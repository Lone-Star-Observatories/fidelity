import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_VISUALS, bodyVisualFor } from '../src/data/bespoke.js';
import { buildStarSystem } from '../src/data/systems.js';
import { skyGeometry } from '../src/astro/appearance.js';
test('Proxima star skin selects its own plasma hypothesis without capturing its planets', () => {
  const visual = BODY_VISUALS['proxima-star'];
  const model = buildStarSystem({ star: { id: 'p', name: 'Proxima Centauri', x: 1, y: 0, z: 0, distLy: 4.2, spect: 'M5V', lum: .0015 }, host: { st_teff: 2980, st_rad: .146, st_mass: .12 }, planets: [] });
  assert.equal(model.bodies[0].skin.map, visual.surfaceMap.key);
  assert.equal(bodyVisualFor({ name: 'Proxima b' }).id, 'proxima-b');
  assert.equal(bodyVisualFor({ name: 'Proxima d' }).id, 'proxima-d');
  assert.equal(bodyVisualFor({ name: 'Proxima Cen' }), visual);
  assert.equal(visual.contextImages[0].tier, 'measured');
  assert.match(visual.nativeSurface, /not a resolved photosphere/);
  assert.equal(visual.skyImage.tier, 'imagined');
  assert.ok(Math.abs(skyGeometry(visual.skyModel).angularDiameterDeg - 60) < 1e-10);
  assert.match(visual.assumed.join(' '), /No ground/);
});
