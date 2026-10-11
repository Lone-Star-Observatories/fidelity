import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync } from 'node:zlib';
import { decompress } from 'brotli/decompress';
import { encodeApplicationNumbers } from '../scripts/application-numbers.js';
import { wrapBrotliSnapshot, restoreApplicationText } from '../src/data/snapshot-codec.js';
const text = 'const exact = -1.234567891234e-19; const label = "α • Proteus"; export { exact, label };';
const original = encodeApplicationNumbers(text);
const wrapped = wrapBrotliSnapshot(original, brotliCompressSync(original));
test('application Brotli envelope preserves original JavaScript and legacy numeric/plain modules', () => {
  assert.equal(restoreApplicationText(wrapped, decompress), text);
  assert.equal(restoreApplicationText(original), text);
  assert.equal(restoreApplicationText(new TextEncoder().encode(text)), text);
});
test('application Brotli envelope rejects missing decoder, truncation, changed checksum and nested envelopes', () => {
  assert.throws(() => restoreApplicationText(wrapped));
  assert.throws(() => restoreApplicationText(wrapped.subarray(0, wrapped.length - 1), decompress));
  const changed = wrapped.slice(); changed[16] ^= 1;
  assert.throws(() => restoreApplicationText(changed, decompress));
  assert.throws(() => restoreApplicationText(wrapped, () => new Uint8Array(original.length)));
  assert.throws(() => restoreApplicationText(wrapBrotliSnapshot(wrapped, brotliCompressSync(wrapped)), decompress));
});
