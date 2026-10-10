// Earth satellites: CelesTrak GP orbital elements (OMM) for every active satellite, tagged by
// category from CelesTrak's groups and by name, plus SATCAT metadata (owner, launch, size).
// CelesTrak asks clients not to re-download a group more than once every two hours, so
// everything is cached for 12 hours. https://celestrak.org/NORAD/documentation/gp-data-formats.php

import { cached } from './cache.js';
import { ucsRecord } from './ucs.js';

const GP = 'https://celestrak.org/NORAD/elements/gp.php';
const SATCAT = 'https://celestrak.org/satcat/records.php';
const HOURS_12 = 12 * 3600000;

// Category order matters: the first match wins.
export const CATEGORIES = ['stations', 'science', 'weather', 'earth', 'navigation', 'starlink', 'oneweb', 'comms', 'military', 'other'];
const GROUPS = { stations: 'stations', science: 'science', weather: 'weather', earth: 'resource', navigation: 'gnss', comms: 'geo', military: 'military' };
const BY_NAME = [[/^STARLINK/, 'starlink'], [/^ONEWEB/, 'oneweb'], [/^(IRIDIUM|GLOBALSTAR|ORBCOMM|KUIPER|INTELSAT|SES|EUTELSAT)/, 'comms'],
  [/^(FLOCK|LEMUR|DOVE|SKYSAT|WORLDVIEW|ICEYE|CAPELLA|LANDSAT|SENTINEL)/, 'earth']];

async function json(url, timeoutMs = 240000) {
  const res = await fetch(url, { headers: { 'user-agent': 'USS-Fidelity/0.3 (local astronomy explorer)' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
  const text = await res.text();
  if (!text.startsWith('[')) throw new Error(`CelesTrak: ${text.slice(0, 120)}`);
  return JSON.parse(text);
}

const group = (name) => cached('celestrak', `gp-${name}`, HOURS_12, () => json(`${GP}?GROUP=${name}&FORMAT=json`)).then((r) => r.value);

/** Compact catalogue: rows [norad, name, category, epoch ms, n, e, i, Ω, ω, M, B*, ṅ, n̈, intl designator]. */
export async function satellites() {
  const { value } = await cached('celestrak', 'catalogue-v1', HOURS_12, async () => {
    const all = await group('active');
    const cat = new Map();
    for (const [c, g] of Object.entries(GROUPS)) {
      try { for (const s of await group(g)) if (!cat.has(s.NORAD_CAT_ID)) cat.set(s.NORAD_CAT_ID, c); } catch { /* a missing group only loses tags */ }
    }
    const categoryOf = (s) => {
      const name = s.OBJECT_NAME.toUpperCase();
      const g = cat.get(s.NORAD_CAT_ID);
      if (g === 'stations' || g === 'science' || g === 'weather') return g;
      for (const [re, c] of BY_NAME) if (re.test(name)) return c;
      return g ?? 'other';
    };
    const rows = all.map((s) => [s.NORAD_CAT_ID, s.OBJECT_NAME, CATEGORIES.indexOf(categoryOf(s)), Date.parse(`${s.EPOCH}Z`),
      s.MEAN_MOTION, s.ECCENTRICITY, s.INCLINATION, s.RA_OF_ASC_NODE, s.ARG_OF_PERICENTER, s.MEAN_ANOMALY,
      s.BSTAR, s.MEAN_MOTION_DOT, s.MEAN_MOTION_DDOT, s.OBJECT_ID]);
    return { fetched: new Date().toISOString(), categories: CATEGORIES, rows, source: 'CelesTrak GP (18th Space Defense Squadron data)' };
  });
  return value;
}

/** SATCAT record for one satellite (owner, launch date and site, type, radar cross-section, orbit), with its UCS record as `UCS`. */
export async function satelliteDetail(norad) {
  const id = Number(norad);
  if (!Number.isInteger(id) || id <= 0 || id > 999999) throw Object.assign(new Error('bad NORAD id'), { status: 400 });
  const { value } = await cached('celestrak', 'satcat-active', 24 * 3600000, () => json(`${SATCAT}?GROUP=active&FORMAT=json`));
  const rec = value.find((r) => r.NORAD_CAT_ID === id);
  if (!rec) throw Object.assign(new Error(`satellite ${id} not in the active catalogue`), { status: 404 });
  // UCS detail (purpose, operator, mass, lifetime…) where the 2023 database has the satellite
  return { ...rec, UCS: await ucsRecord(id).catch(() => null) };
}
