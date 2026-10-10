#!/usr/bin/env node
// Named surface features (#37 follow-up): IAU-approved nomenclature from the USGS Gazetteer of
// Planetary Nomenclature, one small JSON per body in public/features/. Run after adding bodies:
//   node scripts/build-features.mjs
// Source: the Gazetteer's per-target "center points" shapefiles (we read only the .dbf table and
// the metadata's longitude convention). Output longitudes are planetocentric, east-positive,
// −180…180, like everything else in the app.

import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { solSystem } from '../src/data/systems.js';

const BUCKET = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com';
const MAX_PER_BODY = 5000; // every approved name (Mars, the Moon and Venus have ~2,000 each)
const out = new URL('../public/features/', import.meta.url);

/** Files in a zip archive (central directory), inflated on demand. */
function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    files[name] = () => {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 8 ? zlib.inflateRawSync(data) : data;
    };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** dBASE III table → array of row objects (strings). */
function readDbf(buf) {
  const n = buf.readUInt32LE(4), headerLen = buf.readUInt16LE(8), recLen = buf.readUInt16LE(10);
  const fields = [];
  for (let o = 32; buf[o] !== 0x0d; o += 32) fields.push({ name: buf.toString('latin1', o, o + 11).replace(/\0.*$/, ''), len: buf[o + 16] });
  const rows = [];
  for (let i = 0, p = headerLen; i < n; i++, p += recLen) {
    if (buf[p] === 0x2a) continue; // deleted
    let q = p + 1;
    const row = {};
    for (const f of fields) { row[f.name] = buf.toString('utf8', q, q + f.len).trim(); q += f.len; }
    rows.push(row);
  }
  return rows;
}

const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

const ids = new Set(solSystem().bodies.map((b) => b.id));
const listing = await (await fetch(`${BUCKET}/?list-type=2`)).text();
const targets = [...listing.matchAll(/<Key>([A-Z0-9_]+)_nomenclature_center_pts\.zip<\/Key>/g)].map((m) => m[1]);
await fs.mkdir(out, { recursive: true });
const index = {};
for (const target of targets) {
  const id = target.toLowerCase();
  if (!ids.has(id)) continue;
  const res = await fetch(`${BUCKET}/${target}_nomenclature_center_pts.zip`);
  if (!res.ok) { console.warn(`${target}: HTTP ${res.status}`); continue; }
  const files = unzip(Buffer.from(await res.arrayBuffer()));
  const dbfName = Object.keys(files).find((f) => f.endsWith('.dbf'));
  const metaName = Object.keys(files).find((f) => f.endsWith('.xml'));
  const meta = metaName ? files[metaName]().toString('utf8') : '';
  const west = /West longitude system|WEST_LON/i.test(meta) && !/East longitude system|EAST_LON/i.test(meta);
  const rows = readDbf(files[dbfName]())
    .filter((r) => /Adopted/i.test(r.approval) && !/Satellite Feature/i.test(r.type) && r.center_lat !== '' && r.center_lon !== '');
  const features = rows.map((r) => {
    const lon = Number(r.center_lon), d = Number(r.diameter) || 0;
    return [r.clean_name || r.name, Math.round(Number(r.center_lat) * 1e4) / 1e4, Math.round(wrap(west ? -lon : lon) * 1e4) / 1e4,
      Math.round(d * 10) / 10, r.type.split(',')[0].trim(), Number(r.link.match(/Feature\/(\d+)/)?.[1]) || null];
  }).sort((a, b) => b[3] - a[3]).slice(0, MAX_PER_BODY);
  await fs.writeFile(new URL(`${id}.json`, out), JSON.stringify({
    body: id, source: 'USGS Gazetteer of Planetary Nomenclature (IAU WGPSN)', url: 'https://planetarynames.wr.usgs.gov/',
    longitude: west ? 'converted from west-positive' : 'east-positive', total: rows.length,
    columns: ['name', 'lat', 'lon', 'diameterKm', 'type', 'gazetteerId'], features,
  }));
  index[id] = features.length;
  console.log(`${id}: ${features.length} of ${rows.length}${west ? ' (west → east)' : ''}`);
}
await fs.writeFile(new URL('index.json', out), JSON.stringify(index));
