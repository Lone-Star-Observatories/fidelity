import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starClass } from '../src/panels/navlist.js';

test('broad star classes from spectral types', () => {
  assert.equal(starClass({ spect: 'A0m...' }), 'A');
  assert.equal(starClass({ spect: 'sdM4' }), 'M'); // Barnard's Star, a subdwarf
  assert.equal(starClass({ spect: 'DA2' }), 'WD');
  assert.equal(starClass({ spect: 'T0.5' }), 'BD');
  assert.equal(starClass({ spect: 'L7.5', archiveOnly: 2 }), 'BD');
  assert.equal(starClass({ spect: 'G2V' }), 'G');
  assert.equal(starClass({ spect: '' }), null);
});
