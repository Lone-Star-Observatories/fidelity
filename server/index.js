// USS Fidelity local backend: serves the built app and a small /api for things the
// browser can't do alone (CORS-less upstreams, local catalogs, disk caching).
// Zero runtime dependencies — Node 20+ only.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { monthlyVectors, localDay, localMonth, track } from './horizons.js';
import { dsnNow } from './dsn.js';
import { clusters, galaxies, clusterMembers } from './deepsky.js';
import { nebulaImage } from './nebulae.js';
import { gaiaBright } from './gaia.js';
import { starLookup } from './lookup.js';
import { scanCatalogs } from './catalogs.js';
import { cacheStats } from './cache.js';
import { nearby, starDetail, sky, galaxyStars, nearbyPlanets, arrivals } from './stars.js';
import { textureResponse, textureCredits } from './textures.js';
import { spectrumFor } from './spectra.js';
import { smallBodies } from './smallbodies.js';
import { satellites, satelliteDetail } from './satellites.js';
import { feed, feedList } from './feeds.js';
import { traverse } from './traverse.js';
import { jwstSchedule, recentImages, preview } from './observing.js';
import { eventsFeed } from './events.js';
import { crew, crewImage } from './crew.js';
import { voiceStatus, handleVoiceUpgrade } from './voice.js';
import { hipsImage, gibsBand } from './bandimages.js';
import { surveyList, surveyCutout, nasaImages, nasaImage } from './imagery.js';
import { psgSpectrum, starSpectrum, exoSpectraList, exoSpectrum } from './bodyspectra.js';
import { satnogs, marsRaw, rawImage, marsWeather } from './comms.js';
import { signalLayers, signalLayer } from './signals.js';
import { surfaceImages, surfaceImage } from './surfaceimages.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

const routes = {
  'GET /api/health': async () => ({ ok: true, name: 'USS Fidelity', catalogDirs: config.catalogDirs.length }),
  'GET /api/voice/status': async () => voiceStatus(),
  'GET /api/hips': async (q) => binary(await hipsImage(q.get('id') || '')),
  'GET /api/gibs-band': async (q) => binary(await gibsBand(q.get('layers') || '')),
  'GET /api/horizons/vectors': async (q) => monthlyVectors(q.get('body') || '', q.get('month') || ''),
  'GET /api/horizons/local': async (q) => localDay(q.get('body') || '', q.get('center') || '', q.get('day') || ''),
  'GET /api/horizons/local-month': async (q) => localMonth(q.get('body') || '', q.get('center') || '', q.get('month') || ''),
  'GET /api/horizons/track': async (q) => track(q.get('body') || '', q.get('start') || '', q.get('stop') || '', q.get('n')),
  'GET /api/dsn': async () => dsnNow(),
  'GET /api/clusters': async () => clusters(),
  'GET /api/cluster-members': async (q) => clusterMembers(q.get('name') || ''),
  'GET /api/gaia-bright': async () => gaiaBright(),
  'GET /api/star-lookup': async (q) => starLookup(q),
  'GET /api/galaxies': async () => galaxies(),
  'GET /api/catalogs': async () => scanCatalogs(),
  'GET /api/cache': async () => cacheStats(),
  'GET /api/nearby': async (q) => nearby(q.get('center') || 'sol', q.get('radiusLy') || '50'),
  'GET /api/arrivals': async (q) => arrivals(q.get('center') || 'sol', q.get('fromLy') || '0', q.get('toLy') || '250'),
  'GET /api/planets': async (q) => nearbyPlanets(q.get('center') || 'sol', q.get('radiusLy') || '50'),
  'GET /api/sky': async (q) => sky(q.get('center') || 'sol', q.get('maxMag') || '6.5'),
  'GET /api/textures': async () => textureCredits(),
  'GET /api/galaxy': async (q) => galaxyStars(q.get('maxLy') || '1500', q.get('maxAbs') || '2'),
  'GET /api/spectrum': async (q) => spectrumFor(q.get('type') || '', q.get('feh')),
  'GET /api/smallbodies': async () => smallBodies(),
  'GET /api/satellites': async () => satellites(),
  'GET /api/feeds': async () => feedList(),
  'GET /api/observing/jwst/schedule': async () => jwstSchedule(),
  'GET /api/observing/preview': async (q) => binary({ ...(await preview(q.get('uri'))), maxAge: 86400 }),
  'GET /api/events': async () => eventsFeed(),
  'GET /api/crew': async () => crew(),
  'GET /api/crew/image': async (q) => binary(await crewImage(q.get('file') || '')),
  'GET /api/surveys': async () => surveyList(),
  'GET /api/nasa-images': async (q) => nasaImages(q),
  'GET /api/psg': async (q) => psgSpectrum(q.get('body') || '', q.get('month') || ''),
  'GET /api/star-spectrum': async (q) => starSpectrum(q),
  'GET /api/exo-spectra': async (q) => exoSpectraList(q.get('planet') || ''),
  'GET /api/exo-spectrum': async (q) => exoSpectrum(q.get('path') || ''),
  'GET /api/signals': async () => signalLayers(), // COMMS (#35)
  'GET /api/comms/raw-image': async (q) => binary(await rawImage(q.get('url') || '')),
  'GET /api/surface-images': async (q) => surfaceImages(q),
  'GET /api/surface-image': async (q) => binary(await surfaceImage(q)),
};

/** Binary result: sent as-is instead of JSON. */
const binary = (r) => Object.assign(r, { binary: true });

// Routes with a path parameter.
const paramRoutes = [
  [/^GET \/api\/stars\/([a-z0-9-]{1,64})$/, (m) => starDetail(m[1])],
  [/^GET \/api\/nebula-image\/([a-z0-9-]{1,32})$/, async (m) => binary(await nebulaImage(m[1]))],
  [/^GET \/api\/texture\/([A-Za-z]{1,32})$/, async (m) => binary(await textureResponse(m[1]))],
  [/^GET \/api\/satellites\/(\d{1,6})$/, (m) => satelliteDetail(m[1])],
  [/^GET \/api\/observing\/(hst|jwst)\/recent$/, (m) => recentImages(m[1])],
  [/^GET \/api\/traverse\/([a-z0-9-]{1,16})$/, (m) => traverse(m[1])],
  [/^GET \/api\/survey\/([a-z0-9]{2,16})$/, async (m, q) => binary(await surveyCutout(m[1], q))],
  [/^GET \/api\/nasa-image\/([A-Za-z0-9_.\-]{2,80})\/(thumb|medium)$/, async (m) => binary(await nasaImage(m[1], m[2]))],
  [/^GET \/api\/comms\/satnogs\/(\d{1,6})$/, (m) => satnogs(m[1])], // COMMS (#35)
  [/^GET \/api\/comms\/mars-raw\/(m20|msl)$/, (m) => marsRaw(m[1])],
  [/^GET \/api\/comms\/mars-weather\/(m20|msl)$/, (m) => marsWeather(m[1])],
  [/^GET \/api\/signals\/([a-z]{1,16})$/, (m) => signalLayer(m[1])],
  [/^GET \/api\/feed\/([a-z0-9-]{1,32})$/, async (m) => {
    const f = await feed(m[1]);
    if (f.type === 'application/json') return { id: m[1], time: f.time, fetched: f.fetched, credit: f.credit, cache: f.cache, data: f.body };
    // short cache: these are live images
    return binary({ body: f.body, type: f.type, maxAge: 300, headers: { 'x-feed-time': f.time ?? '', 'x-feed-disk': f.disk ?? '', 'x-feed-credit': encodeURIComponent(f.credit), 'x-feed-cache': f.cache } });
  }],
];

async function serveStatic(req, res, pathname) {
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = path.join(config.distDir, rel);
  if (!file.startsWith(config.distDir)) return send(res, 403, { error: 'forbidden' });
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(config.distDir, 'index.html'); // hash router: fall back to shell
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    send(res, 404, 'Run `npm run build` first (or use `npm run dev`).', 'text/plain');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const key = `${req.method} ${url.pathname}`;
  let handler = routes[key] && (() => routes[key](url.searchParams));
  for (const [re, fn] of paramRoutes) {
    const m = !handler && key.match(re);
    if (m) handler = () => fn(m, url.searchParams);
  }
  if (handler) {
    try {
      const out = await handler();
      if (out?.binary) {
        res.writeHead(200, { 'content-type': out.type, 'cache-control': `public, max-age=${out.maxAge ?? 604800}`, ...out.headers });
        res.end(out.body);
      } else send(res, 200, out);
    }
    catch (err) {
      if (!err.status) console.warn(`${key}${url.search} → ${err.message || err}`);
      send(res, err.status || 502, { error: String(err.message || err) });
    }
    return;
  }
  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
  serveStatic(req, res, url.pathname);
});

// "Computer" voice relay (#21): ws://host/api/voice → OpenAI Realtime, key held here
server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://local').pathname === '/api/voice') handleVoiceUpgrade(req, socket);
  else socket.destroy();
});

server.listen(config.port, config.host, () => {
  console.log(`USS Fidelity backend on http://${config.host}:${config.port}`);
  console.log(`  cache:    ${config.dataDir}`);
  console.log(`  catalogs: ${config.catalogDirs.join(', ') || '(none — set FIDELITY_CATALOG_DIRS)'}`);
});
