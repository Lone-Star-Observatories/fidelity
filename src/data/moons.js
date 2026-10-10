// Sol's major moons and notable small bodies.
//
// Moon orbits: JPL SSD mean elements (epoch 2000-01-01.5 TDB unless noted), referred to each
// moon's Laplace plane (pole RA/Dec given), or the planet's equator for Uranus' and Pluto's
// moons. Columns: a (km), e, ω, M, i, Ω (deg), P (days), apsidal and nodal precession
// periods (years). Physical data: NASA planetary satellite fact sheets and JPL SSD
// (https://ssd.jpl.nasa.gov/sats/phys_par/). Small bodies: JPL Small-Body Database
// osculating elements (epoch JD 2461200.5 = 2026-06-08, J2000 ecliptic) and SBDB physical
// parameters; dwarf planet sizes and masses from occultations and their moons' orbits.

// JPL's equatorial frames use the pole on the side the planet spins (Uranus: opposite to IAU north).
import { MOON_FIT } from './moon-fit.js';

const URANUS_POLE = [77.311, 15.175];
const PLUTO_POLE = [132.993, -6.163];
const NASA3D = 'NASA 3D Resources';

const el = (a, e, w, M, i, node, P, Papsis, Pnode, pole, frame = 'laplace', epochJd = 2451545.0) =>
  ({ a, e, w, M, i, node, P, Papsis, Pnode, pole, frame, epochJd });

// id, name, parent, radius km, mass kg, elements, native skin map or pending surface, discovery, extra
export const MOONS = [
  { id: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1737.4, massKg: 7.346e22, meanTempC: -20,
    elements: el(384400, 0.0554, 318.15, 135.27, 5.16, 125.08, 27.322, 5.997, 18.6, null, 'ecliptic'),
    skin: { map: 'moon' }, discovered: 'Prehistoric', note: 'The only world beyond Earth where people have walked (Apollo, 1969–72).' },
  { id: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11.08, massKg: 1.0659e16,
    elements: el(9375, 0.015, 216.3, 189.7, 1.1, 169.2, 0.3187, 1.1, 2.3, [317.7, 52.9]),
    skin: { map: 'phobos' }, discovered: '1877 · Asaph Hall', note: 'Spiralling inward: it will break up into a ring in about 30–50 million years.' },
  { id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, massKg: 1.4762e15,
    elements: el(23457, 0.0, 0.0, 205.0, 1.8, 54.3, 1.2625, 0, 56.2, [316.6, 53.5]),
    skin: { map: 'deimos' }, discovered: '1877 · Asaph Hall' },
  { id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821.6, massKg: 8.9319e22, meanTempC: -143,
    elements: el(421800, 0.004, 49.1, 330.9, 0.0, 0.0, 1.762732, 1.333, 0, [268.1, 64.5]),
    skin: { map: 'io' }, discovered: '1610 · Galileo Galilei', note: 'The most volcanic body known: tidal heating from Jupiter drives over 400 active volcanoes.' },
  { id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1560.8, massKg: 4.7998e22, meanTempC: -160,
    elements: el(671100, 0.009, 45.0, 345.4, 0.5, 184.0, 3.525463, 1.394, 30.202, [268.1, 64.5]),
    skin: { map: 'europa' }, discovered: '1610 · Galileo Galilei', note: 'A salty ocean lies under its ice shell; Europa Clipper arrives in 2030.' },
  { id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634.1, massKg: 1.4819e23, meanTempC: -163,
    elements: el(1070400, 0.001, 198.3, 324.8, 0.2, 58.5, 7.155588, 68.301, 137.812, [268.2, 64.6]),
    skin: { map: 'ganymede' }, discovered: '1610 · Galileo Galilei', note: 'The largest moon in the Solar System, bigger than Mercury, with its own magnetic field.' },
  { id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410.3, massKg: 1.0759e23, meanTempC: -139,
    elements: el(1882700, 0.007, 43.8, 87.4, 0.3, 309.1, 16.69044, 277.921, 577.264, [268.7, 64.8]),
    skin: { map: 'callisto' }, discovered: '1610 · Galileo Galilei' },
  { id: 'amalthea', name: 'Amalthea', parent: 'jupiter', radiusKm: 83.5, massKg: 2.08e18,
    elements: el(181400, 0.003, 180.1, 310.6, 0.4, 282.9, 0.499918, 0.196, 0.393, [268.1, 64.5]),
    surfacePending: true, discovered: '1892 · E. E. Barnard' },
  { id: 'mimas', name: 'Mimas', parent: 'saturn', radiusKm: 198.2, massKg: 3.7493e19,
    elements: el(186000, 0.02, 160.4, 275.3, 1.6, 66.2, 0.942422, 0.493, 0.986, [40.6, 83.5]),
    skin: { map: 'mimas' }, discovered: '1789 · William Herschel', note: 'The giant crater Herschel spans a third of its diameter.' },
  { id: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252.1, massKg: 1.0802e20, meanTempC: -198,
    elements: el(238400, 0.005, 119.5, 57.0, 0.0, 0.0, 1.370218, 2.916, 0, [40.6, 83.5]),
    skin: { map: 'enceladus' }, discovered: '1789 · William Herschel', note: 'Geysers at its south pole vent a subsurface ocean into space; Cassini flew through them.' },
  { id: 'tethys', name: 'Tethys', parent: 'saturn', radiusKm: 531.1, massKg: 6.1745e20,
    elements: el(295000, 0.001, 335.3, 0.0, 1.1, 273.0, 1.887802, 0.005, 4.982, [40.6, 83.5]),
    skin: { map: 'tethys' }, discovered: '1684 · G. D. Cassini' },
  { id: 'dione', name: 'Dione', parent: 'saturn', radiusKm: 561.4, massKg: 1.0955e21,
    elements: el(377700, 0.002, 116.0, 212.0, 0.0, 0.0, 2.736916, 11.698, 0, [40.6, 83.5]),
    skin: { map: 'dione' }, discovered: '1684 · G. D. Cassini' },
  { id: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 763.8, massKg: 2.3065e21,
    elements: el(527200, 0.001, 44.3, 31.5, 0.3, 133.7, 4.517503, 33.939, 35.775, [40.6, 83.5]),
    skin: { map: 'rhea' }, discovered: '1672 · G. D. Cassini' },
  { id: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2574.7, massKg: 1.3452e23, meanTempC: -179,
    elements: el(1221900, 0.029, 78.3, 11.7, 0.3, 78.6, 15.945448, 346.68, 687.37, [36.4, 84.0]),
    skin: { map: 'titan' }, discovered: '1655 · Christiaan Huygens', note: 'A thick nitrogen atmosphere and lakes of liquid methane; Huygens landed in 2005 and Dragonfly launches in 2028.' },
  { id: 'hyperion', name: 'Hyperion', parent: 'saturn', radiusKm: 135, massKg: 5.62e18, rotationHours: 0, chaotic: true,
    elements: el(1481500, 0.105, 214.0, 122.9, 0.6, 87.1, 21.276658, 20.843, 257.625, [40.2, 83.6]),
    surfacePending: true, discovered: '1848 · Bond, Bond & Lassell', note: 'A sponge-like moon that tumbles chaotically: its spin is unpredictable.' },
  { id: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 734.5, massKg: 1.8056e21,
    elements: el(3561700, 0.028, 254.5, 74.8, 7.6, 86.5, 79.331002, 1662.9, 3130.302, [288.7, 78.9]),
    skin: { map: 'iapetus' }, discovered: '1671 · G. D. Cassini', note: 'Two-toned: its leading side is coal-dark, its trailing side bright ice.' },
  { id: 'phoebe', name: 'Phoebe', parent: 'saturn', radiusKm: 106.5, massKg: 8.292e18, rotationHours: 9.27, locked: false,
    elements: el(12929400, 0.164, 240.3, 308.0, 175.2, 192.7, 550.30391, 468.321, 741.483, [276.0, 67.5]),
    surfacePending: true, discovered: '1899 · W. H. Pickering', note: 'Retrograde and dark: probably a captured Kuiper-belt object.' },
  { id: 'miranda', name: 'Miranda', parent: 'uranus', radiusKm: 235.8, massKg: 6.4e19,
    elements: el(129846, 0.001, 154.8, 73.0, 4.4, 100.9, 1.413479, 8.939, 17.787, URANUS_POLE, 'equatorial'),
    skin: { map: 'miranda' }, discovered: '1948 · Gerard Kuiper' },
  { id: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 578.9, massKg: 1.251e21,
    elements: el(190929, 0.001, 9.6, 193.5, 0.0, 0.0, 2.520379, 28.901, 0, URANUS_POLE, 'equatorial'),
    skin: { map: 'ariel' }, discovered: '1851 · William Lassell' },
  { id: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 584.7, massKg: 1.275e21,
    elements: el(265986, 0.004, 183.4, 253.0, 0.1, 174.8, 4.144177, 64.126, 129.745, URANUS_POLE, 'equatorial'),
    skin: { map: 'umbriel' }, discovered: '1851 · William Lassell' },
  { id: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 788.9, massKg: 3.4e21,
    elements: el(436298, 0.002, 184.0, 68.1, 0.1, 29.5, 8.705869, 579.928, 1644.649, URANUS_POLE, 'equatorial'),
    skin: { map: 'titania' }, discovered: '1787 · William Herschel' },
  { id: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761.4, massKg: 3.076e21,
    elements: el(583511, 0.002, 132.2, 143.6, 0.1, 76.8, 13.463237, 158.604, 192.798, URANUS_POLE, 'equatorial'),
    skin: { map: 'oberon' }, discovered: '1787 · William Herschel' },
  { id: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1353.4, massKg: 2.139e22, meanTempC: -235,
    // node period 688 yr (Jacobson 2009): the table's 340 yr misplaces the orbit plane by 4° by 2026 against Horizons
    elements: el(354800, 0.0, 0.0, 63.0, 157.3, 178.1, 5.876994, 0, 688, [299.8, 43.1]),
    skin: { map: 'triton' }, discovered: '1846 · William Lassell', note: 'Orbits backwards: almost certainly a captured Kuiper-belt dwarf planet, with nitrogen geysers.' },
  { id: 'proteus', name: 'Proteus', parent: 'neptune', radiusKm: 210, massKg: 4.4e19,
    elements: el(117600, 0.0, 0.0, 276.8, 0.0, 0.0, 1.122315, 0, 0, [299.8, 42.6]),
    surfacePending: true, discovered: '1989 · Voyager 2' },
  { id: 'nereid', name: 'Nereid', parent: 'neptune', radiusKm: 170, massKg: 3.1e19, rotationHours: 11.59, locked: false,
    elements: el(5513900, 0.751, 296.8, 318.5, 5.1, 319.5, 360.133039, 7990.433, 9426.334, null, 'ecliptic', 2458849.5),
    surfacePending: true, discovered: '1949 · Gerard Kuiper' },
  { id: 'charon', name: 'Charon', parent: 'pluto', radiusKm: 606, massKg: 1.586e21,
    elements: el(19600, 0.0, 0.0, 304.1, 0.0, 0.0, 6.387222, 0, 0, PLUTO_POLE, 'equatorial'),
    skin: { map: 'charon' }, discovered: '1978 · James Christy', note: 'So large relative to Pluto that the pair orbit a point in space between them.' },
  // #37: Dimorphos around Didymos (post-DART orbit: Naidu et al. 2024; Didymos pole as above).
  // The orbital phase is not tracked here, so its position along the orbit is illustrative.
  { id: 'dimorphos', name: 'Dimorphos', parent: 'didymos', radiusKm: 0.0755, massKg: 4.3e9, phaseUnknown: true,
    elements: el(1.152, 0.028, 0, 0, 0, 0, 0.473799, 0, 0, [78.22, -70.79], 'equatorial'), surfacePending: true,
    discovered: '2003 · Pravec et al. (light curves)', note: 'DART struck it on 26 Sep 2022, the first test of deflecting an asteroid: its 11 h 55 min orbit shrank by 33 minutes.' },
];

// name, kind, radius km, mass kg (null = unmeasured), SBDB elements [epoch JD, a AU, e, i, Ω, ω, M], skin, IAU pole/rotation
const sb = (id, name, kind, radiusKm, massKg, [epochJd, a, e, i, node, w, M], extra = {}) =>
  ({ id, name, kind, radiusKm, massKg, elements: { epochJd, a, e, i, node, w, M }, ...extra });

for (const m of MOONS) if (MOON_FIT[m.id]) m.elements.fit = MOON_FIT[m.id];

export const SMALL_BODIES = [
  sb('ceres', 'Ceres', 'dwarf planet', 469.7, 9.384e20, [2461200.5, 2.765552595034094, 0.07969229514816586, 10.58802780183462, 80.24862682043221, 73.29421453021587, 274.4193463761342],
    { skin: { map: 'ceres' }, pole: [291.418, 66.764], iau: [170.65, 952.1532], rotationHours: 9.07417, belt: 'MAIN BELT', discovered: '1801 · Giuseppe Piazzi', meanTempC: -105,
      note: 'The largest body in the asteroid belt; Dawn orbited it 2015–18 and found bright salt deposits from a briny interior.' }),
  sb('vesta', 'Vesta', 'asteroid', 261.4, 2.59e20, [2461200.5, 2.361365965127599, 0.09020374382834395, 7.143925545058711, 103.701293265032, 151.4686478221564, 81.19015607686903],
    { skin: { map: 'vesta' }, pole: [309.031, 42.235], iau: [285.39, 1617.3329428], rotationHours: 5.342, belt: 'MAIN BELT', discovered: '1807 · Heinrich Olbers',
      note: 'A protoplanet with an iron core; meteorites from its giant Rheasilvia impact basin land on Earth (HED meteorites).' }),
  sb('pallas', 'Pallas', 'asteroid', 256.5, 2.04e20, [2461200.5, 2.769559010737709, 0.2307000995648547, 34.93279321851542, 172.8866193357694, 310.9699161652136, 254.2496521742734],
    { surfacePending: true, rotationHours: 7.8132, belt: 'MAIN BELT', discovered: '1802 · Heinrich Olbers' }),
  sb('hygiea', 'Hygiea', 'asteroid', 203.6, 1.05e20, [2461200.5, 3.150974033963701, 0.1067092741240963, 3.829529946447122, 283.1198927508594, 312.4242387344704, 252.0344242359649],
    { surfacePending: true, rotationHours: 13.828, belt: 'MAIN BELT', discovered: '1849 · Annibale de Gasparis' }),
  sb('haumea', 'Haumea', 'dwarf planet', 798, 4.006e21, [2461200.5, 43.06029023650952, 0.1944430148898797, 28.20847393040364, 121.7860561329425, 240.6905472508661, 223.2104118812299],
    { surfacePending: true, rotationHours: 3.9154, belt: 'KUIPER BELT', discovered: '2004 · Brown et al. / Ortiz et al.',
      note: 'Spins every 3.9 hours, stretching it into an egg about 2,300 km long; it has a ring.' }),
  sb('makemake', 'Makemake', 'dwarf planet', 715, null, [2461200.5, 45.57093317300052, 0.1588889953992523, 29.02785603743067, 79.2948338209406, 297.0922733397207, 169.9379962048232],
    { surfacePending: true, rotationHours: 22.83, belt: 'KUIPER BELT', discovered: '2005 · Brown, Trujillo & Rabinowitz' }),
  sb('eris', 'Eris', 'dwarf planet', 1163, 1.6466e22, [2461200.5, 67.93394687853566, 0.4382385347971672, 43.9258279471791, 36.00477044417249, 150.7949235840312, 211.774434275007],
    { surfacePending: true, rotationHours: 378.9, belt: 'SCATTERED DISC', discovered: '2005 · Brown, Trujillo & Rabinowitz', meanTempC: -243,
      note: 'Almost Pluto\'s size and 27% more massive; its discovery led the IAU to define "dwarf planet" in 2006.' }),
  sb('gonggong', 'Gonggong', 'dwarf planet', 615, 1.75e21, [2461200.5, 66.86666567773766, 0.5042510000302973, 30.89906721170288, 336.8383156185827, 206.6232839773693, 111.664541568459],
    { surfacePending: true, rotationHours: 22.4, belt: 'SCATTERED DISC', discovered: '2007 · Schwamb, Brown & Rabinowitz' }),
  sb('quaoar', 'Quaoar', 'dwarf planet', 555, 1.2e21, [2461200.5, 43.15617622670811, 0.03520019261837198, 7.991575800732639, 188.9191248092036, 163.209046106457, 292.8487574842713],
    { surfacePending: true, rotationHours: 17.68, belt: 'KUIPER BELT', discovered: '2002 · Trujillo & Brown', note: 'Has a ring far outside where rings should be able to survive.' }),
  sb('orcus', 'Orcus', 'dwarf planet', 455, 6.3e20, [2461200.5, 39.37686537914865, 0.2205240628250881, 20.55681019612, 268.4053519455824, 73.56848606705262, 189.0972913554275],
    { surfacePending: true, rotationHours: 13.19, belt: 'KUIPER BELT (PLUTINO)', discovered: '2004 · Brown, Trujillo & Rabinowitz' }),
  sb('sedna', 'Sedna', 'dwarf planet', 497, null, [2461200.5, 543.7195289104732, 0.8598824585187618, 11.92527582847476, 144.5061662673739, 311.0987725939751, 358.5956944005428],
    { surfacePending: true, rotationHours: 10.27, belt: 'INNER OORT CLOUD', discovered: '2003 · Brown, Trujillo & Rabinowitz',
      note: 'Never comes closer than 76 AU; its 11,000-year orbit hints at an unseen planet or a passing star long ago. Near perihelion now.' }),
  sb('arrokoth', 'Arrokoth', 'asteroid', 9, 7.5e14, [2461200.5, 44.05257835991367, 0.03555717645015258, 2.450613924655929, 159.0377267890618, 188.8507463365642, 310.9839309924138],
    { surfacePending: true, rotationHours: 15.92, belt: 'KUIPER BELT (COLD CLASSICAL)', discovered: '2014 · New Horizons team (Hubble)',
      note: 'A pristine two-lobed contact binary, 36 km long; New Horizons flew past on 1 Jan 2019. Drawn as a sphere.' }),
  sb('halley', '1P/Halley', 'comet', 5.5, 2.2e14, [2439875.5, 17.92863504856923, 0.9679359956953211, 162.1905300439129, 59.09894720612437, 112.2414314637764, 274.3823371366792],
    { surfacePending: true, rotationHours: 52.8, belt: 'HALLEY-TYPE COMET', comet: { M1: 5.5, K1: 8, perihelion: '2061-07-28' },
      // JPL Horizons osculating elements for the 2061 apparition (epoch 2061-07-28 TDB, perihelion
      // 2061-07-28.7): two-body motion from the 1968 set alone puts that perihelion ~5 months late.
      altElements: [{ epochJd: 2474033.5, a: 17.735623, e: 0.9665768, i: 161.96512, node: 59.392316, w: 112.052104, M: 359.9904974 }], discovered: 'Recorded since 240 BC · orbit by Edmond Halley 1705',
      note: 'Back in 2061. The orbit is the 1968 osculating one (SBDB); planetary tugs shift its timing by days to weeks.' }),
  // #37: the small bodies spacecraft have touched. Elements: JPL SBDB (epoch 2026-06-08) or, for
  // Bennu and 67P, JPL Horizons osculating elements at 2026-06-25 (SBDB's solutions are older).
  // Poles: SBDB (RA/Dec). All drawn as spheres of their mean radius; orientation illustrative except Eros.
  sb('eros', '433 Eros', 'asteroid', 8.42, 6.687e15, [2461200.5, 1.458243716760167, 0.2228779627700761, 10.82854410314273, 304.2679713350896, 178.9181319135911, 62.51145501986792],
    { surfacePending: true, pole: [11.37, 17.22], iau: [326.07, 1639.38864745], rotationHours: 5.27, belt: 'NEAR-EARTH (AMOR)', discovered: '1898 · Gustav Witt',
      note: 'A 34 km peanut; NEAR Shoemaker orbited it for a year and then landed, though built only as an orbiter (2001). Drawn as a sphere.' }),
  sb('itokawa', '25143 Itokawa', 'asteroid', 0.165, 3.51e10, [2461200.5, 1.324052284342771, 0.2801776414987972, 1.620940810523569, 69.07449749929083, 162.8409022415483, 170.653905937934],
    { surfacePending: true, pole: [90.53, -66.30], rotationHours: 12.132, belt: 'NEAR-EARTH (APOLLO)', discovered: '1998 · LINEAR',
      note: 'A 535 m rubble pile shaped like a sea otter; Hayabusa brought back the first asteroid dust (2010). Drawn as a sphere.' }),
  sb('ryugu', '162173 Ryugu', 'asteroid', 0.448, 4.5e11, [2461200.5, 1.190918932702464, 0.1910730046480051, 5.866442486408568, 251.2897123995624, 211.608993811871, 62.34067409463987],
    { surfacePending: true, pole: [96.3956, -66.3937], rotationHours: 7.63262, belt: 'NEAR-EARTH (APOLLO)', discovered: '1999 · LINEAR',
      note: 'A spinning-top rubble pile; Hayabusa2 touched down twice and returned 5.4 g of samples (2020). Drawn as a sphere.' }),
  sb('bennu', '101955 Bennu', 'asteroid', 0.2422, 7.329e10, [2461216.5, 1.125940757035206, 0.2036785985930620, 6.032981384513211, 1.966545538322302, 66.40834897298510, 85.65368423905571],
    { surfacePending: true, pole: [85.4522, -60.3678], rotationHours: 4.296061, belt: 'NEAR-EARTH (APOLLO)', discovered: '1999 · LINEAR',
      note: 'OSIRIS-REx tagged it in 2020 and dropped 121.6 g of samples in Utah in 2023; a small chance of hitting Earth in the 2180s. Drawn as a sphere.' }),
  sb('didymos', '65803 Didymos', 'asteroid', 0.3825, 5.4e11, [2461200.5, 1.642709608529702, 0.3831233242624545, 3.413876519313629, 72.9858236207145, 319.5807001349104, 260.8612886320632],
    { surfacePending: true, pole: [78.22, -70.79], rotationHours: 2.2593, belt: 'NEAR-EARTH (APOLLO)', discovered: '1996 · Spacewatch',
      note: 'The larger of a binary pair; DART hit its moon Dimorphos in 2022 and shortened its orbit by 33 minutes. ESA\'s Hera arrives in 2026.' }),
  sb('67p', '67P/Churyumov–Gerasimenko', 'comet', 1.65, 9.98e12, [2461216.5, 3.458913069061047, 0.6495469549577491, 3.866369645780778, 36.29278553201564, 22.23556143749892, 259.7212569240411],
    { surfacePending: true, pole: [69.3, 64.1], rotationHours: 12.76129, belt: 'JUPITER-FAMILY COMET', comet: { M1: 12.9, K1: 7.5, perihelion: '2028-04-09' }, discovered: '1969 · Klim Churyumov & Svetlana Gerasimenko',
      note: 'Rosetta orbited it for two years and its lander Philae bounced to rest under a cliff (2014). A 4 km rubber-duck shape, drawn as a sphere.' }),
];

export const MOON_CREDIT = {
  base: `${NASA3D}: global mosaics from Voyager, Galileo, Cassini and New Horizons imagery`,
};
