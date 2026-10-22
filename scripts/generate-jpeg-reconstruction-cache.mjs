// Optional build-time cache maintenance. Ordinary full builds need no native CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createJpegReconstructor } from '../src/data/jpeg-reconstruction.js';
const input = process.argv[2] ?? 'standalone/snapshot.json';
const encoder = process.env.FIDELITY_CJXL ?? 'cjxl', decoder = process.env.FIDELITY_DJXL ?? 'djxl';
for (const command of [encoder, decoder]) {
  const version = execFileSync(command, ['--version'], { encoding: 'utf8' });
  if (!/v0\.11\.1\b/.test(version)) throw Error('Expected libjxl0.11.1 CLI: ' + command);
}
const folder = new URL('../src/data/jpeg-reconstruction-cache/', import.meta.url);
const manifestUrl = new URL('manifest.json', folder), manifest = JSON.parse(fs.readFileSync(manifestUrl));
const entries = new Map(manifest.entries.map(x => [x.jpegSha256, x]));
const hash = b => createHash('sha256').update(b).digest('hex'), reconstruct = await createJpegReconstructor();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-jpeg-reconstruction-'));
try {
  for (const match of fs.readFileSync(input, 'utf8').matchAll(/"data:image\/jpeg;base64,([A-Za-z0-9+/=]*)"/g)) {
    const jpeg = Buffer.from(match[1], 'base64'), key = hash(jpeg), target = new URL(key + '.jxl', folder);
    if (entries.has(key)) {
      const cached = fs.readFileSync(target); assert.equal(hash(cached), entries.get(key).jxlSha256);
      assert.deepEqual(Buffer.from(reconstruct(cached, jpeg.length)), jpeg); continue;
    }
    const source = path.join(work, 'input.jpg'), output = path.join(work, 'output.jxl'), restored = path.join(work, 'restored.jpg');
    fs.writeFileSync(source, jpeg);
    execFileSync(encoder, [source, output, '--lossless_jpeg=1', '-e', '9'], { stdio: 'pipe' });
    execFileSync(decoder, [output, restored], { stdio: 'pipe' });
    assert.deepEqual(fs.readFileSync(restored), jpeg);
    const packed = fs.readFileSync(output); assert.deepEqual(Buffer.from(reconstruct(packed, jpeg.length)), jpeg);
    fs.writeFileSync(target, packed);
    entries.set(key, { jpegSha256: key, jpegBytes: jpeg.length, jxlSha256: hash(packed), jxlBytes: packed.length });
  }
  manifest.entries = [...entries.values()].sort((a, b) => a.jpegSha256.localeCompare(b.jpegSha256));
  fs.writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
  console.log(manifest.entries.length + ' exact-byte reconstruction cache entries verified');
} finally { fs.rmSync(work, { recursive: true, force: true }); }
