import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync, constants } from 'node:zlib';
import { decompress } from '../../node_modules/brotli/decompress.js';
import { encodeNumericSnapshot, wrapBrotliSnapshot, restoreSnapshotText } from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const binary=Buffer.from(encodeNumericSnapshot(text,2));
let at=20+binary.readUInt32LE(8)+binary.readUInt32LE(12);
for(let i=0;i<binary.readUInt32LE(16);i++){const width=binary[at++],count=binary.readUInt32LE(at);at+=4+Math.ceil(width*count/2);}
const parts=[binary.subarray(0,at),binary.subarray(at)];
const compress=bytes=>brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
const baseline=gzipSync(wrapBrotliSnapshot(binary,compress(binary)),{level:9});
assert.equal(restoreSnapshotText(gunzipSync(baseline),decompress),text);
const results=[];
for(const modes of [[true,false],[true,true],[false,true]]){
 const encoded=parts.map((p,i)=>modes[i]?compress(p):p);
 const header=Buffer.alloc(28);header.write('FIDSPLIT');header.writeUInt32LE(binary.length,8);header.writeUInt32LE(at,12);header.writeUInt32LE(encoded[0].length,16);header.writeUInt32LE(encoded[1].length,20);header[24]=Number(modes[0]);header[25]=Number(modes[1]);
 const outer=gzipSync(Buffer.concat([header,...encoded]),{level:9});
 const decoded=gunzipSync(outer);let pos=28;
 const restored=encoded.map((p,i)=>{const payload=decoded.subarray(pos,pos+p.length);pos+=p.length;if(!modes[i])return payload;const native=brotliDecompressSync(payload),js=Buffer.from(decompress(payload,parts[i].length));assert.deepEqual(native,js);return native;});
 assert.deepEqual(Buffer.concat(restored),binary);assert.equal(restoreSnapshotText(Buffer.concat(restored)),text);
 results.push({headerBrotli:modes[0],assetTailBrotli:modes[1],outerGzipBytes:outer.length,differenceFromBaseline:outer.length-baseline.length,exactNativeAndBundledJsRoundtrip:true});console.log(results.at(-1));
}
fs.writeFileSync(process.argv[2]||'/tmp/proteus-split-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,headerBytes:at,assetTailBytes:binary.length-at,baselineOuterGzipBytes:baseline.length,results},null,2)+'\n');
