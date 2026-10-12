import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autolandAccel, canLand, TOUCHDOWN_KMS } from '../src/astro/landing.js';
import { gravAccel, verletStep, gmOf } from '../src/astro/orbit.js';
import { BODIES as SOL_BODIES } from '../src/data/sol.js';
import { MOONS } from '../src/data/moons.js';

const G1 = 9.80665e-3; // 1 g in km/s²
const body = (id) => [...SOL_BODIES, ...MOONS].find((b) => b.id === id);
const LANDED_KMS = 0.005; // well inside the helm's LANDED threshold (10 m/s): a soft landing

/** Fly AUTOLAND with velocity Verlet (0.1 s steps) until the ground: → { speed at contact, time, fuel (Δv) }. */
function descend(id, { h0, vAcross = 0, vDown = 0, aMax = G1, dt = 0.1, maxS = 4 * 3600 }) {
  const b = body(id), gm = gmOf(b.massKg), R = b.radiusKm;
  const st = { pos: [R + h0, 0, 0], vel: [-vDown, vAcross, 0] };
  let thrust = [0, 0, 0], dv = 0;
  const acc = (p) => { const g = gravAccel(p, [{ pos: [0, 0, 0], gm, radius: R }]); return [g[0] + thrust[0], g[1] + thrust[1], g[2] + thrust[2]]; };
  for (let t = 0; t < maxS; t += dt) {
    const c = autolandAccel({ r: st.pos, v: st.vel, gm, ground: R, aMax });
    thrust = c.a;
    dv += Math.hypot(...thrust) * dt;
    assert.ok(Math.hypot(...thrust) <= aMax * (1 + 1e-9), 'thrust within the ship\'s acceleration');
    verletStep(st, dt, acc);
    if (Math.hypot(...st.pos) <= R) return { speed: Math.hypot(...st.vel), t, dv };
  }
  return { speed: null, t: maxS, dv };
}

test('AUTOLAND: a soft landing on the Moon from a 100 km circular orbit at 1 g', () => {
  const b = body('moon'), gm = gmOf(b.massKg), vc = Math.sqrt(gm / (b.radiusKm + 100));
  const r = descend('moon', { h0: 100, vAcross: vc });
  assert.ok(r.speed != null, 'reaches the ground');
  assert.ok(r.speed <= LANDED_KMS, `touches down at ${(r.speed * 1000).toFixed(2)} m/s (LANDED is ≤ 10 m/s)`);
  assert.ok(r.speed >= TOUCHDOWN_KMS * 0.3, 'and does not hover forever');
  assert.ok(r.t < 1800, `in ${r.t.toFixed(0)} s`);
  assert.ok(r.dv < 3, `Δv ${r.dv.toFixed(2)} km/s: about the orbital speed plus gravity losses`);
});

test('AUTOLAND: Mars from 50 km falling at 300 m/s with 1 km/s across the ground', () => {
  const r = descend('mars', { h0: 50, vAcross: 1, vDown: 0.3 });
  assert.ok(r.speed != null && r.speed <= LANDED_KMS, `touchdown ${r.speed && (r.speed * 1000).toFixed(2)} m/s`);
});

test('AUTOLAND: from a hover just above the ground it settles gently', () => {
  const r = descend('moon', { h0: 0.05 });
  assert.ok(r.speed != null && r.speed <= LANDED_KMS);
});

test('AUTOLAND needs thrust above the local gravity: 1 g is not enough on Earth, 10 g is', () => {
  const e = body('earth'), gm = gmOf(e.massKg);
  assert.equal(canLand(gm, e.radiusKm, G1).ok, false);
  assert.equal(canLand(gm, e.radiusKm, 10 * G1).ok, true);
  const m = body('moon');
  assert.equal(canLand(gmOf(m.massKg), m.radiusKm, G1).ok, true);
  const r = descend('earth', { h0: 30, vAcross: 0.5, aMax: 10 * G1 });
  assert.ok(r.speed != null && r.speed <= LANDED_KMS, `Earth at 10 g: ${r.speed && (r.speed * 1000).toFixed(2)} m/s`);
});

test('AUTOLAND never thrusts towards the ground', () => {
  const m = body('moon'), gm = gmOf(m.massKg);
  for (const [h, vr] of [[100, 0], [10, -0.5], [1, 0.2], [0.01, -0.001]]) {
    const r = [m.radiusKm + h, 0, 0];
    const c = autolandAccel({ r, v: [vr, 0.3, 0], gm, ground: m.radiusKm, aMax: G1 });
    assert.ok(c.a[0] >= 0, `h ${h}: radial thrust ${c.a[0]}`);
  }
});
