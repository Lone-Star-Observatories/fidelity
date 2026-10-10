import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_VISUALS, bodyVisualFor } from '../src/data/bespoke.js';
import { buildStarSystem } from '../src/data/systems.js';
import { skyGeometry } from '../src/astro/appearance.js';
test('Proxima star skin selects its own plasma hypothesis without capturing its planets', () => {
  const visual = BODY_VISUALS['proxima-star'];
  const model = buildStarSystem({ star: { id: 'p', name: 'Proxima Centauri', x: 1, y: 0, z: 0, distLy: 4.2, spect: 'M5V', lum: .0015 }, host: { st_teff: 2980, st_rad: .146, st_mass: .12 }, planets: [] });
  assert.equal(model.bodies[0].skin.map, visual.surfaceMap.key);
  assert.equal(bodyVisualFor({ name: 'Proxima b' }).id, 'proxima-b');
  assert.equal(bodyVisualFor({ name: 'Proxima d' }).id, 'proxima-d');
  assert.equal(bodyVisualFor({ name: 'Proxima Cen' }), visual);
  assert.equal(visual.contextImages[0].tier, 'measured');
  assert.match(visual.nativeSurface, /not a resolved photosphere/);
  assert.equal(visual.skyImage.tier, 'imagined');
  assert.ok(Math.abs(skyGeometry(visual.skyModel).angularDiameterDeg - 60) < 1e-10);
  assert.match(visual.assumed.join(' '), /No ground/);
});

test('Alpha Centauri components select independent skins and retain correctly labelled native binary data', () => {
  const a = bodyVisualFor({ name: 'Rigil Kentaurus' }), b = bodyVisualFor({ name: 'Toliman' });
  assert.equal(a.id, 'alpha-centauri-a-star');
  assert.equal(b.id, 'alpha-centauri-b-star');
  assert.notEqual(a.surfaceMap.sha256, b.surfaceMap.sha256);
  assert.notEqual(a.skyImage.sha256, b.skyImage.sha256);
  assert.match(a.identityNote, /left/);
  assert.match(b.identityNote, /right/);
  assert.equal(a.contextImages[0].sha256, b.contextImages[0].sha256);
  assert.equal(a.contextImages[1].tier, 'modelled');
  assert.match(a.contextImages[1].label, /ANNOTATED/);
  for (const visual of [a, b]) {
    assert.ok(Math.abs(skyGeometry(visual.skyModel).angularDiameterDeg - 60) < 1e-10);
    assert.match(visual.assumed.join(' '), /no solid ground/);
  }
});

test('Barnard star stays distinct from its planets and Wolf359 preserves spectral-model limits', () => {
  const barnard = bodyVisualFor({ name: "Barnard's Star" }), wolf = bodyVisualFor({ name: 'CN Leo' });
  assert.equal(barnard.id, 'barnard-star');
  assert.equal(wolf.id, 'wolf-star');
  assert.equal(bodyVisualFor({ name: 'Barnard c' }).id, 'barnard-c');
  assert.equal(bodyVisualFor({ name: 'Barnard e' }).id, 'barnard-e');
  assert.notEqual(barnard.surfaceMap.sha256, wolf.surfaceMap.sha256);
  assert.match(wolf.modelled.join(' '), /TiO/);
  assert.match(wolf.modelled.join(' '), /radius-column units checked/);
  assert.match(wolf.contextImages[0].credit, /Kielkopf/);
  assert.equal(wolf.contextImages[0].observationDate, '2020-04-23');
  assert.match(barnard.contextImages[0].description, /time\/motion/);
});

test('Lalande aliases use its independent stellar map and disclose alternative fits', () => {
  const visual = bodyVisualFor({ name: 'HD 95735' });
  assert.equal(visual.id, 'lalande-star');
  assert.equal(bodyVisualFor({ name: 'Gliese 411' }), visual);
  assert.equal(bodyVisualFor({ name: 'GJ 411 b' }), null);
  const model = buildStarSystem({ star: { id: 'l', name: 'Lalande 21185', x: 1, y: 0, z: 0, distLy: 10.46, spect: 'M2V', lum: .02 }, planets: [] });
  assert.equal(model.bodies[0].skin.map, visual.surfaceMap.key);
  assert.equal(visual.contextImages[0].observationDate, '1999-11-11');
  assert.match(visual.contextImages[0].description, /FITS UT_DATE/);
  assert.match(visual.modelled.join(' '), /3719/);
  assert.match(visual.measured.join(' '), /inconsistent/);
  assert.ok(Math.abs(skyGeometry(visual.skyModel).angularDiameterDeg - 60) < 1e-10);
});

test('Sirius components keep separate photospheres and a gaseous white-dwarf identity', () => {
  const a = bodyVisualFor({ name: 'Sirius' }), b = bodyVisualFor({ name: 'alf CMa B' });
  assert.equal(a.id, 'sirius-a-star');
  assert.equal(b.id, 'sirius-b-star');
  assert.notEqual(a.surfaceMap.sha256, b.surfaceMap.sha256);
  assert.match(b.stellarClass, /white dwarf/);
  assert.match(b.modelled.join(' '), /hydrogen atmosphere/);
  assert.match(b.contextImages[1].description, /instrumentalPSF/);
  assert.equal(b.contextImages[1].observationDate, '2020-11-21');
  assert.equal(a.contextImages[0].sha256, b.contextImages[0].sha256);
  const model = buildStarSystem({ star: { id: 'b', name: 'Sirius B', x: 1, y: 0, z: 0, distLy: 8.6, spect: 'DA2', lum: .024 }, planets: [], measured: { mass: 1.018, props: { radiusSun: .0084, teff: 25000, whiteDwarf: true }, ref: 'Binary literature' } });
  assert.equal(model.bodies[0].kind, 'white dwarf');
  assert.equal(model.bodies[0].skin.map, b.surfaceMap.key);
  assert.ok(Math.abs(skyGeometry(b.skyModel).angularDiameterDeg - 60) < 1e-10);
});

test('Luyten binary aliases choose distinct photospheres and keep inverse-model limits explicit', () => {
  const a=bodyVisualFor({name:'Gliese 65A'}),b=bodyVisualFor({name:'G 272-61 B'});
  assert.equal(a.id,'luyten-a-star');assert.equal(b.id,'luyten-b-star');
  assert.equal(bodyVisualFor({name:'BL Cet'}),a);assert.equal(bodyVisualFor({name:'UV Ceti'}),b);
  assert.notEqual(a.surfaceMap.sha256,b.surfaceMap.sha256);assert.notEqual(a.skyImage.sha256,b.skyImage.sha256);
  for(const visual of[a,b]){assert.match(visual.unknown.join(' '),/binary-aware/);assert.match(visual.assumed.join(' '),/no solid ground/);assert.match(visual.modelled.join(' '),/not independent Teff/);assert.ok(Math.abs(skyGeometry(visual.skyModel).angularDiameterDeg-60)<1e-10);assert.equal(visual.contextImages[0].observationDate,'2007-08-29');}
  assert.equal(bodyVisualFor({name:'Luhman 16A'}),null);
  const model=buildStarSystem({star:{id:'a',name:'Gliese 65A',x:1,y:0,z:0,distLy:8.7,spect:'M5.5V',lum:.00147},planets:[]});
  assert.equal(model.bodies[0].skin.map,a.surfaceMap.key);
});

test('Ross154 aliases preserve its own photosphere and keep Xray artifacts separate',()=>{
  const v=bodyVisualFor({name:'Ross 154'});assert.equal(bodyVisualFor({name:'GJ 729'}),v);assert.equal(bodyVisualFor({name:'V1216 Sgr'}),v);
  assert.notEqual(v.surfaceMap.sha256,bodyVisualFor({name:'Ross 128 b'}).surfaceMap.sha256);
  assert.equal(v.contextImages[0].observationDate,'2002-09-09');assert.match(v.contextImages[0].description,/readout streak/);
  assert.match(v.modelled.join(' '),/Coronal X-ray temperatures/);assert.match(v.assumed.join(' '),/no solid ground/);
  assert.ok(Math.abs(skyGeometry(v.skyModel).angularDiameterDeg-60)<1e-10);
});
