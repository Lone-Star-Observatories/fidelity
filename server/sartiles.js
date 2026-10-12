// Venus' radar ground close up (#83): Magellan SAR backscatter tiles for the terrain chunks near the camera.
//
//   GET /api/sar-tile/venus/<z>/<x>/<y>  → 256×256 8-bit greyscale PNG, the same addressing as /api/dem-tile
//       (level z: 4·2^z × 2·2^z tiles of 90°/2^z, x from 180° W, y from 90° N). Cached for good under data/cache/sar.
//
// Levels 3–4 come from the C3-MIDR global mosaic (2025 m/px), 5–7 from the left-look global mosaic at 225 m/px and
// level 8 from the 75 m/px one (USGS Astrogeology; 13 and 117 GB BigTIFFs, uncompressed, one row per strip): each
// tile is range-read row by row and box-averaged over a few source pixels per cell (SAR speckle would alias
// otherwise), so nothing is downloaded whole. The 225/75 m mosaics stop at 84° N and 80° S; black (0) is no data, as
// in the global map. Public domain (NASA/JPL Magellan, USGS).

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { openTiff, httpRange, partPixel, tileBounds, TILE } from './dem.js';
import { greyPng } from './tiff.js';

const USGS = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/';
const R_M = 6051000; // the mosaics' sphere: their tie points put 180° at −19,009,776 m
const degOf = (m) => (m / (Math.PI * R_M)) * 180;
// latTop / latH from each file's GeoTIFF tie point and height × pixel size
const SAR = {
  venus: [
    { minLevel: 3, url: `${USGS}Venus_Magellan_C3-MDIR_Global_Mosaic_2025m.tif`, latTop: 90, latH: 180, lonWest: -180, lonSpan: 360, ppd: 52.2 },
    { minLevel: 5, url: `${USGS}Venus_Magellan_LeftLook_mosaic_global_225m.tif`, latTop: degOf(8871191.6025), latH: degOf(76983 * 225), lonWest: -180, lonSpan: 360, ppd: 469.4 },
    { minLevel: 8, url: `${USGS}Venus_Magellan_LeftLook_mosaic_global_75m.tif`, latTop: degOf(8871191.6025), latH: degOf(230948 * 75), lonWest: -180, lonSpan: 360, ppd: 1408.1 },
  ],
};
export const SAR_LEVELS = { venus: { min: 3, max: 8 } };
export const SAR_CREDIT = 'NASA/JPL Magellan SAR; USGS Astrogeology global mosaics (C3-MIDR 2025 m, left-look 225 m and 75 m), public domain';

/** The mosaic serving level z (the finest whose minLevel ≤ z). */
export const sarSource = (body, z) => (SAR[body] ?? []).filter((s) => z >= s.minLevel).sort((a, b) => b.minLevel - a.minLevel)[0] ?? null;
/** Source pixels averaged per tile cell along each axis: what spans a cell, capped (rows cost one request each). */
export const sarBox = (srcPpd, z) => Math.max(1, Math.min(3, Math.round(srcPpd / ((TILE * 2 ** z) / 90))));

const opened = new Map();
const open = (s) => {
  if (!opened.has(s.url)) opened.set(s.url, openTiff({ format: 'tiff', lonWest: s.lonWest, nodata: null }, httpRange(s.url)).catch((e) => { opened.delete(s.url); throw e; }));
  return opened.get(s.url);
};

async function buildTile(s, z, x, y) {
  const r = await open(s), b = tileBounds(z, x, y), cell = b.deg / TILE, k = sarBox(s.ppd, z);
  const sum = new Float32Array(TILE * TILE), cnt = new Uint16Array(TILE * TILE), jobs = [];
  for (let j = 0; j < TILE; j++) {
    for (let a = 0; a < k; a++) {
      const lat = b.north - (j + (a + 0.5) / k) * cell;
      const cols = [];
      let row = -1;
      for (let i = 0; i < TILE; i++) for (let c = 0; c < k; c++) {
        const px = partPixel(s, r.W, r.H, lat, b.west + (i + (c + 0.5) / k) * cell);
        if (px) { row = px.y; cols.push([j * TILE + i, px.x]); }
      }
      if (!cols.length) continue;
      const xs = cols.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const put = (vals, off) => { for (const [o, px] of cols) { const v = vals[px - off]; if (v > 0) { sum[o] += v; cnt[o]++; } } };
      if (x1 - x0 > r.W / 2) jobs.push(async () => put(await r.row(row), 0));
      else jobs.push(async () => put(await r.row(row, x0, x1), x0));
    }
  }
  let next = 0;
  await Promise.all(Array.from({ length: 16 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  const px = new Uint8Array(TILE * TILE);
  for (let i = 0; i < px.length; i++) px[i] = cnt[i] ? Math.round(sum[i] / cnt[i]) : 0;
  return greyPng(px, TILE, TILE);
}

const inflight = new Map();
/** The PNG for SAR tile (body, z, x, y), from the disk cache or built from the mosaics. */
export async function sarTile(body, z, x, y) {
  const lv = SAR_LEVELS[body];
  z = Number(z); x = Number(x); y = Number(y);
  if (!lv) throw Object.assign(new Error(`no radar tiles for ${body}`), { status: 404 });
  if (!(z >= lv.min && z <= lv.max && x >= 0 && x < 4 * 2 ** z && y >= 0 && y < 2 * 2 ** z)) throw Object.assign(new Error(`tile out of range (levels ${lv.min}–${lv.max})`), { status: 400 });
  const file = path.join(config.dataDir, 'cache', 'sar', body, `${z}-${x}-${y}.png`);
  try { return { body: await fs.readFile(file), type: 'image/png', maxAge: 31536000 }; } catch { /* build it */ }
  if (!inflight.has(file)) {
    inflight.set(file, (async () => {
      const png = await buildTile(sarSource(body, z), z, x, y);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.part`, png);
      await fs.rename(`${file}.part`, file);
      return png;
    })().finally(() => inflight.delete(file)));
  }
  return { body: await inflight.get(file), type: 'image/png', maxAge: 31536000 };
}
