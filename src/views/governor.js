// Frame governor (#42): keeps a 3D view usable on a slow GPU (a software renderer such as SwiftShader,
// an old integrated chip). It watches the time between frames and
//  · lowers the render scale (the renderer's pixel ratio) step by step while frames are slow, and raises it
//    again once they are fast: fill-rate is what a slow GPU runs out of first;
//  · leaves the main thread a short idle gap after a very slow frame, so clicks, keys and the panels are
//    handled between frames instead of queueing behind back-to-back multi-second renders.
// On a normal GPU it does nothing (frames well under `slowMs`, scale stays at 1). Pure: tested in
// tests/governor.test.js.

/**
 * createGovernor({ min, slowMs, fastMs, settle, recover }) → { update(ms) → { scale, changed, idleMs }, scale, reset() }.
 * `ms` is the time since the previous frame (rAF to rAF, so GPU stalls count).
 */
export function createGovernor({ min = 0.35, slowMs = 120, fastMs = 40, settle = 3, recover = 40 } = {}) {
  let scale = 1, ema = null, since = 0, fast = 0;
  function update(ms) {
    if (!(ms > 0) || ms > 60000) return { scale, changed: false, idleMs: 0 }; // a hidden tab or a paused page: ignore
    ema = ema == null ? ms : ema + (ms - ema) * 0.35;
    since++;
    let changed = false;
    if (ema > slowMs && since >= settle && scale > min) {
      scale = Math.max(min, +(scale * 0.7).toFixed(3));
      changed = true; since = 0; fast = 0; ema = null; // judge the new scale on its own frames
    } else if (ema < fastMs && scale < 1) {
      if (++fast >= recover) { scale = Math.min(1, +(scale / 0.7).toFixed(3)); changed = true; since = 0; fast = 0; ema = null; }
    } else fast = 0;
    // after a very slow frame, yield a fraction of it to input and other tasks before the next one
    const idleMs = ms > 250 ? Math.min(400, Math.round(ms * 0.25)) : 0;
    return { scale, changed, idleMs };
  }
  return { update, get scale() { return scale; }, reset() { scale = 1; ema = null; since = 0; fast = 0; } };
}
