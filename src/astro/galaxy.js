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


// ---- galactic dynamics (#18) -------------------------------------------------------------------
// A flat rotation curve with a soft core: v(R) = Vc·R/√(R² + Rc²). Good enough to show how
// the disc shears over millions of years; real stars also wobble (epicycles), which we ignore.
export const VC_KMS = 233;             // circular speed near the Sun (Eilers et al. 2019 ≈ 229–233)
export const KMS_KLY_PER_MYR = 3.3356e-3; // 1 km/s for 1 Myr, in kly
export const CORE_KLY = 1.5;
/** Angular speed of circular orbits at radius R (kly), radians per Myr. */
export const omega = (R) => (VC_KMS * KMS_KLY_PER_MYR) / Math.hypot(R, CORE_KLY);
export const OMEGA_SUN = omega(R0_KLY);
/** Spiral pattern speed: 28.2 km/s/kpc (Dias et al. 2019), radians per Myr. */
export const OMEGA_PATTERN = (28.2 * KMS_KLY_PER_MYR) / 3.26156;
export const GALACTIC_YEAR_MYR = (2 * Math.PI) / OMEGA_SUN;
/**
 * Rotation about the galactic north pole (scene +y) after t Myr for a body at radius R.
 * The disc turns clockwise seen from the north (towards l = 90° at the Sun, scene −z), so the
 * angle about +y is −Ω·t.
 */
export const rotationAngle = (R, tMyr) => -omega(R) * tMyr;

// Satellite galaxies: galactocentric position (kpc) and velocity (km/s), axes parallel to the
// heliocentric galactic frame (X from the Sun towards the centre, Y towards l = 90°, Z north).
export const SATELLITE_ORBITS = [
  { id: 'lmc', name: 'LARGE MAGELLANIC CLOUD', pos: [-1, -41, -28], vel: [-57, -226, 221], diameterKly: 32, texture: 'lmc', ref: 'Kallivayalil et al. 2013 (HST proper motions)' },
  { id: 'smc', name: 'SMALL MAGELLANIC CLOUD', pos: [15, -36, -43], vel: [19, -153, 153], diameterKly: 19, texture: 'smc', ref: 'Kallivayalil et al. 2013 (HST proper motions)' },
  { id: 'sgr', name: 'SAGITTARIUS DWARF', pos: [17.5, 2.5, -6.5], vel: [237.9, -24.3, 209.0], diameterKly: 10, texture: null, ref: 'Law & Majewski 2010' },
];
const KPC_PER_MYR = 1.0227e-3; // 1 km/s in kpc/Myr

/**
 * Integrate an orbit in the logarithmic halo Φ = ½Vc² ln(r² + rc²) with leapfrog, both
 * backwards and forwards. Returns samples every `stepMyr` from −spanMyr to +spanMyr (kpc).
 * No dynamical friction or LMC–SMC pull, so this is a sketch of the orbit, not a forecast.
 */
export function integrateOrbit(pos, vel, { spanMyr = 2000, dtMyr = 0.5, stepMyr = 10, rcKpc = 1 } = {}) {
  const vc2 = (VC_KMS * KPC_PER_MYR) ** 2;
  const acc = (p) => { const k = -vc2 / (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 + rcKpc ** 2); return [k * p[0], k * p[1], k * p[2]]; };
  const run = (dir) => {
    const p = [...pos], v = vel.map((x) => x * KPC_PER_MYR), out = [[...p]], dt = dir * dtMyr, every = Math.round(stepMyr / dtMyr);
    let a = acc(p);
    for (let i = 1; i <= spanMyr / dtMyr; i++) {
      for (let k = 0; k < 3; k++) { v[k] += 0.5 * dt * a[k]; p[k] += dt * v[k]; }
      a = acc(p);
      for (let k = 0; k < 3; k++) v[k] += 0.5 * dt * a[k];
      if (i % every === 0) out.push([...p]);
    }
    return out;
  };
  const back = run(-1), fwd = run(1);
  return { stepMyr, spanMyr, points: [...back.slice(1).reverse(), ...fwd] };
}
/** Position (kpc) on an integrated orbit at time t (Myr), linearly interpolated and clamped. */
export function orbitAt(orbit, tMyr) {
  const { points, stepMyr, spanMyr } = orbit;
  const f = (Math.max(-spanMyr, Math.min(spanMyr, tMyr)) + spanMyr) / stepMyr;
  const i = Math.min(points.length - 2, Math.floor(f)), u = f - i;
  return points[i].map((x, k) => x + (points[i + 1][k] - x) * u);
}
/** Galactocentric kpc (galactic axes) → scene kly. */
export const kpcToScene = (p) => frameToScene(p).map((x) => x * 3.26156);
