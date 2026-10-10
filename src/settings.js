// Per-viewer preferences, remembered in localStorage when available.
const KEY = 'fidelity.settings.v1';

const defaults = {
  scale: 'enhanced',   // 'enhanced' | 'true'
  ephemeris: 'kepler', // 'kepler' | 'horizons'
  labels: true,
  orbits: true,
  starfleet: false, // Galaxy View: Star Trek's Alpha/Beta/Gamma/Delta overlay
  belts: true,      // System View: asteroid and Kuiper-belt populations
  zones: true,      // System View: GEO ring, Van Allen belts, Hill spheres, heliosphere, Oort cloud, Lagrange points
};

let state = { ...defaults };
try { state = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* private mode */ }

const listeners = new Set();

export const settings = {
  get: (k) => state[k],
  set(k, v) {
    state = { ...state, [k]: v };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    for (const fn of listeners) fn(k, v);
  },
  onChange: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
};
