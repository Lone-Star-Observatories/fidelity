import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { MOONS } from '../src/data/moons.js';
import { BODY_VISUALS, bodyVisualFor } from '../src/data/bespoke.js';
import { solSystem } from '../src/data/systems.js';
import { nativeImageMime } from '../scripts/standalone-native-image.js';

test('Weywot is selectable separately with conditional physical and illustrative orbital limits', () => {
 const m=MOONS.find(m=>m.id==='weywot');assert.equal(m.parent,'quaoar');assert.equal(m.radiusKm,73);assert.equal(m.massKg,null);assert.equal(m.rotationHours,null);assert.equal(m.locked,false);assert.equal(m.phaseUnknown,true);assert.equal(m.elements.frame,'ecliptic');
 const b=solSystem().bodies.find(b=>b.id==='weywot');assert.ok(b);assert.equal(bodyVisualFor(b),BODY_VISUALS.weywot);assert.equal(BODY_VISUALS.weywot.surfaceMap,undefined);assert.equal(m.surfacePending,true);
 assert.match(JSON.stringify(m.orbitFacts),/non-Keplerian|Non-Keplerian/);assert.match(JSON.stringify(BODY_VISUALS.weywot.modelled),/29.995/);
 const a=BODY_VISUALS.weywot.contextImages[0],bytes=fs.readFileSync('public'+a.url);assert.equal(nativeImageMime(bytes),'image/gif');assert.equal(bytes.length,164086);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.equal(a.frames,2);assert.equal(a.publicationDate,null);
});
