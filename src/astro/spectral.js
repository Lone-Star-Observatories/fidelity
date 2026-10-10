// Spectral-type parsing and template matching, shared by the backend and the standalone preview.

const CLASS = { O: 0, B: 10, A: 20, F: 30, G: 40, K: 50, M: 60 };
const LUM = { I: 1, Ia: 1, Iab: 1, Ib: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

/**
 * Numeric spectral code: { code (O0=0 … M9=69), lum (1–5), variant ('w' metal-poor, 'r' rich) }.
 * Handles ranges like "B57V" (B5–7) and "K34II", decimals like "M2.5V", and suffixes ("M5Ve").
 */
export function parseSpectralType(t) {
  if (!t) return null;
  let s = String(t).trim();
  let variant = '';
  if (/^[wr][OBAFGKM]/.test(s)) { variant = s[0]; s = s.slice(1); }
  if (/^sd/.test(s)) { variant = 'w'; s = s.replace(/^sd/, ''); } // subdwarf: metal-poor dwarf
  s = s.replace(/^d/, ''); // old "dM4" notation for dwarfs
  const m = s.match(/^([OBAFGKM])\s*(\d+(?:\.\d+)?)?(?:[-/]?(\d))?\s*(Iab|Ia|Ib|III|II|IV|VI|V|I)?/);
  if (!m) return null;
  let sub = m[2] != null ? Number(m[2]) : 5;
  // "B57" → 5–7, "K34" → 3–4, "F02" → 0–2: two digits with no decimal point are a range
  if (m[2] && /^\d\d$/.test(m[2]) && Number(m[2]) > 9) sub = (Number(m[2][0]) + Number(m[2][1])) / 2;
  else if (m[3] != null && m[2] && !m[2].includes('.')) sub = (sub + Number(m[3])) / 2;
  return { letter: m[1], code: CLASS[m[1]] + Math.min(sub, 10), lum: m[4] ? LUM[m[4]] : 5, lumGiven: !!m[4], variant };
}

/** Index entry closest to `type` (score: spectral code distance + 3 × luminosity class distance). */
export function closestTemplate(index, type, metallicity = null) {
  const want = parseSpectralType(type);
  if (!want) return null;
  const variant = want.variant || (metallicity != null ? (metallicity < -0.3 ? 'w' : metallicity > 0.2 ? 'r' : '') : '');
  let best = null, bestScore = Infinity;
  for (const e of index) {
    const p = parseSpectralType(e.type);
    if (!p) continue;
    const score = Math.abs(p.code - want.code) + 3 * Math.abs(p.lum - want.lum) + (p.variant === variant ? 0 : 0.6);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best ? { ...best, score: bestScore } : null;
}

