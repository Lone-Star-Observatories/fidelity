// Band imagery for the spectrum filter (#28), cached on disk:
//   GET /api/hips?id=CDS/P/Haslam408   an all-sky or planetary HiPS survey rendered by the CDS
//     hips2fits service as a 2048×1024 equirectangular PNG, transparent where it has no data
//     (celestial: equatorial, RA 0 at the centre and increasing to the left; planetary: longitude
//     −180…180 left to right). Only the
//     surveys named in src/data/bands.js can be asked for (the backend is not an open proxy).
//   GET /api/gibs-band?layers=…        yesterday's NASA GIBS mosaic of the listed layers (or GIBS's
//     latest day for layer sets marked `latest`, such as SMAP, which lags by several days).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { BANDS, BODY_BAND } from '../src/data/bands.js';

const HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits';
const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const SKY = new Set(BANDS.flatMap((b) => b.passes.map((p) => p.sky)).filter(Boolean));
const PLANETARY = new Set(Object.values(BODY_BAND).flatMap((m) => Object.values(m)).map((s) => s.hips).filter(Boolean));
const GIBS = new Set(Object.values(BODY_BAND).flatMap((m) => Object.values(m)).map((s) => s.gibs).filter(Boolean));
// layer sets whose newest day lags by several days (e.g. SMAP): ask GIBS for its default (latest) time
const LATEST = new Set(Object.values(BODY_BAND).flatMap((m) => Object.values(m)).filter((s) => s.gibs && s.latest).map((s) => s.gibs));
const dir = path.join(config.dataDir, 'bands');
const fileOf = (key) => path.join(dir, `${crypto.createHash('sha1').update(key).digest('hex').slice(0, 20)}.img`);
const inflight = new Map();

async function cachedImage(key, maxAgeMs, fetcher) {
  const file = fileOf(key);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < maxAgeMs) return { body: await fs.readFile(file), cache: 'hit' };
  } catch { /* miss */ }
  if (!inflight.has(key)) {
    inflight.set(key, (async () => {
      try {
        const body = await fetcher();
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, body);
        return { body, cache: 'miss' };
      } catch (err) {
        try { return { body: await fs.readFile(file), cache: 'stale' }; } catch { throw err; }
      }
    })().finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

/** An all-sky or planetary survey as an equirectangular PNG. */
export async function hipsImage(id) {
  if (!SKY.has(id) && !PLANETARY.has(id)) throw Object.assign(new Error('unknown survey'), { status: 404 });
  // PNG: areas a survey does not cover come back transparent, not white
  const q = new URLSearchParams({ hips: id, width: '2048', height: '1024', projection: 'CAR', fov: '360', ra: '0', dec: '0', format: 'png' });
  const { body, cache } = await cachedImage(`hips-png|${id}`, 365 * 86400000, async () => {
    const res = await fetch(`${HIPS2FITS}?${q}`, { headers: UA, signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`hips2fits HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  return { body, type: 'image/png', maxAge: 86400, headers: { 'x-band-cache': cache, 'x-band-kind': SKY.has(id) ? 'sky' : 'planetary' } };
}

/** Yesterday's NASA GIBS mosaic of whitelisted layers (later layers drawn over earlier ones). */
export async function gibsBand(layers) {
  if (!GIBS.has(layers)) throw Object.assign(new Error('unknown layer set'), { status: 404 });
  const latest = LATEST.has(layers), day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layers, CRS: 'EPSG:4326', BBOX: '-90,-180,90,180',
    WIDTH: '2048', HEIGHT: '1024', FORMAT: 'image/png', TRANSPARENT: 'TRUE', ...(latest ? {} : { TIME: day }) });
  const { body, cache } = await cachedImage(`gibs|${layers}|${day}`, 6 * 3600000, async () => {
    const res = await fetch(`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`, { headers: UA, signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`GIBS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
  return { body, type: 'image/png', maxAge: 3600, headers: { 'x-band-cache': cache, 'x-band-time': latest ? 'latest' : `${day}T12:00:00Z` } };
}
