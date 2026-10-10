// Live signals across the Earth (#35): where you can listen to or watch the planet right now.
// Each layer is fetched on demand, cached on disk and reduced to compact markers
//   [lat, lon, name, href, detail, extra?]
// so the browser draws thousands of them on a map without talking to any third party.
//
// Sources are only those with open terms (or, for the KiwiSDR list, a mirror published for
// map makers). WebSDR.org's list says it "may not be re-used ... without prior permission" and
// Radio Garden has no public API: both are links only, awaiting permission.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cached } from './cache.js';
import { config } from './config.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const MIN = 60000, HOUR = 60 * MIN;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const r4 = (x) => Math.round(Number(x) * 1e4) / 1e4;
const okLatLon = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
const clip = (s, n = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const httpUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? String(u) : null);

async function get(url, { timeoutMs = 60000, headers = {}, as = 'json' } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).hostname} HTTP ${res.status}`), { status: 502 });
  return as === 'json' ? res.json() : res.text();
}

// ---- parsers (exported for tests) ----------------------------------------------------------------

/** Radio Browser stations → markers (homepage, stream URL, country · tags · codec). */
export function parseRadioBrowser(rows) {
  const out = [], seen = new Set();
  for (const s of Array.isArray(rows) ? rows : []) {
    const lat = Number(s.geo_lat), lon = Number(s.geo_long);
    const stream = httpUrl(s.url_resolved) ?? httpUrl(s.url);
    if (s.geo_lat == null || s.geo_long == null || !okLatLon(lat, lon) || !stream || seen.has(s.stationuuid)) continue;
    seen.add(s.stationuuid);
    const detail = [s.country, clip(s.tags, 40), s.codec && `${s.codec}${s.bitrate ? ` ${s.bitrate} kb/s` : ''}`].filter(Boolean).join(' · ');
    out.push([r4(lat), r4(lon), clip(s.name), httpUrl(s.homepage) ?? stream, detail, stream]);
  }
  return out;
}

/** The KiwiSDR public list (dyatlov mirror, a JS file: `var kiwisdr_com = [ … ];`) → markers. */
export function parseKiwiList(js) {
  const m = String(js).match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
  let rows = [];
  try { rows = JSON.parse((m?.[1] ?? '[]').replace(/,\s*([\]}])/g, '$1')); } catch { rows = []; } // the file has trailing commas
  const out = [];
  for (const k of rows) {
    if (k.status !== 'active' || k.offline === 'yes') continue;
    const g = String(k.gps ?? '').match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
    const url = httpUrl(k.url);
    if (!g || !url) continue;
    const lat = Number(g[1]), lon = Number(g[2]);
    if (!okLatLon(lat, lon)) continue;
    const [lo, hi] = String(k.bands ?? '').split('-').map(Number);
    const band = Number.isFinite(lo) && Number.isFinite(hi) && hi > 0 ? `${(lo / 1e6).toFixed(0)}–${(hi / 1e6).toFixed(0)} MHz` : null;
    const users = Number(k.users), max = Number(k.users_max);
    out.push([r4(lat), r4(lon), clip(k.name), url, [band, Number.isFinite(users) && max ? `${users}/${max} LISTENING` : null, clip(k.antenna, 60)].filter(Boolean).join(' · '),
      Number.isFinite(users) && max ? (users < max ? 1 : 0) : null]);
  }
  return out;
}

/** TfL JamCams (Place/Type/JamCam) → markers linking to the current still. */
export function parseTfl(rows) {
  const out = [];
  for (const p of Array.isArray(rows) ? rows : []) {
    const prop = (k) => p.additionalProperties?.find((a) => a.key === k)?.value;
    if (prop('available') === 'false' || !okLatLon(p.lat, p.lon)) continue;
    const img = httpUrl(prop('imageUrl'));
    if (!img) continue;
    out.push([r4(p.lat), r4(p.lon), clip(p.commonName), img, `TfL JAMCAM · LONDON${prop('view') ? ` · VIEW ${prop('view').toUpperCase()}` : ''}`, httpUrl(prop('videoUrl'))]);
  }
  return out;
}

/** Caltrans CWWP2 CCTV status JSON (one district) → markers. */
export function parseCaltrans(j) {
  const out = [];
  for (const d of j?.data ?? []) {
    const c = d.cctv;
    if (!c || c.inService === 'false') continue;
    const lat = Number(c.location?.latitude), lon = Number(c.location?.longitude);
    const img = httpUrl(c.imageData?.static?.currentImageURL);
    if (!okLatLon(lat, lon) || !img) continue;
    const stream = httpUrl(c.imageData?.streamingVideoURL);
    out.push([r4(lat), r4(lon), clip(c.location.locationName), img, `CALTRANS D${c.location.district} · ${clip(c.location.nearbyPlace, 30).toUpperCase()}`, stream]);
  }
  return out;
}

/** NZ Transport Agency (Waka Kotahi) traffic cameras XML → markers. */
export function parseNzta(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<camera>([\s\S]*?)<\/camera>/g)) {
    const tag = (t) => m[1].match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    // top-level latitude/longitude come after the nested journey block, so take the last match
    const last = (t) => [...m[1].matchAll(new RegExp(`<${t}>([^<]*)</${t}>`, 'g'))].at(-1)?.[1];
    if (tag('offline') === 'true' || tag('underMaintenance') === 'true') continue;
    const lat = Number(last('latitude')), lon = Number(last('longitude'));
    const img = tag('imageUrl');
    if (!okLatLon(lat, lon) || !img) continue;
    out.push([r4(lat), r4(lon), clip(tag('name')), `https://trafficnz.info${img}`, `NZTA · ${clip(tag('description'), 60).toUpperCase()}`, null]);
  }
  return out;
}

/** Windy Webcams API v3 → markers (needs FIDELITY_WINDY_KEY; the key never leaves the backend). */
export function parseWindy(j) {
  const out = [];
  for (const w of j?.webcams ?? []) {
    const lat = Number(w.location?.latitude), lon = Number(w.location?.longitude);
    const href = httpUrl(w.urls?.detail) ?? httpUrl(w.player?.day);
    if (!okLatLon(lat, lon) || !href) continue;
    out.push([r4(lat), r4(lon), clip(w.title), href, `WINDY · ${clip([w.location?.city, w.location?.country].filter(Boolean).join(', '), 40).toUpperCase()}`, httpUrl(w.player?.day)]); // extra: Windy's embeddable player (COMMS on screen, #69)
  }
  return out;
}

// ---- Radio Garden, from a local export (#69) ----------------------------------------------------
// Radio Garden has no public API; a user-supplied export ({ "Place,CC": { coords: { n, e }, urls: [{ name,
// url }] } }) in data/radio-garden/stations.json (or FIDELITY_RADIO_GARDEN_FILE) is read locally and never
// committed or redistributed. The map gets one marker per place; a place's streams load on demand.
export const radioGardenFile = () => process.env.FIDELITY_RADIO_GARDEN_FILE || path.join(config.dataDir, 'radio-garden', 'stations.json');
let rg = null;
/** Parse an export (it may contain bare NaN) → { places: [{ name, country, lat, lon, streams }], urls: Set }. */
export function parseRadioGarden(text) {
  const j = JSON.parse(String(text).replace(/:\s*NaN\b/g, ': null'));
  const places = [], urls = new Set();
  for (const [key, v] of Object.entries(j ?? {})) {
    const lat = Number(v?.coords?.n), lon = Number(v?.coords?.e);
    if (!okLatLon(lat, lon)) continue;
    const streams = (v.urls ?? []).map((u) => ({ name: clip(u?.name ?? 'Unnamed station', 60) || 'Unnamed station', url: httpUrl(u?.url) })).filter((u) => u.url);
    if (!streams.length) continue;
    for (const u of streams) urls.add(u.url);
    const [name, country] = key.split(',');
    places.push({ name: clip(name), country: clip(country ?? '', 4), lat: r4(lat), lon: r4(lon), streams });
  }
  return { places, urls };
}
async function radioGarden() {
  rg ??= fs.readFile(radioGardenFile(), 'utf8').then(parseRadioGarden).catch((err) => { rg = null; throw err; });
  return rg;
}
/** GET /api/signals/radiogarden/place?i= → that place's streams. */
export async function radioGardenPlace(i) {
  const { places } = await radioGarden();
  const p = places[Number(i)];
  if (!p) throw Object.assign(new Error('unknown place'), { status: 404 });
  return p;
}
/** Is `url` a stream in the local Radio Garden export? */
export async function radioGardenHas(url) { try { return (await radioGarden()).urls.has(url); } catch { return false; } }

// ---- layers -------------------------------------------------------------------------------------

const RADIO_SERVERS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info'];
const CALTRANS_DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const LAYERS = {
  radio: {
    label: 'RADIO STATIONS', kind: 'audio', ttl: 12 * HOUR,
    credit: 'Radio Browser (radio-browser.info): community-run open database of internet radio stations; free to use. Every station with a location (about 13,000; those without coordinates cannot be mapped).',
    licence: 'Open data, free to use (radio-browser.info)', home: 'https://www.radio-browser.info/',
    async get() {
      let last;
      for (const host of RADIO_SERVERS) {
        try {
          return parseRadioBrowser(await get(`https://${host}/json/stations/search?has_geo_info=true&hidebroken=true&order=clickcount&reverse=true&limit=100000`, { timeoutMs: 240000 })); // ~17 MB, cached 12 h
        } catch (err) { last = err; }
      }
      throw last;
    },
  },
  radiogarden: {
    label: 'RADIO GARDEN · LOCAL EXPORT', kind: 'audio', ttl: 0, local: true,
    credit: 'Radio Garden station list, from an export you supplied (data/radio-garden/stations.json). Read locally; not redistributed. Radio Garden has no public API.',
    licence: 'Your local copy; Radio Garden (radio.garden) owns its directory', home: 'https://radio.garden/',
    // [lat, lon, place, homepage, detail, first stream, { place index, streams }]
    async get() { return (await radioGarden()).places.map((p, i) => [p.lat, p.lon, p.name, 'https://radio.garden/', `${p.country} · ${p.streams.length} STATION${p.streams.length > 1 ? 'S' : ''}`, p.streams[0].url, { rg: i, n: p.streams.length }]); },
  },
  kiwisdr: {
    label: 'SDR RECEIVERS · KIWISDR', kind: 'sdr', ttl: HOUR,
    credit: 'KiwiSDR public receiver list (kiwisdr.com/public), via the dyatlov map-maker mirror at rx.linkfanel.net. Each receiver belongs to its operator; listening is free, with time limits on some.',
    licence: 'Public list, mirrored for map makers; receivers are the operators\' own', home: 'http://kiwisdr.com/public/',
    async get() { return parseKiwiList(await get('http://rx.linkfanel.net/kiwisdr_com.js', { as: 'text' })); },
  },
  traffic: {
    label: 'TRAFFIC CAMERAS', kind: 'camera', ttl: 6 * HOUR,
    credit: 'Powered by TfL Open Data (JamCams; contains OS data © Crown copyright and database rights); Caltrans CWWP2 CCTV (public); NZ Transport Agency Waka Kotahi traffic cameras (CC BY 4.0). Stills refresh every 1–5 minutes.',
    licence: 'TfL Open Data licence · Caltrans public data · CC BY 4.0 (NZTA)', home: 'https://api.tfl.gov.uk/',
    async get() {
      const parts = await Promise.allSettled([
        get('https://api.tfl.gov.uk/Place/Type/JamCam').then(parseTfl),
        get('https://trafficnz.info/service/traffic/rest/4/cameras/all', { as: 'text', headers: { accept: 'application/xml' } }).then(parseNzta),
        ...CALTRANS_DISTRICTS.map((d) => get(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, '0')}.json`).then(parseCaltrans)),
      ]);
      const ok = parts.filter((p) => p.status === 'fulfilled').flatMap((p) => p.value);
      if (!ok.length) throw parts.find((p) => p.status === 'rejected')?.reason ?? new Error('no traffic cameras');
      return ok;
    },
  },
  windy: {
    label: 'WEBCAMS · WINDY', kind: 'camera', ttl: 6 * HOUR, needsKey: 'FIDELITY_WINDY_KEY',
    credit: 'Windy Webcams API (windy.com): webcams contributed by their owners. Needs a free API key in FIDELITY_WINDY_KEY on the backend.',
    licence: 'Windy Webcams API terms (attribution, key required)', home: 'https://api.windy.com/webcams',
    async get() {
      const key = process.env.FIDELITY_WINDY_KEY;
      const out = [];
      for (let offset = 0; offset < 1000; offset += 50) { // the free tier pages 50 at a time
        const page = parseWindy(await get(`https://api.windy.com/webcams/api/v3/webcams?limit=50&offset=${offset}&include=location,urls`, { headers: { 'x-windy-api-key': key } }));
        out.push(...page);
        if (page.length < 50) break;
      }
      return out;
    },
  },
};

/** GET /api/signals → the layers, their credit and licence, and whether each is available here. */
export function signalLayers() {
  return {
    layers: Object.entries(LAYERS).map(([id, l]) => ({ id, label: l.label, kind: l.kind, credit: l.credit, licence: l.licence, home: l.home,
      available: l.local ? existsSync(radioGardenFile()) : !l.needsKey || !!process.env[l.needsKey], needsKey: l.needsKey ?? null, needsFile: l.local ? radioGardenFile() : null })),
    linksOnly: [
      { label: 'WEBSDR.ORG', home: 'http://websdr.org/', note: 'The WebSDR list may not be re-used in another site or automated system without permission: link only, awaiting permission.' },
    ],
  };
}

/** GET /api/signals/:layer → { layer, markers: [[lat, lon, name, href, detail, extra]], fetched, credit }. */
export async function signalLayer(id) {
  const l = Object.hasOwn(LAYERS, id) ? LAYERS[id] : null;
  if (!l) throw bad('unknown layer');
  if (l.needsKey && !process.env[l.needsKey]) throw Object.assign(new Error(`${l.label} needs ${l.needsKey} on the backend`), { status: 404 });
  if (l.local) { // read straight from the local file each time (no cache copy of someone else's directory)
    try { const markers = await l.get(); return { layer: id, label: l.label, kind: l.kind, count: markers.length, markers, fetched: null, cache: 'local', error: null, credit: l.credit, licence: l.licence }; }
    catch { throw Object.assign(new Error(`${l.label}: put the export at ${radioGardenFile()}`), { status: 404 }); }
  }
  const { value, storedAt, cache, error } = await cached('signals', `${id === 'radio' ? 'v2' : 'v1'}-${id}`, l.ttl, () => l.get());
  return { layer: id, label: l.label, kind: l.kind, count: value.length, markers: value, fetched: new Date(storedAt).toISOString(), cache, error: error ?? null, credit: l.credit, licence: l.licence };
}
