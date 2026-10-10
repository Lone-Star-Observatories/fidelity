// Eclipses, transits, occultations and alignments (#30), computed from the app's own
// ephemeris so they agree with what the views draw.
//
//   Geometry is in the Sun's rest frame with geometric positions at the same instant: light
//   from the Sun's limb grazing the Moon's limb reaches Earth along a straight line there, so
//   aberration and the Sun's light time cancel (the Moon's 1.3 s is negligible).
//   Sun: Standish Keplerian elements for the Earth–Moon barycentre, less the Moon's share
//     (μ = 1/82.30). Moon: truncated ELP-2000/82 (Meeus ch. 47, ~10″). Clock time is UTC
//     (≈ UT1); the ephemerides run on TT = UT + ΔT.
//   Solar eclipses: shadow cones from tangents to the Sun's and Moon's limbs (k = 0.2725076),
//     intersected with the WGS-84 ellipsoid; greatest eclipse = closest approach of the shadow
//     axis to Earth's centre (gamma), as in the NASA/GSFC Five Millennium Canon.
//   Lunar eclipses: Danjon's rule for the enlarged shadow (+1% of the Moon's parallax, which
//     is what the Canon uses): ρ_u = 1.01·π₁ − s☉ + π☉, ρ_p = 1.01·π₁ + s☉ + π☉, π₁ = 0.998340·π☾.
//   Everything here is COMPUTED; expected accuracy ~1 minute for eclipses, more for planets.

import { heliocentric } from './kepler.js';
import { moonGeocentric, moonFromElements } from './moons.js';
import { earthAxes } from './orientation.js';

const AU = 149597870.7, C_KMS = 299792.458;
export const R_EARTH = 6378.137;
const FLAT = 1 / 298.257223563, B_OVER_A = 1 - FLAT;
export const R_SUN = 696000; // the Canon's solar radius
export const K_MOON = 0.2725076; // Moon radius / Earth equatorial radius (eclipse work)
export const R_MOON = K_MOON * R_EARTH; // 1738.1 km
const MU_MOON = 1 / 82.300568; // Moon / (Earth + Moon) mass
const DEG = Math.PI / 180, DAY_S = 86400;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));
const OBL = 23.4392911 * DEG;
const eclToEq = ([x, y, z]) => [x, y * Math.cos(OBL) - z * Math.sin(OBL), y * Math.sin(OBL) + z * Math.cos(OBL)];
const eqToEcl = ([x, y, z]) => [x, y * Math.cos(OBL) + z * Math.sin(OBL), -y * Math.sin(OBL) + z * Math.cos(OBL)];
const yearOf = (jd) => 2000 + (jd - 2451545) / 365.25;

// ---- time ---------------------------------------------------------------------------------------
// ΔT = TT − UT1 (s): observed values 1986–2026 (IERS), Espenak & Meeus (2006) polynomials before,
// held at today's value to 2050 (Earth's spin has recently been speeding up), then blended into
// the long-term parabola −20 + 32u² by 2150.
const DT_OBS = [[1986, 54.87], [1990, 56.86], [1995, 60.78], [2000, 63.83], [2005, 64.69], [2010, 66.07], [2015, 67.64],
  [2017, 68.59], [2020, 69.36], [2023, 69.2], [2026, 69.2]];
const longTerm = (y) => { const u = (y - 1820) / 100; return -20 + 32 * u * u; };
export function deltaT(jd) {
  const y = yearOf(jd);
  if (y >= 1986 && y <= 2026) {
    const i = DT_OBS.findIndex((r) => r[0] >= y);
    const [y1, v1] = DT_OBS[Math.max(1, i)], [y0, v0] = DT_OBS[Math.max(0, i - 1)];
    return y1 === y0 ? v1 : v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
  }
  if (y > 2026) {
    if (y <= 2050) return 69.2;
    if (y <= 2150) return 69.2 + ((longTerm(2150) - 69.2) * (y - 2050)) / 100;
    return longTerm(y);
  }
  let t;
  if (y >= 1961) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y >= 1941) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y >= 1920) { t = y - 1920; return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3; }
  if (y >= 1900) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y >= 1860) { t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
  if (y >= 1800) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  return longTerm(y);
}
const tt = (jd) => jd + deltaT(jd) / DAY_S;

// ---- positions (geocentric J2000 ecliptic, km) --------------------------------------------------
// Earth's heliocentric position decides where the Sun is. Standish's elements are good to
// ~15″ (≈ ±30 s in eclipse times); when JPL Horizons vectors are loaded (the JPL HORIZONS
// ephemeris mode) a provider supplies them instead: `fn(jdTT)` → [x, y, z] AU, or null.
let earthProvider = null;
/** Use `fn(jdTT) → heliocentric Earth (AU) | null` ahead of Standish's elements (null to clear). */
export function useEarthEphemeris(fn) { earthProvider = fn; }
/** Which Earth ephemeris the last computation used. */
export let earthSource = 'kepler';
/** Earth's heliocentric position (km) at TT `t`. */
function earthHelio(t) {
  const h = earthProvider?.(t);
  if (h) { earthSource = 'horizons'; return mul(h, AU); }
  earthSource = 'kepler';
  const emb = mul(heliocentric('earth', t), AU);
  return sub(emb, mul(moonGeocentric(t), MU_MOON));
}
/** Cubic (4-point Lagrange) interpolation of daily [jd, x, y, z] rows at `jd`, or null outside them. */
export function interpolateDaily(rows, jd) {
  if (!rows?.length || jd < rows[0][0] || jd > rows[rows.length - 1][0]) return null;
  const i = Math.max(1, Math.min(rows.length - 3, Math.floor(jd - rows[0][0])));
  const pts = rows.slice(Math.max(0, i - 1), i + 3);
  if (pts.length < 4) { // short run: linear
    const a = rows[Math.min(rows.length - 2, Math.floor(jd - rows[0][0]))], b = rows[rows.indexOf(a) + 1], f = (jd - a[0]) / (b[0] - a[0]);
    return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * f);
  }
  const out = [0, 0, 0];
  for (let j = 0; j < 4; j++) {
    let w = 1;
    for (let k = 0; k < 4; k++) if (k !== j) w *= (jd - pts[k][0]) / (pts[j][0] - pts[k][0]);
    for (let c = 0; c < 3; c++) out[c] += w * pts[j][c + 1];
  }
  return out;
}
/**
 * Geocentric Sun and Moon (km) at clock time (UT) `jd`, as the shadow sees them: light reaching
 * Earth now passed the Moon τ = |m|/c ago, so the Moon is taken where it was then relative to
 * where Earth is now (Earth's 30 km/s × 1.3 s ≈ 38 km, ~40 s in eclipse times). The Sun's own
 * light time cancels in its rest frame.
 */
export function sunMoon(jd, { lunar = false } = {}) {
  const t = tt(jd);
  const e = earthHelio(t), m = moonGeocentric(t), tau = len(m) / C_KMS / DAY_S;
  // solar eclipse: the Moon then vs Earth now; lunar eclipse: the Moon now vs Earth then (its shadow left Earth τ ago)
  const moon = lunar ? add(m, sub(e, earthHelio(t - tau))) : add(moonGeocentric(t - tau), sub(earthHelio(t - tau), e));
  return { sun: mul(e, -1), moon };
}
/** Geocentric planet (km), light-time corrected, at UT `jd`. */
export function planetGeo(id, jd) {
  const t = tt(jd), e = earthHelio(t);
  let p = sub(mul(heliocentric(id, t), AU), e);
  p = sub(mul(heliocentric(id, t - len(p) / C_KMS / DAY_S), AU), e);
  return p;
}

// ---- the rotating Earth -------------------------------------------------------------------------
/** Earth-fixed axes at UT `jd` in J2000 ecliptic: x Greenwich, y 90° E, z north. */
function earthFrame(jd) {
  const a = earthAxes(jd, -180); // x: Greenwich meridian, y: north pole, z: x × pole (90° W), J2000 equatorial
  return { x: eqToEcl(a.x), y: mul(eqToEcl(a.z), -1), z: eqToEcl(a.y) };
}
const toFixed = (v, f) => [dot(v, f.x), dot(v, f.y), dot(v, f.z)];
const fromFixed = (v, f) => add(add(mul(f.x, v[0]), mul(f.y, v[1])), mul(f.z, v[2]));
/** Geodetic latitude / longitude (deg) of an Earth-fixed point. */
export function geodetic([x, y, z]) {
  const lon = Math.atan2(y, x) / DEG;
  const lat = Math.atan2(z, Math.hypot(x, y) * B_OVER_A * B_OVER_A) / DEG;
  return { lat, lon };
}
/** Earth-fixed surface point (km) at geodetic lat/lon (deg). */
export function surfacePoint(lat, lon) {
  const p = lat * DEG, l = lon * DEG, e2 = FLAT * (2 - FLAT);
  const N = R_EARTH / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
  return [N * Math.cos(p) * Math.cos(l), N * Math.cos(p) * Math.sin(l), N * (1 - e2) * Math.sin(p)];
}
/** First hit of the ray o + s·d (geocentric inertial km, d unit) on the ellipsoid at `frame`, or null. */
function hitEarth(o, d, frame) {
  const of = toFixed(o, frame), df = toFixed(d, frame);
  const O = [of[0], of[1], of[2] / B_OVER_A], D = [df[0], df[1], df[2] / B_OVER_A];
  const a = dot(D, D), b = 2 * dot(O, D), c = dot(O, O) - R_EARTH * R_EARTH, disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = (-b - Math.sqrt(disc)) / (2 * a);
  if (s < 0) return null;
  return add(of, mul(df, s)); // Earth-fixed
}

// ---- solar eclipses -----------------------------------------------------------------------------
/** Shadow geometry at UT `jd`. */
export function solarShadow(jd) {
  const { sun: s, moon: m } = sunMoon(jd);
  const sm = sub(m, s), dSM = len(sm), u = mul(sm, 1 / dSM);
  const c = mul(m, -1); // Earth's centre relative to the Moon
  const z = dot(c, u); // Moon → fundamental plane
  const w = sub(c, mul(u, z)), dist = len(w);
  const tanF1 = (R_SUN + R_MOON) / dSM, tanF2 = (R_SUN - R_MOON) / dSM;
  const l1 = R_MOON + z * tanF1, l2 = R_MOON - z * tanF2; // penumbra / umbra radii on the fundamental plane (l2 < 0: antumbra)
  const frame = earthFrame(jd);
  const north = fromFixed([0, 0, 1], frame);
  const gamma = (dist / R_EARTH) * (dot(mul(w, -1), north) >= 0 ? 1 : -1);
  return { jd, s, m, u, z, dist, gamma, l1, l2, tanF1, tanF2, frame };
}

/** Where the shadow axis meets the ground (Earth-fixed km), or null. */
const axisHit = (g) => hitEarth(g.m, g.u, g.frame);

/** Topocentric Sun/Moon at an Earth-fixed point: semi-diameters, separation (rad), magnitude, obscuration. */
export function localCircumstances(jd, fixedPoint) {
  const { sun: s, moon: m } = sunMoon(jd);
  const P = fromFixed(fixedPoint, earthFrame(jd));
  const ds = sub(s, P), dm = sub(m, P);
  const ss = Math.asin(R_SUN / len(ds)), sm = Math.asin(R_MOON / len(dm)), sep = angle(ds, dm);
  const mag = (ss + sm - sep) / (2 * ss);
  return { ss, sm, sep, magnitude: Math.max(0, mag), obscuration: obscuration(ss, sm, sep), sunUp: dot(ds, P) > 0 };
}
/** Fraction of a disc of radius r1 hidden by a disc of radius r2 at centre distance d. */
export function obscuration(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return r2 >= r1 ? 1 : (r2 * r2) / (r1 * r1);
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const a3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return (a1 + a2 - a3) / (Math.PI * r1 * r1);
}

/**
 * Outlines of the umbra (or antumbra) and penumbra on the ground at UT `jd`: arrays of
 * Earth-fixed points (km); `null` entries break the line where it runs off the Earth.
 */
export function shadowOutlines(jd, n = 96) {
  const g = solarShadow(jd);
  const e1 = norm(cross(g.u, Math.abs(g.u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(g.u, e1);
  const umbra = [], penumbra = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI, r = add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t)));
    const limb = add(g.m, mul(r, R_MOON));
    umbra.push(hitEarth(limb, norm(sub(limb, add(g.s, mul(r, R_SUN)))), g.frame));
    penumbra.push(hitEarth(limb, norm(sub(limb, sub(g.s, mul(r, R_SUN)))), g.frame));
  }
  return { umbra, penumbra, axis: axisHit(g), frame: g.frame };
}

// ---- lunar eclipses -----------------------------------------------------------------------------
/** Earth's shadow on the Moon at UT `jd` (angles in radians, seen from Earth's centre). */
export function lunarShadow(jd) {
  // what happens at the Moon at jd − 1.3 s is seen from Earth at jd
  const { sun: s, moon: m } = sunMoon(jd - 1.28 / DAY_S, { lunar: true });
  const dm = len(m), ds = len(s);
  const piM = Math.asin(R_EARTH / dm), piS = Math.asin(R_EARTH / ds), sS = Math.asin(R_SUN / ds), sM = Math.asin(1737.4 / dm);
  const pi1 = 0.99834 * piM;
  const rhoU = 1.01 * pi1 - sS + piS, rhoP = 1.01 * pi1 + sS + piS;
  const sigma = angle(m, mul(s, -1));
  return { jd, sigma, rhoU, rhoP, sM, umbral: (rhoU + sM - sigma) / (2 * sM), penumbral: (rhoP + sM - sigma) / (2 * sM) };
}

// ---- search helpers -----------------------------------------------------------------------------
function golden(f, a, b, tol = 1e-6) { // minimum of f on [a, b] (days; tol ≈ 0.1 s)
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a), d = a + r * (b - a), fc = f(c), fd = f(d);
  while (b - a > tol) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - r * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + r * (b - a); fd = f(d); }
  }
  return (a + b) / 2;
}
function root(f, a, b, tol = 1e-6) { // f(a), f(b) of opposite sign
  let fa = f(a);
  for (let i = 0; i < 60 && b - a > tol; i++) {
    const mid = (a + b) / 2, fm = f(mid);
    if ((fm < 0) === (fa < 0)) { a = mid; fa = fm; } else b = mid;
  }
  return (a + b) / 2;
}
/** Times where f crosses zero going outward from `t0` (f(t0) < 0) within ±span days: [before, after] or nulls. */
function bracket(f, t0, span, step = 0.004) {
  let lo = null, hi = null;
  for (let t = t0; t > t0 - span; t -= step) if (f(t) >= 0) { lo = root(f, t, t + step); break; }
  for (let t = t0; t < t0 + span; t += step) if (f(t) >= 0) { hi = root(f, t - step, t); break; }
  return [lo, hi];
}
/** Local minima of f sampled every `step` on [from, to], refined: [{ t, v }] (each sample evaluated once). */
function minima(f, from, to, step, keep = () => true, tol = 1e-5) {
  const out = [];
  let a = f(from), b = f(from + step);
  for (let t = from + step; t < to; t += step) {
    const c = f(t + step);
    if (b <= a && b <= c && keep(b)) { const tm = golden(f, t - step, t + step, tol); out.push({ t: tm, v: f(tm) }); }
    a = b; b = c;
  }
  return out;
}
const lonOf = (v) => Math.atan2(v[1], v[0]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** New (phase 0) or full (phase π) moons in [from, to] (UT). */
export function syzygies(from, to, phase) {
  const f = (t) => { const { sun, moon } = sunMoon(t); return wrap(lonOf(moon) - lonOf(sun) - phase); };
  const out = [];
  let t0 = from, f0 = f(t0);
  for (let t = from + 1; t <= to + 1; t += 1) {
    const f1 = f(t);
    if (f0 < 0 && f1 >= 0 && f1 - f0 < Math.PI) out.push(root(f, t0, t));
    t0 = t; f0 = f1;
  }
  return out.filter((t) => t >= from && t <= to);
}

/** Every solar eclipse in [from, to] (UT): type, greatest eclipse, gamma, magnitude, contacts, place and duration. */
export function solarEclipses(from, to) {
  const out = [];
  for (const nm of syzygies(from, to, 0)) {
    const tg = golden((t) => solarShadow(t).dist, nm - 0.3, nm + 0.3);
    const g = solarShadow(tg);
    if (g.dist > R_EARTH + g.l1) continue; // the penumbra misses Earth
    const P = (t) => { const x = solarShadow(t); return x.dist - (R_EARTH + x.l1); };
    const [p1, p4] = bracket(P, tg, 0.3, 0.01);
    const hit = axisHit(g);
    const ev = { type: 'solar', greatest: tg, gamma: g.gamma, contacts: { P1: p1, P4: p4 } };
    if (hit) {
      // central: total if the umbra (not the antumbra) reaches the ground on the axis
      const local = localCircumstances(tg, hit);
      ev.kind = local.sm > local.ss ? 'total' : 'annular';
      ev.magnitude = local.sm / local.ss;
      ev.place = geodetic(hit);
      const U = (t) => { const x = solarShadow(t); return x.dist - (R_EARTH - Math.abs(x.l2)); };
      const [u2, u3] = bracket(U, tg, 0.2, 0.005);
      ev.contacts.U2 = u2; ev.contacts.U3 = u3;
      // hybrid: annular at the ends of the path and total in the middle (or the reverse)
      const kinds = new Set([u2, u3].filter(Boolean).map((t) => { const h = axisHit(solarShadow(t + (t === u2 ? 0.002 : -0.002))); return h ? (localCircumstances(t, h).sm > localCircumstances(t, h).ss ? 'total' : 'annular') : null; }).filter(Boolean));
      if (kinds.size && !kinds.has(ev.kind)) ev.kind = 'hybrid';
      // duration of totality/annularity at greatest eclipse, for an observer turning with Earth
      const D = (t) => { const l = localCircumstances(t, hit); return Math.abs(l.sm - l.ss) - l.sep; };
      const [a, b] = bracket((t) => -D(t), tg, 0.01, 0.0002);
      ev.durationS = a && b ? (b - a) * DAY_S : null;
      ev.path = centralPath(u2 ?? tg - 0.08, u3 ?? tg + 0.08);
    } else {
      // partial: magnitude at the point on Earth nearest the shadow axis
      const near = toFixed(mul(norm(sub(add(g.m, mul(g.u, g.z)), [0, 0, 0])), R_EARTH), g.frame);
      ev.kind = 'partial';
      ev.magnitude = localCircumstances(tg, near).magnitude;
      ev.place = geodetic(near);
    }
    out.push(ev);
  }
  return out;
}
/** The central line and the umbra's northern/southern limits (Earth-fixed lat/lon), sampled every minute. */
export function centralPath(t1, t2) {
  const centre = [], north = [], south = [];
  for (let t = t1; t <= t2; t += 1 / 1440) {
    const g = solarShadow(t), c = axisHit(g);
    if (!c) continue;
    centre.push(geodetic(c));
    const o = shadowOutlines(t, 48), cu = norm(c);
    const ahead = axisHit(solarShadow(t + 1 / 1440));
    if (!ahead) continue;
    const across = norm(cross(sub(ahead, c), cu));
    let best = null, worst = null;
    for (const q of o.umbra) {
      if (!q) continue;
      const k = dot(sub(q, c), across);
      if (!best || k > best.k) best = { k, q };
      if (!worst || k < worst.k) worst = { k, q };
    }
    if (best) { north.push(geodetic(best.q)); south.push(geodetic(worst.q)); }
  }
  return { centre, north, south };
}

/** Every lunar eclipse in [from, to] (UT). */
export function lunarEclipses(from, to) {
  const out = [];
  for (const fm of syzygies(from, to, Math.PI)) {
    const tg = golden((t) => lunarShadow(t).sigma, fm - 0.3, fm + 0.3);
    const l = lunarShadow(tg);
    if (l.penumbral <= 0) continue;
    const at = (key, sign) => (t) => { const x = lunarShadow(t); return x.sigma - (key === 'P' ? x.rhoP + x.sM : key === 'U' ? x.rhoU + x.sM : x.rhoU - x.sM) * sign; };
    const [p1, p4] = bracket(at('P', 1), tg, 0.3, 0.005);
    const contacts = { P1: p1, P4: p4 };
    if (l.umbral > 0) [contacts.U1, contacts.U4] = bracket(at('U', 1), tg, 0.2, 0.002);
    if (l.umbral >= 1) [contacts.U2, contacts.U3] = bracket(at('T', 1), tg, 0.1, 0.001);
    out.push({ type: 'lunar', kind: l.umbral >= 1 ? 'total' : l.umbral > 0 ? 'partial' : 'penumbral', greatest: tg,
      magnitude: l.umbral, penumbralMagnitude: l.penumbral, contacts });
  }
  return out;
}

// ---- transits and occultations ------------------------------------------------------------------
const RADIUS = { mercury: 2439.7, venus: 6051.8, mars: 3389.5, jupiter: 71492, saturn: 60268, uranus: 25559, neptune: 24764 };
/** Transits of Mercury and Venus across the Sun in [from, to]. */
export function planetTransits(from, to) {
  const out = [];
  for (const id of ['mercury', 'venus']) {
    const sep = (t) => { const p = planetGeo(id, t), { sun } = sunMoon(t); return { d: angle(p, sun), ss: Math.asin(R_SUN / len(sun)), sp: Math.asin(RADIUS[id] / len(p)), near: len(p) < len(sun) }; };
    // inferior conjunctions: the elongation from the Sun reaches a minimum while the planet is nearer than the Sun
    for (const { t: tg } of minima((x) => sep(x).d, from, to, 1, (v) => v < 2 * DEG)) {
      const s = sep(tg);
      if (!s.near || s.d >= s.ss + s.sp) continue;
      const [c1, c4] = bracket((x) => { const q = sep(x); return q.d - (q.ss + q.sp); }, tg, 0.6, 0.002);
      out.push({ type: 'transit', body: id, kind: 'transit', greatest: tg, separationArcsec: (s.d / DEG) * 3600, contacts: { C1: c1, C4: c4 } });
    }
  }
  return out;
}

// Bright stars the Moon can occult (J2000 RA, Dec; near the ecliptic).
export const OCCULTABLE_STARS = [['Aldebaran', 68.980, 16.509], ['Regulus', 152.093, 11.967], ['Spica', 201.298, -11.161],
  ['Antares', 247.352, -26.432], ['Pleiades (Alcyone)', 56.871, 24.105], ['Elnath', 81.573, 28.608], ['Pollux', 116.329, 28.026]];
const starDir = (ra, dec) => eqToEcl([Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)]);
/**
 * Occultations by the Moon visible somewhere on Earth in [from, to]: the geocentric separation
 * falls below the Moon's semi-diameter + its parallax (+ the planet's semi-diameter).
 */
export function lunarOccultations(from, to) {
  const out = [];
  const targets = [...['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map((id) => ({ name: id, dir: (t) => planetGeo(id, t), r: RADIUS[id] })),
    ...OCCULTABLE_STARS.map(([name, ra, dec]) => ({ name, star: true, dir: () => starDir(ra, dec), r: 0 }))];
  const moonAt = (t) => moonGeocentric(tt(t)); // geometric is plenty for 'visible somewhere on Earth'
  for (const tg of targets) {
    const lim = (t, d) => { const m = moonAt(t); return Math.asin(R_MOON / len(m)) + Math.asin(R_EARTH / len(m)) + (tg.r ? Math.asin(tg.r / len(d)) : 0); };
    const sep = (t) => angle(moonAt(t), tg.dir(t));
    for (const { t, v } of minima(sep, from, to, 0.25, (x) => x < 3 * DEG)) if (v < lim(t, tg.dir(t))) out.push({ type: 'occultation', body: tg.name, kind: 'occultation', greatest: t, separationDeg: v / DEG });
  }
  return out;
}

// ---- Jupiter's moons ----------------------------------------------------------------------------
const R_JUP = 71492, R_JUP_POLE = 66854;
/**
 * Transits of the Galilean moons and their shadows across Jupiter, and their eclipses and
 * occultations, as seen from Earth (light time included) in [from, to]. Moon positions come
 * from fitted mean elements (≈1° along the orbit), so times are good to ~±10 min.
 */
export function jovianEvents(moons, from, to, step = 1 / 144) {
  const out = [];
  const state = (t) => {
    const T = tt(t), e = earthHelio(T), j0 = mul(heliocentric('jupiter', T), AU);
    const lt = len(sub(j0, e)) / C_KMS / DAY_S, J = mul(heliocentric('jupiter', T - lt), AU);
    return { J, view: norm(sub(J, e)), sun: norm(J), T: T - lt };
  };
  // Jupiter's pole (J2000 equatorial RA 268.057°, Dec 64.495°) for the flattening
  const pole = eqToEcl([Math.cos(64.495 * DEG) * Math.cos(268.057 * DEG), Math.cos(64.495 * DEG) * Math.sin(268.057 * DEG), Math.sin(64.495 * DEG)]);
  const inside = (v, dir) => { // is the moon's projection (along dir) inside Jupiter's disc?
    const p = sub(v, mul(dir, dot(v, dir))), k = dot(p, pole), q = sub(p, mul(pole, k));
    return (dot(q, q) / (R_JUP * R_JUP) + (k * k) / (R_JUP_POLE * R_JUP_POLE)) < 1;
  };
  for (const m of moons) {
    const flags = (t) => { const s = state(t), v = moonFromElements(m.elements, s.T); return {
      transit: dot(v, s.view) < 0 && inside(v, s.view), occultation: dot(v, s.view) > 0 && inside(v, s.view),
      shadow: dot(v, s.sun) < 0 && inside(v, s.sun), eclipse: dot(v, s.sun) > 0 && inside(v, s.sun) }; };
    let prev = flags(from), open = {};
    for (let t = from + step; t <= to; t += step) {
      const now = flags(t);
      for (const k of ['transit', 'shadow', 'occultation', 'eclipse']) {
        if (now[k] && !prev[k]) open[k] = t;
        if (!now[k] && prev[k] && open[k] != null) { out.push({ type: 'jovian', body: m.id, kind: k, start: open[k], end: t, greatest: (open[k] + t) / 2 }); open[k] = null; }
      }
      prev = now;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
/**
 * Jupiter's mutual-event season: the Earth and the Sun both within ~1° of Jupiter's equatorial
 * plane (around its equinoxes, every ~6 years), when the Galilean moons eclipse and occult
 * one another. Individual events need ephemerides good to ~100 km (IMCCE), which mean elements are not.
 */
export function jovianPlaneCrossing(jd) {
  const T = tt(jd), J = mul(heliocentric('jupiter', T), AU), e = earthHelio(T);
  const pole = eqToEcl([Math.cos(64.495 * DEG) * Math.cos(268.057 * DEG), Math.cos(64.495 * DEG) * Math.sin(268.057 * DEG), Math.sin(64.495 * DEG)]);
  const dE = Math.asin(dot(norm(sub(e, J)), pole)) / DEG, dS = Math.asin(dot(norm(mul(J, -1)), pole)) / DEG;
  return { earthDeg: dE, sunDeg: dS, season: Math.abs(dE) < 1.2 && Math.abs(dS) < 1.2 };
}

// ---- alignments -----------------------------------------------------------------------------------
const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const elongation = (id, t) => { const p = planetGeo(id, t), { sun } = sunMoon(t); return { e: angle(p, sun), dl: wrap(lonOf(p) - lonOf(sun)), p }; };
/**
 * Oppositions, greatest elongations, close conjunctions (< `conjDeg`, planets and the Moon) and
 * planetary parades (≥ `paradeMin` planets within `paradeDeg` of ecliptic longitude, all at least
 * 15° from the Sun) in [from, to].
 */
export function alignments(from, to, { conjDeg = 1, paradeDeg = 60, paradeMin = 5 } = {}) {
  const out = [];
  for (const id of PLANETS) {
    const inner = id === 'mercury' || id === 'venus';
    const g = (t) => (inner ? -elongation(id, t).e : Math.PI - elongation(id, t).e); // minimise: max elongation / opposition
    for (const { t: tm } of minima(g, from, to, 3, () => true, 1e-4)) {
      const el = elongation(id, tm);
      if (inner) out.push({ type: 'alignment', body: id, kind: 'greatest elongation', greatest: tm, elongationDeg: el.e / DEG, side: el.dl > 0 ? 'east (evening)' : 'west (morning)' });
      else if (el.e > 170 * DEG) out.push({ type: 'alignment', body: id, kind: 'opposition', greatest: tm, distanceAu: len(el.p) / AU });
    }
  }
  // conjunctions (appulses): minimum separation below conjDeg
  const bodies = [...PLANETS.map((id) => ({ id, dir: (t) => planetGeo(id, t) })), { id: 'moon', dir: (t) => moonGeocentric(tt(t)) }];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const A = bodies[i], B = bodies[j], moon = B.id === 'moon';
    const sep = (t) => angle(A.dir(t), B.dir(t));
    for (const { t: tm, v: s } of minima(sep, from, to, moon ? 0.25 : 2, (x) => x < conjDeg * DEG * 1.5, 1e-4)) {
      const sunSep = angle(A.dir(tm), sunMoon(tm).sun);
      // close Moon conjunctions that are occultations somewhere on Earth are listed as those instead
      const m = moon ? len(sunMoon(tm).moon) : 0;
      if (s < conjDeg * DEG && sunSep > 10 * DEG && (!moon || s > Math.asin(R_MOON / m) + Math.asin(R_EARTH / m))) out.push({ type: 'alignment', body: `${A.id}–${B.id}`, kind: 'conjunction', greatest: tm, separationDeg: s / DEG });
    }
  }
  // parades: sample daily; report each run of qualifying days once, at its tightest
  let run = null;
  for (let t = from; t <= to; t += 1) {
    const { sun } = sunMoon(t);
    const lons = PLANETS.filter((id) => angle(planetGeo(id, t), sun) > 15 * DEG).map((id) => ({ id, l: lonOf(planetGeo(id, t)) }));
    let best = null;
    for (const a of lons) {
      const inArc = lons.filter((b) => { const d = wrap(b.l - a.l); return d >= 0 && d <= paradeDeg * DEG; });
      if (inArc.length >= paradeMin && (!best || inArc.length > best.ids.length)) {
        const span = Math.max(...inArc.map((b) => wrap(b.l - a.l))) / DEG;
        best = { ids: inArc.map((b) => b.id), span };
      }
    }
    if (best) { if (!run || best.ids.length > run.ids.length || (best.ids.length === run.ids.length && best.span < run.span)) run = { ...best, t: run?.t0 != null ? t : t, t0: run?.t0 ?? t }; }
    else if (run) { out.push({ type: 'alignment', body: run.ids.join(', '), kind: 'planetary parade', greatest: run.t, start: run.t0, end: t - 1, spanDeg: run.span, thresholdDeg: paradeDeg }); run = null; }
  }
  if (run) out.push({ type: 'alignment', body: run.ids.join(', '), kind: 'planetary parade', greatest: run.t, start: run.t0, end: to, spanDeg: run.span, thresholdDeg: paradeDeg });
  return out.sort((a, b) => a.greatest - b.greatest);
}

/** Lat/lon (deg) → geocentric inertial point (km) at UT `jd` — for drawing paths on the turning Earth. */
export const inertialPoint = (jd, lat, lon) => fromFixed(surfacePoint(lat, lon), earthFrame(jd));
/** Earth-fixed point (km) → geocentric inertial (km, J2000 ecliptic) at UT `jd`. */
export const fixedToInertial = (jd, p) => fromFixed(p, earthFrame(jd));
