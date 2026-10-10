import { test } from 'node:test';
import assert from 'node:assert/strict';
import { R0_KLY, Z_SUN_KLY, IMAGE, galToScene, imageMapper } from '../src/astro/galaxy.js';
import { galaxyStars } from '../server/stars.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('Sol sits R₀ from the galactic centre, z₀ above the plane', () => {
  const [x, y, z] = galToScene([0, 0, 0]);
  close(x, -R0_KLY); close(y, Z_SUN_KLY); close(z, 0);
});

test('heliocentric +x (towards the centre) moves towards Sgr A*', () => {
  const [x] = galToScene([R0_KLY, 0, 0]);
  close(x, 0);
  // light-years with a unit factor: 1000 ly = 1 kly
  close(galToScene([1000, 0, 0], 1e-3)[0], 1 - R0_KLY);
});

test('image calibration: the marked Sun maps to R₀ along −x', () => {
  const map = imageMapper(...IMAGE.sunOffset);
  const [x, z] = map(IMAGE.sunOffset[0] * IMAGE.widthKly, IMAGE.sunOffset[1] * IMAGE.widthKly);
  close(x, -R0_KLY, 1e-9); close(z, 0, 1e-9);
  // the mapping is a pure rotation (no scale or shear)
  const [ax, az] = map(1, 0), [bx, bz] = map(0, 1);
  close(Math.hypot(ax, az), 1); close(Math.hypot(bx, bz), 1); close(ax * bx + az * bz, 0);
  // ≈147 kly across: a plausible Milky Way artwork width
  assert.ok(IMAGE.widthKly > 140 && IMAGE.widthKly < 155);
});

test('galaxyStars rows are [gx, gy, gz, absmag×10, ci×100] within range', { skip: !process.env.FIDELITY_CATALOG && 'needs the HYG catalogue (set FIDELITY_CATALOG=1)' }, async () => {
  const g = await galaxyStars(500, 0);
  assert.deepEqual(g.fields, ['gx', 'gy', 'gz', 'absmag10', 'ci100']);
  for (const [x, y, z, m] of g.stars) { assert.ok(Math.hypot(x, y, z) <= 501); assert.ok(m <= 0); }
});

test('galaxyStars rejects silly ranges', async () => {
  await assert.rejects(() => galaxyStars(0, 2));
  await assert.rejects(() => galaxyStars(1500, 99));
});

import { omega, OMEGA_SUN, OMEGA_PATTERN, GALACTIC_YEAR_MYR, rotationAngle, SATELLITE_ORBITS, integrateOrbit, orbitAt, kpcToScene } from '../src/astro/galaxy.js';

test('galactic rotation: ~215 Myr year at the Sun, pattern near corotation, inner disc faster', () => {
  assert.ok(GALACTIC_YEAR_MYR > 200 && GALACTIC_YEAR_MYR < 240, String(GALACTIC_YEAR_MYR));
  assert.ok(Math.abs(OMEGA_PATTERN / OMEGA_SUN - 1) < 0.05);
  assert.ok(omega(10) > omega(R0_KLY) && omega(40) < omega(R0_KLY));
  // after a short time the Sun has moved towards l = 90° (scene −z)
  const a = rotationAngle(R0_KLY, 1);
  const z = -(-R0_KLY) * Math.sin(a); // three.js rotation about +y: z' = −x·sinθ + z·cosθ
  assert.ok(z < 0);
});

test('satellite orbits: integration reproduces the present and stays bound', () => {
  for (const s of SATELLITE_ORBITS) {
    const o = integrateOrbit(s.pos, s.vel);
    const now = orbitAt(o, 0);
    s.pos.forEach((x, k) => close(now[k], x, 1e-9));
    const r = o.points.map((p) => Math.hypot(...p));
    assert.ok(Math.max(...r) < 400 && Math.min(...r) > 1, `${s.id} ${Math.min(...r)} ${Math.max(...r)}`);
  }
  // the LMC is ~50 kpc out and near pericentre now
  const lmc = integrateOrbit(SATELLITE_ORBITS[0].pos, SATELLITE_ORBITS[0].vel);
  close(Math.hypot(...orbitAt(lmc, 0)), 49.6, 0.5);
  // scene: LMC lies below the plane (galactic south)
  assert.ok(kpcToScene(orbitAt(lmc, 0))[1] < 0);
});
