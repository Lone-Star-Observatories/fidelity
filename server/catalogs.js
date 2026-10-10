// Inventory of catalogs already downloaded to local disk (e.g. a RAID volume).
// Point FIDELITY_CATALOG_DIRS at the folders and run `npm run catalogs`, or open
// /api/catalogs. Files are recognised by name and matched to the view that uses them.

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export const KNOWN = [
  { id: 'hyg', re: /hyg|athyg/i, name: 'HYG / AT-HYG star database', views: ['navigation', 'quadrant'] },
  { id: 'gaia', re: /gaia|gdr3|dr3_|gedr3/i, name: 'Gaia DR3 (stars, astrophysical params)', views: ['navigation', 'quadrant', 'star'] },
  { id: 'hipparcos', re: /hipparcos|\bhip2?\b|hip_main/i, name: 'Hipparcos catalogue', views: ['navigation'] },
  { id: 'tycho', re: /tycho|tyc2/i, name: 'Tycho-2', views: ['navigation'] },
  { id: 'exoplanets', re: /exoplanet|pscomppars|\bps_\d|planetarysystems/i, name: 'NASA Exoplanet Archive', views: ['navigation', 'system', 'planet'] },
  { id: 'mpcorb', re: /mpcorb|nea\.txt|astorb/i, name: 'MPC / Lowell asteroid orbits', views: ['object'] },
  { id: 'sbdb', re: /sbdb|small.?bod/i, name: 'JPL Small-Body Database export', views: ['object'] },
  { id: 'jpl-de', re: /\bde4\d\d|\.bsp$/i, name: 'JPL planetary ephemeris (DE / SPICE kernel)', views: ['system', 'moon'] },
  { id: 'tle', re: /\.tle$|\.3le$|celestrak|gp\.(csv|json)|satcat/i, name: 'Satellite orbital elements (TLE/OMM)', views: ['satellite'] },
  { id: 'ngc', re: /\bngc|openngc|messier|caldwell/i, name: 'Deep-sky objects (NGC/IC/Messier)', views: ['quadrant', 'galaxy'] },
  { id: 'clusters', re: /harris|globular|hunt.?reffert|cantat|open.?cluster/i, name: 'Star cluster catalogue', views: ['quadrant', 'galaxy'] },
  { id: 'galaxies', re: /\bned\b|hyperleda|leda|cosmicflows|cf4|2mrs|glade|updated.?nearby|lvg/i, name: 'Galaxy catalogue / distances', views: ['universe'] },
  { id: 'textures', re: /\d+k_|bluemarble|blue.?marble|_texture|\.(ktx2|dds)$/i, name: 'Planet / moon textures', views: ['planet', 'moon'] },
];

const DATA_EXT = /\.(csv|tsv|txt|dat|json|fits?|fit\.gz|vot|xml|parquet|gz|bz2|zip|bsp|tle|3le|png|jpe?g|tif{1,2}|ktx2|dds|sqlite|db)$/i;

async function walk(dir, depth, out) {
  if (depth < 0 || out.length > 5000) return;
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, depth - 1, out);
    else if (DATA_EXT.test(e.name)) {
      const st = await fs.stat(p).catch(() => null);
      if (st) out.push({ path: p, bytes: st.size, modified: st.mtime.toISOString() });
    }
  }
}

export async function scanCatalogs(dirs = config.catalogDirs, depth = 6) {
  const files = [];
  const roots = [];
  for (const d of dirs) {
    const ok = await fs.stat(d).then((s) => s.isDirectory()).catch(() => false);
    roots.push({ dir: d, readable: ok });
    if (ok) await walk(d, depth, files);
  }
  for (const f of files) {
    const hit = KNOWN.find((k) => k.re.test(path.basename(f.path)) || k.re.test(path.dirname(f.path)));
    f.catalog = hit ? hit.id : null;
  }
  const catalogs = KNOWN.map((k) => {
    const mine = files.filter((f) => f.catalog === k.id);
    return { id: k.id, name: k.name, views: k.views, files: mine.length,
      bytes: mine.reduce((s, f) => s + f.bytes, 0), paths: mine.slice(0, 20).map((f) => f.path) };
  }).filter((c) => c.files > 0);
  return { roots, catalogs, unrecognised: files.filter((f) => !f.catalog).slice(0, 200) };
}
