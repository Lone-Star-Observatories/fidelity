import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { MOONS } from '../src/data/moons.js';
import { BODY_VISUALS, bodyVisualFor } from '../src/data/bespoke.js';
import { solSystem } from '../src/data/systems.js';

test('Himalia keeps its own native evidence and synodic fit separate from Jupiter geography and registered spin', () => {
 const m=MOONS.find(m=>m.id==='himalia'),v=BODY_VISUALS.himalia;
 assert.equal(m.parent,'jupiter');assert.equal(m.radiusKm,85);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.phaseUnknown,true);assert.equal(m.locked,false);assert.equal(m.surfacePending,true);
 assert.equal(bodyVisualFor(solSystem().bodies.find(b=>b.id==='himalia')),v);assert.notEqual(bodyVisualFor({name:'Jupiter'}),v);assert.equal(v.surfaceMap,undefined);
 assert.match(m.physicalFacts.find(x=>x.label==='SYNODIC PERIOD').detail,/not a sidereal/);assert.match(v.assumed.join(' '),/oversized/);
 assert.equal(v.contextImages.length,2);
 for(const [index,hash,date] of [[0,'e14e948182be89550aa3e633c964a4c0cdb4c6e1d0bd29afec615dd8b21dd7ba','2001-01-31'],[1,'1218c8c0a7f236bd09d65775613aa1bfe734f5505912d40a83db3e58d3771ed7','2026-03-05']]) {
  const a=v.contextImages[index];assert.equal(createHash('sha256').update(fs.readFileSync('public'+a.url)).digest('hex'),hash);assert.equal(a.sha256,hash);assert.equal(a.publicationDate,date);assert.match(a.observationDate,/2000-12/);
 }
 assert.match(v.contextImages[0].terms,/not CC BY/);assert.match(v.contextImages[1].terms,/CC BY4/);assert.ok(v.contextImages[1].authors.length>40);
 for(const role of ['surfaceImage','skyImage']){assert.equal(v[role].tier,'imagined');assert.equal(v[role].observationDate,null);}
});
