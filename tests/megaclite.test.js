import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{BODY_VISUALS,bodyVisualFor}from'../src/data/bespoke.js';import{MOONS}from'../src/data/moons.js';import{skyGeometry}from'../src/astro/appearance.js';
test('Megaclite selection keeps identity,assumed size and unknown spin distinct from native geography',()=>{
 const v=BODY_VISUALS.megaclite,m=MOONS.find(x=>x.id==='megaclite');
 for(const name of ['Megaclite','Magaclite','Jupiter XIX','S/2000 J8'])assert.equal(bodyVisualFor({name}),v);
 for(const name of ['Themisto','Pasiphae','Dione'])assert.notEqual(bodyVisualFor({name}),v);
 assert.equal(v.surfaceMap,undefined);assert.deepEqual(v.contextImages,[]);assert.equal(v.nativeProducts.embedded,false);
 assert.equal(m.radiusKm,2.7);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.surfacePending,true);
 assert.equal(m.elements.a,23640100);assert.equal(m.elements.P,742.7715);assert.equal(m.elements.frame,'ecliptic');assert.equal(m.elements.pole,null);
 assert.ok(Math.abs(skyGeometry(v.skyModel).angularDiameterDeg-.3388827913302414)<1e-12);
 const text=[...v.measured,...v.modelled,...v.unknown,...v.assumed].join(' ');
 for(const phrase of ['not a thermal measurement','not measured spin locking','not calibrated RGB','no detected signal','not independently verified','not CC BY','not pixel-identical','No observed-body map','No dated site'])assert.ok(text.toLowerCase().includes(phrase.toLowerCase()),phrase);
 const q=JSON.parse(fs.readFileSync('docs/research/bespoke-queue.json')).entries.find(x=>x.id==='sol-megaclite');assert.equal(q.visualId,'megaclite');assert.equal(q.discoveryYear,'2000');assert.equal(q.source,'https://ssd.jpl.nasa.gov/sats/discovery.html');
});
