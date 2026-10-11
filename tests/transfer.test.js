// Launch windows and transfers (#45): Izzo's Lambert solver against textbook cases and JPL Horizons,
// two-body propagation, the Hohmann Earth–Mars benchmark, the Mars 2020 porkchop and window search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lambert, propagate } from '../src/astro/lambert.js';
import { transfer, porkchop, porkchopByArrival, planetPos, hohmann, injectionDv, launchWindows, synodicDays, periodDays, transferArc, transferPosition, MU_SUN } from '../src/astro/transfer.js';
import { contourSegments } from '../src/panels/porkchop.js';
import { PLANETS } from '../src/data/sol.js';

const close = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (±${tol})`);
const vclose = (a, b, tol, msg) => a.forEach((x, i) => close(x, b[i], tol, msg));
const MU_E = 398600.4418;
const jd = (s) => Date.parse(s) / 86400000 + 2440587.5;
const mars = { pos: planetPos('mars'), ...PLANETS.find((p) => p.id === 'mars') };

test('Lambert: Vallado example 7-5 and Curtis example 5.2', () => {
  const v = lambert(MU_E, [15945.34, 0, 0], [12214.83899, 10249.46731, 0], 76 * 60);
  vclose(v.v1, [2.058913, 2.915965, 0], 1e-5, 'Vallado v1'); vclose(v.v2, [-3.451565, 0.910315, 0], 1e-5, 'Vallado v2');
  const c = lambert(MU_E, [5000, 10000, 2100], [-14600, 2500, 7000], 3600);
  vclose(c.v1, [-5.9925, 1.9254, 3.2456], 1e-4, 'Curtis v1'); vclose(c.v2, [-3.3125, -4.1966, -0.38529], 1e-4, 'Curtis v2');
});

test('Lambert: every solution, multi-revolution and retrograde too, lands on r2 when propagated', () => {
  const r1 = [7000, 0, 0], r2 = [0, 7000, 0], t = 5 * 3600;
  for (const opts of [{}, { prograde: false }, { revs: 1 }, { revs: 1, lowPath: false }]) {
    const s = lambert(MU_E, r1, r2, t, opts);
    assert.ok(s, JSON.stringify(opts));
    vclose(propagate(MU_E, r1, s.v1, t).r, r2, 1e-3, JSON.stringify(opts));
  }
  assert.equal(lambert(MU_E, r1, r2, 3600, { revs: 3 }), null, 'too short for three revolutions');
});

test('propagation: hyperbolic and elliptic round trips', () => {
  for (const v0 of [[0, 8.5, 0.5], [0, 12.5, 1]]) {
    const out = propagate(MU_E, [7000, 0, 0], v0, 7200), back = propagate(MU_E, out.r, out.v, -7200);
    vclose(back.r, [7000, 0, 0], 1e-4); vclose(back.v, v0, 1e-8);
  }
});

test('Lambert against JPL Horizons: Perseverance on its cruise to Mars (coast arc, 2020-10-01 → 10-31)', () => {
  // Horizons -168, heliocentric ecliptic J2000, km and km/s
  const r1 = [1.711004840242413e8, 2.348940521452815e7, 5.418675672923995e6], v1 = [1.809643732514327, 29.32122002785743, 0.6868456898548434];
  const r2 = [1.62272945008936e8, 9.57419926006276e7, 6.729591109348528e6], v2 = [-8.102768684011698, 25.87379181177234, 0.3275525501805472];
  const s = lambert(MU_SUN, r1, r2, 30 * 86400);
  vclose(s.v1, v1, 0.002, 'departure velocity'); vclose(s.v2, v2, 0.002, 'arrival velocity'); // planetary perturbations ≲ 1 m/s
});

test('Hohmann Earth → Mars: ~259 days, ~3.6 km/s from low Earth orbit', () => {
  const h = hohmann(1, 1.523679);
  close(h.tofDays, 259, 1); close(h.dv1, 2.94, 0.01); close(injectionDv(h.dv1), 3.6, 0.05);
  close(synodicDays(365.25636, periodDays('mars')), 780, 2);
});

test('Mars 2020: porkchop minimum C3 ≈ 13–15 km²/s², and Perseverance\'s real dates give ≈ 14.5', () => {
  const pc = porkchop(mars, jd('2020-06-15'), jd('2020-09-15'), 150, 330, { nDep: 31, nTof: 31 });
  assert.ok(pc.best.c3 > 12.5 && pc.best.c3 < 15, `min C3 ${pc.best.c3}`);
  const real = transfer(mars, jd('2020-07-30T11:50:00Z'), 203.1);
  close(real.c3, 14.5, 0.4, 'Perseverance C3');
  const arc = transferArc(real, 20);
  vclose(arc.at(-1), mars.pos(real.arrJd), 1e-6, 'arc ends at Mars');
  assert.equal(transferPosition(real, real.depJd - 1), null);
  const g = porkchopByArrival(mars, jd('2020-07-01'), jd('2020-08-30'), jd('2021-01-01'), jd('2021-04-01'), { n: 12 });
  assert.equal(g.c3.length, 12); assert.ok(g.cell(5, 5).c3 > 0);
});

test('windows: Mars every ~26 months, the next opening in late 2026', () => {
  const w = launchWindows(mars, jd('2026-06-01'), { aAu: 1.524, years: 5, count: 3, minGapDays: 470 });
  assert.equal(w.length, 3, '2026, 2028–29 and 2031 windows');
  const first = new Date((w[0].best.depJd - 2440587.5) * 86400000).toISOString();
  assert.ok(first >= '2026-09-01' && first <= '2027-01-15', first);
  for (let i = 1; i < w.length; i++) close(w[i].best.depJd - w[i - 1].best.depJd, 780, 90, 'synodic spacing');
  assert.ok(w[0].best.c3 < 15);
});

test('contours: marching squares finds the level crossings', () => {
  const f = [[0, 0, 0], [0, 10, 0], [0, 0, 0]];
  const segs = contourSegments(f, 5);
  assert.equal(segs.length, 4);
  for (const [x1, y1, x2, y2] of segs) assert.ok([x1, y1, x2, y2].every((v) => v >= 0.5 && v <= 1.5));
});

test('launch windows: a search goes stale when the clock leaves what it covered', async () => {
  const { windowsStale, upcoming } = await import('../src/astro/transfer.js');
  const w = (o, c) => ({ opens: o, closes: c, best: {} });
  const e = { fromJd: 1000, ws: [w(1100, 1150), w(1900, 1950), w(2700, 2760)] };
  assert.equal(windowsStale(e, 1000), false);
  assert.equal(windowsStale(e, 1120), false); // inside the first window: still the next one
  assert.equal(upcoming(e, 1200).length, 2);
  assert.equal(windowsStale(e, 1960), true); // only the last window remains: search again from here
  assert.equal(windowsStale(e, 900), true); // the clock went back before the search
  assert.equal(windowsStale({ fromJd: 1000, ws: [] }, 1020), false);
  assert.equal(windowsStale({ fromJd: 1000, ws: [] }, 1100), true);
});
