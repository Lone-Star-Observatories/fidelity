import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOL_ATMOSPHERES, SOL_INTERIORS, BANDS, MR_CURVES, density } from '../src/data/planets.js';
import { PLANETS } from '../src/data/sol.js';

test('every Sol planet has an atmosphere and interior; gas fractions sum to ~100%', () => {
  for (const p of PLANETS) {
    const a = SOL_ATMOSPHERES[p.id];
    assert.ok(a, p.id);
    const sum = a.gases.reduce((s, g) => s + g[2], 0);
    assert.ok(sum > 99 && sum < 102, `${p.id} ${sum}`);
    const layers = SOL_INTERIORS[p.id];
    assert.ok(layers, p.id);
    for (let i = 1; i < layers.length; i++) assert.ok(layers[i][1] > layers[i - 1][1], `${p.id} layers increase`);
    assert.equal(layers.at(-1)[1], 1);
  }
});

test('bulk densities match the NASA fact sheet', () => {
  const want = { mercury: 5.43, venus: 5.24, earth: 5.51, mars: 3.93, jupiter: 1.33, saturn: 0.69, uranus: 1.27, neptune: 1.64, pluto: 1.85 };
  for (const p of PLANETS) assert.ok(Math.abs(density(p.massKg, p.radiusKm) - want[p.id]) < 0.06, `${p.id} ${density(p.massKg, p.radiusKm)}`);
});

test('mass–radius curves: Earth sits on the Earth-like line; iron < rock < water', () => {
  const [iron, earth, water] = MR_CURVES;
  assert.ok(Math.abs(earth.R(1) - 1) < 0.02);
  for (const m of [0.5, 1, 5, 20]) assert.ok(iron.R(m) < earth.R(m) && earth.R(m) < water.R(m));
  const gas = MR_CURVES.find((c) => c.id === 'hhe');
  assert.ok(Math.abs(gas.R(318) - 11.2) < 0.6); // Jupiter
});

test('band tables are in range and positive', () => {
  for (const [k, bands] of Object.entries(BANDS)) for (const [c, hw] of bands) assert.ok(c > 250 && c < 3000 && hw > 0, k);
});
