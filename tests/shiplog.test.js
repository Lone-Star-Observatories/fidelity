import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipState, logEntry, saveLog, restoreLog, clearLog, serializeLog, deserializeLog, LOG_CAP, LOG_KEY, pinchZoom } from '../src/views/ship/shipState.js';

test('pinch zoom at the helm: CHASE pulls in, BRIDGE narrows the field, both clamped; ORBIT is left to OrbitControls', () => {
  assert.deepEqual(pinchZoom('chase', 2, { chaseZoom: 4, fov: 50 }), { chaseZoom: 2, fov: 50 });
  assert.deepEqual(pinchZoom('chase', 0.5, { chaseZoom: 300, fov: 50 }), { chaseZoom: 400, fov: 50 });
  assert.deepEqual(pinchZoom('bridge', 2, { chaseZoom: 1, fov: 50 }), { chaseZoom: 1, fov: 25 });
  assert.deepEqual(pinchZoom('bridge', 100, { chaseZoom: 1, fov: 50 }), { chaseZoom: 1, fov: 5 });
  assert.deepEqual(pinchZoom('orbit', 2, { chaseZoom: 1, fov: 50 }), { chaseZoom: 1, fov: 50 });
  assert.deepEqual(pinchZoom('chase', NaN, { chaseZoom: 1, fov: 50 }), { chaseZoom: 1, fov: 50 });
});

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('the ship\'s log survives a reload (save → clear memory → restore)', () => {
  const store = memStore();
  clearLog(store);
  logEntry('HELM ENGAGED · EARTH');
  logEntry('STANDARD ORBIT · MOON');
  shipState.travelledKm = 384400; shipState.earthS = 3600; shipState.shipS = 3599.9; shipState.visited.add('moon');
  assert.ok(saveLog(store));
  const saved = JSON.parse(store.getItem(LOG_KEY));
  assert.equal(saved.log.length, 2);
  shipState.log.length = 0; shipState.travelledKm = 0; shipState.visited.clear();
  assert.ok(restoreLog(store));
  assert.deepEqual(shipState.log.map((e) => e.text), ['HELM ENGAGED · EARTH', 'STANDARD ORBIT · MOON']);
  assert.ok(shipState.log[0].at instanceof Date);
  assert.equal(shipState.travelledKm, 384400);
  assert.ok(shipState.visited.has('moon'));
});

test('the log is capped', () => {
  clearLog(memStore());
  for (let i = 0; i < LOG_CAP + 50; i++) logEntry(`ENTRY ${i}`);
  assert.equal(shipState.log.length, LOG_CAP);
  assert.equal(shipState.log[0].text, 'ENTRY 50');
  assert.equal(serializeLog().log.length, LOG_CAP);
});

test('CLEAR LOG empties memory and storage; bad or blocked storage is harmless', () => {
  const store = memStore();
  logEntry('X'); saveLog(store);
  clearLog(store);
  assert.equal(shipState.log.length, 0);
  assert.equal(store.getItem(LOG_KEY), null);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(saveLog(broken), false);
  assert.equal(restoreLog(broken), false);
  clearLog(broken);
  assert.equal(deserializeLog({ v: 2 }), false);
  assert.equal(deserializeLog({ v: 1, log: [{ at: 'not a date', text: 'A' }, { at: '2026-10-12T00:00:00Z', text: 5 }, { at: '2026-10-12T00:00:00Z', text: 'OK' }], travelledKm: -4 }), true);
  assert.deepEqual(shipState.log.map((e) => e.text), ['OK']);
  assert.equal(shipState.travelledKm, 0);
});
