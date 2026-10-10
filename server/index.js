// USS Fidelity local backend: serves the built app and a small /api for things the
// browser can't do alone (CORS-less upstreams, local catalogs, disk caching).
// Zero runtime dependencies — Node 20+ only.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { monthlyVectors } from './horizons.js';
import { scanCatalogs } from './catalogs.js';
import { cacheStats } from './cache.js';
import { nearby, starDetail, sky, galaxyStars } from './stars.js';
import { textureResponse, textureCredits } from './textures.js';
import { spectrumFor } from './spectra.js';
import { smallBodies } from './smallbodies.js';

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
  'GET /api/horizons/vectors': async (q) => monthlyVectors(q.get('body') || '', q.get('month') || ''),
  'GET /api/catalogs': async () => scanCatalogs(),
  'GET /api/cache': async () => cacheStats(),
  'GET /api/nearby': async (q) => nearby(q.get('center') || 'sol', q.get('radiusLy') || '50'),
  'GET /api/sky': async (q) => sky(q.get('center') || 'sol', q.get('maxMag') || '6.5'),
  'GET /api/textures': async () => textureCredits(),
  'GET /api/galaxy': async (q) => galaxyStars(q.get('maxLy') || '1500', q.get('maxAbs') || '2'),
  'GET /api/spectrum': async (q) => spectrumFor(q.get('type') || '', q.get('feh')),
  'GET /api/smallbodies': async () => smallBodies(),
};

/** Binary result: sent as-is instead of JSON. */
const binary = (r) => Object.assign(r, { binary: true });

// Routes with a path parameter.
const paramRoutes = [
  [/^GET \/api\/stars\/([a-z0-9-]{1,64})$/, (m) => starDetail(m[1])],
  [/^GET \/api\/texture\/([A-Za-z]{1,32})$/, async (m) => binary(await textureResponse(m[1]))],
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
    if (m) handler = () => fn(m);
  }
  if (handler) {
    try {
      const out = await handler();
      if (out?.binary) {
        res.writeHead(200, { 'content-type': out.type, 'cache-control': 'public, max-age=604800' });
        res.end(out.body);
      } else send(res, 200, out);
    }
    catch (err) { send(res, err.status || 502, { error: String(err.message || err) }); }
    return;
  }
  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
  serveStatic(req, res, url.pathname);
});

server.listen(config.port, config.host, () => {
  console.log(`USS Fidelity backend on http://${config.host}:${config.port}`);
  console.log(`  cache:    ${config.dataDir}`);
  console.log(`  catalogs: ${config.catalogDirs.join(', ') || '(none — set FIDELITY_CATALOG_DIRS)'}`);
});
