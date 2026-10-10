// How bright Sol's bodies look from Earth (src/astro/observe.js).
//   MH18: Mallama & Hilton (2018), Astronomy and Computing 25, 10 (planets).
//   moon: V = 0.21 + 5 log rΔ + 0.026α + 4×10⁻⁹α⁴ (Allen's Astrophysical Quantities).
//   H, G: the IAU H–G system with JPL SBDB/Horizons values (dwarf planets and asteroids).
//   V0, beta: V(1,0) and a linear phase coefficient (mag/deg) as used by JPL Horizons for each
//     satellite (read back from Horizons APmag at two epochs; most moons are given no phase term).
export const PHOTOMETRY = {
  mercury: { law: 'MH18' }, venus: { law: 'MH18' }, earth: { law: 'MH18' }, mars: { law: 'MH18' },
  jupiter: { law: 'MH18' }, saturn: { law: 'MH18' }, uranus: { law: 'MH18' }, neptune: { law: 'MH18' },
  pluto: { V0: -0.94 }, moon: { law: 'moon' },
  phobos: { V0: 11.8 }, deimos: { V0: 12.89 },
  io: { V0: -1.60, beta: 0.028 }, europa: { V0: -1.30, beta: 0.0078 }, ganymede: { V0: -2.02, beta: 0.0187 }, callisto: { V0: -0.81, beta: 0.0268 },
  amalthea: { V0: 7.4 },
  mimas: { V0: 3.3 }, enceladus: { V0: 2.1 }, tethys: { V0: 0.6 }, dione: { V0: 0.8 }, rhea: { V0: 0.1 }, titan: { V0: -1.28 },
  hyperion: { V0: 4.63 }, iapetus: { V0: 1.5 }, phoebe: { V0: 6.89 },
  miranda: { V0: 3.6 }, ariel: { V0: 1.45 }, umbriel: { V0: 2.1 }, titania: { V0: 1.02 }, oberon: { V0: 1.23 },
  triton: { V0: -1.24 }, proteus: { V0: 5.6 }, nereid: { V0: 4.0 }, charon: { V0: 0.9 },
  ceres: { H: 3.34, G: 0.12 }, vesta: { H: 3.25, G: 0.32 }, pallas: { H: 4.12, G: 0.11 }, hygiea: { H: 5.65, G: 0.15 },
  haumea: { H: 0.14, G: 0.15 }, makemake: { H: -0.25, G: 0.15 }, eris: { H: -1.26, G: 0.15 }, gonggong: { H: 1.82, G: 0.15 },
  quaoar: { H: 2.41, G: 0.15 }, orcus: { H: 2.13, G: 0.15 }, sedna: { H: 1.5, G: 0.15 }, arrokoth: { H: 11.06, G: 0.15 },
};

// Equatorial radii (km) where they differ from the mean radius: angular diameters, like
// Horizons, use the equatorial size (IAU WGCCRE 2015).
export const EQUATORIAL_RADIUS_KM = {
  mercury: 2440.53, earth: 6378.137, mars: 3396.19, jupiter: 71492, saturn: 60268, uranus: 25559, neptune: 24764,
};
