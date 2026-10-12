import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { rawGet, sndFrame, streamStation, cameraMedia, rxIqCmd, deviceRange } from '../server/rf.js';
import { rtlPowerCmd } from '../server/sdr.js';
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

test('receive command builders pick the right tool per device, never transmit (#69)', () => {
  const full = { rtl_fm: true, rtl_power: true, rx_fm: true, rx_power: true, bladeRF_cli: true };
  // RTL: the existing rtl_fm path, raw IQ instead of demodulated audio (one stream feeds waterfall and audio)
  assert.deepEqual(rxIqCmd('rtl', { centreHz: 7074000 }, full), { cmd: 'rtl_fm', args: ['-f', '7074000', '-M', 'raw', '-s', '240000', '-l', '0', '-'], tool: 'rtl_fm', format: 's16', scale: 640, rateHz: 240000, group: false });
  // bladeRF: bladeRF-cli; HackRF: rx_fm with a SoapySDR driver string
  const blade = rxIqCmd('bladerf', { centreHz: 145e6, gain: 30 }, full);
  assert.equal(blade.tool, 'bladeRF-cli');
  const hack = rxIqCmd('hackrf', { centreHz: 145e6, gain: 30 }, full);
  assert.ok(hack.args.includes('driver=hackrf') && hack.args.includes('-g') && hack.args.includes('30') && hack.args.includes('raw'));
  // no transmit vocabulary anywhere in the built receive commands
  for (const c of [blade, hack]) assert.ok(!JSON.stringify(c).match(/\btx\b|transmit/i));
  // missing tools → a helpful error, not a bad command
  assert.ok(rxIqCmd('bladerf', { centreHz: 1 }, { rtl_fm: true }).error.includes('bladeRF-cli'));
  assert.equal(rxIqCmd('bladerf', { centreHz: 145e6 }, { rx_fm: true }).tool, 'rx_fm'); // bladeRF through SoapySDR when bladeRF-cli is missing
  assert.ok(rxIqCmd('rtl', { centreHz: 1 }, {}).error.includes('rtl_fm'));
  // the RTL sweep stays rtl_power
  assert.deepEqual(rtlPowerCmd({ fromHz: 88e6, toHz: 108e6, step: 1e4 }), { cmd: 'rtl_power', args: ['-f', '88000000:108000000:10000', '-i', '2', '-1', '-'] });
});

test('device ranges: bladeRF and HackRF reach well past the RTL ceiling (#69)', () => {
  assert.deepEqual(deviceRange('rtl'), [24e6, 1766e6]);
  assert.deepEqual(deviceRange('bladerf'), [47e6, 6e9]);
  assert.deepEqual(deviceRange('hackrf'), [1e6, 6e9]);
  assert.deepEqual(deviceRange('bladerf', { xb200: true }), [60e3, 6e9]); // the XB-200 transverter reaches HF directly
});
