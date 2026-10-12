// COMMS transmission (#69): band plan, licence gate, FM modulator, CW ID, timeout, and the
// transmit route — all against fakes. Nothing here runs hackrf_transfer or bladeRF-cli.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { TX, parseHailingFrequency, checkBand, formatBands, validCallsign, txGate, txClock, cwKeying, cwUnits, cwAudio, dotMs, clampGain, clampTimeoutS, DEFAULT_ANTENNAS, antennaCheck, describeAntennaBands } from '../src/data/tx.js';
import { toDeviceHz, toAntennaHz, antennaRange, converting, converterAllowsTx, normalizeConverter, CONVERTER_TX_REASON } from '../src/data/converter.js';
import { createFmModulator, createAudioChain } from '../server/fm.js';
import { txCommand, createTxSession, loopbackRequest, handleTxUpgrade, _resetActive } from '../server/tx.js';
import { txDevices } from '../server/rf.js';
import { parseCommand } from '../src/voice/computer.js';
import { decimateIq, instFreq, powerSpectrum, occupiedBandwidth, lcg } from './helpers/fm-measure.js';

const tone = (hz, amp, n, rate = TX.audioRate) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));
const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const DEC = 50, FS = TX.iqRate / DEC; // 40 kHz complex after decimation

// ---- band plan ------------------------------------------------------------------------------------
test('hailing frequencies: three digits are MHz, decimals accepted (#69)', () => {
  assert.equal(parseHailingFrequency('146'), 146e6);
  assert.equal(parseHailingFrequency('146.52'), 146.52e6);
  assert.equal(parseHailingFrequency('146 point 52'), 146.52e6);
  assert.equal(parseHailingFrequency('146.520 MHz'), 146.52e6);
  assert.equal(parseHailingFrequency(' 446.000 megahertz'), 446e6);
  for (const bad of ['99', '1460', '14.6', '', 'one four six', '146..5', null]) assert.equal(parseHailingFrequency(bad), null, String(bad));
});

test('band plan: amateur 2 m and 70 cm only, by ITU region, the whole FM signal inside (#69)', () => {
  assert.equal(formatBands(2), '144–148 MHz (2 m), 420–450 MHz (70 cm)');
  assert.equal(formatBands(1), '144–146 MHz (2 m), 430–440 MHz (70 cm)');
  assert.equal(TX.carsonHz, 11000); // 2 × (2.5 kHz + 3 kHz)
  assert.equal(checkBand(146e6, 2).ok, true);
  assert.equal(checkBand(146.52e6, 2).band.name, '2 m');
  assert.equal(checkBand(446e6, 2).band.name, '70 cm');
  assert.equal(checkBand(425e6, 2).ok, true);
  // outside: refused, with the allowed ranges
  const fm = checkBand(100.1e6, 2);
  assert.equal(fm.ok, false);
  assert.match(fm.reason, /144–148 MHz \(2 m\), 420–450 MHz \(70 cm\)/);
  assert.equal(checkBand(150e6, 2).ok, false);
  // edges: the signal is 11 kHz wide, so the carrier must sit 5.5 kHz inside
  assert.match(checkBand(144e6, 2).reason, /band edge/);
  assert.equal(checkBand(144.0055e6, 2).ok, true);
  assert.equal(checkBand(147.995e6, 2).ok, false);
  // Region 1: 2 m stops at 146, 70 cm is 430–440
  assert.equal(checkBand(146e6, 1).ok, false);
  assert.equal(checkBand(147e6, 1).ok, false);
  assert.match(checkBand(147e6, 1).reason, /144–146 MHz \(2 m\), 430–440 MHz \(70 cm\)/);
  assert.equal(checkBand(425e6, 1).ok, false);
  assert.equal(checkBand(433.5e6, 1).ok, true);
  // allowed, but the voluntary band plan keeps satellites free of FM voice: a note, not a refusal
  assert.match(checkBand(145.9e6, 2).note, /satellite/);
  assert.equal(checkBand(146.52e6, 2).note, null);
  assert.equal(checkBand(NaN, 2).ok, false);
});

test('callsigns: plausible ITU forms only (not a licence check) (#69)', () => {
  for (const ok of ['W1AW', 'k1abc', 'G4ABC', 'VK2XYZ', '2E0ABC', 'M0ABC/P', 'DL/W1AW', 'JA1ABC', '3DA0RS']) assert.ok(validCallsign(ok), ok);
  for (const bad of ['', 'ABC', '12345', 'HELLO', 'W1', '1AW', 'W1AW!!']) assert.ok(!validCallsign(bad), bad);
});

test('the gate: no device, no tool, no callsign, no attestation, out of band → refused (#69)', () => {
  const hack = txDevices({ hackN: 1, tools: { hackrf_transfer: true } });
  const ok = { devices: hack, callsign: 'W1AW', attested: true, freqHz: 146e6, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow' };
  assert.equal(txGate(ok).ok, true);
  assert.equal(txGate(ok).device.driver, 'hackrf');
  assert.equal(txGate({ ...ok, devices: [] }).code, 'no-device');
  assert.match(txGate({ ...ok, devices: [] }).reason, /RTL-SDR only receives/);
  assert.equal(txGate({ ...ok, devices: txDevices({ hackN: 1, tools: {} }) }).code, 'no-tool');
  assert.equal(txGate({ ...ok, callsign: '' }).code, 'no-callsign');
  assert.match(txGate({ ...ok, callsign: '  ' }).reason, /callsign in TRANSMIT SETUP/);
  assert.equal(txGate({ ...ok, callsign: 'HELLO' }).code, 'bad-callsign');
  assert.equal(txGate({ ...ok, attested: false }).code, 'no-attestation');
  assert.equal(txGate({ ...ok, attested: 'yes' }).code, 'no-attestation'); // only literally true
  assert.equal(txGate({ ...ok, freqHz: 98.1e6 }).code, 'out-of-band');
  // an RTL-SDR is never in the transmit list
  assert.deepEqual(txDevices({ tools: { rtl_fm: true } }), []);
  assert.equal(txGate({ ...ok, devices: txDevices({ bladeN: 1, tools: { bladeRF_cli: true } }) }).device.driver, 'bladerf');
  // the simulated device exists only when asked for
  assert.equal(txDevices({ fake: true })[0].driver, 'fake');
  assert.equal(clampGain(47), TX.maxGainDb);
  assert.equal(clampGain(-5), 0);
  assert.equal(clampTimeoutS(5), TX.minTimeoutS);
  assert.equal(clampTimeoutS(7200), TX.maxTimeoutS);
  assert.equal(clampTimeoutS(undefined), 180);
});

test('voice: "open a hailing frequency 146" and "close hailing frequency" (#69)', () => {
  assert.deepEqual(parseCommand('Computer, open a hailing frequency 146', []), { action: 'comms', command: 'open_hailing', frequency: '146' });
  assert.deepEqual(parseCommand('open hailing frequency on 146.52 megahertz', []), { action: 'comms', command: 'open_hailing', frequency: '146.52' });
  assert.deepEqual(parseCommand('open hailing frequencies', []), { action: 'comms', command: 'open_hailing', frequency: '' });
  assert.deepEqual(parseCommand('close hailing frequency', []), { action: 'comms', command: 'close_hailing' });
  assert.deepEqual(parseCommand('Computer, close the hailing frequencies', []), { action: 'comms', command: 'close_hailing' });
  // the receive commands still parse as before
  assert.equal(parseCommand('close channel', []).command, 'close_channel');
  assert.equal(parseCommand('open channel 7.074 mhz', []).command, 'tune');
});

// ---- timing ---------------------------------------------------------------------------------------
test('timeout and ID clock (#69)', () => {
  const t0 = 1_000_000, timeoutMs = 180_000;
  assert.deepEqual(txClock({ startedAt: t0, timeoutMs, now: t0 + 60_000 }), { elapsedMs: 60_000, remainingMs: 120_000, timedOut: false, idDue: false });
  assert.equal(txClock({ startedAt: t0, timeoutMs, now: t0 + 179_999 }).timedOut, false);
  assert.equal(txClock({ startedAt: t0, timeoutMs, now: t0 + 180_000 }).timedOut, true);
  assert.equal(txClock({ startedAt: t0, timeoutMs: 600_000, now: t0 + 599_999 }).idDue, false);
  assert.equal(txClock({ startedAt: t0, timeoutMs: 600_000, now: t0 + 600_000 }).idDue, true);
  assert.equal(txClock({ startedAt: t0, lastIdAt: t0 + 600_000, timeoutMs: 900_000, now: t0 + 900_000 }).idDue, false);
});

test('CW ID: PARIS timing at 20 wpm, 800 Hz, clean keying (#69)', () => {
  assert.equal(dotMs(20), 60);
  // PARIS (with its word gap) is the 50-unit standard word: 3.0 s at 20 wpm
  assert.equal(cwUnits(cwKeying('PARIS')), 50);
  assert.equal(cwAudio('PARIS').length, 3 * TX.audioRate);
  // E is one dot: on 1, then the 7-unit word gap
  assert.deepEqual(cwKeying('E'), [[true, 1], [false, 7]]);
  assert.deepEqual(cwKeying('W1').slice(0, 7), [[true, 1], [false, 1], [true, 3], [false, 1], [true, 3], [false, 3], [true, 1]]);
  // the audio follows the keying: W1AW starts with a 60 ms dot, a 60 ms gap, then a 180 ms dash
  const a = cwAudio('W1AW'), ms = (t) => Math.round((t / 1000) * TX.audioRate);
  const rms = (from, to) => Math.sqrt(a.subarray(ms(from), ms(to)).reduce((s, v) => s + v * v, 0) / (ms(to) - ms(from)));
  assert.ok(rms(10, 50) > 0.35, 'dot keyed');
  assert.equal(rms(62, 118), 0, 'gap silent');
  assert.ok(rms(130, 230) > 0.4, 'dash keyed');
  // 5 ms raised-cosine edges: no step at key-down
  assert.ok(Math.abs(a[1]) < 0.01);
  // tone: 800 Hz by zero crossings inside the dash
  const dash = a.subarray(ms(130), ms(230));
  let z = 0; for (let i = 1; i < dash.length; i++) if ((dash[i - 1] < 0) !== (dash[i] < 0)) z++;
  assert.ok(Math.abs(z / 2 / 0.1 - 800) < 15, `${z / 2 / 0.1} Hz`);
  assert.equal(cwUnits(cwKeying('DL/W1AW')) > cwUnits(cwKeying('W1AW')), true); // "/" is sent
});

// ---- the modulator --------------------------------------------------------------------------------
function measure(iq, format = 'int8') {
  const d = decimateIq(iq.subarray(Math.floor(iq.length / 4) & ~3), DEC, format);
  return { peakHz: peak(instFreq(d, FS)), obwHz: occupiedBandwidth(powerSpectrum(d, 4096), FS) };
}

test('FM: a full-scale 1 kHz tone deviates ±2.5 kHz (instantaneous frequency of the IQ) (#69)', () => {
  const m = createFmModulator();
  const iq = m.modulate(tone(1000, 1, TX.audioRate));
  assert.equal(iq.length, TX.audioRate * (TX.iqRate / TX.audioRate) * 2); // int8 I,Q at 2 Msps
  const r = measure(iq);
  assert.ok(Math.abs(r.peakHz - 2500) < 2500 * 0.03, `peak deviation ${r.peakHz.toFixed(0)} Hz`);
  // half scale → half the deviation (linear below the limiter)
  const h = measure(createFmModulator().modulate(tone(1000, 0.5, TX.audioRate)));
  assert.ok(Math.abs(h.peakHz - 1250) < 1250 * 0.03, `half-scale ${h.peakHz.toFixed(0)} Hz`);
  // the bladeRF format carries the same signal
  const s = measure(createFmModulator({ format: 'sc16q11' }).modulate(tone(1000, 1, TX.audioRate)), 'sc16q11');
  assert.ok(Math.abs(s.peakHz - 2500) < 2500 * 0.03);
  // constant envelope: |IQ| stays at the set level (127 × 0.9)
  const i8 = new Int8Array(iq.buffer, iq.byteOffset, iq.length);
  for (let k = 0; k < 2000; k += 2) assert.ok(Math.abs(Math.hypot(i8[k], i8[k + 1]) - 114.3) < 1.2);
});

test('FM: occupied bandwidth stays within Carson\'s 11 kHz (≈10 kHz NFM channel) (#69)', () => {
  // speech-like worst case: full-scale wideband noise, so every audio frequency is at the limiter
  const r = lcg(3), noise = Float32Array.from({ length: TX.audioRate }, () => r());
  const n = measure(createFmModulator().modulate(noise));
  assert.ok(n.obwHz <= TX.carsonHz, `99% occupied bandwidth ${n.obwHz.toFixed(0)} Hz`);
  assert.ok(n.obwHz >= 6000, `99% occupied bandwidth ${n.obwHz.toFixed(0)} Hz`);
  // a 1 kHz tone at full deviation (β = 2.5): sidebands to ±4 kHz hold 99%
  assert.ok(measure(createFmModulator().modulate(tone(1000, 1, TX.audioRate))).obwHz <= 8500);
});

test('FM: the limiter never over-deviates, however hard the mic is driven (#69)', () => {
  const r = lcg(9), loud = Float32Array.from({ length: TX.audioRate }, () => 10 * r());
  const chain = createAudioChain();
  assert.ok(peak(chain.process(loud)) <= 1, 'modulating signal clipped to full deviation');
  const m = measure(createFmModulator().modulate(loud));
  assert.ok(m.peakHz <= 2500 * 1.02, `peak ${m.peakHz.toFixed(0)} Hz`);
  assert.ok(m.obwHz <= TX.carsonHz, `obw ${m.obwHz.toFixed(0)} Hz`);
  // a square wave (rich in harmonics) too
  const sq = Float32Array.from(tone(700, 1, TX.audioRate), (v) => (v >= 0 ? 3 : -3));
  assert.ok(measure(createFmModulator().modulate(sq)).peakHz <= 2500 * 1.02);
  // band limits: 100 Hz hum and 6 kHz hiss are strongly cut, 1 kHz passes
  assert.ok(chain.response(100) < 0.05);
  assert.ok(chain.response(6000) < 0.25);
  assert.ok(Math.abs(chain.response(1000) - 1) < 1e-9);
  assert.ok(chain.response(2000) > chain.response(1000) * 1.5, 'pre-emphasis rises with frequency');
});

// ---- the transmitter process ----------------------------------------------------------------------
test('command lines: hackrf_transfer from stdin, low gain, amp off; bladeRF-cli; capped (#69)', () => {
  assert.deepEqual(txCommand('hackrf', { freqHz: 146.52e6, gainDb: 0 }), { cmd: 'hackrf_transfer', format: 'int8', args: ['-t', '-', '-f', '146520000', '-s', '2000000', '-b', '1750000', '-x', '0', '-a', '0'] });
  assert.deepEqual(txCommand('hackrf', { freqHz: 146e6, gainDb: 47 }).args.slice(-4), ['-x', '20', '-a', '0']);
  const b = txCommand('bladerf', { freqHz: 446e6, gainDb: 99 });
  assert.equal(b.cmd, 'bladeRF-cli');
  assert.equal(b.format, 'sc16q11');
  assert.match(b.args[1], /set frequency tx 446000000; set samplerate tx 2000000; .*set gain tx 20; tx config file=\/dev\/stdin format=bin .*; tx start; tx wait/);
  assert.ok(txCommand('rtl', { freqHz: 146e6 }).error);
});

function fakeClock(t = 1_000_000) {
  let timers = [];
  return {
    now: () => t,
    setTimeout(f, ms) { const h = { at: t + ms, f }; timers.push(h); return h; },
    clearTimeout(h) { timers = timers.filter((x) => x !== h); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const h = timers[0];
        if (!h || h.at > end) break;
        timers.shift(); t = h.at; h.f();
      }
      t = end;
    },
  };
}
function fakeSpawn() {
  const calls = [];
  const spawn = (cmd, args) => {
    const p = new EventEmitter();
    p.chunks = []; p.ended = false; p.killed = null;
    p.stdin = new Writable({ write(c, _e, cb) { p.chunks.push(c); cb(); } });
    p.stdin.on('finish', () => { p.ended = true; setImmediate(() => p.emit('close', 0)); });
    p.stderr = new EventEmitter();
    p.kill = (sig) => { p.killed = sig; setImmediate(() => p.emit('close', null)); };
    calls.push({ cmd, args, proc: p });
    return p;
  };
  return { spawn, calls };
}
const tick = () => new Promise((r) => setImmediate(r));
const pcm16 = (x) => { const b = Buffer.alloc(x.length * 2); x.forEach((v, i) => b.writeInt16LE(Math.round(v * 32767), i * 2)); return b; };

test('session: mic audio streams to hackrf_transfer stdin as FM IQ, paced in real time (#69)', async () => {
  const { spawn, calls } = fakeSpawn(), clock = fakeClock(), events = [];
  const s = createTxSession({ driver: 'hackrf', freqHz: 146.52e6, callsign: 'W1AW', spawn, clock, onEvent: (e) => events.push(e) });
  assert.equal(calls[0].cmd, 'hackrf_transfer');
  assert.deepEqual(calls[0].args.slice(0, 4), ['-t', '-', '-f', '146520000']);
  const t = tone(1000, 1, TX.audioRate);
  for (let i = 0; i < 50; i++) { s.pushAudio(pcm16(t.subarray(i * 320, i * 320 + 320))); clock.advance(20); }
  const iq = Buffer.concat(calls[0].proc.chunks);
  const produced = iq.length / 250; // audio samples: 125 IQ × 2 bytes each
  assert.ok(produced >= TX.audioRate && produced <= TX.audioRate + 0.25 * TX.audioRate, `${produced} samples for 1 s`);
  const d = decimateIq(iq.subarray(iq.length - 200_000 * 2), DEC);
  assert.ok(Math.abs(peak(instFreq(d, FS)) - 2500) < 100);
  assert.equal(s.info().state, 'tx');
  assert.ok(events.some((e) => e.type === 'state' && e.freqHz === 146.52e6 && e.callsign === 'W1AW'));
});

// a cheap modulator for the timing tests: one byte per audio sample, raw (CW) blocks marked 1
const countingMod = () => ({ modulate: (x, { raw } = {}) => Buffer.alloc(x.length, raw ? 1 : 0) });

test('session: the timeout closes it, the CW ID goes out, then the transmitter is released (#69)', async () => {
  const { spawn, calls } = fakeSpawn(), clock = fakeClock(), events = [];
  const s = createTxSession({ driver: 'hackrf', freqHz: 146e6, callsign: 'W1AW', timeoutS: 180, spawn, clock, modulator: countingMod, onEvent: (e) => events.push(e) });
  const p = calls[0].proc;
  for (let i = 0; i < 179; i++) { s.pushAudio(pcm16(new Float32Array(16000))); clock.advance(1000); }
  assert.equal(s.info().state, 'tx');
  assert.equal(p.chunks.flatMap((c) => [...c]).filter((v) => v === 1).length, 0, 'no ID yet');
  s.pushAudio(pcm16(new Float32Array(16000))); clock.advance(1000);
  assert.equal(s.info().state, 'closing');
  assert.equal(s.info().reason, 'timeout');
  clock.advance(10_000);
  await tick(); await tick();
  assert.ok(p.ended, 'stdin closed after the ID');
  const idSamples = Buffer.concat(p.chunks).filter((v) => v === 1).length;
  assert.equal(idSamples, cwAudio('W1AW').length, 'the whole callsign in CW');
  // the ID is the last thing sent
  const all = Buffer.concat(p.chunks);
  assert.equal(all[all.length - 1], 1);
  const closed = events.find((e) => e.type === 'closed');
  assert.equal(closed.reason, 'timeout');
  assert.equal(closed.idSent, true);
});

test('session: operator close, silence and device failure (#69)', async () => {
  { // operator: ID then release
    const { spawn, calls } = fakeSpawn(), clock = fakeClock(), events = [];
    const s = createTxSession({ driver: 'hackrf', freqHz: 146e6, callsign: 'K1ABC', spawn, clock, modulator: countingMod, onEvent: (e) => events.push(e) });
    s.pushAudio(pcm16(new Float32Array(3200))); clock.advance(200);
    s.close('operator');
    s.pushAudio(pcm16(new Float32Array(3200))); // ignored once closing: the mic is off
    clock.advance(10_000); await tick(); await tick();
    assert.equal(Buffer.concat(calls[0].proc.chunks).filter((v) => v === 1).length, cwAudio('K1ABC').length);
    assert.deepEqual(events.filter((e) => e.type === 'closed').map((e) => [e.reason, e.idSent]), [['operator', true]]);
  }
  { // no microphone frames for 15 s → close (with ID)
    const { spawn } = fakeSpawn(), clock = fakeClock(), events = [];
    createTxSession({ driver: 'hackrf', freqHz: 146e6, callsign: 'K1ABC', spawn, clock, modulator: countingMod, onEvent: (e) => events.push(e) });
    clock.advance(16_000); clock.advance(10_000); await tick(); await tick();
    assert.equal(events.find((e) => e.type === 'closed').reason, 'no-audio');
  }
  { // the tool dies mid-transmission → reported, no claim of an ID
    const { spawn, calls } = fakeSpawn(), clock = fakeClock(), events = [];
    createTxSession({ driver: 'hackrf', freqHz: 146e6, callsign: 'K1ABC', spawn, clock, modulator: countingMod, onEvent: (e) => events.push(e) });
    calls[0].proc.stderr.emit('data', 'hackrf_open() failed: HACKRF_ERROR_NOT_FOUND (-5)\n');
    calls[0].proc.emit('close', 1);
    const c = events.find((e) => e.type === 'closed');
    assert.equal(c.reason, 'device');
    assert.equal(c.idSent, false);
    assert.match(c.error, /NOT_FOUND/);
  }
});

test('session: a long transmission sends an ID every 10 minutes, then the mic is back on (#69)', () => {
  const { spawn, calls } = fakeSpawn(), clock = fakeClock();
  const s = createTxSession({ driver: 'hackrf', freqHz: 146e6, callsign: 'W1AW', timeoutS: 1200, spawn, clock, modulator: countingMod });
  const ids = () => Buffer.concat(calls[0].proc.chunks).filter((v) => v === 1).length;
  for (let i = 0; i < 599; i++) { s.pushAudio(pcm16(new Float32Array(16000))); clock.advance(1000); }
  assert.equal(ids(), 0);
  for (let i = 0; i < 10; i++) { s.pushAudio(pcm16(new Float32Array(16000))); clock.advance(1000); }
  assert.equal(ids(), cwAudio('W1AW').length, 'one whole ID at 10 minutes');
  assert.equal(s.info().state, 'tx', 'still transmitting');
  assert.equal(s.info().ids, 1);
  const before = Buffer.concat(calls[0].proc.chunks).length;
  for (let i = 0; i < 5; i++) { s.pushAudio(pcm16(new Float32Array(16000))); clock.advance(1000); }
  assert.ok(Buffer.concat(calls[0].proc.chunks).length > before + 4 * 16000, 'voice resumes');
  assert.equal(ids(), cwAudio('W1AW').length, 'no second ID until another 10 minutes');
});

// ---- the route --------------------------------------------------------------------------------------
test('loopback only: peer, Host and Origin must all be this machine (#69)', () => {
  const req = (remoteAddress, host, origin) => ({ socket: { remoteAddress }, headers: { host, ...(origin ? { origin } : {}) } });
  assert.equal(loopbackRequest(req('127.0.0.1', '127.0.0.1:4011', 'http://127.0.0.1:4011')), true);
  assert.equal(loopbackRequest(req('::1', 'localhost:4011')), true);
  assert.equal(loopbackRequest(req('::ffff:127.0.0.1', '127.0.0.1:4011', 'http://localhost:5173')), true); // vite dev proxy
  assert.equal(loopbackRequest(req('192.168.1.20', '127.0.0.1:4011')), false);
  assert.equal(loopbackRequest(req('127.0.0.1', 'evil.example:4011', 'http://evil.example:4011')), false); // DNS rebinding
  assert.equal(loopbackRequest(req('127.0.0.1', '127.0.0.1:4011', 'https://evil.example')), false);
});

async function withTxServer(deps, fn) {
  const srv = http.createServer(), sockets = new Set();
  srv.on('upgrade', (req, socket) => { sockets.add(socket); handleTxUpgrade(req, socket, deps); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${srv.address().port}/api/rf/tx`;
  try { await fn(url); } finally { for (const s of sockets) s.destroy(); srv.close(); _resetActive(); } // no lingering handle keeps the test process alive
}
function wsClient(url) {
  const ws = new WebSocket(url), inbox = [], waiters = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); inbox.push(m); for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); } };
  const next = (pred, ms = 8000) => {
    const hit = inbox.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`no matching message in ${ms} ms; got ${JSON.stringify(inbox.map((m) => [m.type, m.state ?? m.code ?? m.reason]))}`)), ms);
      waiters.push({ pred, res: (m) => { clearTimeout(t); res(m); } });
    });
  };
  return { ws, inbox, next, open: new Promise((r) => { ws.onopen = r; }) };
}

test('ws /api/rf/tx refuses without a device, a callsign, the attestation or an amateur frequency (#69)', async () => {
  let devices = [];
  await withTxServer({ devices: async () => devices }, async (url) => {
    const c = wsClient(url);
    await c.open;
    const ask = async (m) => { c.inbox.length = 0; c.ws.send(JSON.stringify({ type: 'open', ...m })); return c.next((x) => x.type === 'refused' || x.type === 'open'); };
    const good = { freqHz: 146e6, callsign: 'W1AW', attested: true, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow' };
    assert.equal((await ask(good)).code, 'no-device');
    devices = txDevices({ hackN: 1, tools: {} });
    assert.equal((await ask(good)).code, 'no-tool');
    devices = txDevices({ hackN: 1, tools: { hackrf_transfer: true } });
    assert.equal((await ask({ ...good, callsign: '' })).code, 'no-callsign');
    assert.equal((await ask({ ...good, attested: false })).code, 'no-attestation');
    const r = await ask({ ...good, freqHz: 162.4e6 });
    assert.equal(r.code, 'out-of-band');
    assert.match(r.reason, /144–148 MHz/);
    assert.equal((await ask({ ...good, converter: { kind: 'hamitup' } })).code, 'converter');
    assert.equal((await ask({ ...good, antennaId: 'loop' })).code, 'antenna');
    c.ws.close();
  });
});

test('ws /api/rf/tx: a simulated device opens, takes mic audio, closes with the ID (#69)', async () => {
  const t0 = Date.now(), fast = { now: () => t0 + (Date.now() - t0) * 40, setTimeout: (f, ms) => setTimeout(f, ms / 40), clearTimeout: (h) => clearTimeout(h) };
  await withTxServer({ devices: async () => txDevices({ fake: true }), clock: fast }, async (url) => {
    const c = wsClient(url);
    await c.open;
    c.ws.send(JSON.stringify({ type: 'open', freqHz: 146.52e6, callsign: 'W1AW', attested: true, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow', converter: { kind: 'hamitup', bypass: true } }));
    const o = await c.next((m) => m.type === 'open' || m.type === 'refused');
    assert.equal(o.type, 'open', o.reason);
    assert.equal(o.fake, true);
    assert.equal(o.antenna, 'Arrow (dual-band Yagi)');
    assert.equal(o.directional, true);
    // a second transmitter cannot open while this one runs
    const c2 = wsClient(url); await c2.open;
    c2.ws.send(JSON.stringify({ type: 'open', freqHz: 146.52e6, callsign: 'W1AW', attested: true, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow', converter: { kind: 'hamitup', bypass: true } }));
    assert.equal((await c2.next((m) => m.type === 'refused')).code, 'busy');
    c2.ws.close();
    c.ws.send(pcm16(tone(1000, 0.8, 3200)));
    const st = await c.next((m) => m.type === 'state' && m.bytes > 0);
    assert.equal(st.state, 'tx');
    c.ws.send(JSON.stringify({ type: 'close' }));
    const closed = await c.next((m) => m.type === 'closed');
    assert.equal(closed.reason, 'operator');
    assert.equal(closed.idSent, true);
    c.ws.close();
  });
});

// ---- the owner's station: bladeRF, a Ham It Up converter, antenna profiles ------------------------
test('bladeRF is the primary transmitter; the x40/x115 cannot reach 2 m without the XB-200 (#69)', () => {
  const both = txDevices({ hackN: 1, bladeN: 1, bladeModel: '2.0', tools: { hackrf_transfer: true, bladeRF_cli: true } });
  assert.deepEqual(both.map((d) => d.driver), ['bladerf', 'hackrf']);
  assert.equal(both[0].label, 'bladeRF 2.0 micro');
  const ok = { callsign: 'W1AW', attested: true, freqHz: 146.52e6, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow' };
  assert.equal(txGate({ ...ok, devices: both }).device.driver, 'bladerf');
  const x40 = txDevices({ bladeN: 1, bladeModel: '1', tools: { bladeRF_cli: true } });
  const r = txGate({ ...ok, devices: x40 });
  assert.equal(r.code, 'device-range');
  assert.match(r.reason, /XB-200/);
  assert.equal(txGate({ ...ok, devices: x40, freqHz: 446e6 }).ok, true);
  // the bladeRF command: SC16 Q11 from stdin at 2 Msps, gain capped
  const b = txCommand('bladerf', { freqHz: 146.52e6, gainDb: 0 });
  assert.match(b.args[1], /^set frequency tx 146520000; set samplerate tx 2000000; set bandwidth tx 1500000; set gain tx 0; tx config file=\/dev\/stdin format=bin/);
});

test('Ham It Up: receive tunes antenna + 125 MHz, shows the antenna side; bypass passes straight through (#69)', () => {
  const hiu = { kind: 'hamitup' };
  assert.equal(converting(hiu), true);
  assert.equal(normalizeConverter(hiu).loHz, 125e6);
  assert.equal(toDeviceHz(7.074e6, hiu), 132.074e6);
  assert.equal(toAntennaHz(132.074e6, hiu), 7.074e6);
  assert.deepEqual(antennaRange([24e6, 1766e6], hiu), [0, 1641e6]);
  const by = { kind: 'hamitup', bypass: true };
  assert.equal(converting(by), false);
  assert.equal(toDeviceHz(146.52e6, by), 146.52e6);
  assert.equal(toDeviceHz(146.52e6, null), 146.52e6);
  // a custom downconverter
  const dn = { kind: 'custom', loHz: 9750e6, direction: 'down' };
  assert.equal(toDeviceHz(10489.55e6, dn), 739.55e6);
  assert.equal(toAntennaHz(739.55e6, dn), 10489.55e6);
});

test('transmit through a converter is refused unless it is bypassed (#69)', () => {
  assert.deepEqual(converterAllowsTx({ kind: 'hamitup' }), { ok: false, reason: CONVERTER_TX_REASON });
  assert.equal(CONVERTER_TX_REASON, 'TX through the Ham It Up is not supported: set it to BYPASS or connect the transmitter directly. HF transmit needs a proper transverter and low-pass filter.');
  assert.equal(converterAllowsTx({ kind: 'hamitup', bypass: true }).ok, true);
  assert.equal(converterAllowsTx({ kind: 'none' }).ok, true);
  assert.equal(converterAllowsTx({ kind: 'custom', loHz: 100e6 }).ok, false);
  const ok = { devices: txDevices({ bladeN: 1, bladeModel: '2.0', tools: { bladeRF_cli: true } }), callsign: 'W1AW', attested: true, freqHz: 146e6, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'arrow' };
  const r = txGate({ ...ok, converter: { kind: 'hamitup' } });
  assert.equal(r.code, 'converter');
  assert.equal(r.reason, CONVERTER_TX_REASON);
  assert.equal(txGate({ ...ok, converter: { kind: 'hamitup', bypass: true } }).ok, true);
  // still direct 2 m / 70 cm only: an HF frequency is out of band even with the converter bypassed
  assert.equal(txGate({ ...ok, converter: { kind: 'hamitup', bypass: true }, freqHz: 7.074e6 }).ok, false);
});

test('antenna profiles: transmit only on an antenna marked for the band (#69)', () => {
  assert.deepEqual(DEFAULT_ANTENNAS.map((a) => [a.name, a.bands, a.directional]), [
    ['Arrow (dual-band Yagi)', ['2m', '70cm'], true], ['Small arrow', [], true], ['Donut', [], false], ['Small loop', ['hf-rx'], false], ['Wire', ['hf-rx'], false]]);
  const base = { antennas: DEFAULT_ANTENNAS, freqHz: 146e6, region: 2 };
  assert.equal(antennaCheck({ ...base, antennaId: 'arrow' }).ok, true);
  assert.equal(antennaCheck({ ...base, antennaId: 'arrow', freqHz: 446e6 }).antenna.directional, true);
  assert.equal(antennaCheck({ ...base, antennaId: 'loop' }).reason, 'Unable to comply: the Small loop is set for HF receive only. Select the Arrow (dual-band Yagi) for 146 MHz.');
  assert.match(antennaCheck({ ...base, antennaId: 'small-arrow' }).reason, /the Small arrow is set for an unknown band/);
  assert.match(antennaCheck({ ...base, antennaId: 'donut', freqHz: 146.52e6 }).reason, /Select the Arrow \(dual-band Yagi\) for 146\.52 MHz/);
  assert.equal(antennaCheck({ ...base, antennaId: null }).code, 'no-antenna');
  // once the operator marks the small arrow (a single-band Yagi) for 70 cm: 70 cm yes, 2 m no
  const edited = DEFAULT_ANTENNAS.map((a) => (a.id === 'small-arrow' ? { ...a, bands: ['70cm'] } : a));
  assert.equal(antennaCheck({ ...base, antennas: edited, antennaId: 'small-arrow', freqHz: 435.5e6 }).ok, true);
  assert.equal(antennaCheck({ ...base, antennas: edited, antennaId: 'small-arrow' }).reason, 'Unable to comply: the Small arrow is set for 70 cm. Select the Arrow (dual-band Yagi) for 146 MHz.');
  // nothing in the list fits
  assert.match(antennaCheck({ antennas: [DEFAULT_ANTENNAS[3]], antennaId: 'loop', freqHz: 146e6, region: 2 }).reason, /No antenna in your list is marked for 2 m/);
  assert.equal(describeAntennaBands(['2m', '70cm']), '2 m and 70 cm');
  // the gate refuses for the antenna too
  const g = txGate({ devices: txDevices({ fake: true }), callsign: 'W1AW', attested: true, freqHz: 146e6, region: 2, antennas: DEFAULT_ANTENNAS, antennaId: 'wire' });
  assert.equal(g.code, 'antenna');
  assert.match(g.reason, /^Unable to comply: the Wire is set for HF receive only/);
});
