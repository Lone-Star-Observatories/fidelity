import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MODELS, modelFor } from '../src/data/models.js';

test('mission models are self-contained GLBs within delivery budgets and recorded hashes', async () => {
  for (const [id, asset] of Object.entries(MODELS)) {
    const bytes = await fs.readFile(new URL(`../public${asset.url}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok(bytes.length <= (id === 'iss' ? 5e6 : 2e6), id);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const triangles = gltf.meshes.flatMap((m) => m.primitives)
      .filter((p) => (p.mode ?? 4) === 4)
      .reduce((n, p) => n + gltf.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0);
    assert.equal(triangles, asset.triangles);
    assert.ok(triangles <= 50000, id);
    assert.ok(gltf.buffers.every((b) => !b.uri));
    assert.ok((gltf.images ?? []).every((i) => !i.uri || i.uri.startsWith('data:')));
    assert.ok(asset.credit && asset.source && asset.processing && asset.frame);
  }
});

test('NORAD and Voyager aliases select the intended mission, unknown craft keep fallback', () => {
  assert.equal(modelFor('sat-25544'), MODELS.iss);
  assert.equal(modelFor('sat-20580'), MODELS.hubble);
  assert.equal(modelFor('voyager-1'), MODELS.voyager);
  assert.equal(modelFor('voyager-2'), MODELS.voyager);
  assert.equal(modelFor('unknown'), null);
});

test('offline mission previews are self-contained and retain recorded hashes', async () => {
  let total = 0;
  for (const [id, asset] of Object.entries(MODELS)) {
    const bytes = await fs.readFile(new URL(`../public${asset.previewUrl}`, import.meta.url));
    total += bytes.length;
    assert.equal(bytes.toString('ascii',0,4),'glTF',id);
    assert.equal(bytes.length,asset.previewBytes,id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.previewSha256,id);
    const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    assert.ok(gltf.buffers.every(b=>!b.uri),id);
    assert.ok((gltf.images??[]).every(i=>!i.uri),id);
    assert.ok(!(gltf.extensionsRequired??[]).includes('KHR_draco_mesh_compression'),id);
  }
  assert.ok(total < 5e6, `${total} preview bytes`);
});
