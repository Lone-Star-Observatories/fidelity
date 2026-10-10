import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, editDistance, scoreText, indexEntries, search, groupHits, starAliases, smallBodyAliases } from '../src/data/search.js';
import { staticEntries } from '../src/data/search-index.js';

const idx = indexEntries(staticEntries());
const top = (q, n = 5) => search(idx, q, { limit: n });

test('fold: case, accents, Greek letters and punctuation', () => {
  assert.equal(fold('Šteins'), 'steins');
  assert.equal(fold('Boötes'), 'bootes');
  assert.equal(fold('α Cen'), 'alpha cen');
  assert.equal(fold('67P/Churyumov–Gerasimenko'), '67p churyumov gerasimenko');
  assert.equal(fold('  TRAPPIST-1 e '), 'trappist 1 e');
});

test('editDistance counts adjacent swaps as one edit and stops early', () => {
  assert.equal(editDistance('betelgeuse', 'betelguese'), 1);
  assert.equal(editDistance('kitten', 'sitting', 3), 3);
  assert.equal(editDistance('venus', 'vensu'), 1);
  assert.equal(editDistance('mars', 'mars'), 0);
  assert.ok(editDistance('jupiter', 'io', 2) > 2);
});

test('scoreText ranks exact > prefix > word prefix > substring > fuzzy', () => {
  const s = (q, t) => scoreText(fold(q), fold(t));
  assert.ok(s('psyche', 'psyche') > s('psy', 'psyche'));
  assert.ok(s('psy', 'psyche') > s('psy', '16 psyche'));
  assert.ok(s('psy', '16 psyche') > s('syc', 'psyche'));
  assert.ok(s('syc', 'psyche') > s('psyhce', 'psyche'));
  assert.ok(s('psyhce', 'psyche') > 0);
  assert.equal(s('xyz', 'psyche'), 0);
});

test('"psy" offers 16 Psyche (asteroid) and the Psyche spacecraft', () => {
  const hits = top('psy', 10);
  assert.ok(hits.some((h) => h.kind === 'small body' && h.id === 'psyche-16'));
  assert.ok(hits.some((h) => h.kind === 'spacecraft' && h.id === 'psyche'));
});

test('accent-insensitive: steins finds Šteins', () => {
  assert.equal(top('steins')[0].id, 'steins');
  assert.equal(top('Šteins')[0].id, 'steins');
});

test('asteroid numbers and aliases', () => {
  assert.equal(top('16 Psyche')[0].id, 'psyche-16');
  assert.equal(top('(4) Vesta')[0].id, 'vesta');
  assert.equal(top('433')[0].id, 'eros');
  assert.equal(top('ultima thule')[0].id, 'arrokoth');
  assert.equal(top('luna')[0].id, 'moon');
  assert.deepEqual(smallBodyAliases('psyche-16', 'Psyche').slice(0, 3), ['16 Psyche', '(16) Psyche', '16']);
});

test('acronyms, deep sky and sites', () => {
  assert.equal(top('jwst')[0].id, 'jwst');
  assert.equal(top('m31')[0].id, 'gal-MESSIER031');
  assert.equal(top('pleiades')[0].id, 'cl-Melotte 22');
  assert.equal(top('lagoon')[0].kind, 'nebula');
  assert.equal(top('tranquility')[0].kind, 'site');
});

test('typos still find things, but not next to a real match', () => {
  assert.equal(top('jupitr')[0].id, 'jupiter');
  assert.equal(top('ganymde')[0].id, 'ganymede');
  assert.ok(top('halley', 10).every((h) => h.score >= 30));
});

test('star designations: Bayer (abbreviated and genitive), Flamsteed, Gliese, HIP, HD', () => {
  const a = starAliases({ proper: 'Rigil Kentaurus', bayer: 'Alp1', con: 'Cen', gl: 'Gl 559A', hip: 71683, hd: 128620 });
  assert.ok(a.includes('alpha 1 Cen') && a.includes('alpha 1 Centauri') && a.includes('Gliese 559A') && a.includes('HIP 71683') && a.includes('HD 128620'));
  const s = indexEntries([{ kind: 'star', id: 'x', name: 'Rigil Kentaurus', aliases: a }, { kind: 'star', id: 'y', name: '61 Cyg', aliases: starAliases({ flam: '61', con: 'Cyg' }) }]);
  for (const q of ['alpha cen', 'Alpha Centauri', 'α Cen', 'rigil', 'hd 128620', 'hip 71683']) assert.equal(search(s, q)[0]?.id, 'x', q);
  assert.equal(search(s, '61 cygni')[0]?.id, 'y');
});

test('groupHits keeps the best kind first and caps each group', () => {
  const g = groupHits(top('europa', 20), 2);
  assert.equal(g[0].kind, 'body');
  assert.ok(g.every((x) => x.hits.length <= 2));
});
