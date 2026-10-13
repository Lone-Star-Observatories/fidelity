// Earth's clouds at measured heights (#83): NASA GIBS's NOAA-20 VIIRS Cloud Top Height (day) and the true-colour
// mosaic of the same satellite and day, so that where a cloud is, how white it is and how high its top is all come
// from the same overpasses.
//
//   GET /api/earth-clouds/heights        → 2048×1024 8-bit greyscale PNG, equirectangular (−180…180°, north up):
//       0 = no cloud retrieved (clear sky, or no data), v = 1…255 → cloud top (v − 1) × 50 m + 25 m (≥ 12 km in 241+).
//       Header x-cloud-date: the day (the newest of the last few days that GIBS has published; it lags 1–3 days).
//   GET /api/earth-clouds/colour?date=YYYY-MM-DD → that day's NOAA-20 VIIRS true-colour mosaic (2048×1024 JPEG).
//
// GIBS serves the heights as a colour-mapped PNG; its published colour map (50 m bins) turns colours back into
// metres. Cached on disk per day (data/cache/earthclouds). NASA imagery, no restrictions (credit NASA GIBS/Worldview).

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { decodePng } from './pngdecode.js';
import { greyPng } from './tiff.js';

const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
export const CTH_LAYER = 'VIIRS_NOAA20_Cloud_Top_Height_Day';
export const TC_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
const COLORMAP = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_VIIRS_Cloud_Top_Height.xml';
export const CLOUD_CREDIT = 'NASA GIBS: NOAA-20 VIIRS Cloud Top Height (day, CLDPROP) and corrected reflectance, the same overpasses';
export const STEP_M = 50;
const W = 2048, H = 1024;
const dir = () => path.join(config.dataDir, 'cache', 'earthclouds');
const isoDay = (d) => d.toISOString().slice(0, 10);

/** Parse a GIBS colour map (v1.3 XML): [{ rgb: [r, g, b], lo, hi, nodata }] with lo/hi in the map's units (metres). */
export function parseColormap(xml) {
  const out = [];
  for (const m of xml.matchAll(/<ColorMapEntry\b([^>]*)\/>/g)) {
    const a = m[1], rgb = a.match(/rgb="(\d+),(\d+),(\d+)"/), v = a.match(/value="\[([-0-9.e+INF]+),([-0-9.e+INF]+)\)"/);
    if (!rgb) continue;
    const nodata = /nodata="true"/.test(a) || /transparent="true"/.test(a);
    const num = (s) => (s === '+INF' ? Infinity : s === '-INF' ? -Infinity : Number(s));
    out.push({ rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], lo: v ? num(v[1]) : NaN, hi: v ? num(v[2]) : NaN, nodata });
  }
  return out;
}

/** rgb (packed 0xRRGGBB) → height in metres (bin centre; the open top bin at its lower edge + one step); nodata → absent. */
export function heightLookup(entries) {
  const map = new Map();
  for (const e of entries) {
    if (e.nodata || !Number.isFinite(e.lo)) continue;
    map.set((e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2], Number.isFinite(e.hi) ? (e.lo + e.hi) / 2 : e.lo + STEP_M / 2);
  }
  return map;
}

/** Height (m) → the 8-bit code of /api/earth-clouds/heights, and back (null for 0 = no cloud). */
export const encodeHeight = (m) => Math.max(1, Math.min(255, 1 + Math.floor(Math.max(0, m) / STEP_M)));
export const decodeHeight = (v) => (v > 0 ? (v - 1) * STEP_M + STEP_M / 2 : null);

/** RGBA pixels of the GIBS product → 8-bit height codes (transparent or unknown colours → 0). */
export function encodeHeights(rgba, lookup) {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const m = lookup.get((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
    if (m !== undefined) out[i] = encodeHeight(m);
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`GIBS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
const wms = (layer, day, format) => `${WMS}?${new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, CRS: 'EPSG:4326', BBOX: '-90,-180,90,180', WIDTH: String(W), HEIGHT: String(H), FORMAT: format, TIME: day })}`;

let lookupP = null;
const lookup = () => (lookupP ??= (async () => {
  const f = path.join(dir(), 'colormap-cth.xml');
  let xml;
  try { xml = await fs.readFile(f, 'utf8'); } catch {
    xml = (await get(COLORMAP)).toString('utf8');
    await fs.mkdir(dir(), { recursive: true });
    await fs.writeFile(f, xml);
  }
  const m = heightLookup(parseColormap(xml));
  if (m.size < 100) throw new Error('cloud-top colour map not understood');
  return m;
})().catch((e) => { lookupP = null; throw e; }));

async function cached(name, make) {
  const f = path.join(dir(), name);
  try { return await fs.readFile(f); } catch { /* make it */ }
  const buf = await make();
  if (!buf) return null;
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(`${f}.part`, buf);
  await fs.rename(`${f}.part`, f);
  return buf;
}

/** The heights PNG for `day`, or null when GIBS has not published that day yet (an almost empty image). */
async function heightsFor(day) {
  return cached(`${day}-cth.png`, async () => {
    const { rgba } = decodePng(await get(wms(CTH_LAYER, day, 'image/png')));
    const codes = encodeHeights(rgba, await lookup());
    let n = 0;
    for (const v of codes) if (v) n++;
    if (n < codes.length * 0.15) return null; // not published yet (or only a sliver): try an earlier day
    return greyPng(codes, W, H);
  });
}

let latest = null; // { day, at, body }
/** The newest published day's heights (checked at most every 3 hours): { day, body }. */
export async function latestHeights(now = Date.now()) {
  if (latest && now - latest.at < 3 * 3600000) return latest;
  for (let back = 1; back <= 5; back++) {
    const day = isoDay(new Date(now - back * 86400000));
    const body = await heightsFor(day).catch(() => null);
    if (body) { latest = { day, at: now, body }; return latest; }
  }
  throw Object.assign(new Error('no recent cloud-top heights from GIBS'), { status: 502 });
}

/** Route handler: part 'heights' | 'colour'. */
export async function earthClouds(part, q) {
  if (part === 'heights') {
    const { day, body } = await latestHeights();
    return { body, type: 'image/png', maxAge: 3600, headers: { 'x-cloud-date': day, 'x-cloud-credit': encodeURIComponent(CLOUD_CREDIT) } };
  }
  if (part === 'colour') {
    const day = q?.get('date') || '';
    const t = Date.parse(`${day}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(t <= Date.now() && Date.now() - t < 12 * 86400000)) throw Object.assign(new Error('date must be one of the last few days'), { status: 400 });
    const body = await cached(`${day}-tc.jpg`, () => get(wms(TC_LAYER, day, 'image/jpeg')));
    return { body, type: 'image/jpeg', maxAge: 86400, headers: { 'x-cloud-date': day } };
  }
  throw Object.assign(new Error('unknown part'), { status: 404 });
}
