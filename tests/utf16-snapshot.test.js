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

test('UTF16 v2 preserves331-byte boundaries, binary, legacy v1 and JSON payloads', async()=>{
 const {gzipSync}=await import('node:zlib');
 const {decodeSnapshot}=await import('../src/data/snapshot-codec.js');
 for(const size of [0,1,2,254,255,256,330,331,332,661,662,663,4097]){
  const bytes=Uint8Array.from({length:size},(_,i)=>(i*73+255)%256),packed=encode(bytes,2);
  assert.equal(packed.encoding,'gzip-raw-utf16le-enumerative-v2');
  assert.equal(packed.data.length,Math.ceil(size/331)*166);
  assert.deepEqual(decode(packed),bytes);
  assert.deepEqual(decode(encode(bytes)),bytes);
  assert.equal(Buffer.from(packed.data,'utf16le').toString('utf16le'),packed.data);
  assert.doesNotMatch(packed.data,/[<\r\n\0\ud800-\udfff\ufeff\ufffe\uffff\u2028\u2029]/u);
 }
 const value={name:'Hiʻiaka—</script>',n:-1e-12,unknown:null,native:'data:image/png;base64,AAEC//8='};
 assert.deepEqual(await decodeSnapshot(encode(gzipSync(JSON.stringify(value)),2)),value);
});
test('UTF16 v2 rejects malformed envelopes, overflow, digits, padding and wrong versions',()=>{
 const one=encode(Uint8Array.of(1),2);
 for(const byteLength of [-1,1.5,NaN,Infinity,536870913])assert.throws(()=>decode({...one,byteLength}),/length/);
 for(const data of [one.data.slice(1),one.data+' '])assert.throws(()=>decode({...one,data}),/length/);
 for(const bad of ['<','\r','\n','\0','\ud800','\ufeff','\ufffe','\u2028'])assert.throws(()=>decode({...one,data:bad+one.data.slice(1)}),/digit/);
 assert.throws(()=>decode({...one,data:'\ufffd'.repeat(166)}),/overflow/);
 assert.throws(()=>decode({...encode(Uint8Array.of(1,2),2),byteLength:1}),/padding/);
 assert.throws(()=>decode({...one,encoding:'gzip-raw-utf16le-enumerative-v1'}),/length/);
 assert.throws(()=>encode(Uint8Array.of(1),3),/version/);
});
