// Crew cards (#46): Commons file names and licences, who is aboard what, live time in space.
import test from 'node:test';
import assert from 'node:assert/strict';
import { commonsFile, allowedLicence } from '../server/crew.js';
import { aboard, missionDays, totalDays, initials } from '../src/data/crew.js';

test('Commons file names from upload URLs (originals and thumbnails)', () => {
  assert.equal(commonsFile('https://upload.wikimedia.org/wikipedia/commons/9/97/Zhu_Yangzhu_%2820260523%29.jpg'), 'Zhu_Yangzhu_(20260523).jpg');
  assert.equal(commonsFile('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Jessica_Watkins.jpg/240px-Jessica_Watkins.jpg'), 'Jessica_Watkins.jpg');
  assert.equal(commonsFile('https://example.com/x.jpg'), null);
});

test('only public-domain and Creative Commons images are shown', () => {
  for (const l of ['Public domain', 'PD-USGov-NASA', 'CC0', 'CC BY 4.0', 'CC BY-SA 3.0 IGO']) assert.ok(allowedLicence(l), l);
  for (const l of [null, '', 'Copyrighted', 'Fair use', 'All rights reserved']) assert.ok(!allowedLicence(l), String(l));
});

const PEOPLE = [
  { name: 'Zhu Yangzhu', spacecraft: 'Shenzhou 23', iss: false, launched: '2026-05-24T14:28:36Z', priorDaysInSpace: 150 },
  { name: 'Jessica Watkins', spacecraft: 'Crew-13 Dragon', iss: true, launched: '2026-10-01T00:00:00Z', priorDaysInSpace: 170 },
];
test('aboard and time in space', () => {
  assert.deepEqual(aboard(PEOPLE, 'ISS').map((p) => p.name), ['Jessica Watkins']);
  assert.deepEqual(aboard(PEOPLE, 'TIANGONG').map((p) => p.name), ['Zhu Yangzhu']);
  assert.equal(aboard(PEOPLE, null).length, 2);
  const now = Date.parse('2026-10-11T00:00:00Z');
  assert.equal(missionDays(PEOPLE[1], now), 10);
  assert.equal(totalDays(PEOPLE[1], now), 180);
  assert.equal(initials('Lai Ka-ying'), 'LK');
});
