import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BODY_VISUALS,bodyVisualFor} from '../src/data/bespoke.js';
import {MOONS} from '../src/data/moons.js';
import {skyGeometry} from '../src/astro/appearance.js';

test('Themisto selection preserves assumed size, unknown spin and unverified native identity',()=>{
  const v=BODY_VISUALS.themisto,m=MOONS.find(x=>x.id==='themisto');
  for(const name of ['Themisto','Jupiter XVIII','S/1975 J1','S/2000 J1'])assert.equal(bodyVisualFor({name}),v);
  for(const name of ['Dione','Himalia','Callirrhoe'])assert.notEqual(bodyVisualFor({name}),v);
  assert.equal(v.surfaceMap,undefined);assert.deepEqual(v.contextImages,[]);assert.equal(v.nativeProducts.embedded,false);
  assert.equal(m.radiusKm,4);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.surfacePending,true);
  assert.equal(m.elements.a,7397000);assert.equal(m.elements.P,129.9681);assert.equal(m.elements.frame,'ecliptic');assert.equal(m.elements.pole,null);
  assert.ok(Math.abs(skyGeometry(v.skyModel).angularDiameterDeg-1.0830517897746512)<1e-12);
  const text=[...v.measured,...v.modelled,...v.unknown,...v.assumed].join(' ');
  for(const phrase of ['not a thermal measurement','not measured spin locking','not calibrated RGB','not transferred to Themisto','predicted footprints,not verified detections','private pointing label,not Dione','not a paper PDF','No observed-body map','No dated site'])assert.ok(text.toLowerCase().includes(phrase.toLowerCase()),phrase);
  const q=JSON.parse(fs.readFileSync('docs/research/bespoke-queue.json')).entries.find(x=>x.id==='sol-themisto');
  assert.equal(q.visualId,'themisto');assert.equal(q.discoveryYear,'1975, 2000');assert.equal(q.source,'https://ssd.jpl.nasa.gov/sats/discovery.html');
});
