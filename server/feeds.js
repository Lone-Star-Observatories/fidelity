// Live feeds from spacecraft: the latest images and telemetry, fetched on demand and cached
// briefly on disk. Only the feeds listed here can be fetched (the backend is not an open
// proxy). Every response carries the observation time so the UI can badge its age.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { WEBCAMS } from './webcams.js';
import { norhFeed } from './solarradio.js';
import { srhFeed, sunModelFeed } from './solarmodel.js';

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
// SDO AIA/HMI and SOHO LASCO ids: 4 C2, 5 C3, 8–16 AIA 94…1700, 18 HMI continuum, 19 HMI magnetogram.
const helioviewer = (sourceId, layer, credit, scale0 = 2.42) => ({
  type: 'image', ttl: 15 * MIN, credit, preview: true,
  // preview (#62): the same field of view at 256×256 (four times the arcsec per pixel)
  async get({ preview = false } = {}) {
    const px = preview ? 256 : 1024, scale = scale0 * (1024 / px);
    const now = new Date().toISOString().slice(0, 19) + 'Z';
    const closest = await (await fetchOk(`https://api.helioviewer.org/v2/getClosestImage/?date=${now}&sourceId=${sourceId}`)).json().catch(() => null);
    const q = `date=${now}&imageScale=${scale}&layers=[${layer},1,100]&x0=0&y0=0&width=${px}&height=${px}&display=true`;
    const res = await fetchOk(`https://api.helioviewer.org/v2/takeScreenshot/?${q}`, 90000);
    // fraction of the image width covered by the solar radius (for projecting the disk onto a sphere)
    const disk = closest?.rsun && closest?.scale ? (closest.rsun * closest.scale) / (scale * px) : null;
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

// Mars rovers: the newest full-frame raw image from a navigation, mast or hazard camera
// (raw images reach NASA's public site within hours of downlink; nothing from Mars is live video).
// newest image from the first camera family that has one (navigation views beat solar or arm close-ups)
const pickRaw = (rows, res) => res.map((re) => rows.find((r) => re.test(r.instrument))).find(Boolean) ?? rows[0];
const marsRaw = (mission, credit) => ({
  type: 'image', ttl: 30 * MIN, credit,
  async get() {
    let img;
    if (mission === 'm20') {
      const j = await (await fetchOk('https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=100&page=0&order=sol+desc&extended=sample_type::full,')).json();
      const rows = (j.images ?? []).map((r) => ({ instrument: r.camera?.instrument ?? '', url: r.image_files?.large ?? r.image_files?.full_res, sol: r.sol, taken: r.date_taken_utc, title: r.title }));
      img = pickRaw(rows, [/NAVCAM/, /HAZ/, /MCZ/]);
    } else {
      const j = await (await fetchOk('https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,date_taken%20desc&per_page=100&page=0&condition_1=msl:mission')).json();
      const rows = (j.items ?? []).filter((r) => !r.is_thumbnail && r.extended?.sample_type === 'full').map((r) => ({ instrument: r.instrument ?? '', url: r.https_url ?? r.url, sol: r.sol, taken: r.date_taken, title: r.title }));
      img = pickRaw(rows, [/NAV/, /HAZ/, /MAST/]);
    }
    if (!img?.url) throw new Error('no raw images listed');
    const res = await fetchOk(img.url.replace(/^http:/, 'https:'));
    const time = img.taken ? `${img.taken.replace(/Z$/, '').slice(0, 19)}Z` : lastModified(res);
    return { body: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') || 'image/jpeg', time,
      credit: `${credit} · sol ${img.sol} · ${img.instrument.replace(/_/g, ' ')}` };
  },
});

// Observatory webcams (#37), from the allowlist in webcams.js. Some sites refuse non-browser agents.
//   mjpeg: an Axis-style multipart stream: the first complete JPEG frame is kept.
//   narit: NARIT's sky-camera API names the newest frame (.NET ticks → its dated path).
const CAM_UA = { 'user-agent': 'Mozilla/5.0 (compatible; USS-Fidelity/0.3; local astronomy explorer)' };
async function firstMjpegFrame(res) {
  const reader = res.body.getReader();
  let buf = Buffer.alloc(0);
  try {
    while (buf.length < 8e6) {
      const { done, value } = await reader.read();
      if (done) break;
      buf = Buffer.concat([buf, Buffer.from(value)]);
      const a = buf.indexOf(Buffer.from([0xff, 0xd8])), b = a >= 0 ? buf.indexOf(Buffer.from([0xff, 0xd9]), a + 2) : -1;
      if (b > a) return buf.subarray(a, b + 2);
    }
  } finally { reader.cancel().catch(() => {}); }
  throw new Error('no JPEG frame in the stream');
}
async function naritFrame(station, signal) {
  const api = await fetch('https://weather.narit.or.th/api/GetSkyCamera', { method: 'POST', headers: { ...CAM_UA, 'content-type': 'application/json' }, body: JSON.stringify({ station }), signal });
  if (!api.ok) throw new Error(`NARIT API HTTP ${api.status}`);
  const r = await api.json(), j = Array.isArray(r) ? r[0] : r;
  if (!j?.TicksTime) throw new Error('NARIT API: no frame');
  const ms = Number((BigInt(j.TicksTime) - 621355968000000000n) / 10000n), day = new Date(ms).toISOString().slice(0, 10);
  if (!/^[A-Za-z0-9]+$/.test(j.Station) || !Number.isFinite(ms)) throw new Error('NARIT API: unexpected reply');
  return { url: `https://weather.narit.or.th/skycamera/${j.Station}/${day.slice(0, 4)}/${day}/${j.TicksTime}.jpg`, time: new Date(ms).toISOString() };
}
const webcam = ({ url, credit, mjpeg, narit }) => ({
  type: 'image', ttl: 5 * MIN, credit,
  async get() {
    const signal = AbortSignal.timeout(45000);
    const frame = narit ? await naritFrame(narit, signal) : null;
    const res = await fetch(frame?.url ?? url, { headers: CAM_UA, signal });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    if (mjpeg) return { body: await firstMjpegFrame(res), type: 'image/jpeg', time: new Date().toISOString() };
    return { body: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type')?.startsWith('image/') ? res.headers.get('content-type') : 'image/jpeg', time: frame?.time ?? lastModified(res) ?? new Date().toISOString() };
  },
});
// Harmonized Landsat–Sentinel (HLS) scenes reach GIBS a few days late: walk back to the most
// recent day with data (a nearly empty JPEG is a day not yet processed).
const gibsRecent = (layer, credit) => ({
  type: 'image', ttl: 6 * 60 * MIN, credit,
  async get() {
    for (let back = 2; back <= 8; back++) {
      const day = isoDay(new Date(Date.now() - back * 86400000));
      const q = new URLSearchParams({ SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', LAYERS: layer, CRS: 'EPSG:4326',
        BBOX: '-90,-180,90,180', WIDTH: '2048', HEIGHT: '1024', FORMAT: 'image/jpeg', TIME: day });
      const body = Buffer.from(await (await fetchOk(`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`)).arrayBuffer());
      if (body.length > 40000) return { body, type: 'image/jpeg', time: `${day}T12:00:00Z` };
    }
    throw new Error('no recent scenes');
  },
});
// EUMETSAT View: the newest image of a layer; its time comes from the WMS capabilities.
const EUM = 'https://view.eumetsat.int/geoserver';
let eumCaps = null; // { at, xml }
async function eumetsatTime(layer) {
  if (!eumCaps || Date.now() - eumCaps.at > 10 * MIN) eumCaps = { at: Date.now(), xml: await (await fetchOk(`${EUM}/ows?service=WMS&request=GetCapabilities&version=1.3.0`)).text() };
  const i = eumCaps.xml.indexOf(`<Name>${layer}</Name>`);
  const dim = i < 0 ? null : eumCaps.xml.slice(i, i + 4000).match(/<Dimension[^>]*name="time"[^>]*>[^<]*?\/([0-9T:.\-]+Z)\//);
  return dim ? dim[1].replace('.000Z', 'Z') : null;
}
const eumetsat = (layer, bbox, size, credit) => ({
  type: 'image', ttl: 15 * MIN, credit,
  async get() {
    const time = await eumetsatTime(layer).catch(() => null);
    const q = new URLSearchParams({ service: 'WMS', request: 'GetMap', version: '1.3.0', layers: layer, styles: '', crs: 'EPSG:4326',
      bbox, width: String(size[0]), height: String(size[1]), format: 'image/jpeg', ...(time ? { time } : {}) });
    const res = await fetchOk(`${EUM}/wms?${q}`, 90000);
    return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time };
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
  // the other AIA channels, for the spectrum filter (#28); Helioviewer source ids 8–16
  'sdo-94': helioviewer(8, 'SDO,AIA,AIA,94', 'NASA SDO AIA 94 Å (flaring corona, 6 million K), via Helioviewer'),
  'sdo-131': helioviewer(9, 'SDO,AIA,AIA,131', 'NASA SDO AIA 131 Å (flare plasma, 10 million K), via Helioviewer'),
  'sdo-171': helioviewer(10, 'SDO,AIA,AIA,171', 'NASA SDO AIA 171 Å (quiet corona, 0.6 million K), via Helioviewer'),
  'sdo-211': helioviewer(12, 'SDO,AIA,AIA,211', 'NASA SDO AIA 211 Å (active regions, 2 million K), via Helioviewer'),
  'sdo-335': helioviewer(14, 'SDO,AIA,AIA,335', 'NASA SDO AIA 335 Å (active regions, 2.5 million K), via Helioviewer'),
  'sdo-1600': helioviewer(15, 'SDO,AIA,AIA,1600', 'NASA SDO AIA 1600 Å (upper photosphere / transition region UV), via Helioviewer'),
  'sdo-1700': helioviewer(16, 'SDO,AIA,AIA,1700', 'NASA SDO AIA 1700 Å (temperature minimum / photosphere UV), via Helioviewer'),
  'sdo-304': helioviewer(13, 'SDO,AIA,AIA,304', 'NASA SDO AIA 304 Å (chromosphere), via Helioviewer'),
  'sdo-hmi': helioviewer(18, 'SDO,HMI,HMI,continuum', 'NASA SDO HMI continuum (visible photosphere, sunspots), via Helioviewer'),
  'sdo-171': helioviewer(10, 'SDO,AIA,AIA,171', 'NASA SDO AIA 171 Å (quiet corona and coronal loops, 0.6 million K), via Helioviewer'),
  'sdo-131': helioviewer(9, 'SDO,AIA,AIA,131', 'NASA SDO AIA 131 Å (flaring plasma, 10 million K), via Helioviewer'),
  'sdo-1600': helioviewer(15, 'SDO,AIA,AIA,1600', 'NASA SDO AIA 1600 Å (ultraviolet: upper photosphere and transition region), via Helioviewer'),
  'sdo-hmimag': helioviewer(19, 'SDO,HMI,HMI,magnetogram', 'NASA SDO HMI line-of-sight magnetogram (white and black: opposite magnetic polarities), via Helioviewer'),
  // Spectrum filter (#28): the Sun in microwaves, archival Nobeyama Radioheliograph maps (server/solarradio.js)
  'norh-17': norhFeed('ifa', 'Nobeyama Radioheliograph 17 GHz (1.76 cm), operated by NAOJ/ICCON; archival map of 7 January 2014 (NoRH closed in 2020)'),
  'norh-34': norhFeed('ifz', 'Nobeyama Radioheliograph 34 GHz (8.8 mm), operated by NAOJ/ICCON; archival map of 7 January 2014 (NoRH closed in 2020)'),
  // the Sun at radio wavelengths (#28, server/solarmodel.js): today's measured Siberian Radioheliograph map at 3.0 GHz,
  // and MODELLED · PREDICTED discs below 3 GHz (quiet Sun + HMI-placed active regions, total from NOAA F10.7/RSTN)
  'srh-3000': srhFeed('Siberian Radioheliograph (ISTP SB RAS, Badary) 3.0 GHz (10 cm) CLEAN full-disc map, brightness temperature'),
  'sunmodel-408': sunModelFeed(0.408, '408 MHz', { magnetogram: () => feed('sdo-hmimag', { preview: true }) }),
  'sunmodel-1400': sunModelFeed(1.4, '1.4 GHz', { magnetogram: () => feed('sdo-hmimag', { preview: true }) }),
  'sunmodel-2400': sunModelFeed(2.4, '2.4 GHz', { magnetogram: () => feed('sdo-hmimag', { preview: true }) }),
  'lasco-c2': helioviewer(4, 'SOHO,LASCO,C2,white-light', 'ESA/NASA SOHO LASCO C2 coronagraph (outer corona to 6 solar radii; the white circle marks the hidden Sun), via Helioviewer', 11.9),
  'lasco-c3': helioviewer(5, 'SOHO,LASCO,C3,white-light', 'ESA/NASA SOHO LASCO C3 coronagraph (corona and solar wind to 30 solar radii; stars and planets pass behind), via Helioviewer', 56),
  // Ground-based: NSO GONG H-alpha network, six observatories around the world, one image a minute.
  'gong-halpha': {
    type: 'image', ttl: 10 * MIN, credit: 'NSO / AURA / NSF GONG H-alpha network: a ground-based telescope on Earth (chromosphere: filaments, plage, flares)',
    async get() {
      for (let back = 0; back <= 1; back++) {
        const d = new Date(Date.now() - back * 86400000), ym = isoDay(d).slice(0, 7).replace('-', ''), ymd = isoDay(d).replaceAll('-', '');
        const dirUrl = `https://gong2.nso.edu/HA/hag/${ym}/${ymd}/`;
        const files = [...(await (await fetchOk(dirUrl)).text()).matchAll(/href="(\d{14}[A-Za-z]h\.jpg)"/g)].map((m) => m[1]);
        const last = files.sort().at(-1);
        if (!last) continue;
        const res = await fetchOk(dirUrl + last);
        const t = last.slice(0, 14);
        return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time: `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}Z` };
      }
      throw new Error('no GONG images today');
    },
  },
  // NASA SVS Dial-a-Moon: the Moon as it appears from Earth this hour (phase, libration, size),
  // rendered from LRO elevation and colour data: a computed view, not a photograph.
  'moon-now': {
    type: 'image', ttl: 60 * MIN, credit: 'NASA Scientific Visualization Studio, Dial-a-Moon: rendered from LRO LOLA/LROC data for this hour (geocentric view)',
    async get() {
      const hour = new Date().toISOString().slice(0, 13) + ':00';
      const j = await (await fetchOk(`https://svs.gsfc.nasa.gov/api/dialamoon/${hour}`)).json();
      const res = await fetchOk(j.image.url);
      return { body: Buffer.from(await res.arrayBuffer()), type: 'image/jpeg', time: `${hour}:00Z` };
    },
  },
  'gibs-terra': gibs('MODIS_Terra_CorrectedReflectance_TrueColor', 'NASA GIBS, Terra MODIS corrected reflectance (yesterday)'),
  'gibs-aqua': gibs('MODIS_Aqua_CorrectedReflectance_TrueColor', 'NASA GIBS, Aqua MODIS corrected reflectance (yesterday)'),
  'gibs-snpp': gibs('VIIRS_SNPP_CorrectedReflectance_TrueColor', 'NASA GIBS, Suomi NPP VIIRS corrected reflectance (yesterday)'),
  'gibs-noaa20': gibs('VIIRS_NOAA20_CorrectedReflectance_TrueColor', 'NASA GIBS, NOAA-20 VIIRS corrected reflectance (yesterday)'),
  'gibs-noaa21': gibs('VIIRS_NOAA21_CorrectedReflectance_TrueColor', 'NASA GIBS, NOAA-21 VIIRS corrected reflectance (yesterday)'),
  'mtg-0': eumetsat('mtg_fd:rgb_geocolour', '-81,-81,81,81', [1024, 1024], 'EUMETSAT, Meteosat-12 (MTG-I1) FCI GeoColour RGB, 0° full disk'),
  'msg-0': eumetsat('msg_fes:rgb_naturalenhncd', '-77,-77,77,77', [1024, 1024], 'EUMETSAT, Meteosat SEVIRI natural colour enhanced RGB, 0° full-disk service'),
  'msg-iodc': eumetsat('msg_iodc:rgb_naturalenhncd', '-77,-35.5,77,118.5', [1024, 1024], 'EUMETSAT, Meteosat-9 SEVIRI natural colour enhanced RGB, Indian Ocean (45.5° E)'),
  'msg-rss': eumetsat('msg_rss:rgb_naturalenhncd_nrt', '24,-45,72,70', [1400, 760], 'EUMETSAT, Meteosat SEVIRI 5-minute Rapid Scan, Europe (natural colour enhanced)'),
  'sentinel3-olci': eumetsat('copernicus:daily_sentinel3ab_olci_l1_rgb_fulres', '-90,-180,90,180', [2048, 1024], 'EUMETSAT / Copernicus, Sentinel-3A/B OLCI daily RGB mosaic (filling in through the day)'),
  'hls-landsat': gibsRecent('HLS_L30_Nadir_BRDF_Adjusted_Reflectance', 'NASA GIBS, Harmonized Landsat Sentinel-2 (HLS) L30: Landsat 8/9 OLI scenes of the most recent processed day'),
  ...Object.fromEntries(Object.entries(WEBCAMS).map(([id, c]) => [`cam-${id}`, webcam(c)])),
  'rover-m20': marsRaw('m20', 'NASA/JPL-Caltech, Perseverance raw image'),
  'rover-msl': marsRaw('msl', 'NASA/JPL-Caltech/MSSS, Curiosity raw image'),
  'hls-sentinel2': gibsRecent('HLS_S30_Nadir_BRDF_Adjusted_Reflectance', 'NASA GIBS, Harmonized Landsat Sentinel-2 (HLS) S30: Sentinel-2 MSI scenes of the most recent processed day'),
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
export async function feed(id0, { preview = false } = {}) {
  const f = FEEDS[id0];
  if (!f) throw Object.assign(new Error(`unknown feed ${id0}`), { status: 404 });
  const pre = preview && f.preview, id = pre ? `${id0}.preview` : id0; // #62: a small copy, cached on its own
  const metaFile = path.join(dir, `${id}.json`), bodyFile = path.join(dir, `${id}.bin`);
  let meta = null;
  try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch { /* none */ }
  const read = async (cache) => ({ ...meta, credit: meta.credit ?? f.credit, cache, body: f.type === 'image' ? await fs.readFile(bodyFile) : meta.body });
  if (meta && Date.now() - Date.parse(meta.fetched) < f.ttl) return read('hit');
  if (!inflight.has(id)) {
    inflight.set(id, (async () => {
      try {
        const got = await f.get({ preview: pre });
        await fs.mkdir(dir, { recursive: true });
        meta = { type: got.type ?? 'application/json', time: got.time, disk: got.disk ?? null, credit: got.credit, fetched: new Date().toISOString(), ...(f.type === 'json' ? { body: got.body } : {}) };
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
