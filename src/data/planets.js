// Planet composition and spectral reference data for the Planet View.
//
// Atmospheres (by volume) from the NASA planetary fact sheets, with Curiosity/SAM for Mars
// and Galileo/Juno for Jupiter. Interiors are models fitted to gravity, seismology (Earth,
// Mars/InSight) and spacecraft gravity fields (Juno, Cassini) — hence MODELLED. Molecular
// band positions are laboratory values. Exoplanet atmospheres are listed only where a
// spectrum has actually been measured.

export const SOL_ATMOSPHERES = {
  mercury: { kind: 'EXOSPHERE', pressureBar: 1e-14, source: 'NASA fact sheet (MESSENGER)',
    gases: [['O₂', 'O2', 42], ['Na', 'Na', 29], ['H₂', 'H2', 22], ['He', 'He', 6], ['K', 'K', 0.5]] },
  venus: { kind: 'ATMOSPHERE', pressureBar: 92, source: 'NASA fact sheet (Venera, Pioneer Venus)',
    gases: [['CO₂', 'CO2', 96.5], ['N₂', 'N2', 3.5], ['SO₂', 'SO2', 0.015], ['Ar', 'Ar', 0.007], ['H₂O', 'H2O', 0.002]] },
  earth: { kind: 'ATMOSPHERE', pressureBar: 1.014, source: 'NASA fact sheet; CO₂ from NOAA (2025)',
    gases: [['N₂', 'N2', 78.08], ['O₂', 'O2', 20.95], ['H₂O', 'H2O', 1.0], ['Ar', 'Ar', 0.934], ['CO₂', 'CO2', 0.0425], ['CH₄', 'CH4', 0.00019], ['O₃', 'O3', 0.000004]] },
  mars: { kind: 'ATMOSPHERE', pressureBar: 0.006, source: 'Curiosity SAM (Franz et al. 2017)',
    gases: [['CO₂', 'CO2', 95.1], ['N₂', 'N2', 2.59], ['Ar', 'Ar', 1.94], ['O₂', 'O2', 0.16], ['CO', 'CO', 0.06]] },
  jupiter: { kind: 'UPPER ATMOSPHERE', pressureBar: null, source: 'NASA fact sheet (Galileo probe)',
    gases: [['H₂', 'H2', 89.8], ['He', 'He', 10.2], ['CH₄', 'CH4', 0.3], ['NH₃', 'NH3', 0.026], ['H₂O', 'H2O', 0.0004]] },
  saturn: { kind: 'UPPER ATMOSPHERE', pressureBar: null, source: 'NASA fact sheet (Voyager, Cassini)',
    gases: [['H₂', 'H2', 96.3], ['He', 'He', 3.25], ['CH₄', 'CH4', 0.45], ['NH₃', 'NH3', 0.0125]] },
  uranus: { kind: 'UPPER ATMOSPHERE', pressureBar: null, source: 'NASA fact sheet (Voyager 2)',
    gases: [['H₂', 'H2', 82.5], ['He', 'He', 15.2], ['CH₄', 'CH4', 2.3]] },
  neptune: { kind: 'UPPER ATMOSPHERE', pressureBar: null, source: 'NASA fact sheet (Voyager 2)',
    gases: [['H₂', 'H2', 80], ['He', 'He', 19], ['CH₄', 'CH4', 1.5]] },
  pluto: { kind: 'ATMOSPHERE', pressureBar: 1e-5, source: 'New Horizons (Gladstone et al. 2016)',
    gases: [['N₂', 'N2', 99.5], ['CH₄', 'CH4', 0.45], ['CO', 'CO', 0.05]] },
  moon: { kind: 'EXOSPHERE', pressureBar: 3e-15, source: 'LADEE and Apollo surface instruments (NASA fact sheet)',
    gases: [['Ar', 'Ar', 40], ['He', 'He', 40], ['Ne', 'Ne', 19], ['Na', 'Na', 0.5], ['K', 'K', 0.1]] },
  io: { kind: 'ATMOSPHERE', pressureBar: 1e-9, source: 'Ground-based and Galileo spectroscopy (Lellouch et al. 2007)',
    gases: [['SO₂', 'SO2', 90], ['SO', 'SO', 5], ['Na', 'Na', 1], ['K', 'K', 0.1]] },
  europa: { kind: 'EXOSPHERE', pressureBar: 1e-12, source: 'Hubble (Hall et al. 1995); Juno (2024)', gases: [['O₂', 'O2', 95], ['H₂', 'H2', 4], ['Na', 'Na', 0.5]] },
  titan: { kind: 'ATMOSPHERE', pressureBar: 1.45, source: 'Huygens probe (Niemann et al. 2005, 2010)',
    gases: [['N₂', 'N2', 98.4], ['CH₄', 'CH4', 1.48], ['H₂', 'H2', 0.1], ['CO', 'CO', 0.005]] },
  enceladus: { kind: 'SOUTH-POLE PLUMES', pressureBar: null, source: 'Cassini INMS (Waite et al. 2017)',
    gases: [['H₂O', 'H2O', 97], ['CO₂', 'CO2', 0.6], ['CH₄', 'CH4', 0.2], ['NH₃', 'NH3', 0.6], ['H₂', 'H2', 0.9]] },
  triton: { kind: 'ATMOSPHERE', pressureBar: 1.4e-5, source: 'Voyager 2; stellar occultations (Lellouch et al. 2010)',
    gases: [['N₂', 'N2', 99.9], ['CH₄', 'CH4', 0.02], ['CO', 'CO', 0.03]] },
};

// Interior layers, outer radius as a fraction of the planet radius (inside → out).
export const SOL_INTERIORS = {
  mercury: [['IRON CORE', 0.83, 'iron'], ['SILICATE MANTLE', 0.99, 'rock'], ['CRUST', 1, 'crust']],
  venus: [['IRON CORE', 0.5, 'iron'], ['SILICATE MANTLE', 0.99, 'rock'], ['CRUST', 1, 'crust']],
  earth: [['INNER CORE (SOLID IRON)', 0.19, 'iron'], ['OUTER CORE (LIQUID IRON)', 0.546, 'iron-liquid'], ['MANTLE', 0.995, 'rock'], ['CRUST', 1, 'crust']],
  mars: [['LIQUID IRON CORE', 0.54, 'iron-liquid'], ['MANTLE', 0.985, 'rock'], ['CRUST', 1, 'crust']],
  jupiter: [['DILUTE CORE', 0.4, 'rock'], ['METALLIC HYDROGEN', 0.8, 'metallic'], ['MOLECULAR H₂ / He', 1, 'gas']],
  saturn: [['DIFFUSE CORE', 0.25, 'rock'], ['METALLIC HYDROGEN', 0.5, 'metallic'], ['MOLECULAR H₂ / He', 1, 'gas']],
  uranus: [['ROCKY CORE', 0.2, 'rock'], ['WATER–AMMONIA–METHANE ICES', 0.75, 'ice'], ['H₂ / He / CH₄ ENVELOPE', 1, 'gas']],
  neptune: [['ROCKY CORE', 0.25, 'rock'], ['WATER–AMMONIA–METHANE ICES', 0.8, 'ice'], ['H₂ / He / CH₄ ENVELOPE', 1, 'gas']],
  pluto: [['ROCKY CORE', 0.72, 'rock'], ['WATER ICE (POSSIBLE OCEAN)', 0.98, 'ice'], ['NITROGEN-ICE CRUST', 1, 'crust']],
  moon: [['IRON CORE', 0.19, 'iron'], ['MANTLE', 0.98, 'rock'], ['ANORTHOSITE CRUST', 1, 'crust']],
  io: [['IRON / IRON-SULFIDE CORE', 0.52, 'iron'], ['SILICATE MANTLE (PARTLY MOLTEN)', 0.98, 'rock'], ['SULFUR-RICH CRUST', 1, 'crust']],
  europa: [['IRON CORE', 0.38, 'iron'], ['ROCKY MANTLE', 0.92, 'rock'], ['SALTY OCEAN', 0.985, 'water'], ['ICE SHELL', 1, 'ice']],
  ganymede: [['IRON CORE', 0.25, 'iron'], ['SILICATE MANTLE', 0.45, 'rock'], ['HIGH-PRESSURE ICE', 0.88, 'ice'], ['SALTY OCEAN', 0.94, 'water'], ['ICE SHELL', 1, 'ice']],
  callisto: [['ROCK–ICE MIX', 0.85, 'rock'], ['POSSIBLE OCEAN', 0.93, 'water'], ['ICE CRUST', 1, 'ice']],
  titan: [['HYDRATED ROCK CORE', 0.77, 'rock'], ['HIGH-PRESSURE ICE', 0.86, 'ice'], ['WATER–AMMONIA OCEAN', 0.96, 'water'], ['ICE SHELL', 1, 'ice']],
  enceladus: [['ROCKY CORE', 0.75, 'rock'], ['GLOBAL OCEAN', 0.92, 'water'], ['ICE SHELL', 1, 'ice']],
  triton: [['ROCKY CORE', 0.7, 'rock'], ['WATER ICE MANTLE', 0.97, 'ice'], ['NITROGEN-ICE CRUST', 1, 'crust']],
  charon: [['ROCKY CORE', 0.7, 'rock'], ['WATER ICE MANTLE', 1, 'ice']],
  ceres: [['HYDRATED ROCK INTERIOR', 0.85, 'rock'], ['BRINE-RICH LAYER', 0.92, 'water'], ['ICE–ROCK–SALT CRUST', 1, 'crust']],
  vesta: [['IRON CORE', 0.42, 'iron'], ['OLIVINE MANTLE', 0.92, 'rock'], ['BASALTIC CRUST', 1, 'crust']],
};

export const INTERIOR_SOURCES = {
  earth: 'Seismology (PREM, Dziewonski & Anderson 1981)', mars: 'InSight seismology (Stähler et al. 2021)',
  jupiter: 'Juno gravity (Wahl et al. 2017)', saturn: 'Ring seismology (Mankovich & Fuller 2021)',
  moon: 'Apollo seismology (Weber et al. 2011)', io: 'Galileo gravity (Anderson et al. 2001)', europa: 'Galileo gravity and magnetometry (Anderson et al. 1998; Kivelson et al. 2000)',
  ganymede: 'Galileo gravity and Hubble aurorae (Saur et al. 2015)', titan: 'Cassini gravity and tides (Iess et al. 2012)',
  enceladus: 'Cassini gravity and libration (Thomas et al. 2016)', ceres: 'Dawn gravity (Ermakov et al. 2017)', vesta: 'Dawn gravity (Russell et al. 2012)',
};

// Absorption bands in the 300–2500 nm range (nm, rough half-width), laboratory positions.
export const BANDS = {
  O2: [[687, 4, 'B band'], [760, 6, 'A band'], [1270, 10, '']],
  O3: [[310, 20, 'Hartley/Huggins'], [600, 90, 'Chappuis']],
  H2O: [[720, 10, ''], [820, 12, ''], [940, 25, ''], [1130, 30, ''], [1400, 60, ''], [1900, 70, ''], [2400, 40, '']],
  CO2: [[1430, 20, ''], [1600, 25, ''], [2010, 35, ''], [2060, 25, '']],
  CH4: [[619, 6, ''], [727, 8, ''], [890, 12, ''], [1000, 15, ''], [1150, 30, ''], [1400, 40, ''], [1700, 40, ''], [2300, 60, '']],
  NH3: [[645, 6, ''], [790, 8, ''], [1500, 40, ''], [2000, 40, '']],
  CO: [[1570, 15, ''], [2350, 25, '']],
  H2: [[2120, 120, 'collision-induced']],
  N2: [[2150, 80, 'collision-induced (weak)']],
  SO2: [[300, 20, '']],
  Na: [[589, 2, 'D lines']],
  K: [[766, 2, '']],
  SO: [[2400, 60, '']],
  Ne: [[640, 2, '']],
  Ar: [[812, 2, '']],
  He: [[1083, 2, '']],
  H2S: [[1590, 30, ''], [2630, 40, '']],
};

export const MOLECULE_NAMES = { O2: 'OXYGEN', O3: 'OZONE', H2O: 'WATER', CO2: 'CARBON DIOXIDE', CH4: 'METHANE', NH3: 'AMMONIA',
  CO: 'CARBON MONOXIDE', H2: 'HYDROGEN', N2: 'NITROGEN', SO2: 'SULFUR DIOXIDE', Na: 'SODIUM', K: 'POTASSIUM', H2S: 'HYDROGEN SULFIDE', Ar: 'ARGON', He: 'HELIUM', SO: 'SULFUR MONOXIDE', Ne: 'NEON' };

// Measured exoplanet atmospheres (only planets within the app's 212 ly catalogue range).
export const EXO_ATMOSPHERES = {
  'HD 189733 b': { gases: ['H2O', 'CO', 'CO2', 'H2S'], ref: 'Fu et al. 2024, Nature (JWST)', note: 'Hot Jupiter: water, carbon monoxide and dioxide, and the first hydrogen sulfide seen in an exoplanet.' },
  'K2-18 b': { gases: ['CH4', 'CO2'], ref: 'Madhusudhan et al. 2023, ApJL (JWST)', note: 'Methane and carbon dioxide in a temperate sub-Neptune. A claimed dimethyl sulfide signal is not confirmed.' },
  '55 Cnc e': { gases: ['CO', 'CO2'], ref: 'Hu et al. 2024, Nature (JWST)', note: 'A lava world with a secondary atmosphere, probably carbon monoxide or dioxide.' },
  'GJ 1214 b': { gases: ['CO2'], ref: 'Kempton et al. 2023; Schlawin et al. 2024 (JWST)', note: 'Thick high-altitude haze; a metal-rich atmosphere, with carbon dioxide tentatively seen.' },
  'TRAPPIST-1 b': { gases: [], ref: 'Greene et al. 2023, Nature (JWST)', note: 'Dayside emission rules out a thick CO₂ atmosphere: likely bare rock.' },
  'TRAPPIST-1 c': { gases: [], ref: 'Zieba et al. 2023, Nature (JWST)', note: 'At most a thin atmosphere; not a Venus-like CO₂ blanket.' },
  'LHS 3844 b': { gases: [], ref: 'Kreidberg et al. 2019, Nature (Spitzer)', note: 'No detectable atmosphere: a bare, dark rock.' },
  'GJ 486 b': { gases: ['H2O'], ref: 'Moran et al. 2023, ApJL (JWST)', note: 'Water vapour signal, tentative: it may come from starspots instead.' },
};

// Mass–radius composition curves (Earth units), after Zeng, Sasselov & Jacobsen 2016/2019:
// R ≈ k · M^0.27 for solid worlds (1–20 M⊕); a hydrogen–helium curve for gas giants.
export const MR_CURVES = [
  { id: 'iron', label: 'PURE IRON', R: (m) => 0.86 * m ** 0.27, max: 30 },
  { id: 'earth', label: 'EARTH-LIKE (33% IRON)', R: (m) => 1.0 * m ** 0.27, max: 30 },
  { id: 'water', label: '50% WATER', R: (m) => 1.24 * m ** 0.27, max: 30 },
  { id: 'hhe', label: 'H/He GAS GIANT', R: (m) => (m < 100 ? 3.7 * m ** 0.25 : 11.6 - 0.9 * Math.log10(m / 318)), min: 15 },
];

/** Bulk density (g/cm³) from mass (kg) and radius (km). */
export const density = (massKg, radiusKm) => (massKg * 1000) / ((4 / 3) * Math.PI * (radiusKm * 1e5) ** 3);
