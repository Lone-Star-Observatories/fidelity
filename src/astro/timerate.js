// The time control's maths (#34): the RATE slider's logarithmic scale and the TIMELINE's ticks.
//   Slider positions run −1000…1000. A dead zone around 0 is HOLD; beyond it |rate| grows
//   logarithmically from real time (1 s/s) to 1 millennium/s, with detents at each unit.

export const SLIDER_MAX = 1000, DEAD = 80;
const SEC = 1 / 86400;
// rate units (days per unit); the detents are 1 of each
export const RATE_UNITS = [
  { days: SEC, one: 'SEC', many: 'SEC', tick: 'REAL' }, { days: 1 / 1440, one: 'MIN', many: 'MIN', tick: 'MIN' },
  { days: 1 / 24, one: 'HOUR', many: 'HOURS', tick: 'HR' }, { days: 1, one: 'DAY', many: 'DAYS', tick: 'DAY' },
  { days: 7, one: 'WEEK', many: 'WEEKS', tick: 'WK' }, { days: 30.436875, one: 'MONTH', many: 'MONTHS', tick: 'MO' },
  { days: 365.2425, one: 'YEAR', many: 'YEARS', tick: 'YR' }, { days: 3652.425, one: 'DECADE', many: 'DECADES', tick: 'DEC' },
  { days: 36524.25, one: 'CENTURY', many: 'CENTURIES', tick: 'CEN' }, { days: 365242.5, one: 'MILLENNIUM', many: 'MILLENNIA', tick: 'KYR' },
];
const L0 = Math.log10(SEC), L1 = Math.log10(RATE_UNITS.at(-1).days);
const SNAP = 0.1; // decades either side of a detent that snap to it

/** Days per second at slider position v (0 inside the HOLD dead zone). */
export function sliderToDays(v) {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  const lg = L0 + (Math.min(a, SLIDER_MAX) - DEAD) / (SLIDER_MAX - DEAD) * (L1 - L0);
  const det = RATE_UNITS.find((u) => Math.abs(Math.log10(u.days) - lg) < SNAP);
  return Math.sign(v) * (det ? det.days : 10 ** lg);
}
/** Slider position for a rate (clamped to the slider's range). */
export function daysToSlider(days) {
  if (!days) return 0;
  const t = Math.min(1, Math.max(0, (Math.log10(Math.abs(days)) - L0) / (L1 - L0)));
  return Math.sign(days) * Math.round(DEAD + t * (SLIDER_MAX - DEAD));
}
/** "REAL TIME", "1 DAY/S", "2.5 YEARS/S", "−40 MIN/S", "HOLD". */
export function rateLabel(days) {
  if (!days) return 'HOLD';
  const a = Math.abs(days), sign = days < 0 ? '−' : '';
  if (Math.abs(a / SEC - 1) < 1e-6) return days > 0 ? 'REAL TIME' : '−1 SEC/S';
  const u = [...RATE_UNITS].reverse().find((x) => a >= x.days * 0.9995) ?? RATE_UNITS[0];
  const n = a / u.days, txt = n < 9.95 ? String(+n.toFixed(1)) : String(Math.round(n));
  return `${sign}${txt} ${txt === '1' ? u.one : u.many}/S`;
}

// ---- timeline ticks -------------------------------------------------------------------------
// steps: hours and days in days; months and longer on the calendar (months)
const STEPS = [{ days: 1 / 24 }, { days: 6 / 24 }, { days: 1 }, { days: 7 }, { months: 1 }, { months: 12 }, { months: 120 }, { months: 1200 },
  { months: 12000 }, { months: 120000 }];
const MONTH = 30.436875;
const JD_UNIX = 2440587.5;
const dateOf = (jd) => new Date((jd - JD_UNIX) * 86400000);
const jdOf = (ms) => ms / 86400000 + JD_UNIX;
const yearStr = (y) => (y <= 0 ? `${1 - y} BCE` : String(y));

/**
 * Tick marks for a timeline from jd `from` to `to` drawn `px` wide, at least `minPx` apart:
 * [{ jd, label }]. Calendar steps start on month/year boundaries.
 */
export function timelineTicks(from, to, px, minPx = 80) {
  const perDay = px / (to - from);
  const s = STEPS.find((x) => (x.days ?? x.months * MONTH) * perDay >= minPx) ?? STEPS.at(-1);
  const out = [];
  if (s.days) {
    for (let jd = Math.ceil((from - 0.5) / s.days) * s.days + 0.5; jd <= to && out.length < 500; jd += s.days) {
      const d = dateOf(jd), iso = d.toISOString();
      out.push({ jd, label: s.days < 1 ? iso.slice(11, 16) : d.getUTCDate() === 1 || s.days === 1 && out.length === 0 ? iso.slice(0, 10) : iso.slice(5, 10) });
    }
    return out;
  }
  const d0 = dateOf(from), m0 = d0.getUTCFullYear() * 12 + d0.getUTCMonth();
  for (let m = Math.ceil(m0 / s.months) * s.months; out.length < 500; m += s.months) {
    const y = Math.floor(m / 12), t = new Date(0);
    t.setUTCFullYear(y, m - y * 12, 1); t.setUTCHours(0, 0, 0, 0);
    const jd = jdOf(t.getTime());
    if (!Number.isFinite(jd) || jd > to) break;
    if (jd >= from) out.push({ jd, label: s.months < 12 ? `${yearStr(y)}-${String(m - y * 12 + 1).padStart(2, '0')}` : yearStr(y) });
  }
  return out;
}
