// The 3D corona (#79): physics per band, orientation maths, the measured structure and its parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gamma, baumbach, kEmissivity, fEmissivity, losIntegral, falloffIndex, scaleHeight, euvEmissivity, radioRadius, radioAbsorption,
  electronDensity, coronaLook, cycleActivity, imageToDir, paToDir, beltNormal, imageAxes, modelledStructure, resolveStructure,
  structureFromFeed, coronaLayers, AIA_RGB,
} from '../src/data/corona.js';
import { paProfile, findStreamers, beltFromStreamers, discPatches, coronaFeed } from '../server/corona.js';
import { encodePng } from '../server/png.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);
const jdOf = (y) => 2451545 + (y - 2000) * 365.25;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('Γ: Lanczos matches known values', () => {
  close(gamma(0.5), Math.sqrt(Math.PI), 1e-12); close(gamma(5), 24, 1e-9); close(gamma(3.5), 3.32335097, 1e-7);
});

test('white light: the ray-marched emissivity reproduces Baumbach (1937) along every line of sight', () => {
  for (const b of [1.05, 1.2, 1.5, 2, 3, 5]) {
    const los = losIntegral(kEmissivity, b) + losIntegral(fEmissivity, b, { rMax: 2000, n: 20000 });
    close(los / baumbach(b), 1, 0.005, `b = ${b}`);
  }
  // K corona brightness falls as r^-3 … r^-6 between 1.5 and 3 R☉ (here ≈ r^-4.7), the dust term flattens it further out
  const n = falloffIndex(baumbach, 1.5, 3);
  assert.ok(n > 3 && n < 6, `falloff index ${n}`);
  assert.ok(falloffIndex(baumbach, 5, 10) < 3, 'F corona: shallower far out');
  close(baumbach(1.5) * 1e-6, 1.05e-7, 0.01e-7, 'about 10⁻⁷ of the disc at 1.5 R☉');
  close(electronDensity(1), 4.576e8, 1e5, 'Baumbach–Allen base density');
});

test('EUV: hydrostatic scale height ≈ 0.072 R☉ per MK; the EUV corona hugs the Sun far more than white light', () => {
  close(scaleHeight(1), 0.0722, 0.0005);
  close(scaleHeight(1.6) / scaleHeight(0.63), 1.6 / 0.63, 1e-9, 'H ∝ T');
  const H = scaleHeight(1.6), euv = (b) => losIntegral((r) => euvEmissivity(r, H), b, { rMax: 6 });
  assert.ok(falloffIndex(euv, 1.2, 2) > 1.5 * falloffIndex(baumbach, 1.2, 2), 'steeper than the K corona');
  close(euvEmissivity(1, H), 1, 1e-12);
});

test('radio: the corona is the radio Sun, larger at lower frequency, opaque inside its radius', () => {
  close(radioRadius(0.408), 1.2458, 1e-3); close(radioRadius(17), 1.012, 2e-3);
  assert.ok(radioRadius(0.15) > radioRadius(1.4));
  const rT = 1.25, k = radioAbsorption(rT), n0 = electronDensity(1);
  let tau = 0; // radial optical depth from rT outwards is 1 by construction
  for (let r = rT; r < 30; r += 0.0002) tau += k * (electronDensity(r + 0.0001) / n0) ** 2 * 0.0002;
  close(tau, 1, 0.01);
});

test('the look per band: what dominates, how bright next to the disc, and honest exaggeration', () => {
  const B = (id, palette) => ({ id, palette });
  const white = coronaLook(B('full'), null);
  assert.equal(white.kind, 'white');
  assert.ok(white.exaggeration > 1e5, 'white light must be brightened enormously');
  assert.ok(white.weights.k > 0 && white.weights.f > 0 && !white.weights.euv);
  const e171 = coronaLook(B('xray', 'xray'), null, { effNm: 17.1 });
  assert.equal(e171.kind, 'euv'); assert.equal(e171.exaggeration, 1); assert.deepEqual(e171.rgb, AIA_RGB[171]);
  assert.ok(e171.weights.loops > 0 && e171.extent < 3, 'hot loops, close in');
  assert.ok(coronaLook(B('xray', 'xray'), null, { effNm: 21.1 }).H > e171.H, '211 Å (2 MK) is puffier than 171 Å');
  const radio = coronaLook(B('radio', 'radio'), null, { effNm: 299792458 / 0.408e9 * 1e9 });
  assert.equal(radio.kind, 'radio'); assert.equal(radio.exaggeration, 1); close(radio.rTau, 1.2458, 1e-3);
  assert.ok(radio.extent > 2);
  const ir = coronaLook(B('ir', 'infrared'), null, { effNm: 12000 });
  assert.equal(ir.kind, 'dust'); assert.ok(ir.weights.f > ir.weights.k * 10, 'the dust F corona dominates the thermal IR');
  assert.equal(coronaLook(B('ir', 'infrared'), null, { effNm: 1250 }).kind, 'white');
  assert.equal(coronaLook(B('uv', 'ultraviolet'), null, { effNm: 121.6 }).kind, 'lya');
  assert.equal(coronaLook(B('gamma', 'gamma'), null, { effNm: 1e-4 }).kind, 'none');
  const mw = coronaLook(B('microwave', 'microwave'), null, { effNm: 1.76e7 });
  assert.equal(mw.kind, 'microwave'); assert.equal(mw.gyro, 1, 'gyro-resonance over active regions at 17 GHz');
});

test('solar cycle: minimum Dec 2019, maximum late 2024, declining in 2026', () => {
  close(cycleActivity(jdOf(2019.96)), 0, 1e-6);
  close(cycleActivity(jdOf(2024.81)), 1, 1e-3);
  const a = cycleActivity(jdOf(2026.78));
  assert.ok(a > 0.4 && a < 0.95, `${a}`);
  assert.ok(cycleActivity(jdOf(2030.0)) < a);
});

test('orientation: disc-image and sky coordinates land where the star shader projects the disc image', () => {
  const E = [0.3, 0.1, Math.sqrt(1 - 0.09 - 0.01)], N = [0, 1, 0], { up, right } = imageAxes(E, N);
  close(dot(up, E), 0, 1e-12); close(dot(right, E), 0, 1e-12); close(dot(right, up), 0, 1e-12);
  imageToDir(0, 0, E, N).forEach((v, i) => close(v, E[i], 1e-12, 'disc centre faces the observer'));
  const w = imageToDir(0.5, 0, E, N);
  close(dot(w, right), 0.5, 1e-12); close(dot(w, E), Math.sqrt(0.75), 1e-12);
  // position angles: 0 north, 90 east (image left), 270 west, all on the limb
  paToDir(0, E, N).forEach((v, i) => close(v, up[i], 1e-12));
  paToDir(90, E, N).forEach((v, i) => close(v, -right[i], 1e-12));
  paToDir(270, E, N).forEach((v, i) => close(v, right[i], 1e-12));
  // the shader's own mapping (materials.js): uv = 0.5 + (N·right, N·up) · diskR
  const d = imageToDir(-0.4, 0.3, E, N);
  close(dot(d, right), -0.4, 1e-12); close(dot(d, up), 0.3, 1e-12);
});

test('the streamer belt passes through the measured limb latitudes', () => {
  const E = [0, 0, 1], N = [0, 1, 0];
  const b = beltNormal(-20, 30, E, N), lat = (d) => (Math.asin(d[1]) * 180) / Math.PI;
  // points on the belt satisfy d·n = sinLat0: check the east and west limb crossings
  const onLimb = (sgn) => { // search the limb meridian for the belt
    let best = null;
    for (let l = -89; l <= 89; l += 0.05) { const r = (l * Math.PI) / 180, d = [sgn * Math.cos(r), Math.sin(r), 0]; const f = Math.abs(dot(d, b.n) - b.sinLat0); if (!best || f < best.f) best = { f, d }; }
    return lat(best.d);
  };
  close(onLimb(1), 30, 0.1, 'west (+x = image right)'); close(onLimb(-1), -20, 0.1, 'east');
});

test('modelled structure: deterministic, unit directions, follows the cycle', () => {
  const jdMax = jdOf(2024.8), jdMin = jdOf(2019.97);
  assert.deepEqual(modelledStructure(jdMax), modelledStructure(jdMax));
  assert.ok(modelledStructure(jdMax).regions3d.length > modelledStructure(jdMin).regions3d.length, 'more active regions at maximum');
  assert.ok(modelledStructure(jdMin).polar.depth > 0.7 && modelledStructure(jdMax).polar.depth < 0.05, 'polar holes at minimum only');
  const r = resolveStructure(modelledStructure(jdMax), [1, 0, 0], [0, 1, 0]);
  for (const g of r.regions) close(Math.hypot(...g.dir), 1, 1e-9);
  close(Math.hypot(...r.belt.n), 1, 1e-9);
});

const FEED = { streamers: [{ pa: 45, width: 20, strength: 2 }, { pa: 300, width: 30, strength: 1 }], belt: { east: null, west: 30 },
  regions: [{ x: 0.5, y: 0.2, size: 0.2, strength: 2.2 }], holes: [{ x: 0, y: 0.8, size: 0.3, depth: 0.7 }],
  sources: { coronagraph: { instrument: 'SOHO LASCO C2', time: '2026-10-12T03:00:00Z', credit: 'c' }, euv: { instrument: 'SDO AIA 193 Å', time: '2026-10-12T04:00:00Z', credit: 'e' } } };

test('the feed becomes the structure near its date, else the model takes over', () => {
  const jd = Date.parse('2026-10-12T12:00:00Z') / 86400000 + 2440587.5;
  const s = structureFromFeed(FEED, jd);
  assert.equal(s.source, 'measured');
  assert.equal(s.streamers[0].strength, 1, 'normalised to the strongest');
  assert.equal(structureFromFeed(FEED, jd + 30), null, 'a month away: not today\'s corona');
  assert.equal(structureFromFeed(null, jd), null);
  const r = resolveStructure(s, [0, 0, 1], [0, 1, 0]);
  close(r.regions[0].dir[0], 0.5, 1e-12, 'region at x = 0.5 (west)');
  close(r.streamers[0].dir[0], -Math.sin(Math.PI / 4), 1e-12, 'PA 45: north-east, image left');
});

test('the CORONA panel badges each layer honestly', () => {
  const jd = Date.parse('2026-10-12T12:00:00Z') / 86400000 + 2440587.5, s = structureFromFeed(FEED, jd);
  const rows = coronaLayers(coronaLook({ id: 'full' }, null), s, { jd });
  const by = (l) => rows.find((r) => r.label === l);
  assert.match(by('STREAMERS').value, /SOHO LASCO C2/); assert.equal(by('STREAMERS').tier, 'modelled');
  assert.equal(by('BRIGHTNESS VS DISC').tier, 'imagined', 'white light is exaggerated');
  assert.equal(by('WISPS AND MOTION').tier, 'imagined');
  assert.ok(rows.every((r) => r.tier !== 'measured'), 'nothing inferred is presented as MEASURED');
  const euv = coronaLayers(coronaLook({ id: 'xray' }, null, { effNm: 19.3 }), s, { jd });
  assert.equal(euv.find((r) => r.label === 'BRIGHTNESS VS DISC').tier, 'modelled');
  assert.match(euv.find((r) => r.label === 'BRIGHTNESS VS DISC').value, /TO SCALE/);
  const mod = coronaLayers(coronaLook({ id: 'full' }, null), modelledStructure(jd), { jd });
  assert.equal(mod.find((r) => r.label === 'ACTIVE-REGION LOOPS').tier, 'imagined', 'illustrative positions');
  assert.equal(coronaLayers(coronaLook({ id: 'gamma' }, null, { effNm: 1e-4 }), s)[0].tier, 'computed');
});

// ---- server: measuring the structure on images -------------------------------------------------------------
/** A synthetic coronagraph image: falling background, rays at the given PAs, an occulter and a black pylon. */
function coronagraph(size, rsunPx, rays) {
  const rgba = new Uint8Array(size * size * 4), c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - c, dy = c - y, r = Math.hypot(dx, dy) / rsunPx, pa = ((Math.atan2(-dx, dy) * 180) / Math.PI + 360) % 360;
    let v = r < 2.2 ? 0 : 200 / r ** 2;
    for (const p of rays) { const dpa = Math.min(Math.abs(pa - p), 360 - Math.abs(pa - p)); v *= 1 + 2 * Math.exp(-((dpa / 6) ** 2)); }
    if (Math.abs(dx + dy) < 3 && dx < 0 && dy < 0) v = 0; // pylon to the south-east
    const k = (y * size + x) * 4; rgba[k] = rgba[k + 1] = rgba[k + 2] = Math.min(255, v); rgba[k + 3] = 255;
  }
  return { w: size, h: size, rgba };
}

test('coronagraph: streamers found at their position angles; the pylon is not one', () => {
  const img = coronagraph(256, 20, [60, 300]);
  const { profile } = paProfile(img, 20, { r0: 2.5, r1: 4 });
  const st = findStreamers(profile);
  assert.ok(st.length >= 2);
  const pas = st.slice(0, 2).map((s) => s.pa).sort((a, b) => a - b);
  close(pas[0], 60, 5); close(pas[1], 300, 5);
  assert.deepEqual(beltFromStreamers([{ pa: 60, strength: 1 }, { pa: 300, strength: 1 }]), { east: 30, west: 30 });
  assert.equal(beltFromStreamers([{ pa: 5, strength: 1 }]), null, 'polar rays are not the belt');
});

test('EUV disc: bright active regions and dark coronal holes in image coordinates (x west, y north)', () => {
  const size = 200, disk = 0.4, R = disk * size, c = (size - 1) / 2, rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = (x - c) / R, Y = (c - y) / R, k = (y * size + x) * 4;
    let v = Math.hypot(X, Y) <= 1 ? 100 : 0;
    if (Math.hypot(X - 0.5, Y - 0.2) < 0.15) v = 250; // active region, west of centre, north
    if (Math.hypot(X + 0.1, Y + 0.6) < 0.2) v = 20; // coronal hole, south
    rgba[k] = rgba[k + 1] = rgba[k + 2] = v; rgba[k + 3] = 255;
  }
  const { regions, holes } = discPatches({ w: size, h: size, rgba }, disk);
  assert.equal(regions.length, 1); close(regions[0].x, 0.5, 0.06); close(regions[0].y, 0.2, 0.06);
  assert.ok(holes.length >= 1); close(holes[0].x, -0.1, 0.08); close(holes[0].y, -0.6, 0.08);
});

test('the corona feed: coronagraph (C3 when C2 is stale) and EUV disc reduced to numbers', async () => {
  const now = Date.parse('2026-10-12T05:00:00Z');
  const png = (img) => encodePng(img.w, img.h, img.rgba);
  const c2 = async () => ({ body: png(coronagraph(256, 20, [90])), time: '2026-09-29T15:12:33Z', credit: 'C2' }); // 13 days old
  const c3img = coronagraph(512, 512 / 1024 * 959.63 / 56 * 2, [30]);
  const c3 = async () => ({ body: png(c3img), time: '2026-10-12T03:18:25Z', credit: 'C3' });
  const euvImg = { w: 64, h: 64, rgba: new Uint8Array(64 * 64 * 4).fill(120) };
  const euv = async () => ({ body: png(euvImg), time: '2026-10-12T04:30:00Z', disk: 0.4, credit: 'AIA' });
  const f = coronaFeed({ c2, c3, euv, now: () => now });
  const { body, time } = await f.get();
  assert.equal(body.sources.coronagraph.instrument, 'SOHO LASCO C3');
  assert.equal(body.sources.euv.instrument, 'SDO AIA 193 Å');
  assert.equal(time, '2026-10-12T04:30:00Z');
  assert.ok(Array.isArray(body.profile) && body.profile.length === 72);
  await assert.rejects(coronaFeed({ c2: async () => { throw new Error('x'); }, c3: async () => { throw new Error('x'); }, euv: async () => { throw new Error('x'); } }).get());
});
