// Research-only Brotli input block sizing, distinct from dictionary window sizing.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,gunzipSync,constants as c} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeNumericSnapshot,wrapBrotliSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const binary=encodeNumericSnapshot(text,2), results=[];
for(const block of [0,16,20,24]) {
 const inner=brotliCompressSync(binary,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:c.BROTLI_MODE_FONT,[c.BROTLI_PARAM_LGBLOCK]:block}});
 assert.deepEqual(brotliDecompressSync(inner),Buffer.from(binary));
 const outer=gzipSync(wrapBrotliSnapshot(binary,inner),{level:9});
 assert.equal(restoreSnapshotText(gunzipSync(outer),decompress),text);
 const row={lgblock:block,innerBytes:inner.length,outerGzipBytes:outer.length,nativeAndBundledJsExact:true};
 results.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(process.argv[2]||'/tmp/fidelity-block-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,results},null,2)+'\n');
