import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {encodeNumericSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json',import.meta.url),'utf8');
const original=encodeNumericSnapshot(text,2), view=new DataView(original.buffer);
let at=20+view.getUint32(8,true)+view.getUint32(12,true); const groups=[];
for(let i=0;i<view.getUint32(16,true);i++){const width=original[at++],size=view.getUint32(at,true);at+=4;const start=at,count=width*size;at+=Math.ceil(count/2);groups.push({start,count,width,size});}
const trials=[];
for(const mode of ['baseline','row-major','separate-parity','reverse-columns','column-difference']){
 const candidate=original.slice(), back=original.slice();
 for(const {start,count,width,size} of groups){
  const digits=Array.from({length:count},(_,i)=>(original[start+(i>>1)]>>((i%2)*4))&15);
  const order=Array.from({length:count},(_,i)=> mode==='row-major'?(i%width)*size+Math.floor(i/width):mode==='separate-parity'?(i<Math.ceil(count/2)?i*2:(i-Math.ceil(count/2))*2+1):mode==='reverse-columns'?(width-1-Math.floor(i/size))*size+i%size:i);
  const changed=order.map(i=>mode==='column-difference'? (digits[i]-(i%size?digits[i-1]:0)+15)%15:digits[i]);
  for(let i=0;i<count;i++){const p=start+(i>>1);if(i%2===0)candidate[p]=changed[i]|240;else candidate[p]=(candidate[p]&15)|(changed[i]<<4);}
  const restored=[];for(let i=0;i<count;i++){const code=(candidate[start+(i>>1)]>>((i%2)*4))&15;restored[order[i]]=mode==='column-difference'?(code+(i%size?restored[i-1]:0))%15:code;}
  for(let i=0;i<count;i++){const p=start+(i>>1);if(i%2===0)back[p]=restored[i]|240;else back[p]=(back[p]&15)|(restored[i]<<4);}
 }
 if(!Buffer.from(back).equals(Buffer.from(original))||restoreSnapshotText(back)!==text)throw Error('Roundtrip failed');
 trials.push({mode,gzipLevel9Bytes:gzipSync(candidate,{level:9}).length,exactContainerAndJsonRoundtrip:true});
}
console.log(JSON.stringify({snapshotSha256:createHash('sha256').update(text).digest('hex'),containerBytes:original.length,trials},null,2));
