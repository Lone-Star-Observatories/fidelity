// Astrometry → Cartesian position and space velocity (#29), shared by the backend (Gaia DR3
// motions for the Navigation View) and the tests. Equatorial J2000/ICRS axes, as HYG's x/y/z.

const DEG = Math.PI / 180;
export const K_PM = 4.740470446; // km/s per (mas/yr × kpc)

/**
 * { raDeg, decDeg, plxMas, pmraMasYr (μα*, includes cos δ), pmdecMasYr, rvKms }
 * → { pos: [x, y, z] pc, vel: [vx, vy, vz] km/s }. A missing radial velocity counts as 0
 * (sideways motion only).
 */
export function spaceMotion({ raDeg, decDeg, plxMas, pmraMasYr, pmdecMasYr, rvKms }) {
  const a = raDeg * DEG, d = decDeg * DEG, ca = Math.cos(a), sa = Math.sin(a), cd = Math.cos(d), sd = Math.sin(d);
  const dist = 1000 / plxMas; // pc
  const r = [cd * ca, cd * sa, sd], ea = [-sa, ca, 0], ed = [-sd * ca, -sd * sa, cd];
  const va = K_PM * pmraMasYr / plxMas, vd = K_PM * pmdecMasYr / plxMas, vr = rvKms ?? 0;
  return {
    pos: r.map((x) => x * dist),
    vel: [0, 1, 2].map((k) => vr * r[k] + va * ea[k] + vd * ed[k]),
  };
}
