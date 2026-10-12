import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants as c} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeNumericSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const input=Buffer.from(encodeNumericSnapshot(text,2)),groups=[];
let at=20+input.readUInt32LE(8)+input.readUInt32LE(12);
for(let i=0;i<input.readUInt32LE(16);i++){const width=input[at++],count=input.readUInt32LE(at);at+=4;const n=width*count;groups.push({start:at,n,bytes:Math.ceil(n/2)});at+=Math.ceil(n/2);}
function transform(bytes,inverse=false){const out=Buffer.from(bytes);for(const g of groups){const bits=g.bytes*8;out.fill(0,g.start,g.start+g.bytes);for(let p=0;p<bits;p++){const nibble=Math.floor(p/4),bit=p%4,planePosition=bit*(bits/4)+nibble;const from=inverse?planePosition:p,to=inverse?p:planePosition;if(bytes[g.start+(from>>3)]&(1<<(from&7)))out[g.start+(to>>3)]|=1<<(to&7);}}return out;}
const compress=b=>brotliCompressSync(b,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:c.BROTLI_MODE_FONT}});
const base=compress(input),candidate=transform(input),inner=compress(candidate);
for(const decoded of [brotliDecompressSync(inner),Buffer.from(decompress(inner))]){assert.deepEqual(decoded,candidate);const restored=transform(decoded,true);assert.deepEqual(restored,input);assert.equal(restoreSnapshotText(restored),text);}
const result={snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:input.length,numericGroupCount:groups.length,numericPackedBytes:groups.reduce((s,g)=>s+g.bytes,0),baselineOuterGzipScreenBytes:gzipSync(base,{level:9}).length,bitplaneOuterGzipScreenBytes:gzipSync(inner,{level:9}).length,exactNativeAndBundledJsInverse:true,note:'Research-only four bit planes of existing numeric nibbles, including existing odd padding. Exact numeric character code, token layout, spelling and binary asset tail preserved. Excludes production wrapper/decoder overhead; no adoption.'};
fs.writeFileSync(process.argv[2]||'/tmp/numeric-bitplane-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
