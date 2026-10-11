// Research only: unchanged binary snapshot, native inverse, no browser decoder candidate.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as z from 'node:zlib';
import {encodeNumericSnapshot,wrapBrotliSnapshot,restoreSnapshotText} from '../../src/data/snapshot-codec.js';
const text=fs.readFileSync('standalone/snapshot.json','utf8');
const binary=encodeNumericSnapshot(text,2),c=z.constants;
const br=z.brotliCompressSync(binary,{params:{[c.BROTLI_PARAM_QUALITY]:11,[c.BROTLI_PARAM_MODE]:c.BROTLI_MODE_FONT}});
const baseline=z.gzipSync(wrapBrotliSnapshot(binary,br),{level:9}).length;
const results=[];
for(const level of [19,22]) {
 const packed=z.zstdCompressSync(binary,{params:{[c.ZSTD_c_compressionLevel]:level}});
 const inverse=z.zstdDecompressSync(packed);
 assert.deepEqual(inverse,Buffer.from(binary));
 assert.equal(restoreSnapshotText(inverse),text);
 const row={level,zstdBytes:packed.length,outerGzipBytes:z.gzipSync(packed,{level:9}).length,exactBinaryAndFullJsonInverse:true};
 results.push(row);console.log(JSON.stringify(row));
}
const result={snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,baselineBrotliWrappedOuterGzipBytes:baseline,results,scope:'Native research screen. Zstd sizes exclude versioned wrapper, browser decoder and notices; no production or browser candidate adopted.'};
fs.writeFileSync(process.argv[2]||'/tmp/fidelity-zstd-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({baseline}));
