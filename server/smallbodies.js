// Real orbits for the Solar System's small-body populations, from the JPL Small-Body
// Database query API (https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html): the main belt,
// Hildas, Jupiter Trojans, near-Earth asteroids, Centaurs and trans-Neptunian objects,
// down to a size (absolute magnitude H) limit per population. Cached for 30 days.

import { cached } from './cache.js';

const API = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api';
const MONTH = 30 * 86400000;

// population → SBDB orbit classes and brightness cut (H; smaller = bigger object)
export const POPULATIONS = {
  neo: { classes: ['ATE', 'APO', 'AMO', 'IEO'], H: 20, label: 'NEAR-EARTH ASTEROIDS' },
  main: { classes: ['IMB', 'MBA', 'OMB'], H: 14.5, label: 'MAIN BELT' },
  trojan: { classes: ['TJN'], H: 15, label: 'JUPITER TROJANS' },
  centaur: { classes: ['CEN'], H: 99, label: 'CENTAURS' },
  tno: { classes: ['TNO'], H: 99, label: 'TRANS-NEPTUNIAN OBJECTS' },
};
const POP_INDEX = Object.fromEntries(Object.keys(POPULATIONS).map((k, i) => [k, i]));

async function query(cls, H) {
  const params = new URLSearchParams({ fields: 'a,e,i,om,w,ma,epoch,H', 'sb-class': cls, limit: '200000' });
  if (H < 99) params.set('sb-cdata', JSON.stringify({ AND: [`H|LT|${H}`] }));
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`SBDB HTTP ${res.status}`);
  return (await res.json()).data ?? [];
}

/**
 * Compact rows [pop, a, e, i, Ω, ω, M, epochOffset, H] where epochOffset is days from `epochJd`
 * (most objects share the MPC's current epoch).
 */
export async function smallBodies() {
  const { value } = await cached('smallbodies', 'populations-v1', MONTH, async () => {
    const rows = [];
    let epochJd = null;
    for (const [pop, p] of Object.entries(POPULATIONS)) {
      for (const cls of p.classes) {
        for (const r of await query(cls, p.H)) {
          const [a, e, i, om, w, ma, epoch, H] = r.map(Number);
          if (!(a > 0) || !(e < 1)) continue; // bound orbits only
          epochJd ??= epoch;
          rows.push([POP_INDEX[pop], a, e, i, om, w, ma, epoch - epochJd, Number.isFinite(H) ? H : null]);
        }
      }
    }
    return { epochJd, fields: ['pop', 'a', 'e', 'i', 'node', 'w', 'M', 'epochOffset', 'H'], populations: Object.keys(POPULATIONS), labels: Object.values(POPULATIONS).map((p) => p.label), rows, source: 'JPL Small-Body Database' };
  });
  return value;
}
