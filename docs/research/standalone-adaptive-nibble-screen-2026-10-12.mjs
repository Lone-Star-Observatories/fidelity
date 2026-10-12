// Research only: adaptive move-to-front numeric character recoding, without value conversion.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants as c} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeNumericSnapshot,restoreSnapshotText,wrapBrotliSnapshot} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const binary=Buffer.from(encodeNumericSnapshot(text,2));
function transform(input,reset,inverse=false){
 const out=Buffer.from(input);let at=20+input.readUInt32LE(8)+input.readUInt32LE(12),list=Array.from({length:14},(_,i)=>i);
 for(let group=0;group<input.readUInt32LE(16);group++){
  const width=input[at++],count=input.readUInt32LE(at);at+=4;
  if(reset)list=Array.from({length:14},(_,i)=>i);
  for(let digit=0;digit<width*count;digit++){
   const pos=at+(digit>>1),shift=(digit%2)*4,code=(input[pos]>>shift)&15;
   assert.ok(code<14);const index=inverse?code:list.indexOf(code),value=inverse?list[index]:code;
   out[pos]=(out[pos]&~(15<<shift))|((inverse?value:index)<<shift);
   list.splice(index,1);list.unshift(value);
  }
  at+=Math.ceil(width*count/2);
 }
 return out;
}
const compress=p=>brotliCompressSync(p,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:c.BROTLI_MODE_FONT}});
const measure=p=>{const inner=compress(p);assert.deepEqual(brotliDecompressSync(inner),p);assert.deepEqual(Buffer.from(decompress(inner,p.length)),p);return gzipSync(wrapBrotliSnapshot(p,inner),{level:9}).length;};
const baseline=measure(binary),results=[];
for(const reset of [true,false]){
 const transformed=transform(binary,reset),restored=transform(transformed,reset,true);
 assert.deepEqual(restored,binary);assert.equal(restoreSnapshotText(restored),text);
 const size=measure(transformed);results.push({resetEachWidthGroup:reset,outerGzipScreenBytes:size,differenceFromBaseline:size-baseline,exactNativeBundledJsContainerAndJsonInverse:true});console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(process.argv[2]||'/tmp/adaptive-nibble-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,baselineOuterGzipScreenBytes:baseline,results,note:'Research-only adaptive move-to-front relabeling. Numeric order/layout/spelling and binary assets unchanged after exact inverse. Excludes wrapper/decoder overhead; no production change.'},null,2)+'\n');
