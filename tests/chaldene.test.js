import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{BODY_VISUALS,bodyVisualFor}from'../src/data/bespoke.js';import{MOONS}from'../src/data/moons.js';import{skyGeometry}from'../src/astro/appearance.js';
test('Chaldene selection keeps identity,assumed size and unknown spin distinct from native geography',()=>{
 const v=BODY_VISUALS.chaldene,m=MOONS.find(x=>x.id==='chaldene');
 for(const name of ['Chaldene','Jupiter XXI','S/2000 J10'])assert.equal(bodyVisualFor({name}),v);
 for(const name of ['Themisto','Pasiphae','Dione'])assert.notEqual(bodyVisualFor({name}),v);
 assert.equal(v.surfaceMap,undefined);assert.deepEqual(v.contextImages,[]);assert.equal(v.nativeProducts.embedded,false);
 assert.equal(m.radiusKm,1.9);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.surfacePending,true);
 assert.equal(m.elements.a,22926300);assert.equal(m.elements.P,709.3625);assert.equal(m.elements.frame,'ecliptic');assert.equal(m.elements.pole,null);
 assert.ok(Math.abs(skyGeometry(v.skyModel).angularDiameterDeg-.34943377530265096)<1e-12);
 const text=[...v.measured,...v.modelled,...v.unknown,...v.assumed].join(' ');
 for(const phrase of ['not thermal measurement','not measured spin locking','not calibrated RGB','not independently verified','No blanketCCBY','no analog/bodymap','No datedsite'])assert.ok(text.toLowerCase().includes(phrase.toLowerCase()),phrase);
 const q=JSON.parse(fs.readFileSync('docs/research/bespoke-queue.json')).entries.find(x=>x.id==='sol-chaldene');assert.equal(q.visualId,'chaldene');assert.equal(q.discoveryYear,'2000');assert.equal(q.source,'https://ssd.jpl.nasa.gov/sats/discovery.html');
});
