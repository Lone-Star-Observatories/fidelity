#!/usr/bin/env node
// Build the weekly events feed (#32) → events/events.json. Run by .github/workflows/events.yml
// every week (and by hand: `npm run events`). Dependency-free, Node ≥ 20.
//
//   Launches & operations   The Space Devs Launch Library 2 (LL2_TOKEN optional, raises rate limits)
//   Celestial               the app's own ephemeris + IMO + JPL SBDB + NOAA SWPC
//   Live streams            YouTube channel RSS (YOUTUBE_API_KEY optional, adds live/upcoming state)
//
// A source that fails keeps its events from the previous file (marked stale) so one outage never
// empties the feed. Events that are over (past their end, modelled flight and date precision) are
// dropped, so each week's file holds only what is under way or still to come.
// Options: --out <file>, --days <n> (operations look-ahead, default 60).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA, validateFeed, elapsed } from '../../src/data/events-schema.js';
import { LL2, launchEvent, opsEvent, streamsFrom } from './ll2.js';
import { ephemerisEvents, meteorShowers, cometEvents, fetchComets, auroraEvents, useHorizonsEarth } from './sky.js';
import { CHANNELS, rssStreams, apiStreams, mergeStreams } from '../../server/youtube.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(root, 'events/events.json')));
const OPS_DAYS = Number(arg('--days', 60)), SKY_DAYS = 365, PAST_DAYS = 2; // look back only to catch events still under way
const UA = 'USS-Fidelity-events/1.0 (+https://github.com/Lone-Star-Observatories/fidelity)';

const now = Date.now(), jdNow = now / 86400000 + 2440587.5;
const isoMs = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const from = isoMs(now - PAST_DAYS * 86400e3), opsTo = isoMs(now + OPS_DAYS * 86400e3), skyTo = isoMs(now + SKY_DAYS * 86400e3);

async function fetchOk(url, headers = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(60000) }).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return res;
    if (attempt >= 2 || res.status === 404) throw new Error(`${url.split('?')[0]} → HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
}
const fetchJson = async (url, headers) => (await fetchOk(url, headers)).json();
const fetchText = async (url, headers) => (await fetchOk(url, headers)).text();
const ll2Headers = process.env.LL2_TOKEN ? { authorization: `Token ${process.env.LL2_TOKEN}` } : {};

let previous = null;
try { previous = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch { /* first run */ }
const keep = (pred) => (previous?.events ?? []).filter((e) => pred(e) && !elapsed(e, now)).map((e) => ({ ...e, stale: true }));

const sources = [], events = [];
async function source(id, meta, fn, fallback) {
  try {
    const got = await fn();
    events.push(...got);
    sources.push({ id, ...meta, status: 'ok', count: got.length });
    console.log(`  ${id}: ${got.length}`);
  } catch (err) {
    const old = fallback ? keep(fallback) : [];
    events.push(...old);
    sources.push({ id, ...meta, status: 'stale', error: String(err.message || err), count: old.length });
    console.warn(`  ${id}: FAILED (${err.message}); kept ${old.length} from the previous feed`);
  }
}

console.log(`Events feed ${from} → ${skyTo}`);

await source('ll2-launches', { name: 'The Space Devs — Launch Library 2 (launches)', url: 'https://thespacedevs.com/llapi', licence: 'Free API; attribution to The Space Devs' }, async () => {
  const q = (kind) => `${LL2}/launches/${kind}/?mode=detailed&limit=100&net__gte=${from}&net__lte=${opsTo}&ordering=net`;
  const seen = new Set(), out = [];
  for (const kind of ['previous', 'upcoming']) {
    for (const l of (await fetchJson(q(kind), ll2Headers)).results ?? []) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      out.push(launchEvent(l));
    }
  }
  return out;
}, (e) => e.category === 'launch');

await source('ll2-events', { name: 'The Space Devs — Launch Library 2 (events)', url: 'https://thespacedevs.com/llapi', licence: 'Free API; attribution to The Space Devs' }, async () => {
  const out = [];
  for (const [kind, lte] of [['previous', isoMs(now)], ['upcoming', skyTo]]) {
    const j = await fetchJson(`${LL2}/events/${kind}/?limit=100&date__gte=${from}&date__lte=${lte}&ordering=date`, ll2Headers);
    for (const e of j.results ?? []) {
      const ev = opsEvent(e);
      // near-term operations and anything with a definite date; far-off "sometime this year" items only for deep space
      if (ev && (Date.parse(ev.time) <= Date.parse(opsTo) || ev.category === 'deep-space')) out.push(ev);
    }
  }
  return out;
}, (e) => ['station', 'landing', 'deep-space', 'other'].includes(e.category));

const { monthlyVectors } = await import('../../server/horizons.js').catch(() => ({}));
const horizons = monthlyVectors ? await useHorizonsEarth(monthlyVectors, jdNow - PAST_DAYS - 2, jdNow + SKY_DAYS + 2) : false;
await source('ephemeris', { name: `Fidelity ephemeris: eclipses, transits, occultations, alignments (${horizons ? 'Sun from JPL Horizons' : 'Sun from Standish elements'})`, url: 'https://github.com/Lone-Star-Observatories/fidelity/blob/main/src/astro/eclipses.js', licence: 'MIT' },
  async () => ephemerisEvents(jdNow - PAST_DAYS, jdNow + SKY_DAYS, horizons ? 'horizons' : 'kepler'));
await source('meteors', { name: 'IMO Meteor Shower Calendar (solar longitudes, ZHR)', url: 'https://www.imo.net/resources/calendar/', licence: 'Facts; timing computed' },
  async () => meteorShowers(jdNow - PAST_DAYS, jdNow + SKY_DAYS));
await source('comets', { name: 'JPL Small-Body Database query API', url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html', licence: 'NASA/JPL public data' },
  async () => cometEvents(await fetchComets(fetchJson, jdNow, jdNow + 180), jdNow - PAST_DAYS, jdNow + 180), (e) => e.type === 'comet');
await source('aurora', { name: 'NOAA SWPC Kp forecast and 27-day outlook', url: 'https://www.swpc.noaa.gov/', licence: 'US Government public domain' }, async () => auroraEvents({
  kpForecast: await fetchJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'),
  outlookText: await fetchText('https://services.swpc.noaa.gov/text/27-day-outlook.txt'),
}, jdNow, jdNow + 28), (e) => e.type === 'aurora');

events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
// de-duplicate ids (an LL2 item can appear in both the previous and upcoming lists)
const all = [...new Map(events.map((e) => [e.id, e])).values()];
const unique = all.filter((e) => !elapsed(e, now));
console.log(`  dropped ${all.length - unique.length} elapsed`);

let rss = [], api = [];
try { rss = await rssStreams(fetchText, { now }); } catch (err) { console.warn(`  youtube rss: ${err.message}`); }
try { api = await apiStreams(fetchJson, process.env.YOUTUBE_API_KEY); } catch (err) { console.warn(`  youtube api: ${err.message}`); }
const streams = mergeStreams(streamsFrom(unique, now), api, rss);
sources.push({ id: 'youtube', name: `YouTube channel feeds${process.env.YOUTUBE_API_KEY ? ' + Data API' : ''}`, url: 'https://www.youtube.com/', licence: 'Embeds per YouTube Terms of Service', status: 'ok', count: streams.length });
console.log(`  streams: ${streams.length}`);

const feed = {
  schema: SCHEMA, generated: isoMs(now), window: { from, to: skyTo, operationsTo: opsTo },
  note: 'Times are UTC. REPORTED = published by the operator or agency (schedules slip); COMPUTED = from ephemerides; MODELLED = forecasts and generic flight paths.',
  sources, channels: CHANNELS, streams, events: unique,
};
const v = validateFeed(feed);
if (!v.ok) { console.error(v.problems.slice(0, 40).join('\n')); process.exit(1); }
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, `${JSON.stringify(feed)}\n`);
console.log(`Wrote ${unique.length} events, ${streams.length} streams → ${path.relative(root, OUT)} (${(JSON.stringify(feed).length / 1024).toFixed(0)} KB)`);
