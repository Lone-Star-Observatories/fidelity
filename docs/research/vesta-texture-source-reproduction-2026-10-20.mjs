// Research-only reproduction. Never writes the displayed texture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readTiffLayout,greyPng} from '../../server/tiff.js';
const url='https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif';
const hash=b=>createHash('sha256').update(b).digest('hex');
const prefix='data/research-sources/vesta-reproduction-2026-10-20';
const requests=[];let etag;const startedAt=new Date().toISOString();
async function read(start,end){
 const r=await fetch(url,{headers:{range:`bytes=${start}-${end}`,...(etag?{'if-match':etag}:{})},signal:AbortSignal.timeout(60000)});
 assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes ${start}-${end}/356659263`);
 const tag=r.headers.get('etag');if(etag)assert.equal(tag,etag);else etag=tag;
 const b=Buffer.from(await r.arrayBuffer());assert.equal(b.length,end-start+1);
 requests.push({start,end,bytes:b.length,sha256:hash(b),etag:tag,lastModified:r.headers.get('last-modified')});return b;
}
const layout=await readTiffLayout(read),{W,H,rowsPerStrip,stripOffsets}=layout;
const w=2048,h=Math.round(H*w/W),out=new Uint8Array(w*h),rows=Array(h);let next=0;
await Promise.all(Array.from({length:12},async()=>{while(next<h){const y=next++,r=Math.min(H-1,Math.floor((y+.5)*H/h)),o=stripOffsets[Math.floor(r/rowsPerStrip)]+r%rowsPerStrip*W;const row=await read(o,o+W-1);rows[y]=row;for(let x=0;x<w;x++){const a=Math.floor(x*W/w),b=Math.max(a+1,Math.floor((x+1)*W/w));let s=0;for(let k=a;k<b;k++)s+=row[k];out[y*w+x]=Math.round(s/(b-a));}}}));
const png=greyPng(out,w,h),sampled=Buffer.concat(rows),cached=fs.readFileSync('data/textures/vesta.png');
fs.writeFileSync(prefix+'.png',png);fs.writeFileSync(prefix+'-sampled-rows.bin',sampled);
const oldRaw=await sharp(cached).greyscale().raw().toBuffer(),newRaw=await sharp(png).greyscale().raw().toBuffer();assert.equal(oldRaw.length,newRaw.length);let unequal=0;for(let i=0;i<oldRaw.length;i++)if(oldRaw[i]!==newRaw[i])unequal++;
const file=(path,b)=>({path,bytes:b.length,sha256:hash(b)});
const result={startedAt,completedAt:new Date().toISOString(),url,etag,sourceFileBytes:356659263,fullSourceDownloaded:false,fullSourceSha256:null,layout,output:{width:w,height:h},requests:requests.sort((a,b)=>a.start-b.start),retained:[file(prefix+'.png',png),file(prefix+'-sampled-rows.bin',sampled),file('data/textures/vesta.png',cached)],comparison:{pngByteEqual:png.equals(cached),decodedGreyscalePixelEqual:oldRaw.equals(newRaw),unequalSamples:unequal,totalSamples:oldRaw.length},limits:'Exact reproduction tests this configured source and existing sampler only. Range hashes are not a full TIFF hash. ETag is a server validator, not asserted SHA256. No photometric, visible-colour, per-pixel observation-date, DEM/feature registration, physical accuracy or licence validation.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,requests:result.requests.length,layout:{...layout,stripOffsets:layout.stripOffsets.length}}));
