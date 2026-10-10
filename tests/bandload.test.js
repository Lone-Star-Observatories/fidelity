// Instant band previews and the spoken "Processing" (#62): the loading-state machine, preview sizes
// and their budget, and the backend's upstream queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoadTracker, PREVIEW_SIZES, previewBudget } from '../src/data/bandload.js';
import { BANDS, BODY_BAND } from '../src/data/bands.js';
import { PREVIEW, queued, queueState } from '../server/bandimages.js';

/** A fake clock for setInterval. */
function fakeTimers() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    setInterval: (fn, ms) => { timers.set(++id, { fn, ms, next: now + ms }); return id; },
    clearInterval: (i) => timers.delete(i),
    advance(ms) { const end = now + ms; for (;;) { const due = [...timers.values()].filter((t) => t.next <= end).sort((a, b) => a.next - b.next)[0]; if (!due) break; now = due.next; due.next += due.ms; due.fn(); } now = end; },
    get active() { return timers.size; },
  };
}
const deferred = () => { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; };
const flush = () => new Promise((r) => setTimeout(r, 0));
function rig(opts = {}) {
  const t = fakeTimers(), said = [], states = [];
  const tr = createLoadTracker({ speak: (s) => said.push(s), setInterval: t.setInterval, clearInterval: t.clearInterval, onChange: (s) => states.push(s), ...opts });
  return { t, said, states, tr };
}

test('pending count; "Processing" every 3 s until everything arrives, then "Complete"', async () => {
  const { t, said, tr } = rig();
  tr.begin();
  const a = deferred(), b = deferred();
  tr.track(a.p, 'map'); tr.track(b.p, 'sky');
  assert.equal(tr.state.pending, 2); assert.equal(tr.state.phase, 'loading');
  t.advance(2999); assert.deepEqual(said, [], 'nothing before the first 3 s');
  t.advance(1); assert.deepEqual(said, ['Processing']);
  t.advance(3000); assert.deepEqual(said, ['Processing', 'Processing']);
  a.resolve({}); await flush();
  assert.equal(tr.state.pending, 1);
  t.advance(3000); assert.equal(said.length, 3);
  b.resolve({}); await flush();
  assert.equal(tr.state.pending, 0); assert.equal(tr.state.phase, 'done');
  assert.deepEqual(said.slice(-1), ['Complete']);
  t.advance(9000); assert.equal(said.length, 4, 'stops'); assert.equal(t.active, 0);
});

test('a quick load stays silent; rapid switching (debounce) restarts the clock and ignores stale loads', async () => {
  const { t, said, tr } = rig();
  tr.begin(); const q = deferred(); tr.track(q.p);
  t.advance(1000); q.resolve({}); await flush();
  assert.deepEqual(said, [], 'under 3 s: no "Processing", no "Complete"');
  tr.begin(); const old = deferred(); tr.track(old.p);
  t.advance(2000);
  tr.begin(); const cur = deferred(); tr.track(cur.p); // a new band 2 s later
  t.advance(2000); assert.deepEqual(said, [], 'each change restarts the 3 s');
  old.resolve(null); await flush(); // the old band's failure is ignored
  assert.equal(tr.state.failed, 0); assert.equal(tr.state.pending, 1);
  t.advance(1000); assert.deepEqual(said, ['Processing']);
  cur.resolve({}); await flush(); assert.equal(tr.state.phase, 'done');
});

test('silent when disabled (the pill still updates); never over a Computer reply', async () => {
  let on = false, replying = false;
  const { t, said, states, tr } = rig({ enabled: () => on, canSpeak: () => !replying });
  tr.begin(); const a = deferred(); tr.track(a.p);
  t.advance(9000); assert.deepEqual(said, []); assert.ok(states.at(-1).pending === 1, 'the visual state still shows the pending count');
  on = true; replying = true;
  t.advance(3000); assert.deepEqual(said, [], 'skips the tick while the Computer talks');
  replying = false;
  t.advance(3000); assert.deepEqual(said, ['Processing']);
});

test('on failure: stop announcing, say "Unable to complete" once', async () => {
  const { t, said, tr } = rig();
  tr.begin(); const a = deferred(), b = deferred(), c = deferred();
  tr.track(a.p); tr.track(b.p); tr.track(c.p);
  t.advance(3000); assert.deepEqual(said, ['Processing']);
  a.resolve(null); await flush();
  assert.equal(tr.state.phase, 'failed'); assert.deepEqual(said, ['Processing', 'Unable to complete']);
  b.reject(new Error('x')); await flush();
  t.advance(9000); assert.deepEqual(said, ['Processing', 'Unable to complete'], 'said once, no more ticks');
  c.resolve({}); await flush(); assert.equal(tr.state.pending, 0); assert.equal(tr.state.failed, 2);
});

test('preview sizes and the budget for a standalone bake', () => {
  assert.deepEqual(PREVIEW_SIZES.sky, [256, 128]); assert.deepEqual(PREVIEW_SIZES.body, [512, 256]); assert.deepEqual(PREVIEW_SIZES.solar, [256, 256]);
  assert.deepEqual(PREVIEW.sky, PREVIEW_SIZES.sky, 'the backend renders the sizes the client expects'); assert.deepEqual(PREVIEW.body, PREVIEW_SIZES.body);
  const sky = new Set(BANDS.flatMap((b) => b.passes.map((p) => p.sky)).filter(Boolean)).size;
  const entries = Object.values(BODY_BAND).flatMap((m) => Object.values(m));
  const body = new Set(entries.map((s) => s.hips ?? s.gibs).filter(Boolean)).size, solar = new Set(entries.map((s) => s.feed).filter(Boolean)).size;
  assert.ok(sky >= 10 && body >= 8 && solar >= 9);
  const bytes = previewBudget({ sky, body, solar });
  assert.ok(bytes < 6e6, `every preview fits well inside the 16 MB standalone gate (${(bytes / 1e6).toFixed(1)} MB)`);
});

test('the backend queue: at most 3 upstream fetches at once, previews first', async () => {
  const order = [], gates = [];
  const job = (name) => () => new Promise((r) => { order.push(name); gates.push(r); });
  const ps = ['f1', 'f2', 'f3', 'f4', 'f5'].map((n) => queued(job(n)));
  const pp = queued(job('p1'), true);
  await flush();
  assert.deepEqual(order, ['f1', 'f2', 'f3']); assert.deepEqual(queueState(), { running: 3, waiting: 3 });
  gates[0](); await flush(); await flush();
  assert.equal(order[3], 'p1', 'a preview jumps the queue of full images');
  for (let i = 1; i < 6; i++) { gates[i](); await flush(); await flush(); }
  await Promise.all([...ps, pp]);
  assert.deepEqual(order, ['f1', 'f2', 'f3', 'p1', 'f4', 'f5']);
  assert.deepEqual(queueState(), { running: 0, waiting: 0 });
});
