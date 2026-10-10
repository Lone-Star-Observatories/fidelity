// FUTURE EVENTS (#53): what is coming, from next decade to the Sun's last light. Each entry has its
// timing (a date where one is computed, otherwise a window), the tier of evidence and its sources.
//   COMPUTED  a prediction from measured orbits or motions (Apophis 2029, Gliese 710, pole stars).
//   MODELLED  a scenario whose timing nobody can predict (every supernova): "any time in a window".
//   REPORTED  published results quoted as published.
// `years` is the offset from now to jump to (null: no date to jump to); `window` is [lo, hi] years.
// Supernova peaks: Type II-P M_V = −16.7 ± 1 (Anderson et al. 2014); stripped-envelope (Ib/c)
// M_V ≈ −18 (Drout et al. 2011); a super-luminous/hypernova ≈ −19 to −21 (Gal-Yam 2012). Apparent
// magnitudes are before interstellar extinction unless an A_V is given.

export const FUTURE_GROUPS = [
  ['dying', 'STELLAR DEATHS'],
  ['passes', 'CLOSE PASSES AND CHANGING SKIES'],
  ['solar', 'THE SOLAR SYSTEM'],
  ['sun', 'THE SUN\'S FUTURE'],
];

export const FUTURE_EVENTS = [
  // ---- stellar deaths ---------------------------------------------------------------------
  {
    id: 'betelgeuse', group: 'dying', title: 'BETELGEUSE GOES SUPERNOVA', tier: 'modelled',
    when: 'ANY TIME IN THE NEXT ~100,000 YEARS', window: [0, 1e5], years: null,
    sn: { M: -16.7, Msd: 1, distLy: 548, type: 'IIP', av: 0 },
    summary: 'A red supergiant of ~16–19 solar masses burning helium in its core. When the core collapses it becomes a Type II-P supernova: brighter than the half Moon for weeks, visible in daylight for about a year, then fading over a few years. Orion loses a shoulder; a neutron star remains.',
    facts: [['DISTANCE', '548 LY (168 PC, +27/−15)', 'measured', 'Joyce et al. 2020 (seismic + evolutionary modelling)'],
      ['STAGE', 'CORE HELIUM BURNING', 'modelled', 'Joyce et al. 2020: ~100,000 years before collapse. The 2019–20 "Great Dimming" was a dust cloud, not a sign of imminent collapse (Montargès et al. 2021).']],
    source: 'Joyce et al. 2020, ApJ 902, 63; Montargès et al. 2021, Nature 594, 365', url: 'https://doi.org/10.3847/1538-4357/abb8db',
  },
  {
    id: 'antares', group: 'dying', title: 'ANTARES GOES SUPERNOVA', tier: 'modelled',
    when: 'TIMING UNKNOWN (LATE IN ITS LIFE; WELL WITHIN ~1 MILLION YEARS)', window: [0, 1e6], years: null,
    sn: { M: -16.7, Msd: 1, distLy: 550, type: 'IIP', av: 0 },
    summary: 'The red supergiant heart of Scorpius (~12–15 solar masses). Its collapse would look much like Betelgeuse\'s, low in the southern summer sky; Scorpius loses its heart.',
    facts: [['DISTANCE', '~550 LY (170 PC)', 'measured', 'Hipparcos parallax (van Leeuwen 2007)']],
    source: 'van Leeuwen 2007 (Hipparcos new reduction); Ohnaka et al. 2017', url: 'https://doi.org/10.1051/0004-6361:20078357',
  },
  {
    id: 'vy-cma', group: 'dying', title: 'VY CANIS MAJORIS: SUPERNOVA OR SILENT COLLAPSE', tier: 'modelled',
    when: 'TIMING UNKNOWN', window: [0, 1e5], years: null,
    sn: { M: -16.7, Msd: 1, distLy: 3820, type: 'IIP', av: 0 },
    summary: 'A red hypergiant wrapped in its own dust. Two outcomes are modelled: a supernova, or a direct collapse to a black hole with no explosion, in which case the star simply fades from view over months (as N6946-BH1 appears to have done).',
    facts: [['DISTANCE', '3,820 LY (1.17 KPC)', 'measured', 'Maser parallax, Zhang et al. 2012'],
      ['OUTCOME B', 'FAILED SUPERNOVA → BLACK HOLE', 'modelled', 'Adams et al. 2017 (N6946-BH1, the candidate failed supernova)']],
    source: 'Zhang et al. 2012, ApJ 744, 23; Adams et al. 2017, MNRAS 468, 4968', url: 'https://doi.org/10.1088/0004-637X/744/1/23',
  },
  {
    id: 'eta-carinae', group: 'dying', title: 'ETA CARINAE: SUPERNOVA OR HYPERNOVA', tier: 'modelled',
    when: 'TIMING UNKNOWN', window: [0, 1e6], years: null,
    sn: { M: -19, Msd: 1.5, distLy: 7500, type: 'Ibc', av: 1.7 },
    summary: 'A pair of massive stars, the primary ~90–100 solar masses. In its Great Eruption of the 1840s it briefly became the second-brightest star in the sky (about magnitude −1) without being destroyed. Its final explosion could be a super-luminous supernova; seen from 7,500 ly it would still be a single point, brighter than any star.',
    facts: [['DISTANCE', '7,500 LY (2.3 KPC)', 'measured', 'Smith 2006 (expansion parallax of the Homunculus)'],
      ['GREAT ERUPTION', 'PEAK ~MAG −1 IN 1843', 'measured', 'Historical record (Smith & Frew 2011)'],
      ['EXTINCTION', 'A_V ≈ 1.7 MAG', 'measured', 'Towards Eta Carinae (Davidson & Humphreys 1997)']],
    source: 'Smith 2006, ApJ 644, 1151; Smith & Frew 2011, MNRAS 415, 2009', url: 'https://doi.org/10.1086/503766',
  },
  {
    id: 'wr104', group: 'dying', title: 'WR 104: SUPERNOVA, AND THE GAMMA-RAY BURST QUESTION', tier: 'modelled',
    when: 'TIMING UNKNOWN (WITHIN A FEW HUNDRED THOUSAND YEARS)', window: [0, 5e5], years: null,
    sn: { M: -18, Msd: 1, distLy: 8400, type: 'Ibc', av: 0 },
    summary: 'A Wolf–Rayet star and an OB companion whose colliding winds wind dust into a pinwheel. Early images suggested we see the spiral face-on, which would put any gamma-ray burst beam pointed at us. Measurements in 2025 found the system tilted 30–40° to our line of sight; a burst beam is only a few degrees wide, so it would miss Earth.',
    facts: [['DISTANCE', '~8,400 LY (2.58 KPC)', 'measured', 'Tuthill et al. 2008'],
      ['TILT TO OUR LINE OF SIGHT', '30–40°', 'measured', 'Han et al. 2025 (Keck observations of the binary orbit)'],
      ['GRB BEAM HALF-WIDTH', '~2–10°', 'modelled', 'Long-GRB jet opening angles (Frail et al. 2001; Ryan et al. 2015)'],
      ['DOES THE BEAM HIT EARTH?', 'NO (MISSES BY ≥20°)', 'computed', 'Tilt minus the widest beam half-width']],
    source: 'Tuthill et al. 2008, ApJ 675, 698; Han et al. 2025', url: 'https://doi.org/10.1086/527286',
  },
  {
    id: 'sirius', group: 'dying', title: 'SIRIUS GOES SUPERNOVA: NOT POSSIBLE', tier: 'computed', impossible: true,
    when: 'NEVER', window: null, years: null,
    summary: 'Sirius A has about 2 solar masses: far too little to collapse (that takes ~8). It will swell into a red giant in roughly a billion years and end as a white dwarf. Sirius B is already a white dwarf (1.02 M☉), below the 1.4 M☉ Chandrasekhar limit, and it orbits 20 au from Sirius A, too far to pull in enough gas to reach it. The real future: a pair of white dwarfs.',
    facts: [['SIRIUS A MASS', '2.06 M☉ (CORE COLLAPSE NEEDS ~8)', 'measured', 'Bond et al. 2017 (HST astrometry)'],
      ['SIRIUS B MASS', '1.02 M☉ (CHANDRASEKHAR LIMIT 1.4)', 'measured', 'Bond et al. 2017'],
      ['SEPARATION', '~20 AU (50-YEAR ORBIT)', 'measured', 'Bond et al. 2017']],
    source: 'Bond et al. 2017, ApJ 840, 70', url: 'https://doi.org/10.3847/1538-4357/aa6af8',
  },
  // ---- close passes and changing skies -----------------------------------------------------
  {
    id: 'gliese-710', group: 'passes', title: 'GLIESE 710 PASSES THROUGH THE OORT CLOUD', tier: 'computed',
    when: 'IN ~1.29 MILLION YEARS (±0.04)', window: [1.25e6, 1.33e6], years: 1.29e6,
    star: { massSun: 0.65, distAu: 10600 },
    summary: 'A K7 dwarf heading almost straight at us. At closest approach it will be ~10,600 au from the Sun, inside the Oort cloud, shining at about magnitude −2.7 (brighter than Jupiter). Its gravity will nudge Oort-cloud comets inward: a modelled shower of perhaps ten extra naked-eye comets a year, arriving over the following few million years. Its pull on the planets is negligible.',
    facts: [['CLOSEST APPROACH', '~10,600 AU (0.051 PC)', 'computed', 'Bailer-Jones et al. 2018 (Gaia DR2); Gaia DR3 agrees'],
      ['WHEN', '1.29 ± 0.04 MYR', 'computed', 'Gaia DR2/DR3 astrometry and radial velocity'],
      ['COMET SHOWER', '~10 EXTRA COMETS/YR OVER ~3–4 MYR', 'modelled', 'Berski & Dybczyński 2016']],
    source: 'Bailer-Jones et al. 2018, A&A 616, A37; Berski & Dybczyński 2016, A&A 595, L10 (doi:10.1051/0004-6361/201629835)', url: 'https://doi.org/10.1051/0004-6361/201833456',
    go: { level: 'navigation', system: 'sol' },
  },
  {
    id: 'ross-248', group: 'passes', title: 'ROSS 248 BECOMES THE NEAREST STAR', tier: 'computed',
    when: 'IN ~36,000 YEARS', window: [3.3e4, 3.9e4], years: 36000,
    summary: 'A red dwarf in Andromeda closing at ~78 km/s. Around 36,000 years from now it passes ~3.0 ly from the Sun and becomes our nearest star for a few thousand years, before Alpha Centauri reclaims the title. Alpha Centauri itself comes closest, ~3.2 ly, in about 28,000 years.',
    facts: [['ROSS 248 CLOSEST', '~3.0 LY IN ~36 KYR', 'computed', 'Matthews 1994; Gaia DR3 kinematics'],
      ['ALPHA CENTAURI CLOSEST', '~3.2 LY IN ~28 KYR', 'computed', 'Matthews 1994']],
    source: 'Matthews 1994, QJRAS 35, 1; Gaia DR3', url: 'https://ui.adsabs.harvard.edu/abs/1994QJRAS..35....1M',
    go: { level: 'navigation', system: 'sol' },
  },
  {
    id: 'pole-stars', group: 'passes', title: 'POLARIS\' SUCCESSORS', tier: 'computed', poles: true,
    when: 'ERRAI ~AD 4000 → ALDERAMIN → DENEB → VEGA ~AD 13,800', window: [1000, 26000], years: 2000,
    summary: 'Earth\'s axis traces a circle around the ecliptic pole every ~25,800 years, so the pole star changes. The run below is computed by the app\'s precession model from the stars\' positions today (proper motion ignored, so dates are good to a few centuries).',
    facts: [], source: 'IAU 1976 precession (Lieske et al. 1977); uniform 50.29″/yr beyond ±2,000 years', url: 'https://ui.adsabs.harvard.edu/abs/1977A%26A....58....1L',
  },
  {
    id: 'constellations', group: 'passes', title: 'THE CONSTELLATIONS IN 100,000 YEARS', tier: 'computed',
    when: 'IN 100,000 YEARS', window: [1e5, 1e5], years: 1e5,
    summary: 'Stars drift: the Big Dipper\'s handle bends, nearby bright stars such as Sirius and Arcturus wander, and some of today\'s naked-eye stars fade or leave. The Navigation View moves every catalogued star along its measured motion; set the clock 100,000 years ahead to see the new sky.',
    facts: [['MOTIONS', 'HIPPARCOS / GAIA PROPER MOTIONS + RADIAL VELOCITIES', 'measured', 'HYG v4.4 with Gaia DR3 motions']],
    source: 'HYG v4.4; Gaia DR3', url: 'https://www.astronexus.com/hyg',
    go: { level: 'navigation', system: 'sol' },
  },
  // ---- the Solar System -------------------------------------------------------------------
  {
    id: 'apophis', group: 'solar', title: 'APOPHIS SKIMS PAST EARTH', tier: 'computed',
    when: '2029-04-13 21:46 UTC', iso: '2029-04-13T21:46:00Z', window: null,
    summary: 'A 340 m asteroid passes 38,000 km from Earth\'s centre: closer than the geostationary satellites, and visible to the naked eye from Europe, Africa and western Asia as a moving magnitude-3 star. No impact is possible in 2029 or for at least the next century. Earth\'s tides will change its spin.',
    facts: [['CLOSEST APPROACH', '38,012 KM FROM EARTH\'S CENTRE', 'computed', 'JPL CNEOS (orbit solution with radar astrometry)'],
      ['BRIGHTNESS', 'MAG ~3.1 AT CLOSEST', 'computed', 'JPL'],
      ['IMPACT RISK', 'NONE FOR AT LEAST 100 YEARS', 'computed', 'Removed from the Sentry list in 2021 after radar ranging']],
    source: 'NASA JPL CNEOS', url: 'https://cneos.jpl.nasa.gov/doc/apophis/',
    go: { level: 'system', system: 'sol', body: 'apophis' },
  },
  {
    id: 'impact-risk', group: 'solar', title: 'IMPACT-RISK LIST: EARTH AND THE MOON', tier: 'computed', risk: true,
    when: 'NEXT 100 YEARS (AND BEYOND)', window: [0, 1000], years: null,
    summary: 'Every known asteroid with a non-zero chance of hitting Earth, from NASA\'s Sentry and ESA\'s NEOCC, refreshed twice a day. Nearly all are small, faint and poorly observed; most drop off the list when more observations arrive.',
    facts: [], source: 'NASA JPL CNEOS Sentry; ESA NEO Coordination Centre risk list', url: 'https://cneos.jpl.nasa.gov/sentry/',
  },
  {
    id: 'desdemona-cressida', group: 'solar', title: 'DESDEMONA AND CRESSIDA COLLIDE', tier: 'modelled',
    when: 'WITHIN ~1,000 TO 10 MILLION YEARS', window: [1e3, 1e7], years: null,
    summary: 'Two of Uranus\' small inner moons have orbits so close and chaotic that they are predicted to cross and collide. The debris would spread into a new ring around Uranus.',
    facts: [['TIMESCALE', '10³–10⁷ YEARS', 'modelled', 'French & Showalter 2012 (orbit integrations)']],
    source: 'French & Showalter 2012, Icarus 220, 911', url: 'https://doi.org/10.1016/j.icarus.2012.06.031',
    go: { level: 'system', system: 'sol', body: 'uranus' },
  },
  {
    id: 'phobos', group: 'solar', title: 'THE END OF PHOBOS', tier: 'modelled',
    when: 'IN ~20–50 MILLION YEARS', window: [2e7, 5e7], years: 3e7,
    summary: 'Phobos orbits faster than Mars turns, so Mars\' tides drag it inward, about 1.8 m closer each century. Within tens of millions of years tidal forces tear it apart into a ring around Mars, or it crashes into the surface.',
    facts: [['INWARD DRIFT', '~1.8 M PER CENTURY', 'measured', 'Jacobson 2010; Bills et al. 2005 (shadow timings)'],
      ['RING (BREAK-UP)', '~20–40 MYR', 'modelled', 'Black & Mittal 2015'],
      ['IMPACT (IF IT HOLDS TOGETHER)', '~30–50 MYR', 'modelled', 'Black & Mittal 2015 and earlier tidal-decay estimates']],
    source: 'Black & Mittal 2015, Nature Geoscience 8, 913; Jacobson 2010', url: 'https://doi.org/10.1038/ngeo2583',
    go: { level: 'system', system: 'sol', body: 'mars' },
  },
  // ---- the Sun ------------------------------------------------------------------------------
  {
    id: 'sun-future', group: 'sun', title: 'THE SUN\'S FUTURE', tier: 'modelled', sunTrack: true,
    when: 'OVER THE NEXT ~8 BILLION YEARS', window: [0, 8e9], years: null,
    summary: 'The Sun brightens about 1% every 110 million years as helium builds up in its core. In about a billion years Earth falls inside the habitable zone\'s inner edge and loses its oceans. In ~5 billion years the core runs out of hydrogen and the Sun swells into a red giant, engulfing Mercury and Venus; Earth\'s fate is uncertain. A helium flash at the tip of the red-giant branch, a calmer helium-burning phase, the pulsing asymptotic giant branch, a planetary nebula, and finally a white dwarf.',
    facts: [], source: 'Gough 1981; Kopparapu et al. 2013; Schröder & Smith 2008', url: 'https://doi.org/10.1111/j.1365-2966.2008.13022.x',
    go: { level: 'system', system: 'sol', body: 'sun' },
  },
  {
    id: 'andromeda', group: 'sun', title: 'THE MILKY WAY MEETS ANDROMEDA', tier: 'modelled',
    when: 'FIRST PASS IN ~4–5 BILLION YEARS (IF IT HAPPENS)', window: [4e9, 1e10], years: null,
    summary: 'Andromeda approaches at 110 km/s. Earlier models had a merger in ~4.5 billion years; newer Gaia and HST work gives only about even odds of a merger within 10 billion years. Stars almost never collide; the night sky fills with a second galaxy.',
    facts: [['APPROACH SPEED', '110 KM/S', 'measured', 'van der Marel et al. 2012'],
      ['MERGER ODDS', '~50% WITHIN 10 GYR', 'modelled', 'Sawala et al. 2025']],
    source: 'van der Marel et al. 2012, 2019; Sawala et al. 2025, Nature Astronomy (No certainty of a Milky Way–Andromeda collision)', url: 'https://doi.org/10.1038/s41550-025-02563-1',
    go: { level: 'universe' },
  },
];

// The Sun from here on (Gyr from now; L in L☉, R in R☉). Main sequence from Gough's law (COMPUTED in
// the panel); the late stages as published by Schröder & Smith (2008) (MODELLED).
export const SUN_STAGES = [
  { gyr: 1.1, label: 'EARTH LEAVES THE HABITABLE ZONE', detail: 'L ≈ 1.11 L☉: the runaway-greenhouse limit (Kopparapu et al. 2013) passes 1 au; the oceans evaporate.', computed: true },
  { gyr: 5.0, label: 'CORE HYDROGEN RUNS OUT', detail: 'The Sun leaves the main sequence (age ~10 Gyr) and starts to swell.' },
  { gyr: 7.59, label: 'TIP OF THE RED-GIANT BRANCH · HELIUM FLASH', detail: 'R ≈ 256 R☉ (1.19 au), L ≈ 2,730 L☉, mass lost down to 0.67 M☉; Mercury and Venus engulfed, Earth very likely too (tidal drag). The core ignites helium in a flash.' },
  { gyr: 7.7, label: 'HORIZONTAL BRANCH, THEN AGB THERMAL PULSES', detail: '~100 Myr of quiet core helium burning (~50 L☉), then the asymptotic giant branch with helium-shell flashes.' },
  { gyr: 7.8, label: 'PLANETARY NEBULA → WHITE DWARF', detail: 'The envelope drifts away as a planetary nebula; a white dwarf of 0.54 M☉, about Earth\'s size, remains and cools for billions of years.' },
];
