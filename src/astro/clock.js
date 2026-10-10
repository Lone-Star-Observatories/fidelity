// The ship's clock: simulated time (Julian Date) advancing at a chosen rate.

import { jdFromDate } from './time.js';

// Days of simulated time per real second. 1/86400 is real time.
export const RATES = [
  { days: -365, label: '−1 YEAR/S' }, { days: -30, label: '−1 MONTH/S' }, { days: -7, label: '−1 WEEK/S' },
  { days: -1, label: '−1 DAY/S' }, { days: -1 / 24, label: '−1 HOUR/S' }, { days: 0, label: 'HOLD' },
  { days: 1 / 86400, label: 'REAL TIME' }, { days: 1 / 1440, label: '1 MIN/S' }, { days: 1 / 24, label: '1 HOUR/S' }, { days: 1, label: '1 DAY/S' },
  { days: 7, label: '1 WEEK/S' }, { days: 30, label: '1 MONTH/S' }, { days: 365, label: '1 YEAR/S' },
];
const REAL = RATES.findIndex((r) => r.label === 'REAL TIME');
// the preset nearest a custom rate (for ◀◀ / ▶▶ after a custom run)
const nearest = (days) => RATES.reduce((best, r, i) => (Math.abs(Math.log(Math.abs(r.days) + 1e-9) - Math.log(Math.abs(days))) < Math.abs(Math.log(Math.abs(RATES[best].days) + 1e-9) - Math.log(Math.abs(days))) && Math.sign(r.days) === Math.sign(days) ? i : best), REAL);

// Units for stepping the clock by n (months and longer are calendar steps; see stepJd).
export const STEP_UNITS = [
  { id: 'minute', label: 'MIN', days: 1 / 1440 }, { id: 'hour', label: 'HOUR', days: 1 / 24 }, { id: 'day', label: 'DAY', days: 1 },
  { id: 'week', label: 'WEEK', days: 7 }, { id: 'month', label: 'MONTH', months: 1, days: 30.436875 }, { id: 'year', label: 'YEAR', months: 12, days: 365.2425 },
  { id: 'decade', label: 'DECADE', months: 120, days: 3652.425 }, { id: 'century', label: 'CENTURY', months: 1200, days: 36524.25 },
  { id: 'millennium', label: 'MILLENNIUM', months: 12000, days: 365242.5 },
];
/**
 * `jd` moved by n units. Months and longer step the calendar (Jan 31 + 1 month → Feb 28/29), so a
 * yearly step lands on the same date; beyond JavaScript's date range they fall back to mean lengths.
 */
export function stepJd(jd, n, unitId) {
  const u = STEP_UNITS.find((x) => x.id === unitId) ?? STEP_UNITS[2];
  if (!u.months || !Number.isInteger(n)) return jd + n * u.days;
  const d = new Date((jd - 2440587.5) * 86400000);
  if (Number.isNaN(d.getTime())) return jd + n * u.days;
  const day = d.getUTCDate(), target = new Date(d);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + n * u.months);
  const len = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, len));
  return Number.isNaN(target.getTime()) ? jd + n * u.days : target.getTime() / 86400000 + 2440587.5;
}

// JavaScript dates span ±100,000,000 days around 1970 (±273,790 years): the clock stops at the edge.
export const JD_MIN = 2440587.5 - 9.99e7, JD_MAX = 2440587.5 + 9.99e7;
const HOLD = RATES.findIndex((r) => r.days === 0);

export function createClock() {
  let jd = jdFromDate(new Date());
  let rateIdx = REAL;
  let custom = null; // { days, label } when running at a chosen n units per second
  let last = performance.now();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(clock));

  const clock = {
    get jd() { return jd; },
    get rate() { return custom ?? RATES[rateIdx]; },
    get isNow() { return !custom && rateIdx === REAL && Math.abs(jd - jdFromDate(new Date())) < 1 / 1440; },
    tick(now = performance.now()) {
      jd += ((custom ?? RATES[rateIdx]).days * (now - last)) / 1000;
      last = now;
      if (jd < JD_MIN || jd > JD_MAX) { jd = Math.min(JD_MAX, Math.max(JD_MIN, jd)); custom = null; rateIdx = HOLD; emit(); }
    },
    set(newJd) { jd = Math.min(JD_MAX, Math.max(JD_MIN, newJd)); emit(); },
    /** The current rate, to hand back to restore() (e.g. after scrubbing the timeline). */
    snapshot() { return { rateIdx, custom }; },
    restore(s) { rateIdx = s.rateIdx; custom = s.custom; emit(); },
    /** Move the clock by n units (see stepJd). */
    step(n, unitId) { jd = Math.min(JD_MAX, Math.max(JD_MIN, stepJd(jd, n, unitId))); emit(); },
    /** Run at `days` per second with a label (e.g. 3 DAYS/S); 0 holds. */
    setRate(days, label) { custom = days === 0 ? null : { days, label }; if (days === 0) rateIdx = HOLD; emit(); },
    now() { jd = jdFromDate(new Date()); rateIdx = REAL; custom = null; emit(); },
    faster() { if (custom) { rateIdx = nearest(custom.days); custom = null; } rateIdx = Math.min(RATES.length - 1, rateIdx + 1); emit(); },
    slower() { if (custom) { rateIdx = nearest(custom.days); custom = null; } rateIdx = Math.max(0, rateIdx - 1); emit(); },
    toggleHold() { if (custom) { custom = null; rateIdx = RATES.findIndex((r) => r.days === 0); } else rateIdx = RATES[rateIdx].days === 0 ? REAL : RATES.findIndex((r) => r.days === 0); emit(); },
    onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  };
  return clock;
}
