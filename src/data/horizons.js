// Client for the backend's Horizons proxy. Loads one calendar month of daily
// vectors per body on demand (the backend stores them on disk), and interpolates.

import { dateFromJd } from '../astro/time.js';

const months = new Map(); // `${body}|${YYYY-MM}` → Promise<points | null>

function load(body, month) {
  const key = `${body}|${month}`;
  if (!months.has(key)) {
    months.set(key, fetch(`/api/horizons/vectors?body=${body}&month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => j.value.points)
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
      const t = jd - pts[0][0];
      const i = Math.max(0, Math.min(pts.length - 2, Math.floor(t)));
      const [j0, ...a] = pts[i];
      const [, ...b] = pts[i + 1];
      const f = Math.max(0, Math.min(1, jd - j0));
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    },
  };
}
