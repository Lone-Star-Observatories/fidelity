import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {tokenizer} from 'acorn';
import {brotliCompressSync,brotliDecompressSync,gzipSync,constants} from 'node:zlib';
import {decompress} from '../../node_modules/brotli/decompress.js';
import {encodeApplicationNumbers} from '../../scripts/application-numbers.js';
import {restoreApplicationText,wrapBrotliSnapshot,encodeDenseSnapshotBytes} from '../../src/data/snapshot-codec.js';
const source=fs.readFileSync(process.argv[2],'utf8').replaceAll('</script','<\\/script');
const baseline=Buffer.from(encodeApplicationNumbers(source));
const tokens=[...tokenizer(source,{ecmaVersion:'latest',sourceType:'module'})].filter(t=>t.type.label==='name');
const counts=new Map();for(const t of tokens){const s=source.slice(t.start,t.end);counts.set(s,(counts.get(s)||0)+1);}
const rows=[];
function measure(bytes){const inner=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11,[constants.BROTLI_PARAM_MODE]:constants.BROTLI_MODE_GENERIC}});assert.deepEqual(brotliDecompressSync(inner),bytes);assert.deepEqual(Buffer.from(decompress(inner,bytes.length)),bytes);const outer=gzipSync(wrapBrotliSnapshot(bytes,inner),{level:9});return {binaryBytes:bytes.length,outerGzipBytes:outer.length,transportBytes:Buffer.byteLength(encodeDenseSnapshotBytes(outer,2).data)};}
const base=measure(baseline);
for(const minLength of [2,4,8]){
 const dictionary=[...counts].filter(([s,n])=>s.length>=minLength&&n>=2).map(([s])=>s),indices=new Map(dictionary.map((s,i)=>[s,i]));
 const gaps=[],order=[];let at=0;
 for(const t of tokens){const s=source.slice(t.start,t.end);if(!indices.has(s))continue;gaps.push(source.slice(at,t.start));order.push(indices.get(s));at=t.end;}gaps.push(source.slice(at));
 // Trial JSON carries exact gap spellings and identifier indices, followed by the original numeric transpose.
 const trialSource=JSON.stringify({dictionary,gaps,order});
 const bytes=Buffer.from(encodeApplicationNumbers(trialSource));
 const restored=JSON.parse(restoreApplicationText(bytes));let inverse=restored.gaps[0];for(let i=0;i<restored.order.length;i++)inverse+=restored.dictionary[restored.order[i]]+restored.gaps[i+1];assert.equal(inverse,source);
 const result=measure(bytes);rows.push({minLength,dictionaryEntries:dictionary.length,identifierTokens:order.length,...result,deltaOuterGzipBytes:result.outerGzipBytes-base.outerGzipBytes,exactSourceInverse:true});
}
const result={date:'2026-10-12',applicationSha256:createHash('sha256').update(source).digest('hex'),baseline:base,trials:rows,scope:'Research-only repeated Acorn identifier-token dictionary with exact source gaps. No renaming, value conversion, field or asset changes. Trial JSON/numeric container excludes additional runtime decoder and wrapper overhead. Native and bundled JavaScript Brotli inverses verified. No production change or full HTML savings claim.'};
fs.writeFileSync('docs/research/standalone-identifier-assessment-2026-10-12.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
