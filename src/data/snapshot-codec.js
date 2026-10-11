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
  if (['gzip-raw-radix125-wide-v1', 'gzip-raw-radix125-wide-v2'].includes(packed?.encoding)) return unpackDenseSnapshotBytes(packed);
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
const numericMagic = new TextEncoder().encode('FIDNUM01');
// Version 2 packs the same exact column-major characters into nibbles; 15 is
// reserved for odd-length padding, never a numeric digit. No values are parsed.
const numericNibbleMagic = new TextEncoder().encode('FIDNUM02');
const numericAlphabet = '0123456789.-+eE';
const numericLexemes = /"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
// Transpose decimal lexemes by length, without converting or rounding numbers.
// Only the JSON header changes layout; every binary asset remains unchanged.
export function encodeNumericSnapshot(text, version = 1) {
  if (![1, 2].includes(version)) throw Error('Invalid numeric snapshot version.');
  const binary = encodeBinarySnapshot(text), view = new DataView(binary.buffer);
  const headerLength = view.getUint32(8, true);
  const header = new TextDecoder('utf-8', { fatal: true }).decode(binary.subarray(12, 12 + headerLength));
  const groups = new Map(), order = [];
  const skeleton = new TextEncoder().encode(header.replace(numericLexemes, token => {
    if (token[0] === '"') return token;
    if (token.length > 255) throw Error('Snapshot numeric lexeme too long.');
    if (!groups.has(token.length)) groups.set(token.length, []);
    groups.get(token.length).push(token); order.push(token.length); return '#';
  }));
  const tail = binary.subarray(12 + headerLength);
  const total = 20 + skeleton.length + order.length + tail.length
    + [...groups].reduce((sum, [length, values]) => sum + 5 + (version === 2 ? Math.ceil(length * values.length / 2) : length * values.length), 0);
  if (total > 0xffffffff) throw Error('Numeric snapshot too large.');
  const output = new Uint8Array(total), outView = new DataView(output.buffer); let at = 0;
  const put = bytes => { output.set(bytes, at); at += bytes.length; };
  const length = n => { outView.setUint32(at, n, true); at += 4; };
  put(version === 2 ? numericNibbleMagic : numericMagic); length(skeleton.length); length(order.length); length(groups.size);
  put(skeleton); put(order);
  for (const [width, values] of [...groups].sort((a, b) => a[0] - b[0])) {
    output[at++] = width; length(values.length);
    let position = 0;
    for (let digit = 0; digit < width; digit++) for (const value of values) {
      if (version === 1) output[at++] = value.charCodeAt(digit);
      else {
        const code = numericAlphabet.indexOf(value[digit]);
        if (code < 0) throw Error('Invalid numeric digit.');
        if (position % 2 === 0) output[at] = code | 0xf0;
        else { output[at] = (output[at] & 15) | (code << 4); at++; }
        position++;
      }
    }
    if (version === 2 && position % 2) at++;
  }
  put(tail); return output;
}
function restoreNumericSnapshot(bytes, nibble = false) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let at = 8;
  const length = () => { if (at + 4 > bytes.length) throw Error('Truncated numeric snapshot.'); const n = view.getUint32(at, true); at += 4; return n; };
  const take = n => { if (n > bytes.length - at) throw Error('Truncated numeric snapshot.'); const b = bytes.subarray(at, at + n); at += n; return b; };
  const skeletonLength = length(), count = length(), groupCount = length();
  if (groupCount > 255) throw Error('Invalid numeric group count.');
  const skeleton = new TextDecoder('utf-8', { fatal: true }).decode(take(skeletonLength)), order = take(count);
  const groups = new Map(); let totalCount = 0;
  for (let i = 0; i < groupCount; i++) {
    const width = take(1)[0], size = length();
    if (!width || !size || groups.has(width) || size > count - totalCount) throw Error('Invalid numeric group.');
    let data = take(nibble ? Math.ceil(width * size / 2) : width * size);
    if (nibble) {
      const unpacked = new Uint8Array(width * size);
      for (let digit = 0; digit < unpacked.length; digit++) {
        const code = (data[digit >> 1] >> ((digit % 2) * 4)) & 15;
        if (code >= numericAlphabet.length) throw Error('Invalid numeric nibble.');
        unpacked[digit] = numericAlphabet.charCodeAt(code);
      }
      if (unpacked.length % 2 && (data[data.length - 1] >> 4) !== 15) throw Error('Invalid numeric padding.');
      data = unpacked;
    }
    groups.set(width, { size, data, used: 0 }); totalCount += size;
  }
  if (totalCount !== count) throw Error('Invalid numeric token count.');
  let index = 0;
  const header = skeleton.replace(/"(?:[^"\\]|\\.)*"|#/g, token => {
    if (token !== '#') return token;
    const group = groups.get(order[index++]);
    if (!group || group.used >= group.size) throw Error('Invalid numeric reference.');
    let value = '';
    for (let digit = 0; digit < order[index - 1]; digit++) value += String.fromCharCode(group.data[digit * group.size + group.used]);
    group.used++;
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) throw Error('Invalid numeric lexeme.');
    return value;
  });
  if (index !== count || [...groups.values()].some(group => group.used !== group.size)) throw Error('Unused numeric tokens.');
  const headerBytes = new TextEncoder().encode(header), tail = bytes.subarray(at);
  const binary = new Uint8Array(12 + headerBytes.length + tail.length);
  binary.set(binaryMagic); new DataView(binary.buffer).setUint32(8, headerBytes.length, true);
  binary.set(headerBytes, 12); binary.set(tail, 12 + headerBytes.length);
  // The existing binary decoder validates all asset lengths and references.
  const restored = restoreSnapshotText(binary); JSON.parse(restored); return restored;
}

export function restoreSnapshotText(bytes) {
  if (numericNibbleMagic.every((value, index) => bytes[index] === value)) return restoreNumericSnapshot(bytes, true);
  if (numericMagic.every((value, index) => bytes[index] === value)) return restoreNumericSnapshot(bytes);
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

// HTML raw script text preserves ASCII except NUL and CR; less-than is excluded
// so no payload can form an end tag. Tabs/newlines are payload bytes, not layout.
const denseAlphabet = Array.from({length:128}, (_, code) => code).filter(code => ![0,13,60].includes(code)).map(code => String.fromCharCode(code)).join('');
const denseDigits = new Map([...denseAlphabet].map((character,index) => [character,index]));
// v2 uses 1832-bit blocks:229bytes in263digits; v1/default stays byte-compatible.
export function encodeDenseSnapshotBytes(bytes, version = 1) {
  if (![1, 2].includes(version)) throw Error('Invalid dense transport version.');
  const blockBytes = version === 2 ? 229 : 47, blockDigits = version === 2 ? 263 : 54;
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += blockBytes) {
    let value = 0n;
    for (let index = 0; index < blockBytes; index++) value = (value << 8n) + BigInt(bytes[offset + index] ?? 0);
    const block = Array(blockDigits);
    for (let index = blockDigits - 1; index >= 0; index--) {
      block[index] = denseAlphabet[Number(value % 125n)];
      value /= 125n;
    }
    chunks.push(block.join(''));
  }
  return { encoding: `gzip-raw-radix125-wide-v${version}`, byteLength: bytes.length, data: chunks.join('') };
}
export function unpackDenseSnapshotBytes(packed) {
  const blockBytes = packed?.encoding === 'gzip-raw-radix125-wide-v2' ? 229 : 47;
  const blockDigits = blockBytes === 229 ? 263 : 54;
  if (!['gzip-raw-radix125-wide-v1', 'gzip-raw-radix125-wide-v2'].includes(packed?.encoding) || !Number.isSafeInteger(packed.byteLength)
      || packed.byteLength < 0 || typeof packed.data !== 'string'
      || packed.data.length !== Math.ceil(packed.byteLength / blockBytes) * blockDigits) throw Error('Invalid packed snapshot.');
  const bytes = new Uint8Array(packed.byteLength);
  for (let offset = 0; offset < packed.data.length; offset += blockDigits) {
    let value = 0n;
    for (let index = 0; index < blockDigits; index++) {
      const digit = denseDigits.get(packed.data[offset + index]);
      if (digit === undefined) throw Error('Invalid snapshot digit.');
      value = value * 125n + BigInt(digit);
    }
    if (value >= (1n << BigInt(blockBytes * 8))) throw Error('Invalid snapshot block.');
    const byteOffset = offset / blockDigits * blockBytes;
    for (let index = blockBytes - 1; index >= 0; index--) {
      const byte = Number(value & 255n);
      if (byteOffset + index < bytes.length) bytes[byteOffset + index] = byte;
      else if (byte !== 0) throw Error('Invalid snapshot padding.');
      value >>= 8n;
    }
  }
  return bytes;
}

// FIDAPP01 transposes JavaScript numeric token spellings; plain modules remain supported.
export function restoreApplicationText(bytes) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (![70, 73, 68, 65, 80, 80, 48, 49].every((value, index) => bytes[index] === value)) return decoder.decode(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let at = 8;
  const length = () => { if (at + 4 > bytes.length) throw Error('Truncated application numbers.'); const n = view.getUint32(at, true); at += 4; return n; };
  const take = n => { if (n > bytes.length - at) throw Error('Truncated application numbers.'); const b = bytes.subarray(at, at + n); at += n; return b; };
  const skeletonLength = length(), count = length(), groupCount = length();
  if (groupCount > 255) throw Error('Invalid application group count.');
  const parts = decoder.decode(take(skeletonLength)).split('\0'), order = take(count);
  if (!Array.isArray(parts) || parts.length !== count + 1 || parts.some(p => typeof p !== 'string')) throw Error('Invalid application skeleton.');
  const groups = new Map(); let total = 0;
  for (let i = 0; i < groupCount; i++) {
    const width = take(1)[0], size = length();
    if (!width || !size || groups.has(width) || size > count - total) throw Error('Invalid application number group.');
    groups.set(width, { size, data: take(width * size), used: 0 }); total += size;
  }
  if (total !== count || at !== bytes.length) throw Error('Invalid application number count or trailing bytes.');
  const result = [parts[0]];
  for (let i = 0; i < count; i++) {
    const width = order[i], group = groups.get(width);
    if (!group || group.used >= group.size) throw Error('Invalid application number reference.');
    let token = '';
    for (let digit = 0; digit < width; digit++) token += String.fromCharCode(group.data[digit * group.size + group.used]);
    group.used++;
    if (!/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)$/.test(token)) throw Error('Invalid application numeric spelling.');
    result.push(token, parts[i + 1]);
  }
  if ([...groups.values()].some(g => g.used !== g.size)) throw Error('Unused application numbers.');
  return result.join('');
}
