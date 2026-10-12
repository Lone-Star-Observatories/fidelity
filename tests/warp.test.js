import { test } from 'node:test';
import assert from 'node:assert/strict';
import { warpToC, cToWarp, gamma, tripAtSpeed, burnCoastBurn, honestTrip, throttleToSpeed, speedToThrottle, regime, autoCruise,
  fmtDuration, fmtDistance, fmtSpeed, C_KM_S, AU_KM, LY_KM, YEAR_S, WARP_CANON } from '../src/astro/warp.js';
import { heliocentric } from '../src/astro/kepler.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('TNG warp scale: warp 1 is c, warp 9 ≈ 1,516 c, warp 10 unattainable', () => {
  assert.equal(warpToC(1), 1);
  close(warpToC(2), 10.08, 0.01);
  close(warpToC(9), 1516, 1);
  assert.equal(warpToC(10), Infinity);
  assert.equal(warpToC(0), 0);
});

test('above warp 9 the curve passes through the Technical Manual figures and keeps rising', () => {
  for (const [w, c] of WARP_CANON.slice(1)) close(warpToC(w), c, c * 1e-6, `warp ${w}`);
  let prev = 0;
  for (let w = 0.5; w < 9.99995; w += 0.0137) { const v = warpToC(w); assert.ok(v > prev, `monotonic at ${w}`); prev = v; }
  close(warpToC(9.975), 5416, 30, 'Voyager-class 9.975 on this curve');
});

test('cToWarp inverts warpToC', () => {
  for (const w of [0.4, 1, 3.7, 8, 9, 9.3, 9.75, 9.9, 9.95, 9.99, 9.9995]) close(cToWarp(warpToC(w)), w, 1e-9, `warp ${w}`);
  assert.equal(cToWarp(Infinity), 10);
});

test('relativity: γ at 0.25 c ≈ 1.0328; ship time runs slow', () => {
  close(gamma(0.25), 1.0328, 1e-4);
  close(gamma(0.2), 1.0206, 1e-4);
  const t = tripAtSpeed(LY_KM, 0.25 * C_KM_S);
  close(t.earthS / YEAR_S, 4, 1e-9);
  close(t.shipS / YEAR_S, 4 / 1.0328, 1e-3);
  assert.equal(tripAtSpeed(LY_KM, 2 * C_KM_S).shipS, null); // no proper time beyond c
});

test('Breakthrough Starshot to Alpha Centauri (4.37 ly) takes ≈ 21.8 years', () => {
  const trip = honestTrip(4.37 * LY_KM);
  const s = trip.rows.find((r) => r.id === 'starshot');
  close(s.earthS / YEAR_S, 21.85, 0.01);
  close(s.shipS / YEAR_S, 21.85 / gamma(0.2), 0.01);
  const v = trip.rows.find((r) => r.id === 'chemical'); // Voyager speed: ~77,000 years
  close(v.earthS / YEAR_S, 77100, 200);
  close(trip.warp.earthS / YEAR_S, 4.37 / 1516, 1e-5); // warp 9: under a day
});

test('relativistic rocket: 1 g to 0.25 c and back', () => {
  const r = burnCoastBurn(4.37 * LY_KM, 0.25, 9.80665);
  assert.ok(r.shipS < r.earthS);
  assert.equal(r.peakBeta, 0.25);
  close(r.earthS / YEAR_S, 17.73, 0.01); // coast 4.31 ly at 0.25 c (17.2 yr) plus two ~3-month burns
  const short = burnCoastBurn(AU_KM, 0.25, 9.80665); // 1 AU at 1 g never gets near 0.25 c: flip at midpoint
  assert.ok(short.peakBeta < 0.01);
  close(short.earthS / 86400, 2 * Math.sqrt(AU_KM * 1000 / 9.80665) / 86400, 1e-3); // Newtonian limit: 2√(D/a) ≈ 2.9 days
});

test('light-time Earth–Mars at the 2025 closest approach matches JPL Horizons', () => {
  // Horizons: Mars–Earth range 0.6423 AU on 2025-01-12 (closest approach of the 2025 opposition).
  const jd = Date.UTC(2025, 0, 12) / 86400000 + 2440587.5;
  const e = heliocentric('earth', jd), m = heliocentric('mars', jd);
  const au = Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
  close(au, 0.6423, 0.003);
  const lt = tripAtSpeed(au * AU_KM, C_KM_S).earthS;
  close(lt, 0.6423 * 499.0048, 2);
  assert.equal(fmtDuration(lt).endsWith('MIN'), true);
});

test('throttle: full stop, 1 m/s → full impulse, then warp 1 → 9.99', () => {
  assert.deepEqual(throttleToSpeed(0), { kmS: 0, warp: 0 });
  close(throttleToSpeed(1e-9).kmS, 1e-3, 1e-6);
  close(throttleToSpeed(0.4999999).kmS, 0.25 * C_KM_S, 1);
  assert.equal(throttleToSpeed(0.5).warp, 1);
  close(throttleToSpeed(1).warp, 9.99, 1e-9);
  for (const t of [0.01, 0.2, 0.45, 0.6, 0.93]) close(speedToThrottle(throttleToSpeed(t).kmS), t, 1e-9, `t ${t}`);
  assert.equal(regime(0.3), 'manoeuvring');
  assert.equal(regime(7.66), 'manoeuvring');
  assert.equal(regime(5000), 'impulse');
  assert.equal(regime(2 * C_KM_S), 'warp');
});

test('autopilot cruise: impulse near home, warp across the system', () => {
  assert.equal(autoCruise(384400).warp, 0); // the Moon at ~19 km/s
  const mars = autoCruise(1.5 * AU_KM);
  assert.ok(mars.warp >= 1 && mars.warp <= 3);
  assert.ok(autoCruise(40 * AU_KM).warp > mars.warp);
  assert.equal(autoCruise(4 * LY_KM).warp, 9.9);
});

test('formatting', () => {
  assert.equal(fmtDuration(30), '30.0 S');
  assert.equal(fmtDuration(3 * 3600), '3.0 H');
  assert.equal(fmtDuration(21.85 * YEAR_S), '21.9 YEARS');
  assert.equal(fmtDistance(0.38), '380 M');
  assert.equal(fmtDistance(1.5 * AU_KM), '1.500 AU');
  assert.equal(fmtDistance(4.37 * LY_KM), '4.37 LY');
  assert.equal(fmtSpeed(7.66), '7.66 KM/S');
  assert.equal(fmtSpeed(1516 * C_KM_S), '1,516 c');
});
