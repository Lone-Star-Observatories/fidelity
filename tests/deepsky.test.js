import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radecToSupergal } from '../src/astro/frames.js';
import { ageTeff } from '../src/data/deepsky.js';

const sgLB = (v) => { const r = Math.hypot(...v); return [((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360, (Math.asin(v[2] / r) * 180) / Math.PI]; };

test('supergalactic frame: Virgo near SGL 103°, SGB −2°; the poles are where de Vaucouleurs put them', () => {
  const [l, b] = sgLB(radecToSupergal(187.71, 12.39, 16.5));
  assert.ok(Math.abs(l - 102.9) < 1 && Math.abs(b + 2.3) < 1, `${l} ${b}`);
  // supergalactic north pole: RA 283.8°, Dec +15.7° (galactic 47.37°, +6.32°)
  assert.ok(sgLB(radecToSupergal(283.75, 15.71, 1))[1] > 89.5);
});

test('cluster colour runs from hot (young) to cool (old)', () => {
  assert.ok(ageTeff(6.5) > ageTeff(8) && ageTeff(8) > ageTeff(10));
  assert.ok(ageTeff(10) >= 3500 && ageTeff(6) <= 25000);
});
