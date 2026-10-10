// Milankovitch cycles (#54): Earth's eccentricity, obliquity and precession from the Laskar et al.
// (2004) solution (src/data/la2004.js, every 1 kyr from 2.7 Myr ago to 1 Myr ahead), and the daily
// mean insolation they give at any latitude and season (Berger 1978's formula):
//   Q = (S₀/π) (a/r)² (H₀ sin φ sin δ + cos φ cos δ sin H₀),  cos H₀ = −tan φ tan δ,
//   sin δ = sin ε sin λ,  a/r = (1 + e cos(λ − ϖ − 180°)) / (1 − e²),
// with λ the Sun's true longitude from the vernal equinox and ϖ the (heliocentric) longitude of
// perihelion. S₀ = 1361 W/m² (Kopp & Lean 2011), held fixed: the Sun's slow brightening is not in it.

export const S0 = 1361;
const DEG = Math.PI / 180, TAU = 2 * Math.PI;

/** Orbital elements at `kyr` (thousands of years from J2000, + future), interpolated; null outside the table. */
export function orbitAt(table, kyr) {
  const x = (kyr - table.from) / table.step, i = Math.floor(x);
  if (i < 0 || i >= table.e.length - 1) return x === table.e.length - 1 ? row(table, i, 0) : null;
  return row(table, i, x - i);
}
function row(t, i, f) {
  const lerp = (a) => (a[i] + (f ? (a[i + 1] - a[i]) * f : 0));
  let p0 = t.pi[i] / 1e5, p1 = t.pi[Math.min(i + 1, t.pi.length - 1)] / 1e5;
  if (p1 - p0 > Math.PI) p1 -= TAU; else if (p0 - p1 > Math.PI) p1 += TAU; // unwrap across 0/2π
  const pi = (((p0 + (p1 - p0) * f) % TAU) + TAU) % TAU;
  return { e: lerp(t.e) / 1e6, eps: lerp(t.eps) / 1e6, pi };
}
/** Climatic precession index e·sin ϖ (positive: perihelion near the northern summer solstice is low). */
export const precessionIndex = (o) => o.e * Math.sin(o.pi);

/** Daily mean insolation (W/m²) at latitude `latDeg` when the Sun's true longitude is `lonDeg` (90 = June solstice). */
export function insolation(o, latDeg, lonDeg = 90, s0 = S0) {
  const phi = latDeg * DEG, lam = lonDeg * DEG;
  const dec = Math.asin(Math.sin(o.eps) * Math.sin(lam));
  const aOverR = (1 + o.e * Math.cos(lam - o.pi - Math.PI)) / (1 - o.e * o.e);
  const c = -Math.tan(phi) * Math.tan(dec);
  const H0 = c >= 1 ? 0 : c <= -1 ? Math.PI : Math.acos(c); // polar night / midnight sun
  return (s0 / Math.PI) * aOverR ** 2 * (H0 * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(H0));
}
/** Mars' solar constant at its mean distance (1.5237 au). */
export const S0_MARS = S0 / 1.5237 ** 2;
/** The classic Milankovitch forcing: daily mean insolation at 65° N on the June solstice. */
export const summer65N = (o) => insolation(o, 65, 90);

/** The Sun's true longitude (deg) at perihelion: the season in which Earth is closest to the Sun. */
export const perihelionLongitude = (o) => ((o.pi / DEG + 180) % 360 + 360) % 360;
/** Words for when perihelion falls (northern-hemisphere seasons). */
export function perihelionSeason(o) {
  const l = perihelionLongitude(o);
  const names = [[45, 'NEAR THE MARCH EQUINOX'], [135, 'NEAR THE JUNE SOLSTICE (NORTHERN SUMMER)'], [225, 'NEAR THE SEPTEMBER EQUINOX'], [315, 'NEAR THE DECEMBER SOLSTICE (NORTHERN WINTER)']];
  return (names.find(([b]) => Math.abs(((l - b + 540) % 360) - 180) <= 45) ?? [0, 'NEAR THE MARCH EQUINOX'])[1];
}
/**
 * The next time (kyr from J2000, searching from `fromKyr`) perihelion falls at the June solstice:
 * the "mirrored seasons", when northern summers are closest to the Sun and most extreme.
 */
export function nextPerihelionAtJuneSolstice(table, fromKyr = 0) {
  let prev = null;
  for (let k = fromKyr; k <= table.from + (table.e.length - 1) * table.step; k += 0.25) {
    const o = orbitAt(table, k);
    const d = ((perihelionLongitude(o) - 90 + 540) % 360) - 180; // signed degrees from the solstice
    if (prev != null && prev < 0 && d >= 0 && d - prev < 90) return k;
    prev = d;
  }
  return null;
}
