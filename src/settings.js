// Per-viewer preferences, remembered in localStorage when available.
const KEY = 'fidelity.settings.v1';

const defaults = {
  scale: 'enhanced',   // 'enhanced' | 'true'
  ephemeris: 'horizons', // 'kepler' | 'horizons' (Horizons falls back to Kepler month by month while loading or offline)
  labels: true,
  orbits: true,
  starfleet: true,  // STAR TREK layer (#25, #41): Alpha–Delta quadrants, homeworlds, stations and territories in every view, IMAGINED
  belts: true,      // System View: asteroid and Kuiper-belt populations
  dwarfs: true,     // System View: dwarf planets (DETAIL slider)
  smallBodies: true, // System View: the catalogued asteroids and comets (DETAIL slider)
  spacecraft: true, // System View: interplanetary craft and the tracked Earth-orbit craft drawn as bodies (DETAIL slider)
  liveSkins: true,  // today's Sun (SDO) and Earth (VIIRS) where the backend can fetch them
  corona: true,     // System View: the Sun's ray-marched 3D corona (#79; DETAIL slider step, off = the plain glare)
  satellites: true, // System View: every active Earth satellite
  missions: true,
  voiceInterrupt: false, // Computer: false = replies always finish (STOP button / Esc still stop them); true = a confident wake word interrupts   // System View: launches, landings, dockings and spacewalks from the events feed (#32)
  zones: true,      // System View: GEO ring, Van Allen belts, Hill spheres, heliosphere, Oort cloud, Lagrange points
  axes: false,       // System View: spin axes, and Earth's precession circle on the sky
  fields: false,     // System View: MAG FIELDS: the Sun's field (Parker spiral, current sheet) and planetary magnetospheres (#38)
  features: true,    // System View: IAU names of craters, mountains, valleys… on rocky and icy worlds
  sites: true,       // System View: landing, impact and rover sites on globes (#37)
  deepsky: true,     // surface view: nebulae, galaxies and star clusters on the sky (#48)
  constellations: false, // surface view: constellation figures and names (#48)
  siteHidden: [],    // site kinds filtered out (crewed, lander, rover, impact, planned, observatory, launch, trek)
  galaxyArt: false,   // Galaxy/Quadrant: overlay NASA's face-on artwork on the 3D model
  galaxyBright: 0.45, // Galaxy/Quadrant: model brightness, 0.1–1.5
  textScale: 1,
  stepN: 1,         // STEP control: n …
  collapsedSections: [], // right-panel section titles folded away
  timePanel: 'rate',   // time control middle panel: rate | timeline
  timelineSpan: 730,   // TIMELINE width in days
  stepUnit: 'day',  // … units (minute … millennium)     // TEXT size control: multiplies every font size (0.8–1.6)
  band: 'full',      // spectrum filter (#28): full | radio | microwave | ir | visible | uv | xray | gamma
  bandPass: null,    // its bandpass (null = the band's default)
  curve: null,       // spectrum control (#66): the transmission curve { parts, excl } (null = from band/bandPass; see src/data/curve.js)
  voiceStatus: 'auto', // #62: say "Processing" while band images load: 'on' | 'off' | 'auto' (on while the Computer is listening)
  observer: null,   // detail views' FROM EARTH card and the EVENTS "visible from my location" filter (#33): { lat, lon, label } (null = Greenwich / not set); never leaves the browser
  eventsVisibleOnly: false, // EVENTS: show only what can be seen (or watched) from the observer location
  panelWidth: null, // right panel width in px, set by dragging its left edge (null = automatic)
  cameraModes: {},  // camera mode per view (#39): { system: 'orbit' | 'look' | 'fly', galaxy: …, … }
  zoomToCursor: false, // ORBIT: the wheel zooms towards the pointer (#39)
  rfConverter: { kind: 'none', loHz: 125e6, direction: 'up', bypass: false }, // COMMS (#69): a frequency converter between antenna and local SDR (Ham It Up: LO 125 MHz, up)
  txSetup: { callsign: '', attested: false, region: 2, gainDb: 0, timeoutS: 180 }, // COMMS transmit (#69): the operator's callsign and licence attestation; stays in this browser, sent only to the local backend
  postcard: {},     // postcards (#40): { size, labels, frame, link, quality, mastodon, stylizeOk } (stays in this browser)
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
