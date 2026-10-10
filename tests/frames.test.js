import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galacticLB, eqToEcl, teffFromBV, starTeff, blackbodyRGB } from '../src/astro/frames.js';

const DEG = Math.PI / 180;
const eq = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

test('galactic centre (Sgr A*) is at l = 0°, b = 0°', () => {
  const { l, b } = galacticLB(eq(266.4168, -29.0078));
  assert.ok(Math.min(l, 360 - l) < 0.1, `l = ${l}`);
  assert.ok(Math.abs(b) < 0.1, `b = ${b}`);
});

test('north galactic pole is at b = +90°', () => {
  assert.ok(galacticLB(eq(192.85948, 27.12825)).b > 89.99);
});

test('equatorial → ecliptic puts the north ecliptic pole at RA 18h, Dec +66.56°', () => {
  const [x, y, z] = eqToEcl(eq(270, 66.560708));
  assert.ok(Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6 && z > 0.999999);
});

test('B−V → temperature: the Sun (0.65) ≈ 5800 K', () => {
  assert.ok(Math.abs(teffFromBV(0.65) - 5800) < 150);
});

test('starTeff prefers a measured temperature, then colour, then spectral class', () => {
  assert.equal(starTeff({ teff: 3000, ci: 0.6 }).how, 'measured');
  assert.equal(starTeff({ ci: 1.8 }).how, 'colour index');
  assert.deepEqual(starTeff({ spect: 'M5.5 V' }), { teff: 3200, how: 'spectral class' });
});

test('blackbody colours: hot stars are bluer than cool ones', () => {
  const [r1, , b1] = blackbodyRGB(3000), [r2, , b2] = blackbodyRGB(20000);
  assert.ok(b1 / r1 < b2 / r2);
});
