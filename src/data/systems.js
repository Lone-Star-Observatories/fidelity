import { bodyVisualFor } from './bespoke.js';
// System models: one shape for Sol and for any other star, so the System View and the
// info panel don't care which system they show. Every displayed fact carries a
// provenance tier (see provenance.js) and a short note on where it came from.

import { AU_KM, SUN, PLANETS } from './sol.js';
import { MOONS, SMALL_BODIES } from './moons.js';
import { REGIONS, LAGRANGE } from './poi.js';
import { SPACECRAFT } from './spacecraft.js';
import { shapeFor } from './shapes.js';
import { modelFor } from './models.js';
import { meanMotion } from '../astro/smallbodies.js';
import { eqToEcl, frameToScene, starTeff, blackbodyRGB, rgbToHex } from '../astro/frames.js';

const DEG = Math.PI / 180;
const R_SUN_KM = 695700;
const R_EARTH_KM = 6371;
const M_EARTH_KG = 5.972e24;

const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 1) });
const fact = (label, value, tier, detail = '') => ({ label, value, tier, detail });
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---- Sol ------------------------------------------------------------------------------------

function solFacts(b) {
  const phys = [
    fact('RADIUS', `${fmt(b.radiusKm, 1)} KM`, 'measured', 'NASA fact sheet (mean radius).'),
    fact('MASS', `${b.massKg.toExponential(3).replace('e+', ' × 10^')} KG`, 'measured', 'From the gravitational pull on moons and spacecraft.'),
  ];
  if (b.gravity) phys.push(fact('SURFACE G', `${b.gravity} M/S²`, 'measured'));
  phys.push(fact('DAY (SIDEREAL)', `${fmt(Math.abs(b.rotationHours), 2)} H${b.rotationHours < 0 ? ' · RETROGRADE' : ''}`, 'measured'));
  if (b.periodDays) phys.push(fact('YEAR', `${fmt(b.periodDays, b.periodDays < 1000 ? 1 : 0)} DAYS`, 'measured'));
  if (b.meanTempC != null) phys.push(fact('MEAN TEMP', `${b.meanTempC} °C`, 'measured'));
  if (b.teffK) phys.push(fact('SURFACE TEMP', `${b.teffK} K`, 'measured'));
  if (b.spectral) phys.push(fact('CLASS', b.spectral, 'measured'));
  phys.push(fact('SPIN AXIS', `RA ${b.pole[0]}° DEC ${b.pole[1]}°`, 'measured', 'IAU WGCCRE pole orientation.'));
  if (b.iau) phys.push(fact('ROTATION PHASE', b.iau === 'gmst' ? 'SIDEREAL TIME' : 'IAU MODEL', 'computed',
    b.iau === 'gmst' ? 'Earth turns by Greenwich sidereal time, so day and night fall where they really are.'
      : 'IAU rotation model. Gas giant cloud bands drift, so features will not line up exactly with today.'));
  return {
    PHYSICAL: phys,
    RENDERING: [b.id === 'pluto'
      ? fact('SURFACE', 'NEW HORIZONS MOSAIC', 'measured', 'Global colour mosaic from the 2015 flyby. The black southern band was in polar night and has never been imaged.')
      : b.id === 'venus' ? fact('SURFACE', 'CLOUD TOPS', 'measured', 'What you would see: Venus\'s surface is hidden under permanent cloud.')
      : b.id === 'sun' ? fact('SURFACE', 'PHOTOSPHERE', 'measured', 'Solar imagery with limb darkening applied.')
      : fact('SURFACE', 'SPACECRAFT MOSAIC', 'measured', 'Global map assembled from spacecraft imagery.')],
  };
}

const sci = (x) => x.toExponential(3).replace('e+', ' × 10^');
const G = 6.674e-11;

function physicalFacts(b) {
  const out = [fact('RADIUS', `${fmt(b.radiusKm, b.radiusKm < 100 ? 1 : 0)} KM`, 'measured', b.kind === 'moon' ? 'Mean radius (JPL SSD).' : 'From occultations and spacecraft (JPL SBDB).')];
  if (b.massKg) {
    out.push(fact('MASS', `${sci(b.massKg)} KG`, 'measured', 'From its pull on neighbours or spacecraft.'));
    out.push(fact('DENSITY', `${fmt((b.massKg * 1000) / ((4 / 3) * Math.PI * (b.radiusKm * 1e5) ** 3), 2)} G/CM³`, 'computed', 'Mass ÷ volume. Below ~2: mostly ice; ~3: rock; above 4: rock with iron.'));
    out.push(fact('SURFACE G', `${fmt((G * b.massKg) / (b.radiusKm * 1000) ** 2, 3)} M/S²`, 'computed', 'GM / R².'));
  } else out.push(fact('MASS', 'NOT MEASURED', 'imagined', 'No moon or spacecraft has weighed it yet.'));
  if (b.meanTempC != null) out.push(fact('MEAN TEMP', `${b.meanTempC} °C`, 'measured'));
  if (b.discovered) out.push(fact('DISCOVERED', b.discovered.toUpperCase(), 'measured'));
  return out;
}

function skinFacts(m) {
  const shape = shapeFor(m.id);
  const bespoke = bodyVisualFor(m);
  const shapeFacts = shape ? [fact('SHAPE', shape.label ?? 'PDS RECONSTRUCTION', 'modelled', `${shape.credit}. ${shape.citation} ${shape.frame} Geometry loads on focus; a sphere remains until available.`)] : [];

  if (m.surfacePending && bespoke?.surfaceMap) return [...shapeFacts, fact('SURFACE', 'BESPOKE RESEARCHED HYPOTHESIS', 'imagined', bespoke.assumed.join(' '))];
  if (m.surfacePending) return [...shapeFacts, fact('SURFACE', 'GENERIC PLACEHOLDER · BESPOKE QUEUED', 'imagined', 'Independent procedural illustration. Terrain and colour are unmeasured; native imagery assessment and an individual researched asset are queued.')];
  return [...shapeFacts, fact('SURFACE', 'SPACECRAFT MOSAIC', 'measured', 'Global map assembled from spacecraft imagery. Gaps (e.g. Voyager never saw the northern halves of Uranus\' moons) are filled in.')];
}

const parentRadiusKm = (id) => (PLANETS.find((p) => p.id === id) ?? SMALL_BODIES.find((b) => b.id === id)).radiusKm;

function moonBody(m) {
  const e = m.elements;
  const locked = m.locked !== false && !m.chaotic;
  return {
    id: m.id, name: m.name, kind: 'moon', parent: m.parent, radiusKm: m.radiusKm, massKg: m.massKg, meanTempC: m.meanTempC,
    rotationHours: m.rotationHours || e.P * 24, locked, note: m.note ?? null, discovered: m.discovered,
    palette: ['#8f8a84', '#a9a39b', '#6f6a65'], skin: m.surfacePending && bodyVisualFor(m)?.surfaceMap ? { map: bodyVisualFor(m).surfaceMap.key } : m.skin, orbit: { type: 'moon', parent: m.parent }, moon: m,
    facts: {
      ORBIT: [
        fact('ORBITS', m.parent.toUpperCase(), 'measured'),
        fact('DISTANCE', `${fmt(e.a, e.a < 10 ? 2 : 0)} KM · ${fmt(e.a / parentRadiusKm(m.parent), 1)} × ${m.parent.toUpperCase()} RADII`, 'measured', m.phaseUnknown ? 'Semi-major axis (published orbit solution).' : 'Mean semi-major axis (JPL SSD).'),
        fact('PERIOD', `${fmt(e.P, e.P < 10 ? 3 : 1)} DAYS`, 'measured', 'Sidereal period (JPL SSD).'),
        fact('ECCENTRICITY', fmt(e.e, 3), 'measured'),
        fact('INCLINATION', `${fmt(e.i, 1)}°${e.i > 90 ? ' · RETROGRADE' : ''}`, 'measured', e.frame === 'ecliptic' ? 'To the ecliptic.' : 'To the local Laplace plane (≈ the planet\'s equator for close moons).'),
        m.phaseUnknown ? fact('POSITION', 'ORBIT ONLY · PHASE ILLUSTRATIVE', 'imagined', 'Its orbit size, period and plane are measured, but where it is along the orbit right now is not computed here.') :
        fact('POSITION', m.id === 'moon' ? 'LUNAR THEORY' : 'MEAN ELEMENTS', 'computed', m.id === 'moon'
          ? 'Truncated ELP-2000/82 series (Meeus): within ~0.01° of JPL DE440.'
          : `JPL SSD mean elements with precession; phase fitted to JPL Horizons 2016–2036 (scatter ${e.fit?.rmsDeg ?? '?'}°).`),
      ],
      PHYSICAL: [...physicalFacts(m), ...(locked ? [fact('ROTATION', 'TIDALLY LOCKED', 'measured', 'Always shows the same face to its planet, so its day equals its orbit.')] : m.chaotic ? [fact('ROTATION', 'CHAOTIC TUMBLE', 'measured', 'Cassini found its spin changes unpredictably.')] : [fact('DAY', `${fmt(m.rotationHours, 2)} H`, 'measured')])],
      RENDERING: [...skinFacts(m), ...(m.id === 'moon' ? [fact('LIVE IMAGERY', 'NONE EXISTS', 'measured',
        'No spacecraft images the whole Moon every day, and its surface barely changes. The map is LRO\'s; the phase and lighting are live.')] : [])],
    },
  };
}

function smallBody(b) {
  const e = b.elements;
  const periodYears = 360 / meanMotion(e) / 365.25;
  const q = e.a * (1 - e.e), Q = e.a * (1 + e.e);
  return {
    id: b.id, name: b.name, kind: b.kind, radiusKm: b.radiusKm, massKg: b.massKg, meanTempC: b.meanTempC,
    rotationHours: b.rotationHours ?? 24, pole: b.pole, iau: b.iau, note: b.note ?? null, belt: b.belt, comet: b.comet ?? null,
    palette: ['#8f8a84', '#a9a39b', '#6f6a65'], skin: b.surfacePending && bodyVisualFor(b)?.surfaceMap ? { map: bodyVisualFor(b).surfaceMap.key } : b.skin, orbit: { type: 'elements', el: e, alt: b.altElements ?? null },
    facts: {
      ORBIT: [
        fact('REGION', b.belt, 'measured'),
        fact('ORBIT SIZE', `${fmt(e.a, 2)} AU · ${fmt(q, 2)}–${fmt(Q, 1)} AU`, 'measured', 'Semi-major axis, and closest–farthest from the Sun (JPL SBDB).'),
        fact('YEAR', `${fmt(periodYears, periodYears < 10 ? 2 : 0)} YEARS`, 'computed', "Kepler's third law."),
        fact('ECCENTRICITY', fmt(e.e, 3), 'measured'),
        fact('INCLINATION', `${fmt(e.i, 1)}°${e.i > 90 ? ' · RETROGRADE' : ''}`, 'measured', 'To the ecliptic.'),
        fact('POSITION', 'OSCULATING ORBIT', 'computed', `Two-body orbit from JPL SBDB elements at JD ${e.epochJd}; planetary tugs are ignored, so it drifts slowly away from that date.`),
      ],
      PHYSICAL: [...physicalFacts(b), fact('DAY', `${fmt(b.rotationHours, 2)} H`, 'measured', 'Rotation period from its light curve (JPL SBDB).')],
      RENDERING: skinFacts(b),
    },
  };
}

export function solSystem() {
  const bodies = [SUN, ...PLANETS].map((b) => ({ ...b, orbit: b.kind === 'star' ? null : { type: 'sol' }, facts: solFacts(b) }));
  bodies.push(...MOONS.map(moonBody), ...SMALL_BODIES.map(smallBody));
  // Points of interest: drawn by the System View's zone overlays; focusable like bodies.
  for (const r of REGIONS) bodies.push({ ...r, radiusKm: 1, marker: true, orbit: { type: 'anchor', anchor: r.anchor }, facts: { ...r.facts } });
  for (const c of SPACECRAFT) bodies.push({ ...c, parent: c.center, radiusKm: c.sizeKm, rotationHours: 1e9, orbit: { type: 'horizons', hz: c.horizons, center: c.center },
    facts: { MISSION: [
      fact('STATUS', c.status, 'measured'), fact('LAUNCHED', `${c.launched} · ${c.agency}`, 'measured'),
      fact('POSITION', 'JPL HORIZONS', 'computed', c.center ? `Reconstructed or predicted trajectory relative to ${c.center}, 10-minute steps.` : 'Reconstructed or predicted trajectory (JPL Horizons), daily steps.'),
    ], RENDERING: [modelFor(c.id) ? fact('MODEL', 'NASA MISSION MODEL', 'modelled', `${modelFor(c.id).credit}. Loaded on focus; a representative IMAGINED craft is shown while loading or on failure. The standalone preview embeds compact mission geometry. Inspection lighting is illustrative. ${modelFor(c.id).fidelity} ${modelFor(c.id).units} ${modelFor(c.id).frame}`) : fact('MODEL', 'REPRESENTATIVE', 'imagined', 'A generic spacecraft shape at the catalog size; not this craft\'s design.')] } });
  for (const l of LAGRANGE) bodies.push({ ...l, radiusKm: 1500, marker: true, orbit: { type: 'lagrange', pair: l.pair, L: l.L }, facts: { ...l.facts } });
  return {
    id: 'sol', name: 'Sol', isSol: true, sector: 'SECTOR 001', distLy: 0,
    subtitle: `SECTOR 001 · G2V MAIN-SEQUENCE STAR · 9 MAJOR BODIES · ${MOONS.length} MOONS · ${SMALL_BODIES.length} SMALL BODIES`,
    bodies, starId: 'sun', scale: 1, solDirection: null, planeNormal: [0, 1, 0],
    survey: [
      { label: 'INNER SYSTEM', au: 4.2 }, { label: 'OUTER SYSTEM', au: 80 }, { label: 'SCATTERED DISC', au: 260 },
      { label: 'EARTH & MOON', centre: 'earth', localKm: 420000 }, { label: 'MARS MOONS', centre: 'mars', localKm: 25000 },
      { label: 'JUPITER MOONS', centre: 'jupiter', localKm: 1.95e6 }, { label: 'SATURN MOONS', centre: 'saturn', localKm: 3.7e6 },
      { label: 'URANUS MOONS', centre: 'uranus', localKm: 6e5 }, { label: 'NEPTUNE MOONS', centre: 'neptune', localKm: 4e5 },
      { label: 'PLUTO & CHARON', centre: 'pluto', localKm: 22000 },
    ],
    notes: [],
  };
}

// ---- other stars ------------------------------------------------------------------------------

/**
 * Rough planet class from radius (Earth radii) and equilibrium temperature (K), with an
 * generated class illustration, guided by composition hypotheses. These maps are
 * IMAGINED; radius and temperature do not establish composition or cloud chemistry.
 */
export function planetClass(rEarth, teq) {
  if (rEarth < 1.6) {
    if (teq > 1000) return { label: 'LAVA WORLD', palette: ['#3a2a24', '#c2461f', '#6b3a2a'], skin: { map: 'exoLava' }, illustration: 'GENERATED CLASS ILLUSTRATION' };
    if (teq > 400) return { label: 'HOT ROCKY', palette: ['#8a6a55', '#a07a5f', '#5e4a3e'], skin: { map: 'exoHotRock' }, illustration: 'GENERATED CLASS ILLUSTRATION' };
    if (teq > 180) return { label: 'TEMPERATE ROCKY', palette: ['#7d7468', '#9a8f80', '#5f5850'], skin: { map: 'exoTemperate' }, illustration: 'GENERATED CLASS ILLUSTRATION' };
    return { label: 'ICY ROCKY', palette: ['#b9c2c9', '#8f9aa3', '#dfe6ea'], skin: { map: 'exoIce' }, illustration: 'GENERATED CLASS ILLUSTRATION' };
  }
  if (rEarth < 4) {
    return teq > 700 ? { label: 'HOT SUB-NEPTUNE', palette: ['#c9b38f', '#d8c6a5', '#b09572'], banded: true, skin: { map: 'exoSubNeptune', tint: [1.15, 0.95, 0.72] }, illustration: 'GENERATED CLASS ILLUSTRATION' }
      : { label: 'SUB-NEPTUNE', palette: ['#8fb3d9', '#a6c4e0', '#6f95c0'], banded: true, skin: { map: 'exoSubNeptune', tint: [1, 1, 1] }, illustration: 'GENERATED CLASS ILLUSTRATION' };
  }
  if (teq > 1000) return { label: 'HOT JUPITER', palette: ['#5b3b3b', '#8a4f3c', '#3f2a2a'], banded: true, skin: { map: 'exoHotJupiter' }, illustration: 'GENERATED CLASS ILLUSTRATION' };
  return teq < 150 ? { label: 'COLD GAS GIANT', palette: ['#e3d3a8', '#c9b27f', '#efe6c8'], banded: true, skin: { map: 'exoColdGiant', tint: [1, 1, 1] }, illustration: 'GENERATED CLASS ILLUSTRATION' }
    : { label: 'GAS GIANT', palette: ['#d8c3a5', '#b08a63', '#efe3cf', '#a36b45'], banded: true, skin: { map: 'exoGasGiant', tint: [1, 1, 1] }, illustration: 'GENERATED CLASS ILLUSTRATION' };
}

/** Radius from mass (Earth units), after Chen & Kipping (2017) power laws. */
export function radiusFromMass(mEarth) {
  if (mEarth < 2) return Math.pow(mEarth, 0.28);
  if (mEarth < 130) return 0.80 * Math.pow(mEarth, 0.59);
  return 12.1; // Jovian worlds are all roughly Jupiter-sized
}

// The archive's TAP service abbreviates discovery methods (e.g. "rv", "tran").
const METHODS = { rv: 'RADIAL VELOCITY', 'radial velocity': 'RADIAL VELOCITY', tran: 'TRANSIT', transit: 'TRANSIT', ima: 'IMAGING', imaging: 'IMAGING',
  micro: 'MICROLENSING', microlensing: 'MICROLENSING', ast: 'ASTROMETRY', astrometry: 'ASTROMETRY', ttv: 'TRANSIT TIMING VARIATIONS',
  'transit timing variations': 'TRANSIT TIMING VARIATIONS', etv: 'ECLIPSE TIMING VARIATIONS', 'eclipse timing variations': 'ECLIPSE TIMING VARIATIONS',
  pul: 'PULSAR TIMING', 'pulsar timing': 'PULSAR TIMING', obm: 'BRIGHTNESS MODULATION', 'orbital brightness modulation': 'BRIGHTNESS MODULATION',
  dkin: 'DISK KINEMATICS', 'disk kinematics': 'DISK KINEMATICS', ptv: 'PULSATION TIMING', 'pulsation timing variations': 'PULSATION TIMING' };
export const discoveryMethod = (m) => METHODS[String(m).toLowerCase()] ?? String(m).toUpperCase();

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };

/** Mean anomaly at `epochJd` that puts the planet in front of its star (as seen from Sol) at transit. */
export function transitMeanAnomaly(e, omegaRad) {
  const nu = -omegaRad; // transit when ω + ν = 0 in our plane frame (+x points at Sol)
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  return E - e * Math.sin(E);
}

// ---- stars ---------------------------------------------------------------------------------

/** One star body. `m` = { star, host } from the API; `measured` = ORB6/literature values for it. */
function starBody(m, measured = {}) {
  const { star: s, host } = m;
  const p = measured.props ?? {};
  const t = p.teff ? { teff: p.teff, how: 'measured' } : starTeff({ teff: host?.st_teff, ci: s.ci, spect: s.spect || host?.st_spectype });
  const lum = host?.st_lum != null ? 10 ** host.st_lum : s.lum; // archive gives log10(L/Lsun)
  let radiusSun = p.radiusSun ?? host?.st_rad, radiusTier = 'computed';
  let radiusNote = p.radiusSun ? `${measured.ref}.` : 'Exoplanet Archive (stellar models fitted to observations).';
  if (p.radiusSun && p.whiteDwarf) radiusNote = `${measured.ref}. A white dwarf: about Earth-sized, with roughly the Sun's mass.`;
  if (p.brownDwarf) { radiusTier = 'modelled'; radiusNote = 'Evolutionary models: every brown dwarf is about the size of Jupiter, whatever its mass.'; }
  if (!radiusSun) {
    radiusSun = lum ? Math.sqrt(lum) * (5772 / t.teff) ** 2 : 1;
    radiusTier = lum ? 'computed' : 'imagined';
    radiusNote = lum ? 'From luminosity and temperature (Stefan–Boltzmann).' : 'Unknown; drawn Sun-sized.';
  }
  let massSun = measured.mass ?? host?.st_mass ?? (p.brownDwarf ? 0.005 : null), massTier = measured.mass ? 'measured' : p.brownDwarf ? 'modelled' : 'computed';
  let massNote = measured.mass ? `Dynamical mass from the binary orbit (${measured.ref}).` : 'Exoplanet Archive.';
  if (!massSun) {
    massSun = lum ? Math.max(0.08, Math.pow(lum, 1 / 3.5)) : 1;
    massTier = lum ? 'modelled' : 'imagined';
    massNote = lum ? 'Main-sequence mass–luminosity relation (L ∝ M^3.5).' : 'Unknown; assumed one solar mass.';
  }
  const spect = p.spect || s.spect || host?.st_spectype || '—';
  const bd = !!p.brownDwarf;
  const massFact = bd
    ? fact('MASS', `${typeof p.massJup === 'number' ? fmt(p.massJup, 1) : p.massJup ?? '?'} × JUPITER`, measured.mass ? 'measured' : 'modelled',
      measured.mass ? `Astrometric mass from the binary orbit (${measured.ref}). Below ~75 Jupiters a body never fuses ordinary hydrogen.` : `${measured.ref ?? 'Models'}: from its temperature and an assumed age.`)
    : fact('MASS', `${fmt(massSun, 3)} × SUN`, massTier, massNote);
  const body = {
    id: s.id, name: s.name, kind: p.whiteDwarf ? 'white dwarf' : bd ? 'brown dwarf' : 'star', starLike: true,
    radiusKm: radiusSun * R_SUN_KM, rotationHours: 600,
    // Below ~1000 K almost nothing is emitted in visible light: draw a dim ember.
    color: bd && t.teff < 1000 ? 0x5a1c1c : rgbToHex(blackbodyRGB(t.teff)), spectral: spect, teffK: Math.round(t.teff), massSun, lum,
    metallicity: host?.st_met ?? null, catalog: s, massJup: bd ? p.massJup ?? null : null,
    // Brown dwarfs are banded, cloudy balls more like Jupiter than the Sun.
    skin: { recolour: true }, banded: bd,
    note: p.note ?? null,
    facts: {
      PHYSICAL: [
        fact('CLASS', spect, spect === '—' ? 'imagined' : 'measured', p.whiteDwarf ? 'White dwarf spectral class.' : bd ? 'Brown dwarf class: L (dusty clouds), T (methane), Y (the coldest, water clouds).' : 'Spectral type.'),
        fact('SURFACE TEMP', `${fmt(t.teff, 0)} K`, t.how === 'measured' ? 'measured' : t.how === 'unknown' ? 'imagined' : 'computed',
          t.how === 'measured' ? (p.teff ? `${measured.ref}.` : 'Exoplanet Archive.') : `Estimated from ${t.how}.`),
        fact('RADIUS', `${fmt(radiusSun, radiusSun < 0.1 ? 4 : 3)} × SUN · ${fmt(radiusSun * R_SUN_KM, 0)} KM`, radiusTier, radiusNote),
        massFact,
        ...(lum ? [fact('LUMINOSITY', `${fmt(lum, lum < 0.01 ? 5 : 3)} × SUN`, 'computed', 'From brightness and parallax distance.')] : []),
        fact('DISTANCE FROM SOL', `${fmt(s.distLy, 2)} LY`, 'measured', 'Parallax.'),
      ],
      RENDERING: [
        bd ? fact('COLOUR', t.teff < 1000 ? 'ALMOST INVISIBLE' : 'DEEP RED-MAGENTA', 'computed', t.teff < 1000
          ? 'At this temperature it glows almost only in the infrared: to the eye it would be nearly black. Drawn as a dim ember so you can find it.'
          : 'Sodium and potassium absorb the yellow-green, so L/T dwarfs would look dull red to magenta.')
          : fact('COLOUR', 'BLACKBODY', 'computed', 'Colour of a blackbody at the surface temperature.'),
        fact('SURFACE', 'GENERIC PLACEHOLDER · BESPOKE QUEUED', 'imagined', 'Independent procedural illustration. Photospheric or cloud features are unmeasured; individual researched imagery is queued.'),
      ],
    },
  };
  const visual = bodyVisualFor(body);
  if (visual?.kind === 'star' && visual.surfaceMap) {
    body.skin.map = visual.surfaceMap.key;
    body.facts.RENDERING[1] = fact('SURFACE', 'INDIVIDUAL PHOTOSPHERE HYPOTHESIS', 'imagined', visual.assumed.join(' '));
  }
  return body;
}

// ---- planets -------------------------------------------------------------------------------

/** Orbital-plane frame for a host's planets: +u towards Sol (so transits line up), n the normal. */
function planeFrame(host, transiting) {
  const toSol = frameToScene(eqToEcl(norm([-host.x, -host.y, -host.z])));
  if (!transiting) return { toSol, n: [0, 1, 0], u: norm([1, 0, 0]), tier: 'imagined',
    note: 'Orbit orientation is unknown for planets that do not transit; drawn in the ecliptic plane.' };
  const up = Math.abs(toSol[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const n = norm(cross(toSol, up));
  return { toSol, n, u: toSol, tier: 'computed',
    note: 'Planets transit, so we see the orbits edge-on from Sol; the orbit plane contains our line of sight. Its roll about that line is unknown.' };
}

function planetBodies(rows, star, idFor, notes) {
  const massSun = star.massSun, lum = star.lum;
  const transiting = rows.some((r) => r.tran_flag === 1);
  const plane = planeFrame(star.catalog, transiting);
  const basis = { u: plane.u, n: plane.n, v: cross(plane.n, plane.u) };
  const planets = rows.slice().sort((a, b) => (a.pl_orbper ?? 1e9) - (b.pl_orbper ?? 1e9)).map((r) => {
    const facts = { ORBIT: [], PHYSICAL: [], DISCOVERY: [], RENDERING: [] };
    // period & semi-major axis (Kepler's third law fills whichever is missing)
    let P = r.pl_orbper, a = r.pl_orbsmax;
    if (!a && P) a = Math.cbrt(massSun * (P / 365.25) ** 2);
    if (!P && a) P = 365.25 * Math.sqrt(a ** 3 / massSun);
    if (!a) { a = 0.05; P = 365.25 * Math.sqrt(a ** 3 / massSun); notes.push(`${r.pl_name}: orbit unknown, drawn at 0.05 AU.`); }
    facts.ORBIT.push(fact('PERIOD', `${fmt(P, P < 10 ? 3 : 1)} DAYS`, r.pl_orbper ? 'measured' : 'computed', r.pl_orbper ? '' : "Kepler's third law from the orbit size."));
    facts.ORBIT.push(fact('ORBIT SIZE', `${fmt(a, 4)} AU`, 'computed', "Semi-major axis, from the period and the star's mass (Kepler's third law)."));
    const e = r.pl_orbeccen ?? 0;
    facts.ORBIT.push(fact('ECCENTRICITY', fmt(e, 3), r.pl_orbeccen != null ? 'measured' : 'imagined', r.pl_orbeccen != null ? '' : 'Unknown; assumed circular.'));
    const omega = (r.pl_orblper ?? 0) * DEG;
    let M0, epochJd, phaseTier, phaseNote;
    if (r.tran_flag === 1 && r.pl_tranmid) {
      M0 = transitMeanAnomaly(e, omega); epochJd = r.pl_tranmid;
      phaseTier = 'computed'; phaseNote = 'Phase from measured transit times; error grows the further you run the clock from the observations.';
    } else {
      M0 = hash(r.pl_name) * 2 * Math.PI; epochJd = 2451545;
      phaseTier = 'imagined'; phaseNote = 'Where the planet is along its orbit is unknown; position along the orbit is illustrative.';
    }
    facts.ORBIT.push(fact('POSITION IN ORBIT', phaseTier === 'computed' ? 'FROM TRANSITS' : 'UNKNOWN', phaseTier, phaseNote));
    facts.ORBIT.push(fact('ORBIT PLANE', transiting ? 'EDGE-ON TO SOL' : 'UNKNOWN', r.tran_flag === 1 ? plane.tier : transiting ? 'modelled' : 'imagined',
      r.tran_flag === 1 ? plane.note : transiting ? 'Assumed coplanar with the transiting planets.' : plane.note));

    let rE = r.pl_rade, rTier = 'measured', rNote = 'Measured from the transit depth.';
    if (r.tran_flag !== 1 && rE) { rTier = 'modelled'; rNote = 'Not measured: the archive estimates it from the mass with a mass–radius relation.'; }
    if (!rE && r.pl_bmasse) { rE = radiusFromMass(r.pl_bmasse); rTier = 'modelled'; rNote = 'Estimated from mass (Chen & Kipping 2017).'; }
    if (!rE) { rE = 1; rTier = 'imagined'; rNote = 'Unknown; drawn Earth-sized.'; }
    facts.PHYSICAL.push(fact('RADIUS', `${fmt(rE, 2)} × EARTH · ${fmt(rE * R_EARTH_KM, 0)} KM`, rTier, rNote));
    if (r.pl_bmasse) {
      const prov = r.pl_bmassprov || '';
      const minimum = /sini/i.test(prov);
      const fromR = /M-R/i.test(prov);
      facts.PHYSICAL.push(fact(minimum ? 'MINIMUM MASS' : 'MASS', `${fmt(r.pl_bmasse, 2)} × EARTH`, fromR ? 'modelled' : 'measured',
        minimum ? 'M·sin i from radial velocity: the true mass is at least this.' : fromR ? 'Estimated from the radius.' : 'Measured.'));
    }
    let teq = r.pl_eqt, tNote = 'Exoplanet Archive.';
    if (!teq && lum) { teq = 278.6 * Math.pow(lum, 0.25) / Math.sqrt(a); tNote = 'From the star\'s luminosity and orbit size, zero albedo.'; }
    if (teq) facts.PHYSICAL.push(fact('EQUILIBRIUM TEMP', `${fmt(teq, 0)} K · ${fmt(teq - 273.15, 0)} °C`, 'computed', `${tNote} Ignores atmosphere and greenhouse effects.`));
    if (r.pl_insol) facts.PHYSICAL.push(fact('STARLIGHT', `${fmt(r.pl_insol, 2)} × EARTH`, 'computed', 'Insolation relative to what Earth receives.'));
    const cls = planetClass(rE, teq ?? 300);
    const bespoke = bodyVisualFor({ name: r.pl_name });
    const skin = bespoke?.surfaceMap ? { map: bespoke.surfaceMap.key } : cls.skin;
    if (r.disc_method) facts.DISCOVERY.push(fact('METHOD', discoveryMethod(r.disc_method), 'measured'));
    if (r.disc_year) facts.DISCOVERY.push(fact('YEAR', String(r.disc_year), 'measured'));
    if (r.disc_facility) facts.DISCOVERY.push(fact('FACILITY', r.disc_facility.toUpperCase(), 'measured'));
    facts.RENDERING.push(fact('APPEARANCE', cls.label, 'imagined', 'No resolved surface map exists; its illustrative class is inferred from size and temperature.'));
    facts.RENDERING.push(fact('SKIN', bespoke?.surfaceMap ? 'BESPOKE RESEARCHED HYPOTHESIS' : cls.illustration, 'imagined', bespoke?.surfaceMap ? [...bespoke.measured, ...bespoke.assumed, ...bespoke.unknown].join(' ') : 'Generated class illustration guided by radius and temperature. Composition, clouds, colours and terrain are hypotheses; no resolved surface features are measured.'));
    return {
      id: idFor(r), name: r.pl_name, kind: 'exoplanet', radiusKm: rE * R_EARTH_KM, rotationHours: 30, host: star.id,
      massKg: r.pl_bmasse ? r.pl_bmasse * M_EARTH_KG : null, radiusEarth: rE, massEarth: r.pl_bmasse ?? null, teq,
      massIsMinimum: /sini/i.test(r.pl_bmassprov || ''), radiusMeasured: rTier === 'measured',
      palette: cls.palette, banded: !!cls.banded, skin, planetClass: cls.label,
      orbit: { type: 'kepler', host: star.id, a, e, omega, periodDays: P, M0, epochJd, basis }, facts,
    };
  });
  return { planets, transiting, plane };
}

// ---- systems -------------------------------------------------------------------------------

const MULTIPLICITY = ['', 'SINGLE STAR', 'BINARY STAR', 'TRIPLE STAR', 'QUADRUPLE STAR'];

/**
 * Build a system model from /api/stars/:id: { star, host, planets, group? } where planets
 * are NASA Exoplanet Archive pscomppars rows and `group` lists every star of a multiple
 * system with its ORB6 orbits.
 */
export function buildStarSystem(detail) {
  const notes = [];
  const members = detail.group?.members ?? [{ star: detail.star, host: detail.host, planets: detail.planets }];
  const orbitRows = detail.group?.orbits ?? [];

  // component letters and literature values for each member
  const letterOf = {}, measuredOf = {};
  for (const o of orbitRows) {
    letterOf[o.primaryId] ??= o.letters[0];
    letterOf[o.secondaryId] ??= o.letters[1];
    for (const [id, l] of [[o.primaryId, o.letters[0]], [o.secondaryId, o.letters[1]]]) {
      if (o.measured?.mass?.[l] != null && !measuredOf[id]) measuredOf[id] = { mass: o.measured.mass[l], props: o.measured.props?.[l], ref: o.measured.ref };
      else if (o.measured?.props?.[l] && !measuredOf[id]) measuredOf[id] = { props: o.measured.props[l], ref: o.measured.ref };
    }
  }

  // stars: the requested one first
  const ordered = [...members].sort((a, b) => (a.star.id === detail.star.id ? -1 : b.star.id === detail.star.id ? 1 : 0));
  if (detail.measured && !measuredOf[detail.star.id]) measuredOf[detail.star.id] = detail.measured;
  const stars = ordered.map((m) => starBody(m, measuredOf[m.star.id]));
  for (const st of stars) if (st.note) notes.push(`${st.name}: ${st.note}`);
  const starById = Object.fromEntries(stars.map((s) => [s.id, s]));

  // planets, keyed by letter when only one star has planets (keeps routes like /hyg-70666/b)
  const hostsWithPlanets = ordered.filter((m) => m.planets.length);
  const planets = [];
  let focusPlane = null;
  for (const m of hostsWithPlanets) {
    const host = starById[m.star.id];
    const prefix = hostsWithPlanets.length > 1 ? `${(letterOf[m.star.id] || host.name.split(' ').pop()).toLowerCase()}-` : '';
    const out = planetBodies(m.planets, host, (r) => `${prefix}${(r.pl_letter || r.pl_name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, notes);
    planets.push(...out.planets);
    if (m.star.id === detail.star.id || !focusPlane) focusPlane = out;
  }
  if (!planets.length) notes.push('No planets are known here. That is not the same as none existing: most planet searches would miss small or long-period worlds around this star.');

  // binary orbits in scene coordinates, with each star's mass for the barycentre split
  const toScene = (v) => frameToScene(eqToEcl(v));
  const binary = orbitRows.length ? {
    orbits: orbitRows.map((o) => {
      const P = starById[o.primaryId].catalog;
      const ra = Math.atan2(P.y, P.x), dec = Math.asin(P.z / P.distPc);
      const b = { r: [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)],
        n: [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)], e: [-Math.sin(ra), Math.cos(ra), 0] };
      return { ...o, primary: o.primaryId, secondary: o.secondaryId, distPc: P.distPc,
        basis: { n: toScene(b.n), e: toScene(b.e), r: toScene(b.r) } };
    }),
    mass: Object.fromEntries(stars.map((s) => [s.id, s.massSun])),
  } : null;

  // orbit facts on each star
  for (const o of binary?.orbits ?? []) {
    const aAU = o.aArcsec * o.distPc;
    const dyn = aAU ** 3 / o.periodYears ** 2;
    const pair = `${starById[o.primary].name} + ${starById[o.secondary].name}`;
    const rows = [
      fact('PAIR', pair.toUpperCase(), 'measured', `${o.wds} ${o.designation}`),
      fact('PERIOD', o.periodYears > 1000 ? `${fmt(o.periodYears, 0)} YEARS` : `${fmt(o.periodYears, 2)} YEARS`, 'measured', `ORB6, ${o.ref}. Orbit grade ${o.grade} (1 = definitive, 5 = indeterminate).`),
      fact('SEMI-MAJOR AXIS', `${fmt(o.aArcsec, 3)}″ · ${fmt(aAU, aAU < 100 ? 2 : 0)} AU`, 'measured', 'Angular size from ORB6, scaled by the parallax distance.'),
      fact('ECCENTRICITY', fmt(o.e, 3), 'measured', 'ORB6.'),
      fact('INCLINATION', `${fmt(o.i, 1)}°`, 'measured', 'Relative to the plane of the sky. Which side is nearer to us is ambiguous without radial velocities.'),
      fact('DYNAMICAL MASS', `${fmt(dyn, 2)} × SUN`, 'computed', "Total mass from Kepler's third law (a³/P²)."),
    ];
    for (const id of [o.primary, o.secondary]) (starById[id].facts.ORBIT ??= []).push(...rows);
  }

  const focus = starById[detail.star.id];
  const aMin = planets.length ? Math.min(...planets.map((p) => p.orbit.a)) : null;
  // Binary stars: in ENHANCED mode, draw the stars large enough to see against their orbit
  // (the biggest ≈ 4% of the tightest stellar orbit, at most 15% of its closest approach), keeping
  // their size order (companions at least half the biggest) and never growing a star past a
  // quarter of its innermost planet's orbit.
  const sysScale = aMin ? Math.min(1, Math.max(0.02, aMin / 0.387)) : 1;
  const binAU = binary?.orbits?.length ? Math.min(...binary.orbits.map((o) => Math.min(0.04, 0.15 * (1 - o.e)) * o.aArcsec * o.distPc)) : null;
  if (binAU) {
    const base = (b) => (sysScale < 1 ? 0.045 : 0.07) * Math.pow(b.radiusKm / 695700, 0.4) * sysScale;
    const biggest = Math.max(...stars.map(base)), boost = binAU / biggest;
    for (const st of stars) {
      const own = planets.filter((p) => p.host === st.id).map((p) => p.orbit.a);
      const cap = own.length ? (0.25 * Math.min(...own)) / base(st) : Infinity;
      // a white dwarf or brown dwarf companion is shown smaller, but never below half the biggest
      const floor = (0.5 * binAU) / base(st);
      st.sizeBoost = Math.max(1, Math.min(Math.max(boost, floor), cap));
    }
  }
  const survey = [];
  const focusPlanets = planets.filter((p) => p.host === focus.id);
  if (focusPlanets.length) {
    const aMax = Math.max(...focusPlanets.map((p) => p.orbit.a));
    survey.push({ label: 'PLANETS', au: aMax * 3.2, centre: focus.id });
    if (focusPlanets.length > 3) survey.push({ label: 'INNER PLANETS', au: focusPlanets[1].orbit.a * 3.2, centre: focus.id });
  }
  for (const o of [...(binary?.orbits ?? [])].sort((a, b) => a.periodYears - b.periodYears)) {
    survey.push({ label: `${o.letters.join('–')} ORBIT`, au: o.aArcsec * o.distPc * (1 + o.e) * 2.6, centre: o.primary });
  }
  if (!survey.length) survey.push({ label: 'STAR', au: Math.max((focus.radiusKm / AU_KM) * 40, 0.02), centre: focus.id });

  const n = stars.length;
  const s = detail.star;
  return {
    id: s.id, name: s.name, isSol: false, distLy: s.distLy,
    subtitle: `${fmt(s.distLy, 2)} LY FROM SOL · ${n > 1 ? `${MULTIPLICITY[n] ?? `${n}-STAR`} SYSTEM · ` : ''}${focus.spectral.toUpperCase()} · ${planets.length || 'NO'} KNOWN PLANET${planets.length === 1 ? '' : 'S'}`,
    bodies: [...stars, ...planets], starId: focus.id, stars: stars.map((x) => x.id),
    // Enhanced sizes are relative to the system: shrink everything for compact systems like TRAPPIST-1.
    scale: sysScale,
    solDirection: focusPlane?.plane.toSol ?? frameToScene(eqToEcl(norm([-s.x, -s.y, -s.z]))),
    planeNormal: focusPlane?.plane.n ?? [0, 1, 0],
    transiting: !!focusPlane?.transiting,
    binary, multiplicity: n, groupSource: detail.group?.source ?? null,
    survey, notes, source: s.source,
  };
}
