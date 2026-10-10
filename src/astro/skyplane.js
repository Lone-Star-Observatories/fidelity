// Sky-plane geometry for images and star swarms placed in 3D (#24): an image's plane is
// perpendicular to the line of sight from Sol, its north aligned with equatorial north at that
// position; physical size = angular size × distance. Pure maths (J2000 equatorial unit vectors),
// tested in tests/skyplane.test.js.

const DEG = Math.PI / 180;
export const ARCMIN = DEG / 60;

/** Unit vector toward (RA°, Dec°), J2000 equatorial. */
export const radecVec = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lin = (a, s, b, t) => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t];

/**
 * Local sky basis at (RA°, Dec°) for an image whose north is `northLeft`° counter-clockwise
 * (to the left) of its vertical ("North is N° left of vertical"; east 90° counter-clockwise
 * from north, as the sky is seen). Returns equatorial unit vectors:
 *   r: from Sol toward the image centre; north, east: local sky directions;
 *   up, right: the image's vertical and horizontal axes. right × up = −r (the image faces Sol).
 */
export function skyBasis(ra, dec, northLeft = 0) {
  const a = ra * DEG, d = dec * DEG;
  const r = radecVec(ra, dec);
  const east = [-Math.sin(a), Math.cos(a), 0];
  const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  // north = up rotated by θ counter-clockwise ⇒ the image's up has position angle −θ
  const t = northLeft * DEG;
  const up = lin(north, Math.cos(t), east, -Math.sin(t));
  const right = lin(north, -Math.sin(t), east, -Math.cos(t)); // PA(up) − 90°: west when north is up
  return { r, north, east, up, right };
}

/** Physical size (same unit as `dist`) of something `arcmin` across at distance `dist`. */
export const physicalSize = (arcmin, dist) => 2 * dist * Math.tan((arcmin * ARCMIN) / 2);

/** Gnomonic offset (arcmin along the image's right and up axes) of (ra, dec) from a basis' centre. */
export function planeOffset(basis, ra, dec) {
  const v = radecVec(ra, dec), z = dot(v, basis.r);
  return [Math.atan(dot(v, basis.right) / z) / ARCMIN, Math.atan(dot(v, basis.up) / z) / ARCMIN];
}

/**
 * Teff (K) from Gaia BP−RP colour, dereddened: Mucciarelli & Bellazzini 2020 (dwarfs,
 * θ = 5040/Teff = 0.4929 + 0.5092 C − 0.0353 C²), clamped to C ∈ [−0.4, 3.5] outside its range.
 */
export function teffFromBpRp(c) {
  const x = Math.max(-0.4, Math.min(3.5, c));
  return 5040 / (0.4929 + 0.5092 * x - 0.0353 * x * x);
}

/** Deterministic standard-normal number from a string (Gaia id): reproducible modelled depths. */
export function hashNormal(s) {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  const u1 = ((h1 >>> 0) + 1) / 4294967297, u2 = ((h2 >>> 0) + 1) / 4294967297;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Distance (pc) to draw a cluster member at. Its direction is measured; along the line of sight a
 * single star's parallax is only useful when its error is small next to the cluster's size, so the
 * parallax distance is shrunk toward the cluster's (an inverse-variance weight), and what it can't
 * pin down is filled with a reproducible scatter as wide as the cluster (MODELLED).
 *   clusterPc, radiusPc: the cluster's distance and r50; plx, ePlx: mas; seed: the Gaia id.
 * Returns { pc, measured } where measured = the parallax carries most (≥ 80%) of the weight.
 */
export function memberDistance(clusterPc, radiusPc, plx, ePlx, seed) {
  const r = Math.max(radiusPc, 0.3);
  if (!(plx > 0) || !(ePlx > 0)) return { pc: clusterPc + hashNormal(seed) * r, measured: false };
  const d = 1000 / plx, sd = (d * ePlx) / plx;
  const w = (r * r) / (r * r + sd * sd);
  const off = Math.max(-4 * r, Math.min(4 * r, d - clusterPc));
  return { pc: clusterPc + w * off + (1 - w) * hashNormal(seed) * r, measured: w >= 0.8 };
}
