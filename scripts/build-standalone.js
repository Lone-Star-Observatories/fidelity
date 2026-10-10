#!/usr/bin/env node
// Build the backend-free preview: one self-contained HTML file (no doctype/head, so it can be
// published as a Claude artifact) carrying a catalogue snapshot around Sol.
//   npm run build:standalone   →   dist-standalone/fidelity.html

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { gzipSync, gunzipSync } from 'node:zlib';
import { encodeSnapshotBytes, unpackSnapshotBytes } from '../src/data/snapshot-codec.js';
import { nearby, starDetail, sky, galaxyStars, nearbyPlanets } from '../server/stars.js';
import { TEXTURES, PREVIEW, download } from '../server/textures.js';
import { sampleTiff } from '../server/tiff.js';
import { library } from '../server/spectra.js';
import { smallBodies } from '../server/smallbodies.js';
import { clusters, galaxies } from '../server/deepsky.js';
import { gaiaBright } from '../server/gaia.js';
import { satellites, satelliteDetail } from '../server/satellites.js';
import { FEATURED, SAT_FEEDS } from '../src/data/feeds.js';
import { SPACECRAFT } from '../src/data/spacecraft.js';
import { BODIES as SOL_BODIES } from '../src/data/sol.js';
import { monthlyVectors, localDay, track } from '../server/horizons.js';
import { monthUrl, localUrl, trackUrl } from '../src/data/horizons-urls.js';
import { BODY_VISUALS, BESPOKE_TEXTURES, bodyVisualFor } from '../src/data/bespoke.js';
import { SKINS } from '../src/data/skins.js';
import { SHAPES } from '../src/data/shapes.js';
import { MODELS } from '../src/data/models.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// 1) snapshot: stars within 100 ly of Sol, every planet host's detail, and a few skies
const near = await nearby('sol', 100);
const details = {};
for (const row of near.stars) if (row[8] > 0) details[row[0]] = await starDetail(row[0]);
// Researched stars without known planets still need their actual Star/System views offline.
for (const row of near.stars) {
  if (!details[row[0]] && bodyVisualFor({ name: row[1] })?.kind === 'star') details[row[0]] = await starDetail(row[0]);
}
// multiple-star systems with measured orbits within 50 ly, so their System Views show every star
const iSystem = near.fields.indexOf('system');
for (const row of near.stars) {
  if (row[8] > 0 || !row[iSystem] || Math.hypot(row[2], row[3], row[4]) * 3.26156 > 50) continue;
  try { const d = await starDetail(row[0]); if (d.group?.orbits?.length) details[row[0]] = d; } catch { /* not in the catalogue */ }
}
const skies = {};
for (const id of ['sol', 'hyg-70666']) {
  try { skies[id] = await sky(id); } catch { /* not in this catalogue version */ }
}
// surfaces, embedded as data URIs (smaller variants where the full map is large)
const textures = {}, textureCredits = {};
const SKIP_IN_PREVIEW = new Set(['venusSurface']); // not used by any view yet
// Every upstream surface is a preview, not a full-resolution texture. Keep ring alpha.
const SHRINK = new Set(Object.keys(TEXTURES).filter(key => key !== 'saturnRing'));
async function shrink(buf) {
  return sharp(buf).resize({ width: 512, height: 256, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
}
for (const [key, sources] of Object.entries(TEXTURES)) {
  if (SKIP_IN_PREVIEW.has(key)) continue;
  let url = null, buf = null;
  for (const u of [PREVIEW[key], ...sources.map((s) => s.url).reverse()].filter(Boolean)) {
    if (sources.find((s) => s.url === u)?.tiff) {
      buf = await fs.readFile(path.join(root, 'data/textures', `${key}.png`)).catch(() => null);
      if (!buf) {
        const previewPath = path.join(root, 'data/preview-textures', `${key}.png`);
        buf = await fs.readFile(previewPath).catch(() => null);
        if (!buf) {
          try {
            buf = await sampleTiff(u, 512);
            await fs.mkdir(path.dirname(previewPath), { recursive: true });
            await fs.writeFile(previewPath, buf);
          } catch (error) { console.warn(`  texture ${key}: TIFF preview failed (${error.message})`); }
        }
      }
    } else buf = await download(u);
    if (buf) { url = u; break; }
  }
  const selectedSource = sources.find(s => s.url === url)
    ?? sources.find(s => url && new URL(s.url).hostname === new URL(url).hostname) ?? sources[0];
  if (buf && SHRINK.has(key)) { buf = await shrink(buf); url = 'shrunk.jpg'; }
  if (!buf) { console.warn(`  texture ${key}: unavailable, placeholder will be used`); continue; }
  textures[key] = `data:${url.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${buf.toString('base64')}`;
  textureCredits[key] = selectedSource.credit;
}
// Local artistic textures and compressed shape previews need no upstream requests.
for (const [key, asset] of Object.entries({ ...SKINS, ...BESPOKE_TEXTURES })) {
  const bytes = await sharp(await fs.readFile(path.join(root, 'public', asset.previewUrl))).webp({ quality: 80 }).toBuffer();
  textures[key] = `data:image/webp;base64,${bytes.toString('base64')}`;
  textureCredits[key] = asset.credit;
}
const shapes = {};
for (const [id, asset] of Object.entries(SHAPES)) {
  const bytes = await fs.readFile(path.join(root, 'public', asset.previewUrl));
  shapes[id] = `data:model/gltf-binary;base64,${bytes.toString('base64')}`;
}
const models = {};
for (const asset of Object.values(MODELS)) {
  const bytes = await fs.readFile(path.join(root, 'public', asset.previewUrl));
  models[asset.url] = `data:model/gltf-binary;base64,${bytes.toString('base64')}`;
}
const bodyImages = {};
for (const visual of Object.values(BODY_VISUALS)) {
  for (const asset of [visual.surfaceImage, visual.surfaceMap, visual.skyImage, ...(visual.contextImages ?? [])].filter(Boolean)) {
    // Surface maps already live in textures; cards resolve the same embedded copy.
    if (asset.key && textures[asset.key]) continue;
    let bytes = await fs.readFile(path.join(root, 'public', asset.previewUrl ?? asset.url));
    const imagined = asset.tier === 'imagined';
    if (imagined) bytes = await sharp(bytes).webp({ quality: 80 }).toBuffer();
    bodyImages[asset.url] = `data:image/${imagined ? 'webp' : 'jpeg'};base64,${bytes.toString('base64')}`;
  }
}
// the corona photograph shown in totality (#31)
bodyImages['/references/corona-2017-08-21.jpg'] = `data:image/jpeg;base64,${(await fs.readFile(path.join(root, 'public/references/corona-2017-08-21.jpg'))).toString('base64')}`;
// stellar spectrum library, thinned to 4 nm steps for the preview
const lib = await library();
const spectra = { ...lib, grid: { ...lib.grid, step: lib.grid.step * 2 }, entries: lib.entries.map((e) => ({ ...e, flux: e.flux.filter((_, i) => i % 2 === 0) })) };
// galaxy: the luminous stars (M ≤ 0) within 1.5 kly — ≈8k of the 46k the backend serves
const galaxy = await galaxyStars(1500, 0);
// Gaia beyond 1.5 kly: the 8,000 most luminous of ≈55k (they trace the arms best)
const gaiaAll = await gaiaBright().catch(() => null);
const gaiaSnap = gaiaAll && { ...gaiaAll, stars: gaiaAll.stars.slice().sort((a, b) => a[3] - b[3]).slice(0, 8000) };
// belts: the bigger objects of each population, rounded (≈ 12k of the 61k orbits)
const sbAll = await smallBodies().catch(() => null);
const H_MAX = [18, 12.8, 13.2, 99, 99]; // neo, main, trojan, centaur, tno
// satellites: all but the mega-constellations (1 in 20 Starlink / OneWeb kept so the shells show)
const satAll = await satellites().catch(() => null);
const satellitesSnap = satAll && { ...satAll, rows: satAll.rows.filter((r, i) => !['starlink', 'oneweb', 'other'].includes(satAll.categories[r[2]]) || i % 20 === 0) };
const satcat = {};
// SATCAT + UCS detail for the featured and live-feed satellites (the full catalogue does not fit the 16 MB budget)
for (const id of new Set([...FEATURED.map(([n]) => n), ...Object.keys(SAT_FEEDS).map(Number)])) { try { satcat[id] = await satelliteDetail(id); } catch { /* not active */ } }
// spacecraft: this month's vectors, today's local states, and trajectories (keyed by the client's URLs)
const NAIF = { earth: 399, moon: 301, mars: 499, jupiter: 599 };
const horizons = {};
const jdNow = 2440587.5 + Date.now() / 86400000;
const isoD = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
for (const c of SPACECRAFT) {
  try {
    if (c.center) {
      for (const jd of [jdNow, jdNow + 1]) horizons[localUrl(c.horizons, NAIF[c.center], jd)] = (await localDay(c.horizons, String(NAIF[c.center]), isoD(jd))).value.points.filter((_, i) => i % 2 === 0);
    } else {
      horizons[monthUrl(c.horizons, jdNow)] = (await monthlyVectors(c.horizons, isoD(jdNow).slice(0, 7))).value.points;
      const from = c.trackFrom ?? isoD(jdNow - 365), to = isoD(jdNow + 365);
      horizons[trackUrl(c.horizons, from, to)] = (await track(c.horizons, from, to, 400)).value.points.map((p) => p.map((v, i) => (i ? +v.toFixed(4) : v)));
    }
  } catch (err) { console.warn(`  spacecraft ${c.id}: ${err.message}`); }
}
// planets (and Pluto): this month's and next month's Horizons vectors, so the EPHEMERIS toggle works offline
for (const b of SOL_BODIES.filter((x) => x.horizons)) {
  for (const jd of [jdNow, jdNow + 31]) {
    try { horizons[monthUrl(b.horizons, jd)] = (await monthlyVectors(b.horizons, isoD(jd).slice(0, 7))).value.points.map((p) => p.map((v, i) => (i ? +v.toFixed(7) : v))); } catch (err) { console.warn(`  horizons ${b.id}: ${err.message}`); }
  }
}
// quadrant & universe: all clusters; nearby galaxies; Cosmicflows groups within 300 Mly (≈ 92 Mpc)
const clustersSnap = await clusters().catch(() => null);
const galAll = await galaxies().catch(() => null);
const galaxiesSnap = galAll && { ...galAll, groups: { ...galAll.groups, rows: galAll.groups.rows.filter((r) => r[2] <= 92).map((r) => [r[0], r[1], +r[2].toFixed(1), Math.round(r[3]), Math.round(r[4]), Math.round(r[5])]) } };
const smallbodies = sbAll && { ...sbAll, rows: sbAll.rows.filter((r) => (r[8] ?? 0) < H_MAX[r[0]]).map((r) => r.map((v, i) => (i === 0 || v == null ? v : +v.toFixed(i === 7 ? 1 : 4)))) };
await fs.mkdir(path.join(root, 'standalone'), { recursive: true });
// the weekly events feed (#32): the bundled copy; the preview refreshes it from GitHub when online
let eventsSnap = null;
try { eventsSnap = JSON.parse(await fs.readFile(path.join(root, 'events', 'events.json'), 'utf8')); } catch { console.warn('  events: no events/events.json (run npm run events)'); }
const snapshotJson = JSON.stringify({ events: eventsSnap, nearby: near, details, skies, textures, textureCredits, shapes, models, bodyImages, spectra, galaxy, planets: await nearbyPlanets('sol', 100), smallbodies, satellites: satellitesSnap, satcat, horizons, clusters: clustersSnap, galaxies: galaxiesSnap, gaiaBright: gaiaSnap });
await fs.writeFile(path.join(root, 'standalone/snapshot.json'), snapshotJson);
const compressed = gzipSync(snapshotJson, { level: 9 });
if (gunzipSync(compressed).toString('utf8') !== snapshotJson) throw new Error('Snapshot compression round-trip failed.');
const packed = encodeSnapshotBytes(compressed);
if (!Buffer.from(unpackSnapshotBytes(packed)).equals(compressed)) throw new Error('Snapshot transport round-trip failed.');
await fs.writeFile(path.join(root, 'standalone/snapshot-packed.js'), `export default ${JSON.stringify(packed)};\n`);
console.log(`lossless snapshot: ${Buffer.byteLength(snapshotJson)} → ${compressed.length} gzip bytes`);
console.log(`snapshot: ${near.stars.length} stars, ${Object.keys(details).length} detailed systems, ${Object.keys(skies).length} skies, ${Object.keys(textures).length} textures`);

// 2) build
execFileSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'standalone'], { cwd: root, stdio: 'inherit' });

// 3) inline into one file
const dist = path.join(root, 'dist-standalone');
const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const assets = await fs.readdir(path.join(dist, 'assets'));
const css = await fs.readFile(path.join(dist, 'assets', assets.find((f) => f.endsWith('.css'))), 'utf8');
const js = (await fs.readFile(path.join(dist, 'assets', assets.find((f) => f.endsWith('.js'))), 'utf8')).replaceAll('</script', '<\\/script');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '').trim();
const fonts = (html.match(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g) || []).join('\n');
// Compress the entire application losslessly as well as its embedded snapshot.
// Runtime imports the restored module from a Blob; no executable text is evaluated.
const appCompressed = gzipSync(js, { level: 9 });
if (gunzipSync(appCompressed).toString('utf8') !== js) throw new Error('Application compression round-trip failed.');
const appPacked = encodeSnapshotBytes(appCompressed);
if (!Buffer.from(unpackSnapshotBytes(appPacked)).equals(appCompressed)) throw new Error('Application transport round-trip failed.');
const codecSource = (await fs.readFile(path.join(root, 'src/data/snapshot-codec.js'), 'utf8')).replaceAll('export ', '');
const bootstrap = `${codecSource}\nif (typeof DecompressionStream !== 'function') {\n document.body.textContent = 'This offline preview needs a browser with gzip decompression support. Please open it in a current browser.';\n} else {\n const stream = new Blob([unpackSnapshotBytes(${JSON.stringify(appPacked)})]).stream().pipeThrough(new DecompressionStream('gzip'));\n const code = await new Response(stream).text();\n const url = URL.createObjectURL(new Blob([code], {type:'text/javascript'}));\n try { await import(url); } finally { URL.revokeObjectURL(url); }\n}\n`;
const out = `<title>USS Fidelity</title>\n${fonts}\n<style>\n${css}\n</style>\n${body}\n<script type="module">\n${bootstrap}\n</script>\n`;
const previewBytes = Buffer.byteLength(out);
if (previewBytes > 16_000_000) throw new Error(`Standalone preview exceeds the 16 MB budget (${previewBytes} bytes).`);
await fs.writeFile(path.join(dist, 'fidelity.html'), out);
console.log(`wrote dist-standalone/fidelity.html (${(previewBytes / 1e6).toFixed(2)} MB)`);
