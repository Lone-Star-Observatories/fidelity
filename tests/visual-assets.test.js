import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { Vector3, Matrix4 } from 'three';
import { SHAPES } from '../src/data/shapes.js';
import { SKINS } from '../src/data/skins.js';
import { planetClass } from '../src/data/systems.js';
const file = (url) => new URL(`../public${url}`, import.meta.url);

test('body geometry decodes in native kilometres with valid triangles and seam-safe UVs', async () => {
 await MeshoptDecoder.ready;
 const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 for (const [id,asset] of Object.entries(SHAPES)) for(const preview of [false,true]) {
  const bytes=await fs.readFile(file(preview?asset.previewUrl:asset.url));
  assert.equal(bytes.length, preview?asset.previewBytes:asset.bytes);
  if(!preview)assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  const doc=await io.readBinary(bytes);let count=0,max=0;
  for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh()))for(const prim of node.getMesh().listPrimitives()) {
   const p=prim.getAttribute('POSITION').getArray(),uv=prim.getAttribute('TEXCOORD_0').getArray(),ix=prim.getIndices()?.getArray() ?? Uint32Array.from({length:p.length/3},(_,i)=>i);
   count+=ix.length/3;
   assert.ok([...p].every(Number.isFinite),id);
   const matrix=new Matrix4().fromArray(node.getWorldMatrix()), element=[];
   for(let i=0;i<p.length/3;i++){prim.getAttribute('POSITION').getElement(i,element);max=Math.max(max,new Vector3(...element).applyMatrix4(matrix).length());}
   for(let i=0;i<ix.length;i+=3) {
    const us=[ix[i],ix[i+1],ix[i+2]].map(k=>prim.getAttribute('TEXCOORD_0').getElement(k,[])[0]);
    assert.ok(Math.max(...us)-Math.min(...us)<=0.501,`${id} longitude seam`);
    assert.ok(ix.slice(i,i+3).every(k=>k>=0&&k<p.length/3),id);
   }
  }
  assert.equal(count,preview?asset.previewTriangles:asset.triangles);
  assert.ok(count<=(preview?2000:20000),id);
  assert.ok(max>asset.maxRadiusKm*0.9&&max<asset.maxRadiusKm*1.01,`${id} units/bounds`);
  assert.equal(asset.tier,'modelled');assert.equal(asset.units,'km');assert.ok(asset.citation&&asset.origin&&asset.sourceLabel);
 }
});

test('Haumea occultation ellipsoid preserves published axis lengths without invented relief', async()=>{
 await MeshoptDecoder.ready;
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 for(const url of [SHAPES.haumea.url,SHAPES.haumea.previewUrl]) {
  const doc=await io.readBinary(await fs.readFile(file(url))),extents=[0,0,0];
  for(const node of doc.getRoot().listNodes().filter(node=>node.getMesh()))for(const primitive of node.getMesh().listPrimitives()){
   const positions=primitive.getAttribute('POSITION'),matrix=new Matrix4().fromArray(node.getWorldMatrix());
   for(let i=0;i<positions.getCount();i++){
    const position=new Vector3(...positions.getElement(i,[])).applyMatrix4(matrix);
    const [x,y,z]=position.toArray();
    assert.ok(Math.abs((x/1161)**2+(y/513)**2+(z/852)**2-1)<0.001,'smooth published ellipsoid in km');
    [x,y,z].forEach((value,axis)=>extents[axis]=Math.max(extents[axis],Math.abs(value)));
   }
  }
  [1161,513,852].forEach((axis,i)=>assert.ok(Math.abs(extents[i]-axis)<0.2,'correct long/polar/intermediate axis'));
 }
 assert.equal(SHAPES.haumea.label,'OCCULTATION ELLIPSOID');
 assert.ok(SHAPES.haumea.frame.includes('No calibrated inertial pole'));
});

test('generated masters and previews have honest provenance and fit delivery budgets', async () => {
 let total=0;
 for(const [key,asset] of Object.entries(SKINS)) {
  const bytes=await fs.readFile(file(asset.url)),preview=await fs.readFile(file(asset.previewUrl));
  const m=await sharp(bytes).metadata(),p=await sharp(preview).metadata();
  assert.deepEqual([m.width,m.height],[2048,1024]);assert.deepEqual([p.width,p.height],[512,256]);
  assert.ok(bytes.length<=700000,key);assert.equal(bytes.length,asset.bytes);assert.equal(preview.length,asset.previewBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(asset.tier,'imagined');assert.equal(asset.observationDate,null);assert.ok(asset.composition&&asset.credit&&asset.prompt);total+=preview.length;
 }
 assert.ok(total<300000);
 for(const [r,t] of [[1,1200],[1,500],[1,300],[1,100],[2,800],[2,300],[10,1200],[10,300],[10,100]]) {
  assert.ok(SKINS[planetClass(r,t).skin.map]);
 }
});
