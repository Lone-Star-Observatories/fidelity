import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants as c} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeNumericSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const input=Buffer.from(encodeNumericSnapshot(text,2)),n=input.readUInt32LE(8),head=input.subarray(20,20+n).toString('utf8'),tail=input.subarray(20+n);
assert(!head.includes('\0'));
const compress=bytes=>brotliCompressSync(bytes,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:2}});
const base=compress(input),results=[];
for(const minimumCount of [2,4,8]){
 const counts=new Map();for(const m of head.matchAll(/"(?:[^"\\]|\\.)*"/g))counts.set(m[0],(counts.get(m[0])||0)+1);
 const dictionary=[...counts].filter(([s,count])=>count>=minimumCount&&Buffer.byteLength(s)>=8).sort((a,b)=>b[1]-a[1]).map(([s])=>s),ids=new Map(dictionary.map((s,i)=>[s,i]));
 const parts=[];let at=0;for(const m of head.matchAll(/"(?:[^"\\]|\\.)*"/g)){
  if(!ids.has(m[0]))continue;parts.push(Buffer.from(head.slice(at,m.index)));const id=ids.get(m[0]);assert(id<65536);parts.push(Buffer.from([0,id&255,id>>8]));at=m.index+m[0].length;
 }parts.push(Buffer.from(head.slice(at)));
 const packed=Buffer.concat(parts),dictBytes=Buffer.from(JSON.stringify(dictionary)),sizes=Buffer.alloc(8);sizes.writeUInt32LE(dictBytes.length);sizes.writeUInt32LE(packed.length,4);
 const candidate=Buffer.concat([input.subarray(0,20),sizes,dictBytes,packed,tail]);
 const inner=compress(candidate);for(const decoded of [brotliDecompressSync(inner),Buffer.from(decompress(inner))]){
  assert.deepEqual(decoded,candidate);const dl=decoded.readUInt32LE(20),pl=decoded.readUInt32LE(24),dict=JSON.parse(decoded.subarray(28,28+dl).toString('utf8')),body=decoded.subarray(28+dl,28+dl+pl),chunks=[];let start=0;
  for(let i=0;i<body.length;i++)if(body[i]===0){chunks.push(body.subarray(start,i));assert(i+2<body.length);const id=body.readUInt16LE(i+1);assert(id<dict.length);chunks.push(Buffer.from(dict[id]));i+=2;start=i+1;}chunks.push(body.subarray(start));
  const restoredHead=Buffer.concat(chunks);assert.equal(restoredHead.toString('utf8'),head);const restored=Buffer.concat([decoded.subarray(0,20),restoredHead,decoded.subarray(28+dl+pl)]);assert.deepEqual(restored,input);assert.equal(restoreSnapshotText(restored),text);
 }
 const row={minimumCount,dictionaryEntries:dictionary.length,binaryBytes:candidate.length,innerBytes:inner.length,outerGzipScreenBytes:gzipSync(inner,{level:9}).length,exactNativeAndBundledJsInverse:true};results.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(process.argv[2]||'/tmp/string-dictionary-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:input.length,baselineInnerBytes:base.length,baselineOuterGzipScreenBytes:gzipSync(base,{level:9}).length,results,note:'Outer gzip screen omits new wrapper/decoder/notices overhead; no production adoption or savings claim.'},null,2));
