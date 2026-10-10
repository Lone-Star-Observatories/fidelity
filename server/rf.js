// COMMS (#69): reception only. The backend
//   - relays internet radio streams the station map lists (/api/comms/stream), stripping SHOUTcast/
//     Icecast metadata and keeping the current title (/api/comms/nowplaying);
//   - fetches traffic-camera stills and clips the map lists (/api/comms/media);
//   - reports SDR hardware on this machine (/api/rf/devices);
//   - relays a public KiwiSDR receiver's audio and waterfall to the browser (ws /api/rf/kiwi);
//   - streams a local RTL-SDR through rtl_fm (ws /api/rf/local) and sweeps it with rtl_power
//     (/api/rf/local/scan).
// Every upstream address must come from the cached station lists: this is not an open proxy.
// Nothing here transmits.

import net from 'node:net';
import tls from 'node:tls';
import { spawn } from 'node:child_process';
import { signalLayer, radioGardenHas } from './signals.js';
import { encodeFrame, decodeFrames, acceptKey, allowedOrigin } from './voice.js';
import { kiwiTag, findSignals, kiwiTuneCommands, KIWI_SND_SETUP, KIWI_WF_SETUP, icySplitter } from '../src/data/rf.js';

const UA = 'USS-Fidelity/0.3 (local astronomy explorer)';
const forbidden = (msg) => Object.assign(new Error(msg), { status: 403 });
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

/** Every URL a layer's markers carry (homepage, stream, image, clip). */
async function layerUrls(id) {
  const l = await signalLayer(id);
  return new Set(l.markers.flatMap((m) => [m[3], m[5]]).filter((x) => typeof x === 'string'));
}

// ---- internet radio ----------------------------------------------------------------------------

/**
 * GET over a raw socket: SHOUTcast v1 answers "ICY 200 OK", which fetch rejects. Resolves
 * { status, headers, socket, head } once the header block is in (redirects followed).
 */
export function rawGet(url, { headers = {}, hops = 4, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return reject(bad('http(s) only'));
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
    const sock = u.protocol === 'https:' ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect({ host: u.hostname, port });
    const timer = setTimeout(() => { sock.destroy(); reject(Object.assign(new Error('upstream timeout'), { status: 504 })); }, timeoutMs);
    sock.once('error', (e) => { clearTimeout(timer); reject(Object.assign(e, { status: 502 })); });
    sock.once(u.protocol === 'https:' ? 'secureConnect' : 'connect', () => {
      const h = { Host: u.host, 'User-Agent': UA, Accept: '*/*', Connection: 'close', ...headers };
      sock.write(`GET ${u.pathname}${u.search} HTTP/1.0\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) { if (buf.length > 65536) { sock.destroy(); reject(bad('header too large')); } return; }
      sock.off('data', onData);
      clearTimeout(timer);
      const [statusLine, ...lines] = buf.subarray(0, end).toString('latin1').split('\r\n');
      const status = Number(statusLine.split(' ')[1]) || 0;
      const hdrs = Object.fromEntries(lines.map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; }));
      const head = buf.subarray(end + 4);
      if (status >= 300 && status < 400 && hdrs.location && hops > 0) {
        sock.destroy();
        return rawGet(new URL(hdrs.location, url).href, { headers, hops: hops - 1, timeoutMs }).then(resolve, reject);
      }
      sock.pause();
      resolve({ status, headers: hdrs, socket: sock, head });
    };
    sock.on('data', onData);
  });
}

const nowPlaying = new Map(); // stream url → { title, at }

/** Pipe a listed radio stream to `res`, metadata removed. */
export async function streamStation(url, res) {
  if (!url || !((await layerUrls('radio').catch(() => new Set())).has(url) || (await radioGardenHas(url)))) throw forbidden('not a listed station stream');
  let up;
  try { up = await rawGet(url, { headers: { 'Icy-MetaData': '1' } }); }
  catch { return streamViaFetch(url, res); } // e.g. only an HTTP proxy reaches the internet; SHOUTcast v1 ("ICY 200") still needs the raw socket
  if (up.status !== 200 || /chunked/i.test(up.headers['transfer-encoding'] ?? '')) { up.socket.destroy(); return streamViaFetch(url, res); } // 426, chunked…: let fetch handle HTTP/1.1
  const metaint = Number(up.headers['icy-metaint']) || 0;
  const name = up.headers['icy-name'] ?? null;
  nowPlaying.set(url, { title: nowPlaying.get(url)?.title ?? null, name, genre: up.headers['icy-genre'] ?? null, bitrate: up.headers['icy-br'] ?? null, at: new Date().toISOString() });
  const split = metaint ? icySplitter(metaint, (title) => nowPlaying.set(url, { ...nowPlaying.get(url), title, at: new Date().toISOString() })) : (c) => c;
  res.writeHead(200, { 'content-type': up.headers['content-type'] ?? 'audio/mpeg', 'cache-control': 'no-store' });
  const write = (chunk) => { const a = split(new Uint8Array(chunk)); if (a.length) res.write(Buffer.from(a.buffer, a.byteOffset, a.length)); };
  if (up.head.length) write(up.head);
  up.socket.on('data', write);
  up.socket.on('end', () => res.end());
  up.socket.on('error', () => res.end());
  res.on('close', () => up.socket.destroy());
  up.socket.resume();
}
/** The same through fetch (honours the environment's proxy). */
async function streamViaFetch(url, res) {
  const ac = new AbortController();
  const r = await fetch(url, { headers: { 'user-agent': UA, 'Icy-MetaData': '1' }, signal: ac.signal });
  if (!r.ok || !r.body) throw Object.assign(new Error(`station HTTP ${r.status}`), { status: 502 });
  const metaint = Number(r.headers.get('icy-metaint')) || 0;
  nowPlaying.set(url, { title: nowPlaying.get(url)?.title ?? null, name: r.headers.get('icy-name'), genre: r.headers.get('icy-genre'), bitrate: r.headers.get('icy-br'), at: new Date().toISOString() });
  const split = metaint ? icySplitter(metaint, (title) => nowPlaying.set(url, { ...nowPlaying.get(url), title, at: new Date().toISOString() })) : (c) => c;
  res.writeHead(200, { 'content-type': r.headers.get('content-type') ?? 'audio/mpeg', 'cache-control': 'no-store' });
  res.on('close', () => ac.abort());
  try {
    for await (const chunk of r.body) { const a = split(new Uint8Array(chunk)); if (a.length && !res.write(Buffer.from(a.buffer, a.byteOffset, a.length))) await new Promise((ok) => res.once('drain', ok)); }
  } catch { /* client left or upstream ended */ }
  res.end();
}
export const stationNowPlaying = (url) => nowPlaying.get(url) ?? { title: null };

// ---- camera stills and clips ---------------------------------------------------------------------

/** A traffic-camera still or clip the map lists. */
export async function cameraMedia(url) {
  if (!url || !(await layerUrls('traffic')).has(url)) throw forbidden('not a listed camera');
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Object.assign(new Error(`camera HTTP ${r.status}`), { status: 502 });
  return { binary: true, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') ?? 'image/jpeg', maxAge: 30 };
}

// ---- local hardware ------------------------------------------------------------------------------

/** Run a tool briefly: { ok, out } (ok false when it is not installed). */
function probe(cmd, args, ms = 6000) {
  return new Promise((resolve) => {
    let out = '', done = false;
    let p;
    try { p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return resolve({ ok: false, out: '' }); }
    const finish = (ok) => { if (done) return; done = true; clearTimeout(t); try { p.kill('SIGKILL'); } catch { /* gone */ } resolve({ ok, out }); };
    const t = setTimeout(() => finish(true), ms);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('error', () => finish(false));
    p.on('close', () => finish(true));
  });
}

let deviceCache = null;
/** SDR hardware and tools on this machine. Transmit-capable devices are reported, not used. */
export async function rfDevices() {
  if (deviceCache && Date.now() - deviceCache.at < 30000) return deviceCache.value;
  const [rtl, hack, soapy, rtlFm, rtlPower] = await Promise.all([probe('rtl_test', ['-t']), probe('hackrf_info', []), probe('SoapySDRUtil', ['--find']), probe('rtl_fm', ['-h'], 2000), probe('rtl_power', ['-h'], 2000)]);
  const rtlN = Number(rtl.out.match(/Found (\d+) device/)?.[1] ?? 0);
  const hackN = (hack.out.match(/Serial number/gi) ?? []).length;
  const value = {
    rx: rtlN ? [{ kind: 'rtl-sdr', label: `RTL-SDR × ${rtlN}`, rangeHz: [24e6, 1766e6], streaming: rtlFm.ok, scanning: rtlPower.ok }] : [],
    tx: hackN ? [{ kind: 'hackrf', label: `HackRF × ${hackN}`, note: 'Transmit-capable. Transmission is not enabled in this version.' }] : [],
    tools: { rtl_test: rtl.ok, rtl_fm: rtlFm.ok, rtl_power: rtlPower.ok, hackrf_info: hack.ok, SoapySDRUtil: soapy.ok },
    soapy: soapy.ok ? soapy.out.split('\n').filter((l) => /driver|label/i.test(l)).slice(0, 12) : [],
  };
  deviceCache = { at: Date.now(), value };
  return value;
}

/** Sweep a local RTL-SDR with rtl_power and list clear signals. from/to Hz, span ≤ 40 MHz. */
export async function localScan(fromHz, toHz) {
  const a = Number(fromHz), b = Number(toHz);
  if (!(a >= 24e6 && b > a && b <= 1766e6 && b - a <= 40e6)) throw bad('need 24 MHz ≤ from < to ≤ 1766 MHz, span ≤ 40 MHz');
  const step = Math.max(1000, Math.round((b - a) / 2048));
  const { ok, out } = await probe('rtl_power', ['-f', `${a}:${b}:${step}`, '-i', '2', '-1', '-'], 30000);
  if (!ok) throw Object.assign(new Error('rtl_power is not installed'), { status: 404 });
  const rows = out.split('\n').filter((l) => /^\d{4}-\d\d-\d\d,/.test(l)).map((l) => l.split(',').map((x) => x.trim()));
  rows.sort((x, y) => Number(x[2]) - Number(y[2]));
  const db = rows.flatMap((r) => r.slice(6).map(Number)).filter(Number.isFinite);
  if (!db.length) throw Object.assign(new Error('no sweep data (is the dongle busy?)'), { status: 502 });
  return { fromHz: a, toHz: b, bins: db.length, signals: findSignals(Float32Array.from(db), { startHz: a, spanHz: b - a, snrDb: 10 }) };
}

// ---- websockets ----------------------------------------------------------------------------------

/** Accept a browser WebSocket: { send(text|Buffer), onMessage(fn), onClose(fn), close() }. */
function acceptSocket(req, socket) {
  const refuse = (code, msg) => { socket.end(`HTTP/1.1 ${code} ${msg}\r\ncontent-type: text/plain\r\n\r\n${msg}`); return null; };
  if (!allowedOrigin(req.headers.origin, req.headers.host)) return refuse(403, 'Forbidden origin');
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return refuse(400, 'Bad Request');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);
  let rest = Buffer.alloc(0), onMsg = () => {}, onClose = () => {}, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try { if (!socket.destroyed) socket.end(encodeFrame(Buffer.from([0x03, 0xe8]), 8)); } catch { /* gone */ }
    onClose();
  };
  socket.on('data', (d) => {
    const { frames, rest: r } = decodeFrames(Buffer.concat([rest, d]));
    rest = r;
    for (const f of frames) {
      if (f.opcode === 8) return close();
      if (f.opcode === 9) { socket.write(encodeFrame(f.payload, 10)); continue; }
      if (f.opcode === 1) onMsg(f.payload.toString());
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  return {
    send: (x) => { if (!closed && !socket.destroyed) socket.write(typeof x === 'string' ? encodeFrame(x) : encodeFrame(x, 2)); },
    onMessage: (fn) => { onMsg = fn; },
    onClose: (fn) => { onClose = fn; },
    close,
  };
}

/** ws /api/rf/kiwi?r=<receiver url>: relay a listed KiwiSDR's audio (SND) and waterfall (W/F). */
export async function handleKiwiUpgrade(req, socket) {
  const r = new URL(req.url, 'http://local').searchParams.get('r') ?? '';
  let allowed = false;
  try { allowed = (await layerUrls('kiwisdr')).has(r); } catch { /* list unavailable */ }
  if (!allowed) { socket.end('HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\n\r\nnot a listed receiver'); return; }
  const client = acceptSocket(req, socket);
  if (!client) return;
  const u = new URL(r), ts = Date.now(), base = `ws://${u.host}${u.pathname.replace(/\/$/, '')}`;
  const ups = {};
  const tell = (o) => client.send(JSON.stringify(o));
  const open = (kind, path, setup) => {
    let w;
    try { w = new WebSocket(`${base}/${ts}/${path}`); } catch (e) { tell({ type: 'error', message: `${kind}: ${e.message}` }); return; }
    w.binaryType = 'arraybuffer';
    w.onopen = () => { for (const c of setup) w.send(c); tell({ type: 'open', kind }); if (kind === 'snd' && pendingTune) for (const c of kiwiTuneCommands(pendingTune)) w.send(c); };
    w.onmessage = (e) => {
      if (typeof e.data === 'string') return;
      const b = Buffer.from(e.data), { tag } = kiwiTag(b);
      if (tag === 'MSG' || tag === 'SND' || tag === 'W/F') client.send(b);
    };
    w.onerror = () => tell({ type: 'error', message: `Could not reach the receiver (${kind})` });
    w.onclose = () => { tell({ type: 'closed', kind }); };
    ups[kind] = w;
  };
  let pendingTune = null;
  open('snd', 'SND', KIWI_SND_SETUP);
  open('wf', 'W/F', KIWI_WF_SETUP);
  const keep = setInterval(() => { for (const w of Object.values(ups)) if (w.readyState === 1) w.send('SET keepalive'); }, 5000);
  client.onMessage((text) => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.type === 'tune' && Number.isFinite(m.freqHz) && m.freqHz > 0 && m.freqHz < 32e6) {
      pendingTune = { freqHz: m.freqHz, mode: m.mode, bwHz: m.bwHz, agc: m.agc };
      if (ups.snd?.readyState === 1) for (const c of kiwiTuneCommands(pendingTune)) ups.snd.send(c);
    } else if (m.type === 'zoom' && ups.wf?.readyState === 1) {
      const z = Math.max(0, Math.min(14, m.zoom | 0)), s = Math.max(0, m.start | 0);
      ups.wf.send(`SET zoom=${z} start=${s}`);
    }
  });
  client.onClose(() => { clearInterval(keep); for (const w of Object.values(ups)) { try { w.close(); } catch { /* gone */ } } });
}

/** Wrap 16-bit little-endian PCM (rtl_fm) as a Kiwi-style SND message so the browser has one path. */
export function sndFrame(le, seq, rssi = -127) {
  const n = Math.floor(le.length / 2), b = Buffer.alloc(3 + 7 + n * 2);
  b.write('SND', 0, 'latin1'); b.writeUInt8(0, 3); b.writeUInt32LE(seq >>> 0, 4); b.writeUInt16BE(Math.max(0, Math.round((rssi + 127) * 10)), 8);
  for (let i = 0; i < n; i++) b.writeInt16BE(le.readInt16LE(i * 2), 10 + i * 2);
  return b;
}

/** ws /api/rf/local: tune a local RTL-SDR through rtl_fm (24–1766 MHz). */
export function handleLocalUpgrade(req, socket) {
  const client = acceptSocket(req, socket);
  if (!client) return;
  let proc = null, seq = 0, carry = Buffer.alloc(0);
  const MODES = { wbfm: ['-M', 'wbfm', '-s', '200000', '-r', '12000'], nbfm: ['-M', 'fm', '-s', '12000'], am: ['-M', 'am', '-s', '12000'], usb: ['-M', 'usb', '-s', '12000'], lsb: ['-M', 'lsb', '-s', '12000'] };
  const stop = () => { if (proc) { try { proc.kill('SIGKILL'); } catch { /* gone */ } proc = null; } };
  const start = ({ freqHz, mode, gain }) => {
    stop();
    try {
      proc = spawn('rtl_fm', ['-f', String(Math.round(freqHz)), ...(MODES[mode] ?? MODES.nbfm), ...(gain != null ? ['-g', String(gain)] : []), '-l', '0', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { client.send(JSON.stringify({ type: 'error', message: e.message })); return; }
    proc.on('error', () => client.send(JSON.stringify({ type: 'error', message: 'rtl_fm is not installed (install rtl-sdr)' })));
    proc.stderr.on('data', (d) => { const s = String(d); if (/usb_claim_interface|No supported devices/i.test(s)) client.send(JSON.stringify({ type: 'error', message: s.trim().split('\n').pop() })); });
    proc.stdout.on('data', (d) => {
      const all = Buffer.concat([carry, d]), n = all.length - (all.length % 1024);
      for (let o = 0; o < n; o += 1024) client.send(sndFrame(all.subarray(o, o + 1024), seq++));
      carry = all.subarray(n);
    });
    client.send(JSON.stringify({ type: 'open', kind: 'local', freqHz, mode }));
  };
  client.onMessage((text) => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.type === 'tune' && m.freqHz >= 24e6 && m.freqHz <= 1766e6) start(m);
    if (m.type === 'stop') stop();
  });
  client.onClose(stop);
}
