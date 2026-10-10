import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliderToDays, daysToSlider, rateLabel, timelineTicks, SLIDER_MAX, DEAD } from '../src/astro/timerate.js';
import { createClock, JD_MAX } from '../src/astro/clock.js';

globalThis.performance ??= { now: () => Date.now() };
const jd = (s) => Date.parse(s) / 86400000 + 2440587.5;

test('rate slider: HOLD in the middle, real time to a billion years per second, both ways', () => {
  assert.equal(sliderToDays(0), 0);
  assert.equal(sliderToDays(DEAD - 1), 0);
  assert.equal(sliderToDays(DEAD + 1), 1 / 86400); // snaps to the REAL TIME detent
  assert.equal(sliderToDays(SLIDER_MAX), 365.25e9);
  assert.equal(sliderToDays(-SLIDER_MAX), -365.25e9);
  for (const d of [1 / 86400, 1 / 1440, 1 / 24, 1, 7, 365.2425, 36524.25, 365242.5, 365.25e6, 365.25e9]) {
    assert.equal(sliderToDays(daysToSlider(d)), d, `detent ${d}`);
    assert.equal(sliderToDays(daysToSlider(-d)), -d);
  }
  assert.ok(daysToSlider(1) > daysToSlider(1 / 24) && daysToSlider(365) > daysToSlider(30));
  assert.equal(daysToSlider(1e13), SLIDER_MAX); // clamped
});

test('rate labels', () => {
  assert.equal(rateLabel(0), 'HOLD');
  assert.equal(rateLabel(1 / 86400), 'REAL TIME');
  assert.equal(rateLabel(1), '1 DAY/S');
  assert.equal(rateLabel(-2.5), '−2.5 DAYS/S');
  assert.equal(rateLabel(365242.5), '1 MILLENNIUM/S');
  assert.equal(rateLabel(3 * 36524.25), '3 CENTURIES/S');
  assert.equal(rateLabel(40 / 1440), '40 MIN/S');
});

test('timeline ticks: hours, days, months and years on calendar boundaries', () => {
  const c = jd('2026-10-10T12:00:00Z');
  const hours = timelineTicks(c - 0.5, c + 0.5, 1000);
  assert.ok(hours.length >= 4 && /^\d\d:\d\d$/.test(hours[0].label));
  const months = timelineTicks(c - 180, c + 180, 1000);
  assert.ok(months.some((t) => t.label === '2027-01'));
  assert.ok(months.every((t) => /^\d{4}(-\d\d)?$/.test(t.label)), months.map((t) => t.label).join());
  for (const t of months) assert.equal(new Date((t.jd - 2440587.5) * 86400000).getUTCDate(), 1);
  const years = timelineTicks(c - 36525 * 30, c + 36525, 1000);
  assert.ok(years.some((t) => t.label.endsWith('BCE')), 'BCE years labelled');
  assert.ok(years.length >= 3 && years.length < 20);
});

test('clock stops at the edge of JavaScript dates instead of producing invalid ones', () => {
  const clock = createClock();
  clock.set(JD_MAX + 1e6);
  assert.equal(clock.jd, JD_MAX);
  assert.ok(!Number.isNaN(new Date((clock.jd - 2440587.5) * 86400000).getTime()));
  clock.set(JD_MAX - 1);
  clock.setRate(365242.5, '1 MILLENNIUM/S');
  clock.tick(performance.now() + 5000);
  assert.equal(clock.jd, JD_MAX);
  assert.equal(clock.rate.days, 0, 'held at the edge');
  const s = clock.snapshot(); clock.setRate(1, '1 DAY/S'); clock.restore(s);
  assert.equal(clock.rate.days, 0);
});
