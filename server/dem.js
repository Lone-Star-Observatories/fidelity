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
  latTop: p.startsWith('90') ? 90 : 0, latH: 90, lonWest: Number(p.slice(3)), lonSpan: 180,
}));
// #80 high-resolution tiers, read by HTTP range request without downloading the 11–22 GB products:
// SLDEM2015 (LOLA + SELENE TC, Barker et al. 2016) at 512 px/° in 32 tiles of 30° × 45° within ±60°, LOLA's
// 118 m LDEM (USGS, BigTIFF, half-metre units) towards the poles; the MOLA–HRSC blend (Fergason et al. 2018,
// USGS, BigTIFF int16 metres above the areoid) at 200 m. Each tile cell takes the first part that covers it.
const SLDEM = [];
for (const [lat, tag] of [[60, '30n_60n'], [30, '00n_30n'], [0, '30s_00s'], [-30, '60s_30s']]) {
  for (let lon = 0; lon < 360; lon += 45) {
    const l = `${String(lon).padStart(3, '0')}_${String(lon + 45).padStart(3, '0')}`;
    SLDEM.push({ url: `${PDS}lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/sldem2015/tiles/float_img/sldem2015_512_${tag}_${l}_float.img`,
      format: 'img', W: 23040, H: 15360, type: 'f32', le: true, scale: 1000, latTop: lat, latH: 30, lonWest: lon, lonSpan: 45 });
  }
}
const LOLA118 = { url: `${USGS}Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif`, format: 'tiff', scale: 0.5, lonWest: -180 };
const MOLA_HRSC = { url: `${USGS}Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif`, format: 'tiff', scale: 1, lonWest: -180 };
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
    tiers: [{ minLevel: 5, name: 'SLDEM2015 512 px/° (±60°) and LOLA 118 m', parts: [...SLDEM, LOLA118] }], tilePpd: 512,
  },
  mars: {
    name: 'MGS MOLA MEGDR', instrument: 'Mars Orbiter Laser Altimeter (Mars Global Surveyor)', ref: 'MOLA areoid',
    credit: 'NASA/GSFC MGS MOLA Science Team, PDS Geosciences Node (MEGDR 16 px/°; 64 px/° tiles)', licence: 'NASA, public domain',
    global: { url: `${PDS}mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img`, format: 'img', W: 5760, H: 2880, type: 'i16', le: false, scale: 1, lonWest: 0 },
    hi: { format: 'img', type: 'i16', le: false, scale: 1, ppd: 64, parts: MOLA64 },
    ppd: 64, refRadiusKm: 3396.0,
    tiers: [{ minLevel: 5, name: 'MOLA–HRSC blend 200 m', parts: [MOLA_HRSC] }], tilePpd: 296.4,
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
    ppd: 22.76, refRadiusKm: 6051.0, partial: 'Magellan altimetry has gaps (about 8% of the surface, mostly orbit-to-orbit strips): no data there.', shading: 'all', // #83: the ground under the opaque cloud deck (70 km) carries the relief; the clouds hide it from orbit
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
    ppd: 35.3, refRadiusKm: 606.0, partial: 'The encounter hemisphere only; its noisy rim (stereo near the limb and terminator) is masked.',
    maskEdges: { band: 100, k: 0.35, erode: 2 }, // scripts/build-dem.mjs; tiles inherit the mask (src/data/dem.js heightAt)
  },
  enceladus: {
    name: 'Cassini ISS shape model (Bland 2019)', instrument: 'Cassini ISS stereo/limb shape model', ref: '251.5 km sphere',
    credit: 'NASA/JPL/SSI Cassini ISS; Enceladus shape model (Bland et al. 2019), USGS Astrogeology', licence: 'NASA/USGS, public domain (PDS)',
    global: { url: `${USGS}Enceladus/enceladus_cassini_iss_shapemodel_bland_2019/enceladus_2019pm_radius.tif`, format: 'tiff', scale: 1, lonWest: -180 }, // radius − 251.5 km, metres. Its GeoTIFF tie point is −180° (read as 0° before; the triaxial bulges at 0° and 180° hid the half turn)
    ppd: 2, refRadiusKm: 251.5, width: 720, partial: 'Near-global at 2 px/° (2.2 km); gaps where Cassini had no stereo.',
  },
  // Titan (#80 follow-up): Corlies et al. 2017 (GRL 44, 11754), released CC0 on Cornell eCommons (doi:10.7298/m4dv-gv95).
  // Measured topography (altimetry, SARtopo, stereo) covers ~16% of the 4 px/° grid; the rest of the drawn surface
  // is the paper's radial-basis-function interpolation (MODELLED). Read-outs say NO DATA off the measured cells.
  titan: {
    name: 'Cassini topography (Corlies et al. 2017)', instrument: 'Cassini RADAR altimetry, SARtopo and stereo; RBF-interpolated global map', ref: '2575 km sphere',
    credit: 'NASA/JPL-Caltech/ASI Cassini RADAR; global topography by P. Corlies, A. Hayes et al. (2017), Cornell eCommons (CC0)', licence: 'CC0 1.0',
    global: { url: 'https://ecommons.cornell.edu/server/api/core/bitstreams/9da08126-0616-4415-9271-233ef4f9e447/content', rawName: 'titan_topo_4PPD.cub', format: 'cube', lonWest: -180 },
    drawn: { url: 'https://ecommons.cornell.edu/server/api/core/bitstreams/bebcb917-2790-4fed-ae3c-c47491d3c5c1/content', rawName: 'titan_topo_4PPD_interp.cub', format: 'cube', lonWest: -180, width: 720 },
    ppd: 4, refRadiusKm: 2575.0, noTiles: true, shading: 'none', // the globe shows Titan's haze, which hides the ground: relief in read-outs and the surface view
    partial: 'Measured heights cover ~16% of the grid (Cassini altimetry, SARtopo and stereo tracks); the rest of the drawn surface is the published radial-basis-function interpolation (MODELLED, ±~150 m or worse far from tracks).',
  },
};

/** Bodies with no global DEM, and why (the panel says so). */
export const NO_DEM = {
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
  if (spec.format === 'cube') return openCube(spec, read);
  throw new Error(`no reader for ${spec.format}`);
}

function decodeRow(buf, n, type, le, scale, offset, nodata) {
  const out = new Float64Array(n), size = type === 'f32' ? 4 : type === 'u8' ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const p = i * size;
    const v = type === 'f32' ? (le ? buf.readFloatLE(p) : buf.readFloatBE(p)) : type === 'u8' ? buf[p] : type === 'u16' ? (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p)) : (le ? buf.readInt16LE(p) : buf.readInt16BE(p));
    out[i] = (nodata != null && v === nodata) || !Number.isFinite(v) || v < -1e30 ? NaN : v * scale + (offset ?? 0);
  }
  return out;
}

function openImg(spec, read) {
  const size = spec.type === 'f32' ? 4 : spec.type === 'u8' ? 1 : 2;
  return {
    W: spec.W, H: spec.H, lonWest: spec.lonWest ?? 0,
    async row(y, x0 = 0, x1 = spec.W - 1) {
      const o = (y * spec.W + x0) * size;
      return decodeRow(await read(o, o + (x1 - x0 + 1) * size - 1), x1 - x0 + 1, spec.type, spec.le, spec.scale ?? 1, spec.offset, spec.nodata);
    },
  };
}

/**
 * Uncompressed, strip-organised GeoTIFF or BigTIFF (USGS mosaics and the multi-GB blends: MOLA–HRSC, LOLA 118 m,
 * Magellan 75/225 m SAR): uint8, int16, uint16 or float32, one sample. Only the header, the tag table and the
 * strip offsets are read up front; rows are range-read on demand.
 */
export async function openTiff(spec, read) {
  const head = await read(0, 15);
  const le = head.toString('latin1', 0, 2) === 'II';
  const u16 = (b, o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b, o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const u64 = (b, o) => Number(le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o));
  const version = u16(head, 2), big = version === 43;
  if (version !== 42 && !big) throw new Error('not a TIFF');
  const ifd = big ? u64(head, 8) : u32(head, 4);
  const n = big ? u64(await read(ifd, ifd + 7), 0) : u16(await read(ifd, ifd + 1), 0);
  const esz = big ? 20 : 12, inl = big ? 8 : 4, first = ifd + (big ? 8 : 2);
  const e = await read(first, first + n * esz - 1);
  const tags = {};
  for (let k = 0; k < n; k++) {
    const o = k * esz, type = u16(e, o + 2), count = big ? u64(e, o + 4) : u32(e, o + 4), size = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8, 16: 8 }[type] ?? 4;
    const vo = o + (big ? 12 : 8);
    tags[u16(e, o)] = { type, count, size, inline: count * size <= inl, raw: e.subarray(vo, vo + inl), offset: big ? u64(e, vo) : u32(e, vo) };
  }
  const val = (b, o, t) => (t.type === 3 ? u16(b, o) : t.type === 16 ? u64(b, o) : u32(b, o));
  const scalar = (t) => val(t.raw, 0, t);
  const W = scalar(tags[256]), H = scalar(tags[257]), bits = scalar(tags[258]), fmt = tags[339] ? scalar(tags[339]) : 1;
  if ((tags[259] && scalar(tags[259]) !== 1) || (tags[277] && scalar(tags[277]) !== 1)) throw new Error('compressed or multi-sample TIFF');
  if (tags[322]) throw new Error('tiled TIFF');
  const type = bits === 32 && fmt === 3 ? 'f32' : bits === 16 ? (fmt === 2 ? 'i16' : 'u16') : bits === 8 ? 'u8' : null;
  if (!type) throw new Error(`unsupported TIFF samples (${bits} bits, format ${fmt})`);
  const rps = tags[278] ? scalar(tags[278]) : H;
  const so = tags[273];
  let strips;
  if (so.inline) strips = Array.from({ length: so.count }, (_, i) => val(so.raw, i * so.size, so));
  else {
    const b = await read(so.offset, so.offset + so.count * so.size - 1);
    strips = Array.from({ length: so.count }, (_, i) => val(b, i * so.size, so));
  }
  let nodata = null;
  if (tags[42113]) {
    const t = tags[42113], s = (t.inline ? t.raw.subarray(0, t.count) : await read(t.offset, t.offset + t.count - 1)).toString('latin1').replace(/\0/g, '').trim();
    if (s && Number.isFinite(Number(s))) nodata = Number(s);
  }
  if (spec.nodata !== undefined) nodata = spec.nodata;
  const size = bits / 8;
  return {
    W, H, lonWest: spec.lonWest ?? 0, nodata, type, big,
    async row(y, x0 = 0, x1 = W - 1) {
      const o = strips[Math.floor(y / rps)] + ((y % rps) * W + x0) * size;
      return decodeRow(await read(o, o + (x1 - x0 + 1) * size - 1), x1 - x0 + 1, type, le, spec.scale ?? 1, spec.offset, type === 'f32' && nodata != null && nodata < -1e30 ? null : nodata);
    },
  };
}

/**
 * ISIS3 cube (Titan's Cassini topography, Corlies et al. 2017): a text label, then 32-bit LSB reals in tiles
 * (Format = Tile) or rows (BandSequential); one band. Returns the same raster interface as openTiff.
 */
export async function openCube(spec, read) {
  const label = (await read(0, 65535)).toString('latin1');
  const num = (k) => Number(label.match(new RegExp(`\\b${k}\\s*=\\s*([-0-9.eE+]+)`))?.[1]);
  const W = num('Samples'), H = num('Lines'), start = num('StartByte') - 1;
  const tiled = /Format\s*=\s*Tile/.test(label), tw = tiled ? num('TileSamples') : W, th = tiled ? num('TileLines') : 1;
  if (!/Type\s*=\s*Real/.test(label) || !/ByteOrder\s*=\s*Lsb/.test(label)) throw new Error('only LSB Real cubes');
  const base = num('Base') || 0, mult = Number.isFinite(num('Multiplier')) ? num('Multiplier') : 1;
  const across = Math.ceil(W / tw);
  return {
    W, H, lonWest: spec.lonWest ?? -180,
    async row(y, x0 = 0, x1 = W - 1) {
      const out = new Float64Array(x1 - x0 + 1), ty = Math.floor(y / th), yy = y % th;
      for (let tx = Math.floor(x0 / tw); tx <= Math.floor(x1 / tw); tx++) {
        const a = Math.max(x0, tx * tw), b = Math.min(x1, tx * tw + tw - 1);
        const o = start + ((ty * across + tx) * tw * th + yy * tw + (a - tx * tw)) * 4;
        const buf = await read(o, o + (b - a + 1) * 4 - 1);
        for (let x = a; x <= b; x++) {
          const v = buf.readFloatLE((x - a) * 4); // ISIS special pixels are huge negative reals
          out[x - x0] = !Number.isFinite(v) || Math.abs(v) > 1e30 ? NaN : (v * mult + base) * (spec.scale ?? 1) + (spec.offset ?? 0);
        }
      }
      return out;
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

/** The raster spec serving tile level `z` of a body: its finest tier at or below z, else `hi`, else `global`. */
export function sourceFor(src, z) {
  const tier = (src.tiers ?? []).filter((t) => z >= t.minLevel).sort((a, b) => b.minLevel - a.minLevel)[0];
  return tier ? { parts: tier.parts } : src.hi ?? src.global;
}

/**
 * Where a part of a source covers: latTop/latH (default the whole globe, 90° … −90°), lonWest/lonSpan (default
 * 360°). → the pixel { x, y } of a raster `W` × `H` holding lat/lon, or null outside the part.
 */
export function partPixel(part, W, H, lat, lon) {
  const latTop = part.latTop ?? 90, latH = part.latH ?? 180, lonSpan = part.lonSpan ?? 360;
  const fy = ((latTop - lat) / latH) * H;
  if (fy < 0 || fy >= H) return null;
  const dl = ((((lon - (part.lonWest ?? 0)) % 360) + 360) % 360);
  if (dl >= lonSpan) return null;
  return { x: Math.min(W - 1, Math.floor((dl / lonSpan) * W)), y: Math.floor(fy) };
}

/**
 * Point-sample the cells of a tile from a source (nearest source pixel per cell, one ranged read per row). A
 * source split into parts (MOLA's four 64 px/° files, SLDEM2015's 32 tiles + LOLA 118 m) fills each cell from the
 * first part, in order, that covers it with data; parts that miss the tile are never opened.
 */
async function sampleSource(spec, b) {
  const parts = spec.parts ? spec.parts.map((p) => ({ ...spec, ...p, parts: undefined })) : [spec];
  const out = new Float32Array(TILE * TILE).fill(NaN), rank = new Uint8Array(TILE * TILE).fill(255), cell = b.deg / TILE;
  const jobs = [];
  const latS = b.north - b.deg;
  for (let k = 0; k < parts.length; k++) {
    const part = parts[k];
    const top = part.latTop ?? 90, bottom = top - (part.latH ?? 180), span = part.lonSpan ?? 360;
    if (top <= latS || bottom >= b.north) continue;
    if (span < 360) {
      const dl = ((((b.west - (part.lonWest ?? 0)) % 360) + 360) % 360);
      if (dl >= span && dl + b.deg <= 360) continue; // the tile lies wholly outside this part's longitudes
    }
    const r = await openRemote(part);
    const pp = { ...part, lonWest: part.lonWest ?? r.lonWest };
    for (let j = 0; j < TILE; j++) {
      const lat = b.north - (j + 0.5) * cell;
      const cols = [];
      let y = -1;
      for (let i = 0; i < TILE; i++) {
        const px = partPixel(pp, r.W, r.H, lat, b.west + (i + 0.5) * cell);
        if (!px) continue;
        y = px.y; cols.push([i, px.x]);
      }
      if (!cols.length) continue;
      const xs = cols.map((c) => c[1]), x0 = Math.min(...xs), x1 = Math.max(...xs);
      const put = (row, off) => { for (const [i, x] of cols) { const v = row[x - off], c = j * TILE + i; if (v === v && k < rank[c]) { out[c] = v; rank[c] = k; } } };
      if (x1 - x0 > r.W / 2) jobs.push(async () => put(await r.row(y), 0)); // the tile straddles the raster's seam
      else jobs.push(async () => put(await r.row(y, x0, x1), x0));
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
  if (!src || src.noTiles) throw Object.assign(new Error(`no elevation tiles for ${body}`), { status: 404 });
  z = Number(z); x = Number(x); y = Number(y);
  const zmax = maxLevel(src.tilePpd ?? src.ppd);
  if (!(z >= 0 && z <= zmax && x >= 0 && x < 4 * 2 ** z && y >= 0 && y < 2 * 2 ** z)) throw Object.assign(new Error(`tile out of range (levels 0–${zmax})`), { status: 400 });
  const file = path.join(tileDir(), body, `${z}-${x}-${y}.png`);
  try { return { body: await fs.readFile(file), type: 'image/png', maxAge: 31536000 }; } catch { /* build it */ }
  if (!inflight.has(file)) {
    inflight.set(file, (async () => {
      const b = tileBounds(z, x, y);
      const heights = src.format === 'erddap' ? await etopoTile(b) : await sampleSource(sourceFor(src, z), b);
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
  for (const [id, s] of Object.entries(DEM_SOURCES)) out[id] = { name: s.name, credit: s.credit, ref: s.ref, ppd: s.ppd, tilePpd: s.tilePpd ?? s.ppd, maxLevel: maxLevel(s.tilePpd ?? s.ppd), tile: TILE, partial: s.partial ?? null,
    tiers: (s.tiers ?? []).map((t) => ({ minLevel: t.minLevel, name: t.name })) };
  return { bodies: out, none: NO_DEM };
}
