import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshotBytes, unpackSnapshotBytes, encodeApplicationBytes, unpackApplicationBytes } from '../src/data/snapshot-codec.js';
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

test('raw application transport preserves all bytes and partial blocks without HTML delimiters', () => {
  for (const bytes of [Uint8Array.from({length:256}, (_, i) => i), randomBytes(4097), ...Array.from({length:8}, (_, length) => new Uint8Array(length).fill(255))]) {
    const packed = encodeApplicationBytes(bytes);
    assert.deepEqual(unpackApplicationBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[\x00\x09-\x0d\x1b<]/);
  }
});

test('raw application transport rejects invalid envelopes, overflow and padding', () => {
  const valid = encodeApplicationBytes(new Uint8Array(6));
  for (const packed of [null, {}, {...valid, encoding:'other'}, {...valid, byteLength:-1}, {...valid, data:valid.data.slice(1)}, {...valid, data:'<'.repeat(7)}, {...valid, data:'\x7f'.repeat(7)}, {...encodeApplicationBytes(new Uint8Array(1)), data:valid.data.slice(0,6)+'\x02'}]) {
    assert.throws(() => unpackApplicationBytes(packed));
  }
});
