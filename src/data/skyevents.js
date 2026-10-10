// The sky-events list (#30): computed in a worker for a window around the ship's clock and
// recomputed when the clock leaves it. Every event is COMPUTED from the app's own ephemeris.
import EventsWorker from './skyevents.worker.js?worker&inline';

const BEFORE = 45, AFTER = 2 * 365.25; // days of window around the clock
let worker = null, window_ = null, events = [], pending = null, seq = 0, source = 'kepler';
const listeners = new Set();

/** Ask for the window around `jd`; `earthRows()` supplies Horizons Earth rows when available. */
export function requestEvents(jd, earthRows = () => null) {
  if (window_ && jd > window_.from + 20 && jd < window_.to - 60) return;
  if (pending && jd > pending.from + 20 && jd < pending.to - 60) return;
  worker ??= new EventsWorker();
  const id = ++seq, from = jd - BEFORE, to = jd + AFTER;
  pending = { id, from, to };
  worker.onmessage = (e) => {
    if (e.data.id !== seq) return;
    events = e.data.events; source = e.data.earthSource; window_ = pending; pending = null;
    for (const fn of listeners) fn(events);
  };
  worker.postMessage({ id, from, to, earthRows: earthRows() });
}
/** Events in the computed window (empty until the first result). */
export const skyEvents = () => events;
/** 'horizons' when the Sun came from JPL Horizons vectors, else 'kepler'. */
export const skyEventsSource = () => source;
/** The jd window the list covers, or null before the first result. */
export const skyEventsWindow = () => window_;
export const onSkyEvents = (fn) => (listeners.add(fn), () => listeners.delete(fn));
/** The solar eclipse under way at `jd` (between its first and last penumbral contacts), if any. */
export const solarEclipseAt = (jd) => events.find((e) => e.type === 'solar' && e.contacts.P1 && e.contacts.P4 && jd >= e.contacts.P1 && jd <= e.contacts.P4) ?? null;
/** The lunar eclipse under way at `jd`, if any. */
export const lunarEclipseAt = (jd) => events.find((e) => e.type === 'lunar' && e.contacts.P1 && e.contacts.P4 && jd >= e.contacts.P1 && jd <= e.contacts.P4) ?? null;
