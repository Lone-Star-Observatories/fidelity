// JPL Horizons proxy. Horizons has no CORS headers, so the browser asks us and we
// fetch, parse and cache. Vectors are heliocentric, J2000 ecliptic, AU, TDB.
// API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html

import { cached } from './cache.js';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const THIRTY_DAYS = 30 * 86400000;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
// Horizons COMMAND: major-body ids (e.g. 399) or small-body designations ("DES=1P;").
const BODY = /^-?\d{1,9}$/;

function monthRange(month) {
  const [, y, m] = month.match(MONTH);
  const start = `${y}-${m}-01`;
  const next = new Date(Date.UTC(Number(y), Number(m), 2)); // first of next month + 1 day
  return { start, stop: next.toISOString().slice(0, 10) };
}

/** Parse a CSV VECTORS table (VEC_TABLE=1) into [[jd, x, y, z], ...]. */
export function parseVectors(text) {
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) {
    const msg = text.match(/No ephemeris.*|Cannot.*|ERROR.*/i);
    throw new Error(msg ? msg[0].trim() : 'Horizons returned no ephemeris table');
  }
  return text.slice(soe + 5, eoe).trim().split('\n').map((line) => {
    const cols = line.split(',').map((s) => s.trim());
    return [Number(cols[0]), Number(cols[2]), Number(cols[3]), Number(cols[4])];
  });
}

/** Daily heliocentric vectors of `body` covering calendar `month` (YYYY-MM). */
export async function monthlyVectors(body, month) {
  if (!BODY.test(body)) throw Object.assign(new Error('bad body id'), { status: 400 });
  if (!MONTH.test(month)) throw Object.assign(new Error('month must be YYYY-MM'), { status: 400 });
  const { start, stop } = monthRange(month);
  const params = new URLSearchParams({
    format: 'json', COMMAND: `'${body}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS', CENTER: "'500@10'", REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF',
    START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: "'1d'",
    VEC_TABLE: '1', OUT_UNITS: 'AU-D', CSV_FORMAT: 'YES',
  });
  // Past months never change; the current/future ones are refreshed monthly.
  return cached('horizons', `${body}-${month}`, THIRTY_DAYS, async () => {
    const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
    const json = await res.json();
    return {
      body, month, source: 'JPL Horizons', signature: json.signature,
      points: parseVectors(json.result || ''),
    };
  });
}
