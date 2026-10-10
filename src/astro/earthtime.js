// Earth through time (#54): its slowing spin, and impact physics.
//
// Spin: tides lengthen the day by ~2.3 ms per century (Stephenson et al. 2016 from historical
// eclipses: 1.78 ms/cy net of the post-glacial speed-up). Leap seconds keep UTC within 0.9 s of
// UT1 until 2035, when the CGPM (2022) abolishes them; from then UT1 − UTC grows by the day's excess
// length each day: D(T) = 365.25 × (L₀ T + k T² / 200) ms after T years, for an excess L₀ (ms) now
// and growth k (ms per century).
//
// Impacts: kinetic energy ½ m v² for a sphere of diameter d and density ρ; final crater diameter
// from Collins, Melosh & Marcus (2005), the Earth Impact Effects Program, for a 45° impact into
// crystalline rock; average recurrence of an impact of that energy, Collins et al. (2005) eq. 3.

export const LEAP_SECONDS_END = 2035;
const MT_TNT = 4.184e15; // J

/** Years after 2035 until UT1 − UTC reaches `seconds`, for excess LOD `l0` ms now growing `k` ms/century. */
export function yearsToDrift(seconds, l0, k) {
  const a = 365.25e-3 * (k / 200), b = 365.25e-3 * l0; // D(T) = a T² + b T (s)
  if (a <= 0) return b > 0 ? seconds / b : Infinity;
  return (-b + Math.sqrt(b * b + 4 * a * seconds)) / (2 * a);
}
/** The leap-minute and leap-hour ranges over the scenarios: excess LOD 0–1 ms now, growth 1.7–2.3 ms/cy. */
export function leapScenarios() {
  const cases = [[0, 1.7], [0, 2.3], [1, 1.7], [1, 2.3]];
  const range = (s) => { const ys = cases.map(([l, k]) => yearsToDrift(s, l, k)); return [Math.min(...ys), Math.max(...ys)]; };
  return { minute: range(60), hour: range(3600) };
}
/** Length of the day (hours) `years` from now with the day lengthening `msPerCentury` (+ future, − past). */
export const dayLength = (years, msPerCentury = 2.3) => 24 + (msPerCentury * (years / 100)) / 3.6e6;

/** Kinetic energy (megatonnes of TNT) of a body `dKm` across at `vKms` with density `rho` (kg/m³). */
export function impactEnergyMt(dKm, vKms, rho = 3000) {
  const r = (dKm * 1000) / 2, m = rho * (4 / 3) * Math.PI * r ** 3;
  return (0.5 * m * (vKms * 1000) ** 2) / MT_TNT;
}
/**
 * Final crater diameter (km) on Earth, Collins et al. (2005) eqs. 21 and 27: transient crater
 * D_tc = 1.161 (ρi/ρt)^⅓ L^0.78 v^0.44 g^−0.22 sin^⅓θ, then complex collapse above 3.2 km.
 */
export function craterKm(dKm, vKms, rho = 3000, { rhoTarget = 2750, angleDeg = 45 } = {}) {
  const L = dKm * 1000, v = vKms * 1000, g = 9.81;
  const dtc = 1.161 * (rho / rhoTarget) ** (1 / 3) * L ** 0.78 * v ** 0.44 * g ** -0.22 * Math.sin((angleDeg * Math.PI) / 180) ** (1 / 3);
  const simple = 1.25 * dtc;
  if (simple <= 3200) return simple / 1000;
  return (1.17 * dtc ** 1.13) / 3200 ** 0.13 / 1000;
}
/** Average years between impacts of at least this energy (Collins et al. 2005, eq. 3: 109 E_Mt^0.78). */
export const recurrenceYears = (mt) => 109 * mt ** 0.78;
