// Minimal netCDF-3 (classic and 64-bit offset) reader, dependency-free: enough to pull one gridded
// variable out of an ERDDAP `.nc` response (ETOPO1 elevations for #80). Not a general library:
// no record variables, no groups (netCDF-4/HDF5 files are rejected).

const TYPES = { 1: ['i8', 1], 2: ['char', 1], 3: ['i16', 2], 4: ['i32', 4], 5: ['f32', 4], 6: ['f64', 8] };

/** Parse a netCDF-3 buffer → { dims: {name: len}, vars: {name: {dims, type, attrs, values()}} }. */
export function readNetcdf(buf) {
  const magic = buf.toString('latin1', 0, 3);
  if (magic !== 'CDF') throw new Error('not a netCDF-3 file');
  const version = buf[3];
  let o = 4;
  const u32 = () => { const v = buf.readUInt32BE(o); o += 4; return v; };
  const off = () => { if (version === 2) { const v = Number(buf.readBigUInt64BE(o)); o += 8; return v; } return u32(); };
  const name = () => { const n = u32(); const s = buf.toString('utf8', o, o + n); o += n + ((4 - (n % 4)) % 4); return s; };
  const values = (type, n) => {
    const [t, size] = TYPES[type];
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = o + i * size;
      out.push(t === 'i8' ? buf.readInt8(p) : t === 'char' ? buf[p] : t === 'i16' ? buf.readInt16BE(p) : t === 'i32' ? buf.readInt32BE(p) : t === 'f32' ? buf.readFloatBE(p) : buf.readDoubleBE(p));
    }
    const bytes = n * size;
    o += bytes + ((4 - (bytes % 4)) % 4);
    return t === 'char' ? Buffer.from(out).toString('utf8') : out;
  };
  const attrs = () => {
    const tag = u32(), n = u32(), out = {};
    if (tag !== 12 && !(tag === 0 && n === 0)) throw new Error('bad attribute list');
    for (let i = 0; i < n; i++) { const k = name(); const type = u32(); out[k] = values(type, u32()); }
    return out;
  };
  u32(); // numrecs
  const dimTag = u32(), nd = u32(), dimNames = [], dims = {};
  if (dimTag !== 10 && !(dimTag === 0 && nd === 0)) throw new Error('bad dimension list');
  for (let i = 0; i < nd; i++) { const k = name(); dims[k] = u32(); dimNames.push(k); }
  const global = attrs();
  const varTag = u32(), nv = u32(), vars = {};
  if (varTag !== 11 && !(varTag === 0 && nv === 0)) throw new Error('bad variable list');
  for (let i = 0; i < nv; i++) {
    const k = name(), n = u32(), ids = [];
    for (let j = 0; j < n; j++) ids.push(u32());
    const a = attrs(), type = u32(), vsize = u32(), begin = off();
    const vdims = ids.map((d) => dimNames[d]);
    const count = vdims.reduce((s, d) => s * dims[d], 1);
    vars[k] = {
      dims: vdims, type: TYPES[type][0], attrs: a, begin, vsize, count,
      /** All values as a typed array (row-major over `dims`). */
      values() {
        const [t, size] = TYPES[type];
        const Arr = { i8: Int8Array, char: Uint8Array, i16: Int16Array, i32: Int32Array, f32: Float32Array, f64: Float64Array }[t];
        const out = new Arr(count);
        for (let p = 0; p < count; p++) {
          const q = begin + p * size;
          out[p] = t === 'i8' ? buf.readInt8(q) : t === 'char' ? buf[q] : t === 'i16' ? buf.readInt16BE(q) : t === 'i32' ? buf.readInt32BE(q) : t === 'f32' ? buf.readFloatBE(q) : buf.readDoubleBE(q);
        }
        return out;
      },
    };
  }
  return { dims, vars, attrs: global };
}
