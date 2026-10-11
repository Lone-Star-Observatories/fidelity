#!/usr/bin/env node
// Line-art world map for COMMS (#69): Natural Earth 1:50m country outlines (public domain), as
// TopoJSON from the world-atlas package (ISC). Shared arcs are country borders, unshared ones
// coastlines (src/data/worldmap.js decodes it). Run once:  node scripts/build-worldmap.mjs
import fs from 'node:fs/promises';

const URL_50M = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
const topo = await (await fetch(URL_50M)).json();
for (const g of topo.objects.countries.geometries) { delete g.id; g.properties = { name: g.properties?.name ?? '' }; }
await fs.writeFile(new URL('../public/shapes/world-50m.json', import.meta.url), JSON.stringify(topo));
console.log(`${topo.objects.countries.geometries.length} countries, ${topo.arcs.length} arcs`);
