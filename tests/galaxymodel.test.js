import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMS, armRadius, armToScene } from '../src/views/galaxy/model.js';

const arm = (n) => ARMS.find((a) => a.name.startsWith(n));

test('Reid 2019 arms: the Sun (R₀ 8.18 kpc, β 0) sits just inside the Local arm, between Sagittarius and Perseus', () => {
  const sgr = armRadius(arm('Sagittarius'), 0), loc = armRadius(arm('Local'), 0), per = armRadius(arm('Perseus'), 0);
  assert.ok(sgr < 8.18 && 8.18 < per, `${sgr} ${per}`);
  assert.ok(Math.abs(loc - 8.18) < 0.6, String(loc));
  assert.ok(per - 8.18 > 1.5 && per - 8.18 < 2.5, 'Perseus about 2 kpc outward');
});

test('arms trail: going round in the direction of rotation leads inward', () => {
  for (const a of ARMS.filter((x) => x.psiIn > 0 && x.psiOut > 0)) assert.ok(armRadius(a, a.bk + 30) < armRadius(a, a.bk - 30), a.name);
});

test('β = 0 points from the centre towards the Sun; β = 90° is the direction of rotation (scene −z)', () => {
  const [x, , z] = armToScene(0, 8.18);
  assert.ok(x < 0 && Math.abs(z) < 1e-9);
  assert.ok(armToScene(90, 8.18)[2] < 0);
});
