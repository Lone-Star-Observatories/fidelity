// Sky events (#30) off the main thread: eclipses, transits, occultations and alignments for a
// window of time. In: { id, from, to, earthRows? } (earthRows: Horizons daily heliocentric Earth
// rows [jd, x, y, z] AU, when loaded). Out: { id, events, earthSource }.
import { solarEclipses, lunarEclipses, planetTransits, lunarOccultations, alignments, useEarthEphemeris, interpolateDaily, earthSource } from '../astro/eclipses.js';

self.onmessage = (e) => {
  const { id, from, to, earthRows } = e.data;
  const runs = [];
  for (const r of (earthRows ?? []).slice().sort((a, b) => a[0] - b[0])) {
    const last = runs.at(-1);
    if (last && Math.abs(r[0] - last.at(-1)[0] - 1) < 1e-6) last.push(r); else if (!last || r[0] !== last.at(-1)[0]) runs.push([r]);
  }
  useEarthEphemeris(runs.length ? (jd) => { for (const run of runs) { const v = interpolateDaily(run, jd); if (v) return v; } return null; } : null);
  const year = 365.25;
  const events = [
    ...solarEclipses(from, to), ...lunarEclipses(from, to),
    ...planetTransits(from, Math.max(to, from + 30 * year)), // transits are rare: look 30 years ahead
    ...lunarOccultations(from, Math.min(to, from + year)), ...alignments(from, Math.min(to, from + year)),
  ].sort((a, b) => a.greatest - b.greatest);
  // which Sun each event's times came from
  for (const ev of events) ev.sun = runs.some((run) => interpolateDaily(run, ev.greatest)) ? 'horizons' : 'kepler';
  self.postMessage({ id, events, earthSource: runs.length ? 'horizons' : earthSource });
};
