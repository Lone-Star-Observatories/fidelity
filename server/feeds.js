// Live feeds from spacecraft: the latest images and telemetry, fetched on demand and cached
// briefly on disk. Only the feeds listed here can be fetched (the backend is not an open
// proxy). Every response carries the observation time so the UI can badge its age.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const MIN = 60000;
const isoDay = (d) => d.toISOString().slice(0, 10);
const yesterday = () => isoDay(new Date(Date.now() - 86400000));

async function fetchOk(url, timeoutMs = 60000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  return res;
}
const lastModified = (res) => (res.headers.get('last-modified') ? new Date(res.headers.get('last-modified')).toISOString() : null);

const gibs = (layer, credit) => ({
  type: 'image', ttl: 6 * 60 * MIN, credit,
  async get() {
    const day = yesterday(); // yesterday's mosaic is complete; today's is still filling in
    const q = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, CRS: 'EPSG:4326',
      BBOX: '-90,-180,90,180', WIDTH: '2048', HEIGHT: '1024', FORMAT: 'image/jpeg', TIME: day });
    const res = await fetchOk(`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`);
    return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time: `${day}T12:00:00Z` };
  },
});
// Helioviewer source ids: AIA 193 = 11, AIA 304 = 13, HMI continuum = 18.
const helioviewer = (sourceId, layer, credit) => ({
  type: 'image', ttl: 15 * MIN, credit,
  async get() {
    const now = new Date().toISOString().slice(0, 19) + 'Z';
    const closest = await (await fetchOk(`https://api.helioviewer.org/v2/getClosestImage/?date=${now}&sourceId=${sourceId}`)).json().catch(() => null);
    const q = `date=${now}&imageScale=2.42&layers=[${layer},1,100]&x0=0&y0=0&width=1024&height=1024&display=true`;
    const res = await fetchOk(`https://api.helioviewer.org/v2/takeScreenshot/?${q}`, 90000);
    // fraction of the image width covered by the solar radius (for projecting the disk onto a sphere)
    const disk = closest?.rsun && closest?.scale ? (closest.rsun * closest.scale) / (2.42 * 1024) : null;
    return { body: Buffer.from(await res.arrayBuffer()), type: 'image/png', time: closest?.date ? `${closest.date.replace(' ', 'T')}Z` : now, disk };
  },
});
const goes = (sat, credit) => ({
  type: 'image', ttl: 10 * MIN, credit,
  async get() {
    const res = await fetchOk(`https://cdn.star.nesdis.noaa.gov/${sat}/ABI/FD/GEOCOLOR/1808x1808.jpg`);
    return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time: lastModified(res) };
  },
});
const swpc = (file, keep, credit) => ({
  type: 'json', ttl: 5 * MIN, credit,
  async get() {
    const rows = await (await fetchOk(`https://services.swpc.noaa.gov/json/${file}`)).json();
    const out = keep(rows);
    return { body: out, time: out.at?.(-1)?.time_tag ?? null };
  },
});

export const FEEDS = {
  'goes-east': goes('GOES19', 'NOAA/NESDIS STAR, GOES-19 ABI GeoColor full disk'),
  'goes-west': goes('GOES18', 'NOAA/NESDIS STAR, GOES-18 ABI GeoColor full disk'),
  himawari: {
    type: 'image', ttl: 10 * MIN, credit: 'NICT / JMA, Himawari-9 AHI true colour full disk',
    async get() {
      const latest = await (await fetchOk('https://himawari8.nict.go.jp/img/D531106/latest.json')).json();
      const [d, t] = latest.date.split(' ');
      const res = await fetchOk(`https://himawari8.nict.go.jp/img/D531106/1d/550/${d.replaceAll('-', '/')}/${t.replaceAll(':', '')}_0_0.png`);
      return { body: Buffer.from(await res.arrayBuffer()), type: 'image/png', time: `${d}T${t}Z` };
    },
  },
  'sdo-193': helioviewer(11, 'SDO,AIA,AIA,193', 'NASA SDO AIA 193 Å (corona, 1.5 million K), via Helioviewer'),
  'sdo-304': helioviewer(13, 'SDO,AIA,AIA,304', 'NASA SDO AIA 304 Å (chromosphere), via Helioviewer'),
  'sdo-hmi': helioviewer(18, 'SDO,HMI,HMI,continuum', 'NASA SDO HMI continuum (visible photosphere, sunspots), via Helioviewer'),
  'gibs-terra': gibs('MODIS_Terra_CorrectedReflectance_TrueColor', 'NASA GIBS, Terra MODIS corrected reflectance (yesterday)'),
  'gibs-aqua': gibs('MODIS_Aqua_CorrectedReflectance_TrueColor', 'NASA GIBS, Aqua MODIS corrected reflectance (yesterday)'),
  'gibs-snpp': gibs('VIIRS_SNPP_CorrectedReflectance_TrueColor', 'NASA GIBS, Suomi NPP VIIRS corrected reflectance (yesterday)'),
  'gibs-noaa20': gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor', 'NASA GIBS, NOAA-20 VIIRS corrected reflectance (yesterday)'),
  'gibs-noaa21': gibs('VIIRS_NOAA21_CorrectedReflectance_TrueColor', 'NASA GIBS, NOAA-21 VIIRS corrected reflectance (yesterday)'),
  epic: {
    type: 'image', ttl: 2 * 60 * MIN, credit: 'NASA EPIC team, DSCOVR EPIC natural colour (from L1, 1.5 million km)',
    async get() {
      const list = await (await fetchOk('https://epic.gsfc.nasa.gov/api/natural')).json();
      const last = list.at(-1);
      const [d] = last.date.split(' ');
      const res = await fetchOk(`https://epic.gsfc.nasa.gov/archive/natural/${d.replaceAll('-', '/')}/jpg/${last.image}.jpg`);
      return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time: `${last.date.replace(' ', 'T')}Z` };
    },
  },
  'solar-wind': swpc('rtsw/rtsw_wind_1m.json', (r) => r.filter((x) => x.active).slice(0, 180).reverse()
    .map(({ time_tag, proton_speed, proton_density, proton_temperature, source }) => ({ time_tag, proton_speed, proton_density, proton_temperature, source })),
  'NOAA SWPC real-time solar wind (DSCOVR / ACE at L1)'),
  'solar-mag': swpc('rtsw/rtsw_mag_1m.json', (r) => r.filter((x) => x.active).slice(0, 180).reverse()
    .map(({ time_tag, bt, bz_gsm, source }) => ({ time_tag, bt, bz_gsm, source })), 'NOAA SWPC real-time interplanetary magnetic field (DSCOVR / ACE)'),
  'goes-xray': swpc('goes/primary/xrays-1-day.json', (r) => r.filter((x) => x.energy === '0.1-0.8nm').slice(-360)
    .map(({ time_tag, flux, satellite }) => ({ time_tag, flux, satellite })), 'NOAA SWPC, GOES primary X-ray sensor (solar flares)'),
  crew: {
    type: 'json', ttl: 6 * 60 * MIN, credit: 'People in space: corquaid/international-space-station-APIs (community-maintained)',
    async get() {
      const j = await (await fetchOk('https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json')).json();
      const people = (j.people ?? []).map(({ name, country, agency, position, spacecraft, iss, launched }) => ({ name, country, agency, position, spacecraft, iss, launched }));
      return { body: { expedition: j.iss_expedition ?? null, people }, time: new Date().toISOString() };
    },
  },
};

const dir = path.join(config.dataDir, 'feeds');
const inflight = new Map();

/** Latest value of feed `id`: { body, type, time, credit, fetched, cache }. Serves a stale copy if the source is down. */
export async function feed(id) {
  const f = FEEDS[id];
  if (!f) throw Object.assign(new Error(`unknown feed ${id}`), { status: 404 });
  const metaFile = path.join(dir, `${id}.json`), bodyFile = path.join(dir, `${id}.bin`);
  let meta = null;
  try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch { /* none */ }
  const read = async (cache) => ({ ...meta, credit: f.credit, cache, body: f.type === 'image' ? await fs.readFile(bodyFile) : meta.body });
  if (meta && Date.now() - Date.parse(meta.fetched) < f.ttl) return read('hit');
  if (!inflight.has(id)) {
    inflight.set(id, (async () => {
      try {
        const got = await f.get();
        await fs.mkdir(dir, { recursive: true });
        meta = { type: got.type ?? 'application/json', time: got.time, disk: got.disk ?? null, fetched: new Date().toISOString(), ...(f.type === 'json' ? { body: got.body } : {}) };
        if (f.type === 'image') await fs.writeFile(bodyFile, got.body);
        await fs.writeFile(metaFile, JSON.stringify(meta));
        return read('miss');
      } catch (err) {
        if (meta) return read('stale');
        throw err;
      }
    })().finally(() => inflight.delete(id)));
  }
  return inflight.get(id);
}

/** Feed list with credits (for the UI). */
export const feedList = () => Object.fromEntries(Object.entries(FEEDS).map(([id, f]) => [id, { type: f.type, credit: f.credit }]));
