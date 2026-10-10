import { tokenizer } from 'acorn';

// Keep JavaScript numeric tokens as their original source text, never as Numbers.
export function encodeApplicationNumbers(source) {
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
  const size = 20 + skeleton.length + order.length + [...groups].reduce((n, [width, values]) => n + 5 + width * values.length, 0);
  if (size > 0xffffffff) throw Error('Application numeric container too large.');
  const out = new Uint8Array(size), view = new DataView(out.buffer); let cursor = 0;
  const put = bytes => { out.set(bytes, cursor); cursor += bytes.length; };
  const length = n => { view.setUint32(cursor, n, true); cursor += 4; };
  put(new TextEncoder().encode('FIDAPP01')); length(skeleton.length); length(order.length); length(groups.size);
  put(skeleton); put(order);
  for (const [width, values] of [...groups].sort((a, b) => a[0] - b[0])) {
    out[cursor++] = width; length(values.length);
    for (let digit = 0; digit < width; digit++) for (const value of values) out[cursor++] = value.charCodeAt(digit);
  }
  return out;
}
