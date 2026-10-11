// The loading curtain between main views: lifts at ~30% of what the view started loading.
import test from 'node:test';
import assert from 'node:assert/strict';
import { curtainReady, createLoadTracker, READY_SHARE, MIN_MS, SETTLE_MS, IDLE_MS, MAX_MS } from '../src/views/viewcurtain.js';

test('holds until 30% of the started items have arrived', () => {
  assert.equal(curtainReady({ started: 10, done: 2, elapsed: 2000 }), false);
  assert.equal(curtainReady({ started: 10, done: 3, elapsed: 2000 }), 'loaded');
  assert.equal(READY_SHARE, 0.3);
});

test('never lifts in the first instant, nor before the big loads have had time to start', () => {
  assert.equal(curtainReady({ started: 1, done: 1, elapsed: MIN_MS - 1 }), false);
  assert.equal(curtainReady({ started: 1, done: 1, elapsed: SETTLE_MS - 1 }), false);
  assert.equal(curtainReady({ started: 1, done: 1, elapsed: SETTLE_MS }), 'loaded');
});

test('a cached view (nothing to load) lifts quickly; a stuck one lifts at the limit', () => {
  assert.equal(curtainReady({ started: 0, done: 0, elapsed: IDLE_MS - 1 }), false);
  assert.equal(curtainReady({ started: 0, done: 0, elapsed: IDLE_MS }), 'cached');
  assert.equal(curtainReady({ started: 50, done: 0, elapsed: MAX_MS }), 'timeout');
});

test('items started before the switch do not count when they finish after it', () => {
  const t = createLoadTracker();
  t.begin();
  const old = t.start();
  t.startUrl('a.jpg');
  t.begin(); // the user switched again
  t.end(old); t.endUrl('a.jpg');
  assert.deepEqual(t.state, { started: 0, done: 0 });
  const e = t.start(); t.startUrl('b.jpg'); t.end(e); t.endUrl('b.jpg'); t.endUrl('never-started.jpg');
  assert.deepEqual(t.state, { started: 2, done: 2 });
});
