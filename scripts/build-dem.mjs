// Build the bundled elevation models (#80): fetch each body's measured DEM once (PDS Geosciences,
// USGS Astrogeology, NOAA ERDDAP; all public domain), box-average it onto the app's grid
// (equirectangular, 180° W at the left, east-positive, north up; src/astro/dem.js), quantise to a
// 16-bit greyscale PNG and record min/max metres, reference surface, resolution and credit in
// public/dem/index.json. Normal maps are derived from these heights on the GPU (materials.js), so
// one file serves every exaggeration.
//
//   node scripts/build-dem.mjs                 every body in server/dem.js DEM_SOURCES
//   node scripts/build-dem.mjs mars moon       just these
//   --width=2880                               output width (height = width / 2); default per body
//   --raw=<dir>                                where downloads are kept (default data/dem-raw, git-ignored)
//
// Raw products are large (Pluto's is 620 MB); they are downloaded once and never committed.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEM_SOURCES, openRaster, fileRange, rasterToGrid, etopoFromNc, png16 } from '../server/dem.js';
import { quantize, filter16, quantStep } from '../src/astro/dem.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const only = args.filter((a) => !a.startsWith('--'));
const rawDir = path.resolve(root, opt('raw', 'data/dem-raw'));
const outDir = path.join(root, 'public', 'dem');
// 0.25° everywhere (≈ 15 km on Mars, 7.6 km on the Moon): the bundle stays ~1–2 MB per body;
// /api/dem-tile serves the full-resolution products close up.
const WIDTH = { default: 1440 };

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  console.log(`  downloading ${url}`);
  execFileSync('curl', ['-sSfL', '--retry', '3', '-o', `${file}.part`, url], { stdio: 'inherit' });
  await fsp.rename(`${file}.part`, file);
  return file;
}

/** ETOPO1 (grid-registered, ascending latitude) box-averaged onto the canonical grid. */
function etopoToGrid(g, W, H) {
  const sum = new Float64Array(W * H), cnt = new Uint32Array(W * H), nl = g.lons.length;
  for (let j = 0; j < g.lats.length; j++) {
    const Y = Math.min(H - 1, Math.max(0, Math.floor(((90 - g.lats[j]) / 180) * H)));
    for (let i = 0; i < nl; i++) {
      if (g.lons[i] >= 180) continue; // −180 and +180 are the same meridian
      const X = Math.min(W - 1, Math.floor(((g.lons[i] + 180) / 360) * W)), v = g.z[j * nl + i];
      if (v === v) { sum[Y * W + X] += v; cnt[Y * W + X]++; }
    }
  }
  const out = new Float32Array(W * H);
  for (let k = 0; k < out.length; k++) out[k] = cnt[k] ? sum[k] / cnt[k] : NaN;
  return out;
}

async function build(id, src) {
  const W = Number(opt('width', src.width ?? WIDTH.default)), H = W / 2; // never finer than the source (Enceladus: 720)
  console.log(`${id}: ${src.name} → ${W}×${H}`);
  let heights, sourceUrl;
  if (src.format === 'erddap') {
    const stride = src.stride ?? 4;
    sourceUrl = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude%5B(-90):${stride}:(90)%5D%5B(-180):${stride}:(180)%5D`;
    const file = await download(sourceUrl, path.join(rawDir, `etopo180_s${stride}.nc`));
    heights = etopoToGrid(etopoFromNc(await fsp.readFile(file)), W, H);
  } else {
    const g = src.global;
    sourceUrl = g.url;
    const file = await download(g.url, path.join(rawDir, path.basename(new URL(g.url).pathname)));
    const read = await fileRange(file);
    const r = await openRaster(g, read);
    heights = await rasterToGrid(r, W, H, (f) => process.stdout.write(`\r  ${Math.round(f * 100)}%`));
    process.stdout.write('\r');
    await read.close();
  }
  let valid = 0;
  for (const h of heights) if (h === h) valid++;
  const q = quantize(heights);
  const png = png16(W, H, filter16(q.data, W, H), { min: String(q.min), max: String(q.max), body: id });
  await fsp.mkdir(outDir, { recursive: true });
  await fsp.writeFile(path.join(outDir, `${id}.png`), png);
  const cellKm = (2 * Math.PI * src.refRadiusKm) / W;
  console.log(`  ${q.min} … ${q.max} m, ${(100 * valid / heights.length).toFixed(1)}% covered, ${(png.length / 1e6).toFixed(2)} MB`);
  return {
    file: `${id}.png`, width: W, height: H, min: q.min, max: q.max, quantStepM: Number(quantStep(q.min, q.max).toFixed(3)),
    cellKm: Number(cellKm.toFixed(2)), coverage: Number((valid / heights.length).toFixed(4)), bytes: png.length,
    name: src.name, instrument: src.instrument, ref: src.ref, refRadiusKm: src.refRadiusKm, sourcePpd: src.ppd,
    credit: src.credit, licence: src.licence, source: sourceUrl, partial: src.partial ?? null, shading: src.shading ?? 'all',
  };
}

const indexFile = path.join(outDir, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { bodies: {} };
for (const [id, src] of Object.entries(DEM_SOURCES)) {
  if (only.length && !only.includes(id)) continue;
  index.bodies[id] = { ...(await build(id, src)), built: new Date().toISOString().slice(0, 10) };
}
index.convention = 'Equirectangular, pixel-is-area, row 0 at 90° N, column 0 starting at 180° W, east-positive planetocentric longitude; 16-bit grey: 0 = no data, 1…65535 = min…max metres above `ref`.';
index.bodies = Object.fromEntries(Object.entries(index.bodies).sort(([a], [b]) => a.localeCompare(b)));
await fsp.writeFile(indexFile, `${JSON.stringify(index, null, 1)}\n`);
console.log(`wrote ${path.relative(root, indexFile)}`);
