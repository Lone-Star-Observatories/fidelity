// Coordinate frames and stellar photometry helpers shared by the views.
//
// Frames: J2000 equatorial (catalogue x, y, z), J2000 ecliptic (System View) and IAU
// galactic (Navigation View). Scene mapping: the frame's reference plane is three.js XZ
// and its north pole is +Y.

const DEG = Math.PI / 180;
export const OBLIQUITY = 23.4392911 * DEG;
export const LY_PER_PC = 3.26156;
export const AU_PER_LY = 63241.077;

/** Equatorial → ecliptic (rotate about x by the obliquity). */
export function eqToEcl([x, y, z]) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return [x, y * c + z * s, -y * s + z * c];
}

// J2000 equatorial → IAU galactic rotation (Hipparcos ESA 1997, vol. 1 §1.5.3).
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
export function eqToGal([x, y, z]) {
  return GAL.map((r) => r[0] * x + r[1] * y + r[2] * z);
}

/** IAU galactic → J2000 equatorial (the transpose). */
export function galToEq([x, y, z]) {
  return [0, 1, 2].map((i) => GAL[0][i] * x + GAL[1][i] * y + GAL[2][i] * z);
}
/** RA, Dec (degrees) of an equatorial vector. */
export function raDec([x, y, z]) {
  const r = Math.hypot(x, y, z) || 1;
  return { ra: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, dec: (Math.asin(z / r) * 180) / Math.PI };
}

/** Galactic longitude/latitude (degrees) of an equatorial vector. */
export function galacticLB(v) {
  const [x, y, z] = eqToGal(v);
  const l = (Math.atan2(y, x) / DEG + 360) % 360;
  return { l, b: Math.atan2(z, Math.hypot(x, y)) / DEG };
}

/** Reference frame [x, y, z] (plane = XY, north = +Z) → scene [x, y, z] (plane = XZ, north = +Y). */
export const frameToScene = ([x, y, z]) => [x, z, -y];

/** Apparent magnitude of a star of absolute magnitude M seen from `distPc`. */
export const apparentMag = (M, distPc) => M + 5 * Math.log10(Math.max(distPc, 1e-9) / 10);

/** Effective temperature from B−V colour index (Ballesteros 2012). */
export const teffFromBV = (bv) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

const SPECTRAL_TEFF = { O: 35000, B: 15000, A: 8800, F: 6800, G: 5700, K: 4500, M: 3200, L: 2000, T: 1200, Y: 500, D: 10000 };

/** Best available temperature estimate for a star, with how we got it. */
export function starTeff({ teff, ci, spect }) {
  if (teff) return { teff, how: 'measured' };
  if (ci != null && Number.isFinite(ci)) return { teff: teffFromBV(Math.max(-0.4, Math.min(2.0, ci))), how: 'colour index' };
  const letter = (spect || '').replace(/^(sd|d|esd)/, '').trim()[0]?.toUpperCase();
  if (letter && SPECTRAL_TEFF[letter]) return { teff: SPECTRAL_TEFF[letter], how: 'spectral class' };
  return { teff: 5000, how: 'unknown' };
}

/** Approximate sRGB colour of a blackbody at temperature `t` (Tanner Helland's fit), 0–1. */
export function blackbodyRGB(t) {
  const k = Math.max(1000, Math.min(40000, t)) / 100;
  let r, g, b;
  if (k <= 66) { r = 255; g = 99.4708025861 * Math.log(k) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(k - 60, -0.1332047592); g = 288.1221695283 * Math.pow(k - 60, -0.0755148492); }
  if (k >= 66) b = 255; else if (k <= 19) b = 0; else b = 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}

export const rgbToHex = ([r, g, b]) => (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

// IAU galactic → de Vaucouleurs supergalactic: the supergalactic north pole is at galactic
// (l, b) = (47.37°, +6.32°) and SGL = 0 points at (137.37°, 0°).
const gunit = (l, b) => { const L = l * Math.PI / 180, B = b * Math.PI / 180; return [Math.cos(B) * Math.cos(L), Math.cos(B) * Math.sin(L), Math.sin(B)]; };
const SG_Z = gunit(47.37, 6.32), SG_X = gunit(137.37, 0);
const SG_Y = [SG_Z[1] * SG_X[2] - SG_Z[2] * SG_X[1], SG_Z[2] * SG_X[0] - SG_Z[0] * SG_X[2], SG_Z[0] * SG_X[1] - SG_Z[1] * SG_X[0]];
/** Galactic Cartesian → supergalactic Cartesian. */
export const galToSupergal = (v) => [SG_X, SG_Y, SG_Z].map((a) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2]);
/** Equatorial RA/Dec (deg) and distance → supergalactic Cartesian (same unit as d). */
export function radecToSupergal(ra, dec, d) {
  const a = ra * Math.PI / 180, de = dec * Math.PI / 180;
  return galToSupergal(eqToGal([d * Math.cos(de) * Math.cos(a), d * Math.cos(de) * Math.sin(a), d * Math.sin(de)]));
}
