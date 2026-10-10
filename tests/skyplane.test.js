import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyBasis, physicalSize, planeOffset, radecVec, teffFromBpRp, memberDistance, hashNormal, ARCMIN } from '../src/astro/skyplane.js';
import { NEBULA_3D, CLUSTER_NEBULOSITY, NEBULA_STARS } from '../src/data/nebula3d.js';
import { NEBULAE } from '../src/data/deepsky.js';
import { parseTsv, compactMembers } from '../server/deepsky.js';
import { NEBULA_IMAGES } from '../server/nebulae.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg ?? ''} ${a} vs ${b}`);
const sepDeg = (ra1, d1, ra2, d2) => (Math.acos(Math.min(1, dot(radecVec(ra1, d1), radecVec(ra2, d2)))) * 180) / Math.PI;

test('billboard orientation: a north-up image points at the north celestial pole, faces Sol, east to the left', () => {
  for (const [ra, dec] of [[83.82, -5.39], [283.4, 33.03], [161.26, -59.87], [6.3, 64.1], [0, 0], [200, -80]]) {
    const b = skyBasis(ra, dec, 0);
    // the NCP direction projected onto the sky plane at this position
    const ncp = [0, 0, 1], r = b.r, t = dot(ncp, r);
    const p = [ncp[0] - t * r[0], ncp[1] - t * r[1], ncp[2] - t * r[2]], n = Math.hypot(...p);
    near(dot(b.up, p) / n, 1, 1e-12, 'up → NCP');
    near(dot(b.right, b.east), -1, 1e-12, 'right = west');
    const f = cross(b.right, b.up);
    for (let i = 0; i < 3; i++) near(f[i], -r[i], 1e-12, 'normal faces Sol');
    // a point 1′ north of the centre sits 1′ up the image
    const [x, y] = planeOffset(b, ra, dec + 1 / 60);
    near(x, 0, 1e-6); near(y, 1, 1e-4);
  }
});

test('billboard orientation: "north is θ left of vertical" rotates the image counter-clockwise', () => {
  const b0 = skyBasis(83.8, -5.4, 0), b90 = skyBasis(83.8, -5.4, 90), b180 = skyBasis(83.8, -5.4, -180);
  for (let i = 0; i < 3; i++) {
    near(b90.up[i], -b0.east[i], 1e-12, 'north left ⇒ up is west');
    near(b90.right[i], -b0.north[i], 1e-12, '…and right is south');
    near(b180.up[i], -b0.north[i], 1e-12, 'north down ⇒ up is south');
  }
  // a star 1′ north appears 1′ to the left of centre when north is 90° left
  const [x, y] = planeOffset(b90, 83.8, -5.4 + 1 / 60);
  near(x, -1, 1e-4); near(y, 0, 1e-6);
});

test('physical size = angular size × distance', () => {
  near(physicalSize(30.03, 1344), 30.03 * ARCMIN * 1344, 1e-3, 'small angle');
  near(physicalSize(30.03, 1344), 11.74, 0.01, 'the Hubble Orion mosaic spans ~11.7 ly');
  near(physicalSize(60, 1000), 2 * 1000 * Math.tan(0.5 * Math.PI / 180), 1e-9);
});

test('Gaia BP−RP colour → temperature (Mucciarelli & Bellazzini 2020)', () => {
  near(teffFromBpRp(0.82), 5780, 120, 'the Sun');
  assert.ok(teffFromBpRp(-0.2) > 12000 && teffFromBpRp(2.5) < 3600);
  assert.ok(teffFromBpRp(5) === teffFromBpRp(3.5)); // clamped
});

test('cluster member depth: precise parallaxes are used, poor ones modelled within the cluster', () => {
  // a Hyades-like member: 47 pc cluster, r50 3 pc, parallax 20 ± 0.02 mas (50 pc)
  const a = memberDistance(47, 3, 20, 0.02, '123');
  assert.ok(a.measured); near(a.pc, 50, 0.2);
  // a distant cluster member with a useless parallax
  const b = memberDistance(2000, 2, 0.4, 0.1, '456');
  assert.ok(!b.measured); assert.ok(Math.abs(b.pc - 2000) < 10, String(b.pc));
  // reproducible
  assert.equal(memberDistance(2000, 2, 0.4, 0.1, '456').pc, b.pc);
  // the scatter is a standard normal
  const xs = Array.from({ length: 4000 }, (_, i) => hashNormal(`g${i}`));
  const m = xs.reduce((s, x) => s + x, 0) / xs.length, v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  near(m, 0, 0.06); near(v, 1, 0.08);
});

test('member catalogue parsing: VizieR TSV → compact rows, brightest first, ids kept as strings', () => {
  const tsv = [
    '#RESOURCE=yCat_36730114', '#Name: J/A+A/673/A114/members',
    'GaiaDR3\tRA_ICRS\tDE_ICRS\tPlx\te_Plx\tGmag\tBP-RP\tProb\tinrt',
    ' \tdeg\tdeg\tmas\tmas\tmag\tmag\t ',
    '----\t----\t----\t----\t----\t----\t----\t----',
    '  65283232316451328\t 56.45679586433\t+24.36754142472\t 7.67130996150288791e+00\t 0.310423400000000016\t 3.8633489999999999\t-1.37681960000000016e-02\t 0.748793602143097092\tTrue ',
    '  66526127137440128\t 57.29068893294\t+24.05321183000\t 8.11844844579972147e+00\t 0.479091229999999979\t 3.6157946999999999\t-3.63762379999999982e-02\t 0.383635308495666183\tFalse',
    '  66526127137440129\t \t+24.05321183000\t \t \t 9.1\t \t 0.5\tTrue',
    '',
  ].join('\n');
  const rows = compactMembers(parseTsv(tsv));
  assert.equal(rows.length, 2); // the row without a position is dropped
  assert.deepEqual(rows[0], [57.29069, 24.05321, 8.1184, 0.4791, 3.62, -0.036, 0.38, '66526127137440128', 0]);
  assert.equal(rows[1][7], '65283232316451328'); assert.equal(rows[1][8], 1);
  assert.ok(rows[0][4] <= rows[1][4]);
  assert.equal(compactMembers(parseTsv(tsv), 1).length, 1);
});

test('nebula imagery: every landmark has a credited, licensed, allowlisted image that covers it', () => {
  const hosts = new Set(['cdn.esahubble.org', 'cdn.esawebb.org', 'cdn.eso.org', 'chandra.harvard.edu', 'alasky.cds.unistra.fr']);
  for (const [name, , ra, dec] of NEBULAE) {
    const e = NEBULA_3D[name];
    assert.ok(e, `${name} has an image`);
    const { img, model } = e;
    assert.ok(hosts.has(new URL(img.url).host), img.url);
    assert.ok(img.credit && img.licence && img.page && img.what, name);
    assert.ok(img.fov[0] > 0 && img.fov[1] > 0 && img.fov[0] <= 840, name);
    assert.ok(Math.abs(img.north) <= 180, name);
    assert.ok(img.survey || /^\d{4}-\d\d-\d\d$/.test(img.date), `${name} dated`);
    assert.ok(['blister', 'cloud', 'shell', 'filled', 'barrel'].includes(model.kind) && model.R > 0 && model.depth > 0 && model.ref, name);
    // the nebula (and its model centre) lie inside the image
    assert.ok(sepDeg(ra, dec, img.ra, img.dec) * 60 < Math.max(...img.fov) / 2, `${name} inside its image`);
    if (model.centre) assert.ok(sepDeg(...model.centre, img.ra, img.dec) * 60 < Math.min(...img.fov) / 2, `${name} model centre`);
  }
  for (const v of Object.values(CLUSTER_NEBULOSITY)) assert.ok(NEBULA_IMAGES[v.img.key]);
  assert.equal(Object.keys(NEBULA_IMAGES).length, Object.keys(NEBULA_3D).length + Object.keys(CLUSTER_NEBULOSITY).length, 'image keys are unique');
  for (const [name, neb, ra, dec] of NEBULA_STARS) {
    const e = NEBULA_3D[neb];
    assert.ok(e, `${name}: ${neb}`);
    assert.ok(sepDeg(ra, dec, e.img.ra, e.img.dec) * 60 < Math.max(...e.img.fov) / 2 * 1.05, `${name} inside ${neb}`);
  }
});
