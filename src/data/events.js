// Client for the events feed (#32): /api/events (the weekly GitHub-published file, cached by the
// backend), or in the standalone preview the copy bundled in its snapshot, refreshed from GitHub
// directly when online (raw.githubusercontent.com is CORS-friendly).

import snapshot from '#snapshot';
import { validateFeed, modelSpan } from './events-schema.js';

export { modelSpan };

const RAW = 'https://raw.githubusercontent.com/Lone-Star-Observatories/fidelity/main/events/events.json';
const JD_UNIX = 2440587.5;
export const jdOf = (iso) => Date.parse(iso) / 86400000 + JD_UNIX;

let feed = null, loading = null;
const listeners = new Set();

function adopt(f, origin) {
  if (!f?.events || (feed && Date.parse(feed.generated) > Date.parse(f.generated))) return;
  for (const e of f.events) { e.jd = jdOf(e.time); e.endJd = e.end ? jdOf(e.end) : null; }
  feed = { ...f, origin: f.origin ?? origin };
  for (const fn of listeners) fn(feed);
}

/** Load the feed once; resolves to it (or null). Listeners fire again if a newer copy arrives. */
export function loadEvents() {
  loading ??= (async () => {
    if (snapshot) {
      if (snapshot.events) adopt(snapshot.events, 'bundled');
      try {
        const f = await (await fetch(RAW, { cache: 'no-cache' })).json();
        if (validateFeed(f).ok) adopt(f, 'github');
      } catch { /* offline: the bundled copy stands */ }
      return feed;
    }
    try {
      const r = await fetch('/api/events');
      if (r.ok) adopt(await r.json(), 'backend');
    } catch { /* backend down */ }
    return feed;
  })();
  return loading;
}
export const eventsFeed = () => feed;
export const onEvents = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/** Events whose model is live at `jd`. */
export const activeModels = (jd) => (feed?.events ?? []).filter((e) => { const s = modelSpan(e); return s && jd >= s.from && jd <= s.to; });

/** Best moment to jump to for an event (JD): just before the action starts. */
export function jumpJd(e) {
  const k = e.model?.kind;
  if (k === 'launch') return e.jd - 60 / 86400;
  if (k === 'docking' || k === 'berthing') return e.jd - 1800 / 86400;
  if (k === 'landing') return e.jd - 2700 / 86400;
  if (e.type === 'solar-eclipse' || e.type === 'lunar-eclipse') return e.jd - 2 / 1440;
  return e.jd;
}
