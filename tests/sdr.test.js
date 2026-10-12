// Local SDR waterfall and audio (#69), and WebSDR tuning in the main viewer — all against fakes.
// Nothing here opens an SDR: the receive tools are replaced by fakeSdrSpawn (synthetic IQ).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.FIDELITY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-sdr-')); // the WebSDR framing cache goes here
const { createFft, createSpectrum, createDemodulator, demodRates } = await import('../server/sdrdsp.js');
const { rxIqCmd, createSdrSession, fakeSdrSpawn, sweepSteps, commandTuning, FAKE_SKY } = await import('../server/sdr.js');
const { handleLocalUpgrade, loopbackRequest, websdrFrame, rxDevices } = await import('../server/rf.js');
const { encodeWfRow, parseWfRow, rowAxis, axisTicks, WF_HEADER } = await import('../src/data/sdr.js');
const { kiwiTag, parseKiwiSnd } = await import('../src/data/rf.js');
const { toDeviceHz } = await import('../src/data/converter.js');
const { websdrTuneParam, websdrTuneUrl, framingVerdict, websdrBandFor } = await import('../src/data/websdr.js');

const HAM_IT_UP = { kind: 'hamitup' }, BYPASS = { kind: 'hamitup', bypass: true };
const tone = (n, rate, f, amp = 1, ph = 0) => {
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) { re[i] = amp * Math.cos(2 * Math.PI * f * i / rate + ph); im[i] = amp * Math.sin(2 * Math.PI * f * i / rate + ph); }
  return { re, im };
};
const argmax = (a, from = 0, to = a.length) => { let b = from; for (let i = from; i < to; i++) if (a[i] > a[b]) b = i; return b; };
/** The strongest audio frequency (Hz) of a real signal. */
function dominantHz(x, rate) {
  const n = 4096, fft = createFft(n), re = new Float64Array(n), im = new Float64Array(n), off = x.length - n;
  for (let i = 0; i < n; i++) re[i] = x[off + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  fft(re, im);
  const p = new Float64Array(n / 2); for (let k = 1; k < n / 2; k++) p[k] = re[k] ** 2 + im[k] ** 2;
  return (argmax(p, 2) * rate) / n;
}

// ---- FFT and spectrum ---------------------------------------------------------------------------------
test('FFT matches a direct DFT (#69)', () => {
  const n = 64, fft = createFft(n), re = new Float64Array(n), im = new Float64Array(n), x = [];
  for (let i = 0; i < n; i++) { re[i] = Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1); im[i] = Math.cos(i * 0.31); x.push([re[i], im[i]]); }
  fft(re, im);
  for (const k of [0, 1, 5, 17, 63]) {
    let r = 0, q = 0;
    for (let t = 0; t < n; t++) { const a = (-2 * Math.PI * k * t) / n; r += x[t][0] * Math.cos(a) - x[t][1] * Math.sin(a); q += x[t][0] * Math.sin(a) + x[t][1] * Math.cos(a); }
    assert.ok(Math.abs(r - re[k]) < 1e-9 && Math.abs(q - im[k]) < 1e-9, `bin ${k}`);
  }
  assert.throws(() => createFft(100));
});

test('spectrum rows: a tone lands in its bin, DC in the middle, levels in dBFS, averaged (#69)', () => {
  const rate = 1e6, rows = [];
  const s = createSpectrum({ size: 1024, rateHz: rate, rowsPerSec: 10, onRow: (r) => rows.push(r) });
  assert.equal(s.avgN, 16);
  const off = 74e3, { re, im } = tone(rate * 0.2, rate, off, 10 ** (-30 / 20)); // −30 dBFS at +74 kHz
  for (let i = 0; i < re.length; i += 10000) s.push(re.subarray(i, i + 10000), im.subarray(i, i + 10000));
  assert.equal(rows.length, 2);
  const row = rows[0], peak = argmax(row), binHz = rate / 1024;
  assert.equal(peak, 512 + Math.round(off / binHz)); // bin 512 is the centre
  assert.ok(Math.abs((peak - 512) * binHz - off) <= binHz, `peak ${(peak - 512) * binHz} Hz`);
  assert.ok(Math.abs(row[peak] - -30) < 1.6, `level ${row[peak].toFixed(2)} dBFS (Hann scalloping ≤ 1.42 dB)`);
  // a negative offset lands left of centre
  const rows2 = [], s2 = createSpectrum({ size: 1024, rateHz: rate, onRow: (r) => rows2.push(r) }), t2 = tone(rate * 0.1, rate, -200e3, 0.5);
  s2.push(t2.re, t2.im);
  assert.ok(Math.abs((argmax(rows2[0]) - 512) * binHz - -200e3) <= binHz);
});

test('through the Ham It Up a 7.074 MHz tone is drawn at 7.074 MHz (SDR 132.074 MHz); bypassed, 146.52 MHz is itself (#69)', async () => {
  for (const [conv, listenHz, expectHz] of [[HAM_IT_UP, 7.0e6, 7.074e6], [BYPASS, 146.3e6, 146.52e6], [null, 145.3e6, 145.5e6]]) {
    const sent = [], calls = [];
    const s = createSdrSession({ send: (x) => sent.push(x), tools: {}, spawn: fakeSdrSpawn({ converter: conv, calls, noise: 0.002 }) });
    s.tune({ driver: 'fake', freqHz: toDeviceHz(listenHz, conv), mode: 'am', converter: conv });
    const deadline = Date.now() + 5000;
    let row = null;
    while (!row && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      const b = sent.find((x) => typeof x !== 'string' && kiwiTag(new Uint8Array(x)).tag === 'LWF');
      if (b) row = parseWfRow(kiwiTag(new Uint8Array(b)).body);
    }
    s.stop();
    assert.ok(row, 'a waterfall row arrives');
    assert.equal(row.centreHz, toDeviceHz(listenHz, conv), 'rows carry the SDR-side centre');
    assert.equal(row.fake, true);
    const axis = rowAxis(row, conv), sky = FAKE_SKY.filter((x) => Math.abs(x.hz - axis.centreHz) < axis.spanHz / 2);
    // the strongest bin, read on the antenna-side axis, is the strongest sky signal in view
    const strongest = sky.reduce((a, b) => (b.db > a.db ? b : a));
    assert.equal(strongest.hz, expectHz);
    const got = axis.freqOfBin(argmax(row.db));
    const tol = strongest.kind === 'nbfm' ? 3e3 : axis.binHz; // an FM signal's strongest bin wanders within its ±2.5 kHz deviation
    assert.ok(Math.abs(got - expectHz) <= tol, `${conv?.kind ?? 'none'}${conv?.bypass ? ' bypass' : ''}: peak at ${(got / 1e6).toFixed(4)} MHz, want ${expectHz / 1e6}`);
    if (strongest.kind === 'carrier') assert.equal(axis.binOfFreq(expectHz), argmax(row.db));
    if (conv === HAM_IT_UP) assert.match(calls[0].args[3], /set frequency rx 132000000;/); // the SDR tunes antenna + 125 MHz
  }
});

// ---- the row format -----------------------------------------------------------------------------------
test('waterfall row format: "LWF", header, one byte per bin at dBFS + 200 (#69)', () => {
  const db = Float32Array.from([-100, -30.4, 0, -250, 80]);
  const b = encodeWfRow({ seq: 7, centreHz: 132074000.5, rateHz: 1e6, db, fake: true });
  assert.equal(b.length, WF_HEADER + 5);
  assert.equal(new TextDecoder().decode(b.subarray(0, 3)), 'LWF');
  const dv = new DataView(b.buffer);
  assert.equal(dv.getUint8(3), 1); // version
  assert.equal(dv.getUint32(4, true), 7);
  assert.equal(dv.getFloat64(8, true), 132074000.5);
  assert.equal(dv.getUint32(16, true), 1e6);
  assert.equal(dv.getUint16(20, true), 5);
  assert.equal(dv.getUint8(22), 1);
  assert.deepEqual([...b.subarray(WF_HEADER)], [100, 170, 200, 0, 255]); // clamped at both ends
  const { tag, body } = kiwiTag(b);
  assert.equal(tag, 'LWF');
  const r = parseWfRow(body);
  assert.deepEqual({ seq: r.seq, centreHz: r.centreHz, rateHz: r.rateHz, bins: r.bins, fake: r.fake }, { seq: 7, centreHz: 132074000.5, rateHz: 1e6, bins: 5, fake: true });
  assert.deepEqual([...r.db], [-100, -30, 0, -200, 55]);
  assert.equal(parseWfRow(body.subarray(0, 10)), null);
  // the axis: SDR centre 132.074 MHz through the Ham It Up → 7.074 MHz in the middle, 1 MHz wide
  const ax = rowAxis({ centreHz: 132.074e6, rateHz: 1e6, bins: 1024 }, HAM_IT_UP);
  assert.equal(ax.centreHz, 7.074e6);
  assert.equal(ax.startHz, 6.574e6);
  assert.equal(ax.binOfFreq(7.074e6), 512);
  assert.equal(rowAxis({ centreHz: 132.074e6, rateHz: 1e6, bins: 1024 }, BYPASS).centreHz, 132.074e6);
  assert.deepEqual(axisTicks(6.574e6, 1e6, 5).map((t) => t.label), ['6.6', '6.8', '7.0', '7.2', '7.4']);
});

// ---- device commands through a fake spawn -------------------------------------------------------------
test('device commands: bladeRF-cli IQ at 1 Msps through sh, rtl_fm -M raw; listening in span moves only the NCO (#69)', async () => {
  const calls = [], sent = [];
  const blade = rxIqCmd('bladerf', { centreHz: 132074000, gain: 20 }, { bladeRF_cli: true });
  assert.deepEqual([blade.cmd, blade.args[0], blade.args[1], blade.args[2]], ['sh', '-c', 'bladeRF-cli -e "$1" 3>&1 1>&2 | cat', 'sh']);
  assert.equal(blade.args[3], 'set frequency rx 132074000; set samplerate rx 1000000; set bandwidth rx 1000000; set gain rx 20; rx config file=/dev/fd/3 format=bin n=0 samples=8192 buffers=16 xfers=8 timeout=2000; rx start; rx wait');
  assert.deepEqual({ format: blade.format, scale: blade.scale, rateHz: blade.rateHz, group: blade.group }, { format: 's16', scale: 2048, rateHz: 1e6, group: true });
  assert.match(rxIqCmd('bladerf', { centreHz: 7e6 }, { bladeRF_cli: true }).args[3], /set agc rx on/); // no gain given: the board's AGC
  assert.match(rxIqCmd('bladerf', { centreHz: 7e6, xb200: true }, { bladeRF_cli: true }).args[3], /^xb 200 enable; xb 200 filter rx auto_3db; set frequency rx 7000000;/);
  assert.deepEqual(commandTuning(blade.cmd, blade.args), { centreHz: 132074000, rateHz: 1e6, scale: 2048 });

  const s = createSdrSession({ send: (x) => sent.push(x), tools: { bladeRF_cli: true, rtl_fm: true }, spawn: fakeSdrSpawn({ calls }) });
  s.tune({ driver: 'bladerf', freqHz: 146.52e6, mode: 'nbfm' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].args[3], /set frequency rx 146520000;/);
  s.tune({ driver: 'bladerf', freqHz: 146.82e6, mode: 'nbfm' }); // 300 kHz away: inside the 1 MHz span
  assert.equal(calls.length, 1, 'no retune inside the span');
  const tuned = sent.filter((x) => typeof x === 'string').map((x) => JSON.parse(x)).filter((m) => m.type === 'tuned');
  assert.equal(tuned.at(-1).centreHz, 146.52e6);
  assert.equal(tuned.at(-1).freqHz, 146.82e6);
  s.tune({ driver: 'bladerf', freqHz: 433e6, mode: 'nbfm' }); // far away: the device retunes
  assert.equal(calls.length, 2);
  assert.match(calls[1].args[3], /set frequency rx 433000000;/);
  s.tune({ driver: 'rtl', freqHz: 98.1e6, mode: 'wbfm', gain: 30 });
  assert.deepEqual(calls[2], { cmd: 'rtl_fm', args: ['-f', '98100000', '-M', 'raw', '-s', '240000', '-g', '30', '-l', '0', '-'] });
  s.stop();
  // receive devices: streaming and waterfall when the tool is there; the simulated one only on request
  const rx = rxDevices({ rtlN: 1, bladeN: 1, tools: { bladeRF_cli: true }, fake: true });
  assert.deepEqual(rx.map((d) => [d.driver, d.waterfall, d.tool]), [['rtl', false, null], ['bladerf', true, 'bladeRF-cli'], ['fake', true, 'bladeRF-cli']]);
  assert.equal(rx[2].label, 'SIMULATED SDR');
  assert.equal(rxDevices({ bladeN: 1, tools: { bladeRF_cli: true } }).some((d) => d.fake), false);
});

test('audio and waterfall share one device process; the scan pauses it, sweeps, and resumes (#69)', async () => {
  const calls = [], sent = [];
  const s = createSdrSession({ send: (x) => sent.push(x), tools: { bladeRF_cli: true }, spawn: fakeSdrSpawn({ calls, converter: HAM_IT_UP }) });
  s.tune({ driver: 'bladerf', freqHz: toDeviceHz(9.6e6, HAM_IT_UP), mode: 'am' });
  await new Promise((r) => setTimeout(r, 400));
  const bins = sent.filter((x) => typeof x !== 'string').map((x) => kiwiTag(new Uint8Array(x)).tag);
  assert.ok(bins.includes('LWF') && bins.includes('SND'), `got ${[...new Set(bins)]}`);
  assert.equal(calls.length, 1, 'one process feeds both');
  const snd = parseKiwiSnd(kiwiTag(new Uint8Array(sent.find((x) => typeof x !== 'string' && kiwiTag(new Uint8Array(x)).tag === 'SND'))).body);
  assert.equal(snd.samples.length, 512);
  // scan 9.0–10.0 MHz on the antenna (SDR side through the Ham It Up)
  const signals = await s.scan({ fromHz: toDeviceHz(9.0e6, HAM_IT_UP), toHz: toDeviceHz(10.0e6, HAM_IT_UP) });
  assert.ok(calls.length >= 3, 'stepped captures, then the stream again');
  assert.match(calls.at(-1).args[3], /set frequency rx 134600000;/, 'resumed at the listening centre');
  assert.ok(s.running);
  const found = signals.map((x) => x.freqHz - 125e6);
  for (const want of [9.6e6, 9.65e6, 9.42e6]) assert.ok(found.some((f) => Math.abs(f - want) < 2e3), `scan found ${(want / 1e6).toFixed(3)} MHz in ${found.map((f) => (f / 1e6).toFixed(4))}`);
  s.stop();
  // the sweep on its own: stepped captures across the range
  const sweepCalls = [];
  const sig = await sweepSteps(fakeSdrSpawn({ calls: sweepCalls }), { driver: 'fake', tools: {}, fromHz: 145e6, toHz: 147e6 });
  assert.equal(sweepCalls.length, 3); // 2 MHz in 750 kHz steps
  assert.ok(sig.some((x) => Math.abs(x.freqHz - 146.52e6) < 5e3) && sig.some((x) => Math.abs(x.freqHz - 145.5e6) < 2e3));
});

// ---- demodulators (what rtl_fm used to do, now in JS) -------------------------------------------------
test('demodulators: AM, USB, LSB, CW, NBFM and WFM give the right audio tone; AGC levels it (#69)', () => {
  const rate = 1e6, n = rate * 0.4, run = (mode, iq, extra = {}) => {
    const d = createDemodulator({ rateHz: rate, offsetHz: 100e3, mode, ...extra });
    const parts = [];
    for (let i = 0; i < n; i += 20000) parts.push(d.push(iq.re.subarray(i, i + 20000), iq.im.subarray(i, i + 20000)).audio);
    const a = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { a.set(p, o); o += p.length; }
    return { a, rate: d.audioRate };
  };
  const synth = (fn) => { const re = new Float32Array(n), im = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / rate, { f, a } = fn(t); ph += 2 * Math.PI * f / rate; re[i] = a * Math.cos(ph); im[i] = a * Math.sin(ph); } return { re, im }; };
  assert.deepEqual(demodRates(1e6, 'am'), { d0: 20, midRate: 50000, d1: 2, audioRate: 25000 });
  assert.deepEqual(demodRates(240e3, 'usb'), { d0: 5, midRate: 48000, d1: 2, audioRate: 24000 });
  const am = run('am', synth((t) => ({ f: 100e3, a: 0.01 * (1 + 0.5 * Math.sin(2 * Math.PI * 1000 * t)) })));
  assert.ok(Math.abs(dominantHz(am.a, am.rate) - 1000) < 15, `AM ${dominantHz(am.a, am.rate)}`);
  const peak = am.a.subarray(am.a.length >> 1).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  assert.ok(peak > 0.1 && peak < 1, `AGC brings a −40 dBFS carrier to a sane level (${peak.toFixed(3)})`);
  const usb = run('usb', synth(() => ({ f: 101.2e3, a: 0.01 })), { bwHz: 2400 });
  assert.ok(Math.abs(dominantHz(usb.a, usb.rate) - 1200) < 15, `USB ${dominantHz(usb.a, usb.rate)}`);
  const lsb = run('lsb', synth(() => ({ f: 98.8e3, a: 0.01 })), { bwHz: 2400 });
  assert.ok(Math.abs(dominantHz(lsb.a, lsb.rate) - 1200) < 15, `LSB ${dominantHz(lsb.a, lsb.rate)}`);
  const usbWrong = run('usb', synth(() => ({ f: 98.8e3, a: 0.01 })), { bwHz: 2400, agc: 'off' }); // the other sideband is rejected
  const rms = (x) => Math.sqrt(x.subarray(x.length >> 1).reduce((s, v) => s + v * v, 0) / (x.length >> 1));
  assert.ok(rms(usbWrong.a) < 0.05 * rms(run('usb', synth(() => ({ f: 101.2e3, a: 0.01 })), { bwHz: 2400, agc: 'off' }).a), 'opposite sideband suppressed');
  const cw = run('cw', synth(() => ({ f: 100e3, a: 0.01 })), { bwHz: 500 });
  assert.ok(Math.abs(dominantHz(cw.a, cw.rate) - 500) < 15, `CW ${dominantHz(cw.a, cw.rate)}`);
  const nbfm = run('nbfm', synth((t) => ({ f: 100e3 + 2500 * Math.sin(2 * Math.PI * 1000 * t), a: 0.01 })), { bwHz: 12000 });
  assert.ok(Math.abs(dominantHz(nbfm.a, nbfm.rate) - 1000) < 15, `NBFM ${dominantHz(nbfm.a, nbfm.rate)}`);
  const wfm = run('wbfm', synth((t) => ({ f: 100e3 + 50e3 * Math.sin(2 * Math.PI * 1000 * t), a: 0.01 })));
  assert.equal(wfm.rate, 25000);
  assert.ok(Math.abs(dominantHz(wfm.a, wfm.rate) - 1000) < 15, `WFM ${dominantHz(wfm.a, wfm.rate)}`);
});

// ---- loopback gating ----------------------------------------------------------------------------------
test('ws /api/rf/local is for this machine only (peer, Host, Origin) (#69)', async () => {
  const fakeSocket = () => { const s = { out: '', ended: false, end(x) { this.out += x ?? ''; this.ended = true; }, write(x) { this.out += x; }, setNoDelay() {}, on() {} }; return s; };
  const req = (remoteAddress, host, origin) => ({ url: '/api/rf/local', socket: { remoteAddress }, headers: { host, upgrade: 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', ...(origin ? { origin } : {}) } });
  for (const r of [req('192.168.1.20', '127.0.0.1:4011'), req('127.0.0.1', 'evil.example:4011', 'http://evil.example:4011'), req('127.0.0.1', '127.0.0.1:4011', 'https://evil.example')]) {
    assert.equal(loopbackRequest(r), false);
    const s = fakeSocket();
    await handleLocalUpgrade(r, s, { tools: {} });
    assert.ok(s.ended && /^HTTP\/1\.1 403/.test(s.out), s.out);
  }
  const ok = fakeSocket();
  await handleLocalUpgrade(req('127.0.0.1', '127.0.0.1:4011', 'http://127.0.0.1:4011'), ok, { tools: {} });
  assert.match(ok.out, /^HTTP\/1\.1 101/);
});

test('ws /api/rf/local end to end: ready → tune → tuned, waterfall rows and audio; the simulated device needs the flag (#69)', async () => {
  const srv = http.createServer(), sockets = new Set(), calls = [];
  let fakeOk = false;
  srv.on('upgrade', (req, socket) => { sockets.add(socket); handleLocalUpgrade(req, socket, { tools: {}, spawn: fakeSdrSpawn({ calls }), fakeOk }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const open = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.address().port}/api/rf/local`), json = [], bin = [];
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e) => { if (typeof e.data === 'string') json.push(JSON.parse(e.data)); else bin.push(kiwiTag(new Uint8Array(e.data))); };
    const until = async (f, ms = 5000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error(`timeout; got ${JSON.stringify(json)}`); await new Promise((r) => setTimeout(r, 20)); } };
    await until(() => json.some((m) => m.type === 'ready'));
    return { ws, json, bin, until };
  };
  try {
    const a = await open();
    a.ws.send(JSON.stringify({ type: 'tune', driver: 'fake', freqHz: 146.52e6, mode: 'nbfm' }));
    await a.until(() => a.json.some((m) => m.type === 'error'));
    assert.match(a.json.find((m) => m.type === 'error').message, /FIDELITY_FAKE_SDR=1/);
    a.ws.close();
    fakeOk = true;
    const b = await open();
    b.ws.send(JSON.stringify({ type: 'tune', driver: 'fake', freqHz: 20e6, mode: 'am' }));
    await b.until(() => b.json.some((m) => m.type === 'error'));
    assert.match(b.json.find((m) => m.type === 'error').message, /outside this device's 47 MHz–6000 MHz range/);
    b.ws.send(JSON.stringify({ type: 'tune', driver: 'fake', freqHz: 146.52e6, mode: 'nbfm' }));
    await b.until(() => b.bin.some((x) => x.tag === 'LWF') && b.bin.some((x) => x.tag === 'SND'));
    const t = b.json.find((m) => m.type === 'tuned');
    assert.deepEqual({ centreHz: t.centreHz, rateHz: t.rateHz, audioRate: t.audioRate, fake: t.fake }, { centreHz: 146.52e6, rateHz: 1e6, audioRate: 25000, fake: true });
    assert.equal(calls.length, 1);
    b.ws.close();
    await new Promise((r) => setTimeout(r, 100));
  } finally { for (const s of sockets) s.destroy(); srv.close(); }
});

// ---- WebSDR in the main viewer --------------------------------------------------------------------------
test('WebSDR tune URL: ?tune=<kHz><mode> for AM, FM, USB, LSB and CW (#69)', () => {
  assert.equal(websdrTuneParam({ freqHz: 7074000, mode: 'usb' }), '7074usb');
  assert.equal(websdrTuneParam({ freqHz: 3630000, mode: 'lsb' }), '3630lsb');
  assert.equal(websdrTuneParam({ freqHz: 198000, mode: 'am' }), '198am');
  assert.equal(websdrTuneParam({ freqHz: 145500000, mode: 'nbfm' }), '145500fm');
  assert.equal(websdrTuneParam({ freqHz: 98100000, mode: 'wbfm' }), '98100fm');
  assert.equal(websdrTuneParam({ freqHz: 10136500, mode: 'cw' }), '10136.5cw');
  assert.equal(websdrTuneParam({ freqHz: 7074123, mode: 'usb' }), '7074.123usb');
  assert.equal(websdrTuneParam({ freqHz: 0, mode: 'usb' }), null);
  assert.equal(websdrTuneUrl('http://websdr.ewi.utwente.nl:8901/', { freqHz: 7074000, mode: 'usb' }), 'http://websdr.ewi.utwente.nl:8901/?tune=7074usb');
  assert.equal(websdrTuneUrl('http://sdr.example.org/index.html?lang=en#top', { freqHz: 14074000, mode: 'usb' }), 'http://sdr.example.org/index.html?lang=en&tune=14074usb');
  assert.equal(websdrTuneUrl('http://sdr.example.org/?tune=1000am', { freqHz: 9600000, mode: 'am' }), 'http://sdr.example.org/?tune=9600am'); // replaced, not repeated
  assert.equal(websdrTuneUrl('javascript:alert(1)', { freqHz: 1, mode: 'am' }), null);
  const bands = [{ l: 3.5, h: 3.8 }, { l: 7, h: 7.2 }];
  assert.equal(websdrBandFor(bands, 7.074e6), bands[1]);
  assert.equal(websdrBandFor(bands, 9.6e6), null);
});

test('WebSDR framing check: X-Frame-Options and CSP frame-ancestors (#69)', () => {
  assert.deepEqual(framingVerdict({}), { embeddable: true, reason: 'no framing restriction' });
  assert.equal(framingVerdict({ 'Server': 'WebSDR/20140718.1716-64' }).embeddable, true);
  assert.deepEqual(framingVerdict({ 'X-Frame-Options': 'DENY' }), { embeddable: false, reason: 'X-Frame-Options DENY' });
  assert.equal(framingVerdict({ 'x-frame-options': 'SAMEORIGIN, SAMEORIGIN' }).embeddable, false); // a header sent twice
  assert.equal(framingVerdict({ 'x-frame-options': 'sameorigin' }).embeddable, false);
  assert.equal(framingVerdict({ 'x-frame-options': 'ALLOW-FROM https://example.org/' }).embeddable, false);
  // a real one (3.radiorubka.org): CSP frame-ancestors 'none' with XFO DENY
  const r = framingVerdict({ 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; frame-ancestors 'none'; upgrade-insecure-requests;" });
  assert.deepEqual(r, { embeddable: false, reason: "CSP frame-ancestors 'none'" });
  assert.equal(framingVerdict({ 'content-security-policy': "frame-ancestors 'self'" }).embeddable, false);
  assert.equal(framingVerdict({ 'content-security-policy': 'frame-ancestors https://partner.example' }).embeddable, false);
  assert.equal(framingVerdict({ 'content-security-policy': 'frame-ancestors *' }).embeddable, true);
  assert.equal(framingVerdict({ 'content-security-policy': 'frame-ancestors http://127.0.0.1:*', 'x-frame-options': 'DENY' }).embeddable, true); // CSP wins over XFO
  assert.equal(framingVerdict({ 'content-security-policy': "default-src 'self'" }).embeddable, true); // no frame-ancestors directive
});

test('GET /api/rf/websdr/frame: listed receivers only, checked once and cached (#69)', async () => {
  const list = async () => new Set(['http://sdr.example.org/', 'http://deny.example.org/']);
  let fetched = 0;
  const fetchHeaders = async (url) => { fetched++; return url.includes('deny') ? { status: 200, finalUrl: url, headers: { 'x-frame-options': 'DENY' } } : { status: 200, finalUrl: url, headers: { server: 'WebSDR' } }; };
  await assert.rejects(websdrFrame('http://elsewhere.example/', { list, fetchHeaders }), (e) => e.status === 403);
  await assert.rejects(websdrFrame('', { list, fetchHeaders }), (e) => e.status === 403);
  const a = await websdrFrame('http://sdr.example.org/', { list, fetchHeaders });
  assert.equal(a.embeddable, true);
  assert.equal(a.cache, 'miss');
  const again = await websdrFrame('http://sdr.example.org/', { list, fetchHeaders });
  assert.equal(again.cache, 'hit');
  assert.equal(fetched, 1);
  const d = await websdrFrame('http://deny.example.org/', { list, fetchHeaders });
  assert.deepEqual([d.embeddable, d.reason], [false, 'X-Frame-Options DENY']);
  await assert.rejects(websdrFrame('http://sdr.example.org/x', { list: async () => new Set(['http://sdr.example.org/x']), fetchHeaders: async () => { throw new Error('ECONNREFUSED'); } }), (e) => e.status === 502);
});

test('voice: "tune to 7074 usb" carries the mode to the receiver or the WebSDR (#69)', async () => {
  const { parseCommand } = await import('../src/voice/computer.js');
  assert.deepEqual(parseCommand('Computer, tune to 7074 usb', []), { action: 'comms', command: 'tune', frequency: '7074 usb' });
  assert.deepEqual(parseCommand('tune to 9.6 megahertz am', []), { action: 'comms', command: 'tune', frequency: '9.6 mhz am' });
  assert.deepEqual(parseCommand('tune to 14074', []), { action: 'comms', command: 'tune', frequency: '14074' });
  const { websdrStart } = await import('../src/views/comms/websdr.js');
  assert.deepEqual(websdrStart([{ l: 3.5, h: 3.8 }, { l: 7, h: 7.2 }]), { freqHz: 7.074e6, mode: 'usb' });
  assert.deepEqual(websdrStart([{ l: 0.5, h: 1.6 }]), { freqHz: 1.05e6, mode: 'am' });
  assert.deepEqual(websdrStart([{ l: 144, h: 146 }]), { freqHz: 145e6, mode: 'nbfm' });
});
