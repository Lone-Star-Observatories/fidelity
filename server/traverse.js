// Mars rover traverses: the published drive paths from NASA/JPL's MMGIS mission maps, fetched on
// demand, thinned to a few thousand points and cached for six hours (active rovers drive daily).

import { cached } from './cache.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const MARS_KM = 3389.5;
export const TRAVERSES = {
  m20: { url: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json', credit: 'NASA/JPL-Caltech MMGIS, Perseverance traverse (localized drives)' },
  msl: { url: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json', credit: 'NASA/JPL-Caltech MMGIS, Curiosity traverse (localized drives)' },
};

const DEG = Math.PI / 180;
const arcKm = ([lo1, la1], [lo2, la2]) => {
  const a = Math.sin(((la2 - la1) * DEG) / 2) ** 2 + Math.cos(la1 * DEG) * Math.cos(la2 * DEG) * Math.sin(((lo2 - lo1) * DEG) / 2) ** 2;
  return 2 * MARS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** GeoJSON (LineString / MultiLineString features, lon/lat[/elev]) → one ordered [lon, lat] path, distance and last sol. */
export function flattenTraverse(geo, maxPoints = 4000) {
  const pts = [];
  let sol = null;
  for (const f of geo.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const line of lines) for (const c of line) {
      const p = [Number(c[0]), Number(c[1])];
      const last = pts.at(-1);
      if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(last && last[0] === p[0] && last[1] === p[1])) pts.push(p);
    }
    if (f.properties?.sol != null) sol = Math.max(sol ?? 0, Number(f.properties.sol));
  }
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += arcKm(pts[i - 1], pts[i]);
  // keep every n-th point, always including the last (the rover's current position)
  const step = Math.max(1, Math.ceil(pts.length / maxPoints));
  const path = pts.filter((_, i) => i % step === 0);
  if (pts.length && path.at(-1) !== pts.at(-1)) path.push(pts.at(-1));
  const r = (x) => Math.round(x * 1e6) / 1e6;
  return { points: path.map(([lo, la]) => [r(lo), r(la)]), distanceKm: Math.round(km * 100) / 100, sol, rawPoints: pts.length };
}

/** GET /api/traverse/:id → { id, credit, fetched, sol, distanceKm, points: [[lon, lat], …] } (planetocentric, east-positive). */
export async function traverse(id) {
  const t = TRAVERSES[id];
  if (!t) throw Object.assign(new Error(`unknown traverse ${id}`), { status: 404 });
  const got = await cached('traverse', id, 6 * 3600e3, async () => {
    const res = await fetch(t.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) });
    if (!res.ok) throw new Error(`traverse HTTP ${res.status}`);
    return { ...flattenTraverse(await res.json()), fetched: new Date().toISOString() };
  });
  return { id, credit: t.credit, cache: got.cache, ...got.value };
}
