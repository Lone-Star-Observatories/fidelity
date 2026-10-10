// Spectra for the detail views, fetched on demand and cached:
//   - Sol bodies: a MODELLED spectrum from NASA GSFC's Planetary Spectrum Generator (PSG;
//     Villanueva et al. 2018, 2022) with the body's own atmosphere template, as seen from Earth
//     on the given month (reflected sunlight plus thermal emission, 0.3–30 µm).
//   - Stars: the star's own MEASURED Gaia DR3 BP/RP (XP) spectrum, 336–1020 nm, found through
//     SIMBAD's cross-identification (Gaia Collaboration, De Angeli et al. 2023).
//   - Exoplanets: MEASURED transmission, eclipse and direct-imaging spectra from the NASA
//     Exoplanet Archive's Atmospheric Spectroscopy table.

import { cached } from './cache.js';
import { simbadAt } from './lookup.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const DAY = 86400000;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const upstream = (msg) => Object.assign(new Error(msg), { status: 502 });

// ---- PSG: Sol bodies --------------------------------------------------------------------------
// PSG object class and name per app body id. Earth is seen from the Moon.
const PSG_BODIES = {
  mercury: ['Planet', 'Mercury'], venus: ['Planet', 'Venus'], earth: ['Planet', 'Earth'], mars: ['Planet', 'Mars'],
  jupiter: ['Planet', 'Jupiter'], saturn: ['Planet', 'Saturn'], uranus: ['Planet', 'Uranus'], neptune: ['Planet', 'Neptune'], pluto: ['Planet', 'Pluto'],
  moon: ['Moon', 'Moon'], io: ['Moon', 'Io'], europa: ['Moon', 'Europa'], ganymede: ['Moon', 'Ganymede'], callisto: ['Moon', 'Callisto'],
  titan: ['Moon', 'Titan'], enceladus: ['Moon', 'Enceladus'], triton: ['Moon', 'Triton'], charon: ['Moon', 'Charon'],
  rhea: ['Moon', 'Rhea'], dione: ['Moon', 'Dione'], tethys: ['Moon', 'Tethys'], iapetus: ['Moon', 'Iapetus'], mimas: ['Moon', 'Mimas'],
  titania: ['Moon', 'Titania'], oberon: ['Moon', 'Oberon'], ariel: ['Moon', 'Ariel'], umbriel: ['Moon', 'Umbriel'], miranda: ['Moon', 'Miranda'],
  phobos: ['Moon', 'Phobos'], deimos: ['Moon', 'Deimos'],
  ceres: ['Asteroid', 'Ceres'], vesta: ['Asteroid', 'Vesta'], pallas: ['Asteroid', 'Pallas'], eris: ['Asteroid', 'Eris'], makemake: ['Asteroid', 'Makemake'],
  haumea: ['Asteroid', 'Haumea'],
};
export const psgBodies = () => Object.keys(PSG_BODIES);

export function psgConfig(id, month) {
  const [cls, name] = PSG_BODIES[id];
  return [
    `<OBJECT>${cls}`, `<OBJECT-NAME>${name}`, `<OBJECT-DATE>${month.replace('-', '/')}/15 00:00`,
    '<GEOMETRY>Observatory', id === 'earth' ? '<GEOMETRY-REF>Moon' : '<GEOMETRY-REF>Earth',
    '<GENERATOR-RANGE1>0.3', '<GENERATOR-RANGE2>30', '<GENERATOR-RANGEUNIT>um',
    '<GENERATOR-RESOLUTION>150', '<GENERATOR-RESOLUTIONUNIT>RP', '<GENERATOR-RADUNITS>Wsrm2um',
    '<GENERATOR-GAS-MODEL>Y', '<GENERATOR-CONT-MODEL>Y', '<GENERATOR-CONT-STELLAR>Y', '<GENERATOR-TRANS-APPLY>N',
  ].join('\n');
}

/** Parse PSG's text output: '# Wave/freq Total …' header, then whitespace columns. */
export function parsePsg(text) {
  const lines = text.split('\n');
  const head = lines.find((l) => /^#\s*Wave\/freq/i.test(l));
  const cols = head ? head.replace(/^#\s*/, '').split(/\s+/).map((c) => c.toLowerCase()) : ['wave/freq', 'total'];
  const data = Object.fromEntries(cols.map((c) => [c, []]));
  for (const l of lines) {
    if (!l || l[0] === '#') continue;
    const v = l.trim().split(/\s+/).map(Number);
    if (v.length < 2 || !Number.isFinite(v[0])) continue;
    cols.forEach((c, i) => data[c].push(v[i] ?? null));
  }
  const errors = lines.filter((l) => /ERROR/i.test(l)).map((l) => l.replace(/^#\s*/, '').trim());
  return { wavelengthUm: data['wave/freq'], total: data.total, reflected: data.reflected ?? null, thermal: data.thermal ?? null, errors };
}

/** GET /api/psg?body=&month=YYYY-MM */
export async function psgSpectrum(body, month) {
  if (!PSG_BODIES[body]) throw Object.assign(new Error(`no PSG template for ${body}`), { status: 404 });
  if (!/^\d{4}-\d{2}$/.test(month)) throw bad('month must be YYYY-MM');
  const { value, cache } = await cached('psg', `v1-${body}-${month}`, 120 * DAY, async () => {
    const form = new URLSearchParams({ file: psgConfig(body, month), type: 'rad', watm: 'y' });
    const res = await fetch('https://psg.gsfc.nasa.gov/api.php', { method: 'POST', body: form, headers: { 'user-agent': UA }, signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw upstream(`PSG HTTP ${res.status}`);
    const out = parsePsg(await res.text());
    if (out.wavelengthUm.length < 20) throw upstream(`PSG returned no spectrum${out.errors.length ? `: ${out.errors[0]}` : ''}`);
    // keep 4 significant figures: the curve, not the bytes
    const r4 = (a) => a && a.map((x) => (x == null ? null : +x.toPrecision(4)));
    return { body, month, units: 'W/sr/m²/µm (spectral radiance)', wavelengthUm: r4(out.wavelengthUm), total: r4(out.total), reflected: r4(out.reflected), thermal: r4(out.thermal),
      geometry: body === 'earth' ? 'seen from the Moon' : 'seen from Earth', source: 'NASA GSFC Planetary Spectrum Generator (Villanueva et al. 2018, 2022), with PSG\'s atmosphere template for this body' };
  });
  return { ...value, cache };
}

// ---- Gaia DR3 XP: stars -------------------------------------------------------------------------
const GAIA_ID = /^\d{6,20}$/;

/** The Gaia DR3 source id SIMBAD lists for the brightest star at (ra, dec), or null. */
async function gaiaIdAt(ra, dec, radiusDeg) {
  const s = await simbadAt(ra, dec, radiusDeg);
  if (!s.found) return { simbad: null, gaia: null };
  const id = s.ids?.find((x) => /^Gaia DR3 \d+$/.test(x));
  if (id) return { simbad: s.name, gaia: id.slice(9) };
  // the identifier list in the lookup is capped: ask SIMBAD for this object's Gaia DR3 name
  const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json',
    QUERY: `SELECT i2.id FROM ident AS i1 JOIN ident AS i2 ON i1.oidref = i2.oidref WHERE i1.id = '${s.name.replace(/'/g, "''")}' AND i2.id LIKE 'Gaia DR3 %'` });
  const res = await fetch('https://simbad.cds.unistra.fr/simbad/sim-tap/sync', { method: 'POST', body, signal: AbortSignal.timeout(60000) });
  const j = res.ok ? await res.json() : null;
  const g = j?.data?.[0]?.[0];
  return { simbad: s.name, gaia: g ? String(g).slice(9) : null };
}

/** Parse the Gaia datalink XP_SAMPLED CSV. */
export function parseXp(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const iw = head.indexOf('wavelength'), iF = head.indexOf('flux'), iE = head.indexOf('flux_error');
  const nm = [], flux = [], err = [];
  for (const l of lines.slice(1)) {
    const f = l.split(',');
    nm.push(Number(f[iw])); flux.push(Number(f[iF])); err.push(Number(f[iE]));
  }
  return { nm, flux, err };
}

/** GET /api/star-spectrum?ra=&dec=[&distLy=] */
export async function starSpectrum(q) {
  const ra = Number(q.get('ra')), dec = Number(q.get('dec'));
  if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90)) throw bad('ra in [0, 360), dec in [-90, 90]');
  const distLy = Number(q.get('distLy')) || null;
  const radius = Math.min(0.03, Math.max(0.005, distLy ? 1.5 / distLy * 57.3 : 0.01));
  const { value, cache } = await cached('gaia-xp', `v1-${ra.toFixed(4)},${dec.toFixed(4)}`, 180 * DAY, async () => {
    const { simbad, gaia } = await gaiaIdAt(ra, dec, radius);
    if (!gaia || !GAIA_ID.test(gaia)) return { found: false, simbad, reason: simbad ? 'No Gaia DR3 entry for this star in SIMBAD.' : 'Star not identified in SIMBAD.' };
    const url = `https://gea.esac.esa.int/data-server/data?${new URLSearchParams({ RETRIEVAL_TYPE: 'XP_SAMPLED', ID: `Gaia DR3 ${gaia}`, FORMAT: 'csv', DATA_STRUCTURE: 'INDIVIDUAL' })}`;
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) });
    const text = res.ok ? await res.text() : '';
    if (!res.ok || !/^source_id/.test(text)) return { found: false, simbad, gaiaId: gaia, reason: 'Gaia DR3 has no published BP/RP spectrum for this source (very bright stars saturate the detectors).' };
    const xp = parseXp(text);
    return { found: true, simbad, gaiaId: gaia, units: 'W m⁻² nm⁻¹', ...xp,
      source: 'Gaia DR3 BP/RP sampled spectrum (ESA/Gaia/DPAC; De Angeli et al. 2023; Montegriffo et al. 2023), identified via SIMBAD' };
  });
  return { ...value, cache };
}

// ---- NASA Exoplanet Archive: exoplanet atmospheres ---------------------------------------------
const ARCHIVE = 'https://exoplanetarchive.ipac.caltech.edu';
const tapCsvSafe = (s) => s.replace(/'/g, "''");

/** GET /api/exo-spectra?planet=<pl_name> → the list of published spectra for that planet. */
export async function exoSpectraList(planet) {
  if (!planet || planet.length > 60) throw bad('planet name required');
  const { value, cache } = await cached('exo-spectra', `v1-${planet}`, 30 * DAY, async () => {
    const query = `select pl_name,spec_type,authors,num_datapoints,instrument,facility,minwavelng,maxwavelng,note,bibcode,spec_path from spectra where pl_name = '${tapCsvSafe(planet)}'`;
    const res = await fetch(`${ARCHIVE}/TAP/sync?${new URLSearchParams({ query, format: 'json' })}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw upstream(`Exoplanet Archive HTTP ${res.status}`);
    const rows = await res.json();
    return { planet, spectra: rows.map((r) => ({ type: r.spec_type, authors: r.authors, points: r.num_datapoints, instrument: r.instrument, facility: r.facility,
      minUm: r.minwavelng, maxUm: r.maxwavelng, note: r.note, bibcode: r.bibcode, path: r.spec_path })),
      source: 'NASA Exoplanet Archive, Atmospheric Spectroscopy table (doi:10.26133/NEA36)' };
  });
  return { ...value, cache };
}

// The archive serves spectrum files from a per-visit workspace: open one, reuse it for an hour.
let workspace = null;
async function archiveWorkspace() {
  if (workspace && Date.now() - workspace.at < 3600000) return workspace.path;
  const html = await (await fetch(`${ARCHIVE}/cgi-bin/atmospheres/nph-firefly?atmospheres`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) })).text();
  const m = html.match(/FF_InitPage \('(\/work\/TMP_[A-Za-z0-9_]+\/atmospheres\/tab1)'/);
  if (!m) throw upstream('Exoplanet Archive workspace not found');
  workspace = { at: Date.now(), path: m[1] };
  return workspace.path;
}

/** Parse an IPAC table (|col|col| header rows, whitespace data). */
export function parseIpac(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  for (const l of lines) { const m = l.match(/^\\(\w+)\s*=\s*'?(.*?)'?\s*$/); if (m) meta[m[1]] = m[2]; }
  const headIdx = lines.findIndex((l) => l.startsWith('|'));
  if (headIdx < 0) return { meta, rows: [] };
  const head = lines[headIdx];
  const bounds = [];
  for (let i = 0; i < head.length; i++) if (head[i] === '|') bounds.push(i);
  const names = bounds.slice(0, -1).map((b, k) => head.slice(b + 1, bounds[k + 1]).trim());
  const rows = [];
  for (const l of lines.slice(headIdx + 1)) {
    if (!l.trim() || l.startsWith('|') || l.startsWith('\\')) continue;
    const r = {};
    names.forEach((n, k) => {
      const raw = l.slice(bounds[k], bounds[k + 1] + 1).trim();
      r[n] = raw === 'null' || raw === '' ? null : Number.isFinite(Number(raw)) ? Number(raw) : raw;
    });
    rows.push(r);
  }
  return { meta, rows };
}

/** GET /api/exo-spectrum?path= → points { um, width, value, errHi, errLo, limit } and what `value` is. */
export async function exoSpectrum(p) {
  if (!/^(\d{2}\/){4}[A-Za-z0-9_.+\-]{3,120}\.tbl$/.test(p || '')) throw bad('bad spectrum path');
  const { value, cache } = await cached('exo-spectrum', `v1-${p}`, 365 * DAY, async () => {
    const res = await fetch(`${ARCHIVE}${await archiveWorkspace()}/data/${p}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) { workspace = null; throw upstream(`spectrum HTTP ${res.status}`); }
    const { meta, rows } = parseIpac(await res.text());
    const kind = meta.SPEC_TYPE ?? '';
    const [col, unit, label] = rows[0]?.PL_TRANDEP !== undefined ? ['PL_TRANDEP', '%', 'TRANSIT DEPTH']
      : rows[0]?.ESPECLIPDEP !== undefined ? ['ESPECLIPDEP', '%', 'ECLIPSE DEPTH']
        : rows[0]?.FLAM !== undefined ? ['FLAM', 'W m⁻² µm⁻¹', 'FLUX DENSITY'] : [null, '', ''];
    if (!col) throw upstream('unrecognised spectrum table');
    const points = rows.filter((r) => r[col] != null && r.CENTRALWAVELNG != null).map((r) => ({
      um: r.CENTRALWAVELNG, width: r.BANDWIDTH, value: r[col], errHi: r[`${col}ERR1`] ?? null, errLo: r[`${col}ERR2`] ?? null, limit: r[`${col}LIM`] ?? 0,
    }));
    return { kind, label, unit, instrument: meta.INSTRUMENT, facility: meta.FACILITY, reference: meta.REFERENCE, note: meta.NOTE === 'null' ? null : meta.NOTE, points };
  });
  return { ...value, cache };
}
