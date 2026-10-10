import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satrecFromRow, stateAt, precessionToJ2000, temeToEcliptic, subPoint } from '../src/astro/sgp4.js';

// CelesTrak GP row for the ISS (epoch 2026-10-09 19:42 UTC), as /api/satellites serves it.
const ISS = [25544, 'ISS (ZARYA)', 0, 1791574969139, 15.48793003, 0.00067745, 51.6314, 92.7969, 242.6225, 117.4075, 0.00012651917, 0.00006479, 0, '1998-067A'];
// JPL Horizons, ISS (-125544) geocentric, J2000 ecliptic, km, at 2026-10-09 18:00 TDB.
const HORIZONS = [2612.424445832627, 3257.522958536613, -5368.169065885251];
const TDB_MINUS_UTC_DAYS = 69.184 / 86400;

test('precession matrix is a rotation and ~0.36° by 2026', () => {
  const P = precessionToJ2000(2461323.25);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const d = P[i][0] * P[j][0] + P[i][1] * P[j][1] + P[i][2] * P[j][2];
    assert.ok(Math.abs(d - (i === j ? 1 : 0)) < 1e-12);
  }
  const angle = Math.acos((P[0][0] + P[1][1] + P[2][2] - 1) / 2) * 180 / Math.PI;
  assert.ok(Math.abs(angle - 0.36) < 0.02, `angle ${angle}`);
});

test('SGP4 ISS position matches JPL Horizons to within 20 km', () => {
  const jdUtc = 2461323.25 - TDB_MINUS_UTC_DAYS;
  const s = stateAt(satrecFromRow(ISS), jdUtc);
  const p = temeToEcliptic(s.position, precessionToJ2000(jdUtc));
  const err = Math.hypot(p[0] - HORIZONS[0], p[1] - HORIZONS[1], p[2] - HORIZONS[2]);
  assert.ok(err < 20, `${err.toFixed(1)} km`);
  const g = subPoint(s.position, jdUtc);
  assert.ok(g.altKm > 400 && g.altKm < 440);
  assert.ok(Math.abs(g.lat) <= 51.7);
});
