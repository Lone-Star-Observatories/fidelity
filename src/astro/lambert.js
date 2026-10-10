// Lambert's problem and two-body propagation (#45).
//
//   lambert(mu, r1, r2, tof, { revs, prograde, lowPath }) → { v1, v2 }: the orbit from r1 to r2 in
//   time tof. Izzo's solver (D. Izzo, "Revisiting Lambert's problem", CMDA 121, 2015): a single
//   non-dimensional time-of-flight equation in x, solved with Householder iterations from Izzo's
//   initial guesses; multi-revolution solutions (revs ≥ 1) on the low or high path. Short and long
//   ways come out of `prograde` (the transfer angle follows the direction of motion).
//   propagate(mu, r0, v0, dt) → { r, v }: universal-variable Kepler (Curtis, alg. 3.3/3.4), any
//   eccentricity. Units are whatever mu, r and t share (km, s, km³/s² here). Pure maths, no DOM.

const PI = Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Gauss hypergeometric ₂F₁(3, 1; 5/2; x) by its series (|x| < 1). */
function hyp2f1b(x) {
  if (x >= 1) return Infinity;
  let res = 1, term = 1;
  for (let i = 0; i < 1000; i++) {
    term = (term * (3 + i) * (1 + i)) / (2.5 + i) * x / (i + 1);
    const old = res;
    res += term;
    if (old === res) return res;
  }
  return res;
}
const yOf = (x, ll) => Math.sqrt(1 - ll * ll * (1 - x * x));
function psiOf(x, y, ll) {
  if (x >= -1 && x < 1) return Math.acos(x * y + ll * (1 - x * x));
  if (x > 1) return Math.asinh((y - x * ll) * Math.sqrt(x * x - 1));
  return 0;
}
function tofY(x, y, T0, ll, M) {
  let T;
  if (M === 0 && x > Math.sqrt(0.6) && x < Math.sqrt(1.4)) {
    const eta = y - ll * x, S1 = (1 - ll - x * eta) * 0.5, Q = (4 / 3) * hyp2f1b(S1);
    T = (eta ** 3 * Q + 4 * ll * eta) * 0.5;
  } else {
    const psi = psiOf(x, y, ll);
    T = ((psi + M * PI) / Math.sqrt(Math.abs(1 - x * x)) - x + ll * y) / (1 - x * x);
  }
  return T - T0;
}
const tof = (x, T0, ll, M) => tofY(x, yOf(x, ll), T0, ll, M);
const dT1 = (x, y, T, ll) => (3 * T * x - 2 + (2 * ll ** 3 * x) / y) / (1 - x * x);
const dT2 = (x, y, T, d1, ll) => (3 * T + 5 * x * d1 + (2 * (1 - ll * ll) * ll ** 3) / y ** 3) / (1 - x * x);
const dT3 = (x, y, d1, d2, ll) => (7 * x * d2 + 8 * d1 - (6 * (1 - ll * ll) * ll ** 5 * x) / y ** 5) / (1 - x * x);

function halley(p0, T0, ll, tol, maxIter) {
  for (let i = 0; i < maxIter; i++) {
    const y = yOf(p0, ll), d1 = dT1(p0, y, T0, ll), d2 = dT2(p0, y, T0, d1, ll);
    if (d2 === 0) break;
    const d3 = dT3(p0, y, d1, d2, ll);
    const p = p0 - (2 * d1 * d2) / (2 * d2 * d2 - d1 * d3);
    if (Math.abs(p - p0) < tol) return p;
    p0 = p;
  }
  return p0;
}
function householder(p0, T0, ll, M, tol, maxIter) {
  for (let i = 0; i < maxIter; i++) {
    const y = yOf(p0, ll), f = tofY(p0, y, T0, ll, M), T = f + T0;
    const d1 = dT1(p0, y, T, ll), d2 = dT2(p0, y, T, d1, ll), d3 = dT3(p0, y, d1, d2, ll);
    const p = p0 - f * ((d1 * d1 - (f * d2) / 2) / (d1 * (d1 * d1 - f * d2) + (d3 * f * f) / 6));
    if (!Number.isFinite(p)) return NaN;
    if (Math.abs(p - p0) < tol) return p;
    p0 = p;
  }
  return NaN; // did not converge
}
function initialGuess(T, ll, M, lowPath) {
  if (M === 0) {
    const T0 = Math.acos(ll) + ll * Math.sqrt(1 - ll * ll), T1 = (2 * (1 - ll ** 3)) / 3;
    if (T >= T0) return (T0 / T) ** (2 / 3) - 1;
    if (T < T1) return (2.5 * T1 / T) * (T1 - T) / (1 - ll ** 5) + 1;
    return Math.exp((Math.log(2) * Math.log(T / T0)) / Math.log(T1 / T0)) - 1;
  }
  const a = ((M * PI + PI) / (8 * T)) ** (2 / 3), b = ((8 * T) / (M * PI)) ** (2 / 3);
  const xl = (a - 1) / (a + 1), xr = (b - 1) / (b + 1);
  return lowPath ? Math.max(xl, xr) : Math.min(xl, xr);
}

/**
 * Izzo's Lambert solver. r1, r2: position vectors; tof > 0; mu: gravitational parameter.
 * Returns { v1, v2 } or null when no solution exists for `revs` revolutions.
 */
export function lambert(mu, r1, r2, tofS, { revs = 0, prograde = true, lowPath = true, tol = 1e-10, maxIter = 35 } = {}) {
  if (!(tofS > 0)) return null;
  const c = sub(r2, r1), cn = norm(c), r1n = norm(r1), r2n = norm(r2);
  const s = (r1n + r2n + cn) / 2;
  const ir1 = scale(r1, 1 / r1n), ir2 = scale(r2, 1 / r2n);
  let ih = cross(ir1, ir2);
  const ihn = norm(ih);
  if (ihn < 1e-12) return null; // 0° or 180°: the transfer plane is undefined
  ih = scale(ih, 1 / ihn);
  let ll = Math.sqrt(Math.max(0, 1 - Math.min(1, cn / s)));
  let it1, it2;
  if (ih[2] < 0) { ll = -ll; it1 = cross(ir1, ih); it2 = cross(ir2, ih); } else { it1 = cross(ih, ir1); it2 = cross(ih, ir2); }
  if (!prograde) { ll = -ll; it1 = scale(it1, -1); it2 = scale(it2, -1); }
  const T = Math.sqrt((2 * mu) / s ** 3) * tofS;

  // feasibility of the requested number of revolutions
  let Mmax = Math.floor(T / PI);
  const T00 = Math.acos(ll) + ll * Math.sqrt(1 - ll * ll);
  if (T < T00 + Mmax * PI && Mmax > 0) {
    const xmin = halley(0.1, T00, ll, tol, maxIter), Tmin = tof(xmin, 0, ll, Mmax);
    if (T < Tmin) Mmax -= 1;
  }
  if (revs > Mmax) return null;
  const x = householder(initialGuess(T, ll, revs, lowPath), T, ll, revs, tol, maxIter);
  if (!Number.isFinite(x)) return null;
  const y = yOf(x, ll);
  const gamma = Math.sqrt((mu * s) / 2), rho = (r1n - r2n) / cn, sigma = Math.sqrt(1 - rho * rho);
  const Vr1 = (gamma * ((ll * y - x) - rho * (ll * y + x))) / r1n;
  const Vr2 = (-gamma * ((ll * y - x) + rho * (ll * y + x))) / r2n;
  const Vt1 = (gamma * sigma * (y + ll * x)) / r1n;
  const Vt2 = (gamma * sigma * (y + ll * x)) / r2n;
  return { v1: add(scale(ir1, Vr1), scale(it1, Vt1)), v2: add(scale(ir2, Vr2), scale(it2, Vt2)) };
}

// ---- universal-variable propagation ---------------------------------------------------------
const stumpC = (z) => (z > 1e-8 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-8 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5 - z / 24);
const stumpS = (z) => {
  if (z > 1e-8) { const s = Math.sqrt(z); return (s - Math.sin(s)) / s ** 3; }
  if (z < -1e-8) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / s ** 3; }
  return 1 / 6 - z / 120;
};
/** State after `dt` on the two-body orbit through (r0, v0). */
export function propagate(mu, r0, v0, dt) {
  const r0n = norm(r0), v0n = norm(v0), vr0 = dot(r0, v0) / r0n, sm = Math.sqrt(mu);
  const alpha = 2 / r0n - (v0n * v0n) / mu;
  let chi = sm * Math.abs(alpha) * dt || sm * dt / r0n;
  for (let i = 0; i < 100; i++) {
    const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
    const F = (r0n * vr0) / sm * chi * chi * C + (1 - alpha * r0n) * chi ** 3 * S + r0n * chi - sm * dt;
    const dF = (r0n * vr0) / sm * chi * (1 - alpha * chi * chi * S) + (1 - alpha * r0n) * chi * chi * C + r0n;
    const step = F / dF;
    chi -= step;
    if (Math.abs(step) < 1e-10 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
  const f = 1 - (chi * chi / r0n) * C, g = dt - (chi ** 3 / sm) * S;
  const r = add(scale(r0, f), scale(v0, g)), rn = norm(r);
  const fd = (sm / (rn * r0n)) * (alpha * chi ** 3 * S - chi), gd = 1 - (chi * chi / rn) * C;
  return { r, v: add(scale(r0, fd), scale(v0, gd)) };
}
