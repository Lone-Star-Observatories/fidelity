// Spacecraft positions from the backend's JPL Horizons proxy (or the standalone snapshot).
// Heliocentric craft: daily vectors per month, interpolated linearly. Craft near a planet or
// the Moon: 10-minute planet-relative states for the UTC day, Hermite-interpolated (smooth
// even for two-hour Mars orbits). Trajectories for drawing come as long, coarse tracks.

import snapshot from '#snapshot';
import { monthUrl, localUrl, localMonthUrl, trackUrl } from './horizons-urls.js';

const TDB_UTC = 69.184 / 86400; // Horizons tabulates in TDB; the ship's clock is UTC
const cache = new Map(); // url → { state: 'loading'|'ready'|'failed', value, at }
const ends = new Map(); // Horizons id → last date (YYYY-MM-DD) of its published (predicted) ephemeris, when one was hit

/** Where a craft's published ephemeris ends (YYYY-MM-DD), once a request has run into it; else null. */
export const ephemerisEnd = (hz) => ends.get(String(hz)) ?? null;

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
    .then((j) => {
      const v = j.value ?? j;
      cache.set(url, { state: 'ready', value: v.points, at: Date.now() });
      if (v.ephemerisEnd) ends.set(String(v.body), v.ephemerisEnd);
    })
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

// Planet-relative states: the 10-minute day when it has loaded, else the 20-minute month
// (one request a month, so fast time-play keeps up), else the last loaded set within two days,
// so a craft never drops to its planet's centre while data is on the way.
const lastLocal = new Map(); // `${hz}@${center}` → { pts, jd0, jd1 }
function localPoints(hz, center, jd) {
  const k = `${hz}@${center}`;
  const day = want(localUrl(hz, center, jd));
  let pts = day?.length ? day : null;
  if (pts) { want(localUrl(hz, center, jd + 1)); want(localUrl(hz, center, jd - 1)); }
  else {
    const month = want(localMonthUrl(hz, center, jd));
    if (month?.length) { pts = month; want(localMonthUrl(hz, center, jd + 3)); want(localMonthUrl(hz, center, jd - 3)); }
  }
  if (pts) { lastLocal.set(k, { pts, jd0: pts[0][0], jd1: pts[pts.length - 1][0] }); return pts; }
  const last = lastLocal.get(k);
  return last && jd > last.jd0 - 2 && jd < last.jd1 + 2 ? last.pts : null;
}

/** Position relative to `center` (NAIF major-body id), J2000 ecliptic km, or null while loading. */
export function localAt(hz, center, jdUtc) {
  const jd = jdUtc + TDB_UTC;
  const pts = localPoints(hz, center, jd);
  if (!pts?.length) return null;
  const step = pts[1][0] - pts[0][0];
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor((jd - pts[0][0]) / step)));
  const a = pts[i], b = pts[i + 1], h = (b[0] - a[0]) * 86400, t = Math.max(0, Math.min(1, (jd - a[0]) / (b[0] - a[0])));
  // cubic Hermite with velocities (km/s)
  const h00 = 2 * t ** 3 - 3 * t * t + 1, h10 = t ** 3 - 2 * t * t + t, h01 = -2 * t ** 3 + 3 * t * t, h11 = t ** 3 - t * t;
  return [0, 1, 2].map((k) => h00 * a[1 + k] + h10 * h * a[4 + k] + h01 * b[1 + k] + h11 * h * b[4 + k]);
}

/** The day's planet-relative samples (for drawing the orbit), km; the same array while the day is unchanged. */
const daySamples = new Map(); // points array → day number → samples
export function localDaySamples(hz, center, jdUtc) {
  const jd = jdUtc + TDB_UTC, pts = localPoints(hz, center, jd);
  if (!pts) return null;
  // a month is cut to the UTC day containing now (d = that day's midnight JD)
  const span = pts[pts.length - 1][0] - pts[0][0], d = span > 1.5 ? Math.floor(jd - 0.5) + 0.5 : 0;
  let byDay = daySamples.get(pts);
  if (!byDay) { byDay = new Map(); daySamples.set(pts, byDay); if (daySamples.size > 64) daySamples.delete(daySamples.keys().next().value); }
  if (!byDay.has(d)) {
    const sel = d ? pts.filter((p) => p[0] >= d && p[0] <= d + 1.01) : pts;
    byDay.set(d, (sel.length > 1 ? sel : pts).map((p) => [p[1], p[2], p[3]]));
  }
  return byDay.get(d);
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
