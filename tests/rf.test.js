import test from 'node:test';
import assert from 'node:assert/strict';
import { kiwiTag, parseKiwiMsg, parseKiwiSnd, parseKiwiWf, passband, kiwiTuneCommands, findSignals, parseFrequency, formatFrequency, bandName, suggestMode, icySplitter, stationMedia } from '../src/data/rf.js';

const enc = (s) => new TextEncoder().encode(s);

test('Kiwi MSG frames', () => {
  const { tag, body } = kiwiTag(enc('MSG audio_rate=12000 bandwidth=30000000 too_busy=1 name=Wessex%20KiWi'));
  assert.equal(tag, 'MSG');
  const m = parseKiwiMsg(body);
  assert.equal(m.audio_rate, '12000');
  assert.equal(m.bandwidth, '30000000');
  assert.equal(m.name, 'Wessex KiWi');
});

test('Kiwi SND frames: sequence, S-meter, big-endian PCM', () => {
  const b = new Uint8Array(3 + 7 + 6);
  b.set(enc('SND'));
  const dv = new DataView(b.buffer);
  dv.setUint8(3, 0); dv.setUint32(4, 42, true); dv.setUint16(8, 1000, false); // RSSI = 100 − 127 = −27 dBm
  dv.setInt16(10, 1234, false); dv.setInt16(12, -2, false); dv.setInt16(14, 32767, false);
  const { tag, body } = kiwiTag(b);
  assert.equal(tag, 'SND');
  const s = parseKiwiSnd(body);
  assert.equal(s.seq, 42);
  assert.ok(Math.abs(s.rssi + 27) < 1e-9);
  assert.deepEqual([...s.samples], [1234, -2, 32767]);
});

test('Kiwi W/F frames: bins to dBm', () => {
  const b = new Uint8Array(3 + 13 + 4);
  b.set(enc('W/F'));
  const dv = new DataView(b.buffer);
  dv.setUint32(4, 0, true); dv.setUint32(8, 0, true); dv.setUint32(12, 7, true);
  b.set([255, 155, 100, 0], 16);
  const w = parseKiwiWf(kiwiTag(b).body);
  assert.equal(w.seq, 7);
  assert.deepEqual([...w.db], [0, -100, -155, -255]);
});

test('passbands and tuning commands', () => {
  assert.deepEqual(passband('usb', 2400), { low: 300, high: 2700 });
  assert.deepEqual(passband('lsb', 2400), { low: -2700, high: -300 });
  assert.deepEqual(passband('am', 9800), { low: -4900, high: 4900 });
  const c = kiwiTuneCommands({ freqHz: 7074000, mode: 'usb', bwHz: 2400, agc: 'slow' });
  assert.equal(c[0], 'SET mod=usb low_cut=300 high_cut=2700 freq=7074.000');
  assert.match(c[1], /^SET agc=1 hang=1 .*decay=2000/);
});

test('findSignals picks carriers out of the noise floor', () => {
  const n = 1024, db = new Float32Array(n);
  for (let i = 0; i < n; i++) db[i] = -110 + Math.sin(i * 12.9898) * 2; // noise around −110
  db[100] = -60; db[101] = -65; // a strong carrier
  db[600] = -90; // a weak one (20 dB up)
  db[900] = -105; // too weak
  const s = findSignals(db, { startHz: 0, spanHz: 30e6, snrDb: 12 });
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].freqHz - 100.5 * (30e6 / n)) < 30e6 / n);
  assert.ok(s[0].snr > s[1].snr);
  assert.ok(Math.abs(s[1].freqHz - 600.5 * (30e6 / n)) < 30e6 / n);
});

test('frequencies: parse, format, band, mode', () => {
  assert.equal(parseFrequency('7074'), 7074000);
  assert.equal(parseFrequency('7.074 MHz'), 7074000);
  assert.equal(parseFrequency('198 kHz'), 198000);
  assert.equal(parseFrequency('nonsense'), null);
  assert.equal(formatFrequency(7074000), '7.074 000 MHz');
  assert.equal(formatFrequency(198000), '198.000 kHz');
  assert.equal(bandName(7074000), '40 m AMATEUR');
  assert.equal(bandName(9.6e6), '31 m BROADCAST');
  assert.equal(suggestMode(7074000), 'lsb');
  assert.equal(suggestMode(14074000), 'usb');
  assert.equal(suggestMode(9.6e6), 'am');
  assert.equal(suggestMode(98.1e6), 'wbfm');
});

test('ICY metadata is stripped from the audio and titles reported', () => {
  const titles = [];
  const split = icySplitter(4, (t) => titles.push(t));
  const meta = enc("StreamTitle='Artist - Song';");
  const block = new Uint8Array(Math.ceil(meta.length / 16) * 16); block.set(meta);
  const stream = new Uint8Array([1, 2, 3, 4, block.length / 16, ...block, 5, 6, 7, 8, 0, 9, 10]);
  // feed in awkward chunks
  const out = [];
  for (const [a, b] of [[0, 3], [3, 9], [9, 30], [30, stream.length]]) out.push(...split(stream.subarray(a, b)));
  assert.deepEqual(out, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(titles, ['Artist - Song']);
});

test('what a station can put on screen', () => {
  assert.deepEqual(stationMedia('radio', [0, 0, 'R', 'https://home', '', 'https://stream']), { video: null, audio: true, stream: 'https://stream' });
  assert.equal(stationMedia('traffic', [0, 0, 'Cam', 'https://img.jpg', '', 'https://clip.mp4']).video, 'mp4');
  assert.equal(stationMedia('traffic', [0, 0, 'Cam', 'https://img.jpg', '', 'https://x.m3u8']).video, 'image');
  assert.equal(stationMedia('windy', [0, 0, 'W', 'https://page', '', null]).video, null);
  assert.equal(stationMedia('video', [0, 0, 'V', 'https://page', '', null, { youtube: 'abc' }]).video, 'youtube');
});
