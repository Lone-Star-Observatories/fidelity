// COMMS transmission (#69): "open a hailing frequency" for a licensed amateur operator.
//
//   ws /api/rf/tx (loopback only: the peer address, the Host and any Origin must all be this
//   machine). The browser sends { type: 'open', freqHz, callsign, attested, region, gainDb,
//   timeoutS, driver, converter, antennas, antennaId }, then its microphone as binary Int16 PCM (16 kHz mono), then { type: 'close' }.
//   Before anything is spawned the request passes txGate (src/data/tx.js): a transmit-capable SDR
//   with its tool installed, no receive converter (Ham It Up) in the path unless bypassed, an antenna marked for the band, a callsign, the licence attestation, an amateur allocation for the
//   region with the whole FM signal inside it. One transmission at a time.
//
//   The session modulates narrowband FM (server/fm.js) and streams the IQ to the SDR tool's stdin:
//   bladeRF-cli (the primary path: SC16 Q11, 2 Msps, `set gain tx` ≤ 20) or hackrf_transfer -t -
//   (int8, 2 Msps, TX VGA ≤ 20 dB, RF amp off).
//   It ends itself after the timeout (default 3 min), after 15 s without microphone audio, or when
//   the browser goes away; every end sends the station ID (callsign in CW, 20 wpm, 800 Hz) before
//   the transmitter is released, and an ID goes out every 10 minutes during a long transmission.

import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { TX, txGate, txClock, cwAudio, clampGain, clampTimeoutS, normalizeCallsign, regionOf } from '../src/data/tx.js';
import { createFmModulator, pcm16ToFloat } from './fm.js';
import { rfDevices, acceptSocket } from './rf.js';
import { allowedOrigin } from './voice.js';

const BLOCK = 320;                       // audio samples per modulated block (20 ms)
const LEAD = Math.round(TX.audioRate * 0.2); // never run more than 200 ms ahead of real time
const MIC_MAX = TX.audioRate / 2;        // microphone jitter buffer cap (500 ms; oldest dropped)
export const SILENCE_MS = 15000;         // no microphone frames this long → close

/** The command that transmits IQ from stdin on a device. Pure. { cmd, args, format } or { error }. */
export function txCommand(driver, { freqHz, gainDb = TX.defaultGainDb }) {
  const f = String(Math.round(freqHz)), g = clampGain(gainDb);
  if (driver === 'hackrf') return { cmd: 'hackrf_transfer', format: 'int8', args: ['-t', '-', '-f', f, '-s', String(TX.iqRate), '-b', '1750000', '-x', String(g), '-a', '0'] };
  if (driver === 'bladerf') return { cmd: 'bladeRF-cli', format: 'sc16q11', args: ['-e', [
    `set frequency tx ${f}`, `set samplerate tx ${TX.iqRate}`, 'set bandwidth tx 1500000', `set gain tx ${g}`,
    'tx config file=/dev/stdin format=bin samples=8192 buffers=32 xfers=16 repeat=1 delay=0', 'tx start', 'tx wait'].join('; ')] };
  if (driver === 'fake') return { cmd: null, args: [], format: 'int8', fake: true };
  return { error: `cannot transmit through a ${driver}` };
}

/** FIDELITY_FAKE_TX: a process whose stdin swallows the IQ (counting it). Nothing radiates. */
export function fakeTransmitter() {
  const p = new EventEmitter();
  p.bytes = 0;
  p.stdin = new Writable({ write(chunk, _e, cb) { p.bytes += chunk.length; cb(); } });
  p.stdin.on('finish', () => setImmediate(() => p.emit('close', 0)));
  p.stderr = new EventEmitter();
  p.kill = () => { setImmediate(() => p.emit('close', null)); return true; };
  return p;
}

const realClock = { now: () => Date.now(), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t) };

/**
 * One transmission. onEvent receives { type: 'state' | 'closed', … }. The caller has already passed txGate.
 * Returns { pushAudio(Buffer Int16LE), close(reason), kill(), info() }.
 */
export function createTxSession({ driver, freqHz, callsign, gainDb = TX.defaultGainDb, timeoutS = TX.defaultTimeoutS, spawn = nodeSpawn, clock = realClock, onEvent = () => {}, silenceMs = SILENCE_MS, modulator = createFmModulator }) {
  const cmd = txCommand(driver, { freqHz, gainDb });
  if (cmd.error) throw Object.assign(new Error(cmd.error), { status: 400 });
  const call = normalizeCallsign(callsign), timeoutMs = clampTimeoutS(timeoutS) * 1000, rate = TX.audioRate;
  const mod = modulator({ format: cmd.format });
  const proc = cmd.fake ? fakeTransmitter() : spawn(cmd.cmd, cmd.args, { stdio: ['pipe', 'ignore', 'pipe'] });
  const startedAt = clock.now();
  let state = 'tx', reason = null, lastIdAt = startedAt, lastAudioAt = startedAt, produced = 0, ended = false, waitingDrain = false;
  let mic = [], micLen = 0, id = null, idPos = 0, ids = 0, idsAtClose = 0, timer = null, killTimer = null, lastState = 0, stderr = '', exitCode;

  const info = () => { const c = txClock({ startedAt, lastIdAt, timeoutMs, now: clock.now() }); return { state, freqHz, callsign: call, driver, startedAt, elapsedMs: c.elapsedMs, remainingMs: c.remainingMs, timeoutMs, ids, sendingId: !!id, bytes: proc.bytes, reason }; };
  const emitState = () => { lastState = clock.now(); onEvent({ type: 'state', ...info() }); };

  function queueId() { if (!id) { id = cwAudio(call); idPos = 0; } }
  /** The next block to modulate: the ID while one is queued, else the microphone (silence when it runs dry). */
  function nextBlock() {
    if (id) {
      const s = id.subarray(idPos, idPos + BLOCK);
      idPos += s.length;
      if (idPos >= id.length) { id = null; ids++; lastIdAt = clock.now(); }
      return { samples: s, raw: true };
    }
    if (state !== 'tx') return null; // closing and the ID is out: done
    const out = new Float32Array(BLOCK);
    let o = 0;
    while (o < BLOCK && mic.length) {
      const c = mic[0], n = Math.min(BLOCK - o, c.length);
      out.set(c.subarray(0, n), o); o += n; micLen -= n;
      if (n === c.length) mic.shift(); else mic[0] = c.subarray(n);
    }
    return { samples: out, raw: false };
  }

  function pump() {
    timer = null;
    if (ended) return;
    const now = clock.now(), c = txClock({ startedAt, lastIdAt, timeoutMs, now });
    if (state === 'tx' && c.timedOut) beginClose('timeout');
    else if (state === 'tx' && now - lastAudioAt >= silenceMs) beginClose('no-audio');
    else if (state === 'tx' && c.idDue) queueId();
    while (!waitingDrain) {
      if (produced >= ((now - startedAt) / 1000) * rate + LEAD) break;
      const b = nextBlock();
      if (!b) { ended = true; proc.stdin.end(); armKill(); break; }
      produced += b.samples.length;
      if (!proc.stdin.write(mod.modulate(b.samples, { raw: b.raw }))) { waitingDrain = true; proc.stdin.once('drain', () => { waitingDrain = false; if (!timer) pump(); }); }
    }
    if (now - lastState >= 1000) emitState();
    if (!ended && !timer) timer = clock.setTimeout(pump, 20);
  }
  function armKill() { killTimer = clock.setTimeout(() => { try { proc.kill('SIGTERM'); } catch { /* gone */ } }, 5000); }
  function beginClose(why) {
    if (state !== 'tx') return;
    state = 'closing'; reason = why; mic = []; micLen = 0;
    idsAtClose = id ? ids - 1 : ids; // an ID already under way counts as the closing one
    queueId(); // the station ID always ends a transmission
    emitState();
  }
  function finish(code) {
    if (state === 'closed') return;
    if (timer) clock.clearTimeout(timer);
    if (killTimer) clock.clearTimeout(killTimer);
    timer = null; ended = true; exitCode = code;
    const early = state === 'tx';
    state = 'closed';
    if (early) reason = 'device';
    onEvent({ type: 'closed', ...info(), idSent: !early && ids > idsAtClose, exitCode: code, error: early ? (stderr.trim().split('\n').pop() || `${cmd.cmd} stopped`) : null });
  }
  proc.on('close', (code) => finish(code));
  proc.on('error', (e) => { stderr += `${cmd.cmd}: ${e.code === 'ENOENT' ? 'not installed' : e.message}\n`; finish(-1); });
  proc.stderr?.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
  proc.stdin.on('error', () => { /* the tool exited; 'close' reports it */ });
  emitState();
  pump();

  return {
    /** Microphone frames (Int16 LE PCM at 16 kHz). Ignored once closing. */
    pushAudio(buf) {
      if (state !== 'tx') return;
      const x = pcm16ToFloat(buf);
      mic.push(x); micLen += x.length; lastAudioAt = clock.now();
      while (micLen > MIC_MAX && mic.length > 1) micLen -= mic.shift().length;
    },
    close(why = 'operator') { beginClose(why); },
    /** Stop at once (no ID): only when the backend itself is going away. */
    kill() { try { proc.kill('SIGKILL'); } catch { /* gone */ } },
    info,
    pump,
  };
}

/** Is this request from this machine to this machine? (peer address, Host, Origin.) */
export function loopbackRequest(req) {
  const peer = req.socket?.remoteAddress ?? '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)) return false;
  const hostname = (h) => { try { return new URL(`http://${h}`).hostname; } catch { return null; } };
  const loop = (n) => n === '127.0.0.1' || n === 'localhost' || n === '[::1]';
  if (!loop(hostname(req.headers.host ?? ''))) return false;
  const o = req.headers.origin;
  if (o) { let u; try { u = new URL(o); } catch { return false; } if (!loop(u.hostname) || !allowedOrigin(o, req.headers.host)) return false; }
  return true;
}

let active = null; // one transmission per backend

/** ws /api/rf/tx: open / audio / close a hailing frequency. `deps` lets tests swap devices, spawn and the clock. */
export async function handleTxUpgrade(req, socket, deps = {}) {
  if (!loopbackRequest(req)) { socket.end('HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\n\r\ntransmit control is for this machine only'); return; }
  const client = acceptSocket(req, socket);
  if (!client) return;
  const devicesFn = deps.devices ?? (async () => (await rfDevices()).tx);
  const tell = (o) => client.send(JSON.stringify(o));
  let session = null, opening = false, gone = false;
  client.onMessage(async (text) => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.type === 'open') {
      if (session || opening || active) return tell({ type: 'refused', code: 'busy', reason: 'A transmission is already in progress.' });
      opening = true;
      try {
        const g = txGate({ devices: await devicesFn(), driver: m.driver ?? null, callsign: m.callsign, attested: m.attested === true, freqHz: Number(m.freqHz), region: regionOf(m.region), converter: m.converter ?? null, antennas: Array.isArray(m.antennas) ? m.antennas : [], antennaId: m.antennaId ?? null });
        if (!g.ok) return tell({ type: 'refused', code: g.code, reason: g.reason });
        if (gone || active) return;
        session = active = createTxSession({ driver: g.device.driver, freqHz: Number(m.freqHz), callsign: m.callsign, gainDb: m.gainDb, timeoutS: m.timeoutS, spawn: deps.spawn, clock: deps.clock,
          onEvent: (e) => { tell(e); if (e.type === 'closed') { if (active === session) active = null; session = null; } } });
        tell({ type: 'open', freqHz: Number(m.freqHz), device: g.device.label, band: g.band.name, note: g.note, fake: !!g.device.fake, antenna: g.antenna.name, directional: !!g.antenna.directional });
      } catch (e) {
        tell({ type: 'refused', code: 'error', reason: String(e.message || e) });
      } finally { opening = false; }
    } else if (m.type === 'close') session?.close('operator');
  });
  client.onBinary((buf) => session?.pushAudio(buf));
  client.onClose(() => { gone = true; session?.close('disconnect'); });
}

/** For tests: forget a stuck session. */
export const _resetActive = () => { active = null; };
