import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCsvLine, parseHyg, starName, matchHosts } from '../server/stars.js';

const HEAD = '"id","hip","hd","hr","gl","bf","proper","ra","dec","dist","pmra","pmdec","rv","mag","absmag","spect","ci","x","y","z","vx","vy","vz","rarad","decrad","pmrarad","pmdecrad","bayer","flam","con","comp","comp_primary","base","lum","var","var_min","var_max"';
const ROWS = [
  '0,,,,"","",Sol,0.0,0.0,0.0,0.0,0.0,0.0,-26.7,4.85,G2V,0.656,0.000005,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,"","","",1,0,"",1.0,"",,',
  '70666,70890,,,"Gl 551","",Proxima Centauri,14.495985,-62.679485,1.3012,0,0,0,11.01,15.45,M5Ve,1.807,-0.474486,-0.362641,-1.15606,0,0,0,0,0,0,0,"","",Cen,1,70666,"",0.0001,"",,',
  '8087,8102,10700,509,"Gl 71","52Tau Cet","",1.734,-15.937,3.6502,0,0,0,3.49,5.68,G8V,0.727,3.15441,1.53919,-1.002273,0,0,0,0,0,0,0,Tau,52,Cet,1,8087,"",0.46,"",,',
  '99,,,,"","","",1,1,100000,0,0,0,9,1,K,1,0,0,0,0,0,0,0,0,0,0,"","","",1,99,"",1,"",,',
];

test('CSV splitter handles quotes and doubled quotes', () => {
  assert.deepEqual(splitCsvLine('a,"b,c","d ""e""",'), ['a', 'b,c', 'd "e"', '']);
});

test('parseHyg keeps stars with known distances and names them', () => {
  const stars = parseHyg([HEAD, ...ROWS].join('\n'));
  assert.deepEqual(stars.map((s) => s.id), ['sol', 'hyg-70666', 'hyg-8087']); // 100000 pc = unknown, dropped
  assert.equal(stars[1].name, 'Proxima Centauri');
  assert.equal(stars[2].name, 'τ Cet');
  assert.equal(stars[2].hip, 8102);
});

test('starName falls back through designations', () => {
  assert.equal(starName({ gl: 'Gl 876' }), 'Gliese 876');
  assert.equal(starName({ hip: '123' }), 'HIP 123');
  assert.equal(starName({ id: '7' }), 'HYG 7');
});

test('matchHosts: HIP number, then position, else an archive-only star', () => {
  const stars = parseHyg([HEAD, ...ROWS].join('\n'));
  const rows = [
    { hostname: 'Proxima Cen', hip_name: 'HIP 70890', ra: 217.39, dec: -62.68, sy_dist: 1.30, pl_name: 'Proxima Cen b' },
    { hostname: 'tau Cet', hip_name: null, hd_name: null, ra: 26.01, dec: -15.93, sy_dist: 3.60, pl_name: 'tau Cet g' },
    { hostname: 'TRAPPIST-1', hip_name: null, ra: 346.626, dec: -5.043, sy_dist: 12.43, st_spectype: 'M8.0 V', pl_name: 'TRAPPIST-1 b' },
    { hostname: 'TRAPPIST-1', hip_name: null, ra: 346.626, dec: -5.043, sy_dist: 12.43, pl_name: 'TRAPPIST-1 c' },
  ];
  const { planetsOf, extra } = matchHosts(stars, rows);
  assert.equal(planetsOf.get('hyg-70666').planets.length, 1);
  assert.equal(planetsOf.get('hyg-8087').host.hostname, 'tau Cet'); // matched by position + distance
  assert.equal(extra.length, 1);
  assert.equal(extra[0].id, 'exo-trappist-1');
  assert.equal(planetsOf.get('exo-trappist-1').planets.length, 2);
  assert.ok(Math.abs(Math.hypot(extra[0].x, extra[0].y, extra[0].z) - 12.43) < 1e-9);
});

test('brown dwarfs without a HIP number are joined to their ORB6 orbit by position', async () => {
  const { NEIGHBOURS } = await import('../server/neighbours.js');
  const { matchBinaries } = await import('../server/stars.js');
  const stars = NEIGHBOURS.map((n) => ({ ...n }));
  const orbit = { wds: '10493-5319', designation: 'LUH  16', components: '', hip: null, v2: 15.9,
    raDeg: 162.3284, decDeg: -53.3184, periodYears: 26.55, aArcsec: 1.764, i: 79.92, node: 130.02, periastronYear: 2018.06, e: 0.344, omega: 136.67 };
  const { edges } = matchBinaries(stars, [orbit]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].primaryId, 'bd-luhman-16a');
  assert.equal(edges[0].secondaryId, 'bd-luhman-16b');
  // 501.557 mas → 6.50 ly, the third-nearest system to the Sun
  assert.ok(Math.abs(stars[0].distPc * 3.26156 - 6.503) < 0.01);
});
