// Archive band maps and whole-disc images for the spectrum filter (#28), cached on disk like the
// other band imagery (server/bandimages.js: same cache folder, same upstream queue):
//   GET /api/band-archive?id=moon-diviner-noon[&size=preview]
//     a global equirectangular PNG (longitude −180…180 left to right, north up, transparent where
//     there is no data) built from an archive product named in src/data/bandarchive.js:
//       trek  NASA Solar System Treks WMTS tiles mosaicked (zoom 0 = 512×256 is the preview);
//       img8  a PDS 8-bit simple-cylindrical raster (0 = no data);
//       bins  a PDS ASCII table of binned values, drawn grey (1st percentile → black, 99th → white,
//             clipped beyond: a robust stretch, so a few extreme bins do not flatten the rest).
//   GET /api/band-archive?id=…&meta=1  (#72)
//     the map's physical scale as JSON: { id, kind, scale: { min, max, unit, what, … } | null }, grey
//     0 → min, 255 → max, linear. Tables: the stretch the image was drawn with (computed from the table,
//     cached beside the image); the XRS raster and Diviner: the product's documented scaling
//     (`scale` in src/data/bandarchive.js).
//   GET /api/band-disc?id=webb-jupiter-2022[&size=preview]
//     a whole-disc image (JPEG/PNG as published; the preview is the publisher's own small rendition,
//     or the image itself where the publisher's thumbnail is a crop, e.g. Chandra's).
// Only ids in BODY_BAND can be asked for, and only from the archive hosts below (not an open proxy).
// PNG decoding and encoding are dependency-free (server/png.js).

import { BODY_BAND } from '../src/data/bands.js';
import { cachedImage, queued, PREVIEW } from './bandimages.js';
import { decodePng, encodePng, resample, isPng } from './png.js';

const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const all = Object.values(BODY_BAND).flatMap((m) => Object.values(m));
const ARCHIVE = new Map(all.filter((s) => s.archive).map((s) => [s.archive.id, s.archive]));
const DISC = new Map(all.filter((s) => s.disc).map((s) => [s.disc.id, s.disc]));
export const HOSTS = /^https:\/\/(pds-geosciences\.wustl\.edu|trek\.nasa\.gov|cdn\.esawebb\.org|cdn\.esahubble\.org|chandra\.harvard\.edu|storage\.noirlab\.edu)\//;
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

/** Parse a PDS ASCII table of binned values: rows of the `cols` fields (the value last), malformed lines skipped. */
export function parseBins(text, cols) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/).map(Number);
    if (f.length <= Math.max(...cols) || f.some((x, i) => cols.includes(i) && !Number.isFinite(x))) continue;
    rows.push(cols.map((i) => f[i]));
  }
  return rows;
}
const isValue = (v) => v < 9999; // 9999.999 is the tables' NOT_APPLICABLE_CONSTANT: no data
/** The p-quantile (0…1) of sorted numbers, linearly interpolated. */
export function quantile(sorted, p) {
  const x = (sorted.length - 1) * p, i = Math.floor(x), f = x - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}
/** The grey stretch of a table (#72): its bins' 1st → 99th percentile (grey 0 → 255), and their full range. */
export const STRETCH = { lo: 0.01, hi: 0.99, version: 'p1-p99' };
export function binsStretch(vals) {
  const v = vals.filter(isValue).sort((a, b) => a - b);
  if (!v.length) throw new Error('no values in table');
  let min = quantile(v, STRETCH.lo), max = quantile(v, STRETCH.hi);
  if (!(max > min)) { min = v[0]; max = v[v.length - 1]; } // nearly flat: the full range
  return { min, max, dataMin: v[0], dataMax: v[v.length - 1], n: v.length };
}

/**
 * A PDS ASCII table of binned values as a grey equirectangular map (W×H, longitude −180…180).
 * cols: [latLo, latHi, lonLo, lonHi, value] (boxes) or [lat, lon, value] with `cell` degrees (a grid of
 * centres, interpolated bilinearly). Values ≥ 9999 are no data. Grey is linear from the 1st percentile
 * of the values (black) to the 99th (white), clipped beyond (binsStretch). Returns { width, height, data,
 * min, max, dataMin, dataMax, n }: min and max are the values at grey 0 and 255, in the table's units.
 */
export function binsToRgba(text, { cols, cell }, W, H) {
  const rows = parseBins(text, cols);
  const st = binsStretch(rows.map((r) => r[r.length - 1]));
  const { min, max } = st, span = max - min || 1;
  const grid = new Float32Array(W * H).fill(NaN);
  const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  if (cell) {
    const nx = Math.round(360 / cell), ny = Math.round(180 / cell), g = new Float32Array(nx * ny).fill(NaN);
    for (const [lat, lon, v] of rows) {
      const i = Math.floor((wrap(lon) + 180) / cell), j = Math.floor((90 - lat) / cell);
      if (i >= 0 && i < nx && j >= 0 && j < ny && isValue(v)) g[j * nx + i] = v;
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
      if (!isValue(v)) continue;
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
    const g = Math.round(Math.min(1, Math.max(0, (v - min) / span)) * 255);
    data.set([g, g, g, 255], i * 4);
  }
  return { width: W, height: H, data, ...st };
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

// a table's image is keyed by its stretch, so a cached map never disagrees with its scale (#72)
const imageKey = (id, a, pre) => `archive|${id}${a.kind === 'bins' ? `|${STRETCH.version}` : ''}${pre ? '|preview' : ''}`;

/** GET /api/band-archive?id=…: an archive product as an equirectangular PNG. */
export async function archiveImage(id, size = '') {
  const a = ARCHIVE.get(id);
  if (!a) throw notFound('archive map');
  const pre = isPreview(size);
  const { body, cache } = await cachedImage(imageKey(id, a, pre), YEAR, () => queued(async () => {
    const out = await buildArchive(a, pre);
    return encodePng(out.img.width, out.img.height, out.img.data);
  }, pre));
  const w = body.readUInt32BE(16), h = body.readUInt32BE(20);
  return { body, type: 'image/png', maxAge: 86400, headers: { 'x-band-cache': cache, 'x-band-kind': `archive-${a.kind}`, 'x-band-size': `${w}x${h}` } };
}

/**
 * The physical scale of an archive map (#72): grey 0 → min, 255 → max, linear, in `unit` (of `what`).
 * The entry's `scale` (src/data/bandarchive.js) gives the unit and, for a raster or a Trek layer, the
 * documented min/max and where they come from; a table's min/max are the stretch its image was drawn
 * with (binsStretch), times `factor` (the table's units → the unit shown).
 */
export function scaleOf(a, stretch = null) {
  if (!a.scale) return null;
  const { factor = 1, ...s } = a.scale;
  if (a.kind !== 'bins') return { ...s, stretch: 'documented' };
  const r = (x) => Number((x * factor).toPrecision(6));
  return { ...s, min: r(stretch.min), max: r(stretch.max), dataMin: r(stretch.dataMin), dataMax: r(stretch.dataMax), bins: stretch.n, stretch: STRETCH.version };
}

/** GET /api/band-archive?id=…&meta=1: { id, kind, scale } (scale null for a map without one, e.g. Titan's VIMS mosaics). */
export async function archiveMeta(id) {
  const a = ARCHIVE.get(id);
  if (!a) throw notFound('archive map');
  if (a.kind !== 'bins') return { id, kind: a.kind, scale: scaleOf(a) };
  // computed from the same downloaded table as the image, cached beside it
  const { body } = await cachedImage(`archive-meta|${id}|${STRETCH.version}`, YEAR, () => queued(async () => {
    const rows = parseBins((await raw(a.url)).toString('latin1'), a.cols);
    return Buffer.from(JSON.stringify(scaleOf(a, binsStretch(rows.map((r) => r[r.length - 1])))));
  }, true));
  return { id, kind: a.kind, scale: JSON.parse(body.toString('utf8')) };
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
