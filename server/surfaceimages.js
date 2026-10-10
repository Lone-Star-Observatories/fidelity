// FROM THE SURFACE (#36): the gallery of pictures taken on a body's surface.
//   GET /api/surface-images?body=mars → { body, curated: [...], live: [...], pending: [...], errors }
//     curated: the archival sets in src/data/surface-images.js, with local preview URLs;
//     live (Mars): the newest full-frame raw images from Perseverance and Curiosity (NASA raw-image
//     APIs, cached 1 hour), placed at each rover's latest published position (MMGIS traverse).
//   GET /api/surface-image?src=<https url> → the image, from allowlisted hosts only (SURFACE_HOSTS),
//     JPEG/PNG verified, cached on disk for a year (raw images are immutable once published).

import { cached } from './cache.js';
import { cachedBinary } from './imagery.js';
import { traverse } from './traverse.js';
import { SURFACE_IMAGES, LIVE_SURFACE, PENDING_SURFACE, imageAllowed, proxiedImage } from '../src/data/surface-images.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const HOUR = 3600000, DAY = 24 * HOUR;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const PER_CAMERA = 2;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} from ${new URL(url).hostname}`), { status: 502 });
  return res.json();
}

/** Perseverance: the RSS raw-image API, newest full frames per camera. */
export function m20Items(json, camLabel) {
  return (json?.images ?? []).filter((x) => x.sample_type === 'Full' && x.image_files).map((x) => ({
    id: `m20-${x.imageid}`, title: x.title ?? `Sol ${x.sol}: ${camLabel}`, mission: 'Perseverance (Mars 2020)', instrument: camLabel,
    date: x.date_taken_utc ? `${x.date_taken_utc.slice(0, 19)}Z` : null, sol: x.sol ?? null,
    src: x.image_files.medium ?? x.image_files.small, full: x.image_files.large ?? x.image_files.medium,
    page: `https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/${encodeURIComponent(x.imageid)}/`,
    credit: x.credit || 'NASA/JPL-Caltech', colour: 'raw',
  }));
}
/** Curiosity: the raw_image_items API, newest full frames per camera. */
export function mslItems(json, camLabel) {
  return (json?.items ?? []).filter((x) => x.extended?.sample_type === 'full' && !x.is_thumbnail).map((x) => ({
    id: `msl-${x.imageid}`, title: x.title ?? `Sol ${x.sol}: ${camLabel}`, mission: 'Curiosity (MSL)', instrument: camLabel,
    date: x.date_taken ? `${x.date_taken.slice(0, 19)}Z` : null, sol: x.sol ?? null,
    src: x.https_url ?? x.url, full: x.https_url ?? x.url,
    page: `https://science.nasa.gov/mission/msl-curiosity/raw-images/`,
    credit: x.image_credit || 'NASA/JPL-Caltech', colour: x.instrument?.startsWith('NAV') ? 'greyscale' : 'raw',
  }));
}

async function roverLatest(rover) {
  const { value } = await cached('surface-raw', `v2-${rover.id}`, HOUR, async () => {
    const out = [];
    for (const [cam, label] of rover.cameras) {
      const url = rover.id === 'm20'
        ? `${rover.api}&ver=1.2&num=12&page=0&order=sol+desc&search=%7C${cam}&extended=sample_type::full,`
        : `${rover.api}?order=sol%20desc&per_page=100&page=0&condition_1=msl:mission&search=${cam}`;
      const json = await getJson(url);
      // one product per exposure (Mastcam-Z publishes several processings of each frame)
      const seen = new Set();
      out.push(...(rover.id === 'm20' ? m20Items(json, label) : mslItems(json, label))
        .filter((x) => imageAllowed(x.src) && !seen.has(x.date) && seen.add(x.date)).slice(0, PER_CAMERA));
    }
    return out;
  });
  // where the rover is now: the last point of its published traverse (approximate: drives are localized later)
  let at = null;
  try { const t = await traverse(rover.traverse); const p = t.points?.at(-1); if (p) at = { lon: p[0], lat: p[1], sol: t.sol ?? null }; } catch { /* no position */ }
  return value.map((x) => ({ ...x, body: 'mars', tier: 'measured', live: true, licence: 'Public domain (NASA raw images; credit requested)',
    lat: at?.lat ?? null, lon: at?.lon ?? null, approx: at ? `ROVER\'S LATEST MAPPED POSITION${at.sol ? ` (SOL ${at.sol})` : ''}` : 'ROVER POSITION UNAVAILABLE',
    note: 'A raw image as it came down from Mars: not calibrated, colour not balanced.', thumbUrl: proxiedImage(x, 'thumb'), fullUrl: proxiedImage(x, 'full') }));
}

/** Fetch one allowlisted image; JPEG or PNG by header and by magic bytes (mars.nasa.gov says image/jpg). */
export function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  return null;
}
async function fetchSurfaceImage(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'error', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Object.assign(new Error(`upstream HTTP ${res.status}`), { status: 502 });
  if (!/^image\/(jpe?g|png)\b/i.test(res.headers.get('content-type') || '')) throw Object.assign(new Error(`upstream sent ${res.headers.get('content-type') || 'no type'}`), { status: 502 });
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > 15e6) throw Object.assign(new Error('image too large'), { status: 502 });
  const type = sniffImage(body);
  if (!type) throw Object.assign(new Error('upstream body is not a JPEG or PNG'), { status: 502 });
  return { body, type };
}

/** GET /api/surface-images?body= */
export async function surfaceImages(q) {
  const body = (q.get('body') || '').toLowerCase();
  if (!/^[a-z0-9-]{1,32}$/.test(body)) throw bad('body required');
  const curated = (SURFACE_IMAGES[body] ?? []).map((e) => ({ ...e, thumbUrl: e.feed ? `/api/feed/${e.feed}` : proxiedImage(e, 'thumb'), fullUrl: e.feed ? `/api/feed/${e.feed}` : proxiedImage(e, 'full') }));
  const live = [], errors = [];
  for (const rover of LIVE_SURFACE[body] ?? []) {
    try { live.push(...(await roverLatest(rover))); } catch (err) { errors.push(`${rover.mission}: ${err.message || err}`); }
  }
  return { body, curated, live, pending: PENDING_SURFACE.filter((p) => p.body === body), errors };
}

/** GET /api/surface-image?src= → the image (allowlisted hosts only). */
export async function surfaceImage(q) {
  const src = q.get('src') || '';
  if (!imageAllowed(src)) throw Object.assign(new Error('image host or path not allowed'), { status: 403 });
  const out = await cachedBinary(`surface|${src}`, 365 * DAY, () => fetchSurfaceImage(src));
  return { body: out.body, type: out.type, maxAge: 30 * 86400, headers: { 'x-cache': out.cache } };
}
