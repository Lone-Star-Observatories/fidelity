// Hash router. Every view has an address so the back button, deep links and the
// Sector 001 beacon all work: #/system/sol, #/system/sol/earth, #/system/hyg-70666/b,
// #/navigation/sol, #/star/hyg-32263/hyg-118441, #/planet/sol/earth, …

export const LEVELS = ['universe', 'galaxy', 'quadrant', 'navigation', 'system', 'star', 'planet'];

export function parse(hash = location.hash) {
  const [level, system, body] = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!LEVELS.includes(level)) return { level: 'system', system: 'sol', body: null };
  if (level === 'navigation') return { level, system: system || null, body: null };
  if (level === 'star' || level === 'planet') return { level, system: system || 'sol', body: body || (level === 'star' ? 'sun' : 'earth') };
  return { level, system: system || 'sol', body: level === 'system' ? body || null : null };
}

export function href({ level, system = 'sol', body = null }) {
  if (level === 'system') return `#/system/${system}${body ? `/${body}` : ''}`;
  if (level === 'navigation') return `#/navigation${system ? `/${system}` : ''}`;
  if (level === 'star' || level === 'planet') return `#/${level}/${system}/${body}`;
  return `#/${level}`;
}

let listener = () => {};
let current = null;

// Some embedded frames don't let the hash change; then route in memory instead.
export function go(route) {
  const target = href(route);
  try { location.hash = target; } catch { /* sandboxed */ }
  if (location.hash !== target) { current = target; listener(parse(target)); }
}

export function onRoute(fn) {
  listener = fn;
  window.addEventListener('hashchange', () => { current = null; fn(parse()); });
  fn(parse(current ?? location.hash));
}
