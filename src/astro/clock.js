// The ship's clock: simulated time (Julian Date) advancing at a chosen rate (#34).
//   One shared clock for every view. It keeps a single double-precision JD that may run far beyond
//   JavaScript's dates (±273 kyr): `jd` is that time clamped to the calendar (always a valid Date),
//   `deepJd` is the unclamped JD, `years` is the offset from the present in Julian years (deep
//   time), and `inCalendar` says whether the time is still a calendar date. Each view sets a limit
//   (setLimit): the part of the range valid for it. Time clamps there, holds, and gives the reason
//   (`clamped`). A double holds a JD 2 Gyr out to ~10 seconds, far finer than any deep-time view needs.

import { jdFromDate } from './time.js';

// Days of simulated time per real second. 1/86400 is real time. The deep-time presets sit at
// either end, so ◀◀ / ▶▶ reach them after a year per second.
export const RATES = [
  { days: -365.25e9, label: '−1 GYR/S' }, { days: -365.25e6, label: '−1 MYR/S' }, { days: -365242.5, label: '−1 MILLENNIUM/S' },
  { days: -365, label: '−1 YEAR/S' }, { days: -30, label: '−1 MONTH/S' }, { days: -7, label: '−1 WEEK/S' },
  { days: -1, label: '−1 DAY/S' }, { days: -1 / 24, label: '−1 HOUR/S' }, { days: 0, label: 'HOLD' },
  { days: 1 / 86400, label: 'REAL TIME' }, { days: 1 / 1440, label: '1 MIN/S' }, { days: 1 / 24, label: '1 HOUR/S' }, { days: 1, label: '1 DAY/S' },
  { days: 7, label: '1 WEEK/S' }, { days: 30, label: '1 MONTH/S' }, { days: 365, label: '1 YEAR/S' },
  { days: 365242.5, label: '1 MILLENNIUM/S' }, { days: 365.25e6, label: '1 MYR/S' }, { days: 365.25e9, label: '1 GYR/S' },
];
const REAL = RATES.findIndex((r) => r.label === 'REAL TIME');
const HOLD = RATES.findIndex((r) => r.days === 0);
// the preset nearest a custom rate (for ◀◀ / ▶▶ after a custom run)
const nearest = (days) => RATES.reduce((best, r, i) => (Math.abs(Math.log(Math.abs(r.days) + 1e-9) - Math.log(Math.abs(days))) < Math.abs(Math.log(Math.abs(RATES[best].days) + 1e-9) - Math.log(Math.abs(days))) && Math.sign(r.days) === Math.sign(days) ? i : best), REAL);

// Units for stepping the clock by n (months and longer are calendar steps; see stepJd).
export const STEP_UNITS = [
  { id: 'minute', label: 'MIN', days: 1 / 1440 }, { id: 'hour', label: 'HOUR', days: 1 / 24 }, { id: 'day', label: 'DAY', days: 1 },
  { id: 'week', label: 'WEEK', days: 7 }, { id: 'month', label: 'MONTH', months: 1, days: 30.436875 }, { id: 'year', label: 'YEAR', months: 12, days: 365.2425 },
  { id: 'decade', label: 'DECADE', months: 120, days: 3652.425 }, { id: 'century', label: 'CENTURY', months: 1200, days: 36524.25 },
  { id: 'millennium', label: 'MILLENNIUM', months: 12000, days: 365242.5 },
  { id: 'myr', label: 'MYR', days: 365.25e6 }, { id: 'gyr', label: 'GYR', days: 365.25e9 },
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

// JavaScript dates span ±100,000,000 days around 1970 (±273,790 years): the calendar ends there.
export const JD_MIN = 2440587.5 - 9.99e7, JD_MAX = 2440587.5 + 9.99e7;
/** Days in a Julian year: deep-time offsets (KYR, MYR, GYR) count these. */
export const YEAR_DAYS = 365.25;
/** The furthest any view reaches: the Galaxy View's ±2 Gyr. */
export const DEEP_MAX_YEARS = 2e9;
const jdNow = () => jdFromDate(new Date());

/** The calendar itself: the default limit (JavaScript dates). */
export const CALENDAR_LIMIT = Object.freeze({ minJd: JD_MIN, maxJd: JD_MAX, reason: 'CALENDAR ENDS ±273 KYR' });
/** A limit of ±`years` around `now` (JD), e.g. the Navigation View's ±50 Myr of integrated orbits. */
export function yearsLimit(years, reason, now = jdNow()) {
  const y = Math.min(years, DEEP_MAX_YEARS);
  return { minJd: now - y * YEAR_DAYS, maxJd: now + y * YEAR_DAYS, reason };
}
/** JD of 1 January 00:00 UTC of astronomical year `y` (0 = 1 BCE), proleptic Gregorian calendar. */
export function jdOfYear(y) {
  const d = new Date(0);
  d.setUTCFullYear(y, 0, 1);
  return d.getTime() / 86400000 + 2440587.5;
}
/** A limit from the start of `fromYear` to the end of `toYear` (astronomical numbering), e.g. an ephemeris's span. */
export const calendarLimit = (fromYear, toYear, reason) => ({ minJd: jdOfYear(fromYear), maxJd: jdOfYear(toYear + 1) - 1 / 1440, reason }); // to the last minute of toYear

export function createClock() {
  let t = jdNow(); // the one time: a JD, possibly far beyond the calendar
  let rateIdx = REAL;
  let custom = null; // { days, label } when running at a chosen n units per second
  let limit = CALENDAR_LIMIT;
  let clampReason = null; // why time last stopped at the limit
  let last = performance.now();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(clock));
  /** Put time at `x`, inside the limit; true if it had to be clamped. */
  const place = (x) => {
    const y = Math.min(limit.maxJd, Math.max(limit.minJd, x));
    t = y;
    clampReason = y !== x ? limit.reason : null;
    return y !== x;
  };
  const hold = () => { custom = null; rateIdx = HOLD; };

  const clock = {
    /** The time as a calendar JD (clamped to JavaScript dates, so dateFromJd(jd) is always valid). */
    get jd() { return Math.min(JD_MAX, Math.max(JD_MIN, t)); },
    /** The time as a JD that may run beyond the calendar (deep time). */
    get deepJd() { return t; },
    /** Offset from the present in Julian years (+ future, − past). */
    get years() { return (t - jdNow()) / YEAR_DAYS; },
    /** Whether the time is a calendar date (inside JavaScript's ±273 kyr). */
    get inCalendar() { return t >= JD_MIN && t <= JD_MAX; },
    get rate() { return custom ?? RATES[rateIdx]; },
    get isNow() { return !custom && rateIdx === REAL && Math.abs(t - jdNow()) < 1 / 1440; },
    /** The active view's limit: { minJd, maxJd, reason }. */
    get limit() { return limit; },
    /** Why time stopped, while it sits at the limit (e.g. "ORBITS INTEGRATED ±50 MYR"); otherwise null. */
    get clamped() { return clampReason && (t === limit.minJd || t === limit.maxJd) ? clampReason : null; },
    /** Advance by the time since the last tick (several loops may tick in one frame: only the first moves it). */
    tick(now = performance.now()) {
      if (!(now > last)) return;
      const dt = (now - last) / 1000;
      last = now;
      const days = (custom ?? RATES[rateIdx]).days;
      if (!days) return;
      if (place(t + days * dt)) { hold(); emit(); }
    },
    /** Go to `newJd` (it may lie beyond the calendar; it is clamped to the limit). */
    set(newJd) { if (Number.isFinite(newJd)) place(newJd); emit(); },
    /** Go to `y` years from now. */
    setYears(y) { clock.set(jdNow() + y * YEAR_DAYS); },
    /**
     * Restrict time to `l` = { minJd, maxJd, reason }: the active view's valid range (null: the
     * calendar). A time outside it is brought to the edge and held there, with the reason shown.
     */
    setLimit(l) {
      const lo = jdNow() - DEEP_MAX_YEARS * YEAR_DAYS, hi = jdNow() + DEEP_MAX_YEARS * YEAR_DAYS;
      const next = l ? { minJd: Math.max(lo, l.minJd), maxJd: Math.min(hi, l.maxJd), reason: l.reason } : CALENDAR_LIMIT;
      if (next.reason === limit.reason && Math.abs(next.minJd - limit.minJd) < 1 && Math.abs(next.maxJd - limit.maxJd) < 1) return;
      limit = next;
      if (place(t)) hold();
      emit();
    },
    /** The current rate, to hand back to restore() (e.g. after scrubbing the timeline). */
    snapshot() { return { rateIdx, custom }; },
    restore(s) { rateIdx = s.rateIdx; custom = s.custom; emit(); },
    /** Move the clock by n units (see stepJd). */
    step(n, unitId) { place(stepJd(t, n, unitId)); emit(); },
    /** Run at `days` per second with a label (e.g. 3 DAYS/S); 0 holds. */
    setRate(days, label) { custom = days === 0 ? null : { days, label }; if (days === 0) rateIdx = HOLD; emit(); },
    /** Run at the same speed the other way (HOLD stays HOLD). `labelOf(days)` names a custom rate. */
    reverse(labelOf) {
      const d = clock.rate.days;
      if (!d) return;
      const i = RATES.findIndex((r) => r.days === -d);
      if (!custom && i >= 0) { rateIdx = i; emit(); return; }
      clock.setRate(-d, labelOf ? labelOf(-d) : (d > 0 ? `−${clock.rate.label}` : clock.rate.label.replace(/^−/, '')));
    },
    now() { t = jdNow(); clampReason = null; rateIdx = REAL; custom = null; emit(); },
    faster() { if (custom) { rateIdx = nearest(custom.days); custom = null; } rateIdx = Math.min(RATES.length - 1, rateIdx + 1); emit(); },
    slower() { if (custom) { rateIdx = nearest(custom.days); custom = null; } rateIdx = Math.max(0, rateIdx - 1); emit(); },
    toggleHold() { if (custom) hold(); else rateIdx = RATES[rateIdx].days === 0 ? REAL : HOLD; emit(); },
    onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  };
  return clock;
}
