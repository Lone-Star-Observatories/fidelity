#!/usr/bin/env node
// Inventory local catalogs: `npm run catalogs -- /Volumes/DATA/catalogs [more dirs]`
// (or set FIDELITY_CATALOG_DIRS). Prints what was found and which views can use it.

import { scanCatalogs } from '../server/catalogs.js';
import { config } from '../server/config.js';

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : config.catalogDirs;
if (!dirs.length) {
  console.error('Usage: npm run catalogs -- <dir> [dir...]   (or set FIDELITY_CATALOG_DIRS)');
  process.exit(1);
}

const gb = (b) => (b / 1e9 >= 1 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const { roots, catalogs, unrecognised } = await scanCatalogs(dirs);

for (const r of roots) console.log(`${r.readable ? '✔' : '✘'} ${r.dir}`);
console.log('\nRecognised catalogs:');
if (!catalogs.length) console.log('  (none)');
for (const c of catalogs) {
  console.log(`  ${c.name.padEnd(46)} ${String(c.files).padStart(5)} files ${gb(c.bytes).padStart(10)}  → ${c.views.join(', ')}`);
  for (const p of c.paths.slice(0, 3)) console.log(`      ${p}`);
}
if (unrecognised.length) {
  console.log(`\nUnrecognised data files (${unrecognised.length}${unrecognised.length >= 200 ? '+' : ''}):`);
  for (const f of unrecognised.slice(0, 25)) console.log(`  ${gb(f.bytes).padStart(10)}  ${f.path}`);
}
