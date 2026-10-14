// Run the token-layout Python preparation and independent inverse first.
// Isolated IDAT compression screen only; never writes production inputs.
import fs from 'node:fs';
import z from 'node:zlib';
import {createHash} from 'node:crypto';
const file='data/research-sources/standalone-png-token-layout-screen-preparation-2026-10-14.json';
const p=JSON.parse(fs.readFileSync(file));
const text=fs.readFileSync('standalone/snapshot.json','utf8');
const pngs=[...text.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map(m=>Buffer.from(m[1],'base64'));
let baseline=0,trial=0;
for(const a of p.assets){
 const b=pngs.find(b=>createHash('sha256').update(b).digest('hex')===a.sourceSha256);
 if(!b)throw new Error('Frozen PNG source missing');
 const chunks=[];
 for(let i=8;i<b.length;){const n=b.readUInt32BE(i);if(b.toString('ascii',i+4,i+8)==='IDAT')chunks.push(b.subarray(i+8,i+8+n));i+=n+12;}
 const original=Buffer.concat(chunks),tokens=fs.readFileSync(a.tokenScreenPayloadPath);
 const compress=b=>z.gzipSync(z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_QUALITY]:11,[z.constants.BROTLI_PARAM_MODE]:z.constants.BROTLI_MODE_FONT}}),{level:9}).length;
 a.isolatedScreen={originalIdatOuterGzipBytes:compress(original),tokenPayloadOuterGzipBytes:compress(tokens),independentPackedInverse:a.independentEncodedTokenInverse?.exactOriginalIdatHash===true?'Independent Python exact original IDAT hash verified':'Run independent inverse before asserting restoration'};
 baseline+=a.isolatedScreen.originalIdatOuterGzipBytes;trial+=a.isolatedScreen.tokenPayloadOuterGzipBytes;
}
p.isolatedScreenTotals={baseline,trial,difference:trial-baseline,scope:'Isolated IDAT vs token payload; excludes full container, PNG framing, decoder/wrapper and HTML transport. No adoption or net HTML savings claim.'};
fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');console.log(p.isolatedScreenTotals);
