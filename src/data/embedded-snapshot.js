// Lossless offline packaging: decode once before dependent modules start.
import packed from '#snapshot-packed';
import { decodeSnapshot } from './snapshot-codec.js';
if (typeof DecompressionStream !== 'function') {
  document.body.textContent = 'This offline preview needs a browser with gzip decompression support. Please open it in a current browser.';
  throw new Error('Offline snapshot requires DecompressionStream.');
}
export default await decodeSnapshot(packed);
