import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G_KM, gmOf, gravAccel, verletStep, orbitalEnergy, stateToElements, circularSpeed, segmentHitsSphere, dominantBody } from '../src/astro/orbit.js';
import { BODIES as SOL_BODIES } from '../src/data/sol.js';
import { MOONS } from '../src/data/moons.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);
const mass = (id) => [...SOL_BODIES, ...MOONS].find((b) => b.id === id)?.massKg;

test('GM from the app\'s masses matches the JPL Horizons constants (G × M)', () => {
  // Horizons physical-data headers: GM Earth 398600.435, Moon 4902.800, Sun 1.32712440041e11 km³/s²
  close(gmOf(mass('earth')), 398600.435, 398600 * 1e-4, 'Earth');
  close(gmOf(mass('moon')), 4902.8, 4902.8 * 1e-4, 'Moon');
  close(gmOf(mass('sun')), 1.32712440041e11, 1.327e11 * 2e-4, 'Sun');
  close(G_KM, 6.6743e-20, 1e-25);
});

const GM_E = 398600.435, R_E = 6371;

test('a circular orbit 400 km up (the ISS) takes ≈ 92 minutes', () => {
  const r = R_E + 400, v = circularSpeed(GM_E, r);
  close(v, 7.67, 0.01, 'orbital speed km/s');
  const el = stateToElements([r, 0, 0], [0, v, 0], GM_E);
  assert.ok(el.bound);
  close(el.e, 0, 1e-9);
  close(el.periodS / 60, 92.4, 0.2, 'period min');
  close(el.periapsis - R_E, 400, 1e-6);
  close(el.apoapsis - R_E, 400, 1e-6);
});

test('escape speed at Earth\'s surface ≈ 11.19 km/s and is classified hyperbolic', () => {
  const el0 = stateToElements([R_E, 0, 0], [0, 7, 0], GM_E);
  close(el0.escapeKmS, 11.186, 0.002);
  const el = stateToElements([R_E, 0, 0], [0, 11.19, 0], GM_E);
  assert.equal(el.bound, false);
  assert.ok(el.e >= 1, `e = ${el.e}`);
  assert.equal(el.apoapsis, Infinity);
  assert.equal(el.periodS, null);
  const sub = stateToElements([R_E, 0, 0], [0, 11.1, 0], GM_E);
  assert.ok(sub.bound && sub.e < 1);
});

test('an eccentric orbit: periapsis, apoapsis and inclination from the state vector', () => {
  // perigee 7000 km, apogee 42164 km (a GTO-like orbit), inclined 28.5°
  const rp = 7000, ra = 42164, a = (rp + ra) / 2, vp = Math.sqrt(GM_E * (2 / rp - 1 / a)), i = 28.5 * Math.PI / 180;
  const el = stateToElements([rp, 0, 0], [0, vp * Math.cos(i), vp * Math.sin(i)], GM_E);
  close(el.periapsis, rp, 1e-6); close(el.apoapsis, ra, 1e-4);
  close(el.e, (ra - rp) / (ra + rp), 1e-9);
  close(el.inclination, i, 1e-9);
  close(el.a, a, 1e-6);
});

test('velocity Verlet keeps a circular orbit\'s energy over several orbits', () => {
  const r = R_E + 400, v = circularSpeed(GM_E, r);
  const bodies = [{ pos: [0, 0, 0], gm: GM_E, radius: R_E }];
  const s = { pos: [r, 0, 0], vel: [0, v, 0] };
  const e0 = orbitalEnergy(s.pos, s.vel, GM_E);
  const period = 2 * Math.PI * Math.sqrt(r ** 3 / GM_E), dt = 10;
  let maxErr = 0, minR = Infinity, maxR = 0;
  for (let t = 0; t < 5 * period; t += dt) {
    verletStep(s, dt, (p) => gravAccel(p, bodies), 0, s.acc);
    const e = orbitalEnergy(s.pos, s.vel, GM_E);
    maxErr = Math.max(maxErr, Math.abs((e - e0) / e0));
    const rr = Math.hypot(...s.pos); minR = Math.min(minR, rr); maxR = Math.max(maxR, rr);
  }
  assert.ok(maxErr < 1e-5, `relative energy drift ${maxErr}`);
  assert.ok(maxR - minR < 1, `radius stays within 1 km: ${minR}–${maxR}`);
});

test('gravity: inverse square outside, a uniform sphere inside, sums over bodies', () => {
  const a = gravAccel([R_E, 0, 0], [{ pos: [0, 0, 0], gm: GM_E, radius: R_E }]);
  close(-a[0] * 1000, 9.82, 0.01, 'surface g m/s²');
  const half = gravAccel([R_E / 2, 0, 0], [{ pos: [0, 0, 0], gm: GM_E, radius: R_E }]);
  close(half[0], a[0] / 2, 1e-12, 'half way down');
  const two = gravAccel([0, 0, 0], [{ pos: [10, 0, 0], gm: 100 }, { pos: [-10, 0, 0], gm: 100 }]);
  close(two[0], 0, 1e-15, 'balanced');
});

test('swept collisions catch a step that jumps through a world', () => {
  assert.equal(segmentHitsSphere([-2e4, 0, 0], [2e4, 0, 0], [0, 0, 0], R_E) !== null, true);
  close(segmentHitsSphere([-2e4, 0, 0], [2e4, 0, 0], [0, 0, 0], R_E), (2e4 - R_E) / 4e4, 1e-12);
  assert.equal(segmentHitsSphere([-2e4, 1e4, 0], [2e4, 1e4, 0], [0, 0, 0], R_E), null);
  assert.equal(segmentHitsSphere([0, 7000, 0], [0, 8000, 0], [0, 0, 0], R_E), null, 'moving away');
  assert.equal(segmentHitsSphere([0, 6000, 0], [0, 8000, 0], [0, 0, 0], R_E), 0, 'already inside');
});

test('dominant body: inside the Moon\'s sphere of influence the Moon rules, else Earth, else the Sun', () => {
  const sun = [0, 0, 0], earth = [1.496e8, 0, 0], moon = [1.496e8 + 384400, 0, 0];
  const gmS = 1.327e11, gmM = 4902.8;
  const bodies = [{ id: 'earth', pos: earth, gm: GM_E, parentPos: sun, parentGm: gmS }, { id: 'moon', pos: moon, gm: gmM, parentPos: earth, parentGm: GM_E }];
  assert.equal(dominantBody([1.496e8 + 7000, 0, 0], bodies, 'sun'), 'earth');
  assert.equal(dominantBody([1.496e8 + 384400 - 30000, 0, 0], bodies, 'sun'), 'moon');
  assert.equal(dominantBody([1.496e8 + 2e6, 0, 0], bodies, 'sun'), 'sun', 'beyond Earth\'s 924,000 km sphere');
});
