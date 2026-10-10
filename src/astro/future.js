// Future events (#53): the calculations behind the FUTURE catalogue. Each function says what it
// rests on; values derived here are COMPUTED from the stated inputs, scenarios are MODELLED.

import { poleStar } from './orientation.js';

const LY_PER_PC = 3.261563777;
const J2000 = 2451545;

/** Apparent magnitude of an absolute magnitude M at `distLy`, with `av` magnitudes of extinction. */
export const apparentMag = (M, distLy, av = 0) => M + 5 * Math.log10(distLy / LY_PER_PC / 10) + av;

/**
 * Supernova light-curve templates: magnitudes below peak, `days` after explosion.
 *   'IIP' (red-supergiant core collapse, like SN 1999em / 2004et): ~10-day rise, ~100-day plateau
 *     fading ~0.8 mag, a ~2 mag drop over ~20 days, then the cobalt-56 tail at 0.98 mag/100 d.
 *   'Ibc' (stripped star, e.g. a Wolf–Rayet): ~15-day rise, ~0.07 mag/day for 40 days, then
 *     ~0.02 mag/day. Template shapes from Anderson et al. 2014 and Drout et al. 2011 (MODELLED).
 */
export function lightCurve(days, type = 'IIP') {
  if (days < 0) return Infinity;
  if (type === 'Ibc') {
    if (days < 15) return 4 * (1 - days / 15) ** 2;
    if (days < 55) return 0.07 * (days - 15);
    return 2.8 + 0.02 * (days - 55);
  }
  if (days < 10) return 3 * (1 - days / 10) ** 2;
  if (days < 110) return 0.008 * (days - 10);
  if (days < 130) return 0.8 + 2.0 * ((days - 110) / 20);
  return 2.8 + 0.0098 * (days - 130);
}
/** How bright that is, in words (compared with familiar objects). */
export function brightnessWords(m) {
  if (m <= -12) return 'ABOUT THE FULL MOON';
  if (m <= -9.5) return 'ABOUT THE HALF MOON';
  if (m <= -6) return 'A POINT BRIGHTER THAN ANY PLANET: VISIBLE IN DAYLIGHT';
  if (m <= -4) return 'LIKE VENUS: VISIBLE IN DAYLIGHT IF YOU KNOW WHERE TO LOOK';
  if (m <= -1.5) return 'BRIGHTER THAN SIRIUS';
  if (m <= 1.5) return 'A FIRST-MAGNITUDE STAR';
  if (m <= 6) return 'NAKED-EYE STAR';
  return 'NOT VISIBLE TO THE NAKED EYE';
}
/** Days the event stays brighter than magnitude `limit` (sampled daily, up to 10 years). */
export function daysBrighterThan(peak, limit, type = 'IIP') {
  let n = 0;
  for (let d = 0; d < 3650; d++) if (peak + lightCurve(d, type) <= limit) n++;
  return n;
}

// ---- the Sun ----------------------------------------------------------------------------------
export const SUN_AGE_GYR = 4.57;
/**
 * Main-sequence solar luminosity (L☉) `gyr` billion years from now: Gough (1981),
 * L(t) = L☉ / (1 + 0.4 (1 − t/t☉)). Valid to the end of the main sequence (~+5 Gyr).
 */
export const sunLuminosity = (gyr) => 1 / (1 + 0.4 * (1 - (SUN_AGE_GYR + gyr) / SUN_AGE_GYR));
/**
 * Habitable-zone edges (au) for a Sun-like star of luminosity L (L☉): Kopparapu et al. (2013)
 * for T_eff = 5,780 K: runaway greenhouse at S_eff = 1.107 (inner), maximum greenhouse 0.356 (outer).
 */
export const habitableZone = (L) => ({ inner: Math.sqrt(L / 1.107), outer: Math.sqrt(L / 0.356) });
/** When (Gyr from now) the inner habitable-zone edge passes 1 au: Gough's law solved for L = 1.107. */
export function earthLeavesHabitableZone() {
  const L = 1.107;
  return SUN_AGE_GYR * (1 - (1 / L - 1) / 0.4) - SUN_AGE_GYR;
}

// ---- pole stars --------------------------------------------------------------------------------
const jdOfYear = (y) => J2000 + (y - 2000) * 365.25;
/**
 * The run of north pole stars from `fromYear` to `toYear` (astronomical years) by the app's precession
 * model (IAU 1976 within ±2,000 years of J2000, uniform 50.29″/yr beyond; proper motion ignored):
 * [{ name, fromYear, toYear, bestYear, minSepDeg }] for each star that is the nearest bright star
 * to the pole for a stretch.
 */
export function poleStarSequence(fromYear = 2000, toYear = 28000, step = 50) {
  const runs = [];
  for (let y = fromYear; y <= toYear; y += step) {
    const p = poleStar(jdOfYear(y));
    let r = runs.at(-1);
    if (!r || r.name !== p.name) runs.push((r = { name: p.name, fromYear: y, toYear: y, bestYear: y, minSepDeg: p.sep }));
    r.toYear = y;
    if (p.sep < r.minSepDeg) { r.minSepDeg = p.sep; r.bestYear = y; }
  }
  return runs;
}

// ---- passing stars -----------------------------------------------------------------------------
/**
 * A passing star's pull on the Solar System: its acceleration on the Sun relative to the Sun's on
 * Earth, and the tidal (differential) part across Earth's orbit, which is what could change orbits.
 */
export function passingStarPull(massSun, distAu) {
  const direct = massSun / distAu ** 2; // vs the Sun's pull at 1 au (1 M☉ / 1 au²)
  return { direct, tidal: (2 * massSun) / distAu ** 3 };
}
