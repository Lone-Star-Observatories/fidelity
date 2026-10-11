// Research-only exact binary export for Python standard-library LZMA screening.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { encodeNumericSnapshot, wrapBrotliSnapshot, restoreSnapshotText } from '../../src/data/snapshot-codec.js';
const text = fs.readFileSync('standalone/snapshot.json','utf8');
const binary = encodeNumericSnapshot(text,2);
const inner = zlib.brotliCompressSync(binary,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11,[zlib.constants.BROTLI_PARAM_MODE]:zlib.constants.BROTLI_MODE_FONT}});
const baseline = zlib.gzipSync(wrapBrotliSnapshot(binary,inner),{level:9});
if (restoreSnapshotText(binary) !== text) throw new Error('Binary inverse mismatch');
fs.writeFileSync('/tmp/fidelity-lzma-screen.bin',binary);
fs.writeFileSync('/tmp/fidelity-lzma-baseline.json',JSON.stringify({snapshotSha256:crypto.createHash('sha256').update(text).digest('hex'),binaryBytes:binary.length,baselineOuterGzipBytes:baseline.length}));
console.log(JSON.stringify({binaryBytes:binary.length,baselineOuterGzipBytes:baseline.length}));
