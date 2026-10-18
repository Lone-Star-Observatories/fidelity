import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { MOONS } from '../src/data/moons.js';
import { BODY_VISUALS, bodyVisualFor } from '../src/data/bespoke.js';
import { solSystem } from '../src/data/systems.js';

test('Vanth selection preserves Orcus identity, unknown spin and native ownership limits', () => {
 const m=MOONS.find(m=>m.id==='vanth'),v=BODY_VISUALS.vanth;
 assert.equal(m.parent,'orcus');assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.surfacePending,true);
 assert.equal(bodyVisualFor(solSystem().bodies.find(b=>b.id==='vanth')),v);
 assert.notEqual(bodyVisualFor(solSystem().bodies.find(b=>b.id==='orcus')),v);
 assert.equal(v.surfaceMap,undefined);assert.equal(v.contextImages,undefined);
 assert.match(v.nativeSurface,/ownership\/credit crosswalk remains open/);
 assert.match(v.modelled.join(' '),/tangent-plane/);assert.match(v.modelled.join(' '),/443±10/);
 for(const role of ['surfaceImage','skyImage']){const a=v[role];assert.equal(a.tier,'imagined');assert.equal(a.observationDate,null);assert.equal(createHash('sha256').update(fs.readFileSync('public'+a.url)).digest('hex'),a.sha256);assert.match(v[role==='surfaceImage'?'surfaceLabel':'skyLabel'],/IMAGINED/);}
});
