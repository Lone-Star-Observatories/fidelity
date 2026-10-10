// Independent schematic mission models; no source mesh or texture reused.
import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MODELS} from '../../src/data/models.js';
globalThis.FileReader=class {readAsArrayBuffer(b){b.arrayBuffer().then(x=>{this.result=x;this.onloadend?.();});}};
const specs={roadster:{wheels:4,car:true},sojourner:{wheels:6,solar:true,small:true},spirit:{wheels:6,solar:true},opportunity:{wheels:6,solar:true},'lunokhod-1':{wheels:8,tub:true,solar:true},'lunokhod-2':{wheels:8,tub:true,solar:true},zhurong:{wheels:6,solar:true}};
await MeshoptEncoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const assets={...MODELS};
for(const [id,s]of Object.entries(specs)){
 const scene=new T.Scene(), group=new T.Group();scene.add(group);
 const mat=(color,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:.45});
 const body=mat(s.car?0xa81018:0xc4bbaa,.3),black=mat(0x202026),solar=mat(0x183c70,.3),gold=mat(0xc89d41,.5);
 const box=(x,y,z,w,h,d,m)=>{const a=new T.Mesh(new T.BoxGeometry(w,h,d),m);a.position.set(x,y,z);group.add(a);return a;};
 box(0,.5,0,s.car?1.1:1,.28,s.car?2.1:1.25,body);
 if(s.tub){const a=new T.Mesh(new T.CylinderGeometry(.6,.45,.5,16),body);a.position.y=.8;group.add(a);}
 for(let side of[-1,1])for(let k=0;k<s.wheels/2;k++){const z=(k-(s.wheels/2-1)/2)*(s.car?1.3:.55);const a=new T.Mesh(new T.CylinderGeometry(s.small?.16:.23,s.small?.16:.23,.15,16),black);a.rotation.z=Math.PI/2;a.position.set(side*.65,.25,z);group.add(a);box(side*.45,.38,z,.45,.055,.06,gold);}
 if(s.car){box(0,.69,-.15,.95,.12,.85,black);box(-.23,.8,.1,.3,.4,.25,black);box(.23,.8,.1,.3,.4,.25,black);box(0,.94,-.55,1,.04,.04,gold);box(-.47,.8,-.55,.04,.3,.04,gold);box(.47,.8,-.55,.04,.3,.04,gold);const head=new T.Mesh(new T.SphereGeometry(.12,12,8),mat(0xe8e8e8));head.position.set(-.23,1.15,.12);group.add(head);box(-.23,.93,.12,.22,.26,.15,mat(0xe8e8e8));}
 else{box(0,.95,-.35,.08,.75,.08,gold);box(0,1.35,-.35,.4,.15,.14,black);box(.15,.75,.5,.12,.15,.5,gold);if(s.solar){box(0,.72,0,1.6,.035,1.5,solar);}else{box(0,.78,.6,.5,.35,.3,gold);}}
 const source=await new GLTFExporter().parseAsync(scene,{binary:true});const doc=await io.readBinary(new Uint8Array(source));await doc.transform(dedup(),meshopt({encoder:MeshoptEncoder}));const bytes=Buffer.from(await io.writeBinary(doc));await fs.writeFile(`public/models/${id}.glb`,bytes);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices??p.attributes.POSITION].count/3,0);
 const hash=createHash('sha256').update(bytes).digest('hex');assets[id]={url:`/models/${id}.glb`,previewUrl:`/models/${id}.glb`,bytes:bytes.length,triangles,previewBytes:bytes.length,sha256:hash,previewSha256:hash,tier:'modelled',credit:'Fidelity original procedural visualization',licence:'MIT — project-authored geometry',source:'scripts/assets/build-surface-models.mjs',sourcePage:s.car?'https://www.nasa.gov/history/5-years-ago-first-flight-of-the-falcon-heavy-rocket/':'https://science.nasa.gov/mars/exploration/',retrieved:'2026-10-10',fidelity:'Schematic mission silhouette; details, dimensions and configuration are approximate, not an engineering replica.',frame:'Illustrative model frame; no telemetry attitude.',processing:'Independent primitive geometry; no external mesh or texture.',maxTextureSize:0};
 console.log(id,bytes.length);
}
const old=await fs.readFile('src/data/models.js','utf8');await fs.writeFile('src/data/models.js','// Local mission visualizations. See docs/assets.md for registration limits.\nexport const MODELS = '+JSON.stringify(assets,null,2)+';\n'+old.slice(old.indexOf('export function modelFor')));
