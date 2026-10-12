import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor } from '../src/views/governor.js';
import { globeTier } from '../src/views/system/relief.js';

test('the frame governor leaves a fast GPU alone', () => {
  const g = createGovernor();
  for (let i = 0; i < 200; i++) { const r = g.update(16.7); assert.equal(r.scale, 1); assert.equal(r.idleMs, 0); }
});

test('slow frames lower the render scale step by step, to the floor, and yield idle time', () => {
  const g = createGovernor({ min: 0.5 });
  let r;
  for (let i = 0; i < 3; i++) r = g.update(2000);
  assert.equal(r.scale, 0.7);
  assert.ok(r.idleMs > 0 && r.idleMs <= 400, 'a 2 s frame leaves the page an idle gap');
  for (let i = 0; i < 30; i++) r = g.update(2000);
  assert.equal(r.scale, 0.5, 'never below the floor');
  assert.equal(g.update(100).idleMs, 0, 'no idle gap after an ordinary slow frame');
});

test('fast frames bring the scale back up after a while', () => {
  const g = createGovernor({ min: 0.5, recover: 10 });
  for (let i = 0; i < 6; i++) g.update(500);
  assert.ok(g.scale < 1);
  for (let i = 0; i < 100; i++) g.update(10);
  assert.equal(g.scale, 1);
});

test('a hidden tab (a huge gap) or a zero interval does not count', () => {
  const g = createGovernor();
  for (let i = 0; i < 10; i++) g.update(120000);
  g.update(0);
  assert.equal(g.scale, 1);
});

test('globe tessellation tiers by camera distance, with hysteresis', () => {
  assert.equal(globeTier(10), 0);
  assert.equal(globeTier(3), 1, 'the helm\'s standoff (3 radii from the centre) gets the middle sphere');
  assert.equal(globeTier(1.2), 2);
  assert.equal(globeTier(4.2, 1), 1, 'stays in the middle tier until 10% past its edge');
  assert.equal(globeTier(4.5, 1), 0);
  assert.equal(globeTier(1.7, 2), 2);
  assert.equal(globeTier(1.7, 1), 1);
});
