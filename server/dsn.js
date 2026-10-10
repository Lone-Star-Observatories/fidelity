// DSN Now: which spacecraft NASA's Deep Space Network antennas are talking to right now
// (Goldstone, Madrid, Canberra), with data rates, received power and range. The feed's
// spacecraftID is the negative NAIF id, the same id JPL Horizons uses.
// https://eyes.nasa.gov/dsn/dsn.html

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const URL_DSN = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
let memo = null; // { at, value }
// COMMS (#35): when this backend last saw each craft in contact, kept on disk across restarts.
const lastFile = path.join(config.dataDir, 'cache', 'dsn', 'last-seen.json');
let lastSeen = null;

/** Fold contacts into the last-seen map { [spacecraftId]: { at, station, dish, band, code } }. */
export function updateLastSeen(map, contacts, at) {
  for (const c of contacts) map[c.spacecraftId] = { at, station: c.station, dish: c.dish, band: c.down?.band ?? c.up?.band ?? null, code: c.code };
  return map;
}

const attrs = (s) => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** Parse dsn.xml into dishes with their station and signals. */
export function parseDsn(xml) {
  const out = [];
  let station = null, time = null;
  for (const m of xml.matchAll(/<(station|dish)\b([^>]*?)(\/?)>([\s\S]*?(?=<station\b|<dish\b|<\/dsn>))?/g)) {
    const a = attrs(m[2]);
    if (m[1] === 'station') { station = a.friendlyName; time = Number(a.timeUTC); continue; }
    const body = m[4] ?? '';
    const sig = (tag) => [...body.matchAll(new RegExp(`<${tag}\\b([^>]*)/>`, 'g'))].map((x) => attrs(x[1]))
      .filter((s) => s.active === 'true' && s.spacecraftID && Number(s.spacecraftID) < 0 && Number(s.spacecraftID) !== -99);
    const targets = [...body.matchAll(/<target\b([^>]*)\/>/g)].map((x) => attrs(x[1]));
    const down = sig('downSignal'), up = sig('upSignal');
    const ids = new Set([...down, ...up].map((s) => Number(s.spacecraftID)));
    for (const id of ids) {
      const t = targets.find((x) => Number(x.id) === -id) ?? {};
      const d = down.find((s) => Number(s.spacecraftID) === id), u = up.find((s) => Number(s.spacecraftID) === id);
      out.push({
        station, dish: a.name, activity: a.activity, elevation: Number(a.elevationAngle), azimuth: Number(a.azimuthAngle),
        spacecraftId: id, code: (d ?? u).spacecraft,
        down: d ? { rate: Number(d.dataRate), power: Number(d.power), band: d.band, type: d.signalType } : null,
        up: u ? { rate: Number(u.dataRate), power: Number(u.power), band: u.band } : null,
        rangeKm: Number(t.downlegRange) > 0 ? Number(t.downlegRange) : null, rtltSec: Number(t.rtlt) > 0 ? Number(t.rtlt) : null,
        time,
      });
    }
  }
  return out;
}

/** Current DSN contacts, refreshed at most every 20 s. */
export async function dsnNow() {
  if (memo && Date.now() - memo.at < 20000) return memo.value;
  const res = await fetch(`${URL_DSN}?r=${Math.floor(Date.now() / 5000)}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`DSN HTTP ${res.status}`);
  const contacts = parseDsn(await res.text());
  const time = new Date().toISOString();
  lastSeen ??= await fs.readFile(lastFile, 'utf8').then(JSON.parse).catch(() => ({}));
  updateLastSeen(lastSeen, contacts, time);
  fs.mkdir(path.dirname(lastFile), { recursive: true }).then(() => fs.writeFile(lastFile, JSON.stringify(lastSeen))).catch(() => {});
  memo = { at: Date.now(), value: { time, contacts, lastSeen, source: 'NASA DSN Now' } };
  return memo.value;
}
