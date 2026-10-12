// Elevation models (#80): the PNG codec, sampling conventions and normal maths, and the bundled
// DEMs against known summits and deeps (within what a 0.25° grid can hold).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  decodePng16, filter16, quantize, dequantize, sampleDem, demXY, cellLatLon, demUOffset, heightToRadius,
  slopeNormal, hillshade, extremaNear, downsample, fmtElevation, reliefK, quantStep, fillGaps,
} from '../src/astro/dem.js';
import { png16, maxLevel, tileBounds, openTiff, rasterToGrid, DEM_SOURCES } from '../server/dem.js';
import { readNetcdf } from '../server/netcdf.js';
import { siteDir } from '../src/views/system/sites.js';
import { dirToLatLon } from '../src/views/system/surface.js';

const close = (a, b, eps, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} ≉ ${b} (±${eps})`);
const index = JSON.parse(fs.readFileSync(new URL('../public/dem/index.json', import.meta.url)));
const inflate = (z) => zlib.inflateSync(z);

async function load(id) {
  const e = index.bodies[id];
  const png = fs.readFileSync(new URL(`../public/dem/${e.file}`, import.meta.url));
  const { width, height, data, text } = await decodePng16(png, inflate);
  assert.equal(Number(text.min), e.min); assert.equal(Number(text.max), e.max);
  return { ...e, width, height, heights: dequantize(data, e.min, e.max) };
}

test('16-bit PNG round trip: filter, deflate, decode, dequantise within one quantisation step', async () => {
  const W = 37, H = 11, h = new Float32Array(W * H).map((_, i) => (i % 7 === 3 ? NaN : Math.sin(i) * 9000 + i));
  const q = quantize(h);
  const png = png16(W, H, filter16(q.data, W, H), { min: String(q.min), max: String(q.max) });
  const d = await decodePng16(png, inflate);
  assert.equal(d.width, W); assert.equal(d.height, H); assert.equal(d.text.min, String(q.min));
  const back = dequantize(d.data, q.min, q.max), step = quantStep(q.min, q.max);
  for (let i = 0; i < h.length; i++) {
    if (Number.isNaN(h[i])) assert.ok(Number.isNaN(back[i]), 'no data stays no data');
    else close(back[i], h[i], step, `sample ${i}`);
  }
});

test('grid convention: column 0 starts at 180° W, row 0 at the north pole, longitude wraps', () => {
  const [x, y] = demXY(1440, 720, 89.875, -179.875);
  close(x, 0, 1e-9); close(y, 0, 1e-9);
  const ll = cellLatLon(1440, 720, 1439, 719);
  close(ll.lat, -89.875, 1e-9); close(ll.lon, 179.875, 1e-9);
  close(demXY(1440, 720, 0, 190)[0], demXY(1440, 720, 0, -170)[0], 1e-9, '190° E is 170° W');
  // a body whose colour map starts at 0° (Pluto) samples the DEM half a turn on
  close(demUOffset(0), 0.5, 1e-12); close(demUOffset(), 0, 1e-12);
});

test('bilinear sampling interpolates between cell centres and skips no-data cells', () => {
  const dem = { width: 4, height: 2, heights: new Float32Array([0, 100, 200, 300, 400, 500, NaN, 700]) };
  const c = (x, y) => cellLatLon(4, 2, x, y);
  close(sampleDem(dem, c(1, 0).lat, c(1, 0).lon), 100, 1e-6);
  close(sampleDem(dem, c(0, 0).lat, (c(0, 0).lon + c(1, 0).lon) / 2), 50, 1e-6, 'halfway between columns');
  close(sampleDem(dem, c(0, 0).lat, c(3, 0).lon + 45), 150, 1e-6, 'across the date line: 300 and 0');
  assert.ok(Number.isNaN(sampleDem(dem, c(2, 1).lat, c(2, 1).lon)), 'a no-data cell centre has no height');
  close(sampleDem(dem, c(1, 1).lat, (c(1, 1).lon + c(2, 1).lon) / 2), 500, 1e-6, 'its neighbour carries the blend alone');
  assert.ok(Number.isNaN(sampleDem({ width: 2, height: 1, heights: new Float32Array([NaN, NaN]) }, 0, 0)));
});

test('height → radius: 1 + k·h/R, the sphere when off or without data', () => {
  close(heightToRadius(21000, 3389.5, 1), 1 + 21000 / 3389500, 1e-12);
  close(heightToRadius(21000, 3389.5, 10), 1 + 210000 / 3389500, 1e-12);
  assert.equal(heightToRadius(21000, 3389.5, 0), 1);
  assert.equal(heightToRadius(NaN, 3389.5, 1), 1);
  assert.equal(reliefK('x5'), 5); assert.equal(reliefK('off'), 0); assert.equal(reliefK('nonsense'), 1);
});

test('normal maths: a uniform eastward ramp of 10 % tilts the normal west by atan(0.1)', () => {
  const W = 360, H = 180, R = 1000; // km
  const heights = new Float32Array(W * H);
  const metresPerDeg = (Math.PI / 180) * R * 1000;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) heights[y * W + x] = 0.1 * x * metresPerDeg; // at the equator, ignoring the wrap
  const n = slopeNormal({ width: W, height: H, heights }, 0.5, 10.5, R);
  close(n.sE, 0.1, 1e-3); close(n.sN, 0, 1e-9);
  close(n.slopeDeg, Math.atan(0.1) * 180 / Math.PI, 0.01);
  close(n.normal[0], -0.1 / Math.hypot(0.1, 1), 1e-3); close(n.normal[2], 1 / Math.hypot(0.1, 1), 1e-3);
  // lit from the east (downhill side faces west): darker than lit from the west
  assert.ok(hillshade(n.normal, 90, 30) < hillshade(n.normal, 270, 30));
  close(hillshade([0, 0, 1], 0, 30), 0.5, 1e-9, 'flat ground under a 30° sun');
  // ×5 exaggeration multiplies the slope
  close(slopeNormal({ width: W, height: H, heights }, 0.5, 10.5, R, 5).sE, 0.5, 5e-3);
});

test('box downsampling averages and ignores gaps', () => {
  const d = downsample({ width: 4, height: 2, heights: new Float32Array([1, 3, 5, NaN, 2, 4, 6, 8]) }, 2, 1);
  close(d.heights[0], 2.5, 1e-6); close(d.heights[1], 19 / 3, 1e-5);
});

test('Mars (MOLA): Olympus Mons ≈ 21.2 km at 18.65° N 226.2° E; Hellas floor ≈ −8 km', async () => {
  const mars = await load('mars');
  const top = extremaNear(mars, 18.65, 226.2, 1.5).max;
  assert.ok(top.h > 20500 && top.h < 21300, `Olympus Mons summit cell ${top.h} m`); // MOLA peak 21,229 m; a 0.25° cell averages ~15 km
  // the quoted 18.65° N 226.2° E is the edifice's centre; MOLA's highest 16 px/° cell is 17.34° N 226.97° E on the caldera rim
  close(top.lat, 18.65, 1.6, 'summit lat'); close(((top.lon + 360) % 360), 226.2, 1.2, 'summit lon');
  const hellas = extremaNear(mars, -33, 62, 4).min; // the deepest part of Hellas Planitia
  assert.ok(hellas.h < -7500 && hellas.h > -8300, `Hellas ${hellas.h}`);
  // Tharsis stands high, the northern plains low
  assert.ok(sampleDem(mars, 0, -112) > 6000 && sampleDem(mars, 60, 0) < -3000);
});

test('Earth (ETOPO1): Everest and Challenger Deep at the 0.25° grid\'s resolution', async () => {
  const earth = await load('earth');
  const everest = extremaNear(earth, 27.988, 86.925, 1).max, deep = extremaNear(earth, 11.35, 142.2, 1).min;
  // ETOPO1 itself peaks at 8,271 m / −10,898 m on its 1′ grid; 0.25° cells average a 28 km box
  assert.ok(everest.h > 5800 && everest.h < 8849, `Everest cell ${everest.h}`);
  assert.ok(deep.h < -8500 && deep.h > -10995, `Challenger Deep cell ${deep.h}`);
  close(sampleDem(earth, 0, -30), -4000, 2000, 'mid-Atlantic abyss');
  assert.ok(sampleDem(earth, -80, 30) > 2000, 'the East Antarctic ice surface');
});

test('Venus (Magellan): Maxwell Montes ≈ 11 km at 65° N 3° E', async () => {
  const venus = await load('venus');
  const top = extremaNear(venus, 65.2, 3.3, 2).max;
  assert.ok(top.h > 9500 && top.h < 11300, `Maxwell Montes ${top.h} (above 6051 km)`);
});

test('Moon (LOLA): the highest point ≈ 10.6 km near 5.4° N 201.4° E, South Pole–Aitken deep', async () => {
  const moon = await load('moon');
  const top = extremaNear(moon, 5.4, -158.6, 2).max;
  assert.ok(top.h > 9800 && top.h < 10800, `Selenean summit ${top.h}`);
  assert.ok(extremaNear(moon, -69.7, -172, 2).min.h < -8000, 'Antoniadi crater in SPA, the lowest place on the Moon (≈ −9.1 km)');
  assert.ok(sampleDem(moon, 15, 0) < sampleDem(moon, -30, 10), 'maria lie below the highlands');
});

test('every bundled DEM is well formed and credited; partial ones say so', async () => {
  for (const [id, e] of Object.entries(index.bodies)) {
    assert.ok(DEM_SOURCES[id], `${id} has a source`);
    assert.equal(e.height * 2, e.width, `${id} is 2:1`);
    assert.ok(e.credit && e.licence && e.source.startsWith('https://'), `${id} credited`);
    assert.ok(e.max > e.min && e.refRadiusKm > 0);
    if (e.coverage < 0.9) assert.ok(e.partial, `${id} covers ${e.coverage}: must explain`);
    assert.ok(e.bytes < 2.5e6, `${id} stays small (${e.bytes} bytes)`);
  }
  assert.ok(Object.keys(index.bodies).length >= 10);
});

test('site directions and DEM samples agree for a body with a texture offset (Pluto, texLon0 = 0)', () => {
  // the globe puts east lon L at mesh u = (L − texLon0) / 360; the DEM's u is (L + 180) / 360
  const L = 30, d = siteDir({ texLon0: 0 }, 10, L), meshLon = dirToLatLon(d).lon;
  const meshU = (meshLon + 180) / 360, demU = (meshU + demUOffset(0)) % 1;
  close(demU, (L + 180) / 360, 1e-9);
});

test('tile levels and bounds', () => {
  assert.equal(maxLevel(64), 4); assert.equal(maxLevel(2), 0); assert.equal(maxLevel(16), 2);
  assert.deepEqual(tileBounds(0, 0, 0), { west: -180, north: 90, deg: 90 });
  assert.deepEqual(tileBounds(2, 9, 3), { west: 22.5, north: 22.5, deg: 22.5 });
});

test('TIFF reader and grid resampling on a synthetic int16 GeoTIFF (0…360° E, no-data −32768)', async () => {
  const W = 8, H = 4, px = new Int16Array(W * H).map((_, i) => (i === 5 ? -32768 : i * 10));
  const tags = [[256, 3, 1, W], [257, 3, 1, H], [258, 3, 1, 16], [259, 3, 1, 1], [273, 4, H, 0], [277, 3, 1, 1], [278, 3, 1, 1], [339, 3, 1, 2], [42113, 2, 7, 0]];
  const ifd = 8, entries = 2 + tags.length * 12 + 4, stripTab = ifd + entries, ndOff = stripTab + 4 * H, dataOff = ndOff + 8;
  const buf = Buffer.alloc(dataOff + px.length * 2);
  buf.write('II', 0, 'latin1'); buf.writeUInt16LE(42, 2); buf.writeUInt32LE(ifd, 4); buf.writeUInt16LE(tags.length, ifd);
  tags.forEach(([t, type, count, v], k) => {
    const o = ifd + 2 + k * 12;
    buf.writeUInt16LE(t, o); buf.writeUInt16LE(type, o + 2); buf.writeUInt32LE(count, o + 4);
    if (t === 273) buf.writeUInt32LE(stripTab, o + 8); else if (t === 42113) buf.writeUInt32LE(ndOff, o + 8); else if (type === 3) buf.writeUInt16LE(v, o + 8); else buf.writeUInt32LE(v, o + 8);
  });
  for (let y = 0; y < H; y++) buf.writeUInt32LE(dataOff + y * W * 2, stripTab + 4 * y);
  buf.write('-32768\0', ndOff, 'latin1');
  Buffer.from(px.buffer).copy(buf, dataOff);
  const read = async (a, b) => buf.subarray(a, b + 1);
  const r = await openTiff({ scale: 0.5, lonWest: 0 }, read);
  assert.equal(r.nodata, -32768);
  const row0 = await r.row(0);
  assert.ok(Number.isNaN(row0[5])); close(row0[4], 20, 1e-9);
  // onto a 4×2 canonical grid: column 0 (180° W…90° W) holds source columns 4–5 (180°…270° E)
  const g = await rasterToGrid(r, 4, 2);
  close(g[0], ((4 * 10 + 12 * 10 + 13 * 10) * 0.5) / 3, 1e-4, 'average of the valid cells, no-data skipped');
});

test('netCDF-3 reader pulls a short grid with its fill value', () => {
  // dims lat(2) lon(3); var z(lat, lon) short with _FillValue
  const parts = [];
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); parts.push(b); };
  const name = (s) => { u32(s.length); const b = Buffer.alloc(Math.ceil(s.length / 4) * 4); b.write(s, 'latin1'); parts.push(b); };
  parts.push(Buffer.from('CDF\x01', 'latin1')); u32(0);
  u32(10); u32(2); name('lat'); u32(2); name('lon'); u32(3);
  u32(0); u32(0);
  u32(11); u32(1); name('z'); u32(2); u32(0); u32(1);
  u32(12); u32(1); name('_FillValue'); u32(3); u32(1); { const b = Buffer.alloc(4); b.writeInt16BE(32767); parts.push(b); }
  u32(3); u32(12);
  const head = Buffer.concat(parts), begin = head.length + 4;
  const data = Buffer.alloc(12); [1, -2, 3, 32767, 5, -6].forEach((v, i) => data.writeInt16BE(v, i * 2));
  const b4 = Buffer.alloc(4); b4.writeUInt32BE(begin);
  const nc = readNetcdf(Buffer.concat([head, b4, data]));
  assert.deepEqual(nc.dims, { lat: 2, lon: 3 });
  assert.deepEqual(Array.from(nc.vars.z.values()), [1, -2, 3, 32767, 5, -6]);
  assert.equal(nc.vars.z.attrs._FillValue[0], 32767);
});

test('gap fill: data kept, no holes, eases from the edge of the data back to the reference surface', () => {
  const W = 360, H = 180, heights = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) heights[y * W + x] = x < 180 ? 3000 : NaN; // one hemisphere seen
  const f = fillGaps({ width: W, height: H, heights });
  assert.ok(f.every(Number.isFinite));
  for (let x = 0; x < 180; x += 17) assert.equal(f[90 * W + x], 3000);
  const nearEdge = f[90 * W + 182], far = f[90 * W + 270];
  assert.ok(nearEdge > 2000, `next to the data ${nearEdge}`);
  assert.ok(far < nearEdge && far >= 0, `far into the gap ${far}`);
  assert.equal(fillGaps({ width: 2, height: 1, heights: new Float32Array([1, 2]) })[1], 2, 'nothing to fill');
});

test('elevations read as signed metres', () => {
  assert.equal(fmtElevation(21229), '+21,229 M');
  assert.equal(fmtElevation(-8180), '−8,180 M');
  assert.equal(fmtElevation(21229, { km: true }), '+21.23 KM');
  assert.equal(fmtElevation(NaN), 'NO DATA');
});

test('mesh directions map back to planetocentric lat / east lon on offset maps (Pluto 0°, Ceres 0°, the rest −180°)', async () => {
  const { meshDirToLatLon } = await import('../src/views/system/relief.js');
  for (const body of [{ id: 'pluto', texLon0: 0 }, { id: 'mars' }, { id: 'x', texLon0: -90 }]) {
    for (const [lat, lon] of [[18.65, -133.8], [-42, 70], [0, 179.5], [5, -179.5]]) {
      const ll = meshDirToLatLon(body, siteDir(body, lat, lon));
      close(ll.lat, lat, 1e-9); close(((ll.lon - lon + 540) % 360) - 180, 0, 1e-9, `${body.id} lon`);
    }
  }
});

test('Ceres\' colour map is registered like its DEM: the USGS Dawn mosaic starts at 0° E', async () => {
  const { SMALL_BODIES } = await import('../src/data/moons.js');
  assert.equal(SMALL_BODIES.find((b) => b.id === 'ceres').texLon0, 0);
});
