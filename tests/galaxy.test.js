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
