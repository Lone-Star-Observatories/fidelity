// The 3D corona (#79): adaptive quality (slow frames lower its resolution and march steps, fast ones bring them back)
// and what a postcard (#40) must say about it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQualityGovernor, CORONA_QUALITY, coronaPostcard } from '../src/views/system/corona.js';

const run = (g, dt, n) => { for (let i = 0; i < n; i++) g.tick(dt); return g.level; };

test('levels get cheaper monotonically, best first', () => {
  assert.deepEqual(CORONA_QUALITY[0], [1, 1]);
  for (let i = 1; i < CORONA_QUALITY.length; i++) {
    const [s, k] = CORONA_QUALITY[i], [s0, k0] = CORONA_QUALITY[i - 1];
    assert.ok(s * s * k < s0 * s0 * k0, `level ${i} costs less than level ${i - 1}`);
  }
});

test('a fast machine stays at the best level; a slow one steps down to the cheapest', () => {
  assert.equal(run(createQualityGovernor(), 16.7, 2000), 0);
  const slow = createQualityGovernor();
  assert.equal(run(slow, 45, 40), 1, 'about a second of slow frames: one step down');
  assert.equal(run(slow, 45, 2000), CORONA_QUALITY.length - 1);
  assert.equal(run(createQualityGovernor(), 2000, 400), CORONA_QUALITY.length - 1, 'very slow frames (software GL) count, clamped');
});

test('it climbs back when frames are fast, but not into a level that proved too slow', () => {
  const g = createQualityGovernor();
  run(g, 45, 100);
  const low = g.level;
  assert.ok(low >= 2);
  assert.equal(run(g, 12, 250), low - 1, 'spare time: one step back up after a few seconds');
  // that level is too slow again straight away: drop and stay below it
  run(g, 40, 40);
  assert.ok(g.level >= low);
  assert.equal(run(g, 12, 3000), low, 'does not try the level that was too slow again');
});

test('one long frame (a postcard render) or a hidden tab does not change the level', () => {
  const g = createQualityGovernor();
  run(g, 16.7, 100);
  g.tick(3000); g.tick(60000);
  assert.equal(run(g, 16.7, 50), 0);
  assert.equal(g.tick(-1), 0);
});

test('postcards list the corona honestly: the volume MODELLED, wisps and exaggerated brightness IMAGINED', () => {
  assert.equal(coronaPostcard(null), null);
  assert.equal(coronaPostcard({ mesh: { visible: false }, look: { kind: 'white' } }), null, 'not drawn: not on the postcard');
  const src = { coronagraph: { instrument: 'SOHO LASCO C3', credit: 'ESA/NASA SOHO' }, euv: { instrument: 'SDO AIA 193 Å', credit: 'NASA SDO' } };
  const white = coronaPostcard({ mesh: { visible: true }, look: { kind: 'white', exaggeration: 3e5 }, structure: { source: 'measured', sources: src } });
  assert.deepEqual(white.modelled, ['3D CORONA']);
  assert.ok(white.imagined.includes('CORONA WISPS') && white.imagined.includes('CORONA BRIGHTNESS (EXAGGERATED)'));
  assert.match(white.credit, /SOHO LASCO C3 and SDO AIA 193 Å/);
  const euv = coronaPostcard({ mesh: { visible: true }, look: { kind: 'euv', exaggeration: 1 }, structure: { source: 'modelled' } });
  assert.ok(!euv.imagined.includes('CORONA BRIGHTNESS (EXAGGERATED)'), 'EUV is drawn to scale');
  assert.ok(euv.imagined.includes('CORONA ACTIVE REGIONS (ILLUSTRATIVE)'));
  assert.equal(euv.credit, null);
});
