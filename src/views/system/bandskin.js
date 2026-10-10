// How each body looks in each band (#28), in the ticket's order of preference:
//   1. a real map in this band (src/data/bands.js BODY_BAND)               MEASURED
//   2. a predicted skin from its spectral signature:                      MODELLED · PREDICTED
//        reflected light (UV, visible, near-IR to 2.5 µm): the best image we have, scaled by the
//          body's reflectance in the band relative to 550 nm (measured disc spectra where we have
//          them: Karkoschka 1998 for the giant planets and Titan);
//        thermal emission (beyond ~3 µm): Planck emission from a surface or cloud-top temperature
//          model (airless bodies: T = T_ss·cos^¼ on the day side); at microwave and radio
//          wavelengths the measured brightness-temperature spectrum (giants, Venus) or the damped
//          subsurface temperature of an airless body (src/data/band-physics.js, #61);
//        non-thermal radio: Jupiter's synchrotron radiation belts (`belts`, drawn around the planet);
//        observed emission signatures (aurorae, Lyman-α coronae, X-ray fluorescence and charge
//          exchange, cosmic-ray gamma glow, Io's volcanoes), each marked detected or predicted;
//   3. otherwise NOT OBSERVED IN THIS BAND.
// Every verdict is audited, with sources, in docs/research/band-audit.json (#61).

import { bodyBandSource } from '../../data/bands.js';
import { bandResponse, curve, effectiveNm, colourIndex } from '../../astro/bands.js';
import KARKOSCHKA from '../../data/reflectance-karkoschka.js';
import { brightnessTempK, subsurfaceTemps, synchrotron, ringTbK, REFS, IR_WINDOWS } from '../../data/band-physics.js';

// Near-IR beyond the measured 300–1050 nm spectra (approximate, MODELLED): methane bands at 1.15,
// 1.4, 1.7, 2.3 µm with windows between (Irwin; Karkoschka & Tomasko), as ratios to 550 nm.
const NIR = {
  jupiter: [[1150, 0.45], [1300, 0.6], [1650, 0.4], [2000, 0.15], [2300, 0.04], [2500, 0.06]],
  saturn: [[1150, 0.5], [1300, 0.6], [1650, 0.45], [2000, 0.18], [2300, 0.04], [2500, 0.06]],
  uranus: [[1250, 0.1], [1650, 0.03], [2300, 0.005]],
  neptune: [[1250, 0.1], [1650, 0.03], [2300, 0.005]],
  titan: [[1080, 1.1], [1150, 0.3], [1280, 1.0], [1400, 0.15], [1600, 0.8], [1800, 0.1], [2000, 0.6], [2300, 0.05]],
};
const measuredPlusNir = (id) => {
  const m = KARKOSCHKA.spectra[id], a550 = curve(m)(550);
  return [...m, ...NIR[id].filter(([nm]) => nm > m.at(-1)[0]).map(([nm, r]) => [nm, +(r * a550).toFixed(4)])];
};

// Disk-integrated reflectance spectra, [nm, value]; only the shape matters (the skin is scaled
// relative to 550 nm). Giant planets and Titan: measured full-disc albedo 300–1050 nm (Karkoschka
// 1998, PDS) plus the near-IR approximation above. The rest are approximate (MODELLED) tables:
//   Moon/Mercury: red-sloped regolith (ROLO, Clementine, MESSENGER MASCS). Mars: ferric oxides,
//   steep blue drop (HST, OMEGA). Venus: the unknown UV absorber at 300–400 nm (Akatsuki UVI), CO₂
//   bands in the near-IR (Pollack 1978, VEx). Earth: Rayleigh-bright blue and UV, the vegetation red
//   edge (EPOXI, DSCOVR EPIC). Icy moons: water-ice bands at 1.5 and 2.0 µm (Clark).
export const REFLECTANCE = {
  moon: [[300, 0.55], [400, 0.72], [550, 1], [750, 1.27], [1000, 1.5], [1250, 1.65], [1650, 1.9], [2200, 2.05], [2500, 2.1]],
  mercury: [[300, 0.5], [400, 0.7], [550, 1], [750, 1.32], [1000, 1.58], [1650, 2.0], [2500, 2.35]],
  mars: [[250, 0.15], [400, 0.3], [550, 1], [700, 2.0], [900, 2.2], [1250, 2.4], [1650, 2.5], [2200, 2.4], [2500, 2.3]],
  venus: [[200, 0.2], [300, 0.45], [365, 0.68], [450, 0.9], [550, 1], [750, 1.08], [1000, 1.02], [1450, 0.55], [1650, 0.8], [2000, 0.35], [2300, 0.55], [2500, 0.4]],
  earth: [[200, 1.4], [350, 1.7], [450, 1.35], [550, 1], [650, 0.88], [750, 0.95], [1000, 0.86], [1400, 0.35], [1650, 0.6], [1900, 0.25], [2200, 0.42], [2500, 0.3]],
  jupiter: measuredPlusNir('jupiter'),
  saturn: measuredPlusNir('saturn'),
  uranus: measuredPlusNir('uranus'),
  neptune: measuredPlusNir('neptune'),
  titan: measuredPlusNir('titan'),
  ice: [[300, 0.85], [400, 0.95], [550, 1], [1000, 0.98], [1250, 0.85], [1500, 0.4], [1800, 0.7], [2000, 0.3], [2300, 0.55], [2500, 0.4]],
  rock: [[300, 0.6], [400, 0.78], [550, 1], [750, 1.15], [1000, 1.25], [1650, 1.4], [2500, 1.5]],
};
export const REFLECTANCE_MEASURED = new Set(Object.keys(KARKOSCHKA.spectra));
const ICY = ['europa', 'ganymede', 'callisto', 'enceladus', 'tethys', 'dione', 'rhea', 'iapetus', 'mimas', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'pluto', 'charon', 'eris', 'haumea', 'makemake'];
const baseId = (id) => String(id).replace(/~$/, ''); // bandtextures asks for `${id}~` to get the look under a real map
export const reflectanceOf = (id) => REFLECTANCE[baseId(id)] ?? (ICY.includes(baseId(id)) ? REFLECTANCE.ice : REFLECTANCE.rock);

// Thermal emission model (K): airless day side Tss·cos^¼ with a night floor, or an atmosphere's
// effective emitting temperature in the IR and its brightness temperature in the microwave/radio
// (the measured spectrum in band-physics.js takes over where there is one).
//   Sources: Diviner (Moon), MESSENGER/ground (Mercury), Mars Climate Sounder/TES, Venus cloud tops
//   ~230 K, Galileo PPR (Europa: Spencer et al. 1999), Voyager/Cassini/Juno for the giants.
export const THERMAL = {
  mercury: { airless: true, tss: 700, night: 100 }, moon: { airless: true, tss: 390, night: 95 }, mars: { airless: true, tss: 290, night: 180 },
  venus: { ir: 230, radio: 700 }, earth: { ir: 255, radio: 285 }, jupiter: { ir: 125, radio: 350 }, saturn: { ir: 95, radio: 200 },
  uranus: { ir: 59, radio: 200 }, neptune: { ir: 59, radio: 200 }, titan: { ir: 94, radio: 90 }, io: { airless: true, tss: 130, night: 90 },
  europa: { airless: true, tss: 132, night: 86 }, ganymede: { airless: true, tss: 152, night: 85 }, callisto: { airless: true, tss: 165, night: 80 },
  enceladus: { airless: true, tss: 80, night: 50 },
};
const thermalOf = (b) => THERMAL[baseId(b.id)] ?? (b.meanTempC != null ? { ir: b.meanTempC + 273.15, radio: b.meanTempC + 273.15 } : { airless: true, tss: 120, night: 50 });

// Emission signatures by band (glow kinds, see materials.js: 1 whole disc, 2 sunlit side, 3 polar
// aurora spots, 4 limb, 5 auroral ovals over a faint sunlit disc, 6 volcanic hot spots).
// `detected` = observed (the pattern is still a sketch); otherwise PREDICTED, not detected.
const GLOWS = {
  xray: {
    moon: { kind: 2, gain: 0.9, detected: true, why: 'The sunlit Moon fluoresces in soft X-rays: ROSAT imaged it in 1990 (Schmitt et al. 1991, Nature 349, 583); the night side is dark apart from foreground charge-exchange emission. Chandrayaan-1 C1XS and Chang\'e-2 measured the lines from orbit.' },
    venus: { kind: 2, gain: 0.7, detected: true, why: 'Solar X-rays fluoresce (C, O) in the upper atmosphere on the day side, plus a faint charge-exchange halo (Chandra 2001: Dennerl et al. 2002, A&A 386, 319).' },
    mars: { kind: 2, gain: 0.6, detected: true, why: 'Day-side X-ray fluorescence of CO₂ (Chandra 2001: Dennerl 2002, A&A 394, 1119) and an exospheric charge-exchange halo out to ~8 Mars radii (XMM-Newton: Dennerl et al. 2006, A&A 451, 709); the halo lies outside the disc and is not drawn.' },
    mercury: { kind: 2, gain: 0.5, detected: true, why: 'Solar X-rays make the sunlit surface fluoresce (Mg, Al, Si, S, Ca, Fe): measured from orbit by MESSENGER\'s X-ray spectrometer (Nittler et al. 2011, Science 333, 1847; global maps Nittler et al. 2020, Icarus 345, 113716). Too faint to see from Earth.' },
    jupiter: { kind: 3, gain: 1, detected: true, why: 'Auroral X-ray hot spots at both poles, pulsing every ~45 min (Chandra: Gladstone et al. 2002, Nature 415, 1000), plus fainter disc emission from scattered solar X-rays.' },
    saturn: { kind: 2, gain: 0.45, detected: true, why: 'Saturn\'s disc reflects and scatters solar X-rays; it brightened with a solar flare (Chandra: Bhardwaj et al. 2005, ApJ 624, L121). Its aurora is far fainter than Jupiter\'s. The rings glow in oxygen Kα (Bhardwaj et al. 2005, ApJ 627, L73).' },
    uranus: { kind: 2, gain: 0.25, detected: true, why: 'A low-signal detection: 5 ± 2 X-ray photons coincident with Uranus in a 2002 Chandra ACIS image, 0.6–1.1 keV, likely scattered solar X-rays with possible auroral or ring fluorescence (Dunn et al. 2021, JGR Space Physics 126, e2020JA028739). Not confirmed by the 2017 HRC images.' },
    earth: { kind: 3, gain: 0.8, detected: true, why: 'Auroral X-rays from electron precipitation (Polar PIXIE), day-side fluorescence and scattering of solar X-rays, and charge exchange of the solar wind with the exosphere.' },
    io: { kind: 1, gain: 0.35, detected: true, why: 'Chandra detected soft X-rays from Io (and the Io plasma torus), probably from torus ions striking its surface and atmosphere (Elsner et al. 2002, ApJ 572, 1077).' },
    europa: { kind: 1, gain: 0.3, detected: true, why: 'Chandra detected soft X-rays from Europa, probably from energetic ions striking its icy surface (Elsner et al. 2002, ApJ 572, 1077).' },
    pluto: { kind: 1, gain: 0.25, detected: true, why: 'Chandra caught a handful of soft X-ray photons from Pluto in 2014–15, more than solar-wind charge exchange with its escaping atmosphere was expected to give (Lisse et al. 2017, Icarus 287, 103, "the puzzling detection").' },
    eros: { kind: 2, gain: 0.3, detected: true, why: 'NEAR Shoemaker\'s X-ray spectrometer measured solar-induced fluorescence of the surface from orbit (Lim & Nittler 2009, Icarus 200, 129). Not detectable from Earth.' },
    itokawa: { kind: 2, gain: 0.3, detected: true, why: 'Hayabusa\'s X-ray spectrometer measured fluorescence of the surface during solar flares (Okada et al. 2006, Science 312, 1338). Not detectable from Earth.' },
    neptune: { kind: 2, gain: 0.1, detected: false, why: 'Predicted, not detected: Neptune should scatter solar X-rays like the other giants, but it is the one planet with no X-ray detection yet (Dunn et al. 2021).' },
  },
  // Cosmic rays make every solid surface and every atmosphere glow in gamma rays (pion decay above
  // ~100 MeV, nuclear lines at MeV). Only the Moon (and Earth's limb, from orbit) is close enough
  // for Fermi to see; Mercury, Mars, Vesta, Ceres and Eros were measured by orbiting spectrometers.
  gamma: { moon: { kind: 1, gain: 0.6, detected: true, why: 'Cosmic rays striking the regolith. Fermi-LAT and EGRET see it from Earth orbit: about 1.1×10⁻⁶ photons cm⁻² s⁻¹ above 100 MeV, brightest at solar minimum. That is about twice the Sun\'s disc, and about equal to the disc plus its halo (Abdo et al. 2011, 2012). Lunar Prospector (Lawrence et al. 1998, Science 281, 1484) and Kaguya mapped its MeV nuclear lines from orbit.' },
    earth: { kind: 4, gain: 1, detected: true, why: 'Cosmic rays striking the upper atmosphere make Earth\'s limb the brightest gamma-ray source in Fermi\'s sky (seen from low orbit). Thunderstorms add terrestrial gamma-ray flashes.' },
    mercury: { kind: 1, gain: 0.35, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by MESSENGER\'s gamma-ray spectrometer (K, Th, U, Si, Fe lines). Far too faint to see from Earth.' },
    mars: { kind: 1, gain: 0.35, detected: true, why: 'Cosmic-ray glow of the surface through the thin air, mapped from orbit by Mars Odyssey\'s gamma-ray spectrometer (it found the buried water ice). Far too faint to see from Earth.' },
    vesta: { kind: 1, gain: 0.3, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by Dawn\'s GRaND spectrometer. Far too faint to see from Earth.' },
    ceres: { kind: 1, gain: 0.3, detected: true, why: 'Cosmic-ray glow of the surface, measured from orbit by Dawn\'s GRaND spectrometer (near-surface ice). Far too faint to see from Earth.' },
    eros: { kind: 1, gain: 0.3, detected: true, why: 'Cosmic-ray glow of the surface, measured by NEAR Shoemaker\'s gamma-ray spectrometer, best after it landed in 2001 (Peplowski 2016, PSS 134, 36). Far too faint to see from Earth.' },
    jupiter: { kind: 4, gain: 0.15, why: 'Predicted cosmic-ray glow of the upper atmosphere (its magnetic field shields much of it). Not confirmed: a tentative Fermi-LAT signal (Leane & Linden 2023) awaits confirmation.' } },
};
// Bodies with thick atmospheres glow at the limb; every other solid body glows across its disc.
const THICK_AIR = new Set(['venus', 'earth', 'titan', 'jupiter', 'saturn', 'uranus', 'neptune']);
const isComet = (b) => !!b.comet || b.kind === 'comet';
function predictedGamma(body) {
  const air = THICK_AIR.has(body.id);
  return { kind: air ? 4 : 1, gain: 0.15, why: `Predicted, not detected: cosmic rays striking ${air ? 'its upper atmosphere' : 'its surface'} should make ${body.name} glow faintly in gamma rays, as they do the Moon${air ? ' and Earth' : ''}. It is too far away and too faint for any gamma-ray telescope.` };
}
const predictedCometX = (body) => ({ kind: 1, gain: 0.2, why: `Predicted, not observed for ${body.name}: an active comet glows in soft X-rays where solar-wind ions steal electrons from its coma (charge exchange), discovered in comet Hyakutake (ROSAT: Lisse et al. 1996, Science 274, 205) and seen in dozens of comets since. ${body.name} has no X-ray observation; the glow lives in the coma near the Sun, not on the nucleus drawn here.` });

// Ultraviolet signatures by bandpass: aurorae in the far-UV and Lyman-α from hydrogen coronae.
const PASS_GLOWS = {
  'uv-fuv': {
    jupiter: { kind: 5, gain: 1, detected: true, why: 'In the far-UV Jupiter\'s disc is dark (hydrogen absorbs sunlight) and the auroral ovals of H₂ Lyman and Werner bands dominate (HST STIS, Juno UVS). The sunlit disc is drawn faint, the ovals as a sketch.' },
    saturn: { kind: 5, gain: 0.8, detected: true, why: 'Saturn\'s H₂ auroral ovals dominate the far-UV (HST, Cassini UVIS); the disc reflects little sunlight here.' },
    uranus: { kind: 5, gain: 0.4, detected: true, why: 'Faint, patchy aurorae detected from Earth orbit by HST (Lamy et al. 2012, GRL 39), first seen by Voyager 2 in 1986.' },
    earth: { kind: 5, gain: 0.9, detected: true, why: 'Auroral ovals and the oxygen and N₂ dayglow (IMAGE FUV, DMSP SSUSI, GOLD).' },
    ganymede: { kind: 5, gain: 0.5, detected: true, why: 'Two auroral ovals of atomic oxygen (130.4, 135.6 nm) inside Ganymede\'s own magnetosphere (HST STIS: Feldman et al. 2000, ApJ 535, 1085); their rocking revealed its subsurface ocean (Saur et al. 2015, JGR 120, 1715).' },
    europa: { kind: 1, gain: 0.35, detected: true, why: 'Oxygen emission at 130.4 and 135.6 nm from Europa\'s thin O₂ atmosphere (HST GHRS: Hall et al. 1995, Nature 373, 677), with transient water-vapour plumes reported (Roth et al. 2014, Science 343, 171).' },
    io: { kind: 4, gain: 0.6, detected: true, why: 'Io\'s SO₂ atmosphere glows in oxygen and sulphur lines where the plasma torus strikes it, brightest at the equatorial flanks (HST STIS, Roth et al.).' },
  },
  'uv-lya': {
    earth: { kind: 4, gain: 1, detected: true, why: 'The geocorona: exospheric hydrogen scattering solar Lyman-α, many Earth radii across (first imaged from the Moon by the Apollo 16 far-UV camera in 1972).' },
    mars: { kind: 4, gain: 0.7, detected: true, why: 'Mars\' hydrogen corona, whose seasonal swing showed that water escape varies (MAVEN IUVS, Mars Express SPICAM: Chaffin et al. 2014, GRL 41, 314).' },
    venus: { kind: 4, gain: 0.7, detected: true, why: 'Venus\' hydrogen corona scatters solar Lyman-α (Mariner 5, Venera, Venus Express).' },
    jupiter: { kind: 5, gain: 0.8, detected: true, why: 'Jupiter\'s disc glows in Lyman-α (brightest at the equatorial "bulge") and its aurorae are brighter still (Voyager UVS, HST).' },
    saturn: { kind: 5, gain: 0.6, detected: true, why: 'Saturn\'s upper atmosphere scatters solar and interplanetary Lyman-α, with auroral emission at the poles (Voyager UVS, Cassini UVIS).' },
    uranus: { kind: 4, gain: 0.4, detected: true, why: 'Uranus\' extended hydrogen corona and dayglow (Voyager 2 UVS; HST).' },
    neptune: { kind: 4, gain: 0.3, detected: true, why: 'Neptune\'s Lyman-α dayglow (Voyager 2 UVS).' },
    titan: { kind: 4, gain: 0.5, detected: true, why: 'Titan\'s hydrogen torus and upper-atmosphere Lyman-α (Voyager, Cassini UVIS).' },
    moon: { kind: 2, gain: 0.25, detected: true, why: 'The Moon reflects a few per cent of Lyman-α. LRO LAMP even maps the permanently shadowed craters by the starlight and interplanetary Lyman-α sky glow they reflect (Gladstone et al. 2012, JGR Planets 117).' },
    pluto: { kind: 4, gain: 0.4, detected: true, why: 'New Horizons Alice saw Pluto\'s atmosphere in Lyman-α and imaged its night side lit by the interplanetary Lyman-α glow (Gladstone & Young 2019, Annu. Rev. 47, 119).' },
  },
};
function predictedLya(body) {
  if (isComet(body)) return { kind: 4, gain: 0.8, detected: false, why: `Not observed here: an active comet's hydrogen coma, millions of km across, is the brightest thing about it in Lyman-α (SOHO SWAN: Combi et al. 2000, Icarus 144, 191). ${body.name}'s coma is not drawn; the nucleus itself reflects only a few per cent.` };
  return { kind: 2, gain: 0.1, detected: false, why: `Predicted, not observed: like the Moon, ${body.name}'s sunlit surface should reflect a few per cent of solar Lyman-α. No Lyman-α image of it exists.` };
}
// Io: at 3–5 µm its passive surface is cold (~130 K) and the volcanoes outshine it.
const IO_SPOTS = { kind: 6, gain: 1, detected: true, why: 'At 3–5 µm Io\'s cold surface is outshone by dozens of active volcanic hot spots, together ~10¹⁴ W (Veeder et al. 1994, JGR 99, 17095); Keck adaptive optics tracks them night by night (de Kleer & de Pater 2016, Icarus 280, 405). Hot-spot positions here are a sketch.' };

// Venus: the near-IR windows at 1.0–1.3, 1.74 and 2.3 µm let heat from the lower atmosphere and
// surface out through the clouds, so the night side glows, silhouetting the clouds.
const VENUS_WINDOWS = new Set(['ir-J', 'ir-H', 'ir-Ks', 'ir-F200W']);
const VENUS_NIGHT = { kind: 7, detected: true, why: 'Sunlight off the cloud tops on the day side; on the night side, heat from the hot lower atmosphere escapes through the 1.74 and 2.3 µm windows (and the surface itself at 1.0–1.2 µm), with the clouds in silhouette: discovered from the ground (Allen & Crawford 1984, Nature 307, 222) and mapped by Venus Express VIRTIS and Akatsuki IR2 (surface emissivity: Mueller et al. 2020, Icarus 335, 113400). The night-side pattern here is a sketch.' };

// The Sun's own emission where a photosphere's blackbody says "nothing": measured signatures.
export const SUN_SIGNATURES = {
  gamma: { gain: 0.7, label: 'DETECTED BY FERMI-LAT · SKETCH', why: 'Fermi-LAT detects the quiet Sun above 100 MeV. Cosmic-ray protons hitting the photosphere make the disc glow (4.6×10⁻⁷ photons cm⁻² s⁻¹ at the 2008–09 solar minimum), and cosmic-ray electrons scattering sunlight make an inverse-Compton halo tens of degrees wide (6.8×10⁻⁷; Abdo et al. 2011). The disc emission reaches beyond 100 GeV and is strongest at solar minimum (HAWC, Fermi). Flares add bursts above 1 GeV. The detection is measured; this view is a sketch (false-colour tint over the visible photosphere\'s pattern).' },
  radio: { gain: 0.9, label: 'MEASURED DAILY (F10.7) · SKETCH', why: 'The corona and chromosphere shine by thermal free-free emission: brightness temperatures of ~10⁴ K at centimetre and ~10⁶ K at metre wavelengths, far above the photosphere\'s blackbody. The 10.7 cm flux (F10.7) has been measured daily since 1947 (Tapping 2013, Space Weather 11, 394); flares add radio bursts. This view is a sketch: a false-colour tint over the visible photosphere\'s pattern.' },
  microwave: { gain: 0.9, label: 'MEASURED (ALMA, NOBEYAMA) · SKETCH', why: 'At millimetre wavelengths we see the chromosphere, 6,000–10,000 K (ALMA, Nobeyama), brighter than the photosphere\'s blackbody predicts. This view is a sketch: a false-colour tint over the visible photosphere\'s pattern.' },
  xray: { gain: 0.6, label: 'MEASURED (GOES XRS, NuSTAR) · SKETCH', why: 'Hard X-rays come from flares: hot (10–40 MK) plasma and electrons accelerated in reconnection, imaged by RHESSI (2002–2018) and focused by NuSTAR, which also finds faint microflares on the quiet Sun (Grefenstette et al. 2016, ApJ 826, 20). GOES XRS has measured the whole-disc 0.1–0.8 nm flux every few seconds since the 1970s (the flare classes A–X). Between flares the Sun is faint above ~10 keV. This view is a sketch: a false-colour tint over the visible photosphere\'s pattern.' },
};
const PALETTE = { asis: 0, radio: 1, microwave: 2, infrared: 3, visible: 4, ultraviolet: 5, xray: 6, gamma: 7 };
export const paletteIndex = (name) => PALETTE[name] ?? 4;

const glowLabel = (g) => (g.detected ? 'DETECTED · MODELLED SKETCH' : 'PREDICTED · NOT DETECTED');
const glowLook = (g, pal) => ({ mode: 'glow', tier: 'modelled', palette: pal, glow: g.kind, gain: g.gain, label: glowLabel(g), detail: g.why });
const refText = (keys) => keys.map((k) => REFS[k]?.cite.split(' (')[0]).filter(Boolean).join('; ');

/** The microwave/radio look (λ ≥ 0.3 mm) where measured physics replaces the single-temperature model, else null. */
function longWaveLook(body, pass, nm, pal, t) {
  const id = baseId(body.id), ghz = 299792458 / nm, fq = ghz >= 1 ? `${+ghz.toPrecision(3)} GHz` : `${Math.round(ghz * 1000)} MHz`;
  const tb = !t.airless ? brightnessTempK(id, nm) : null;
  if (tb) {
    const T = Math.round(tb.T), sync = synchrotron(id, nm);
    const look = { mode: 'thermal', tier: 'modelled', palette: pal, thermal: [0, 0, T, 0], um: nm / 1000,
      label: `${tb.verified ? 'MEASURED' : 'ESTIMATED'} DISC Tb ${T} K${sync && sync.fraction > 0.05 ? ` · BELTS ${Math.round(sync.fraction * 100)}% OF FLUX` : ''}`,
      detail: `Thermal emission through ${pass.label} (${fq}): ${body.name}'s disc-averaged brightness temperature ${tb.extrapolated ? 'held at the nearest measured value' : 'interpolated in the measured spectrum'}, ${T} K (${REFS[tb.ref]?.cite ?? tb.ref}${tb.verified ? '' : '; an estimate, not read from the source'}). Longer wavelengths see deeper, warmer layers. The map is a uniform false-colour disc: a sketch.` };
    if (sync && sync.fraction > 0.05) {
      look.belts = sync.fraction;
      look.gain = Math.max(0.3, 1 - sync.fraction); // the disc dims beside the belts that outshine it
      look.detail += ` Non-thermal: synchrotron radiation from relativistic electrons in the inner radiation belts (1.3–3 Jupiter radii) gives ~${sync.syncJy.toFixed(1)} Jy against the disc's ~${sync.discJy.toFixed(1)} Jy at 4.04 AU (${refText(['dP03', 'G16', 'B02'])}); the belts are drawn as a modelled glow around the planet.`;
    }
    return look;
  }
  const ss = t.airless ? subsurfaceTemps(id, nm, t, ICY.includes(id)) : null;
  if (ss) {
    const d = Math.round(ss.day), n = Math.round(ss.night);
    return { mode: 'thermal', tier: 'modelled', palette: pal, thermal: [d, n, 0, 1], um: nm / 1000, label: `SUBSURFACE · ${d} K DAY · ${n} K NIGHT`,
      detail: `Thermal emission through ${pass.label} (${fq}) comes from below the surface, where the day–night swing is damped to ${Math.round(ss.damping * 100)}% (Piddington & Minnett 1949) about ~${ss.mean} K${ss.emis < 0.99 ? `, and ice scatters the emission away (effective emissivity ~${ss.emis.toFixed(2)}): ${body.name} is microwave-colder than its surface` : ''}. ${ss.ref.length ? `Sources: ${refText(ss.ref)}.` : 'Parameters are generic estimates.'} MODELLED.` };
  }
  return null;
}

/**
 * The look of `body` in this band/pass: { mode, tier, label, detail, source?, gain?, thermal?, um?,
 * glow?, belts?, palette }. Modes: 'real', 'reflected', 'thermal', 'glow', 'dark'.
 */
export function bandLook(body, band, pass) {
  const pal = paletteIndex(band.palette);
  const real = bodyBandSource(body.id, band, pass);
  if (real) return { mode: 'real', source: real, tier: real.predicted ? 'modelled' : 'measured', predicted: !!real.predicted, palette: real.gibs ? 0 : pal, label: real.note ?? 'REAL MAP IN THIS BAND', detail: real.credit };
  const f = pass?.filter;
  const nm = f ? effectiveNm(f) : null;
  if (!f) return { mode: 'dark', tier: 'computed', palette: pal, label: 'NOT OBSERVED IN THIS BAND', detail: 'No bandpass selected.' };
  const id = baseId(body.id), solid = !body.starLike && body.kind !== 'star' && !body.marker && body.kind !== 'spacecraft';
  const pg = PASS_GLOWS[pass.id]?.[id] ?? (pass.id === 'uv-lya' && solid ? predictedLya(body) : null);
  if (pg) return glowLook(pg, pal);
  if (id === 'io' && nm >= 3000 && nm <= 6000) return glowLook(IO_SPOTS, pal);
  if (id === 'venus' && VENUS_WINDOWS.has(pass.id)) {
    const R = curve(reflectanceOf(id));
    return { ...glowLook(VENUS_NIGHT, pal), gain: Math.max(0.3, bandResponse(R, f) / R(550)) };
  }
  if (nm >= 150 && nm <= 2600) {
    const R = curve(reflectanceOf(id));
    const gain = bandResponse(R, f) / R(550);
    const measured = REFLECTANCE_MEASURED.has(id) && nm <= 1050;
    return { mode: 'reflected', tier: 'modelled', palette: pal, gain, label: `PREDICTED · ×${gain.toFixed(2)} OF ITS 550 nm REFLECTANCE`,
      detail: `Predicted skin: the best image we have for ${body.name}, scaled by its ${measured ? 'measured full-disc albedo spectrum (Karkoschka 1998, Icarus 133, 134)' : 'approximate reflectance spectrum'} integrated through ${pass.label} (${(nm).toFixed(0)} nm effective). Spatial detail comes from the visible image.` };
  }
  if (nm > 2600 && nm < 1e10 && solid) {
    const t = thermalOf(body), radio = nm > 1e6;
    if (nm >= 3e5) { const lw = longWaveLook(body, pass, nm, pal, t); if (lw) return lw; }
    const win = IR_WINDOWS[id];
    if (win && nm >= win.range[0] && nm <= win.range[1]) return { mode: 'thermal', tier: 'modelled', palette: pal, thermal: [0, 0, win.T, 0], um: nm / 1000, label: `ESTIMATED · ${win.T} K THROUGH THE 5 µm WINDOW`,
      detail: `Thermal emission through ${pass.label}: ${win.note}. A disc-average estimate (~${win.T} K, not the ${t.ir} K cloud tops); reflected sunlight is weak here. MODELLED.` };
    const thermal = t.airless ? [t.tss, t.night, 0, 1] : [0, 0, radio ? t.radio : t.ir, 0];
    return { mode: 'thermal', tier: 'modelled', palette: pal, thermal, um: nm / 1000, label: t.airless ? `PREDICTED THERMAL · ${t.tss} K DAY · ${t.night} K NIGHT` : `PREDICTED THERMAL · ${radio ? t.radio : t.ir} K`,
      detail: `Predicted thermal emission through ${pass.label}: Planck emission at ${t.airless ? `T = ${t.tss} K·cos^¼ on the day side, ${t.night} K at night` : `a ${radio ? 'microwave/radio brightness' : 'cloud-top'} temperature of ${radio ? t.radio : t.ir} K`}, in false colour.` };
  }
  const glow = GLOWS[band.id]?.[id] ?? (band.id === 'gamma' && solid ? predictedGamma(body) : band.id === 'xray' && isComet(body) ? predictedCometX(body) : null);
  if (glow) return glowLook(glow, pal);
  return { mode: 'dark', tier: 'computed', palette: pal, label: 'NOT OBSERVED IN THIS BAND', detail: `No image of ${body.name} in ${pass.label}, and no spectral signature to predict one from.` };
}

/**
 * Saturn's rings in a band (#61): { visible, gain, palette, tier, label, detail }. Reflected ice in
 * UV–near-IR; ~70–110 K thermal ice in the mid/far-IR (Cassini CIRS); 7–20 K in the microwave
 * against a 134–146 K disc (WMAP); oxygen Kα fluorescence in X-rays (Chandra). Not detected in
 * radio emission (they block the planet) or gamma rays.
 */
export function ringBandLook(body, band, pass) {
  const pal = paletteIndex(band.palette), nm = pass?.filter ? effectiveNm(pass.filter) : 550;
  if (band.id === 'full') return { visible: true, gain: 1, palette: 0 };
  if (nm >= 150 && nm <= 2600) {
    const R = curve(REFLECTANCE.ice), gain = bandResponse(R, pass.filter) / R(550);
    return { visible: true, gain, palette: pal, tier: 'modelled', label: `REFLECTED · ×${gain.toFixed(2)}`, detail: 'Water-ice ring particles reflect sunlight; ice absorbs at 1.5 and 2.0 µm.' };
  }
  if (nm > 2600 && nm < 3e5) return { visible: true, gain: 0.5, palette: pal, tier: 'modelled', label: 'THERMAL ICE ~70–110 K', detail: 'Ring particles emit thermally at roughly 70–110 K, warmest on the lit face (Cassini CIRS); MODELLED sketch.' };
  if (nm >= 3e5 && nm < 1e8 && band.id === 'microwave') {
    const ring = ringTbK(baseId(body.id), nm), disc = brightnessTempK(baseId(body.id), nm)?.T;
    if (ring != null && disc) return { visible: true, gain: ring / disc, palette: pal, tier: 'modelled', label: `RINGS ${ring.toFixed(0)} K vs DISC ${disc.toFixed(0)} K`, detail: 'WMAP measured the rings at 7–20 K (23–94 GHz) against a 134–146 K disc: cold ice, mostly blocking the planet (Weiland et al. 2011, ApJS 192, 19).' };
  }
  if (band.id === 'xray') return { visible: true, gain: 0.35, palette: pal, tier: 'modelled', label: 'DETECTED · MODELLED SKETCH', detail: 'Solar X-rays make oxygen in the ring ice fluoresce (O Kα, 0.53 keV; Chandra: Bhardwaj et al. 2005, ApJ 627, L73).' };
  return { visible: false, gain: 0, palette: pal, tier: 'computed', label: 'NOT OBSERVED IN THIS BAND', detail: 'The rings have no detected emission here.' };
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
