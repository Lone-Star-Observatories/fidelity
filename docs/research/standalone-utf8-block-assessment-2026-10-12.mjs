// Research-only larger UTF-8 enumerative blocks; no production codec changes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unpackSnapshotBytes} from '../../src/data/snapshot-codec.js';
const html=await fs.readFile('dist-standalone/index.html','utf8');
const m=html.match(/id="fidelity-snapshot-data"[^>]*data-encoding="([^"]+)" data-byte-length="(\d+)">([\s\S]*?)<\/script>/);
assert.ok(m);
const bytes=unpackSnapshotBytes({encoding:m[1],byteLength:Number(m[2]),data:m[3]});
const hash=b=>createHash('sha256').update(b).digest('hex');
const groups=[125n,1888n,61402n],counts=[1n];let best={utf8:257,binary:229};
for(let n=1;n<=4096;n++){
 counts[n]=groups.reduce((s,g,i)=>s+(n>i?g*counts[n-i-1]:0n),0n);
 const binary=Math.floor((counts[n].toString(2).length-1)/8);
 if(n>=257&&binary&&n/binary<best.utf8/best.binary)best={utf8:n,binary};
}
const source=(await fs.readFile('src/data/snapshot-codec.js','utf8')).split('// Enumerate raw-script UTF-8 strings by byte length.')[1];
const report={compressedBytes:bytes.length,compressedSha256:hash(bytes),baselineTransportBytes:Buffer.byteLength(m[3]),capacitySearch:{maximumUtf8BlockBytes:4096,best},trials:[]};
for(const candidate of [{utf8:513,binary:458},best]){
 const variant=source.replace(/\b257\b/g,String(candidate.utf8)).replace(/\b229\b/g,String(candidate.binary)).replace(/\b228\b/g,String(candidate.binary-1)).replace(/1832n/g,String(candidate.binary*8)+'n');
 const module=await import('data:text/javascript;base64,'+Buffer.from('// '+variant).toString('base64'));
 const packed=module.encodeUtf8SnapshotBytes(bytes);assert.deepEqual(module.unpackUtf8SnapshotBytes(packed),bytes);
 const size=Buffer.byteLength(packed.data);report.trials.push({...candidate,transportBytes:size,savedBeforeDecoderOverhead:report.baselineTransportBytes-size,exactCompressedInverse:true});
}
console.log(JSON.stringify(report,null,2));
