// Per-viewer preferences, remembered in localStorage when available.
const KEY = 'fidelity.settings.v1';

const defaults = {
  scale: 'enhanced',   // 'enhanced' | 'true'
  ephemeris: 'horizons', // 'kepler' | 'horizons' (Horizons falls back to Kepler month by month while loading or offline)
  labels: true,
  orbits: true,
  starfleet: false, // Galaxy View: Star Trek's Alpha/Beta/Gamma/Delta overlay
  belts: true,      // System View: asteroid and Kuiper-belt populations
  liveSkins: true,  // today's Sun (SDO) and Earth (VIIRS) where the backend can fetch them
  satellites: true, // System View: every active Earth satellite
  zones: true,      // System View: GEO ring, Van Allen belts, Hill spheres, heliosphere, Oort cloud, Lagrange points
  axes: false,       // System View: spin axes, and Earth's precession circle on the sky
  fields: false,     // System View: the Sun's magnetic field (Parker spiral, current sheet)
  sites: true,       // System View: landing, impact and rover sites on globes (#37)
  siteHidden: [],    // site kinds filtered out (crewed, lander, rover, impact, planned, observatory, launch)
  galaxyArt: false,   // Galaxy/Quadrant: overlay NASA's face-on artwork on the 3D model
  galaxyBright: 0.45, // Galaxy/Quadrant: model brightness, 0.1–1.5
  panelWidth: null, // right panel width in px, set by dragging its left edge (null = automatic)
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
