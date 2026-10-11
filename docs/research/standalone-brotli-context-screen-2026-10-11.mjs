import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,gunzipSync,constants as c}from'node:zlib';
import{decompress}from'../../node_modules/brotli/decompress.js';
import{encodeNumericSnapshot,wrapBrotliSnapshot,restoreSnapshotText}from'../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8'),binary=encodeNumericSnapshot(text,2),results=[];
for(const [mode,disableContext]of[[0,false],[0,true],[1,false],[1,true],[2,false],[2,true]]){
 const inner=brotliCompressSync(binary,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:mode,[c.BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING]:disableContext}});
 assert.deepEqual(brotliDecompressSync(inner),Buffer.from(binary));
 const outer=gzipSync(wrapBrotliSnapshot(binary,inner),{level:9});
 assert.equal(restoreSnapshotText(gunzipSync(outer),decompress),text);
 const row={mode,disableContext,innerBytes:inner.length,outerGzipBytes:outer.length,nativeAndBundledJsExact:true};results.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(process.argv[2]||'/tmp/brotli-context-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,results},null,2));
