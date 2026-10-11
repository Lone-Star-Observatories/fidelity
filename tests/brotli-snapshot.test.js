import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { decompress } from 'brotli/decompress';
import { encodeNumericSnapshot, wrapBrotliSnapshot, restoreSnapshotText, decodeSnapshot, encodeDenseSnapshotBytes } from '../src/data/snapshot-codec.js';
const text = JSON.stringify({ detail: { unicode: 'α • Ariel', exact: -1.234567891234e-19, unknown: null }, native: 'data:image/png;base64,AAEC//8=', model: 'data:model/gltf-binary;base64,AAEC//8=' });
const original = encodeNumericSnapshot(text, 2);
const wrapped = wrapBrotliSnapshot(original, brotliCompressSync(original));
test('Brotli inner stage preserves exact JSON spelling and binary assets through the gzip transport', async () => {
  assert.equal(restoreSnapshotText(wrapped, decompress), text);
  const packed = { ...encodeDenseSnapshotBytes(gzipSync(wrapped), 2), decodeBrotli: decompress };
  assert.deepEqual(await decodeSnapshot(packed), JSON.parse(text));
  assert.equal(restoreSnapshotText(original), text);
});
test('Brotli snapshot rejects missing decoder, truncated/trailing data, bounds and altered output', () => {
  assert.throws(() => restoreSnapshotText(wrapped));
  for (const bytes of [wrapped.subarray(0, 19), wrapped.subarray(0, wrapped.length - 1), Uint8Array.from([...wrapped, 0])]) assert.throws(() => restoreSnapshotText(bytes, decompress));
  for (const offset of [8, 12, 16]) { const changed = wrapped.slice(); changed[offset] ^= 1; assert.throws(() => restoreSnapshotText(changed, decompress)); }
  assert.throws(() => restoreSnapshotText(wrapped, () => new Uint8Array(original.length)));
  const nested = wrapBrotliSnapshot(wrapped, brotliCompressSync(wrapped));
  assert.throws(() => restoreSnapshotText(nested, decompress));
});
