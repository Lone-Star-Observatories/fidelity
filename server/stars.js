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
import { hipMotions, gaiaRvSlice } from './gaia.js';
import { spaceMotion } from '../src/astro/spacemotion.js';
import { starAliases } from '../src/data/search.js';

const gunzip = promisify(zlib.gunzip);
const HYG_URL = 'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz';
const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const LY_PER_PC = 3.26156;
const KMS_PER_PC_YR = 977792.2; // 1 pc/yr in km/s
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
      alt: starAliases(r), // every designation, for the text search (#63)
      hip: r.hip ? Number(r.hip) : null,
      hd: r.hd ? Number(r.hd) : null,
      gl: r.gl || null,
      x: num(f[col.x]), y: num(f[col.y]), z: num(f[col.z]), // parsecs, equatorial J2000
      distPc: dist,
      mag: num(f[col.mag]), absmag: num(f[col.absmag]),
      spect: f[col.spect] || null, ci: num(f[col.ci]), lum: num(f[col.lum]),
      // space velocity, km/s (HYG gives pc/yr); without a radial velocity it is the transverse part only
      v: f[col.vx] !== undefined ? [num(f[col.vx]), num(f[col.vy]), num(f[col.vz])].map((x) => (x == null ? 0 : x * KMS_PER_PC_YR)) : null,
      rvKnown: num(f[col.rv]) != null && num(f[col.rv]) !== 0,
      rv: num(f[col.rv]) || null,
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
    // Grade 9 = an astrometric orbit: a wobble of the light centre, the companion never seen.
    // Several are discredited (van de Kamp's Barnard's Star "companions"); designations with
    // digits (Aa1, Aa2) mark proposed planets, not stars.
    if (o.grade === 9 || /\d/.test(o.components) || /[A-Z][a-z]?\d\b/.test(o.designation)) continue;
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
    if (!S && seen.has([P.id, `${P.id}-${l2.toLowerCase()}`].sort().join('|'))) continue; // same companion, another orbit solution
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

// ---- space motions (#29) -------------------------------------------------------------------

// Where a star's velocity comes from: HYG (Hipparcos proper motion + catalogue RV), Gaia DR3
// (astrometry + Gaia RV), or Gaia DR3 astrometry with the catalogue's RV (or none).
export const VSRC = ['HYG', 'Gaia DR3', 'Gaia DR3 + catalogue RV', 'Gaia DR3 RV slice (not in HYG)'];

/**
 * Give each HYG star with a good Gaia DR3 match (parallax/error > 10) a Gaia position and
 * velocity in `s.motion`. Gaia RVs with errors under 5 km/s win; otherwise the catalogue RV is
 * kept; with neither, the motion is sideways only. Returns the number of stars updated.
 */
export function applyGaia(stars, rows) {
  const byHip = new Map(rows.map((r) => [r[0], r]));
  let n = 0;
  for (const s of stars) {
    const r = s.hip && byHip.get(s.hip);
    if (!r) continue;
    const [, ra, dec, plx, plxErr, pmra, pmdec, rv, rvErr] = r;
    if (!(plx > 0 && plxErr > 0 && plx / plxErr > 10)) continue;
    const gaiaRv = rv != null && rvErr != null && rvErr < 5;
    const useRv = gaiaRv ? rv : s.rvKnown ? s.rv : null;
    const m = spaceMotion({ raDeg: ra, decDeg: dec, plxMas: plx, pmraMasYr: pmra, pmdecMasYr: pmdec, rvKms: useRv });
    s.motion = { x: m.pos[0], y: m.pos[1], z: m.pos[2], v: m.vel, rvKnown: useRv != null, vSrc: gaiaRv ? 1 : 2 };
    n++;
  }
  return n;
}
/** Position used for the Navigation View: Gaia DR3 where matched, else HYG. */
const posOf = (s) => s.motion ?? s;
/** A star's own measured motion { v, rvKnown, vSrc } or null. */
function ownMotion(s) {
  if (s.id === 'sol') return { v: [0, 0, 0], rvKnown: false, vSrc: 0 }; // velocities are Sun-relative
  if (s.motion) return s.motion;
  if (s.v && s.v.some((x) => x !== 0)) return { v: s.v, rvKnown: s.rvKnown, vSrc: 0 };
  return null;
}
const rank = (m, s) => (m.rvKnown ? 0 : 4) + (m.vSrc === 1 ? 0 : m.vSrc === 2 ? 1 : 2) + Math.min(0.99, ((s.absmag ?? 30) + 10) / 50);
/** The motion a system shares (stars of a bound system move together): measured RV first, then Gaia, then the brightest. */
function systemMotion(cat, s) {
  const g = cat.groupOf.get(s.id);
  if (!g || g.members.size < 2) return ownMotion(s);
  let best = null, bestR = Infinity;
  for (const id of g.members) {
    const m = cat.byId.get(id), mm = m && ownMotion(m);
    if (mm && rank(mm, m) < bestR) { best = mm; bestR = rank(mm, m); }
  }
  return best;
}

const GAIA_RETRY_MS = 10 * 60000;
/** Load Gaia DR3 motions in the background (≈1 min the first time, then from the disk cache). */
function startGaia(cat) {
  if (cat.motions.status === 'loading' || cat.motions.status === 'ok') return cat.gaiaReady;
  if (cat.motions.status === 'error' && Date.now() - cat.motions.at < GAIA_RETRY_MS) return cat.gaiaReady;
  cat.motions = { status: 'loading' };
  cat.gaiaReady = hipMotions()
    .then((v) => { cat.motions = { status: 'ok', stars: applyGaia(cat.stars, v.rows), source: v.source }; })
    .catch((err) => { cat.motions = { status: 'error', error: String(err.message || err), at: Date.now() }; });
  return cat.gaiaReady;
}
/** Resolves once Gaia motions are applied (or have failed): for the standalone builder. */
export async function motionsReady() {
  const cat = await catalog();
  await startGaia(cat);
  return cat.motions;
}

/**
 * Load the Gaia DR3 RV slice in the background (first asked for by /api/arrivals, so the
 * standalone build never fetches it) and merge it once the Hipparcos motions are in, so the
 * de-duplication compares Gaia positions with Gaia positions where it can.
 */
function startGaiaRv(cat) {
  const g = cat.gaiaRv;
  if (g.status === 'loading' || g.status === 'ok') return cat.gaiaRvReady;
  if (g.status === 'error' && Date.now() - g.at < GAIA_RETRY_MS) return cat.gaiaRvReady;
  cat.gaiaRv = { status: 'loading', stars: [] };
  cat.gaiaRvReady = (async () => {
    const v = await gaiaRvSlice();
    await startGaia(cat);
    const t0 = Date.now();
    const { added, matched, noisy } = mergeGaiaRv(cat.stars, v.rows, { pos: posOf });
    const ly = (s) => ({ d: s.distPc * LY_PER_PC, M: s.absmag });
    const hyg = cat.stars.filter((s) => s.id !== 'sol').map(ly);
    const before = completenessByClass(hyg), after = completenessByClass([...hyg, ...added.map(ly)]);
    cat.gaiaRv = {
      status: 'ok', stars: added, byId: new Map(added.map((s) => [s.id, s])), rows: v.rows.length, matched, noisy, added: added.length,
      via: v.via, fetchMs: v.ms, mergeMs: Date.now() - t0, fetched: v.fetched, source: v.source,
      completeness: {
        gaiaLy: +(100 * LY_PER_PC).toFixed(0), // parallax > 10 mas
        classes: before.map((c, i) => ({ label: c.label, mv: c.mv, hygLy: c.completeLy, mergedLy: after[i].completeLy })),
        density: densityProfile([...cat.stars, ...added]),
      },
    };
  })().catch((err) => { cat.gaiaRv = { status: 'error', stars: [], error: String(err.message || err), at: Date.now() }; });
  return cat.gaiaRvReady;
}
const gaiaRvStatus = (cat) => {
  const g = cat.gaiaRv;
  return g.status === 'ok'
    ? { status: 'ok', rows: g.rows, matched: g.matched, noisy: g.noisy, added: g.added, via: g.via, fetchMs: g.fetchMs, mergeMs: g.mergeMs, fetched: g.fetched, source: g.source }
    : { status: g.status, error: g.error ?? null };
};

/**
 * How complete the catalogue is with distance from Sol: its star density within 20 ly, and the
 * distance where the density of a 10 ly shell first falls below half of that (beyond it, the
 * catalogue holds mainly the brighter stars).
 */
export function densityProfile(stars) {
  const LY = LY_PER_PC, edges = [];
  for (let r = 30; r <= 1000; r += 10) edges.push(r); // outer edges of 10 ly shells beyond 20 ly
  const counts = new Array(edges.length).fill(0);
  let inner = 0;
  for (const s of stars) {
    const d = s.distPc * LY;
    if (d <= 20) inner++;
    const k = Math.ceil((d - 20) / 10) - 1;
    if (k >= 0 && k < counts.length) counts[k]++;
  }
  const vol = (a, b) => (4 / 3) * Math.PI * (b ** 3 - a ** 3);
  const rho0 = inner / vol(0, 20);
  let halfLy = null;
  for (let k = 0; k < counts.length; k++) {
    const rho = counts[k] / vol(edges[k] - 10, edges[k]);
    if (rho < 0.5 * rho0) { halfLy = edges[k] - 10; break; }
  }
  return { rho0PerLy3: rho0, halfLy, refLy: 20 };
}

// ---- the Gaia DR3 radial-velocity slice (#29) ------------------------------------------------

/** Johnson V from Gaia G and BP−RP (Riello et al. 2021, valid −0.5 < BP−RP < 5); G − 0.3 without a colour. */
export function gaiaV(g, bprp) {
  if (bprp == null) return g + 0.3;
  const x = Math.max(-0.5, Math.min(5, bprp));
  return g - (-0.02704 + 0.01424 * x - 0.2156 * x * x + 0.01426 * x ** 3);
}
/** Rough B−V from BP−RP, only for drawing a star's colour (≈ 0.65 for the Sun, ≈ 1.5 for an M dwarf). */
export const gaiaBV = (bprp) => (bprp == null ? null : +Math.max(-0.3, Math.min(2, bprp * (0.83 - 0.11 * Math.max(0, bprp)))).toFixed(2));

/**
 * Merge the Gaia DR3 RV slice with the catalogue: a Gaia row is the same star as a catalogue
 * star when position, parallax and magnitude all agree. Tolerances follow how well the
 * catalogue knows the star: 3″ / 10% for stars that already carry Gaia astrometry; 5″ plus
 * 20 years of proper motion / 25% for Hipparcos stars (J2000 positions vs Gaia's 2016.0);
 * 100″ plus 66 years of proper motion / 45% for Gliese, Yale and literature rows (old
 * positions, photometric distances). V (from G and BP−RP) must agree within 1.5 mag (1.2 for
 * the rough rows) where the catalogue has one, so a fainter companion Gaia resolves next to a
 * catalogue star stays a star of its own. Within 15″ and 0.3 mag the parallax test is waived
 * (some Gliese distances are off by 2×). Returns the Gaia-only stars as catalogue-like
 * records (`vSrc` 3), how many rows matched, and how many were dropped as RVs with errors
 * ≥ `maxRvErr` km/s (`noisy`).
 */
export function mergeGaiaRv(stars, rows, { pos = (s) => s.motion ?? s, maxRvErr = 5 } = {}) {
  const CELL = 0.005; // rad, ≈ 17′ — far more than any match tolerance
  const grid = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  for (const s of stars) {
    const p = pos(s), d = Math.hypot(p.x, p.y, p.z);
    if (!(d > 0) || d > 130) continue;
    const u = [p.x / d, p.y / d, p.z / d], k = key(...u.map((c) => Math.floor(c / CELL)));
    if (!grid.has(k)) grid.set(k, []);
    // how well the catalogue knows this star: Gaia astrometry (the same 2016.0 epoch), a
    // Hipparcos parallax with J2000 positions, or neither (Gliese / Yale / literature rows,
    // whose positions can be ~1′ out and distances ~40% out)
    const q = s.motion ? 0 : s.hip ? 1 : 2;
    grid.get(k).push({ s, u, plx: 1000 / d, posArcsec: [3, 5, 100][q], pmYears: [1, 16.5 * 1.2, 66][q], plxFrac: [0.1, 0.25, 0.45][q], dMag: [1.5, 1.5, 1.2][q] });
  }
  const added = [];
  let matched = 0, noisy = 0;
  for (const r of rows) {
    const [sid, ra, dec, plx, pmra, pmdec, rv, g, bprp, rvErr] = r;
    if (rvErr != null && !(rvErr < maxRvErr)) { noisy++; continue; } // RV too uncertain (or spurious) to follow
    const u = unit(ra, dec), c = u.map((x) => Math.floor(x / CELL));
    const pm = Math.hypot(pmra, pmdec) / 1000; // ″/yr
    const V = gaiaV(g, bprp);
    let hit = null;
    for (let i = -1; i <= 1 && !hit; i++) for (let j = -1; j <= 1 && !hit; j++) for (let k = -1; k <= 1 && !hit; k++) {
      for (const e of grid.get(key(c[0] + i, c[1] + j, c[2] + k)) ?? []) {
        const sep = Math.acos(Math.min(1, u[0] * e.u[0] + u[1] * e.u[1] + u[2] * e.u[2])) * 206265;
        const tol = e.posArcsec + pm * e.pmYears;
        if (sep > tol) continue;
        const dV = e.s.mag != null ? Math.abs(e.s.mag - V) : null;
        // nearly the same place and brightness: the same star even when an old distance is far off
        const twin = dV != null && dV <= 0.3 && sep <= Math.min(15, tol);
        if (!twin && Math.abs(e.plx - plx) > Math.max(e.plxFrac * plx, 2)) continue;
        if (dV != null && dV > e.dMag) continue;
        hit = e.s; break;
      }
    }
    if (hit) { matched++; continue; }
    const m = spaceMotion({ raDeg: ra, decDeg: dec, plxMas: plx, pmraMasYr: pmra, pmdecMasYr: pmdec, rvKms: rv });
    const distPc = 1000 / plx;
    added.push({
      id: `gdr3-${sid}`, name: `Gaia DR3 ${sid}`, gaia: sid, hip: null, hd: null, gl: null,
      x: m.pos[0], y: m.pos[1], z: m.pos[2], distPc, mag: +V.toFixed(2), absmag: +(V - 5 * Math.log10(distPc / 10)).toFixed(2), ci: gaiaBV(bprp), spect: null,
      motion: { x: m.pos[0], y: m.pos[1], z: m.pos[2], v: m.vel, rvKnown: true, vSrc: 3 }, source: 'Gaia DR3',
    });
  }
  return { added, matched, noisy };
}

// Absolute-magnitude (V) bins with the dwarfs that dominate them.
export const MV_CLASSES = [['B–A', -Infinity, 2], ['F', 2, 4], ['G', 4, 5.5], ['K', 5.5, 8.8], ['M0–M3', 8.8, 12], ['M4+', 12, Infinity]];
/**
 * How far out each absolute-magnitude class is complete in a list of { d (ly), M }: its density
 * inside the smallest radius (≥ 20 ly) holding 30 of its stars, then shells outward each
 * expected to hold ≥ 30; the class is complete out to the first shell holding fewer than half
 * of what that density predicts. `completeLy` null = complete out to `maxLy`.
 */
export function completenessByClass(list, maxLy = 1000) {
  const vol = (a, b) => (4 / 3) * Math.PI * (b ** 3 - a ** 3);
  return MV_CLASSES.map(([label, lo, hi]) => {
    const ds = list.filter((s) => s.M != null && s.M >= lo && s.M < hi && s.d <= maxLy).map((s) => s.d).sort((a, b) => a - b);
    const within = (r) => { let a = 0, b = ds.length; while (a < b) { const m = (a + b) >> 1; if (ds[m] <= r) a = m + 1; else b = m; } return a; };
    let ref = null;
    for (let r = 20; r <= 300; r += 10) if (within(r) >= 30) { ref = r; break; }
    if (!ref) return { label, mv: [lo, hi], refLy: null, completeLy: 0, n: ds.length };
    const rho = within(ref) / vol(0, ref);
    let a = ref, completeLy = null;
    while (a < maxLy) {
      let b = a;
      while (b < maxLy && rho * vol(a, b) < 30) b += 5;
      if (rho * vol(a, b) < 30) break; // too few expected before maxLy to tell
      if (within(b) - within(a) < 0.5 * rho * vol(a, b)) { completeLy = a; break; }
      a = b;
    }
    return { label, mv: [lo, hi], refLy: ref, completeLy, n: ds.length };
  });
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
    const cat = { stars, byId, planetsOf, planetError, groupOf, binaryError, hygFrom: from, motions: { status: 'none' }, gaiaReady: null, gaiaRv: { status: 'none', stars: [] }, gaiaRvReady: null };
    cat.density = densityProfile(stars);
    return cat;
  })().catch((err) => { catalogPromise = null; throw err; });
  return catalogPromise.then((cat) => { startGaia(cat); return cat; });
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
  const cp = posOf(c);
  const rows = [];
  for (const s of cat.stars) {
    const q = posOf(s);
    const d = Math.hypot(q.x - cp.x, q.y - cp.y, q.z - cp.z);
    if (d > rPc && s.id !== 'sol') continue; // Sol (Sector 001) is always included
    const p = cat.planetsOf.get(s.id);
    const m = ownMotion(s);
    rows.push([s.id, s.name, q.x, q.y, q.z, s.absmag, s.ci, s.spect, p ? p.planets.length : 0, s.source === 'HYG v4' ? 0 : s.brownDwarf ? 2 : 1,
      systemId(cat, s), m ? m.v.map((x) => +x.toFixed(3)) : null, m?.rvKnown ? 1 : 0, m ? m.vSrc : null]);
  }
  return {
    center: { ...summary(cat, c), x: cp.x, y: cp.y, z: cp.z, ...(c.motion ? { distPc: Math.hypot(cp.x, cp.y, cp.z), distLy: Math.hypot(cp.x, cp.y, cp.z) * LY_PER_PC } : {}) }, radiusLy: r,
    fields: ['id', 'name', 'x', 'y', 'z', 'absmag', 'ci', 'spect', 'planets', 'archiveOnly', 'system', 'vKms', 'rvKnown', 'vSrc'],
    stars: rows,
    sources: { stars: `HYG v4.4 (${cat.hygFrom})${cat.motions.status === 'ok' ? '; Gaia DR3 positions and motions where matched' : ''}`, planets: cat.planetError ? `unavailable: ${cat.planetError}` : 'NASA Exoplanet Archive pscomppars' },
    motions: motionStatus(cat),
  };
}

const systemId = (cat, s) => { const g = cat.groupOf.get(s.id); return g && g.members.size > 1 ? [...g.members].sort()[0] : null; }; // a stable id shared by a system's stars
const motionStatus = (cat) => ({ status: cat.motions.status, gaiaStars: cat.motions.stars ?? 0, error: cat.motions.error ?? null, sources: VSRC });

/**
 * Stars with a measured space motion in the shell fromLy < d ≤ toLy around `centerId` (#29):
 * the stars that can drift into the Navigation View's sphere in deep time. Each carries its
 * system's shared motion. Compact rows (positions pc, velocities km/s, equatorial);
 * flags = rvKnown + 2 × velocity source (VSRC index).
 */
export async function arrivals(centerId, fromLy, toLy, { gaia = false, waitMs = 8000 } = {}) {
  const a = Number(fromLy), b = Number(toLy);
  if (!(a >= 0 && b > a && b <= 1000)) throw bad('need 0 ≤ fromLy < toLy ≤ 1000');
  const cat = await catalog();
  const c = centerOf(cat, centerId), cp = posOf(c);
  // the Gaia DR3 RV slice (opt-in: the route asks for it, the standalone builder does not)
  if (gaia) await Promise.race([startGaiaRv(cat), new Promise((r) => setTimeout(r, waitMs).unref?.())]);
  const rows = [], counts = VSRC.map(() => 0);
  const aPc = a / LY_PER_PC, bPc = b / LY_PER_PC;
  const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
  for (const s of cat.stars) {
    if (s.id === 'sol' || s.id === c.id) continue;
    const q = posOf(s);
    const d = Math.hypot(q.x - cp.x, q.y - cp.y, q.z - cp.z);
    if (d <= aPc || d > bPc) continue;
    const m = systemMotion(cat, s);
    if (!m) continue;
    counts[m.vSrc]++;
    rows.push([s.id, s.name, +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), s.absmag != null ? +s.absmag.toFixed(2) : null,
      s.ci, systemId(cat, s), +m.v[0].toFixed(3), +m.v[1].toFixed(3), +m.v[2].toFixed(3), (m.rvKnown ? 1 : 0) + 2 * m.vSrc]);
  }
  // Gaia-only stars: compact rows (name null = "Gaia DR3 <source_id>", 0.001 pc, 0.01 km/s)
  const gv = gaia && cat.gaiaRv.status === 'ok';
  if (gv) {
    for (const s of cat.gaiaRv.stars) {
      const m = s.motion, d = Math.hypot(m.x - cp.x, m.y - cp.y, m.z - cp.z);
      if (d <= aPc || d > bPc || s.id === c.id) continue;
      counts[3]++;
      rows.push([s.id, null, r3(m.x), r3(m.y), r3(m.z), s.absmag, s.ci, null, r2(m.v[0]), r2(m.v[1]), r2(m.v[2]), 1 + 2 * 3]);
    }
  }
  return {
    center: c.id, fromLy: a, toLy: b,
    fields: ['id', 'name', 'x', 'y', 'z', 'absmag', 'ci', 'system', 'vx', 'vy', 'vz', 'flags'],
    stars: rows, velocitySources: Object.fromEntries(VSRC.map((k, i) => [k, counts[i]])),
    density: cat.density, motions: motionStatus(cat),
    ...(gaia ? { gaiaRv: gaiaRvStatus(cat), completeness: gv ? cat.gaiaRv.completeness : null } : {}),
    source: `HYG v4.4${cat.motions.status === 'ok' ? ' + Gaia DR3 motions' : ''}${gv ? ' + Gaia DR3 RV slice (≤ 326 ly)' : ''}; stars with a measured proper motion only`,
  };
}

function summary(cat, s) {
  const p = cat.planetsOf.get(s.id);
  return { ...s, distLy: s.distPc * LY_PER_PC, planetCount: p ? p.planets.length : 0 };
}

/** Planets around stars within `radiusLy` of `centerId`, nearest first (compact rows). */
export async function nearbyPlanets(centerId, radiusLy) {
  const r = Number(radiusLy);
  if (!(r > 0 && r <= 150)) throw bad('radiusLy must be in (0, 150]');
  const cat = await catalog();
  const c = centerOf(cat, centerId);
  const rows = [];
  for (const [id, { planets }] of cat.planetsOf) {
    const s = cat.byId.get(id);
    if (!s) continue;
    const d = Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) * LY_PER_PC;
    if (d > r) continue;
    for (const p of planets) {
      rows.push([p.pl_name, id, s.name, +d.toFixed(3), p.pl_rade ?? null, p.pl_bmasse ?? null, /sini/i.test(p.pl_bmassprov || '') ? 1 : 0,
        p.pl_orbper ?? null, p.pl_orbsmax ?? null, p.pl_eqt ?? null, p.pl_insol ?? null, p.tran_flag === 1 ? 1 : 0, p.disc_year ?? null, p.disc_method ?? null, p.pl_letter ?? null]);
    }
  }
  rows.sort((a, b) => a[3] - b[3]);
  return { center: c.id, radiusLy: r, fields: ['name', 'hostId', 'host', 'distLy', 'radiusEarth', 'massEarth', 'massIsMin', 'periodDays', 'aAU', 'teqK', 'insol', 'transits', 'year', 'method', 'letter'], planets: rows };
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
    rows.push([+(dx / d).toFixed(5), +(dy / d).toFixed(5), +(dz / d).toFixed(5), +app.toFixed(2), s.ci, app < 1.6 ? s.name : null, s.id]);
  }
  return { center: c.id, maxMag: m, fields: ['dx', 'dy', 'dz', 'mag', 'ci', 'name', 'id'], stars: rows };
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
    rows.push([Math.round(g[0]), Math.round(g[1]), Math.round(g[2]), Math.round(s.absmag * 10), s.ci != null ? Math.round(s.ci * 100) : null, s.id]);
  }
  return { maxLy: d, maxAbs: M, fields: ['gx', 'gy', 'gz', 'absmag10', 'ci100', 'id'], stars: rows, source: 'HYG v4.4' };
}
