// The solar corona in 3D (#79): the physics and the honesty, kept free of three.js so it can be tested.
// src/views/system/corona.js ray-marches a volume around the Sun from what this module returns:
//   coronaLook(band, pass)       what dominates in the band, how fast it fades, its colour and how bright it is
//                                next to the disc (honest ratio, and the exaggeration used to show it)
//   structureFromFeed / modelledStructure   where streamers, active regions and coronal holes are: measured on
//                                today's SOHO LASCO and SDO AIA images (server/corona.js), else a solar-cycle model
//   imageToDir, paToDir, beltNormal          image and sky coordinates → directions in the Sun's own frame
//                                (y = rotation axis), the same projection the disc images use (materials.js)
//   coronaLayers(look, structure)            the rows of the Sun's CORONA panel, each with its badge
//
// Physics, with sources:
//   White light (K + F corona): Baumbach (1937) mean eclipse brightness B(r)/B☉ = 10⁻⁶ (0.0532 r^-2.5 +
//     1.425 r^-7 + 2.565 r^-17) (Allen's Astrophysical Quantities, §14.2). The r^-2.5 term is mostly the dust
//     (F) corona; the steep terms the electron (K) corona. Each term r^-k is the line-of-sight integral of an
//     emissivity r^-(k+1) / (√π Γ(k/2) / Γ((k+1)/2)), so the ray march reproduces Baumbach exactly.
//   Electron density: Baumbach–Allen n_e(r) = 10⁸ (0.036 r^-1.5 + 1.55 r^-6 + 2.99 r^-16) cm⁻³.
//   EUV / soft X-rays: optically thin, emission ∝ n_e², hydrostatic with gravity ∝ 1/r²:
//     n ∝ exp(−(r − 1) / (H r)), H = k T / (μ m_p g☉) ≈ 0.072 R☉ per MK (μ = 0.6).
//   Radio: the corona is optically thick (free–free) out to the radio Sun's radius 1 + 0.12 f_GHz^-0.8
//     (Shibasaki, Alissandrakis & Pohjolainen 2011; the same law as server/solarmodel.js), at ~10⁶ K.

const RSUN_M = 6.957e8, G_SUN = 274.0, K_B = 1.380649e-23, M_P = 1.67262192e-27;

// ---- maths -------------------------------------------------------------------------------------------
/** Γ(x) for x > 0 (Lanczos, g = 7). */
export function gamma(x) {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
}
/** ∫ (b² + s²)^(−(k+1)/2) ds over the whole line = b^−k · this. */
export const losFactor = (k) => (Math.sqrt(Math.PI) * gamma(k / 2)) / gamma((k + 1) / 2);

// ---- white light ---------------------------------------------------------------------------------------
export const BAUMBACH = [[0.0532, 2.5], [1.425, 7], [2.565, 17]];
/** Baumbach (1937): white-light coronal brightness (K + F) at r R☉, in units of 10⁻⁶ of the mean disc brightness. */
export const baumbach = (r) => BAUMBACH.reduce((s, [c, k]) => s + c * r ** -k, 0);
/** The emissivity terms [coefficient, power] whose line-of-sight integrals are Baumbach's terms (index 0: F, 1–2: K). */
export const EMISSIVITY = BAUMBACH.map(([c, k]) => [c / losFactor(k), k + 1]);
export const kEmissivity = (r) => EMISSIVITY[1][0] * r ** -EMISSIVITY[1][1] + EMISSIVITY[2][0] * r ** -EMISSIVITY[2][1];
export const fEmissivity = (r) => EMISSIVITY[0][0] * r ** -EMISSIVITY[0][1];
/** Baumbach–Allen electron density (cm⁻³). */
export const electronDensity = (r) => 1e8 * (0.036 * r ** -1.5 + 1.55 * r ** -6 + 2.99 * r ** -16);

/** Line-of-sight integral of emissivity j(r) at impact parameter b (R☉), out to rMax; inside the disc (b < 1) only the part in front of it. */
export function losIntegral(j, b, { rMax = 60, n = 2000 } = {}) {
  const sMax = Math.sqrt(Math.max(0, rMax * rMax - b * b)), s0 = b < 1 ? Math.sqrt(1 - b * b) : 0, L = sMax - s0;
  let sum = 0;
  for (let i = 0; i <= n; i++) { // s = s0 + L t³: samples crowd where the emissivity is steepest
    const t = i / n, s = s0 + L * t ** 3, w = (i === 0 || i === n ? 0.5 : 1) * 3 * L * t * t / n;
    sum += j(Math.sqrt(b * b + s * s)) * w;
  }
  return b >= 1 ? 2 * sum : sum;
}
/** Logarithmic slope −d ln B / d ln r of a brightness law between r1 and r2. */
export const falloffIndex = (B, r1, r2) => Math.log(B(r1) / B(r2)) / Math.log(r2 / r1);

// ---- EUV, X-ray, radio -----------------------------------------------------------------------------------
/** Hydrostatic density scale height at the coronal base (R☉) for T in MK (μ = 0.6). */
export const scaleHeight = (tMK) => (K_B * tMK * 1e6) / (0.6 * M_P * G_SUN) / RSUN_M;
/** Optically thin EUV emissivity (∝ n²) at r for scale height H (R☉), 1 at the base. */
export const euvEmissivity = (r, H) => Math.exp((-2 * (r - 1)) / (H * r));
/** The radio Sun's radius (R☉) at f GHz (Shibasaki et al. 2011), as in server/solarmodel.js. */
export const radioRadius = (fGHz) => 1 + 0.12 * fGHz ** -0.8;
/** Peak formation temperature (MK) of the SDO AIA EUV channels, by wavelength in Å (Lemen et al. 2012). */
export const AIA_TEMP_MK = { 94: 6.3, 131: 10, 171: 0.63, 193: 1.6, 211: 2.0, 304: 0.05, 335: 2.5 };
/** Helioviewer's AIA colour tables, roughly (so the corona matches the disc image's colours). */
export const AIA_RGB = { 94: [0.45, 1, 0.6], 131: [0.35, 0.95, 1], 171: [1, 0.78, 0.25], 193: [1, 0.62, 0.3], 211: [0.95, 0.45, 0.95], 304: [1, 0.35, 0.12], 335: [0.4, 0.55, 1], 1600: [1, 0.85, 0.35], 1700: [1, 0.6, 0.55] };
const PAL = { radio: [1, 0.55, 0.15], microwave: [0.3, 0.85, 1], infrared: [1, 0.45, 0.2], visible: [1, 1, 1], ultraviolet: [0.7, 0.55, 1], xray: [0.4, 0.9, 1], gamma: [1, 0.4, 0.9] };
const nearestAia = (nm) => {
  const a = nm * 10;
  return Object.keys(AIA_TEMP_MK).map(Number).find((k) => Math.abs(a - k) / k < 0.03) ?? null;
};

// ---- the look in a band ----------------------------------------------------------------------------------
const exp10 = (v) => { const e = Math.floor(Math.log10(v)); return `${(v / 10 ** e).toFixed(e < 0 && v / 10 ** e < 1.05 ? 0 : 1).replace(/\.0$/, '')}×10${String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`; };
/** White light at impact b, as a fraction of the mean disc brightness. */
export const whiteRatio = (b) => baumbach(b) * 1e-6;
/** A typical display brightness for the corona at 1.5 R☉ (the disc is ~1): what the exaggeration is chosen to give. */
const SHOWN_AT_1_5 = 0.03;

/**
 * How the corona looks in the current band (null pass/band → full spectrum, seen as white light):
 * { kind, label, why, nm, rgb, weights: { k, f, euv, radio, loops, gyro }, H, rTau, extent (R☉), gain, onDisc,
 *   ratio (corona/disc at 1.5 R☉, or at the limb), ratioText, exaggeration (≥ 1), structure: { streamers, holes, plumes, wisps } }
 * or { kind: 'none', … } where the quiet corona emits nothing measurable.
 */
export function coronaLook(band, pass, { effNm = null } = {}) {
  const id = band?.id ?? 'full';
  const nm = id === 'full' ? 550 : effNm ?? null;
  const pal = PAL[band?.palette] ?? [1, 1, 1];
  const base = { nm, onDisc: 0, H: 0.1, rTau: 1, gyro: 0, structure: { streamers: 1, holes: 1, plumes: 1, wisps: 1 } };
  if (nm == null) return { ...base, kind: 'none', label: 'NO CORONA MODEL FOR THIS CURVE', why: 'The curve has no effective wavelength.', rgb: [0, 0, 0], weights: {}, extent: 1, gain: 0, ratio: 0, ratioText: '—', exaggeration: 1 };
  // gamma rays and hard X-rays: only flares; the quiet corona is not seen
  if (nm < 0.1) return { ...base, kind: 'none', label: 'NOT OBSERVED: NO QUIET-CORONA EMISSION', rgb: [0, 0, 0], weights: {}, extent: 1, gain: 0, ratio: 0, ratioText: 'NONE DETECTED',
    why: 'Above ~10 keV the corona shows up only during flares (bremsstrahlung from loop tops and footpoints; RHESSI, Fermi GBM); the quiet corona at 1–3 MK emits essentially nothing here.', exaggeration: 1 };
  // EUV and soft X-rays (0.1–40 nm): hot, optically thin plasma; loops and the limb are as bright as the disc
  if (nm < 40) {
    const aia = nearestAia(nm), tMK = aia ? AIA_TEMP_MK[aia] : 3, H = scaleHeight(Math.max(0.6, Math.min(tMK, 4)));
    const chromo = aia === 304;
    const ratio = losIntegral((r) => euvEmissivity(r, H), 1 + H / 2) / losIntegral((r) => euvEmissivity(r, H), 0.0); // limb vs disc centre
    return { ...base, kind: 'euv', nm, H, rgb: aia ? AIA_RGB[aia] : pal, onDisc: 0.3,
      label: chromo ? 'EUV 304 Å: CHROMOSPHERE, PROMINENCES AND A THIN HOT CORONA' : `EUV ${aia ? `${aia} Å` : 'SOFT X-RAYS'}: HOT LOOPS (${tMK >= 1 ? tMK.toFixed(1) : tMK.toFixed(2)} MK)`,
      why: `Optically thin plasma at ~${tMK} MK glowing in emission lines (∝ density²). It fades with the hydrostatic scale height H = ${H.toFixed(2)} R☉ (kT/μm_p g), so the corona hugs the Sun; loops over active regions dominate, coronal holes are dark. Off the limb it is about as bright as the disc, so it is drawn to scale.`,
      weights: { k: 0, f: 0, euv: chromo ? 0.5 : 1, radio: 0, loops: chromo ? 0.6 : 1 }, extent: chromo ? 1.6 : Math.min(2.6, 1.4 + 10 * H),
      gain: 1, ratio, ratioText: 'COMPARABLE TO THE DISC, LIMB-BRIGHTENED', exaggeration: 1, structure: { streamers: 0.25, holes: 1, plumes: 0.6, wisps: 0.6 } };
  }
  // far and near UV (40–400 nm): the photosphere/chromosphere; Lyman-α has its own (resonantly scattered) corona
  if (nm < 400) {
    const lya = nm > 115 && nm < 128, ratio = lya ? 1e-6 : 3e-8;
    return { ...base, kind: lya ? 'lya' : 'uv', rgb: lya ? pal : (nearestAia(nm) ? AIA_RGB[nearestAia(nm)] : pal),
      label: lya ? 'LYMAN-α CORONA: HYDROGEN SCATTERING SUNLIGHT' : 'ULTRAVIOLET: A FAINT SCATTERED CORONA',
      why: lya ? 'Neutral hydrogen left in the corona resonantly scatters the disc\'s Lyman-α (SOHO UVCS, Solar Orbiter Metis): it traces the same streamers as white light, ~10⁻⁶ of the disc at 1.5 R☉.'
        : 'The photosphere and chromosphere dominate; the corona is only electron-scattered light, as in white light but fainter against a UV-bright disc.',
      weights: { k: 1, f: lya ? 0 : 0.6, euv: 0, radio: 0, loops: 0 }, extent: 6, gain: SHOWN_AT_1_5 / whiteRatio(1.5) * (lya ? 0.8 : 0.5), onDisc: 0, ratio,
      ratioText: `~${exp10(ratio)} OF THE DISC AT 1.5 R☉`, exaggeration: (SHOWN_AT_1_5 * (lya ? 0.8 : 0.5)) / ratio };
  }
  // visible and near IR (0.4–2.5 µm): electrons (K) close in, dust (F) further out and growing redwards
  if (nm < 2500) {
    const f = nm < 1000 ? 0.3 : 0.3 + (nm - 1000) / 1000, ratio = whiteRatio(1.5); // Baumbach's r^-2.5 term holds the F corona and part of the K; drawn fainter so streamers read
    return { ...base, kind: 'white', rgb: id === 'full' || id === 'visible' ? [1, 0.97, 0.92] : pal,
      label: nm < 1000 ? 'WHITE LIGHT: K-CORONA STREAMERS + F-CORONA' : 'NEAR INFRARED: K-CORONA INSIDE, DUST F-CORONA OUTSIDE',
      why: `Photospheric light scattered by free electrons (K corona: streamers, polar plumes) and by interplanetary dust (F corona, beyond ~2–3 R☉, brighter towards the infrared). Brightness falls from the Baumbach (1937) law, ≈ r^${falloffIndex(baumbach, 1.5, 3).toFixed(1).replace(/^/, '-')} between 1.5 and 3 R☉: about ${exp10(ratio)} of the disc at 1.5 R☉, which is why it is seen only in eclipses or coronagraphs.`,
      weights: { k: 1, f, euv: 0, radio: 0, loops: 0 }, extent: nm < 1000 ? 6 : 8, gain: SHOWN_AT_1_5 / ratio, ratio, ratioText: `${exp10(ratio)} OF THE DISC AT 1.5 R☉ (BAUMBACH)`, exaggeration: SHOWN_AT_1_5 / ratio };
  }
  // thermal infrared (2.5 µm–1 mm): the dust corona glows
  if (nm < 1e6) {
    const ratio = 1e-6;
    return { ...base, kind: 'dust', rgb: pal, label: 'THERMAL INFRARED: THE DUST (F) CORONA',
      why: 'Interplanetary dust near the Sun, heated to ~1000 K, glows in the infrared and scatters sunlight; it is flattened towards the ecliptic and thins out close in, where dust sublimates (the predicted dust-free zone, a few R☉; Parker Solar Probe saw the dust thinning inside ~19 R☉). Order of magnitude 10⁻⁶ of the disc.',
      weights: { k: 0.15, f: 4, euv: 0, radio: 0, loops: 0 }, extent: 12, gain: (SHOWN_AT_1_5 / whiteRatio(1.5)) * 2.5, ratio, ratioText: '~10⁻⁶ OF THE DISC (ORDER OF MAGNITUDE)', exaggeration: (SHOWN_AT_1_5 * 2.5) / ratio,
      structure: { streamers: 0.3, holes: 0.2, plumes: 0, wisps: 0.4 } };
  }
  // microwaves (1 mm–3 cm) and radio (> 3 cm): the corona is the source
  const fGHz = 299792458 / (nm * 1e-9) / 1e9, rTau = radioRadius(fGHz), radio = nm >= 3e7;
  return { ...base, kind: radio ? 'radio' : 'microwave', rgb: pal, rTau, gyro: !radio && fGHz < 20 ? 1 : 0,
    label: radio ? `RADIO: THE CORONA ITSELF, ${rTau.toFixed(2)} R☉ ACROSS` : `MICROWAVE: THE TRANSITION REGION, GYRO-RESONANCE OVER ACTIVE REGIONS`,
    why: radio ? `At ${fGHz < 1 ? `${Math.round(fGHz * 1000)} MHz` : `${fGHz.toFixed(1)} GHz`} the ~10⁶ K corona is optically thick (free–free absorption), so the radio Sun is the corona: ${rTau.toFixed(2)}× the optical disc (Shibasaki et al. 2011), brightest over streamers and active regions. Drawn to scale against the disc.`
      : `At ${fGHz.toFixed(0)} GHz the emission comes from the chromosphere and transition region, just above the optical limb (radio radius ${rTau.toFixed(3)} R☉)${fGHz < 20 ? '; strong fields over active regions add compact gyro-resonance sources at coronal temperatures' : ''}. Drawn to scale.`,
    weights: { k: 0, f: 0, euv: 0, radio: 1, loops: 0 }, H: 0.12, extent: radio ? Math.min(4, 1 + (rTau - 1) * 6 + 0.6) : 1.4, gain: 1, onDisc: 0.15,
    ratio: radio ? 1 : 0.1, ratioText: radio ? 'AS BRIGHT AS THE DISC (IT IS THE DISC)' : '~0.1 OF THE DISC JUST OFF THE LIMB', exaggeration: 1,
    structure: { streamers: radio ? 0.6 : 0.2, holes: 0.8, plumes: 0, wisps: 0.3 } };
}

/** The radio corona's absorption coefficient: radial optical depth 1 at rTau for emission ∝ n_e² (normalised to 1 at r = 1). */
export function radioAbsorption(rTau) {
  const n0 = electronDensity(1), j = (r) => (electronDensity(r) / n0) ** 2;
  let tau = 0;
  const steps = 4000, L = 30 - rTau;
  for (let i = 0; i < steps; i++) { // r = rTau + L t³ (midpoints): the integrand falls steeply from rTau
    const t = (i + 0.5) / steps;
    tau += j(rTau + L * t ** 3) * 3 * L * t * t / steps;
  }
  return 1 / tau;
}

// ---- the solar cycle -----------------------------------------------------------------------------------
const MINIMA = [1996.4, 2008.96, 2019.96]; // cycle 23, 24, 25 minima (SIDC)
const yearOf = (jd) => 2000 + (jd - 2451545) / 365.25;
/** Solar-cycle activity 0 (minimum) … 1 (maximum) at Julian date jd: cycle 25 peaked in late 2024; later cycles assumed 11 yr long. */
export function cycleActivity(jd) {
  const y = yearOf(jd);
  let m = MINIMA[0];
  for (const x of MINIMA) if (y >= x) m = x;
  while (y >= m + 11) m += 11;
  const x = (y - m) / 11, xm = 4.85 / 11; // rise ~4.85 yr, decay ~6 yr
  return x < xm ? Math.sin((Math.PI / 2) * (x / xm)) ** 2 : Math.cos((Math.PI / 2) * ((x - xm) / (1 - xm))) ** 2;
}
/** Phase words for the panel. */
export const cycleWords = (jd) => { const a = cycleActivity(jd), y = yearOf(jd); let m = MINIMA[0]; for (const x of MINIMA) if (y >= x) m = x; while (y >= m + 11) m += 11; const rising = y - m < 4.85; return a > 0.8 ? 'NEAR MAXIMUM' : a < 0.2 ? 'NEAR MINIMUM' : rising ? 'RISING PHASE' : 'DECLINING PHASE'; };

// ---- structure -----------------------------------------------------------------------------------------
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (...vs) => vs.reduce((s, v) => s.map((x, i) => x + v[i]), [0, 0, 0]);
const mul = (v, k) => v.map((x) => x * k);
/** The image axes of a solar disc image seen from direction E (unit, towards the observer), north N: { right (west), up (north) }, as the star shader (materials.js) projects them. */
export function imageAxes(E, N) {
  const up = norm(add(N, mul(E, -dot(N, E))));
  return { up, right: norm(cross(mul(E, -1), up)) };
}
/** A point on a disc image (x west, y north, in disc radii) → the direction from the Sun's centre to that point on the visible hemisphere. */
export function imageToDir(x, y, E, N) {
  const { up, right } = imageAxes(E, N), z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return norm(add(mul(right, x), mul(up, y), mul(E, z)));
}
/** A position angle on the sky (degrees from solar north through east) → the direction in the plane of the sky. */
export function paToDir(pa, E, N) {
  const a = (pa * Math.PI) / 180;
  return imageToDir(-Math.sin(a), Math.cos(a), E, N);
}
/** The streamer belt through the limb latitudes east and west (degrees): { n (belt pole), sinLat0 }: belt points satisfy d·n = sinLat0. */
export function beltNormal(east, west, E, N) {
  const lw = (west ?? east) * Math.PI / 180, le = (east ?? west) * Math.PI / 180;
  const lat0 = (lw + le) / 2, tau = (lw - le) / 2, { right } = imageAxes(E, N);
  return { n: norm(add(mul(N, Math.cos(tau)), mul(right, -Math.sin(tau)))), sinLat0: Math.sin(lat0) };
}

// deterministic pseudo-random numbers for the modelled structure (the same every time for one rotation)
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; };
/** Carrington-like rotation number at jd (27.2753 d synodic, from 1853-11-09). */
const rotation = (jd) => (jd - 2398167.4) / 27.2753;

/**
 * Today's structure from the backend feed (server/corona.js), in image and sky coordinates, or null when it is missing
 * or more than `maxDays` from the clock (then the structure is modelled for the clock's date).
 */
export function structureFromFeed(data, jd, { maxDays = 14 } = {}) {
  if (!data) return null;
  const t = data.sources?.euv?.time ?? data.sources?.coronagraph?.time;
  if (!t || Math.abs(jd - (Date.parse(t) / 86400000 + 2440587.5)) > maxDays) return null;
  const top = Math.max(1e-6, ...(data.streamers ?? []).map((s) => s.strength));
  return {
    source: 'measured', time: t, sources: data.sources ?? {},
    streamers: (data.streamers ?? []).map((s) => ({ pa: s.pa, width: Math.max(4, Math.min(40, s.width * 0.6)), strength: Math.min(1, s.strength / top) })),
    belt: data.belt ?? null,
    regions: (data.regions ?? []).map((r) => ({ x: r.x, y: r.y, size: Math.max(0.08, r.size), strength: Math.min(1, (r.strength - 1) / 1.5) })),
    holes: (data.holes ?? []).map((h) => ({ x: h.x, y: h.y, size: h.size, depth: Math.min(1, h.depth) })),
    activity: cycleActivity(jd),
  };
}

/**
 * A solar-cycle-appropriate corona for date jd (no imagery, or the clock far from today): a streamer belt tilted
 * ~10° at minimum to ~70° at maximum, polar coronal holes large at minimum and gone at maximum, and active regions
 * in number and latitude following the cycle (Spörer's law), at illustrative longitudes that turn with the Sun.
 * Directions here are in the Sun's frame (y = north, longitude 0 = the observer's central meridian).
 */
export function modelledStructure(jd) {
  const a = cycleActivity(jd), rot = rotation(jd), r = rnd(Math.floor(rot) * 7919 + 17);
  const turn = (rot % 1) * 2 * Math.PI; // the Sun turns once per synodic rotation under the observer
  const lonDir = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  const tilt = ((10 + 60 * a) * Math.PI) / 180, phase = r() * 2 * Math.PI + turn;
  const n = norm([Math.sin(tilt) * Math.sin(phase + Math.PI / 2), Math.cos(tilt), Math.sin(tilt) * Math.cos(phase + Math.PI / 2)]);
  const count = Math.round(2 + 8 * a), meanLat = 0.45 - 0.3 * Math.min(1, Math.max(0, a)); // ~25° early, lower later
  const regions = Array.from({ length: count }, () => {
    const lat = (r() < 0.5 ? -1 : 1) * (meanLat * 0.6 + r() * meanLat * 0.8), lon = r() * 2 * Math.PI + turn; // features drift west (Stonyhurst longitude grows)
    return { dir: lonDir(lat, lon), size: 0.08 + r() * 0.1, strength: 0.4 + 0.6 * r() };
  });
  return {
    source: 'modelled', activity: a, belt3d: { n, sinLat0: 0 }, streamers3d: [], regions3d: regions, holes3d: [],
    polar: { lat: 55 + 30 * a, depth: 0.85 * (1 - a) },
  };
}

/**
 * Resolve a structure into directions in the Sun's frame for observer direction E and pole N (unit vectors in that frame):
 * { belt: { n, sinLat0 }, streamers: [{ dir, width (rad), strength }], regions: [{ dir, size, strength }], holes: [{ dir, size, depth }], polar }.
 */
export function resolveStructure(s, E, N) {
  if (s.source === 'modelled') { // from its own frame (observer +z, north +y) into this one
    const z = norm(add(E, mul(N, -dot(E, N)))), x = cross(N, z), to = (v) => norm(add(mul(x, v[0]), mul(N, v[1]), mul(z, v[2])));
    return { belt: { n: to(s.belt3d.n), sinLat0: s.belt3d.sinLat0 }, streamers: [], regions: s.regions3d.map((g) => ({ ...g, dir: to(g.dir) })), holes: [], polar: s.polar };
  }
  const a = s.activity ?? 0.5;
  const belt = s.belt ? beltNormal(s.belt.east, s.belt.west, E, N) : { n: N, sinLat0: 0 };
  // polar holes: measured on the disc when one sits near a pole, else as the cycle suggests
  const polarHole = (s.holes ?? []).some((h) => Math.abs(h.y) > 0.6);
  return {
    belt,
    streamers: s.streamers.map((t) => ({ dir: paToDir(t.pa, E, N), width: (t.width * Math.PI) / 180, strength: t.strength })),
    regions: s.regions.map((g) => ({ dir: imageToDir(g.x, g.y, E, N), size: g.size, strength: g.strength })),
    holes: s.holes.map((h) => ({ dir: imageToDir(h.x, h.y, E, N), size: h.size, depth: h.depth })),
    polar: { lat: 55 + 30 * a, depth: polarHole ? 0.8 : 0.85 * (1 - a) },
  };
}

// ---- the panel -------------------------------------------------------------------------------------------
const when = (t) => (t ? t.slice(0, 16).replace('T', ' ') + ' UTC' : '—');
/** The CORONA rows: [{ label, value, tier, detail }]. */
export function coronaLayers(look, s, { jd = null, eclipse = null } = {}) {
  const rows = [];
  if (!look) return rows;
  if (look.kind === 'none') return [{ label: 'IN THIS BAND', value: look.label, tier: 'computed', detail: look.why }];
  rows.push({ label: 'IN THIS BAND', value: look.label, tier: 'modelled', detail: look.why });
  const cg = s?.sources?.coronagraph, euv = s?.sources?.euv;
  if (s?.source === 'measured' && cg) rows.push({ label: 'STREAMERS', value: `${s.streamers.length} FROM ${cg.instrument} · ${when(cg.time)}`, tier: 'modelled',
    detail: `Position angles and widths MEASURED on the ${cg.instrument} white-light image (${cg.credit}); a coronagraph sees them projected on the sky, so they are placed in the plane of the sky (MODELLED), with a belt through the limb streamers nearest the equator.` });
  else rows.push({ label: 'STREAMERS', value: `MODELLED BELT · ${jd ? cycleWords(jd) : 'SOLAR CYCLE'}`, tier: 'modelled',
    detail: 'No coronagraph image within 14 days of the clock: a streamer belt tilted as the solar cycle suggests (~10° at minimum, ~70° at maximum), at an illustrative orientation.' });
  if (s?.source === 'measured' && euv) {
    rows.push({ label: 'ACTIVE-REGION LOOPS', value: `${s.regions.length} REGIONS FROM ${euv.instrument} · ${when(euv.time)}`, tier: 'modelled',
      detail: `Bright patches MEASURED on today's ${euv.instrument} disc (${euv.credit}), placed where the disc image shows them; the loop arcades over them are MODELLED shapes (size from the patch, east–west, tilted by Joy's law).` });
    rows.push({ label: 'CORONAL HOLES · PLUMES', value: `${s.holes.length} HOLES FROM ${euv.instrument}`, tier: 'modelled',
      detail: 'Dark patches MEASURED on the EUV disc are coronal holes: thinner corona, opening outwards (MODELLED expansion), with polar plumes drawn as fine rays inside them (positions IMAGINED).' });
  } else {
    rows.push({ label: 'ACTIVE-REGION LOOPS', value: `${s?.regions3d?.length ?? 0} ILLUSTRATIVE · CYCLE-APPROPRIATE`, tier: 'imagined',
      detail: 'Number and latitudes follow the solar cycle (Spörer\'s law, MODELLED); their longitudes are illustrative, not observed.' });
    rows.push({ label: 'CORONAL HOLES · PLUMES', value: 'POLAR HOLES · MODELLED', tier: 'modelled', detail: 'Polar coronal holes are large near solar minimum and vanish near maximum.' });
  }
  rows.push({ label: 'FALL-OFF', value: look.kind === 'euv' ? `HYDROSTATIC · H = ${look.H.toFixed(2)} R☉` : look.kind === 'radio' || look.kind === 'microwave' ? `OPTICALLY THICK TO ${look.rTau.toFixed(2)} R☉` : `BAUMBACH: r^-${falloffIndex(baumbach, 1.5, 3).toFixed(1)} (1.5–3 R☉)`, tier: 'modelled',
    detail: look.kind === 'euv' ? 'Emission ∝ n², n ∝ exp(−(r−1)/(H r)), H = kT/(μ m_p g☉).' : look.kind === 'radio' || look.kind === 'microwave' ? 'Free–free emission ∝ n_e² (Baumbach–Allen density), with an absorption that makes the corona opaque inside the radio radius (Shibasaki et al. 2011).' : 'Baumbach (1937) average eclipse photometry, K corona (electrons) and F corona (dust) as separate terms; the 3D volume reproduces it along every line of sight.' });
  rows.push({ label: 'BRIGHTNESS VS DISC', value: look.exaggeration > 3 ? `${look.ratioText} · DRAWN ×${exp10(look.exaggeration).replace('1×', '')} BRIGHTER` : `${look.ratioText} · TO SCALE`, tier: look.exaggeration > 3 ? 'imagined' : 'modelled',
    detail: look.exaggeration > 3 ? 'A screen cannot show 10⁻⁶ beside the disc, so the corona is brightened by this factor (artistic exaggeration); relative brightness inside the corona is kept.' : 'Comparable to the disc in this band: drawn at the same exposure.' });
  rows.push({ label: 'WISPS AND MOTION', value: 'FINE RAYS, SLOW OUTFLOW', tier: 'imagined', detail: 'The fine radial striations and their slow outward drift are artistic: real streamers and plumes are this fine, but these are not where real ones are.' });
  if (eclipse) rows.push({ label: 'TOTALITY', value: eclipse, tier: 'modelled', detail: 'Other eclipses than 2017-08-21 show this model, aligned to the solar axis, in place of the photograph.' });
  return rows;
}
