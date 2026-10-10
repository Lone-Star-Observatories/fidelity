import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mfcc, dtw, createEndpointer, resampler, RATE } from '../src/voice/wake.js';

// A synthetic "word": a few formant-like tones with a pitch glide, and a different one.
const word = (f0, f1, len = 0.6, noise = 0, seed = 1) => {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  return Float32Array.from({ length: Math.round(len * RATE) }, (_, i) => {
    const t = i / RATE, env = Math.sin((Math.PI * t) / len);
    return env * (0.4 * Math.sin(2 * Math.PI * (f0 + 200 * t) * t) + 0.25 * Math.sin(2 * Math.PI * f1 * t)) + noise * rnd();
  });
};

test('DTW: a word matches a noisy, slower copy of itself better than a different word', () => {
  const a = mfcc(word(300, 1200)), slow = mfcc(word(300, 1200, 0.75, 0.02, 7)), other = mfcc(word(700, 2600));
  assert.ok(dtw(a, a) < 1e-9);
  assert.ok(dtw(a, slow) < dtw(a, other) * 0.7, `${dtw(a, slow).toFixed(2)} vs ${dtw(a, other).toFixed(2)}`);
});

test('the endpointer cuts one utterance out of silence', () => {
  const got = [];
  const ep = createEndpointer((u) => got.push(u.length / RATE));
  const quiet = new Float32Array(RATE * 0.5).map(() => (Math.random() - 0.5) * 1e-4);
  for (const chunk of [quiet, word(300, 1200, 0.6), quiet, quiet]) for (let i = 0; i < chunk.length; i += 320) ep.push(chunk.subarray(i, i + 320));
  assert.equal(got.length, 1);
  assert.ok(Math.abs(got[0] - 0.6) < 0.15, `${got[0]} s`);
});

test("the resampler keeps a tone's frequency (48 → 16 kHz)", () => {
  const rs = resampler(48000, 16000), out = [];
  const tone = Float32Array.from({ length: 48000 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
  for (let i = 0; i < tone.length; i += 128) out.push(...rs(tone.subarray(i, i + 128)));
  assert.ok(Math.abs(out.length - 16000) <= 2, `${out.length} samples`);
  let crossings = 0; for (let i = 1; i < out.length; i++) if (out[i - 1] < 0 && out[i] >= 0) crossings++;
  assert.ok(Math.abs(crossings - 440) <= 2, `${crossings} cycles`);
});

import { parseCommand, pcm16Base64, base64Pcm16 } from '../src/voice/computer.js';
globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');

test('offline navigation commands parse', () => {
  const names = [{ name: 'Mars' }, { name: 'Europa' }, { name: 'Proxima Centauri' }];
  assert.equal(parseCommand('Computer, go to Europa', names).target.name, 'Europa');
  assert.equal(parseCommand('set course for proxima centauri', names).target.name, 'Proxima Centauri');
  assert.deepEqual(parseCommand('show the Van Allen belts', names), { action: 'layer', layer: 'zones', on: true });
  assert.deepEqual(parseCommand('show the asteroid belts', names), { action: 'layer', layer: 'belts', on: true });
  assert.deepEqual(parseCommand('hide the orbits', names), { action: 'layer', layer: 'orbits', on: false });
  assert.equal(parseCommand('stop', names).action, 'stop');
  assert.equal(parseCommand('what is the weather', names), null);
});

test('PCM16 base64 round-trips audio', () => {
  const x = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10) * 0.8);
  const y = base64Pcm16(pcm16Base64(x));
  assert.equal(y.length, x.length);
  assert.ok(Math.max(...x.map((v, i) => Math.abs(v - y[i]))) < 1e-4);
});
