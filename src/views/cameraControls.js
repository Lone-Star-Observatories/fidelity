// Camera controls shared by every 3D view (#39): the camera cluster (ORBIT / LOOK / FLY, zoom
// − slider +, real-unit read-out, FILL VIEW, RESET, link, zoom-to-cursor, full-screen), keyboard
// and touch handling, free look, free move and the smooth return to ORBIT. Each view keeps its
// OrbitControls; the rig takes over the camera only in the free modes, during its own flights and
// while settling back into orbit. Views call `rig.update(now)` every frame and run their own
// target easing and `controls.update()` only when it returns true.
//
// Hooks a view can pass (all optional):
//   fit()                      frame the selection (the rig switches to ORBIT first)
//   reset()                    the view's default framing
//   nearest(pos) → number      distance (scene units) from pos to the nearest surface, for FLY speed
//   ahead(pos, dir) → number   distance to what is in front, for the return to ORBIT
//   toOrbit(prevMode) → bool   view-specific return to ORBIT (System View); true when handled
//   busy() → bool              the view's own flight is moving the camera (orbit-style lookAt)
//   override() → { fov, setFov(v), minFov, maxFov, fit(), reset() } | null   (the surface view)
//   state() / apply(s)         bookmark the camera (see cameraMath encodeCamera)
//   onFullscreen(on)           detail views expand their globe
//   moved()                    after FLY moved the camera (System View re-anchors its origin)

import * as THREE from 'three';
import { settings } from '../settings.js';
import { fitDistance, viewWidth, spanReadout, fieldReadout, flySpeed, sliderFromDistance, distanceFromSlider, zoomed } from './cameraMath.js';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Per-frame easing factor, or 1 (jump) when the viewer prefers reduced motion. */
export const motionK = (k) => (reducedMotion() ? 1 : k);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---- shell-level: full-screen viewport and the bookmark handler -------------------------------
const fsListeners = new Set();
const appEl = () => document.getElementById('app');
export const isFullscreen = () => !!appEl()?.classList.contains('cam-full');
export function setFullscreen(on) {
  const app = appEl();
  if (!app || isFullscreen() === on) return;
  app.classList.toggle('cam-full', on);
  for (const fn of fsListeners) fn(on);
  window.dispatchEvent(new Event('resize'));
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen() && !e.target.closest?.('input, select, textarea')) setFullscreen(false);
  });
}
let bookmarkHandler = null;
/** main.js turns a camera state into a URL (it knows the route and the clock). */
export function onBookmark(fn) { bookmarkHandler = fn; }
let postcardHandler = null;
/** main.js opens the POSTCARD dialog for the active view (#40). */
export function onPostcard(fn) { postcardHandler = fn; }

// ---- helpers for views whose objects are points (stars, clusters, galaxies) -------------------
/** Distance from `pos` to the nearest of the points `each(fn)` hands over (fn(x, y, z[, r])). */
export function nearestPoint(pos, each) {
  let best = Infinity;
  each((x, y, z, r = 0) => { const d = Math.hypot(x - pos.x, y - pos.y, z - pos.z) - r; if (d < best) best = d; });
  return best;
}
/** Distance along `dir` to the nearest point within `maxDeg` of the line of sight, or null. */
export function aheadPoint(pos, dir, each, maxDeg = 3) {
  const cos = Math.cos((maxDeg * Math.PI) / 180);
  let best = null;
  each((x, y, z) => {
    const dx = x - pos.x, dy = y - pos.y, dz = z - pos.z, d = Math.hypot(dx, dy, dz);
    if (!(d > 0)) return;
    const along = (dx * dir.x + dy * dir.y + dz * dir.z);
    if (along / d >= cos && (best == null || along < best)) best = along;
  });
  return best;
}

const MODES = [['orbit', 'ORBIT', '1', 'Orbit the target: drag to turn, wheel or pinch to zoom'],
  ['look', 'LOOK', '2', 'Free look: turn on the spot (drag), zoom changes the field of view'],
  ['fly', 'FLY', '3', 'Free move: W A S D or arrows, Q / E down / up, drag to look, Shift for speed']];
const FLY_KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', KeyE: 'u', KeyQ: 'd' };

export function createCameraRig(o) {
  const { key, camera, controls, dom, container } = o;
  const host = o.host ?? container;
  const unitM = () => (typeof o.metersPerUnit === 'function' ? o.metersPerUnit() : o.metersPerUnit ?? 1);
  const baseFov = camera.fov;
  const minFov = o.minFov ?? 0.5, maxFov = o.maxFov ?? 100;
  let mode = 'orbit';
  let settle = null, flight = null, zoomGoal = null;
  let last = performance.now();
  const keys = new Set();
  let shift = false;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), qa = new THREE.Quaternion();

  const active = () => !container.hidden && container.offsetParent !== null;
  const orbitTarget = () => controls.target;
  const forward = (v = v1) => v.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const nearest = () => Math.max(1e-30, o.nearest?.(camera.position) ?? camera.position.distanceTo(orbitTarget()));

  // ---- the cluster ----------------------------------------------------------------------------
  const el = document.createElement('div');
  el.className = `cam-cluster${o.inline ? ' inline' : ''}${o.className ? ` ${o.className}` : ''}`;
  const btn = (text, title, fn, cls = '') => {
    const b = Object.assign(document.createElement('button'), { className: `cam-btn ${cls}`.trim(), textContent: text, title });
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); b.blur(); });
    return b;
  };
  const modeRow = document.createElement('div');
  modeRow.className = 'cam-row cam-modes';
  const modeBtns = MODES.map(([m, label, k, tip]) => {
    const b = btn(label, `${tip} [${k}]`, () => setMode(m), 'cam-mode');
    b.dataset.mode = m;
    if (o.modes && !o.modes.includes(m)) b.hidden = true;
    return b;
  });
  modeRow.append(...modeBtns);
  const slider = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 1000, step: 1, className: 'cam-slider', title: 'Zoom (wheel, pinch, + / −)' });
  let sliding = false;
  slider.addEventListener('pointerdown', (e) => { sliding = true; e.stopPropagation(); });
  slider.addEventListener('change', () => { sliding = false; });
  slider.addEventListener('input', () => setZoomFraction(slider.value / 1000));
  const zoomRow = document.createElement('div');
  zoomRow.className = 'cam-row';
  zoomRow.append(btn('−', 'Zoom out [−]', () => zoomBy(-1), 'cam-zoom'), slider, btn('+', 'Zoom in [+]', () => zoomBy(1), 'cam-zoom'));
  const readout = document.createElement('div');
  readout.className = 'cam-readout';
  const toolRow = document.createElement('div');
  toolRow.className = 'cam-row';
  const cursorBtn = btn('◎', 'Zoom to cursor: the wheel zooms towards the pointer [C]', () => toggleCursor(), 'cam-tool');
  const fsBtn = btn('⛶', 'Full-screen viewport: hide the side panel and rail [Shift+F] (Esc restores)', () => toggleFullscreen(), 'cam-tool');
  toolRow.append(
    btn('FIT', 'Fill view: frame the selection [F]', () => fit()),
    btn('RESET', 'Reset view: the default framing [R]', () => reset()),
    btn('LINK', 'Copy a link that reopens this view: camera, mode and epoch [B]', () => bookmark()),
    btn('POSTCARD', 'Capture this view as an image to save or share [P]', () => postcardHandler?.(key)),
    cursorBtn, fsBtn);
  el.append(modeRow, zoomRow, readout, toolRow);
  for (const t of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel']) el.addEventListener(t, (e) => e.stopPropagation());
  host.appendChild(el);

  function syncUI() {
    const ov = o.override?.();
    for (const b of modeBtns) {
      b.classList.toggle('on', !ov && b.dataset.mode === mode);
      b.disabled = !!ov;
    }
    cursorBtn.classList.toggle('on', !!settings.get('zoomToCursor'));
    cursorBtn.hidden = !!ov || mode !== 'orbit' || o.noCursorZoom;
    fsBtn.classList.toggle('on', isFullscreen());
    syncReadout();
  }
  let lastText = '';
  function syncReadout() {
    const ov = o.override?.();
    let text, frac;
    if (ov) {
      text = fieldReadout(ov.fov);
      frac = 1 - Math.log(ov.fov / (ov.minFov ?? 2)) / Math.log((ov.maxFov ?? 110) / (ov.minFov ?? 2));
    } else if (mode !== 'orbit') {
      text = fieldReadout(camera.fov);
      frac = 1 - Math.log(camera.fov / minFov) / Math.log(maxFov / minFov);
    } else {
      const d = camera.position.distanceTo(orbitTarget());
      text = spanReadout(viewWidth(d, camera.fov, camera.aspect) * unitM());
      frac = sliderFromDistance(d, controls.minDistance || d / 100, Number.isFinite(controls.maxDistance) ? controls.maxDistance : d * 100);
    }
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    if (!sliding) slider.value = String(Math.round(Math.min(1, Math.max(0, frac)) * 1000));
  }

  // ---- modes ----------------------------------------------------------------------------------
  function persistMode(m) {
    const all = { ...(settings.get('cameraModes') ?? {}) };
    if (all[key] === m) return;
    all[key] = m;
    settings.set('cameraModes', all);
  }
  /** Smoothly turn the camera to face the orbit target (and restore the field of view). */
  function startSettle() {
    settle = { q0: camera.quaternion.clone(), fov0: camera.fov, t0: performance.now(), dur: reducedMotion() ? 0 : 700 };
  }
  function setMode(m, { persist = true, retarget = true } = {}) {
    if (o.override?.()) return;
    if (o.modes && !o.modes.includes(m)) return;
    if (persist) persistMode(m);
    if (m === mode) { syncUI(); return; }
    const prev = mode;
    mode = m;
    keys.clear();
    pointers.clear();
    controls.enabled = m === 'orbit';
    if (m === 'orbit') {
      zoomGoal = null;
      if (retarget && !o.toOrbit?.(prev)) {
        // orbit around whatever is in front: the target goes on the line of sight
        const dir = forward(v2).clone();
        const d = o.ahead?.(camera.position, dir) ?? lastOrbitDistance;
        retargetTo(v3.copy(camera.position).addScaledVector(dir, Math.max(d, controls.minDistance || 0)));
      }
      startSettle();
    } else {
      if (prev === 'orbit') lastOrbitDistance = camera.position.distanceTo(orbitTarget());
      settle = null;
      flight = null;
    }
    syncUI();
  }
  let lastOrbitDistance = camera.position.distanceTo(controls.target) || 1;
  function retargetTo(p) {
    controls.target.copy(p);
    o.target?.copy(p);
    o.retarget?.(p);
  }

  // ---- zoom -----------------------------------------------------------------------------------
  function setFov(f) {
    camera.fov = Math.min(maxFov, Math.max(minFov, f));
    camera.updateProjectionMatrix();
  }
  function setOrbitDistance(d) {
    const t = orbitTarget(), off = v1.copy(camera.position).sub(t);
    if (off.lengthSq() === 0) off.set(0, 0, 1);
    camera.position.copy(t).add(off.setLength(d));
  }
  const clampD = (d) => Math.min(Number.isFinite(controls.maxDistance) ? controls.maxDistance : Infinity, Math.max(controls.minDistance || 0, d));
  function zoomBy(steps) {
    const ov = o.override?.();
    if (ov) return ov.setFov(zoomed(ov.fov, steps, ov.minFov ?? 2, ov.maxFov ?? 110));
    if (mode !== 'orbit') return setFov(zoomed(camera.fov, steps, minFov, maxFov));
    const d = zoomGoal ?? camera.position.distanceTo(orbitTarget());
    zoomGoal = clampD(zoomed(d, steps));
    if (reducedMotion()) { setOrbitDistance(zoomGoal); zoomGoal = null; }
  }
  function setZoomFraction(s) {
    const ov = o.override?.();
    if (ov) { const a = ov.minFov ?? 2, b = ov.maxFov ?? 110; return ov.setFov(a * Math.exp((1 - s) * Math.log(b / a))); }
    if (mode !== 'orbit') return setFov(minFov * Math.exp((1 - s) * Math.log(maxFov / minFov)));
    const d = camera.position.distanceTo(orbitTarget());
    const lo = controls.minDistance || d / 100, hi = Number.isFinite(controls.maxDistance) ? controls.maxDistance : d * 100;
    zoomGoal = null;
    setOrbitDistance(distanceFromSlider(s, lo, hi));
  }
  function toggleCursor() {
    settings.set('zoomToCursor', !settings.get('zoomToCursor'));
    applyCursor();
  }
  function applyCursor() {
    controls.zoomToCursor = !o.noCursorZoom && !!settings.get('zoomToCursor');
    syncUI();
  }
  // zoom-to-cursor moves the orbit target: hand the new target to the view
  controls.addEventListener('end', () => { if (controls.zoomToCursor && mode === 'orbit') { o.target?.copy(controls.target); o.retarget?.(controls.target); } });

  // ---- framing --------------------------------------------------------------------------------
  function toOrbitQuiet() {
    if (mode !== 'orbit') { mode = 'orbit'; controls.enabled = true; persistMode('orbit'); }
    setFov(baseFov);
    settle = null;
    zoomGoal = null;
    syncUI();
  }
  function fit() {
    const ov = o.override?.();
    if (ov) return ov.fit?.();
    toOrbitQuiet();
    o.fit?.();
  }
  function reset() {
    const ov = o.override?.();
    if (ov) return ov.reset?.();
    toOrbitQuiet();
    o.reset?.();
  }
  function toggleFullscreen() {
    setFullscreen(!isFullscreen());
  }
  const onFs = (on) => { o.onFullscreen?.(on && active()); syncUI(); };
  fsListeners.add(onFs);
  function bookmark() {
    const s = state();
    if (s) bookmarkHandler?.(s, key);
  }
  function state() {
    if (o.state) return o.state(mode);
    return { mode, p: camera.position.toArray(), q: camera.quaternion.toArray(), fov: camera.fov, t: controls.target.toArray() };
  }
  function apply(s) {
    if (!s) return;
    if (o.apply) { o.apply(s); }
    else {
      camera.position.fromArray(s.p);
      camera.quaternion.fromArray(s.q);
      if (s.t) retargetTo(v1.fromArray(s.t));
    }
    flight = null; settle = null; zoomGoal = null;
    mode = s.mode === 'look' || s.mode === 'fly' ? s.mode : 'orbit';
    controls.enabled = mode === 'orbit';
    if (mode !== 'orbit') setFov(s.fov); else setFov(baseFov);
    persistMode(mode);
    syncUI();
  }

  /** Fly the camera to `position` looking at `target` (log-distance easing, honours reduced motion). */
  function flyTo({ position, target }) {
    toOrbitQuiet();
    flight = { p0: camera.position.clone(), t0v: controls.target.clone(), p1: position.clone(), t1: target.clone(), start: performance.now(), dur: reducedMotion() ? 0 : 1200 };
  }
  /** FILL VIEW for a sphere: fly to frame it from the current direction. */
  function frameSphere(centre, radius, margin = 1.08) {
    const dir = v1.copy(camera.position).sub(controls.target);
    if (dir.lengthSq() === 0) dir.set(0, 0.5, 1);
    const d = Math.min(Number.isFinite(controls.maxDistance) ? controls.maxDistance : Infinity, fitDistance(radius, baseFov, camera.aspect || 1, margin));
    flyTo({ target: centre.clone(), position: centre.clone().add(dir.normalize().multiplyScalar(d)) });
  }
  function stepFlight(now) {
    const f = flight, k = f.dur ? ease(Math.min(1, (now - f.start) / f.dur)) : 1;
    const t = v1.copy(f.t0v).lerp(f.t1, k);
    const a = v2.copy(f.p0).sub(f.t0v), b = v3.copy(f.p1).sub(f.t1);
    const la = a.length() || 1e-9, lb = b.length() || 1e-9;
    a.divideScalar(la); b.divideScalar(lb);
    const dir = qa.setFromUnitVectors(a, b).slerp(new THREE.Quaternion(), 1 - k); // partial rotation a → b
    const d = Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * k);
    camera.position.copy(t).add(a.applyQuaternion(dir).multiplyScalar(d));
    camera.lookAt(t);
    controls.target.copy(t);
    o.target?.copy(t);
    if (k >= 1) flight = null;
  }

  // ---- free look and free move: pointer, touch, wheel -----------------------------------------
  const pointers = new Map();
  const free = () => mode !== 'orbit' && !o.override?.() && !(o.busy?.());
  function look(dx, dy) {
    const k = (camera.fov * Math.PI / 180) / (dom.clientHeight || 600);
    const up = v1.copy(camera.up).normalize();
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, dx * k); // grab the sky: it follows the pointer
    const right = v2.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pitch = new THREE.Quaternion().setFromAxisAngle(right, dy * k);
    const q = yaw.multiply(pitch).multiply(camera.quaternion);
    // keep away from the poles (no flipping over the top)
    const f = v3.set(0, 0, -1).applyQuaternion(q);
    if (Math.abs(f.dot(up)) < 0.995) camera.quaternion.copy(q);
    else camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(up, dx * k));
  }
  function move(dir, dist) {
    camera.position.addScaledVector(dir, dist);
    o.moved?.();
  }
  dom.addEventListener('pointerdown', (e) => {
    if (!free()) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { dom.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  });
  const endPointer = (e) => { pointers.delete(e.pointerId); };
  dom.addEventListener('pointerup', endPointer);
  dom.addEventListener('pointercancel', endPointer);
  dom.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !free()) return;
    if (pointers.size === 1) {
      look(e.clientX - p.x, e.clientY - p.y);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y), cx0 = (a.x + b.x) / 2, cy0 = (a.y + b.y) / 2;
      const nx = e.clientX, ny = e.clientY;
      const other = a === p ? b : a;
      const after = Math.hypot(nx - other.x, ny - other.y), cx1 = (nx + other.x) / 2, cy1 = (ny + other.y) / 2;
      const ratio = before > 0 ? after / before : 1;
      if (mode === 'look') setFov(camera.fov / ratio); // pinch: field of view
      else {
        const n = nearest();
        move(forward(v2).clone(), Math.log(ratio) * n * 0.6); // pinch: forward / back
        const k = (2 * n * Math.tan((camera.fov * Math.PI) / 360)) / (dom.clientHeight || 600);
        move(v2.set(1, 0, 0).applyQuaternion(camera.quaternion).clone(), -(cx1 - cx0) * k); // two-finger pan: slide
        move(v2.copy(camera.up).clone(), (cy1 - cy0) * k);
      }
    }
    p.x = e.clientX; p.y = e.clientY;
  });
  dom.addEventListener('wheel', (e) => {
    if (!free()) return;
    e.preventDefault();
    setFov(camera.fov * Math.exp(e.deltaY * 0.001));
  }, { passive: false });

  // ---- keyboard -------------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (!active() || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, select, textarea, [contenteditable]') || document.querySelector('.pc-overlay')) return;
    shift = e.shiftKey;
    if (free() && mode === 'fly' && FLY_KEYS[e.code]) { keys.add(FLY_KEYS[e.code]); e.preventDefault(); return; }
    if (e.repeat && !['+', '=', '-', '_'].includes(e.key)) return;
    switch (e.key) {
      case '1': setMode('orbit'); break;
      case '2': setMode('look'); break;
      case '3': setMode('fly'); break;
      case '+': case '=': zoomBy(1); break;
      case '-': case '_': zoomBy(-1); break;
      case 'f': fit(); break;
      case 'F': toggleFullscreen(); break;
      case 'r': case 'R': reset(); break;
      case 'b': case 'B': bookmark(); break;
      case 'p': case 'P': postcardHandler?.(key); break;
      case 'c': case 'C': if (!o.override?.() && mode === 'orbit') toggleCursor(); break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { shift = e.shiftKey; if (FLY_KEYS[e.code]) keys.delete(FLY_KEYS[e.code]); });
  window.addEventListener('blur', () => keys.clear());

  // ---- per frame ------------------------------------------------------------------------------
  let uiT = 0, overridden = false;
  /** Returns true when the view should run its own target easing and controls.update(). */
  function update(now = performance.now()) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (now - uiT > 100) { uiT = now; syncReadout(); }
    const ov = !!o.override?.();
    if (ov !== overridden) { overridden = ov; pointers.clear(); keys.clear(); syncUI(); }
    if (ov) return false;
    if (flight) { stepFlight(now); return false; }
    if (zoomGoal != null && mode === 'orbit') {
      const d = camera.position.distanceTo(orbitTarget());
      const next = Math.exp(Math.log(d) + (Math.log(zoomGoal) - Math.log(d)) * 0.25);
      setOrbitDistance(next);
      if (Math.abs(Math.log(next / zoomGoal)) < 0.005) zoomGoal = null;
    }
    if (settle) {
      const k = settle.dur ? ease(Math.min(1, (now - settle.t0) / settle.dur)) : 1;
      m4.lookAt(camera.position, orbitTarget(), camera.up);
      camera.quaternion.slerpQuaternions(settle.q0, qa.setFromRotationMatrix(m4), k);
      setFov(settle.fov0 + (baseFov - settle.fov0) * k);
      if (k >= 1) settle = null;
      return false;
    }
    if (o.busy?.()) return true;
    if (mode === 'orbit') return true;
    if (mode === 'fly' && keys.size) {
      const dir = v2.set(0, 0, 0), f = forward(v1);
      const r = v3.set(1, 0, 0).applyQuaternion(camera.quaternion);
      if (keys.has('f')) dir.add(f); if (keys.has('b')) dir.sub(f);
      if (keys.has('r')) dir.add(r); if (keys.has('l')) dir.sub(r);
      const up = v1.copy(camera.up).normalize();
      if (keys.has('u')) dir.add(up); if (keys.has('d')) dir.sub(up);
      if (dir.lengthSq() > 0) move(dir.normalize().clone(), flySpeed(nearest()) * (shift ? 5 : 1) * dt);
    }
    return false;
  }

  // restore the remembered mode
  const remembered = (settings.get('cameraModes') ?? {})[key];
  if (remembered && remembered !== 'orbit' && (!o.modes || o.modes.includes(remembered))) { mode = remembered; controls.enabled = false; }
  applyCursor();
  settings.onChange((k) => { if (k === 'zoomToCursor') applyCursor(); });
  syncUI();
  syncReadout();

  const api = {
    el,
    camera,
    get mode() { return mode; },
    setMode, update, zoomBy, fit, reset, flyTo, frameSphere, state, apply, syncUI,
    /** True while the rig itself is moving the camera (its flight or the settle into orbit). */
    get moving() { return !!(flight || settle); },
    /** Distance to the nearest surface (the view's `nearest` hook). */
    nearest: () => nearest(),
    cancelFlight() { flight = null; zoomGoal = null; },
    fov: baseFov,
  };
  if (typeof window !== 'undefined') (window.__fidelityCameras ??= {})[key] = api; // for browser checks and the console
  return api;
}
