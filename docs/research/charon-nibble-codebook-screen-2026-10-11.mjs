import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants as c} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeNumericSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const original=Buffer.from(encodeNumericSnapshot(text,2)), view=new DataView(original.buffer,original.byteOffset,original.byteLength);
let at=20+view.getUint32(8,true)+view.getUint32(12,true); const spans=[],frequency=Array(14).fill(0);
for(let i=0;i<view.getUint32(16,true);i++) {const width=original[at++],count=view.getUint32(at,true);at+=4;const digits=width*count,length=Math.ceil(digits/2);spans.push({at,digits,length});for(let j=0;j<digits;j++)frequency[(original[at+(j>>1)]>>((j%2)*4))&15]++;at+=length;}
const ranked=frequency.map((n,i)=>({n,i})).sort((a,b)=>b.n-a.n||a.i-b.i).map(x=>x.i);
const assignments=[['identity',Array.from({length:14},(_,i)=>i)],['frequency',ranked.map((_,i)=>ranked.indexOf(i))],['frequency-high',ranked.map((_,i)=>13-ranked.indexOf(i))]];
const results=[];
for(const [name,map] of assignments){const candidate=Buffer.from(original),inverse=Array(16).fill(15);map.forEach((v,i)=>inverse[v]=i);
for(const span of spans)for(let j=0;j<span.digits;j++){const offset=span.at+(j>>1),shift=(j%2)*4,code=(original[offset]>>shift)&15;candidate[offset]=(candidate[offset]&~(15<<shift))|(map[code]<<shift);}
const inner=brotliCompressSync(candidate,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:c.BROTLI_MODE_FONT}});const native=brotliDecompressSync(inner),js=Buffer.from(decompress(inner));assert.deepEqual(native,candidate);assert.deepEqual(js,candidate);
for(const restored of [native,js]){for(const span of spans)for(let j=0;j<span.digits;j++){const offset=span.at+(j>>1),shift=(j%2)*4,code=(restored[offset]>>shift)&15;restored[offset]=(restored[offset]&~(15<<shift))|(inverse[code]<<shift);}assert.deepEqual(restored,original);assert.equal(restoreSnapshotText(restored),text);}
const row={name,map,innerBytes:inner.length,gzipBytes:gzipSync(inner,{level:9}).length,exactContainerAndJson:true};results.push(row);console.log(JSON.stringify(row));}
fs.writeFileSync(process.argv[2]||'/tmp/charon-codebook-results.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:original.length,frequency,results,scope:'Research only numeric nibble codebook relabeling. No numeric value or layout changes. Gzip sizes exclude production envelope and decoder overhead.'},null,2));
