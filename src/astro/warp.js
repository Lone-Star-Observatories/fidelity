// Helm (#42): speeds, warp factors, relativity and honest trip times. Pure and tested
// (tests/warp.test.js). Warp drive is fiction (IMAGINED); the speed of light, time dilation and the
// trip times of real propulsion are COMPUTED from the stated assumptions below.

export const C_KM_S = 299792.458;
export const AU_KM = 149597870.7;
export const LY_KM = 9460730472580.8; // Julian year × c
export const YEAR_S = 365.25 * 86400; // Julian year
const LOG10 = Math.log10;

// ---- warp factor ⇄ speed ------------------------------------------------------------------------
// Up to warp 9 the TNG scale is v = w^(10/3) c (warp 1 = c, warp 9 ≈ 1,516 c). Above 9 the curve
// steepens towards warp 10, which is unattainable (infinite speed). Between 9 and 10 we interpolate
// log v linearly in x = −log10(10 − w) through the figures quoted in Star Trek: The Next Generation
// Technical Manual (Sternbach & Okuda 1991): 9.2 ≈ 1,649 c, 9.6 ≈ 1,909 c, 9.9 ≈ 3,053 c,
// 9.99 ≈ 7,912 c, 9.9999 ≈ 199,516 c. All of it is canon-quoted fiction: IMAGINED.
export const WARP_CANON = [[9, 1516], [9.2, 1649], [9.6, 1909], [9.9, 3053], [9.99, 7912], [9.9999, 199516]];
const ANCHORS = WARP_CANON.map(([w, c]) => [-LOG10(10 - w), LOG10(c)]);
ANCHORS[0][1] = LOG10(Math.pow(9, 10 / 3)); // continuous with w^(10/3) at warp 9

/** Speed (multiples of c) at warp factor `w`. Warp ≥ 10 is infinite; below 1 the same power law. */
export function warpToC(w) {
  if (!(w > 0)) return 0;
  if (w <= 9) return Math.pow(w, 10 / 3);
  if (w >= 10) return Infinity;
  const x = -LOG10(10 - w);
  let i = 0;
  while (i < ANCHORS.length - 2 && x > ANCHORS[i + 1][0]) i++;
  const [x0, y0] = ANCHORS[i], [x1, y1] = ANCHORS[i + 1];
  return Math.pow(10, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)); // beyond 9.9999: the last segment's slope
}

/** Warp factor for a speed in multiples of c (the inverse of warpToC). */
export function cToWarp(c) {
  if (!(c > 0)) return 0;
  if (!Number.isFinite(c)) return 10;
  const lc = LOG10(c);
  if (lc <= ANCHORS[0][1]) return Math.pow(c, 3 / 10);
  let i = 0;
  while (i < ANCHORS.length - 2 && lc > ANCHORS[i + 1][1]) i++;
  const [x0, y0] = ANCHORS[i], [x1, y1] = ANCHORS[i + 1];
  const x = x0 + ((lc - y0) * (x1 - x0)) / (y1 - y0);
  return 10 - Math.pow(10, -x);
}

// ---- relativity ----------------------------------------------------------------------------------
/** Lorentz factor γ for speed β = v / c (< 1). */
export const gamma = (beta) => (beta >= 1 ? Infinity : 1 / Math.sqrt(1 - beta * beta));

/** A trip of `distKm` at a constant `vKmS`: { earthS, shipS, gamma } (ship = proper time, sublight only). */
export function tripAtSpeed(distKm, vKmS) {
  const earthS = distKm / vKmS, beta = vKmS / C_KM_S;
  const g = beta < 1 ? gamma(beta) : null;
  return { earthS, shipS: g ? earthS / g : null, gamma: g };
}

/**
 * A trip of `distKm` that accelerates at constant proper acceleration `accelMS2` up to β `betaMax`,
 * coasts, then decelerates the same way (relativistic rocket, Rindler): { earthS, shipS, peakBeta }.
 * If the trip is too short to reach betaMax, it flips at the midpoint.
 */
export function burnCoastBurn(distKm, betaMax, accelMS2 = 9.80665) {
  const c = C_KM_S * 1000, a = accelMS2, D = distKm * 1000;
  const phiMax = Math.atanh(Math.min(betaMax, 1 - 1e-15));
  const xBurn = (c * c / a) * (Math.cosh(phiMax) - 1); // distance to reach betaMax
  if (2 * xBurn >= D) {
    const phi = Math.acosh(1 + (a * D / 2) / (c * c));
    return { earthS: 2 * (c / a) * Math.sinh(phi), shipS: 2 * (c / a) * phi, peakBeta: Math.tanh(phi) };
  }
  const coast = D - 2 * xBurn, v = c * betaMax;
  return { earthS: 2 * (c / a) * Math.sinh(phiMax) + coast / v, shipS: 2 * (c / a) * phiMax + (coast / v) / gamma(betaMax), peakBeta: betaMax };
}

// ---- real and imagined propulsion ----------------------------------------------------------------
// Straight-line, constant-speed comparisons: real missions follow transfer orbits and gravity assists,
// so these say how fast each technology is, not how a mission would fly. Sources in docs/data-sources.md.
export const PROPULSION = [
  { id: 'light', label: 'LIGHT', kmS: C_KM_S, tier: 'computed', detail: 'The speed of light in vacuum, 299,792.458 km/s (exact, by definition of the metre). Nothing with mass reaches it.' },
  { id: 'chemical', label: 'CHEMICAL · VOYAGER 1', kmS: 17, tier: 'computed', detail: 'Voyager 1 leaves the Solar System at ~17 km/s (NASA/JPL mission status), after Jupiter and Saturn gravity assists: the fastest outbound craft from chemical rockets.' },
  { id: 'ion', label: 'ION DRIVE · DAWN-CLASS', kmS: 11, tier: 'computed', detail: 'Assumes a cruise of ~11 km/s: the total Δv Dawn\'s xenon ion engines delivered over 11 years (NASA/JPL), a record for a spacecraft\'s own propulsion. Ion drives are efficient but push gently.' },
  { id: 'orion', label: 'NUCLEAR PULSE · PROJECT ORION', kmS: 0.033 * C_KM_S, tier: 'computed', detail: 'Assumes 3.3% of c (~10,000 km/s): Freeman Dyson\'s 1968 estimate for an interstellar Orion propelled by hydrogen-bomb pulses (Physics Today 21(10), 41). Never built; banned in space by the 1963 Partial Test Ban Treaty.' },
  { id: 'starshot', label: 'BREAKTHROUGH STARSHOT', kmS: 0.2 * C_KM_S, tier: 'computed', detail: 'Assumes 0.2 c: gram-scale light-sail probes pushed by a ground laser array (Breakthrough Initiatives, 2016). Only for chips weighing grams, with no way to stop at the far end.' },
];
/** The USS Fidelity's full impulse (canon-style quarter light speed; the ship is IMAGINED, its time dilation COMPUTED). */
export const FULL_IMPULSE_C = 0.25;

/** Honest trip times for a distance: real propulsion, light, relativistic impulse and warp. */
export function honestTrip(distKm, { warp = 9 } = {}) {
  const rows = PROPULSION.map((p) => ({ ...p, ...tripAtSpeed(distKm, p.kmS) }));
  const imp = tripAtSpeed(distKm, FULL_IMPULSE_C * C_KM_S);
  const w = warpToC(warp);
  return { distKm, rows, impulse: { beta: FULL_IMPULSE_C, ...imp }, warp: { factor: warp, c: w, earthS: distKm / (w * C_KM_S) } };
}

// ---- the helm: throttle, regimes, read-outs ------------------------------------------------------
/** Speed regimes: MANOEUVRING (≤ 100 km/s, near planets and stations), IMPULSE (≤ 0.25 c), WARP (≥ warp 1). */
export function regime(kmS) {
  if (kmS >= C_KM_S * 0.999) return 'warp';
  if (kmS > 100) return 'impulse';
  return kmS > 0 ? 'manoeuvring' : 'stopped';
}

/**
 * The throttle t ∈ [0, 1]: 0 is FULL STOP; up to 0.5 the speed climbs logarithmically from 1 m/s to
 * full impulse (0.25 c); from 0.5 to 1 the warp factor climbs from 1 to 9.99.
 */
export const THROTTLE_IMPULSE = 0.5;
export function throttleToSpeed(t) {
  if (!(t > 0)) return { kmS: 0, warp: 0 };
  if (t < THROTTLE_IMPULSE) {
    const lo = -3, hi = LOG10(FULL_IMPULSE_C * C_KM_S);
    return { kmS: Math.pow(10, lo + ((hi - lo) * t) / THROTTLE_IMPULSE), warp: 0 };
  }
  const w = 1 + ((Math.min(1, t) - THROTTLE_IMPULSE) / (1 - THROTTLE_IMPULSE)) * 8.99;
  return { kmS: warpToC(w) * C_KM_S, warp: w };
}
/** The throttle setting that gives speed `kmS` (inverse of throttleToSpeed; between 0.25 c and c it rounds to warp 1). */
export function speedToThrottle(kmS) {
  if (!(kmS > 0)) return 0;
  const lo = -3, hi = LOG10(FULL_IMPULSE_C * C_KM_S);
  if (kmS <= FULL_IMPULSE_C * C_KM_S) return Math.max(1e-4, ((LOG10(kmS) - lo) / (hi - lo)) * THROTTLE_IMPULSE);
  const w = Math.max(1, cToWarp(kmS / C_KM_S));
  return Math.min(1, THROTTLE_IMPULSE + ((w - 1) / 8.99) * (1 - THROTTLE_IMPULSE));
}

/** Autopilot cruise: the slowest regime that crosses `distKm` in about `targetS` seconds (impulse or a warp factor ≤ 9.9). */
export function autoCruise(distKm, targetS = 20) {
  const need = distKm / targetS;
  if (need <= FULL_IMPULSE_C * C_KM_S) return { kmS: Math.max(need, 0.5), warp: 0 };
  const w = Math.min(9.9, Math.max(1, Math.ceil(cToWarp(need / C_KM_S) * 10) / 10));
  return { kmS: warpToC(w) * C_KM_S, warp: w };
}

// ---- formatting ----------------------------------------------------------------------------------
const n = (v, d) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

/** A duration in seconds: "0.8 S", "12.4 MIN", "5.2 H", "212 DAYS", "21.8 YEARS", "1.3 MILLION YEARS". */
export function fmtDuration(s) {
  if (!Number.isFinite(s)) return '∞';
  if (s < 1) return `${n(s * 1000, 0)} MS`;
  if (s < 120) return `${n(s, s < 10 ? 2 : 1)} S`;
  if (s < 7200) return `${n(s / 60, 1)} MIN`;
  if (s < 2 * 86400) return `${n(s / 3600, 1)} H`;
  const y = s / YEAR_S;
  if (y < 2) return `${n(s / 86400, 0)} DAYS`;
  if (y < 1e6) return `${n(y, y < 100 ? 1 : 0)} YEARS`;
  return `${n(y / 1e6, 1)} MILLION YEARS`;
}

/** A distance in km: "380 M", "412 KM", "1.52 AU", "4.37 LY". */
export function fmtDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${n(km * 1000, 0)} M`;
  if (km < 1e7) return `${n(km, km < 100 ? 1 : 0)} KM`;
  if (km < 0.05 * LY_KM) return `${n(km / AU_KM, km < 10 * AU_KM ? 3 : 1)} AU`;
  return `${n(km / LY_KM, 2)} LY`;
}

/** A speed in km/s: "3.2 M/S", "7.66 KM/S", "74,948 KM/S", "1,516 c". */
export function fmtSpeed(kmS) {
  if (kmS <= 0) return '0 M/S';
  if (kmS < 1) return `${n(kmS * 1000, kmS < 0.01 ? 1 : 0)} M/S`;
  if (kmS < C_KM_S * 0.999) return `${n(kmS, kmS < 100 ? 2 : 0)} KM/S`;
  const c = kmS / C_KM_S;
  return `${n(c, c < 10 ? 2 : 0)} c`;
}
