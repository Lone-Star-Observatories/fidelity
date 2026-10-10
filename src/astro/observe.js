// Seeing it from Earth: where a body is on the sky, how bright and how big it looks, which
// constellation it is in, and when it rises, crosses the meridian and sets for an observer.
//
// Positions come from the app's own ephemeris (heliocentric J2000 ecliptic AU, the System
// View's frame before scene mapping). RA/Dec are astrometric J2000 (light-time corrected, like
// JPL Horizons quantity 1); horizon work precesses them to the equinox of date (IAU 1976).
// Magnitudes: Mallama & Hilton (2018) for the planets, the H–G system for small bodies, and
// V(1,0) with a linear phase law for moons. Tested against JPL Horizons (tests/observe.test.js).

import { BOUNDARIES, CONSTELLATION_NAMES } from '../data/constellations.js';
import { PHOTOMETRY, EQUATORIAL_RADIUS_KM } from '../data/photometry.js';

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;
export const AU_KM = 149597870.7;
const LIGHT_DAYS_PER_AU = 499.004784 / 86400;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const wrap360 = (x) => ((x % 360) + 360) % 360;
const wrap180 = (x) => wrap360(x + 180) - 180;

/** J2000 ecliptic → J2000 equatorial. */
export function eclToEq([x, y, z]) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return [x, y * c - z * s, y * s + z * c];
}
/** RA, Dec (degrees) of an equatorial vector. */
export function toRaDec(v) {
  return { ra: wrap360(Math.atan2(v[1], v[0]) / DEG), dec: Math.asin(v[2] / len(v)) / DEG };
}
export const fromRaDec = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

/** IAU 1976 (Lieske) precession of a J2000 equatorial vector to the mean equator and equinox of `jd`. */
export function precess(v, jd) {
  const T = (jd - 2451545.0) / 36525;
  const as = DEG / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(th), Math.sin(th)];
  const [x, y, w] = v;
  return [
    (cz * cZ * ct - sz * sZ) * x + (-sz * cZ * ct - cz * sZ) * y + (-cZ * st) * w,
    (cz * sZ * ct + sz * cZ) * x + (-sz * sZ * ct + cz * cZ) * y + (-sZ * st) * w,
    (cz * st) * x + (-sz * st) * y + ct * w,
  ];
}

const B1875 = 2405889.258550475;
/** IAU constellation containing J2000 (ra, dec), from Roman's (1987) B1875 boundaries. */
export function constellation(ra, dec) {
  const p = toRaDec(precess(fromRaDec(ra, dec), B1875));
  const h = p.ra / 15;
  for (const [lo, hi, dLo, abbr] of BOUNDARIES) {
    if (p.dec >= dLo && h >= lo && h < hi) return { abbr, name: CONSTELLATION_NAMES[abbr] ?? abbr };
  }
  return { abbr: 'Oct', name: 'Octans' };
}

/**
 * Geocentric astrometric view of a body: `bodyAt(jd)` and `earthAt(jd)` give heliocentric
 * J2000 ecliptic positions (AU). The body is taken where it was when the light left it.
 */
export function geocentric(bodyAt, earthAt, jd) {
  const E = earthAt(jd);
  let P = bodyAt(jd), tau = 0;
  for (let k = 0; k < 3; k++) {
    tau = len(sub(P, E)) * LIGHT_DAYS_PER_AU;
    P = bodyAt(jd - tau);
  }
  const g = sub(P, E);
  return { helio: P, earth: E, geo: g, delta: len(g), r: len(P), lightDays: tau };
}

/**
 * Sky quantities for a geocentric result: RA/Dec (J2000), elongation from the Sun, phase angle,
 * illuminated fraction and angular diameter (arcsec, from `radiusKm`).
 */
export function describe({ helio, earth, geo, delta, r }, { radiusKm = 0 } = {}) {
  const eq = eclToEq(geo);
  const { ra, dec } = toRaDec(eq);
  const sunDist = len(earth);
  const elongation = Math.acos(Math.max(-1, Math.min(1, dot(earth.map((x) => -x), geo) / (sunDist * delta)))) / DEG;
  const phase = r > 0 ? Math.acos(Math.max(-1, Math.min(1, dot(helio, geo) / (r * delta)))) / DEG : 0;
  // east of the Sun = evening sky
  const sunEcl = earth.map((x) => -x);
  const east = Math.sin(Math.atan2(geo[1], geo[0]) - Math.atan2(sunEcl[1], sunEcl[0])) > 0;
  return {
    ra, dec, delta, r, elongation, phase, illuminated: (1 + Math.cos(phase * DEG)) / 2, east,
    angularDiameterArcsec: radiusKm ? (2 * Math.atan(radiusKm / (delta * AU_KM))) / DEG * 3600 : null,
    eq,
  };
}

/** Planetographic latitude of the sub-observer point (deg) for a body with pole (RA, Dec) seen along `eqDir` (observer → body). */
export function subObserverLatitude(eqDir, [poleRa, poleDec]) {
  return -Math.asin(dot(eqDir, fromRaDec(poleRa, poleDec)) / len(eqDir)) / DEG;
}

/** Mallama & Hilton (2018) planet magnitudes, without the 5 log rΔ term. */
function planetV1(id, a, { ringTilt = 0, subLat = 0 } = {}) {
  switch (id) {
    case 'mercury': return -0.613 + 6.328e-2 * a - 1.6336e-3 * a ** 2 + 3.3644e-5 * a ** 3 - 3.4265e-7 * a ** 4 + 1.6893e-9 * a ** 5 - 3.0334e-12 * a ** 6;
    case 'venus': return a <= 163.7 ? -4.384 - 1.044e-3 * a + 3.687e-4 * a ** 2 - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4
      : 236.05828 - 2.81914 * a + 8.39034e-3 * a ** 2;
    case 'earth': return -3.99 - 1.060e-3 * a + 2.054e-4 * a ** 2;
    case 'mars': return a <= 50 ? -1.601 + 0.02267 * a - 0.0001302 * a ** 2 : -0.367 - 0.02573 * a + 0.0003445 * a ** 2;
    case 'jupiter': {
      if (a <= 12) return -9.395 - 3.7e-4 * a + 6.16e-4 * a ** 2;
      const x = a / 180;
      return -9.428 - 2.5 * Math.log10(1 - 1.507 * x - 0.363 * x ** 2 - 0.062 * x ** 3 + 2.809 * x ** 4 - 1.876 * x ** 5);
    }
    case 'saturn': {
      const sb = Math.sin(Math.abs(ringTilt) * DEG);
      if (a <= 6.5 && Math.abs(ringTilt) <= 27) return -8.914 - 1.825 * sb + 0.026 * a - 0.378 * sb * Math.exp(-2.25 * a);
      return -8.94 + 2.446e-4 * a + 2.672e-4 * a ** 2 - 1.505e-6 * a ** 3 + 4.767e-9 * a ** 4;
    }
    case 'uranus': return -7.110 - 8.4e-4 * Math.abs(subLat) + 6.587e-3 * a + 1.045e-4 * a ** 2;
    case 'neptune': return -7.00 + (a > 1.9 ? 7.944e-3 * a + 9.617e-5 * a ** 2 : 0);
    default: return null;
  }
}

/** H–G phase function (Bowell et al. 1989). */
export function hgMagnitude(H, G, r, delta, phaseDeg) {
  const t = Math.tan((phaseDeg * DEG) / 2);
  const p1 = Math.exp(-3.33 * t ** 0.63), p2 = Math.exp(-1.87 * t ** 1.22);
  return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * p1 + G * p2);
}

/**
 * Apparent visual magnitude of Sol body `id` (null when unknown). `geom` = describe() output,
 * `extra` = { ringTilt, subLat } for Saturn and Uranus.
 */
export function apparentMagnitude(id, geom, extra = {}) {
  const { r, delta, phase } = geom;
  if (id === 'sun') return -26.74 + 5 * Math.log10(delta);
  const p = PHOTOMETRY[id];
  if (!p) return null;
  const d = 5 * Math.log10(r * delta);
  if (p.law === 'MH18') return planetV1(id, phase, extra) + d;
  if (p.law === 'moon') return 0.21 + d + 0.026 * phase + 4e-9 * phase ** 4;
  if (p.H != null) return hgMagnitude(p.H, p.G ?? 0.15, r, delta, phase);
  return p.V0 + d + (p.beta ?? 0) * phase;
}

export const equatorialRadiusKm = (id, fallback) => EQUATORIAL_RADIUS_KM[id] ?? fallback;

// ---- the observer's sky -----------------------------------------------------------------------

/** Greenwich mean sidereal time (deg), IAU 1982, for a UT Julian date. */
export function gmst(jd) {
  const d = jd - 2451545.0, T = d / 36525;
  return wrap360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Altitude and azimuth (deg; azimuth from north through east) of equator-of-date (ra, dec). */
export function horizontal(raDate, decDate, jd, latDeg, lonDeg) {
  const H = (gmst(jd) + lonDeg - raDate) * DEG, phi = latDeg * DEG, dec = decDate * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { alt: alt / DEG, az: wrap360(az / DEG + 180), hourAngle: wrap180(H / DEG) };
}

/** Bennett's refraction (deg) for a geometric altitude. */
export const refraction = (alt) => (alt < -1.5 ? 0 : (1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * DEG)) / 60);

/** Equator-of-date RA/Dec for a J2000 equatorial vector. */
export function ofDate(eq, jd) { return toRaDec(precess(eq, jd)); }

/**
 * Rise, transit and set in [jd0, jd0 + span) for `raDecAt(jd)` → { ra, dec } (equator of date).
 * `h0` = geometric altitude of the event (deg): −0.5667 for a point with standard refraction;
 * subtract a semi-diameter for the upper limb and add the horizontal parallax for the Moon.
 * Returns { rise, transit, set, transitAlt } (JDs or null) and `always` = 'up' | 'down' | null.
 */
export function riseTransitSet(raDecAt, jd0, latDeg, lonDeg, { h0 = -0.5667, span = 1, stepMin = 10 } = {}) {
  const n = Math.round((span * 1440) / stepMin);
  const at = (jd) => { const p = raDecAt(jd); return horizontal(p.ra, p.dec, jd, latDeg, lonDeg); };
  const f = (jd) => at(jd).alt - h0;
  const out = { rise: null, transit: null, set: null, transitAlt: null, always: null };
  let prev = { jd: jd0, h: at(jd0) };
  let anyUp = prev.h.alt > h0, anyDown = !anyUp;
  for (let k = 1; k <= n; k++) {
    const jd = jd0 + (k * stepMin) / 1440, h = at(jd);
    if (h.alt > h0) anyUp = true; else anyDown = true;
    const a0 = prev.h.alt - h0, a1 = h.alt - h0;
    if (a0 <= 0 && a1 > 0 && out.rise == null) out.rise = bisect(f, prev.jd, jd);
    if (a0 > 0 && a1 <= 0 && out.set == null) out.set = bisect(f, prev.jd, jd);
    if (prev.h.hourAngle < 0 && h.hourAngle >= 0 && h.hourAngle < 90 && out.transit == null) {
      out.transit = bisect((t) => at(t).hourAngle, prev.jd, jd);
      out.transitAlt = at(out.transit).alt;
    }
    prev = { jd, h };
  }
  if (!out.rise && !out.set) out.always = anyUp && !anyDown ? 'up' : 'down';
  return out;
}

function bisect(f, a, b) {
  let fa = f(a);
  for (let k = 0; k < 30; k++) {
    const m = (a + b) / 2, fm = f(m);
    if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/**
 * When a fixed star (J2000 ra) transits at local midnight: the best month to see it. Returns the
 * month index 0–11, from the Sun's mean right ascension (~0h at the March equinox).
 */
export function bestMonth(raDeg) {
  // the Sun is opposite (RA + 180°) on that date; the Sun's RA advances ~0.9856°/day from 0 at ~20 March
  const days = wrap360(raDeg + 180) / 0.9856;
  const d = new Date(Date.UTC(2001, 2, 20) + days * 86400000);
  return d.getUTCMonth();
}

/** Formatting helpers: RA as 12h 34m 56s, Dec as +12° 34′ 56″. */
export function formatRa(ra) {
  const t = wrap360(ra) / 15;
  let h = Math.floor(t), m = Math.floor((t - h) * 60), s = Math.round(((t - h) * 60 - m) * 60);
  if (s === 60) { s = 0; m += 1; } if (m === 60) { m = 0; h = (h + 1) % 24; }
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
export function formatDec(dec) {
  const a = Math.abs(dec);
  let d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
  if (s === 60) { s = 0; m += 1; } if (m === 60) { m = 0; d += 1; }
  return `${dec < 0 ? '−' : '+'}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}
/** 8-point compass name for an azimuth. */
export const compass = (az) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(wrap360(az) / 45) % 8];
