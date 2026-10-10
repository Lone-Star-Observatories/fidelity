// Time helpers. The ship clock runs in UTC; the small TT−UTC offset (~69 s) is
// below what the Keplerian model resolves, so it is ignored.

export const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5;

export const jdFromDate = (date) => date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
export const dateFromJd = (jd) => new Date((jd - JD_UNIX_EPOCH) * MS_PER_DAY);

/** LCARS-flavoured stardate-ish readout: real year + fractional day-of-year. */
export function shipDate(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = (date.getTime() - start) / MS_PER_DAY + 1;
  return `${date.getUTCFullYear()}.${doy.toFixed(2).padStart(6, '0')}`;
}

export const isoDay = (date) => date.toISOString().slice(0, 10);
