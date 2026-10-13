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

// ---- clock jumps (#42): carry the ship along its orbit and sweep the interval for collisions ----------

const stumpC = (z) => (z > 1e-6 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-6 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 1 / 2 - z / 24 + (z * z) / 720);
const stumpS = (z) => {
  if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
  if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
  return 1 / 6 - z / 120 + (z * z) / 5040;
};
/**
 * Two-body (Kepler) propagation by universal variables: the state `dt` seconds later (or earlier, dt < 0)
 * about a body of `gm`. Ellipses, parabolas and hyperbolas alike. Returns { r, v } (km, km/s).
 */
export function keplerPropagate(r0, v0, gm, dt) {
  if (dt === 0) return { r: r0.slice(), v: v0.slice() };
  const rm = Math.hypot(...r0), vr = (r0[0] * v0[0] + r0[1] * v0[1] + r0[2] * v0[2]) / rm;
  const alpha = 2 / rm - (v0[0] ** 2 + v0[1] ** 2 + v0[2] ** 2) / gm; // 1/a
  const sq = Math.sqrt(gm);
  let x = alpha > 1e-12 ? sq * dt * alpha : Math.sign(dt) * Math.min((sq * Math.abs(dt)) / rm, Math.cbrt(6 * sq * Math.abs(dt)));
  if (alpha > 1e-12) { // an ellipse: whole orbits add nothing, so solve within one period (keeps Newton well behaved)
    const T = (2 * Math.PI) / Math.sqrt(gm * alpha ** 3);
    if (Math.abs(dt) > T) return keplerPropagate(r0, v0, gm, dt - Math.trunc(dt / T) * T);
  }
  for (let i = 0; i < 100; i++) {
    const z = alpha * x * x, C = stumpC(z), S = stumpS(z);
    const F = ((rm * vr) / sq) * x * x * C + (1 - alpha * rm) * x * x * x * S + rm * x - sq * dt;
    const dF = ((rm * vr) / sq) * x * (1 - alpha * x * x * S) + (1 - alpha * rm) * x * x * C + rm;
    let dx = F / dF;
    if (!Number.isFinite(dx)) break;
    if (Math.abs(dx) > Math.abs(x) + 1) dx = Math.sign(dx) * (Math.abs(x) + 1); // damp wild first steps on hyperbolas
    x -= dx;
    if (Math.abs(dx) < 1e-12 * Math.max(1, Math.abs(x))) break;
  }
  const z = alpha * x * x, C = stumpC(z), S = stumpS(z);
  const f = 1 - ((x * x) / rm) * C, g = dt - ((x * x * x) / sq) * S;
  const r = [0, 1, 2].map((k) => f * r0[k] + g * v0[k]);
  const rn = Math.hypot(...r);
  const fd = (sq / (rm * rn)) * (alpha * x * x * x * S - x), gd = 1 - ((x * x) / rn) * C;
  return { r, v: [0, 1, 2].map((k) => fd * r0[k] + gd * v0[k]) };
}

/** Seconds to the next periapsis passage going `sign` (±1) in time (negative when going back), or null (none that way on a hyperbola). */
export function timeToPeriapsis(r, v, gm, sign = 1) {
  const el = stateToElements(r, v, gm), rm = Math.hypot(...r), rv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  if (el.e < 1e-9) return 0; // circular: every point is a periapsis
  if (el.bound) {
    const a = el.a, n = Math.sqrt(gm / a ** 3), T = (2 * Math.PI) / n;
    const E = Math.atan2(rv / (el.e * Math.sqrt(gm * a)), (1 - rm / a) / el.e);
    const tSince = (E - el.e * Math.sin(E)) / n; // (−T/2, T/2]
    const mod = (x) => ((x % T) + T) % T;
    return sign > 0 ? mod(-tSince) : -mod(tSince);
  }
  const n = Math.sqrt(gm / (-el.a) ** 3);
  const F = Math.asinh(rv / (el.e * Math.sqrt(-gm * el.a)));
  const tSince = (el.e * Math.sinh(F) - F) / n;
  if (sign > 0) return tSince < 0 ? -tSince : null;
  return tSince > 0 ? -tSince : null;
}

/**
 * A clock jump of `dt` seconds with the ship in free flight about its frame body (`gm`, radius `R`; the
 * state `r`, `v` in km and km/s relative to it). The ship is carried along its two-body orbit, and the
 * interval is swept for collisions: with the frame body exactly (a periapsis under its surface inside the
 * interval: the crossing is found by bisection), and with `others` ({ id, R, posAt(t) → km relative to the
 * frame body, t in seconds from the jump's start }) at up to `maxSamples` steps of ≤ 1/64 orbit, each body
 * moving in a straight line between its ephemeris positions. A jump too long for that (more than ~32 orbits)
 * is not swept against the others: `swept` is false (the caller says so).
 * Returns { r, v, hit: null | { id ('frame' or an other's id), t (s), at (km, frame), rel (km from the body hit), relKmS }, swept, samples }.
 */
export function sweepJump({ r, v, gm, R, dt, others = [], maxSamples = 2048 }) {
  const el = stateToElements(r, v, gm), rm = Math.hypot(...r);
  const scale = el.bound ? el.periodS : 2 * Math.PI * Math.sqrt(rm ** 3 / gm);
  const want = Math.ceil(Math.abs(dt) / (scale / 64));
  const N = Math.max(16, Math.min(maxSamples, want)), swept = want <= maxSamples;
  const at = (t) => keplerPropagate(r, v, gm, t);
  const rad = (p) => Math.hypot(...p);
  let best = null; // the earliest hit
  const take = (h) => { if (h && (!best || Math.abs(h.t) < Math.abs(best.t))) best = h; };
  if (el.periapsis < R) {
    const sign = Math.sign(dt) || 1;
    if (rm <= R) take({ id: 'frame', t: 0, at: r.slice(), rel: r.slice(), relKmS: rad(v) });
    else {
      const tp = timeToPeriapsis(r, v, gm, sign);
      if (tp != null && Math.abs(tp) <= Math.abs(dt)) {
        // r(t) falls monotonically from the last apoapsis (or from now) to the periapsis: bisect r = R
        let lo = el.bound ? sign * Math.max(0, Math.abs(tp) - el.periodS / 2) : 0, hi = tp;
        if (rad(at(lo).r) < R) lo = 0;
        for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (rad(at(mid).r) > R) lo = mid; else hi = mid; }
        const s = at(hi);
        take({ id: 'frame', t: hi, at: s.r, rel: s.r, relKmS: rad(s.v) });
      }
    }
  }
  if (others.length && swept) {
    let prevShip = r.slice();
    const prevPos = others.map((o) => o.posAt(0));
    for (let k = 1; k <= N; k++) {
      const t = (dt * k) / N;
      if (best && Math.abs(t) > Math.abs(best.t) + Math.abs(dt) / N) break;
      const s = at(t);
      others.forEach((o, i) => {
        const q = o.posAt(t), p0 = prevPos[i];
        const f = segmentHitsSphere([prevShip[0] - p0[0], prevShip[1] - p0[1], prevShip[2] - p0[2]], [s.r[0] - q[0], s.r[1] - q[1], s.r[2] - q[2]], [0, 0, 0], o.R);
        if (f != null) {
          const tt = (dt * (k - 1 + f)) / N, hs = at(tt), bv = [0, 1, 2].map((j) => (q[j] - p0[j]) / (dt / N));
          const bp = [0, 1, 2].map((j) => p0[j] + (q[j] - p0[j]) * f);
          take({ id: o.id, t: tt, at: hs.r, rel: [hs.r[0] - bp[0], hs.r[1] - bp[1], hs.r[2] - bp[2]], relKmS: Math.hypot(hs.v[0] - bv[0], hs.v[1] - bv[1], hs.v[2] - bv[2]) });
        }
        prevPos[i] = q;
      });
      prevShip = s.r;
    }
  }
  const end = at(best ? best.t : dt);
  return { r: end.r, v: end.v, hit: best, swept, samples: N };
}
