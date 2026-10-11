import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_LEVELS, DETAIL_MAX, DETAIL_FLAGS, flagsForLevel, levelOfFlags, hiddenByDetail } from '../src/data/detail.js';
import { PLANETS, SUN } from '../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';

const getter = (o) => (k) => o[k];

test('the far left is the bare system: every slider flag off', () => {
  const f = flagsForLevel(0);
  assert.deepEqual(Object.keys(f).sort(), [...DETAIL_FLAGS].sort());
  assert.ok(Object.values(f).every((v) => v === false));
  const get = getter(f);
  for (const b of [SUN, ...PLANETS, ...MOONS].filter((x) => x.kind !== 'dwarf planet')) assert.equal(hiddenByDetail(b, get), false, `${b.id} always shows`);
  assert.equal(hiddenByDetail(PLANETS.find((b) => b.id === 'pluto'), get), true, 'Pluto is a dwarf planet');
  for (const b of SMALL_BODIES) assert.equal(hiddenByDetail(b, get), true, `${b.id} hidden at the far left`);
});

test('each step to the right adds its group and keeps the earlier ones', () => {
  for (let n = 0; n <= DETAIL_MAX; n++) {
    const f = flagsForLevel(n);
    DETAIL_LEVELS.forEach((l, i) => l.flags.forEach((k) => assert.equal(f[k], i <= n, `${k} at step ${n}`)));
    assert.equal(levelOfFlags(getter(f)), n, 'reads back the step it wrote');
  }
  assert.ok(Object.values(flagsForLevel(DETAIL_MAX)).every(Boolean), 'the far right: everything on');
  assert.equal(flagsForLevel(99).axes, true); assert.equal(flagsForLevel(-3).dwarfs, false); // clamped
});

test('the slider reads the deepest complete step from the bar toggles', () => {
  const f = flagsForLevel(DETAIL_MAX);
  assert.equal(levelOfFlags(getter({ ...f, belts: false })), DETAIL_LEVELS.findIndex((l) => l.id === 'small'));
  assert.equal(levelOfFlags(getter({ ...f, missions: false })), DETAIL_LEVELS.findIndex((l) => l.id === 'belts'), 'a step needs all its flags');
  assert.equal(levelOfFlags(() => undefined), DETAIL_MAX, 'unset flags count as on (the defaults)');
});

test('dwarf planets, asteroids and comets, and spacecraft each follow their own flag', () => {
  const ceres = SMALL_BODIES.find((b) => b.kind === 'dwarf planet'), comet = SMALL_BODIES.find((b) => b.comet), rock = SMALL_BODIES.find((b) => b.kind === 'asteroid');
  const get = getter({ dwarfs: true, smallBodies: false, spacecraft: false });
  assert.equal(hiddenByDetail(ceres, get), false);
  assert.equal(hiddenByDetail(comet, get), true);
  assert.equal(hiddenByDetail(rock, get), true);
  assert.equal(hiddenByDetail({ id: 'voyager-1', kind: 'spacecraft' }, get), true);
  assert.equal(hiddenByDetail({ id: 'iss', kind: 'satellite' }, get), true);
  assert.equal(hiddenByDetail({ id: 'se-l2', kind: 'lagrange point', marker: true }, get), false, 'markers follow ZONES');
});
