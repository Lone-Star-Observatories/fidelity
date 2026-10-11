// Research fixture only: no production codec, file or payload is changed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '/Users/ageer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const source = await readFile('dist-standalone/fidelity.html');
const digest = b => createHash('sha256').update(b).digest('hex');
// Deliberately nonconforming legacy encoding: one representative high byte.
const fixture = Buffer.concat([Buffer.from('<!doctype html><meta charset="windows-1252"><script id="payload" type="application/octet-stream">'), Buffer.from([0xe9]), Buffer.from('</script>')]);
const server = createServer((req,res) => { res.setHeader('Content-Type', req.url === '/utf8' ? 'text/html; charset=utf-8' : 'text/html'); res.end(fixture); });
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page = await browser.newPage(); const results = {};
 for (const route of ['meta','utf8']) {
  await page.goto(`http://127.0.0.1:${server.address().port}/${route}`);
  results[route] = await page.evaluate(() => ({charset:document.characterSet, codePoints:[...document.querySelector('#payload').textContent].map(c=>c.codePointAt(0))}));
 }
 assert.equal(results.meta.charset,'windows-1252'); assert.deepEqual(results.meta.codePoints,[233]);
 assert.equal(results.utf8.charset,'UTF-8'); assert.deepEqual(results.utf8.codePoints,[65533]);
 assert.equal(digest(await readFile('dist-standalone/fidelity.html')),digest(source));
 console.log(JSON.stringify({status:'rejected-not-adopted',fixtureSha256:digest(fixture),productionHtmlBytes:source.length,productionHtmlSha256:digest(source),results,productionArtifactUnchanged:true},null,2));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
