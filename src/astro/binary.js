// Visual-binary orbits in 3D. ORB6 gives the relative orbit of the secondary around the
// primary on the sky (a in arcsec, i, Ω, ω, T, e, P). With the parallax distance that
// becomes AU; the sky axes (north, east, line of sight) are turned into the scene frame.
// Hierarchical systems (α Cen A+B, with C around the pair) are built inner orbit first,
// and every star moves about the shared centre of mass.

import { eccentricAnomaly } from './kepler.js';

const DEG = Math.PI / 180;

export const besselianYear = (jd) => 1900 + (jd - 2415020.31352) / 365.242198781;

/** Unit vectors at sky position (RA, Dec): line of sight away from Sol, north, east (equatorial). */
export function skyBasis(raDeg, decDeg) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return {
    r: [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)],
    n: [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)],
    e: [-Math.sin(a), Math.cos(a), 0],
  };
}

/**
 * Secondary relative to primary at Besselian year `t`, in arcsec along
 * [north (Δδ), east (Δα cos δ), line of sight] — Thiele–Innes form.
 */
export function relativeSky(o, t) {
  const M = (2 * Math.PI * (t - o.periastronYear)) / o.periodYears;
  const E = eccentricAnomaly(M, o.e);
  const X = Math.cos(E) - o.e, Y = Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  const w = o.omega * DEG, W = o.node * DEG, i = o.i * DEG, a = o.aArcsec;
  const A = a * (Math.cos(w) * Math.cos(W) - Math.sin(w) * Math.sin(W) * Math.cos(i));
  const B = a * (Math.cos(w) * Math.sin(W) + Math.sin(w) * Math.cos(W) * Math.cos(i));
  const F = a * (-Math.sin(w) * Math.cos(W) - Math.cos(w) * Math.sin(W) * Math.cos(i));
  const G = a * (-Math.sin(w) * Math.sin(W) + Math.cos(w) * Math.cos(W) * Math.cos(i));
  const C = a * Math.sin(w) * Math.sin(i), H = a * Math.cos(w) * Math.sin(i);
  return [A * X + F * Y, B * X + G * Y, C * X + H * Y];
}

/** Separation (arcsec) and position angle (degrees east of north) at Besselian year `t`. */
export function separationPA(o, t) {
  const [n, e] = relativeSky(o, t);
  return { rho: Math.hypot(n, e), theta: ((Math.atan2(e, n) / DEG) + 360) % 360 };
}

/** Relative position in AU along equatorial axes (orbit `o` with distance and sky basis). */
export function relativeEquatorial(o, t, distPc, basis) {
  const [n, e, z] = relativeSky(o, t).map((v) => v * distPc); // arcsec × pc = AU
  return [0, 1, 2].map((k) => basis.n[k] * n + basis.e[k] * e + basis.r[k] * z);
}

/**
 * Build the hierarchy: `orbits` = [{ id, primary, secondary }] (leaf ids), `mass` = leaf →
 * M☉. Inner (shorter-period) orbits are joined first. Returns the root nodes.
 */
export function hierarchy(orbits, mass) {
  const nodeOf = new Map();
  const leaf = (id) => { if (!nodeOf.has(id)) nodeOf.set(id, { id, mass: mass[id] ?? 1, leaves: [id] }); return nodeOf.get(id); };
  for (const o of [...orbits].sort((a, b) => a.periodYears - b.periodYears)) {
    const X = leaf(o.primary), Y = leaf(o.secondary);
    if (X === Y) continue;
    const node = { orbit: o, a: X, b: Y, mass: X.mass + Y.mass, leaves: [...X.leaves, ...Y.leaves] };
    for (const id of node.leaves) nodeOf.set(id, node);
  }
  for (const id of Object.keys(mass)) leaf(id);
  return [...new Set(nodeOf.values())];
}

/**
 * Positions of every leaf (and pair barycentres) at time `t`, given `rel(orbit, t)` → the
 * secondary-minus-primary vector. Root barycentre at the origin.
 */
export function place(roots, t, rel, out = { leaves: {}, centres: [] }) {
  const walk = (node, offset) => {
    if (!node.orbit) { out.leaves[node.id] = offset; return; }
    const r = rel(node.orbit, t);
    const fa = node.b.mass / node.mass, fb = node.a.mass / node.mass;
    out.centres.push({ orbit: node.orbit, centre: offset, fa, fb });
    walk(node.a, offset.map((v, k) => v - r[k] * fa));
    walk(node.b, offset.map((v, k) => v + r[k] * fb));
  };
  for (const r of roots) walk(r, [0, 0, 0]);
  return out;
}
