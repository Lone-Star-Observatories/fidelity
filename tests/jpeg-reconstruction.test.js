import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeSnapshot, encodeSnapshotBytes, encodeNumericSnapshot, encodeJpegSnapshot, restoreJpegSnapshot, restoreSnapshotText, wrapBrotliSnapshot } from '../src/data/snapshot-codec.js';
import encodedWasm from '../src/vendor/jpeg-xl/decoder-wasm.js';
const vendorManifest = JSON.parse(fs.readFileSync(new URL('../src/vendor/jpeg-xl/manifest.json', import.meta.url)));
import { createJpegReconstructor } from '../src/data/jpeg-reconstruction.js';
import { packCachedJpegs } from '../scripts/jpeg-reconstruction-cache.js';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { decompress } from 'brotli/decompress';
const hash = b => createHash('sha256').update(b).digest('hex');
const reconstruct = await createJpegReconstructor();
const folder = new URL('../src/data/jpeg-reconstruction-cache/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)));
test('all pinned JPEG XL payloads reconstruct exact original JPEG hashes and reject trailing input', () => {
  assert.equal(hash(Buffer.from(encodedWasm, 'base64')), vendorManifest.wasmSha256);
  for (const row of manifest.entries) {
    const packed = fs.readFileSync(new URL(row.jpegSha256 + '.jxl', folder));
    assert.equal(hash(packed), row.jxlSha256);
    assert.equal(hash(reconstruct(packed, row.jpegBytes)), row.jpegSha256);
  }
  const row = manifest.entries[0], packed = fs.readFileSync(new URL(row.jpegSha256 + '.jxl', folder));
  assert.throws(() => reconstruct(packed.subarray(0, packed.length - 1), row.jpegBytes));
  assert.throws(() => reconstruct(Buffer.concat([packed, Buffer.from([0])]), row.jpegBytes));
  assert.throws(() => reconstruct(packed, row.jpegBytes - 1));
});
test('versioned JPEG frame retains exact JSON spelling, uncached JPEGs, native PNG and model bytes through Brotli', async () => {
  const row = manifest.entries[0], packed = fs.readFileSync(new URL(row.jpegSha256 + '.jxl', folder));
  const jpeg = reconstruct(packed, row.jpegBytes);
  const text = '{ "number": -0.00001230, "name":"Hiʻiaka", "native":"data:image/jpeg;base64,' + Buffer.from(jpeg).toString('base64') + '", "new":"data:image/jpeg;base64,/9j/2Q==", "png":"data:image/png;base64,AAEC/w==", "model":"data:model/gltf-binary;base64,AAEC/w==" }';
  const binary = encodeNumericSnapshot(text, 2), result = packCachedJpegs(binary);
  assert.equal(result.count, 1);
  assert.deepEqual(restoreJpegSnapshot(result.bytes, reconstruct), binary);
  assert.equal(restoreSnapshotText(wrapBrotliSnapshot(result.bytes, brotliCompressSync(result.bytes)), decompress, reconstruct), text);
  assert.equal(restoreSnapshotText(binary), text);
  const bytes = gzipSync(wrapBrotliSnapshot(result.bytes, brotliCompressSync(result.bytes)));
  assert.deepEqual(await decodeSnapshot({ ...encodeSnapshotBytes(bytes), decodeBrotli: decompress, reconstructJpeg: reconstruct }), JSON.parse(text));
});
test('JPEG frame rejects wrong lengths, types, checksums, truncated/trailing records and invalid decoder outputs', () => {
  const text = '{"x":"data:image/jpeg;base64,/9j/2Q=="}', binary = encodeNumericSnapshot(text, 2);
  const framed = encodeJpegSnapshot(binary, () => Uint8Array.of(1, 2));
  assert.throws(() => restoreJpegSnapshot(framed));
  assert.throws(() => restoreJpegSnapshot(framed, () => Uint8Array.of(0)));
  assert.throws(() => restoreJpegSnapshot(framed, () => Uint8Array.of(1,2,3,4)));
  const correct = () => Uint8Array.of(255,216,255,217);
  assert.deepEqual(restoreJpegSnapshot(framed, correct), binary);
  for (const offset of [0, 8, 12, 16, 20]) { const bad = framed.slice(); bad[offset] ^= 128; assert.throws(() => restoreJpegSnapshot(bad, correct)); }
  assert.throws(() => restoreJpegSnapshot(framed.subarray(0, framed.length - 1), correct));
  assert.throws(() => restoreJpegSnapshot(Buffer.concat([framed, Buffer.from([0])]), correct));
  const bad = framed.slice(), prefix = new DataView(bad.buffer).getUint32(16, true), record = 24 + prefix;
  const length = new DataView(bad.buffer).getUint32(record, true); bad[record + 4 + length] = 2;
  assert.throws(() => restoreJpegSnapshot(bad, correct));
});
