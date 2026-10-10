// Apparent size and brightness from a viewpoint (#47): angular diameters, the pixels a disc covers
// at a given field of view, the field-of-view presets of the surface view, and the strength of the
// Sun's glare. Pure maths, no DOM.

const DEG = Math.PI / 180;

/** Angular diameter (degrees) of a sphere of radius `radiusKm` seen from `distKm` (centre to eye). */
export const angularDiameterDeg = (radiusKm, distKm) => (distKm > radiusKm ? (2 * Math.asin(radiusKm / distKm)) / DEG : 180);

/**
 * Radius in pixels of a disc of angular diameter `angDeg` at the centre of a perspective view with
 * vertical field `vfovDeg` on a viewport `heightPx` tall (the projection of the limb's tangent).
 */
export const discRadiusPx = (angDeg, vfovDeg, heightPx) => (heightPx / 2) * (Math.tan((angDeg / 2) * DEG) / Math.tan((vfovDeg / 2) * DEG));

/** Vertical field (camera.fov) for a horizontal field `hDeg` on a viewport of aspect w/h. */
export const verticalFov = (hDeg, aspect) => (2 * Math.atan(Math.tan((hDeg / 2) * DEG) / aspect)) / DEG;
/** Horizontal field for a vertical field `vDeg`. */
export const horizontalFov = (vDeg, aspect) => (2 * Math.atan(Math.tan((vDeg / 2) * DEG) * aspect)) / DEG;

/**
 * Field-of-view presets. `across` says which way the field is measured: cameras and the eye across
 * the wide (horizontal) side of the picture, binoculars and telescopes as their round field's
 * diameter, which fills the narrow side. Phone: 26 mm-equivalent main camera (36 × 24 mm frame:
 * 2·atan(18/26) = 69°); 50 mm lens on full frame: 2·atan(18/50) = 40°; binoculars: a 7×50's ~7°
 * true field; telescope: ~1° (a small refractor at low power).
 */
export const FOV_PRESETS = [
  { id: 'eye', label: 'NAKED EYE', deg: 50, across: 'h', note: 'The central field you take in without moving your eyes (~50°).' },
  { id: 'phone', label: 'PHONE CAMERA', deg: 69, across: 'h', note: '26 mm-equivalent main camera, landscape: 2·atan(18/26) ≈ 69° across.' },
  { id: '50mm', label: '50 MM LENS', deg: 40, across: 'h', note: '50 mm lens on a full-frame (36 × 24 mm) camera: 2·atan(18/50) ≈ 40° across.' },
  { id: 'binoculars', label: 'BINOCULARS', deg: 7, across: 'v', note: '7×50 binoculars: a ~7° round true field.' },
  { id: 'telescope', label: 'TELESCOPE', deg: 1, across: 'v', note: 'A small telescope at low power: a ~1° round field.' },
];
/** camera.fov (vertical degrees) for a preset on a viewport of aspect w/h. */
export const presetFov = (p, aspect) => (p.across === 'h' ? verticalFov(p.deg, aspect) : p.deg);

/** Relative airmass (Kasten & Young 1989) for a body `altDeg` above the horizon. */
export const airmass = (altDeg) => (altDeg <= -1 ? Infinity : 1 / (Math.sin(Math.max(altDeg, 0) * DEG) + 0.50572 * (Math.max(altDeg, 0) + 6.07995) ** -1.6364));

/**
 * Strength (0…1) of the Sun's glare halo as seen from a surface: it follows the Sun's illuminance,
 * E ∝ (1 AU / d)², dimmed by the atmosphere along the line of sight (extinction `k` mag per airmass,
 * 0.2 for Earth's clear sky at visible wavelengths, 0 without an atmosphere) and by an eclipse.
 * Each factor of ten in illuminance takes 0.15 off, so the Sun stays dazzling from Neptune (1/900 of
 * Earth's sunlight, still ~-19 mag) but its halo is smaller.
 */
export function glareStrength(distAU, altDeg, { obscuration = 0, k = 0 } = {}) {
  if (altDeg < -1 || obscuration >= 1) return 0;
  const ext = k > 0 ? 10 ** (-0.4 * k * Math.min(40, airmass(altDeg))) : 1;
  const E = (1 / (distAU * distAU)) * ext * (1 - obscuration);
  return E <= 0 ? 0 : Math.max(0, Math.min(1, 1 + 0.15 * Math.log10(E)));
}
