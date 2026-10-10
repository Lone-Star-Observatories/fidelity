// The Sun's maps in the spectrum filter (#28): matched by wavelength range in the System and Star views
// alike, weighted like any body; the measured SRH 3 GHz map; the MODELLED · PREDICTED radio disc below
// 3 GHz (never counted as MEASURED); and the dependency-free PNG decoder it reads HMI with.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { BANDS, BODY_BAND } from '../src/data/bands.js';
import { setCurrentCurve, currentBand } from '../src/data/bandstate.js';
import { presetPass } from '../src/data/curve.js';
import { starBandLook } from '../src/views/system/starband.js';
import { starBandDelta, SUN_SIGNATURES, paletteIndex, bandLook } from '../src/views/system/bandskin.js';
import { prepare, sunCurveLook, curveLook } from '../src/views/system/curvelook.js';
import { encodePng } from '../server/solarradio.js';
import { modelDisc, quietTb, zirinTb, discFlux, tbToSfu, sfuToTb, decodePng, srhToPng, srhUsable, solarRadiusArcsec } from '../server/solarmodel.js';

const nm = (g) => 299792458 / g; // GHz → nm
const win = (lo, hi) => ({ parts: [{ key: 'w', lo, hi }], excl: [] });
/** The System View's path: the shared curve state, then the Sun's look from it (SystemView applyStarBand). */
const systemSun = (curve, opts = {}) => { setCurrentCurve(curve); const cb = currentBand(); return starBandLook({ isSun: true, ...opts }, cb.band, cb.pass); };

test('System View path: a custom window on 17 GHz picks Nobeyama, weighted by overlap', () => {
  const inside = systemSun(win(nm(17.01), nm(16.99)));
  assert.equal(inside.feed, 'norh-17'); assert.ok(inside.mix > 0.95, 'the window lies inside the map\'s range: drawn at full weight');
  assert.equal(inside.tier, 'measured'); assert.match(inside.label, /MEASURED/);
  const wide = systemSun(win(nm(18), nm(16)));
  assert.equal(wide.feed, 'norh-17', 'still the map that overlaps');
  assert.ok(wide.mix > 0 && wide.mix < 0.2, `weighted like any body: a 2 GHz window over a 34 MHz map (${wide.mix})`);
  assert.match(wide.label, /\d+% MEASURED/);
  const s = sunCurveLook(prepare(win(nm(18), nm(16))));
  assert.ok(Math.abs(s.realShare - wide.mix) < 1e-12, 'System and Star views share one rule');
});

test('System View path: a window on 171 Å picks AIA 171; 34 GHz picks NoRH 34; the standalone shows only baked maps', () => {
  assert.equal(systemSun(win(17.05, 17.15)).feed, 'sdo-171');
  assert.equal(systemSun(win(nm(34.04), nm(33.96))).feed, 'norh-34');
  const offline = systemSun(win(17.05, 17.15), { hasFeed: () => false });
  assert.equal(offline.feed, null); assert.equal(offline.mix, 0); assert.match(offline.label, /NEEDS THE LOCAL BACKEND/);
  assert.equal(systemSun(win(17.05, 17.15), { hasFeed: (id) => id === 'sdo-171' }).feed, 'sdo-171', 'a baked copy is shown offline');
});

test('exact single-bandpass curves reproduce the old results', () => {
  // the old System View rule, with the Sun's maps as they were before the radio entries (#28)
  const OLD = Object.fromEntries(Object.entries(BODY_BAND.sun).filter(([k, s]) => !s.predicted && k !== 'srh-3000'));
  const PAL = [[1, 1, 1], [1, 0.55, 0.15], [0.3, 0.85, 1], [1, 0.45, 0.2], [1, 1, 1], [0.7, 0.55, 1], [0.4, 0.9, 1], [1, 0.4, 0.9]];
  const old = (band, p) => {
    const src = OLD[p?.id] ?? OLD[band.id];
    if (src?.feed) return { feed: src.feed, tint: [1, 1, 1], mode: 'real' };
    const t = PAL[paletteIndex(band.palette)], sig = SUN_SIGNATURES[band.id];
    if (sig) return { tint: t.map((c) => c * sig.gain), mode: 'glow' };
    const d = starBandDelta(5772, p);
    if (d === -Infinity) return { tint: [0.02, 0.02, 0.02], mode: 'dark' };
    const k = Math.max(0.05, Math.min(3, 10 ** (0.4 * Math.max(-6, Math.min(6, d)) * 0.35)));
    return { tint: t.map((c) => c * k), mode: 'computed' };
  };
  let n = 0;
  for (const b of BANDS) for (const p of b.passes) {
    const now = systemSun(presetPass(p.id)), was = old(b, p);
    assert.equal(currentBand().pass.id, p.id, 'the curve canonicalises to the pass');
    if (was.feed) { assert.equal(now.feed, was.feed, p.id); assert.equal(now.mix, 1, p.id); assert.deepEqual(now.tint, [1, 1, 1], p.id); n++; continue; }
    if (now.feed) { assert.ok(BODY_BAND.sun[p.id].predicted && now.tier === 'modelled', `${p.id}: only the new modelled radio discs differ`); continue; }
    assert.equal(now.mode, was.mode, p.id);
    now.tint.forEach((c, i) => assert.ok(Math.abs(c - was.tint[i]) < 1e-12, p.id));
    n++;
  }
  assert.equal(n, BANDS.reduce((a, b) => a + b.passes.length, 0) - 4, "all but the four radio passes with a modelled disc");
});

test('the modelled radio discs are badged MODELLED · PREDICTED wherever they are used', () => {
  for (const id of ['radio-408', 'radio-hi', 'radio-nvss', 'radio-s']) {
    const s = BODY_BAND.sun[id];
    assert.ok(s.predicted && s.feed.startsWith('sunmodel-') && /MODELLED · PREDICTED/.test(s.credit), id);
  }
  assert.ok(!BODY_BAND.sun['srh-3000'].predicted, 'the SRH 3 GHz map is a measurement');
  const c = sunCurveLook(prepare(win(nm(1.43), nm(1.37))));
  assert.equal(c.feed.feed, 'sunmodel-1400'); assert.equal(c.measured, 0);
  assert.match(c.look.label, /MODELLED MAP · PREDICTED/); assert.doesNotMatch(c.look.label, /\bMEASURED\b(?! SIGNATURE)/);
  assert.equal(c.look.tier, 'modelled');
  // a body map flagged predicted: drawn (mix.real) but counted as PREDICTED, never MEASURED
  BODY_BAND.__p = { ir: { hips: 'X', credit: 'test model', range: [1000, 2000], predicted: true } };
  try {
    const l = curveLook({ id: '__p', name: 'T' }, win(1100, 1900));
    assert.ok(l.mix.real > 0.9); assert.doesNotMatch(l.label, /MEASURED/); assert.equal(l.tier, 'modelled'); assert.ok(l.sources[0].predicted);
    assert.equal(bandLook({ id: '__p', name: 'T' }, BANDS.find((b) => b.id === 'ir'), BANDS.find((b) => b.id === 'ir').passes[0]).tier, 'modelled');
  } finally { delete BODY_BAND.__p; }
  // a 3 GHz window: today's SRH map, MEASURED
  const srh = systemSun(win(nm(3.005), nm(2.995)));
  assert.equal(srh.feed, 'srh-3000'); assert.equal(srh.tier, 'measured');
});

test('quiet-Sun brightness temperature: Zirin et al. 1991, saturating to the corona', () => {
  assert.ok(Math.abs(zirinTb(1.4) - 80000) < 2500 && Math.abs(zirinTb(10) - 12000) < 600, 'the published fit');
  assert.ok(quietTb(0.05) > 9e5 && quietTb(0.05) < 1e6, 'metre waves: the ~10⁶ K corona');
  assert.ok(Math.abs(sfuToTb(tbToSfu(5e4, 1.4), 1.4) - 5e4) < 1e-6);
  // 100 sfu at 2.8 GHz over the disc ≈ 6.2×10⁴ K (Rayleigh–Jeans)
  assert.ok(Math.abs(sfuToTb(100, 2.8) - 6.2e4) < 2e3);
});

test('modelled disc: mean brightness temperature within the quiet-Sun range at 1.4 GHz and 408 MHz, and scaling with F10.7', () => {
  const at = (f, f107) => modelDisc(f, { f107, size: 128 });
  // quiet Sun (solar minimum, F10.7 ≈ 70): 1.4 GHz ~(0.5–1.5)×10⁵ K, 408 MHz ~(2–12)×10⁵ K (Zirin et al. 1991; Dulk 1985;
  // Shibasaki et al. 2011)
  const q14 = at(1.4, 70), q408 = at(0.408, 70);
  assert.ok(q14.meanTb > 5e4 && q14.meanTb < 1.5e5, `1.4 GHz: ${Math.round(q14.meanTb)} K`);
  assert.ok(q408.meanTb > 2e5 && q408.meanTb < 1.2e6, `408 MHz: ${Math.round(q408.meanTb)} K`);
  assert.ok(Math.abs(q14.meanTb / quietTb(1.4) - q14.sfu / tbToSfu(quietTb(1.4), 1.4)) < 1e-3, 'the disc carries exactly the flux it was given');
  const a14 = at(1.4, 180), a408 = at(0.408, 180);
  assert.ok(a14.meanTb > q14.meanTb * 1.5 && a408.meanTb > q408.meanTb, 'brighter at solar maximum');
  assert.ok(at(1.4, 120).meanTb > q14.meanTb && at(1.4, 120).meanTb < a14.meanTb, 'monotonic in F10.7');
  // F10.7 126 sfu (10 October 2026) predicts ~71 sfu at 1.4 GHz; RSTN measured 73
  assert.ok(Math.abs(discFlux(1.415, { f107: 126 }).sfu - 73) < 6);
  // an RSTN reading within 15% of the frequency sets the total instead
  const r = discFlux(1.4, { f107: 126, rstn: [[1415, 73], [2695, 120]] });
  assert.equal(r.from, 'rstn'); assert.equal(r.at, 1415); assert.ok(Math.abs(r.sfu - 73) < 1);
  assert.equal(discFlux(0.9, { f107: 126, rstn: [[1415, 73]] }).from, 'f107', 'none near enough: F10.7');
  // limb brightening at decimetre wavelengths; a larger, flat disc at metre wavelengths
  const row = (d, f) => { const c = (d.size - 1) / 2, R = d.disk * d.size; return (r0) => d.tb[Math.round(c) * d.size + Math.round(c + r0 * R)]; };
  const q = modelDisc(1.4, { f107: 67, size: 256 }), m = modelDisc(0.408, { f107: 67, size: 256 });
  assert.ok(row(q)(0.97) > row(q)(0.3) * 1.15, 'dm: limb-brightened');
  assert.ok(row(m)(1.2) > row(m)(0) * 0.3 && row(q)(1.2) < row(q)(0) * 0.05, 'm: the radio Sun extends beyond the optical limb');
});

test('modelled disc: active regions sit where the magnetogram has strong fields', () => {
  const w = 64, rgba = new Uint8Array(w * w * 4).fill(128);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  const spot = [40, 28]; // a strong positive-polarity patch east of centre
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const o = ((spot[1] + y) * w + spot[0] + x) * 4; rgba[o] = rgba[o + 1] = rgba[o + 2] = 255; }
  const d = modelDisc(2.4, { f107: 150, mag: { w, h: w, rgba, disk: 0.39 }, size: 128, disk: 0.39 });
  assert.ok(d.arPlaced);
  let best = 0, at = 0;
  for (let i = 0; i < d.tb.length; i++) if (d.tb[i] > best) { best = d.tb[i]; at = i; }
  const x = at % 128, y = Math.floor(at / 128), k = 128 / 64;
  assert.ok(Math.hypot(x - (spot[0] + 0.5) * k, y - (spot[1] + 0.5) * k) < 6, `brightest at the spot (${x}, ${y})`);
  assert.ok(best > d.quietTb * 2, 'an active region is far brighter than the quiet disc');
});

test('PNG decoder: plain and Adam7-interlaced, every filter type', () => {
  const w = 13, h = 9, rgb = new Uint8Array(w * h * 3).map((_, i) => (i * 37 + (i >> 3)) & 255);
  const plain = decodePng(encodePng(rgb, w, h));
  assert.equal(plain.w, w); assert.equal(plain.h, h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) assert.equal(plain.rgba[i * 4 + c], rgb[i * 3 + c]);
  // an interlaced RGBA PNG (as Helioviewer serves), passes written with filters 0–4 in turn
  const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 53 + 7) & 255);
  const passes = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]], rows = [];
  let ft = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    let prev = new Uint8Array(pw * 4);
    for (let r = 0; r < ph; r++) {
      const line = new Uint8Array(pw * 4);
      for (let x = 0; x < pw; x++) line.set(rgba.subarray(((y0 + r * dy) * w + x0 + x * dx) * 4, ((y0 + r * dy) * w + x0 + x * dx) * 4 + 4), x * 4);
      const f = ft++ % 5, out = new Uint8Array(line.length);
      for (let i = 0; i < line.length; i++) {
        const a = i >= 4 ? line[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0, p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        out[i] = (line[i] - [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
      }
      rows.push(Buffer.from([f]), Buffer.from(out)); prev = line;
    }
  }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); return Buffer.concat([l, Buffer.from(t, 'latin1'), d, Buffer.alloc(4)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[12] = 1;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  assert.deepEqual([...decodePng(png).rgba], [...rgba]);
});

test('SRH 3 GHz: FITS (4.9″/px, Tb in K) to a binned PNG with the disc fraction; failed maps rejected', () => {
  const W = 64, card = (k, v) => `${k.padEnd(8)}= ${String(v).padStart(20)}`.padEnd(80), str = (k, v) => `${k.padEnd(8)}= '${v}'`.padEnd(80);
  const fits = (fill) => {
    const cards = [card('SIMPLE', 'T'), card('BITPIX', -32), card('NAXIS', 2), card('NAXIS1', W), card('NAXIS2', W), str('DATE-OBS', '2026-10-10'), str('T-OBS', '03:59:38'),
      str('FREQUENC', '3000'), card('CDELT1', 39.2), card('CDELT2', 39.2), card('CRPIX1', 32), card('CRPIX2', 32), 'END'.padEnd(80)];
    const head = Buffer.from(cards.join('').padEnd(2880), 'latin1'), data = Buffer.alloc(Math.ceil((W * W * 4) / 2880) * 2880);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) data.writeFloatBE(fill(Math.hypot(x - 31, y - 31) * 39.2 / 960), (y * W + x) * 4);
    return Buffer.concat([head, data]);
  };
  const good = fits((r) => (r < 1 ? 2e4 : 100)), bad = fits((r) => (r < 1 ? -6000 : 100));
  assert.equal(srhUsable(good), true); assert.equal(srhUsable(bad), false);
  const out = srhToPng(good);
  assert.equal(out.time, '2026-10-10T03:59:38Z'); assert.equal(out.freq, 3000);
  assert.ok(Math.abs(out.disk - solarRadiusArcsec(Date.parse(out.time)) / (39.2 * W)) < 1e-9);
  const img = decodePng(out.png);
  assert.equal(img.w, W / 2, 'binned 2×2');
  assert.ok(img.rgba[(16 * 32 + 16) * 4] > 100 && img.rgba[0] < 30, 'the disc glows, the sky is dark');
  assert.ok(Math.abs(solarRadiusArcsec(Date.UTC(2026, 0, 3)) - 975.9) < 1 && Math.abs(solarRadiusArcsec(Date.UTC(2026, 6, 4)) - 943.7) < 1, 'perihelion/aphelion');
});
