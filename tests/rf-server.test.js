import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { rawGet, sndFrame, streamStation, cameraMedia } from '../server/rf.js';
import { kiwiTag, parseKiwiSnd } from '../src/data/rf.js';

test('rawGet reads a SHOUTcast "ICY 200 OK" answer that fetch would refuse', async () => {
  const srv = net.createServer((s) => s.once('data', () => s.end('ICY 200 OK\r\nicy-name: Test FM\r\nicy-metaint: 8192\r\ncontent-type: audio/mpeg\r\n\r\nAUDIO')));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  const up = await rawGet(`http://127.0.0.1:${port}/live`);
  assert.equal(up.status, 200);
  assert.equal(up.headers['icy-name'], 'Test FM');
  assert.equal(up.headers['icy-metaint'], '8192');
  assert.equal(up.head.toString(), 'AUDIO');
  up.socket.destroy(); srv.close();
});

test('rawGet follows redirects', async () => {
  const b = net.createServer((s) => s.once('data', () => s.end('HTTP/1.0 200 OK\r\ncontent-type: audio/aac\r\n\r\nX')));
  await new Promise((r) => b.listen(0, '127.0.0.1', r));
  const a = net.createServer((s) => s.once('data', () => s.end(`HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:${b.address().port}/s\r\n\r\n`)));
  await new Promise((r) => a.listen(0, '127.0.0.1', r));
  const up = await rawGet(`http://127.0.0.1:${a.address().port}/`);
  assert.equal(up.headers['content-type'], 'audio/aac');
  up.socket.destroy(); a.close(); b.close();
});

test('rtl_fm PCM becomes a Kiwi-style SND message the browser already parses', () => {
  const le = Buffer.alloc(6); le.writeInt16LE(100, 0); le.writeInt16LE(-300, 2); le.writeInt16LE(32000, 4);
  const { tag, body } = kiwiTag(new Uint8Array(sndFrame(le, 9, -60)));
  assert.equal(tag, 'SND');
  const s = parseKiwiSnd(body);
  assert.equal(s.seq, 9);
  assert.ok(Math.abs(s.rssi + 60) < 0.11);
  assert.deepEqual([...s.samples], [100, -300, 32000]);
});

test('the relays refuse anything not on the station lists (no open proxy)', async () => {
  await assert.rejects(streamStation('', {}), (e) => e.status === 403 || e.status === 502 || e.status === 400);
  await assert.rejects(cameraMedia(''), (e) => e.status === 403 || e.status === 502 || e.status === 400);
});
