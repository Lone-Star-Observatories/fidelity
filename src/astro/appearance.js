// Geometric constraints for hypothetical observer images. Colours are broad guides,
// not calibrated spectral rendering of atmosphere, material BRDF or visual adaptation.
import { blackbodyRGB } from './frames.js';
const AU_KM = 149597870.7;
const SUN_RADIUS_KM = 695700; // IAU nominal solar radius
export function skyGeometry({ radiusSun, temperatureK, distanceAU, horizontalFovDeg = 60 }) {
  if (![radiusSun, temperatureK, distanceAU, horizontalFovDeg].every(Number.isFinite)
      || radiusSun <= 0 || temperatureK <= 0 || distanceAU <= 0 || horizontalFovDeg <= 0 || horizontalFovDeg >= 180) {
    throw new RangeError('Positive finite stellar values and a field of view below 180° are required.');
  }
  const ratio = radiusSun * SUN_RADIUS_KM / (distanceAU * AU_KM);
  if (ratio >= 1) throw new RangeError('Observer must be outside the photosphere.');
  const diameter = 2 * Math.asin(ratio);
  return {
    angularDiameterDeg: diameter * 180 / Math.PI,
    centreDiscWidthFraction: Math.tan(diameter / 2) / Math.tan(horizontalFovDeg * Math.PI / 360),
    irradianceEarth: radiusSun ** 2 * (temperatureK / 5772) ** 4 / distanceAU ** 2,
    approximateSrgb: blackbodyRGB(temperatureK),
    horizontalFovDeg,
    limits: 'Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation.',
  };
}
