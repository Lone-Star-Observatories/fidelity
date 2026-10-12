// The ship's computer's calculators: the Computer answers from these instead of guessing. Each
// reads the same ephemerides and solvers the views use (Kepler/Horizons positions, Lambert
// transfers, the eclipse and alignment searches) and returns plain numbers with units in the
// key names, the epoch, the method and its provenance tier, so a spoken answer can cite them.

import { geocentric, describe, subObserverLatitude, apparentMagnitude, equatorialRadiusKm, constellation, formatRa, formatDec, AU_KM } from '../astro/observe.js';
import { hohmann, synodicDays, launchWindows, MU_SUN, targetFor } from '../astro/transfer.js';
import { solarEclipses, lunarEclipses, planetTransits, alignments } from '../astro/eclipses.js';

const G_KM = 6.6743e-20; // km³ kg⁻¹ s⁻² (CODATA 2018)
const C_KM_S = 299792.458;
const DAY_S = 86400;
const LY_PER_PC = 3.261563777;
const jdOfIso = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t / 86400000 + 2440587.5 : null; };
const isoOfJd = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
const dateOfJd = (jd) => isoOfJd(jd).slice(0, 10);
const r3 = (x, n = 4) => (x == null || !Number.isFinite(x) ? null : Number(x.toPrecision(n)));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** A light-time or travel time as words: "8 min 19 s", "4.2 h", "3.1 days", "12.4 years". */
export function durationWords(s) {
  if (!Number.isFinite(s)) return null;
  if (s < 60) return `${r3(s, 3)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  if (s < 2 * DAY_S) return `${r3(s / 3600, 3)} h`;
  if (s < 2 * 365.25 * DAY_S) return `${r3(s / DAY_S, 3)} days`;
  return `${r3(s / (365.25 * DAY_S), 4)} years`;
}

/**
 * Osculating two-body elements from a relative position (km) and velocity (km/s) about a body of
 * gravitational parameter mu (km³/s²): a, e, i (to the ecliptic), periapsis/apoapsis, period.
 */
export function elementsFromState(r, v, mu) {
  const rn = len(r), v2 = dot(v, v), h = cross(r, v);
  const eVec = sub(cross(v, h).map((x) => x / mu), r.map((x) => x / rn));
  const e = len(eVec), inv = 2 / rn - v2 / mu, a = 1 / inv;
  const bound = inv > 0;
  return { a_km: bound ? a : null, e, i_deg: (Math.acos(h[2] / len(h)) * 180) / Math.PI,
    periapsis_km: bound ? a * (1 - e) : (len(h) ** 2 / mu) / (1 + e), apoapsis_km: bound && e < 1 ? a * (1 + e) : null,
    period_s: bound ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : null, bound };
}

// ---- a safe calculator: numbers, + − × ÷ ^, parentheses, constants and functions, SI units ------
const CONSTANTS = {
  pi: Math.PI, e: Math.E, c: 299792458, G: 6.6743e-11, g0: 9.80665,
  m: 1, km: 1e3, au: 1.495978707e11, ly: 9.4607304725808e15, pc: 3.0856775814913673e16,
  s: 1, min: 60, h: 3600, hour: 3600, day: 86400, yr: 31557600, year: 31557600,
  kg: 1, msun: 1.98847e30, mearth: 5.9722e24, mjup: 1.89813e27, mmoon: 7.342e22,
  rsun: 6.957e8, rearth: 6.3781e6, rjup: 7.1492e7,
};
const FUNCS = { sqrt: Math.sqrt, cbrt: Math.cbrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, log10: Math.log10, exp: Math.exp, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  deg: (x) => (x * Math.PI) / 180 };
/** Evaluate an arithmetic expression (SI constants: c, G, au, ly, pc, msun, …; ^ is power). Throws on anything else. */
export function evaluate(expr) {
  const src = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\*\*/g, '^');
  const toks = src.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|[a-z_][a-z0-9_]*|[-+*/^(),]|\S/gi) ?? [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const expect = (t) => { if (next() !== t) throw new Error(`expected ${t}`); };
  function primary() {
    const t = next();
    if (t == null) throw new Error('unexpected end');
    if (/^[\d.]/.test(t)) return Number(t);
    if (t === '(') { const v = sum(); expect(')'); return v; }
    if (t === '-') return -power();
    if (t === '+') return power();
    const k = t.toLowerCase();
    if (FUNCS[k] && peek() === '(') { next(); const args = [sum()]; while (peek() === ',') { next(); args.push(sum()); } expect(')'); return FUNCS[k](...args); }
    if (k === 'pow' && peek() === '(') { next(); const a = sum(); expect(','); const b = sum(); expect(')'); return a ** b; }
    if (t in CONSTANTS) return CONSTANTS[t];
    if (k in CONSTANTS) return CONSTANTS[k];
    throw new Error(`unknown symbol ${t}`);
  }
  function power() { const b = primary(); if (peek() === '^') { next(); return b ** unary(); } return b; }
  function unary() { if (peek() === '-') { next(); return -unary(); } if (peek() === '+') { next(); return unary(); } return power(); }
  function product() {
    let v = unary();
    for (;;) {
      if (peek() === '*') { next(); v *= unary(); } else if (peek() === '/') { next(); v /= unary(); }
      else if (peek() != null && /^[\d.a-z_(]/i.test(peek())) v *= unary(); // implicit: "3 au", "2 pi"
      else return v;
    }
  }
  function sum() { let v = product(); while (peek() === '+' || peek() === '-') v = next() === '+' ? v + product() : v - product(); return v; }
  const v = sum();
  if (i < toks.length) throw new Error(`unexpected ${toks[i]}`);
  if (!Number.isFinite(v)) throw new Error('result is not a finite number');
  return v;
}

/**
 * The calculators over a live system. `env` = {
 *   bodies() → the Sol model's bodies; posAU(id, jd) → heliocentric J2000 ecliptic AU (the System View's
 *   positions: Horizons or Kepler); jd() → the ship's clock; stars() → nearby stars { name, x, y, z pc };
 *   source() → 'JPL Horizons' | 'Kepler' }.
 */
export function createShipCalc(env) {
  const bodies = () => env.bodies() ?? [];
  function find(name) {
    const n = norm(name);
    if (!n) return null;
    if (['earth', 'home', 'terra'].includes(n)) return { body: bodies().find((b) => b.id === 'earth') };
    if (['sun', 'sol', 'the sun'].includes(n)) return { body: bodies().find((b) => b.id === 'sun') ?? bodies()[0] };
    const all = bodies();
    const b = all.find((x) => norm(x.name) === n || x.id === n) ?? all.find((x) => norm(x.name).startsWith(n)) ?? all.find((x) => norm(x.name).includes(n));
    if (b) return { body: b };
    const st = (env.stars?.() ?? []).find((s) => norm(s.name) === n) ?? (env.stars?.() ?? []).find((s) => s.name && norm(s.name).includes(n));
    return st ? { star: st } : null;
  }
  const when = (iso) => { if (!iso || /^now$/i.test(iso)) return env.jd(); const jd = jdOfIso(iso); if (jd == null) throw new Error(`unreadable date ${iso}`); return jd; };
  const pos = (id) => (jd) => env.posAU(id, jd);
  const velKmS = (id, jd, h = 0.01) => sub(env.posAU(id, jd + h), env.posAU(id, jd - h)).map((x) => (x * AU_KM) / (2 * h * DAY_S));
  const muOf = (b) => (!b || b.id === 'sun' ? MU_SUN : b.massKg ? G_KM * b.massKg : null);
  const base = (jd, method) => ({ epoch: isoOfJd(jd), tier: 'COMPUTED', method: `${method}; positions: ${env.source?.() ?? 'Kepler'}` });

  const tools = {
    /** Where a body is and how it looks from Earth at the clock (or `iso`). */
    body_state({ name, iso }) {
      const f = find(name);
      if (!f) return { ok: false, error: `no body or star called ${name} in the loaded catalogues` };
      if (f.star) {
        const d = Math.hypot(f.star.x, f.star.y, f.star.z);
        return { ok: true, name: f.star.name, distance_ly: r3(d * LY_PER_PC), distance_pc: r3(d), light_time: `${r3(d * LY_PER_PC)} years`, tier: 'MEASURED', method: 'catalogue parallax distance' };
      }
      const b = f.body, jd = when(iso);
      if (b.id === 'sun') {
        const e = env.posAU('earth', jd), d = len(e);
        return { ok: true, name: b.name, ...base(jd, 'heliocentric Earth position'), distance_from_earth_au: r3(d, 6), distance_from_earth_km: r3(d * AU_KM, 6), light_time: durationWords((d * AU_KM) / C_KM_S) };
      }
      const P = env.posAU(b.id, jd), r = len(P), v = velKmS(b.id, jd);
      const out = { ok: true, name: b.name, kind: b.kind, ...base(jd, 'astrometric, light-time corrected'), distance_from_sun_au: r3(r, 6), distance_from_sun_km: r3(r * AU_KM, 6), heliocentric_speed_km_s: r3(len(v)) };
      if (b.parent && b.parent !== 'sun') {
        const rel = sub(P, env.posAU(b.parent, jd)), parent = bodies().find((x) => x.id === b.parent);
        out[`distance_from_${b.parent}_km`] = r3(len(rel) * AU_KM, 6);
        out[`speed_relative_to_${b.parent}_km_s`] = r3(len(sub(v, velKmS(b.parent, jd))));
        out.parent = parent?.name ?? b.parent;
      }
      if (b.id !== 'earth') {
        const g = geocentric(pos(b.id), pos('earth'), jd), d = describe(g, { radiusKm: equatorialRadiusKm(b.id, b.radiusKm) });
        const lat = b.pole ? subObserverLatitude(d.eq, b.pole) : 0; // Saturn's rings brighten it with their tilt
        const mag = (() => { try { return apparentMagnitude(b.id, d, { ringTilt: lat, subLat: lat }); } catch { return null; } })();
        Object.assign(out, { distance_from_earth_au: r3(g.delta, 6), distance_from_earth_km: r3(g.delta * AU_KM, 6), light_time_from_earth: durationWords(g.lightDays * DAY_S),
          ra_j2000: formatRa(d.ra), dec_j2000: formatDec(d.dec), constellation: constellation(d.ra, d.dec)?.name ?? null,
          elongation_from_sun_deg: r3(d.elongation, 5), sky: d.elongation < 15 ? 'too close to the Sun to observe' : d.east ? 'evening sky (east of the Sun)' : 'morning sky (west of the Sun)',
          phase_angle_deg: r3(d.phase, 4), illuminated_percent: r3(d.illuminated * 100, 4), angular_diameter_arcsec: r3(d.angularDiameterArcsec, 3), apparent_magnitude: Number.isFinite(mag) ? r3(mag, 3) : null });
      }
      return out;
    },

    /** Distance and light time between two bodies (or a body and a star), and optional travel time at a speed. */
    distance({ from = 'earth', to, iso, speed_km_s, fraction_of_c }) {
      const a = find(from), b = find(to);
      if (!a || !b) return { ok: false, error: `no body or star called ${!a ? from : to} in the loaded catalogues` };
      const jd = when(iso);
      const at = (f) => (f.star ? [f.star.x, f.star.y, f.star.z].map((x) => (x * LY_PER_PC * 63241.077)) : env.posAU(f.body.id, jd)); // stars: pc → AU (Sol-centred; fine beyond the Solar System)
      const dAu = len(sub(at(a), at(b))), km = dAu * AU_KM;
      const out = { ok: true, from: a.body?.name ?? a.star.name, to: b.body?.name ?? b.star.name, ...base(jd, a.star || b.star ? 'catalogue distance' : 'geometric distance between ephemeris positions'),
        distance_km: r3(km, 6), distance_au: r3(dAu, 6), distance_ly: r3(dAu / 63241.077, 4), light_time: durationWords(km / C_KM_S) };
      const speed = speed_km_s ?? (fraction_of_c ? fraction_of_c * C_KM_S : null);
      if (speed > 0) { out.speed_km_s = r3(speed); out.travel_time_straight_line = durationWords(km / speed); out.travel_note = 'straight line at constant speed; ignores acceleration, gravity and the target moving'; }
      return out;
    },

    /** Osculating orbit of a body about its parent at the clock: a, e, i, periapsis, apoapsis, period. */
    orbit({ name, iso }) {
      const f = find(name);
      if (!f?.body || f.body.id === 'sun') return { ok: false, error: f?.star ? `${f.star.name} is a star; its galactic orbit is not in this calculator` : `no orbiting body called ${name}` };
      const b = f.body, jd = when(iso), parent = b.parent && b.parent !== 'sun' ? bodies().find((x) => x.id === b.parent) : null, mu = muOf(parent);
      if (!mu) return { ok: false, error: `no mass on file for ${parent?.name ?? b.parent}` };
      const pid = parent?.id ?? 'sun';
      const rel = sub(env.posAU(b.id, jd), pid === 'sun' ? [0, 0, 0] : env.posAU(pid, jd)).map((x) => x * AU_KM);
      const vrel = pid === 'sun' ? velKmS(b.id, jd) : sub(velKmS(b.id, jd, 0.002), velKmS(pid, jd, 0.002));
      const el = elementsFromState(rel, vrel, mu), au = pid === 'sun';
      return { ok: true, name: b.name, about: parent?.name ?? 'the Sun', ...base(jd, 'osculating two-body elements from the ephemeris state'),
        semi_major_axis: el.a_km == null ? null : au ? `${r3(el.a_km / AU_KM, 6)} AU` : `${r3(el.a_km, 6)} km`, eccentricity: r3(el.e, 4), inclination_to_ecliptic_deg: r3(el.i_deg, 4),
        periapsis: au ? `${r3(el.periapsis_km / AU_KM, 5)} AU` : `${r3(el.periapsis_km, 5)} km`, apoapsis: el.apoapsis_km == null ? 'unbound (hyperbolic)' : au ? `${r3(el.apoapsis_km / AU_KM, 5)} AU` : `${r3(el.apoapsis_km, 5)} km`,
        period: durationWords(el.period_s), current_distance: au ? `${r3(len(rel) / AU_KM, 6)} AU` : `${r3(len(rel), 6)} km`, current_speed_km_s: r3(len(vrel)) };
    },

    /** Earth → target: the Hohmann reference, the synodic period and the next launch windows (Lambert, least C3). */
    transfer({ to, iso, windows = 2 }) {
      const f = find(to);
      if (!f?.body || f.body.id === 'earth' || f.body.id === 'sun') return { ok: false, error: `no transfer target called ${to} (planets, moons via their planet, and catalogued small bodies)` };
      const t = targetFor(f.body, bodies());
      if (!t) return { ok: false, error: `${f.body.name} has no heliocentric orbit to plan a transfer to` };
      const jd = when(iso), h = hohmann(1, t.aAu);
      const ws = launchWindows(t, jd, { aAu: t.aAu, years: Math.min(14, Math.max(3, 1.2 * synodicDays(365.25636, t.periodDays) / 365.25 * Math.min(4, windows) )), stepDays: t.aAu > 3 ? 8 : 4, count: Math.min(4, windows), minGapDays: Math.max(120, 0.6 * synodicDays(365.25636, t.periodDays)) });
      return { ok: true, from: 'Earth (200 km parking orbit)', to: t.viaParent ? `${f.body.name} (via ${t.viaParent})` : t.name, epoch: isoOfJd(jd), tier: 'COMPUTED', method: 'Hohmann reference; launch windows from Lambert solutions minimising C3 (Kepler elements)',
        hohmann_flight_time: durationWords(h.tofDays * DAY_S), hohmann_dv_depart_km_s: r3(h.dv1), hohmann_dv_arrive_km_s: r3(h.dv2), synodic_period: durationWords(synodicDays(365.25636, t.periodDays) * DAY_S),
        next_windows: ws.map((w) => ({ depart: dateOfJd(w.best.depJd), arrive: dateOfJd(w.best.arrJd), flight_days: Math.round(w.best.tofDays), c3_km2_s2: r3(w.best.c3), dv_depart_km_s: r3(w.best.dvDepart), dv_arrive_km_s: r3(w.best.dvArrive), arrival: w.best.arriveKind, dv_total_km_s: r3(w.best.dvTotal), window_opens: dateOfJd(w.opens), window_closes: dateOfJd(w.closes) })) };
    },

    /** The next sky events after the clock: eclipses, transits of Mercury/Venus, oppositions, conjunctions, elongations. */
    sky_events({ kind = 'any', body, iso, count = 3 }) {
      const jd = when(iso), n = Math.max(1, Math.min(8, count)), k = norm(kind);
      const list = [];
      if (['any', 'eclipse', 'solar eclipse', 'solar'].includes(k)) for (const e of solarEclipses(jd, jd + 1100)) list.push({ when: e.greatest, event: `${e.kind} solar eclipse`, magnitude: r3(e.magnitude, 3), duration: e.durationS ? durationWords(e.durationS) : null, greatest_at: e.place ? `${r3(e.place.lat, 3)}°, ${r3(e.place.lon, 4)}°` : null });
      if (['any', 'eclipse', 'lunar eclipse', 'lunar'].includes(k)) for (const e of lunarEclipses(jd, jd + 1100)) list.push({ when: e.greatest, event: `${e.kind} lunar eclipse`, magnitude: r3(e.kind === 'penumbral' ? e.penumbralMagnitude : e.magnitude, 3) });
      if (['transit'].includes(k)) for (const e of planetTransits(jd, jd + 365.25 * 60)) list.push({ when: e.greatest, event: `transit of ${e.body[0].toUpperCase()}${e.body.slice(1)} across the Sun` });
      if (['any', 'opposition', 'conjunction', 'elongation', 'alignment'].includes(k)) for (const e of alignments(jd, jd + 800)) {
        if (k !== 'any' && k !== 'alignment' && !e.kind.includes(k)) continue;
        list.push({ when: e.greatest, event: `${e.body ? `${e.body[0].toUpperCase()}${e.body.slice(1)}: ` : ''}${e.kind}${e.side ? ` (${e.side})` : ''}`, ...(e.elongationDeg ? { elongation_deg: r3(e.elongationDeg, 3) } : {}), ...(e.distanceAu ? { distance_au: r3(e.distanceAu, 4) } : {}) });
      }
      const b = body ? norm(body) : null;
      const out = list.filter((e) => !b || norm(e.event).includes(b)).sort((p, q) => p.when - q.when).slice(0, n).map((e) => ({ ...e, when: isoOfJd(e.when) }));
      return { ok: true, after: isoOfJd(jd), tier: 'COMPUTED', method: 'the app\'s eclipse, transit and alignment searches (matched to the Five Millennium Canon within about a minute)', events: out,
        ...(out.length ? {} : { note: `none found in the search span (eclipses ~3 years, alignments ~2 years, transits 60 years)` }) };
    },

    /** Arithmetic with SI constants (c, G, au, ly, pc, msun, mearth, rsun, day, yr…). */
    calculate({ expression }) {
      const v = evaluate(expression);
      return { ok: true, expression, result: r3(v, 10), note: 'SI units: metres, kilograms, seconds', tier: 'COMPUTED' };
    },
  };
  return {
    tools,
    run(name, args) {
      const f = tools[name];
      if (!f) return { ok: false, error: `no calculator called ${name}` };
      try { return f(args ?? {}); } catch (err) { return { ok: false, error: String(err.message || err) }; }
    },
  };
}

/** The calculators as Realtime function tools. */
export const CALC_TOOLS = [
  { type: 'function', name: 'body_state', description: "Compute where a Solar System body is and how it appears from Earth (distances, light time, speed, RA/Dec, constellation, elongation, phase, angular size, magnitude) at the ship's clock or a given time; for a star, its distance.", parameters: { type: 'object', properties: { name: { type: 'string' }, iso: { type: 'string', description: 'ISO 8601 UTC; omit for the ship\'s clock' } }, required: ['name'] } },
  { type: 'function', name: 'distance', description: 'Compute the distance and light time between two bodies (or to a star), and optionally the straight-line travel time at a speed.', parameters: { type: 'object', properties: { from: { type: 'string', description: 'default Earth' }, to: { type: 'string' }, iso: { type: 'string' }, speed_km_s: { type: 'number' }, fraction_of_c: { type: 'number' } }, required: ['to'] } },
  { type: 'function', name: 'orbit', description: "Compute a body's orbit about its parent (semi-major axis, eccentricity, inclination, periapsis, apoapsis, period, current distance and speed) from the ephemeris.", parameters: { type: 'object', properties: { name: { type: 'string' }, iso: { type: 'string' } }, required: ['name'] } },
  { type: 'function', name: 'transfer', description: 'Plan an Earth-to-target transfer: Hohmann flight time and delta-v, synodic period, and the next launch windows (departure, arrival, C3, delta-v) from Lambert solutions.', parameters: { type: 'object', properties: { to: { type: 'string' }, iso: { type: 'string' }, windows: { type: 'integer', minimum: 1, maximum: 4 } }, required: ['to'] } },
  { type: 'function', name: 'sky_events', description: "Find the next sky events after the ship's clock: solar and lunar eclipses, transits of Mercury or Venus, oppositions, conjunctions, greatest elongations.", parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['any', 'eclipse', 'solar eclipse', 'lunar eclipse', 'transit', 'opposition', 'conjunction', 'elongation'] }, body: { type: 'string' }, iso: { type: 'string' }, count: { type: 'integer', minimum: 1, maximum: 8 } } } },
  { type: 'function', name: 'calculate', description: 'Evaluate arithmetic exactly (use for any other numeric question): + - * / ^, parentheses, sqrt, cbrt, sin/cos/tan (radians), deg(x), ln, log10, exp; SI constants c, G, g0, au, ly, pc, km, day, yr, msun, mearth, mjup, mmoon, rsun, rearth, rjup, pi.', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
];
