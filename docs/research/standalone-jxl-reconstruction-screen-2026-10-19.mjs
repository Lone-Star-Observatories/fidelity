import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants as Z} from 'node:zlib';
import {encodeNumericSnapshot,restoreSnapshotText,wrapBrotliSnapshot} from '../../src/data/snapshot-codec.js';
import make from '../../data/research-sources/standalone-jxl-reconstruction-preparation-2026-10-19/wasm-build/fidelity_reconstruct.mjs';
import {decompress} from 'brotli/decompress';
const base=new URL('../../data/research-sources/standalone-jxl-reconstruction-preparation-2026-10-19/',import.meta.url), hash=b=>createHash('sha256').update(b).digest('hex');
const text=fs.readFileSync(new URL('frozen-snapshot.json',base),'utf8'), original=Buffer.from(encodeNumericSnapshot(text,2));
const inventory=JSON.parse(fs.readFileSync(new URL('all-jpeg/results.json',base)));
assert.equal(hash(Buffer.from(text)),inventory.snapshotSha256);
const entries=new Map(inventory.results.map(x=>[x.sha256,x]));
let at=20+original.readUInt32LE(8)+original.readUInt32LE(12);
for(let i=0;i<original.readUInt32LE(16);i++){const width=original[at],size=original.readUInt32LE(at+1);at+=5+Math.ceil(width*size/2);}
const prefix=original.subarray(0,at),count=original.readUInt32LE(at);at+=4;
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const parts=[Buffer.from('FIDJXL01'),u32(original.length),u32(prefix.length),prefix,u32(count)];
let replaced=0;
for(let i=0;i<count;i++){
 const n=original.readUInt32LE(at);at+=4;const p=original.subarray(at,at+n);at+=n;
 const size=original.readUInt32LE(at);at+=4;const payload=original.subarray(at,at+size);at+=size;
 const row=p.toString()==='data:image/jpeg;base64,'?entries.get(hash(payload)):undefined;
 const packed=row?fs.readFileSync(row.jxlPath):payload;
 if(row){assert.equal(size,row.bytes);assert.equal(hash(packed),row.jxlSha256);replaced++;}
 parts.push(u32(n),p,Buffer.from([row?1:0]),u32(size),u32(packed.length),packed);
}
assert.equal(at,original.length);assert.equal(replaced,60);
const candidate=Buffer.concat(parts),wasm=fs.readFileSync(new URL('wasm-build/fidelity_reconstruct.wasm',base)),glue=fs.readFileSync(new URL('wasm-build/fidelity_reconstruct.mjs',base));
const mod=await make({wasmBinary:wasm});
function inverse(b){
 assert.equal(b.subarray(0,8).toString(),'FIDJXL01');let pos=16;
 const out=[b.subarray(pos,pos+b.readUInt32LE(12))];pos+=b.readUInt32LE(12);
 const count=b.readUInt32LE(pos);pos+=4;out.push(u32(count));
 for(let i=0;i<count;i++){
  const n=b.readUInt32LE(pos);pos+=4;const p=b.subarray(pos,pos+n);pos+=n;
  const type=b[pos++],size=b.readUInt32LE(pos),len=b.readUInt32LE(pos+4);pos+=8;
  const input=b.subarray(pos,pos+len);pos+=len;let restored=input;
  if(type===1){const ip=mod._malloc(len),op=mod._malloc(size);try{mod.HEAPU8.set(input,ip);const written=mod._reconstruct(ip,len,op,size);assert.equal(written,size);restored=Buffer.from(mod.HEAPU8.subarray(op,op+size));}finally{mod._free(ip);mod._free(op);}}
  else assert.equal(type,0);
  assert.equal(restored.length,size);out.push(u32(n),p,u32(size),restored);
 }
 assert.equal(pos,b.length);const output=Buffer.concat(out);assert.equal(output.length,b.readUInt32LE(8));return output;
}
assert.deepEqual(inverse(candidate),original);assert.equal(restoreSnapshotText(inverse(candidate)),text);
const params={params:{[Z.BROTLI_PARAM_QUALITY]:11,[Z.BROTLI_PARAM_MODE]:Z.BROTLI_MODE_FONT}};
const screen=b=>{const br=brotliCompressSync(b,params);assert.deepEqual(brotliDecompressSync(br),b);assert.deepEqual(Buffer.from(decompress(br)),b);return gzipSync(wrapBrotliSnapshot(b,br),{level:9}).length;};
const baseline=screen(original),payload=screen(candidate),decoderCombined=screen(Buffer.concat([glue,wasm]));
const result={scope:'Isolated complete FIDNUM02 JPEG-reconstruction frame. Exact custom single-threaded WASM inverse in Node; no production or browser adoption.',snapshotSha256:hash(Buffer.from(text)),original:{bytes:original.length,sha256:hash(original),outerGzipBytes:baseline},candidate:{bytes:candidate.length,sha256:hash(candidate),outerGzipBytes:payload,jpegAssets:replaced,assetCount:count,exactOriginalContainer:true,exactCompleteJson:true,nativeAndBundledJsBrotliExact:true},decoder:{glueBytes:glue.length,wasmBytes:wasm.length,combinedBrotliFontOuterGzipBytes:decoderCombined},estimatedNetCompressedReductionBeforeTransportAndIntegration:baseline-payload-decoderCombined,limits:['Research frame parser is not production-hardened.','No browser/HTML startup or integration savings claim.','Decoder costs include glue and WASM but exclude integration code and transport overhead.','All original JPEG bytes reconstructed; no pixel re-encoding.']};
fs.writeFileSync(new URL('full-container-screen.json',base),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(new URL('full-container-candidate.bin',base),candidate);console.log(JSON.stringify(result,null,2));
