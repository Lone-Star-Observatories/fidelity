// Archive band maps and whole-disc images for the spectrum filter (#28), cached on disk like the
// other band imagery (server/bandimages.js: same cache folder, same upstream queue):
//   GET /api/band-archive?id=moon-diviner-noon[&size=preview]
//     a global equirectangular PNG (longitude −180…180 left to right, north up, transparent where
//     there is no data) built from an archive product named in src/data/bandarchive.js:
//       trek  NASA Solar System Treks WMTS tiles mosaicked (zoom 0 = 512×256 is the preview);
//       img8  a PDS 8-bit simple-cylindrical raster (0 = no data);
//       bins  a PDS ASCII table of binned values, drawn grey (min → black, max → white).
//   GET /api/band-disc?id=webb-jupiter-2022[&size=preview]
//     a whole-disc image (JPEG/PNG as published; the preview is the publisher's own small rendition).
// Only ids in BODY_BAND can be asked for, and only from the archive hosts below (not an open proxy).
// PNG decoding and encoding are dependency-free (server/png.js).

import { BODY_BAND } from '../src/data/bands.js';
import { cachedImage, queued, PREVIEW } from './bandimages.js';
import { decodePng, encodePng, resample, isPng } from './png.js';

const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const all = Object.values(BODY_BAND).flatMap((m) => Object.values(m));
const ARCHIVE = new Map(all.filter((s) => s.archive).map((s) => [s.archive.id, s.archive]));
const DISC = new Map(all.filter((s) => s.disc).map((s) => [s.disc.id, s.disc]));
export const HOSTS = /^https:\/\/(pds-geosciences\.wustl\.edu|trek\.nasa\.gov|cdn\.esawebb\.org|cdn\.esahubble\.org)\//;
const YEAR = 365 * 86400000;
const isPreview = (size) => size === 'preview';
const notFound = (what) => Object.assign(new Error(`unknown ${what}`), { status: 404 });

async function get(url, ms = 120000) {
  if (!HOSTS.test(url)) throw Object.assign(new Error('host not allowed'), { status: 403 });
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw Object.assign(new Error(`upstream HTTP ${res.status}`), { status: res.status === 404 ? 404 : 502 });
  return Buffer.from(await res.arrayBuffer());
}

/** Trek WMTS (EQ tile matrix: 2^(z+1) × 2^z tiles of 256 px from −180°, 90°) mosaicked to one image. */
export async function trekMosaic(layer, z, fetchTile = (r, c) => get(`https://trek.nasa.gov/tiles/${layer}/1.0.0/default/default028mm/${z}/${r}/${c}.png`, 60000)) {
  const nx = 2 ** (z + 1), ny = 2 ** z, W = nx * 256, H = ny * 256, data = new Uint8Array(W * H * 4);
  const jobs = [];
  let got = 0;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) jobs.push([r, c]);
  for (let i = 0; i < jobs.length; i += 4) { // a few tiles at a time
    await Promise.all(jobs.slice(i, i + 4).map(async ([r, c]) => {
      let t;
      try { t = decodePng(await fetchTile(r, c)); got++; } catch (err) { if (err.status === 404) return; throw err; } // a missing tile: no data
      for (let y = 0; y < Math.min(256, t.height); y++) data.set(t.data.subarray(y * t.width * 4, y * t.width * 4 + Math.min(256, t.width) * 4), ((r * 256 + y) * W + c * 256) * 4);
    }));
  }
  if (!got) throw Object.assign(new Error(`no tiles for ${layer} at zoom ${z}`), { status: 404 });
  return { width: W, height: H, data };
}

/** A PDS 8-bit raster (rows north → south, longitude −180…180), 0 = no data, as grey RGBA. */
export function img8ToRgba(buf, width, height) {
  if (buf.length < width * height) throw new Error(`raster is ${buf.length} bytes, expected ${width * height}`);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) { const v = buf[i]; data.set([v, v, v, v ? 255 : 0], i * 4); }
  return { width, height, data };
}

/**
 * A PDS ASCII table of binned values as a grey equirectangular map (W×H, longitude −180…180).
 * cols: [latLo, latHi, lonLo, lonHi, value] (boxes) or [lat, lon, value] with `cell` degrees (a grid of
 * centres, interpolated bilinearly). Values ≥ 9999 are no data. Returns { width, height, data, min, max }.
 */
export function binsToRgba(text, { cols, cell }, W, H) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/).map(Number);
    if (f.length <= Math.max(...cols) || f.some((x, i) => cols.includes(i) && !Number.isFinite(x))) continue;
    rows.push(cols.map((i) => f[i]));
  }
  const vals = rows.map((r) => r[r.length - 1]).filter((v) => v < 9999);
  if (!vals.length) throw new Error('no values in table');
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const grid = new Float32Array(W * H).fill(NaN);
  const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  if (cell) {
    const nx = Math.round(360 / cell), ny = Math.round(180 / cell), g = new Float32Array(nx * ny).fill(NaN);
    for (const [lat, lon, v] of rows) {
      const i = Math.floor((wrap(lon) + 180) / cell), j = Math.floor((90 - lat) / cell);
      if (i >= 0 && i < nx && j >= 0 && j < ny && v < 9999) g[j * nx + i] = v;
    }
    for (let y = 0; y < H; y++) {
      const gy = ((y + 0.5) / H) * ny - 0.5, j0 = Math.max(0, Math.floor(gy)), j1 = Math.min(ny - 1, j0 + 1), fy = Math.min(1, Math.max(0, gy - j0));
      for (let x = 0; x < W; x++) {
        const gx = ((x + 0.5) / W) * nx - 0.5, i0 = Math.floor(gx), fx = gx - i0, a = (i0 + nx) % nx, b = (i0 + 1) % nx;
        const q = [[g[j0 * nx + a], (1 - fx) * (1 - fy)], [g[j0 * nx + b], fx * (1 - fy)], [g[j1 * nx + a], (1 - fx) * fy], [g[j1 * nx + b], fx * fy]];
        let s = 0, w = 0;
        for (const [v, k] of q) if (!Number.isNaN(v)) { s += v * k; w += k; }
        if (w > 0.25) grid[y * W + x] = s / w; // edges of the data fade out instead of smearing
      }
    }
  } else {
    for (const [la0, la1, lo0, lo1, v] of rows) {
      if (!(v < 9999)) continue;
      const y0 = Math.max(0, Math.floor(((90 - Math.max(la0, la1)) / 180) * H)), y1 = Math.min(H, Math.ceil(((90 - Math.min(la0, la1)) / 180) * H));
      const span = ((lo1 - lo0) + 360) % 360 || 360, start = wrap(lo0);
      const x0 = Math.floor(((start + 180) / 360) * W), x1 = Math.ceil(((start + span + 180) / 360) * W);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y * W + (x % W)] = v;
    }
  }
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = grid[i];
    if (Number.isNaN(v)) continue;
    const g = Math.round(((v - min) / span) * 255);
    data.set([g, g, g, 255], i * 4);
  }
  return { width: W, height: H, data, min, max };
}

// a table or raster is downloaded once and shared by the preview and the full map
const raw = (url) => cachedImage(`raw|${url}`, YEAR, () => get(url)).then((r) => r.body);

async function buildArchive(a, pre) {
  const [W, H] = pre ? PREVIEW.body : [1024, 512];
  if (a.kind === 'trek') {
    const z = pre ? 0 : a.zoom ?? 0;
    return { img: await trekMosaic(a.layer, z) };
  }
  if (a.kind === 'img8') {
    const img = img8ToRgba(await raw(a.url), a.width, a.height);
    return { img: pre ? resample(img, W, H) : img };
  }
  if (a.kind === 'bins') {
    const t = binsToRgba((await raw(a.url)).toString('latin1'), a, W, H);
    return { img: t };
  }
  throw new Error(`unknown archive kind ${a.kind}`);
}

/** GET /api/band-archive?id=…: an archive product as an equirectangular PNG. */
export async function archiveImage(id, size = '') {
  const a = ARCHIVE.get(id);
  if (!a) throw notFound('archive map');
  const pre = isPreview(size);
  const { body, cache } = await cachedImage(`archive|${id}${pre ? '|preview' : ''}`, YEAR, () => queued(async () => {
    const out = await buildArchive(a, pre);
    return encodePng(out.img.width, out.img.height, out.img.data);
  }, pre));
  const w = body.readUInt32BE(16), h = body.readUInt32BE(20);
  return { body, type: 'image/png', maxAge: 86400, headers: { 'x-band-cache': cache, 'x-band-kind': `archive-${a.kind}`, 'x-band-size': `${w}x${h}` } };
}

const isJpeg = (b) => b?.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
/** GET /api/band-disc?id=…: a whole-disc image as published (JPEG or PNG checked). */
export async function discImage(id, size = '') {
  const d = DISC.get(id);
  if (!d) throw notFound('disc image');
  const pre = isPreview(size) && d.preview;
  const { body, cache } = await cachedImage(`disc|${id}${pre ? '|preview' : ''}`, YEAR, () => queued(async () => {
    const b = await get(pre ? d.preview : d.url, 120000);
    if (!isJpeg(b) && !isPng(b)) throw Object.assign(new Error('upstream did not send an image'), { status: 502 });
    return b;
  }, !!pre));
  return { body, type: isPng(body) ? 'image/png' : 'image/jpeg', maxAge: 86400, headers: { 'x-band-cache': cache, 'x-band-kind': 'disc' } };
}

export const archiveIds = () => [...ARCHIVE.keys()];
export const discIds = () => [...DISC.keys()];
