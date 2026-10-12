// The USS Fidelity between views (#42). One ship: the System View's helm keeps its precise state relative
// to the nearest body (km and AU in the ecliptic scene); out between the stars the Navigation, Quadrant
// and Galaxy views fly it from this shared record, in light-years in the IAU galactic frame relative to
// Sol (today's positions: deep time moves the stars, not the ship). Hand-overs convert between the two.
// The log, the distance travelled and the ship's clocks live here too, so they survive the view changes
// (this session only). Pure apart from the shared object; the frame maths is tested (tests/shipstate.test.js).

import { eqToGal, galToEq, eqToEcl, frameToScene, OBLIQUITY, LY_PER_PC, AU_PER_LY } from '../../astro/frames.js';

/** Ecliptic → equatorial (J2000): the inverse of eqToEcl. */
export function eclToEq([x, y, z]) {
  const c = Math.cos(OBLIQUITY), s = Math.sin(OBLIQUITY);
  return [x, y * c - z * s, y * s + z * c];
}
/** Scene axes → frame axes: the inverse of frameToScene ([x, y, z] → [x, z, −y]). */
export const sceneToFrame = ([x, y, z]) => [x, -z, y];
/** A System View scene vector (ecliptic, scene axes) → the galactic frame. */
export const eclSceneToGal = (v) => eqToGal(eclToEq(sceneToFrame(v)));
/** A galactic-frame vector → System View scene axes (ecliptic). */
export const galToEclScene = (v) => frameToScene(eqToEcl(galToEq(v)));
/** Galactic frame → the galaxy-scale views' scene axes (Navigation, Quadrant, Galaxy share them). */
export const galToScene = (v) => frameToScene(v);
/** Galaxy-scale scene axes → galactic frame. */
export const sceneToGal = (v) => sceneToFrame(v);
/** A catalogue star (J2000 equatorial parsecs x, y, z; Sol at the origin) → heliocentric galactic light-years. */
export const starGalLy = (s) => eqToGal([(s?.x ?? 0) * LY_PER_PC, (s?.y ?? 0) * LY_PER_PC, (s?.z ?? 0) * LY_PER_PC]);
/**
 * The rotation from galaxy-scale scene axes to System View scene axes as a column-major 3×3 (three column
 * vectors): column i is where the galaxy scene's axis i points in the System View. Apply it to a ship
 * attitude when it changes hands (the System View's axes are ecliptic, the others galactic).
 */
export function galSceneToEclSceneBasis() {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => galToEclScene(sceneToGal(e)));
}

export { AU_PER_LY };
// ---- hand-over distances ---------------------------------------------------------------------------
/** The edge of a star system for the helm (AU): a few hundred AU, or beyond the widest survey framing. */
export function systemEdgeAU(model) {
  const au = Math.max(0, ...(model?.survey ?? []).map((s) => s.au ?? 0));
  return Math.max(200, au * 1.15);
}
/** In the Navigation View a catalogue star captures the ship within this distance (ly ≈ 1,265 AU). */
export const CAPTURE_LY = 0.02;
/** ...but the star just left only once the ship has been this far from it (no instant recapture). */
export const ARM_LY = 0.03;
/** Arrival standoff (ly) for a course to a star: drop out ~630 AU out and hand over to its System View. */
export const STAR_STANDOFF_LY = 0.01;
/** Quadrant → Navigation: a charted star within this distance of a stopped or arriving ship. */
export const NAV_DOWN_LY = 50;
/** Galaxy → Quadrant: within this fraction of the Quadrant View's radius of Sol (it is Sol-centred only). */
export const QUADRANT_DOWN_FRAC = 0.9;

// ---- simulation speed-up (a viewing aid, IMAGINED): flight seconds per real second ---------------------
export const SIM_SPEEDS = [[1, '×1 · REAL TIME'], [60, '1 MIN/S'], [3600, '1 H/S'], [86400, '1 DAY/S'], [604800, '1 WEEK/S'], [2629800, '1 MONTH/S'], [31557600, '1 YEAR/S'], [315576000, '10 YEARS/S']];
/** The smallest speed-up that lets a flight of `flightS` seconds be watched in about `watchS` real seconds. */
export function autoSim(flightS, watchS = 25) {
  if (!(flightS > 0)) return 1;
  for (const [k] of SIM_SPEEDS) if (flightS / k <= watchS) return k;
  return SIM_SPEEDS.at(-1)[0];
}
export const simLabel = (k) => SIM_SPEEDS.find(([x]) => x === k)?.[1] ?? `×${Math.round(k).toLocaleString('en-US')}`;

// ---- the shared ship ---------------------------------------------------------------------------------
export const shipState = {
  /** 'system' (the System View's helm has it), 'deep' (a galaxy-scale view flies it) or null (nobody at the helm). */
  frame: null,
  /** Heliocentric galactic position, light-years (today's frame). */
  gal: [0, 0, 0],
  /** Attitude in galaxy-scale scene axes, a quaternion [x, y, z, w]. */
  quat: [0, 0, 0, 1],
  kmS: 0, // speed along the nose (IMPULSE / WARP)
  vel: [0, 0, 0], // km/s, galactic scene axes (REAL PHYSICS: no gravity out here)
  model: 'impulse', thrustG: 1, throttle: 0, view: 'chase', cruise: 'auto', sim: 'auto',
  /** { kind: 'star' | 'object' | 'region', id, name, gal (ly), standoffLy, handDown } */
  course: null,
  /** A course to lay in when the next galaxy-scale view takes the ship (a target as above). */
  pendingCourse: null,
  /** The star system just left: it does not recapture the ship until it has been ARM_LY away. */
  departed: null, departedArmed: false,
  /** A hand-down in progress: { star, fromGal (unit, galactic: where the ship comes from), manual, quat, kmS }. */
  arrival: null,
  // the ship's log (this session)
  log: [], travelledKm: 0, earthS: 0, shipS: 0, visited: new Set(),
};
export function logEntry(text) {
  shipState.log.push({ at: new Date(), text });
  if (shipState.log.length > 80) shipState.log.shift();
}
