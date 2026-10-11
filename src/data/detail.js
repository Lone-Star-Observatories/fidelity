// The System View's DETAIL slider: one control that adds map elements step by step. Far left is the
// bare system (the star, planets, moons and their orbits); each step to the right switches on one more
// group of layers. The steps write the ordinary layer flags, so the bar's toggles still fine-tune
// what a step shows, and the slider reads back the deepest step whose groups are all on.

/** Steps, left to right: each switches on its `flags` (and every step before it). */
export const DETAIL_LEVELS = [
  { id: 'core', label: 'STAR · PLANETS · MOONS', flags: [] },
  { id: 'dwarfs', label: '+ DWARF PLANETS', flags: ['dwarfs'] },
  { id: 'small', label: '+ ASTEROIDS & COMETS', flags: ['smallBodies'] },
  { id: 'belts', label: '+ BELTS', flags: ['belts'] },
  { id: 'craft', label: '+ SPACECRAFT & MISSIONS', flags: ['spacecraft', 'missions'] },
  { id: 'zones', label: '+ ZONES & LAGRANGE POINTS', flags: ['zones'] },
  { id: 'sats', label: '+ EARTH SATELLITES', flags: ['satellites'] },
  { id: 'surface', label: '+ SURFACE NAMES & SITES', flags: ['features', 'sites'] },
  { id: 'physics', label: '+ SPIN AXES & MAG FIELDS', flags: ['axes', 'fields'] },
];
export const DETAIL_MAX = DETAIL_LEVELS.length - 1;
/** Every flag the slider drives. */
export const DETAIL_FLAGS = DETAIL_LEVELS.flatMap((l) => l.flags);

/** { flag: on } for step `level`: the flags of every step up to it on, the rest off. */
export function flagsForLevel(level) {
  const n = Math.max(0, Math.min(DETAIL_MAX, Math.round(level)));
  return Object.fromEntries(DETAIL_LEVELS.flatMap((l, i) => l.flags.map((f) => [f, i <= n])));
}

/** The deepest step whose flags (and every earlier step's) are all on, given a flag getter. */
export function levelOfFlags(get) {
  let n = 0;
  for (let i = 1; i <= DETAIL_MAX; i++) {
    if (!DETAIL_LEVELS[i].flags.every((f) => get(f) !== false)) break;
    n = i;
  }
  return n;
}

/** True when the slider's flags hide this body (the star, planets and moons are never hidden). */
export function hiddenByDetail(body, get) {
  if (body.marker) return false; // zones and Lagrange points have their own flag
  if (body.kind === 'dwarf planet') return get('dwarfs') === false;
  if (body.kind === 'asteroid' || body.kind === 'comet' || body.comet) return get('smallBodies') === false;
  if (body.kind === 'spacecraft' || body.kind === 'satellite') return get('spacecraft') === false;
  return false;
}
