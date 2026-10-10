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

export function createClock() {
  let jd = jdFromDate(new Date());
  let rateIdx = REAL;
  let last = performance.now();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(clock));

  const clock = {
    get jd() { return jd; },
    get rate() { return RATES[rateIdx]; },
    get isNow() { return rateIdx === REAL && Math.abs(jd - jdFromDate(new Date())) < 1 / 1440; },
    tick(now = performance.now()) {
      jd += (RATES[rateIdx].days * (now - last)) / 1000;
      last = now;
    },
    set(newJd) { jd = newJd; emit(); },
    now() { jd = jdFromDate(new Date()); rateIdx = REAL; emit(); },
    faster() { rateIdx = Math.min(RATES.length - 1, rateIdx + 1); emit(); },
    slower() { rateIdx = Math.max(0, rateIdx - 1); emit(); },
    /** Jump to the listed rate nearest `days` per second (e.g. 1 / 1440 = 1 MIN/S). */
    setRate(days) { rateIdx = RATES.reduce((b, r, i) => (Math.abs(r.days - days) < Math.abs(RATES[b].days - days) ? i : b), 0); emit(); },
    toggleHold() { rateIdx = RATES[rateIdx].days === 0 ? REAL : RATES.findIndex((r) => r.days === 0); emit(); },
    onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
  };
  return clock;
}
