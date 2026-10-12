// Reproduce the same-payload UTF-8 transport screen and Chrome HTML parser check.
// Run from the repository after a full build; no assets or production inputs change.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { encodeDenseSnapshotBytes, encodeUtf8SnapshotBytes, unpackSnapshotBytes } from '../../src/data/snapshot-codec.js';
const root = process.cwd();
const html = await fs.readFile(path.join(root, 'dist-standalone/index.html'), 'utf8');
const match = html.match(/id="fidelity-snapshot-data"[^>]*data-encoding="([^"]+)" data-byte-length="(\d+)">([\s\S]*?)<\/script>/);
assert.ok(match, 'Build the separated full snapshot first.');
const bytes = unpackSnapshotBytes({ encoding: match[1], byteLength: Number(match[2]), data: match[3] });
const old = encodeDenseSnapshotBytes(bytes, 2), packed = encodeUtf8SnapshotBytes(bytes);
assert.deepEqual(unpackSnapshotBytes(packed), bytes);
const hash = b => createHash('sha256').update(b).digest('hex');
const report = { compressedBytes: bytes.length, compressedSha256: hash(bytes), oldUtf8Bytes: Buffer.byteLength(old.data), newUtf8Bytes: Buffer.byteLength(packed.data), savedTransportBytes: Buffer.byteLength(old.data) - Buffer.byteLength(packed.data) };
const fixture = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'fidelity-utf8-')), 'fixture.html');
await fs.writeFile(fixture, `<meta charset="utf-8"><script id="packed" type="text/plain" data-byte-length="${bytes.length}">${packed.data}</script>`);
const playwright = process.env.FIDELITY_PLAYWRIGHT_MODULE || '/Users/ageer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(playwright);
const browser = await chromium.launch({ executablePath: process.env.FIDELITY_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
 const page = await browser.newPage();
 await page.goto('file://' + fixture);
 const codecUrl = 'data:text/javascript;base64,' + Buffer.from(await fs.readFile(path.join(root, 'src/data/snapshot-codec.js'), 'utf8')).toString('base64');
 const inspect = () => page.evaluate(async url => {
   const codec = await import(url), el = document.getElementById('packed');
   const bytes = codec.unpackSnapshotBytes({ encoding: 'gzip-raw-utf8-enumerative-v1', byteLength: Number(el.dataset.byteLength), data: el.textContent });
   const hash = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), v => v.toString(16).padStart(2, '0')).join('');
   return { characterSet: document.characterSet, compressedSha256: await hash(bytes), textSha256: await hash(new TextEncoder().encode(el.textContent)) };
 }, codecUrl);
 report.browser = await inspect();
 assert.equal(report.browser.characterSet, 'UTF-8');
 assert.equal(report.browser.compressedSha256, report.compressedSha256);
 assert.equal(report.browser.textSha256, hash(packed.data));
 const body = await fs.readFile(fixture);
 const server = createServer((request, response) => { response.setHeader('Content-Type', 'text/html; charset=UTF-8'); response.end(body); });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 try {
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   report.httpUtf8 = await inspect();
   assert.deepEqual(report.httpUtf8, report.browser);
 } finally { await new Promise(resolve => server.close(resolve)); }
 console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await fs.rm(path.dirname(fixture), { recursive: true }); }
