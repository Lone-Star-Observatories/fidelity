#!/usr/bin/env node
// Build the backend-free preview: one self-contained HTML file (no doctype/head, so it can be
// published as a Claude artifact) carrying a catalogue snapshot around Sol.
//   npm run build:standalone   →   dist-standalone/fidelity.html

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { nearby, starDetail, sky, galaxyStars } from '../server/stars.js';
import { TEXTURES, PREVIEW, download } from '../server/textures.js';
import { library } from '../server/spectra.js';
import { smallBodies } from '../server/smallbodies.js';
import { clusters, galaxies } from '../server/deepsky.js';
import { satellites, satelliteDetail } from '../server/satellites.js';
import { FEATURED } from '../src/data/feeds.js';
import { SPACECRAFT } from '../src/data/spacecraft.js';
import { monthlyVectors, localDay, track } from '../server/horizons.js';
import { monthUrl, localUrl, trackUrl } from '../src/data/horizons-urls.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';

const PLANET_KEYS = new Set(['moon', 'mars', 'pluto', 'mercury', 'jupiter', 'saturn', 'uranus', 'neptune']);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// 1) snapshot: stars within 100 ly of Sol, every planet host's detail, and a few skies
const near = await nearby('sol', 100);
const details = {};
for (const row of near.stars) if (row[8] > 0) details[row[0]] = await starDetail(row[0]);
const skies = {};
for (const id of ['sol', 'hyg-70666']) {
  try { skies[id] = await sky(id); } catch { /* not in this catalogue version */ }
}
// surfaces, embedded as data URIs (smaller variants where the full map is large)
const textures = {}, textureCredits = {};
const SKIP_IN_PREVIEW = new Set(['venusSurface']); // not used by any view yet
// Moon and asteroid maps are shrunk to 512 px for the preview (needs python3 + Pillow; else skipped).
const SHRINK = new Set([...MOONS.map((m) => m.skin.map), ...SMALL_BODIES.map((b) => b.skin.map)].filter((k) => !PLANET_KEYS.has(k)));
function shrink(buf) {
  try {
    return execFileSync('python3', ['-I', '-c', 'import sys,io\nfrom PIL import Image\nim=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")\nim.thumbnail((512,256))\nb=io.BytesIO();im.save(b,"JPEG",quality=82);sys.stdout.buffer.write(b.getvalue())'],
      { input: buf, maxBuffer: 16 * 1024 * 1024 });
  } catch { return null; }
}
for (const [key, sources] of Object.entries(TEXTURES)) {
  if (SKIP_IN_PREVIEW.has(key)) continue;
  let url = null, buf = null;
  for (const u of [PREVIEW[key], ...sources.map((s) => s.url).reverse()].filter(Boolean)) {
    if (sources.find((s) => s.url === u)?.tiff) { // range-sampled by the backend: use its cached copy if present
      buf = await fs.readFile(path.join(root, 'data/textures', `${key}.png`)).catch(() => null);
    } else buf = await download(u);
    if (buf) { url = u; break; }
  }
  if (buf && SHRINK.has(key)) { buf = shrink(buf); url = 'shrunk.jpg'; }
  if (!buf) { console.warn(`  texture ${key}: unavailable, placeholder will be used`); continue; }
  textures[key] = `data:${url.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${buf.toString('base64')}`;
  textureCredits[key] = (sources.find((s) => s.url === url) ?? sources[0]).credit;
}
// stellar spectrum library, thinned to 4 nm steps for the preview
const lib = await library();
const spectra = { ...lib, grid: { ...lib.grid, step: lib.grid.step * 2 }, entries: lib.entries.map((e) => ({ ...e, flux: e.flux.filter((_, i) => i % 2 === 0) })) };
// galaxy: the luminous stars (M ≤ 0) within 1.5 kly — ≈8k of the 46k the backend serves
const galaxy = await galaxyStars(1500, 0);
// belts: the bigger objects of each population, rounded (≈ 12k of the 61k orbits)
const sbAll = await smallBodies().catch(() => null);
const H_MAX = [18, 12.8, 13.2, 99, 99]; // neo, main, trojan, centaur, tno
// satellites: all but the mega-constellations (1 in 20 Starlink / OneWeb kept so the shells show)
const satAll = await satellites().catch(() => null);
const satellitesSnap = satAll && { ...satAll, rows: satAll.rows.filter((r, i) => !['starlink', 'oneweb', 'other'].includes(satAll.categories[r[2]]) || i % 20 === 0) };
const satcat = {};
for (const [id] of FEATURED) { try { satcat[id] = await satelliteDetail(id); } catch { /* not active */ } }
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
// quadrant & universe: all clusters; nearby galaxies; Cosmicflows groups within 300 Mly (≈ 92 Mpc)
const clustersSnap = await clusters().catch(() => null);
const galAll = await galaxies().catch(() => null);
const galaxiesSnap = galAll && { ...galAll, groups: { ...galAll.groups, rows: galAll.groups.rows.filter((r) => r[2] <= 92).map((r) => [r[0], r[1], +r[2].toFixed(1), Math.round(r[3]), Math.round(r[4]), Math.round(r[5])]) } };
const smallbodies = sbAll && { ...sbAll, rows: sbAll.rows.filter((r) => (r[8] ?? 0) < H_MAX[r[0]]).map((r) => r.map((v, i) => (i === 0 || v == null ? v : +v.toFixed(i === 7 ? 1 : 4)))) };
await fs.mkdir(path.join(root, 'standalone'), { recursive: true });
await fs.writeFile(path.join(root, 'standalone/snapshot.json'), JSON.stringify({ nearby: near, details, skies, textures, textureCredits, spectra, galaxy, smallbodies, satellites: satellitesSnap, satcat, horizons, clusters: clustersSnap, galaxies: galaxiesSnap }));
console.log(`snapshot: ${near.stars.length} stars, ${Object.keys(details).length} planetary systems, ${Object.keys(skies).length} skies, ${Object.keys(textures).length} textures`);

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
const out = `<title>USS Fidelity</title>\n${fonts}\n<style>\n${css}\n</style>\n${body}\n<script type="module">\n${js}\n</script>\n`;
await fs.writeFile(path.join(dist, 'fidelity.html'), out);
console.log(`wrote dist-standalone/fidelity.html (${(out.length / 1e6).toFixed(2)} MB)`);
