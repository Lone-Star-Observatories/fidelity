// Curated deep-sky landmarks with literature distances (ly), to label what the catalogues
// show as dots: nebulae (no all-sky catalogue gives their distances), famous star clusters
// (named in Hunt & Reffert 2023), and galaxies and clusters of galaxies beyond our own.

// [name, kind, RA°, Dec°, distance ly, note]
export const NEBULAE = [
  ['Orion Nebula · M42', 'HII', 83.82, -5.39, 1344, 'The nearest big star nursery; VLBA parallax 414 pc (Menten et al. 2007).'],
  ['Horsehead Nebula', 'dark', 85.25, -2.46, 1375, 'A pillar of dust silhouetted against glowing hydrogen.'],
  ['California Nebula', 'HII', 60.825, 36.42, 1000, 'Lit by the hot star ξ Persei.'],
  ['Lagoon Nebula · M8', 'HII', 270.92, -24.38, 4100, ''],
  ['Trifid Nebula · M20', 'HII', 270.6, -23.03, 4100, ''],
  ['Eagle Nebula · M16', 'HII', 274.7, -13.81, 5700, 'Home of the Pillars of Creation.'],
  ['Omega Nebula · M17', 'HII', 275.2, -16.17, 5500, ''],
  ['Carina Nebula', 'HII', 161.26, -59.87, 8500, 'Contains η Carinae, a star that may explode soon (astronomically).'],
  ['Rosette Nebula', 'HII', 97.98, 4.95, 5200, ''],
  ['North America Nebula', 'HII', 314.7, 44.33, 2590, ''],
  ['Heart Nebula', 'HII', 38.2, 61.45, 7500, ''],
  ['Cone Nebula', 'HII', 100.24, 9.89, 2500, ''],
  ['Rho Ophiuchi clouds', 'dark', 246.8, -24.5, 460, 'One of the closest star-forming regions.'],
  ['Taurus Molecular Cloud', 'dark', 67, 26, 450, 'Where many young Sun-like stars are forming.'],
  ['Coalsack', 'dark', 191.0, -63.0, 600, 'A dark cloud visible to the naked eye next to the Southern Cross.'],
  ['Witch Head Nebula', 'reflection', 75.5, -7.9, 900, 'Reflects light from Rigel.'],
  ['Helix Nebula', 'PN', 337.41, -20.84, 655, 'One of the closest planetary nebulae: a dying Sun-like star.'],
  ['Ring Nebula · M57', 'PN', 283.4, 33.03, 2570, ''],
  ['Dumbbell Nebula · M27', 'PN', 299.9, 22.72, 1360, ''],
  ["Cat's Eye Nebula", 'PN', 269.64, 66.63, 3300, ''],
  ['Owl Nebula · M97', 'PN', 168.7, 55.02, 2030, ''],
  ['Butterfly Nebula', 'PN', 258.43, -37.1, 3400, ''],
  ['Southern Ring Nebula', 'PN', 151.76, -40.44, 2500, 'Imaged by JWST in its first release (2022).'],
  ['Crab Nebula · M1', 'SNR', 83.63, 22.01, 6500, 'Remains of the supernova seen in 1054, with a pulsar at its heart.'],
  ['Cassiopeia A', 'SNR', 350.85, 58.81, 11000, 'The youngest known Milky Way supernova remnant (~1680).'],
  ['Vela supernova remnant', 'SNR', 128.5, -45.8, 800, 'Exploded about 11,000 years ago.'],
  ['Veil Nebula', 'SNR', 312.75, 30.67, 2400, 'The Cygnus Loop.'],
  ["Tycho's supernova remnant", 'SNR', 6.33, 64.14, 8000, 'Seen by Tycho Brahe in 1572.'],
  ["Kepler's supernova remnant", 'SNR', 262.67, -21.49, 17000, 'The last naked-eye Milky Way supernova (1604).'],
];
export const NEBULA_KIND = { HII: 'EMISSION NEBULA (HII)', PN: 'PLANETARY NEBULA', SNR: 'SUPERNOVA REMNANT', dark: 'DARK CLOUD', reflection: 'REFLECTION NEBULA' };

// Hunt & Reffert names → common names, labelled in the Quadrant View.
export const FAMOUS_CLUSTERS = {
  'Melotte 22': 'Pleiades', 'Melotte 25': 'Hyades', 'NGC 2632': 'Beehive (Praesepe)', 'NGC 869': 'h Persei (Double Cluster)', 'NGC 884': 'χ Persei (Double Cluster)',
  'IC 2602': 'Southern Pleiades', 'IC 2391': 'ο Velorum Cluster', 'NGC 2682': 'M67', 'NGC 6475': 'Ptolemy Cluster (M7)', 'NGC 6405': 'Butterfly Cluster (M6)',
  'NGC 2516': 'Southern Beehive', 'Melotte 111': 'Coma Star Cluster', 'NGC 5139': 'ω Centauri', 'NGC 6205': 'M13 (Hercules)',
  'NGC 6121': 'M4', 'NGC 6656': 'M22', 'NGC 3603': 'NGC 3603', 'Trumpler 14': 'Trumpler 14 (Carina)',
};

// UNGC names → common names.
export const GALAXY_NAMES = {
  MESSIER031: 'Andromeda · M31', MESSIER033: 'Triangulum · M33', LMC: 'Large Magellanic Cloud', SMC: 'Small Magellanic Cloud', MESSIER081: "Bode's Galaxy · M81",
  MESSIER082: 'Cigar Galaxy · M82', NGC5128: 'Centaurus A', MESSIER101: 'Pinwheel · M101', NGC0253: 'Sculptor Galaxy', MESSIER083: 'Southern Pinwheel · M83',
  IC0342: 'IC 342', MESSIER094: 'M94', MESSIER064: 'Black Eye · M64', MESSIER051a: 'Whirlpool · M51', NGC6822: "Barnard's Galaxy", MESSIER032: 'M32', MESSIER110: 'M110',
  Maffei1: 'Maffei 1', Maffei2: 'Maffei 2', CenAdwarfs: '', NGC4945: 'NGC 4945', NGC0300: 'NGC 300', NGC0055: 'NGC 55', MESSIER106: 'M106', NGC4214: 'NGC 4214', WLM: 'WLM',
};

// Clusters of galaxies and superclusters beyond the nearby-galaxy catalogue: [name, RA°, Dec°, distance Mly, note].
export const GALAXY_CLUSTERS = [
  ['Virgo Cluster', 187.71, 12.39, 54, 'The heart of our Local Supercluster: ~1,500 galaxies around M87, whose black hole the EHT imaged in 2019.'],
  ['Fornax Cluster', 54.62, -35.45, 62, ''],
  ['Centaurus Cluster', 192.2, -41.31, 170, ''],
  ['Hydra Cluster', 159.18, -27.53, 160, ''],
  ['Norma Cluster · Great Attractor', 243.9, -60.9, 220, 'The core of the Great Attractor, hidden behind the Milky Way.'],
  ['Perseus Cluster', 49.95, 41.51, 240, 'The X-ray brightest cluster in the sky.'],
  ['Coma Cluster', 194.95, 27.98, 320, 'Where Fritz Zwicky first inferred dark matter (1933).'],
  ['Shapley Supercluster', 201.98, -31.5, 650, 'The most massive structure in the nearby universe.'],
  ['Hercules Cluster', 241.31, 17.72, 500, ''],
];

/** Cluster colour temperature from age: young clusters are dominated by hot blue stars, old ones by red giants. */
export const ageTeff = (logAge) => (logAge == null ? 6000 : Math.max(3500, Math.min(25000, 25000 * 10 ** (-(logAge - 6.5) * 0.55))));
