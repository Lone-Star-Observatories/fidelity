// Planetshine (#49): sunlight reflected by a planet onto its moons' night sides. Pure maths.
//
// Illuminance on the moon from the planet, as a fraction of the direct sunlight the moon receives
// (the Sun is effectively equidistant from both):  E/E☉ = p · (R/d)² · Φ(α), with p the planet's
// geometric albedo, R its radius, d the planet–moon distance, α the phase angle at the planet
// (Sun–planet–moon) and Φ the Lambert phase law Φ(α) = [sin α + (π − α) cos α] / π (Φ(0) = 1).
// Earthshine at "full Earth" (new Moon) comes out ≈ 1.0 × 10⁻⁴ of sunlight, as measured by the
// Big Bear Solar Observatory earthshine project (Qiu et al. 2003; Pallé et al. 2003, apparent
// albedo p* ≈ 0.30), and it is bluish: Earth's spectrum is dominated by Rayleigh scattering and
// the oceans (Arnold et al. 2002; Sterzik et al. 2012).

/** Geometric (visual) albedo, tint of the reflected light (linear RGB, max 1) and source, per planet. */
export const PLANETSHINE = {
  earth: { p: 0.367, tint: [0.62, 0.78, 1.0], name: 'EARTHSHINE', source: 'Geometric albedo 0.367 (NASA fact sheet); colour: Rayleigh-scattered, ocean-dominated earthlight (Arnold et al. 2002; Sterzik et al. 2012)' },
  mars: { p: 0.170, tint: [1.0, 0.66, 0.46], name: 'MARSSHINE', source: 'Geometric albedo 0.170 (NASA fact sheet)' },
  jupiter: { p: 0.538, tint: [1.0, 0.91, 0.78], name: 'JUPITERSHINE', source: 'Geometric albedo 0.538 (NASA fact sheet)' },
  saturn: { p: 0.499, tint: [1.0, 0.93, 0.76], name: 'SATURNSHINE', source: 'Geometric albedo 0.499 (NASA fact sheet); rings not included' },
  uranus: { p: 0.488, tint: [0.72, 0.95, 1.0], name: 'URANUSSHINE', source: 'Geometric albedo 0.488 (NASA fact sheet)' },
  neptune: { p: 0.442, tint: [0.55, 0.72, 1.0], name: 'NEPTUNESHINE', source: 'Geometric albedo 0.442 (NASA fact sheet)' },
  pluto: { p: 0.52, tint: [1.0, 0.9, 0.78], name: 'PLUTOSHINE', source: 'Geometric albedo ~0.52 (New Horizons, Buratti et al. 2017)' },
};

/** Lambert phase law, Φ(0) = 1. */
export const lambertPhase = (alpha) => (Math.sin(alpha) + (Math.PI - alpha) * Math.cos(alpha)) / Math.PI;

/** Planetshine on a moon as a fraction of direct sunlight there. */
export const planetshineFraction = (p, radiusKm, distKm, alpha) => p * (radiusKm / distKm) ** 2 * lambertPhase(Math.max(0, Math.min(Math.PI, alpha)));

/** Angle (radians) between two 3-vectors. */
export const angleBetween = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], n = Math.hypot(...a) * Math.hypot(...b);
  return n ? Math.acos(Math.max(-1, Math.min(1, d / n))) : 0;
};

/** Illuminated fraction of a disc at phase angle α (Sun–body–observer): (1 + cos α) / 2. */
export const litFraction = (alpha) => (1 + Math.cos(alpha)) / 2;

/**
 * On-screen brightness for a planetshine fraction. The eye adapts to a night side (earthshine is
 * plain to see beside a crescent 10,000 times brighter), a screen cannot show both, so the display
 * compresses: 4% of full brightness at earthshine's 10⁻⁴, +3% per decade, between 1% and 16%.
 */
export const planetshineDisplay = (f) => (f > 0 ? Math.max(0.01, Math.min(0.16, 0.04 + 0.03 * Math.log10(f / 1e-4))) : 0);
