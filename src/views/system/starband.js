// How a star's photosphere looks in the spectrum filter's band (#28), for the Star View and the System
// View (SystemView applyStarBand): one function, so both views agree, worked out by wavelength so a
// custom transmission curve (#66) works too.
//   1. The Sun, a map in this band (BODY_BAND.sun: SDO via Helioviewer, NoRH, SRH)        MEASURED
//      or a modelled disc (`predicted: true`: the Sun below 3 GHz)                       MODELLED · PREDICTED
//      A single bandpass takes the map keyed by its id (the old rule, reproduced exactly); a custom curve
//      takes every map whose `range` overlaps it, weighted by overlap like any body (curvelook.js
//      sunCurveLook): the best-covered map is drawn, blended over the predicted tint by its share (`mix`).
//   2. The Sun's measured emission where its blackbody says "nothing" (SUN_SIGNATURES)   MODELLED sketch
//   3. A blackbody at T_eff through the filter, relative to V (Vega system)               COMPUTED
//   4. NOT OBSERVED IN THIS BAND where a photosphere emits essentially nothing.

import { bodyBandSource } from '../../data/bands.js';
import { effectiveNm } from '../../astro/bands.js';
import { support } from '../../data/curve.js';
import { starBandDelta, paletteIndex, SUN_SIGNATURES } from './bandskin.js';
import { prepare, sunCurveLook } from './curvelook.js';

/** False-colour tint per palette index (asis, radio, microwave, infrared, visible, ultraviolet, xray, gamma). */
export const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];

/** Which of the Sun's measured signatures covers `nm`: gamma (< 0.01 nm), microwave (1 mm–3 cm), radio (> 3 cm). */
export const sunSignatureKey = (nm) => (nm == null ? null : nm < 0.01 ? 'gamma' : nm >= 3e7 ? 'radio' : nm >= 1e6 ? 'microwave' : null);

/** The curve of a custom pass: its own (#66), else a window over the filter's support. */
const passCurve = (pass) => {
  if (pass?.curve) return pass.curve;
  const s = pass?.filter && support(pass.filter);
  return s ? { parts: [{ key: 'filter', lo: s[0], hi: s[1] }], excl: [] } : { parts: [], excl: [] };
};
const mapLook = (src) => ({ mode: 'real', tier: src.predicted ? 'modelled' : 'measured', predicted: !!src.predicted,
  label: src.note ?? (src.predicted ? 'MODELLED · PREDICTED DISC' : 'REAL IMAGE IN THIS BAND'), detail: src.credit });

/**
 * The Sun's look in this band, pass or custom curve: null in full spectrum, else { tint, feed?, mix, mode, tier, label,
 * detail, sources? }. `feed` is a map to draw on the Earth-facing disc and `mix` (0…1) its weight over `tint` (the
 * predicted look for the rest). `hasFeed(id)` says whether a feed can be shown (the standalone preview: only baked ones).
 */
export function sunBandLook(band, pass, { teff = 5772, hasFeed = () => true } = {}) {
  if (!band || band.id === 'full') return null;
  if (band.id === 'custom') {
    const s = sunCurveLook(prepare(passCurve(pass)), teff);
    const feed = s.feed?.feed && hasFeed(s.feed.feed) ? s.feed.feed : null;
    const look = { ...s.look };
    if (!feed && look.mode === 'real') look.mode = 'curve';
    if (s.feed?.feed && !feed) look.label += ' · MAP NEEDS THE LOCAL BACKEND';
    return { tint: s.tint, feed, mix: feed ? s.realShare : 0, predicted: !!s.feed?.predicted, ...look };
  }
  const src = bodyBandSource('sun', band, pass);
  if (src?.feed && hasFeed(src.feed)) return { tint: [1, 1, 1], feed: src.feed, mix: 1, ...mapLook(src) };
  return photosphereLook({ teff, isSun: true }, band, pass);
}

/** Signatures (the Sun) or the blackbody through the pass. */
function photosphereLook({ teff, isSun }, band, pass) {
  const tint = PAL_RGB[paletteIndex(band.palette)];
  const nm = pass?.filter ? effectiveNm(pass.filter) : null;
  const sig = isSun ? SUN_SIGNATURES[band.id] ?? SUN_SIGNATURES[sunSignatureKey(nm)] : null;
  if (sig) return { tint: tint.map((c) => c * sig.gain), mix: 0, mode: 'glow', tier: 'modelled', label: sig.label, detail: sig.why };
  const d = starBandDelta(teff, pass);
  if (d === -Infinity) return { tint: [0.02, 0.02, 0.02], mix: 0, mode: 'dark', tier: 'computed', label: 'NOT OBSERVED IN THIS BAND',
    detail: `A ${Math.round(teff)} K photosphere emits almost nothing in ${pass?.label ?? band.label}; no image or measured flux of this star is available here.` };
  const k = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
  return { tint: tint.map((c) => c * k), mix: 0, delta: d, mode: 'computed', tier: 'computed', label: `${d >= 0 ? 'BRIGHTER' : 'FAINTER'} BY ${Math.abs(d).toFixed(1)} MAG THAN IN V`,
    detail: `A ${Math.round(teff)} K blackbody through ${pass?.label}, relative to the V band in the Vega system (COMPUTED). Display brightness compressed.` };
}

/**
 * The look of a star in this band: null in full spectrum, else { tint: [r, g, b], feed?, mix, mode, tier, label, detail }.
 * `feed` names a live/archival/modelled image to show on the Earth-facing disc. `noFeeds`: the standalone preview, which
 * has no backend; `hasFeed(id)` then says which feeds it carries baked in.
 */
export function starBandLook({ teff = 5772, isSun = false, noFeeds = false, hasFeed = null } = {}, band, pass) {
  if (!band || band.id === 'full') return null;
  if (isSun) return sunBandLook(band, pass, { teff, hasFeed: hasFeed ?? (() => !noFeeds) });
  return photosphereLook({ teff, isSun: false }, band, pass);
}
