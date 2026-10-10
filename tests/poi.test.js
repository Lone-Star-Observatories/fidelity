import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoRing, vanAllen, GEO_KM, R_EARTH_KM, VAN_ALLEN } from '../src/views/system/zones.js';
import { REGIONS, LAGRANGE, MASS_RATIO } from '../src/data/poi.js';
import { solSystem } from '../src/data/systems.js';

const AU_KM = 149597870.7;

test('GEO ring sits at 42,164 km in TRUE scale', () => {
  const ring = geoRing();
  ring.remap((x) => (x * R_EARTH_KM) / AU_KM, 'true');
  const p = ring.object.geometry.attributes.position;
  const r = Math.hypot(p.getX(0), p.getY(0), p.getZ(0)) * AU_KM;
  assert.ok(Math.abs(r - GEO_KM) < 1);
});

test('Van Allen shells follow dipole field lines inside their L range', () => {
  for (const [shape, [L1, L2]] of vanAllen().map((s, i) => [s, i ? VAN_ALLEN.outer : VAN_ALLEN.inner])) {
    shape.remap((x) => x, 'unit'); // Earth radii
    const p = shape.object.geometry.attributes.position;
    for (let k = 0; k < p.count; k += 97) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const r = Math.hypot(x, y, z), cosLat = Math.hypot(x, z) / r;
      const L = r / cosLat ** 2; // r = L cos²λ
      assert.ok(L > L1 - 1e-3 && L < L2 + 1e-3, `L=${L}`);
      assert.ok(r >= 0.999, 'never below the surface');
    }
  }
});

test('Sun–Earth L1/L2 are ~1.5 million km from Earth', () => {
  const h = AU_KM * Math.cbrt(MASS_RATIO['sun-earth'] / 3);
  assert.ok(Math.abs(h - 1.5e6) < 2e4);
  const em = 384400 * Math.cbrt(MASS_RATIO['earth-moon'] / 3);
  assert.ok(Math.abs(384400 - em - 326000) < 5000 && Math.abs(384400 + em - 449000) < 5000);
});

test('every point of interest is in the Sol model with facts and a known anchor', () => {
  const m = solSystem(), ids = new Set(m.bodies.map((b) => b.id));
  for (const p of [...REGIONS, ...LAGRANGE]) {
    const b = m.bodies.find((x) => x.id === p.id);
    assert.ok(b?.marker && Object.values(b.facts).flat().length);
    if (b.anchor) assert.ok(ids.has(b.anchor));
  }
});
