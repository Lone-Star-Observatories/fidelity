// COMMS (#69): reception. The backend
//   - relays internet radio streams the station map lists (/api/comms/stream), stripping SHOUTcast/
//     Icecast metadata and keeping the current title (/api/comms/nowplaying);
//   - fetches traffic-camera stills and clips the map lists (/api/comms/media);
//   - reports SDR hardware on this machine (/api/rf/devices);
//   - relays a public KiwiSDR receiver's audio and waterfall to the browser (ws /api/rf/kiwi);
//   - streams a local SDR (ws /api/rf/local, loopback only): one IQ stream per device feeds the
//     waterfall and the audio (server/sdr.js, server/sdrdsp.js);
//   - checks whether a listed WebSDR page may be framed in the main viewer (/api/rf/websdr/frame).
// Every upstream address must come from the cached station lists: this is not an open proxy.
// Nothing here transmits: transmission (a licensed operator, amateur bands only) is server/tx.js.

import net from 'node:net';
import tls from 'node:tls';
import { spawn } from 'node:child_process';
import { signalLayer, stationListHas } from './signals.js';
import { encodeFrame, decodeFrames, acceptKey, allowedOrigin } from './voice.js';
import { createSdrSession, rxIqCmd, deviceRange } from './sdr.js';
import { cached } from './cache.js';
import { framingVerdict } from '../src/data/websdr.js';
import { kiwiTag, kiwiTuneCommands, KIWI_SND_SETUP, KIWI_WF_SETUP, icySplitter } from '../src/data/rf.js';

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
  if (!url || !((await layerUrls('radio').catch(() => new Set())).has(url) || (await stationListHas(url)))) throw forbidden('not a listed station stream');
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

// ---- WebSDR in the main viewer -------------------------------------------------------------------

/** Response headers of a listed WebSDR page: HEAD first (the WebSDR server answers 501), else a GET read to the headers only. */
async function pageHeaders(url) {
  const opts = { redirect: 'follow', headers: { 'user-agent': UA } };
  try {
    const r = await fetch(url, { ...opts, method: 'HEAD', signal: AbortSignal.timeout(10000) });
    if (r.ok) return { status: r.status, finalUrl: r.url, headers: Object.fromEntries(r.headers) };
  } catch { /* try GET */ }
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, method: 'GET', signal: ac.signal });
    const out = { status: r.status, finalUrl: r.url, headers: Object.fromEntries(r.headers) };
    try { await r.body?.cancel(); } catch { /* fine */ }
    return out;
  } finally { clearTimeout(t); ac.abort(); }
}

/**
 * GET /api/rf/websdr/frame?u=: may this listed WebSDR page be shown in an iframe? Checks the
 * operator's X-Frame-Options / CSP frame-ancestors once a week (cached). Listed URLs only.
 * → { url, finalUrl, status, embeddable, reason, checked, cache }.
 */
export async function websdrFrame(url, { list = () => layerUrls('websdr'), fetchHeaders = pageHeaders } = {}) {
  let ok = false;
  try { ok = !!url && (await list()).has(url); } catch { /* list unavailable */ }
  if (!ok) throw forbidden('not a listed WebSDR receiver');
  const c = await cached('websdr-frame', url, 7 * 864e5, async () => {
    let h;
    try { h = await fetchHeaders(url); } catch (e) { throw Object.assign(new Error(`could not reach the receiver (${e.cause?.code ?? e.name ?? 'error'})`), { status: 502 }); }
    if (h.status >= 400) throw Object.assign(new Error(`the receiver answered HTTP ${h.status}`), { status: 502 });
    return { url, finalUrl: h.finalUrl || url, status: h.status, ...framingVerdict(h.headers), checked: new Date().toISOString() };
  });
  return { ...c.value, cache: c.cache };
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
/**
 * SDR hardware and tools on this machine. `tx` lists transmit-capable devices (HackRF, bladeRF;
 * an RTL-SDR only receives), `ready` when their transmit tool is installed; server/tx.js uses them
 * only for a licensed operator's hailing frequency. FIDELITY_FAKE_TX=1 (development only) adds a
 * simulated transmitter that radiates nothing.
 */
export async function rfDevices() {
  if (deviceCache && Date.now() - deviceCache.at < 30000) return deviceCache.value;
  const [rtl, hack, blade, soapy, rtlFm, rtlPower, rxFm, rxPower, hackTx] = await Promise.all([
    probe('rtl_test', ['-t']), probe('hackrf_info', []), probe('bladeRF-cli', ['-p']), probe('SoapySDRUtil', ['--find']),
    probe('rtl_fm', ['-h'], 2000), probe('rtl_power', ['-h'], 2000), probe('rx_fm', ['-h'], 2000), probe('rx_power', ['-h'], 2000), probe('hackrf_transfer', ['-h'], 2000)]);
  const rtlN = Number(rtl.out.match(/Found (\d+) device/)?.[1] ?? 0);
  const hackN = (hack.out.match(/Serial number/gi) ?? []).length;
  // bladeRF-cli -p lists a "Serial" line per connected board; SoapySDRUtil --find also names a bladerf driver
  const bladeN = (blade.out.match(/Serial\s*#?:/gi) ?? []).length || (/driver\s*=\s*bladerf/i.test(soapy.out) ? 1 : 0);
  // bladeRF-cli -p names the board ("Nuand bladeRF 2.0" for the 2.0 micro); a bladeRF x40/x115 tunes 300 MHz–3.8 GHz
  const bladeModel = /bladeRF\s*2\.0/i.test(blade.out) ? '2.0' : /Description:.*bladeRF/i.test(blade.out) ? '1' : null;
  const tools = { rtl_test: rtl.ok, rtl_fm: rtlFm.ok, rtl_power: rtlPower.ok, rx_fm: rxFm.ok, rx_power: rxPower.ok, hackrf_info: hack.ok, hackrf_transfer: hackTx.ok, bladeRF_cli: blade.ok, SoapySDRUtil: soapy.ok };
  const xb200 = process.env.FIDELITY_BLADERF_XB200 === '1';
  const value = {
    rx: rxDevices({ rtlN, bladeN, hackN, tools, xb200, fake: process.env.FIDELITY_FAKE_SDR === '1' }),
    tx: txDevices({ hackN, bladeN, bladeModel, tools, fake: process.env.FIDELITY_FAKE_TX === '1' }),
    tools,
    soapy: soapy.ok ? soapy.out.split('\n').filter((l) => /driver|label/i.test(l)).slice(0, 12) : [],
  };
  deviceCache = { at: Date.now(), value };
  return value;
}

/**
 * Receive devices from the probe counts (pure). Each streams IQ (one process feeds the waterfall and
 * the audio) when its tool is installed. `fake` adds the SIMULATED SDR (FIDELITY_FAKE_SDR=1, development).
 */
export function rxDevices({ rtlN = 0, bladeN = 0, hackN = 0, tools = {}, xb200 = false, fake = false }) {
  const dev = (driver, kind, n, extra = {}) => {
    const cmd = rxIqCmd(driver, { centreHz: deviceRange(driver, { xb200 })[0] }, tools);
    return { kind, driver, label: `${kind.toUpperCase()}${n > 1 ? ` × ${n}` : ''}`, rangeHz: deviceRange(driver, { xb200 }), streaming: !cmd.error, waterfall: !cmd.error, tool: cmd.tool ?? null, note: cmd.error ?? null, ...extra };
  };
  return [...(rtlN ? [dev('rtl', 'rtl-sdr', rtlN)] : []), ...(bladeN ? [dev('bladerf', 'bladeRF', bladeN, { xb200 })] : []), ...(hackN ? [dev('hackrf', 'hackrf', hackN)] : []),
    ...(fake ? [{ ...dev('fake', 'simulated', 1), label: 'SIMULATED SDR', fake: true, note: 'FIDELITY_FAKE_SDR=1: a development stand-in. Synthetic IQ (a few tones and noise); nothing is received.' }] : [])];
}

/** Transmit-capable devices from the probe counts (pure). The bladeRF is the primary transmitter (listed first). */
export function txDevices({ hackN = 0, bladeN = 0, bladeModel = null, tools = {}, fake = false }) {
  const bladeLabel = bladeModel === '2.0' ? 'bladeRF 2.0 micro' : bladeModel === '1' ? 'bladeRF x40/x115' : 'bladeRF';
  return [
    ...(bladeN ? [{ kind: 'bladeRF', driver: 'bladerf', model: bladeModel, label: `${bladeLabel}${bladeN > 1 ? ` × ${bladeN}` : ''}`, tool: 'bladeRF-cli', ready: !!tools.bladeRF_cli,
      rangeHz: bladeModel === '1' ? [300e6, 3.8e9] : deviceRange('bladerf'),
      note: tools.bladeRF_cli ? 'Transmits through bladeRF-cli (SC16 Q11 IQ from stdin, 2 Msps, lowest TX gain by default).' : 'bladeRF-cli is not installed (install libbladeRF / bladeRF-cli) — cannot transmit.' }] : []),
    ...(hackN ? [{ kind: 'hackrf', driver: 'hackrf', label: `HackRF${hackN > 1 ? ` × ${hackN}` : ''}`, tool: 'hackrf_transfer', ready: !!tools.hackrf_transfer, rangeHz: deviceRange('hackrf'),
      note: tools.hackrf_transfer ? 'Transmits through hackrf_transfer (int8 IQ on stdin), RF amp off.' : 'hackrf_transfer is not installed (install the hackrf tools) — cannot transmit.' }] : []),
    ...(fake ? [{ kind: 'simulated', driver: 'fake', label: 'SIMULATED TX', tool: null, ready: true, fake: true, rangeHz: [1e6, 6e9],
      note: 'FIDELITY_FAKE_TX=1: a development stand-in. The modulator runs; the IQ goes nowhere and nothing radiates.' }] : []),
  ];
}

export { sndFrame, rxIqCmd, deviceRange } from './sdr.js';

// ---- websockets ----------------------------------------------------------------------------------

/** Is this request from this machine to this machine? (peer address, Host, Origin.) Local SDR control and transmit only. */
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

/** Accept a browser WebSocket: { send(text|Buffer), onMessage(fn), onBinary(fn), onClose(fn), close() }. */
export function acceptSocket(req, socket) {
  const refuse = (code, msg) => { socket.end(`HTTP/1.1 ${code} ${msg}\r\ncontent-type: text/plain\r\n\r\n${msg}`); return null; };
  if (!allowedOrigin(req.headers.origin, req.headers.host)) return refuse(403, 'Forbidden origin');
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return refuse(400, 'Bad Request');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);
  let rest = Buffer.alloc(0), onMsg = () => {}, onBin = () => {}, onClose = () => {}, closed = false;
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
      else if (f.opcode === 2) onBin(f.payload);
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  return {
    send: (x) => { if (!closed && !socket.destroyed) socket.write(typeof x === 'string' ? encodeFrame(x) : encodeFrame(x, 2)); },
    onMessage: (fn) => { onMsg = fn; },
    onBinary: (fn) => { onBin = fn; },
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

/**
 * ws /api/rf/local: the local SDR (loopback only). One IQ stream per device feeds the waterfall rows
 * and the demodulated audio (server/sdr.js). `deps` lets tests swap the tools and spawn.
 */
export async function handleLocalUpgrade(req, socket, deps = {}) {
  if (!loopbackRequest(req)) { socket.end('HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\n\r\nlocal SDR control is for this machine only'); return; }
  const client = acceptSocket(req, socket);
  if (!client) return;
  const tools = deps.tools ?? (await rfDevices()).tools;
  const xb200 = deps.xb200 ?? process.env.FIDELITY_BLADERF_XB200 === '1';
  const fakeOk = deps.fakeOk ?? process.env.FIDELITY_FAKE_SDR === '1';
  const session = createSdrSession({ send: (x) => client.send(x), tools, spawn: deps.spawn ?? null, xb200 });
  const tell = (o) => client.send(JSON.stringify(o));
  client.onMessage(async (text) => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.type === 'tune' && Number.isFinite(m.freqHz)) {
      const driver = String(m.driver ?? 'rtl');
      if (driver === 'fake' && !fakeOk) return tell({ type: 'error', message: 'the simulated SDR needs FIDELITY_FAKE_SDR=1' });
      const [lo, hi] = deviceRange(driver, { xb200 });
      if (!(m.freqHz >= lo && m.freqHz <= hi)) return tell({ type: 'error', message: `${(m.freqHz / 1e6).toFixed(3)} MHz is outside this device's ${lo < 1e6 ? `${(lo / 1e3).toFixed(0)} kHz` : `${(lo / 1e6).toFixed(0)} MHz`}–${(hi / 1e6).toFixed(0)} MHz range` });
      session.tune({ ...m, driver });
    } else if (m.type === 'scan' && Number.isFinite(m.fromHz) && Number.isFinite(m.toHz)) {
      const a = Math.min(m.fromHz, m.toHz), b = Math.max(m.fromHz, m.toHz);
      if (!(b - a > 0 && b - a <= 40e6)) return tell({ type: 'error', message: 'scan span must be under 40 MHz' });
      const signals = await session.scan({ fromHz: a, toHz: b });
      tell({ type: 'scan', fromHz: a, toHz: b, signals });
    } else if (m.type === 'stop') session.stop();
  });
  client.onClose(() => session.stop());
  tell({ type: 'ready' });
}
