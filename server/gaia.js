// Bright, well-measured Gaia DR3 stars beyond HYG's reach, for the Galaxy View: G < 9 with
// parallax measured to better than 10% and parallax < 2 mas (farther than ~1,600 ly).
// ESA Gaia archive TAP (https://gea.esac.esa.int/archive/), cached for 90 days.

import { cached } from './cache.js';

const TAP = 'https://gea.esac.esa.int/tap-server/tap/sync';
const ADQL = 'SELECT ra, dec, parallax, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source WHERE parallax_over_error > 10 AND phot_g_mean_mag < 9 AND parallax < 2';
const GAL = [ // J2000 equatorial → IAU galactic
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
const DEG = Math.PI / 180;

/** Rows [gx, gy, gz (ly, heliocentric galactic), M_G×10, BP−RP×100], the same shape as /api/galaxy. */
export async function gaiaBright() {
  const { value } = await cached('gaia', 'bright-far-v1', 90 * 86400000, async () => {
    const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: ADQL });
    const res = await fetch(TAP, { method: 'POST', body, signal: AbortSignal.timeout(240000) });
    if (!res.ok) throw new Error(`Gaia TAP HTTP ${res.status}`);
    const lines = (await res.text()).trim().split('\n').slice(1);
    const stars = [];
    for (const l of lines) {
      const [ra, dec, plx, g, bprp] = l.split(',').map(Number);
      if (!(plx > 0)) continue;
      const ly = (1000 / plx) * 3.26156, a = ra * DEG, d = dec * DEG;
      const v = [ly * Math.cos(d) * Math.cos(a), ly * Math.cos(d) * Math.sin(a), ly * Math.sin(d)];
      const gv = GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
      const absG = g - 5 * Math.log10(1000 / plx / 10); // ignores extinction
      stars.push([Math.round(gv[0]), Math.round(gv[1]), Math.round(gv[2]), Math.round(absG * 10), Number.isFinite(bprp) ? Math.round(bprp * 100) : null]);
    }
    return { fields: ['gx', 'gy', 'gz', 'absmag10', 'color100'], color: 'BP−RP', stars, source: 'Gaia DR3 (G < 9, parallax/error > 10, parallax < 2 mas)' };
  });
  return value;
}

// ---- space motions for the Navigation View (#29) -------------------------------------------
// Gaia DR3 astrometry and radial velocities for Hipparcos stars within ~1,090 ly (parallax
// > 3 mas), via Gaia's own Hipparcos-2 cross-match. ≈ 63k rows (≈ 8 MB of CSV, ~1 min); cached
// for 90 days. Rows: [hip, ra°, dec°, parallax mas, parallax error, pmra*, pmdec mas/yr, RV
// km/s | null, RV error | null].
const HIP_ADQL = `SELECT h.original_ext_source_id AS hip, g.ra, g.dec, g.parallax, g.parallax_error, g.pmra, g.pmdec, g.radial_velocity, g.radial_velocity_error
FROM gaiadr3.hipparcos2_best_neighbour AS h JOIN gaiadr3.gaia_source AS g ON g.source_id = h.source_id WHERE g.parallax > 3`;

/** Parse the cross-match CSV into compact rows (exported for tests). */
export function parseHipMotions(csv) {
  const rows = [];
  for (const l of csv.trim().split('\n').slice(1)) {
    const f = l.split(',');
    const n = f.map((x) => (x === '' ? null : Number(x)));
    if (!(n[0] > 0) || n[3] == null || n[5] == null || n[6] == null) continue;
    rows.push([n[0], +n[1].toFixed(7), +n[2].toFixed(7), +n[3].toFixed(4), +n[4].toFixed(4), +n[5].toFixed(4), +n[6].toFixed(4),
      n[7] == null ? null : +n[7].toFixed(3), n[8] == null ? null : +n[8].toFixed(3)]);
  }
  return rows;
}

export async function hipMotions() {
  const { value } = await cached('gaia', 'hip-motions-3mas-v1', 90 * 86400000, async () => {
    const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: HIP_ADQL });
    const res = await fetch(TAP, { method: 'POST', body, signal: AbortSignal.timeout(300000) });
    if (!res.ok) throw new Error(`Gaia TAP HTTP ${res.status}`);
    const text = await res.text();
    if (!text.startsWith('hip,')) throw new Error(`Gaia TAP: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
    return { fields: ['hip', 'ra', 'dec', 'plx', 'plxErr', 'pmra', 'pmdec', 'rv', 'rvErr'], rows: parseHipMotions(text), source: 'Gaia DR3 gaia_source × hipparcos2_best_neighbour (parallax > 3 mas)' };
  });
  return value;
}

// ---- the Gaia DR3 radial-velocity slice (#29) ----------------------------------------------
// Every Gaia DR3 star with a radial velocity, parallax > 10 mas (within ~326 ly) and
// parallax/error > 10: 169,740 rows (≈ 23 MB of CSV; the sync query took ~22 s when measured
// on 2026-10-10). It fills in the K and M dwarfs that Hipparcos (and so HYG) is too faint for,
// so the Navigation View's deep-time sphere does not thin out so fast. Gaia's RVs reach
// G_RVS ≈ 14, so faint M dwarfs are still missing beyond a few tens of light-years. Cached for
// a year (DR3 does not change). Rows: [source_id (a string: it exceeds 2^53), ra°, dec°,
// parallax mas, pmra*, pmdec mas/yr, RV km/s, G, BP−RP | null, RV error km/s | null]. The
// merge drops RVs with errors ≥ 5 km/s, as for the Hipparcos stars: faint stars' DR3 RVs can
// be spurious (one M dwarf 36 ly away has −374 ± 8 km/s and almost no proper motion, which
// would bring it within 0.4 ly of the Sun in 29,000 years).
const TAP_BASE = 'https://gea.esac.esa.int/tap-server/tap';
export const RV_ADQL = 'SELECT source_id, ra, dec, parallax, pmra, pmdec, radial_velocity, radial_velocity_error, phot_g_mean_mag, bp_rp FROM gaiadr3.gaia_source '
  + 'WHERE parallax > 10 AND parallax_over_error > 10 AND radial_velocity IS NOT NULL';
const YEAR = 365 * 86400000;

/** Parse the RV-slice CSV into compact rows (exported for tests). source_id stays a string. */
export function parseRvSlice(csv) {
  const lines = csv.trim().split('\n');
  const head = lines[0].trim().split(',');
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const k of ['source_id', 'ra', 'dec', 'parallax', 'pmra', 'pmdec', 'radial_velocity', 'phot_g_mean_mag']) {
    if (col[k] == null) throw new Error(`Gaia TAP: no ${k} column`);
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].trim().split(',');
    const sid = f[col.source_id];
    if (!/^\d{6,20}$/.test(sid)) continue;
    const n = (k) => (col[k] == null || f[col[k]] == null || f[col[k]] === '' ? null : Number(f[col[k]]));
    const ra = n('ra'), dec = n('dec'), plx = n('parallax'), pmra = n('pmra'), pmdec = n('pmdec'), rv = n('radial_velocity'), g = n('phot_g_mean_mag'), bprp = n('bp_rp'), rvErr = n('radial_velocity_error');
    if (![ra, dec, plx, pmra, pmdec, rv, g].every(Number.isFinite) || !(plx > 0)) continue;
    rows.push([sid, +ra.toFixed(7), +dec.toFixed(7), +plx.toFixed(4), +pmra.toFixed(3), +pmdec.toFixed(3), +rv.toFixed(2), +g.toFixed(3),
      Number.isFinite(bprp) ? +bprp.toFixed(3) : null, Number.isFinite(rvErr) ? +rvErr.toFixed(2) : null]);
  }
  return rows;
}

/**
 * Run an ADQL query on the Gaia archive and return its CSV: the sync endpoint first and, if
 * that fails or times out, an async (UWS) job: submit with PHASE=RUN, poll its phase, fetch
 * the result. `opts.fetch` is injectable for tests. Resolves to { text, via: 'sync' | 'async' }.
 */
export async function tapCsv(adql, { fetch: f = fetch, header, syncTimeoutMs = 180000, asyncTimeoutMs = 20 * 60000, pollMs = 5000, base = TAP_BASE } = {}) {
  const params = { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql };
  const good = (t) => !header || t.startsWith(header);
  let syncError;
  try {
    const res = await f(`${base}/sync`, { method: 'POST', body: new URLSearchParams(params), signal: AbortSignal.timeout(syncTimeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!good(text)) throw new Error(text.slice(0, 120).replace(/\s+/g, ' '));
    return { text, via: 'sync' };
  } catch (err) { syncError = err; }
  const sub = await f(`${base}/async`, { method: 'POST', body: new URLSearchParams({ ...params, PHASE: 'RUN' }), redirect: 'manual', signal: AbortSignal.timeout(60000) });
  const loc = sub.headers?.get?.('location');
  if (!loc) throw new Error(`Gaia TAP: sync failed (${syncError?.message}) and no async job was created (HTTP ${sub.status})`);
  const job = new URL(loc, `${base}/async`).href;
  const until = Date.now() + asyncTimeoutMs;
  for (;;) {
    const phase = (await (await f(`${job}/phase`, { signal: AbortSignal.timeout(30000) })).text()).trim();
    if (phase === 'COMPLETED') break;
    if (phase === 'ERROR' || phase === 'ABORTED') throw new Error(`Gaia TAP async job ${phase} (sync had failed: ${syncError?.message})`);
    if (Date.now() > until) throw new Error('Gaia TAP async job timed out');
    await new Promise((r) => setTimeout(r, pollMs));
  }
  const res = await f(`${job}/results/result`, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Gaia TAP async result HTTP ${res.status}`);
  const text = await res.text();
  if (!good(text)) throw new Error(`Gaia TAP: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  return { text, via: 'async' };
}

/** The RV slice, from the disk cache (a year) or the archive. */
export async function gaiaRvSlice() {
  const { value, cache } = await cached('gaia', 'rv-slice-10mas-v2', YEAR, async () => {
    const t0 = Date.now();
    const { text, via } = await tapCsv(RV_ADQL, { header: 'source_id,' });
    const rows = parseRvSlice(text);
    return { fields: ['sourceId', 'ra', 'dec', 'plx', 'pmra', 'pmdec', 'rv', 'g', 'bprp', 'rvErr'], rows, via, ms: Date.now() - t0, csvBytes: text.length,
      fetched: new Date().toISOString(), source: 'Gaia DR3 gaia_source: radial_velocity not null, parallax > 10 mas, parallax/error > 10' };
  });
  return { ...value, cache };
}
