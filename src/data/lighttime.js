// Light-speed messages: one light-year per year, by definition. Beyond a lifetime the spans
// are told in human lifetimes (75 years) and generations (25 years).

export const LIFETIME_YEARS = 75;
export const GENERATION_YEARS = 25;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const n = (v, d) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** Decimal year → "OCT 2030". */
export function fmtYear(y) {
  const Y = Math.floor(y);
  return `${MONTHS[Math.min(11, Math.floor((y - Y) * 12))]} ${Y < 10000 ? Y : Y.toLocaleString('en-US')}`;
}

/** A duration in years, in months / years / lifetimes. */
export function span(yrs) {
  if (yrs > LIFETIME_YEARS) return `${n(yrs / LIFETIME_YEARS, 1)} LIFETIMES · ${n(yrs, 0)} YEARS`;
  if (yrs < 1) return `${n(yrs * 12, 1)} MONTHS`;
  return `${n(yrs, yrs < 10 ? 2 : 1)} YEARS`;
}

/** Who would be waiting for the reply. */
export function humanScale(roundTripYears) {
  if (roundTripYears < LIFETIME_YEARS) return `A child born the day it is sent would be ${n(roundTripYears, 0)} when the reply arrives.`;
  const g = Math.round(roundTripYears / GENERATION_YEARS);
  return `The reply would reach the great-${'great-'.repeat(Math.max(0, g - 3))}grandchildren of whoever sent it (${g} generations).`;
}

/** Sent year y0, distance d ly → { arrives, replyBack, roundTrip } (years). */
export const messageTimes = (y0, d) => ({ arrives: y0 + d, replyBack: y0 + 2 * d, roundTrip: 2 * d });
