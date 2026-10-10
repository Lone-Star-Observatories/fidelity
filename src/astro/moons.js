// Natural satellites: parent-relative positions, J2000 ecliptic, km.
//
// The Moon: a truncated ELP-2000/82 series (Meeus, Astronomical Algorithms, ch. 47; the
// largest terms) — about 10″ in longitude and a few km in distance against JPL DE440.
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
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
// [D, M, M′, F, Σb (1e-6°)]
const B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065],
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
  const lon = Lp + sl / 1e6 - 1.3969713 * T; // mean equinox of date → J2000 (general precession)
  const lat = sb / 1e6, dist = 385000.56 + sr / 1000;
  return [dist * cos(lat) * cos(lon), dist * cos(lat) * sin(lon), dist * sin(lat)];
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
