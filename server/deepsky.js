// Beyond the star catalogue: star clusters in our part of the Milky Way, and the galaxies
// of the nearby universe. Fetched from VizieR (CDS) once and cached for 90 days.
//   Clusters: Hunt & Reffert 2023, A&A 673, A114 — 7,167 Gaia DR3 clusters (J/A+A/673/A114)
//   Nearby galaxies: Karachentsev, Makarov & Kaisina 2013, AJ 145, 101 — the Updated Nearby
//     Galaxy Catalog, 869 galaxies within ~11 Mpc (J/AJ/145/101)
//   Galaxy groups: Tully et al. 2023, ApJ 944, 94 — Cosmicflows-4 group distances (J/ApJ/944/94)

import { cached } from './cache.js';

const VIZIER = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv';
const QUARTER = 90 * 86400000;

/** Parse VizieR ASU-TSV: header, units, dashes, then data rows (as objects keyed by column). */
export function parseTsv(text) {
  const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return [];
  const head = lines[0].split('\t').map((s) => s.trim());
  return lines.slice(3).map((l) => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim()]));
  }).filter((r) => r[head[0]] !== '');
}

async function vizier(source, columns, extra = {}) {
  const q = new URLSearchParams({ '-source': source, '-out.max': '999999', '-out': columns.join(','), ...extra });
  const res = await fetch(`${VIZIER}?${q}`, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`VizieR HTTP ${res.status}`);
  return parseTsv(await res.text());
}
const num = (s) => (s === '' || s == null ? null : Number(s));

/** Star clusters: rows [name, l°, b°, distance pc, members, log10 age yr, kind, r50 pc]. */
export async function clusters() {
  const { value } = await cached('deepsky', 'hunt-reffert-2023-v2', QUARTER, async () => {
    const rows = (await vizier('J/A+A/673/A114/clusters', ['Name', 'GLON', 'GLAT', 'dist50', 'N', 'logAge50', 'Type', 'r50pc']))
      .map((r) => [r.Name.replaceAll('_', ' '), +num(r.GLON).toFixed(3), +num(r.GLAT).toFixed(3), Math.round(num(r.dist50)), num(r.N), num(r.logAge50) != null ? +num(r.logAge50).toFixed(2) : null, r.Type || null,
        num(r.r50pc) != null ? +num(r.r50pc).toFixed(1) : null])
      .filter((r) => r[3] > 0);
    return { fields: ['name', 'l', 'b', 'distPc', 'members', 'logAge', 'type', 'r50pc'], rows, source: 'Hunt & Reffert 2023 (Gaia DR3)' };
  });
  return value;
}

// ---- cluster members (#24) -------------------------------------------------------------------
export const MAX_MEMBERS = 2500;
const MEMBER_COLS = ['GaiaDR3', 'RA_ICRS', 'DE_ICRS', 'Plx', 'e_Plx', 'Gmag', 'BP-RP', 'Prob', 'inrt'];
const fixed = (x, d) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));

/**
 * VizieR member rows → compact rows [RA°, Dec°, parallax mas, error mas, G mag, BP−RP, membership
 * probability, Gaia DR3 id (string: 19 digits), 1 if within the tidal radius else 0], brightest first, at most `max`.
 */
export function compactMembers(rows, max = MAX_MEMBERS) {
  return rows
    .map((r) => [fixed(num(r.RA_ICRS), 5), fixed(num(r.DE_ICRS), 5), fixed(num(r.Plx), 4), fixed(num(r.e_Plx), 4), fixed(num(r.Gmag), 2), fixed(num(r['BP-RP']), 3), fixed(num(r.Prob), 2), r.GaiaDR3, r.inrt === 'False' ? 0 : 1])
    .filter((r) => r[0] != null && r[1] != null && r[4] != null && /^\d{1,20}$/.test(r[7]))
    .sort((a, b) => a[4] - b[4])
    .slice(0, max);
}

/**
 * GET /api/cluster-members?name=Melotte 22 → { name, distPc, r50pc, av, type, total, shown,
 * fields, rows } for one Hunt & Reffert cluster: its brightest Gaia DR3 members (VizieR
 * J/A+A/673/A114/members), cached 90 days. Only names in the cluster catalogue are accepted.
 */
export async function clusterMembers(name) {
  const n = String(name || '').trim();
  if (!/^[\w .+-]{2,40}$/.test(n)) throw Object.assign(new Error('bad cluster name'), { status: 400 });
  const list = await clusters();
  if (!list.rows.some((r) => r[0] === n)) throw Object.assign(new Error(`unknown cluster ${n}`), { status: 404 });
  const id = n.replaceAll(' ', '_');
  const { value } = await cached('cluster-members', `v2-${id}`, QUARTER, async () => {
    const [info] = await vizier('J/A+A/673/A114/clusters', ['Name', 'N', 'dist50', 'r50pc', 'rtpc', 'AV50', 'Type', 'logAge50'], { Name: id, '-out.max': '1' });
    if (!info) throw Object.assign(new Error(`VizieR has no cluster ${n}`), { status: 404 });
    const raw = await vizier('J/A+A/673/A114/members', MEMBER_COLS, { Name: id, '-sort': 'Gmag', '-out.max': String(MAX_MEMBERS) });
    const rows = compactMembers(raw);
    return {
      name: n, distPc: num(info.dist50), r50pc: num(info.r50pc), rtPc: num(info.rtpc), av: num(info.AV50), type: info.Type || null, logAge: num(info.logAge50),
      total: num(info.N), shown: rows.length, fields: ['ra', 'dec', 'plx', 'ePlx', 'g', 'bpRp', 'prob', 'gaiaDr3', 'inTidal'], rows, inTidal: rows.filter((r) => r[8]).length,
      source: 'Hunt & Reffert 2023, A&A 673, A114 (VizieR J/A+A/673/A114/members): Gaia DR3 members',
    };
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
