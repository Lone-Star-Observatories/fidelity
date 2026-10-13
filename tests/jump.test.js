import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keplerPropagate, timeToPeriapsis, sweepJump, verletStep, gravAccel, stateToElements, orbitalEnergy } from '../src/astro/orbit.js';

const GM_E = 398600.435, R_E = 6371;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);
const norm = (p) => Math.hypot(...p);

/** Reference: a fine velocity-Verlet integration of the same two-body problem. */
function integrate(r, v, gm, dt, h = 1) {
  const st = { pos: r.slice(), vel: v.slice() };
  const acc = (p) => gravAccel(p, [{ pos: [0, 0, 0], gm }]);
  const n = Math.ceil(Math.abs(dt) / h), hs = dt / n;
  for (let i = 0; i < n; i++) verletStep(st, hs, acc, 0, i ? st.acc : null);
  return st;
}

test('Kepler propagation: a circular orbit goes a quarter of the way round in a quarter period', () => {
  const r = R_E + 400, vc = Math.sqrt(GM_E / r), T = 2 * Math.PI * Math.sqrt(r ** 3 / GM_E);
  const s = keplerPropagate([r, 0, 0], [0, vc, 0], GM_E, T / 4);
  close(s.r[0], 0, 1e-3); close(s.r[1], r, 1e-3); close(s.v[0], -vc, 1e-6);
  const back = keplerPropagate([r, 0, 0], [0, vc, 0], GM_E, -T / 4);
  close(back.r[1], -r, 1e-3, 'backwards in time');
  const many = keplerPropagate([r, 0, 0], [0, vc, 0], GM_E, 1000.25 * T);
  close(many.r[1], r, 1e-2, '1000¼ orbits later');
});

test('Kepler propagation matches a fine numerical integration on an ellipse and a hyperbola', () => {
  for (const [v0, dt] of [[[0, 9.0, 0.5], 7000], [[0, 12.5, 0.3], 20000]]) {
    const r0 = [R_E + 500, 0, 0];
    const k = keplerPropagate(r0, v0, GM_E, dt), n = integrate(r0, v0, GM_E, dt, 0.5);
    close(norm([k.r[0] - n.pos[0], k.r[1] - n.pos[1], k.r[2] - n.pos[2]]), 0, 0.5, `position after ${dt} s`);
    close(orbitalEnergy(k.r, k.v, GM_E), orbitalEnergy(r0, v0, GM_E), 1e-6, 'energy');
  }
});

test('time to periapsis: from apoapsis it is half a period', () => {
  const rp = R_E + 300, ra = R_E + 3000, a = (rp + ra) / 2;
  const va = Math.sqrt(GM_E * (2 / ra - 1 / a));
  const T = 2 * Math.PI * Math.sqrt(a ** 3 / GM_E);
  close(timeToPeriapsis([ra, 0, 0], [0, va, 0], GM_E, 1), T / 2, 1e-3);
  close(timeToPeriapsis([ra, 0, 0], [0, va, 0], GM_E, -1), -T / 2, 1e-3);
});

test('a long clock jump cannot tunnel the ship through its frame body: it stops at the surface', () => {
  // an orbit whose periapsis is 200 km under the surface, starting at apoapsis
  const rp = R_E - 200, ra = R_E + 2000, a = (rp + ra) / 2, va = Math.sqrt(GM_E * (2 / ra - 1 / a));
  const res = sweepJump({ r: [ra, 0, 0], v: [0, va, 0], gm: GM_E, R: R_E, dt: 30 * 86400 });
  assert.equal(res.hit?.id, 'frame');
  close(norm(res.hit.at), R_E, 1e-3, 'on the surface');
  assert.ok(res.hit.t > 0 && res.hit.t < stateToElements([ra, 0, 0], [0, va, 0], GM_E).periodS / 2, 'before the first periapsis');
  assert.ok(res.hit.relKmS > 7, 'an impact at orbital speed');
  // the same orbit lifted above the surface: no hit, and the ship is carried along its orbit
  const safe = sweepJump({ r: [ra, 0, 0], v: [0, va + 0.3, 0], gm: GM_E, R: R_E, dt: 30 * 86400 });
  assert.equal(safe.hit, null);
  assert.ok(norm(safe.r) > R_E);
  assert.equal(safe.swept, false, 'hundreds of orbits: too long to sample finely against other bodies');
});

test('a jump is swept against a body crossing the ship\'s path (a moon passing through)', () => {
  const r = 400000, vc = Math.sqrt(GM_E / r); // the ship near the Moon's distance, almost still on this time scale
  // a 1,737 km body moving through the ship's position halfway through a 2-hour jump
  const mid = keplerPropagate([r, 0, 0], [0, vc, 0], GM_E, 3600).r; // where the ship is halfway
  const moon = { id: 'moon', R: 1737, posAt: (t) => [mid[0] + (t - 3600) * 1.0, mid[1], mid[2]] };
  const res = sweepJump({ r: [r, 0, 0], v: [0, vc, 0], gm: GM_E, R: R_E, dt: 7200, others: [moon] });
  assert.equal(res.hit?.id, 'moon');
  assert.ok(res.hit.t > 0 && res.hit.t < 3600);
  close(norm(res.hit.rel), 1737, 2, 'stopped at its surface');
  // without the moon in the way: no hit
  const away = { id: 'moon', R: 1737, posAt: (t) => [-r, (t - 3600) * 1.0, 0] };
  assert.equal(sweepJump({ r: [r, 0, 0], v: [0, vc, 0], gm: GM_E, R: R_E, dt: 7200, others: [away] }).hit, null);
});
