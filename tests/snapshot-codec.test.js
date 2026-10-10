import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshotBytes, unpackSnapshotBytes } from '../src/data/snapshot-codec.js';
import { randomBytes } from 'node:crypto';

test('offline snapshot preserves catalogue fields, Unicode and embedded asset bytes', async () => {
  const snapshot = { nearby: { fields: ['id', 'system', 'vKms', 'rvKnown'], stars: [['α Cen', null, [-1.234567891, 0, 3.14159265], false]] },
    details: { example: { metadata: { unknown: null, label: 'Hiʻiaka • Gl 725 A' }, measured: 1e-12 } },
    textures: { native: 'data:image/png;base64,AAEC//8=' }, models: { craft: 'data:model/gltf-binary;base64,AAEC//8=' },
    horizons: { '/api/horizons/local': [[2461323.5, -0.000001, 2, 3]] }, bodyImages: {} };
  const packed = gzipSync(JSON.stringify(snapshot)).toString('base64');
  assert.deepEqual(await decodeSnapshot(packed), snapshot);
  assert.deepEqual(await decodeSnapshot(encodeSnapshotBytes(gzipSync(JSON.stringify(snapshot)))), snapshot);
});

test('radix85 transport preserves binary values and partial blocks without script delimiters', () => {
  for (const bytes of [Uint8Array.from({ length: 256 }, (_, index) => index), randomBytes(4097), ...[0,1,2,3,4,5].map(length => new Uint8Array(length).fill(255))]) {
    const packed = encodeSnapshotBytes(bytes);
    assert.deepEqual(unpackSnapshotBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[<>"'\\]/);
  }
});

test('radix85 rejects invalid encoding, lengths, digits, overflow and padding', () => {
  for (const packed of [null, {}, {encoding:'gzip-radix85-v1',byteLength:-1,data:''},
    {encoding:'gzip-radix85-v1',byteLength:1,data:'0000'},
    {encoding:'gzip-radix85-v1',byteLength:4,data:'0000"'},
    {encoding:'gzip-radix85-v1',byteLength:4,data:'#####'},
    {encoding:'gzip-radix85-v1',byteLength:1,data:'00001'}]) assert.throws(() => unpackSnapshotBytes(packed));
});

test('offline snapshot rejects corrupt gzip instead of serving partial data', async () => {
  await assert.rejects(decodeSnapshot(Buffer.from('not gzip').toString('base64')));
});
