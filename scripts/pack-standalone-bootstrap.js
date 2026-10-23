import { gzipSync, gunzipSync } from 'node:zlib';
import { minify } from 'terser';
import { build } from 'esbuild';
import { encodeDenseSnapshotBytes, encodeUtf16SnapshotBytes, unpackSnapshotBytes } from '../src/data/snapshot-codec.js';

// A gzip-only first stage can restore the complete, independent Brotli startup
// decoder before that decoder is needed. No decoder state is shared with the app.
export async function packStandaloneBootstrap(source, codecSource, notices) {
  const bytes = Buffer.from(source, 'utf8');
  const compressed = gzipSync(bytes, { level: 9 });
  if (!gunzipSync(compressed).equals(bytes)) throw new Error('Startup gzip round-trip failed.');
  const packed = encodeDenseSnapshotBytes(compressed, 2);
  if (!Buffer.from(unpackSnapshotBytes(packed)).equals(compressed)) throw new Error('Startup transport round-trip failed.');
  let noticeHtml = '', noticeLoader = '';
  if (notices !== undefined) {
    const noticeBytes = Buffer.from(notices, 'utf8');
    const noticeGzip = gzipSync(noticeBytes, { level: 9 });
    const noticePacked = encodeUtf16SnapshotBytes(noticeGzip, 2);
    if (!gunzipSync(unpackSnapshotBytes(noticePacked)).equals(noticeBytes)) throw new Error('Notice round-trip failed.');
    // This decoder runs before the native-gzip capability check, so complete
    // readable notices remain available even on an unsupported browser.
    const decoder = await build({ stdin: { contents: "import { gunzipSync } from 'three/examples/jsm/libs/fflate.module.js'; globalThis.__fidelityNoticeGunzip = gunzipSync;", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'iife', minify: true });
    noticeLoader = `${decoder.outputFiles[0].text}\nconst noticeData = document.getElementById('fidelity-notice-data');
const noticeText = new TextDecoder('utf-8', {fatal:true}).decode(globalThis.__fidelityNoticeGunzip(unpackSnapshotBytes({encoding:noticeData.dataset.encoding,byteLength:Number(noticeData.dataset.byteLength),data:noticeData.textContent})));
delete globalThis.__fidelityNoticeGunzip;
document.getElementById('fidelity-third-party-notices').textContent = noticeText;
document.getElementById('fidelity-readable-notices').textContent = noticeText;`;
    noticeHtml = `<script id="fidelity-notice-data" type="application/x-fidelity-packed" data-encoding="${noticePacked.encoding}" data-byte-length="${noticePacked.byteLength}">${noticePacked.data}</script>\n<script id="fidelity-third-party-notices" type="text/plain"></script>\n<details id="fidelity-notices" style="position:fixed;bottom:0;left:0;z-index:2147483647;background:#111;color:#eee;font:12px sans-serif;max-width:90vw"><summary style="cursor:pointer;padding:4px">Third-party notices</summary><pre id="fidelity-readable-notices" style="white-space:pre-wrap;overflow:auto;max-height:70vh;padding:12px;margin:0"></pre></details>\n`;
  }
  const loader = `${codecSource.replaceAll('export ', '')}\n${noticeLoader}\nif (typeof DecompressionStream !== 'function') {
 const notices = document.getElementById('fidelity-notices');
 document.body.textContent = 'This offline preview needs a browser with gzip decompression support. Please open it in a current browser.';
 if (notices) document.body.append(notices);
} else {
 const el = document.getElementById('fidelity-startup-data');
 const data = unpackSnapshotBytes({encoding:el.dataset.encoding,byteLength:Number(el.dataset.byteLength),data:el.textContent});
 const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
 const source = await new Response(stream).text();
 const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
 try { await import(url); } finally { URL.revokeObjectURL(url); }
}`;
  const { code } = await minify(loader, { module: true, compress: { passes: 2 }, mangle: true, format: { inline_script: true } });
  if (!code) throw new Error('Startup loader minification failed.');
  return {
    html: `${noticeHtml}<script id="fidelity-startup-data" type="application/x-fidelity-packed" data-encoding="${packed.encoding}" data-byte-length="${packed.byteLength}">${packed.data}</script>\n<script type="module">${code}</script>`,
    packed,
    sourceBytes: bytes.length,
  };
}
