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

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// 1) snapshot: stars within 100 ly of Sol, every planet host's detail, and a few skies
const near = await nearby('sol', 100);
const details = {};
for (const row of near.stars) if (row[8] > 0) details[row[0]] = await starDetail(row[0]);
const skies = {};
for (const id of ['sol', 'hyg-70666', 'exo-trappist-1', 'hyg-8087', 'hyg-16496']) {
  try { skies[id] = await sky(id); } catch { /* not in this catalogue version */ }
}
// surfaces, embedded as data URIs (smaller variants where the full map is large)
const textures = {}, textureCredits = {};
const SKIP_IN_PREVIEW = new Set(['venusSurface']); // not used by any view yet
for (const [key, sources] of Object.entries(TEXTURES)) {
  if (SKIP_IN_PREVIEW.has(key)) continue;
  let url = null, buf = null;
  for (const u of [PREVIEW[key], ...sources.map((s) => s.url).reverse()].filter(Boolean)) {
    buf = await download(u);
    if (buf) { url = u; break; }
  }
  if (!buf) { console.warn(`  texture ${key}: unavailable, placeholder will be used`); continue; }
  textures[key] = `data:${url.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${buf.toString('base64')}`;
  textureCredits[key] = (sources.find((s) => s.url === url) ?? sources[0]).credit;
}
// stellar spectrum library, thinned to 4 nm steps for the preview
const lib = await library();
const spectra = { ...lib, grid: { ...lib.grid, step: lib.grid.step * 2 }, entries: lib.entries.map((e) => ({ ...e, flux: e.flux.filter((_, i) => i % 2 === 0) })) };
// galaxy: the luminous stars (M ≤ 0) within 1.5 kly — ≈8k of the 46k the backend serves
const galaxy = await galaxyStars(1500, 0);
await fs.mkdir(path.join(root, 'standalone'), { recursive: true });
await fs.writeFile(path.join(root, 'standalone/snapshot.json'), JSON.stringify({ nearby: near, details, skies, textures, textureCredits, spectra, galaxy }));
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
