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
  if (packed?.encoding === 'gzip-raw-radix120-wide-v1') return unpackRawSnapshotBytes(packed);
  if (packed?.encoding === 'gzip-raw-radix120-v1') return unpackApplicationBytes(packed);
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
  return JSON.parse(restoreSnapshotText(new Uint8Array(await new Response(stream).arrayBuffer())));
}

const binaryMagic = new TextEncoder().encode('FIDBIN01');
const assetMarker = '__FIDELITY_BINARY_ASSET_';
const assetPattern = /"(data:[^"\s]*;base64,)([A-Za-z0-9+/=]*)"/g;
const markerPattern = /"__FIDELITY_BINARY_ASSET_(\d+)__"/g;
function binaryBase64(bytes) {
  const parts = [];
  for (let at = 0; at < bytes.length; at += 16384) parts.push(String.fromCharCode(...bytes.subarray(at, at + 16384)));
  return btoa(parts.join(''));
}
// Binary assets avoid base64 compression overhead. Restoring the original JSON
// text also restores every embedded data URI and every detailed field exactly.
export function encodeBinarySnapshot(text) {
  if (text.includes(assetMarker)) throw Error('Reserved snapshot asset marker.');
  const assets = [], seen = new Map(), encoder = new TextEncoder();
  const header = encoder.encode(text.replace(assetPattern, (literal, prefix, data) => {
    if (!seen.has(literal)) {
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      if (binaryBase64(bytes) !== data) throw Error('Noncanonical snapshot asset.');
      seen.set(literal, assets.length);
      assets.push({ prefix: encoder.encode(prefix), bytes });
    }
    return JSON.stringify(assetMarker + seen.get(literal) + '__');
  }));
  const total = 16 + header.length + assets.reduce((sum, a) => sum + 8 + a.prefix.length + a.bytes.length, 0);
  if (total > 0xffffffff) throw Error('Snapshot container too large.');
  const output = new Uint8Array(total), view = new DataView(output.buffer); let at = 0;
  const put = bytes => { output.set(bytes, at); at += bytes.length; };
  const length = n => { view.setUint32(at, n, true); at += 4; };
  put(binaryMagic); length(header.length); put(header); length(assets.length);
  for (const a of assets) { length(a.prefix.length); put(a.prefix); length(a.bytes.length); put(a.bytes); }
  return output;
}
export function restoreSnapshotText(bytes) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (!binaryMagic.every((value, index) => bytes[index] === value)) return decoder.decode(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let at = 8;
  const length = () => { if (at + 4 > bytes.length) throw Error('Truncated snapshot container.'); const n = view.getUint32(at, true); at += 4; return n; };
  const take = n => { if (n > bytes.length - at) throw Error('Truncated snapshot asset.'); const b = bytes.subarray(at, at + n); at += n; return b; };
  const header = decoder.decode(take(length())), count = length(), literals = [];
  if (count > Math.floor((bytes.length - at) / 8)) throw Error('Invalid snapshot asset count.');
  for (let i = 0; i < count; i++) {
    const prefix = decoder.decode(take(length()));
    if (!/^data:[^"\s]*;base64,$/.test(prefix)) throw Error('Invalid snapshot asset prefix.');
    literals.push(JSON.stringify(prefix + binaryBase64(take(length()))));
  }
  if (at !== bytes.length) throw Error('Trailing snapshot container bytes.');
  const used = new Set();
  const restored = header.replace(markerPattern, (marker, index) => {
    if (!Number.isSafeInteger(Number(index)) || String(Number(index)) !== index || Number(index) >= count) throw Error('Invalid snapshot asset reference.');
    used.add(Number(index)); return literals[Number(index)];
  });
  if (used.size !== count || restored.includes(assetMarker)) throw Error('Invalid snapshot asset references.');
  return restored;
}

// The application envelope is inert HTML script text, not a JavaScript string.
// ASCII excludes parser-normalized NUL/CR/LF, whitespace controls and '<'.
const applicationAlphabet = Array.from({ length: 128 }, (_, code) => code)
  .filter(code => ![0, 9, 10, 11, 12, 13, 27, 60].includes(code))
  .map(code => String.fromCharCode(code)).join('');
const applicationDigits = new Map([...applicationAlphabet].map((character, index) => [character, index]));
// Wider exact integer blocks reduce ASCII overhead; gzip and decoded bytes stay identical.
export function encodeRawSnapshotBytes(bytes) {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 44) {
    let value = 0n;
    for (let index = 0; index < 44; index++) value = (value << 8n) + BigInt(bytes[offset + index] ?? 0);
    const block = Array(51);
    for (let index = 50; index >= 0; index--) {
      block[index] = applicationAlphabet[Number(value % 120n)];
      value /= 120n;
    }
    chunks.push(block.join(''));
  }
  return { encoding: 'gzip-raw-radix120-wide-v1', byteLength: bytes.length, data: chunks.join('') };
}
export function unpackRawSnapshotBytes(packed) {
  if (packed?.encoding !== 'gzip-raw-radix120-wide-v1' || !Number.isSafeInteger(packed.byteLength)
      || packed.byteLength < 0 || typeof packed.data !== 'string'
      || packed.data.length !== Math.ceil(packed.byteLength / 44) * 51) throw Error('Invalid packed snapshot.');
  const bytes = new Uint8Array(packed.byteLength);
  for (let offset = 0; offset < packed.data.length; offset += 51) {
    let value = 0n;
    for (let index = 0; index < 51; index++) {
      const digit = applicationDigits.get(packed.data[offset + index]);
      if (digit === undefined) throw Error('Invalid snapshot digit.');
      value = value * 120n + BigInt(digit);
    }
    if (value >= (1n << 352n)) throw Error('Invalid snapshot block.');
    const byteOffset = offset / 51 * 44;
    for (let index = 43; index >= 0; index--) {
      const byte = Number(value & 255n);
      if (byteOffset + index < bytes.length) bytes[byteOffset + index] = byte;
      else if (byte !== 0) throw Error('Invalid snapshot padding.');
      value >>= 8n;
    }
  }
  return bytes;
}
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
