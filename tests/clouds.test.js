import { test } from 'node:test';
import assert from 'node:assert/strict';
import { superRotation, whiteness, layerLook, layerReadout, helmLayerLook } from '../src/views/system/clouds.js';
import { CLOUD_LAYERS } from '../src/astro/atmosphere.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('Venus\' deck turns once in ~4 days, westward, against its ground', () => {
  const L = CLOUD_LAYERS.venus, j = 2460000.5;
  close(superRotation(L, j + 4) - superRotation(L, j), 0, 1e-9, 'a whole turn');
  const d = superRotation(L, j + 1) - superRotation(L, j);
  close(((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 1.5 * Math.PI, 1e-6, 'a quarter turn west a day');
  assert.equal(superRotation(CLOUD_LAYERS.earth, j), 0, 'Earth\'s shell is registered to the imagery');
});

test('whiteness picks out clouds, not desert, sea or forest', () => {
  assert.ok(whiteness(240, 240, 245) > 0.9, 'bright cloud');
  assert.ok(whiteness(190, 190, 195) > 0.5, 'grey cloud');
  assert.ok(whiteness(210, 170, 120) < 0.2, 'desert');
  assert.ok(whiteness(20, 40, 90) < 0.01, 'sea');
  assert.ok(whiteness(40, 80, 30) < 0.01, 'forest');
});

test('the look from each layer', () => {
  const top = layerLook('venus', 71, { day: 1 });
  assert.equal(top.where, 'above');
  assert.ok(top.sunVisible && top.bodiesVisible);
  const deck = layerLook('venus', 60, { day: 1 });
  assert.equal(deck.where, 'in');
  assert.ok(!deck.sunVisible && deck.murk > 0.9);
  const ground = layerLook('venus', 0, { day: 1 });
  assert.equal(ground.where, 'below');
  assert.equal(ground.starFade, 0, 'no stars under the deck');
  assert.ok(ground.hideShell, 'the deck overhead is the overcast sky');
  assert.ok(ground.skyAmb[0] > ground.skyAmb[2] * 2, 'orange light');
  assert.ok(ground.fogK > 0.5, 'thick air');
  const e = layerLook('earth', 0.002, { day: 1 });
  assert.ok(e.sunVisible && !e.hideShell && e.murk === 0);
  assert.equal(layerLook('mars', 1), null);
});

test('read-outs carry the profile and its source', () => {
  const r = layerReadout('venus', 0, 0.002);
  close(r.pBar, 92.1, 0.01);
  assert.match(r.source, /VIRA/);
  const e = layerReadout('earth', 0, 0.002);
  close(e.pBar * 1000, 1013.25, 1e-6);
  assert.match(e.source, /1976/);
});

test('the helm under Venus\' deck gets the surface view\'s overcast; above it, or under Earth\'s clouds, nothing changes', () => {
  assert.equal(helmLayerLook('venus', 120, 40), null, 'above the haze: open space');
  const low = helmLayerLook('venus', 20, 40);
  assert.ok(low && low.sunVisible === false && low.bodiesVisible === false, 'no Sun, no sky under the deck');
  assert.ok(low.light < 0.1, 'a few percent of the light');
  assert.ok(low.sunTint[0] > low.sunTint[2], 'orange');
  const inDeck = helmLayerLook('venus', 60, 40);
  assert.ok(inDeck && inDeck.murk >= low.murk, 'at least as murky inside the deck as below it');
  assert.equal(helmLayerLook('earth', 2, 40), null, 'Earth\'s thin shell leaves the Sun in view');
  assert.equal(helmLayerLook('mars', 2, 40), null);
});
