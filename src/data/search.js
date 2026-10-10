// Text search (#63): the matcher. Pure, no DOM, so the server's star search and the tests share it.
//
// Matching is case- and accent-insensitive (Šteins = steins, Boötes = bootes) and Greek letters
// match their names (α Cen = alpha cen). A query scores against an entry's name and aliases:
// exact > prefix > word prefix (every query word starts a word) > substring > fuzzy (one or two
// typos, Damerau–Levenshtein against each word or the name's opening). Kinds group the dropdown.

const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa',
  λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega' };
// HYG / Yale Bright Star three-letter Bayer abbreviations
export const BAYER = { Alp: 'alpha', Bet: 'beta', Gam: 'gamma', Del: 'delta', Eps: 'epsilon', Zet: 'zeta', Eta: 'eta', The: 'theta', Iot: 'iota', Kap: 'kappa',
  Lam: 'lambda', Mu: 'mu', Nu: 'nu', Xi: 'xi', Omi: 'omicron', Pi: 'pi', Rho: 'rho', Sig: 'sigma', Tau: 'tau', Ups: 'upsilon', Phi: 'phi', Chi: 'chi', Psi: 'psi', Ome: 'omega' };

/** IAU constellation abbreviation → genitive, for "Alpha Centauri" from α Cen. */
export const GENITIVE = {
  And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Bootis',
  Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris', Cap: 'Capricorni',
  Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae',
  Com: 'Comae Berenices', CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis', Cyg: 'Cygni',
  Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis',
  Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis', LMi: 'Leonis Minoris',
  Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis',
  Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei',
  Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium', PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli', Sge: 'Sagittae',
  Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii',
  Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris', Vel: 'Velorum', Vir: 'Virginis',
  Vol: 'Volantis', Vul: 'Vulpeculae',
};

/** Fold for matching: lower case, accents and punctuation stripped, Greek letters spelled out. */
export function fold(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[α-ω]/g, (c) => ` ${GREEK[c] ?? c} `)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss').replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[đ]/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Designations for a star from its catalogue fields: proper name, Bayer (Greek and spelled-out,
 * with the abbreviation and the genitive: "α Cen", "Alpha Cen", "Alpha Centauri"), Flamsteed
 * ("61 Cyg", "61 Cygni"), Gliese, HIP and HD numbers.
 */
export function starAliases({ proper, bayer, flam, con, gl, hip, hd } = {}) {
  const out = [];
  if (proper) out.push(proper);
  const gen = con && GENITIVE[con];
  if (bayer && con) {
    const [, letter, idx = ''] = bayer.match(/^([A-Za-z]+)-?(\d*)$/) || [, bayer, ''];
    const name = BAYER[letter] ?? letter.toLowerCase();
    out.push(`${name}${idx ? ` ${idx}` : ''} ${con}`);
    if (gen) out.push(`${name}${idx ? ` ${idx}` : ''} ${gen}`);
  }
  if (flam && con) { out.push(`${flam} ${con}`); if (gen) out.push(`${flam} ${gen}`); }
  if (gl) { out.push(gl); out.push(gl.replace(/^Gl\b/, 'Gliese').replace(/^GJ\b/, 'Gliese')); }
  if (hip) out.push(`HIP ${hip}`);
  if (hd) out.push(`HD ${hd}`);
  return [...new Set(out)];
}

/** Optimal-string-alignment distance (Damerau–Levenshtein with adjacent swaps), capped at `max` + 1. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1), prev = new Array(b.length + 1), cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    for (let j = 0; j <= b.length; j++) { prev2[j] = prev[j]; prev[j] = cur[j]; }
  }
  return prev[b.length];
}

/** Score one folded query against one folded candidate string (0 = no match). */
export function scoreText(q, text, fuzzy = true) {
  if (!q || !text) return 0;
  if (text === q) return 100;
  if (text.startsWith(q)) return 80 + Math.min(10, (10 * q.length) / text.length);
  const words = text.split(' '), qw = q.split(' ');
  if (qw.every((w) => words.some((x) => x.startsWith(w)))) return 60 + Math.min(10, (10 * q.length) / text.length);
  if (q.length >= 3 && text.includes(q)) return 40;
  if (fuzzy && q.length >= 4 && !/[0-9]/.test(q)) { // a typo or two: whole words, or the opening of the name
    const max = q.length >= 7 ? 2 : 1;
    if (qw.length === 1 && words.some((x) => editDistance(q, x, max) <= max)) return 25;
    if (qw.length === 1 && editDistance(q, text.slice(0, q.length), max) <= max) return 20;
    if (qw.length > 1 && qw.every((w) => words.some((x) => x.startsWith(w) || (w.length >= 4 && editDistance(w, x.slice(0, w.length), 1) <= 1)))) return 18;
  }
  return 0;
}

/** Prepare entries once: { kind, name, aliases?, ... } → with folded keys. */
export function indexEntries(entries) {
  return entries.map((e) => ({ ...e, _keys: [...new Set([e.name, ...(e.aliases ?? [])].map(fold).filter(Boolean))] }));
}

/** Best score of an indexed entry for a raw query (aliases score a little below the name). */
export function scoreEntry(q, e, fuzzy = true) {
  const fq = typeof q === 'string' ? fold(q) : q.f;
  let best = 0;
  e._keys.forEach((k, i) => { const s = scoreText(fq, k, fuzzy) - (i ? 2 : 0); if (s > best) best = s; });
  return best > 0 ? best + (e.boost ?? 0) : 0;
}

/** Ranked hits for `q` across indexed entries: [{ ...entry, score }], best first, at most `limit`. */
export function search(index, q, { limit = 40 } = {}) {
  const f = fold(q);
  if (!f) return [];
  let out = [];
  // exact, prefix and substring matches first; typo-tolerant matching only when those are few
  for (const e of index) { const s = scoreEntry({ f }, e, false); if (s > 0) out.push({ ...e, score: s }); }
  if (out.filter((h) => h.score >= 40).length < 5) {
    out = [];
    for (const e of index) { const s = scoreEntry({ f }, e, true); if (s > 0) out.push({ ...e, score: s }); }
    // a typo match is noise next to a real one ("halley" should not offer "valley")
    if (out.some((h) => h.score >= 60)) out = out.filter((h) => h.score >= 30);
  }
  out.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

/** Order kinds by their best hit and cap each group: [{ kind, hits }]. */
export function groupHits(hits, perKind = 6) {
  const groups = new Map();
  for (const h of hits) { if (!groups.has(h.kind)) groups.set(h.kind, []); const g = groups.get(h.kind); if (g.length < perKind) g.push(h); }
  return [...groups].map(([kind, list]) => ({ kind, hits: list }));
}

// Minor-planet numbers for the app's small bodies (MPC), so "16 Psyche", "(16)" and "16" find them.
export const MINOR_PLANET_NUMBERS = {
  ceres: 1, pallas: 2, 'juno-3': 3, vesta: 4, hebe: 6, iris: 7, hygiea: 10, eunomia: 15, 'psyche-16': 16, lutetia: 21, euphrosyne: 31, 'europa-52': 52, cybele: 65,
  sylvia: 87, ida: 243, eros: 433, mathilde: 253, davida: 511, patroclus: 617, hektor: 624, interamnia: 704, gaspra: 951, ganymed: 1036, chiron: 2060, steins: 2867,
  phaethon: 3200, eurybates: 3548, toutatis: 4179, annefrank: 5535, chariklo: 10199, leucus: 11351, polymele: 15094, orus: 21900, itokawa: 25143,
  quaoar: 50000, donaldjohanson: 52246, didymos: 65803, sedna: 90377, orcus: 90482, apophis: 99942, bennu: 101955, haumea: 136108, eris: 136199,
  makemake: 136472, dinkinesh: 152830, ryugu: 162173, gonggong: 225088, arrokoth: 486958, dimorphos: 65803,
};

/** Aliases for a small body: its number in the usual forms, and provisional names worth knowing. */
export function smallBodyAliases(id, name) {
  const n = MINOR_PLANET_NUMBERS[id], out = [];
  const base = name.replace(/\s*\(\d+\)$/, '');
  if (n && id !== 'dimorphos') out.push(`${n} ${base}`, `(${n}) ${base}`, String(n));
  if (id === 'dimorphos') out.push('Didymos I', '65803 Didymos I');
  if (id === 'halley') out.push("Halley's Comet", 'Halley', 'Comet Halley');
  if (id === '67p') out.push('67P', 'Churyumov Gerasimenko', 'Rosetta comet');
  if (id === 'arrokoth') out.push('Ultima Thule', '2014 MU69');
  if (id === 'gonggong') out.push('2007 OR10');
  if (id === 'sedna') out.push('2003 VB12');
  return out;
}

// Common alternative names for planets, moons and the Sun.
export const BODY_ALIASES = {
  sun: ['Sun', 'Sol', 'the Sun'], moon: ['Luna', 'the Moon', 'Selene'], earth: ['Terra', 'Gaia', 'the Earth'], mars: ['the Red Planet'],
  charon: ['Pluto I'], titan: ['Saturn VI'], io: ['Jupiter I'], europa: ['Jupiter II'], ganymede: ['Jupiter III'], callisto: ['Jupiter IV'],
  triton: ['Neptune I'], phobos: ['Mars I'], deimos: ['Mars II'],
};
