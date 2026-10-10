// Navigation deep time: stars that arrive (#29).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverageKms, needOuter, completeness, badgeLines, brightLimit, spanFor, classLine, INNER_LY, OUTER_LY } from '../src/views/navigation/drift.js';
import { applyGaia, densityProfile, mergeGaiaRv, completenessByClass, gaiaV, gaiaBV, MV_CLASSES } from '../server/stars.js';
import { parseHipMotions, parseRvSlice, tapCsv, RV_ADQL } from '../server/gaia.js';
import { spaceMotion } from '../src/astro/spacemotion.js';
import { integrateTrack, closestApproach } from '../src/astro/galpot.js';
import { eqToGal, LY_PER_PC } from '../src/astro/frames.js';

test('coverage: the loaded shell accounts for stars slower than (loaded − radius) / time', () => {
  assert.equal(coverageKms(1000, 100, 0), Infinity);
  // 900 ly in 3 Myr = 300 ly/Myr ≈ 90 km/s
  assert.ok(Math.abs(coverageKms(1000, 100, -3e6) - 89.9) < 0.2);
  assert.equal(needOuter(10, 1e5), false);
  assert.equal(needOuter(10, 1e6), true); // 240 ly in 1 Myr covers only ~72 km/s
  assert.equal(spanFor(4e6).spanMyr, 5);
  assert.equal(spanFor(-6e6).spanMyr, 50);
  assert.ok(INNER_LY < OUTER_LY);
});

test('completeness and the bright-star limit', () => {
  const rho = 3.5e-3; // HYG within 20 ly of Sol, stars per ly³
  assert.ok(Math.abs(completeness(14.66, 10, rho) - 1) < 0.01);
  assert.equal(completeness(5, 10, null), null);
  // Hipparcos complete to V ≈ 7.5: at 1,000 ly only stars brighter than M ≈ 0.1 are all there
  assert.ok(Math.abs(brightLimit(1000) - 0.07) < 0.05);
  assert.ok(brightLimit(250) > 3 && brightLimit(250) < 3.2);
});

test('badge: nothing now; in deep time counts, completeness, coverage and velocity sources', () => {
  assert.deepEqual(badgeLines({ epoch: 0 }), []);
  const base = { epoch: 2e7, radiusLy: 25, shown: 12, arrived: 9, departed: 40, gaia: 7, hyg: 5, loadedLy: 1000, density: { rho0PerLy3: 3.5e-3, halfLy: 60 } };
  const lines = badgeLines(base).map((l) => l.text);
  assert.match(lines[0], /12 STARS WITHIN 25 LY · 9 ARRIVED .* 40 LEFT/);
  assert.match(lines[1], /BRIGHT STARS ONLY BEYOND ~60 LY · CATALOGUE INCOMPLETE · ~5% /);
  assert.ok(lines.some((t) => /FASTER THAN 15 KM\/S ARRIVING FROM BEYOND 1,000 LY ARE NOT LOADED/.test(t)), lines.join('\n'));
  assert.match(lines.at(-1), /7 GAIA DR3 · 5 HYG/);
  // while loading, say so instead of looking empty
  assert.ok(badgeLines({ ...base, loading: 'LOADING ARRIVALS 250–1,000 LY…' }).some((l) => l.warn && /LOADING/.test(l.text)));
  // the preview only has its 100 ly snapshot
  assert.ok(badgeLines({ ...base, preview: true, previewLy: 100, loadedLy: 100 }).some((l) => /PREVIEW/.test(l.text)));
  // like for like, once there are enough bright stars to compare
  assert.ok(badgeLines({ ...base, like: { mag: 0.1, today: 20, now: 18 } }).some((l) => /20 TODAY · 18 NOW/.test(l.text)));
});

test('Gaia DR3 motions replace HYG where the parallax is good; catalogue RV kept when Gaia has none', () => {
  const csv = 'hip,ra,dec,parallax,parallax_error,pmra,pmdec,radial_velocity,radial_velocity_error\n'
    + '89825,274.96183629691126,-1.938612759804832,52.396292205290564,0.0171099,-0.4140637404226508,-0.10847507667730025,-14.419985,0.2563099\n'
    + '1,10,10,4,0.1,5,5,,\n'
    + '2,20,20,4,1.5,5,5,10,0.5\n'; // parallax/error < 10: ignored
  const rows = parseHipMotions(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][7], null);
  const stars = [
    { id: 'hyg-89547', hip: 89825, rvKnown: true, rv: -13.3 },
    { id: 'a', hip: 1, rvKnown: true, rv: 7 },
    { id: 'b', hip: 2, rvKnown: false, rv: null },
    { id: 'c', hip: null },
  ];
  assert.equal(applyGaia(stars, rows), 2);
  const g = stars[0].motion;
  assert.equal(g.vSrc, 1);
  assert.ok(g.rvKnown);
  const want = spaceMotion({ raDeg: 274.96183629691126, decDeg: -1.938612759804832, plxMas: 52.396292205290564, pmraMasYr: -0.4140637404226508, pmdecMasYr: -0.10847507667730025, rvKms: -14.419985 });
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(g.v[k] - want.vel[k]) < 0.01);
  assert.ok(Math.abs(Math.hypot(g.x, g.y, g.z) - 1000 / 52.3963) < 0.01);
  assert.equal(stars[1].motion.vSrc, 2); // Gaia astrometry + the catalogue's RV
  const r = stars[1].motion, d = [r.x, r.y, r.z], u = d.map((x) => x / Math.hypot(...d));
  assert.ok(Math.abs(r.v[0] * u[0] + r.v[1] * u[1] + r.v[2] * u[2] - 7) < 1e-6);
  assert.equal(stars[2].motion, undefined);
});

test('density profile finds where the catalogue thins out', () => {
  const stars = [];
  // uniform 3 per 1000 ly³ inside 50 ly, a tenth of that beyond
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40000; i++) {
    const r = 120 * Math.cbrt(rnd());
    if (r > 50 && rnd() > 0.1) continue;
    stars.push({ distPc: r / 3.26156 });
  }
  const p = densityProfile(stars);
  assert.equal(p.halfLy, 50);
  assert.ok(p.rho0PerLy3 > 0.004 && p.rho0PerLy3 < 0.007, String(p.rho0PerLy3));
});

// ---- the Gaia DR3 radial-velocity slice (#29) ---------------------------------------------------
// Gliese 710 as the RV slice returns it (gaiadr3.gaia_source, fetched 2026-10-10); BP−RP from DR3.
const GL710_ROW = '4270814637616488064,274.96183629691126,-1.938612759804832,52.396292205290564,-0.4140637404226508,-0.10847507667730025,-14.419985,9.063088,1.6448,0.2563099';
const RV_HEAD = 'source_id,ra,dec,parallax,pmra,pmdec,radial_velocity,phot_g_mean_mag,bp_rp,radial_velocity_error';

test('RV slice: rows parse with source_id kept exact (it exceeds 2^53) and incomplete rows dropped', () => {
  assert.match(RV_ADQL, /radial_velocity IS NOT NULL/);
  assert.match(RV_ADQL, /parallax > 10\b/);
  assert.match(RV_ADQL, /parallax_over_error > 10\b/);
  assert.match(RV_ADQL, /radial_velocity_error/);
  const rows = parseRvSlice(`${RV_HEAD}\n${GL710_ROW}\n12345678901,10,20,15.5,100,-50,12.3,13.1,,\n99,1,2,30,1,1,1,10,1,1\n123456789,1,2,30,1,1,,10,1,1\n`);
  assert.equal(rows.length, 2); // "99" is no source_id; the last has no RV
  assert.equal(rows[0][0], '4270814637616488064');
  assert.notEqual(String(Number(rows[0][0])), rows[0][0]); // as a number it would have been rounded
  assert.deepEqual(rows[0].slice(1, 10), [274.9618363, -1.9386128, 52.3963, -0.414, -0.108, -14.42, 9.063, 1.645, 0.26]);
  assert.equal(rows[1][8], null); // no BP−RP
  assert.equal(rows[1][9], null); // no RV error
  assert.throws(() => parseRvSlice('source_id,ra\n1,2'), /no dec column/);
  // column order is read from the header
  const swapped = parseRvSlice('ra,source_id,dec,parallax,pmra,pmdec,radial_velocity,phot_g_mean_mag\n10,1234567,20,15,1,1,5,12');
  assert.equal(swapped[0][0], '1234567');
  assert.equal(swapped[0][1], 10);
});

test('TAP: sync first; an async job (submit, poll, fetch) when sync fails', async () => {
  const calls = [];
  const res = (status, text, headers = {}) => ({ ok: status < 300, status, text: async () => text, headers: { get: (k) => headers[k] ?? null } });
  const syncOk = async (url) => { calls.push(url); return res(200, 'source_id,ra\n1,2'); };
  assert.deepEqual(await tapCsv('Q', { fetch: syncOk, header: 'source_id,', base: 'https://tap' }), { text: 'source_id,ra\n1,2', via: 'sync' });
  assert.deepEqual(calls, ['https://tap/sync']);
  calls.length = 0;
  let polls = 0;
  const viaJob = async (url, opts = {}) => {
    calls.push(`${opts.method ?? 'GET'} ${url}`);
    if (url.endsWith('/sync')) throw new Error('The operation was aborted due to timeout');
    if (url.endsWith('/async')) { assert.equal(opts.body.get('PHASE'), 'RUN'); assert.equal(opts.redirect, 'manual'); return res(303, '', { location: 'https://tap/async/job42' }); }
    if (url.endsWith('/phase')) return res(200, ++polls < 2 ? 'EXECUTING\n' : 'COMPLETED');
    if (url.endsWith('/results/result')) return res(200, 'source_id,ra\n7,8');
    throw new Error(url);
  };
  const out = await tapCsv('Q', { fetch: viaJob, header: 'source_id,', base: 'https://tap', pollMs: 1 });
  assert.deepEqual(out, { text: 'source_id,ra\n7,8', via: 'async' });
  assert.deepEqual(calls, ['POST https://tap/sync', 'POST https://tap/async', 'GET https://tap/async/job42/phase', 'GET https://tap/async/job42/phase', 'GET https://tap/async/job42/results/result']);
  // an error page instead of CSV, then a failed job: an error (the disk cache then serves a stale copy)
  const errJob = async (url) => (url.endsWith('/sync') ? res(200, '<VOTABLE>error') : url.endsWith('/async') ? res(303, '', { location: 'https://tap/async/j' }) : res(200, 'ERROR'));
  await assert.rejects(tapCsv('Q', { fetch: errJob, header: 'source_id,', base: 'https://tap', pollMs: 1 }), /async job ERROR/);
});

test('V and B−V from Gaia photometry', () => {
  assert.ok(Math.abs(gaiaV(9.063, 1.645) - 9.58) < 0.03); // Gliese 710: V = 9.65 in HYG
  assert.ok(Math.abs(gaiaV(10, 0.82) - 10.15) < 0.03); // a solar twin: V − G ≈ 0.15 (the Sun: −26.76 vs −26.90)
  assert.equal(gaiaBV(null), null);
  assert.ok(Math.abs(gaiaBV(0.82) - 0.61) < 0.05);
  assert.ok(gaiaBV(3) > 1.4 && gaiaBV(3) <= 2);
});

test('merge: Gaia RV rows already in the catalogue are dropped by position, parallax and magnitude; the rest are added', () => {
  const [gl] = parseRvSlice(`${RV_HEAD}\n${GL710_ROW}`);
  // the catalogue's Gliese 710, carrying Gaia astrometry from the Hipparcos cross-match
  const m = spaceMotion({ raDeg: gl[1], decDeg: gl[2], plxMas: gl[3], pmraMasYr: gl[4], pmdecMasYr: gl[5], rvKms: gl[6] });
  const gl710 = { id: 'hyg-89547', name: 'Gliese 710', hip: 89825, mag: 9.65, x: 1.69, y: -19.48, z: -0.66, distPc: 19.5, motion: { x: m.pos[0], y: m.pos[1], z: m.pos[2], v: m.vel, rvKnown: true, vSrc: 1 } };
  // a Gliese-only row: position 54″ out, distance 26.5 ly where Gaia says 31.1 ly (GJ 1123's case)
  const at = (ra, dec, ly) => { const d = ly / LY_PER_PC, a = ra * Math.PI / 180, b = dec * Math.PI / 180; return { x: d * Math.cos(b) * Math.cos(a), y: d * Math.cos(b) * Math.sin(a), z: d * Math.sin(b), distPc: d }; };
  const gj = { id: 'hyg-118621', name: 'GJ 1123', hip: null, mag: 13.1, ...at(150 + 54 / 3600, -20, 26.5) };
  // a Hipparcos star whose fainter companion only Gaia resolves (5″ away, 3 mag fainter)
  const hipA = { id: 'hyg-1', name: 'HIP 1', hip: 1, mag: 9, ...at(40, 10, 80) };
  const plx = (ly) => (1000 / (ly / LY_PER_PC)).toFixed(4);
  const csv = [RV_HEAD, GL710_ROW,
    `5203276810942065536,150,-20,${plx(31.1)},-300,200,20,13.0,2.4,1.1`, // GJ 1123 again: the same star (V ≈ 13.2)
    `1000000000000000001,${40 + 5 / 3600},10,${plx(80)},10,10,5,11.1,2.5,2.0`, // the companion (V ≈ 12.1)
    `1000000000000000002,200,30,${plx(150)},40,-20,-30,12.5,2.0,`, // a K/M dwarf nobody had (no RV error given)
    // Gaia DR3 5544743925212648320: −374 ± 8 km/s with almost no proper motion, likely spurious
    '5544743925212648320,120.5,-38.2,89.5064,-65.479,-29.204,-373.74,14.346,2.9,8.18',
  ].join('\n');
  const { added, matched, noisy } = mergeGaiaRv([gl710, gj, hipA, { id: 'sol', x: 0, y: 0, z: 0, distPc: 0 }], parseRvSlice(csv));
  assert.equal(matched, 2);
  assert.equal(noisy, 1);
  assert.deepEqual(added.map((s) => s.id), ['gdr3-1000000000000000001', 'gdr3-1000000000000000002']);
  const s = added[1];
  assert.equal(s.name, 'Gaia DR3 1000000000000000002');
  assert.equal(s.motion.vSrc, 3);
  assert.ok(s.motion.rvKnown);
  const want = spaceMotion({ raDeg: 200, decDeg: 30, plxMas: +plx(150), pmraMasYr: 40, pmdecMasYr: -20, rvKms: -30 });
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(s.motion.v[k] - want.vel[k]) < 1e-9);
  assert.ok(Math.abs(s.distPc * LY_PER_PC - 150) < 0.01);
  assert.ok(Math.abs(s.absmag - (s.mag - 5 * Math.log10(s.distPc / 10))) < 0.01);
  // a magnitude mismatch alone keeps a star apart; with no catalogue magnitude, position + parallax decide
  assert.equal(mergeGaiaRv([{ ...gl710, mag: 12 }], parseRvSlice(`${RV_HEAD}\n${GL710_ROW}`)).matched, 0);
  assert.equal(mergeGaiaRv([{ ...gl710, mag: null }], parseRvSlice(`${RV_HEAD}\n${GL710_ROW}`)).matched, 1);
});

test('Gliese 710 is not doubled by the RV slice, and its +1.29 Myr pass is the same from the slice row', () => {
  const rows = parseRvSlice(`${RV_HEAD}\n${GL710_ROW}`);
  // with no catalogue to match, the slice builds it from the same Gaia DR3 numbers as the cross-match
  const [s] = mergeGaiaRv([], rows).added;
  const sun = integrateTrack([0, 0, 0], [0, 0, 0], { spanMyr: 5 });
  const star = integrateTrack(eqToGal([s.x, s.y, s.z].map((x) => x * LY_PER_PC)), eqToGal(s.motion.v), { spanMyr: 5 });
  const { tYears, dMinLy } = closestApproach(star, sun, 5e6);
  assert.ok(Math.abs(tYears - 1.29e6) < 0.04e6, `t = ${tYears}`);
  assert.ok(dMinLy / LY_PER_PC > 0.03 && dMinLy / LY_PER_PC < 0.08, `d = ${dMinLy / LY_PER_PC} pc`);
});

test('completeness by class: where each absolute-magnitude class thins out', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const list = [];
  // G dwarfs (M_V 4.8) everywhere out to 600 ly; K dwarfs (M_V 7) only to 120 ly, then a tenth
  for (let i = 0; i < 60000; i++) { const d = 600 * Math.cbrt(rnd()); if (rnd() < 0.15) list.push({ d, M: 4.8 }); }
  for (let i = 0; i < 60000; i++) { const d = 600 * Math.cbrt(rnd()); if (d < 120 || rnd() < 0.1) list.push({ d, M: 7 }); }
  const c = Object.fromEntries(completenessByClass(list, 600).map((x) => [x.label, x]));
  assert.equal(c.G.completeLy, null); // complete out to maxLy
  assert.ok(c.K.completeLy >= 110 && c.K.completeLy <= 130, String(c.K.completeLy));
  assert.equal(c['M4+'].refLy, null); // none at all
  assert.equal(MV_CLASSES.length, 6);
  assert.equal(classLine([{ label: 'G', hygLy: 220, mergedLy: 325 }, { label: 'F', hygLy: 390, mergedLy: 390 }, { label: 'A', hygLy: null, mergedLy: null }]), 'G 220→325 · F 390 · A ≥1,000');
});

test('badge with the Gaia RV slice: per-class completeness, both half-density radii and stars per source', () => {
  const base = { epoch: 2e7, radiusLy: 25, shown: 30, arrived: 20, departed: 40, gaia: 7, gaiaOnly: 18, hyg: 5, loadedLy: 1000, density: { rho0PerLy3: 3.5e-3, halfLy: 40 } };
  const info = { gaiaLy: 326, density: { rho0PerLy3: 3.5e-3, halfLy: 80 }, classes: [{ label: 'K', hygLy: 120, mergedLy: 325 }, { label: 'M4+', hygLy: 35, mergedLy: 45 }] };
  const lines = badgeLines({ ...base, completeness: info, gaiaRv: { status: 'ok' } }).map((l) => l.text);
  assert.ok(lines.some((t) => /DENSITY HALVES BEYOND ~80 LY \(HYG ALONE ~40\)/.test(t)), lines.join('\n'));
  assert.ok(lines.some((t) => /HALF-COMPLETE TO, LY .*326 LY\): K 120→325 · M4\+ 35→45/.test(t)), lines.join('\n'));
  assert.match(lines.at(-1), /7 GAIA DR3 \(HIPPARCOS STARS\) · 18 GAIA DR3 RV-ONLY · 5 HYG/);
  // loading and failure say so
  assert.ok(badgeLines({ ...base, gaiaRv: { status: 'loading' } }).some((l) => l.warn && /LOADING GAIA DR3/.test(l.text)));
  assert.ok(badgeLines({ ...base, gaiaRv: { status: 'error', error: 'HTTP 503' } }).some((l) => l.warn && /UNAVAILABLE \(HTTP 503\) · HYG ONLY/.test(l.text)));
});
