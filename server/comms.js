// COMMS (#35): live communications for satellites and the Mars rovers.
//   SatNOGS   radio transmitters (DB) and the newest good observations (Network) of a satellite,
//             with waterfall and audio links: what amateur ground stations actually heard.
//   Mars      the newest raw images from Perseverance and Curiosity, and the rovers' weather reports.
// Everything is fetched on demand, cached on disk (server/cache.js) and rate-limited by the cache TTL.

import { cached } from './cache.js';
import { cachedBinary } from './imagery.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const MIN = 60000;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

async function getJson(url, timeoutMs = 45000) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).hostname} HTTP ${res.status}`), { status: 502 });
  return res.json();
}

// ---- SatNOGS ----------------------------------------------------------------------------------
const mhz = (hz) => (hz ? Math.round(hz / 1000) / 1000 : null);

/** SatNOGS DB transmitters → compact rows (frequencies in MHz). */
export function parseTransmitters(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((t) => t.status !== 'invalid')
    .map((t) => ({
      description: t.description, type: t.type, mode: t.mode ?? null, baud: t.baud ?? null,
      downlink: mhz(t.downlink_low), downlinkHigh: mhz(t.downlink_high), uplink: mhz(t.uplink_low), uplinkMode: t.uplink_mode ?? null,
      alive: !!t.alive, status: t.status, service: t.service ?? null, updated: t.updated ?? null, citation: t.citation ?? null,
    }))
    .sort((a, b) => (b.status === 'active') - (a.status === 'active') || (b.service === 'Amateur') - (a.service === 'Amateur') || (a.downlink ?? 1e9) - (b.downlink ?? 1e9));
}

/** SatNOGS Network observations → the newest finished ones, with their public products. */
export function parseObservations(rows, norad, now = Date.now()) {
  return (Array.isArray(rows) ? rows : [])
    .filter((o) => Number(o.norad_cat_id) === Number(norad) && Date.parse(o.end) <= now)
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))
    .slice(0, 8)
    .map((o) => ({
      id: o.id, start: o.start, end: o.end, status: o.status, station: o.station_name,
      lat: o.station_lat ?? null, lon: o.station_lng ?? null, maxAltitude: o.max_altitude ?? null,
      frequencyMhz: mhz(o.observation_frequency ?? o.transmitter_downlink_low),
      mode: o.transmitter_mode ?? null, description: o.transmitter_description ?? null,
      waterfall: o.waterfall || null, audio: o.payload || null, decoded: (o.demoddata ?? []).length,
      url: `https://network.satnogs.org/observations/${o.id}/`,
    }));
}

/** GET /api/comms/satnogs/:norad → { transmitters, observations, credit }. */
export async function satnogs(norad) {
  const id = Number(norad);
  if (!Number.isInteger(id) || id < 1 || id > 999999) throw bad('bad NORAD id');
  const [tx, obs] = await Promise.allSettled([
    cached('satnogs', `tx2-${id}`, 24 * 60 * MIN, async () => parseTransmitters(await getJson(`https://db.satnogs.org/api/transmitters/?satellite__norad_cat_id=${id}&format=json`))),
    cached('satnogs', `obs-${id}`, 20 * 60 * MIN, async () => parseObservations(await getJson(`https://network.satnogs.org/api/observations/?norad_cat_id=${id}&status=good&format=json`), id)),
  ]);
  if (tx.status === 'rejected' && obs.status === 'rejected') throw Object.assign(new Error(`SatNOGS unreachable: ${tx.reason?.message}`), { status: 502 });
  const part = (r) => (r.status === 'fulfilled' ? { rows: r.value.value, fetched: new Date(r.value.storedAt).toISOString(), cache: r.value.cache } : { rows: null, error: String(r.reason?.message ?? r.reason) });
  return {
    norad: id, transmitters: part(tx), observations: part(obs),
    credit: 'SatNOGS (Libre Space Foundation): DB transmitters and Network observations, CC BY-SA 4.0',
    links: { db: `https://db.satnogs.org/satellite/${id}`, network: `https://network.satnogs.org/observations/?norad=${id}` },
  };
}

// ---- Mars rovers --------------------------------------------------------------------------------
const ROVERS = {
  m20: {
    name: 'Perseverance', credit: 'NASA/JPL-Caltech (Mars 2020 raw images; unprocessed, may be distorted)',
    url: 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=100&page=0&order=sol+desc&extended=sample_type::full,',
    parse: (j) => (j.images ?? []).map((i) => ({
      id: i.imageid, sol: i.sol, taken: i.date_taken_utc ? `${i.date_taken_utc.replace(/(\.\d+)?Z?$/, '')}Z` : null, received: i.date_received ?? null,
      camera: i.camera?.instrument ?? '', title: i.title ?? '', thumb: i.image_files?.small ?? null, image: i.image_files?.large ?? i.image_files?.medium ?? null, link: i.link ?? null,
    })),
    weather: 'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json',
    weatherName: 'MEDA', weatherCredit: 'NASA/JPL-Caltech/CAB (Mars 2020 MEDA public weather feed)',
  },
  msl: {
    name: 'Curiosity', credit: 'NASA/JPL-Caltech (MSL raw images; unprocessed, may be distorted)',
    url: 'https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,date_taken%20desc&per_page=100&page=0&condition_1=msl:mission',
    parse: (j) => (j.items ?? []).filter((i) => !i.is_thumbnail).map((i) => ({
      id: i.imageid, sol: i.sol, taken: i.date_taken ?? null, received: i.date_received ?? null,
      camera: i.instrument ?? '', title: i.title ?? '', thumb: i.https_url ?? i.url ?? null, image: i.https_url ?? i.url ?? null,
      link: i.link ? `https://mars.nasa.gov${i.link}` : null,
    })),
    weather: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json',
    weatherName: 'REMS', weatherCredit: 'Centro de Astrobiología (CAB) / NASA/JPL-Caltech (MSL REMS; for outreach)',
  },
};
const RAW_HOST = /^https:\/\/mars\.nasa\.gov\/(mars2020-raw-images|msl-raw-images)\/[\w./-]+\.(jpe?g|png)$/i;

/** GET /api/comms/mars-raw/:rover → the newest raw images (thumbnails proxied through /api/comms/raw-image). */
export async function marsRaw(rover) {
  const r = ROVERS[rover];
  if (!r) throw bad('rover: m20 or msl');
  const { value, storedAt, cache } = await cached('mars-raw', `v2-${rover}`, 30 * MIN, async () => {
    // newest first, at most two per camera so one instrument's burst does not fill the strip
    const per = {};
    return r.parse(await getJson(r.url)).filter((i) => i.thumb && RAW_HOST.test(i.thumb) && (per[i.camera] = (per[i.camera] ?? 0) + 1) <= 2).slice(0, 12);
  });
  return { rover, name: r.name, images: value, fetched: new Date(storedAt).toISOString(), cache, credit: r.credit };
}

/** GET /api/comms/raw-image?url= → one raw image, only from the rovers' raw-image folders. */
export async function rawImage(url) {
  if (!RAW_HOST.test(url ?? '')) throw bad('not a rover raw image');
  const out = await cachedBinary(`mars-raw|${url}`, 30 * 86400000, async () => {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    const type = (res.headers.get('content-type') || '').split(';')[0].replace('image/jpg', 'image/jpeg');
    if (!res.ok || !/^image\/(jpeg|png)$/.test(type)) throw Object.assign(new Error(`raw image HTTP ${res.status} ${type}`), { status: 502 });
    return { body: Buffer.from(await res.arrayBuffer()), type };
  });
  return { body: out.body, type: out.type, maxAge: 7 * 86400 };
}

const num = (v) => (v === '--' || v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
/** The newest sol with any reading from a weather feed (REMS `soles` newest first; MEDA `sols` oldest first). */
export function parseWeather(j) {
  const sols = [...(j?.soles ?? j?.sols ?? [])].sort((a, b) => Number(b.sol) - Number(a.sol));
  const s = sols.find((x) => num(x.min_temp) != null || num(x.max_temp) != null || num(x.pressure) != null);
  if (!s) return null;
  return {
    sol: Number(s.sol), date: s.terrestrial_date, season: s.season ?? null, minC: num(s.min_temp), maxC: num(s.max_temp),
    pressurePa: num(s.pressure), opacity: s.atmo_opacity && s.atmo_opacity !== '--' ? s.atmo_opacity : null,
    uv: s.local_uv_irradiance_index && s.local_uv_irradiance_index !== '--' ? s.local_uv_irradiance_index : null,
    sunrise: s.sunrise ?? null, sunset: s.sunset ?? null,
  };
}

/** GET /api/comms/mars-weather/:rover → the latest published sol of REMS (Curiosity) or MEDA (Perseverance). */
export async function marsWeather(rover) {
  const r = ROVERS[rover];
  if (!r) throw bad('rover: m20 or msl');
  const { value, storedAt, cache } = await cached('mars-weather', `v1-${rover}`, 6 * 60 * MIN, async () => parseWeather(await getJson(r.weather, 60000)));
  return { rover, instrument: r.weatherName, latest: value, fetched: new Date(storedAt).toISOString(), cache, credit: r.weatherCredit };
}
