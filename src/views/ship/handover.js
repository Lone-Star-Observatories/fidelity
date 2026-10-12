// When the ship changes views (#42): pure decisions, tested in tests/shipstate.test.js. Positions are
// heliocentric galactic light-years; `vel` is the ship's direction of motion (any length, zero when stopped).
//
//   System → Navigation   past the system's edge (systemEdgeAU), heading out (helm.js checkDeparture)
//   Navigation → System   within CAPTURE_LY of a charted star (not the one just left until ARM_LY), or
//                         arriving on a course for it
//   Navigation → Quadrant beyond the sensor radius from the centre star, heading out
//   Quadrant → Navigation stopped or arriving with a charted star within NAV_DOWN_LY (centred on it), or
//                         closing on Sol within NAV_DOWN_LY
//   Quadrant → Galaxy     beyond the Quadrant View's radius of Sol, heading out
//   Galaxy → Quadrant     within QUADRANT_DOWN_FRAC of that radius of Sol, closing or stopped (the Quadrant
//                         View is Sol-centred, so far targets stay in the Galaxy View)

import { CAPTURE_LY, ARM_LY, NAV_DOWN_LY, QUADRANT_DOWN_FRAC } from './shipState.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Moving away from `c` (or at rest when `still` counts as outward). */
const outward = (pos, c, vel) => dot(sub(pos, c), vel) > 0;

/** The nearest of `stars` ({ id, gal }) to `pos`: { star, d } or null. */
export function nearestStar(pos, stars) {
  let best = null, bd = Infinity;
  for (const s of stars) { const d = len(sub(pos, s.gal)); if (d < bd) { bd = d; best = s; } }
  return best ? { star: best, d: bd } : null;
}

/**
 * Navigation View. `state` = { departed (star id or null), departedArmed (bool) }; the function updates
 * departedArmed once the ship is ARM_LY from the departed star. Returns { to: 'system', id } |
 * { to: 'quadrant' } | null.
 */
export function navDecision({ pos, vel, centreGal, radiusLy, stars, courseId = null, arrived = false, state }) {
  const dep = state?.departed && stars.find((s) => s.id === state.departed);
  if (dep && !state.departedArmed && len(sub(pos, dep.gal)) > ARM_LY) state.departedArmed = true;
  if (arrived && courseId && stars.some((s) => s.id === courseId)) return { to: 'system', id: courseId };
  let best = null, bd = CAPTURE_LY;
  for (const s of stars) {
    if (s.id === state?.departed && !state.departedArmed) continue;
    const d = len(sub(pos, s.gal));
    if (d < bd) { bd = d; best = s; }
  }
  if (best) return { to: 'system', id: best.id };
  if (len(sub(pos, centreGal)) > radiusLy && outward(pos, centreGal, vel)) return { to: 'quadrant' };
  return null;
}

/** Quadrant View (Sol-centred, `radiusLy`). Returns { to: 'galaxy' } | { to: 'navigation', id } | null. */
export function quadrantDecision({ pos, vel, radiusLy, stars, stopped = false, arrived = false }) {
  const r = len(pos);
  if (r > radiusLy && outward(pos, [0, 0, 0], vel)) return { to: 'galaxy' };
  if (r < NAV_DOWN_LY && !outward(pos, [0, 0, 0], vel) && len(vel) > 0) return { to: 'navigation', id: 'sol' };
  if (stopped || arrived) {
    const n = nearestStar(pos, stars);
    if (n && n.d < NAV_DOWN_LY) return { to: 'navigation', id: n.star.id };
  }
  return null;
}

/** Galaxy View. Returns { to: 'quadrant' } | null. */
export function galaxyDecision({ pos, vel, quadrantRadiusLy, stopped = false }) {
  if (len(pos) < quadrantRadiusLy * QUADRANT_DOWN_FRAC && (stopped || !outward(pos, [0, 0, 0], vel))) return { to: 'quadrant' };
  return null;
}
