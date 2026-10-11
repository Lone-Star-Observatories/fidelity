import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeSnapshot, encodeSnapshotBytes, unpackSnapshotBytes, encodeApplicationBytes, unpackApplicationBytes, encodeRawSnapshotBytes, encodeDenseSnapshotBytes, encodeBinarySnapshot, encodeNumericSnapshot, restoreSnapshotText } from '../src/data/snapshot-codec.js';
import { randomBytes } from 'node:crypto';

test('offline snapshot preserves catalogue fields, Unicode and embedded asset bytes', async () => {
  const snapshot = { nearby: { fields: ['id', 'system', 'vKms', 'rvKnown'], stars: [['α Cen', null, [-1.234567891, 0, 3.14159265], false]] },
    details: { example: { metadata: { unknown: null, label: 'Hiʻiaka • Gl 725 A' }, measured: 1e-12 } },
    textures: { native: 'data:image/png;base64,AAEC//8=' }, models: { craft: 'data:model/gltf-binary;base64,AAEC//8=' },
    horizons: { '/api/horizons/local': [[2461323.5, -0.000001, 2, 3]] }, bodyImages: {} };
  const packed = gzipSync(JSON.stringify(snapshot)).toString('base64');
  assert.deepEqual(await decodeSnapshot(packed), snapshot);
  assert.deepEqual(await decodeSnapshot(encodeSnapshotBytes(gzipSync(JSON.stringify(snapshot)))), snapshot);
  assert.deepEqual(await decodeSnapshot(encodeApplicationBytes(gzipSync(JSON.stringify(snapshot)))), snapshot);
});

test('radix85 transport preserves binary values and partial blocks without script delimiters', () => {
  for (const bytes of [Uint8Array.from({ length: 256 }, (_, index) => index), randomBytes(4097), ...[0,1,2,3,4,5].map(length => new Uint8Array(length).fill(255))]) {
    const packed = encodeSnapshotBytes(bytes);
    assert.deepEqual(unpackSnapshotBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[<>"'\\]/);
  }
});

test('radix85 rejects invalid encoding, lengths, digits, overflow and padding', () => {
  for (const packed of [null, {}, {encoding:'gzip-radix85-v1',byteLength:-1,data:''},
    {encoding:'gzip-radix85-v1',byteLength:1,data:'0000'},
    {encoding:'gzip-radix85-v1',byteLength:4,data:'0000"'},
    {encoding:'gzip-radix85-v1',byteLength:4,data:'#####'},
    {encoding:'gzip-radix85-v1',byteLength:1,data:'00001'}]) assert.throws(() => unpackSnapshotBytes(packed));
});

test('offline snapshot rejects corrupt gzip instead of serving partial data', async () => {
  await assert.rejects(decodeSnapshot(Buffer.from('not gzip').toString('base64')));
});

test('raw application transport preserves all bytes and partial blocks without HTML delimiters', () => {
  for (const bytes of [Uint8Array.from({length:256}, (_, i) => i), randomBytes(4097), ...Array.from({length:8}, (_, length) => new Uint8Array(length).fill(255))]) {
    const packed = encodeApplicationBytes(bytes);
    assert.deepEqual(unpackApplicationBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[\x00\x09-\x0d\x1b<]/);
  }
});

test('raw application transport rejects invalid envelopes, overflow and padding', () => {
  const valid = encodeApplicationBytes(new Uint8Array(6));
  for (const packed of [null, {}, {...valid, encoding:'other'}, {...valid, byteLength:-1}, {...valid, data:valid.data.slice(1)}, {...valid, data:'<'.repeat(7)}, {...valid, data:'\x7f'.repeat(7)}, {...encodeApplicationBytes(new Uint8Array(1)), data:valid.data.slice(0,6)+'\x02'}]) {
    assert.throws(() => unpackApplicationBytes(packed));
  }
});

test('wide raw snapshot transport preserves every partial block and rejects corrupt envelopes', async () => {
  for (const bytes of [randomBytes(4097), ...Array.from({length:89}, (_, length) => new Uint8Array(length).fill(255))]) {
    const packed = encodeRawSnapshotBytes(bytes);
    assert.deepEqual(unpackSnapshotBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[\x00\x09-\x0d\x1b<]/);
  }
  const valid = encodeRawSnapshotBytes(new Uint8Array(44));
  for (const packed of [{...valid, byteLength:-1}, {...valid, byteLength:1.5}, {...valid, data:valid.data.slice(1)}, {...valid, data:'<'.repeat(51)}, {...valid, data:'\x7f'.repeat(51)}, {...valid, byteLength:1, data:valid.data.slice(0,50)+'\x02'}]) assert.throws(() => unpackSnapshotBytes(packed));
  assert.deepEqual(await decodeSnapshot(encodeRawSnapshotBytes(gzipSync(JSON.stringify({label:'α • Hiʻiaka', bytes:'AAEC//8='})))), {label:'α • Hiʻiaka', bytes:'AAEC//8='});
});

test('binary snapshot restores exact text, duplicate data URIs, Unicode and arbitrary asset bytes', async () => {
  const uri='data:image/png;base64,'+randomBytes(65537).toString('base64');
  const text=JSON.stringify({first:uri, duplicate:uri, empty:'data:model/gltf-binary;base64,', label:'α Hiʻiaka', nested:[null,1e-12,false]},null,2);
  const packed=encodeBinarySnapshot(text);
  assert.equal(restoreSnapshotText(packed),text);
  assert.deepEqual(await decodeSnapshot(encodeRawSnapshotBytes(gzipSync(packed))),JSON.parse(text));
  assert.equal(restoreSnapshotText(new TextEncoder().encode(text)),text);
  assert.throws(()=>encodeBinarySnapshot('{"label":"__FIDELITY_BINARY_ASSET_"}'));
});
test('binary snapshot rejects truncated lengths, excess data and invalid references', () => {
  const valid=encodeBinarySnapshot('{"x":"data:image/png;base64,AAEC"}');
  for(const size of [8,9,12,valid.length-1]) assert.throws(()=>restoreSnapshotText(valid.slice(0,size)));
  const badLength=valid.slice();new DataView(badLength.buffer).setUint32(8,0xffffffff,true);assert.throws(()=>restoreSnapshotText(badLength));
  const trailing=new Uint8Array(valid.length+1);trailing.set(valid);assert.throws(()=>restoreSnapshotText(trailing));
  const badReference=valid.slice();const at=new TextDecoder().decode(valid).indexOf('ASSET_0')+6;badReference[at]=49;assert.throws(()=>restoreSnapshotText(badReference));
});


test('numeric snapshot preserves exact decimal lexemes, whitespace, quoted digits and binary assets', async () => {
  const text = '{ "label": "# 12.34 α \\"quoted\\"", "values": [-0, 1.2300, 2e+03, -1E-12, 12345678901234567890123], "asset": "data:image/png;base64,AAEC" }';
  const bytes = encodeNumericSnapshot(text);
  assert.equal(restoreSnapshotText(bytes), text);
  assert.deepEqual(await decodeSnapshot(encodeRawSnapshotBytes(gzipSync(bytes))), JSON.parse(text));
  assert.equal(restoreSnapshotText(encodeNumericSnapshot('{"only":"# 123"}')), '{"only":"# 123"}');
});
test('numeric snapshot rejects truncation, invalid ordering, digit corruption and trailing bytes', () => {
  const valid = encodeNumericSnapshot('{"values":[12,34,5]}');
  for (const size of [8,12,19,valid.length-1]) assert.throws(() => restoreSnapshotText(valid.slice(0,size)));
  const skeletonLength = new DataView(valid.buffer).getUint32(8,true);
  const invalidOrder=valid.slice(); invalidOrder[20+skeletonLength]=255; assert.throws(()=>restoreSnapshotText(invalidOrder));
  const invalidDigit=valid.slice(); invalidDigit[20+skeletonLength+3+5]=65; assert.throws(()=>restoreSnapshotText(invalidDigit));
  const trailing=new Uint8Array(valid.length+1); trailing.set(valid); assert.throws(()=>restoreSnapshotText(trailing));
});

test('nibble numeric snapshot preserves original spellings and rejects digit/padding corruption', async () => {
  const text = '{ "quoted": "# α 12", "values": [-0, 1.2300, 2e+03, -1E-12, 12345678901234567890123], "asset": "data:image/png;base64,AAEC" }';
  const bytes = encodeNumericSnapshot(text, 2);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,8)), 'FIDNUM02');
  assert.equal(restoreSnapshotText(bytes), text);
  assert.deepEqual(await decodeSnapshot(encodeDenseSnapshotBytes(gzipSync(bytes), 2)), JSON.parse(text));
  assert.equal(restoreSnapshotText(encodeNumericSnapshot('{"label":"# 123"}', 2)), '{"label":"# 123"}');
  const valid = encodeNumericSnapshot('{"n":5}', 2);
  const offset = 20 + new DataView(valid.buffer).getUint32(8,true) + 1 + 5;
  const digit = valid.slice(); digit[offset] |= 15; assert.throws(()=>restoreSnapshotText(digit), /nibble/);
  const padding = valid.slice(); padding[offset] &= 15; assert.throws(()=>restoreSnapshotText(padding), /padding/);
  for (const size of [8,19,valid.length-1]) assert.throws(()=>restoreSnapshotText(valid.slice(0,size)));
  const trailing = new Uint8Array(valid.length+1); trailing.set(valid); assert.throws(()=>restoreSnapshotText(trailing));
  assert.throws(()=>encodeNumericSnapshot(text,3), /version/);
});


test('dense raw transport preserves all bytes, partial blocks and rejects invalid envelopes', async () => {
  for (const bytes of [randomBytes(4097), ...Array.from({length:95}, (_, length) => new Uint8Array(length).fill(255))]) {
    const packed = encodeDenseSnapshotBytes(bytes);
    assert.deepEqual(unpackSnapshotBytes(packed), new Uint8Array(bytes));
    assert.doesNotMatch(packed.data, /[\0\r<]/);
    assert.throws(() => unpackSnapshotBytes({...packed, data: packed.data + 'a'}));
    if (packed.data.length) assert.throws(() => unpackSnapshotBytes({...packed, data: '<' + packed.data.slice(1)}));
  }
  const snapshot = {label: 'α # \"', number: -1e-12, bytes:'data:image/png;base64,AAEC//8='};
  assert.deepEqual(await decodeSnapshot(encodeDenseSnapshotBytes(gzipSync(JSON.stringify(snapshot)))), snapshot);
  assert.throws(() => unpackSnapshotBytes({encoding:'gzip-raw-radix125-wide-v1', byteLength:47, data:'\x7f'.repeat(54)}));
});


test('dense v2 preserves block boundaries and rejects overflow and nonzero padding', async () => {
  for (const size of [0,1,228,229,230,458,459,4097]) {
    const bytes=randomBytes(size), packed=encodeDenseSnapshotBytes(bytes,2);
    assert.equal(packed.encoding,'gzip-raw-radix125-wide-v2');
    assert.deepEqual(unpackSnapshotBytes(packed),new Uint8Array(bytes));
    assert.doesNotMatch(packed.data,/[\0\r<]/);
    assert.throws(()=>unpackSnapshotBytes({...packed,data:packed.data+'a'}));
  }
  const full=encodeDenseSnapshotBytes(new Uint8Array(229).fill(255),2);
  assert.throws(()=>unpackSnapshotBytes({...full,byteLength:1}));
  assert.throws(()=>unpackSnapshotBytes({...full,data:'\x7f'.repeat(263)}));
  assert.throws(()=>encodeDenseSnapshotBytes(new Uint8Array(),3));
  assert.deepEqual(await decodeSnapshot(encodeDenseSnapshotBytes(gzipSync('{"label":"α","n":-1e-12}'),2)),{label:'α',n:-1e-12});
});
