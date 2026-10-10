// Standalone HTML carries the compressed snapshot separately from application code.
// Read raw script text so quotes and ASCII control bytes survive without JS escaping.
const element = document.getElementById('fidelity-snapshot-data');
if (!element) throw Error('Offline snapshot data is missing.');
export default {
  encoding: element.dataset.encoding,
  byteLength: Number(element.dataset.byteLength),
  data: element.textContent,
};
