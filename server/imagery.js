// Imagery of all kinds for the detail views, fetched on demand and kept on disk:
//   - Sky-survey cutouts across the spectrum (gamma rays to radio) at any position, from the
//     CDS hips2fits service (HiPS all-sky surveys, Strasbourg).
//   - NASA Image and Video Library searches (spacecraft and telescope images of a body) and
//     their preview images.
// Only the listed surveys and NASA's asset host can be fetched: this is not an open proxy.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { cached } from './cache.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const DAY = 86400000;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

// band: gamma | x-ray | uv | visible | near-ir | mid-ir | far-ir | microwave | radio
export const SURVEYS = {
  fermi: { hips: 'CDS/P/Fermi/color', band: 'gamma', label: 'FERMI LAT · GAMMA RAYS', range: '> 1 GeV',
    credit: 'NASA Fermi LAT all-sky, via CDS hips2fits' },
  rass: { hips: 'CDS/P/RASS', band: 'x-ray', label: 'ROSAT · X-RAYS', range: '0.1–2.4 keV',
    credit: 'ROSAT All-Sky Survey (MPE), via CDS hips2fits' },
  galex: { hips: 'CDS/P/GALEXGR6_7/color', band: 'uv', label: 'GALEX · ULTRAVIOLET', range: '135–280 nm',
    credit: 'NASA GALEX GR6/7 (FUV + NUV), via CDS hips2fits' },
  dss2: { hips: 'CDS/P/DSS2/color', band: 'visible', label: 'DSS2 · VISIBLE', range: 'B + R photographic plates',
    credit: 'Digitized Sky Survey 2 (POSS-II / UK Schmidt plates; STScI), via CDS hips2fits' },
  panstarrs: { hips: 'CDS/P/PanSTARRS/DR1/color-z-zg-g', band: 'visible', label: 'PAN-STARRS · VISIBLE', range: 'g, z (dec > −30°)',
    credit: 'Pan-STARRS1 DR1 (University of Hawaiʻi), via CDS hips2fits' },
  mellinger: { hips: 'CDS/P/Mellinger/color', band: 'visible', label: 'NAKED-EYE SKY', range: 'colour mosaic, wide fields',
    credit: 'Axel Mellinger all-sky colour mosaic, via CDS hips2fits' },
  twomass: { hips: 'CDS/P/2MASS/color', band: 'near-ir', label: '2MASS · NEAR INFRARED', range: 'J, H, Ks (1.2–2.2 µm)',
    credit: '2MASS (UMass / IPAC-Caltech, NASA/NSF), via CDS hips2fits' },
  wise: { hips: 'CDS/P/allWISE/color', band: 'mid-ir', label: 'WISE · MID INFRARED', range: '3.4–22 µm',
    credit: 'NASA WISE / AllWISE (JPL-Caltech, UCLA), via CDS hips2fits' },
  akari: { hips: 'CDS/P/AKARI/FIS/Color', band: 'far-ir', label: 'AKARI · FAR INFRARED', range: '65–160 µm',
    credit: 'JAXA AKARI FIS all-sky, via CDS hips2fits' },
  planck: { hips: 'CDS/P/PLANCK/R2/HFI/color', band: 'microwave', label: 'PLANCK · MICROWAVE', range: '100–857 GHz',
    credit: 'ESA Planck HFI (R2), via CDS hips2fits' },
  nvss: { hips: 'CDS/P/NVSS', band: 'radio', label: 'NVSS · RADIO', range: '1.4 GHz (dec > −40°)',
    credit: 'NRAO VLA Sky Survey, via CDS hips2fits' },
  hi4pi: { hips: 'CDS/P/HI4PI/NHI', band: 'radio', label: 'HI4PI · 21 CM HYDROGEN', range: '1.42 GHz neutral hydrogen',
    credit: 'HI4PI (EBHIS + GASS) neutral-hydrogen column, via CDS hips2fits' },
  // Not in the imagery cards (hidden): single-band UV maps for the spectrum filter's Magellanic Clouds (#28),
  // as asinh-stretched PNGs, transparent where there is no data (GALEX skipped the LMC's bright bar; the Swift
  // UVOT Magellanic Clouds Survey covers it, Siegel et al. 2015, Hagen et al. 2017)
  galexnuv: { hips: 'CDS/P/GALEXGR6_7/NUV', band: 'uv', label: 'GALEX NUV', range: '175–280 nm', hidden: true, format: 'png', stretch: 'asinh',
    credit: 'NASA GALEX GR6/7 near-UV, via CDS hips2fits' },
  uvotw1: { hips: 'nasa.heasarc/P/Swift/UVOT/int_UVW1', band: 'uv', label: 'SWIFT UVOT UVW1', range: '260 nm', hidden: true, format: 'png', stretch: 'asinh',
    credit: 'NASA Swift UVOT UVW1 intensity (Swift UVOT Magellanic Clouds Survey), HEASARC HiPS via CDS hips2fits' },
};

export const surveyList = () => Object.fromEntries(Object.entries(SURVEYS).filter(([, s]) => !s.hidden).map(([k, s]) => [k, { band: s.band, label: s.label, range: s.range, credit: s.credit }]));

// ---- binary disk cache ---------------------------------------------------------------------
const imgDir = path.join(config.dataDir, 'imagery');
const inflight = new Map();
export async function cachedBinary(key, ttlMs, fetcher) {
  const name = crypto.createHash('sha1').update(key).digest('hex').slice(0, 20);
  const file = path.join(imgDir, `${name}.bin`), meta = path.join(imgDir, `${name}.json`);
  let stale = null;
  try {
    const m = JSON.parse(await fs.readFile(meta, 'utf8'));
    if (Date.now() - m.storedAt < ttlMs) return { ...m, body: await fs.readFile(file), cache: 'hit' };
    stale = m;
  } catch { /* miss */ }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const got = await fetcher();
      await fs.mkdir(imgDir, { recursive: true });
      await fs.writeFile(file, got.body);
      const m = { storedAt: Date.now(), type: got.type, credit: got.credit ?? '' };
      await fs.writeFile(meta, JSON.stringify(m));
      return { ...m, body: got.body, cache: 'miss' };
    } catch (err) {
      if (stale) return { ...stale, body: await fs.readFile(file), cache: 'stale' };
      throw err;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
async function fetchImage(url, timeoutMs = 90000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`upstream HTTP ${res.status}`), { status: 502 });
  const type = res.headers.get('content-type') || '';
  if (!/^image\/(jpeg|png)/.test(type)) throw Object.assign(new Error(`upstream sent ${type || 'no type'}`), { status: 502 });
  return { body: Buffer.from(await res.arrayBuffer()), type: type.split(';')[0] };
}

/** Whether survey `hips` has data at (ra, dec), from the CDS MocServer coverage maps (cached). */
async function covers(hips, ra, dec) {
  const r1 = (x) => x.toFixed(1);
  const { value } = await cached('survey-moc', `${hips}|${r1(ra)}|${r1(dec)}`, 180 * DAY, async () => {
    const q = new URLSearchParams({ RA: ra.toFixed(4), DEC: dec.toFixed(4), SR: '0.01', intersect: 'overlaps', fmt: 'json', get: 'id', ID: hips });
    const res = await fetch(`https://alasky.cds.unistra.fr/MocServer/query?${q}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw Object.assign(new Error(`MocServer HTTP ${res.status}`), { status: 502 });
    return { covered: (await res.json()).includes(hips) };
  }).catch(() => ({ value: { covered: true } })); // unknown: try the cutout anyway
  return value.covered;
}

/** GET /api/survey/:key?ra=&dec=&fov= → JPEG (or, for single-band maps, PNG) cutout (fov in degrees, 0.02–60; 512 px square, north up, east left). */
export async function surveyCutout(key, q) {
  const s = SURVEYS[key];
  if (!s) throw Object.assign(new Error(`unknown survey ${key}`), { status: 404 });
  const ra = Number(q.get('ra')), dec = Number(q.get('dec')), fov = Number(q.get('fov') || 0.25);
  if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90)) throw bad('ra in [0, 360), dec in [-90, 90]');
  if (!(fov >= 0.02 && fov <= 60)) throw bad('fov in [0.02, 60] degrees');
  if (!(await covers(s.hips, ra, dec))) throw Object.assign(new Error(`${s.label} does not cover this part of the sky`), { status: 404 });
  const size = Math.min(1024, Math.max(128, Number(q.get('size')) || 512));
  // round so nearby requests share a cutout: 1/200 of the field
  const step = fov / 200, r = (x) => (Math.round(x / step) * step).toFixed(5);
  const params = new URLSearchParams({ hips: s.hips, width: size, height: size, fov: fov.toPrecision(4), ra: r(ra), dec: r(dec),
    projection: fov > 30 ? 'AIT' : 'TAN', coordsys: 'icrs', format: s.format ?? 'jpg', ...(s.stretch ? { stretch: s.stretch, min_cut: '0.5%', max_cut: '99.8%' } : {}) });
  const out = await cachedBinary(`survey|${params}`, 180 * DAY, async () =>
    ({ ...(await fetchImage(`https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${params}`)), credit: s.credit }));
  return { body: out.body, type: out.type, maxAge: 30 * 86400, headers: { 'x-credit': encodeURIComponent(s.credit), 'x-cache': out.cache } };
}

// ---- NASA Image and Video Library ------------------------------------------------------------
const NASA_ID = /^[A-Za-z0-9_.\-]{2,80}$/;

/** GET /api/nasa-images?q=&must= → up to 36 images: { nasaId, title, date, center, creator, description, keywords }. */
export async function nasaImages(q) {
  const query = (q.get('q') || '').trim().slice(0, 80);
  const must = (q.get('must') || '').trim().toLowerCase().slice(0, 40);
  if (query.length < 2) throw bad('q required');
  const { value } = await cached('nasa-images', `v1-${query}|${must}`, 14 * DAY, async () => {
    const res = await fetch(`https://images-api.nasa.gov/search?${new URLSearchParams({ q: query, media_type: 'image', page_size: '100' })}`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw Object.assign(new Error(`NASA images HTTP ${res.status}`), { status: 502 });
    const items = (await res.json()).collection?.items ?? [];
    const out = [];
    for (const it of items) {
      const d = it.data?.[0];
      if (!d || !NASA_ID.test(d.nasa_id)) continue;
      const text = `${d.title} ${(d.keywords ?? []).join(' ')}`.toLowerCase();
      // keep images about this body (a search for "Io" matches far too much otherwise)
      if (must && !new RegExp(`\\b${must.replace(/[^a-z0-9 -]/g, '')}\\b`).test(text)) continue;
      out.push({
        nasaId: d.nasa_id, title: d.title, date: d.date_created?.slice(0, 10) ?? null, center: d.center ?? null,
        creator: d.secondary_creator || d.photographer || null, keywords: (d.keywords ?? []).slice(0, 8),
        description: String(d.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700),
      });
      if (out.length >= 36) break;
    }
    return { query, items: out, source: 'NASA Image and Video Library (images.nasa.gov)' };
  });
  return value;
}

/** GET /api/nasa-image/:id/:size (thumb | medium) → the preview JPEG, via images-assets.nasa.gov. */
export async function nasaImage(id, size) {
  if (!NASA_ID.test(id) || !['thumb', 'medium'].includes(size)) throw bad('bad image id');
  const out = await cachedBinary(`nasa|${id}|${size}`, 365 * DAY, async () => {
    const base = `https://images-assets.nasa.gov/image/${encodeURIComponent(id)}/${encodeURIComponent(id)}`;
    try { return await fetchImage(`${base}~${size}.jpg`); } catch (err) {
      if (size === 'medium') return fetchImage(`${base}~thumb.jpg`); // older items carry only a thumbnail
      throw err;
    }
  });
  return { body: out.body, type: out.type, maxAge: 30 * 86400, headers: { 'x-cache': out.cache } };
}
