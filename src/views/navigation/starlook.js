// How a star is drawn in the Navigation View: size from luminosity in the current spectrum band,
// colour from its temperature (or the band's false colour). Shared by the chart's stars and the
// deep-time arrivals so both agree, and by the band rule of bandstate.js so the chart agrees with
// the System View's sky: a star's band brightness is its V magnitude shifted by Δmag (COMPUTED).

import { starTeff, blackbodyRGB } from '../../astro/frames.js';
import { bandStarLook } from '../../data/bandstate.js';

export const MIN_PX = 6, MAX_PX = 22, DARK_PX = 8;

/**
 * Point size (CSS px) for absolute magnitude `absmag`, `dMag` brighter in the band than in V.
 * Never below MIN_PX: most stars near the Sun are M dwarfs (M ≈ 12–16) and must still read on the chart.
 */
export function starSize(absmag, dMag = 0) {
  const M = (absmag ?? 12) - (Number.isFinite(dMag) ? dMag : 0);
  return Math.max(MIN_PX, Math.min(MAX_PX, 14 - 0.5 * M));
}

/** { rgb, size, dark } for a catalogue star in the current band; `dark` draws a hollow NOT OBSERVED marker. */
export function navStarLook(star) {
  const t = starTeff(star).teff;
  const { rgb, dMag, dark } = bandStarLook(t, blackbodyRGB(t));
  if (dark) return { rgb: [0.45, 0.5, 0.6], size: DARK_PX, dark: true };
  return { rgb, size: starSize(star.absmag, dMag), dark: false };
}
