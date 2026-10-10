// Client for the backend's star catalogue routes. Responses are memoised per session;
// the backend keeps them on disk, so revisits work offline.
//
// The standalone preview (no backend) answers from a bundled snapshot instead: stars
// within 100 ly of Sol, their planets, and Sol's sky.

import snapshot from '#snapshot';
import { SKINS } from './skins.js';
import { BESPOKE_TEXTURES } from './bespoke.js';
const localTextures = { ...SKINS, ...BESPOKE_TEXTURES };
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
  const url = `/api/nearby?center=${encodeURIComponent(center)}&radiusLy=${radiusLy}`;
  const d = await get(url);
  if (d.motions?.status === 'loading') memo.delete(url); // Gaia motions still arriving: ask again next time
  return { ...d, stars: rowsToObjects(d) };
}

/**
 * Stars with measured motions in the shell fromLy < d ≤ toLy around `center` (#29): the
 * stars that can drift into the Navigation View in deep time. The preview has no backend, so
 * it answers from its own 100 ly snapshot (arrivals beyond that need the local backend).
 */
export async function fetchArrivals(center, fromLy, toLy) {
  if (snapshot) {
    const all = rowsToObjects(snapshot.nearby), c = all.find((s) => s.id === center);
    if (!c) throw new Error(`${center} is outside this preview's 100 ly snapshot`);
    const [a, b] = [fromLy / LY_PER_PC, toLy / LY_PER_PC];
    const stars = all.filter((s) => s.id !== 'sol' && s.id !== center && s.vKms && (({ x, y, z }) => { const d = Math.hypot(x - c.x, y - c.y, z - c.z); return d > a && d <= b; })(s))
      .map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, z: s.z, absmag: s.absmag, ci: s.ci, system: s.system, v: s.vKms, rvKnown: !!s.rvKnown, vSrc: s.vSrc ?? 0 }));
    return { center, fromLy, toLy, stars, preview: true, previewLy: 100, density: snapshot.arrivalsDensity ?? null, velocitySources: null };
  }
  const url = `/api/arrivals?center=${encodeURIComponent(center)}&fromLy=${fromLy}&toLy=${toLy}`;
  const d = await get(url);
  memo.delete(url); // large: the view keeps what it needs
  const f = Object.fromEntries(d.fields.map((k, i) => [k, i]));
  // Gaia-only rows (#29: the DR3 radial-velocity slice) carry no name: "Gaia DR3 <source_id>"
  const stars = d.stars.map((r) => ({ id: r[f.id], name: r[f.name] ?? `Gaia DR3 ${String(r[f.id]).replace(/^gdr3-/, '')}`, x: r[f.x], y: r[f.y], z: r[f.z], absmag: r[f.absmag], ci: r[f.ci], system: r[f.system],
    v: [r[f.vx], r[f.vy], r[f.vz]], rvKnown: !!(r[f.flags] & 1), vSrc: r[f.flags] >> 1 }));
  return { ...d, stars };
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
  return localTextures[key]?.url ?? `/api/texture/${encodeURIComponent(key)}`;
}

/** Image credits, keyed like the textures. */
export async function fetchTextureCredits() {
  if (snapshot) return snapshot.textureCredits ?? {};
  const local = Object.fromEntries(Object.entries(localTextures).map(([key, asset]) => [key, asset.credit]));
  try { return { ...await get('/api/textures'), ...local }; } catch { return local; }
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

/** Catalogue stars around Sol in galactic coordinates (ly), for the Galaxy View. */
export async function fetchGalaxyStars() {
  if (snapshot) return snapshot.galaxy ?? null;
  try { return await get('/api/galaxy?maxLy=1500&maxAbs=2'); } catch { return null; }
}

/** Small-body populations (real orbits) for the Sol System View. */
export async function fetchSmallBodies() {
  if (snapshot) return snapshot.smallbodies ?? null;
  try { return await get('/api/smallbodies'); } catch { return null; }
}

/** Every active Earth satellite (compact CelesTrak GP rows). */
export async function fetchSatellites() {
  if (snapshot) return snapshot.satellites ?? null;
  try { return await get('/api/satellites'); } catch { return null; }
}

/** SATCAT record for one satellite. */
export async function fetchSatelliteDetail(norad) {
  if (snapshot) return snapshot.satcat?.[norad] ?? null;
  try { return await get(`/api/satellites/${norad}`); } catch { return null; }
}

/** A live feed: images → { url, time, credit }; JSON feeds → { data, time, credit }. */
export async function fetchFeed(id, kind) {
  if (snapshot) return null; // live feeds need the local backend
  if (kind === 'json') { // not memoised: live data
    const r = await fetch(`/api/feed/${id}`);
    if (!r.ok) throw new Error(`feed ${id}: HTTP ${r.status}`);
    return r.json();
  }
  const res = await fetch(`/api/feed/${id}`);
  if (!res.ok) throw new Error(`feed ${id}: HTTP ${res.status}`);
  return { url: URL.createObjectURL(await res.blob()), time: res.headers.get('x-feed-time'), credit: decodeURIComponent(res.headers.get('x-feed-credit') || '') };
}

/** Star clusters (Hunt & Reffert 2023) for the Quadrant View. */
export async function fetchClusters() {
  if (snapshot) return snapshot.clusters ?? null;
  try { return await get('/api/clusters'); } catch { return null; }
}

/** One cluster's brightest Gaia DR3 members (#24); null offline or in the standalone preview. */
export async function fetchClusterMembers(name) {
  if (snapshot) return null;
  try { return await get(`/api/cluster-members?name=${encodeURIComponent(name)}`); } catch { return null; }
}

/** URL of a nebula's real image (#24), or null in the standalone preview (images are not embedded). */
export const nebulaImageUrl = (key) => (snapshot ? null : `/api/nebula-image/${encodeURIComponent(key)}`);

/** Nearby galaxies (UNGC) and galaxy groups (Cosmicflows-4) for the Universe View. */
export async function fetchGalaxies() {
  if (snapshot) return snapshot.galaxies ?? null;
  try { return await get('/api/galaxies'); } catch { return null; }
}

/** Known planets within `radiusLy` of `center`, nearest first. */
export async function fetchPlanets(center, radiusLy) {
  if (!snapshot) return get(`/api/planets?center=${encodeURIComponent(center)}&radiusLy=${radiusLy}`);
  // preview: the Sol-centred list, re-measured from `center` using the snapshot's star positions
  const all = rowsToObjects(snapshot.nearby), c = all.find((s) => s.id === center);
  const pos = new Map(all.map((s) => [s.id, s]));
  const p = snapshot.planets;
  if (!c || !p) return { fields: p?.fields ?? [], planets: [] };
  const iDist = p.fields.indexOf('distLy'), iHost = p.fields.indexOf('hostId');
  const rows = p.planets.map((r) => { const h = pos.get(r[iHost]); const out = r.slice(); out[iDist] = h ? Math.hypot(h.x - c.x, h.y - c.y, h.z - c.z) * LY_PER_PC : Infinity; return out; })
    .filter((r) => r[iDist] <= radiusLy).sort((a, b) => a[iDist] - b[iDist]);
  return { fields: p.fields, planets: rows };
}

/** Bright distant Gaia DR3 stars for the Galaxy View (same row shape as fetchGalaxyStars). */
export async function fetchGaiaBright() {
  if (snapshot) return snapshot.gaiaBright ?? null;
  try { return await get('/api/gaia-bright'); } catch { return null; }
}

/** Local researched illustration, or its embedded standalone preview. */
export function visualImageUrl(asset) {
  if (!asset) return null;
  return snapshot ? (asset.key && snapshot.textures?.[asset.key]) || snapshot.bodyImages?.[asset.url] || null : asset.url;
}

/** Identify a star by position (#23): SIMBAD always, Gaia DR3 when `gaia` (null offline). */
export async function fetchStarLookup(ra, dec, distLy, gaia = false) {
  if (snapshot) return null;
  try { return await get(`/api/star-lookup?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}${distLy ? `&distLy=${Math.round(distLy)}` : ''}${gaia ? '&gaia=1' : ''}`); } catch { return null; }
}

/** A Mars rover's traverse (#37): { points: [[lon, lat], …], distanceKm, sol, credit }, or null offline. */
export async function fetchTraverse(id) {
  if (snapshot) return null; // traverses need the local backend (or the bundled lunar file)
  const m = /^(moon|mars):(.+)$/.exec(id); // finished traverses, mapped once: shipped with the app
  if (m) { try { return (await get(`/traverses/${m[1]}.json`))[m[2]] ?? null; } catch { return null; } }
  try { return await get(`/api/traverse/${id}`); } catch { return null; }
}

/** Space telescopes: JWST's schedule now/next and the newest public HST/JWST images; null offline. */
export async function fetchObserving(mission) {
  if (snapshot) return null; // needs the local backend
  const [schedule, recent] = await Promise.all([
    mission === 'jwst' ? fetch('/api/observing/jwst/schedule').then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    fetch(`/api/observing/${mission}/recent`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  return { schedule, recent };
}

/** IAU named features for a body (USGS Gazetteer, bundled per body), or null if it has none. */
export async function fetchFeatures(id) {
  if (snapshot) return null;
  try { return await get(`/features/${id}.json`); } catch { return null; }
}
