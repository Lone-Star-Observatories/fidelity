// How a star's photosphere looks in the spectrum filter's band (#28), for the Star View: the same
// rules as the System View's star (SystemView applyStarBand), worked out by wavelength so a custom
// transmission curve (#66) works too.
//   1. The Sun, a real image in this band (BODY_BAND.sun: SDO via Helioviewer, NoRH)      MEASURED
//   2. The Sun's measured emission where its blackbody says "nothing" (SUN_SIGNATURES)   MODELLED sketch
//   3. A blackbody at T_eff through the filter, relative to V (Vega system)               COMPUTED
//   4. NOT OBSERVED IN THIS BAND where a photosphere emits essentially nothing.

import { bodyBandSource, BODY_BAND } from '../../data/bands.js';
import { effectiveNm } from '../../astro/bands.js';
import { starBandDelta, paletteIndex, SUN_SIGNATURES } from './bandskin.js';

/** False-colour tint per palette index (asis, radio, microwave, infrared, visible, ultraviolet, xray, gamma). */
export const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];

/** Which of the Sun's measured signatures covers `nm`: gamma (< 0.01 nm), microwave (1 mm–3 cm), radio (> 3 cm). */
export const sunSignatureKey = (nm) => (nm == null ? null : nm < 0.01 ? 'gamma' : nm >= 3e7 ? 'radio' : nm >= 1e6 ? 'microwave' : null);

/** The Sun's real image for this band: by bandpass/band id, else a map whose `range` covers the effective wavelength. */
export function sunBandSource(band, pass) {
  const byId = bodyBandSource('sun', band, pass);
  if (byId) return byId;
  const nm = pass?.filter ? effectiveNm(pass.filter) : null;
  if (nm == null) return null;
  return Object.values(BODY_BAND.sun ?? {}).find((s) => s.range && nm >= s.range[0] * 0.8 && nm <= s.range[1] * 1.25) ?? null;
}

/**
 * The look of a star in this band: null in full spectrum, else { tint: [r, g, b], feed?, mode, tier,
 * label, detail }. `feed` names a live/archival image to show as-is on the Earth-facing disc (`noFeeds`:
 * the standalone preview, which has no backend to fetch one).
 */
export function starBandLook({ teff = 5772, isSun = false, noFeeds = false } = {}, band, pass) {
  if (!band || band.id === 'full') return null;
  const tint = PAL_RGB[paletteIndex(band.palette)];
  const src = isSun && !noFeeds ? sunBandSource(band, pass) : null;
  if (src?.feed) return { tint: [1, 1, 1], feed: src.feed, mode: 'real', tier: 'measured', label: src.note ?? 'REAL IMAGE IN THIS BAND', detail: src.credit };
  const nm = pass?.filter ? effectiveNm(pass.filter) : null;
  const sig = isSun ? SUN_SIGNATURES[band.id] ?? SUN_SIGNATURES[sunSignatureKey(nm)] : null;
  if (sig) return { tint: tint.map((c) => c * sig.gain), mode: 'glow', tier: 'modelled', label: sig.label, detail: sig.why };
  const d = starBandDelta(teff, pass);
  if (d === -Infinity) return { tint: [0.02, 0.02, 0.02], mode: 'dark', tier: 'computed', label: 'NOT OBSERVED IN THIS BAND',
    detail: `A ${Math.round(teff)} K photosphere emits almost nothing in ${pass?.label ?? band.label}; no image or measured flux of this star is available here.` };
  const k = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
  return { tint: tint.map((c) => c * k), delta: d, mode: 'computed', tier: 'computed', label: `${d >= 0 ? 'BRIGHTER' : 'FAINTER'} BY ${Math.abs(d).toFixed(1)} MAG THAN IN V`,
    detail: `A ${Math.round(teff)} K blackbody through ${pass?.label}, relative to the V band in the Vega system (COMPUTED). Display brightness compressed.` };
}
