// Milky Way geometry and the calibration of the face-on artwork (PIA10748). Units: kly.
// Scene frame is galactocentric: Sgr A* at the origin, the galactic plane is y = 0.

import { frameToScene } from './frames.js';

export const R0_KLY = 26.67;      // Sun–galactic centre distance: 8.178 kpc (GRAVITY 2019)
export const Z_SUN_KLY = 0.068;   // Sun above the midplane: 20.8 pc (Bennett & Bovy 2019)
// Calibration of PIA10748 (5600 px), measured against PIA19341 where the Sun is marked:
// the Sun sits 0.0117 W right of and 0.1816 W below the image centre.
export const IMAGE = { sunOffset: [0.01169, 0.18158], widthKly: R0_KLY / Math.hypot(0.01169, 0.18158) };
/** Heliocentric galactic [x, y, z] (any unit) → galactocentric scene position (kly). */
export const galToScene = ([x, y, z], unitKly = 1) => {
  const [sx, sy, sz] = frameToScene([x * unitKly, y * unitKly, z * unitKly]);
  return [sx - R0_KLY, sy + Z_SUN_KLY, sz];
};
/** Map image (u right, v down; fractions from the centre) to the galactic plane (scene x, z). */
export function imageMapper(sunU, sunV) {
  // seen from galactic north: image right = +x, image up = −z; then rotate so the Sun → −x
  const bx = sunU, bz = sunV;
  const a = Math.atan2(bz, bx), target = Math.PI;
  const rot = target - a;
  return (u, v) => [u * Math.cos(rot) - v * Math.sin(rot), u * Math.sin(rot) + v * Math.cos(rot)];
}

