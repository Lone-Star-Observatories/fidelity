import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeApplicationNumbers } from '../scripts/application-numbers.js';
import { restoreApplicationText } from '../src/data/snapshot-codec.js';

test('application packing preserves exact token spellings and JavaScript lexical contexts', () => {
  for (const source of [
    'export const a=[0,-0,1.00,.5,1.,1e+09,0xFF,0b10,0o77,12345678901234567890];',
    'const a="numbers 123 # Ω";const b=/12.3/;const c=`12 ${3.00} Ω`;/* 45 */const d=1_000;const e=99n;',
    'export default "no numbers Ω";',
  ]) assert.equal(restoreApplicationText(encodeApplicationNumbers(source)), source);
  assert.equal(restoreApplicationText(new TextEncoder().encode('export default 1;')), 'export default 1;');
  assert.equal(restoreApplicationText(new TextEncoder().encode('ΩΩΩΩΩ;')), 'ΩΩΩΩΩ;');
  assert.throws(() => encodeApplicationNumbers('const x=1;\0'), /reserved separator/);
});

test('application container rejects corruption, truncation, and trailing bytes', () => {
  const good = encodeApplicationNumbers('const n=[1.25,3e2];');
  for (let length = 8; length < good.length; length++) assert.throws(() => restoreApplicationText(good.subarray(0, length)));
  const extra = new Uint8Array(good.length + 1); extra.set(good); assert.throws(() => restoreApplicationText(extra), /trailing/);
  const badUtf8 = good.slice();badUtf8[20] = 255;assert.throws(() => restoreApplicationText(badUtf8));
  const badReference = good.slice();badReference[20 + new DataView(good.buffer).getUint32(8, true)] = 0;assert.throws(() => restoreApplicationText(badReference), /reference/);
  const badSpelling = good.slice();badSpelling[badSpelling.length - 1] = 63;assert.throws(() => restoreApplicationText(badSpelling), /spelling/);
  const bad = good.slice();new DataView(bad.buffer).setUint32(16,256,true);assert.throws(()=>restoreApplicationText(bad),/group count/);
});
