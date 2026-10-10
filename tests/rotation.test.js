import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gmstDeg, meridianDirection, bodyAxes } from '../src/astro/rotation.js';
import { heliocentric } from '../src/astro/kepler.js';
import { OBLIQUITY } from '../src/astro/frames.js';

const DEG = Math.PI / 180;
const eclToEq = ([x, y, z]) => [x, y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY), y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]))))) / DEG;

test('GMST at J2000.0 is 280.46°', () => {
  assert.ok(Math.abs(gmstDeg(2451545.0) - 280.46061837) < 1e-9);
});

test('Earth: the Sun is over Greenwich near 12:00 UTC (within the equation of time)', () => {
  const jd = 2461120.0; // 2026-03-20 12:00 UTC
  const earth = heliocentric('earth', jd);
  const toSun = eclToEq(earth.map((v) => -v));
  const greenwich = meridianDirection([0, 90], 'gmst', jd, 0);
  assert.ok(angle(greenwich, toSun) < 3, `${angle(greenwich, toSun).toFixed(2)}°`); // EoT ≈ −7.5 min ≈ 1.9° in March
});

test('Earth: Greenwich faces away from the Sun at midnight UTC', () => {
  const jd = 2461120.5;
  const toSun = eclToEq(heliocentric('earth', jd).map((v) => -v));
  assert.ok(angle(meridianDirection([0, 90], 'gmst', jd, 0), toSun) > 177);
});

test('body axes are orthonormal and right-handed', () => {
  const { x, y, z } = bodyAxes([268.057, 64.495], [284.95, 870.536], 2461000.5);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const v of [x, y, z]) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12);
  assert.ok(Math.abs(dot(x, y)) < 1e-12 && Math.abs(dot(y, z)) < 1e-12 && Math.abs(dot(x, z)) < 1e-12);
  const c = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  assert.ok(dot(c, z) > 0.999999);
});
