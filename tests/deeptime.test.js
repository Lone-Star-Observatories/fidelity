// The shared clock beyond JavaScript's dates and the deep-time readout (#34).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, yearsLimit, calendarLimit, jdOfYear, JD_MIN, JD_MAX, YEAR_DAYS, DEEP_MAX_YEARS, STEP_UNITS } from '../src/astro/clock.js';
import { formatOffset, clockReadout, deepTicks, rateLabel } from '../src/astro/timerate.js';

globalThis.performance ??= { now: () => Date.now() };
const jdNow = () => Date.now() / 86400000 + 2440587.5;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≉ ${b}`);

test('deep time: the clock runs past the calendar when the view allows it', () => {
  const c = createClock();
  c.setLimit(yearsLimit(2e9, 'SATELLITE ORBITS ±2 GYR'));
  c.setYears(1.2e6);
  near(c.years, 1.2e6, 1e-3, 'years from now');
  assert.equal(c.inCalendar, false);
  assert.equal(c.jd, JD_MAX, 'the calendar JD stays a valid date');
  assert.ok(!Number.isNaN(new Date((c.jd - 2440587.5) * 86400000).getTime()));
  near(c.deepJd - jdNow(), 1.2e6 * YEAR_DAYS, 1, 'deep JD');
  c.setYears(-3e5);
  assert.equal(c.jd, JD_MIN);
  assert.equal(c.inCalendar, false);
  c.setYears(100);
  assert.equal(c.inCalendar, true);
  near(c.jd, c.deepJd, 0, 'in the calendar the two agree');
});

test('deep time: a Gyr per second, reverse, and stepping by MYR', () => {
  const c = createClock();
  c.setLimit(yearsLimit(2e9, 'GAL'));
  const t0 = performance.now();
  c.tick(t0);
  c.setRate(365.25e9, '1 GYR/S');
  c.tick(t0 + 500);
  near(c.years, 0.5e9, 1e3, 'half a second at 1 Gyr/s');
  c.reverse(rateLabel);
  assert.equal(c.rate.days, -365.25e9);
  assert.equal(c.rate.label, '−1 GYR/S', 'the preset the other way');
  c.tick(t0 + 750);
  near(c.years, 0.25e9, 1e3, 'running back');
  c.tick(t0 + 750); // a second loop in the same frame does not move it again
  near(c.years, 0.25e9, 1e3);
  c.setRate(0);
  c.step(-3, 'myr');
  near(c.years, 0.25e9 - 3e6, 1e3, 'stepped 3 Myr back');
  assert.ok(STEP_UNITS.some((u) => u.id === 'gyr'));
  c.setRate(2 * 365.2425, '2 YEARS/S');
  c.reverse(rateLabel);
  assert.equal(c.rate.label, '−2 YEARS/S', 'a custom rate reversed and relabelled');
});

test('each view clamps the clock at its limit, holds, and says why', () => {
  const c = createClock();
  c.setLimit(yearsLimit(5e7, 'ORBITS INTEGRATED ±50 MYR'));
  const t0 = performance.now();
  c.tick(t0);
  c.setRate(365.25e9, '1 GYR/S');
  c.tick(t0 + 1000);
  near(c.years, 5e7, 1, 'stopped at +50 Myr');
  assert.equal(c.rate.days, 0, 'held');
  assert.equal(c.clamped, 'ORBITS INTEGRATED ±50 MYR');
  c.step(-1, 'myr');
  assert.equal(c.clamped, null, 'moving away clears the reason');
  // a setting beyond the limit lands on it
  c.setYears(-9e7);
  near(c.years, -5e7, 1);
  assert.equal(c.clamped, 'ORBITS INTEGRATED ±50 MYR');
  // a narrower view pulls the clock in (and holds it there with its own reason)
  c.setLimit(yearsLimit(2e9, 'GAL'));
  c.setYears(1e9);
  c.setRate(365.25e6, '1 MYR/S');
  c.setLimit(calendarLimit(-2999, 3000, 'KEPLER ELEMENTS · 3000 BCE–3000 CE'));
  assert.equal(c.inCalendar, true);
  assert.equal(c.deepJd, jdOfYear(3001) - 1 / 1440);
  assert.equal(c.rate.days, 0);
  assert.equal(c.clamped, 'KEPLER ELEMENTS · 3000 BCE–3000 CE');
  assert.equal(new Date((c.jd - 2440587.5) * 86400000).toISOString().slice(0, 16), '3000-12-31T23:59');
  c.now();
  assert.equal(c.clamped, null);
  assert.ok(c.isNow);
  // no view reaches past ±2 Gyr
  c.setLimit({ minJd: -1e15, maxJd: 1e15, reason: 'WIDE' });
  c.setYears(1e10);
  near(c.years, DEEP_MAX_YEARS, 1);
  // null restores the calendar
  c.setLimit(null);
  assert.equal(c.deepJd, JD_MAX);
});

test('jdOfYear: proleptic Gregorian years, BCE as astronomical numbering', () => {
  assert.equal(jdOfYear(2000), 2451544.5);
  assert.equal(jdOfYear(1970), 2440587.5);
  assert.equal(jdOfYear(0), 1721059.5); // 1 January 1 BCE (proleptic Gregorian)
});

test('readout: a date in the calendar, an offset beyond it', () => {
  const now = 2461323.5; // 2026-10-10 00:00 UTC
  assert.equal(clockReadout(now + 0.5, now), '2026-10-10 12:00:00');
  assert.equal(clockReadout(now + 1.2e6 * YEAR_DAYS, now), '+1.2 MYR');
  assert.equal(clockReadout(now - 2e9 * YEAR_DAYS, now), '−2.0 GYR');
  assert.match(clockReadout(JD_MAX, now), /^\+275\d{3}-\d\d-\d\d /, 'the last calendar day is still a date');
  assert.equal(formatOffset(1.2e6), '+1.2 MYR');
  assert.equal(formatOffset(2e9), '+2.0 GYR');
  assert.equal(formatOffset(-3e5), '−300 KYR');
  assert.equal(formatOffset(4.5e4), '+45.0 KYR');
  assert.equal(formatOffset(-750), '−750 YR');
  assert.equal(formatOffset(999960), '+1.0 MYR', 'rounds up into the next unit');
  assert.equal(formatOffset(0.01), 'NOW');
});

test('rate labels and timeline ticks in deep time', () => {
  assert.equal(rateLabel(365.25e6), '1 MYR/S');
  assert.equal(rateLabel(-2.5 * 365.25e9), '−2.5 GYR/S');
  assert.equal(rateLabel(100 * 365242.5), '100 KYR/S');
  const t = deepTicks(-5e7, 5e7, 1000, 80);
  assert.deepEqual(t.map((k) => k.label), ['−50.0 MYR', '−40.0 MYR', '−30.0 MYR', '−20.0 MYR', '−10.0 MYR', 'NOW', '+10.0 MYR', '+20.0 MYR', '+30.0 MYR', '+40.0 MYR', '+50.0 MYR']);
  const g = deepTicks(0.1e9, 2e9, 600, 80);
  assert.ok(g.length >= 3 && g.length <= 8 && g.every((k) => / GYR$| MYR$/.test(k.label)));
});
