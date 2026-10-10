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

// ---- #29: batch integration, closest approaches, Gliese 710 -----------------------------------
import { integrateBatch, trackOf, closestApproach, linearApproach } from '../src/astro/galpot.js';
import { spaceMotion } from '../src/astro/spacemotion.js';
import { eqToGal, LY_PER_PC } from '../src/astro/frames.js';

test('integrateBatch: same orbits as integrateTrack; Float32 storage within 0.01 ly', () => {
  const pos = [3, -2, 1, 200, 150, -40], vel = [10, -20, 5, -30, 8, 12];
  const b = integrateBatch(pos, vel, { spanMyr: 5 }), b32 = integrateBatch(pos, vel, { spanMyr: 5, Float: Float32Array });
  for (const i of [0, 1]) {
    const one = integrateTrack(pos.slice(3 * i, 3 * i + 3), vel.slice(3 * i, 3 * i + 3), { spanMyr: 5 });
    for (const t of [-4.7e6, -1e6, 2.2e6, 5e6]) {
      const p = trackAt(trackOf(b, i), t).pos, q = trackAt(one, t).pos, r = trackAt(trackOf(b32, i), t).pos;
      for (let k = 0; k < 3; k++) { assert.ok(Math.abs(p[k] - q[k]) < 1e-9); assert.ok(Math.abs(r[k] - q[k]) < 0.01, `${r[k]} ${q[k]}`); }
    }
  }
});

test('coarse ±50 Myr tracks (0.25 Myr steps, 2.5 Myr samples) keep relative positions to ~0.1 ly', () => {
  const pos = [0, 0, 0, 300, -500, 80], vel = [0, 0, 0, 25, -18, 7];
  const fine = integrateBatch(pos, vel, { spanMyr: 50 }), coarse = integrateBatch(pos, vel, { spanMyr: 50, dtMyr: 0.25, sampleMyr: 2.5, Float: Float32Array });
  const rel = (b, t) => { const a = trackAt(trackOf(b, 1), t).pos, s = trackAt(trackOf(b, 0), t).pos; return a.map((x, k) => x - s[k]); };
  for (const t of [-48.7e6, -20.3e6, 13.1e6, 37.6e6, 50e6]) {
    const f = rel(fine, t), c = rel(coarse, t);
    assert.ok(Math.hypot(f[0] - c[0], f[1] - c[1], f[2] - c[2]) < 0.1, `${t} ${f} ${c}`);
  }
});

test('linearApproach screens straight-line passes', () => {
  // 10 ly away along x, coming straight in at 2.998 km/s (1 km/s = 3.336 ly per Myr): passes at +1 Myr
  const r = linearApproach([10, 0.5, 0], [-2.99796, 0, 0]);
  assert.ok(Math.abs(r.tYears - 1e6) < 1e3 && Math.abs(r.dLy - 0.5) < 1e-6, JSON.stringify(r));
});

// Gliese 710 (HIP 89825): Gaia DR3 astrometry and radial velocity (gaiadr3.gaia_source via
// hipparcos2_best_neighbour, as server/gaia.js fetches it). Literature: perihelion ≈ 0.052 pc
// (≈ 10,700 AU, 0.17 ly) at +1.29 Myr (Bailer-Jones et al. 2018; de la Fuente Marcos &
// de la Fuente Marcos 2018, 2020).
const GL710_GAIA = { raDeg: 274.96183629691126, decDeg: -1.938612759804832, plxMas: 52.396292205290564, pmraMasYr: -0.4140637404226508, pmdecMasYr: -0.10847507667730025, rvKms: -14.419985 };
const passOf = ({ pos, vel }) => {
  const sun = integrateTrack([0, 0, 0], [0, 0, 0], { spanMyr: 5 });
  const star = integrateTrack(eqToGal(pos.map((x) => x * LY_PER_PC)), eqToGal(vel), { spanMyr: 5 });
  return closestApproach(star, sun, 5e6);
};
test('Gliese 710 from Gaia DR3: perihelion ~0.05 pc at ~+1.29 Myr, as published', () => {
  const { tYears, dMinLy } = passOf(spaceMotion(GL710_GAIA));
  const pc = dMinLy / LY_PER_PC;
  assert.ok(Math.abs(tYears - 1.29e6) < 0.04e6, `t = ${tYears}`);
  assert.ok(pc > 0.03 && pc < 0.08, `d = ${pc} pc`); // Gaia DR3 pm errors (~0.02 mas/yr) alone allow ±0.01 pc
});
test('Gliese 710 from HYG (Hipparcos proper motion, older RV): later and wider', () => {
  // HYG v4.4 row: x, y, z (pc) and vx, vy, vz (pc/yr), equatorial
  const pos = [1.690966, -19.477219, -0.661744], vel = [-0.00000101, 0.00001355, 0.00000066].map((v) => v * 977792.2);
  const { tYears, dMinLy } = passOf({ pos, vel });
  assert.ok(Math.abs(tYears - 1.44e6) < 0.05e6, `t = ${tYears}`); // HYG: 19.56 pc at −13.3 km/s
  // Hipparcos' (1.7, 2.1) mas/yr proper motion is ~6× Gaia's: the pass comes out ~0.3 pc
  assert.ok(dMinLy / LY_PER_PC > 0.1 && dMinLy / LY_PER_PC < 0.6, `d = ${dMinLy / LY_PER_PC} pc`);
});
