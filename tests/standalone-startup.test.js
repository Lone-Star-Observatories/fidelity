import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { packStandaloneBootstrap } from '../scripts/pack-standalone-bootstrap.js';
import { unpackSnapshotBytes } from '../src/data/snapshot-codec.js';

test('startup envelope restores exact Unicode module source without consuming script delimiters', async () => {
  const source = 'globalThis.fixture = "Namaka — </script> $& \\u0000";\n';
  const codec = await readFile(new URL('../src/data/snapshot-codec.js', import.meta.url), 'utf8');
  const result = await packStandaloneBootstrap(source, codec);
  assert.equal(gunzipSync(unpackSnapshotBytes(result.packed)).toString('utf8'), source);
  assert.equal((result.html.match(/<\/script>/g) ?? []).length, 2);
  assert.ok(result.html.includes('fidelity-startup-data'));
  assert.ok(result.html.includes('gzip decompression support'));
});
