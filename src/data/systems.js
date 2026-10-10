// System models: one shape for Sol and for any other star, so the System View and the
// info panel don't care which system they show. Every displayed fact carries a
// provenance tier (see provenance.js) and a short note on where it came from.

import { AU_KM, SUN, PLANETS } from './sol.js';
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
  return {
    PHYSICAL: phys,
    RENDERING: [fact('APPEARANCE', 'STYLISED', 'imagined', 'Colours are stand-ins; Planet View will load NASA imagery.')],
  };
}

export function solSystem() {
  const bodies = [SUN, ...PLANETS].map((b) => ({ ...b, orbit: b.kind === 'star' ? null : { type: 'sol' }, facts: solFacts(b) }));
  return {
    id: 'sol', name: 'Sol', isSol: true, sector: 'SECTOR 001', distLy: 0,
    subtitle: 'SECTOR 001 · G2V MAIN-SEQUENCE STAR · 9 MAJOR BODIES',
    bodies, starId: 'sun', scale: 1, solDirection: null, planeNormal: [0, 1, 0],
    survey: [{ label: 'INNER SYSTEM', au: 4.2 }, { label: 'OUTER SYSTEM', au: 80 }],
    notes: [],
  };
}

// ---- other stars ------------------------------------------------------------------------------

/** Rough planet class from radius (Earth radii) and equilibrium temperature (K). */
export function planetClass(rEarth, teq) {
  if (rEarth < 1.6) {
    if (teq > 1000) return { label: 'LAVA WORLD', palette: ['#3a2a24', '#c2461f', '#6b3a2a'] };
    if (teq > 400) return { label: 'HOT ROCKY', palette: ['#8a6a55', '#a07a5f', '#5e4a3e'] };
    if (teq > 180) return { label: 'TEMPERATE ROCKY', palette: ['#7d7468', '#9a8f80', '#5f5850'] };
    return { label: 'ICY ROCKY', palette: ['#b9c2c9', '#8f9aa3', '#dfe6ea'] };
  }
  if (rEarth < 4) {
    return teq > 700 ? { label: 'HOT SUB-NEPTUNE', palette: ['#c9b38f', '#d8c6a5', '#b09572'], banded: true }
      : { label: 'SUB-NEPTUNE', palette: ['#8fb3d9', '#a6c4e0', '#6f95c0'], banded: true };
  }
  return teq > 1000 ? { label: 'HOT JUPITER', palette: ['#5b3b3b', '#8a4f3c', '#3f2a2a'], banded: true }
    : { label: 'GAS GIANT', palette: ['#d8c3a5', '#b08a63', '#efe3cf', '#a36b45'], banded: true };
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

/**
 * Build a system model from /api/stars/:id. `detail` = { star, host, planets[] } where
 * planets are NASA Exoplanet Archive pscomppars rows.
 */
export function buildStarSystem(detail) {
  const { star: s, host, planets: rows } = detail;
  const notes = [];

  // ---- star ----
  const t = starTeff({ teff: host?.st_teff, ci: s.ci, spect: s.spect || host?.st_spectype });
  const lum = host?.st_lum != null ? 10 ** host.st_lum : s.lum; // archive gives log10(L/Lsun)
  let radiusSun = host?.st_rad, radiusTier = 'computed', radiusNote = 'Exoplanet Archive (stellar models fitted to observations).';
  if (!radiusSun) {
    radiusSun = lum ? Math.sqrt(lum) * (5772 / t.teff) ** 2 : 1;
    radiusTier = lum ? 'computed' : 'imagined';
    radiusNote = lum ? 'From luminosity and temperature (Stefan–Boltzmann).' : 'Unknown; drawn Sun-sized.';
  }
  let massSun = host?.st_mass, massTier = 'computed', massNote = 'Exoplanet Archive.';
  if (!massSun) {
    massSun = lum ? Math.max(0.08, Math.pow(lum, 1 / 3.5)) : 1;
    massTier = lum ? 'modelled' : 'imagined';
    massNote = lum ? 'Main-sequence mass–luminosity relation (L ∝ M^3.5).' : 'Unknown; assumed one solar mass.';
  }
  const starColor = rgbToHex(blackbodyRGB(t.teff));
  const spect = s.spect || host?.st_spectype || '—';
  const starBody = {
    id: 'star', name: s.name, kind: 'star', radiusKm: radiusSun * R_SUN_KM, rotationHours: 600,
    color: starColor, spectral: spect, teffK: Math.round(t.teff),
    facts: {
      PHYSICAL: [
        fact('CLASS', spect, spect === '—' ? 'imagined' : 'measured', 'Spectral type.'),
        fact('SURFACE TEMP', `${fmt(t.teff, 0)} K`, t.how === 'measured' ? 'measured' : t.how === 'unknown' ? 'imagined' : 'computed',
          t.how === 'measured' ? 'Exoplanet Archive.' : `Estimated from ${t.how}.`),
        fact('RADIUS', `${fmt(radiusSun, 3)} × SUN · ${fmt(radiusSun * R_SUN_KM, 0)} KM`, radiusTier, radiusNote),
        fact('MASS', `${fmt(massSun, 3)} × SUN`, massTier, massNote),
        ...(lum ? [fact('LUMINOSITY', `${fmt(lum, lum < 0.01 ? 5 : 3)} × SUN`, 'computed', 'From brightness and parallax distance.')] : []),
        fact('DISTANCE FROM SOL', `${fmt(s.distLy, 2)} LY`, 'measured', 'Parallax.'),
      ],
      RENDERING: [fact('COLOUR', 'BLACKBODY', 'computed', 'Colour of a blackbody at the surface temperature.')],
    },
  };

  // ---- orientation ----
  const toSol = frameToScene(eqToEcl(norm([-s.x, -s.y, -s.z]))); // direction from the star to Sol, scene frame
  const transiting = rows.some((r) => r.tran_flag === 1);
  let planeNormal, planeTier, planeNote;
  if (transiting) {
    const up = Math.abs(toSol[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    planeNormal = norm(cross(toSol, up));
    planeTier = 'computed';
    planeNote = 'Planets transit, so we see the orbits edge-on from Sol; the orbit plane contains our line of sight. Its roll about that line is unknown.';
  } else {
    planeNormal = [0, 1, 0];
    planeTier = 'imagined';
    planeNote = 'Orbit orientation is unknown for planets that do not transit; drawn in the ecliptic plane.';
  }

  // ---- planets ----
  const planets = rows
    .slice()
    .sort((a, b) => (a.pl_orbper ?? 1e9) - (b.pl_orbper ?? 1e9))
    .map((r) => {
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
      facts.ORBIT.push(fact('ORBIT PLANE', transiting ? 'EDGE-ON TO SOL' : 'UNKNOWN', r.tran_flag === 1 ? planeTier : transiting ? 'modelled' : 'imagined',
        r.tran_flag === 1 ? planeNote : transiting ? 'Assumed coplanar with the transiting planets.' : planeNote));

      // size & mass
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
      if (r.disc_method) facts.DISCOVERY.push(fact('METHOD', discoveryMethod(r.disc_method), 'measured'));
      if (r.disc_year) facts.DISCOVERY.push(fact('YEAR', String(r.disc_year), 'measured'));
      if (r.disc_facility) facts.DISCOVERY.push(fact('FACILITY', r.disc_facility.toUpperCase(), 'measured'));
      facts.RENDERING.push(fact('APPEARANCE', cls.label, 'imagined', 'No image of this planet exists; its look is inferred from size and temperature.'));

      const id = (r.pl_letter || r.pl_name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        id, name: r.pl_name, kind: 'exoplanet', radiusKm: rE * R_EARTH_KM, rotationHours: 30,
        massKg: r.pl_bmasse ? r.pl_bmasse * M_EARTH_KG : null, palette: cls.palette, banded: !!cls.banded,
        orbit: { type: 'kepler', a, e, omega, periodDays: P, M0, epochJd }, facts,
      };
    });

  if (!rows.length) notes.push('No planets are known here. That is not the same as none existing: most planet searches would miss small or long-period worlds around this star.');

  const aMin = planets.length ? Math.min(...planets.map((p) => p.orbit.a)) : null;
  const aMax = planets.length ? Math.max(...planets.map((p) => p.orbit.a)) : null;
  const starAU = starBody.radiusKm / AU_KM;
  const survey = planets.length
    ? [{ label: 'WHOLE SYSTEM', au: aMax * 3.2 }, ...(planets.length > 3 ? [{ label: 'INNER PLANETS', au: planets[1].orbit.a * 3.2 }] : [])]
    : [{ label: 'STAR', au: Math.max(starAU * 40, 0.02) }];

  return {
    id: s.id, name: s.name, isSol: false, distLy: s.distLy,
    subtitle: `${fmt(s.distLy, 2)} LY FROM SOL · ${spect.toUpperCase()} · ${planets.length || 'NO'} KNOWN PLANET${planets.length === 1 ? '' : 'S'}`,
    bodies: [starBody, ...planets], starId: 'star',
    // Enhanced sizes are relative to the system: shrink everything for compact systems like TRAPPIST-1.
    scale: aMin ? Math.min(1, Math.max(0.02, aMin / 0.387)) : 1,
    solDirection: toSol, planeNormal, transiting,
    survey, notes, source: s.source,
    massSun,
  };
}
