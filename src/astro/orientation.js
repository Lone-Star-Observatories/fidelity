// Spin axes that move (#19): Earth's precession and nutation, the Moon's IAU rotation model
// (which carries its librations), and the pole star of any epoch.
//
//   Earth: IAU 1976 precession (Lieske et al. 1977) within ±2,000 years of J2000, uniform
//     precession of the equinoxes (50.29″/yr about the J2000 ecliptic pole, obliquity held at
//     23.44°) beyond that; nutation from its two largest terms (18.6-yr lunar node, 0.5-yr solar).
//   Moon: IAU WGCCRE 2009 (Archinal et al. 2011), pole and prime meridian with the E1–E13
//     periodic terms. Rotating uniformly on an elliptical, tilted orbit gives the optical
//     librations (±7.9° in longitude, ±6.7° in latitude) seen from Earth.

import { precessionToJ2000 } from './sgp4.js';
import { daysSinceJ2000, gmstDeg, poleUnit } from './rotation.js';

const DEG = Math.PI / 180, AS = DEG / 3600, J2000 = 2451545.0;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const add = (a, b, ka, kb) => a.map((x, i) => x * ka + b[i] * kb);
const EPS0 = 23.4392911 * DEG;
/** The J2000 ecliptic pole in J2000 equatorial coordinates. */
export const ECLIPTIC_POLE = [0, -Math.sin(EPS0), Math.cos(EPS0)];

/** Nutation in longitude and obliquity (radians), largest terms of IAU 1980. */
export function nutation(jd) {
  const T = (jd - J2000) / 36525;
  const om = (125.04452 - 1934.136261 * T) * DEG; // Moon's ascending node
  const L = (280.4665 + 36000.7698 * T) * DEG, Lm = (218.3165 + 481267.8813 * T) * DEG;
  const dpsi = (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * om)) * AS;
  const deps = (9.2 * Math.cos(om) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lm) - 0.09 * Math.cos(2 * om)) * AS;
  return { dpsi, deps };
}

/** Earth's north pole of date (true, with nutation) as a J2000 equatorial unit vector. */
export function earthPole(jd, { withNutation = true } = {}) {
  const years = (jd - J2000) / 365.25;
  let mean;
  if (Math.abs(years) <= 2000) {
    const M = precessionToJ2000(jd); // date → J2000: the pole of date is M · ẑ
    mean = [M[0][2], M[1][2], M[2][2]];
  } else {
    // uniform precession: the pole circles the ecliptic pole westward at 50.29″/yr
    const a = -50.29 * years * AS;
    // rotate the J2000 pole about the ecliptic pole by `a` (Rodrigues)
    const k = ECLIPTIC_POLE, v = [0, 0, 1], c = Math.cos(a), s = Math.sin(a), kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const kx = cross(k, v);
    mean = [0, 1, 2].map((i) => v[i] * c + kx[i] * s + k[i] * kv * (1 - c));
  }
  if (!withNutation) return norm(mean);
  // nutation: tip the pole by Δε towards/away from the ecliptic pole and by Δψ·sinε around it
  const { dpsi, deps } = nutation(jd);
  const eq = norm(cross(mean, ECLIPTIC_POLE)); // towards the equinox of date
  const towardsEcl = norm(cross(eq, mean)); // in the plane of pole and ecliptic pole, pointing at the ecliptic pole
  const t = add(mean, towardsEcl, 1, -deps); // larger obliquity tilts the pole away from the ecliptic pole
  return norm(add(t, eq, 1, dpsi * Math.sin(EPS0)));
}

/** Body-fixed axes from a pole, the node direction q, and the prime meridian W (deg), texture-matched like bodyAxes. */
export function axesFrom(p, q, Wdeg, texLon0 = -180) {
  const pq = cross(p, q), W = Wdeg * DEG;
  const m = add(q, pq, Math.cos(W), Math.sin(W));
  const lon = (texLon0 + 180) * DEG, pm = cross(p, m);
  const x = add(m, pm, Math.cos(lon), Math.sin(lon));
  return { x, y: p, z: cross(x, p) };
}

/** Earth's axes: precessing pole, sidereal time measured from the equinox of date. */
export function earthAxes(jd, texLon0 = -180) {
  const p = earthPole(jd);
  const q = norm(cross(p, ECLIPTIC_POLE)); // the equinox of date (ecliptic motion ignored)
  return axesFrom(p, q, gmstDeg(jd), texLon0);
}

/** Moon: IAU 2009 pole (RA, Dec in deg) and prime meridian W (deg). */
export function moonIAU(jd) {
  const d = daysSinceJ2000(jd), T = d / 36525;
  const E = [0, 125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d, 134.963 + 13.064993 * d, 276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d].map((x) => x * DEG);
  const s = (k) => Math.sin(E[k]), c = (k) => Math.cos(E[k]);
  const ra = 269.9949 + 0.0031 * T - 3.8787 * s(1) - 0.1204 * s(2) + 0.07 * s(3) - 0.0172 * s(4) + 0.0072 * s(6) - 0.0052 * s(10) + 0.0043 * s(13);
  const dec = 66.5392 + 0.013 * T + 1.5419 * c(1) + 0.0239 * c(2) - 0.0278 * c(3) + 0.0068 * c(4) - 0.0029 * c(6) + 0.0009 * c(7) + 0.0008 * c(10) - 0.0009 * c(13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * s(1) + 0.1208 * s(2) - 0.0642 * s(3) + 0.0158 * s(4) + 0.0252 * s(5)
    - 0.0066 * s(6) - 0.0047 * s(7) - 0.0046 * s(8) + 0.0028 * s(9) + 0.0052 * s(10) + 0.004 * s(11) + 0.0019 * s(12) - 0.0044 * s(13);
  return { pole: [ra, dec], W };
}
export function moonAxes(jd, texLon0 = -180) {
  const { pole, W } = moonIAU(jd);
  const p = poleUnit(pole);
  return axesFrom(p, norm(cross([0, 0, 1], p)), W, texLon0);
}

// Bright stars near Earth's precession circle (J2000 RA, Dec in degrees).
export const POLE_STARS = [
  ['Polaris', 37.95, 89.26], ['Kochab', 222.68, 74.16], ['Thuban', 211.1, 64.38], ['Vega', 279.23, 38.78],
  ['Deneb', 310.36, 45.28], ['Alderamin', 319.64, 62.59], ['Errai', 354.84, 77.63], ['Iota Herculis', 264.87, 46.01],
  ['Delta Cygni', 296.24, 45.13], ['Polaris Australis (σ Oct)', 317.2, -88.96],
];
/** The pole star of an epoch: the listed star nearest Earth's north pole, with its separation (deg). */
export function poleStar(jd) {
  const p = earthPole(jd, { withNutation: false });
  let best = null;
  for (const [name, ra, dec] of POLE_STARS) {
    const v = poleUnit([ra, dec]);
    const sep = Math.acos(Math.max(-1, Math.min(1, v[0] * p[0] + v[1] * p[1] + v[2] * p[2]))) / DEG;
    if (!best || sep < best.sep) best = { name, sep };
  }
  return best;
}
/** Obliquity of the ecliptic of date (deg), IAU 1980 (within ±2,000 yr; held at J2000 beyond). */
export function obliquityDeg(jd) {
  const T = (jd - J2000) / 36525;
  if (Math.abs(T) > 20) return EPS0 / DEG;
  return 23.4392911 - (46.815 * T + 0.00059 * T * T - 0.001813 * T ** 3) / 3600;
}
