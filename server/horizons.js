// JPL Horizons proxy. Horizons has no CORS headers, so the browser asks us and we
// fetch, parse and cache. Vectors are heliocentric, J2000 ecliptic, AU, TDB.
// API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html

import { cached } from './cache.js';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const THIRTY_DAYS = 30 * 86400000;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

// Horizons rejects bursts of parallel requests: run at most three at a time, with one retry.
let active = 0;
const waiting = [];
async function queued(fn) {
  if (active >= 3) await new Promise((r) => waiting.push(r));
  active++;
  try {
    try { return await fn(); } catch { await new Promise((r) => setTimeout(r, 1500)); return await fn(); }
  } finally { active--; waiting.shift()?.(); }
}
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
    const json = await queued(async () => {
      const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
      return res.json();
    });
    return {
      body, month, source: 'JPL Horizons', signature: json.signature,
      points: parseVectors(json.result || ''),
    };
  });
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CENTER = /^\d{1,3}$/;
const nextDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Parse a CSV VECTORS table with velocities (VEC_TABLE=2): [[jd, x, y, z, vx, vy, vz], ...]. */
export function parseStateVectors(text) {
  const soe = text.indexOf('$$SOE'), eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) {
    const msg = text.match(/No ephemeris.*|Cannot.*|ERROR.*/i);
    throw new Error(msg ? msg[0].trim() : 'Horizons returned no ephemeris table');
  }
  return text.slice(soe + 5, eoe).trim().split('\n').map((line) => {
    const c = line.split(',').map((s) => s.trim());
    return [Number(c[0]), ...c.slice(2, 8).map(Number)];
  });
}

async function horizons(params) {
  return queued(() => horizonsOnce(params));
}
async function horizonsOnce(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
    REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', CSV_FORMAT: 'YES', ...params })}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  return res.json();
}

const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
/**
 * Run `get(from, to)`; when Horizons says the (predicted) ephemeris starts or ends inside the
 * range, run it again on the part that exists and report where the ephemeris starts/ends.
 * `margin` days are kept clear of the edge.
 */
async function clipped(get, start, stop, margin = 0) {
  try { return { points: await get(start, stop), ephemerisStart: null, ephemerisEnd: null }; } catch (err) {
    const after = String(err.message).match(/after A\.D\. (\d{4})-([A-Z]{3})-(\d{2})/);
    const before = String(err.message).match(/prior to A\.D\. (\d{4})-([A-Z]{3})-(\d{2})/);
    if (!after && !before) throw err;
    const d = (m, shift) => new Date(Date.parse(`${m[1]}-${MON[m[2]]}-${m[3]}T00:00:00Z`) + shift * 86400000).toISOString().slice(0, 10);
    const from = before ? d(before, 1) : start, to = after ? d(after, -margin) : stop;
    if (Date.parse(to) <= Date.parse(from)) throw err;
    return { points: await get(from, to), ephemerisStart: before ? d(before, 0) : null, ephemerisEnd: after ? d(after, 0) : null };
  }
}

/**
 * One UTC day of planet-relative states (km, km/s; 10-minute steps) for a spacecraft orbiting
 * `center` (a major-body id, e.g. 499 Mars). Past days are kept; today/future refreshed daily.
 */
export async function localDay(body, center, day) {
  if (!BODY.test(body) || !CENTER.test(center)) throw Object.assign(new Error('bad body or center'), { status: 400 });
  if (!DAY.test(day)) throw Object.assign(new Error('day must be YYYY-MM-DD'), { status: 400 });
  const past = Date.parse(`${nextDay(day)}T00:00:00Z`) < Date.now() - 86400000;
  return cached('horizons-local', `${body}@${center}-${day}`, past ? 365 * 86400000 : 86400000, async () => {
    const json = await horizons({ COMMAND: `'${body}'`, CENTER: `'500@${center}'`, START_TIME: `'${day}'`, STOP_TIME: `'${nextDay(day)} 00:10'`,
      STEP_SIZE: "'10m'", VEC_TABLE: '2', OUT_UNITS: 'KM-S' });
    return { body, center, day, source: 'JPL Horizons', points: parseStateVectors(json.result || '') };
  });
}

/**
 * A calendar month of planet-relative states (km, km/s; 20-minute steps): the stand-in while
 * a 10-minute day is loading, and what fast time-play runs on (one request per month, not per day).
 */
export async function localMonth(body, center, month) {
  if (!BODY.test(body) || !CENTER.test(center)) throw Object.assign(new Error('bad body or center'), { status: 400 });
  if (!MONTH.test(month)) throw Object.assign(new Error('month must be YYYY-MM'), { status: 400 });
  const { start, stop } = monthRange(month);
  const past = Date.parse(`${stop}T00:00:00Z`) < Date.now() - 86400000;
  return cached('horizons-local-month', `${body}@${center}-${month}`, past ? 365 * 86400000 : 86400000, async () => {
    const get = async (from, to) => parseStateVectors((await horizons({ COMMAND: `'${body}'`, CENTER: `'500@${center}'`, START_TIME: `'${from}'`, STOP_TIME: `'${to}'`,
      STEP_SIZE: "'20m'", VEC_TABLE: '2', OUT_UNITS: 'KM-S' })).result || '');
    const { points, ephemerisStart, ephemerisEnd } = await clipped(get, start, stop);
    return { body, center, month, source: 'JPL Horizons', points, ephemerisStart, ephemerisEnd };
  });
}

/** Heliocentric track (AU) of `body` from `start` to `stop` in about `n` steps, for drawing trajectories. */
export async function track(body, start, stop, n = 400) {
  if (!BODY.test(body) || !DAY.test(start) || !DAY.test(stop)) throw Object.assign(new Error('bad track request'), { status: 400 });
  const days = Math.max(1, Math.round((Date.parse(stop) - Date.parse(start)) / 86400000 / Math.min(1000, Math.max(10, Number(n) || 400))));
  return cached('horizons-track', `v2-${body}-${start}-${stop}-${days}`, THIRTY_DAYS, async () => {
    const get = async (from, to) => {
      const json = await horizons({ COMMAND: `'${body}'`, CENTER: "'500@10'", START_TIME: `'${from}'`, STOP_TIME: `'${to}'`,
        STEP_SIZE: `'${days}d'`, VEC_TABLE: '1', OUT_UNITS: 'AU-D' });
      return parseVectors(json.result || '');
    };
    const { points, ephemerisStart, ephemerisEnd } = await clipped(get, start, stop, 1);
    return { body, start, stop, stepDays: days, source: 'JPL Horizons', points, ephemerisStart, ephemerisEnd };
  });
}
