// Client for the backend's Horizons proxy. Loads one calendar month of daily
// vectors per body on demand (the backend stores them on disk), and interpolates.

import snapshot from '#snapshot';
import { dateFromJd } from '../astro/time.js';
import { interpolateDaily } from '../astro/eclipses.js';

const months = new Map(); // `${body}|${YYYY-MM}` → Promise<points | null>
const loaded = new Map(); // `${body}|${YYYY-MM}` → points, once they have arrived

/** Every loaded daily row [jd, x, y, z] (AU, TDB) for Horizons body `body` (e.g. '399' for Earth). */
export const loadedRows = (body) => [...loaded].filter(([k]) => k.startsWith(`${body}|`)).flatMap(([, pts]) => pts);
/** A sync Earth ephemeris (jdTT → heliocentric AU, or null) from whatever Horizons months have loaded. */
export function earthFromHorizons() {
  let runs = [], size = -1;
  return (jd) => {
    if (loaded.size !== size) {
      size = loaded.size; runs = [];
      for (const r of loadedRows('399').sort((a, b) => a[0] - b[0])) {
        const last = runs.at(-1);
        if (last && Math.abs(r[0] - last.at(-1)[0] - 1) < 1e-6) last.push(r); else if (!last || r[0] !== last.at(-1)[0]) runs.push([r]);
      }
    }
    for (const run of runs) { const v = interpolateDaily(run, jd); if (v) return v; }
    return null;
  };
}
/** Start loading `body`'s month containing `jd` (so loadedRows can use it later). */
export const preloadMonth = (body, jd) => load(body, monthOf(jd)).catch(() => null);

function load(body, month) {
  const key = `${body}|${month}`;
  if (!months.has(key) && snapshot) { // standalone: the months bundled in the snapshot, else Kepler
    const pts = snapshot.horizons?.[`/api/horizons/vectors?body=${body}&month=${month}`];
    if (pts) loaded.set(key, pts);
    months.set(key, pts ? Promise.resolve(pts) : Promise.reject(new Error('not bundled')));
  }
  if (!months.has(key)) {
    months.set(key, fetch(`/api/horizons/vectors?body=${body}&month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { loaded.set(key, j.value.points); return j.value.points; })
      .catch((err) => { months.delete(key); throw err; }));
  }
  return months.get(key);
}

const monthOf = (jd) => dateFromJd(jd).toISOString().slice(0, 7);

/**
 * Ephemeris for a set of bodies. `positionOf(id, jd)` returns [x,y,z] AU or null
 * if that month isn't loaded yet (callers fall back to Keplerian elements); it
 * kicks off the load in the background so the next frame can use it.
 */
export function createHorizonsEphemeris(bodies, onStatus = () => {}) {
  const ready = new Map(); // key → points
  const failedAt = new Map(); // key → ms; retried after RETRY_MS rather than every frame
  const RETRY_MS = 30000;
  let pending = 0;
  let failed = false;

  const ensure = (horizonsId, month) => {
    const key = `${horizonsId}|${month}`;
    if (ready.has(key) || months.has(key)) return;
    if (Date.now() - (failedAt.get(key) || 0) < RETRY_MS) return;
    pending++;
    onStatus({ pending, failed });
    load(horizonsId, month)
      .then((pts) => { ready.set(key, pts); failed = false; })
      .catch(() => { failed = true; failedAt.set(key, Date.now()); })
      .finally(() => { pending--; onStatus({ pending, failed }); });
  };

  return {
    positionOf(id, jd) {
      const body = bodies[id];
      if (!body?.horizons) return null;
      const month = monthOf(jd);
      const pts = ready.get(`${body.horizons}|${month}`);
      if (!pts) { ensure(body.horizons, month); return null; }
      // cubic through the daily vectors (linear would cut ~5,000 km inside Earth's orbit between them)
      return interpolateDaily(pts, Math.max(pts[0][0], Math.min(pts[pts.length - 1][0], jd)));
    },
  };
}
