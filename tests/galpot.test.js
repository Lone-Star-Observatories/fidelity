import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vcirc, integrateTrack, trackAt, KPC_PER_MYR, R_SUN_KPC, SUN_GAL_KMS, phi, toGC, LY_PER_KPC } from '../src/astro/galpot.js';

test('Milky Way model: circular speed ~230 km/s at the Sun, flat-ish to 20 kpc', () => {
  const v0 = vcirc(R_SUN_KPC);
  assert.ok(v0 > 220 && v0 < 240, String(v0));
  assert.ok(Math.abs(vcirc(16) - v0) < 35);
});

test('tracks reproduce the present exactly and are smooth between samples', () => {
  const tr = integrateTrack([3, -2, 1], [10, -20, 5]);
  const now = trackAt(tr, 0);
  [3, -2, 1].forEach((x, k) => assert.ok(Math.abs(now.pos[k] - x) < 1e-6));
  [10, -20 + 0, 5].forEach((v, k) => assert.ok(Math.abs(now.vel[k] - (v + SUN_GAL_KMS[k])) < 1e-6));
  // Hermite velocity matches finite differences of position within a sample interval
  const a = trackAt(tr, 4.3e5), b = trackAt(tr, 4.3e5 + 100);
  const fd = (b.pos[1] - a.pos[1]) / 100 / 3.3356e-6; // ly/yr → km/s
  assert.ok(Math.abs(fd - a.vel[1]) < 0.05, `${fd} ${a.vel[1]}`);
});

test('the Sun: ~245 km/s now, orbit curves towards the centre, bobs through the disc; energy conserved', () => {
  const tr = integrateTrack([0, 0, 0], [0, 0, 0]);
  const speed = (t) => Math.hypot(...trackAt(tr, t).vel);
  assert.ok(Math.abs(speed(0) - 245.6) < 1);
  for (const t of [-5e7, -1e7, 1e7, 5e7]) assert.ok(Math.abs(speed(t) - 235) < 20, `${t} ${speed(t)}`); // mildly eccentric orbit
  // 245 km/s for 10 Myr ≈ 8.2 kly along l = 90°, already bending towards the centre
  const s = trackAt(tr, 1e7);
  assert.ok(s.pos[1] > 7800 && s.pos[1] < 8300, String(s.pos[1]));
  assert.ok(s.pos[0] > 0, 'curves towards the galactic centre');
  let zmax = 0;
  for (let t = -5e7; t <= 5e7; t += 1e6) zmax = Math.max(zmax, Math.abs(trackAt(tr, t).pos[2]));
  assert.ok(zmax > 50 && zmax < 600, String(zmax));
  // energy: ½v² + Φ the same at −50, 0 and +50 Myr to 1 part in 10⁶
  const E = (t) => { const q = trackAt(tr, t), g = toGC(q.pos.map((x) => x / LY_PER_KPC)); return 0.5 * q.vel.reduce((a, v) => a + (v * KPC_PER_MYR) ** 2, 0) + phi(...g); };
  // velocities are galactocentric but toGCv is a rotation, so |v| is frame-independent
  for (const t of [-5e7, 5e7]) assert.ok(Math.abs(E(t) / E(0) - 1) < 1e-6, `${E(t)} ${E(0)}`);
});
