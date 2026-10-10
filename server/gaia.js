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
