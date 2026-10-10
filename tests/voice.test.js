import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { encodeFrame, decodeFrames, acceptKey, handleVoiceUpgrade, voiceStatus } from '../server/voice.js';

test('WebSocket frames round-trip (masked client frames, 16-bit lengths)', () => {
  const text = 'x'.repeat(300);
  const mask = Buffer.from([1, 2, 3, 4]), payload = Buffer.from(text);
  const masked = Buffer.from(payload.map((b, i) => b ^ mask[i & 3]));
  const frame = Buffer.concat([Buffer.from([0x81, 0x80 | 126, 300 >> 8, 300 & 255]), mask, masked]);
  const { frames, rest } = decodeFrames(Buffer.concat([frame, encodeFrame('hi'), Buffer.from([0x81])]));
  assert.equal(frames.length, 2);
  assert.equal(frames[0].payload.toString(), text);
  assert.equal(frames[1].payload.toString(), 'hi');
  assert.equal(rest.length, 1, 'a partial frame waits for more bytes');
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'RFC 6455 example');
});

/** A stand-in Realtime API: echoes every message back as { type: 'echo', got, auth }. */
function mockUpstream() {
  const srv = http.createServer();
  srv.on('upgrade', (req, socket) => {
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(req.headers['sec-websocket-key'])}`, '', ''].join('\r\n'));
    let buf = Buffer.alloc(0);
    socket.on('data', (c) => {
      buf = Buffer.concat([buf, c]);
      const { frames, rest } = decodeFrames(buf); buf = Buffer.from(rest);
      for (const f of frames) if (f.opcode === 8) socket.end(encodeFrame(Buffer.from([0x03, 0xe8]), 8)); else if (f.opcode === 1) socket.write(encodeFrame(JSON.stringify({ type: 'echo', got: JSON.parse(f.payload.toString()), auth: req.headers.authorization, url: req.url })));
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

test('the voice relay forwards both ways and keeps the key server-side', async () => {
  const up = await mockUpstream();
  process.env.FIDELITY_OPENAI_KEY = 'sk-test-123';
  process.env.FIDELITY_REALTIME_URL = `ws://127.0.0.1:${up.address().port}/v1/realtime`;
  process.env.FIDELITY_REALTIME_MODEL = 'gpt-realtime';
  const relay = http.createServer();
  relay.on('upgrade', handleVoiceUpgrade);
  await new Promise((r) => relay.listen(0, '127.0.0.1', r));
  try {
    assert.deepEqual(voiceStatus(), { configured: true, model: 'gpt-realtime' });
    const ws = new WebSocket(`ws://127.0.0.1:${relay.address().port}/api/voice`);
    const got = [];
    await new Promise((resolve, reject) => {
      ws.onmessage = (e) => { const m = JSON.parse(e.data); got.push(m); if (m.type === 'relay.open') ws.send(JSON.stringify({ type: 'session.update', n: 1 })); if (m.type === 'echo') resolve(); };
      ws.onerror = () => reject(new Error('relay socket error'));
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    const echo = got.find((m) => m.type === 'echo');
    assert.equal(echo.got.type, 'session.update');
    assert.equal(echo.auth, 'Bearer sk-test-123', 'the backend adds the key upstream');
    assert.match(echo.url, /model=gpt-realtime/);
    ws.close();
  } finally {
    relay.close(); up.close();
    delete process.env.FIDELITY_OPENAI_KEY; delete process.env.FIDELITY_REALTIME_URL; delete process.env.FIDELITY_REALTIME_MODEL;
  }
});

test('the voice relay refuses other websites and a missing key', async () => {
  const relay = http.createServer();
  relay.on('upgrade', handleVoiceUpgrade);
  await new Promise((r) => relay.listen(0, '127.0.0.1', r));
  const status = (headers) => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: relay.address().port, path: '/api/voice', headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13', ...headers } });
    req.on('response', (res) => resolve(res.statusCode));
    req.on('upgrade', () => resolve(101));
    req.end();
  });
  try {
    process.env.FIDELITY_OPENAI_KEY = 'sk-test';
    assert.equal(await status({ Origin: 'https://evil.example' }), 403);
    delete process.env.FIDELITY_OPENAI_KEY;
    assert.equal(await status({}), 503);
  } finally { relay.close(); delete process.env.FIDELITY_OPENAI_KEY; }
});

test('replies finish: noise and echo never interrupt; a confident wake word can when INTERRUPT is on', async () => {
  const { shouldWake, BARGE_IN_STRICTNESS } = await import('../src/voice/computer.js');
  const threshold = 10;
  assert.equal(shouldWake({ replying: false, interrupt: false, distance: 9, threshold }), true, 'idle: normal wake');
  assert.equal(shouldWake({ replying: false, interrupt: false, distance: 11, threshold }), false);
  assert.equal(shouldWake({ replying: true, interrupt: false, distance: 1, threshold }), false, 'default: the reply finishes');
  assert.equal(shouldWake({ replying: true, interrupt: true, distance: 9, threshold }), false, 'a loose match is not enough mid-reply');
  assert.equal(shouldWake({ replying: true, interrupt: true, distance: threshold * BARGE_IN_STRICTNESS - 0.1, threshold }), true);
});
