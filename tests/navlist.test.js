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

import { systemName } from '../src/panels/navlist.js';
test('system names: Luhman 16 AB, Sirius AB, mixed names, single stars', () => {
  assert.equal(systemName([{ name: 'Luhman 16A' }, { name: 'Luhman 16B' }]), 'Luhman 16 AB');
  assert.equal(systemName([{ name: 'Sirius' }, { name: 'Sirius B' }]), 'Sirius AB');
  assert.equal(systemName([{ name: 'Rigil Kentaurus' }, { name: 'Toliman' }, { name: 'Proxima Centauri' }]), 'Rigil Kentaurus system');
  assert.equal(systemName([{ name: 'Wolf 359' }]), 'Wolf 359');
});
