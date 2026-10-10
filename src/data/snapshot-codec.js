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
