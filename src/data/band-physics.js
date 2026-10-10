// Measured long-wavelength physics for the spectrum filter (#28), from the #61 band audit
// (docs/research/band-audit.json). Used by src/views/system/bandskin.js.
//
//   BRIGHTNESS_T  disc-averaged brightness temperature vs frequency where it has been measured
//                 (giant planets, Venus): at radio wavelengths we see deeper, warmer layers.
//   SUBSURFACE    airless bodies: at microwave/radio wavelengths the emission comes from below the
//                 surface, where the day–night swing is damped (Piddington & Minnett 1949), and icy
//                 surfaces scatter (Juno MWR: Europa and Ganymede are colder than their surface).
//   SYNCHROTRON   Jupiter's radiation belts: non-thermal emission that outshines the disc below ~3 GHz.
//   RING_TB       Saturn's rings in the microwave (WMAP).
//
// Every point carries a reference key (REFS) and `v`: true when the number was read from the cited
// source during the audit, false for an estimate or interpolation (the UI says MODELLED either way;
// nothing here is drawn as MEASURED, only these tables are measured).

export const REFS = {
  dP19: { cite: 'de Pater et al. 2019, Icarus 322, 168 (VLA 3–37 GHz, Table 2 disc-averaged Tb)', doi: '10.1016/j.icarus.2018.11.024' },
  W11: { cite: 'Weiland et al. 2011, ApJS 192, 19 (WMAP 7-yr planets: Tables 3, 6, 11–13)', doi: '10.1088/0067-0049/192/2/19' },
  D23: { cite: 'Dahal et al. 2023, PSJ 4, 154 (CLASS: Venus at 39–218 GHz; Jupiter calibration from Planck)', doi: '10.3847/PSJ/acee76' },
  B01: { cite: 'Butler et al. 2001, Icarus 154, 226 (VLA Venus; 679.9 ± 13.6 K at 4.86 GHz as quoted by Mohan et al. 2019)', doi: '10.1006/icar.2001.6710' },
  M19: { cite: 'Mohan et al. 2019, MNRAS (GMRT Venus: 554 ± 38 K at 608 MHz, 622 ± 43 K at 1.30 GHz)', url: 'https://arxiv.org/abs/1906.03243' },
  HB03: { cite: 'Hofstadter & Butler 2003, Icarus 165, 168 (Uranus cm-wave seasonal change)', doi: '10.1016/s0019-1035(03)00174-x' },
  dP03: { cite: 'de Pater et al. 2003, Icarus 163, 434 (Jupiter radio spectrum 74 MHz–8 GHz)', doi: '10.1016/S0019-1035(03)00067-8' },
  G16: { cite: 'Girard et al. 2016, A&A 587, A3 (LOFAR 127–172 MHz; compiled synchrotron spectrum, Fig. 8)', url: 'https://arxiv.org/abs/1511.09118' },
  B02: { cite: 'Bolton et al. 2002, Nature 415, 987 (Cassini 13.8 GHz synchrotron)', doi: '10.1038/415987a' },
  SC14: { cite: 'Santos-Costa et al. 2014, A&A 568, A61 (Cassini-flyby VLA comparison)', doi: '10.1051/0004-6361/201423896' },
  PM49: { cite: 'Piddington & Minnett 1949, Aust. J. Sci. Res. A 2, 63 (microwave emission of the Moon: damped phase lag)', doi: '10.1071/ch9490063' },
  MdP94: { cite: 'Mitchell & de Pater 1994, Icarus 110, 2 (Mercury 0.3–20.5 cm)', doi: '10.1006/icar.1994.1105' },
  Fa10: { cite: 'Fa & Jin 2010, Icarus 207, 605 (Chang\'e-1 radiometer 3–37 GHz)', doi: '10.1016/j.icarus.2009.11.034' },
  L25: { cite: 'Levin et al. 2025, Nature Astronomy 10, 84 (Juno MWR Europa: 29 ± 10 km conductive shell; cm-scale scatterers)', doi: '10.1038/s41550-025-02718-0' },
  Br23: { cite: 'Brown et al. 2023, JGR Planets 128 (Juno MWR Ganymede: Tb anti-correlated with albedo; bright terrain more reflective)', doi: '10.1029/2022je007609' },
  Z24: { cite: 'Zhang et al. 2024, LPSC 55 #2561 (MWR: Europa Tb rises with frequency, Ganymede falls; both colder than the surface)', url: 'https://www.hou.usra.edu/meetings/lpsc2024/pdf/2561.pdf' },
  dK21: { cite: 'de Kleer et al. 2021, PSJ 2, 5 (ALMA Ganymede: mm emissivity 0.75–0.78)', doi: '10.3847/psj/abcbf4' },
  C23: { cite: 'Camarca et al. 2023, PSJ 4, 142 (ALMA Callisto 343 GHz: 116 ± 5 K, emissivity 0.89–0.91)', doi: '10.3847/psj/aceb68' },
  T18: { cite: 'Trumbo et al. 2018, AJ 156, 161 (ALMA Europa 233 GHz thermal maps)', doi: '10.3847/1538-3881/aada87' },
  S99: { cite: 'Spencer et al. 1999, Science 284, 1514 (Galileo PPR Europa temperatures)', doi: '10.1126/science.284.5419.1514' },
  RJ15: { cite: 'Ries & Janssen 2015, Icarus 257, 88 (Cassini 2.2 cm Enceladus anomaly)', doi: '10.1016/j.icarus.2015.04.030' },
  J16: { cite: 'Janssen et al. 2016, Icarus 270, 443 (Cassini 2.18 cm Titan radiometry)', doi: '10.1016/j.icarus.2015.09.027' },
  J13: { cite: 'Janssen et al. 2013, Icarus 226, 522 (Cassini 2.2 cm Saturn)', doi: '10.1016/j.icarus.2013.06.008' },
  LG14: { cite: 'Le Gall et al. 2014, Icarus 241, 221 (Cassini radiometry of Iapetus)', doi: '10.1016/j.icarus.2014.06.011' },
  G15: { cite: 'Gulkis et al. 2015, Science 347 (Rosetta MIRO 0.5 and 1.6 mm, comet 67P)', doi: '10.1126/science.aaa0709' },
};

const GHZ_NM = 299792458;
export const nmToGHz = (nm) => GHZ_NM / nm;

// Disc-averaged brightness temperature [GHz, K, ref, verified]. Interpolated linearly in log ν;
// held flat beyond the ends (said so by `extrapolated`).
export const BRIGHTNESS_T = {
  jupiter: [
    [0.408, 450, 'dP03', false], [1.4, 330, 'dP03', false], // thermal disc only, extrapolated below the VLA table (estimate)
    [3.04, 270, 'dP19', true], [4.52, 233.1, 'dP19', true], [6.5, 210.9, 'dP19', true], [8.5, 188.9, 'dP19', true],
    [10.46, 178.0, 'dP19', true], [13.18, 164.0, 'dP19', true], [15.18, 155.0, 'dP19', true], [18.49, 146.7, 'dP19', true],
    [20.49, 140.1, 'dP19', true], [22.49, 136.0, 'dP19', true], [23.51, 135.0, 'dP19', true], [25.51, 139.0, 'dP19', true],
    [29.49, 146.2, 'dP19', true], [33.49, 150.4, 'dP19', true], [36.51, 152.5, 'dP19', true],
    [40.92, 154.4, 'W11', true], [60.41, 165.0, 'W11', true], [93.25, 173.0, 'W11', true], [147.9, 174.2, 'D23', true],
  ],
  saturn: [
    [1.4, 220, 'J13', false], [4.9, 180, 'J13', false], [13.8, 150, 'J13', false], // cm values: estimates in line with VLA/Cassini, not read from a table
    [22.85, 133.8, 'W11', true], [33.11, 138.8, 'W11', true], [40.9, 142.1, 'W11', true], [60.8, 146.1, 'W11', true], [93.5, 146.0, 'W11', true],
  ],
  // WMAP seven-year means (Tables 12, 13) with the blank-sky offsets (+2.2 … +1.1 K) added; Neptune's are noisy (±8–17%)
  uranus: [
    [1.4, 270, 'HB03', false], [4.9, 240, 'HB03', false], [8.4, 210, 'HB03', false],
    [22.85, 168, 'W11', true], [33.11, 128, 'W11', true], [40.9, 155, 'W11', true], [60.8, 139.5, 'W11', true], [93.5, 121, 'W11', true],
  ],
  neptune: [
    [4.9, 230, 'W11', false], [22.85, 163, 'W11', true], [33.11, 149, 'W11', true], [40.9, 128, 'W11', true], [60.8, 139.5, 'W11', true], [93.5, 143, 'W11', true],
  ],
  venus: [
    [0.608, 554, 'M19', true], [1.298, 622, 'M19', true], [4.86, 680, 'B01', true], [15.8, 495, 'B01', false],
    [38.8, 432.3, 'D23', true], [93.7, 355.6, 'D23', true], [147.9, 317.9, 'D23', true], [217.5, 294.7, 'D23', true],
  ],
  titan: [[13.78, 86, 'J16', false]], // surface ~94 K × microwave emissivity ~0.9 (estimate; Janssen 2016 maps it)
};

// Thermal-IR windows where a giant planet's deep, warm layers shine through: the 5 µm window
// between methane and ammonia/phosphine absorption. Disc-average estimates (not read from a
// source); hot spots in Jupiter's belts are far warmer (Voyager IRIS, Galileo NIMS, Juno JIRAM).
export const IR_WINDOWS = {
  jupiter: { range: [4400, 5300], T: 220, note: 'the 5 µm window: emission from the 2–8 bar cloud deck, brightest in cloud-free belt hot spots' },
  saturn: { range: [4400, 5300], T: 170, note: 'the 5 µm window: deep emission silhouetting Saturn\'s clouds (Cassini VIMS)' },
};

/** Interpolated brightness temperature of `id` at wavelength `nm`: { T, ref, verified, extrapolated } or null. */
export function brightnessTempK(id, nm) {
  const t = BRIGHTNESS_T[id];
  if (!t) return null;
  const f = nmToGHz(nm), lf = Math.log(f);
  // "verified" when a verified measurement lies within ±10% in frequency (the WMAP and VLA bands are that wide)
  const near = t.reduce((m, p) => (Math.abs(Math.log(p[0]) - lf) < Math.abs(Math.log(m[0]) - lf) ? p : m));
  const verified = near[3] && Math.abs(Math.log(near[0]) - lf) < 0.1;
  if (f <= t[0][0]) return { T: t[0][1], ref: t[0][2], verified, extrapolated: Math.abs(Math.log(t[0][0]) - lf) >= 0.1 };
  const last = t.at(-1);
  if (f >= last[0]) return { T: last[1], ref: last[2], verified, extrapolated: Math.abs(Math.log(last[0]) - lf) >= 0.1 };
  for (let i = 1; i < t.length; i++) {
    if (f > t[i][0]) continue;
    const a = t[i - 1], b = t[i], u = (lf - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
    return { T: a[1] + u * (b[1] - a[1]), ref: near[2], verified, extrapolated: false };
  }
  return null;
}

// Airless bodies: the microwave sees down ~`L` wavelengths (electrical absorption length) into
// regolith whose diurnal wave dies off over the thermal skin depth `skinCm`; the day–night swing
// is damped by A = 1/√(1 + 2δ + 2δ²), δ = Lλ/skin (Piddington & Minnett 1949), about `mean` (the
// temperature below the diurnal layer). `emis(GHz)` is the effective emissivity (volume scattering
// in ice makes Europa and Ganymede microwave-cold). Values are approximate unless a ref says so.
export const SUBSURFACE = {
  moon: { mean: 230, skinCm: 6, L: 10, ref: ['PM49', 'Fa10'] },
  mercury: { mean: 360, skinCm: 6, L: 10, ref: ['MdP94'] },
  // WMAP saw Mars at 178–204 K in all five bands, 2001–2008 (Table 6): the microwave disc is the subsurface, not the 290 K noon surface
  mars: { mean: 195, skinCm: 4, L: 10, ref: ['W11'] },
  // Juno MWR: colder than the sunlit surface at all six channels; Europa's Tb rises with frequency (deep scatterers), Ganymede's falls
  europa: { mean: 100, skinCm: 3, L: 30, emis: [[0.6, 0.5], [22, 0.72], [233, 0.8]], ref: ['L25', 'Z24', 'T18', 'S99'] },
  ganymede: { mean: 110, skinCm: 3, L: 30, emis: [[0.6, 0.72], [22, 0.55], [97.5, 0.76], [343.5, 0.76]], ref: ['Br23', 'Z24', 'dK21'] },
  callisto: { mean: 125, skinCm: 3, L: 20, emis: [[0.6, 0.75], [22, 0.8], [343, 0.9]], ref: ['C23'] },
  enceladus: { mean: 70, skinCm: 3, L: 30, emis: [[13.78, 0.6], [300, 0.8]], ref: ['RJ15'] },
  iapetus: { mean: 90, skinCm: 3, L: 20, emis: [[13.78, 0.75]], ref: ['LG14'] },
};
const ICY_DEFAULT = { skinCm: 3, L: 20, emis: [[1, 0.7], [300, 0.85]] }; // radar-bright icy surfaces scatter: generic estimate
const ROCK_DEFAULT = { skinCm: 5, L: 10 }; // lunar-like regolith: generic estimate

const interpLog = (pts, f) => {
  if (f <= pts[0][0]) return pts[0][1];
  if (f >= pts.at(-1)[0]) return pts.at(-1)[1];
  for (let i = 1; i < pts.length; i++) if (f <= pts[i][0]) {
    const a = pts[i - 1], b = pts[i], u = (Math.log(f) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
    return a[1] + u * (b[1] - a[1]);
  }
  return pts.at(-1)[1];
};

/** Damping of the diurnal swing at wavelength `nm` for a regolith with skin depth `skinCm` and absorption length `L` wavelengths. */
export const diurnalDamping = (nm, skinCm, L) => { const d = (L * nm * 1e-7) / skinCm; return 1 / Math.sqrt(1 + 2 * d + 2 * d * d); };

/**
 * Subsurface brightness temperatures of an airless body at `nm` (≥ 0.3 mm): { day, night, mean, emis, damping, ref }.
 * `t` is its surface model { tss, night }; `icy` picks the icy default when the body has no entry.
 */
export function subsurfaceTemps(id, nm, t, icy = false) {
  const s = SUBSURFACE[id] ?? (icy ? ICY_DEFAULT : ROCK_DEFAULT);
  if (!t?.airless) return null;
  const mean = s.mean ?? Math.round(0.45 * t.tss + 0.55 * t.night); // rough diurnal mean when not tabulated (≈ the Moon's 230 K, Mercury's 360 K)
  const A = diurnalDamping(nm, s.skinCm, s.L), e = s.emis ? interpLog(s.emis, nmToGHz(nm)) : 1;
  return { day: e * (mean + A * (t.tss - mean)), night: e * (mean - A * (mean - t.night)), mean, emis: e, damping: A, ref: s.ref ?? [] };
}

// Jupiter's synchrotron radiation from its inner radiation belts (1.3–3 R_J), flux density in Jy at
// the standard 4.04 AU [GHz, Jy, ref, verified]. Thermal disc emission dominates above ~5 GHz
// ("synchrotron dominates at ≳ 6 cm", de Pater et al. 2019); the spectrum is a few Jy, roughly flat
// from ~0.1 to a few GHz (de Pater et al. 2003; Girard et al. 2016 Fig. 8), ~1.1 Jy at 13.8 GHz
// (Cassini, as reanalysed after Bolton et al. 2002; reported value, not re-derived here).
export const SYNCHROTRON = {
  jupiter: { fluxJy: [[0.127, 3.5, 'G16', false], [0.408, 4.8, 'dP03', false], [1.4, 4.6, 'dP03', false], [2.3, 4.2, 'dP03', false], [4.9, 3.3, 'dP03', false], [8.4, 2.4, 'dP03', false], [13.8, 1.1, 'SC14', false], [22, 0.6, 'dP03', false]],
    beltsRj: [1.3, 3], peakRj: 1.5, discSr: Math.PI * 71492 * 66854 / (4.04 * 149597870.7) ** 2, ref: ['dP03', 'G16', 'B02', 'SC14', 'dP19'] },
};

/** Rayleigh–Jeans flux density (Jy) of a disc of solid angle `sr` at brightness temperature `T`, frequency `ghz`. */
export const discFluxJy = (T, ghz, sr) => (2 * 1.380649e-23 * T * (ghz * 1e9) ** 2 / 299792458 ** 2) * sr / 1e-26;

/** Jupiter-style belts: { syncJy, discJy, fraction } at `nm`, or null when the body has none or the band is beyond 30 GHz. */
export function synchrotron(id, nm) {
  const s = SYNCHROTRON[id];
  if (!s) return null;
  const f = nmToGHz(nm);
  if (f > 30 || f < 0.05) return null;
  const syncJy = interpLog(s.fluxJy, f), Tb = brightnessTempK(id, nm)?.T ?? 0, discJy = discFluxJy(Tb, f, s.discSr);
  return { syncJy, discJy, fraction: syncJy / (syncJy + discJy) };
}

// Saturn's rings in the microwave: ring-model brightness temperature [GHz, K] (WMAP Table 11; the
// disc is 134–146 K in the same bands). The rings are cold ice: they mostly block the planet.
export const RING_TB = { saturn: [[22.85, 6.7], [33.11, 9.6], [40.9, 11.3], [60.8, 14.5], [93.5, 19.8]] };
export const ringTbK = (id, nm) => (RING_TB[id] ? interpLog(RING_TB[id], nmToGHz(nm)) : null);
