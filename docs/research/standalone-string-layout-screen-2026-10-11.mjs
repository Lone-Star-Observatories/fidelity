import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {encodeNumericSnapshot} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync(new URL('../../standalone/snapshot.json', import.meta.url),'utf8');
const input=Buffer.from(encodeNumericSnapshot(text,2));
const n=input.readUInt32LE(8), head=input.subarray(20,20+n).toString('utf8'), tail=input.subarray(20+n);
const baseline=gzipSync(input,{level:9}).length;
const results=[];
for(const maximum of [64,256,4096]) {
 const groups=new Map(),order=[];
 const skeleton=head.replace(/"(?:[^"\\]|\\.)*"/g, token=>{
  const b=Buffer.from(token);if(b.length>maximum)return token;
  if(!groups.has(b.length))groups.set(b.length,[]);groups.get(b.length).push(b);order.push(b.length);return '@';
 });
 const orderBytes=Buffer.alloc(order.length*2);order.forEach((width,index)=>orderBytes.writeUInt16LE(width,index*2));
 const decodedOrder=order.map((_,index)=>orderBytes.readUInt16LE(index*2));assert.deepEqual(decodedOrder,order);
 const chunks=[Buffer.from(skeleton),orderBytes];
 const recovered=new Map();
 for(const [width,values] of [...groups].sort((a,b)=>a[0]-b[0])) {
  const block=Buffer.alloc(width*values.length); for(let col=0;col<width;col++)for(let row=0;row<values.length;row++)block[col*values.length+row]=values[row][col];
  chunks.push(block);const decoded=values.map((_,row)=>{const b=Buffer.alloc(width);for(let col=0;col<width;col++)b[col]=block[col*values.length+row];return b.toString('utf8');});recovered.set(width,decoded);
 }
 let at=0;const restored=skeleton.replace(/"(?:[^"\\]|\\.)*"|@/g,token=>token==='@'?recovered.get(decodedOrder[at++]).shift():token);assert.equal(restored,head);assert.equal(at,order.length);
 const bytes=Buffer.concat([input.subarray(0,20),...chunks,tail]);results.push({maximum,tokens:order.length,gzipBytes:gzipSync(bytes,{level:9}).length,exactHeaderRoundtrip:true,groupCount:groups.size});
}
console.log(JSON.stringify({baseline,results},null,2));
