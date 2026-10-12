// Gravity-assist search (#45) off the main thread. In: { id, target: { planet } | { el }, massKg, radiusKm, aAu,
// sequences, fromJd, years, maxDays }. Out: { id, via, routes } per sequence as it finishes, then { id, done }.
import { searchSequence } from './flyby.js';
import { planetPos } from './transfer.js';
import { smallBodyPosition } from './smallbodies.js';

self.onmessage = async (e) => {
  const q = e.data;
  const pos = q.target.planet ? planetPos(q.target.planet) : (jd) => smallBodyPosition(q.target.el, jd);
  const target = { pos, massKg: q.massKg, radiusKm: q.radiusKm };
  for (const via of q.sequences) {
    const legs = via.length + 1;
    const routes = await searchSequence(target, q.aAu, via, q.fromJd, { years: q.years, maxDays: q.maxDays, stepDays: legs > 2 ? 14 : 10, nTof: legs > 2 ? 7 : 9 });
    // functions do not cross to the page: routes are plain numbers and arrays
    self.postMessage({ id: q.id, via, routes });
  }
  self.postMessage({ id: q.id, done: true });
};
