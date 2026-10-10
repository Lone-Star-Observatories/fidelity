// What the great space telescopes are doing: JWST's published observing schedule (STScI weekly
// reports: what it is pointed at now and next) and the most recent public Hubble and JWST images
// (MAST). Hubble's live timeline is not published as open data, so Hubble gets recent images only.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { cached } from './cache.js';
import { config } from './config.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const STSCI = 'https://www.stsci.edu';
const SCHEDULES = `${STSCI}/jwst/science-execution/observing-schedules`;

async function fetchOk(url, opts = {}, timeoutMs = 60000) {
  const res = await fetch(url, { ...opts, headers: { 'user-agent': UA, ...opts.headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res;
}

const durSec = (d) => {
  const m = /^(\d+)\/(\d+):(\d+):(\d+)$/.exec(d?.trim() ?? '');
  return m ? ((+m[1] * 24 + +m[2]) * 60 + +m[3]) * 60 + +m[4] : null;
};

/** Parse one STScI JWST weekly schedule report (fixed-width columns keyed off the header line). */
export function parseJwstSchedule(text) {
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => l.startsWith('VISIT ID'));
  if (hi < 0) return [];
  const header = lines[hi];
  const names = ['VISIT ID', 'PCS MODE', 'VISIT TYPE', 'SCHEDULED START TIME', 'DURATION', 'SCIENCE INSTRUMENT AND MODE', 'TARGET NAME', 'CATEGORY', 'KEYWORDS'];
  const at = names.map((n) => header.indexOf(n));
  if (at.some((x) => x < 0)) return [];
  const col = (l, i) => l.slice(at[i], i + 1 < at.length ? at[i + 1] : undefined).trim();
  const visits = [];
  for (const l of lines.slice(hi + 2)) {
    if (!l.trim()) continue;
    const id = col(l, 0);
    if (!id) { // continuation: another target / category line for the visit above
      const v = visits.at(-1);
      if (v && col(l, 6)) v.alsoTargets.push(col(l, 6));
      if (v && col(l, 8) && !v.keywords.includes(col(l, 8))) v.keywords += `, ${col(l, 8)}`;
      continue;
    }
    const start = col(l, 3);
    const parallel = /ATTACHED TO PRIME/.test(start);
    visits.push({ visit: id, type: col(l, 2), start: parallel ? null : start, durationSec: parallel ? null : durSec(col(l, 4)), parallel,
      instrument: col(l, 5), target: col(l, 6), category: col(l, 7), keywords: col(l, 8), alsoTargets: [] });
  }
  return visits;
}

/** GET /api/observing/jwst/schedule → { now, next: [...], previous: [...], source, fetched } around the present. */
export async function jwstSchedule() {
  const got = await cached('observing', 'jwst-schedule', 3 * 3600e3, async () => {
    const page = await (await fetchOk(SCHEDULES)).text();
    const files = [...new Set([...page.matchAll(/href="([^"]*_report_\d+\.txt)"/g)].map((m) => m[1]))].slice(0, 3); // newest weeks first
    if (!files.length) throw new Error('no JWST schedule reports listed');
    const visits = [];
    for (const f of files.reverse()) {
      const v = parseJwstSchedule(await (await fetchOk(new URL(f, STSCI).href)).text());
      for (const x of v) if (x.start && !visits.some((y) => y.visit === x.visit && y.start === x.start)) visits.push(x);
      // a parallel rides with the prime that precedes it
      v.forEach((x, i) => { if (x.parallel) { const prime = v.slice(0, i).reverse().find((p) => !p.parallel); const p = prime && visits.find((y) => y.visit === prime.visit && y.start === prime.start); if (p) (p.parallels ??= []).push({ instrument: x.instrument, type: x.type }); } });
    }
    visits.sort((a, b) => a.start.localeCompare(b.start));
    return { visits, files: files.map((f) => new URL(f, STSCI).href), fetched: new Date().toISOString() };
  });
  const { visits, files, fetched } = got.value;
  const now = Date.now();
  const t = (v) => Date.parse(v.start);
  let i = visits.findLastIndex((v) => t(v) <= now);
  const cur = i >= 0 && t(visits[i]) + (visits[i].durationSec ?? 0) * 1000 > now ? visits[i] : null;
  if (!cur) i = visits.findLastIndex((v) => t(v) <= now); // between visits: slewing or calibrating
  return { now: cur, previous: visits.slice(Math.max(0, i - 4), Math.max(0, i)).reverse(), next: visits.slice(i + 1, i + 9), coversUntil: visits.at(-1)?.start ?? null,
    source: 'STScI JWST weekly observing schedule (as planned; visits can move)', files, fetched, cache: got.cache };
}

const MAST = 'https://mast.stsci.edu/api/v0/invoke';
const MJD0 = 40587; // MJD of 1970-01-01
const mjdToIso = (m) => new Date((m - MJD0) * 86400e3).toISOString().slice(0, 19) + 'Z';

/** GET /api/observing/:mission/recent → newest public calibrated images (one per target and instrument). */
export async function recentImages(mission) {
  const coll = { hst: 'HST', jwst: 'JWST' }[mission];
  if (!coll) throw Object.assign(new Error(`unknown mission ${mission}`), { status: 404 });
  const got = await cached('observing', `recent-${mission}`, 3600e3, async () => {
    const now = Date.now() / 86400e3 + MJD0;
    const request = { service: 'Mast.Caom.Filtered', format: 'json', pagesize: 400, page: 1, removenullcolumns: true,
      params: { columns: 'obs_id,target_name,instrument_name,filters,t_min,t_exptime,t_obs_release,jpegURL,s_ra,s_dec,proposal_id,proposal_pi,obs_title', filters: [
        { paramName: 'obs_collection', values: [coll] }, { paramName: 'dataproduct_type', values: ['image'] }, { paramName: 'calib_level', values: [3] },
        { paramName: 'intentType', values: ['science'] }, { paramName: 't_min', values: [{ min: now - 45, max: now }] }, { paramName: 't_obs_release', values: [{ min: now - 45, max: now }] }] } };
    const res = await fetchOk(MAST, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ request: JSON.stringify(request) }) }, 90000);
    const rows = ((await res.json()).data ?? []).filter((r) => r.jpegURL && /^mast:(HST|JWST)\/product\//.test(r.jpegURL)).sort((a, b) => b.t_min - a.t_min);
    // one image per target and instrument: prefer combined (drizzled / i2d) products over single exposures
    const combined = (r) => /_(drz|drc|i2d)\.(jpg|png)$/.test(r.jpegURL);
    const best = new Map();
    for (const r of rows) {
      const key = `${r.target_name}|${r.instrument_name}`;
      const b = best.get(key);
      if (!b || (!combined(b) && combined(r))) best.set(key, r);
    }
    const images = [];
    for (const r of [...best.values()].sort((a, b) => b.t_min - a.t_min)) {
      images.push({ obsId: r.obs_id, target: r.target_name, instrument: r.instrument_name, filters: r.filters, observed: mjdToIso(r.t_min), released: mjdToIso(r.t_obs_release),
        exposureSec: r.t_exptime, ra: r.s_ra, dec: r.s_dec, program: r.proposal_id, pi: r.proposal_pi, title: r.obs_title, preview: `/api/observing/preview?uri=${encodeURIComponent(r.jpegURL)}` });
      if (images.length >= 24) break;
    }
    return { images, fetched: new Date().toISOString() };
  });
  return { mission, source: 'MAST (STScI): newest public calibrated images, one per target and instrument', ...got.value, cache: got.cache };
}

const PREVIEW = /^mast:(HST|JWST)\/product\/[A-Za-z0-9_.-]{1,160}\.(jpg|png)$/;
/** GET /api/observing/preview?uri=mast:… → the MAST preview JPEG/PNG, cached on disk (MAST URIs only). */
export async function preview(uri) {
  if (!PREVIEW.test(uri ?? '')) throw Object.assign(new Error('not a MAST preview uri'), { status: 400 });
  const file = path.join(config.dataDir, 'observing', `${crypto.createHash('sha1').update(uri).digest('hex').slice(0, 16)}${path.extname(uri)}`);
  const type = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
  try { return { body: await fs.readFile(file), type }; } catch { /* not cached yet */ }
  const res = await fetchOk(`https://mast.stsci.edu/api/v0.1/Download/file?uri=${encodeURIComponent(uri)}`, {}, 120000);
  const body = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  return { body, type };
}
