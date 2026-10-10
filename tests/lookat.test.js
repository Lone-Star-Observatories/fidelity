import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angularDiameterDeg, phase, describeSize, fmtAngle, fitFov } from '../src/astro/lookat.js';
import { moonGeocentric } from '../src/astro/moons.js';
import { heliocentric } from '../src/astro/kepler.js';

const AU = 149597870.7, R_EARTH = 6378.137;
const jdOf = (iso) => Date.parse(iso) / 86400000 + 2440587.5;

// JPL Horizons observer tables, target 399 (Earth) from 500@301 (the Moon's centre), 00:00 UT:
// [date, illuminated %, angular diameter ″] (queried 2026-10-10)
const HORIZONS = [
  ['2026-10-10T00:00:00Z', 99.43365, 6831.290],
  ['2026-10-17T00:00:00Z', 65.56812, 6503.353],
  ['2026-10-24T00:00:00Z', 6.02068, 6949.442],
  ['2026-11-01T00:00:00Z', 40.37885, 7112.060],
];

test('Earth from the Moon: size and phase from the app\'s own ephemeris match JPL Horizons', () => {
  for (const [iso, illu, diam] of HORIZONS) {
    const jd = jdOf(iso) + 69.2 / 86400; // TT
    const moon = moonGeocentric(jd); // km, Earth → Moon
    const emb = heliocentric('earth', jd).map((x) => x * AU); // Sun → Earth–Moon barycentre
    const earth = emb.map((x, i) => x - moon[i] / 82.30); // Sun → Earth
    const d = Math.hypot(...moon);
    const deg = angularDiameterDeg(R_EARTH, d);
    assert.ok(Math.abs(deg * 3600 - diam) / diam < 0.005, `${iso}: ${(deg * 3600).toFixed(0)}″ vs ${diam}″`);
    const p = phase(earth.map((x) => -x), moon);
    assert.ok(Math.abs(p.illuminated * 100 - illu) < 1.5, `${iso}: ${(p.illuminated * 100).toFixed(1)}% vs ${illu}%`);
  }
});

test('readouts: angles, comparisons with the full Moon, and fitted fields', () => {
  assert.equal(fmtAngle(1.898), '1.90°');
  assert.equal(fmtAngle(0.5267), '31.6′');
  assert.match(describeSize(1.898), /^1\.90° · 3\.7 × THE FULL MOON$/);
  assert.match(describeSize(0.0001), /A POINT TO THE EYE/);
  assert.equal(fitFov(1.9), 7.6);
  assert.equal(fitFov(90), 60);
  assert.equal(fitFov(0.001), 0.05);
});
