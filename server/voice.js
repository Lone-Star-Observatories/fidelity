// "Computer" voice (#21): a WebSocket relay from the browser to the OpenAI Realtime API, so the
// API key stays in this process (env FIDELITY_OPENAI_KEY or OPENAI_API_KEY) and never reaches
// the page. The browser only ever opens ws://127.0.0.1:4011/api/voice. Dependency-free: a
// minimal RFC 6455 server side here, Node's built-in WebSocket client upstream.
//
// Only same-origin pages may connect (the Origin must be this backend or the Vite dev server),
// so another website open in the browser cannot use the key.

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const voiceConfig = () => ({
  key: process.env.FIDELITY_OPENAI_KEY || process.env.OPENAI_API_KEY || '',
  model: process.env.FIDELITY_REALTIME_MODEL || 'gpt-realtime',
  url: process.env.FIDELITY_REALTIME_URL || 'wss://api.openai.com/v1/realtime',
});

/** GET /api/voice/status: is a key configured (never the key itself). */
export const voiceStatus = () => { const c = voiceConfig(); return { configured: !!c.key, model: c.model }; };

// ---- frames -------------------------------------------------------------------------------------
/** Encode one unmasked server frame. */
export function encodeFrame(payload, opcode = 1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const n = data.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, data]);
}
/**
 * Decode as many complete frames as `buf` holds: { frames: [{ fin, opcode, payload }], rest }.
 * Client frames are masked (RFC 6455 §5.3); unmasked ones are accepted too (tests).
 */
export function decodeFrames(buf) {
  const frames = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const b0 = buf[off], b1 = buf[off + 1];
    let len = b1 & 127, p = off + 2;
    if (len === 126) { if (buf.length - p < 2) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (buf.length - p < 8) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    const masked = (b1 & 128) !== 0;
    const mask = masked ? buf.subarray(p, p + 4) : null;
    if (masked) p += 4;
    if (buf.length - p < len) break;
    const payload = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    frames.push({ fin: (b0 & 128) !== 0, opcode: b0 & 15, payload });
    off = p + len;
  }
  return { frames, rest: buf.subarray(off) };
}
/** Sec-WebSocket-Accept for a client key. */
export const acceptKey = (key) => crypto.createHash('sha1').update(key + GUID).digest('base64');

export const allowedOrigin = (origin, host) => {
  if (!origin) return true; // non-browser clients (tests, curl)
  try {
    const o = new URL(origin);
    return o.host === host || ['127.0.0.1:5173', 'localhost:5173'].includes(o.host);
  } catch { return false; }
};

/** Handle an HTTP upgrade on /api/voice: relay frames both ways until either side closes. */
export function handleVoiceUpgrade(req, socket) {
  const cfg = voiceConfig();
  const refuse = (code, msg) => { socket.end(`HTTP/1.1 ${code} ${msg}\r\ncontent-type: text/plain\r\n\r\n${msg}`); };
  if (!allowedOrigin(req.headers.origin, req.headers.host)) return refuse(403, 'Forbidden origin');
  if (!cfg.key) return refuse(503, 'No OpenAI key: set FIDELITY_OPENAI_KEY (or OPENAI_API_KEY) for the backend');
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return refuse(400, 'Bad Request');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);

  const toClient = (text) => { if (!socket.destroyed) socket.write(encodeFrame(text)); };
  const pending = []; // client messages that arrive before the upstream is open
  let upstream = null, closed = false;
  const close = (why) => {
    if (closed) return;
    closed = true;
    try { if (!socket.destroyed) socket.end(encodeFrame(Buffer.from([0x03, 0xe8]), 8)); } catch { /* gone */ }
    try { upstream?.close(); } catch { /* gone */ }
    if (why) console.warn(`voice: ${why}`);
  };
  try {
    upstream = new WebSocket(`${cfg.url}?model=${encodeURIComponent(cfg.model)}`, { headers: { Authorization: `Bearer ${cfg.key}` } });
  } catch (err) { toClient(JSON.stringify({ type: 'error', error: { message: `upstream: ${err.message}` } })); return close(err.message); }
  upstream.onopen = () => { for (const m of pending.splice(0)) upstream.send(m); toClient(JSON.stringify({ type: 'relay.open', model: cfg.model })); };
  upstream.onmessage = (e) => toClient(typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString());
  upstream.onerror = () => toClient(JSON.stringify({ type: 'error', error: { message: 'Could not reach the OpenAI Realtime API' } }));
  upstream.onclose = () => close();

  let buf = Buffer.alloc(0), parts = [];
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const { frames, rest } = decodeFrames(buf);
    buf = Buffer.from(rest);
    for (const f of frames) {
      if (f.opcode === 8) return close();
      if (f.opcode === 9) { socket.write(encodeFrame(f.payload, 10)); continue; }
      if (f.opcode === 1 || f.opcode === 0) {
        parts.push(f.payload);
        if (!f.fin) continue;
        const text = Buffer.concat(parts).toString(); parts = [];
        if (upstream.readyState === 1) upstream.send(text); else pending.push(text);
      }
    }
  });
  socket.on('close', () => close());
  socket.on('error', () => close());
}
