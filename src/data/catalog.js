// Client for the backend's star catalogue routes. Responses are memoised per session;
// the backend keeps them on disk, so revisits work offline.
//
// The standalone preview (no backend) answers from a bundled snapshot instead: stars
// within 100 ly of Sol, their planets, and Sol's sky.

import snapshot from '#snapshot';
import { LY_PER_PC } from '../astro/frames.js';
import { closestTemplate } from '../astro/spectral.js';

const memo = new Map();

function get(url) {
  if (!memo.has(url)) {
    memo.set(url, fetch(url)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .catch((err) => { memo.delete(url); throw err; }));
  }
  return memo.get(url);
}

const rowsToObjects = (d) => d.stars.map((row) => Object.fromEntries(d.fields.map((f, i) => [f, row[i]])));

function snapshotNearby(center, radiusLy) {
  const all = rowsToObjects(snapshot.nearby);
  const c = all.find((s) => s.id === center);
  if (!c) throw new Error(`${center} is outside this preview's 100 ly snapshot`);
  const rPc = radiusLy / LY_PER_PC;
  const stars = all.filter((s) => s.id === 'sol' || Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) <= rPc);
  const centre = center === 'sol' ? snapshot.nearby.center : { ...c, distLy: Math.hypot(c.x, c.y, c.z) * LY_PER_PC, distPc: Math.hypot(c.x, c.y, c.z) };
  return { ...snapshot.nearby, center: centre, radiusLy, stars,
    sources: { ...snapshot.nearby.sources, stars: `${snapshot.nearby.sources.stars} · preview snapshot (100 ly of Sol)` } };
}

/** Stars within `radiusLy` of star `center`, as objects. */
export async function fetchNearby(center, radiusLy) {
  if (snapshot) return snapshotNearby(center, radiusLy);
  const d = await get(`/api/nearby?center=${encodeURIComponent(center)}&radiusLy=${radiusLy}`);
  return { ...d, stars: rowsToObjects(d) };
}

export async function fetchStar(id) {
  if (!snapshot) return get(`/api/stars/${encodeURIComponent(id)}`);
  if (snapshot.details[id]) return snapshot.details[id];
  const s = rowsToObjects(snapshot.nearby).find((x) => x.id === id);
  if (!s) throw new Error(`${id} is outside this preview's 100 ly snapshot`);
  const distPc = Math.hypot(s.x, s.y, s.z);
  return { star: { ...s, distPc, distLy: distPc * LY_PER_PC, source: 'HYG v4' }, host: null, planets: [] };
}

export async function fetchSky(center) {
  if (!snapshot) return get(`/api/sky?center=${encodeURIComponent(center)}&maxMag=6.5`);
  if (snapshot.skies[center]) return snapshot.skies[center];
  throw new Error('sky not in snapshot');
}

/** URL for surface texture `key`: the backend's cache, or an image bundled in the preview. */
export function textureUrl(key) {
  if (snapshot) return snapshot.textures?.[key] ?? null;
  return `/api/texture/${encodeURIComponent(key)}`;
}

/** Image credits, keyed like the textures. */
export async function fetchTextureCredits() {
  if (snapshot) return snapshot.textureCredits ?? {};
  try { return await get('/api/textures'); } catch { return {}; }
}

/** Best-matching observed template spectrum for a spectral type (null if none). */
export async function fetchSpectrum(type, feh) {
  if (!type || type === '—') return null;
  if (snapshot) {
    const lib = snapshot.spectra;
    const t = lib && closestTemplate(lib.entries, type, feh ?? null);
    return t ? { requested: type, template: t.type, exact: t.score < 0.6, grid: lib.grid, flux: t.flux, source: lib.source } : null;
  }
  try {
    return await get(`/api/spectrum?type=${encodeURIComponent(type)}${feh != null ? `&feh=${feh}` : ''}`);
  } catch { return null; }
}
