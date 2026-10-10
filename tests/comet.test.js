import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cometMagnitude, cometActivity, cometSizes } from '../src/views/system/comet.js';

test("Halley's magnitude law: naked-eye in 1986, hopeless at today's 35 AU", () => {
  // perihelion 1986 Feb 9: r = 0.587 AU, Δ ≈ 1.55 AU; it peaked around magnitude 2.5–4 that spring
  const m = cometMagnitude({ M1: 5.5, K1: 8 }, 1.55, 0.587);
  assert.ok(m > 2.5 && m < 5.5, String(m));
  assert.ok(cometMagnitude({ M1: 5.5, K1: 8 }, 34, 35) > 25);
});

test('activity switches on inside 5 AU; tails grow towards the Sun', () => {
  assert.equal(cometActivity(35), 0);
  assert.equal(cometActivity(2), 1);
  const far = cometSizes(2.5), near = cometSizes(0.6);
  assert.ok(near.ionAU > far.ionAU && near.dustAU > far.dustAU && near.comaKm > far.comaKm);
  assert.ok(near.ionAU <= 0.6);
});

import { spiralAngleDeg, fieldStrength, sheetLatitude } from '../src/views/system/solarfield.js';
test('Parker spiral: ~45° to radial at 1 AU, nearly azimuthal at Saturn; 5 nT at 1 AU falling as 1/r far out', () => {
  const a1 = spiralAngleDeg(1);
  assert.ok(a1 > 42 && a1 < 49, String(a1));
  assert.ok(spiralAngleDeg(10) > 84);
  assert.ok(Math.abs(fieldStrength(1) - 5) < 1e-9);
  const r = fieldStrength(10) / fieldStrength(20);
  assert.ok(r > 1.9 && r < 2.1, String(r)); // ∝ 1/r where B_φ dominates
  assert.ok(Math.abs(sheetLatitude(Math.PI / 2, 45) - Math.PI / 4) < 1e-12);
});

import { heliosphere, VOYAGER_DIRS, HELIO } from '../src/views/system/zones.js';
import { frameToScene, eqToEcl } from '../src/astro/frames.js';
test('heliosphere shells pass through both Voyager crossings; the south (V2) side is closer', () => {
  const { fits, nose } = heliosphere((v) => frameToScene(v), eqToEcl);
  const D = Math.PI / 180;
  const dir = ({ ra, dec }) => frameToScene(eqToEcl([Math.cos(dec * D) * Math.cos(ra * D), Math.cos(dec * D) * Math.sin(ra * D), Math.sin(dec * D)]));
  const v1 = dir(VOYAGER_DIRS.v1), v2 = dir(VOYAGER_DIRS.v2);
  const n = [nose.x, nose.y, nose.z], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const s = v1.map((x, i) => x - v2[i]), sl = Math.hypot(...s), sa = s.map((x) => x / sl);
  const r = (f, v) => f.rN * (1 + 0.9 * (1 - dot(v, n)) ** 1.5) * (1 + f.k * dot(v, sa));
  assert.ok(Math.abs(r(fits.terminationShock, v1) - HELIO.terminationShock[0]) < 1e-6);
  assert.ok(Math.abs(r(fits.terminationShock, v2) - HELIO.terminationShock[1]) < 1e-6);
  assert.ok(Math.abs(r(fits.heliopause, v2) - HELIO.heliopause[1]) < 1e-6);
  assert.ok(fits.terminationShock.rN > 60 && fits.terminationShock.rN < 100, String(fits.terminationShock.rN));
});

import { SMALL_BODIES } from '../src/data/moons.js';
import { smallBodyPosition } from '../src/astro/smallbodies.js';
test("Halley's 2061 elements put perihelion on 2061-07-28 at 0.59 AU (JPL Horizons)", () => {
  const h = SMALL_BODIES.find((b) => b.id === 'halley');
  const r = Math.hypot(...smallBodyPosition(h.altElements[0], 2474034.22));
  assert.ok(Math.abs(r - 0.5928) < 0.002, String(r));
});
