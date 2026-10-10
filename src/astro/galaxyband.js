// How galaxies look across the spectrum (#28): display weights for the Milky Way model's
// components (src/views/galaxy/model.js) and for galaxies by morphological type (Universe View).
// MODELLED. The weights are relative to the visible (V band = 1) and are a picture of which
// component dominates where, not calibrated luminosities. They are anchored on these facts:
//
//   Old stars (bulge, thick disc, halo) peak in the near-IR: COBE/DIRBE's 1–4 µm map is the bulge
//     and disc (Arendt et al. 1994; Dwek et al. 1995); they fade fast into the UV (old populations
//     emit little below 300 nm; the UV upturn is weak, O'Connell 1999).
//   Young OB stars and HII regions dominate the UV (GALEX: spirals' arms light up, Gil de Paz et
//     al. 2007). HII regions also shine in recombination lines (Hα, [O III], [S II]), in warm-dust
//     and PAH emission (Spitzer 8–24 µm, Churchwell et al. 2009), and in free-free radio
//     continuum at cm wavelengths (WMAP/Planck free-free; Planck 2015 X).
//   Dust absorbs: A_λ/A_V from Fitzpatrick 1999 (R_V = 3.1): ≈ 2.6 at 150 nm, 1 at V, 0.11 at K.
//     It glows instead in the far-IR, peaking near 100–160 µm (IRAS, COBE/DIRBE, Planck HFI), with
//     anomalous (spinning-dust) microwave emission near 30 GHz (Planck 2015 XXV).
//   Gas: neutral hydrogen's 21 cm line maps the gas disc, which reaches twice as far as the stars
//     and flares (Kalberla & Kerp 2009); cosmic-ray electrons in the magnetic field make the
//     synchrotron glow of the 408 MHz sky (Haslam et al. 1982); cosmic-ray protons hitting the gas
//     make the gamma-ray plane through pion decay (Fermi-LAT; Ackermann et al. 2012).
//   X-rays: the Galactic ridge emission follows the stars, not hot gas (unresolved accreting white
//     dwarfs and active stars; Revnivtsev et al. 2006, 2009); the eROSITA bubbles, ~14 kpc tall,
//     glow at 0.6–1 keV (Predehl et al. 2020). Interstellar gas absorbs soft X-rays and all of the
//     extreme UV near the plane.
//   Gamma rays: the Fermi bubbles, ~10 kpc lobes above and below the centre at 1–100 GeV (Su,
//     Slatyer & Finkbeiner 2010), with their microwave "haze" (Finkbeiner 2004; Planck 2013 IX) and
//     polarised radio lobes (Carretti et al. 2013); the Galactic-centre GeV excess (Goodenough &
//     Hooper 2009; Ackermann et al. 2017).
//   Galaxies by type: ellipticals are red (B−K ≈ 4 against ≈ 3.3 for spirals), dust- and gas-poor
//     (little far-IR, 21 cm or UV; Bregman 1992), with hot X-ray haloes in the massive ones (Forman
//     et al. 1985); spirals follow the far-IR–radio correlation of star formation (Condon 1992);
//     irregulars and dwarfs are blue in the UV and rich in HI (Hunter & Elmegreen 2004). The
//     gamma-ray galaxies are star-forming ones (LMC, SMC, M31, NGC 253, M82; Ackermann et al. 2012).

import { bandResponse, curve, effectiveNm } from './bands.js';

// anchor wavelengths (nm): γ 100 MeV, γ 1 MeV, hard X 40 keV, soft X 1.2 keV, 0.4 keV, 0.2 keV, 0.14 keV,
// the Lyman limit (from ~0.1 keV to 91.2 nm interstellar gas absorbs everything), FUV, NUV, U, V, I, K, 3.4 µm, 8 µm,
// 24 µm, 100 µm, 1 mm, 3 mm, 1 cm, 6 cm, 21 cm, 73 cm (408 MHz)
export const WL = [1e-5, 1e-3, 0.03, 1, 3, 6, 9, 91.2, 150, 230, 365, 550, 800, 2200, 3400, 8000, 24000, 1e5, 1e6, 3e6, 1e7, 6e7, 2.1e8, 7.3e8];
const Z6 = [0, 0, 0, 0, 0, 0];
export const COMPONENT_SED = {
  thin: [0, 0, 0.12, 0.1, 0.02, 0, 0, 0, 0.15, 0.35, 0.7, 1, 1.1, 1.15, 0.8, 0.2, 0.05, 0, ...Z6],
  thick: [0, 0, 0.08, 0.06, 0.01, 0, 0, 0, 0.02, 0.08, 0.45, 1, 1.25, 1.5, 1.1, 0.3, 0.05, 0, ...Z6],
  bulge: [0, 0, 0.3, 0.2, 0.05, 0, 0, 0, 0.03, 0.1, 0.4, 1, 1.4, 2.2, 1.6, 0.35, 0.1, 0.05, ...Z6],
  nuclear: [0.4, 0.2, 0.5, 0.3, 0.1, 0, 0, 0, 0.05, 0.15, 0.4, 1, 1.4, 2.2, 1.8, 1.2, 1.5, 1.2, 0.6, 0.6, 0.8, 1, 1, 1],
  arms: [0, 0, 0.05, 0.04, 0.01, 0, 0, 0, 2.2, 1.8, 1.4, 1, 0.7, 0.4, 0.25, 0.1, 0.03, 0, ...Z6],
  hii: [0, 0, 0.1, 0.05, 0.01, 0, 0, 0, 1.2, 1.0, 1.0, 1, 0.8, 0.5, 0.8, 2.0, 2.5, 1.6, 0.6, 0.8, 1.4, 1.2, 0.9, 0.4],
  halo: [0, 0, 0.02, 0.02, 0, 0, 0, 0, 0.05, 0.1, 0.5, 1, 1.15, 1.3, 1.0, 0.2, 0, 0, ...Z6],
  // only outside the visible: interstellar gas (21 cm, synchrotron, pion-decay gamma rays) and the bubbles
  gas: [1.8, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.3, 0.7, 1.2, 2.0, 1.8],
  fermi: [1.0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.25, 0.1, 0],
  erosita: [0, 0, 0.1, 1.0, 1.0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...Z6],
};
// dust: extinction relative to V (absorbing, drawn dark), and thermal emission (drawn glowing)
export const DUST_ABSORB = [0, 0, 0, 0.5, 1.5, 3, 3, 3, 2.6, 2.7, 1.55, 1, 0.6, 0.11, 0.06, 0.04, 0.02, 0, ...Z6];
export const DUST_GLOW = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.6, 0.8, 2.5, 0.8, 0.35, 0.15, 0.03, 0, 0];

// Universe galaxies by type: E/S0 (T ≤ 0), spirals (1–8), irregulars and dwarfs (≥ 9)
export const TYPE_SED = {
  early: [0.02, 0.02, 0.8, 0.8, 0.3, 0, 0, 0, 0.08, 0.15, 0.5, 1, 1.3, 2.0, 1.4, 0.3, 0.15, 0.05, 0.03, 0.03, 0.15, 0.25, 0.3, 0.35],
  spiral: [0.1, 0.1, 0.3, 0.3, 0.1, 0, 0, 0, 0.7, 0.8, 0.95, 1, 1.1, 1.4, 1.0, 0.8, 0.9, 1.3, 0.6, 0.5, 0.7, 0.9, 1.0, 1.1],
  irregular: [0.05, 0.05, 0.2, 0.2, 0.05, 0, 0, 0, 1.6, 1.4, 1.2, 1, 0.85, 0.7, 0.5, 0.4, 0.5, 0.8, 0.3, 0.3, 0.4, 0.5, 0.5, 0.5],
};
// 21 cm line: the HI it maps, relative to the 21 cm continuum the weights above describe
const HI_LINE = { early: 0.1, spiral: 1.2, irregular: 2.5 };

const anchors = (vals) => WL.map((w, i) => [w, vals[i]]);
const sedAt = (vals, f) => Math.max(0, bandResponse(curve(anchors(vals)), f));

/** Optical recombination/forbidden lines and the 21 cm line that a narrow filter isolates. */
const LINES = { halpha: 656.28, hbeta: 486.13, oiii: 500.7, sii: 671.6, hi: 211061140 };
/** Which line a filter isolates: a filter narrower than 3% of its wavelength that contains a known line. */
export function lineFilter(f) {
  if (!f?.points?.length) return null;
  const peak = Math.max(...f.points.map((q) => q[1])), lit = f.points.filter((p) => p[1] > 0.5 * peak);
  const lo = lit[0]?.[0], hi = lit.at(-1)?.[0];
  if (!(hi > lo) || (hi - lo) / ((hi + lo) / 2) > 0.03) return null;
  for (const [k, nm] of Object.entries(LINES)) if (nm >= lo * 0.999 && nm <= hi * 1.001) return k;
  return null;
}

/**
 * Display weights of the galaxy model's components through a filter: { thin, thick, …, dustAbsorb,
 * dustGlow, line }. Full spectrum (no filter) = the visible look.
 */
export function galaxyBandWeights(f) {
  const out = {};
  if (!f) { for (const k of Object.keys(COMPONENT_SED)) out[k] = ['gas', 'fermi', 'erosita'].includes(k) ? 0 : 1; return { ...out, dustAbsorb: 1, dustGlow: 0, line: null, nm: 550 }; }
  for (const [k, v] of Object.entries(COMPONENT_SED)) out[k] = sedAt(v, f);
  out.dustAbsorb = sedAt(DUST_ABSORB, f);
  out.dustGlow = sedAt(DUST_GLOW, f);
  const line = lineFilter(f);
  if (line === 'hi') { out.gas *= 1.5; out.hii *= 0.2; out.nuclear *= 0.3; out.fermi = 0; }
  else if (line) { // an emission-line filter: the ionised gas stands out against the starlight
    out.hii *= 4;
    for (const k of ['thin', 'thick', 'bulge', 'nuclear', 'arms', 'halo']) out[k] *= 0.35;
  }
  return { ...out, line, nm: effectiveNm(f) };
}

/** Morphological type T (de Vaucouleurs) → type class. */
export const typeClass = (T) => (T == null ? 'spiral' : T <= 0 ? 'early' : T <= 8 ? 'spiral' : 'irregular');
/** A galaxy's display weight in a filter relative to the visible, by type (Universe View). */
export function galaxyTypeWeight(T, f) {
  if (!f) return 1;
  const c = typeClass(T), w = sedAt(TYPE_SED[c], f);
  return lineFilter(f) === 'hi' ? w * HI_LINE[c] : w;
}

/**
 * What the Milky Way model shows in a band, for the panel: { value, detail, dark }. `w` is
 * galaxyBandWeights(filter) or null (full spectrum). `dark`: nothing of the galaxy is seen.
 */
export function galaxyBandNote(w) {
  if (!w) return { value: 'FULL SPECTRUM', detail: 'Starlight as the eye would see it from outside: old yellow stars in the bar and disc, blue young stars and pink HII regions on the arms, dark dust lanes.', dark: false };
  const nm = w.nm;
  if (w.line === 'hi') return { value: 'HI 21 CM: THE GAS DISC', detail: 'The 21 cm line of neutral hydrogen maps the gas disc, which reaches about twice as far as the stars and flares thicker towards its edge (Kalberla & Kerp 2009); the arms are traced by gas. Stars and dust are invisible here.', dark: false };
  if (w.line) return { value: 'EMISSION LINE: IONISED GAS', detail: 'A narrow emission-line filter: the HII regions around young massive stars glow in this line and stand out against the starlight, which the narrow filter suppresses.', dark: false };
  if (nm >= 3e7) return { value: 'RADIO: GAS DISC AND ARMS', detail: 'Synchrotron from cosmic-ray electrons spiralling in the magnetic field (the 408 MHz sky, Haslam et al. 1982) and free-free emission from HII regions: the gas disc and the arms dominate, dust is transparent and the starlight is gone. The faint lobes over the centre stand for the polarised radio counterparts of the Fermi bubbles (Carretti et al. 2013).', dark: false };
  if (nm >= 1e6) return { value: 'MICROWAVE: FREE-FREE, SYNCHROTRON, DUST', detail: 'Free-free emission from HII regions, synchrotron and spinning dust in the gas disc, and the "haze" over the centre that matches the Fermi bubbles (WMAP, Planck 2013 IX); towards 1 mm cold dust takes over. Starlight is gone.', dark: false };
  if (nm >= 3e4) return { value: 'FAR INFRARED: GLOWING DUST', detail: 'Dust lanes glow instead of absorbing: cold dust (15–25 K) peaks near 100–160 µm (IRAS, COBE/DIRBE, Planck), and HII regions are bright with warm dust. Starlight has faded away.', dark: false };
  if (nm >= 3000) return { value: 'MID INFRARED: WARM DUST AND PAHs', detail: 'PAH molecules and warm dust glow around star-forming regions (Spitzer GLIMPSE/MIPSGAL); the old stars fade and the dust lanes start to emit rather than absorb.', dark: false };
  if (nm >= 900) return { value: 'NEAR INFRARED: OLD STARS, BULGE STRONGEST', detail: 'Old red giants dominate: the bar and bulge are at their brightest (COBE/DIRBE; Dwek et al. 1995) and the dust is nearly transparent (A_K ≈ 0.1 A_V; Fitzpatrick 1999), so the whole disc shows through.', dark: false };
  if (nm >= 330) return { value: 'VISIBLE: STARLIGHT AND DUST', detail: 'Starlight dimmed by dust lanes (A_λ/A_V from Fitzpatrick 1999); bluer filters favour the young stars on the arms, redder ones the old bulge.', dark: false };
  if (nm >= 91.2) return { value: 'ULTRAVIOLET: YOUNG STARS', detail: 'Young hot OB stars and HII regions on the arms dominate (as GALEX sees in other spirals); the old bulge fades, and dust absorbs about 2.5 times more than in visible light.', dark: false };
  if (nm >= 9) return { value: 'NOT OBSERVED IN THIS BAND', detail: 'Interstellar hydrogen and helium absorb the extreme ultraviolet within a few hundred light-years: no part of the galaxy beyond the local bubble can be seen in this band.', dark: true };
  if (nm >= 0.01) return { value: 'X-RAYS: RIDGE AND EROSITA BUBBLES', detail: 'The Galactic ridge X-ray emission follows the stars (unresolved accreting white dwarfs and active stars; Revnivtsev et al. 2006); the centre is bright; the eROSITA bubbles, ~14 kpc tall, glow at 0.6–1 keV (Predehl et al. 2020). Gas in the plane absorbs soft X-rays, so the disc is faint.', dark: false };
  return { value: 'GAMMA RAYS: GAS PLANE AND FERMI BUBBLES', detail: 'Cosmic-ray protons striking interstellar gas make the plane glow (pion decay; Fermi-LAT, Ackermann et al. 2012); the Fermi bubbles rise ~10 kpc above and below the centre (Su, Slatyer & Finkbeiner 2010), and the centre shows the GeV excess. The stars vanish.', dark: false };
}

/** What the Universe View's galaxies show in a band, for the panel. */
export function typeBandNote(f) {
  if (!f) return null;
  const nm = effectiveNm(f), line = lineFilter(f);
  if (line === 'hi') return 'HI 21 cm: gas-rich spirals and dwarf irregulars stand out; gas-poor ellipticals almost vanish.';
  if (nm >= 3e7) return 'Radio continuum: star-forming spirals (synchrotron, the far-IR–radio correlation; Condon 1992) and a few radio-loud giant ellipticals.';
  if (nm >= 1e6) return 'Microwave: dust and free-free emission of star-forming galaxies; ellipticals are faint.';
  if (nm >= 3e4) return 'Far infrared: dusty star-forming spirals glow; dust-poor ellipticals almost vanish.';
  if (nm >= 3000) return 'Mid infrared: PAH and warm dust in spirals; ellipticals show only their fading old starlight.';
  if (nm >= 900) return 'Near infrared: old stars; ellipticals and lenticulars brightest (B−K ≈ 4 against ≈ 3.3 for spirals).';
  if (nm >= 330) return 'Visible light: blue-band brightness as catalogued, re-weighted by type within the band.';
  if (nm >= 91.2) return 'Ultraviolet: young stars; dwarf irregulars and spirals bright, ellipticals faint (weak UV upturn; O\'Connell 1999).';
  if (nm >= 9) return 'Extreme ultraviolet: absorbed by the Milky Way\'s own gas; no galaxy is seen.';
  if (nm >= 0.01) return 'X-rays: hot gas haloes of massive ellipticals (Forman et al. 1985) and X-ray binaries in spirals.';
  return 'Gamma rays: only a few star-forming galaxies are detected (LMC, SMC, M31, NGC 253, M82; Ackermann et al. 2012); the rest are drawn very faint.';
}
