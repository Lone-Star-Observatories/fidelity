// Quote- and script-safe radix85 transport saves space over base64. Gzip is unchanged.
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&_~()[]{}@%$#';
const digits = new Map([...alphabet].map((character, index) => [character, index]));

export function encodeSnapshotBytes(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 4) {
    let value = 0;
    for (let index = 0; index < 4; index++) value = value * 256 + (bytes[offset + index] ?? 0);
    const block = Array(5);
    for (let index = 4; index >= 0; index--) {
      block[index] = alphabet[value % 85];
      value = Math.floor(value / 85);
    }
    chunks.push(block.join(''));
  }
  return { encoding: 'gzip-radix85-v1', byteLength: bytes.length, data: chunks.join('') };
}

export function unpackSnapshotBytes(packed) {
  // Existing base64 snapshots remain readable.
  if (typeof packed === 'string') return Uint8Array.from(atob(packed), character => character.charCodeAt(0));
  if (packed?.encoding !== 'gzip-radix85-v1' || !Number.isSafeInteger(packed.byteLength)
      || packed.byteLength < 0 || typeof packed.data !== 'string'
      || packed.data.length !== Math.ceil(packed.byteLength / 4) * 5) throw Error('Invalid packed snapshot.');
  const bytes = new Uint8Array(packed.byteLength);
  for (let offset = 0; offset < packed.data.length; offset += 5) {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const digit = digits.get(packed.data[offset + index]);
      if (digit === undefined) throw Error('Invalid snapshot digit.');
      value = value * 85 + digit;
    }
    if (value > 0xffffffff) throw Error('Invalid snapshot block.');
    const byteOffset = offset / 5 * 4;
    for (let index = 3; index >= 0; index--) {
      const byte = value % 256;
      if (byteOffset + index < bytes.length) bytes[byteOffset + index] = byte;
      else if (byte !== 0) throw Error('Invalid snapshot padding.');
      value = Math.floor(value / 256);
    }
  }
  return bytes;
}

// Same lossless decoder in the browser preview and packaging verification.
export async function decodeSnapshot(packed) {
  const bytes = unpackSnapshotBytes(packed);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

// The application envelope is inert HTML script text, not a JavaScript string.
// ASCII excludes parser-normalized NUL/CR/LF, whitespace controls and '<'.
const applicationAlphabet = Array.from({ length: 128 }, (_, code) => code)
  .filter(code => ![0, 9, 10, 11, 12, 13, 27, 60].includes(code))
  .map(code => String.fromCharCode(code)).join('');
const applicationDigits = new Map([...applicationAlphabet].map((character, index) => [character, index]));
export function encodeApplicationBytes(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 6) {
    let value = 0;
    for (let index = 0; index < 6; index++) value = value * 256 + (bytes[offset + index] ?? 0);
    const block = Array(7);
    for (let index = 6; index >= 0; index--) {
      block[index] = applicationAlphabet[value % 120];
      value = Math.floor(value / 120);
    }
    chunks.push(block.join(''));
  }
  return { encoding: 'gzip-raw-radix120-v1', byteLength: bytes.length, data: chunks.join('') };
}
export function unpackApplicationBytes(packed) {
  if (packed?.encoding !== 'gzip-raw-radix120-v1' || !Number.isSafeInteger(packed.byteLength)
      || packed.byteLength < 0 || typeof packed.data !== 'string'
      || packed.data.length !== Math.ceil(packed.byteLength / 6) * 7) throw Error('Invalid packed application.');
  const bytes = new Uint8Array(packed.byteLength);
  for (let offset = 0; offset < packed.data.length; offset += 7) {
    let value = 0;
    for (let index = 0; index < 7; index++) {
      const digit = applicationDigits.get(packed.data[offset + index]);
      if (digit === undefined) throw Error('Invalid application digit.');
      value = value * 120 + digit;
    }
    if (value > 0xffffffffffff) throw Error('Invalid application block.');
    const byteOffset = offset / 7 * 6;
    for (let index = 5; index >= 0; index--) {
      const byte = value % 256;
      if (byteOffset + index < bytes.length) bytes[byteOffset + index] = byte;
      else if (byte !== 0) throw Error('Invalid application padding.');
      value = Math.floor(value / 256);
    }
  }
  return bytes;
}
