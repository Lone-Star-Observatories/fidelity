// Research-only rejected candidate; production remains FIDAPP01.
import { tokenizer } from 'acorn';

// Keep JavaScript numeric tokens as their original source text, never as Numbers.
export function encodeApplicationNumbers(source, version = 1) {
  if (![1, 2].includes(version)) throw Error('Invalid application numeric version.');
  if (source.includes('\0')) throw Error('Application source contains a reserved separator.');
  const parts = [], groups = new Map(), order = []; let at = 0;
  for (const token of tokenizer(source, { ecmaVersion: 'latest', sourceType: 'module' })) {
    if (token.type.label !== 'num') continue;
    const raw = source.slice(token.start, token.end);
    if (raw.length > 255 || !/^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)$/.test(raw)) continue;
    parts.push(source.slice(at, token.start)); at = token.end;
    order.push(raw.length);
    if (!groups.has(raw.length)) groups.set(raw.length, []);
    groups.get(raw.length).push(raw);
  }
  parts.push(source.slice(at));
  const skeleton = new TextEncoder().encode(parts.join('\0'));
  const packedGroups = [...groups].sort((a, b) => a[0] - b[0]).map(([width, values]) => {
    const data = Uint8Array.from(Array.from({ length: width }, (_, digit) => values.map(value => value.charCodeAt(digit))).flat());
    if (version === 1) return { width, count: values.length, data };
    const alphabet = [...new Set(data)].sort((a, b) => a - b);
    const bits = Math.max(1, Math.ceil(Math.log2(alphabet.length)));
    const packed = new Uint8Array(Math.ceil(data.length * bits / 8)); let bit = 0;
    for (const value of data) {
      const code = alphabet.indexOf(value);
      for (let b = 0; b < bits; b++, bit++) packed[bit >> 3] |= ((code >> b) & 1) << (bit % 8);
    }
    return { width, count: values.length, data: Uint8Array.from([alphabet.length, ...alphabet, ...packed]) };
  });
  const size = 20 + skeleton.length + order.length + packedGroups.reduce((n, group) => n + 5 + group.data.length, 0);
  if (size > 0xffffffff) throw Error('Application numeric container too large.');
  const out = new Uint8Array(size), view = new DataView(out.buffer); let cursor = 0;
  const put = bytes => { out.set(bytes, cursor); cursor += bytes.length; };
  const length = n => { view.setUint32(cursor, n, true); cursor += 4; };
  put(new TextEncoder().encode(version === 2 ? 'FIDAPP02' : 'FIDAPP01')); length(skeleton.length); length(order.length); length(groups.size);
  put(skeleton); put(order);
  for (const group of packedGroups) {
    out[cursor++] = group.width; length(group.count); put(group.data);
  }
  return out;
}

// FIDAPP01 transposes exact JavaScript numeric spellings; FIDAPP02 bit-packs
// their sorted per-group character alphabet. Legacy and plain modules remain supported.
export function restoreApplicationText(bytes) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const packed = bytes[7] === 50;
  if (![70, 73, 68, 65, 80, 80, 48].every((value, index) => bytes[index] === value) || ![49, 50].includes(bytes[7])) return decoder.decode(bytes);
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
    let data;
    if (packed) {
      const alphabetSize = take(1)[0], alphabet = take(alphabetSize);
      if (!alphabetSize || alphabetSize > 32 || [...alphabet].some((code, i) => !'0123456789.eE+-xXabcdefABCDEFbBoO'.includes(String.fromCharCode(code)) || (i && code <= alphabet[i - 1]))) throw Error('Invalid application numeric alphabet.');
      const bits = Math.max(1, Math.ceil(Math.log2(alphabetSize))), count = width * size;
      const codes = take(Math.ceil(count * bits / 8)); data = new Uint8Array(count); let bit = 0;
      for (let i = 0; i < count; i++) {
        let code = 0; for (let b = 0; b < bits; b++, bit++) code |= ((codes[bit >> 3] >> (bit % 8)) & 1) << b;
        if (code >= alphabetSize) throw Error('Invalid application numeric code.');
        data[i] = alphabet[code];
      }
      if (bit % 8 && (codes[codes.length - 1] >> (bit % 8))) throw Error('Invalid application numeric padding.');
    } else data = take(width * size);
    groups.set(width, { size, data, used: 0 }); total += size;
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
