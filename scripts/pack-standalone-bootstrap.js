import { gzipSync, gunzipSync } from 'node:zlib';
import { minify } from 'terser';
import { encodeDenseSnapshotBytes, unpackSnapshotBytes } from '../src/data/snapshot-codec.js';

// A gzip-only first stage can restore the complete, independent Brotli startup
// decoder before that decoder is needed. No decoder state is shared with the app.
export async function packStandaloneBootstrap(source, codecSource) {
  const bytes = Buffer.from(source, 'utf8');
  const compressed = gzipSync(bytes, { level: 9 });
  if (!gunzipSync(compressed).equals(bytes)) throw new Error('Startup gzip round-trip failed.');
  const packed = encodeDenseSnapshotBytes(compressed, 2);
  if (!Buffer.from(unpackSnapshotBytes(packed)).equals(compressed)) throw new Error('Startup transport round-trip failed.');
  const loader = `${codecSource.replaceAll('export ', '')}\nif (typeof DecompressionStream !== 'function') {
 document.body.textContent = 'This offline preview needs a browser with gzip decompression support. Please open it in a current browser.';
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
    html: `<script id="fidelity-startup-data" type="application/x-fidelity-packed" data-encoding="${packed.encoding}" data-byte-length="${packed.byteLength}">${packed.data}</script>\n<script type="module">${code}</script>`,
    packed,
    sourceBytes: bytes.length,
  };
}
