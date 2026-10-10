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
