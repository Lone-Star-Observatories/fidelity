// Approximate heliocentric positions of the major planets from Keplerian elements.
//
// Source: E. M. Standish (JPL/Caltech), "Keplerian Elements for Approximate Positions
// of the Major Planets", Table 1 (valid 1800 AD – 2050 AD), J2000 ecliptic & equinox.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
//
// Accuracy over the valid span is arcminutes for the inner planets and a few tenths
// of a degree for the outer ones — plenty for a navigation display, and it works fully
// offline. When the viewer wants ephemeris-grade positions the System View switches to
// JPL Horizons vectors (see src/data/horizons.js); provenance badges reflect which.

const DEG = Math.PI / 180;

// [a (AU), e, I (deg), L (deg), long.peri ϖ (deg), long.node Ω (deg)] at J2000,
// followed by the same six rates per Julian century.
export const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
            [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus:   [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
            [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  // Earth row is the Earth–Moon barycentre (within ~4,700 km of Earth's centre).
  earth:   [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
            [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars:    [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
            [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
            [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn:  [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
            [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus:  [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
            [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
            [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto:   [[39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
            [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

export const VALID_RANGE = { fromYear: 1800, toYear: 2050 };

/** Julian centuries since J2000.0 for a Julian Date. */
export const centuries = (jd) => (jd - 2451545.0) / 36525;

/** Osculating-style elements of `body` at Julian Date `jd` (angles in radians). */
export function elementsAt(body, jd) {
  const [base, rate] = ELEMENTS[body];
  const T = centuries(jd);
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);
  return { a, e, I: I * DEG, L: L * DEG, peri: peri * DEG, node: node * DEG };
}

/** Solve Kepler's equation M = E − e·sin E for E (radians). */
export function eccentricAnomaly(M, e) {
  // Normalise M into [-π, π] for fast, stable convergence.
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Rotate orbital-plane coordinates (x′, y′) into the reference frame (x, y, z). */
export function toEcliptic(xp, yp, { I, peri, node }) {
  const w = peri - node;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(node), sO = Math.sin(node);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    (sw * sI) * xp + (cw * sI) * yp,
  ];
}

/** Position for elements `el` (a, e, I, peri, node; radians) at mean anomaly `M`. */
export function positionAt(el, M) {
  const E = eccentricAnomaly(M, el.e);
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return toEcliptic(xp, yp, el);
}

/** `segments` points tracing the full ellipse described by elements `el`. */
export function ellipse(el, segments = 360) {
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * 2 * Math.PI;
    pts.push(toEcliptic(el.a * (Math.cos(E) - el.e), b * Math.sin(E), el));
  }
  return pts;
}

/** Heliocentric J2000 ecliptic position [x, y, z] in AU of `body` at Julian Date `jd`. */
export function heliocentric(body, jd) {
  const el = elementsAt(body, jd);
  return positionAt(el, el.L - el.peri);
}

/** Points tracing the full orbit ellipse of `body` at `jd` (for drawing). */
export const orbitPath = (body, jd, segments = 360) => ellipse(elementsAt(body, jd), segments);
