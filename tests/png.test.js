// server/png.js: the shared PNG decoder reads Adam7-interlaced images (Helioviewer sends them, #79) as well as plain ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodePng, encodePng } from '../server/png.js';
import { decodePng as decodeSolar } from '../server/solarmodel.js';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(t, 'latin1'), d, Buffer.alloc(4)]); };
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

/** A PNG of raw samples `px` (w×h×ch, colour type `type`), Adam7 or not, rows filtered with types 0–4 in turn. */
function makePng(px, w, h, type, ch, { interlace = true, extra = [] } = {}) {
  const rows = [];
  let ft = 0;
  for (const [x0, y0, dx, dy] of interlace ? ADAM7 : [[0, 0, 1, 1]]) {
    const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    let prev = new Uint8Array(pw * ch);
    for (let r = 0; r < ph; r++) {
      const line = new Uint8Array(pw * ch);
      for (let x = 0; x < pw; x++) for (let c = 0; c < ch; c++) line[x * ch + c] = px[((y0 + r * dy) * w + x0 + x * dx) * ch + c];
      const f = ft++ % 5, out = new Uint8Array(line.length);
      for (let i = 0; i < line.length; i++) {
        const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0, p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        out[i] = (line[i] - [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
      }
      rows.push(Buffer.from([f]), Buffer.from(out)); prev = line;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = type; ihdr[12] = interlace ? 1 : 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), ...extra, chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

test('Adam7: RGBA and RGB at awkward sizes (empty passes included) decode to the same pixels as the plain image', () => {
  for (const [w, h] of [[1, 1], [3, 2], [5, 1], [13, 9], [17, 16]]) {
    const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 53 + 7) & 255);
    const a = decodePng(makePng(rgba, w, h, 6, 4)), b = decodePng(makePng(rgba, w, h, 6, 4, { interlace: false }));
    assert.equal(a.width, w); assert.equal(a.height, h);
    assert.deepEqual([...a.data], [...rgba], `RGBA ${w}×${h}`);
    assert.deepEqual([...b.data], [...rgba]);
    const rgb = new Uint8Array(w * h * 3).map((_, i) => (i * 29 + 3) & 255), c = decodePng(makePng(rgb, w, h, 2, 3));
    for (let i = 0; i < w * h; i++) assert.deepEqual([...c.data.subarray(i * 4, i * 4 + 4)], [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255]);
  }
});

test('Adam7: palette with tRNS, grey with a transparent key, grey+alpha', () => {
  const w = 11, h = 7, idx = new Uint8Array(w * h).map((_, i) => i % 4);
  const plte = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9]), trns = Buffer.from([255, 128]);
  const p = decodePng(makePng(idx, w, h, 3, 1, { extra: [chunk('PLTE', plte), chunk('tRNS', trns)] }));
  for (let i = 0; i < w * h; i++) {
    const k = idx[i];
    assert.deepEqual([...p.data.subarray(i * 4, i * 4 + 4)], [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], k === 0 ? 255 : k === 1 ? 128 : 255]);
  }
  const grey = new Uint8Array(w * h).map((_, i) => (i * 7) & 255), key = Buffer.alloc(2); key.writeUInt16BE(grey[5]);
  const g = decodePng(makePng(grey, w, h, 0, 1, { extra: [chunk('tRNS', key)] }));
  for (let i = 0; i < w * h; i++) assert.deepEqual([...g.data.subarray(i * 4, i * 4 + 4)], [grey[i], grey[i], grey[i], grey[i] === grey[5] ? 0 : 255]);
  const ga = new Uint8Array(w * h * 2).map((_, i) => (i * 11 + 1) & 255), q = decodePng(makePng(ga, w, h, 4, 2));
  for (let i = 0; i < w * h; i++) assert.deepEqual([...q.data.subarray(i * 4, i * 4 + 4)], [ga[i * 2], ga[i * 2], ga[i * 2], ga[i * 2 + 1]]);
});

test('the radio-disc model and corona feed decode through the same decoder ({ w, h, rgba })', () => {
  const w = 9, h = 6, rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 31) & 255);
  const s = decodeSolar(makePng(rgba, w, h, 6, 4));
  assert.equal(s.w, w); assert.equal(s.h, h);
  assert.deepEqual([...s.rgba], [...rgba]);
  assert.deepEqual([...decodeSolar(encodePng(w, h, rgba)).rgba], [...rgba]);
});

test('unsupported and broken PNGs are refused, not misread', () => {
  const rgba = new Uint8Array(4 * 4 * 4).fill(9), good = makePng(rgba, 4, 4, 6, 4);
  assert.throws(() => decodePng(Buffer.from('not a png at all')), /not a PNG/);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(4, 4); ihdr[8] = 16; ihdr[9] = 6;
  assert.throws(() => decodePng(Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IEND', Buffer.alloc(0))])), /depth 16/);
  const idatAt = good.indexOf('IDAT') - 4, len = good.readUInt32BE(idatAt), body = zlib.inflateSync(good.subarray(idatAt + 8, idatAt + 8 + len));
  const short = Buffer.concat([good.subarray(0, idatAt), chunk('IDAT', zlib.deflateSync(body.subarray(0, body.length - 5))), chunk('IEND', Buffer.alloc(0))]);
  assert.throws(() => decodePng(short), /truncated/);
});
