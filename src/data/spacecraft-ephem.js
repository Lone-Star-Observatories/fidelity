// Spacecraft positions from the backend's JPL Horizons proxy (or the standalone snapshot).
// Heliocentric craft: daily vectors per month, interpolated linearly. Craft near a planet or
// the Moon: 10-minute planet-relative states for the UTC day, Hermite-interpolated (smooth
// even for two-hour Mars orbits). Trajectories for drawing come as long, coarse tracks.

import snapshot from '#snapshot';
import { monthUrl, localUrl, trackUrl } from './horizons-urls.js';

const TDB_UTC = 69.184 / 86400; // Horizons tabulates in TDB; the ship's clock is UTC
const cache = new Map(); // url → { state: 'loading'|'ready'|'failed', value, at }

function want(url) {
  const c = cache.get(url);
  if (c && (c.state !== 'failed' || Date.now() - c.at < 30000)) return c.state === 'ready' ? c.value : null;
  if (snapshot) { // standalone: only what was bundled
    const v = snapshot.horizons?.[url] ?? null;
    cache.set(url, { state: v ? 'ready' : 'failed', value: v, at: Date.now() });
    return v;
  }
  cache.set(url, { state: 'loading', at: Date.now() });
  fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => cache.set(url, { state: 'ready', value: (j.value ?? j).points, at: Date.now() }))
    .catch(() => cache.set(url, { state: 'failed', at: Date.now() }));
  return null;
}

/** Heliocentric J2000 ecliptic [x, y, z] AU, or null while loading. */
export function heliocentricAt(hz, jdUtc) {
  const jd = jdUtc + TDB_UTC;
  const pts = want(monthUrl(hz, jd));
  if (!pts?.length) return null;
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor(jd - pts[0][0])));
  const a = pts[i], b = pts[i + 1], f = Math.max(0, Math.min(1, jd - a[0]));
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}

/** Position relative to `center` (NAIF major-body id), J2000 ecliptic km, or null while loading. */
export function localAt(hz, center, jdUtc) {
  const jd = jdUtc + TDB_UTC;
  const pts = want(localUrl(hz, center, jd));
  if (!pts?.length) return null;
  const step = pts[1][0] - pts[0][0];
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor((jd - pts[0][0]) / step)));
  const a = pts[i], b = pts[i + 1], h = (b[0] - a[0]) * 86400, t = Math.max(0, Math.min(1, (jd - a[0]) / (b[0] - a[0])));
  // cubic Hermite with velocities (km/s)
  const h00 = 2 * t ** 3 - 3 * t * t + 1, h10 = t ** 3 - 2 * t * t + t, h01 = -2 * t ** 3 + 3 * t * t, h11 = t ** 3 - t * t;
  return [0, 1, 2].map((k) => h00 * a[1 + k] + h10 * h * a[4 + k] + h01 * b[1 + k] + h11 * h * b[4 + k]);
}

/** All planet-relative samples for the day (for drawing the orbit), km. */
export function localDaySamples(hz, center, jdUtc) {
  const pts = want(localUrl(hz, center, jdUtc + TDB_UTC));
  return pts ? pts.map((p) => [p[1], p[2], p[3]]) : null;
}

/** Heliocentric trajectory points (AU) between two dates, or null while loading. */
export const trajectory = (hz, start, stop) => want(trackUrl(hz, start, stop));

/** Live DSN contacts (refreshed by the caller). */
export async function fetchDsn() {
  if (snapshot) return null;
  const r = await fetch('/api/dsn');
  if (!r.ok) throw new Error(`DSN HTTP ${r.status}`);
  return r.json();
}
