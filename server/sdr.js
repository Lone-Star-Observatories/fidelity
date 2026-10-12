// Local SDR reception (#69): one IQ stream per device feeds both the waterfall and the audio.
//
//   ws /api/rf/local (loopback only: peer, Host and Origin). The browser sends
//     { type: 'tune', freqHz (SDR side), mode, bwHz, agc, gain, driver, converter }
//     { type: 'scan', fromHz, toHz }   (SDR side) → { type: 'scan', fromHz, toHz, signals } (SDR side)
//     { type: 'stop' }
//   and receives JSON { type: 'ready' | 'tuned' | 'scanning' | 'error', … }, Kiwi-style "SND" audio
//   frames and "LWF" waterfall rows (src/data/sdr.js).
//
// The device runs one receive process at a time (an SDR is opened by one program only):
//   bladeRF  bladeRF-cli -e "set frequency rx F; set samplerate rx 1000000; …; rx config file=/dev/fd/3
//            format=bin n=0 …; rx start; rx wait" — SC16 Q11 IQ at 1 Msps, through `sh` so fd 3 is a
//            real pipe (Node gives children socket pairs, which /dev/fd/N cannot reopen on Linux)
//   RTL-SDR  rtl_fm -f F -M raw -s 240000 -l 0 -  — the existing rtl_fm path, raw IQ instead of audio
//            (int16, 240 kS/s; rtl_fm offset-tunes and decimates internally)
//   others   rx_fm (rx_tools, SoapySDR) with the same -M raw arguments
// Listening inside the current span only moves the software NCO; leaving it retunes the device.
// The scan pauses the stream, sweeps (rtl_power on an RTL-SDR, else a stepped capture of the IQ),
// and resumes. FIDELITY_FAKE_SDR=1 adds a SIMULATED SDR (synthetic IQ, IMAGINED on screen).

import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createSpectrum, createDemodulator, iqFromBytes, audioToPcm } from './sdrdsp.js';
import { encodeWfRow } from '../src/data/sdr.js';
import { findSignals } from '../src/data/rf.js';

/** Sample rate per receive tool: modest, so plain JS keeps up (≈ 1 Msps for the bladeRF). */
export const IQ_RATE = { bladerf: 1_000_000, rtl: 240_000, soapy: 240_000 };
const RTL_FM_SCALE = 128 * (Math.floor(1e6 / IQ_RATE.rtl) + 1); // rtl_fm sums `downsample` 8-bit samples per output
const SOAPY = { bladerf: 'bladerf', hackrf: 'hackrf', rtl: 'rtlsdr' };

/** Tunable range (Hz) of a device driver. The bladeRF reaches down to 60 kHz with the XB-200 transverter board. */
export function deviceRange(driver, { xb200 = false } = {}) {
  if (driver === 'bladerf' || driver === 'fake') return [xb200 && driver === 'bladerf' ? 60e3 : 47e6, 6e9];
  return { rtl: [24e6, 1766e6], hackrf: [1e6, 6e9] }[driver] ?? [24e6, 1766e6];
}

/**
 * The receive command that streams raw IQ for a device. Pure: `tools` says which programs exist.
 * → { cmd, args, tool, format: 's16', scale (full scale), rateHz, group (kill the process group) } or { error }.
 */
export function rxIqCmd(driver, { centreHz, gain = null, xb200 = false }, tools = {}) {
  const f = String(Math.round(centreHz)), g = gain != null && Number.isFinite(Number(gain)) ? Math.round(Number(gain)) : null;
  if ((driver === 'bladerf' && tools.bladeRF_cli) || driver === 'fake') {
    const rate = IQ_RATE.bladerf;
    const cmds = [
      ...(xb200 && driver === 'bladerf' ? ['xb 200 enable', 'xb 200 filter rx auto_3db'] : []),
      `set frequency rx ${f}`, `set samplerate rx ${rate}`, 'set bandwidth rx 1000000',
      g != null ? `set gain rx ${g}` : 'set agc rx on',
      'rx config file=/dev/fd/3 format=bin n=0 samples=8192 buffers=16 xfers=8 timeout=2000', 'rx start', 'rx wait'];
    // sh: fd 3 becomes a real pipe into cat, whose stdout is ours; bladeRF-cli's own messages go to stderr
    return { cmd: 'sh', args: ['-c', 'bladeRF-cli -e "$1" 3>&1 1>&2 | cat', 'sh', cmds.join('; ')], tool: 'bladeRF-cli', format: 's16', scale: 2048, rateHz: rate, group: true, fake: driver === 'fake' };
  }
  const raw = ['-M', 'raw', '-s', String(IQ_RATE.rtl), ...(g != null ? ['-g', String(g)] : []), '-l', '0', '-'];
  if (driver === 'rtl' && tools.rtl_fm) return { cmd: 'rtl_fm', args: ['-f', f, ...raw], tool: 'rtl_fm', format: 's16', scale: RTL_FM_SCALE, rateHz: IQ_RATE.rtl, group: false };
  if (driver !== 'rtl' && tools.rx_fm) return { cmd: 'rx_fm', args: ['-d', `driver=${SOAPY[driver] ?? driver}`, '-f', f, ...raw], tool: 'rx_fm', format: 's16', scale: 32768, rateHz: IQ_RATE.soapy, group: false };
  if (driver === 'rtl') return { error: 'rtl_fm is not installed (install rtl-sdr)' };
  if (driver === 'bladerf') return { error: 'receiving from a bladeRF needs bladeRF-cli (libbladeRF) or rx_fm (rx_tools with SoapySDR bladerf support)' };
  return { error: `receiving from a ${driver} needs rx_fm (rx_tools) built with SoapySDR ${driver} support` };
}

/** rtl_power for a sweep (RTL-SDR only; other devices sweep by stepping the IQ stream). */
export function rtlPowerCmd({ fromHz, toHz, step }) {
  return { cmd: 'rtl_power', args: ['-f', `${Math.round(fromHz)}:${Math.round(toHz)}:${Math.round(step)}`, '-i', '2', '-1', '-'] };
}
/** rtl_power CSV → dB per bin from fromHz (rows sorted by their start). */
export function parseRtlPower(out) {
  const rows = String(out).split('\n').filter((l) => /^\d{4}-\d\d-\d\d,/.test(l)).map((l) => l.split(',').map((x) => x.trim()));
  rows.sort((x, y) => Number(x[2]) - Number(y[2]));
  return Float32Array.from(rows.flatMap((r) => r.slice(6).map(Number)).filter(Number.isFinite));
}

// ---- the simulated device (FIDELITY_FAKE_SDR=1, and every test) -----------------------------------

/**
 * What the simulated station's antenna hears (antenna-side Hz, level in dBFS at the SDR). A few HF
 * signals (reachable through the Ham It Up), FM broadcast and 2 m. IMAGINED: nothing here is received.
 */
export const FAKE_SKY = [
  { hz: 6.8e6, db: -48, kind: 'carrier' }, { hz: 7.074e6, db: -30, kind: 'carrier' }, { hz: 7.2e6, db: -36, kind: 'am', tone: 700 }, { hz: 7.35e6, db: -42, kind: 'am', tone: 400 },
  { hz: 9.42e6, db: -46, kind: 'carrier' }, { hz: 9.6e6, db: -32, kind: 'am', tone: 1000 }, { hz: 9.65e6, db: -40, kind: 'am', tone: 600 }, { hz: 14.074e6, db: -34, kind: 'carrier' },
  { hz: 98.1e6, db: -28, kind: 'wbfm', tone: 1000 }, { hz: 98.5e6, db: -40, kind: 'wbfm', tone: 500 },
  { hz: 145.5e6, db: -44, kind: 'carrier' }, { hz: 146.52e6, db: -34, kind: 'nbfm', tone: 1000 },
];

/** Where a sky signal arrives at the SDR through the simulated station's converter (its switch follows SIGNAL PATH). */
function fakeDeviceHz(antennaHz, converter) {
  const c = converter ?? {};
  if (!c.kind || c.kind === 'none' || c.bypass) return antennaHz;
  if (antennaHz > 65e6) return null; // the Ham It Up's HF input is low-pass filtered: VHF does not get through
  const lo = c.kind === 'hamitup' ? 125e6 : Number(c.loHz) || 125e6;
  return c.direction === 'down' ? antennaHz - lo : antennaHz + lo;
}

/** Read the centre and rate a receive command asks for (what a real tool would tune). */
export function commandTuning(cmd, args) {
  if (cmd === 'sh') {
    const s = args[3] ?? '';
    return { centreHz: Number(s.match(/set frequency rx (\d+)/)?.[1]), rateHz: Number(s.match(/set samplerate rx (\d+)/)?.[1]), scale: 2048 };
  }
  const at = (flag) => Number(args[args.indexOf(flag) + 1]);
  return { centreHz: at('-f'), rateHz: at('-s'), scale: cmd === 'rtl_fm' ? RTL_FM_SCALE : 32768 };
}

/**
 * A spawn() stand-in for receive tools: emits int16 IQ in real time (20 ms chunks) with the sky's
 * signals inside the tuned span plus noise. `realtime: false` lets tests pull it as fast as they like.
 */
export function fakeSdrSpawn({ converter = null, sky = FAKE_SKY, noise = 0.004, realtime = true, calls = [] } = {}) {
  return function spawn(cmd, args) {
    calls.push({ cmd, args });
    const { centreHz, rateHz, scale } = commandTuning(cmd, args);
    const p = new EventEmitter();
    p.pid = undefined;
    p.stderr = new Readable({ read() {} });
    let t = 0, stopped = false, timer = null;
    const sigs = sky.map((s) => ({ ...s, dev: fakeDeviceHz(s.hz, converter) }))
      .filter((s) => s.dev != null && Math.abs(s.dev - centreHz) < rateHz / 2)
      .map((s) => ({ ...s, off: s.dev - centreHz, amp: 10 ** (s.db / 20), ph: 0 }));
    const chunk = Math.round(rateHz * 0.02);
    function make() {
      const b = Buffer.alloc(chunk * 4);
      for (let i = 0; i < chunk; i++, t++) {
        let re = (Math.random() + Math.random() - 1) * noise * 1.7, im = (Math.random() + Math.random() - 1) * noise * 1.7;
        const time = t / rateHz;
        for (const s of sigs) {
          let a = s.amp, f = s.off;
          if (s.kind === 'am') a *= 1 + 0.6 * Math.sin(2 * Math.PI * s.tone * time);
          else if (s.kind === 'nbfm') f += 2500 * Math.sin(2 * Math.PI * s.tone * time);
          else if (s.kind === 'wbfm') f += 50e3 * Math.sin(2 * Math.PI * s.tone * time);
          s.ph += (2 * Math.PI * f) / rateHz;
          re += a * Math.cos(s.ph); im += a * Math.sin(s.ph);
        }
        b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(re * scale))), i * 4);
        b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(im * scale))), i * 4 + 2);
      }
      for (const s of sigs) s.ph %= 2 * Math.PI;
      return b;
    }
    p.stdout = new Readable({ read() { if (!realtime) setImmediate(() => { if (!stopped) this.push(make()); }); } });
    if (realtime) timer = setInterval(() => { if (!stopped) p.stdout.push(make()); }, 20);
    p.kill = () => {
      if (stopped) return true;
      stopped = true; clearInterval(timer);
      setImmediate(() => { p.stdout.push(null); p.emit('exit', null, 'SIGTERM'); p.emit('close', null, 'SIGTERM'); });
      return true;
    };
    p.fake = true;
    return p;
  };
}

// ---- a receive session ----------------------------------------------------------------------------

/** Stop a receive process (the whole process group for the `sh` pipeline). */
function stopProc(p, group) {
  if (!p) return;
  try { if (group && p.pid) process.kill(-p.pid, 'SIGTERM'); else p.kill('SIGTERM'); } catch { try { p.kill('SIGKILL'); } catch { /* gone */ } }
}

/** Kiwi-style "SND" frame from Int16 LE PCM (the browser already parses it). */
export function sndFrame(le, seq, rssi = -127) {
  const n = Math.floor(le.length / 2), b = Buffer.alloc(3 + 7 + n * 2);
  b.write('SND', 0, 'latin1'); b.writeUInt8(0, 3); b.writeUInt32LE(seq >>> 0, 4); b.writeUInt16BE(Math.max(0, Math.round((rssi + 127) * 10)), 8);
  for (let i = 0; i < n; i++) b.writeInt16BE(le.readInt16LE(i * 2), 10 + i * 2);
  return b;
}

/**
 * One device, one process: tune / scan / stop. `send(textOrBuffer)` goes to the browser.
 * deps: { tools, spawn (default: real; fakeSdrSpawn for the simulated device), xb200 }.
 */
export function createSdrSession({ send, tools = {}, spawn = null, xb200 = false, fakeSpawn = fakeSdrSpawn }) {
  let proc = null, cmd = null, carry = Buffer.alloc(0), spec = null, demod = null, state = null, seqWf = 0, seqSnd = 0, pcm = Buffer.alloc(0), scanning = false, power = 0;
  const tell = (o) => send(JSON.stringify(o));
  const spawnFor = (s) => spawn ?? (s.driver === 'fake' ? fakeSpawn({ converter: s.converter }) : nodeSpawn);

  function stop() { const p = proc; proc = null; stopProc(p, cmd?.group); carry = Buffer.alloc(0); }

  function buildDemod() {
    demod = createDemodulator({ rateHz: cmd.rateHz, offsetHz: state.freqHz - state.centreHz, mode: state.mode, bwHz: state.bwHz, agc: state.agc });
    pcm = Buffer.alloc(0);
  }

  function onData(d) {
    const all = carry.length ? Buffer.concat([carry, d]) : d;
    const { re, im, rest } = iqFromBytes(all, cmd.scale);
    carry = Buffer.from(rest);
    if (!re.length) return;
    spec.push(re, im);
    const { audio, power: p } = demod.push(re, im);
    power += (p - power) * 0.2;
    pcm = Buffer.concat([pcm, audioToPcm(audio)]);
    const frame = 1024; // 512 samples per SND frame
    const dbfs = 10 * Math.log10(power + 1e-20);
    while (pcm.length >= frame) { send(sndFrame(pcm.subarray(0, frame), seqSnd++, Math.max(-127, dbfs))); pcm = pcm.subarray(frame); }
  }

  function start() {
    stop();
    const c = rxIqCmd(state.driver, { centreHz: state.centreHz, gain: state.gain, xb200 }, tools);
    if (c.error) { tell({ type: 'error', message: c.error }); return; }
    cmd = c;
    spec = createSpectrum({ size: 1024, rateHz: c.rateHz, rowsPerSec: 10, onRow: (db) => send(Buffer.from(encodeWfRow({ seq: seqWf++, centreHz: state.centreHz, rateHz: c.rateHz, db, fake: !!c.fake }))) });
    buildDemod();
    let p;
    try { p = spawnFor(state)(c.cmd, c.args, { stdio: ['ignore', 'pipe', 'pipe'], detached: !!c.group }); }
    catch (e) { tell({ type: 'error', message: e.message }); return; }
    proc = p;
    let errText = '';
    p.on('error', (e) => { if (proc === p) tell({ type: 'error', message: e.code === 'ENOENT' ? `${c.cmd} is not installed` : e.message }); });
    p.stderr?.on('data', (d) => {
      errText = (errText + d).slice(-2000);
      const t = String(d);
      if (/usb_claim_interface|No supported devices|No devices found|Failed to open|No device|not found|Error/i.test(t) && proc === p) tell({ type: 'error', message: t.trim().split('\n').pop() });
    });
    p.stdout.on('data', (d) => { if (proc === p) onData(d); });
    p.on('close', (code) => { if (proc === p) { proc = null; tell({ type: 'error', message: `${c.tool} stopped${code ? ` (exit ${code})` : ''}${errText.trim() ? `: ${errText.trim().split('\n').pop()}` : ''}` }); } });
    tell({ type: 'tuned', centreHz: state.centreHz, freqHz: state.freqHz, rateHz: c.rateHz, audioRate: demod.audioRate, rate: demod.audioRate, driver: state.driver, tool: c.tool, fake: !!c.fake, mode: state.mode });
  }

  /** Room to listen off-centre without retuning the device (Hz). */
  const reach = (mode, rateHz) => rateHz / 2 - (mode === 'wbfm' ? 125e3 : 30e3);

  return {
    tune(m) {
      if (scanning) return;
      const next = { driver: m.driver ?? 'rtl', freqHz: Math.round(m.freqHz), mode: m.mode ?? 'am', bwHz: m.bwHz, agc: m.agc ?? 'fast', gain: m.gain ?? null, converter: m.converter ?? null };
      const rateHz = IQ_RATE[next.driver === 'rtl' ? 'rtl' : next.driver === 'bladerf' || next.driver === 'fake' ? 'bladerf' : 'soapy'];
      const sameDevice = proc && state && state.driver === next.driver && state.gain === next.gain && JSON.stringify(state.converter) === JSON.stringify(next.converter);
      if (sameDevice && Math.abs(next.freqHz - state.centreHz) <= reach(next.mode, rateHz)) {
        const changed = next.mode !== state.mode || next.bwHz !== state.bwHz || next.agc !== state.agc || next.freqHz !== state.freqHz;
        state = { ...state, ...next };
        if (changed) buildDemod();
        tell({ type: 'tuned', centreHz: state.centreHz, freqHz: state.freqHz, rateHz: cmd.rateHz, audioRate: demod.audioRate, rate: demod.audioRate, driver: state.driver, tool: cmd.tool, fake: !!cmd.fake, mode: state.mode, moved: false });
        return;
      }
      state = { ...next, centreHz: next.freqHz };
      start();
    },
    /** Pause, sweep fromHz–toHz (SDR side), resume. Resolves the signals [{ freqHz, db, snr, widthHz }]. */
    async scan({ fromHz, toHz }) {
      if (!state || scanning) return [];
      scanning = true;
      tell({ type: 'scanning', fromHz, toHz });
      stop();
      try {
        return state.driver === 'rtl' && tools.rtl_power ? await sweepRtlPower(spawnFor(state), { fromHz, toHz }) : await sweepSteps(spawnFor(state), { driver: state.driver, gain: state.gain, tools, xb200, fromHz, toHz });
      } finally { scanning = false; start(); }
    },
    stop,
    get state() { return state && { ...state }; },
    get running() { return !!proc; },
  };
}

/** A sweep with rtl_power (RTL-SDR). */
function sweepRtlPower(spawn, { fromHz, toHz }) {
  const step = Math.max(1000, Math.round((toHz - fromHz) / 2048)), c = rtlPowerCmd({ fromHz, toHz, step });
  return new Promise((resolve) => {
    let out = '', p;
    try { p = spawn(c.cmd, c.args, { stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return resolve([]); }
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, 30000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', () => {});
    p.on('close', () => { clearTimeout(t); const db = parseRtlPower(out); resolve(db.length ? findSignals(db, { startHz: fromHz, spanHz: toHz - fromHz, snrDb: 10 }) : []); });
  });
}

/**
 * A sweep by stepping the IQ stream: at each centre, capture ~0.3 s, average 24 FFT frames, keep the
 * middle 75 % of the span (away from the band edges' roll-off), stitch, find signals.
 */
export async function sweepSteps(spawn, { driver, gain, tools, xb200 = false, fromHz, toHz, size = 1024, frames = 24, settle = 0.1 }) {
  const probe = rxIqCmd(driver, { centreHz: fromHz, gain, xb200 }, tools);
  if (probe.error) return [];
  const rate = probe.rateHz, usable = rate * 0.75, keep = Math.round(size * 0.75), binHz = rate / size, lo = (size - keep) / 2;
  const steps = Math.max(1, Math.ceil((toHz - fromHz) / usable)), all = new Float32Array(steps * keep);
  for (let s = 0; s < steps; s++) {
    const centre = fromHz + usable / 2 + s * usable;
    const row = await captureRow(spawn, rxIqCmd(driver, { centreHz: centre, gain, xb200 }, tools), { size, frames, settle });
    if (row) all.set(row.subarray(lo, lo + keep), s * keep);
  }
  const startHz = fromHz - binHz / 2, spanHz = steps * keep * binHz; // findSignals counts from a bin's lower edge
  return findSignals(all, { startHz, spanHz, snrDb: 10 }).filter((x) => x.freqHz >= fromHz && x.freqHz <= toHz);
}

/** Run a receive command until one averaged spectrum row is in, then stop it. */
function captureRow(spawn, c, { size, frames, settle }) {
  return new Promise((resolve) => {
    let p, skip = Math.round(c.rateHz * settle) * 4, carry = Buffer.alloc(0), done = false;
    const spec = createSpectrum({ size, rateHz: c.rateHz, rowsPerSec: c.rateHz / (size * frames), maxAvg: frames, onRow: (db) => finish(db) });
    const t = setTimeout(() => finish(null), 4000);
    function finish(db) { if (done) return; done = true; clearTimeout(t); stopProc(p, c.group); resolve(db); }
    try { p = spawn(c.cmd, c.args, { stdio: ['ignore', 'pipe', 'pipe'], detached: !!c.group }); } catch { return finish(null); }
    p.on('error', () => finish(null));
    p.on('close', () => finish(null));
    p.stdout.on('data', (d) => {
      if (done) return;
      if (skip > 0) { if (d.length <= skip) { skip -= d.length; return; } d = d.subarray(skip); skip = 0; }
      const { re, im, rest } = iqFromBytes(carry.length ? Buffer.concat([carry, d]) : d, c.scale);
      carry = Buffer.from(rest);
      spec.push(re, im);
    });
  });
}
