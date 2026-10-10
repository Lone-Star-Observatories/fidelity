import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepJd, createClock } from '../src/astro/clock.js';

const jd = (s) => Date.parse(s) / 86400000 + 2440587.5;
const iso = (x) => new Date((x - 2440587.5) * 86400000).toISOString().slice(0, 16);
globalThis.performance ??= { now: () => Date.now() };

test('calendar steps keep the date (and clamp to the month length)', () => {
  assert.equal(iso(stepJd(jd('2024-01-31T12:00Z'), 1, 'month')), '2024-02-29T12:00');
  assert.equal(iso(stepJd(jd('2024-02-29T00:00Z'), 1, 'year')), '2025-02-28T00:00');
  assert.equal(iso(stepJd(jd('2026-10-10T00:00Z'), -3, 'decade')), '1996-10-10T00:00');
  assert.equal(iso(stepJd(jd('2026-10-10T00:00Z'), 2, 'millennium')), '4026-10-10T00:00');
});

test('fixed steps and fractions', () => {
  assert.equal(iso(stepJd(jd('2026-10-10T09:00Z'), -90, 'minute')), '2026-10-10T07:30');
  assert.equal(iso(stepJd(jd('2026-10-10T00:00Z'), 2.5, 'week')), '2026-10-27T12:00');
  assert.equal(iso(stepJd(jd('2026-10-10T00:00Z'), 0.5, 'year')), iso(jd('2026-10-10T00:00Z') + 182.62125));
});

test('the clock steps, runs at a custom rate, and returns to presets', () => {
  const c = createClock();
  const t0 = c.jd;
  c.step(3, 'day');
  assert.ok(Math.abs(c.jd - t0 - 3) < 1e-6);
  c.setRate(30, '30 DAYS/S');
  assert.equal(c.rate.label, '30 DAYS/S');
  c.tick(performance.now() + 1000);
  assert.ok(c.jd - t0 > 32.9, 'one second at 30 days/s');
  c.faster();
  assert.ok(c.rate.days > 30 && !c.rate.label.includes('30 DAYS'), 'back on the preset ladder');
  c.setRate(0);
  assert.equal(c.rate.days, 0);
});
