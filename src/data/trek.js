// The Star Trek layer (#25, #41): fictional places from the franchise, drawn over the real sky as an
// IMAGINED overlay. Nothing here is a measurement and nothing here may alter real data: a homeworld
// "at" a real star is a label beside that catalogue star, never a change to it.
//
// Placement, in order of confidence:
//   canon      the place is tied to a real star (or Sol's system) on screen
//   reference  a licensed reference book does it, mostly Star Trek: Star Charts (G. Mandel, Pocket Books 2002)
//   fan        nobody does it precisely: an approximate spot after the layout of Star Charts' maps,
//              flagged APPROXIMATE wherever it is drawn
// Summaries are our own words. Memory Alpha (CC BY-NC) is linked, not copied.
// Star Trek is a trademark of Paramount / CBS Studios; this is a non-commercial fan homage.
//
// Placements:
//   { type: 'star', star, hip, hyg, raDeg, decDeg, distLy }  a real catalogue star (HYG v4.4 id, position and distance),
//                                                            so the label rides on the star the view already loads
//   { type: 'gal', l, b, distLy, radiusLy? }                  heliocentric galactic longitude / latitude (deg) and
//                                                            distance from Sol (ly); radiusLy for a region
//   { type: 'arc', l: [l0, l1], distLy }                     a curved border at a distance from Sol
//   { type: 'path', points: [[l, b, distLy], …] }            a route, Sol-relative
//   { type: 'surface', body, lat, lon }                      a site on a Solar System body (planetocentric, east +)
//   { type: 'orbit', body, altKm, phaseDeg }                 a station circling a Solar System body
//   { type: 'quadrants' }                                    the four quadrants, drawn by each galaxy-scale view

export const TREK_KINDS = {
  homeworld: 'HOMEWORLD', colony: 'WORLD', station: 'STATION', starbase: 'STARBASE', yard: 'FLEET YARD',
  territory: 'TERRITORY', feature: 'FEATURE', route: 'ROUTE', sector: 'SECTOR', quadrant: 'QUADRANTS',
};
export const TREK_CONFIDENCE = {
  canon: { label: 'CANON', hint: 'Stated or shown on screen.' },
  reference: { label: 'REFERENCE BOOK', hint: 'From a licensed reference work (mostly Star Trek: Star Charts, 2002); not stated on screen.' },
  fan: { label: 'FAN ESTIMATE', hint: 'No on-screen or licensed position: an approximate spot after the layout of Star Charts\' maps.' },
};
export const TREK_SERIES = {
  TOS: 'STAR TREK', TNG: 'THE NEXT GENERATION', DS9: 'DEEP SPACE NINE', VOY: 'VOYAGER', ENT: 'ENTERPRISE', FILM: 'FILM',
};
export const STAR_CHARTS = 'Star Trek: Star Charts (Geoffrey Mandel, Pocket Books, 2002)';
const LICENCE = 'Star Trek is a trademark of Paramount / CBS Studios. Fan homage, non-commercial; no franchise artwork or text is used.';
export const TREK_LICENCE = LICENCE;

/** A Memory Alpha search link (always resolves, unlike a guessed article title). */
const ma = (q) => `https://memory-alpha.fandom.com/wiki/Special:Search?query=${encodeURIComponent(q)}`;
const first = (series, episode, year, extra = {}) => ({ series, episode, year, ...extra });

// Real stars: HYG v4.4 rows (id, HIP, RA/Dec J2000, parallax distance), checked against the catalogue the backend loads.
const STARS = {
  sol: { type: 'star', star: 'Sol', hip: null, hyg: 'sol', raDeg: 0, decDeg: 0, distLy: 0 },
  keid: { type: 'star', star: '40 Eridani A (Keid)', names: ['Keid', '40 Eridani A', 'Omicron2 Eridani'], hip: 19849, hyg: 'hyg-19799', raDeg: 63.81806, decDeg: -7.65287, distLy: 16.26 },
  epsInd: { type: 'star', star: 'Epsilon Indi', names: ['Epsilon Indi', 'Eps Ind', 'Epsilon Indi A'], hip: 108870, hyg: 'hyg-108526', raDeg: 330.83229, decDeg: -56.78598, distLy: 11.81 },
  cyg61: { type: 'star', star: '61 Cygni A', names: ['61 Cygni A', '61 Cyg A'], hip: 104214, hyg: 'hyg-103879', raDeg: 316.72191, decDeg: 38.74942, distLy: 11.37 },
  wolf359: { type: 'star', star: 'Wolf 359', names: ['Wolf 359', 'Gliese 406', 'CN Leonis'], hip: null, gl: 'Gl 406', hyg: 'hyg-118720', raDeg: 164.12226, decDeg: 7.01532, distLy: 7.80 },
  aCen: { type: 'star', star: 'Alpha Centauri A (Rigil Kentaurus)', names: ['Rigil Kentaurus', 'Alpha Centauri A'], hip: 71683, hyg: 'hyg-71456', raDeg: 219.91148, decDeg: -60.83398, distLy: 4.32 },
  altair: { type: 'star', star: 'Altair', names: ['Altair'], hip: 97649, hyg: 'hyg-97338', raDeg: 297.69582, decDeg: 8.86832, distLy: 16.73 },
  vega: { type: 'star', star: 'Vega', names: ['Vega'], hip: 91262, hyg: 'hyg-90979', raDeg: 279.2346, decDeg: 38.78369, distLy: 25.04 },
  rigel: { type: 'star', star: 'Rigel', names: ['Rigel'], hip: 24436, hyg: 'hyg-24378', raDeg: 78.63447, decDeg: -8.20164, distLy: 862.8 },
  deneb: { type: 'star', star: 'Deneb', names: ['Deneb'], hip: 102098, hyg: 'hyg-101767', raDeg: 310.35798, decDeg: 45.28034, distLy: 1411.9 },
};
const at = (k, extra = {}) => ({ ...STARS[k], ...extra });

/** Every fictional place, one shape (see the header). `views` says where each is drawn. */
export const TREK = [
  // ---- the four quadrants (drawn by each galaxy-scale view: Navigation, Quadrant, Galaxy) ---------------------
  { id: 'quadrants', name: 'Alpha, Beta, Gamma and Delta Quadrants', kind: 'quadrant', views: ['navigation', 'quadrant', 'galaxy'],
    placement: { type: 'quadrants', through: 'the galactic core', border: 'Alpha | Beta along the core–Sol line' }, confidence: 'reference',
    source: `Canon: the galaxy is split into four quadrants by two perpendicular lines through the galactic core. ${STAR_CHARTS} runs the Alpha/Beta line through Sol, so the Federation straddles it, Alpha on the side of galactic longitude 180–360°, Beta on 0–180°, Gamma and Delta beyond the core.`,
    firstAppearance: first('TNG', 'The Price', 1989, { featured: true, what: 'the Gamma and Delta Quadrants named' }),
    summary: 'Star Trek\'s map of the galaxy: four quarters meeting at the core. Earth sits on the Alpha/Beta line, the Klingons and Romulans in the Beta Quadrant, Cardassia and Bajor in the Alpha; the Dominion lies in the Gamma Quadrant and the Borg in the Delta, tens of thousands of light-years away.',
    alternatives: 'Not the IAU galactic quadrants I–IV, which are measured from the Sun by galactic longitude and are drawn separately (orange). Episodes sometimes speak loosely of Earth being "in the Alpha Quadrant".',
    memoryAlpha: ma('Quadrant') },

  // ---- homeworlds and places at real stars (Navigation View; WARP TO opens the real system) ------------------
  { id: 'vulcan', name: 'Vulcan', kind: 'homeworld', views: ['navigation', 'system'], placement: at('keid'), confidence: 'reference',
    source: `${STAR_CHARTS}; the 40 Eridani A identification was first argued by Gene Roddenberry, Sallie Baliunas, Robert Donahue and George Nichols in a letter to Sky & Telescope (1991)`,
    firstAppearance: first('TOS', 'Amok Time', 1967, { what: 'the planet first seen' }),
    summary: 'The hot, thin-aired desert world of Spock\'s people, who ruled their violent passions with logic. Vulcans made first contact with humanity and were Earth\'s guides, and sometimes its minders, on the way to the Federation.',
    alternatives: 'Older fan-made star maps disagreed (Epsilon Eridani was one suggestion); 40 Eridani A is the star nearly every later reference uses. Real 40 Eridani A is an orange K1 dwarf with a white dwarf and a red dwarf companion; no planet has been confirmed there.',
    memoryAlpha: ma('Vulcan (planet)') },
  { id: 'andoria', name: 'Andoria', kind: 'homeworld', views: ['navigation', 'system'], placement: at('epsInd'), confidence: 'reference',
    source: `${STAR_CHARTS}: Andoria in the Epsilon Indi system. No star is named on screen.`,
    firstAppearance: first('TOS', 'Journey to Babel', 1967, { what: 'Andorians first seen' }),
    summary: 'Home of the blue-skinned, antennaed Andorians, one of the Federation\'s founding peoples. Enterprise made it an icy moon of a gas giant, with cities under the ice.',
    alternatives: 'Other unofficial maps have put Andor elsewhere; Star Charts is the licensed placement used here. Real Epsilon Indi has a giant planet (Epsilon Indi Ab, imaged by JWST in 2024) and a pair of brown dwarfs.',
    memoryAlpha: ma('Andoria') },
  { id: 'tellar', name: 'Tellar Prime', kind: 'homeworld', views: ['navigation', 'system'], placement: at('cyg61'), confidence: 'reference',
    source: `${STAR_CHARTS}: Tellar in the 61 Cygni system. No star is named on screen.`,
    firstAppearance: first('TOS', 'Journey to Babel', 1967, { what: 'Tellarites first seen' }),
    summary: 'Homeworld of the argumentative Tellarites, for whom a good quarrel is a courtesy; another founding world of the Federation.',
    alternatives: 'Only Star Charts ties Tellar to a real star. 61 Cygni was the first star to have its distance measured (Bessel, 1838).',
    memoryAlpha: ma('Tellar Prime') },
  { id: 'wolf-359', name: 'Battle of Wolf 359', kind: 'feature', views: ['navigation', 'system'], placement: at('wolf359'), confidence: 'canon',
    source: 'Named on screen: the Federation fleet met a Borg cube at Wolf 359, a real red dwarf 7.8 ly from Sol.',
    firstAppearance: first('TNG', 'The Best of Both Worlds, Part II', 1990),
    summary: 'Where Starfleet tried to stop a single Borg cube heading for Earth and lost dozens of ships in one engagement. Deep Space Nine later opened with Benjamin Sisko\'s memory of it.',
    alternatives: 'The star is canon; it is a dim M6 flare star with no confirmed planets.',
    memoryAlpha: ma('Battle of Wolf 359') },
  { id: 'alpha-centauri', name: 'Alpha Centauri · Cochrane', kind: 'colony', views: ['navigation', 'system'], placement: at('aCen'), confidence: 'canon',
    source: 'On screen, Zefram Cochrane, inventor of the warp drive, is introduced as "of Alpha Centauri".',
    firstAppearance: first('TOS', 'Metamorphosis', 1967),
    summary: 'The nearest star system, settled by humans in Star Trek\'s future and linked with Zefram Cochrane, whose warp flight led to first contact with the Vulcans.',
    alternatives: 'Star Trek: First Contact (1996) shows Cochrane building his warp ship on Earth, in Montana; the usual reconciliation is that he later lived at Alpha Centauri. Which star of the triple system is meant is never said; the label sits on Alpha Centauri A.',
    memoryAlpha: ma('Alpha Centauri') },
  { id: 'altair-vi', name: 'Altair VI', kind: 'colony', views: ['navigation', 'system'], placement: at('altair'), confidence: 'canon',
    source: 'Named on screen: the Enterprise is ordered to Altair VI for a presidential inauguration.',
    firstAppearance: first('TOS', 'Amok Time', 1967),
    summary: 'A Federation world at Altair, the errand Kirk sets aside to get Spock home to Vulcan.',
    alternatives: 'The star is canon. Real Altair is a fast-spinning A-type star, squashed by its rotation; no planets are known.',
    memoryAlpha: ma('Altair VI') },
  { id: 'vega-colony', name: 'Vega colony', kind: 'colony', views: ['navigation', 'system'], placement: at('vega'), confidence: 'canon',
    source: 'Named on screen as the destination for the Enterprise\'s injured crew in the original pilot.',
    firstAppearance: first('TOS', 'The Menagerie', 1966, { what: 'aired using footage of the unaired pilot "The Cage"' }),
    summary: 'A human colony at Vega, mentioned in Captain Pike\'s day as the place to take the wounded.',
    alternatives: 'The star is canon. Real Vega is a young A0 star with a debris disc; it sits 25.04 ly away, just outside the 25 ly sensor range.',
    memoryAlpha: ma('Vega colony') },
  { id: 'sector-001', name: 'Sector 001', kind: 'sector', views: ['navigation'], placement: at('sol'), confidence: 'canon',
    source: 'Named on screen as Earth\'s sector designation. Other sector numbers are not tied to real stars, so no grid is drawn.',
    firstAppearance: first('TNG', 'The Best of Both Worlds', 1990),
    summary: 'Starfleet\'s name for the Sol system and its neighbourhood: the first entry in the Federation\'s sector numbering. The ship\'s beacon in this app is named after it.',
    alternatives: 'How big a sector is, and how the numbers run, varies between sources, so no sector grid is drawn.',
    memoryAlpha: ma('Sector 001') },
  // far real stars: the Quadrant View
  { id: 'rigel', name: 'Rigel worlds', kind: 'colony', views: ['quadrant'], placement: at('rigel'), confidence: 'canon',
    source: 'Named on screen many times (Rigel II, IV, VII, XII …).',
    firstAppearance: first('TOS', 'The Menagerie', 1966, { what: 'Rigel VII, in footage from the unaired pilot "The Cage"' }),
    summary: 'A busy system in Star Trek: a fortress world where Pike fought, pleasure planets, mining colonies and a trade hub.',
    alternatives: 'Real Rigel is a blue supergiant only about 8 million years old, far too young for inhabited planets; some reference works therefore spread the Rigel worlds over several stars. The label sits on the catalogue star (HYG parallax distance; other estimates run 800–900 ly).',
    memoryAlpha: ma('Rigel') },
  { id: 'deneb-iv', name: 'Deneb IV · Farpoint', kind: 'station', views: ['quadrant'], placement: at('deneb'), confidence: 'canon',
    source: 'Named on screen: Farpoint Station on Deneb IV.',
    firstAppearance: first('TNG', 'Encounter at Farpoint', 1987),
    summary: 'Farpoint Station, built by the Bandi with help they did not admit to, where Picard\'s Enterprise first meets Q.',
    alternatives: 'Real Deneb is a white supergiant whose distance is poorly known (about 1,400 ly from the HYG parallax, 2,600 ly from other methods). A place that far would sit well beyond most of the Federation as Star Charts draws it.',
    memoryAlpha: ma('Deneb IV') },

  // ---- approximate places (Quadrant View) ---------------------------------------------------------------------
  { id: 'qonos', name: "Qo'noS", kind: 'homeworld', views: ['quadrant'], placement: { type: 'gal', l: 62, b: 4, distLy: 110 }, confidence: 'fan',
    source: `Beta Quadrant, beyond Federation space, as in the maps of ${STAR_CHARTS}; the distance is a fan estimate.`,
    firstAppearance: first('TNG', 'Sins of the Father', 1990, { what: 'the Klingon homeworld first seen' }),
    summary: 'Capital of the Klingon Empire: a stormy world of warrior houses ruled from the Great Hall in the First City.',
    alternatives: 'Distances inferred from on-screen travel times range widely, from tens to over a hundred light-years from Earth.',
    memoryAlpha: ma("Qo'noS") },
  { id: 'romulus', name: 'Romulus & Remus', kind: 'homeworld', views: ['quadrant'], placement: { type: 'gal', l: 18, b: -3, distLy: 175 }, confidence: 'fan',
    source: `Beta Quadrant, behind the Neutral Zone, as in the maps of ${STAR_CHARTS}; the distance is a fan estimate.`,
    firstAppearance: first('TOS', 'Balance of Terror', 1966, { what: 'the twin worlds first named' }),
    summary: 'The twin worlds of the Romulan Star Empire: Romulus the capital, Remus a tidally locked mining world whose people were treated as slaves.',
    alternatives: 'No on-screen distance. Star Trek (2009) and Picard destroy Romulus in a supernova (2387), so the label marks where it was.',
    memoryAlpha: ma('Romulus') },
  { id: 'romulan-neutral-zone', name: 'Romulan Neutral Zone', kind: 'feature', views: ['quadrant'], placement: { type: 'arc', l: [-12, 48], distLy: 130 }, confidence: 'fan',
    source: `Canon border between Federation and Romulan space; its position is drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TOS', 'Balance of Terror', 1966),
    summary: 'A strip of space neither side may enter, set up by treaty after the Earth–Romulan War. Crossing it is an act of war; outposts on the Federation side watch it.',
    alternatives: 'Its width and length are never given on screen.',
    memoryAlpha: ma('Romulan Neutral Zone') },
  { id: 'bajor', name: 'Bajor', kind: 'homeworld', views: ['quadrant'], placement: { type: 'gal', l: 300, b: 2, distLy: 52 }, confidence: 'fan',
    source: `Alpha Quadrant, near the Cardassian border, as in the maps of ${STAR_CHARTS}; the distance is a fan estimate. Its star is called B'hava'el in reference works.`,
    firstAppearance: first('TNG', 'Ensign Ro', 1991, { what: 'Bajorans first seen' }),
    summary: 'A deeply spiritual world, occupied by Cardassia for decades; after the occupation it hosts Deep Space 9 and the mouth of the wormhole its people call the Celestial Temple.',
    alternatives: 'No on-screen distance from Earth.',
    memoryAlpha: ma('Bajor') },
  { id: 'deep-space-9', name: 'Deep Space 9', kind: 'station', views: ['quadrant'], placement: { type: 'gal', l: 300.6, b: 2, distLy: 52.2 }, confidence: 'fan',
    source: 'In the Bajoran system beside the wormhole (canon); placed with Bajor (approximate).',
    firstAppearance: first('DS9', 'Emissary', 1993),
    summary: 'A Cardassian-built ore-processing station, taken over by Starfleet and Bajor and towed to the wormhole, where it becomes a crossroads of trade, faith and war.',
    alternatives: 'Its original name was Terok Nor.',
    memoryAlpha: ma('Deep Space 9') },
  { id: 'bajoran-wormhole', name: 'Bajoran wormhole', kind: 'feature', views: ['quadrant', 'galaxy'],
    placement: { type: 'path', points: [[300.6, 2, 52.2], [319.4, 0, 70000]] }, confidence: 'fan',
    source: 'Canon: a stable wormhole from the Bajoran system to the Idran system in the Gamma Quadrant, commonly given as about 70,000 ly. The Gamma end is drawn at that distance on the Gamma side (approximate).',
    firstAppearance: first('DS9', 'Emissary', 1993),
    summary: 'The only known stable wormhole, built and inhabited by beings outside linear time whom the Bajorans worship as the Prophets. It opened the Gamma Quadrant to trade, and to the Dominion.',
    alternatives: 'The Gamma end\'s exact position is never shown; the line is a reminder of the shortcut, not a route.',
    memoryAlpha: ma('Bajoran wormhole') },
  { id: 'cardassia', name: 'Cardassia Prime', kind: 'homeworld', views: ['quadrant'], placement: { type: 'gal', l: 308, b: -2, distLy: 68 }, confidence: 'fan',
    source: `Alpha Quadrant, beyond Bajor, as in the maps of ${STAR_CHARTS}; the distance is a fan estimate.`,
    firstAppearance: first('DS9', 'Tribunal', 1994, { what: 'the planet first seen (Cardassians first appear in TNG "The Wounded", 1991)' }),
    summary: 'Capital of the Cardassian Union: a resource-poor world whose military state took what it needed from its neighbours.',
    alternatives: 'No on-screen distance from Earth.',
    memoryAlpha: ma('Cardassia Prime') },
  { id: 'ferenginar', name: 'Ferenginar', kind: 'homeworld', views: ['quadrant'], placement: { type: 'gal', l: 335, b: 3, distLy: 140 }, confidence: 'fan',
    source: `Alpha Quadrant, as in the maps of ${STAR_CHARTS}; the distance is a fan estimate.`,
    firstAppearance: first('DS9', 'Family Business', 1995, { what: 'the planet first seen (the Ferengi first appear in TNG "The Last Outpost", 1987)' }),
    summary: 'The rain-soaked capital of the Ferengi Alliance, where profit is the highest virtue and the Rules of Acquisition are scripture.',
    alternatives: 'No on-screen distance from Earth.',
    memoryAlpha: ma('Ferenginar') },
  { id: 'badlands', name: 'The Badlands', kind: 'feature', views: ['quadrant'], placement: { type: 'gal', l: 293, b: 0, distLy: 60, radiusLy: 6 }, confidence: 'fan',
    source: 'Canon: a region of plasma storms near the Cardassian border; the position is a fan estimate.',
    firstAppearance: first('VOY', 'Caretaker', 1995, { featured: true }),
    summary: 'A maze of plasma storms where Maquis raiders hid from Cardassian and Starfleet patrols, and where Voyager was snatched away to the Delta Quadrant.',
    alternatives: 'Its size and exact position are never given.',
    memoryAlpha: ma('Badlands') },
  { id: 'briar-patch', name: 'The Briar Patch', kind: 'feature', views: ['quadrant'], placement: { type: 'gal', l: 75, b: 6, distLy: 260, radiusLy: 12 }, confidence: 'fan',
    source: 'Canon: a hazardous nebula region on the edge of Federation space; no position is given, so this spot is a rough fan estimate.',
    firstAppearance: first('FILM', 'Star Trek: Insurrection', 1998),
    summary: 'A tangle of nebulae and strange radiation that hides the Ba\'ku planet, whose rings keep its people young, and the scheme to take it.',
    alternatives: 'Sources differ even on which quadrant it lies in; treat this marker as decorative.',
    memoryAlpha: ma('Briar Patch') },
  { id: 'mutara-nebula', name: 'Mutara Nebula', kind: 'feature', views: ['quadrant'], placement: { type: 'gal', l: 210, b: -5, distLy: 70, radiusLy: 4 }, confidence: 'fan',
    source: 'Canon: a nebula in Federation space near the Regula I laboratory; the position is a fan estimate.',
    firstAppearance: first('FILM', 'Star Trek II: The Wrath of Khan', 1982),
    summary: 'The ion-charged nebula where Kirk and Khan fought half-blind, and where the Genesis Device made a new world.',
    alternatives: 'Its position is never given.',
    memoryAlpha: ma('Mutara Nebula') },
  { id: 'delphic-expanse', name: 'Delphic Expanse', kind: 'feature', views: ['quadrant'], placement: { type: 'gal', l: 25, b: 10, distLy: 80, radiusLy: 25 }, confidence: 'fan',
    source: 'Canon: a region surrounded by thick clouds and gravitational anomalies, home of the Xindi; the position is a fan estimate.',
    firstAppearance: first('ENT', 'The Expanse', 2003),
    summary: 'A region wrapped in thermobaric clouds and riddled with anomalies made by the Sphere Builders, where Archer\'s Enterprise hunted the Xindi weapon that had attacked Earth.',
    alternatives: 'Its position and size are never given; reference works disagree.',
    memoryAlpha: ma('Delphic Expanse') },
  { id: 'starbase-375', name: 'Starbase 375', kind: 'starbase', views: ['quadrant'], placement: { type: 'gal', l: 296, b: 3, distLy: 44 }, confidence: 'fan',
    source: 'Canon: a Federation starbase in the Dominion War; the position is a fan estimate near Bajor.',
    firstAppearance: first('DS9', 'Behind the Lines', 1997, { featured: true }),
    summary: 'A Starfleet base on the front line of the Dominion War, where Sisko served as Admiral Ross\'s adjutant after the station fell.',
    alternatives: 'Its position is never given.',
    memoryAlpha: ma('Starbase 375') },

  // ---- territories (soft regions; extents are fan estimates after Star Charts' maps) -----------------------------
  { id: 'ufp', name: 'United Federation of Planets', kind: 'territory', views: ['quadrant'], placement: { type: 'gal', l: 0, b: 0, distLy: 0, radiusLy: 95 }, confidence: 'fan',
    source: `Straddles the Alpha and Beta Quadrants around Sol (canon); extent drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TOS', null, 1966, { featured: true, what: 'the original series' }),
    summary: 'The interstellar union founded by Earth, Vulcan, Andoria and Tellar, with its capital in Paris and Starfleet headquartered in San Francisco.',
    alternatives: 'On-screen statements of its size are rare and inconsistent; the disc only marks where it is.',
    memoryAlpha: ma('United Federation of Planets') },
  { id: 'klingon-empire', name: 'Klingon Empire', kind: 'territory', views: ['quadrant'], placement: { type: 'gal', l: 65, b: 0, distLy: 150, radiusLy: 70 }, confidence: 'fan',
    source: `Beta Quadrant (canon); extent drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TOS', 'Errand of Mercy', 1967, { what: 'Klingons first seen' }),
    summary: 'A feudal warrior empire, first the Federation\'s rival, then its uneasy ally.',
    alternatives: 'Its borders shift between series and reference works.',
    memoryAlpha: ma('Klingon Empire') },
  { id: 'romulan-star-empire', name: 'Romulan Star Empire', kind: 'territory', views: ['quadrant'], placement: { type: 'gal', l: 18, b: 0, distLy: 200, radiusLy: 65 }, confidence: 'fan',
    source: `Beta Quadrant (canon); extent drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TOS', 'Balance of Terror', 1966),
    summary: 'A secretive, militarised empire of the Vulcans\' distant cousins, kept apart from the Federation by the Neutral Zone.',
    alternatives: 'Its extent is not given on screen.',
    memoryAlpha: ma('Romulan Star Empire') },
  { id: 'cardassian-union', name: 'Cardassian Union', kind: 'territory', views: ['quadrant'], placement: { type: 'gal', l: 312, b: 0, distLy: 85, radiusLy: 35 }, confidence: 'fan',
    source: `Alpha Quadrant (canon); extent drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TNG', 'The Wounded', 1991, { what: 'Cardassians first seen' }),
    summary: 'A military state that occupied Bajor and fought the Federation over its border, later joining the Dominion.',
    alternatives: 'Its extent is not given on screen.',
    memoryAlpha: ma('Cardassian Union') },
  { id: 'ferengi-alliance', name: 'Ferengi Alliance', kind: 'territory', views: ['quadrant'], placement: { type: 'gal', l: 336, b: 0, distLy: 145, radiusLy: 25 }, confidence: 'fan',
    source: `Alpha Quadrant (canon); extent drawn after ${STAR_CHARTS} (approximate).`,
    firstAppearance: first('TNG', 'The Last Outpost', 1987, { what: 'the Ferengi first seen' }),
    summary: 'A trading power run like a business, more interested in deals than conquest.',
    alternatives: 'Its extent is not given on screen.',
    memoryAlpha: ma('Ferengi Alliance') },

  // ---- galaxy scale (Galaxy View) -----------------------------------------------------------------------------
  { id: 'dominion', name: 'The Dominion', kind: 'territory', views: ['galaxy'], placement: { type: 'gal', l: 322, b: 0, distLy: 66000, radiusLy: 6000 }, confidence: 'fan',
    source: 'Gamma Quadrant, around the far end of the Bajoran wormhole (canon); extent a fan estimate.',
    firstAppearance: first('DS9', 'Rules of Acquisition', 1993, { what: 'first mentioned' }),
    summary: 'A Gamma Quadrant empire ruled by the shape-shifting Founders through the Vorta and the Jem\'Hadar, which came through the wormhole and went to war with the Alpha Quadrant powers.',
    alternatives: 'Its size is never given; said to be thousands of years old and very large.',
    memoryAlpha: ma('Dominion') },
  { id: 'borg', name: 'Borg space', kind: 'territory', views: ['galaxy'], placement: { type: 'gal', l: 37, b: 0, distLy: 52000, radiusLy: 10000 }, confidence: 'fan',
    source: 'Delta Quadrant (canon); extent a fan estimate. The Enterprise-D first met them after Q flung it about 7,000 ly.',
    firstAppearance: first('TNG', 'Q Who', 1989),
    summary: 'The Collective: cybernetic drones sharing one mind, absorbing whole peoples and their technology. Voyager crossed the edge of their space on its way home.',
    alternatives: 'Their space is described as vast; no map is shown on screen.',
    memoryAlpha: ma('Borg') },
  { id: 'voyager-route', name: "Voyager's route home", kind: 'route', views: ['galaxy'],
    placement: { type: 'path', points: [[40.6, 0, 70000], [37, 0, 62000], [33.5, 0, 50000], [31, 0, 38000], [29, 0, 24000], [25, 0, 9000], [0, 0, 0]] }, confidence: 'fan',
    source: 'Canon: stranded about 70,000 ly from Earth in the Delta Quadrant ("Caretaker"), home seven years later ("Endgame", 2001). The route\'s shape is a fan sketch.',
    firstAppearance: first('VOY', 'Caretaker', 1995),
    summary: 'USS Voyager\'s seven-year trip back from the Delta Quadrant, cut short by a telepathic boost, a slipstream test, a stolen Borg transwarp conduit and finally a Borg transwarp hub that dropped it next to Earth.',
    alternatives: 'The shortcuts are named on screen but not mapped, so the dashes show the general direction only.',
    memoryAlpha: ma('USS Voyager') },
  { id: 'great-barrier', name: 'The Great Barrier', kind: 'feature', views: ['galaxy'], placement: { type: 'gal', l: 0, b: 0, distLy: 26670, radiusLy: 1500 }, confidence: 'canon',
    source: 'Canon: an energy barrier around the centre of the galaxy, with the planet Sha Ka Ree inside. Its size is a fan estimate.',
    firstAppearance: first('FILM', 'Star Trek V: The Final Frontier', 1989),
    summary: 'A barrier of energy said to wall off the galactic core, crossed by the Enterprise in search of a paradise that turned out to be a prison.',
    alternatives: 'The film reaches the centre in hours, while the real core is about 26,700 ly from Sol; the real centre holds Sgr A*, a black hole of four million suns (MEASURED, labelled separately).',
    memoryAlpha: ma('Great Barrier') },
  { id: 'galactic-barrier', name: 'The galactic barrier', kind: 'feature', views: ['galaxy'], placement: { type: 'gal', l: 0, b: 0, distLy: 26670, radiusLy: 52000 }, confidence: 'canon',
    source: 'Canon: an energy field at the rim of the galaxy. Its radius here is a fan estimate at the edge of the modelled disc.',
    firstAppearance: first('TOS', 'Where No Man Has Gone Before', 1966),
    summary: 'A shimmering barrier at the galaxy\'s edge that grants godlike powers to some who cross it, at a terrible price.',
    alternatives: 'Not to be confused with the Great Barrier at the centre (Star Trek V).',
    memoryAlpha: ma('Galactic barrier') },

  // ---- Sol system (System View): stations in orbit and sites on the ground --------------------------------------
  { id: 'utopia-planitia-yards', name: 'Utopia Planitia Fleet Yards', kind: 'yard', views: ['system'], placement: { type: 'orbit', body: 'mars', altKm: 17032, phaseDeg: 30 }, confidence: 'canon',
    source: 'Canon: Starfleet\'s main shipyards at Mars, named on the Enterprise-D dedication plaque and shown in orbit. Drawn at areostationary height (fan estimate).',
    firstAppearance: first('VOY', 'Relativity', 1999, { featured: true, what: 'the orbital yards shown' }),
    summary: 'Where the Galaxy-class Enterprise, Voyager and many other ships were built, with drydocks in orbit and works on the ground.',
    alternatives: 'Shown both as orbital frames and as a surface complex; both are drawn (see the Mars ground site).',
    memoryAlpha: ma('Utopia Planitia Fleet Yards') },
  { id: 'utopia-planitia-ground', name: 'Utopia Planitia (Mars colony & yards)', kind: 'colony', views: ['system'], placement: { type: 'surface', body: 'mars', lat: 46.7, lon: 117.5 }, confidence: 'canon', approx: true,
    source: 'Canon: the yards and settlements take their name from Utopia Planitia, a real plain on Mars. Drawn at the centre of the IAU feature (USGS Gazetteer).',
    firstAppearance: first('TNG', 'Booby Trap', 1989, { featured: true, what: 'the yards named' }),
    summary: 'In Star Trek\'s future, Mars is settled and Utopia Planitia hosts shipyards and colonies. The real plain is where Viking 2 (1976) and China\'s Zhurong rover (2021) landed.',
    alternatives: 'Exactly where on the 3,300 km plain the yards stand is never said.',
    memoryAlpha: ma('Utopia Planitia') },
  { id: 'sf-fleet-yards', name: 'San Francisco Fleet Yards', kind: 'yard', views: ['system'], placement: { type: 'orbit', body: 'earth', altKm: 500, phaseDeg: 200 }, confidence: 'canon',
    source: 'Canon: orbital construction yards above San Francisco. Height a fan estimate.',
    firstAppearance: null, appearanceNote: 'Named in dialogue and on ship dedication plaques; the earliest mention is not checked here.',
    summary: 'Starfleet\'s shipyards in Earth orbit, near its headquarters.',
    alternatives: 'Their orbit is never given.',
    memoryAlpha: ma('San Francisco Fleet Yards') },
  { id: 'earth-spacedock', name: 'Earth Spacedock', kind: 'starbase', views: ['system'], placement: { type: 'orbit', body: 'earth', altKm: 1500, phaseDeg: 80 }, confidence: 'canon',
    source: 'Canon: a huge mushroom-shaped station in Earth orbit. Height a fan estimate.',
    firstAppearance: first('FILM', 'Star Trek III: The Search for Spock', 1984),
    summary: 'The giant orbital dock where starships are serviced inside its hangar bays; Kirk steals the Enterprise out of it.',
    alternatives: 'Often equated with Starbase 1 in reference works; the films do not make the link clearly.',
    memoryAlpha: ma('Earth Spacedock') },
  { id: 'mckinley-station', name: 'Earth Station McKinley', kind: 'station', views: ['system'], placement: { type: 'orbit', body: 'earth', altKm: 3000, phaseDeg: 320 }, confidence: 'canon',
    source: 'Canon: an orbital repair station above Earth. Height a fan estimate.',
    firstAppearance: first('TNG', 'Family', 1990),
    summary: 'The open-frame orbital yard where the Enterprise-D was repaired after the Borg attack.',
    alternatives: 'Its orbit is never given.',
    memoryAlpha: ma('Earth Station McKinley') },
  { id: 'jupiter-station', name: 'Jupiter Station', kind: 'station', views: ['system'], placement: { type: 'orbit', body: 'jupiter', altKm: 2500000, phaseDeg: 140 }, confidence: 'canon',
    source: 'Canon: a research station at Jupiter. Drawn outside Callisto\'s orbit (fan estimate).',
    firstAppearance: first('VOY', 'Life Line', 2000, { featured: true }),
    summary: 'Home of Dr Lewis Zimmerman\'s holography lab, where Voyager\'s Emergency Medical Hologram was designed.',
    alternatives: 'Whether it orbits Jupiter or one of its moons is not made clear.',
    memoryAlpha: ma('Jupiter Station') },
  { id: 'starfleet-hq', name: 'Starfleet Headquarters & Academy', kind: 'station', views: ['system'], placement: { type: 'surface', body: 'earth', lat: 37.80, lon: -122.47 }, confidence: 'canon', approx: true,
    source: 'Canon: San Francisco, by the Golden Gate. The exact point (the Presidio) is a fan estimate.',
    firstAppearance: first('FILM', 'Star Trek: The Motion Picture', 1979, { featured: true, what: 'headquarters shown' }),
    summary: 'Starfleet Command and the Academy where its officers train, on the shores of San Francisco Bay.',
    alternatives: 'Depictions put headquarters on either side of the Golden Gate (the Presidio or Fort Baker).',
    memoryAlpha: ma('Starfleet Headquarters') },
  { id: 'tycho-city', name: 'Tycho City', kind: 'colony', views: ['system'], placement: { type: 'surface', body: 'moon', lat: -43.3, lon: -11.2 }, confidence: 'canon', approx: true,
    source: 'Canon: a city on the Moon named after Tycho crater; drawn at the real crater\'s centre (USGS Gazetteer).',
    firstAppearance: null, appearanceNote: 'Named in dialogue; the earliest mention is not checked here.',
    summary: 'One of humanity\'s lunar cities in Star Trek\'s future. The real Tycho is a bright 85 km crater whose rays cross the near side; Surveyor 7 landed on its ejecta in 1968.',
    alternatives: 'Only its name ties it to the crater.',
    memoryAlpha: ma('Tycho City') },
  { id: 'new-berlin', name: 'New Berlin', kind: 'colony', views: ['system'], placement: { type: 'surface', body: 'moon', lat: 28, lon: -15 }, confidence: 'fan',
    source: 'Canon: a lunar city. No location is given; drawn in Mare Imbrium as a fan estimate.',
    firstAppearance: null, appearanceNote: 'Named in dialogue; the earliest mention is not checked here.',
    summary: 'Another of the Moon\'s cities in Star Trek\'s future.',
    alternatives: 'Its location on the Moon is unknown; the marker is decorative.',
    memoryAlpha: ma('New Berlin') },
];

export const TREK_BY_ID = new Map(TREK.map((t) => [t.id, t]));
/** Entries drawn in a view ('navigation' | 'quadrant' | 'galaxy' | 'system'). */
export const trekFor = (view) => TREK.filter((t) => t.views.includes(view));
/** Entries tied to a real catalogue star (by HYG id), e.g. for WARP TO and the System View ring. */
export const trekAtStar = (starId) => TREK.filter((t) => t.placement.type === 'star' && t.placement.hyg === starId && starId !== 'sol');
/**
 * Entries attached to a catalogue star: by HYG id, or else by name (another catalogue build may number
 * stars differently). Never Sol, whose own label already says SECTOR 001.
 */
export function trekStarMatch(star) {
  const name = star.name?.toLowerCase();
  return TREK.filter((t) => t.placement.type === 'star' && t.placement.hyg !== 'sol' && star.id !== 'sol'
    && (t.placement.hyg === star.id || (!!name && (t.placement.names ?? []).some((n) => n.toLowerCase() === name))));
}

/** Heliocentric galactic [x, y, z] (ly) of a gal placement. */
export function trekGal({ l, b, distLy }) {
  const D = Math.PI / 180;
  return [distLy * Math.cos(b * D) * Math.cos(l * D), distLy * Math.cos(b * D) * Math.sin(l * D), distLy * Math.sin(b * D)];
}

/**
 * Habitable-zone distance (AU) where an imagined planet is drawn around a real star: √(L / L☉), the
 * distance at which it receives Earth's sunlight. An assumption, not a placement from any source.
 */
export const trekOrbitAU = (lum) => (lum > 0 ? Math.sqrt(lum) : 1);

/** One-line description of where an entry is, for cards and lists. */
export function trekWhere(t) {
  const p = t.placement;
  if (p.type === 'quadrants') return 'TWO LINES THROUGH THE GALACTIC CORE · ALPHA | BETA THROUGH SOL';
  if (p.type === 'star') return p.hyg === 'sol' ? 'SOL' : `${p.star.toUpperCase()}${p.hip ? ` · HIP ${p.hip}` : p.gl ? ` · ${p.gl.toUpperCase()}` : ''}`;
  if (p.type === 'surface') return `${p.body.toUpperCase()} SURFACE · ${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? 'N' : 'S'} ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? 'E' : 'W'}`;
  if (p.type === 'orbit') return `${p.body.toUpperCase()} ORBIT · ${p.altKm.toLocaleString('en-US')} KM UP`;
  if (p.type === 'arc') return `l ${((p.l[0] + 360) % 360).toFixed(0)}–${p.l[1].toFixed(0)}° · ~${p.distLy.toLocaleString('en-US')} LY FROM SOL`;
  if (p.type === 'path') return `${p.points.length} WAYPOINTS · TO ~${Math.max(...p.points.map((x) => x[2])).toLocaleString('en-US')} LY FROM SOL`;
  return `l ${p.l.toFixed(0)}° b ${p.b.toFixed(0)}° · ~${p.distLy.toLocaleString('en-US')} LY FROM SOL${p.radiusLy ? ` · RADIUS ~${p.radiusLy.toLocaleString('en-US')} LY` : ''}`;
}
/** Is the drawn position approximate? Everything not pinned to a real star or a real surface feature. */
export const trekApprox = (t) => !!t.approx || t.confidence === 'fan' || !['star', 'surface'].includes(t.placement.type);
