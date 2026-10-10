// The current spectrum-filter band (#28), shared by every view, and how a star looks in it.
import { BANDS, bandById, passById } from './bands.js';
import { starBandDelta, paletteIndex } from '../views/system/bandskin.js';

let band = BANDS[0], pass = null;
const listeners = new Set();
export const currentBand = () => ({ band, pass: pass ?? band.passes[0] ?? null, full: band.id === 'full' });
export function setCurrentBand(bandId, passId) {
  band = bandById(bandId); pass = passById(band, passId);
  for (const fn of listeners) fn(currentBand());
}
export const onBand = (fn) => (listeners.add(fn), () => listeners.delete(fn));

const PAL_RGB = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];
/**
 * A star's display colour in the current band: its usual blackbody colour in full spectrum and V;
 * otherwise the band's false colour, brightened or dimmed by its blackbody in the band relative to
 * V in the Vega system (COMPUTED); black where a photosphere emits essentially nothing (radio, X, γ).
 */
export function bandStarColour(teff, rgb) {
  const { band: b, pass: p, full } = currentBand();
  if (full || (b.id === 'visible' && p?.id === 'vis-V')) return rgb;
  const d = starBandDelta(teff, p);
  if (d === -Infinity) return [0, 0, 0];
  const k = Math.max(0.08, Math.min(1.6, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.5)));
  const t = b.id === 'visible' ? rgb : PAL_RGB[paletteIndex(b.palette)];
  return [t[0] * k, t[1] * k, t[2] * k];
}
