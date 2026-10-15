import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeUtf16SnapshotBytes as encode, unpackSnapshotBytes as decode} from '../src/data/snapshot-codec.js';
test('UTF16 snapshot transport preserves block boundaries and all byte values',()=>{
 for(const size of [0,1,254,255,256,509,510,511,1024]){
 const bytes=Uint8Array.from({length:size},(_,i)=>(i*73+255)%256),packed=encode(bytes);
 assert.deepEqual(decode(packed),bytes);
 assert.equal(Buffer.from(packed.data,'utf16le').toString('utf16le'),packed.data);
 assert.equal(packed.data.length,Math.ceil(size/255)*128);
 assert.ok(!/[<\r\n\0\ud800-\udfff\ufeff\ufffe\uffff\u2028\u2029]/u.test(packed.data));
 }
});
test('UTF16 snapshot transport rejects corrupt length, digits, overflow and padding',()=>{
 const one=encode(Uint8Array.of(1));
 for(const byteLength of [-1,1.5,NaN,Infinity,536870913])assert.throws(()=>decode({...one,byteLength}),/length/);
 for(const data of [one.data.slice(1),one.data+' '])assert.throws(()=>decode({...one,data}),/length/);
 for(const bad of ['<','\r','\n','\0','\ud800','\ufeff','\ufffe','\u2028'])assert.throws(()=>decode({...one,data:bad+one.data.slice(1)}),/digit/);
 assert.throws(()=>decode({...one,data:'\ufffd'.repeat(128)}),/overflow/);
 assert.throws(()=>decode({...encode(Uint8Array.of(1,2)),byteLength:1}),/padding/);
});
