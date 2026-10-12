// #80 / #83 follow-ups: BigTIFF and ISIS cube readers, high-resolution tiers, the Venus SAR tile route's choices,
// Charon's rim mask, the measured Earth cloud tops (colour map → heights), the cloud mask and the shells' sides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { openTiff, openCube, sourceFor, partPixel, maxLevel, DEM_SOURCES, NO_DEM } from '../server/dem.js';
import { sarSource, sarBox, SAR_LEVELS } from '../server/sartiles.js';
import { parseColormap, heightLookup, encodeHeights, encodeHeight, decodeHeight } from '../server/earthclouds.js';
import { decodePng } from '../server/pngdecode.js';
import { greyPng } from '../server/tiff.js';
import { gapDistance, isoTexture, maskNoisyEdges } from '../src/astro/dem.js';
import { tileMaxLevel, tileMinLevel } from '../src/data/dem.js';
import { cloudGate, cthKm, icePriorMask, shellSide } from '../src/views/system/clouds.js';

const close = (a, b, eps, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} ≉ ${b} (±${eps})`);

test('BigTIFF reader: 8-byte offsets, LONG8 strip table, uint8 samples', async () => {
  const W = 6, H = 3, px = Uint8Array.from({ length: W * H }, (_, i) => i * 10);
  const tags = [[256, 3, 1, W], [257, 3, 1, H], [258, 3, 1, 8], [259, 3, 1, 1], [273, 16, H, 0], [277, 3, 1, 1], [278, 3, 1, 1], [339, 3, 1, 1]];
  const ifd = 16, entries = 8 + tags.length * 20 + 8, stripTab = ifd + entries, dataOff = stripTab + 8 * H;
  const buf = Buffer.alloc(dataOff + px.length);
  buf.write('II', 0, 'latin1'); buf.writeUInt16LE(43, 2); buf.writeUInt16LE(8, 4); buf.writeBigUInt64LE(BigInt(ifd), 8);
  buf.writeBigUInt64LE(BigInt(tags.length), ifd);
  tags.forEach(([t, type, count, v], k) => {
    const o = ifd + 8 + k * 20;
    buf.writeUInt16LE(t, o); buf.writeUInt16LE(type, o + 2); buf.writeBigUInt64LE(BigInt(count), o + 4);
    if (t === 273) buf.writeBigUInt64LE(BigInt(stripTab), o + 12); else buf.writeUInt16LE(v, o + 12);
  });
  for (let y = 0; y < H; y++) buf.writeBigUInt64LE(BigInt(dataOff + y * W), stripTab + 8 * y);
  Buffer.from(px).copy(buf, dataOff);
  const r = await openTiff({ lonWest: -180 }, async (a, b) => buf.subarray(a, b + 1));
  assert.ok(r.big); assert.equal(r.type, 'u8'); assert.equal(r.W, W); assert.equal(r.H, H);
  assert.deepEqual(Array.from(await r.row(2, 1, 3)), [130, 140, 150]);
});

test('ISIS cube reader: tiled LSB reals with special pixels as no data', async () => {
  const W = 4, H = 2, tw = 2, th = 2, start = 512;
  const label = Buffer.alloc(start, ' ');
  label.write(`Object = IsisCube\n Samples = ${W}\n Lines = ${H}\n Format = Tile\n TileSamples = ${tw}\n TileLines = ${th}\n Type = Real\n ByteOrder = Lsb\n Base = 0.0\n Multiplier = 1.0\n StartByte = ${start + 1}\nEnd\n`, 0, 'latin1');
  const data = Buffer.alloc(W * H * 4);
  // two tiles across, one down; values = 100·row + col; (1, 3) special
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = Math.floor(x / tw), o = (tx * tw * th + y * tw + (x % tw)) * 4;
    data.writeFloatLE(y === 1 && x === 3 ? -3.4028226550889045e38 : 100 * y + x, o);
  }
  const buf = Buffer.concat([label, data]);
  const r = await openCube({}, async (a, b) => buf.subarray(a, b + 1));
  assert.equal(r.W, W); assert.equal(r.H, H);
  const row1 = Array.from(await r.row(1));
  assert.deepEqual(row1.slice(0, 3), [100, 101, 102]); assert.ok(Number.isNaN(row1[3]));
  assert.deepEqual(Array.from(await r.row(0, 1, 2)), [1, 2]);
});

test('high-resolution tiers: SLDEM2015 + LOLA 118 m for the Moon, MOLA–HRSC for Mars, from level 5', () => {
  assert.equal(sourceFor(DEM_SOURCES.moon, 4), DEM_SOURCES.moon.hi, 'LDEM_64 up to level 4');
  const t = sourceFor(DEM_SOURCES.moon, 6);
  assert.equal(t.parts.length, 33, '32 SLDEM2015 tiles and the LOLA 118 m fallback');
  assert.ok(t.parts.every((p) => p.url.startsWith('https://')));
  assert.equal(maxLevel(DEM_SOURCES.moon.tilePpd), 7);
  assert.equal(maxLevel(DEM_SOURCES.mars.tilePpd), 6);
  // the 30°×45° SLDEM tile 00n_30n_000_045 holds 20° N 10° E near its row 5120 (from its top at 30° N)
  const sl = t.parts.find((p) => p.url.includes('00n_30n_000_045'));
  const px = partPixel(sl, sl.W, sl.H, 20, 10);
  assert.deepEqual(px, { x: Math.floor((10 / 45) * 23040), y: Math.floor((10 / 30) * 15360) });
  assert.equal(partPixel(sl, sl.W, sl.H, 20, 50), null, 'east of the tile');
  assert.equal(partPixel(sl, sl.W, sl.H, -1, 10), null, 'south of the tile');
  assert.ok(t.parts.filter((p) => partPixel(p, 100, 100, 75, 30)).length === 1, 'towards the poles only LOLA 118 m');
});

test('Enceladus\' shape model is read from −180° (its tie point), Titan is bundled with an interpolated drawn surface', () => {
  assert.equal(DEM_SOURCES.enceladus.global.lonWest, -180);
  assert.ok(DEM_SOURCES.titan && DEM_SOURCES.titan.drawn && DEM_SOURCES.titan.noTiles);
  assert.ok(!NO_DEM.titan, 'Titan has a DEM now');
  assert.ok(NO_DEM.ganymede && NO_DEM.europa && NO_DEM.callisto && NO_DEM.io);
});

test('client tile levels: tilePpd overrides, coarse levels that add nothing are skipped, no tiles for Titan', () => {
  assert.equal(tileMaxLevel({ sourcePpd: 64 }), 4);
  assert.equal(tileMaxLevel({ sourcePpd: 64, tilePpd: 512 }), 7);
  assert.equal(tileMaxLevel({ sourcePpd: 4, tilePpd: 0 }), -1);
  assert.equal(tileMinLevel({ width: 1440 }), 1, 'level 0 (2.8 px/°) is coarser than the 4 px/° grid');
  assert.equal(tileMinLevel({ width: 720 }), 0);
});

test('Venus SAR tiles: C3-MIDR for levels 3–4, the 225 m mosaic for 5–7, 75 m at 8; a few pixels averaged per cell', () => {
  assert.deepEqual(SAR_LEVELS.venus, { min: 3, max: 8 });
  assert.ok(sarSource('venus', 3).url.includes('C3-MDIR'));
  assert.ok(sarSource('venus', 6).url.includes('225m'));
  assert.ok(sarSource('venus', 8).url.includes('75m'));
  assert.equal(sarSource('mars', 5), null);
  const s = sarSource('venus', 5);
  close(s.latTop, 84, 0.01, 'the 225 m mosaic starts at 84° N'); close(s.latTop - s.latH, -80, 0.02, 'and stops at 80° S');
  assert.equal(sarBox(52.2, 4), 1); assert.equal(sarBox(469.4, 5), 3); assert.equal(sarBox(469.4, 7), 1);
});

test('Charon\'s rim mask: streaky or smooth cells next to a gap go, textured terrain stays', () => {
  const W = 120, H = 60, h = new Float32Array(W * H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x >= 80) h[i] = NaN; // the unseen side
    else if (x >= 70) h[i] = 50 * Math.sin(y * 0.9) + 0.5 * x; // a 10-cell band of along-track streaks (texture in y only)
    else h[i] = 100 * rnd(); // textured terrain
  }
  const d = gapDistance({ width: W, height: H, heights: h });
  assert.equal(d[30 * W + 79], 1); assert.equal(d[30 * W + 80], 0); assert.equal(d[30 * W + 75], 5);
  const t = isoTexture({ width: W, height: H, heights: h });
  assert.ok(t[30 * W + 75] < 0.2 * t[30 * W + 30], 'streaks have little texture across them');
  const m = maskNoisyEdges({ width: W, height: H, heights: h }, { band: 20, k: 0.35, erode: 1 });
  let streakLeft = 0, terrainGone = 0;
  // (the texture window, 7 cells, reaches the good terrain from the band's inner three columns: those stay)
  for (let y = 5; y < H - 5; y++) { for (let x = 74; x < 80; x++) if (Number.isFinite(m.heights[y * W + x])) streakLeft++; for (let x = 5; x < 60; x++) if (!Number.isFinite(m.heights[y * W + x])) terrainGone++; }
  assert.equal(streakLeft, 0, 'the streaky rim is masked');
  assert.equal(terrainGone, 0, 'the terrain inside is kept');
});

test('Earth\'s measured cloud tops: GIBS colour map → metres → 8-bit codes, and back', () => {
  const xml = `<ColorMaps><ColorMap><Entries><ColorMapEntry rgb="220,220,255" transparent="true" sourceValue="[-9999,0)" nodata="true" ref="0"/></Entries></ColorMap>
    <ColorMap units="m"><Entries><ColorMapEntry rgb="255,0,0" transparent="false" sourceValue="[0,50)" value="[0,50)" ref="1"/>
    <ColorMapEntry rgb="0,0,255" transparent="false" sourceValue="[9000,9050)" value="[9000,9050)" ref="12"/>
    <ColorMapEntry rgb="102,0,119" transparent="false" sourceValue="[12000,+INF)" value="[12000,+INF)" ref="16"/></Entries></ColorMap></ColorMaps>`;
  const e = parseColormap(xml);
  assert.equal(e.length, 4); assert.ok(e[0].nodata);
  const lk = heightLookup(e);
  assert.equal(lk.size, 3);
  assert.equal(lk.get(0x0000ff), 9025); assert.equal(lk.get(0x660077), 12025);
  const rgba = Uint8Array.from([0, 0, 255, 255, 220, 220, 255, 0, 255, 0, 0, 255, 1, 2, 3, 255]);
  const codes = encodeHeights(rgba, lk);
  assert.deepEqual(Array.from(codes), [encodeHeight(9025), 0, encodeHeight(25), 0]);
  close(decodeHeight(codes[0]), 9025, 25); assert.equal(decodeHeight(0), null);
  close(cthKm(codes[0]), 9.025, 0.025);
});

test('PNG decoder reads back an 8-bit greyscale PNG', () => {
  const px = Uint8Array.from({ length: 12 }, (_, i) => i * 20);
  const d = decodePng(greyPng(px, 4, 3));
  assert.equal(d.width, 4); assert.equal(d.height, 3);
  assert.equal(d.rgba[4 * 5], 100); assert.equal(d.rgba[4 * 5 + 3], 255);
  assert.ok(zlib);
});

test('cloud mask: the measured product decides, else the ice prior; ice prior covers the ice sheets and high snow', () => {
  assert.equal(cloudGate(0, 0), 0, 'no cloud-top retrieval: no cloud, however white');
  assert.equal(cloudGate(120, 1), 1, 'a measured cloud over ice is a cloud');
  assert.equal(cloudGate(null, 1), 0, 'without the product, an ice sheet is not cloud');
  assert.equal(cloudGate(null, 0), 1);
  const h = (lat, lon) => (lat < -60 ? 2500 : lat > 60 && lon > -50 && lon < -30 ? 2000 : Math.abs(lat - 30) < 4 && Math.abs(lon - 87) < 4 ? 5200 : lat > 40 && lat < 50 ? 300 : -3000);
  const W = 72, H = 36, m = icePriorMask(h, W, H);
  const at = (lat, lon) => m[Math.floor((90 - lat) / 180 * H) * W + Math.floor((lon + 180) / 360 * W)];
  assert.equal(at(-75, 0), 255, 'Antarctica'); assert.equal(at(72, -40), 255, 'Greenland'); assert.equal(at(30, 87), 255, 'Himalaya / Tibet');
  assert.equal(at(45, 10), 0, 'lowland Europe'); assert.equal(at(0, -150), 0, 'the ocean');
});

test('cloud shells draw only the faces the camera sees (no far-side faces through gaps in the ground)', () => {
  const R = 1 + 10 / 6371;
  assert.equal(shellSide(1.1, R), 0, 'from above: outer faces (THREE.FrontSide = 0)');
  assert.equal(shellSide(1 + 2 / 6371, R), 1, 'from below: inner faces (THREE.BackSide = 1)');
});
