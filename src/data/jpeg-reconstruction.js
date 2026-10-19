// This decoder restores original JPEG bytes; it never returns a new pixel rendition.
import createModule from '../vendor/jpeg-xl/decoder.mjs';
import encodedWasm from '../vendor/jpeg-xl/decoder-wasm.js';
export async function createJpegReconstructor() {
  if (typeof WebAssembly !== 'object') throw Error('This offline preview needs WebAssembly for lossless image reconstruction. Please open it in a current browser.');
  const wasmBinary = Uint8Array.from(atob(encodedWasm), x => x.charCodeAt(0));
  // Blob-imported standalone modules cannot resolve a relative WASM URL.
  // Supply both the bytes and a self-contained fallback location; no fetch is needed.
  const module = await createModule({ wasmBinary, locateFile: () => 'data:application/wasm;base64,' + encodedWasm });
  return (input, size) => {
    if (!(input instanceof Uint8Array) || !input.length || input.length > 134217728
        || !Number.isSafeInteger(size) || size < 1 || size > 134217728) throw Error('Invalid JPEG reconstruction size.');
    const source = module._malloc(input.length), target = module._malloc(size);
    try {
      if (!source || !target) throw Error('JPEG reconstruction allocation failed.');
      module.HEAPU8.set(input, source);
      if (module._reconstruct(source, input.length, target, size) !== size) throw Error('Invalid JPEG reconstruction payload.');
      return module.HEAPU8.slice(target, target + size);
    } finally { module._free(source); module._free(target); }
  };
}
