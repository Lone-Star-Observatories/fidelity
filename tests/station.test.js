import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrid, fromGrid, parseLocation, station, sdrDiagnosis } from '../src/data/station.js';

test('Maidenhead grid squares match published locators', () => {
  assert.equal(toGrid(41.7147, -72.7272), 'FN31pr'); // W1AW, Newington CT (ARRL)
  assert.equal(toGrid(51.4779, -0.0015), 'IO91xl'); // Royal Observatory Greenwich
  assert.equal(toGrid(-33.8568, 151.2153), 'QF56od'); // Sydney Opera House
  assert.equal(toGrid(41.7147, -72.7272, 4), 'FN31');
  assert.equal(toGrid(41.7147, -72.7272, 8).length, 8);
  // round trip: the centre of a square lies in that square
  for (const g of ['FN31pr', 'IO91xl', 'QF56od', 'EM12', 'JJ00aa', 'RR99xx']) assert.equal(toGrid(fromGrid(g).lat, fromGrid(g).lon, g.length), g);
  assert.equal(fromGrid('ZZ99'), null); assert.equal(fromGrid('hello'), null);
});

test('what operators type for a location', () => {
  const g = parseLocation('em12kx');
  assert.equal(g.grid, 'EM12kx'); assert.match(g.label, /°N .*°W$/); assert.ok(Math.abs(g.lat - 32.979) < 0.03 && Math.abs(g.lon - -97.125) < 0.05);
  assert.deepEqual([parseLocation('32.78, -96.80').lat, parseLocation('32.78, -96.80').lon], [32.78, -96.8]);
  assert.deepEqual([parseLocation('32.78N 96.80W').lat, parseLocation('32.78N 96.80W').lon], [32.78, -96.8]);
  assert.deepEqual([parseLocation('33.87 S, 151.21 E').lat, parseLocation('33.87 S, 151.21 E').lon], [-33.87, 151.21]);
  for (const bad of ['', 'Dallas', '95, 10', '10, 200']) assert.equal(parseLocation(bad), null, bad);
  assert.equal(station(41.7147, -72.7272).grid, 'FN31pr');
});

test('why no local SDR shows up', () => {
  assert.deepEqual(sdrDiagnosis({ rx: [{ driver: 'bladerf' }], tools: {} }), []);
  assert.match(sdrDiagnosis({ rx: [], tools: {} })[0], /bladeRF-cli was not found/);
  assert.match(sdrDiagnosis({ rx: [], tools: { bladeRF_cli: true } })[0], /found no board/);
  assert.match(sdrDiagnosis(null)[0], /backend/);
});
