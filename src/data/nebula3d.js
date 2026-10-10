// Real images of the Quadrant View's landmark nebulae (#24), and the best-effort 3D shape each
// is drawn with. Shared by the browser (orientation, size, model, credits) and the backend
// (`server/nebulae.js`: this table is its download allowlist).
//
// Image metadata was read from each image's page (ESA/Hubble, ESA/Webb and ESO publish the
// AVM astrometry: centre, field of view and "North is N° left/right of vertical"; Chandra's
// from the AVM tags embedded in its JPEGs). `north` is the angle the north direction makes
// with the image's vertical, positive to the LEFT (counter-clockwise), the ESA/ESO convention;
// east is 90° counter-clockwise from north (the sky as seen, not mirrored). Survey cutouts are
// rendered by CDS hips2fits on a TAN projection, north up (`north: 0`).
//
// Model kinds (all MODELLED; `R` is the object's radius in arcminutes, `depth` its half-depth
// along the line of sight in units of R):
//   blister  a concave ionized bowl on the face of its molecular cloud, opening toward us
//   cloud    emission spread through a slab (Gaussian in depth)
//   shell    emission on a spherical/ellipsoidal shell (limb-brightened)
//   filled   emission filling an ellipsoid (pulsar-wind nebulae, bipolar lobes seen side-on)
//   barrel   a cylinder seen near end-on (the Ring and Helix)
// Seen from Sol, every model adds back up to exactly the image (emission is only redistributed
// along each line of sight), so the view from Earth stays MEASURED.

const ESAHUBBLE = (id) => ({ url: `https://cdn.esahubble.org/archives/images/screen/${id}.jpg`, page: `https://esahubble.org/images/${id}/`, licence: 'CC BY 4.0' });
const ESAWEBB = (id) => ({ url: `https://cdn.esawebb.org/archives/images/screen/${id}.jpg`, page: `https://esawebb.org/images/${id}/`, licence: 'CC BY 4.0' });
const ESO = (id) => ({ url: `https://cdn.eso.org/images/screen/${id}.jpg`, page: `https://www.eso.org/public/images/${id}/`, licence: 'CC BY 4.0' });
const CHANDRA = (path, file) => ({ url: `https://chandra.harvard.edu/photo/${path}/${file}`, page: `https://chandra.harvard.edu/photo/${path}/`, licence: 'NASA/CXC: no copyright asserted, NASA media guidelines' });

// Survey cutouts through CDS hips2fits (square, north up). fov in degrees.
export const SURVEY_HIPS = {
  dss2: { hips: 'CDS/P/DSS2/color', credit: 'Digitized Sky Survey 2 (POSS-II / UK Schmidt plates; STScI), via CDS hips2fits', licence: 'DSS: non-commercial use with acknowledgement (STScI/AURA)' },
  panstarrs: { hips: 'CDS/P/PanSTARRS/DR1/color-z-zg-g', credit: 'Pan-STARRS1 DR1 (University of Hawaiʻi), via CDS hips2fits', licence: 'PS1: free use with acknowledgement' },
  halpha: { hips: 'CDS/P/Finkbeiner', credit: 'Finkbeiner 2003 full-sky Hα composite (WHAM, VTSS, SHASSA), via CDS hips2fits', licence: 'ODbL-1.0 (CDS HiPS)' },
  mellinger: { hips: 'CDS/P/Mellinger/color', credit: 'Axel Mellinger all-sky colour mosaic, via CDS hips2fits', licence: 'non-commercial use with credit (A. Mellinger)' },
};
const survey = (key, ra, dec, fovDeg) => ({
  survey: key, ra, dec, fov: [fovDeg * 60, fovDeg * 60], north: 0, date: null, credit: SURVEY_HIPS[key].credit, licence: SURVEY_HIPS[key].licence,
  page: `https://alasky.cds.unistra.fr/hips-image-services/hips2fits`,
  url: `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${new URLSearchParams({ hips: SURVEY_HIPS[key].hips, width: '1024', height: '1024', fov: String(fovDeg), ra: String(ra), dec: String(dec), projection: 'TAN', coordsys: 'icrs', format: 'jpg' })}`,
});

/**
 * Keyed by the nebula's name in NEBULAE (`src/data/deepsky.js`).
 * img: { key, url, page, licence, credit, date, what, ra, dec (image centre °), fov [w, h] arcmin, north °, black (sky level to subtract), tint? }
 * model: { kind, R (arcmin), depth, w?, centre? [ra, dec], ref }
 */
export const NEBULA_3D = {
  'Orion Nebula · M42': {
    img: { key: 'm42', ...ESAHUBBLE('heic0601a'), what: 'Hubble ACS mosaic (Orion Treasury Project)', ra: 83.7905, dec: -5.414, fov: [30.03, 30.03], north: 0, date: '2006-01-11',
      credit: 'NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Space Telescope Orion Treasury Project Team' },
    model: { kind: 'blister', R: 12, depth: 0.5, centre: [83.8186, -5.3897], label: 'BLISTER BOWL', ref: "O'Dell 2001 (ARA&A 39, 99), Wen & O'Dell 1995: a thin concave ionized layer on the face of the OMC-1 cloud, opening toward us, with the Trapezium about 0.25 pc in front of it." },
  },
  'Horsehead Nebula': {
    img: { key: 'horsehead', ...ESO('eso0202a'), what: 'VLT FORS2', ra: 85.2458, dec: -2.4582, fov: [6.53, 6.72], north: 89.9, date: '2002-01-25', credit: 'ESO' },
    model: { kind: 'cloud', R: 4, depth: 0.5, label: 'DUST PILLAR', ref: 'A pillar of the L1630 cloud in front of the glowing IC 434: depth assumed about half its width.' },
  },
  'California Nebula': {
    img: { key: 'california', ...survey('dss2', 60.825, 36.42, 3.2), what: 'DSS2 colour survey cutout' },
    model: { kind: 'cloud', R: 75, depth: 0.25, label: 'IONIZED SHEET', ref: 'A long sheet lit by ξ Persei; depth assumed a quarter of its length.' },
  },
  'Lagoon Nebula · M8': {
    img: { key: 'm8', ...ESO('eso1403a'), what: 'VLT Survey Telescope (VPHAS+)', ra: 270.9041, dec: -24.3869, fov: [58.12, 39.74], north: -0.1, date: '2014-01-22', credit: 'ESO/VPHAS+ team' },
    model: { kind: 'cloud', R: 28, depth: 0.5, label: 'IONIZED CLOUD', ref: 'No published 3D model: emission spread through a slab half as deep as it is wide.' },
  },
  'Trifid Nebula · M20': {
    img: { key: 'm20', ...ESO('eso0930a'), what: 'MPG/ESO 2.2 m WFI', ra: 270.6748, dec: -22.9712, fov: [13.89, 22.82], north: 0.2, date: '2009-08-26', credit: 'ESO' },
    model: { kind: 'cloud', R: 12, depth: 0.7, label: 'IONIZED CLOUD', ref: 'No published 3D model: emission spread through a slab.' },
  },
  'Eagle Nebula · M16': {
    img: { key: 'm16', ...ESO('eso0926a'), what: 'MPG/ESO 2.2 m WFI', ra: 274.7, dec: -13.82, fov: [32.08, 32.08], north: 0, date: '2009-07-16', credit: 'ESO' },
    model: { kind: 'blister', R: 14, depth: 0.5, centre: [274.6518, -13.8007], label: 'CAVITY WALL', ref: 'The cavity cleared by NGC 6611, its pillars on the far wall (Hester et al. 1996): drawn as a bowl opening toward us.' },
  },
  'Omega Nebula · M17': {
    img: { key: 'm17', ...ESO('eso0925a'), what: 'VLT ISAAC (infrared)', ra: 275.1963, dec: -16.172, fov: [8.57, 8.57], north: -179, date: '2009-07-07', credit: 'ESO' },
    model: { kind: 'cloud', R: 5, depth: 0.6, label: 'IONIZED CLOUD', ref: 'A blister seen nearly edge-on; drawn as a slab.' },
  },
  'Carina Nebula': {
    img: { key: 'carina', ...ESO('eso1250a'), what: 'VLT Survey Telescope (VPHAS+)', ra: 161.2737, dec: -59.8632, fov: [61.82, 66.34], north: 0, date: '2012-12-06',
      credit: 'ESO. Acknowledgement: VPHAS+ Consortium/Cambridge Astronomical Survey Unit' },
    model: { kind: 'cloud', R: 50, depth: 0.5, label: 'GIANT HII COMPLEX', ref: 'No published 3D model: emission spread through a slab half as deep as it is wide.' },
  },
  'Rosette Nebula': {
    img: { key: 'rosette', ...survey('dss2', 97.98, 4.95, 1.8), what: 'DSS2 colour survey cutout' },
    model: { kind: 'shell', R: 40, depth: 1, w: 0.35, label: 'THICK SHELL', ref: 'A thick shell around the cavity blown by NGC 2244 (Bruhweiler et al. 2010); taken as round.' },
  },
  'North America Nebula': {
    img: { key: 'ngc7000', ...survey('dss2', 314.7, 44.33, 3), what: 'DSS2 colour survey cutout' },
    model: { kind: 'cloud', R: 70, depth: 0.3, label: 'IONIZED SHEET', ref: 'Part of one HII region with the Pelican, cut by the dust lane L935; depth assumed.' },
  },
  'Heart Nebula': {
    img: { key: 'ic1805', ...survey('dss2', 38.2, 61.45, 2.6), what: 'DSS2 colour survey cutout' },
    model: { kind: 'cloud', R: 65, depth: 0.5, label: 'IONIZED CLOUD', ref: 'Around the cluster Melotte 15 (IC 1805); depth assumed.' },
  },
  'Cone Nebula': {
    img: { key: 'ngc2264', ...survey('dss2', 100.25, 9.65, 1.0), what: 'DSS2 colour survey cutout (NGC 2264 field)' },
    model: { kind: 'cloud', R: 25, depth: 0.5, label: 'IONIZED CLOUD', ref: 'The NGC 2264 region; depth assumed.' },
  },
  'Rho Ophiuchi clouds': {
    img: { key: 'rhooph', ...survey('mellinger', 246.8, -24.5, 6), what: 'Mellinger colour mosaic cutout' },
    model: { kind: 'cloud', R: 150, depth: 0.3, dust: true, label: 'DUST CLOUD', ref: 'Dust density from how dark the image is (more extinction, less light); depth assumed a third of its width.' },
  },
  'Taurus Molecular Cloud': {
    img: { key: 'taurus', ...survey('mellinger', 67, 26, 14), what: 'Mellinger colour mosaic cutout' },
    model: { kind: 'cloud', R: 360, depth: 0.3, dust: true, label: 'DUST CLOUD', ref: 'Dust density from how dark the image is; Gaia shows the complex is ~30 pc deep (Roccatagliata et al. 2020), about a third of its width.' },
  },
  Coalsack: {
    img: { key: 'coalsack', ...survey('mellinger', 189, -63, 8), what: 'Mellinger colour mosaic cutout' },
    model: { kind: 'cloud', R: 180, depth: 0.3, dust: true, label: 'DUST CLOUD', ref: 'Dust density from how dark the image is; depth assumed.' },
  },
  'Witch Head Nebula': {
    img: { key: 'ic2118', ...survey('dss2', 75.5, -7.9, 3), what: 'DSS2 colour survey cutout' },
    model: { kind: 'cloud', R: 70, depth: 0.3, label: 'REFLECTING DUST', ref: 'Dust lit by Rigel; depth assumed.' },
  },
  'Helix Nebula': {
    img: { key: 'helix', ...ESO('eso0907a'), what: 'VISTA (infrared)', ra: 337.4107, dec: -20.8372, fov: [28.02, 25.94], north: 0.1, date: '2009-02-25', credit: 'ESO / VISTA. Acknowledgment: Cambridge Astronomical Survey Unit' },
    model: { kind: 'barrel', R: 8.5, depth: 0.6, centre: [337.4106, -20.8372], label: 'BARREL, END-ON', ref: "O'Dell, McCullough & Meixner 2004: an inner disk and outer ring seen nearly pole-on; drawn as a thick barrel along our line of sight." },
  },
  'Ring Nebula · M57': {
    img: { key: 'm57', ...ESAHUBBLE('heic1310a'), what: 'Hubble WFC3', ra: 283.3967, dec: 33.0289, fov: [2.1, 2.1], north: 11.7, date: '2013-05-23', credit: "NASA, ESA, and C. Robert O'Dell (Vanderbilt University)" },
    model: { kind: 'barrel', R: 0.75, depth: 0.9, centre: [283.3962, 33.0291], label: 'BARREL, END-ON', ref: "O'Dell et al. 2013 (AJ 145, 92): a barrel-shaped triaxial ellipsoid whose long axis points nearly at us." },
  },
  'Dumbbell Nebula · M27': {
    img: { key: 'm27', ...ESO('eso9846a'), what: 'VLT FORS1', ra: 299.9017, dec: 22.7211, fov: [6.76, 6.82], north: 0, date: '1998-10-07', credit: 'ESO/I. Appenzeller, W. Seifert, O. Stahl, M. Zamani' },
    model: { kind: 'filled', R: 4, depth: 0.5, centre: [299.9015, 22.7212], label: 'BIPOLAR, SIDE-ON', ref: 'Bipolar lobes seen nearly side-on: assumed as deep as they are wide.' },
  },
  "Cat's Eye Nebula": {
    img: { key: 'catseye', ...ESAHUBBLE('heic0414a'), what: 'Hubble ACS', ra: 269.6386, dec: 66.6328, fov: [1.17, 1.17], north: 144.6, date: '2004-09-09', credit: 'ESA, NASA, HEIC and the Hubble Heritage Team (STScI/AURA)' },
    model: { kind: 'shell', R: 0.35, depth: 1, centre: [269.6392, 66.633], label: 'NESTED SHELLS', ref: 'Overlapping elliptical bubbles (Reed et al. 1999); drawn as one shell.' },
  },
  'Owl Nebula · M97': {
    img: { key: 'm97', ...survey('panstarrs', 168.6988, 55.019, 0.12), what: 'Pan-STARRS1 survey cutout' },
    model: { kind: 'shell', R: 1.7, depth: 1, centre: [168.6988, 55.019], label: 'SHELL', ref: 'A shell with a cylindrical cavity (Guerrero et al. 2003); drawn as a round shell.' },
  },
  'Butterfly Nebula': {
    img: { key: 'ngc6302', ...ESAHUBBLE('heic0910h'), what: 'Hubble WFC3', ra: 258.4323, dec: -37.1035, fov: [2.35, 2.74], north: -128.4, date: '2009-09-09', credit: 'NASA, ESA and the Hubble SM4 ERO Team' },
    model: { kind: 'filled', R: 1.2, depth: 0.4, centre: [258.4354, -37.1031], label: 'BIPOLAR, SIDE-ON', ref: 'Two lobes either side of a dusty torus, seen nearly side-on: assumed as deep as they are wide.' },
  },
  'Southern Ring Nebula': {
    img: { key: 'ngc3132', ...ESAWEBB('weic2207b'), what: 'JWST NIRCam', ra: 151.757, dec: -40.4364, fov: [2.42, 2.25], north: -112, date: '2022-07-12', credit: 'NASA, ESA, CSA, STScI, and the Webb ERO Production Team' },
    model: { kind: 'shell', R: 0.75, depth: 1, centre: [151.7574, -40.4364], label: 'ELLIPSOIDAL SHELL', ref: 'An ellipsoidal shell (De Marco et al. 2022); taken as round in depth.' },
  },
  'Crab Nebula · M1': {
    img: { key: 'm1', ...ESAHUBBLE('heic0515a'), what: 'Hubble WFPC2 mosaic', ra: 83.6355, dec: 22.0152, fov: [6.41, 6.41], north: 0, date: '2005-12-01', credit: 'NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)' },
    model: { kind: 'filled', R: 3.3, depth: 0.75, centre: [83.6331, 22.0145], label: 'FILLED ELLIPSOID', ref: 'A prolate ellipsoid of filaments around the pulsar-wind nebula (Martin, Milisavljevic & Drout 2021 3D map).' },
  },
  'Cassiopeia A': {
    img: { key: 'casa', ...ESAWEBB('weic2311a'), what: 'JWST MIRI', ra: 350.8582, dec: 58.8182, fov: [7.41, 7.41], north: 0.5, date: '2023-04-07',
      credit: 'NASA, ESA, CSA, D. Milisavljevic (Purdue University), T. Temim (Princeton University), I. De Looze (UGent), J. DePasquale (STScI)' },
    model: { kind: 'shell', R: 2.6, depth: 1, centre: [350.8584, 58.8113], label: 'EXPANDING SHELL', ref: 'Ejecta in a thick shell with rings (Milisavljevic & Fesen 2013 Doppler map); drawn as a round shell.' },
  },
  'Vela supernova remnant': {
    img: { key: 'vela', ...survey('halpha', 128.5, -45.8, 10), what: 'Hα survey cutout (grey intensity, drawn in Hα red)', tint: [1, 0.3, 0.38], black: 0.3 },
    model: { kind: 'shell', R: 240, depth: 1, label: 'EXPANDING SHELL', ref: 'Taken as a round shell, ~8° across.' },
  },
  'Veil Nebula': {
    img: { key: 'veil', ...survey('dss2', 312.75, 30.67, 3.6), what: 'DSS2 colour survey cutout' },
    model: { kind: 'shell', R: 85, depth: 1, label: 'EXPANDING SHELL', ref: 'The Cygnus Loop: a shell ~3° across; the Veil filaments are its edges seen tangentially.' },
  },
  "Tycho's supernova remnant": {
    img: { key: 'tycho', ...CHANDRA('2011/tycho2', 'tycho2.jpg'), what: 'Chandra ACIS (X-rays)', ra: 6.3208, dec: 64.1436, fov: [10, 10], north: -0.12, date: '2011-04-26', credit: 'NASA/CXC/Chinese Academy of Sciences/F. Lu et al.' },
    model: { kind: 'shell', R: 4, depth: 1, label: 'EXPANDING SHELL', ref: 'A near-spherical blast wave (Type Ia).' },
  },
  "Kepler's supernova remnant": {
    img: { key: 'kepler', ...CHANDRA('2007/kepler', 'kepler.jpg'), what: 'Chandra ACIS (X-rays)', ra: 262.6715, dec: -21.4916, fov: [4.92, 4.92], north: 0, date: '2007-01-09', credit: 'NASA/CXC/NCSU/S. Reynolds et al.' },
    model: { kind: 'shell', R: 1.8, depth: 1, centre: [262.6688, -21.4873], label: 'EXPANDING SHELL', ref: 'A near-spherical blast wave (Type Ia).' },
  },
};

/** Real nebulosity around star clusters (keyed by Hunt & Reffert name). */
export const CLUSTER_NEBULOSITY = {
  'Melotte 22': {
    img: { key: 'pleiades', ...survey('dss2', 56.75, 24.12, 2.2), what: 'DSS2 colour survey cutout', black: 0.16 },
    model: { kind: 'cloud', R: 60, depth: 0.15, label: 'REFLECTING DUST', ref: 'A dust cloud the cluster is passing through, lit by its B stars (Gibson & Nordsieck 2003); a thin sheet in depth.' },
  },
};

// Survey images carry their sky background: subtract more of it.
for (const v of [...Object.values(NEBULA_3D), ...Object.values(CLUSTER_NEBULOSITY)]) v.img.black ??= v.img.survey ? 0.14 : 0.03;

/** Stars inside the nebulae that can be investigated: [name, nebula, RA°, Dec°, note]. Positions from SIMBAD. */
export const NEBULA_STARS = [
  ['θ¹ Orionis C', 'Orion Nebula · M42', 83.81861, -5.38970, 'The brightest Trapezium star (O7 V, ~35 solar masses): its ultraviolet light ionizes the nebula.'],
  ['ξ Persei', 'California Nebula', 59.74126, 35.79103, 'The runaway O7.5 star that ionizes the California Nebula.'],
  ['HD 164492 A', 'Trifid Nebula · M20', 270.59814, -23.03083, 'The O7.5 star at the centre of the Trifid.'],
  ['HD 168076', 'Eagle Nebula · M16', 274.65175, -13.80067, 'The brightest star of NGC 6611 (O3–O5), which carves the Pillars of Creation.'],
  ['η Carinae', 'Carina Nebula', 161.26477, -59.68443, 'A ~100-solar-mass binary that erupted in the 1840s; a supernova candidate.'],
  ['HD 15558', 'Heart Nebula', 38.17724, 61.45599, 'An O5 giant in IC 1805, powering the Heart Nebula.'],
  ['15 Monocerotis (S Mon)', 'Cone Nebula', 100.24442, 9.89576, 'The O7 star at the head of NGC 2264.'],
  ['ρ Ophiuchi A', 'Rho Ophiuchi clouds', 246.39633, -23.44718, 'The B2 star whose light the blue reflection nebula IC 4604 scatters.'],
  ['Helix central star', 'Helix Nebula', 337.41061, -20.83715, 'The white dwarf (~100,000 K) at the heart of the Helix.'],
  ['Ring central star', 'Ring Nebula · M57', 283.39624, 33.02913, 'The hot white-dwarf remnant that lights the Ring.'],
  ['Dumbbell central star', 'Dumbbell Nebula · M27', 299.90151, 22.72120, 'One of the hottest known white dwarfs (~135,000 K).'],
  ["Cat's Eye central star", "Cat's Eye Nebula", 269.63918, 66.63299, 'A Wolf–Rayet-type central star, still shedding a fast wind.'],
  ['Owl central star', 'Owl Nebula · M97', 168.69880, 55.01902, 'The 16th-magnitude central star of the Owl.'],
  ['Butterfly central star', 'Butterfly Nebula', 258.4354, -37.1031, 'Hidden by its dusty torus; found by Hubble in 2009, one of the hottest stars known (~220,000 K).'],
  ['Southern Ring central stars', 'Southern Ring Nebula', 151.75736, -40.43643, 'A bright A-type companion; JWST showed the dusty white dwarf that made the nebula beside it.'],
  ['Crab Pulsar', 'Crab Nebula · M1', 83.63311, 22.01449, 'The neutron star left by SN 1054, spinning 30 times a second.'],
  ['Cas A central compact object', 'Cassiopeia A', 350.86604, 58.81189, 'The neutron star of Cassiopeia A, seen only in X-rays.'],
  ['Vela Pulsar', 'Vela supernova remnant', 128.83606, -45.17643, 'The neutron star of the Vela supernova, spinning 11 times a second.'],
];
