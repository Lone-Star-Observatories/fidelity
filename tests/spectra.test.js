import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpectralType, closestTemplate } from '../src/astro/spectral.js';
import { parsePicklesFits } from '../server/spectra.js';
import { massFractions, starComposition, planck, wienPeakNm } from '../src/data/composition.js';

test('spectral types parse: ranges, decimals, suffixes, subdwarfs', () => {
  assert.deepEqual(parseSpectralType('G2V'), { letter: 'G', code: 42, lum: 5, lumGiven: true, variant: '' });
  assert.equal(parseSpectralType('B57V').code, 16);
  assert.equal(parseSpectralType('M2.5V').code, 62.5);
  assert.equal(parseSpectralType('K0III').lum, 3);
  assert.equal(parseSpectralType('M2Ib').lum, 1);
  assert.equal(parseSpectralType('sdM4').variant, 'w');
  assert.equal(parseSpectralType('DA2'), null); // white dwarfs have no normal-star template
});

test('closest template prefers the same luminosity class', () => {
  const index = ['G8V', 'G8III', 'K0V', 'M2I', 'M2V', 'wK0V'].map((type) => ({ type }));
  assert.equal(closestTemplate(index, 'G8.5V').type, 'G8V');
  assert.equal(closestTemplate(index, 'G8III').type, 'G8III');
  assert.equal(closestTemplate(index, 'M2Ib').type, 'M2I');
  assert.equal(closestTemplate(index, 'K1V', -0.6).type, 'wK0V'); // metal-poor → metal-weak template
});

test('FITS reader pulls the spectral type and the table', () => {
  const card = (s) => s.padEnd(80, ' ');
  const block = (cards) => { const t = cards.map(card).join('') + card('END'); return Buffer.from(t.padEnd(Math.ceil(t.length / 2880) * 2880, ' '), 'latin1'); };
  const h0 = block(['SIMPLE  =                    T', 'NAXIS   =                    0', "COMMENT1= 'spectral type: G2V'", "COMMENT2= 'metallicity: solar'"]);
  const h1 = block(["XTENSION= 'BINTABLE'", 'NAXIS1  =                    8', 'NAXIS2  =                    2']);
  const data = Buffer.alloc(2880);
  data.writeFloatBE(5000, 0); data.writeFloatBE(1.5, 4); data.writeFloatBE(5010, 8); data.writeFloatBE(2.5, 12);
  const p = parsePicklesFits(Buffer.concat([h0, h1, data]));
  assert.equal(p.type, 'G2V');
  assert.equal(p.metallicity, 'solar');
  assert.deepEqual([...p.wavelengthA], [5000, 5010]);
  assert.deepEqual([...p.flux], [1.5, 2.5]);
});

test('solar mass fractions match Asplund et al. 2009 (X, Y, Z)', () => {
  const f = massFractions(0);
  assert.ok(Math.abs(f.X - 0.7381) < 1e-4 && Math.abs(f.Y - 0.2485) < 1e-4 && Math.abs(f.Z - 0.0134) < 1e-4);
  const o = f.elements.find((e) => e.el === 'O').frac;
  assert.ok(o > 0.005 && o < 0.0065); // oxygen ≈ 0.57% by mass
  assert.ok(Math.abs(f.elements.reduce((s, e) => s + e.frac, 0) - 1) < 1e-9);
});

test('metal-poor stars have less of everything but H/He; white dwarfs are special', () => {
  assert.ok(massFractions(-0.5).Z < 0.0134 * 0.33);
  const wd = starComposition({ kind: 'white dwarf', spectral: 'DA2' });
  assert.equal(wd.whiteDwarf, true);
  assert.equal(starComposition({ spectral: 'G8V', metallicity: -0.52 }).tier, 'modelled');
  assert.equal(starComposition({ spectral: 'G8V', metallicity: null }).tier, 'imagined');
});

test('Planck peak sits where Wien says', () => {
  const T = 5772, peak = wienPeakNm(T);
  assert.ok(planck(peak, T) > planck(peak * 0.95, T) && planck(peak, T) > planck(peak * 1.05, T));
});
