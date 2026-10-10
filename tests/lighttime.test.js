import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtYear, span, humanScale, messageTimes } from '../src/data/lighttime.js';

test('a reply from Proxima Centauri takes 8.5 years', () => {
  const t = messageTimes(2026.78, 4.2465);
  assert.equal(fmtYear(t.arrives), 'JAN 2031');
  assert.equal(fmtYear(t.replyBack), 'APR 2035');
  assert.equal(span(t.roundTrip), '8.49 YEARS');
});

test('beyond 75 years, spans are told in lifetimes and generations', () => {
  assert.equal(span(81), '1.1 LIFETIMES · 81 YEARS');
  assert.equal(span(300), '4.0 LIFETIMES · 300 YEARS');
  assert.match(humanScale(81), / great-grandchildren of .*\(3 generations\)/);
  assert.match(humanScale(300), /(great-){10}grandchildren of .*\(12 generations\)/);
  assert.match(humanScale(8.5), /would be 9 when/);
});
