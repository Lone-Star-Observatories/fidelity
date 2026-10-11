// Navigation View star look: every star stays visible, band brightness drives size (#28 reconcile).
import test from 'node:test';
import assert from 'node:assert/strict';
import { starSize, navStarLook, MIN_PX, MAX_PX } from '../src/views/navigation/starlook.js';
import { setCurrentBand, bandStarLook, currentBand } from '../src/data/bandstate.js';
import { starBandDelta } from '../src/views/system/bandskin.js';

test('M dwarfs are never sub-pixel; luminous stars are larger, capped', () => {
  assert.equal(starSize(16), MIN_PX); // a faint M dwarf (Proxima M ≈ 15.5)
  assert.ok(starSize(4.83) > starSize(15)); // the Sun beats an M dwarf
  assert.ok(starSize(1.4) > starSize(4.83)); // Sirius beats the Sun
  assert.equal(starSize(-20), MAX_PX);
  assert.equal(starSize(undefined), starSize(12));
});

test('full spectrum: blackbody colour and V size', () => {
  setCurrentBand('full');
  const l = navStarLook({ absmag: 4.83, teff: 5772 });
  assert.equal(l.dark, false);
  assert.equal(l.size, starSize(4.83));
});

test('in a band the size follows the System View rule (V magnitude − Δmag) and colour keeps full strength', () => {
  setCurrentBand('ir');
  const { pass } = currentBand();
  const cool = navStarLook({ absmag: 12, teff: 3000 }), d = starBandDelta(3000, pass);
  assert.ok(d > 0, 'a 3,000 K star is brighter in the infrared than in V');
  assert.equal(cool.size, starSize(12, Math.min(6, d)));
  assert.ok(Math.abs(Math.max(...cool.rgb) - 1) < 1e-9);
});

test('where a photosphere emits nothing the star becomes a hollow NOT OBSERVED marker, not invisible', () => {
  setCurrentBand('radio');
  const l = navStarLook({ absmag: 4.83, teff: 5772 });
  assert.equal(l.dark, true);
  assert.ok(l.size >= MIN_PX && Math.max(...l.rgb) > 0.3);
  assert.equal(bandStarLook(5772, [1, 1, 1]).dMag, -Infinity);
  setCurrentBand('full');
});
