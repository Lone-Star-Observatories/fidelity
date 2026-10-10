// Star catalogue + known planets, for the Navigation View and other System Views.
//
// Stars: the HYG database (Hipparcos, Yale Bright Star, Gliese; https://codeberg.org/astronexus/hyg),
// read from a local copy if FIDELITY_CATALOG_DIRS has one, otherwise downloaded once into
// data/catalogs/. Planets: the NASA Exoplanet Archive composite table (pscomppars) via TAP,
// cached for a week. Hosts are matched to catalogue stars by HIP/HD number, then by sky
// position + distance; hosts too faint for HYG (e.g. TRAPPIST-1) are added from the archive.

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { config } from './config.js';
import { cached } from './cache.js';
import { scanCatalogs } from './catalogs.js';
import { orbits as loadOrbits, MEASURED, componentLetters } from './binaries.js';
import { NEIGHBOURS, BROWN_DWARF_PROPS } from './neighbours.js';

const gunzip = promisify(zlib.gunzip);
const HYG_URL = 'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz';
const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const LY_PER_PC = 3.26156;
const MAX_PLANET_HOST_PC = 65; // ≈ 212 ly: covers a 100 ly radius around any star within ~110 ly of Sol
const WEEK = 7 * 86400000;

// ---- CSV ---------------------------------------------------------------------------------

/** Minimal RFC 4180 line splitter (quoted fields, doubled quotes). */
export function splitCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s) => (s === '' || s == null ? null : Number(s));

const GREEK = { Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ',
  Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω' };

/** Best human-readable designation for a HYG row. */
export function starName(r) {
  if (r.proper) return r.proper;
  if (r.bayer && r.con) {
    const [, letter, idx] = r.bayer.match(/^([A-Za-z]+)(?:-?(\d+))?$/) || [, r.bayer, ''];
    return `${GREEK[letter] ?? letter}${idx ? `${idx}` : ''} ${r.con}`;
  }
  if (r.flam && r.con) return `${r.flam} ${r.con}`;
  if (r.gl) return r.gl.replace(/^Gl\b/, 'Gliese');
  if (r.hip) return `HIP ${r.hip}`;
  if (r.hd) return `HD ${r.hd}`;
  return `HYG ${r.id}`;
}

/** Parse HYG CSV text into star records (only stars with a known distance). */
export function parseHyg(text) {
  const lines = text.split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const stars = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = splitCsvLine(lines[i]);
    const dist = num(f[col.dist]);
    if (dist == null || dist >= 100000) continue; // HYG uses 100000 pc for "unknown"
    const r = {
      id: f[col.id], hip: f[col.hip], hd: f[col.hd], gl: f[col.gl], proper: f[col.proper],
      bayer: f[col.bayer], flam: f[col.flam], con: f[col.con], compPrimary: f[col.comp_primary],
    };
    stars.push({
      id: r.id === '0' ? 'sol' : `hyg-${r.id}`,
      name: starName(r),
      hip: r.hip ? Number(r.hip) : null,
      hd: r.hd ? Number(r.hd) : null,
      gl: r.gl || null,
      x: num(f[col.x]), y: num(f[col.y]), z: num(f[col.z]), // parsecs, equatorial J2000
      distPc: dist,
      mag: num(f[col.mag]), absmag: num(f[col.absmag]),
      spect: f[col.spect] || null, ci: num(f[col.ci]), lum: num(f[col.lum]),
      // HYG groups multiple-star components under their primary's id
      compPrimary: r.compPrimary && r.compPrimary !== r.id ? (r.compPrimary === '0' ? 'sol' : `hyg-${r.compPrimary}`) : null,
      source: 'HYG v4',
    });
  }
  return stars;
}

// ---- loading -----------------------------------------------------------------------------

async function hygText() {
  // 1) a copy already on local disk (e.g. the RAID)
  if (config.catalogDirs.length) {
    const { catalogs } = await scanCatalogs();
    const local = catalogs.find((c) => c.id === 'hyg')?.paths.find((p) => /hyg[^/\\]*\.csv(\.gz)?$/i.test(p));
    if (local) return { text: await readMaybeGz(local), from: local };
  }
  // 2) our own downloaded copy
  const file = path.join(config.dataDir, 'catalogs', path.basename(HYG_URL));
  try { return { text: await readMaybeGz(file), from: file }; } catch { /* download */ }
  const res = await fetch(HYG_URL, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HYG download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  return { text: (await gunzip(buf)).toString('utf8'), from: HYG_URL };
}

async function readMaybeGz(file) {
  const buf = await fs.readFile(file);
  return (file.endsWith('.gz') ? await gunzip(buf) : buf).toString('utf8');
}

async function exoplanetRows() {
  const cols = [
    'hostname', 'hip_name', 'hd_name', 'gaia_dr3_id', 'ra', 'dec', 'sy_dist', 'sy_pnum',
    'pl_name', 'pl_letter', 'pl_orbsmax', 'pl_orbper', 'pl_orbeccen', 'pl_orbincl', 'pl_orblper', 'pl_tranmid',
    'pl_rade', 'pl_bmasse', 'pl_bmassprov', 'pl_eqt', 'pl_insol', 'tran_flag',
    'st_teff', 'st_rad', 'st_mass', 'st_lum', 'st_met', 'st_metratio', 'st_spectype', 'disc_method', 'disc_year', 'disc_facility',
  ];
  const query = `select ${cols.join(',')} from pscomppars where sy_dist <= ${MAX_PLANET_HOST_PC}`;
  const { value } = await cached('exoplanets', `pscomppars-${MAX_PLANET_HOST_PC}pc-v2`, WEEK, async () => {
    const res = await fetch(`${TAP}?query=${encodeURIComponent(query)}&format=json`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`Exoplanet Archive HTTP ${res.status}`);
    return res.json();
  });
  return value;
}

// ---- cross-match -------------------------------------------------------------------------

const DEG = Math.PI / 180;
const unit = (raDeg, decDeg) => [Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG), Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG), Math.sin(decDeg * DEG)];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Group archive rows by host and attach each host to a catalogue star (or a new one). */
export function matchHosts(stars, rows) {
  const byHip = new Map(), byHd = new Map();
  for (const s of stars) {
    if (s.hip) byHip.set(s.hip, s);
    if (s.hd) byHd.set(s.hd, s);
  }
  const hosts = new Map();
  for (const r of rows) {
    if (!hosts.has(r.hostname)) hosts.set(r.hostname, { host: r, planets: [] });
    hosts.get(r.hostname).planets.push(r);
  }
  const near = stars.filter((s) => s.distPc <= MAX_PLANET_HOST_PC * 1.2);
  const planetsOf = new Map(); // starId → { host, planets }
  const extra = [];
  for (const [name, entry] of hosts) {
    const h = entry.host;
    const hip = h.hip_name && Number(h.hip_name.replace(/^HIP\s*/, ''));
    const hd = h.hd_name && Number(h.hd_name.replace(/^HD\s*/, ''));
    let star = (hip && byHip.get(hip)) || (hd && byHd.get(hd)) || null;
    if (!star) {
      // Position match: 5′ tolerates proper motion between catalogue epochs; distance within 15%.
      const u = unit(h.ra, h.dec);
      let best = null, bestAng = 5 / 60;
      for (const s of near) {
        if (Math.abs(s.distPc - h.sy_dist) > 0.15 * h.sy_dist) continue;
        const ang = Math.acos(Math.min(1, (s.x * u[0] + s.y * u[1] + s.z * u[2]) / s.distPc)) / DEG;
        if (ang < bestAng) { best = s; bestAng = ang; }
      }
      star = best;
    }
    if (!star) {
      const u = unit(h.ra, h.dec);
      star = {
        id: `exo-${slug(name)}`, name, hip: null, hd: null, gl: null,
        x: u[0] * h.sy_dist, y: u[1] * h.sy_dist, z: u[2] * h.sy_dist, distPc: h.sy_dist,
        mag: null, absmag: null, spect: h.st_spectype, ci: null, lum: h.st_lum != null ? 10 ** h.st_lum : null,
        source: 'NASA Exoplanet Archive',
      };
      extra.push(star);
    }
    planetsOf.set(star.id, entry);
  }
  return { planetsOf, extra };
}

// ---- multiple stars ----------------------------------------------------------------------

/**
 * Attach ORB6 visual-binary orbits to catalogue stars. The primary is found by HIP number;
 * the secondary is a HYG component of the same system (or a star at a matching position and
 * distance, e.g. Proxima for α Cen AC), chosen by magnitude. Secondaries missing from HYG
 * are added from the orbit catalogue. Returns orbit edges and the extra stars.
 */
export function matchBinaries(stars, orbitList, maxPc = 100) {
  const byHip = new Map(), members = new Map(), byIdLocal = new Map();
  for (const s of stars) {
    byIdLocal.set(s.id, s);
    if (s.hip) byHip.set(s.hip, s);
    if (s.compPrimary) { if (!members.has(s.compPrimary)) members.set(s.compPrimary, []); members.get(s.compPrimary).push(s); }
  }
  const near = stars.filter((s) => s.distPc <= maxPc * 1.3);
  // bucket by 1° declination band so each orbit only scans its own patch of sky
  const decOf = (s) => Math.asin(Math.max(-1, Math.min(1, s.z / s.distPc))) * 180 / Math.PI;
  const bands = Array.from({ length: 181 }, () => []);
  for (const s of near) if (s.distPc > 0) bands[Math.round(decOf(s)) + 90].push(s);
  const around = (P, sepDeg) => {
    const d = decOf(P), out = [];
    for (let k = Math.max(0, Math.floor(d - sepDeg) + 90); k <= Math.min(180, Math.ceil(d + sepDeg) + 90); k++) out.push(...bands[k]);
    return out;
  };
  const edges = [], extra = [], seen = new Set();
  // Objects with no Hipparcos number (brown dwarfs) are matched to their orbit by position.
  const lit = stars.filter((s) => s.source === 'literature' && !s.compPrimary);
  const byPosition = (o) => {
    const u = unit(o.raDeg, o.decDeg);
    return lit.find((s) => (s.x * u[0] + s.y * u[1] + s.z * u[2]) / s.distPc > Math.cos(2 / 60 * DEG)) ?? null;
  };
  for (const o of orbitList) {
    const P = (o.hip && byHip.get(o.hip)) || (!o.hip && lit.length ? byPosition(o) : null);
    if (!P || P.distPc > maxPc) continue;
    const [l1, l2] = componentLetters(o.components);
    if (!l1.startsWith('A')) continue; // orbits between other components need component-level ids
    const measured = MEASURED[o.wds] ?? null;
    const sep = Math.max(3 * o.aArcsec, 30) / 3600; // degrees
    const cands = new Set(members.get(P.compPrimary ?? P.id) ?? []);
    if (P.compPrimary) cands.add(byIdLocal.get(P.compPrimary));
    const cosSep = Math.cos(sep * Math.PI / 180);
    for (const s of around(P, sep + 1)) {
      if (s === P || Math.abs(s.distPc - P.distPc) > 0.3 * P.distPc) continue;
      if ((s.x * P.x + s.y * P.y + s.z * P.z) / (s.distPc * P.distPc) > cosSep) cands.add(s);
    }
    let S = null, best = 2.5;
    for (const c of cands) {
      if (!c || c === P) continue;
      const dm = o.v2 != null && c.mag != null ? Math.abs(c.mag - o.v2) : 2.4;
      if (dm < best) { best = dm; S = c; }
    }
    if (!S) {
      const props = measured?.props?.[l2] ?? {};
      S = {
        id: `${P.id}-${l2.toLowerCase()}`, name: props.name ?? `${P.name} ${l2}`, hip: null, hd: null, gl: null,
        x: P.x, y: P.y, z: P.z, distPc: P.distPc,
        mag: o.v2, absmag: o.v2 != null ? o.v2 - 5 * Math.log10(P.distPc / 10) : null,
        spect: props.spect ?? null, ci: null, lum: null, compPrimary: P.id, source: 'ORB6',
      };
      extra.push(S);
    }
    // "Gliese 244B" → "Sirius B" when the primary has a proper name
    if (/^(Gliese|GJ|HIP|HD|HYG)\b/.test(S.name) && !/^(Gliese|GJ|HIP|HD|HYG)\b/.test(P.name)) S.name = `${P.name} ${l2}`;
    const key = [P.id, S.id].sort().join('|');
    if (seen.has(key)) continue; // one orbit per pair (catalogue order = preferred)
    seen.add(key);
    edges.push({ orbit: o, primaryId: P.id, secondaryId: S.id, letters: [l1, l2], measured });
  }
  return { edges, extra };
}

/** Union of HYG component grouping and orbit edges: id → { members: Set<id>, edges: [] }. */
export function buildGroups(stars, edges) {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); };
  for (const s of stars) if (s.compPrimary) union(s.id, s.compPrimary);
  for (const e of edges) union(e.primaryId, e.secondaryId);
  const groups = new Map();
  for (const id of parent.keys()) {
    const r = find(id);
    if (!groups.has(r)) groups.set(r, { members: new Set(), edges: [] });
    groups.get(r).members.add(id);
  }
  for (const e of edges) groups.get(find(e.primaryId)).edges.push(e);
  const of = new Map();
  for (const g of groups.values()) for (const id of g.members) of.set(id, g);
  return of;
}

// ---- service -----------------------------------------------------------------------------

let catalogPromise = null;

/** Load (once) the stars + planet hosts. Planet data failing leaves stars usable. */
export function catalog() {
  catalogPromise ??= (async () => {
    const { text, from } = await hygText();
    const stars = parseHyg(text);
    stars.push(...NEIGHBOURS.map((n) => ({ ...n })));
    let planetsOf = new Map(), planetError = null;
    try {
      const m = matchHosts(stars, await exoplanetRows());
      planetsOf = m.planetsOf;
      stars.push(...m.extra);
    } catch (err) { planetError = String(err.message || err); }
    let edges = [], binaryError = null;
    try {
      const b = matchBinaries(stars, await loadOrbits());
      edges = b.edges;
      stars.push(...b.extra);
    } catch (err) { binaryError = String(err.message || err); }
    const groupOf = buildGroups(stars, edges);
    const byId = new Map(stars.map((s) => [s.id, s]));
    return { stars, byId, planetsOf, planetError, groupOf, binaryError, hygFrom: from };
  })().catch((err) => { catalogPromise = null; throw err; });
  return catalogPromise;
}

const notFound = (msg) => Object.assign(new Error(msg), { status: 404 });
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

function centerOf(cat, id) {
  const c = cat.byId.get(id || 'sol');
  if (!c) throw notFound(`unknown star ${id}`);
  return c;
}

/** Stars within `radiusLy` of `centerId`. Compact rows keep the payload small. */
export async function nearby(centerId, radiusLy) {
  const r = Number(radiusLy);
  if (!(r > 0 && r <= 150)) throw bad('radiusLy must be in (0, 150]');
  const cat = await catalog();
  const c = centerOf(cat, centerId);
  const rPc = r / LY_PER_PC;
  const rows = [];
  for (const s of cat.stars) {
    const dx = s.x - c.x, dy = s.y - c.y, dz = s.z - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > rPc && s.id !== 'sol') continue; // Sol (Sector 001) is always included
    const p = cat.planetsOf.get(s.id);
    rows.push([s.id, s.name, s.x, s.y, s.z, s.absmag, s.ci, s.spect, p ? p.planets.length : 0, s.source === 'HYG v4' ? 0 : s.brownDwarf ? 2 : 1]);
  }
  return {
    center: summary(cat, c), radiusLy: r,
    fields: ['id', 'name', 'x', 'y', 'z', 'absmag', 'ci', 'spect', 'planets', 'archiveOnly'],
    stars: rows,
    sources: { stars: `HYG v4.4 (${cat.hygFrom})`, planets: cat.planetError ? `unavailable: ${cat.planetError}` : 'NASA Exoplanet Archive pscomppars' },
  };
}

function summary(cat, s) {
  const p = cat.planetsOf.get(s.id);
  return { ...s, distLy: s.distPc * LY_PER_PC, planetCount: p ? p.planets.length : 0 };
}

/** One star and its known planets (raw archive rows). */
export async function starDetail(id) {
  const cat = await catalog();
  const s = cat.byId.get(id);
  if (!s) throw notFound(`unknown star ${id}`);
  const p = cat.planetsOf.get(id);
  const g = cat.groupOf.get(id);
  const group = g && g.members.size > 1 ? {
    members: [...g.members].map((mid) => {
      const m = cat.byId.get(mid), mp = cat.planetsOf.get(mid);
      return { star: summary(cat, m), host: mp ? mp.host : null, planets: mp ? mp.planets : [] };
    }),
    orbits: g.edges.map((e) => ({ ...e.orbit, primaryId: e.primaryId, secondaryId: e.secondaryId, letters: e.letters, measured: e.measured })),
    source: 'ORB6 (USNO/GSU Sixth Catalog of Orbits of Visual Binary Stars) + HYG component grouping',
  } : null;
  return { star: summary(cat, s), host: p ? p.host : null, planets: p ? p.planets : [], group, measured: BROWN_DWARF_PROPS[id] ?? null };
}

/**
 * The naked-eye sky as seen from `centerId`: unit directions (equatorial) + apparent
 * magnitude from there, for stars brighter than `maxMag`.
 */
export async function sky(centerId, maxMag = 6.5) {
  const m = Number(maxMag);
  if (!(m > -2 && m <= 8)) throw bad('maxMag must be in (-2, 8]');
  const cat = await catalog();
  const c = centerOf(cat, centerId);
  const rows = [];
  for (const s of cat.stars) {
    if (s.id === c.id || s.absmag == null) continue;
    const dx = s.x - c.x, dy = s.y - c.y, dz = s.z - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-6) continue;
    const app = s.absmag + 5 * Math.log10(d / 10);
    if (app > m) continue;
    rows.push([+(dx / d).toFixed(5), +(dy / d).toFixed(5), +(dz / d).toFixed(5), +app.toFixed(2), s.ci, app < 1.6 ? s.name : null]);
  }
  return { center: c.id, maxMag: m, fields: ['dx', 'dy', 'dz', 'mag', 'ci', 'name'], stars: rows };
}

// ---- galaxy ------------------------------------------------------------------------------

// J2000 equatorial → IAU galactic (same matrix as src/astro/frames.js)
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

/**
 * Catalogue stars for the Galaxy View: heliocentric galactic x/y/z in light-years (x towards
 * the galactic centre, z towards galactic north), for stars within `maxLy` brighter than
 * absolute magnitude `maxAbs`. Compact integer rows.
 */
export async function galaxyStars(maxLy = 1500, maxAbs = 2) {
  const d = Number(maxLy), M = Number(maxAbs);
  if (!(d > 0 && d <= 5000) || !(M >= -10 && M <= 20)) throw bad('maxLy in (0, 5000], maxAbs in [-10, 20]');
  const cat = await catalog();
  const rows = [];
  for (const s of cat.stars) {
    if (s.absmag == null || s.absmag > M || s.distPc * LY_PER_PC > d) continue;
    const v = [s.x * LY_PER_PC, s.y * LY_PER_PC, s.z * LY_PER_PC];
    const g = GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
    rows.push([Math.round(g[0]), Math.round(g[1]), Math.round(g[2]), Math.round(s.absmag * 10), s.ci != null ? Math.round(s.ci * 100) : null]);
  }
  return { maxLy: d, maxAbs: M, fields: ['gx', 'gy', 'gz', 'absmag10', 'ci100'], stars: rows, source: 'HYG v4.4' };
}
