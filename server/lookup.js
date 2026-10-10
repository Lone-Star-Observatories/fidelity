// Click-to-investigate (#23): identify any star by its position.
//   SIMBAD (CDS, Strasbourg) TAP: name, object type, spectral type, parallax, other names.
//   Gaia DR3 (ESA) TAP: astrometry, photometry and the FLAME/GSP-Phot astrophysical
//     parameters (temperature, radius, luminosity, mass, age) for stars beyond the HYG catalogue.
// Cone searches are small (a few arcseconds to an arcminute) and cached for 30 days.

import { cached } from './cache.js';

const MONTH = 30 * 86400000;
const SIMBAD = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';
const GAIA = 'https://gea.esac.esa.int/tap-server/tap/sync';
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

async function tap(url, query, { quoteLeadingIds = false } = {}) {
  const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', QUERY: query });
  const res = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Object.assign(new Error(`TAP HTTP ${res.status}`), { status: 502 });
  const text = await res.text();
  // 64-bit identifiers (Gaia source_id, first column) lose digits as JSON numbers: quote them first
  const raw = JSON.parse(quoteLeadingIds ? text.replace(/(\[\s*)(\d{16,20})(\s*,)/g, '$1"$2"$3') : text);
  const names = raw.metadata.map((m) => m.name);
  return raw.data.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]])));
}
const coords = (q) => {
  const ra = Number(q.get('ra')), dec = Number(q.get('dec'));
  if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90)) throw bad('ra in [0, 360), dec in [-90, 90]');
  return { ra, dec };
};
const key = (ra, dec, r) => `${ra.toFixed(4)},${dec.toFixed(4)},${r}`;

/** The SIMBAD object nearest (ra, dec) within `radiusDeg`, with up to 12 other identifiers. */
export async function simbadAt(ra, dec, radiusDeg = 0.01) {
  const { value } = await cached('simbad', `v4-${key(ra, dec, radiusDeg)}`, MONTH, async () => {
    // the clicked stars are bright catalogue stars (V or G brighter than ~10), so look for those first;
    // in crowded fields (Orion) the nearest dozen objects are otherwise all faint
    const q = (bright) => tap(SIMBAD, `SELECT TOP 12 b.oid, b.main_id, b.otype, b.sp_type, b.ra, b.dec, b.plx_value, b.rvz_radvel, f.V, f.G,
        DISTANCE(POINT('ICRS', b.ra, b.dec), POINT('ICRS', ${ra}, ${dec})) AS sep
      FROM basic AS b LEFT OUTER JOIN allfluxes AS f ON f.oidref = b.oid
      WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDeg})) = 1${bright ? ' AND (f.V < 11 OR f.G < 11)' : ''} ORDER BY sep`);
    let rows = await q(true);
    if (!rows.length) rows = await q(false);
    // prefer a star over an extended region or association that happens to contain the point
    const stellar = (r) => /\*|^(PM|HB|RG|WD|BD|Pec|LM|Pe|Em|s\?|AB|Ce|RR|Mi|SN|C\*|S\*|OH|V\*)/.test(r.otype ?? '') || !!r.sp_type;
    // the clicked stars are bright catalogue stars: the brightest star in the cone is the match
    const mag = (r) => r.V ?? r.G ?? 99;
    const stars = rows.filter(stellar).sort((x, y) => mag(x) - mag(y) || x.sep - y.sep);
    const best = stars[0] ?? rows[0];
    if (!best) return { found: false };
    const ids = await tap(SIMBAD, `SELECT TOP 12 id FROM ident WHERE oidref = ${Number(best.oid)}`).catch(() => []);
    return {
      found: true, name: best.main_id, type: best.otype, spectral: best.sp_type || null, vMag: best.V ?? best.G ?? null, parallaxMas: best.plx_value,
      radialVelocityKms: best.rvz_radvel, sepArcsec: best.sep * 3600, ids: ids.map((r) => r.id),
      url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(best.main_id)}`,
      source: 'SIMBAD, CDS Strasbourg',
    };
  });
  return value;
}

/**
 * The Gaia DR3 star nearest (ra, dec), preferring one whose parallax distance matches
 * `distLy` and brighter than G = `maxG`.
 */
export async function gaiaAt(ra, dec, distLy, radiusDeg = 0.02, maxG = 10) {
  const { value } = await cached('gaia', `star-v2-${key(ra, dec, radiusDeg)}-${maxG}`, MONTH, async () => {
    const rows = await tap(GAIA, `SELECT TOP 8 g.source_id, g.ra, g.dec, g.parallax, g.parallax_error, g.pmra, g.pmdec, g.radial_velocity,
        g.phot_g_mean_mag, g.bp_rp, g.teff_gspphot, g.non_single_star, g.phot_variable_flag, g.ruwe,
        a.radius_flame, a.lum_flame, a.mass_flame, a.age_flame, a.spectraltype_esphs
      FROM gaiadr3.gaia_source AS g LEFT OUTER JOIN gaiadr3.astrophysical_parameters AS a ON a.source_id = g.source_id
      WHERE 1 = CONTAINS(POINT('ICRS', g.ra, g.dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDeg})) AND g.phot_g_mean_mag < ${maxG}`, { quoteLeadingIds: true });
    return { rows };
  });
  const dist = (r) => (r.parallax > 0 ? (1000 / r.parallax) * 3.26156 : Infinity);
  const score = (r) => {
    const sep = Math.hypot((r.ra - ra) * Math.cos((dec * Math.PI) / 180), r.dec - dec) * 3600;
    const dd = distLy ? Math.abs(Math.log(dist(r) / distLy)) * 100 : 0;
    return sep + dd + r.phot_g_mean_mag;
  };
  const best = [...value.rows].sort((a, b) => score(a) - score(b))[0];
  if (!best) return { found: false };
  return {
    found: true, sourceId: String(best.source_id), ra: best.ra, dec: best.dec,
    parallaxMas: best.parallax, parallaxErrorMas: best.parallax_error, distLy: dist(best),
    pmMasYr: [best.pmra, best.pmdec], radialVelocityKms: best.radial_velocity, gMag: best.phot_g_mean_mag, bpRp: best.bp_rp,
    teffK: best.teff_gspphot, radiusSun: best.radius_flame, lumSun: best.lum_flame, massSun: best.mass_flame, ageGyr: best.age_flame,
    spectral: best.spectraltype_esphs || null, multiple: best.non_single_star > 0 || best.ruwe > 1.4,
    variable: best.phot_variable_flag === 'VARIABLE', ruwe: best.ruwe, source: 'Gaia DR3, ESA/Gaia/DPAC',
    url: `https://gea.esac.esa.int/archive/`,
  };
}

/** GET /api/star-lookup?ra=&dec=[&distLy=][&gaia=1]: SIMBAD always, Gaia DR3 when asked. */
export async function starLookup(q) {
  const { ra, dec } = coords(q);
  const distLy = q.get('distLy') ? Number(q.get('distLy')) : null;
  const wantGaia = q.get('gaia') === '1';
  // a star placed from rounded light-year positions can be ~30″ off at a few thousand ly
  const r = Math.min(0.03, Math.max(0.005, distLy ? 1.5 / distLy * 57.3 : 0.01));
  const [simbad, gaia] = await Promise.all([
    simbadAt(ra, dec, r).catch((err) => ({ found: false, error: err.message })),
    wantGaia ? gaiaAt(ra, dec, distLy, r).catch((err) => ({ found: false, error: err.message })) : null,
  ]);
  return { ra, dec, simbad, gaia };
}
