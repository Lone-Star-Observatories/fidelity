// How each body looks in each band (#28), in the ticket's order of preference:
//   1. a real map in this band (src/data/bands.js BODY_BAND)               MEASURED
//   2. a predicted skin from its spectral signature:                      MODELLED · PREDICTED
//        reflected light (UV, visible, near-IR to 2.5 µm): the best image we have, scaled by the
//          body's reflectance in the band relative to 550 nm;
//        thermal emission (beyond ~3 µm, microwave, radio): Planck emission from a surface or
//          cloud-top temperature model (airless bodies: T = T_ss·cos^¼ on the day side);
//        high-energy glows only where a signature has been observed (X-ray fluorescence of the
//          sunlit Moon/Venus/Mars, Jupiter's auroral X-rays, cosmic-ray gamma glow of the Moon and
//          Earth's limb);
//   3. otherwise NOT OBSERVED IN THIS BAND.

import { bodyBandSource } from '../../data/bands.js';
import { bandResponse, curve, effectiveNm, colourIndex } from '../../astro/bands.js';

// Disk-integrated reflectance relative to 550 nm (approximate, MODELLED), [nm, ratio].
//   Moon/Mercury: red-sloped regolith (ROLO, Clementine, MESSENGER MASCS). Mars: ferric oxides,
//   steep blue drop (HST, OMEGA). Venus: the unknown UV absorber at 300–400 nm, CO₂ bands in the
//   near-IR (Pollack 1978, VEx). Earth: Rayleigh-bright blue and UV, the vegetation red edge
//   (EPOXI, DSCOVR EPIC). Giant planets: methane bands at 890 nm, 1.7 and 2.3 µm (Karkoschka 1994,
//   1998; Irwin). Titan: methane bands with the 938 nm, 1.08/1.28/1.6/2.0 µm windows. Icy moons:
//   water-ice bands at 1.5 and 2.0 µm (Clark).
export const REFLECTANCE = {
  moon: [[300, 0.55], [400, 0.72], [550, 1], [750, 1.27], [1000, 1.5], [1250, 1.65], [1650, 1.9], [2200, 2.05], [2500, 2.1]],
  mercury: [[300, 0.5], [400, 0.7], [550, 1], [750, 1.32], [1000, 1.58], [1650, 2.0], [2500, 2.35]],
  mars: [[250, 0.15], [400, 0.3], [550, 1], [700, 2.0], [900, 2.2], [1250, 2.4], [1650, 2.5], [2200, 2.4], [2500, 2.3]],
  venus: [[200, 0.2], [300, 0.45], [365, 0.68], [450, 0.9], [550, 1], [750, 1.08], [1000, 1.02], [1450, 0.55], [1650, 0.8], [2000, 0.35], [2300, 0.55], [2500, 0.4]],
  earth: [[200, 1.4], [350, 1.7], [450, 1.35], [550, 1], [650, 0.88], [750, 0.95], [1000, 0.86], [1400, 0.35], [1650, 0.6], [1900, 0.25], [2200, 0.42], [2500, 0.3]],
  jupiter: [[250, 0.35], [300, 0.55], [400, 0.82], [550, 1], [620, 0.93], [727, 0.75], [750, 0.88], [890, 0.22], [940, 0.75], [1000, 0.82], [1150, 0.45], [1300, 0.6], [1650, 0.4], [2000, 0.15], [2300, 0.04], [2500, 0.06]],
  saturn: [[250, 0.3], [300, 0.45], [400, 0.75], [550, 1], [620, 0.95], [727, 0.8], [750, 0.9], [890, 0.28], [940, 0.8], [1000, 0.85], [1150, 0.5], [1650, 0.45], [2000, 0.18], [2300, 0.04], [2500, 0.06]],
  uranus: [[300, 0.95], [400, 1.15], [550, 1], [620, 0.72], [750, 0.35], [890, 0.07], [1000, 0.2], [1250, 0.15], [1650, 0.03], [2300, 0.005]],
  neptune: [[300, 1.1], [400, 1.25], [550, 1], [620, 0.7], [750, 0.32], [890, 0.06], [1000, 0.18], [1250, 0.14], [1650, 0.03], [2300, 0.005]],
  titan: [[300, 0.4], [400, 0.6], [550, 1], [650, 1.15], [750, 0.85], [890, 0.25], [938, 1.25], [1000, 0.5], [1080, 1.1], [1150, 0.3], [1280, 1.0], [1400, 0.15], [1600, 0.8], [1800, 0.1], [2000, 0.6], [2300, 0.05]],
  ice: [[300, 0.85], [400, 0.95], [550, 1], [1000, 0.98], [1250, 0.85], [1500, 0.4], [1800, 0.7], [2000, 0.3], [2300, 0.55], [2500, 0.4]],
  rock: [[300, 0.6], [400, 0.78], [550, 1], [750, 1.15], [1000, 1.25], [1650, 1.4], [2500, 1.5]],
};
const ICY = ['europa', 'ganymede', 'callisto', 'enceladus', 'tethys', 'dione', 'rhea', 'iapetus', 'mimas', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'pluto', 'charon', 'eris', 'haumea', 'makemake'];
export const reflectanceOf = (id) => REFLECTANCE[id] ?? (ICY.includes(id) ? REFLECTANCE.ice : REFLECTANCE.rock);

// Thermal emission model (K): airless day side Tss·cos^¼ with a night floor, or an atmosphere's
// effective emitting temperature in the IR and its brightness temperature in the microwave/radio.
//   Sources: Diviner (Moon), MESSENGER/ground (Mercury), Mars Climate Sounder/TES, Venus cloud tops
//   ~230 K but a 735 K surface at cm wavelengths (Mayer 1958), Voyager/Cassini/Juno brightness
//   temperatures for the giants (deeper, warmer layers at radio wavelengths).
export const THERMAL = {
  mercury: { airless: true, tss: 700, night: 100 }, moon: { airless: true, tss: 390, night: 95 }, mars: { airless: true, tss: 290, night: 180 },
  venus: { ir: 230, radio: 700 }, earth: { ir: 255, radio: 285 }, jupiter: { ir: 125, radio: 350 }, saturn: { ir: 95, radio: 200 },
  uranus: { ir: 59, radio: 200 }, neptune: { ir: 59, radio: 200 }, titan: { ir: 94, radio: 90 }, io: { airless: true, tss: 130, night: 90 },
};
const thermalOf = (b) => THERMAL[b.id] ?? (b.meanTempC != null ? { ir: b.meanTempC + 273.15, radio: b.meanTempC + 273.15 } : { airless: true, tss: 120, night: 50 });

// High-energy signatures that have actually been observed (MODELLED as simple patterns).
const GLOWS = {
  xray: { moon: { kind: 2, gain: 0.9, why: 'Sunlit Moon fluoresces in soft X-rays (ROSAT 1990); the night side is dark.' },
    venus: { kind: 2, gain: 0.7, why: 'Solar X-rays fluoresce in the upper atmosphere on the day side (Chandra 2001).' },
    mars: { kind: 2, gain: 0.6, why: 'Day-side X-ray fluorescence and a faint exospheric halo (Chandra 2001).' },
    jupiter: { kind: 3, gain: 1, why: 'Auroral X-ray hot spots at both poles (Chandra, XMM-Newton).' },
    earth: { kind: 3, gain: 0.8, why: 'Auroral X-rays from electron precipitation (PIXIE, Polar).' } },
  // Cosmic rays make every solid surface and every atmosphere glow in gamma rays (pion decay above
  // ~100 MeV, nuclear lines at MeV). Only the Moon (and Earth's limb, from orbit) is close enough
  // for Fermi to see; Mercury, Mars, Vesta and Ceres were measured by orbiting spectrometers.
  gamma: { moon: { kind: 1, gain: 0.6, detected: true, why: 'Cosmic rays striking the regolith. Fermi-LAT and EGRET see it from Earth orbit: about 1.1×10⁻⁶ photons cm⁻² s⁻¹ above 100 MeV, brightest at solar minimum. That is about twice the Sun\'s disc, and about equal to the disc plus its halo (Abdo et al. 2011, 2012). Lunar Prospector and Kaguya mapped its MeV nuclear lines from orbit.' },
    earth: { kind: 4, gain: 1, detected: true, why: 'Cosmic rays striking the upper atmosphere make Earth\'s limb the brightest gamma-ray source in Fermi\'s sky (seen from low orbit). Thunderstorms add terrestrial gamma-ray flashes.' },
    mercury: { kind: 1, gain: 0.35, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by MESSENGER\'s gamma-ray spectrometer (K, Th, U, Si, Fe lines). Far too faint to see from Earth.' },
    mars: { kind: 1, gain: 0.35, detected: true, why: 'Cosmic-ray glow of the surface through the thin air, mapped from orbit by Mars Odyssey\'s gamma-ray spectrometer (it found the buried water ice). Far too faint to see from Earth.' },
    vesta: { kind: 1, gain: 0.3, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by Dawn\'s GRaND spectrometer. Far too faint to see from Earth.' },
    ceres: { kind: 1, gain: 0.3, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by Dawn\'s GRaND spectrometer (near-surface ice). Far too faint to see from Earth.' },
    jupiter: { kind: 4, gain: 0.15, why: 'Predicted cosmic-ray glow of the upper atmosphere (its magnetic field shields much of it). Not confirmed: a tentative Fermi-LAT signal (Leane & Linden 2023) awaits confirmation.' } },
};
// Bodies with thick atmospheres glow at the limb; every other solid body glows across its disc.
const THICK_AIR = new Set(['venus', 'earth', 'titan', 'jupiter', 'saturn', 'uranus', 'neptune']);
function predictedGamma(body) {
  const air = THICK_AIR.has(body.id);
  return { kind: air ? 4 : 1, gain: 0.15, why: `Predicted, not detected: cosmic rays striking ${air ? 'its upper atmosphere' : 'its surface'} should make ${body.name} glow faintly in gamma rays, as they do the Moon${air ? ' and Earth' : ''}. It is too far away and too faint for any gamma-ray telescope.` };
}

// The Sun's own emission where a photosphere's blackbody says "nothing": measured signatures.
export const SUN_SIGNATURES = {
  gamma: { gain: 0.7, label: 'DETECTED BY FERMI-LAT · SKETCH', why: 'Fermi-LAT detects the quiet Sun above 100 MeV. Cosmic-ray protons hitting the photosphere make the disc glow (4.6×10⁻⁷ photons cm⁻² s⁻¹ at the 2008–09 solar minimum), and cosmic-ray electrons scattering sunlight make an inverse-Compton halo tens of degrees wide (6.8×10⁻⁷; Abdo et al. 2011). The disc emission reaches beyond 100 GeV and is strongest at solar minimum (HAWC, Fermi). Flares add bursts above 1 GeV. The detection is measured; this view is a sketch (false-colour tint over the visible photosphere\'s pattern).' },
  radio: { gain: 0.9, label: 'MEASURED DAILY (F10.7) · SKETCH', why: 'The corona and chromosphere shine by thermal free-free emission: brightness temperatures of ~10⁴ K at centimetre and ~10⁶ K at metre wavelengths, far above the photosphere\'s blackbody. The 10.7 cm flux (F10.7) has been measured daily since 1947; flares add radio bursts. This view is a sketch: a false-colour tint over the visible photosphere\'s pattern.' },
  microwave: { gain: 0.9, label: 'MEASURED (ALMA, NOBEYAMA) · SKETCH', why: 'At millimetre wavelengths we see the chromosphere, 6,000–10,000 K (ALMA, Nobeyama), brighter than the photosphere\'s blackbody predicts. This view is a sketch: a false-colour tint over the visible photosphere\'s pattern.' },
};
const PALETTE = { asis: 0, radio: 1, microwave: 2, infrared: 3, visible: 4, ultraviolet: 5, xray: 6, gamma: 7 };
export const paletteIndex = (name) => PALETTE[name] ?? 4;

/**
 * The look of `body` in this band/pass: { mode, tier, label, detail, source?, gain?, thermal?, um?,
 * glow?, palette }. Modes: 'real', 'reflected', 'thermal', 'glow', 'dark'.
 */
export function bandLook(body, band, pass) {
  const pal = paletteIndex(band.palette);
  const real = bodyBandSource(body.id, band, pass);
  if (real) return { mode: 'real', source: real, tier: 'measured', palette: real.gibs ? 0 : pal, label: real.note ?? 'REAL MAP IN THIS BAND', detail: real.credit };
  const f = pass?.filter;
  const nm = f ? effectiveNm(f) : null;
  if (!f) return { mode: 'dark', tier: 'computed', palette: pal, label: 'NOT OBSERVED IN THIS BAND', detail: 'No bandpass selected.' };
  if (nm >= 150 && nm <= 2600) {
    const R = curve(reflectanceOf(body.id));
    const gain = bandResponse(R, f) / R(550);
    return { mode: 'reflected', tier: 'modelled', palette: pal, gain, label: `PREDICTED · ×${gain.toFixed(2)} OF ITS 550 nm REFLECTANCE`,
      detail: `Predicted skin: the best image we have for ${body.name}, scaled by its approximate reflectance spectrum integrated through ${pass.label} (${(nm).toFixed(0)} nm effective). Spatial detail comes from the visible image.` };
  }
  if (nm > 2600 && nm < 1e10 && !body.starLike && body.kind !== 'star') {
    const t = thermalOf(body), radio = nm > 1e6;
    const thermal = t.airless ? [t.tss, t.night, 0, 1] : [0, 0, radio ? t.radio : t.ir, 0];
    return { mode: 'thermal', tier: 'modelled', palette: pal, thermal, um: nm / 1000, label: t.airless ? `PREDICTED THERMAL · ${t.tss} K DAY · ${t.night} K NIGHT` : `PREDICTED THERMAL · ${radio ? t.radio : t.ir} K`,
      detail: `Predicted thermal emission through ${pass.label}: Planck emission at ${t.airless ? `T = ${t.tss} K·cos^¼ on the day side, ${t.night} K at night` : `a ${radio ? 'microwave/radio brightness' : 'cloud-top'} temperature of ${radio ? t.radio : t.ir} K`}, in false colour. Non-thermal radio (e.g. Jupiter's radiation belts) is not modelled.` };
  }
  const glow = GLOWS[band.id]?.[body.id] ?? (band.id === 'gamma' && !body.starLike && body.kind !== 'star' && !body.marker && body.kind !== 'spacecraft' ? predictedGamma(body) : null);
  if (glow) return { mode: 'glow', tier: 'modelled', palette: pal, glow: glow.kind, gain: glow.gain,
    label: glow.detected ? 'DETECTED · MODELLED SKETCH' : band.id === 'gamma' && !GLOWS.gamma[body.id] ? 'PREDICTED · NOT DETECTED' : 'MODELLED SIGNATURE', detail: glow.why };
  return { mode: 'dark', tier: 'computed', palette: pal, label: 'NOT OBSERVED IN THIS BAND', detail: `No image of ${body.name} in ${pass.label}, and no spectral signature to predict one from.` };
}

/**
 * A star's brightness in the band relative to the V band, in the Vega system (A0 V ≈ 9,600 K has
 * colour 0 everywhere): Δmag > 0 means brighter in the band. COMPUTED from a blackbody at T_eff.
 */
export function starBandDelta(teff, pass) {
  if (!pass?.filter) return 0;
  const nm = effectiveNm(pass.filter);
  if (nm < 90 || nm > 3e4) return -Infinity; // no photospheric emission worth showing (X-ray, gamma, radio)
  return colourIndex(teff, pass.filter) - colourIndex(9600, pass.filter);
}
