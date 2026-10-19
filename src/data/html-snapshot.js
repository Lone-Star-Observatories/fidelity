// Standalone HTML carries the compressed snapshot separately from application code.
// Read raw script text so quotes and ASCII control bytes survive without JS escaping.
import { decompress } from 'brotli/decompress';
import { createJpegReconstructor } from './jpeg-reconstruction.js';
if (typeof WebAssembly !== 'object') {
  document.body.textContent = 'This offline preview needs WebAssembly for lossless image reconstruction. Please open it in a current browser.';
  throw Error('Offline snapshot requires WebAssembly.');
}
const reconstructJpeg = await createJpegReconstructor();
const element = document.getElementById('fidelity-snapshot-data');
if (!element) throw Error('Offline snapshot data is missing.');
export default {
  encoding: element.dataset.encoding,
  byteLength: Number(element.dataset.byteLength),
  data: element.textContent,
  decodeBrotli: decompress,
  reconstructJpeg,
};
