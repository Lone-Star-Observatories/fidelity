// Band loading state (#62): instant previews, full resolution in the background, and a spoken
// "Processing" every 3 s while anything for the current band/curve is still on its way.
//
//   begin()           a band/curve change: a new generation; everything older is ignored from now on
//   track(promise)    one full-resolution load of the current generation (resolves to a value, or
//                     null/rejects on failure); returns a handle whose .gen says if it is still current
//   state             { gen, pending, done, failed, phase: idle | loading | done | failed }
//
//   Announcer: while pending > 0 it says "Processing" every `period` ms (the first after one period, so
//   a quick load or rapid switching stays silent: each change restarts the timer). It skips a tick
//   while the Computer is replying (canSpeak), says nothing when disabled (enabled), and after it has
//   spoken at least once ends with "Complete". The first failure stops it with "Unable to complete"
//   (said once); the preview stays. The on-screen pill (onChange) works either way.
//
// Pure apart from the injected timers and speech, so the state machine is tested in Node.

export const PREVIEW_SIZES = { sky: [256, 128], body: [512, 256], solar: [256, 256] };
/** Preview bytes budget per kind (PNG, typical): what a standalone bake would cost. */
export const previewBudget = (counts, bytesPerPixel = 1.6) =>
  Object.entries(counts).reduce((a, [k, n]) => a + n * PREVIEW_SIZES[k][0] * PREVIEW_SIZES[k][1] * bytesPerPixel, 0);

export function createLoadTracker({ speak = () => {}, enabled = () => true, canSpeak = () => true, onChange = () => {},
  setInterval: si = globalThis.setInterval, clearInterval: ci = globalThis.clearInterval, period = 3000 } = {}) {
  let gen = 0, pending = 0, done = 0, failed = 0, phase = 'idle', timer = null, spoke = false, failNoted = false;
  const labels = new Map(); // id → label of what is pending
  let nextId = 0;
  const state = () => ({ gen, pending, done, failed, phase, spoke, waiting: [...labels.values()] });
  const changed = () => onChange(state());
  const stop = () => { if (timer != null) ci(timer); timer = null; };
  const say = (text) => { try { speak(text); } catch { /* no speech */ } };
  function tick() {
    if (pending <= 0 || phase !== 'loading') { stop(); return; }
    if (!enabled() || !canSpeak()) return; // muted, or the Computer is talking: skip this tick
    say('Processing'); spoke = true;
    changed(); // the pill pulses with each tick
  }
  function settle() {
    if (phase === 'failed') { if (pending <= 0) stop(); changed(); return; }
    if (pending > 0) { changed(); return; }
    stop();
    phase = done || failed ? 'done' : 'idle';
    if (spoke && enabled() && canSpeak()) say('Complete');
    changed();
  }
  return {
    get state() { return state(); },
    /** A band/curve change: forget everything pending (older loads finish silently). */
    begin() {
      gen++; pending = 0; done = 0; failed = 0; phase = 'idle'; spoke = false; failNoted = false; labels.clear(); stop();
      changed();
      return gen;
    },
    /** Track one full-resolution load of the current generation. */
    track(promise, label = '') {
      const g = gen, id = nextId++;
      pending++; labels.set(id, label);
      if (phase === 'idle' || phase === 'done') phase = 'loading';
      if (timer == null && phase === 'loading') timer = si(tick, period);
      changed();
      const finish = (ok) => {
        if (g !== gen) return; // a stale band: ignore
        pending = Math.max(0, pending - 1); labels.delete(id);
        if (ok) done++;
        else {
          failed++;
          if (!failNoted) { failNoted = true; phase = 'failed'; stop(); if (enabled()) say('Unable to complete'); }
        }
        settle();
      };
      Promise.resolve(promise).then((v) => finish(v != null && v !== false), () => finish(false));
      return { gen: g, current: () => g === gen };
    },
    /** Is generation `g` still the current one? */
    current: (g) => g === gen,
    stop,
  };
}

// The app's one tracker; main.js plugs in speech, the VOICE STATUS setting, the Computer's state and the pill.
const hooks = { speak: () => {}, enabled: () => false, canSpeak: () => true, onChange: () => {} };
export const bandLoads = createLoadTracker({ speak: (t) => hooks.speak(t), enabled: () => hooks.enabled(), canSpeak: () => hooks.canSpeak(), onChange: (s) => hooks.onChange(s) });
export const configureBandLoads = (h) => Object.assign(hooks, h);
