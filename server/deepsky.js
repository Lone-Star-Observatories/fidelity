// Beyond the star catalogue: star clusters in our part of the Milky Way, and the galaxies
// of the nearby universe. Fetched from VizieR (CDS) once and cached for 90 days.
//   Clusters: Hunt & Reffert 2023, A&A 673, A114 — 7,167 Gaia DR3 clusters (J/A+A/673/A114)
//   Nearby galaxies: Karachentsev, Makarov & Kaisina 2013, AJ 145, 101 — the Updated Nearby
//     Galaxy Catalog, 869 galaxies within ~11 Mpc (J/AJ/145/101)
//   Galaxy groups: Tully et al. 2023, ApJ 944, 94 — Cosmicflows-4 group distances (J/ApJ/944/94)

import { cached } from './cache.js';

const VIZIER = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';
const QUARTER = 90 * 86400000;

async function vizier(source, columns) {
  const q = new URLSearchParams({ '-source': source, '-out.max': '999999', '-out': columns.join(',') });
  const res = await fetch(`${VIZIER}?${q}`, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`VizieR HTTP ${res.status}`);
  const lines = (await res.text()).split('\n').filter((l) => l && !l.startsWith('#'));
  // header, units, dashes, then data
  const head = lines[0].split('\t').map((s) => s.trim());
  return lines.slice(3).map((l) => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim()]));
  }).filter((r) => r[head[0]] !== '');
}
const num = (s) => (s === '' || s == null ? null : Number(s));

/** Star clusters: rows [name, l°, b°, distance pc, members, log10 age yr, kind]. */
export async function clusters() {
  const { value } = await cached('deepsky', 'hunt-reffert-2023', QUARTER, async () => {
    const rows = (await vizier('J/A+A/673/A114/clusters', ['Name', 'GLON', 'GLAT', 'dist50', 'N', 'logAge50', 'Type']))
      .map((r) => [r.Name.replaceAll('_', ' '), +num(r.GLON).toFixed(3), +num(r.GLAT).toFixed(3), Math.round(num(r.dist50)), num(r.N), num(r.logAge50) != null ? +num(r.logAge50).toFixed(2) : null, r.Type || null])
      .filter((r) => r[3] > 0);
    return { fields: ['name', 'l', 'b', 'distPc', 'members', 'logAge', 'type'], rows, source: 'Hunt & Reffert 2023 (Gaia DR3)' };
  });
  return value;
}

const hms = (s) => { const [h, m, x] = s.split(/\s+/).map(Number); return (h + m / 60 + x / 3600) * 15; };
const dms = (s) => { const sign = s.trim().startsWith('-') ? -1 : 1; const [d, m, x] = s.replace(/^[+-]/, '').split(/\s+/).map(Number); return sign * (d + m / 60 + x / 3600); };

/**
 * Galaxies: the Updated Nearby Galaxy Catalog (named, with type, size and luminosity) and the
 * Cosmicflows-4 groups (supergalactic Cartesian positions, Mpc).
 */
export async function galaxies() {
  const { value } = await cached('deepsky', 'galaxies-v1', QUARTER, async () => {
    const ungc = (await vizier('J/AJ/145/101/catalog', ['Name', 'RAJ2000', 'DEJ2000', 'Dist', 'TT', 'BMag', 'A26', 'f_Dist']))
      .map((r) => [r.Name, +hms(r.RAJ2000).toFixed(4), +dms(r.DEJ2000).toFixed(4), num(r.Dist), num(r.TT), num(r.BMag), num(r.A26), r.f_Dist || null])
      .filter((r) => r[3] > 0);
    const groups = (await vizier('J/ApJ/944/94/groups', ['1PGC', 'Ngal', 'Dist', 'SGX', 'SGY', 'SGZ']))
      .map((r) => [num(r['1PGC']), num(r.Ngal), num(r.Dist), num(r.SGX), num(r.SGY), num(r.SGZ)])
      .filter((r) => r[2] > 0 && r[3] != null);
    return {
      ungc: { fields: ['name', 'ra', 'dec', 'distMpc', 'type', 'absB', 'diameterKpc', 'distMethod'], rows: ungc, source: 'Karachentsev et al. 2013 (UNGC)' },
      groups: { fields: ['pgc', 'members', 'distMpc', 'sgx', 'sgy', 'sgz'], rows: groups, source: 'Tully et al. 2023 (Cosmicflows-4)' },
    };
  });
  return value;
}
