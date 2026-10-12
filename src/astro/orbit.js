// Helm REAL PHYSICS (#42): gravity from a list of point masses, velocity-Verlet steps, state vectors
// → orbital elements and swept collision tests. Pure and tested (tests/orbit.test.js). Units: km, s,
// km³/s² (GM). G is CODATA 2018; GM is G × the body's mass from the app's own data (COMPUTED).

export const G_SI = 6.6743e-11; // m³ / (kg s²), CODATA 2018
export const G_KM = G_SI * 1e-9; // km³ / (kg s²)
/** GM (km³/s²) from a mass in kg. */
export const gmOf = (massKg) => (massKg > 0 ? G_KM * massKg : 0);

/**
 * Gravitational acceleration (km/s²) at `p` from `bodies` ({ pos: [x, y, z] km, gm, radius? km }).
 * Inside a body's radius the pull falls off linearly to the centre (a uniform sphere), so a step that
 * ends inside a world never meets a singularity. Adds into `out` (zeroed first) and returns it.
 */
export function gravAccel(p, bodies, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (const b of bodies) {
    if (!(b.gm > 0)) continue;
    const dx = b.pos[0] - p[0], dy = b.pos[1] - p[1], dz = b.pos[2] - p[2];
    const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
    if (r === 0) continue;
    const R = b.radius ?? 0;
    const k = r >= R ? b.gm / (r2 * r) : b.gm / (R * R * R);
    out[0] += k * dx; out[1] += k * dy; out[2] += k * dz;
  }
  return out;
}

/**
 * One velocity-Verlet (kick–drift–kick) step of `dt` seconds. `state` = { pos: [km], vel: [km/s] } is
 * updated in place; `acc(pos, t)` returns km/s² at time t (seconds from the start of the step).
 * Symplectic, so a bound orbit keeps its energy over many periods. Returns the state.
 */
export function verletStep(state, dt, acc, t0 = 0, a0 = null) {
  const a = a0 ?? acc(state.pos, t0);
  const v = state.vel, p = state.pos;
  for (let k = 0; k < 3; k++) { v[k] += 0.5 * dt * a[k]; p[k] += dt * v[k]; }
  const a1 = acc(p, t0 + dt);
  for (let k = 0; k < 3; k++) v[k] += 0.5 * dt * a1[k];
  state.acc = [a1[0], a1[1], a1[2]];
  return state;
}

/** Specific orbital energy (km²/s²) of a state relative to a body of `gm`. */
export const orbitalEnergy = (r, v, gm) => 0.5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) - gm / Math.hypot(r[0], r[1], r[2]);

/**
 * Orbital elements from a state vector relative to a body of `gm` (km, km/s, km³/s²):
 * { a (km; negative on a hyperbola), e, periapsis, apoapsis (km from the centre; Infinity unbound),
 *   periodS (null unbound), energy, bound, escapeKmS (at this radius), inclination (rad, to the frame's z) }.
 */
export function stateToElements(r, v, gm) {
  const rm = Math.hypot(r[0], r[1], r[2]);
  const v2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const energy = 0.5 * v2 - gm / rm;
  const h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hm = Math.hypot(...h);
  const rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  // eccentricity vector e = ((v² − μ/r) r − (r·v) v) / μ
  const ev = [0, 1, 2].map((k) => ((v2 - gm / rm) * r[k] - rv * v[k]) / gm);
  const e = Math.hypot(...ev);
  const bound = energy < 0 && e < 1;
  const a = energy !== 0 ? -gm / (2 * energy) : Infinity;
  const p = (hm * hm) / gm; // semi-latus rectum
  const periapsis = p / (1 + e);
  const apoapsis = bound ? p / (1 - e) : Infinity;
  const periodS = bound ? 2 * Math.PI * Math.sqrt(a ** 3 / gm) : null;
  return { a, e, periapsis, apoapsis, periodS, energy, bound, escapeKmS: Math.sqrt((2 * gm) / rm), inclination: hm > 0 ? Math.acos(Math.max(-1, Math.min(1, h[2] / hm))) : 0 };
}

/** Circular orbital speed (km/s) at radius r (km) about a body of `gm`. */
export const circularSpeed = (gm, r) => Math.sqrt(gm / r);

/**
 * Where the segment p0 → p1 first enters the sphere (centre c, radius R): the fraction t ∈ [0, 1], or
 * null if it never does (a start already inside counts as t = 0). Catches a fast step that would jump
 * clean through a world.
 */
export function segmentHitsSphere(p0, p1, c, R) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
  const fx = p0[0] - c[0], fy = p0[1] - c[1], fz = p0[2] - c[2];
  const C = fx * fx + fy * fy + fz * fz - R * R;
  if (C <= 0) return 0;
  const A = dx * dx + dy * dy + dz * dz;
  if (A === 0) return null;
  const B = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * The body whose gravity dominates at `p`: the smallest sphere of influence (Laplace, r = a (m/M)^0.4
 * about its parent) that contains the point, else the root (the star). `bodies`: { id, pos, gm,
 * parentPos?, parentGm? }; the root has no parent. Returns the id.
 */
export function dominantBody(p, bodies, rootId) {
  let best = rootId, bestSoi = Infinity;
  for (const b of bodies) {
    if (!(b.gm > 0) || !b.parentPos || !(b.parentGm > 0)) continue;
    const a = Math.hypot(b.pos[0] - b.parentPos[0], b.pos[1] - b.parentPos[1], b.pos[2] - b.parentPos[2]);
    const soi = a * Math.pow(b.gm / b.parentGm, 0.4);
    const d = Math.hypot(p[0] - b.pos[0], p[1] - b.pos[1], p[2] - b.pos[2]);
    if (d < soi && soi < bestSoi) { best = b.id; bestSoi = soi; }
  }
  return best;
}
