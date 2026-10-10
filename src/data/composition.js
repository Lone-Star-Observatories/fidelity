// What stars are made of, and which spectral lines show it.
//
// Sun: present-day photospheric abundances, Asplund, Grevesse, Sauval & Scott 2009 (ARA&A 47,
// 481), log ε(X) = log10(N_X / N_H) + 12. Other stars: the solar mix scaled by their measured
// metallicity [Fe/H], with helium following ΔY/ΔZ ≈ 1.4 — a standard assumption, so MODELLED.

const ASPLUND_2009 = [
  ['H', 'HYDROGEN', 12.0, 1.008], ['He', 'HELIUM', 10.93, 4.0026], ['O', 'OXYGEN', 8.69, 15.999],
  ['C', 'CARBON', 8.43, 12.011], ['Ne', 'NEON', 7.93, 20.18], ['N', 'NITROGEN', 7.83, 14.007],
  ['Mg', 'MAGNESIUM', 7.6, 24.305], ['Si', 'SILICON', 7.51, 28.085], ['Fe', 'IRON', 7.5, 55.845],
  ['S', 'SULFUR', 7.12, 32.06], ['Al', 'ALUMINIUM', 6.45, 26.982], ['Ar', 'ARGON', 6.4, 39.948],
  ['Ca', 'CALCIUM', 6.34, 40.078], ['Na', 'SODIUM', 6.24, 22.99], ['Ni', 'NICKEL', 6.22, 58.693],
];

/** Mass fractions for the solar mix, metals scaled by 10^[Fe/H]. */
export function massFractions(feh = 0) {
  const SUN_Y = 0.2485, SUN_Z = 0.0134, DYDZ = 1.4;
  const metals = ASPLUND_2009.filter(([el]) => el !== 'H' && el !== 'He');
  const raw = metals.map(([el, name, le, A]) => ({ el, name, w: 10 ** (le - 12) * A }));
  const sumW = raw.reduce((s, r) => s + r.w, 0);
  const Z = SUN_Z * 10 ** feh;
  const Y = Math.min(0.4, Math.max(0.23, SUN_Y + DYDZ * (Z - SUN_Z)));
  const X = 1 - Y - Z;
  return {
    X, Y, Z,
    elements: [
      { el: 'H', name: 'HYDROGEN', frac: X }, { el: 'He', name: 'HELIUM', frac: Y },
      ...raw.map((r) => ({ el: r.el, name: r.name, frac: (r.w / sumW) * Z })),
    ],
  };
}

/** Composition for a star body: { title, tier, note, X, Y, Z, elements } or a white-dwarf note. */
export function starComposition(body, isSun = false) {
  const spect = body.spectral || '';
  if (body.kind === 'white dwarf' || /^D[ABOQZC]/.test(spect)) {
    const dq = /^DQ/.test(spect);
    return {
      whiteDwarf: true, tier: 'modelled',
      title: dq ? 'CARBON-RICH WHITE DWARF' : 'HYDROGEN-ATMOSPHERE WHITE DWARF',
      note: dq
        ? 'A DQ white dwarf: carbon dredged up from the core shows in its spectrum. The interior is mostly carbon and oxygen, the ash of helium burning.'
        : 'A DA white dwarf: gravity is so strong that heavy elements sink, leaving a thin skin of almost pure hydrogen over a carbon–oxygen interior.',
      elements: dq
        ? [{ el: 'C', name: 'CARBON (CORE)', frac: 0.5 }, { el: 'O', name: 'OXYGEN (CORE)', frac: 0.48 }, { el: 'He', name: 'HELIUM ENVELOPE', frac: 0.02 }]
        : [{ el: 'C', name: 'CARBON (CORE)', frac: 0.49 }, { el: 'O', name: 'OXYGEN (CORE)', frac: 0.49 }, { el: 'He', name: 'HELIUM LAYER', frac: 0.01 }, { el: 'H', name: 'HYDROGEN SKIN', frac: 0.0001 }],
    };
  }
  if (body.kind === 'brown dwarf') {
    const t = body.teffK ?? 1000;
    const clouds = t > 1300 ? 'IRON AND SILICATE (ROCK-VAPOUR) CLOUDS' : t > 500 ? 'METHANE AND WATER ABSORPTION, CLOUDS SINKING' : 'WATER-ICE CLOUDS';
    const mf = massFractions(0);
    return {
      ...mf, brownDwarf: true, tier: 'modelled', feh: null,
      title: 'BROWN DWARF · SOLAR MIX',
      note: `A failed star: too light to fuse ordinary hydrogen, it only burned its deuterium early on and has been cooling ever since. Made of the same hydrogen–helium mix as the Sun; at ${Math.round(t)} K its atmosphere shows ${clouds.toLowerCase()}.`,
      clouds,
    };
  }
  const feh = isSun ? 0 : body.metallicity;
  const mf = massFractions(feh ?? 0);
  return {
    ...mf,
    feh: feh ?? null,
    tier: isSun ? 'measured' : feh != null ? 'modelled' : 'imagined',
    title: isSun ? 'SOLAR PHOTOSPHERE' : feh != null ? `SOLAR MIX × 10^${feh >= 0 ? '+' : ''}${feh.toFixed(2)} METALS` : 'ASSUMED SOLAR MIX',
    note: isSun
      ? 'Photospheric abundances from the solar spectrum (Asplund et al. 2009), by mass.'
      : feh != null
        ? `Metallicity [Fe/H] = ${feh.toFixed(2)} is measured (NASA Exoplanet Archive); the element mix is the Sun's scaled to it.`
        : 'No metallicity measurement in the catalogue, so the solar mix is assumed.',
  };
}

// Lines worth marking on a stellar spectrum (air wavelengths, nm), with what makes them.
export const STELLAR_LINES = [
  { nm: 393.37, label: 'Ca II K', el: 'Ca' }, { nm: 396.85, label: 'Ca II H', el: 'Ca' },
  { nm: 410.17, label: 'Hδ', el: 'H' }, { nm: 430.8, label: 'G band (CH)', el: 'C' }, { nm: 434.05, label: 'Hγ', el: 'H' },
  { nm: 486.13, label: 'Hβ', el: 'H' }, { nm: 517.27, label: 'Mg b', el: 'Mg' }, { nm: 527.0, label: 'Fe I', el: 'Fe' },
  { nm: 589.3, label: 'Na D', el: 'Na' }, { nm: 656.28, label: 'Hα', el: 'H' },
  { nm: 705.4, label: 'TiO', el: 'TiO', cool: true }, { nm: 777.4, label: 'O I', el: 'O' }, { nm: 766.5, label: 'K I', el: 'K' },
  { nm: 849.8, label: 'Ca II triplet', el: 'Ca' }, { nm: 1083, label: 'He I', el: 'He', hot: true },
  { nm: 1282, label: 'Paβ', el: 'H' }, { nm: 2166, label: 'Brγ', el: 'H' },
];

/** Planck spectral radiance B_λ(T) (arbitrary units), λ in nm. */
export function planck(nm, T) {
  const l = nm * 1e-9, h = 6.62607015e-34, c = 299792458, k = 1.380649e-23;
  return 1 / (l ** 5 * (Math.exp((h * c) / (l * k * T)) - 1));
}

/** Wien peak wavelength (nm) for temperature T. */
export const wienPeakNm = (T) => 2.897771955e6 / T;
