// AUTOLAND (#42): a powered descent to a soft landing in REAL PHYSICS, the "suicide burn" way. The ship
// kills its speed across the ground first, then falls freely and burns only as hard as it must to stop
// at the ground: the descent rate it allows is the stopping speed for the height left at a fraction of the
// spare thrust, √(2 k (a − g) h), plus a slow final touchdown speed. Thrust never pushes towards the ground
// and is capped at the ship's acceleration. Pure: tested in tests/landing.test.js (Moon and Mars descents).
// Units: km, s, km/s, km/s², km³/s². Speeds are relative to the body's centre (its rotation is ignored, as the
// helm's LANDED test does).

export const TOUCHDOWN_KMS = 0.0015; // the descent rate aimed for at the ground (1.5 m/s; LANDED is ≤ 10 m/s)
const K = 0.6; // the share of the spare thrust the stopping curve plans on (the rest is margin)
const TAU = 0.8; // s: how quickly the velocity error is corrected
const FLARE_S = 6; // s: near the ground the allowed descent rate is the height over this time

/** Can the ship hover here? Local gravity (km/s²) at radius r and whether thrust `aMax` beats it with margin. */
export function canLand(gm, R, aMax) {
  const g = gm / (R * R);
  return { g, ok: aMax > 1.25 * g };
}

/**
 * The thrust acceleration (km/s², a vector of length ≤ aMax) to command now. `r`, `v`: the ship relative to the
 * body's centre; `ground` (km): the ground's radius under the ship (the DEM where there is one).
 * → { a: [x, y, z], h (km above the ground), vDown (km/s, + descending), vAcross (km/s), vDes (km/s), phase }.
 */
export function autolandAccel({ r, v, gm, ground, aMax }) {
  const rm = Math.hypot(r[0], r[1], r[2]);
  const up = [r[0] / rm, r[1] / rm, r[2] / rm];
  const h = Math.max(0, rm - ground);
  const g = gm / (rm * rm);
  const vr = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
  const vh = [v[0] - vr * up[0], v[1] - vr * up[1], v[2] - vr * up[2]];
  const vAcross = Math.hypot(vh[0], vh[1], vh[2]);
  const spare = Math.max(1e-9, aMax - g);
  // the descent rate allowed (negative: down): the stopping curve, but no faster than lets the speed across the
  // ground be killed before the height runs out; the final touchdown speed only once that speed is gone
  const tKill = vAcross / (0.7 * aMax);
  const stop = Math.sqrt(2 * K * spare * h), flare = h / FLARE_S; // the last metres: a linear flare, not the steep root
  const curve = Math.min(stop, flare);
  const vDes = -(Math.min(curve, tKill > 0 ? (0.5 * h) / tKill : curve) + (vAcross < 0.002 ? TOUCHDOWN_KMS : 0));
  // vertical first: hold the stopping curve, never thrusting towards the ground
  // (plus the curve's own deceleration as a feed-forward, so the descent does not lag behind it)
  const onCurve = vr < 0 && stop <= flare && curve <= (tKill > 0 ? (0.5 * h) / tKill : curve);
  const onFlare = vr < 0 && flare < stop;
  let aUp = (vDes - vr) / TAU + g + (onCurve ? K * spare : onFlare ? -vr / FLARE_S : 0);
  aUp = Math.min(aMax, Math.max(0, aUp));
  // then across the ground with what is left: kill the horizontal speed
  const left = Math.sqrt(Math.max(0, aMax * aMax - aUp * aUp));
  const want = vAcross / TAU;
  const aH = Math.min(left, want);
  const a = [aUp * up[0], aUp * up[1], aUp * up[2]];
  if (vAcross > 1e-12) for (let k = 0; k < 3; k++) a[k] -= (aH * vh[k]) / vAcross;
  const phase = h < 0.3 ? 'TOUCHDOWN' : vAcross > 0.005 && aH > 0.2 * aMax ? 'BRAKING' : aUp > 0.05 * aMax + g * 0.5 ? 'SUICIDE BURN' : 'FALLING';
  return { a, h, vDown: -vr, vAcross, vDes: -vDes, phase };
}
