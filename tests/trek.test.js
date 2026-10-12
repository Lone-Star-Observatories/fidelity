import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TREK, TREK_KINDS, TREK_CONFIDENCE, TREK_SERIES, trekFor, trekAtStar, trekStarMatch, trekGal, trekOrbitAU, trekWhere, trekApprox } from '../src/data/trek.js';
import { SITES, SITE_KINDS } from '../src/data/sites.js';
import { solSystem } from '../src/data/systems.js';
import { LY_PER_PC } from '../src/astro/frames.js';

const VIEWS = new Set(['navigation', 'quadrant', 'galaxy', 'system']);
const solBodies = new Set(solSystem().bodies.map((b) => b.id));

test('every Star Trek entry is well formed: id, kind, view, confidence, source, own summary, Memory Alpha link', () => {
  const seen = new Set();
  for (const t of TREK) {
    assert.ok(/^[a-z0-9-]+$/.test(t.id), `${t.id}: id`);
    assert.ok(!seen.has(t.id), `duplicate ${t.id}`); seen.add(t.id);
    assert.ok(t.name, `${t.id}: name`);
    assert.ok(TREK_KINDS[t.kind], `${t.id}: kind ${t.kind}`);
    assert.ok(t.views.length && t.views.every((v) => VIEWS.has(v)), `${t.id}: views`);
    assert.ok(TREK_CONFIDENCE[t.confidence], `${t.id}: confidence ${t.confidence}`);
    assert.ok(t.source?.length > 20, `${t.id}: source`);
    assert.ok(t.summary?.length > 30, `${t.id}: summary`);
    assert.match(t.memoryAlpha, /^https:\/\/memory-alpha\.fandom\.com\//, `${t.id}: Memory Alpha link`);
    if (t.firstAppearance) {
      const f = t.firstAppearance;
      assert.ok(TREK_SERIES[f.series], `${t.id}: series ${f.series}`);
      assert.ok(f.year >= 1965 && f.year <= 2026, `${t.id}: year ${f.year}`);
    } else assert.ok(t.appearanceNote, `${t.id}: no first appearance and no note saying so`);
  }
});

test('every placement is valid, and approximate places say so', () => {
  for (const t of TREK) {
    const p = t.placement;
    switch (p.type) {
      case 'star':
        assert.ok(p.star && (p.hyg === 'sol' || /^hyg-\d+$/.test(p.hyg)), `${t.id}: real star named with its HYG id`);
        assert.ok(p.hyg === 'sol' || p.hip || p.gl, `${t.id}: HIP or Gliese designation`);
        assert.ok(p.raDeg >= 0 && p.raDeg < 360 && Math.abs(p.decDeg) <= 90 && p.distLy >= 0, `${t.id}: position`);
        break;
      case 'gal':
        assert.ok(p.l >= 0 && p.l < 360 && Math.abs(p.b) <= 90 && p.distLy >= 0, `${t.id}: galactic position`);
        assert.ok(trekApprox(t), `${t.id}: a galactic-coordinate place is approximate`);
        break;
      case 'arc': assert.ok(p.l[0] < p.l[1] && p.distLy > 0, `${t.id}: arc`); break;
      case 'path': assert.ok(p.points.length >= 2 && p.points.every(([l, b, d]) => l >= 0 && l < 360 && Math.abs(b) <= 90 && d >= 0), `${t.id}: path`); break;
      case 'surface':
        assert.ok(solBodies.has(p.body) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180, `${t.id}: surface`);
        break;
      case 'orbit': assert.ok(solBodies.has(p.body) && p.altKm > 0, `${t.id}: orbit`); break;
      case 'quadrants': break;
      default: assert.fail(`${t.id}: unknown placement ${p.type}`);
    }
    if (t.confidence === 'fan') assert.ok(trekApprox(t), `${t.id}: fan placements are flagged approximate`);
    assert.ok(trekWhere(t).length > 2, `${t.id}: where`);
  }
});

test('homeworlds at real stars: Vulcan at 40 Eridani A, Andoria at Epsilon Indi, Tellar at 61 Cygni A (Star Charts)', () => {
  const at = (id) => TREK.find((t) => t.id === id).placement;
  assert.equal(at('vulcan').hip, 19849); assert.equal(at('vulcan').hyg, 'hyg-19799');
  assert.equal(at('andoria').hip, 108870);
  assert.equal(at('tellar').hip, 104214);
  assert.equal(at('wolf-359').gl, 'Gl 406');
  assert.deepEqual(trekAtStar('hyg-19799').map((t) => t.id), ['vulcan']);
  assert.deepEqual(trekAtStar('sol'), []); // Sol already says SECTOR 001
  // matched by catalogue id, or by name when ids differ; never the companion that shares a Flamsteed name
  assert.deepEqual(trekStarMatch({ id: 'hyg-103879', name: '61 Cyg' }).map((t) => t.id), ['tellar']);
  assert.deepEqual(trekStarMatch({ id: 'hyg-103883', name: '61 Cyg' }), []);
  assert.deepEqual(trekStarMatch({ id: 'gaia-x', name: 'Keid' }).map((t) => t.id), ['vulcan']);
  // the real stars' distances agree with their HYG parallaxes (pc × 3.26156)
  assert.ok(Math.abs(at('vulcan').distLy - 4.9845 * LY_PER_PC) < 0.02);
  assert.ok(Math.abs(at('rigel').distLy - 264.5503 * LY_PER_PC) < 0.5);
});

test('canon geometry: Alpha on the l 180–360° side of the core–Sol line, Beta on 0–180°; the core is 26,670 ly away', () => {
  const beta = ['qonos', 'romulus', 'klingon-empire', 'romulan-star-empire'], alpha = ['bajor', 'cardassia', 'ferenginar', 'cardassian-union'];
  for (const id of beta) { const l = TREK.find((t) => t.id === id).placement.l; assert.ok(l > 0 && l < 180, `${id} in Beta`); }
  for (const id of alpha) { const l = TREK.find((t) => t.id === id).placement.l; assert.ok(l > 180 && l < 360, `${id} in Alpha`); }
  const [x, y] = trekGal({ l: 0, b: 0, distLy: 26670 });
  assert.ok(Math.abs(x - 26670) < 1e-6 && Math.abs(y) < 1e-6);
  // Voyager started ~70,000 ly away, on the Delta side (beyond the core, Beta's side)
  const v = TREK.find((t) => t.id === 'voyager-route').placement.points;
  assert.equal(v[0][2], 70000); assert.deepEqual(v.at(-1), [0, 0, 0]);
  const [vx, vy] = trekGal({ l: v[0][0], b: 0, distLy: v[0][2] });
  assert.ok(vx > 26670 && vy > 0, 'Delta: beyond the core, l 0–90°');
});

test('every view draws something, and the System View gets stations and surface sites', () => {
  for (const v of VIEWS) assert.ok(trekFor(v).length >= 4, v);
  assert.ok(TREK.filter((t) => t.placement.type === 'orbit').length >= 4);
  assert.equal(trekOrbitAU(0.25), 0.5); assert.equal(trekOrbitAU(null), 1);
});

test('Star Trek sites join the sites layer as their own IMAGINED kind, never as a real site', () => {
  const trek = SITES.filter((s) => s.kind === 'trek');
  assert.ok(trek.length >= 4);
  assert.ok(SITE_KINDS.trek);
  for (const s of trek) {
    assert.equal(s.tier, 'imagined', s.id);
    assert.ok(s.id.startsWith('trek-') && TREK.some((t) => t.id === s.trekId), s.id);
  }
  assert.ok(SITES.filter((s) => s.kind !== 'trek').every((s) => s.tier !== 'imagined'), 'no real site is imagined');
});
