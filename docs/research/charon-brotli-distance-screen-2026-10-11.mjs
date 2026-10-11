import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,gunzipSync,constants as c}from'node:zlib';
import{decompress}from'../../node_modules/brotli/decompress.js';
import{encodeNumericSnapshot,wrapBrotliSnapshot,restoreSnapshotText}from'../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8'),binary=encodeNumericSnapshot(text,2),results=[];
for(const [postfix,direct]of[[0,0],[1,16],[2,32]]){
 const inner=brotliCompressSync(binary,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:2,[c.BROTLI_PARAM_NPOSTFIX]:postfix,[c.BROTLI_PARAM_NDIRECT]:direct}});
 assert.deepEqual(brotliDecompressSync(inner),Buffer.from(binary));
 const outer=gzipSync(wrapBrotliSnapshot(binary,inner),{level:9});
 assert.equal(restoreSnapshotText(gunzipSync(outer),decompress),text);
 const row={postfix,direct,innerBytes:inner.length,outerGzipBytes:outer.length,nativeAndBundledJsExact:true};results.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(process.argv[2]||'/tmp/charon-distance-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,results},null,2));
