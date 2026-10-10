// Propagates the whole satellite catalogue with SGP4 off the main thread. In: { rows } once,
// then { jd } requests. Out: { jd, buf } with [x, y, z, vx, vy, vz] per satellite: geocentric
// J2000 ecliptic in scene axes, AU and AU/day (NaN for satellites SGP4 cannot place).
import { satrecFromRow, stateAt, precessionToJ2000, temeToEcliptic } from '../../astro/sgp4.js';

const AU_KM = 149597870.7;
let recs = [];
self.onmessage = (e) => {
  if (e.data.rows) { recs = e.data.rows.map((r) => { try { return satrecFromRow(r); } catch { return null; } }); return; }
  const { jd } = e.data;
  const P = precessionToJ2000(jd);
  const buf = new Float32Array(recs.length * 6);
  for (let i = 0; i < recs.length; i++) {
    const s = recs[i] && stateAt(recs[i], jd);
    if (!s) { buf.fill(NaN, i * 6, i * 6 + 6); continue; }
    const p = temeToEcliptic(s.position, P), v = temeToEcliptic(s.velocity, P);
    // ecliptic (x, y, z) → scene (x, z, −y)
    buf.set([p[0] / AU_KM, p[2] / AU_KM, -p[1] / AU_KM, (v[0] * 86400) / AU_KM, (v[2] * 86400) / AU_KM, (-v[1] * 86400) / AU_KM], i * 6);
  }
  self.postMessage({ jd, buf }, [buf.buffer]);
};
