// Launch windows and transfer orbits (#45): porkchop grids, the next windows to any Solar System
// body, Δv budgets and the transfer arc, all COMPUTED from the app's ephemeris (Standish elements
// for the planets, SBDB elements for small bodies; good to days for window dates) with Izzo's
// Lambert solver (lambert.js). Heliocentric J2000 ecliptic, km and s inside, AU/days at the edges.

import { lambert, propagate } from './lambert.js';
import { heliocentric, ELEMENTS } from './kepler.js';

export const MU_SUN = 1.32712440018e11; // km³/s²
export const MU_EARTH = 398600.4418;
export const R_EARTH = 6378.137;
const AU = 149597870.7, DAY = 86400;
const G = 6.6743e-20; // km³ kg⁻¹ s⁻²

/** Heliocentric state { r: km, v: km/s } of a position function pos(jd) → AU, by central difference. */
export function stateOf(pos, jd, h = 0.25) {
  const a = pos(jd - h), b = pos(jd + h), c = pos(jd);
  return { r: c.map((x) => x * AU), v: b.map((x, i) => ((x - a[i]) * AU) / (2 * h * DAY)) };
}
/** Position function for a planet by its Standish elements (Earth: the Earth–Moon barycentre). */
export const planetPos = (id) => (jd) => heliocentric(id, jd);
/** Orbital period (days) of a planet from its elements. */
export const periodDays = (id) => 365.25636 * ELEMENTS[id][0][0] ** 1.5;

const v3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** Δv (km/s) from a circular parking orbit of radius rp around a body (mu) to a hyperbola with excess speed vinf. */
export const injectionDv = (vinf, mu = MU_EARTH, rp = R_EARTH + 200) => Math.sqrt(vinf * vinf + (2 * mu) / rp) - Math.sqrt(mu / rp);
/** Δv (km/s) to capture from v∞ into a circular orbit of radius rp (or an ellipse with apoapsis ra). */
export const captureDv = (vinf, mu, rp, ra = rp) => Math.sqrt(vinf * vinf + (2 * mu) / rp) - Math.sqrt(mu * (2 / rp - 2 / (rp + ra)));

/**
 * The target's arrival budget. `target` = { pos(jd) → AU, massKg?, radiusKm? }. Bodies with
 * appreciable gravity are captured into a low circular orbit at 1.1 R (giants: a loose ellipse,
 * periapsis 1.1 R, apoapsis 100 R, as orbiters do); small bodies are matched in speed (rendezvous).
 */
export function arrivalDv(vinf, target) {
  if (!target.massKg || !target.radiusKm) return { dv: vinf, kind: 'rendezvous (match speed)' };
  const mu = G * target.massKg, rp = 1.1 * target.radiusKm;
  if (Math.sqrt((2 * mu) / rp) < 0.5) return { dv: vinf, kind: 'rendezvous (match speed)' };
  if (target.massKg > 1e26) return { dv: captureDv(vinf, mu, rp, 100 * target.radiusKm), kind: 'orbit insertion (1.1 R × 100 R ellipse)' };
  return { dv: captureDv(vinf, mu, rp), kind: 'capture into a circular orbit at 1.1 R' };
}

/** One transfer: departure jd, flight days → C3, v∞ at arrival, Δv budget, and the Lambert velocities. */
export function transfer(target, depJd, tofDays, { from = planetPos('earth'), parkingKm = 200 } = {}) {
  const e = stateOf(from, depJd), t = stateOf(target.pos, depJd + tofDays);
  const sol = lambert(MU_SUN, e.r, t.r, tofDays * DAY);
  if (!sol) return null;
  const vd = v3(sol.v1, e.v), va = v3(sol.v2, t.v);
  const vinfDep = len(vd), vinfArr = len(va);
  const dep = injectionDv(vinfDep, MU_EARTH, R_EARTH + parkingKm), arr = arrivalDv(vinfArr, target);
  return { depJd, tofDays, arrJd: depJd + tofDays, c3: vinfDep * vinfDep, vinfDep, vinfArr, dvDepart: dep, dvArrive: arr.dv, arriveKind: arr.kind, dvTotal: dep + arr.dv,
    r1: e.r, v1: sol.v1, r2: t.r, v2: sol.v2 };
}

/** Porkchop grid: rows of departure jds × columns of flight times. Cells hold transfer() or null. */
export function porkchop(target, depFrom, depTo, tofMin, tofMax, { nDep = 60, nTof = 60, from } = {}) {
  const deps = Array.from({ length: nDep }, (_, i) => depFrom + ((depTo - depFrom) * i) / (nDep - 1));
  const tofs = Array.from({ length: nTof }, (_, j) => tofMin + ((tofMax - tofMin) * j) / (nTof - 1));
  const cells = deps.map((d) => tofs.map((t) => transfer(target, d, t, { from })));
  let best = null;
  for (const row of cells) for (const c of row) if (c && (!best || c.c3 < best.c3)) best = c;
  return { deps, tofs, cells, best };
}

/** Porkchop on a departure × arrival grid (the classic layout): c3[j][i] for arrival j, departure i. */
export function porkchopByArrival(target, depFrom, depTo, arrFrom, arrTo, { n = 48, minTof = 20, from } = {}) {
  const deps = Array.from({ length: n }, (_, i) => depFrom + ((depTo - depFrom) * i) / (n - 1));
  const arrs = Array.from({ length: n }, (_, j) => arrFrom + ((arrTo - arrFrom) * j) / (n - 1));
  const cells = arrs.map((a) => deps.map((d) => (a - d >= minTof ? transfer(target, d, a - d, { from }) : null)));
  return { deps, arrs, c3: cells.map((row) => row.map((x) => (x && Number.isFinite(x.c3) ? x.c3 : null))), cell: (i, j) => cells[j]?.[i] ?? null };
}

/** Hohmann transfer between circular coplanar orbits of radii r1, r2 (AU): flight days, Δv at each end (km/s, heliocentric). */
export function hohmann(r1Au, r2Au) {
  const r1 = r1Au * AU, r2 = r2Au * AU, a = (r1 + r2) / 2;
  const v1 = Math.sqrt(MU_SUN / r1), v2 = Math.sqrt(MU_SUN / r2);
  const vp = Math.sqrt(MU_SUN * (2 / r1 - 1 / a)), va = Math.sqrt(MU_SUN * (2 / r2 - 1 / a));
  return { tofDays: (Math.PI * Math.sqrt(a ** 3 / MU_SUN)) / DAY, dv1: Math.abs(vp - v1), dv2: Math.abs(v2 - va) };
}
/** Synodic period (days) of two orbital periods (days). */
export const synodicDays = (p1, p2) => 1 / Math.abs(1 / p1 - 1 / p2);

/** Flight-time range to search for a target at mean distance aAu: around the Hohmann time. */
export function tofRange(aAu) {
  const h = hohmann(1, Math.max(0.2, aAu)).tofDays;
  return aAu < 1 ? [0.45 * h, 1.6 * h] : [0.55 * h, 1.5 * h];
}

/**
 * The next launch windows: the departures (from `fromJd`, over `years`) where the least-C3 transfer
 * reaches a local minimum, at least `minGapDays` apart. Each window: its best transfer and the
 * departure span where C3 stays within `slack` of that minimum.
 */
export function launchWindows(target, fromJd, { years = 8, stepDays = 4, aAu, tof = tofRange(aAu ?? 1.52), nTof = 24, count = 6, slack = 1.3, minGapDays } = {}) {
  const tofs = Array.from({ length: nTof }, (_, j) => tof[0] + ((tof[1] - tof[0]) * j) / (nTof - 1));
  const series = [];
  for (let d = fromJd; d <= fromJd + years * 365.25; d += stepDays) {
    let best = null;
    for (const t of tofs) { const x = transfer(target, d, t); if (x && Number.isFinite(x.c3) && (!best || x.c3 < best.c3)) best = x; }
    series.push(best);
  }
  const gap = minGapDays ?? 200;
  const minima = [];
  for (let i = 1; i < series.length - 1; i++) {
    const a = series[i - 1], b = series[i], c = series[i + 1];
    if (b && a && c && b.c3 <= a.c3 && b.c3 < c.c3) minima.push({ i, best: b });
  }
  // the deepest minimum sets the scale: shallow dips between real windows are not windows
  const floor = Math.min(...minima.map((m) => m.best.c3));
  minima.splice(0, minima.length, ...minima.filter((m) => m.best.c3 <= floor * 1.8 + 5));
  minima.sort((p, q) => p.best.c3 - q.best.c3);
  const chosen = [];
  for (const m of minima) if (chosen.every((c) => Math.abs(c.best.depJd - m.best.depJd) > gap)) chosen.push(m);
  chosen.sort((p, q) => p.best.depJd - q.best.depJd);
  return chosen.slice(0, count).map(({ i, best }) => {
    let lo = i, hi = i;
    while (lo > 0 && series[lo - 1] && series[lo - 1].c3 <= best.c3 * slack) lo--;
    while (hi < series.length - 1 && series[hi + 1] && series[hi + 1].c3 <= best.c3 * slack) hi++;
    // refine the optimum on a fine local grid
    const fine = porkchop(target, best.depJd - stepDays, best.depJd + stepDays, Math.max(tof[0], best.tofDays - 30), Math.min(tof[1], best.tofDays + 30), { nDep: 9, nTof: 31 }).best ?? best;
    return { best: fine, opens: series[lo].depJd, closes: series[hi].depJd };
  });
}

/** Points (AU, heliocentric ecliptic) along a transfer, for drawing. */
export function transferArc(x, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const { r } = propagate(MU_SUN, x.r1, x.v1, (x.tofDays * DAY * i) / n);
    pts.push(r.map((c) => c / AU));
  }
  return pts;
}
/** Spacecraft position (AU) on a transfer at `jd` (null outside it). */
export function transferPosition(x, jd) {
  if (jd < x.depJd || jd > x.arrJd) return null;
  return propagate(MU_SUN, x.r1, x.v1, (jd - x.depJd) * DAY).r.map((c) => c / AU);
}
