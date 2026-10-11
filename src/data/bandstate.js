// The current spectrum-filter band (#28), shared by every view, and how a star looks in it.
//   Since #66 the state is a transmission curve T(λ) (src/data/curve.js). currentBand() still returns
//   { band, pass, full } (plus `curve`, `custom`, `prep`): a curve that is one bandpass gives that
//   band and pass exactly as before; a custom curve gives a synthetic band
//   { id: 'custom', label: 'CUSTOM', short: 'CUSTOM', palette: <dominant band's palette>, dominant, passes: [] }
//   and pass { id: 'custom', label, filter: { points }, curve }, so every pass-based consumer works.
import { BANDS, bandById, passById } from './bands.js';
import { starBandDelta, paletteIndex } from '../views/system/bandskin.js';
import { curveFromLegacy, normCurve } from './curve.js';
import { prepare, curveStarRgb, curveStarDelta } from '../views/system/curvelook.js';

let band = BANDS[0], pass = null, curve = { full: true, parts: [], excl: [] }, prep = prepare(curve), custom = null;
const listeners = new Set();
export const currentBand = () => (custom
  ? { band: custom.band, pass: custom.pass, full: false, curve, custom: true, prep }
  : { band, pass: pass ?? band.passes[0] ?? null, full: band.id === 'full', curve, custom: false, prep });
const emit = () => { for (const fn of listeners) fn(currentBand()); };
/** Set the curve (src/data/curve.js); a single bandpass maps back onto its band and pass. */
export function setCurrentCurve(c) {
  curve = normCurve(c);
  prep = prepare(curve);
  custom = null;
  if (prep.can.kind === 'full') { band = BANDS[0]; pass = null; }
  else if (prep.can.kind === 'pass') { band = prep.can.band; pass = prep.can.pass; }
  else {
    const d = prep.desc;
    custom = { band: { id: 'custom', label: 'CUSTOM', short: 'CUSTOM', palette: d.palette ?? 'visible', dominant: d.dominant ?? 'visible', composite: !!d.composite, passes: [] },
      pass: { id: 'custom', label: d.label, filter: d.filter ?? { points: [] }, curve } };
  }
  emit();
}
/** The old setter (band id, bandpass id): the same as the curve of that one bandpass. */
export function setCurrentBand(bandId, passId) {
  const b = bandById(bandId), p = passById(b, passId);
  setCurrentCurve(curveFromLegacy(b.id, p?.id));
}
export const onBand = (fn) => (listeners.add(fn), () => listeners.delete(fn));

const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];
/**
 * A star's display colour in the current band: its usual blackbody colour in full spectrum and V;
 * otherwise the band's false colour, brightened or dimmed by its blackbody in the band relative to
 * V in the Vega system (COMPUTED); black where a photosphere emits essentially nothing (radio, X, γ).
 * A custom curve: integrated through T(λ); a wide curve gives a three-band composite colour.
 */
export function bandStarColour(teff, rgb) {
  if (custom) return curveStarRgb(teff, prep, rgb);
  const { band: b, pass: p, full } = currentBand();
  if (full || (b.id === 'visible' && p?.id === 'vis-V')) return rgb;
  const d = starBandDelta(teff, p);
  if (d === -Infinity) return [0, 0, 0];
  const k = Math.max(0.08, Math.min(1.6, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.5)));
  const t = b.id === 'visible' ? rgb : PAL_RGB[paletteIndex(b.palette)];
  return [t[0] * k, t[1] * k, t[2] * k];
}

/**
 * A star in the current band for views that encode brightness as size (Navigation): the same rule as
 * bandStarColour and the System View's sky, split into { rgb: hue at full strength (max channel 1),
 * dMag: how much brighter in this band than in V (Vega system, COMPUTED; 0 in full spectrum and V),
 * dark: true where a photosphere emits essentially nothing (radio, X-ray, gamma: NOT OBSERVED) }.
 */
export function bandStarLook(teff, rgb) {
  const { band: b, pass: p, full } = currentBand();
  if (!custom && (full || (b.id === 'visible' && p?.id === 'vis-V'))) return { rgb, dMag: 0, dark: false };
  const d = custom ? curveStarDelta(teff, prep.f) : starBandDelta(teff, p);
  if (d === -Infinity) return { rgb: [0, 0, 0], dMag: -Infinity, dark: true };
  const c = bandStarColour(teff, rgb), mx = Math.max(...c) || 1;
  return { rgb: c.map((x) => x / mx), dMag: Math.max(-6, Math.min(6, d)), dark: false };
}
