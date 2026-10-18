import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{createHash}from'node:crypto';import sharp from'sharp';
import{BODY_VISUALS,bodyVisualFor,BESPOKE_TEXTURES}from'../src/data/bespoke.js';
test('bespoke matching identifies full body names without confusing planet letters',()=>{
 assert.equal(bodyVisualFor({id:'b',name:'Barnard b'}),BODY_VISUALS['barnard-b']);
 assert.equal(bodyVisualFor({id:'b',name:'Unrelated star b'}),null);
 assert.equal(bodyVisualFor({id:'ceres',name:'Ceres'}),BODY_VISUALS.ceres);
 assert.equal(BODY_VISUALS.ceres.surfaceMap,undefined);
 assert.equal(BESPOKE_TEXTURES.barnardBespoke.tier,'imagined');
});
test('bespoke assets and research identify hypothetical coverage and verified local bytes',async()=>{
 for(const visual of Object.values(BODY_VISUALS)) {
  assert.ok(visual.references.length>=3&&visual.assumed.length>0&&visual.measured.length>0);
  for(const asset of [visual.surfaceImage,visual.surfaceMap,visual.skyImage].filter(Boolean)) {
   const data=await fs.readFile(new URL('../public'+asset.url,import.meta.url));
   assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);assert.equal(data.length,asset.bytes);
   const metadata=await sharp(data).metadata();assert.deepEqual([metadata.width,metadata.height],[asset.width,asset.height]);
   const preview=await fs.readFile(new URL('../public'+asset.previewUrl,import.meta.url));assert.equal(createHash('sha256').update(preview).digest('hex'),asset.previewSha256);
   assert.equal(asset.tier,'imagined');assert.equal(asset.observationDate,null);
  }
  assert.ok(visual.skyModel.angularDiameterDeg>0);
 }
});

test('system construction prefers a named hypothesis and preserves measured Ceres texture',async()=>{
 const {buildStarSystem,solSystem}=await import('../src/data/systems.js');
 const m=buildStarSystem({star:{id:'x',name:"Barnard's Star",x:1.8,y:0,z:0,distPc:1.8,distLy:6,spect:'M4V',lum:.0034},host:{st_teff:3195,st_rad:.185,st_mass:.16},planets:[{pl_name:'Barnard b',pl_letter:'b',pl_orbper:3.154,pl_orbsmax:.0229,pl_bmasse:.299,pl_bmassprov:'Msini',tran_flag:0,pl_eqt:438}]});
 const b=m.bodies.find(b=>b.id==='b');assert.equal(b.skin.map,'barnardBespoke');assert.equal(b.facts.RENDERING.find(f=>f.label==='SKIN').tier,'imagined');
 assert.equal(solSystem().bodies.find(b=>b.id==='ceres').skin.map,'ceres');
});

test('unresolved dwarf planets get individual hypotheses while native maps retain priority', async()=>{
 const {solSystem}=await import('../src/data/systems.js');
 const bodies=solSystem().bodies;
 for(const id of ['eris','haumea','makemake']) {
  const body=bodies.find(body=>body.id===id), visual=bodyVisualFor(body);
  assert.equal(body.skin.map,visual.surfaceMap.key);
  assert.equal(body.facts.RENDERING.find(f=>f.label==='SURFACE').tier,'imagined');
  assert.ok(visual.unknown.length&&visual.modelled.length);
  for(const image of visual.contextImages) {
   const bytes=await fs.readFile(new URL('../public'+image.url,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
   assert.equal((await sharp(bytes).metadata()).format,'jpeg');
   assert.equal(image.tier,'measured');
  }
 }
 assert.equal(bodies.find(body=>body.id==='pluto').skin.map,'pluto');
 assert.ok(BODY_VISUALS.makemake.measured.some(text=>text.includes('fluorescence')));
 assert.ok(BODY_VISUALS.makemake.references.some(ref=>ref.publicationDate==='2025-09-08'));
});

test('Proxima b and d retain independent named visuals and unmeasured surface constraints', async()=>{
 const {buildStarSystem}=await import('../src/data/systems.js');
 const archive=JSON.parse(await fs.readFile(new URL('../docs/research/nearest-exoplanets.json',import.meta.url),'utf8'));
 const model=buildStarSystem({star:{id:'proxima',name:'Proxima',x:1.3,y:0,z:0,distPc:1.3,distLy:4.24,spect:'M5.5V',lum:.00151},host:{st_teff:2900,st_rad:.141,st_mass:.1221},planets:archive.rows.slice(0,2)});
 const b=model.bodies.find(body=>body.name==='Proxima Cen b'),d=model.bodies.find(body=>body.name==='Proxima Cen d');
 assert.equal(b.skin.map,'proximaBBespoke');assert.equal(d.skin.map,'proximaDBespoke');
 assert.equal(bodyVisualFor({name:'Proxima Centauri b'}).id,'proxima-b');
 assert.equal(bodyVisualFor({name:'Proxima d'}).id,'proxima-d');
 assert.equal(bodyVisualFor({id:'b',name:'b'}),null);
 assert.ok(BODY_VISUALS['proxima-d'].skyModel.angularDiameterDeg>BODY_VISUALS['proxima-b'].skyModel.angularDiameterDeg);
 for(const id of ['proxima-b','proxima-d']) {
  const visual=BODY_VISUALS[id];
  assert.ok(visual.unknown.some(text=>text.includes('physical radius')));
  assert.ok(visual.modelled.some(text=>text.includes('not measured surface temperature')));
  const image=visual.contextImages[0],bytes=await fs.readFile(new URL('../public'+image.url,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
  assert.equal((await sharp(bytes).metadata()).format,'jpeg');assert.equal(image.tier,'imagined');
 }
});

test('Barnard c/d/e have separate researched maps and geometrically ordered stellar skies', async()=>{
 const {buildStarSystem}=await import('../src/data/systems.js');
 const archive=JSON.parse(await fs.readFile(new URL('../docs/research/nearest-exoplanets.json',import.meta.url),'utf8'));
 const planets=archive.rows.filter(r=>/^Barnard [bcde]$/.test(r.pl_name));
 const model=buildStarSystem({star:{id:'barnard',name:"Barnard's Star",x:1.8,y:0,z:0,distPc:1.8,distLy:6,spect:'M4V',lum:.003558},host:{st_teff:3195,st_rad:.185,st_mass:.162},planets});
 const maps=new Set();
 for(const letter of ['b','c','d','e']) {
  const body=model.bodies.find(b=>b.name===`Barnard ${letter}`),visual=bodyVisualFor(body);
  assert.equal(body.skin.map,visual.surfaceMap.key);maps.add(visual.surfaceMap.sha256);
  assert.equal(bodyVisualFor({name:`GJ 699 ${letter}`}),letter==='b'?null:visual);
  if(letter!=='b'){
   assert.ok(visual.unknown.some(s=>s.includes('physical radius')));
   assert.ok(visual.modelled.some(s=>s.includes('not measured surface temperature')));
   assert.ok(Math.abs(visual.skyImage.rasterValidation.widthFraction / visual.skyModel.centreDiscWidthFraction - 1) < 0.2);
   assert.ok(visual.assumed.some(s=>s.includes('Exact apparent-size calibration')));
  }
 }
 assert.equal(maps.size,4);
 const angular=id=>BODY_VISUALS[`barnard-${id}`].skyModel.angularDiameterDeg;
 assert.ok(angular('d')>angular('b')&&angular('b')>angular('c')&&angular('c')>angular('e'));
});

test('Epsilon Indi keeps native point-source imagery separate from invented clouds', async()=>{
 const {EXO_ATMOSPHERES}=await import('../src/data/planets.js');
 const {buildStarSystem}=await import('../src/data/systems.js');
 const archive=JSON.parse(await fs.readFile(new URL('../docs/research/nearest-exoplanets.json',import.meta.url),'utf8'));
 const row=archive.rows.find(r=>r.pl_name==='eps Ind A b');
 const model=buildStarSystem({star:{id:'indi',name:'Epsilon Indi A',x:3.6,y:0,z:0,distPc:3.6,distLy:12,spect:'K5V',lum:.2},host:row,planets:[row]});
 const body=model.bodies.find(b=>b.name===row.pl_name),v=bodyVisualFor(body);
 assert.equal(v.id,'epsilon-indi-b');assert.equal(body.skin.map,v.surfaceMap.key);
 assert.equal(bodyVisualFor({name:'Epsilon Indi B b'}),null);
 assert.equal(v.surfaceMap.tier,'imagined');assert.match(v.nativeSurface,/unresolved/);
 assert.deepEqual(EXO_ATMOSPHERES[row.pl_name].gases,['NH3']);
 assert.match(EXO_ATMOSPHERES[row.pl_name].note,/photometry/);
 assert.equal(v.contextImages.length,2);
 for(const asset of v.contextImages){
  assert.equal(asset.tier,'measured');assert.match(asset.description,/point[- ]source/);
  assert.ok(asset.sourceUrl&&asset.termsUrl);assert.match(asset.terms,/CC BY 4.0/);
  const bytes=await fs.readFile(new URL('../public'+asset.url,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal((await sharp(bytes).metadata()).format,'jpeg');
 }
 assert.equal(v.contextImages[1].sha256,v.contextImages[1].sourceSha256);
 assert.match(v.unknown.join(' '),/no accessible solid ground/);
 assert.ok(v.skyImage.rasterValidation.geometricTargetWidthPixels<1);
});

test('all twenty archive-selected planets now have individual initial dossiers', async()=>{
 const {buildStarSystem}=await import('../src/data/systems.js');
 const archive=JSON.parse(await fs.readFile(new URL('../docs/research/nearest-exoplanets.json',import.meta.url),'utf8'));
 assert.equal(archive.rows.length,20);
 const maps=new Set();
 for(const row of archive.rows){
  const v=bodyVisualFor({name:row.pl_name});assert.ok(v,row.pl_name);
  assert.equal(v.surfaceMap.tier,'imagined');assert.ok(v.skyImage);maps.add(v.surfaceMap.sha256);
 }
 assert.equal(maps.size,20);
 const row=archive.rows.find(r=>r.pl_name==='GJ 1061 b');
 const model=buildStarSystem({star:{id:'gj1061',name:'GJ1061',x:3.6,y:0,z:0,distPc:3.6,distLy:12,spect:'M5.5V',lum:.0017},host:row,planets:[row]});
 const v=bodyVisualFor(model.bodies.find(b=>b.name===row.pl_name));
 assert.equal(v.id,'gj1061-b');assert.equal(bodyVisualFor({name:'GJ 1061 c'}),null);
 assert.match(v.modelled.join(' '),/interaction-model inference/);
 assert.match(v.modelled.join(' '),/not a measured radius/);
 assert.ok(v.unknown.some(s=>s.includes('composition')));
 assert.ok(Math.abs(v.skyModel.angularDiameterDeg-3.959505454)<1e-6);
});

test('Phobos keeps its native globe and shape while local scenes remain hypothetical',async()=>{
 const{MOONS}=await import('../src/data/moons.js');const{SHAPES}=await import('../src/data/shapes.js');
 const moon=MOONS.find(b=>b.id==='phobos'),v=bodyVisualFor(moon);
 assert.equal(moon.skin.map,'phobos');assert.equal(v.surfaceMap,undefined);
 assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');
 assert.match(v.unknown.join(' '),/Groove formation remains uncertain/);
 assert.match(v.skyImage.rasterValidation.limits,/oversized/);
 const a=v.contextImages[0];assert.equal(a.tier,'measured');assert.equal(a.observationDate,'2008-03-23');
 assert.equal(a.publicationDate,'2008-04-09');assert.match(a.description,/not calibrated/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+a.url,import.meta.url))).digest('hex'),a.sha256);
assert.match(SHAPES.phobos.source,/gaskell/);assert.notEqual(bodyVisualFor({name:'Deimos'})?.id,'phobos');
});

test('Deimos preserves its own native globe and distinguishes Hera monochrome from enhanced HiRISE', async () => {
 const {MOONS}=await import('../src/data/moons.js');
 const v=bodyVisualFor({name:'Deimos'});assert.equal(v.id,'deimos');assert.equal(v.surfaceMap,undefined);
 assert.equal(MOONS.find(m=>m.id==='deimos').skin.map,'deimos');
 assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');
 assert.equal(v.contextImages[0].observationDate,'2025-03-12');assert.equal(v.contextImages[0].publicationDate,'2025-03-13');
 assert.match(v.contextImages[0].terms,/ESA Standard Licence/);assert.match(v.contextImages[0].description,/monochromatic|monochrome/);
 assert.equal(v.contextImages[1].observationDate,'2009-02-21');assert.match(v.contextImages[1].description,/not calibrated/);
 for(const a of v.contextImages)assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+a.url,import.meta.url))).digest('hex'),a.sha256);
 assert.match(v.unknown.join(' '),/composition/);assert.match(v.assumed.join(' '),/invented/);
});

test('Io preserves its own globe and labels JIRAM saturation and regional reservoir hypotheses', async () => {
 const {MOONS}=await import('../src/data/moons.js');const moon=MOONS.find(m=>m.id==='io'),v=bodyVisualFor(moon);
 assert.equal(v.id,'io');assert.equal(moon.skin.map,'io');assert.equal(v.surfaceMap,undefined);
 assert.match(v.modelled.join(' '),/possible regional/);assert.match(v.modelled.join(' '),/Deep magma ocean not ruled out/);
 assert.match(v.contextImages[0].description,/not visible surface colour/);assert.match(v.contextImages[0].description,/saturates/);
 assert.equal(v.contextImages[0].observationDate,'2024-12-27');assert.equal(v.contextImages[0].publicationDate,'2025-04-29');
 assert.match(v.contextImages[1].description,/circa1999/);assert.match(v.contextImages[1].description,/not lava colour/);
 for(const a of v.contextImages)assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+a.url,import.meta.url))).digest('hex'),a.sha256);
 assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.match(v.unknown.join(' '),/chemistry/);
});

test('Europa preserves its native globe and distinguishes SRU display processing from ice-shell modelling',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const moon=MOONS.find(m=>m.id==='europa'),v=bodyVisualFor(moon);assert.equal(v.id,'europa');assert.equal(moon.skin.map,'europa');assert.equal(v.surfaceMap,undefined);
 assert.match(v.modelled.join(' '),/29±10km/);assert.match(v.modelled.join(' '),/idealized pure-water/);assert.match(v.contextImages[0].description,/display rendition/);assert.match(v.contextImages[0].description,/radiation-particle/);
 assert.equal(v.contextImages[0].observationDate,'2022-09-29');assert.equal(v.contextImages[0].publicationDate,'2024-05-15');assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),v.contextImages[0].sha256);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.match(v.unknown.join(' '),/chemistry/);
});


test('Ganymede preserves its own globe and distinguishes spectral overlay from imagined local chemistry',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const moon=MOONS.find(m=>m.id==='ganymede'),v=bodyVisualFor(moon);assert.equal(v.id,'ganymede');assert.equal(moon.skin.map,'ganymede');assert.equal(v.surfaceMap,undefined);assert.match(v.modelled.join(' '),/laboratory/);assert.match(v.contextImages[0].description,/display rendition/);assert.match(v.contextImages[0].description,/older Galileo/);assert.equal(v.contextImages[0].observationDate,'2021-06-07');assert.equal(v.contextImages[0].publicationDate,'2023-10-30');assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),v.contextImages[0].sha256);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.match(v.unknown.join(' '),/chemistry/);
});

test('Callisto retains own globe and separates SSI panel processing from imagined chemistry',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const moon=MOONS.find(m=>m.id==='callisto'),v=bodyVisualFor(moon);assert.equal(v.id,'callisto');assert.equal(moon.skin.map,'callisto');assert.equal(v.surfaceMap,undefined);assert.equal(v.contextImages[0].observationDate,'2001-05-25');assert.equal(v.contextImages[0].publicationDate,'2001-08-22');assert.match(v.contextImages[0].description,/display rendition/);assert.match(v.contextImages[0].description,/Strip gaps/);assert.match(v.contextImages[0].credit,/Academic Research Lab/);assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),v.contextImages[0].sha256);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.match(v.unknown.join(' '),/chemistry/);assert.match(v.modelled.join(' '),/interpretations/);
});

test('Amalthea retains pending global surface and distinguishes native detection from stereo context',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const moon=MOONS.find(m=>m.id==='amalthea'),v=bodyVisualFor(moon);assert.equal(v.id,'amalthea');assert.equal(moon.surfacePending,true);assert.equal(moon.skin,undefined);assert.equal(v.surfaceMap,undefined);assert.equal(v.contextImages.length,2);assert.equal(v.contextImages[0].observationDate,'2024-03-07');assert.equal(v.contextImages[1].observationDate,'1999-08-12 / 1999-11-26');assert.match(v.contextImages[0].description,/Tiny moon detections/);assert.match(v.contextImages[1].description,/north pole truncated/);assert.match(v.modelled.join(' '),/no Galileo incorporation/);assert.match(v.modelled.join(' '),/interpretations/);for(const a of v.contextImages)assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+a.url,import.meta.url))).digest('hex'),a.sha256);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');
});

test('Mimas native provenance renders with a supported measured tier and preserves its own globe',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='mimas'),v=bodyVisualFor(m);assert.equal(v.id,'mimas');assert.equal(m.skin.map,'mimas');assert.equal(v.surfaceMap,undefined);assert.equal(v.contextImages[0].tier,'measured');assert.equal(v.contextImages[0].observationDate,'2017-01-30');assert.equal(v.contextImages[0].publicationDate,'2017-03-14');assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),v.contextImages[0].sha256);assert.match(v.modelled.join(' '),/warm fully frozen/);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');
});

 test('Dione keeps its own globe and unresolved Cassini panel association',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='dione'),v=bodyVisualFor(m);assert.equal(v.id,'dione');assert.equal(m.skin.map,'dione');assert.equal(v.surfaceMap,undefined);assert.equal(v.contextImages[0].tier,'measured');assert.equal(v.contextImages[0].observationDate,'2015-08-17');assert.equal(v.contextImages[0].publicationDate,'2015-08-20');assert.match(JSON.stringify(v),/camera\/panel/);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'b095fce60ac09c67dc9525227f6abcc16a93840a32928afb87ed0ff2674a3c81');
 });

test('Larissa keeps moon identity, unknown rotation and unresolved spectra separate from Voyager terrain',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='larissa'),v=bodyVisualFor(m);
 assert.equal(m.parent,'neptune');assert.equal(v.id,'larissa');assert.equal(m.surfacePending,true);assert.equal(m.skin,undefined);assert.equal(v.surfaceMap,undefined);assert.equal(m.rotationHours,null);assert.equal(m.massKg,null);assert.equal(m.locked,false);assert.match(m.note,/not evidence of nonsynchronous/);const {solSystem}=await import('../src/data/systems.js');const displayed=solSystem().bodies.find(b=>b.id==='larissa');assert.equal(displayed.rotationHours,null);assert.equal(displayed.locked,false);assert.equal(displayed.facts.PHYSICAL.find(f=>f.label==='ROTATION').value,'UNKNOWN');
 assert.equal(v.contextImages[0].observationDate,null);assert.equal(v.contextImages[0].publicationDate,null);assert.match(v.modelled.join(' '),/not measured local fractions/);assert.match(v.unknown.join(' '),/PIA00063/);assert.equal(v.surfaceImage.tier,'imagined');assert.equal(v.skyImage.tier,'imagined');assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'3e7126c54302c7d4c9d1d22085028424366ece918a8e12b5ff097c9889a22349');
});

test('Galatea separates annotated Voyager detection and ring spectroscopy from imagined terrain',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='galatea'),v=bodyVisualFor(m);assert.equal(m.parent,'neptune');assert.equal(v.id,'galatea');assert.equal(m.surfacePending,true);assert.equal(m.skin,undefined);assert.equal(v.surfaceMap,undefined);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(v.contextImages[0].observationDate,null);assert.equal(v.contextImages[0].publicationDate,'1999-07-25');assert.match(v.unknown.join(' '),/Galileo Jupiter/);assert.match(v.modelled.join(' '),/Ring spectra cannot be relabelled/);assert.match(v.modelled.join(' '),/nondetection does not prove/);assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'73ddb508c68215cbb65150eb744348041c1e397d226a27ea482fe528e460e72c');
});

test('Despina keeps its native N3 detection distinct from N5/N6 and unknown spin',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='despina'),v=bodyVisualFor(m);
 assert.equal(v.id,'despina');assert.equal(m.surfacePending,true);assert.equal(m.skin,undefined);assert.equal(v.surfaceMap,undefined);
 assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.deepEqual(m.elements.pole,[299.7,42.7]);
 assert.match(v.contextImages[0].description,/N5 Thalassa.*N6 Naiad/);assert.match(v.modelled.join(' '),/density prior/);assert.match(v.unknown.join(' '),/CC BY-NC-ND3.0/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'722e261781ab4d164adbe5a9a9cd81ebdfef891088b321470bd966d8284b6425');
});

test('Naiad separates orbital resonance and conditional strength from spin and terrain',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='naiad'),v=bodyVisualFor(m);
 assert.equal(v.id,'naiad');assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.surfacePending,true);assert.equal(v.surfaceMap,undefined);assert.equal(m.massKg,null);assert.equal(m.elements.i,4.7);
 assert.match(v.modelled.join(' '),/not spin locking/);assert.match(v.modelled.join(' '),/conditional strength/);assert.match(v.contextImages[0].description,/Naiad1989N6/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'722e261781ab4d164adbe5a9a9cd81ebdfef891088b321470bd966d8284b6425');
});

 test('Thalassa preserves N5 identity and orbital resonance without inventing spin or resolved geography',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='thalassa'),v=bodyVisualFor(m);
 assert.equal(v.id,'thalassa');assert.equal(m.rotationHours,null);assert.equal(m.massKg,null);assert.equal(m.locked,false);assert.equal(m.surfacePending,true);assert.equal(v.surfaceMap,undefined);assert.equal(m.elements.i,.2);assert.equal(m.elements.node,130.6);
 assert.match(v.modelled.join(' '),/not spin locking/);assert.match(v.contextImages[0].description,/Thalassa1989N5 distinct Naiad1989N6/);assert.equal(v.contextImages[0].publicationDate,null);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'722e261781ab4d164adbe5a9a9cd81ebdfef891088b321470bd966d8284b6425');
 });

 test('Hippocamp preserves unresolved point identity, photometric size and unknown spin',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const m=MOONS.find(x=>x.id==='hippocamp'),v=bodyVisualFor(m);
 assert.equal(v.id,'hippocamp');assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.surfacePending,true);assert.equal(v.surfaceMap,undefined);assert.equal(m.radiusKm,16.2);assert.deepEqual(m.elements.pole,[299.8,43]);
 assert.match(v.modelled.join(' '),/no JPL radius or GM invented/);assert.match(v.contextImages[0].description,/not independently cross-matched/);assert.equal(v.contextImages[0].observationDate,'2009');assert.equal(v.contextImages[0].publicationDate,'2019-02-20');
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'104a38a680e824f717c5bcdcb0457fa2e42a6a27e739867ca9f507900162bfec');
 });

test('MK2 labels its provisional orbit, assumed plane and albedo radius without JPL or spin claims',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');const m=MOONS.find(x=>x.id==='mk2'),v=bodyVisualFor(m),b=solSystem().bodies.find(x=>x.id==='mk2');
 assert.equal(v.id,'mk2');assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(v.surfaceMap,undefined);assert.equal(b.facts.ORBIT.find(x=>x.label==='ORIENTATION').tier,'imagined');assert.match(b.facts.ORBIT.find(x=>x.label==='ORIENTATION').detail,/line of sight/);assert.equal(b.facts.PHYSICAL.find(x=>x.label==='RADIUS').tier,'modelled');assert.equal(b.facts.PHYSICAL.find(x=>x.label==='ROTATION').value,'UNKNOWN');assert.match(v.modelled.join(' '),/NOT resolvedmoonphotometry/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'7045b682fa3effe001998a273d462c4097ffc7618fe2b1afacda4636902bb616');
});

 test('Dysnomia retains thermal-size and rejected-orbit limits with unchanged native Hubble bytes',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');const m=MOONS.find(x=>x.id==='dysnomia'),v=bodyVisualFor(m),b=solSystem().bodies.find(x=>x.id==='dysnomia');
 assert.equal(v.id,'dysnomia');assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(v.surfaceMap,undefined);assert.equal(m.radiusKm,307.5);assert.equal(b.facts.ORBIT.find(x=>x.label==='POSITION').tier,'imagined');assert.match(b.facts.ORBIT.find(x=>x.label==='ORBIT SCALE').detail,/rejected6.3sigma/);assert.equal(b.facts.PHYSICAL.find(x=>x.label==='RADIUS').tier,'modelled');assert.equal(b.facts.PHYSICAL.find(x=>x.label==='ROTATION').value,'UNKNOWN');assert.match(v.contextImages[0].observationDateNote,/Dec9–10 conflict/);assert.match(v.modelled.join(' '),/0.0084/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'236fdc506b8a80baee9955a02308a81dacccf5a0014bc21257f137a98fbde2d0');
 });

 test('Namaka keeps limb, mass and orbit models distinct from resolved geometry and Hiʻiaka',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');const m=MOONS.find(x=>x.id==='namaka'),v=bodyVisualFor(m),b=solSystem().bodies.find(x=>x.id==='namaka');
 assert.equal(v.id,'namaka');assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(v.surfaceMap,undefined);assert.equal(m.radiusKm,75);assert.equal(b.facts.PHYSICAL.find(x=>x.label==='RADIUS').tier,'modelled');assert.equal(b.facts.PHYSICAL.find(x=>x.label==='MASS').tier,'modelled');assert.equal(b.facts.ORBIT.find(x=>x.label==='PERIOD').tier,'computed');assert.match(b.facts.ORBIT.find(x=>x.label==='POSITION').detail,/Hiʻiaka interactions/);assert.match(v.contextImages[0].description,/crossmatch OPEN/);assert.match(v.assumed.join(' '),/No astronomical disk/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'a00aa2da6fea9576721907b21395457fff9a2967dd54cb99129cb43d8a736cbc');
 });

 test('Hiʻiaka preserves approximate spin aliases and body-specific models without measured phase claims',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');const m=MOONS.find(x=>x.id==='hiiaka'),v=bodyVisualFor(m),b=solSystem().bodies.find(x=>x.id==='hiiaka');
 assert.equal(v.id,'hiiaka');assert.match(v.surfaceLabel,/HIʻIAKA/);assert.match(v.skyLabel,/HIʻIAKA/);assert.equal(m.rotationHours,9.8);assert.equal(m.locked,false);assert.equal(v.surfaceMap,undefined);assert.equal(m.radiusKm,185);assert.equal(b.facts.PHYSICAL.find(x=>x.label==='RADIUS').tier,'modelled');assert.equal(b.facts.PHYSICAL.find(x=>x.label==='DAY').tier,'modelled');assert.match(b.facts.PHYSICAL.find(x=>x.label==='DAY').detail,/4.9hour/);assert.equal(b.facts.ORBIT.find(x=>x.label==='PERIOD').tier,'computed');assert.match(v.contextImages[0].description,/crossmatch OPEN/);assert.match(v.modelled.join(' '),/9.71141/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'a00aa2da6fea9576721907b21395457fff9a2967dd54cb99129cb43d8a736cbc');
 });


test('Dimorphos keeps native local DRACO separate from invented geography and unknown spin',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');
 const m=MOONS.find(x=>x.id==='dimorphos'),v=bodyVisualFor(m),b=solSystem().bodies.find(x=>x.id==='dimorphos');
 assert.equal(v.id,'dimorphos');assert.equal(v.surfaceMap,undefined);assert.equal(m.surfacePending,true);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(b.facts.PHYSICAL.find(x=>x.label==='MASS').tier,'imagined');
 assert.equal(bodyVisualFor({name:'Didymos'})?.id==='dimorphos',false);assert.match(b.facts.PHYSICAL.find(x=>x.label==='ROTATION').value,/UNKNOWN/);
 assert.equal(v.contextImages[0].sha256,'a2f8b44dfc8a592c5a5856d03ccfec09f4dbbe7f15c06d6ce4a85bc2b49cba13');
 assert.match(v.contextImages[0].processing,/not full original pixel preservation/);assert.match(v.assumed.join(' '),/not joint fit/);assert.match(v.modelled.join(' '),/not independent weighing/);
 assert.match(v.surfaceLabel,/IMAGINED/);assert.match(v.skyLabel,/IMAGINED/);
});

test('Gonggong preserves unresolved native detections and conditional system models',async()=>{
 const v=bodyVisualFor({name:'Gonggong'});
 assert.equal(v.id,'gonggong');assert.equal(v.surfaceMap,undefined);
 const queue=JSON.parse(await fs.readFile(new URL('../docs/research/bespoke-queue.json',import.meta.url),'utf8'));assert.match(queue.entries.find(x=>x.bodyId==='gonggong').surface,/resolved globe remains pending/);
 assert.equal(bodyVisualFor({name:'Xiangliu'})?.id==='gonggong',false);
 const satellite=queue.entries.find(x=>x.id==='sol-xiangliu');assert.equal(satellite.parent,'gonggong');assert.equal(satellite.visualId,'xiangliu');assert.equal(bodyVisualFor(satellite).id,'xiangliu');
 assert.equal(bodyVisualFor({name:'2007 OR10'}),v);
 assert.match(v.surfaceLabel,/IMAGINED/);assert.match(v.skyLabel,/IMAGINED/);
 assert.match(v.modelled.join(' '),/SYSTEM mass/);assert.match(v.modelled.join(' '),/not measured radius/);
 assert.match(v.measured.join(' '),/Xiangliu was not detected/);
 assert.equal(createHash('sha256').update(await fs.readFile(new URL('../public'+v.contextImages[0].url,import.meta.url))).digest('hex'),'7deeac6962e701c6b809960b69e25c18ddc81014964e2dcd4d56a4ffb95b002a');
 assert.match(v.contextImages[0].processing,/no resizing/);assert.match(v.contextImages[0].credit,/C. Kiss.*J. Stansberry/);
});

test('Gonggong physical cards distinguish thermal radius and system mass without changing catalogue numbers',async()=>{
 const {SMALL_BODIES}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');
 const m=SMALL_BODIES.find(x=>x.id==='gonggong'),b=solSystem().bodies.find(x=>x.id==='gonggong');
 assert.equal(m.radiusKm,615);assert.equal(m.massKg,1.75e21);assert.equal(m.rotationHours,22.4);
 const facts=b.facts.PHYSICAL;assert.equal(facts.find(x=>x.label==='RADIUS').tier,'modelled');assert.equal(facts.find(x=>x.label==='SYSTEM MASS').tier,'modelled');assert.equal(facts.some(x=>x.label==='MASS'),false);assert.equal(facts.some(x=>x.label==='SURFACE G'),false);assert.match(facts.find(x=>x.label==='DAY').detail,/44.8/);
});

 test('Xiangliu keeps its own dossier, unknown spin and conditional size separate from Gonggong',async()=>{
 const {MOONS}=await import('../src/data/moons.js');const {solSystem}=await import('../src/data/systems.js');const m=MOONS.find(x=>x.id==='xiangliu'),b=solSystem().bodies.find(x=>x.id==='xiangliu'),v=bodyVisualFor(m);
 assert.equal(v.id,'xiangliu');assert.notEqual(v,bodyVisualFor({name:'Gonggong'}));assert.equal(v.surfaceMap,undefined);assert.equal(m.surfacePending,true);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.massKg,null);assert.match(b.facts.PHYSICAL.find(x=>x.label==='RADIUS').value,/HYPOTHESIS/);assert.equal(b.facts.PHYSICAL.some(x=>x.label==='SURFACE G'),false);assert.match(v.modelled.join(' '),/retrograde/);assert.match(v.modelled.join(' '),/not measured rotation/);assert.match(v.assumed.join(' '),/oversized/);assert.equal(v.skyImage.height,831);assert.equal(v.skyImage.previewHeight,138);assert.equal(v.contextImages[0].url,bodyVisualFor({name:'Gonggong'}).contextImages[0].url);
 });

 test('minor-planet satellite inventory keeps Weywot and Vanth separate from primary dossiers',async()=>{
 const queue=JSON.parse(await fs.readFile(new URL('../docs/research/bespoke-queue.json',import.meta.url),'utf8'));
 for(const [name,parent] of [['Weywot','quaoar'],['Vanth','orcus']]) {const entry=queue.entries.find(x=>x.id===`sol-${name.toLowerCase()}`);assert.equal(entry.parent,parent);assert.equal(entry.kind,'moon');const id=name.toLowerCase();assert.equal(entry.visualId,id);assert.equal(entry.bodyId,id);assert.equal(bodyVisualFor(entry),BODY_VISUALS[id]);}
 });
