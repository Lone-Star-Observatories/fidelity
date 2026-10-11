// Archive band maps and whole-disc images for the spectrum filter (#28): every entry is credited,
// has a wavelength range and an allowlisted source; disc images carry their geometry; a curve over
// a disc's range gives it weight; the backend's decoders and its allowlist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { BODY_BAND, BANDS, bandById, passById } from '../src/data/bands.js';
import { ARCHIVE_BAND, discUv, discLabel } from '../src/data/bandarchive.js';
import { bandLook } from '../src/views/system/bandskin.js';
import { curveLook, realOverlap, prepare } from '../src/views/system/curvelook.js';
import { windowFilter, logIntegral, clip } from '../src/data/curve.js';
import { HOSTS, archiveIds, discIds, archiveImage, discImage, binsToRgba, img8ToRgba, trekMosaic } from '../server/bandarchive.js';
import { decodePng, encodePng, resample } from '../server/png.js';
import { effectiveNm } from '../src/astro/bands.js';

const entries = Object.entries(ARCHIVE_BAND).flatMap(([body, m]) => Object.entries(m).map(([key, s]) => ({ body, key, s })));
const passOf = (key) => BANDS.flatMap((b) => b.passes.map((p) => ({ b, p }))).find(({ p }) => p.id === key);

test('every archive map and disc image: credit, range, an allowlisted source, keyed by a real bandpass', () => {
  assert.ok(entries.length >= 25);
  for (const { body, key, s } of entries) {
    const at = `${body}.${key}`;
    assert.ok(s.credit?.length > 20 && s.note, `${at}: credit and note`);
    assert.ok(Array.isArray(s.range) && s.range[0] > 0 && s.range[0] < s.range[1], `${at}: range`);
    assert.equal(BODY_BAND[body][key], s, `${at}: merged into BODY_BAND`);
    const pass = passOf(key);
    assert.ok(pass, `${at}: a bandpass`);
    // the image's own range overlaps the bandpass it is shown in (no stand-ins from another band)
    const f = pass.p.filter, w = clip(f, s.range[0] * 0.8, s.range[1] * 1.25);
    assert.ok(w && logIntegral([w]) > 0, `${at}: range ${s.range} vs ${pass.p.label}`);
    assert.ok(!!s.archive !== !!s.disc, `${at}: an archive map or a disc image`);
    if (s.archive) {
      assert.ok(archiveIds().includes(s.archive.id), `${at}: allowlisted`);
      if (s.archive.url) assert.match(s.archive.url, HOSTS, `${at}: archive host`);
      assert.ok(['trek', 'img8', 'bins'].includes(s.archive.kind));
    } else {
      assert.ok(discIds().includes(s.disc.id), `${at}: allowlisted`);
      assert.match(s.disc.url, HOSTS); if (s.disc.preview) assert.match(s.disc.preview, HOSTS); // no preview: the image itself is small
      assert.match(s.date, /^\d{4}(-\d\d){0,2}$/, `${at}: date`);
      assert.match(s.credit, /CC BY 4\.0|public domain/, `${at}: licence`);
    }
  }
});

test('disc images: geometry inside the image, north and size from the image', () => {
  const discs = new Map(entries.filter((e) => e.s.disc).map((e) => [e.s.disc.id, e.s]));
  assert.ok(discs.size >= 5);
  for (const [id, s] of discs) {
    const d = s.disc;
    for (const k of ['w', 'h', 'cx', 'cy', 're', 'rp', 'pa']) assert.ok(Number.isFinite(d[k]), `${id}.${k}`);
    assert.ok(d.cx - d.re >= -1 && d.cx + d.re <= d.w + 1 && d.cy - d.re >= -1 && d.cy + d.re <= d.h + 1, `${id}: disc inside the image`);
    assert.ok(d.rp <= d.re && d.rp > 0.85 * d.re, `${id}: polar radius ≤ equatorial (oblate planets)`);
    // seen from the equator: the sub-Earth point is the disc centre, the north pole at the limb along pa
    const E = [0, 0, 1], P = [0, 1, 0];
    const c = discUv(d, E, E, P);
    assert.ok(Math.abs(c.u - d.cx / d.w) < 1e-9 && Math.abs(c.v - (1 - d.cy / d.h)) < 1e-9);
    const n = discUv(d, P, E, P), a = (d.pa * Math.PI) / 180;
    assert.ok(Math.abs((n.u - c.u) * d.w - -Math.sin(a) * d.rp) < 1e-6 && Math.abs((n.v - c.v) * d.h - Math.cos(a) * d.rp) < 1e-6, `${id}: north at pa`);
    assert.ok(discUv(d, [0, 0, -1], E, P).facing < 0, 'the far side is not covered');
    const look = bandLook({ id: entries.find((e) => e.s === s).body, name: id }, bandById(passOf(entries.find((e) => e.s === s).key).b.id), passOf(entries.find((e) => e.s === s).key).p);
    assert.equal(look.tier, 'measured'); assert.equal(look.label, discLabel(s.date)); assert.match(look.label, /DISC IMAGE · .* · EARTH-FACING SIDE ONLY/);
  }
  // Jupiter: north up, the limb at the top of the disc; Uranus: north to the right (its sunward pole)
  const j = BODY_BAND.jupiter['ir-F200W'].disc, u = BODY_BAND.uranus['ir-W1'].disc;
  assert.ok(Math.abs(discUv(j, [0, 1, 0], [0, 0, 1], [0, 1, 0]).v * j.h - (j.h - j.cy + j.rp)) < 1e-6);
  assert.ok(discUv(u, [0, 1, 0], [0, 0, 1], [0, 1, 0]).u > u.cx / u.w + 0.15, 'Uranus north is on the right');
});

test('a curve covering a disc image\'s range gives it weight; the label says what it covers', () => {
  for (const [body, key] of [['jupiter', 'ir-F200W'], ['saturn', 'ir-W1'], ['neptune', 'ir-Ks'], ['uranus', 'ir-W1'], ['jupiter', 'uv-fuv'], ['jupiter', 'x-soft'], ['jupiter', 'ir-F444W'], ['io', 'ir-W1']]) {
    const s = BODY_BAND[body][key];
    const curve = { parts: [{ lo: s.range[0], hi: s.range[1] }], excl: [] };
    const o = realOverlap(prepare(curve), body);
    const hit = o.list.find((x) => x.source === s || x.source.disc?.id === s.disc.id);
    assert.ok(hit && hit.weight > 0.5, `${body}: ${s.disc.id} weighted ${hit?.weight}`);
    const look = curveLook({ id: body, name: body }, curve);
    assert.equal(look.real.source.disc.id, s.disc.id);
    assert.match(look.label, /MEASURED.*DISC IMAGE .* EARTH-FACING SIDE ONLY/);
    assert.equal(look.real.palette, 0, 'a disc image in its own colours');
    assert.equal(look.real.lit, false, 'its lighting is in the image');
  }
  // archive maps the same way: a window over the Th line picks Lunar Prospector's thorium map
  const th = BODY_BAND.moon['g-th'];
  const o = realOverlap(prepare({ parts: [{ lo: th.range[0], hi: th.range[1] }], excl: [] }), 'moon');
  assert.equal(o.list[0].source, th);
  assert.equal(curveLook({ id: 'moon', name: 'Moon' }, { parts: [{ lo: th.range[0], hi: th.range[1] }], excl: [] }).real.lit, false, 'gamma rays are not sunlight');
});

test('the gamma band\'s nuclear-line passes: real maps for the Moon and Mars, predictions elsewhere', () => {
  const g = bandById('gamma');
  for (const id of ['g-k', 'g-th', 'g-fe']) {
    const p = passById(g, id);
    assert.ok(effectiveNm(p.filter) < 1e-3, id);
    assert.equal(bandLook({ id: 'moon', name: 'Moon' }, g, p).mode, 'real');
    assert.equal(bandLook({ id: 'mars', name: 'Mars' }, g, p).mode, 'real');
    assert.notEqual(bandLook({ id: 'jupiter', name: 'Jupiter' }, g, p).tier, 'measured');
  }
  assert.match(BODY_BAND.mars['g-h'].note, /hydrogen/);
  assert.match(BODY_BAND.moon['g-th'].note, /derived map of a measured spectrum/);
  assert.equal(bandLook({ id: 'moon', name: 'Moon' }, g, passById(g, 'g-lat')).mode, 'glow', 'the Fermi band keeps the cosmic-ray glow');
  assert.match(BODY_BAND.mercury['x-soft'].archive.url, /xrs_map_mg_si/);
});

test('PNG codec: round trip, every filter type, resampling ignores transparent pixels', () => {
  const w = 5, h = 4, rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 37) % 256);
  const back = decodePng(encodePng(w, h, rgba));
  assert.deepEqual([...back.data], [...rgba]);
  // a hand-made grey+alpha PNG using the Sub, Up, Average and Paeth filters
  const raw = Buffer.from([1, 10, 255, 5, 0, 2, 1, 0, 1, 0, 3, 4, 255, 4, 0, 4, 1, 0, 2, 0]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(4, 4); ihdr[8] = 8; ihdr[9] = 4;
  const png = encodePng(1, 1, new Uint8Array(4)); // for its signature (the decoder does not check CRCs)
  const chunks = (k, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); return Buffer.concat([len, Buffer.from(k), d, Buffer.alloc(4)]); };
  const g = decodePng(Buffer.concat([png.subarray(0, 8), chunks('IHDR', ihdr), chunks('IDAT', zlib.deflateSync(raw)), chunks('IEND', Buffer.alloc(0))]));
  const grey = [...g.data].filter((_, k) => k % 4 === 0 || k % 4 === 3);
  assert.deepEqual(grey, [10, 255, 15, 255, /* Sub */ 11, 255, 16, 255, /* Up */ 9, 126, 16, 190, /* Average */ 10, 126, 18, 190 /* Paeth */]);
  const half = resample({ width: 2, height: 1, data: new Uint8Array([200, 200, 200, 255, 0, 0, 0, 0]) }, 1, 1);
  assert.equal(half.data[0], 200, 'a transparent neighbour does not darken the average');
});

test('binned tables and rasters become equirectangular maps, −180…180, no data transparent', () => {
  // a 90° grid of cell centres, longitudes 0…360 east: 45°E bright, 225°E (−135°) dark
  const rows = [];
  for (const lat of [45, -45]) for (const lon of [45, 135, 225, 315]) rows.push(`${lat} ${lon} ${lon === 45 ? 10 : lon === 225 ? 0 : lat > 0 ? 9999.999 : 5}`);
  const m = binsToRgba(rows.join('\n'), { cols: [0, 1, 2], cell: 90 }, 8, 4);
  const px = (x, y) => m.data[(y * 8 + x) * 4], al = (x, y) => m.data[(y * 8 + x) * 4 + 3];
  assert.equal(m.min, 0); assert.equal(m.max, 10);
  assert.ok(px(5, 1) > 200, '45°E (bright) is right of centre'); assert.ok(px(1, 1) < 60, '135°W (dark) is left'); // bilinear between cell centres
  assert.equal(al(5, 1), 255);
  // boxes: one 2°×2° box at 0–2°N, 10–12°E
  const b = binsToRgba('0 0.0 2.0 10.0 12.0 7\n1 -2.0 0.0 10.0 12.0 3', { cols: [1, 2, 3, 4, 5] }, 360, 180);
  assert.equal(b.data[(89 * 360 + 190) * 4], 255); assert.equal(b.data[(90 * 360 + 190) * 4], 0); assert.equal(b.data[(90 * 360 + 190) * 4 + 3], 255);
  assert.equal(b.data[(10 * 360 + 10) * 4 + 3], 0, 'no data elsewhere');
  const r = img8ToRgba(Buffer.from([0, 7, 9, 0]), 2, 2);
  assert.deepEqual([...r.data.slice(0, 8)], [0, 0, 0, 0, 7, 7, 7, 255]);
});

test('Trek tiles mosaic in WMTS order; unknown ids and foreign hosts are refused', async () => {
  const tile = (v) => { const d = new Uint8Array(256 * 256 * 4).fill(v); return encodePng(256, 256, d); };
  const m = await trekMosaic('X', 0, async (r, c) => tile(c ? 200 : 100));
  assert.equal(m.width, 512); assert.equal(m.data[0], 100); assert.equal(m.data[(300) * 4], 200);
  await assert.rejects(trekMosaic('X', 0, async () => { throw Object.assign(new Error('gone'), { status: 404 }); }), /no tiles/);
  await assert.rejects(archiveImage('../../etc/passwd'), (e) => e.status === 404);
  await assert.rejects(discImage('https://example.com/x.jpg'), (e) => e.status === 404);
});

test('#72 disc images: Chandra X-rays, Gemini 4.7 µm Jupiter, Gemini 3.8 µm Io — measured geometry, licence, allowlisted hosts', async () => {
  const x = BODY_BAND.jupiter['x-soft'], m = BODY_BAND.jupiter['ir-F444W'], io = BODY_BAND.io['ir-W1'];
  // Chandra 2007 (576×572): limb fitted on the X-ray + Hubble composite, north from the belts (7°, as the sky had it)
  assert.deepEqual([x.disc.w, x.disc.h, x.disc.pa], [576, 572, 7]);
  assert.ok(Math.abs(x.disc.rp / x.disc.re - 0.935) < 0.01, 'Jupiter\'s oblateness');
  assert.ok(Math.abs(2 * x.disc.re * (61 / 576) - 37) < 2.5, 'about 37″ across on Chandra\'s 61″ frame');
  assert.equal(x.disc.preview, undefined, 'Chandra\'s thumbnail is a crop: the image itself is the preview');
  assert.match(x.note, /X-rays.*alone/); assert.match(x.credit, /public domain/);
  assert.ok(x.range[0] > 0.5 && x.range[1] < 5, 'soft X-rays (nm)');
  // Gemini M′ (1400×1304) north up, the same disc on F444W and (labelled) the 5 µm pass
  assert.deepEqual([m.disc.w, m.disc.h, m.disc.pa], [1400, 1304, 0]);
  assert.equal(BODY_BAND.jupiter['ir-5'].disc, m.disc); assert.match(BODY_BAND.jupiter['ir-5'].note, /just below this/);
  assert.match(m.credit, /CC BY 4\.0/); assert.match(io.credit, /CC BY 4\.0/);
  // Io: a sphere (one radius), at L′; the look is the measured disc, not the hot-spot sketch
  assert.equal(io.disc.re, io.disc.rp); assert.ok(io.range[0] < 3780 && io.range[1] > 3780, 'L′ 3.78 µm');
  assert.equal(bandLook({ id: 'io', name: 'Io' }, bandById('ir'), passById(bandById('ir'), 'ir-W1')).tier, 'measured');
  for (const s of [x, m, io]) assert.match(s.disc.url, HOSTS);
  for (const u of ['https://chandra.harvard.edu/photo/2007/jupiter/jupiter_xray.jpg', 'https://storage.noirlab.edu/media/archives/images/large/noirlab2116a.jpg']) assert.match(u, HOSTS);
  for (const u of ['https://chandra.harvard.edu.evil.com/x.jpg', 'http://storage.noirlab.edu/x.jpg', 'https://noirlab.edu/public/images/x/']) assert.doesNotMatch(u, HOSTS);
  assert.ok(discIds().includes('chandra-jupiter-2007') && discIds().includes('gemini-jupiter-m-2017') && discIds().includes('gemini-io-l-2013'));
});
