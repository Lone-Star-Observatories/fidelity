import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrb6Line, componentLetters } from '../server/binaries.js';
import { separationPA, relativeSky, hierarchy, place, besselianYear } from '../src/astro/binary.js';

// Sirius AB as published by Bond et al. 2017 (ORB6 line, fixed columns).
const SIRIUS = '064508.92-164258.0 06451-1643 AGC   1AB       5423  48915  32349  -1.47   8.44     50.1284  y   0.0043     7.4957 a  0.0025  136.336    0.040   45.400     0.071   1994.5715  y   0.0058   0.59142  0.00037  149.161    0.075  2000 2016 2 n BdH2017  wds06451-1643a.png';

test('ORB6 line parses with units', () => {
  const o = parseOrb6Line(SIRIUS);
  assert.equal(o.wds, '06451-1643');
  assert.deepEqual(componentLetters(o.components), ['A', 'B']);
  assert.equal(o.hip, 32349);
  assert.equal(o.periodYears, 50.1284);
  assert.equal(o.aArcsec, 7.4957);
  assert.equal(o.grade, 2);
});

test('Sirius B position matches published ephemeris', () => {
  const o = parseOrb6Line(SIRIUS);
  // Bond et al. 2017 orbit: at periastron (1994.57) Sirius B is ~3.1″ away; near 2019.5 apastron ~11.3″.
  // true (3D) separation at periastron is a(1 − e); the projected one is smaller
  const peri = Math.hypot(...relativeSky(o, o.periastronYear));
  assert.ok(Math.abs(peri - o.aArcsec * (1 - o.e)) < 1e-9, `r at periastron ${peri}`);
  assert.ok(separationPA(o, o.periastronYear).rho <= peri);
  // The orbit is inclined, so projected separation at apastron is below a(1+e); it must still exceed 10″.
  const apo = separationPA(o, o.periastronYear + o.periodYears / 2).rho;
  assert.ok(apo > 10 && apo <= o.aArcsec * (1 + o.e) + 1e-9, `rho at apastron ${apo}`);
  // 2020.0: published PA ≈ 69°, separation ≈ 11.2″ (WDS/ORB6 ephemeris)
  const now = separationPA(o, 2020.0);
  assert.ok(Math.abs(now.rho - 11.2) < 0.4, `rho 2020 ${now.rho}`);
  assert.ok(Math.abs(now.theta - 69) < 5, `PA 2020 ${now.theta}`);
});

test('hierarchy: inner pair first, barycentre at origin', () => {
  const orbits = [
    { id: 'AC', primary: 'A', secondary: 'C', periodYears: 547000 },
    { id: 'AB', primary: 'A', secondary: 'B', periodYears: 79.8 },
  ];
  const roots = hierarchy(orbits, { A: 1.0788, B: 0.9092, C: 0.1221 });
  assert.equal(roots.length, 1);
  assert.equal(roots[0].orbit.id, 'AC');
  const rel = (o) => (o.id === 'AB' ? [20, 0, 0] : [0, 8700, 0]);
  const { leaves } = place(roots, 0, rel);
  const m = { A: 1.0788, B: 0.9092, C: 0.1221 };
  const com = [0, 1, 2].map((k) => Object.keys(m).reduce((s, id) => s + m[id] * leaves[id][k], 0));
  for (const v of com) assert.ok(Math.abs(v) < 1e-9);
  assert.ok(Math.abs(leaves.B[0] - leaves.A[0] - 20) < 1e-9); // B is 20 AU from A
});

test('Besselian year at J2000 is 2000.0013', () => {
  assert.ok(Math.abs(besselianYear(2451545.0) - 2000.0013) < 1e-4);
});

// ---- catalogue matching and the multi-star model -------------------------------------------
import { matchBinaries, buildGroups } from '../server/stars.js';
import { MEASURED } from '../server/binaries.js';
import { buildStarSystem } from '../src/data/systems.js';

const siriusA = { id: 'hyg-32263', name: 'Sirius', hip: 32349, x: -0.494, y: 2.477, z: -0.758, distPc: 2.6371, mag: -1.44, absmag: 1.45, spect: 'A0m', ci: 0, lum: 22.8, compPrimary: null, source: 'HYG v4' };
const siriusB = { id: 'hyg-118441', name: 'Gliese 244B', hip: null, x: -0.494, y: 2.477, z: -0.758, distPc: 2.6371, mag: 8.44, absmag: 11.33, spect: 'DA2', ci: 0, lum: 0.0026, compPrimary: 'hyg-32263', source: 'HYG v4' };

test('matchBinaries pairs Sirius A with its HYG companion and names it', () => {
  const stars = [siriusA, { ...siriusB }];
  const { edges, extra } = matchBinaries(stars, [parseOrb6Line(SIRIUS)]);
  assert.equal(edges.length, 1);
  assert.equal(extra.length, 0);
  assert.equal(edges[0].secondaryId, 'hyg-118441');
  assert.equal(stars[1].name, 'Sirius B');
  assert.equal(edges[0].measured, MEASURED['06451-1643']);
  const g = buildGroups(stars, edges);
  assert.equal(g.get('hyg-32263'), g.get('hyg-118441'));
});

test('a missing secondary is added from the orbit catalogue', () => {
  const { edges, extra } = matchBinaries([siriusA], [parseOrb6Line(SIRIUS)]);
  assert.equal(extra.length, 1);
  assert.equal(edges[0].secondaryId, 'hyg-32263-b');
});

test('multi-star model: measured masses, white dwarf, barycentric orbit facts', () => {
  const stars = [siriusA, { ...siriusB }];
  const { edges } = matchBinaries(stars, [parseOrb6Line(SIRIUS)]);
  const star = (s) => ({ ...s, distLy: s.distPc * 3.26156 });
  const detail = {
    star: star(siriusA), host: null, planets: [],
    group: {
      members: stars.map((s) => ({ star: star(s), host: null, planets: [] })),
      orbits: edges.map((e) => ({ ...e.orbit, primaryId: e.primaryId, secondaryId: e.secondaryId, letters: e.letters, measured: e.measured })),
    },
  };
  const m = buildStarSystem(detail);
  assert.equal(m.multiplicity, 2);
  const b = m.bodies.find((x) => x.id === 'hyg-118441');
  assert.equal(b.kind, 'white dwarf');
  assert.equal(b.massSun, 1.018);
  assert.equal(b.facts.PHYSICAL.find((f) => f.label === 'MASS').tier, 'measured');
  const dyn = b.facts.ORBIT.find((f) => f.label === 'DYNAMICAL MASS');
  assert.match(dyn.value, /^3\.0\d/); // a³/P² ≈ 3.07 M☉ (Bond et al.: 2.063 + 1.018)
  assert.equal(m.binary.orbits.length, 1);
  assert.ok(m.survey.some((s) => s.label === 'A–B ORBIT'));
});
