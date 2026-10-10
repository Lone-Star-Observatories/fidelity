// Planetary magnetic fields (#38): dipole parameters from published field models, field lines of a
// tilted, offset dipole, and the magnetopause and bow shock. Pure maths, no DOM.
//
//   Field lines: a dipole's line of shell L is r = L sin²θ (θ from the dipole axis); |B| =
//   B0 (R/r)³ √(1 + 3 cos²θ), with B0 the equatorial surface field.
//   Magnetopause: Shue et al. 1998, r = r0 (2 / (1 + cos θ))^α, θ from the upstream direction; for
//   Earth r0 and α follow the solar wind (dynamic pressure Dp in nPa, IMF Bz in nT); other planets
//   use their observed typical stand-off and α = 0.6 (MODELLED).
//   Bow shock: a conic r = r_bs (1 + ε) / (1 + ε cos θ), ε = 0.81 (Farris & Russell 1994 style).

/** Centred dipole from the degree-1 Gauss coefficients (nT): equatorial surface field, tilt and the north end of its axis. */
export function dipoleFromGauss(g10, g11, h11) {
  const B0 = Math.hypot(g10, g11, h11);
  // the axis end in the northern hemisphere: (−g11, −h11, −g10) for a south-pointing moment (Earth), sign flipped otherwise
  const s = g10 < 0 ? -1 : 1;
  const x = s * g11, y = s * h11, z = s * g10;
  return { B0, tiltDeg: (Math.acos(Math.abs(z) / B0) * 180) / Math.PI, poleLat: 90 - (Math.acos(Math.abs(z) / B0) * 180) / Math.PI, poleLon: (Math.atan2(y, x) * 180) / Math.PI,
    momentNorth: g10 > 0 };
}

const IGRF14_2025 = dipoleFromGauss(-29350.0, -1410.3, 4545.5); // IGRF-14, epoch 2025.0
const JRM09 = dipoleFromGauss(410244.7, -71498.3, 21330.5); // Connerney et al. 2018 (Juno)

/**
 * Per body: B0 (nT, equatorial surface), tilt and north-end longitude (east, body-fixed), moment
 * direction (momentNorth: field lines leave the northern hemisphere), offset of the dipole centre
 * (body radii, as [lat, lon, distance]), magnetopause stand-off and bow-shock distance (radii),
 * upstream ('sun', or 'flow' for a moon in its planet's corotating plasma), source and tiers.
 */
export const MAGNETIC = {
  mercury: { B0: 195, tiltDeg: 0, poleLon: 0, momentNorth: false, offset: [90, 0, 0.196], standoff: 1.45, bowShock: 1.96, upstream: 'sun',
    source: 'MESSENGER: Anderson et al. 2011/2012 (dipole 195 nT·R³, offset 484 km north, tilt < 0.8°); Winslow et al. 2013 (boundaries)' },
  earth: { B0: IGRF14_2025.B0, tiltDeg: IGRF14_2025.tiltDeg, poleLon: IGRF14_2025.poleLon, poleLat: IGRF14_2025.poleLat, momentNorth: false, offset: [22, 141, 0.089], standoff: 10.2, bowShock: 13.5, upstream: 'sun', live: true,
    source: 'IGRF-14, epoch 2025 (g10 −29350.0, g11 −1410.3, h11 4545.5 nT); eccentric-dipole offset ≈ 570 km towards the western Pacific (approx.); Shue et al. 1998 magnetopause' },
  jupiter: { B0: JRM09.B0, tiltDeg: JRM09.tiltDeg, poleLon: JRM09.poleLon, momentNorth: true, offset: null, standoff: 75, bowShock: 95, upstream: 'sun', system3: true,
    source: 'Juno JRM09 (Connerney et al. 2018): tilt 10.31° towards System III 196.6° W; stand-off 63–92 R (Joy et al. 2002)' },
  saturn: { B0: 21191, tiltDeg: 0.0, poleLon: 0, momentNorth: true, offset: null, standoff: 22, bowShock: 27, upstream: 'sun',
    source: 'Cassini Grand Finale (Dougherty et al. 2018): g10 21,191 nT, tilt < 0.007°; stand-off ~22 R (Arridge et al. 2006)' },
  uranus: { B0: 22800, tiltDeg: 58.6, poleLon: 0, momentNorth: true, offset: [-85, 135, 0.31], standoff: 18, bowShock: 23.7, upstream: 'sun', phaseUnknown: true,
    source: 'Voyager 2 offset tilted dipole (Connerney et al. 1987): 0.228 G, tilt 58.6°, offset 0.31 R; boundaries from the 1986 flyby' },
  neptune: { B0: 14200, tiltDeg: 46.9, poleLon: 0, momentNorth: true, offset: [-26, 70, 0.55], standoff: 26, bowShock: 34.9, upstream: 'sun', phaseUnknown: true,
    source: 'Voyager 2 offset tilted dipole (Connerney et al. 1991): 0.142 G, tilt 46.9°, offset 0.55 R; boundaries from the 1989 flyby' },
  ganymede: { B0: 719, tiltDeg: 4, poleLon: 0, momentNorth: false, offset: null, standoff: 2.0, bowShock: null, upstream: 'flow',
    source: 'Galileo (Kivelson et al. 2002): equatorial surface field 719 nT, moment tilted 176° from the spin axis; a mini-magnetosphere ~2 R inside Jupiter\'s, facing the corotating plasma' },
};

/** Crustal fields with no global dipole: schematic loops at mapped anomalies (lat, lon east, loop span °, height in radii). */
export const CRUSTAL = {
  mars: { source: 'MGS / MAVEN crustal field map (Langlais et al. 2019): strongest over Terra Cimmeria and Terra Sirenum; loops drawn schematically',
    loops: [[-45, 175, 6, 0.05], [-55, 180, 7, 0.06], [-60, 165, 6, 0.05], [-50, 190, 5, 0.04], [-65, 185, 6, 0.05], [-40, 160, 5, 0.04], [-70, 200, 5, 0.04], [-35, 195, 4, 0.03]] },
  moon: { source: 'Lunar Prospector / Kaguya crustal maps: Reiner Gamma, Descartes, Mare Ingenii and Crisium-antipode anomalies; loops drawn schematically',
    loops: [[7.5, -59, 5, 0.03], [-10, 15, 5, 0.03], [-34, 163, 6, 0.035], [-22, 125, 5, 0.03]] },
};

/** |B| (nT) of a dipole at r radii and θ from its axis. */
export const dipoleStrength = (B0, r, theta) => (B0 / r ** 3) * Math.sqrt(1 + 3 * Math.cos(theta) ** 2);

/** Shue et al. 1998: { r0 (Earth radii), alpha } for dynamic pressure Dp (nPa) and IMF Bz (nT). */
export function shue(Dp = 2, Bz = 0) {
  const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (Bz + 8.14))) * Dp ** (-1 / 6.6);
  const alpha = (0.58 - 0.007 * Bz) * (1 + 0.024 * Math.log(Dp));
  return { r0, alpha };
}
/** Solar-wind dynamic pressure (nPa) from proton density (cm⁻³) and speed (km/s). */
export const dynamicPressure = (n, v) => 1.6726e-6 * n * v * v;
export const magnetopauseR = (r0, alpha, theta) => r0 * (2 / (1 + Math.cos(theta))) ** alpha;
export const bowShockR = (rbs, theta, eps = 0.81) => (rbs * (1 + eps)) / (1 + eps * Math.cos(theta));

/**
 * Field lines of a dipole in its own frame (z along the north end of the axis), in body radii:
 * [{ L, phi, points: [[x, y, z, |B| nT]] }] for shells L within `maxL`, at `nPhi` magnetic longitudes,
 * from footpoint to footpoint (r = L sin²θ, starting at r = 1).
 */
export function fieldLines(B0, { shells = [1.6, 2.5, 4, 6.5, 10, 16, 26, 42, 68], maxL = Infinity, nPhi = 8, steps = 48 } = {}) {
  const out = [];
  for (const L of shells.filter((x) => x <= maxL)) {
    const th0 = Math.asin(Math.min(1, Math.sqrt(1 / L)));
    for (let k = 0; k < nPhi; k++) {
      const phi = (2 * Math.PI * k) / nPhi, pts = [];
      for (let i = 0; i <= steps; i++) {
        const th = th0 + ((Math.PI - 2 * th0) * i) / steps, r = L * Math.sin(th) ** 2;
        pts.push([r * Math.sin(th) * Math.cos(phi), r * Math.sin(th) * Math.sin(phi), r * Math.cos(th), dipoleStrength(B0, r, th)]);
      }
      out.push({ L, phi, points: pts });
    }
  }
  return out;
}
