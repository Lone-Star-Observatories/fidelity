// Hash router. Every view has an address so the back button, deep links and the
// Sector 001 beacon all work: #/system/sol, #/system/sol/earth, #/navigation, …

export const LEVELS = ['universe', 'galaxy', 'quadrant', 'navigation', 'system'];
export const HOME = '#/system/sol';

export function parse(hash = location.hash) {
  const [level, system, body] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!LEVELS.includes(level)) return { level: 'system', system: 'sol', body: null };
  return { level, system: system || 'sol', body: body || null };
}

export function href({ level, system = 'sol', body = null }) {
  return level === 'system' ? `#/system/${system}${body ? `/${body}` : ''}` : `#/${level}`;
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
