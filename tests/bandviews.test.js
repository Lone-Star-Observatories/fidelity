// The spectrum filter (#28) beyond the System View: the galaxy model, Universe galaxies, the
// Magellanic Clouds, the Star View's photosphere, Earth/Sun microwave maps and the NoRH decoder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { ghz, topHat, filter } from '../src/astro/bands.js';
import { BANDS, BODY_BAND } from '../src/data/bands.js';
import { galaxyBandWeights, galaxyTypeWeight, galaxyBandNote, lineFilter, WL, COMPONENT_SED, TYPE_SED, DUST_ABSORB, DUST_GLOW } from '../src/astro/galaxyband.js';
import { cloudImageFor } from '../src/data/satellite-bands.js';
import { starBandLook, sunSignatureKey } from '../src/views/system/starband.js';
import { parseFits, norhToPng } from '../server/solarradio.js';

const pass = (id) => BANDS.flatMap((b) => b.passes.map((p) => ({ band: b, pass: p }))).find((x) => x.pass.id === id);
const W = (id) => galaxyBandWeights(pass(id).pass.filter);
const STARS = ['thin', 'thick', 'bulge', 'arms', 'halo'];

test('galaxy SEDs are tabulated on every anchor wavelength', () => {
  for (const [k, v] of Object.entries({ ...COMPONENT_SED, ...TYPE_SED, DUST_ABSORB, DUST_GLOW })) assert.equal(v.length, WL.length, k);
  for (let i = 1; i < WL.length; i++) assert.ok(WL[i] > WL[i - 1]);
});

test('galaxy model: old bulge strongest in the near-IR, young arms in the UV, dust transparent in the IR', () => {
  const v = W('vis-V'), k = W('ir-Ks'), uv = W('uv-fuv');
  for (const c of STARS) assert.ok(Math.abs(v[c] - 1) < 0.05, `V ≈ visible look: ${c}`);
  assert.ok(k.bulge > 2 && k.bulge > k.arms * 4, 'bulge dominates Ks');
  assert.ok(uv.arms > 2 && uv.bulge < 0.1 && uv.dustAbsorb > 2.4, 'UV: young stars, bulge fades, dust absorbs');
  assert.ok(k.dustAbsorb < 0.15, 'A_K ≈ 0.1 A_V');
});

test('galaxy model: far-IR dust glows; radio and HI are the gas disc; X-rays the ridge and eROSITA bubbles; gamma the gas and Fermi bubbles', () => {
  const fir = W('ir-90');
  assert.ok(fir.dustGlow > 2 && fir.dustAbsorb < 0.05 && fir.thin < 0.05);
  const r = W('radio-408'), hi = W('radio-hi');
  assert.ok(r.gas > 1.5 && STARS.every((c) => r[c] === 0));
  assert.equal(hi.line, 'hi');
  assert.ok(hi.gas > r.gas && hi.hii < 0.3);
  const x = W('x-soft'), hx = W('x-hard');
  assert.ok(x.erosita > x.thin * 5 && x.erosita > x.bulge);
  assert.ok(hx.bulge > hx.thin && hx.dustAbsorb < 0.2, 'hard X: the ridge follows the stars, little absorption');
  const g = W('g-lat');
  assert.ok(g.gas > 1.5 && g.fermi > 0.9 && STARS.every((c) => g[c] === 0));
  for (const id of ['x-171', 'x-304']) { const e = W(id); assert.ok(Math.max(...STARS.map((c) => e[c]), e.erosita, e.gas) < 0.01, `${id}: EUV absorbed`); assert.equal(galaxyBandNote(e).dark, true); }
  assert.equal(galaxyBandNote(null).value, 'FULL SPECTRUM');
});

test('emission-line filters are recognised, by wavelength (so a custom curve works too)', () => {
  assert.equal(lineFilter(pass('vis-ha').pass.filter), 'halpha');
  assert.equal(lineFilter(pass('vis-oiii').pass.filter), 'oiii');
  assert.equal(lineFilter(pass('radio-hi').pass.filter), 'hi');
  assert.equal(lineFilter(pass('radio-nvss').pass.filter), null);
  assert.equal(lineFilter(filter('johnson-V')), null);
  assert.equal(lineFilter(topHat(654, 658)), 'halpha');
  assert.ok(W('vis-ha').hii > 3 * W('vis-ha').thin);
});

test('Universe galaxies by type: ellipticals in the near-IR, spirals in the far-IR, irregulars in the UV and HI', () => {
  const f = (id) => pass(id).pass.filter;
  assert.ok(galaxyTypeWeight(-5, f('ir-Ks')) > galaxyTypeWeight(4, f('ir-Ks')));
  assert.ok(galaxyTypeWeight(4, f('ir-90')) > 5 * galaxyTypeWeight(-5, f('ir-90')));
  assert.ok(galaxyTypeWeight(10, f('uv-fuv')) > galaxyTypeWeight(4, f('uv-fuv')) && galaxyTypeWeight(4, f('uv-fuv')) > 5 * galaxyTypeWeight(-5, f('uv-fuv')));
  assert.ok(galaxyTypeWeight(10, f('radio-hi')) > galaxyTypeWeight(4, f('radio-hi')) && galaxyTypeWeight(4, f('radio-hi')) > 10 * galaxyTypeWeight(-5, f('radio-hi')));
  assert.ok(galaxyTypeWeight(-5, f('x-hard')) > galaxyTypeWeight(4, f('x-hard')));
  assert.equal(galaxyTypeWeight(-5, null), 1);
});

test('Magellanic Clouds: optical in full and visible, Spitzer in the mid-IR, a real image for every band but the EUV', () => {
  assert.equal(cloudImageFor({ full: true }).id, 'dss2');
  const at = (id) => { const { band, pass: p } = pass(id); return cloudImageFor({ band, pass: p, full: false }); };
  assert.equal(at('vis-V').id, 'dss2');
  assert.equal(at('ir-F770W').id, 'spitzer');
  assert.equal(at('ir-Ks').id, '2mass');
  assert.equal(at('ir-140').id, 'akari');
  assert.equal(at('uv-nuv').id, 'uv');
  assert.equal(at('mw-94').id, 'planck');
  assert.equal(at('radio-hi').id, 'hi4pi');
  assert.equal(at('radio-hi').nearest, false);
  assert.equal(at('radio-408').nearest, true);
  assert.equal(at('x-soft').id, 'rass');
  assert.equal(at('g-lat').id, 'fermi');
  assert.equal(at('x-304'), null);
  // a custom curve (#66) is matched by wavelength
  assert.equal(cloudImageFor({ band: { id: 'custom', palette: 'infrared', passes: [] }, pass: { id: 'custom', filter: topHat(7000, 9000) }, full: false }).id, 'spitzer');
});

test('Star View photosphere: the Sun shows NoRH in the microwave, its measured sketches elsewhere; stars a blackbody', () => {
  const mw = pass('mw-23');
  assert.equal(starBandLook({ isSun: true }, mw.band, mw.pass).feed, 'norh-17');
  assert.equal(starBandLook({ isSun: true }, mw.band, mw.pass).tier, 'measured');
  assert.equal(starBandLook({ isSun: true, noFeeds: true }, mw.band, mw.pass).mode, 'glow', 'standalone: the measured-signature sketch');
  const r = pass('radio-408');
  const r408 = starBandLook({ isSun: true }, r.band, r.pass);
  assert.equal(r408.feed, 'sunmodel-408', '408 MHz: the modelled disc (#28)');
  assert.equal(r408.tier, 'modelled', 'a modelled disc is never MEASURED');
  assert.equal(starBandLook({ isSun: true, noFeeds: true }, r.band, r.pass).mode, 'glow', 'standalone without a baked copy: the radio sketch');
  assert.equal(starBandLook({ isSun: false, teff: 5772 }, r.band, r.pass).mode, 'dark');
  const custom = { id: 'custom', palette: 'microwave', passes: [] };
  assert.equal(starBandLook({ isSun: true }, custom, { id: 'custom', filter: ghz(16.5, 17.5) }).feed, 'norh-17', 'custom curve matched by range');
  const cr = starBandLook({ isSun: true }, custom, { id: 'custom', filter: ghz(1.0, 1.2) });
  assert.ok(!cr.feed && cr.tier === 'modelled' && /F10\.7/.test(cr.detail), 'custom radio curve clear of every map: the radio sketch');
  assert.equal(sunSignatureKey(1e-5), 'gamma');
  const ks = pass('ir-Ks');
  const cool = starBandLook({ teff: 3000 }, ks.band, ks.pass), hot = starBandLook({ teff: 20000 }, ks.band, ks.pass);
  assert.ok(cool.delta > hot.delta && cool.tier === 'computed');
  assert.equal(starBandLook({ teff: 5000 }, BANDS[0], null), null);
});

test('new real maps: Sun NoRH and Earth GMI/SMAP carry their wavelength range', () => {
  for (const id of ['mw-23', 'mw-33', 'mw-94', 'microwave']) { const s = BODY_BAND.sun[id]; assert.ok(s.feed.startsWith('norh-') && s.range[0] < s.range[1], id); }
  const gmi = BODY_BAND.earth.microwave;
  assert.ok(gmi.gibs.includes('GMI_Brightness_Temp') && gmi.range[0] < 1.7e6 && gmi.range[1] > 2.8e7);
  assert.ok(BODY_BAND.earth['radio-nvss'].latest && BODY_BAND.earth['radio-nvss'].range[0] < 2.13e8);
});

test('NoRH decoder: FITS header and big-endian floats in, PNG out with the disc fraction', () => {
  const card = (k, v) => `${k.padEnd(8)}= ${String(v).padStart(20)}`.padEnd(80);
  const cards = [card('SIMPLE', 'T'), card('BITPIX', -32), card('NAXIS', 2), card('NAXIS1', 4), card('NAXIS2', 2),
    card('SOLR', 960), card('CDELT1', 600), `${'DATE-OBS'.padEnd(8)}= '2014-01-07'`.padEnd(80), `${'TIME-OBS'.padEnd(8)}= '02:44:33.103'`.padEnd(80), 'END'.padEnd(80)];
  const head = Buffer.from(cards.join('').padEnd(2880), 'latin1'), data = Buffer.alloc(2880);
  [0, 1e4, 1e5, 3e5, 2e4, 1e4, NaN, 0].forEach((v, i) => data.writeFloatBE(v, i * 4));
  const buf = Buffer.concat([head, data]);
  const f = parseFits(buf);
  assert.equal(f.w, 4); assert.equal(f.h, 2); assert.equal(f.data[1], 1e4); assert.equal(f.header['DATE-OBS'], '2014-01-07');
  const out = norhToPng(buf);
  assert.ok(Math.abs(out.disk - 960 / (600 * 4)) < 1e-9);
  assert.equal(out.time, '2014-01-07T02:44:33Z');
  assert.deepEqual([...out.png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join(''), 'PNG');
  // the IDAT inflates to h rows of (1 + 3w) bytes; FITS row 0 (bottom) becomes the last PNG row
  const idat = out.png.indexOf('IDAT'), len = out.png.readUInt32BE(idat - 4), raw = zlib.inflateSync(out.png.subarray(idat + 4, idat + 4 + len));
  assert.equal(raw.length, 2 * 13);
  assert.ok(raw[13 + 1 + 3 * 3 + 2] === 255, '300,000 K is white-hot');
  assert.equal(raw[1 + 2 * 3], 0, 'NaN is dark');
});
