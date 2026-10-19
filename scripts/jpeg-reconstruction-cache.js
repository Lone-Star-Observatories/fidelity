import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeJpegSnapshot } from '../src/data/snapshot-codec.js';
const folder = new URL('../src/data/jpeg-reconstruction-cache/', import.meta.url);
export function packCachedJpegs(binary) {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)));
  const entries = new Map(manifest.entries.map(x => [x.jpegSha256, x]));
  const hash = b => createHash('sha256').update(b).digest('hex');
  let count = 0;
  const bytes = encodeJpegSnapshot(binary, jpeg => {
    const key = hash(jpeg), row = entries.get(key); if (!row) return undefined;
    const packed = fs.readFileSync(new URL(key + '.jxl', folder));
    if (jpeg.length !== row.jpegBytes || packed.length !== row.jxlBytes || hash(packed) !== row.jxlSha256) throw Error('Invalid JPEG reconstruction cache: ' + key);
    count++; return packed;
  });
  return { bytes, count };
}
