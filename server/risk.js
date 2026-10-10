// Impact-risk lists for Earth (#53): NASA CNEOS Sentry and the ESA NEOCC risk list, cached 12 h.
//   Sentry: https://ssd-api.jpl.nasa.gov/doc/sentry.html (JSON).
//   NEOCC:  https://neo.ssa.esa.int/risk-list (pipe-separated text, the "esa_risk_list" download).
// Each object: potential impact years, cumulative impact probability, Palermo (cumulative and
// maximum) and Torino scales, estimated diameter and impact speed.

import { cached } from './cache.js';

const UA = { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' };
const TTL = 12 * 3600000;
const num = (s) => { const v = Number(String(s ?? '').trim()); return String(s ?? '').trim() !== '' && Number.isFinite(v) ? v : null; };

/** Sentry's summary table → [{ des, name, years, ip, psCum, psMax, ts, diameterM, vInfKms, nImp, lastObs }]. */
export function parseSentry(json) {
  return (json?.data ?? []).map((r) => ({
    des: r.des, name: r.fullname?.trim() || r.des,
    years: r.range, ip: num(r.ip), psCum: num(r.ps_cum), psMax: num(r.ps_max), ts: num(r.ts_max),
    diameterM: num(r.diameter) != null ? num(r.diameter) * 1000 : null, vInfKms: num(r.v_inf), nImp: r.n_imp ?? null, lastObs: r.last_obs ?? null,
  }));
}

/** The NEOCC risk-list text → [{ des, name, diameterM, date, ipMax, psMax, ts, vKms, years, ipCum, psCum }]. */
export function parseNeocc(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const f = line.split('|').map((s) => s.trim());
    if (f.length < 11 || !/^\d{4}-\d\d-\d\d/.test(f[3] ?? '')) continue; // header and unit rows have no date
    const [desName, diam, , date, ipMax, psMax, ts, vel, years, ipCum, psCum] = f;
    const m = desName.match(/^(\S+)\s*(.*)$/);
    out.push({ des: m?.[1] ?? desName, name: m?.[2] || null, diameterM: num(diam), date, ipMax: num(ipMax), psMax: num(psMax), ts: num(ts), vKms: num(vel), years, ipCum: num(ipCum), psCum: num(psCum) });
  }
  return out;
}

async function sentry() {
  const res = await fetch('https://ssd-api.jpl.nasa.gov/sentry.api', { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Sentry HTTP ${res.status}`);
  const json = await res.json();
  return { rows: parseSentry(json) };
}
async function neocc() {
  const res = await fetch('https://neo.ssa.esa.int/PSDB-portlet/download?file=esa_risk_list', { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`NEOCC HTTP ${res.status}`);
  const text = await res.text();
  return { updated: text.match(/Last Update:\s*([0-9-]+ [0-9:]+ UTC)/)?.[1] ?? null, rows: parseNeocc(text) };
}

/** Both lists, sorted by cumulative Palermo scale (most significant first). */
export async function impactRisk() {
  const [s, e] = await Promise.all([
    cached('risk', 'sentry', TTL, sentry).catch((err) => ({ error: err.message })),
    cached('risk', 'neocc', TTL, neocc).catch((err) => ({ error: err.message })),
  ]);
  const byPs = (a, b) => (b.psCum ?? -99) - (a.psCum ?? -99);
  return {
    sentry: s.value ? { fetched: new Date(s.storedAt).toISOString(), cache: s.cache, count: s.value.rows.length, rows: [...s.value.rows].sort(byPs) } : { error: s.error },
    neocc: e.value ? { fetched: new Date(e.storedAt).toISOString(), cache: e.cache, updated: e.value.updated, count: e.value.rows.length, rows: [...e.value.rows].sort(byPs) } : { error: e.error },
  };
}
