#!/usr/bin/env node
// PDS body-fixed shape reconstructions, converted into km and the viewer's +Y-north frame.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHAPES } from '../../src/data/shapes.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, normals, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
const root = new URL('../../', import.meta.url), SBN = 'https://sbnarchive.psi.edu/pds4/';
const sources = {
  phobos: { url: `${SBN}non_mission/gaskell.phobos.shape-model/data/phobos_ver64q.tab`, format: 'indexed', credit: 'Robert W. Gaskell / NASA PDS Small Bodies Node', citation: 'Gaskell, R.W. (2020). Gaskell Phobos Shape Model V1.0. doi:10.26033/xzv5-bw95', observationDate: '1976–1978, 1989', modelDate: '2006-03-11', frame: 'PDS body-fixed frame defined by pck00006.tpc; source origin retained. Converted (x,y,z) → (x,z,−y). Centre of mass not independently established.' },
  hyperion: { url: `${SBN}certified/saturn_satellite_shape_models_V1_0/data/hyperion_30k_plt.tab`, format: 'unindexed', credit: 'Peter C. Thomas / Cassini ISS / NASA PDS Small Bodies Node', citation: 'Saturn Small Moon Shape Models V1.0 (2018), urn:nasa:pds:saturn_satellite_shape_models. Thomas et al. (2007, 2013); see archive label and hyperion_document.pdf.', observationDate: 'Cassini tour 2004–2017', modelDate: '2018 archive', frame: 'Source origin: model centre of figure to about 200 m. +Z is north as observed on 2005 day 268; prime meridian set by a crater. Converted (x,y,z) → (x,z,−y). Current chaotic spin is not predicted.' },
  amalthea: { file: 'j5amalthea', west: true }, proteus: { file: 'n8proteus', west: true }, halley: { file: '1682q1halley', west: false },
};
for (const s of Object.values(sources)) if (s.file) Object.assign(s, {
  url: `${SBN}non_mission/small_bodies.stooke.shape-models/data/${s.file}.tab`, format: 'radial',
  credit: 'Philip J. Stooke / NASA PDS Small Bodies Node', citation: 'Stooke Small Bodies Shape Models, urn:nasa:pds:small_bodies.stooke.shape-models; Stooke (1993, 1994) and archive bundle_description.txt.',
  observationDate: s.file.includes('halley') ? 'Giotto / Vega, 1986 encounter' : 'Voyager encounters, 1979 or 1989; see per-file label', modelDate: 'Pre-Galileo models; PDS4 migration 2025',
  frame: `Planetocentric radial grid, source ${s.west ? 'west' : 'east'}-positive longitude converted to east-positive. +X prime meridian, +Y north, −Z east. Original cartographic origin retained; it need not equal centre of figure or mass.`,
});
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

export function parseShape(text, spec) {
  const rows = text.trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/).map(Number));
  let vertices = [], indices = [];
  if (spec.format === 'radial') {
    const table = new Map(rows.map(([lon, lat, radius]) => [`${lon},${lat}`, radius]));
    const longs = [...new Set(rows.map((r) => r[0]))].sort((a, b) => a-b).filter((x) => x < 360);
    const lats = [...new Set(rows.map((r) => r[1]))].sort((a,b) => a-b);
    for (const lon of longs) for (const lat of lats) {
      const radius = table.get(`${lon},${lat}`), L = lon * Math.PI / 180 * (spec.west ? -1 : 1), B = lat * Math.PI / 180;
      vertices.push(radius * Math.cos(B) * Math.cos(L), radius * Math.sin(B), -radius * Math.cos(B) * Math.sin(L));
    }
    for (let i=0;i<longs.length;i++) for (let j=0;j<lats.length-1;j++) {
      const a=i*lats.length+j, b=((i+1)%longs.length)*lats.length+j;
      if (j>0) indices.push(a,b,a+1);
      if (j<lats.length-2) indices.push(b,b+1,a+1);
    }
  } else {
    const [nv, nf] = rows[0];
    for (const row of rows.slice(1, nv+1)) {
      const [x,y,z] = spec.format==='indexed' ? row.slice(1) : row;
      vertices.push(x,z,-y);
    }
    for (const row of rows.slice(nv+1,nv+1+nf)) indices.push(...(spec.format==='indexed' ? row.slice(1) : row).map((x)=>x-(spec.format==='indexed'?1:0)));
  }
  if (!vertices.every(Number.isFinite) || !indices.every((i)=>i>=0 && i<vertices.length/3)) throw new Error('Invalid PDS shape table');
  let volume=0;
  for(let i=0;i<indices.length;i+=3) {
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    volume += vertices[a]*(vertices[b+1]*vertices[c+2]-vertices[b+2]*vertices[c+1])+vertices[a+1]*(vertices[b+2]*vertices[c]-vertices[b]*vertices[c+2])+vertices[a+2]*(vertices[b]*vertices[c+1]-vertices[b+1]*vertices[c]);
  }
  if (volume<0) for(let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  return { vertices, indices };
}

// Split only the longitude seam. UV longitude runs -180 → +180 (0 at centre).
function addUVs(doc, prim) {
  const p=prim.getAttribute('POSITION').getArray(), ix=prim.getIndices().getArray();
  const positions=[], uv=[], index=[];
  for(let i=0;i<ix.length;i+=3) {
    const triangle=[];
    for(let j=0;j<3;j++) {
      const k=ix[i+j]*3,x=p[k],y=p[k+1],z=p[k+2],r=Math.hypot(x,y,z);
      triangle.push({ p:[x,y,z], u:(Math.atan2(-z,x)+Math.PI)/(2*Math.PI), v:0.5+Math.asin(Math.max(-1,Math.min(1,y/r)))/Math.PI });
    }
    if (Math.max(...triangle.map(t=>t.u))-Math.min(...triangle.map(t=>t.u))>0.5) for(const t of triangle) if(t.u<0.5)t.u+=1;
    // A triangle enclosing a pole has no single continuous longitude. Give its
    // nearest-pole corner the neighbours' mean longitude to avoid a seam streak.
    if (Math.max(...triangle.map(t=>t.u))-Math.min(...triangle.map(t=>t.u))>0.5) {
      const pole = triangle.reduce((a,b)=>Math.abs(a.v-0.5)>Math.abs(b.v-0.5)?a:b);
      const sides=triangle.filter(t=>t!==pole);
      sides[1].u += Math.round(sides[0].u-sides[1].u);
      pole.u=(sides[0].u+sides[1].u)/2;
    }
    for(const t of triangle) { index.push(positions.length/3);positions.push(...t.p);uv.push(t.u,t.v); }
  }
  const buffer=doc.getRoot().listBuffers()[0];
  prim.setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer));
  prim.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer));
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer));
}

export async function makeGLB(shape, target) {
  const doc=new Document(), buffer=doc.createBuffer();
  const prim=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(shape.vertices)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(shape.indices)).setBuffer(buffer))
    .setMaterial(doc.createMaterial('Placeholder albedo replaced by viewer skin').setBaseColorFactor([0.45,0.42,0.4,1]).setRoughnessFactor(0.95));
  const mesh=doc.createMesh().addPrimitive(prim);doc.createScene().addChild(doc.createNode().setMesh(mesh));
  if(shape.indices.length/3>target) await doc.transform(weld(), simplify({simplifier:MeshoptSimplifier,ratio:target*0.9/(shape.indices.length/3),error:target<2000?0.05:0.005}));
  const triangles=prim.getIndices().getCount()/3;
  if(triangles>target) throw new Error(`${triangles} > ${target} triangle budget`);
  addUVs(doc,prim);
  await doc.transform(normals({overwrite:true}),prune({keepAttributes:true}),meshopt({encoder:MeshoptEncoder}));
  const array=prim.getAttribute('POSITION').getArray();
  // Quantization may alter accessor storage; original radial bound safely encloses the source.
  const maxRadiusKm=Math.max(...shape.vertices.filter((_,i)=>i%3===0).map((_,i)=>Math.hypot(...shape.vertices.slice(i*3,i*3+3))));
  return {bytes:await io.writeBinary(doc),triangles,maxRadiusKm};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const records={...SHAPES};
for(const [id,spec] of Object.entries(sources)) {
 const response=await fetch(spec.url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`${id} HTTP ${response.status}`);
 const text=await response.text(), shape=parseShape(text,spec);
 const master=await makeGLB(shape,20000), preview=await makeGLB(shape,1990);
 await fs.mkdir(new URL('public/shapes/',root),{recursive:true});
 await fs.writeFile(new URL(`public/shapes/${id}.glb`,root),master.bytes);await fs.writeFile(new URL(`public/shapes/${id}-preview.glb`,root),preview.bytes);
 records[id]={url:`/shapes/${id}.glb`,previewUrl:`/shapes/${id}-preview.glb`,source:spec.url,sourceLabel:spec.url.replace('.tab','.xml'),credit:spec.credit,citation:spec.citation,tier:'modelled',units:'km',frame:spec.frame,origin:'Source cartographic/model origin retained; not forcibly moved to centre of mass.',observationDate:spec.observationDate,modelDate:spec.modelDate,retrieved:'2026-10-10',texLon0:-180,processing:'Body frame conversion; geometric decimation; seam-split equirectangular UVs; recomputed normals and Meshopt compression. No terrain synthesized.',triangles:master.triangles,previewTriangles:preview.triangles,maxRadiusKm:master.maxRadiusKm,bytes:master.bytes.length,previewBytes:preview.bytes.length,sha256:createHash('sha256').update(master.bytes).digest('hex'),sourceSha256:createHash('sha256').update(text).digest('hex')};
 console.log(id,records[id].triangles,records[id].previewTriangles);
}
await fs.writeFile(new URL('src/data/shapes.js',root),'// Credited body-fixed reconstructions and smooth modelled ellipsoids.\nexport const SHAPES = '+JSON.stringify(records,null,2)+';\nexport const shapeFor = (id) => SHAPES[id] ?? null;\n');
}
