import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeImageMime } from '../scripts/standalone-native-image.js';

test('native standalone cards identify animation and scientific raster signatures without changing bytes', () => {
  for (const [bytes, mime] of [
    [Buffer.from('GIF87a unchanged multi-frame payload'), 'image/gif'],
    [Buffer.from('GIF89a unchanged multi-frame payload'), 'image/gif'],
    [Buffer.from([137,80,78,71,13,10,26,10,0]), 'image/png'],
    [Buffer.from([255,216,255,224,0]), 'image/jpeg'],
    [Buffer.from('RIFFxxxxWEBPpayload'), 'image/webp'],
  ]) {
    const original = Buffer.from(bytes);
    assert.equal(nativeImageMime(bytes), mime);
    assert.deepEqual(bytes, original);
  }
  for (const bytes of [Buffer.alloc(0), Buffer.from('GIF89'), Buffer.from('not an image')]) {
    assert.throws(() => nativeImageMime(bytes), /Unsupported native/);
  }
});
