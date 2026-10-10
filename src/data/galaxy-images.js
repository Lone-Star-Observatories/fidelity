// Nearby galaxies with images and orientation (#48 sky, #50 Universe View). Shared by the browser
// and the backend (`server/nebulae.js` serves the cutouts from this allowlist).
//
// Per galaxy: J2000 centre, D25 major axis (arcmin, RC3 / HyperLEDA), position angle of the major
// axis (degrees, north through east), inclination (0 face-on, 90 edge-on), the nearer side where
// it is established, morphology, and where the orientation comes from: `orient: 'measured'` when PA
// and inclination are fitted to the disc's rotation (HI or Hα velocity fields), otherwise
// 'modelled' (isophote shape: an apparent axis ratio read as a thin disc, or an ellipsoid's
// projection, which does not fix the true 3D shape).
//
// Images are survey cutouts rendered by CDS hips2fits on a TAN projection centred on the galaxy,
// north up (so they sit on the sky exactly as observed): DSS2 colour (POSS-II / UK Schmidt plates)
// and, for Maffei 1 and 2 behind the Milky Way's dust, 2MASS near-infrared colour.

const HIPS = {
  dss2: { hips: 'CDS/P/DSS2/color', credit: 'Digitized Sky Survey 2 (POSS-II / UK Schmidt plates; STScI), via CDS hips2fits', licence: 'DSS: non-commercial use with acknowledgement (STScI/AURA)', date: '1985–2000 (plate epochs)' },
  twomass: { hips: 'CDS/P/2MASS/color', credit: '2MASS J/H/Ks colour (UMass / IPAC-Caltech, NASA/NSF), via CDS hips2fits', licence: '2MASS: public, with acknowledgement', date: '1997–2001' },
};
const cutout = (key, survey, ra, dec, fovArcmin) => ({
  key, survey, ra, dec, fov: fovArcmin, north: 0, credit: HIPS[survey].credit, licence: HIPS[survey].licence, date: HIPS[survey].date,
  url: `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${new URLSearchParams({ hips: HIPS[survey].hips, width: '1024', height: '1024', fov: String(fovArcmin / 60), ra: String(ra), dec: String(dec), projection: 'TAN', coordsys: 'icrs', format: 'jpg' })}`,
  page: 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits',
});
const fovFor = (d25) => Math.max(10, Math.min(320, d25 * 1.7));

// [UNGC name, common name, RA°, Dec°, D25′, PA°, inclination°, nearSide, type, orient, orientation source, survey]
const ROWS = [
  ['MESSIER031', 'Andromeda · M31', 10.6847, 41.2690, 190, 38, 77, 'NW', 'spiral', 'measured', 'HI velocity field: PA 38°, i 77° (Corbelli et al. 2010; Chemin et al. 2009); the NW side, crossed by dust lanes, is nearer', 'dss2'],
  ['MESSIER033', 'Triangulum · M33', 23.4621, 30.6599, 70.8, 22, 55, null, 'spiral', 'measured', 'HI kinematics: PA 22°, i ~55° (Corbelli & Salucci 2000; Kam et al. 2017)', 'dss2'],
  ['MESSIER032', 'M32', 10.6743, 40.8652, 8.7, 170, 42, null, 'elliptical', 'modelled', 'Isophotes (RC3 8.7′ × 6.5′, PA 170°): a compact elliptical', 'dss2'],
  ['MESSIER110', 'M110', 10.0921, 41.6853, 21.9, 170, 60, null, 'elliptical', 'modelled', 'Isophotes (RC3 21.9′ × 10.9′, PA 170°): a dwarf elliptical', 'dss2'],
  ['NGC6822', "Barnard's Galaxy", 296.2404, -14.8031, 15.5, 5, 30, null, 'irregular', 'modelled', 'Optical isophotes (bar, PA ~5°); its larger HI disc lies at PA ~110° (de Blok & Walter 2000)', 'dss2'],
  ['IC0010', 'IC 10', 5.0721, 59.3039, 6.8, 129, 30, null, 'irregular', 'modelled', 'Isophotes (RC3 6.8′ × 5.9′); a starburst dwarf behind the Milky Way plane', 'dss2'],
  ['MESSIER081', "Bode's Galaxy · M81", 148.8882, 69.0653, 26.9, 157, 59, null, 'spiral', 'measured', 'THINGS HI velocity field: PA 330° (receding side), i 59.6° (de Blok et al. 2008)', 'dss2'],
  ['MESSIER082', 'Cigar Galaxy · M82', 148.9685, 69.6797, 11.2, 65, 80, null, 'spiral', 'modelled', 'Isophotes (RC3 11.2′ × 4.3′, PA 65°): seen nearly edge-on', 'dss2'],
  ['NGC5128', 'Centaurus A', 201.3651, -43.0191, 25.7, 35, 40, null, 'elliptical', 'modelled', 'Isophotes (RC3 25.7′ × 20.0′, PA 35°); its dust lane is a warped disc from a merger', 'dss2'],
  ['MESSIER083', 'Southern Pinwheel · M83', 204.2538, -29.8658, 12.9, 225, 24, null, 'spiral', 'measured', 'HI kinematics: PA 225°, i 24° (Lundgren et al. 2004)', 'dss2'],
  ['NGC0253', 'Sculptor Galaxy', 11.8881, -25.2884, 27.5, 52, 76, null, 'spiral', 'measured', 'HI kinematics: PA 51°, i 76° (Koribalski et al. 1995; Lucero et al. 2015)', 'dss2'],
  ['MESSIER101', 'Pinwheel · M101', 210.8023, 54.3489, 28.8, 39, 18, null, 'spiral', 'measured', 'THINGS HI velocity field: PA 39°, i 18° (de Blok et al. 2008)', 'dss2'],
  ['MESSIER051a', 'Whirlpool · M51', 202.4696, 47.1952, 11.2, 172, 22, null, 'spiral', 'measured', 'CO / Hα kinematics: PA 172°, i 22° (Colombo et al. 2014)', 'dss2'],
  ['MESSIER104', 'Sombrero · M104', 189.9976, -11.6231, 8.7, 89, 84, null, 'spiral', 'modelled', 'Isophotes (RC3 8.7′ × 3.5′, PA 89°): nearly edge-on, a huge bulge', 'dss2'],
  ['NGC4945', 'NGC 4945', 196.3645, -49.4682, 20.0, 43, 78, null, 'spiral', 'measured', 'HI kinematics: PA 43°, i 78° (Ott et al. 2001)', 'dss2'],
  ['Maffei1', 'Maffei 1', 39.1475, 59.6550, 23.0, 84, 50, null, 'elliptical', 'modelled', 'Near-infrared isophotes (Buta & McCall 2003); hidden by ~5 mag of Milky Way dust', 'twomass'],
  ['Maffei2', 'Maffei 2', 40.4796, 59.6042, 5.8, 26, 67, null, 'spiral', 'modelled', 'Near-infrared isophotes (Hurt et al. 1996)', 'twomass'],
];

const slug = (s) => s.toLowerCase().replace(/^messier0*/, 'm').replace(/a$/, '').replace(/[^a-z0-9]+/g, '');
export const GALAXY_IMAGES = ROWS.map(([ungc, name, ra, dec, d25, pa, incl, near, type, orient, orientSource, survey]) => ({
  ungc, name, ra, dec, d25, pa, incl, near, type, orient, orientSource,
  // apparent axis ratio of an oblate disc of intrinsic thickness 0.2 (Hubble 1926): √(cos²i·(1 − q₀²) + q₀²)
  axisRatio: Math.sqrt(Math.cos((incl * Math.PI) / 180) ** 2 * 0.96 + 0.04),
  img: cutout(`gal-${slug(ungc)}`, survey, ra, dec, fovFor(d25)),
}));
export const galaxyImageByUngc = Object.fromEntries(GALAXY_IMAGES.map((g) => [g.ungc, g]));
