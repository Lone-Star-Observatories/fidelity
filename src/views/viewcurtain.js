// A blank loading curtain between main views: switching to Quadrant, Navigation, Galaxy… holds the
// viewport dark until about 30% of what the new view asked for has arrived, so it doesn't appear
// half-drawn. "What it asked for" is counted, not guessed: every texture or model three.js loads
// (THREE.DefaultLoadingManager) and every fetch() started after the switch. A view whose imagery
// is already cached starts nothing and lifts at once; SHOW NOW or the time limit lifts it anyway.

import * as THREE from 'three';

export const READY_SHARE = 0.3;  // lift once this share of the started items has arrived…
export const MIN_MS = 250;       // …but never sooner than this (no flicker on a cached view)
export const SETTLE_MS = 600;    // …nor before the view has had time to start its big loads
export const IDLE_MS = 450;      // nothing started by now: everything was cached
export const MAX_MS = 15000;     // never hold a view longer than this

/** Whether the curtain can lift: { started, done } counts since the switch, `elapsed` ms. */
export function curtainReady({ started, done, elapsed }) {
  if (elapsed >= MAX_MS) return 'timeout';
  if (elapsed < MIN_MS) return false;
  if (started === 0) return elapsed >= IDLE_MS ? 'cached' : false;
  return done / started >= READY_SHARE && elapsed >= SETTLE_MS ? 'loaded' : false;
}

/** Counts items started and finished since begin(); finishing an item started before it doesn't count. */
export function createLoadTracker() {
  let epoch = 0, started = 0, done = 0;
  const open = new Map(); // three.js url → epoch it started in (the manager keys items by url)
  return {
    begin() { epoch++; started = 0; done = 0; },
    start() { started++; return epoch; },
    end(e) { if (e === epoch) done++; },
    startUrl(url) { open.set(url, this.start()); },
    endUrl(url) { if (open.has(url)) { this.end(open.get(url)); open.delete(url); } },
    get state() { return { started, done }; },
  };
}

export function createViewCurtain(viewport) {
  const tracker = createLoadTracker();
  // three.js: every TextureLoader / GLTFLoader without its own manager reports here
  const m = THREE.DefaultLoadingManager, s = m.itemStart, e = m.itemEnd;
  m.itemStart = (url) => { tracker.startUrl(url); s.call(m, url); };
  m.itemEnd = (url) => { tracker.endUrl(url); e.call(m, url); };
  // data and images fetched by the views and panels
  const f = globalThis.fetch?.bind(globalThis);
  if (f) globalThis.fetch = (...args) => { const ep = tracker.start(); return f(...args).finally(() => tracker.end(ep)); };

  const el = document.createElement('div');
  el.className = 'view-curtain';
  el.hidden = true;
  el.innerHTML = '<div class="vc-title"></div><div class="vc-bar"><i></i><b></b></div><div class="vc-sub"></div><button type="button" class="vc-skip">SHOW NOW</button>';
  viewport.appendChild(el);
  const title = el.querySelector('.vc-title'), fill = el.querySelector('.vc-bar i'), sub = el.querySelector('.vc-sub');
  el.querySelector('.vc-bar b').style.left = `${READY_SHARE * 100}%`;
  let t0 = 0, raf = 0;
  const lift = () => { cancelAnimationFrame(raf); raf = 0; el.hidden = true; };
  el.querySelector('.vc-skip').addEventListener('click', lift);

  function step() {
    const { started, done } = tracker.state, elapsed = performance.now() - t0;
    const share = started ? done / started : 0;
    fill.style.width = `${Math.round(share * 100)}%`;
    sub.textContent = started ? `IMAGERY AND DATA · ${done} OF ${started} LOADED · OPENS AT ${READY_SHARE * 100}%` : 'IMAGERY AND DATA · CHECKING…';
    if (curtainReady({ started, done, elapsed })) return lift();
    raf = requestAnimationFrame(step);
  }
  return {
    /** Drop the curtain for a new view (the view keeps loading and drawing behind it). */
    begin(label) {
      tracker.begin();
      t0 = performance.now();
      title.textContent = `LOADING ${label}`;
      fill.style.width = '0%';
      sub.textContent = 'IMAGERY AND DATA · CHECKING…';
      el.hidden = false;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    },
    lift,
    get up() { return !el.hidden; },
  };
}
