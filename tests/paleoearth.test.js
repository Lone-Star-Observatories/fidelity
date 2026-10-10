import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { seaLevelAt, iceSlices } from '../src/views/system/paleoearth.js';
import { SEA_LEVEL } from '../src/data/paleo.js';

/** Decode the PNGs scripts/paleoearth.js writes (8-bit, filter 0 on every row). */
function readPng(file) {
  const b = fs.readFileSync(file); let p = 8, w = 0, h = 0, ch = 0; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 2 ? 3 : 1; } else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) { assert.equal(raw[y * (w * ch + 1)], 0); raw.copy(px, y * w * ch, y * (w * ch + 1) + 1, (y + 1) * (w * ch + 1)); }
  return { w, h, ch, px };
}
const elev = readPng(new URL('../public/paleo/earth-elev.png', import.meta.url));
const at = (lat, lon) => { const j = Math.floor((90 - lat) / 0.25), i = Math.floor((lon + 180) / 0.25), k = (j * elev.w + i) * 3; return { e: (elev.px[k] / 255) * 800 - 400, spill: (elev.px[k + 1] / 255) * 800 - 400, ocean: elev.px[k + 2] > 127 }; };
// the shader's rule
const seaAt = (p, sea) => (p.ocean ? p.e <= sea : p.spill < sea);

test('sea-level layer: floods only what the open ocean reaches', () => {
  assert.equal(seaAt(at(27.5, -81.5), 0), false, 'Florida is land today');
  assert.equal(seaAt(at(27.5, -81.5), 65), true, '+65 m drowns Florida');
  assert.equal(seaAt(at(36.25, -116.85), 65), false, 'Death Valley (below sea level) stays dry: the sea cannot reach it at +65 m');
  assert.equal(seaAt(at(42, 50.5), 0), false, 'the Caspian is not the open ocean');
  assert.equal(seaAt(at(54.5, 3), 0), true, 'the North Sea today');
  assert.equal(seaAt(at(54.5, 3), -120), false, 'Doggerland at the LGM');
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
