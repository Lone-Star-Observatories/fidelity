import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot } from '../src/data/snapshot-codec.js';

test('offline snapshot preserves catalogue fields, Unicode and embedded asset bytes', async () => {
  const snapshot = { nearby: { fields: ['id', 'system', 'vKms', 'rvKnown'], stars: [['α Cen', null, [-1.234567891, 0, 3.14159265], false]] },
    details: { example: { metadata: { unknown: null, label: 'Hiʻiaka • Gl 725 A' }, measured: 1e-12 } },
    textures: { native: 'data:image/png;base64,AAEC//8=' }, models: { craft: 'data:model/gltf-binary;base64,AAEC//8=' },
    horizons: { '/api/horizons/local': [[2461323.5, -0.000001, 2, 3]] }, bodyImages: {} };
  const packed = gzipSync(JSON.stringify(snapshot)).toString('base64');
  assert.deepEqual(await decodeSnapshot(packed), snapshot);
});

test('offline snapshot rejects corrupt gzip instead of serving partial data', async () => {
  await assert.rejects(decodeSnapshot(Buffer.from('not gzip').toString('base64')));
});
