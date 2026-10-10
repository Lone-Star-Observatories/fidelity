import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETSHINE, lambertPhase, planetshineFraction, litFraction, planetshineDisplay, angleBetween } from '../src/astro/planetshine.js';

test('Lambert phase law', () => {
  assert.equal(lambertPhase(0), 1);
  assert.ok(Math.abs(lambertPhase(Math.PI / 2) - 1 / Math.PI) < 1e-12);
  assert.ok(Math.abs(lambertPhase(Math.PI)) < 1e-12);
});

test('earthshine at new Moon is ~1e-4 of sunlight (BBSO: Qiu et al. 2003, Pallé et al. 2003)', () => {
  const f = planetshineFraction(PLANETSHINE.earth.p, 6371, 384400, 0);
  assert.ok(f > 0.85e-4 && f < 1.2e-4, f);
  // with BBSO's mean apparent albedo p* ≈ 0.297 in place of the geometric albedo the same order holds
  assert.ok(Math.abs(planetshineFraction(0.297, 6371, 384400, 0) / f - 0.297 / 0.367) < 1e-9);
  // at first/last quarter of the Moon (Earth half lit, α = 90°) about a third of that
  assert.ok(Math.abs(planetshineFraction(PLANETSHINE.earth.p, 6371, 384400, Math.PI / 2) / f - 1 / Math.PI) < 1e-9);
  // earthlight is bluish
  const [r, , b] = PLANETSHINE.earth.tint;
  assert.ok(b > r);
});

test('planetshine elsewhere: Jupiter on Io, Saturn on Titan, Mars on Phobos', () => {
  const io = planetshineFraction(PLANETSHINE.jupiter.p, 69911, 421700, 0);
  const titan = planetshineFraction(PLANETSHINE.saturn.p, 58232, 1221870, 0);
  const phobos = planetshineFraction(PLANETSHINE.mars.p, 3389.5, 9376, 0);
  assert.ok(io > 0.01 && io < 0.02, io); // ~1.5% of Io's sunlight
  assert.ok(titan > 8e-4 && titan < 1.5e-3, titan);
  assert.ok(phobos > 0.015 && phobos < 0.03, phobos); // Mars fills 42° of Phobos' sky
  assert.ok(io > 100 * planetshineFraction(PLANETSHINE.earth.p, 6371, 384400, 0));
});

test('lit fraction and the display exposure', () => {
  assert.equal(litFraction(0), 1);
  assert.ok(Math.abs(litFraction(Math.PI / 2) - 0.5) < 1e-12);
  assert.ok(Math.abs(planetshineDisplay(1e-4) - 0.04) < 1e-12);
  assert.ok(planetshineDisplay(0.015) > planetshineDisplay(1e-4));
  assert.equal(planetshineDisplay(10), 0.16);
  assert.equal(planetshineDisplay(0), 0);
  assert.ok(Math.abs(angleBetween([1, 0, 0], [0, 2, 0]) - Math.PI / 2) < 1e-12);
});
