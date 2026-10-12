import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { seaLevelAt, iceSlices, MESSINIAN, biomeSlices, saharaWeight, biomeWeight } from '../src/views/system/paleoearth.js';
import { BIOME_YEARS, BIOME_NAMES } from '../src/data/paleo-biomes.js';
import { SEA_LEVEL } from '../src/data/paleo.js';

/** Decode the PNGs scripts/paleoearth.js writes (8-bit, filter 0 on every row). */
function readPng(file) {
  const b = fs.readFileSync(file); let p = 8, w = 0, h = 0, ch = 0; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : d[9] === 2 ? 3 : 1; } else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) { assert.equal(raw[y * (w * ch + 1)], 0); raw.copy(px, y * w * ch, y * (w * ch + 1) + 1, (y + 1) * (w * ch + 1)); }
  return { w, h, ch, px };
}
const elev = readPng(new URL('../public/paleo/earth-elev.png', import.meta.url));
const at = (lat, lon) => { const j = Math.floor((90 - lat) / 0.25), i = Math.floor((lon + 180) / 0.25), k = (j * elev.w + i) * elev.ch; return { e: (elev.px[k] / 255) * 800 - 400, spill: (elev.px[k + 1] / 255) * 800 - 400, ocean: elev.px[k + 2] > 127, med: elev.px[k + 3] > 0, a: elev.px[k + 3] }; };
// the Messinian shader's decoding of alpha: basin side and depth (m)
const medOf = (p) => (p.a === 0 ? null : p.a < 128 ? { side: 'west', depth: ((p.a - 1) / 126) * 4500 } : { side: 'east', depth: ((p.a - 128) / 127) * 4500 });
// the shader's rule
const seaAt = (p, sea) => (p.ocean ? p.e <= sea : p.spill < sea);

test('sea-level layer: floods only what the open ocean reaches', () => {
  assert.equal(seaAt(at(27.5, -81.5), 0), false, 'Florida is land today');
  assert.equal(seaAt(at(27.5, -81.5), 65), true, '+65 m drowns Florida');
  assert.equal(seaAt(at(36.25, -116.85), 65), false, 'Death Valley (below sea level) stays dry: the sea cannot reach it at +65 m');
  assert.equal(seaAt(at(42, 50.5), 0), false, 'the Caspian is not the open ocean');
  assert.equal(seaAt(at(54.5, 3), 0), true, 'the North Sea today');
  assert.equal(seaAt(at(54.5, 3), -120), false, 'Doggerland at the LGM');
  assert.equal(at(35, 18).med, true, 'the Ionian Sea is in the Mediterranean basin');
  assert.equal(at(45, -4).med, false, 'the Bay of Biscay is not');
  assert.equal(at(36, -8).med, false, 'nor the Gulf of Cadiz, west of the Gibraltar sill');
  assert.equal(at(43, 34).med, false, 'nor the Black Sea (not open ocean)');
});

test('ice-sheet masks: none over Canada today, the Laurentide at 20 ka', () => {
  const ice = (t, lat, lon) => { const m = readPng(new URL(`../public/paleo/ice-${t}.png`, import.meta.url)); return m.px[Math.floor((90 - lat) / 0.25) * m.w + Math.floor((lon + 180) / 0.25)] > 127; };
  assert.equal(ice(0, 56, -85), false, 'Hudson Bay region ice-free today');
  assert.equal(ice(20000, 56, -85), true, 'under the Laurentide at 20 ka');
  assert.equal(ice(0, -80, 0), true, 'Antarctica today');
  assert.equal(ice(20000, 60, 15), true, 'Fennoscandian ice sheet at 20 ka');
});

test('sea level by time and ice-slice blending', () => {
  assert.ok(Math.abs(seaLevelAt(SEA_LEVEL, 0)) < 1e-9, 'anchored to 0 today');
  assert.ok(seaLevelAt(SEA_LEVEL, 21) < -100, 'LGM');
  assert.equal(seaLevelAt(SEA_LEVEL, 900), null, 'beyond the record');
  assert.deepEqual(iceSlices(21000), { a: 20000, b: 22500, mix: 0.4 });
  assert.equal(iceSlices(40000), null);
});

test('Messinian: basins either side of the Sicily sill, depths, and where brine stays at the peak drawdown', () => {
  for (const [name, lat, lon] of [['Balearic', 40, 5], ['Tyrrhenian', 40, 12.5], ['Alboran', 36, -3]]) assert.equal(medOf(at(lat, lon)).side, 'west', name);
  for (const [name, lat, lon] of [['Ionian', 36, 18], ['Herodotus', 33.5, 28], ['Adriatic', 43, 15], ['Aegean', 38, 25]]) assert.equal(medOf(at(lat, lon)).side, 'east', name);
  assert.ok(medOf(at(36, 18)).depth > 3500, 'the Ionian abyssal plain is deep');
  assert.ok(medOf(at(43, 15)).depth < 300, 'the Adriatic is shallow');
  const brine = (lat, lon) => { const m = medOf(at(lat, lon)); return m.depth - (m.side === 'east' ? MESSINIAN.eastM : MESSINIAN.westM); };
  // Aloisi et al. 2024: the deep Ionian and Herodotus sub-basins stayed filled with more than 1 km of brine
  assert.ok(brine(36, 18) > 1000, 'Ionian brine > 1 km'); assert.ok(brine(33.5, 28) > 1000, 'Herodotus brine > 1 km');
  assert.ok(brine(43, 15) < 0 && brine(38, 25) < 0, 'the Adriatic and Aegean floors are exposed');
  assert.equal(medOf(at(45, -4)), null, 'the Bay of Biscay is outside');
});

test('vegetation: BIOME4 slices (Beyer et al. 2020) and the 6 ka North Africa proxy map (Hoelzmann et al. 1998)', () => {
  assert.equal(BIOME_YEARS.length, 72); assert.equal(BIOME_YEARS[0], 0); assert.equal(BIOME_YEARS.at(-1), 120000);
  assert.equal(BIOME_NAMES[21], 'Desert'); assert.equal(BIOME_NAMES[28], 'Land ice');
  assert.deepEqual(biomeSlices(6000), { a: 6000, b: 6000, mix: 0 });
  assert.deepEqual(biomeSlices(23000), { a: 22000, b: 24000, mix: 0.5 }); // 2 kyr steps before 22 ka
  assert.equal(biomeSlices(130000), null);
  assert.equal(biomeWeight(0), 0); assert.equal(biomeWeight(3000), 1); // today's imagery near the present
  assert.equal(saharaWeight(6000), 1); assert.equal(saharaWeight(4500), 0); assert.equal(saharaWeight(9000), 0);
  const biome = (y, lat, lon) => { const m = readPng(new URL(`../public/paleo/biome-${y}.png`, import.meta.url)); return BIOME_NAMES[m.px[Math.floor((90 - lat) / 0.5) * m.w + Math.floor((lon + 180) / 0.5)] - 1]; };
  assert.equal(biome(0, -3, -60), 'Tropical evergreen forest', 'the Amazon today');
  assert.equal(biome(21000, 56, -85), 'Land ice', 'the Laurentide at the LGM');
  assert.match(biome(0, 22, 10), /Desert|Barren/, 'the central Sahara today');
  assert.match(biome(6000, 22, 10), /Desert|Barren/, 'the model keeps the Sahara dry at 6 ka (the "Green Sahara problem"): why the proxy map is drawn there');
  const af = readPng(new URL('../public/paleo/sahara-6k.png', import.meta.url));
  const cell = (lat, lon) => { const k = (Math.floor(90 - lat) * af.w + Math.floor(lon + 180)) * 4; return [...af.px.subarray(k, k + 4)]; };
  const [r, g, , a] = cell(22.5, 10.5);
  assert.ok(a > 250 && g >= r * 0.9, `the records put vegetation in the central Sahara at 6 ka: rgba ${cell(22.5, 10.5)}`);
  assert.equal(cell(45.5, 10.5)[3], 0, 'outside the mapped region');
});

