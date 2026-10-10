import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { angularDiameterDeg, discRadiusPx, verticalFov, horizontalFov, FOV_PRESETS, presetFov, glareStrength, airmass } from '../src/astro/apparent.js';
import { moonGeocentric } from '../src/astro/moons.js';
import { heliocentric } from '../src/astro/kepler.js';
import { SUN } from '../src/data/sol.js';
import { MOONS } from '../src/data/moons.js';

const AU = 149597870.7;
const jd = (iso) => Date.parse(iso) / 86400000 + 2440587.5;
const MOON_R = MOONS.find((m) => m.id === 'moon').radiusKm;
// JPL Horizons, geocentric observer table (QUANTITIES 13 angular diameter, 20 delta), queried 2026-10-10:
// the extremes of 2026 at 6-hour steps.
const HORIZONS = [
  { body: 'moon', what: 'perigee', t: '2026-12-24T06:00Z', arcsec: 2009.567, au: 0.00238412398244 },
  { body: 'moon', what: 'apogee', t: '2026-12-11T06:00Z', arcsec: 1763.456, au: 0.00271685306732 },
  { body: 'sun', what: 'perihelion', t: '2026-01-03T18:00Z', arcsec: 1951.041, au: 0.98330205236201 },
  { body: 'sun', what: 'aphelion', t: '2026-07-06T12:00Z', arcsec: 1887.054, au: 1.01664385987608 },
];

test('angular diameter from the app\'s radii matches JPL Horizons at the 2026 extremes', () => {
  for (const r of HORIZONS) {
    const R = r.body === 'moon' ? MOON_R : SUN.radiusKm;
    const deg = angularDiameterDeg(R, r.au * AU);
    // Horizons uses 696,000 km for the Sun (IAU nominal 695,700 is 0.04% smaller)
    assert.ok(Math.abs(deg * 3600 - r.arcsec) / r.arcsec < 0.0006, `${r.what}: ${(deg * 3600).toFixed(1)}" vs ${r.arcsec}"`);
  }
});

test('the app\'s own ephemeris gives the right apparent size at perigee, apogee, perihelion, aphelion', () => {
  for (const r of HORIZONS) {
    const d = r.body === 'moon' ? Math.hypot(...moonGeocentric(jd(r.t))) : Math.hypot(...heliocentric('earth', jd(r.t))) * AU;
    const deg = angularDiameterDeg(r.body === 'moon' ? MOON_R : SUN.radiusKm, d);
    const tol = r.body === 'moon' ? 0.002 : 0.0006; // Meeus lunar series ~10 km in distance; Standish Earth ~1e-5 AU
    assert.ok(Math.abs(deg * 3600 - r.arcsec) / r.arcsec < tol, `${r.what}: ${(deg * 3600).toFixed(1)}" vs ${r.arcsec}"`);
  }
  // the Moon's disc varies by ~14% between apogee and perigee, the Sun's by ~3.4%
  assert.ok(Math.abs(2009.567 / 1763.456 - 1.1396) < 0.001);
});

test('a disc rendered through a perspective camera covers exactly its true angular size', () => {
  for (const [fov, H] of [[50, 900], [6, 900], [1, 1080], [110, 700]]) {
    const cam = new THREE.PerspectiveCamera(fov, 1.6, 1e-6, 1e9);
    cam.position.set(0, 0, 0); cam.lookAt(0, 0, -1); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const D = 384400, R = MOON_R;
    // the limb seen from the eye: the tangent point, at angle asin(R/D) from the centre
    const a = Math.asin(R / D), limb = new THREE.Vector3(0, Math.sin(a), -Math.cos(a)).multiplyScalar(Math.sqrt(D * D - R * R)).project(cam);
    const px = (limb.y * H) / 2;
    assert.ok(Math.abs(px - discRadiusPx(angularDiameterDeg(R, D), fov, H)) < 1e-6 * H, `fov ${fov}`);
  }
  // at the TELESCOPE preset the Moon (~0.5°) fills about half the 1° field
  assert.ok(Math.abs(discRadiusPx(0.5, 1, 1000) - 250) < 0.1);
});

test('field-of-view presets', () => {
  const asp = 16 / 9;
  for (const p of FOV_PRESETS) {
    const v = presetFov(p, asp);
    if (p.across === 'h') assert.ok(Math.abs(horizontalFov(v, asp) - p.deg) < 1e-9);
    else assert.equal(v, p.deg);
  }
  assert.ok(Math.abs(2 * Math.atan(18 / 50) * 180 / Math.PI - FOV_PRESETS.find((p) => p.id === '50mm').deg) < 0.5);
  assert.ok(Math.abs(verticalFov(90, 1) - 90) < 1e-9);
});

test('glare follows the Sun\'s illuminance, the atmosphere and an eclipse', () => {
  assert.equal(glareStrength(1, 45), 1);
  assert.ok(glareStrength(30, 45) > 0.5 && glareStrength(30, 45) < 0.6); // Neptune: 1/900 of the light
  assert.ok(glareStrength(1, 2, { k: 0.2 }) < glareStrength(1, 60, { k: 0.2 })); // low Sun through more air
  assert.ok(glareStrength(1, 45, { obscuration: 0.9 }) < 0.86);
  assert.equal(glareStrength(1, 45, { obscuration: 1 }), 0);
  assert.equal(glareStrength(1, -5), 0);
  assert.ok(Math.abs(airmass(90) - 1) < 0.001 && airmass(0) > 37 && airmass(0) < 39);
});
