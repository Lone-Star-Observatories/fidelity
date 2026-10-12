// Gravity-assist routes (#45): patched conics. Each leg between planets is a Lambert arc (lambert.js)
// on the app's ephemeris; at each flyby planet the arriving and leaving v∞ must be joined by a
// hyperbola. An unpowered flyby keeps |v∞| and turns it through at most δmax(rp); when the legs need
// a different speed or a larger turn, a burn at periapsis pays the difference (the "powered flyby"
// model of mission design, e.g. Izzo & Vasile's MGA). Cost = launch Δv from LEO + flyby burns + arrival.
// Heliocentric J2000 ecliptic; km and s inside, AU and days at the edges. COMPUTED.

import { lambert, propagate } from './lambert.js';
import { stateOf, planetPos, injectionDv, arrivalDv, hohmann, MU_SUN } from './transfer.js';
import { ELEMENTS } from './kepler.js';

const AU = 149597870.7, DAY = 86400, G = 6.6743e-20;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Flyby planets: gravity (from mass) and the lowest safe periapsis (above the atmosphere; Jupiter's
// radiation belts keep craft beyond ~4 RJ, as Pioneer 11's 1.6 RJ pass was the exception).
export const FLYBY = {
  venus: { name: 'Venus', massKg: 4.867e24, radiusKm: 6051.8, minAltKm: 300 },
  earth: { name: 'Earth', massKg: 5.972e24, radiusKm: 6371, minAltKm: 300 },
  mars: { name: 'Mars', massKg: 6.417e23, radiusKm: 3389.5, minAltKm: 200 },
  jupiter: { name: 'Jupiter', massKg: 1.898e27, radiusKm: 69911, minAltKm: 69911 * 3 },
  saturn: { name: 'Saturn', massKg: 5.683e26, radiusKm: 58232, minAltKm: 58232 * 1.5 },
};
const muOf = (id) => G * FLYBY[id].massKg;

/** Total turn (rad) of a hyperbolic flyby with periapsis rp for arriving and leaving speeds a, b (km/s). */
const turnAt = (rp, a, b, mu) => Math.asin(1 / (1 + (rp * a * a) / mu)) + Math.asin(1 / (1 + (rp * b * b) / mu));

/**
 * Join v∞ in and v∞ out (km/s vectors relative to the planet) at a planet: the periapsis that gives
 * the turn, and the periapsis burn that changes the speed. Turns beyond what the lowest safe pass can
 * give are charged as an impulsive rotation of v∞ (a penalty, so the search avoids them).
 * Returns { rp, altKm, dv, turnDeg, maxTurnDeg, ok }.
 */
export function flybyJoin(vin, vout, id) {
  const p = FLYBY[id], mu = muOf(id), rMin = p.radiusKm + p.minAltKm;
  const a = len(vin), b = len(vout);
  const turn = Math.acos(Math.max(-1, Math.min(1, dot(vin, vout) / (a * b))));
  const maxTurn = turnAt(rMin, a, b, mu);
  let rp, extra = 0;
  if (turn > maxTurn) { rp = rMin; extra = 2 * Math.min(a, b) * Math.sin((turn - maxTurn) / 2); }
  else {
    let lo = rMin, hi = rMin * 1e5; // the turn falls as rp grows: bisect
    for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (turnAt(m, a, b, mu) > turn) lo = m; else hi = m; }
    rp = Math.sqrt(lo * hi);
  }
  const burn = Math.abs(Math.sqrt(b * b + (2 * mu) / rp) - Math.sqrt(a * a + (2 * mu) / rp));
  return { rp, altKm: rp - p.radiusKm, dv: burn + extra, burn, turnDeg: (turn * 180) / Math.PI, maxTurnDeg: (maxTurn * 180) / Math.PI, ok: extra === 0 };
}

/**
 * A route: Earth at depJd, then each flyby planet in `via`, then `target` ({ pos(jd) → AU, massKg?, radiusKm? }),
 * with leg flight times `tofs` (days). Returns null if a leg has no Lambert solution.
 */
export function routeCost(target, via, depJd, tofs) {
  const bodies = ['earth', ...via];
  const pos = [...bodies.map((id) => planetPos(id)), target.pos];
  const times = [depJd];
  for (const t of tofs) times.push(times.at(-1) + t);
  const states = pos.map((p, i) => stateOf(p, times[i]));
  const legs = [];
  for (let i = 0; i < tofs.length; i++) {
    const s = lambert(MU_SUN, states[i].r, states[i + 1].r, tofs[i] * DAY);
    if (!s) return null;
    legs.push({ fromJd: times[i], tofDays: tofs[i], r1: states[i].r, v1: s.v1, v2: s.v2 });
  }
  const vinfDep = len(sub(legs[0].v1, states[0].v));
  const flybys = via.map((id, k) => {
    const vin = sub(legs[k].v2, states[k + 1].v), vout = sub(legs[k + 1].v1, states[k + 1].v);
    return { id, name: FLYBY[id].name, jd: times[k + 1], vinfIn: len(vin), vinfOut: len(vout), ...flybyJoin(vin, vout, id) };
  });
  const vinfArr = len(sub(legs.at(-1).v2, states.at(-1).v));
  const dvDepart = injectionDv(vinfDep), arr = arrivalDv(vinfArr, target);
  const dvFlybys = flybys.reduce((s, f) => s + f.dv, 0);
  return { via, depJd, arrJd: times.at(-1), tofDays: times.at(-1) - depJd, tofs, legs, flybys, c3: vinfDep * vinfDep, vinfDep, vinfArr,
    dvDepart, dvFlybys, dvArrive: arr.dv, arriveKind: arr.kind, dvTotal: dvDepart + dvFlybys + arr.dv };
}

const meanA = (id) => ELEMENTS[id][0][0];
/** Flight-time range (days) for a leg between mean distances a1 and a2 (AU): around the Hohmann time. */
function legRange(a1, a2) {
  const h = hohmann(Math.min(a1, a2), Math.max(a1, a2)).tofDays;
  return [Math.max(30, 0.35 * h), 1.6 * h];
}

/** Flyby sequences worth trying for a target at mean distance aAu (planets only as flyby bodies). */
export function sequencesFor(aAu, targetId) {
  const out = [];
  if (aAu < 0.6) out.push(['venus']);
  else if (aAu > 1.25 && aAu < 3.6) out.push(['venus'], ...(targetId === 'mars' ? [] : [['mars']]));
  else if (aAu >= 3.6 && aAu < 7) out.push(['mars'], ['venus'], ['venus', 'earth']);
  else if (aAu >= 7) {
    out.push(['jupiter'], ['venus', 'earth'], ['mars', 'jupiter']);
    if (aAu > 15 && targetId !== 'saturn') out.push(['saturn'], ['jupiter', 'saturn']);
  }
  return out.filter((s) => !s.includes(targetId));
}

/** Coordinate descent on [depJd, ...tofs] from `x0`, shrinking the step: the local optimum of dvTotal. */
function refine(target, via, start, ranges, maxDays = Infinity) {
  let best = start, step = [8, ...start.tofs.map((t) => Math.max(4, t * 0.05))];
  const vec = (r) => [r.depJd, ...r.tofs];
  for (let round = 0; round < 40 && step.some((s) => s > 0.25); round++) {
    let moved = false;
    for (let k = 0; k < step.length; k++) {
      for (const sgn of [1, -1]) {
        const v = vec(best); v[k] += sgn * step[k];
        if (k > 0 && (v[k] < ranges[k - 1][0] * 0.8 || v[k] > ranges[k - 1][1] * 1.25)) continue;
        const r = routeCost(target, via, v[0], v.slice(1));
        if (r && r.tofDays <= maxDays && r.dvTotal < best.dvTotal - 1e-6) { best = r; moved = true; }
      }
    }
    if (!moved) step = step.map((s) => s / 2);
  }
  return best;
}

/**
 * Search one flyby sequence: a grid over departure (fromJd … +years, every stepDays) × leg flight
 * times, then a local refinement of the best few. `targetA` = target's mean distance (AU).
 * Only routes that arrive within maxDays count (Δv alone would always prefer the slowest path).
 * Returns the best distinct routes (departures at least minGapDays apart), cheapest first. `yieldEvery`
 * lets a caller keep the page responsive: it is awaited every that many departures.
 */
export async function searchSequence(target, targetA, via, fromJd, { years = 12, stepDays = 10, nTof = 9, keep = 3, minGapDays = 200, maxC3 = 200, maxDays = Infinity, yieldEvery = 0, pause } = {}) {
  const chain = ['earth', ...via].map(meanA).concat(targetA);
  // each leg within its Hohmann-like range, and none longer than the whole trip may be
  const ranges = chain.slice(1).map((a, i) => legRange(chain[i], a)).map(([lo, hi]) => [Math.min(lo, maxDays * 0.5), Math.min(hi, maxDays)]);
  const grids = ranges.map(([lo, hi]) => Array.from({ length: nTof }, (_, j) => lo + ((hi - lo) * j) / (nTof - 1)));
  const top = [];
  const consider = (r) => {
    if (!r || !(r.c3 <= maxC3) || r.tofDays > maxDays) return;
    const i = top.findIndex((t) => Math.abs(t.depJd - r.depJd) < minGapDays);
    if (i >= 0) { if (r.dvTotal < top[i].dvTotal) top[i] = r; } else top.push(r);
    top.sort((a, b) => a.dvTotal - b.dvTotal);
    if (top.length > keep * 3) top.length = keep * 3;
  };
  const nDep = Math.ceil((years * 365.25) / stepDays);
  for (let d = 0; d < nDep; d++) {
    const dep = fromJd + d * stepDays;
    const idx = grids.map(() => 0);
    for (;;) {
      consider(routeCost(target, via, dep, idx.map((j, k) => grids[k][j])));
      let k = idx.length - 1;
      while (k >= 0 && ++idx[k] === nTof) idx[k--] = 0;
      if (k < 0) break;
    }
    if (yieldEvery && pause && d % yieldEvery === yieldEvery - 1) await pause();
  }
  const refined = top.slice(0, keep * 2).map((r) => refine(target, via, r, ranges, maxDays)).filter((r) => r.depJd >= fromJd - 1);
  refined.sort((a, b) => a.dvTotal - b.dvTotal);
  const out = [];
  for (const r of refined) if (out.every((o) => Math.abs(o.depJd - r.depJd) >= minGapDays)) out.push(r);
  return out.slice(0, keep);
}

/** Sampled path of a route: rows [jd, x, y, z] (AU), every leg propagated from its Lambert start. */
export function routePath(route, perLeg = 90) {
  const rows = [];
  for (const L of route.legs) {
    for (let i = 0; i <= perLeg; i++) {
      if (i === 0 && rows.length) continue;
      const t = (L.tofDays * i) / perLeg;
      rows.push([L.fromJd + t, ...propagate(MU_SUN, L.r1, L.v1, t * DAY).r.map((c) => c / AU)]);
    }
  }
  return rows;
}
