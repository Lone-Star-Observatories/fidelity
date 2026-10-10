// Future missions (#44): the curated list is well formed, every target resolves to a body the app
// draws, and nothing about a mission that has not flown is ever badged MEASURED.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUTURE_MISSIONS, MISSION_TIERS, CHECKED, pathTier, factTier, looseJd } from '../src/data/future-missions.js';
import { PLANETS } from '../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';
import { LAGRANGE } from '../src/data/poi.js';

const BODY_IDS = new Set(['sun', ...PLANETS.map((b) => b.id), ...MOONS.map((b) => b.id), ...SMALL_BODIES.map((b) => b.id), ...LAGRANGE.map((b) => b.id)]);

test('every mission is well formed and sourced', () => {
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set();
  for (const m of FUTURE_MISSIONS) {
    assert.ok(MISSION_TIERS[m.tier], `${m.id}: tier ${m.tier}`);
    assert.ok(!ids.has(m.id), `${m.id}: duplicate`); ids.add(m.id);
    assert.ok(m.name && m.agency, m.id);
    assert.ok(m.sources?.length, `${m.id}: no source`);
    for (const u of m.sources) assert.match(u.url ?? u, /^https:\/\//, m.id);
    if (m.target) assert.ok(BODY_IDS.has(m.target), `${m.id}: unknown target ${m.target}`);
    if (m.launch && m.tier !== 'ended') assert.ok(looseJd(m.launch), `${m.id}: unreadable launch ${m.launch}`);
    if (m.notSelected) assert.equal(m.tier, 'proposed', `${m.id}: only a proposal can be "not selected"`);
    if (m.ll2) assert.doesNotThrow(() => new RegExp(m.ll2));
  }
  for (const t of ['confirmed', 'planned', 'proposed']) assert.ok(FUTURE_MISSIONS.some((m) => m.tier === t), `no ${t} missions`);
});

test('no mission that has not flown is ever rendered as MEASURED', () => {
  for (const m of FUTURE_MISSIONS) {
    for (const src of ['horizons', 'transfer']) assert.notEqual(pathTier(m, src), 'measured', `${m.id} path (${src})`);
    assert.notEqual(factTier(m), 'measured', `${m.id} facts`);
  }
  for (const m of FUTURE_MISSIONS.filter((x) => x.tier === 'proposed')) {
    assert.equal(factTier(m), 'modelled', `${m.id}: a proposal is a concept`);
    assert.equal(pathTier(m, 'transfer'), 'modelled');
  }
  // Trident lost its competition and says so
  assert.ok(FUTURE_MISSIONS.find((m) => m.id === 'trident')?.notSelected);
});

test('loose dates', () => {
  const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
  assert.equal(iso(looseJd('2028-07')), '2028-07-01');
  assert.equal(iso(looseJd('2028/2029')), '2028-01-01');
  assert.equal(iso(looseJd('2026-10-19')), '2026-10-19');
  assert.equal(looseJd(null), null);
});
