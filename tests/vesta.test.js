import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {BODY_VISUALS,bodyVisualFor} from '../src/data/bespoke.js';
import {skyGeometry} from '../src/astro/appearance.js';

test('Vesta native context stays distinct from invented views and nonunique interiors',()=>{
  const v=BODY_VISUALS.vesta;
  for(const name of ['Vesta','4 Vesta','(4) Vesta']) assert.equal(bodyVisualFor({name}),v);
  assert.notEqual(bodyVisualFor({name:'Ceres'}),v);
  assert.equal(v.surfaceMap,undefined);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(fs.readFileSync('data/textures/vesta.png')),'176feb188fb351bba86c4a45c47b2de071214fb765dfe0d2c7e809f30e55884d');
  assert.equal(hash(fs.readFileSync('public/dem/vesta.png')),'48ec68589cf820d60b2bbf05d2472168ba14a11a35a78865be9cb4fa9fc4f13e');
  const n=v.contextImages[0];
  assert.equal(n.observationDate,'2011-12-18');
  assert.equal(n.publicationDate,'2012-02-20');
  assert.equal(hash(fs.readFileSync('public'+n.url)),n.sha256);
  assert.equal(n.credit,'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA');
  assert.match(n.processing,/not full-pixel preservation/);
  for(const role of ['surfaceImage','skyImage']) assert.equal(v[role].tier,'imagined');
  const text=[...v.measured,...v.modelled,...v.unknown,...v.assumed].join(' ');
  for(const phrase of ['5–95%quantiles','does not exclude coreless','Historical','Sun off frame','not dated','no generated raster','not calibrated visibleRGB']) {
    assert.ok(text.toLowerCase().includes(phrase.toLowerCase()),phrase);
  }
  assert.ok(Math.abs(skyGeometry(v.skyModel).angularDiameterDeg-.22567642880633507)<1e-12);
});
