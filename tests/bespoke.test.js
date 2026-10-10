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
