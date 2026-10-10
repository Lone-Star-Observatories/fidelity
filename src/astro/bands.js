// Spectral bands (#28): filter curves, the Planck function and band convolution.
//   Filters: SVO Filter Profile Service curves (src/data/filters.js) for the optical, UV and IR
//   bandpasses; radio, microwave and high-energy bands are top-hats in frequency or energy.
//   bandResponse(S, filter) is the photon-weighted mean of S over the filter:
//     ⟨S⟩ = ∫ S(λ) T(λ) λ dλ / ∫ T(λ) λ dλ.

import FILTERS from '../data/filters.js';

const H = 6.62607015e-34, C = 299792458, K = 1.380649e-23;
/** Planck spectral radiance B_λ(T), W m⁻² sr⁻¹ m⁻¹, at wavelength `nm`. */
export function planck(nm, T) {
  const l = nm * 1e-9, x = (H * C) / (l * K * T);
  return x > 700 ? 0 : (2 * H * C * C) / l ** 5 / Math.expm1(x);
}
/** Rayleigh–Jeans B_λ ≈ 2ckT/λ⁴ (the long-wavelength limit). */
export const rayleighJeans = (nm, T) => (2 * C * K * T) / (nm * 1e-9) ** 4;

/** A filter: { points: [[nm, T], …] } from the bundle, or a top-hat. */
export const filter = (key) => FILTERS.filters[key] ?? null;
export const topHat = (nmLo, nmHi, n = 48) => ({ points: Array.from({ length: n }, (_, i) => [nmLo * (nmHi / nmLo) ** (i / (n - 1)), 1]) });
const KEV_NM = 1.23984198; // λ(nm) = 1.2398 / E(keV)
const GHZ_NM = 299792458; // λ(nm) = 2.998e8 / ν(GHz)
export const ghz = (lo, hi) => topHat(GHZ_NM / hi, GHZ_NM / lo);
export const kev = (lo, hi) => topHat(KEV_NM / hi, KEV_NM / lo);
export const micron = (lo, hi) => topHat(lo * 1000, hi * 1000);

/** Photon-weighted mean of S(λ nm) over a filter (trapezoid rule). */
export function bandResponse(S, f) {
  const p = f.points;
  let num = 0, den = 0;
  for (let i = 1; i < p.length; i++) {
    const [l0, t0] = p[i - 1], [l1, t1] = p[i], dl = l1 - l0;
    num += 0.5 * dl * (S(l0) * t0 * l0 + S(l1) * t1 * l1);
    den += 0.5 * dl * (t0 * l0 + t1 * l1);
  }
  return den > 0 ? num / den : 0;
}
/** Band-averaged Planck radiance. */
export const planckBand = (T, f) => bandResponse((nm) => planck(nm, T), f);
/** Pivot-ish effective wavelength (nm): ∫ λ T dλ / ∫ T dλ. */
export function effectiveNm(f) {
  const p = f.points;
  let num = 0, den = 0;
  for (let i = 1; i < p.length; i++) { const dl = p[i][0] - p[i - 1][0], t = (p[i][1] + p[i - 1][1]) / 2, l = (p[i][0] + p[i - 1][0]) / 2; num += l * t * dl; den += t * dl; }
  return den ? num / den : 0;
}
/** Piecewise log-linear interpolation of [[nm, value], …] anchors (flat beyond the ends). */
export function curve(anchors) {
  return (nm) => {
    if (nm <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) if (nm <= anchors[i][0]) {
      const [a, va] = anchors[i - 1], [b, vb] = anchors[i], f = Math.log(nm / a) / Math.log(b / a);
      return va + (vb - va) * f;
    }
    return anchors.at(-1)[1];
  };
}
/**
 * Brightness of a T-kelvin blackbody in a band relative to the V band (both band-averaged),
 * expressed in magnitudes (a colour index: V − band; positive = brighter in the band).
 */
export function colourIndex(T, f) {
  const v = planckBand(T, filter('johnson-V')), b = planckBand(T, f);
  return v > 0 && b > 0 ? 2.5 * Math.log10(b / v) : -Infinity;
}
export { FILTERS };
