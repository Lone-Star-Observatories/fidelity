// Natural satellites: parent-relative positions, J2000 ecliptic, km.
//
// The Moon: the ELP-2000/82 series as given by Meeus (Astronomical Algorithms, ch. 47: the 60
// largest terms in each of longitude, distance and latitude), precessed rigorously to J2000 —
// about 10″ and a few km against JPL DE440.
// Other moons: JPL SSD mean orbital elements (https://ssd.jpl.nasa.gov/sats/elem/), referred
// to each moon's local Laplace plane, with apsidal and nodal precession. Good to a degree
// or two along the orbit; JPL Horizons is the ephemeris-grade source.

import { eccentricAnomaly, toEcliptic } from './kepler.js';
import { eqToEcl } from './frames.js';
import { poleUnit } from './rotation.js';

const DEG = Math.PI / 180;
const J2000 = 2451545.0;
const sin = (d) => Math.sin(d * DEG), cos = (d) => Math.cos(d * DEG);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// ---- the Moon ---------------------------------------------------------------------------------
// [D, M, M′, F, Σl (1e-6°), Σr (1e-3 km)]
const LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751], [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130], [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0], [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0], [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117], [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0], [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165], [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];
// [D, M, M′, F, Σb (1e-6°)]
const B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794], [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475], [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107], [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451], [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366], [2, 1, 0, 1, -351], [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315], [2, -2, 0, -1, 302], [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223], [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164], [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

/** Geocentric Moon, J2000 ecliptic [x, y, z] km. */
export function moonGeocentric(jd) {
  const T = (jd - J2000) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const E = 1 - 0.002516 * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of LR) {
    const arg = d * D + m * M + mp * Mp + f * F, e = m ? E ** Math.abs(m) : 1;
    sl += l * e * sin(arg); sr += r * e * cos(arg);
  }
  for (const [d, m, mp, f, b] of B) sb += b * (m ? E ** Math.abs(m) : 1) * sin(d * D + m * M + mp * Mp + f * F);
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  // ecliptic and mean equinox of date → J2000 (Meeus eq. 21.5: rigorous ecliptic precession)
  const [lon, lat] = eclipticToJ2000(Lp + sl / 1e6, sb / 1e6, T);
  const dist = 385000.56 + sr / 1000;
  return [dist * cos(lat) * cos(lon), dist * cos(lat) * sin(lon), dist * sin(lat)];
}

/** Ecliptic longitude/latitude (deg) of the date T (Julian centuries from J2000) → J2000 ecliptic (Meeus 21.5). */
export function eclipticToJ2000(lonDeg, latDeg, T) {
  const t = -T, AS = 1 / 3600; // from the date back to J2000
  const eta = ((47.0029 - 0.06603 * T + 0.000598 * T * T) * t + (-0.03302 + 0.000598 * T) * t * t + 0.00006 * t ** 3) * AS;
  const Pi = 174.876384 + (3289.4789 * T + 0.60622 * T * T - (869.8089 + 0.50491 * T) * t + 0.03536 * t * t) * AS;
  const p = ((5029.0966 + 2.22226 * T - 0.000042 * T * T) * t + (1.11113 - 0.000042 * T) * t * t - 0.000006 * t ** 3) * AS;
  const A = cos(eta) * cos(latDeg) * sin(Pi - lonDeg) - sin(eta) * sin(latDeg);
  const Bv = cos(latDeg) * cos(Pi - lonDeg);
  const Cv = cos(eta) * sin(latDeg) + sin(eta) * cos(latDeg) * sin(Pi - lonDeg);
  const lon = p + Pi - Math.atan2(A, Bv) / DEG;
  return [lon, Math.asin(Math.max(-1, Math.min(1, Cv))) / DEG];
}

// ---- other moons -------------------------------------------------------------------------------

/** Reference-plane basis (J2000 equatorial) for a pole; x = the plane's ascending node on the ICRF equator. */
function planeBasis(pole) {
  const z = norm(poleUnit(pole));
  let x = cross([0, 0, 1], z);
  x = Math.hypot(...x) < 1e-9 ? [1, 0, 0] : norm(x);
  return { x, y: cross(z, x), z };
}

/**
 * Parent-relative J2000 ecliptic position (km) of a moon from JPL mean elements
 * `el` = { a, e, w, M, i, node, P (days), Papsis, Pnode (years), epochJd, frame, pole }.
 * frame 'laplace' / 'equatorial' use `pole` (RA, Dec); 'ecliptic' is the J2000 ecliptic.
 */
export function moonFromElements(el, jd) {
  const t = jd - el.epochJd;
  const retro = el.i > 90;
  // Nodes regress on prograde orbits and advance on retrograde ones (J2); apsides advance.
  const dNode = el.Pnode ? (retro ? 1 : -1) * 360 / (el.Pnode * 365.25) : 0;
  const dPeri = el.Papsis ? 360 / (el.Papsis * 365.25) : 0; // longitude of periapsis
  const node = el.node + dNode * t;
  // Phase: JPL's rounded periods drift by whole orbits over decades, so each moon carries a
  // fit to Horizons (`el.fit`: mean longitude at fit.jd and mean motion, deg/day) where
  // available; otherwise the published mean anomaly and period.
  const w = el.w + (retro ? dPeri : dPeri - dNode) * t;
  const lambda = el.fit ? el.fit.lambda + el.fit.n * (jd - el.fit.jd) : el.node + el.w + el.M + (360 / el.P) * t;
  const M = lambda - node - w;
  const E = eccentricAnomaly(M * DEG, el.e);
  const xp = el.a * (Math.cos(E) - el.e), yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const v = toEcliptic(xp, yp, { I: el.i * DEG, node: node * DEG, peri: (node + w) * DEG });
  if (el.frame === 'ecliptic') return v;
  const b = planeBasis(el.pole);
  const eq = [0, 1, 2].map((k) => b.x[k] * v[0] + b.y[k] * v[1] + b.z[k] * v[2]);
  return eqToEcl(eq);
}

/** Parent-relative J2000 ecliptic position (km) of moon `m` (see src/data/moons.js). */
export const moonOffsetKm = (m, jd) => (m.id === 'moon' ? moonGeocentric(jd) : moonFromElements(m.elements, jd));
