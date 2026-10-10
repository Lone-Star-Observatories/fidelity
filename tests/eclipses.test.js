import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solarEclipses, lunarEclipses, planetTransits, deltaT, useEarthEphemeris, interpolateDaily, localCircumstances, surfacePoint, jovianPlaneCrossing } from '../src/astro/eclipses.js';

// NASA/GSFC Five Millennium Canon (Espenak & Meeus): greatest eclipse in TD (= TT), gamma,
// magnitude, central duration and the point of greatest eclipse.
const SOLAR = [
  { day: '2023-10-14', td: '18:00:41', kind: 'annular', gamma: 0.3753, mag: 0.952, dur: 317, lat: 11.4, lon: -83.1 },
  { day: '2024-04-08', td: '18:18:29', kind: 'total', gamma: 0.3431, mag: 1.0566, dur: 268, lat: 25.3, lon: -104.1 },
  { day: '2026-08-12', td: '17:47:06', kind: 'total', gamma: 0.8977, mag: 1.0386, dur: 138, lat: 65.2, lon: -25.2 },
  { day: '2027-08-02', td: '10:07:50', kind: 'total', gamma: 0.1421, mag: 1.079, dur: 383, lat: 25.5, lon: 33.2 },
];
// NASA lunar eclipse pages: greatest eclipse (UT) and umbral magnitude.
const LUNAR = [
  { day: '2025-03-14', ut: '06:58:43', kind: 'total', umag: 1.1784 },
  { day: '2025-09-07', ut: '18:11:48', kind: 'total', umag: 1.362 },
];
const jdOf = (day, hms = '00:00:00') => Date.parse(`${day}T${hms}Z`) / 86400000 + 2440587.5;

// JPL Horizons daily heliocentric Earth around each eclipse: the JPL HORIZONS ephemeris mode
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/horizons-earth-eclipses.json', import.meta.url))).points;
const runs = Object.values(fx).filter((r) => r.length);
const horizons = (jd) => { for (const run of runs) { const v = interpolateDaily(run, jd); if (v) return v; } return null; };

for (const [mode, provider, tol] of [['JPL Horizons Sun', horizons, 30], ['Keplerian Sun', null, 90]]) {
  test(`solar eclipses match the Five Millennium Canon (${mode}, ±${tol} s)`, () => {
    useEarthEphemeris(provider);
    try {
      for (const r of SOLAR) {
        const [e] = solarEclipses(jdOf(r.day) - 0.5, jdOf(r.day) + 1);
        assert.ok(e, `${r.day}: eclipse found`);
        assert.equal(e.kind, r.kind, r.day);
        const tdErr = (e.greatest + deltaT(e.greatest) / 86400 - jdOf(r.day, r.td)) * 86400;
        assert.ok(Math.abs(tdErr) < tol, `${r.day}: greatest eclipse off by ${tdErr.toFixed(0)} s`);
        assert.ok(Math.abs(Math.abs(e.gamma) - r.gamma) < 0.003, `${r.day}: gamma ${e.gamma.toFixed(4)}`);
        assert.ok(Math.abs(e.magnitude - r.mag) < 0.002, `${r.day}: magnitude ${e.magnitude.toFixed(4)}`);
        assert.ok(Math.abs(e.durationS - r.dur) < 10, `${r.day}: duration ${e.durationS.toFixed(0)} s`);
        assert.ok(Math.abs(e.place.lat - r.lat) < 0.5 && Math.abs(e.place.lon - r.lon) < 0.6, `${r.day}: greatest at ${e.place.lat.toFixed(2)}, ${e.place.lon.toFixed(2)}`);
      }
    } finally { useEarthEphemeris(null); }
  });
}

test('lunar eclipses match NASA (Danjon shadow, ±30 s, ±0.006 in umbral magnitude)', () => {
  useEarthEphemeris(horizons);
  try {
    for (const r of LUNAR) {
      const [e] = lunarEclipses(jdOf(r.day) - 0.5, jdOf(r.day) + 1);
      assert.equal(e.kind, r.kind);
      const err = (e.greatest - jdOf(r.day, r.ut)) * 86400;
      assert.ok(Math.abs(err) < 30, `${r.day}: greatest off by ${err.toFixed(0)} s`);
      assert.ok(Math.abs(e.magnitude - r.umag) < 0.006, `${r.day}: umbral magnitude ${e.magnitude.toFixed(4)}`);
      assert.ok(e.contacts.U2 && e.contacts.U3 && e.contacts.U3 > e.contacts.U2);
    }
  } finally { useEarthEphemeris(null); }
});

test('the 2032 transit of Mercury is found (Keplerian elements: within 5 minutes)', () => {
  const [t] = planetTransits(jdOf('2032-11-01'), jdOf('2032-11-30'));
  assert.equal(t.body, 'mercury');
  const err = (t.greatest - jdOf('2032-11-13', '08:54:00')) * 1440;
  assert.ok(Math.abs(err) < 5, `greatest transit off by ${err.toFixed(1)} min`);
  assert.ok(Math.abs(t.separationArcsec - 572) < 15, `closest ${t.separationArcsec.toFixed(0)}″`);
});

test('totality at Luxor on 2027-08-02 hides the whole Sun', () => {
  const luxor = surfacePoint(25.7, 32.65);
  const c = localCircumstances(jdOf('2027-08-02', '10:05:20'), luxor);
  assert.ok(c.sm > c.ss && c.sep < c.sm - c.ss, `separation ${(c.sep * 206265).toFixed(0)}″`);
  assert.equal(c.obscuration, 1);
  // published: about 6 min 19 s of totality at Luxor
  let total = 0;
  for (let s = 0; s < 1200; s++) { const l = localCircumstances(jdOf('2027-08-02', '09:55:00') + s / 86400, luxor); if (l.sep < l.sm - l.ss) total++; }
  assert.ok(total > 365 && total < 400, `totality ${total} s`);
});

test('Jupiter\'s 2026–27 mutual-event season is flagged', () => {
  assert.equal(jovianPlaneCrossing(jdOf('2026-10-10')).season, true);
  assert.equal(jovianPlaneCrossing(jdOf('2029-10-10')).season, false);
});
