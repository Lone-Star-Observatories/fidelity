// Points of interest in Sector 001: regions (belts, magnetosphere, heliosphere, Oort cloud)
// and Lagrange points, as focusable entries in the Sol model. Each carries badged facts.

const fact = (label, value, tier, detail = '') => ({ label, value, tier, detail });

// Mass ratios for Lagrange-point distances (secondary / primary).
export const MASS_RATIO = { 'sun-earth': 3.0404e-6, 'earth-moon': 0.012300, 'sun-jupiter': 9.5479e-4 };

const region = (id, name, anchor, view, labelAt, { explain, ...facts }) => ({ id, name, kind: 'region', anchor, ...view, labelAt, explain, facts });
const point = (id, name, pair, L, facts) => ({ id, name, kind: 'lagrange point', pair, L, facts });

export const REGIONS = [
  region('main-belt', 'Main asteroid belt', 'sun', { viewAU: 9 }, [2.9, 0, 0], {
    explain: "Leftover building blocks of the planets that never formed one: Jupiter's gravity kept stirring them. Most are rubble piles; Ceres is big enough to be round.",
    REGION: [
      fact('WHERE', '2.1–3.3 AU', 'measured', 'Between Mars and Jupiter; Kirkwood gaps mark resonances with Jupiter.'),
      fact('KNOWN OBJECTS', '> 1.3 MILLION', 'measured', 'Minor Planet Center count; the dots are the 36,000 largest, on their real orbits (JPL SBDB).'),
      fact('TOTAL MASS', '≈ 3% OF THE MOON', 'measured', '2.4 × 10^21 kg from planetary ephemerides (Pitjeva & Pitjev 2018); Ceres holds a third of it.'),
      fact('SPACING', '~1 MILLION KM APART', 'computed', 'Mostly empty: spacecraft cross it without manoeuvring.'),
    ] }),
  region('trojans', 'Jupiter Trojans', 'sun', { viewAU: 16 }, [0, 0, 5.2], {
    explain: "Asteroids sharing Jupiter's orbit, trapped around the stable Lagrange points 60° ahead (L4) and behind (L5). Possibly captured from the outer Solar System early on.",
    REGION: [
      fact('WHERE', "JUPITER'S L4 AND L5", 'measured', 'Two swarms 60° ahead of and behind Jupiter, held by the Sun–Jupiter Lagrange points.'),
      fact('KNOWN OBJECTS', '> 15,000', 'measured', 'The dots are the 11,600 largest (JPL SBDB). Lucy visits them 2027–2033.'),
    ] }),
  region('kuiper-belt', 'Kuiper belt', 'sun', { viewAU: 150 }, [44, 0, 0], {
    explain: "A wide ring of icy bodies beyond Neptune, left over from the Solar System's formation: the home of Pluto and Arrokoth, and a source of short-period comets.",
    REGION: [
      fact('WHERE', '30–50 AU', 'measured', 'Beyond Neptune; the scattered disc stretches much further.'),
      fact('KNOWN OBJECTS', '> 4,000', 'measured', 'Every TNO with an orbit in JPL SBDB is drawn, plus Centaurs between the giant planets.'),
      fact('NOTABLE', 'PLUTO · ARROKOTH · HAUMEA · MAKEMAKE', 'measured'),
    ] }),
  region('heliosphere', 'Heliosphere', 'sun', { viewAU: 420 }, [0, 0, 121.6], {
    explain: 'The bubble blown in interstellar space by the solar wind. The wind slows abruptly at the termination shock; the heliopause is where it meets the interstellar medium. Only the two Voyagers have crossed it, at different distances, so its shape is mostly modelled.',
    REGION: [
      fact('TERMINATION SHOCK', '94 · 84 AU', 'measured', 'Where the solar wind drops below the speed of sound: crossed by Voyager 1 (2004) and Voyager 2 (2007).'),
      fact('HELIOPAUSE', '121.6 · 119.0 AU', 'measured', 'The edge of the Sun\'s bubble: Voyager 1 (Aug 2012) and Voyager 2 (Nov 2018) entered interstellar space.'),
      fact('NOSE', 'TOWARDS SCORPIUS–OPHIUCHUS', 'measured', 'Interstellar wind arrives from ecliptic longitude 255.7°, latitude 5.1° (IBEX).'),
      fact('SHAPE', 'BLUNT NOSE, LONG TAIL, SQUASHED SOUTH', 'modelled', 'Each shell is fitted through both Voyager crossings (yellow points): the south (Voyager 2) side is closer, pushed in by the interstellar magnetic field. Only those two points are measured; the tail length is unknown (models range from comet-like to croissant-shaped).'),
      fact('IBEX RIBBON', 'CENTRE 221°, +39° · ~74° ACROSS', 'measured', 'A ring of energetic neutral atoms on the sky (orange), discovered by IBEX in 2009 (McComas et al.); it traces the direction of the interstellar magnetic field.'),
      fact('INTERSTELLAR FIELD', 'DRAPED OVER THE NOSE', 'modelled', 'Blue lines: a uniform field bent around the heliopause (potential-field sketch, not a simulation).'),
    ] }),
  region('oort-cloud', 'Oort cloud', 'sun', { viewAU: 320000 }, [0, 0, 50000], {
    explain: 'A vast, spherical swarm of icy bodies thought to surround the Sun out to a quarter of the way to the next star, the reservoir of long-period comets. None has been seen in place.',
    REGION: [
      fact('WHERE', '2,000–100,000 AU', 'modelled', 'Inferred from long-period comets falling in from every direction. No Oort-cloud object has been seen in place.'),
      fact('OBJECTS', '~10^11 ICY BODIES', 'modelled', 'Estimated from comet arrival rates.'),
      fact('DOTS', 'ILLUSTRATIVE', 'imagined', 'Random points with a plausible density (∝ r^-3.5); the inner Hills cloud is flattened.'),
      fact('LIGHT TIME', 'UP TO 1.6 YEARS', 'computed', '100,000 AU at the speed of light: a third of the way to Proxima Centauri.'),
    ] }),
  region('geo-ring', 'Geostationary ring', 'earth', { viewKm: 60000 }, [42164, 0, 0], {
    explain: 'At 35,786 km above the equator an orbit takes exactly one sidereal day, so a satellite there hangs over one spot: ideal for weather and communications satellites.',
    REGION: [
      fact('RADIUS', '42,164 KM FROM CENTRE', 'computed', 'Where an orbit takes one sidereal day: satellites hover over one longitude.'),
      fact('ALTITUDE', '35,786 KM', 'computed'),
      fact('PROPOSED BY', 'ARTHUR C. CLARKE, 1945', 'measured', 'In "Extra-Terrestrial Relays", Wireless World.'),
    ] }),
  region('van-allen', 'Van Allen belts', 'earth', { viewKm: 50000 }, [5 * 6371, 0, 0], {
    explain: "Two doughnuts of charged particles trapped by Earth's magnetic field. Spacecraft and astronauts limit their time inside them because of the radiation.",
    REGION: [
      fact('INNER BELT', 'L ≈ 1.2–2.5 · PROTONS', 'modelled', 'Energetic protons trapped by Earth\'s magnetic field, from cosmic rays hitting the atmosphere.'),
      fact('OUTER BELT', 'L ≈ 3.5–6.5 · ELECTRONS', 'modelled', 'Swells and shrinks with solar storms (Van Allen Probes, 2012–2019).'),
      fact('AXIS', '80.8°N 72.6°W', 'measured', 'Tilted with the geomagnetic dipole (IGRF-14, 2025), turning with the Earth.'),
      fact('DISCOVERED', '1958 · EXPLORER 1', 'measured', 'James Van Allen\'s Geiger counter on the first US satellite.'),
    ] }),
  region('hill-spheres', 'Hill spheres', 'earth', { viewKm: 3.6e6 }, [1.5e6, 0, 0], {
    explain: "The region where a planet's gravity, rather than the Sun's, controls an orbiting body. A moon must orbit well inside it (about half the radius or less) to stay.",
    REGION: [
      fact('MEANING', 'WHERE A PLANET RULES', 'computed', 'Inside it, a planet\'s gravity beats the Sun\'s tides: moons must orbit well within it. r = a(1−e)·∛(m / 3M☉).'),
      fact("EARTH'S", '1.47 MILLION KM', 'computed', 'The Moon orbits at a quarter of that.'),
      fact("JUPITER'S", '51 MILLION KM', 'computed', 'Its outermost moons orbit over 30 million km out.'),
    ] }),
];

export const LAGRANGE = [
  point('se-l1', 'Sun–Earth L1', 'sun-earth', 1, { POINT: [
    fact('DISTANCE', '1.5 MILLION KM SUNWARD', 'computed'),
    fact('THERE NOW', 'SOHO · ACE · DSCOVR · ADITYA-L1', 'measured', 'An unbroken view of the Sun, and an hour\'s warning of solar storms.')] }),
  point('se-l2', 'Sun–Earth L2', 'sun-earth', 2, { POINT: [
    fact('DISTANCE', '1.5 MILLION KM ANTI-SUNWARD', 'computed'),
    fact('THERE NOW', 'JWST · GAIA · EUCLID', 'measured', 'Sun, Earth and Moon all behind you: ideal for cold telescopes.')] }),
  point('se-l3', 'Sun–Earth L3', 'sun-earth', 3, { POINT: [
    fact('WHERE', 'BEHIND THE SUN', 'computed', 'Always hidden from Earth, and unstable; nothing is there (Counter-Earths are fiction).')] }),
  point('se-l4', 'Sun–Earth L4', 'sun-earth', 4, { POINT: [
    fact('WHERE', '60° AHEAD OF EARTH', 'computed'),
    fact('THERE NOW', 'EARTH TROJAN 2010 TK7', 'measured', 'Found by NEOWISE in 2011; 2020 XL5 is a second.')] }),
  point('se-l5', 'Sun–Earth L5', 'sun-earth', 5, { POINT: [
    fact('WHERE', '60° BEHIND EARTH', 'computed', 'Proposed for a space-weather monitor that sees storms before they rotate towards Earth (ESA Vigil).')] }),
  point('em-l1', 'Earth–Moon L1', 'earth-moon', 1, { POINT: [fact('DISTANCE', '≈ 326,000 KM FROM EARTH', 'computed', 'Between Earth and Moon.')] }),
  point('em-l2', 'Earth–Moon L2', 'earth-moon', 2, { POINT: [
    fact('DISTANCE', '≈ 449,000 KM FROM EARTH', 'computed', 'Beyond the far side.'),
    fact('THERE NOW', 'QUEQIAO-2', 'measured', 'China\'s relay satellite for far-side landers orbits near here.')] }),
  point('em-l4', 'Earth–Moon L4', 'earth-moon', 4, { POINT: [fact('WHERE', '60° AHEAD OF THE MOON', 'computed', 'The faint Kordylewski dust clouds may gather here (reported 2018; debated).')] }),
  point('em-l5', 'Earth–Moon L5', 'earth-moon', 5, { POINT: [fact('WHERE', '60° BEHIND THE MOON', 'computed', 'The L5 Society\'s proposed home for space colonies (1975).')] }),
  point('sj-l4', 'Sun–Jupiter L4', 'sun-jupiter', 4, { POINT: [fact('THERE NOW', 'THE GREEK CAMP (TROJANS)', 'measured', 'The leading swarm of Jupiter Trojans.')] }),
  point('sj-l5', 'Sun–Jupiter L5', 'sun-jupiter', 5, { POINT: [fact('THERE NOW', 'THE TROJAN CAMP', 'measured', 'The trailing swarm; Patroclus–Menoetius, Lucy\'s last target (2033).')] }),
];
