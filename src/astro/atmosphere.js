// Clouds and ground (#83): pure, tested atmosphere models for the two worlds with a cloud layer above a
// ground you can land on, Venus and Earth.
//  · Venus: the Venus International Reference Atmosphere (VIRA; Seiff et al. 1985, Adv. Space Res. 5(11), 3),
//    low-latitude profile below 100 km, built from the Pioneer Venus probes and the Venera landers; the
//    altitudes are above the 6,052 km reference sphere.
//  · Earth: the U.S. Standard Atmosphere 1976 (NOAA/NASA/USAF), below 86 km, from its defining layers.
//  · The cloud layers: Venus' deck at its measured height (Pioneer Venus LCPS nephelometer, Knollenberg &
//    Hunten 1980), Earth's at an assumed height (the imagery has none).
//  · Light, murk and visibility in the descent (MODELLED), and the DESCEND / ASCEND state machine.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** VIRA, 0–30° latitude: [altitude km above 6,052 km, temperature K, pressure bar]. Rounded to the table's figures. */
export const VENUS_VIRA = [
  [0, 735.3, 92.1], [5, 696.8, 66.65], [10, 658.2, 47.39], [15, 620.8, 33.04], [20, 580.7, 22.52],
  [25, 539.2, 14.93], [30, 496.9, 9.851], [35, 453.7, 5.917], [40, 416.8, 3.501], [45, 383.8, 1.979],
  [50, 350.5, 1.066], [55, 302.3, 0.5314], [60, 262.8, 0.2357], [65, 243.2, 0.09765], [70, 229.8, 0.0369],
  [75, 215.4, 0.01363], [80, 197.1, 0.004476], [85, 180.6, 0.001339], [90, 169.4, 0.0003734], [100, 175.4, 0.0000266],
];
export const VENUS_REF_RADIUS_KM = 6052;
export const VIRA_SOURCE = 'VIRA (Seiff et al. 1985), from the Pioneer Venus probes and Venera landers';

/**
 * Venus at `altKm` above the 6,052 km sphere: { tK, pBar } (log-pressure and temperature interpolated; the lowlands
 * below the sphere, to −3 km, extrapolated along the lowest row's gradient; clamped above 100 km).
 */
export function venusAtmosphere(altKm) {
  const z = clamp(altKm, -3, 100), T = VENUS_VIRA;
  let i = 0;
  while (i < T.length - 2 && T[i + 1][0] < z) i++;
  const [z0, t0, p0] = T[i], [z1, t1, p1] = T[i + 1], f = (z - z0) / (z1 - z0);
  return { tK: t0 + (t1 - t0) * f, pBar: Math.exp(Math.log(p0) + (Math.log(p1) - Math.log(p0)) * f) };
}

// U.S. Standard Atmosphere 1976: geopotential layer bases (km'), lapse rates (K/km'), sea-level T and p.
const US76 = [[0, -6.5], [11, 0], [20, 1], [32, 2.8], [47, 0], [51, -2.8], [71, -2], [84.852, 0]];
const R0 = 6356.766, GMR = 34.1632; // Earth radius for geopotential (km), g0·M/R* (K/km)
export const US76_SOURCE = 'U.S. Standard Atmosphere 1976 (NOAA/NASA/USAF)';

/** Earth at geometric altitude `altKm` above mean sea level: { tK, pBar, pHpa } (US Standard Atmosphere 1976, −1 to 86 km). */
export function earthAtmosphere(altKm) {
  const z = clamp(altKm, -1, 86), h = (R0 * z) / (R0 + z); // geopotential altitude
  let T = 288.15, p = 101325;
  for (let i = 0; i < US76.length - 1; i++) {
    const [hb, L] = US76[i], top = US76[i + 1][0], dh = Math.min(h, top) - hb;
    if (dh <= 0 && i > 0) break;
    if (L === 0) p *= Math.exp((-GMR * dh) / T);
    else { const T1 = T + L * dh; p *= (T / T1) ** (GMR / L); T = T1; }
    if (h <= top) break;
  }
  return { tK: T, pBar: p / 1e5, pHpa: p / 100 };
}

/**
 * The cloud layer and the ground of each world that has both. Heights in km above the ground's reference
 * (Venus: the 6,051 km DEM sphere, near VIRA's 6,052 km; Earth: mean sea level).
 */
export const CLOUD_LAYERS = {
  venus: {
    shellKm: 70, topKm: 70, baseKm: 48, hazeTopKm: 90, lowerHazeKm: 30, assumed: false, tier: 'measured',
    superRotationDays: 4, // the cloud tops circle the planet westward in ~4 days; the ground turns once in 243 days (retrograde)
    standKm: 70.5, descentS: 40,
    note: 'Main sulphuric-acid cloud deck 48–70 km, haze above to ~90 km and below to ~30 km (Pioneer Venus LCPS: Knollenberg & Hunten 1980; Venera)',
    profile: venusAtmosphere, source: VIRA_SOURCE, refRadiusKm: VENUS_REF_RADIUS_KM,
  },
  earth: {
    // a volume drawn as stacked slices (the outermost at shellKm): each column of cloud fills the slices between
    // its base and its top. Tops are MEASURED where NOAA-20 VIIRS gives a cloud-top height (GIBS); otherwise the
    // whole layer is ASSUMED: base 2 km, tops 10 km. Bases are always modelled (the product has no cloud base).
    shellKm: 12.5, topKm: 10, baseKm: 2, assumed: true, tier: 'modelled',
    slicesKm: [1, 2, 3.5, 5, 6.5, 8, 9.5, 11, 12.5],
    standKm: 10.8, descentS: 30,
    note: 'Cloud heights ASSUMED where no cloud-top height is measured: a layer from 2 km (base) to 10 km (tops). Real clouds lie from ~0.5 km (stratus) to ~15 km (anvils)',
    profile: earthAtmosphere, source: US76_SOURCE, refRadiusKm: 6371,
  },
};

/** The layer record for a body, or null. */
export const cloudLayer = (id) => CLOUD_LAYERS[id] ?? null;

/**
 * The cloud column over a spot: { topKm, baseKm, standKm, measured }. Venus: its measured deck. Earth: with a
 * measured cloud-top height `topKm` (VIIRS), the top is that and the base is MODELLED (the top less 45% of its
 * height, 0.8–4 km thick, never below 0.3 km); without one, the ASSUMED 2–10 km layer.
 */
export function cloudColumn(id, topKm = null) {
  const L = cloudLayer(id);
  if (!L) return null;
  if (id !== 'earth' || !(topKm > 0)) return { topKm: L.topKm, baseKm: L.baseKm, standKm: L.standKm, measured: id !== 'earth' };
  const thick = clamp(0.45 * topKm, 0.8, 4), baseKm = Math.max(0.3, topKm - thick);
  return { topKm, baseKm: Math.min(baseKm, topKm), standKm: topKm + 0.8, measured: true };
}

/** Does Earth's slice at `hKm` draw a column from `baseKm` to `topKm`? Those inside it, and always the slice nearest its top. */
export function sliceDraws(hKm, topKm, baseKm, slices = CLOUD_LAYERS.earth.slicesKm) {
  if (hKm >= baseKm - 1e-6 && hKm <= topKm + 1e-6) return true;
  let best = slices[0];
  for (const s of slices) if (Math.abs(s - topKm) < Math.abs(best - topKm)) best = s;
  return Math.abs(best - hKm) < 1e-6;
}
/** How many slices draw that column (≥ 1). */
export const slicesInColumn = (topKm, baseKm, slices = CLOUD_LAYERS.earth.slicesKm) => slices.filter((h) => sliceDraws(h, topKm, baseKm, slices)).length;
/** Opacity of each of `n` stacked slices so that together they show the column's opacity `a`. */
export const sliceAlpha = (a, n) => 1 - Math.pow(1 - clamp(a, 0, 1), 1 / Math.max(1, n));

/** The atmosphere at `altKm` above the body's reference: { tK, tC, pBar, source } or null. */
export function atmosphereAt(id, altKm) {
  const L = cloudLayer(id);
  if (!L) return null;
  const a = L.profile(altKm);
  return { ...a, tC: a.tK - 273.15, source: L.source };
}

/**
 * How much of the view the cloud hides at `altKm` (0 clear … 1 opaque), MODELLED: Venus' deck is a bright
 * murk from its top (70 km) down to ~48 km, thinning through the lower haze to ~30 km and clear below;
 * Earth's cloud fills the column from its base to its top (`col`, from cloudColumn: measured top or the assumed
 * 2–10 km), as thick as there is cloud over the spot (`cover`, 0…1, from the imagery), thinning over ~0.4 km at
 * the base and the top.
 */
export function murk(id, altKm, cover = 1, col = null) {
  const L = cloudLayer(id);
  if (!L) return 0;
  if (id === 'venus') {
    if (altKm >= L.topKm + 2) return 0;
    if (altKm >= L.baseKm) return 0.97 * smooth(L.topKm + 2, L.topKm - 4, altKm);
    return 0.97 * smooth(L.lowerHazeKm, L.baseKm, altKm);
  }
  const c = col ?? cloudColumn(id);
  const inside = smooth(c.baseKm - 0.2, c.baseKm + 0.2, altKm) * (1 - smooth(c.topKm - 0.2, c.topKm + 0.2, altKm));
  return 0.88 * clamp(cover, 0, 1) * inside;
}

/**
 * Sunlight reaching `altKm` as a fraction of the light above the clouds (MODELLED from the Venera 11–14 and
 * Pioneer Venus flux measurements: ~2–3% at Venus' surface, mostly lost in the deck; Earth's shell drawn as
 * a typical overcast that passes ~30%).
 */
export function lightFraction(id, altKm) {
  if (id === 'venus') {
    const pts = [[0, 0.025], [30, 0.045], [48, 0.08], [55, 0.2], [62, 0.45], [70, 1]];
    if (altKm >= 70) return 1;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] < altKm) i++;
    const [a0, f0] = pts[i], [a1, f1] = pts[i + 1], f = clamp((altKm - a0) / (a1 - a0), 0, 1);
    return Math.exp(Math.log(f0) + (Math.log(f1) - Math.log(f0)) * f);
  }
  if (id === 'earth') return 1;
  return 1;
}

/** Is the Sun's disc visible from `altKm`? Not from inside or below Venus' deck. */
export const sunVisible = (id, altKm) => !(id === 'venus' && altKm < CLOUD_LAYERS.venus.topKm - 2);

/**
 * Rayleigh extinction (per km) near `altKm`, MODELLED: Earth's sea-level air scatters ~0.0116 /km at 550 nm;
 * CO₂ scatters ~2.5× more per molecule, and Venus' surface gas is ~50× denser in molecules, so ~1 /km there:
 * a few kilometres of visibility, the far landscape fading into the orange murk.
 */
export function extinctionPerKm(id, altKm) {
  if (id === 'venus') {
    const a = venusAtmosphere(Math.max(0, altKm)), s = venusAtmosphere(0);
    return 1.0 * (a.pBar / s.pBar) * (s.tK / a.tK);
  }
  if (id === 'earth') {
    const a = earthAtmosphere(Math.max(0, altKm));
    return 0.0116 * (a.pBar / 1.01325) * (288.15 / a.tK);
  }
  return 0;
}
/** Koschmieder visibility (km) from an extinction coefficient: 3.912 / β. */
export const visibilityKm = (beta) => (beta > 0 ? 3.912 / beta : Infinity);

/** Which layer is the camera at? 'above' (over the clouds), 'in' (inside them), 'below' (under them, above the ground). */
export function layerAt(id, altKm, col = null) {
  const L = cloudLayer(id);
  if (!L) return 'below';
  if (id === 'venus') return altKm > L.topKm ? 'above' : altKm >= L.baseKm ? 'in' : 'below';
  const c = col ?? cloudColumn(id);
  return altKm > c.topKm + 0.15 ? 'above' : altKm >= c.baseKm - 0.15 ? 'in' : 'below';
}

// ---- DESCEND / ASCEND --------------------------------------------------------------------------
// Altitude above the ground (km). The flight eases in log(altitude + 5 km), so it slows towards the ground.
export const GROUND_EYE_KM = 0.002; // the surface camera stands 2 m above the DEM's ground
const DESCENT_EASE_KM = 5; // log(altitude + 5 km): the cloud deck and the haze get ~30% of the flight, the last kilometre ~8%

/** Altitude (km) a fraction `f` (0…1) of the way from `fromKm` to `toKm`, eased (smoothstep) in log altitude. */
export function descentAltitude(fromKm, toKm, f) {
  const t = smooth(0, 1, f), e = DESCENT_EASE_KM;
  const a = Math.log(Math.max(fromKm, 0) + e), b = Math.log(Math.max(toKm, 0) + e);
  return Math.max(0, Math.exp(a + (b - a) * t) - e);
}

/**
 * The descent state: { phase: 'top' | 'down' | 'ground' | 'up', altKm, fromKm, toKm, t0, dur }.
 * Pure: every step takes the time `now` in seconds.
 */
export function createDescent(id, { at = 'top' } = {}) {
  const L = cloudLayer(id);
  const top = L?.standKm ?? GROUND_EYE_KM, ground = GROUND_EYE_KM;
  return at === 'ground' || !L ? { phase: 'ground', altKm: ground, fromKm: ground, toKm: ground, t0: 0, dur: 0, top, ground }
    : { phase: 'top', altKm: top, fromKm: top, toKm: top, t0: 0, dur: 0, top, ground };
}
/** Start descending (or ascending) at time `now` (s) from wherever the camera is; durations scale with the height to cover. */
export function startDescent(st, dir, now, fullS = 30) {
  const toKm = dir === 'down' ? st.ground : st.top;
  if (Math.abs(st.altKm - toKm) < 1e-6) return { ...st, phase: dir === 'down' ? 'ground' : 'top' };
  const e = DESCENT_EASE_KM, span = Math.abs(Math.log(st.altKm + e) - Math.log(toKm + e)) / Math.abs(Math.log(st.top + e) - Math.log(st.ground + e));
  return { ...st, phase: dir, fromKm: st.altKm, toKm, t0: now, dur: Math.max(2, fullS * span) };
}
/** Advance to time `now` (s). */
export function stepDescent(st, now) {
  if (st.phase !== 'down' && st.phase !== 'up') return st;
  const f = clamp((now - st.t0) / st.dur, 0, 1);
  const altKm = descentAltitude(st.fromKm, st.toKm, f);
  if (f >= 1) return { ...st, altKm: st.toKm, phase: st.phase === 'down' ? 'ground' : 'top' };
  return { ...st, altKm };
}
