// Elevation models (#80): where each body's measured DEM lives, a reader for its raw form (PDS IMG,
// uncompressed GeoTIFF, ERDDAP netCDF) through any byte-range source (a local file for the build
// script, HTTP range requests here), and the cached tile route behind the close-up relief:
//
//   GET /api/dem-tile/<body>/<z>/<x>/<y>  → 256×256 16-bit greyscale PNG of heights (metres),
//       the tile covering lon −180 + x·s … +s, lat 90 − y·s … −s with s = 90° / 2^z;
//       tEXt "min"/"max" give the quantisation (src/astro/dem.js). Cached for good under data/cache/dem.
//   GET /api/dem-info → per body: source, credit, finest tile level.
//
// The global grids bundled in public/dem are made from the same table by scripts/build-dem.mjs.
// Dependency-free (node:zlib); upstreams are public-domain NASA/USGS/NOAA products.

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.js';
import { readNetcdf } from './netcdf.js';
import { quantize, filter16 } from '../src/astro/dem.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const PDS = 'https://pds-geosciences.wustl.edu/';
const USGS = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/';
const ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180';

// format: 'img' (headerless PDS image) | 'tiff' (uncompressed strips) | 'erddap'.
// lonWest: east longitude of the raster's west edge; rasters run 90° N → 90° S.
// value = raw × scale + offset (metres above `ref`); `parts` tile a product split into files.
const MOLA64 = ['90n000', '90n180', '00n000', '00n180'].map((p) => ({
  url: `${PDS}mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg064/megt${p}gb.img`, W: 11520, H: 5760,
  latTop: p.startsWith('90') ? 90 : 0, lonWest: Number(p.slice(3)),
}));
export const DEM_SOURCES = {
  earth: {
    name: 'ETOPO1 Ice Surface', instrument: 'NOAA NCEI global relief (SRTM30, GEBCO, IBCAO and more)', ref: 'mean sea level',
    credit: 'NOAA NCEI ETOPO1 Ice Surface (Amante & Eakins 2009), via NOAA CoastWatch ERDDAP', licence: 'US Government work, public domain',
    url: `${ERDDAP}.html`, format: 'erddap', ppd: 60, stride: 4, refRadiusKm: 6371.0, shading: 'land', // the sea stays a flat, shaded-free surface
  },
  moon: {
    name: 'LRO LOLA LDEM', instrument: 'Lunar Orbiter Laser Altimeter (LRO)', ref: '1737.4 km sphere',
    credit: 'NASA/GSFC LRO LOLA Science Team, PDS Geosciences Node (LDEM_16; LDEM_64 tiles)', licence: 'NASA, public domain',
    global: { url: `${PDS}lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img`, format: 'img', W: 5760, H: 2880, type: 'i16', le: true, scale: 0.5, lonWest: 0 },
    hi: { url: `${PDS}lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_64.img`, format: 'img', W: 23040, H: 11520, type: 'i16', le: true, scale: 0.5, lonWest: 0 },
    ppd: 64, refRadiusKm: 1737.4,
  },
  mars: {
    name: 'MGS MOLA MEGDR', instrument: 'Mars Orbiter Laser Altimeter (Mars Global Surveyor)', ref: 'MOLA areoid',
    credit: 'NASA/GSFC MGS MOLA Science Team, PDS Geosciences Node (MEGDR 16 px/°; 64 px/° tiles)', licence: 'NASA, public domain',
    global: { url: `${PDS}mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img`, format: 'img', W: 5760, H: 2880, type: 'i16', le: false, scale: 1, lonWest: 0 },
    hi: { format: 'img', type: 'i16', le: false, scale: 1, ppd: 64, parts: MOLA64 },
    ppd: 64, refRadiusKm: 3396.0,
  },
  mercury: {
    name: 'MESSENGER USGS global DEM v2', instrument: 'MESSENGER MDIS stereo (USGS Astrogeology)', ref: '2439.4 km sphere',
    credit: 'NASA/JHUAPL/Carnegie MESSENGER; USGS Astrogeology global DEM 665 m (Becker et al. 2016)', licence: 'USGS/NASA, public domain',
    global: { url: `${USGS}Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, format: 'tiff', scale: 0.5, lonWest: 0 },
    ppd: 64, refRadiusKm: 2439.4,
  },
  venus: {
    name: 'Magellan global topography', instrument: 'Magellan radar altimeter (GTDR), USGS Astrogeology mosaic', ref: '6051.0 km sphere',
    credit: 'NASA/JPL Magellan altimetry (Ford & Pettengill 1992); USGS Astrogeology global topography 4641 m v2', licence: 'USGS/NASA, public domain',
    global: { url: `${USGS}Venus_Magellan_Topography_Global_4641m_v02.tif`, format: 'tiff', scale: 1, lonWest: -180 },
    ppd: 22.76, refRadiusKm: 6051.0, partial: 'Magellan altimetry has gaps (about 8% of the surface, mostly orbit-to-orbit strips): no data there.', shading: 'none', // the globe shows the cloud tops: relief only in the surface view and read-outs
  },
  ceres: {
    name: 'Dawn HAMO DTM (DLR)', instrument: 'Dawn Framing Camera stereo, HAMO (DLR)', ref: '470 km sphere',
    credit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA Dawn; DLR HAMO global DTM 60 px/° (Preusker et al. 2016), via USGS Astrogeology', licence: 'NASA/DLR, public domain (PDS)',
    global: { url: `${USGS}Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif`, format: 'tiff', scale: 1, lonWest: 0 },
    ppd: 60, refRadiusKm: 470.0,
  },
  vesta: {
    name: 'Dawn HAMO DTM (DLR)', instrument: 'Dawn Framing Camera stereo, HAMO (DLR)', ref: '255 km sphere',
    credit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA Dawn; DLR HAMO global DTM 48 px/° (Preusker et al. 2014), via USGS Astrogeology', licence: 'NASA/DLR, public domain (PDS)',
    global: { url: `${USGS}Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif`, format: 'tiff', scale: 1, offset: -255000, lonWest: -180 }, // the file holds radii
    ppd: 48, refRadiusKm: 255.0,
  },
  pluto: {
    name: 'New Horizons global DEM', instrument: 'New Horizons LORRI/MVIC stereo (Schenk et al. 2018)', ref: '1188.3 km sphere',
    credit: 'NASA/JHUAPL/SwRI New Horizons; global DEM 300 m (Schenk et al. 2018), via USGS Astrogeology', licence: 'NASA, public domain (PDS)',
    global: { url: `${USGS}Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif`, format: 'tiff', scale: 1, lonWest: 0 },
    ppd: 69.1, refRadiusKm: 1188.3, partial: 'The encounter hemisphere only: the far side was seen at low resolution and has no stereo.',
  },
  charon: {
    name: 'New Horizons global DEM', instrument: 'New Horizons LORRI/MVIC stereo (Schenk et al. 2018)', ref: '606 km sphere',
    credit: 'NASA/JHUAPL/SwRI New Horizons; global DEM 300 m (Schenk et al. 2018), via USGS Astrogeology', licence: 'NASA, public domain (PDS)',
    global: { url: `${USGS}Charon_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif`, format: 'tiff', scale: 1, lonWest: -180 },
    ppd: 35.3, refRadiusKm: 606.0, partial: 'The encounter hemisphere only.',
  },
  enceladus: {
    name: 'Cassini ISS shape model (Bland 2019)', instrument: 'Cassini ISS stereo/limb shape model', ref: '251.5 km sphere',
    credit: 'NASA/JPL/SSI Cassini ISS; Enceladus shape model (Bland et al. 2019), USGS Astrogeology', licence: 'NASA/USGS, public domain (PDS)',
    global: { url: `${USGS}Enceladus/enceladus_cassini_iss_shapemodel_bland_2019/enceladus_2019pm_radius.tif`, format: 'tiff', scale: 1, lonWest: 0 }, // radius − 251.5 km, metres
    ppd: 2, refRadiusKm: 251.5, width: 720, partial: 'Near-global at 2 px/° (2.2 km); gaps where Cassini had no stereo.',
  },
};

/** Bodies with no global DEM, and why (the panel says so). */
export const NO_DEM = {
  titan: 'Cassini radar and altimetry cover strips only (~9% of the surface at high resolution); interpolated global maps exist but are not open as a grid here.',
  ganymede: 'No global stereo DEM: Galileo and Voyager stereo cover small areas; JUICE will map it from 2034.',
  europa: 'No global DEM: Galileo stereo of small areas only; Europa Clipper will map it from 2030.',
  callisto: 'No global DEM: limb profiles and local Galileo stereo only.',
  io: 'No global DEM: local Galileo/Voyager stereo (e.g. Tvashtar Paterae) only.',
};

// ---- byte sources -------------------------------------------------------------------------------
/** HTTP range reader for `url` (inclusive byte range). */
export function httpRange(url) {
  return async (start, end) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: { range: `bytes=${start}-${end}`, 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
        if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        return res.status === 200 ? buf.subarray(start, end + 1) : buf;
      } catch (err) { if (attempt >= 2) throw err; }
    }
  };
}

/** Local file reader (the build script). */
export async function fileRange(file) {
  const fh = await fs.open(file, 'r');
  const read = async (start, end) => { const b = Buffer.alloc(end - start + 1); await fh.read(b, 0, b.length, start); return b; };
  read.close = () => fh.close();
  return read;
}

// ---- raster readers -----------------------------------------------------------------------------
/** Open a raster: → { W, H, lonWest, row(y, x0, x1) → Float64Array of metres (NaN = no data) }. */
export async function openRaster(spec, read) {
  if (spec.format === 'img') return openImg(spec, read);
  if (spec.format === 'tiff') return openTiff(spec, read);
  throw new Error(`no reader for ${spec.format}`);
}

function decodeRow(buf, n, type, le, scale, offset, nodata) {
  const out = new Float64Array(n), size = type === 'f32' ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const p = i * size;
    const v = type === 'f32' ? (le ? buf.readFloatLE(p) : buf.readFloatBE(p)) : type === 'u16' ? (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p)) : (le ? buf.readInt16LE(p) : buf.readInt16BE(p));
    out[i] = (nodata != null && v === nodata) || !Number.isFinite(v) || v < -1e30 ? NaN : v * scale + (offset ?? 0);
  }
  return out;
}

function openImg(spec, read) {
  const size = spec.type === 'f32' ? 4 : 2;
  return {
    W: spec.W, H: spec.H, lonWest: spec.lonWest ?? 0,
    async row(y, x0 = 0, x1 = spec.W - 1) {
      const o = (y * spec.W + x0) * size;
      return decodeRow(await read(o, o + (x1 - x0 + 1) * size - 1), x1 - x0 + 1, spec.type, spec.le, spec.scale ?? 1, spec.offset, spec.nodata);
    },
  };
}

/** Uncompressed, strip-organised GeoTIFF (USGS mosaics): int16, uint16 or float32, one sample. */
export async function openTiff(spec, read) {
  const head = await read(0, 15);
  const le = head.toString('latin1', 0, 2) === 'II';
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  if (u16(head, 2) !== 42) throw new Error('not a classic TIFF');
  const ifd = u32(head, 4);
  const n = u16(await read(ifd, ifd + 1), 0);
  const e = await read(ifd + 2, ifd + 2 + n * 12 - 1);
  const tags = {};
  for (let k = 0; k < n; k++) {
    const o = k * 12, type = u16(e, o + 2), count = u32(e, o + 4), size = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8 }[type] ?? 4;
    tags[u16(e, o)] = { type, count, inline: count * size <= 4, raw: e.subarray(o + 8, o + 12), offset: u32(e, o + 8) };
  }
  const scalar = (t) => (t.type === 3 ? u16(t.raw, 0) : u32(t.raw, 0));
  const W = scalar(tags[256]), H = scalar(tags[257]), bits = scalar(tags[258]), fmt = tags[339] ? scalar(tags[339]) : 1;
  if ((tags[259] && scalar(tags[259]) !== 1) || (tags[277] && scalar(tags[277]) !== 1)) throw new Error('compressed or multi-sample TIFF');
  if (tags[322]) throw new Error('tiled TIFF');
  const type = bits === 32 && fmt === 3 ? 'f32' : bits === 16 ? (fmt === 2 ? 'i16' : 'u16') : null;
  if (!type) throw new Error(`unsupported TIFF samples (${bits} bits, format ${fmt})`);
  const rps = tags[278] ? scalar(tags[278]) : H;
  const so = tags[273];
  let strips;
  if (so.inline) strips = [scalar(so)];
  else {
    const size = so.type === 3 ? 2 : 4, b = await read(so.offset, so.offset + so.count * size - 1);
    strips = Array.from({ length: so.count }, (_, i) => (size === 2 ? u16(b, i * 2) : u32(b, i * 4)));
  }
  let nodata = null;
  if (tags[42113]) {
    const t = tags[42113], s = (t.inline ? t.raw.subarray(0, t.count) : await read(t.offset, t.offset + t.count - 1)).toString('latin1').replace(/\0/g, '').trim();
    if (s && Number.isFinite(Number(s))) nodata = Number(s);
  }
  const size = bits / 8;
  return {
    W, H, lonWest: spec.lonWest ?? 0, nodata, type,
    async row(y, x0 = 0, x1 = W - 1) {
      const o = strips[Math.floor(y / rps)] + ((y % rps) * W + x0) * size;
      return decodeRow(await read(o, o + (x1 - x0 + 1) * size - 1), x1 - x0 + 1, type, le, spec.scale ?? 1, spec.offset, type === 'f32' && nodata != null && nodata < -1e30 ? null : nodata);
    },
  };
}

/** ETOPO1 from ERDDAP over a lat/lon box at a stride (arc-minutes) → { lats[], lons[], z: Float64Array lat-major, ascending lat }. */
export async function etopoBox(latS, latN, lonW, lonE, stride = 1) {
  const q = `altitude%5B(${latS}):${stride}:(${latN})%5D%5B(${lonW}):${stride}:(${lonE})%5D`;
  const res = await fetch(`${ERDDAP}.nc?${q}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`ERDDAP HTTP ${res.status}`);
  return etopoFromNc(Buffer.from(await res.arrayBuffer()));
}
export function etopoFromNc(buf) {
  const nc = readNetcdf(buf);
  const lats = Array.from(nc.vars.latitude.values()), lons = Array.from(nc.vars.longitude.values());
  const raw = nc.vars.altitude.values(), fill = nc.vars.altitude.attrs._FillValue?.[0] ?? 32767;
  const z = new Float64Array(raw.length);
  for (let i = 0; i < raw.length; i++) z[i] = raw[i] === fill ? NaN : raw[i];
  return { lats, lons, z };
}

// ---- resampling to the app's grid ---------------------------------------------------------------
/**
 * Box-average a raster onto the canonical grid (W × H, 180° W first, north up), streaming rows.
 * Each source cell lands in the output cell holding its centre; no-data cells are skipped.
 */
export async function rasterToGrid(r, W, H, onProgress) {
  const sum = new Float64Array(W * H), cnt = new Uint32Array(W * H);
  const colOut = new Int32Array(r.W);
  for (let x = 0; x < r.W; x++) {
    const lon = r.lonWest + ((x + 0.5) / r.W) * 360;
    colOut[x] = Math.min(W - 1, Math.floor(((((lon + 180) % 360) + 360) % 360) / 360 * W));
  }
  for (let y = 0; y < r.H; y++) {
    const Y = Math.min(H - 1, Math.floor(((y + 0.5) / r.H) * H)), row = await r.row(y), o = Y * W;
    for (let x = 0; x < r.W; x++) { const v = row[x]; if (v === v) { sum[o + colOut[x]] += v; cnt[o + colOut[x]]++; } }
    if (onProgress && y % 512 === 0) onProgress(y / r.H);
  }
  const heights = new Float32Array(W * H);
  for (let i = 0; i < heights.length; i++) heights[i] = cnt[i] ? sum[i] / cnt[i] : NaN;
  return heights;
}

// ---- 16-bit PNG ---------------------------------------------------------------------------------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(kind, d) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(kind, 'latin1'), d]);
  len.writeUInt32BE(d.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** 16-bit greyscale PNG from filtered scanlines (src/astro/dem.js filter16), with tEXt key/values. */
export function png16(width, height, filtered, text = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 16; ihdr[9] = 0;
  const texts = Object.entries(text).map(([k, v]) => chunk('tEXt', Buffer.from(`${k}\0${v}`, 'latin1')));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...texts,
    chunk('IDAT', zlib.deflateSync(Buffer.from(filtered.buffer, filtered.byteOffset, filtered.length), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- tiles --------------------------------------------------------------------------------------
export const TILE = 256;
const tileDeg = (z) => 90 / 2 ** z;
/** The finest tile level worth serving: no finer than the source (tile px/° ≤ source px/°). */
export const maxLevel = (ppd) => Math.max(0, Math.floor(Math.log2((ppd * 90) / TILE)));

/** Tile (z, x, y) bounds: { west, north, deg } (lon −180…180 east, lat). */
export function tileBounds(z, x, y) {
  const deg = tileDeg(z);
  return { west: -180 + x * deg, north: 90 - y * deg, deg };
}

const opened = new Map(); // url → Promise<raster>
const openRemote = (spec) => {
  const key = spec.url;
  if (!opened.has(key)) opened.set(key, openRaster(spec, httpRange(spec.url)).catch((err) => { opened.delete(key); throw err; }));
  return opened.get(key);
};

/** Point-sample the cells of a tile from a source (nearest source pixel per cell, one ranged read per row). */
async function sampleSource(spec, b) {
  const parts = spec.parts ? spec.parts.map((p) => ({ ...spec, ...p, parts: undefined })) : [spec];
  const out = new Float32Array(TILE * TILE).fill(NaN), cell = b.deg / TILE;
  const jobs = [];
  for (const part of parts) {
    const r = await openRemote(part);
    // a whole-globe raster spans 180° × 360°; MOLA's 64 px/° parts are 90° × 180° each
    const latTop = part.latTop ?? 90, latH = spec.parts ? 90 : 180, lonSpan = spec.parts ? 180 : 360;
    for (let j = 0; j < TILE; j++) {
      const lat = b.north - (j + 0.5) * cell;
      const fy = ((latTop - lat) / latH) * r.H;
      if (fy < 0 || fy >= r.H) continue;
      const y = Math.floor(fy);
      const cols = [];
      for (let i = 0; i < TILE; i++) {
        const lon = b.west + (i + 0.5) * cell;
        const dl = ((((lon - r.lonWest) % 360) + 360) % 360);
        if (dl >= lonSpan) continue;
        cols.push([i, Math.min(r.W - 1, Math.floor((dl / lonSpan) * r.W))]);
      }
      if (!cols.length) continue;
      const xs = cols.map((c) => c[1]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      if (x1 - x0 > r.W / 2) { // the tile straddles the raster's seam: two reads
        jobs.push(async () => { const row = await r.row(y); for (const [i, x] of cols) out[j * TILE + i] = row[x]; });
      } else {
        jobs.push(async () => { const row = await r.row(y, x0, x1); for (const [i, x] of cols) out[j * TILE + i] = row[x - x0]; });
      }
    }
  }
  let next = 0;
  await Promise.all(Array.from({ length: 16 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  return out;
}

async function etopoTile(b) {
  const cell = b.deg / TILE, arcmin = cell * 60, stride = Math.max(1, Math.round(arcmin));
  const s = Math.max(-90, b.north - b.deg + cell / 2), n = Math.min(90, b.north - cell / 2);
  const w = b.west + cell / 2, e = Math.min(180, b.west + b.deg - cell / 2);
  const g = await etopoBox(s.toFixed(5), n.toFixed(5), w.toFixed(5), e.toFixed(5), stride);
  const out = new Float32Array(TILE * TILE).fill(NaN), nl = g.lons.length;
  const near = (arr, v) => { let lo = 0, hi = arr.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return Math.abs(arr[hi] - v) < Math.abs(arr[lo] - v) ? hi : lo; };
  for (let j = 0; j < TILE; j++) {
    const yi = near(g.lats, b.north - (j + 0.5) * cell);
    for (let i = 0; i < TILE; i++) out[j * TILE + i] = g.z[yi * nl + near(g.lons, b.west + (i + 0.5) * cell)];
  }
  return out;
}

const tileDir = () => path.join(config.dataDir, 'cache', 'dem');
const inflight = new Map();

/** The PNG for tile (body, z, x, y), from the disk cache or built from the source. */
export async function demTile(body, z, x, y) {
  const src = DEM_SOURCES[body];
  if (!src) throw Object.assign(new Error(`no elevation model for ${body}`), { status: 404 });
  z = Number(z); x = Number(x); y = Number(y);
  const zmax = maxLevel(src.ppd);
  if (!(z >= 0 && z <= zmax && x >= 0 && x < 4 * 2 ** z && y >= 0 && y < 2 * 2 ** z)) throw Object.assign(new Error(`tile out of range (levels 0–${zmax})`), { status: 400 });
  const file = path.join(tileDir(), body, `${z}-${x}-${y}.png`);
  try { return { body: await fs.readFile(file), type: 'image/png', maxAge: 31536000 }; } catch { /* build it */ }
  if (!inflight.has(file)) {
    inflight.set(file, (async () => {
      const b = tileBounds(z, x, y);
      const heights = src.format === 'erddap' ? await etopoTile(b) : await sampleSource(src.hi ?? src.global, b);
      const q = quantize(heights);
      const png = png16(TILE, TILE, filter16(q.data, TILE, TILE), { min: String(q.min), max: String(q.max), body, z: String(z), x: String(x), y: String(y) });
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(`${file}.part`, png);
      await fs.rename(`${file}.part`, file);
      return png;
    })().finally(() => inflight.delete(file)));
  }
  return { body: await inflight.get(file), type: 'image/png', maxAge: 31536000 };
}

/** What each body's tiles offer (for the client's level choice and credits). */
export function demInfo() {
  const out = {};
  for (const [id, s] of Object.entries(DEM_SOURCES)) out[id] = { name: s.name, credit: s.credit, ref: s.ref, ppd: s.ppd, maxLevel: maxLevel(s.ppd), tile: TILE, partial: s.partial ?? null };
  return { bodies: out, none: NO_DEM };
}
