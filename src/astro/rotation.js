// Body orientation from the IAU rotation model: the pole (RA, Dec), and the prime-meridian
// angle W measured from the node Q where the body's equator crosses the J2000 equator.
// Earth uses Greenwich mean sidereal time, so day and night fall where they really are.

const DEG = Math.PI / 180;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const add = (a, b, ka, kb) => a.map((x, i) => x * ka + b[i] * kb);

export const daysSinceJ2000 = (jd) => jd - 2451545.0;

/** Greenwich mean sidereal time, degrees (IAU 1982, good to ~0.1 s over centuries). */
export const gmstDeg = (jd) => (((280.46061837 + 360.98564736629 * daysSinceJ2000(jd)) % 360) + 360) % 360;

export function poleUnit([raDeg, decDeg]) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/** Prime-meridian angle W (degrees) for `iau` = [W0, Ẇ] or 'gmst'. */
export const primeMeridian = (iau, jd) => (iau === 'gmst' ? gmstDeg(jd) : iau[0] + iau[1] * daysSinceJ2000(jd));

/**
 * Body-fixed axes in J2000 equatorial coordinates, matched to an equirectangular texture
 * whose left edge is longitude `texLon0` (east-positive): returns { x, y, z } where y is
 * the north pole and x points at the texture's centre longitude (three.js sphere UVs).
 */
export function bodyAxes(pole, iau, jd, texLon0 = -180) {
  const p = norm(poleUnit(pole));
  let q = cross([0, 0, 1], p);
  q = Math.hypot(...q) < 1e-9 ? [1, 0, 0] : norm(q); // Earth: measured from the equinox
  const W = primeMeridian(iau, jd) * DEG;
  const pq = cross(p, q);
  const m = add(q, pq, Math.cos(W), Math.sin(W)); // prime meridian direction
  const lon = (texLon0 + 180) * DEG;
  const pm = cross(p, m); // 90° east of the prime meridian
  const x = add(m, pm, Math.cos(lon), Math.sin(lon));
  return { x, y: p, z: cross(x, p) };
}

/** Unit vector at body longitude `lonDeg` (east), latitude 0, in J2000 equatorial. */
export function meridianDirection(pole, iau, jd, lonDeg) {
  const { x, z } = bodyAxes(pole, iau, jd, -180); // x = lon 0, −z = lon 90°E
  const l = lonDeg * DEG;
  return add(x, z.map((v) => -v), Math.cos(l), Math.sin(l));
}
