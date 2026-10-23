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

test('complete notices restore before the unsupported-gzip message and remain readable', async () => {
  const { runInNewContext } = await import('node:vm');
  const notices = 'Copyright — complete notices\n<https://example.test> </script> $&\n\u0000';
  const codec = await readFile(new URL('../src/data/snapshot-codec.js', import.meta.url), 'utf8');
  const result = await packStandaloneBootstrap('throw Error("must not launch");', codec, notices);
  const el = result.html.match(/id="fidelity-notice-data"[^>]*data-encoding="([^"]+)" data-byte-length="(\d+)">([\s\S]*?)<\/script>/);
  const elements = {
    'fidelity-notice-data': { dataset: { encoding: el[1], byteLength: el[2] }, textContent: el[3] },
    'fidelity-third-party-notices': {}, 'fidelity-readable-notices': {}, 'fidelity-notices': {},
  };
  const body = { append(el) { this.retained = el; } };
  const module = result.html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  await runInNewContext(`(async()=>{${module}})()`, { document: { body, getElementById: id => elements[id] }, TextEncoder, TextDecoder, Uint8Array, Uint16Array, Uint32Array, ArrayBuffer });
  assert.equal(elements['fidelity-third-party-notices'].textContent, notices);
  assert.equal(elements['fidelity-readable-notices'].textContent, notices);
  assert.equal(body.retained, elements['fidelity-notices']);
  assert.match(body.textContent, /gzip decompression support/);
  assert.ok(result.html.includes('Third-party notices'));
});
