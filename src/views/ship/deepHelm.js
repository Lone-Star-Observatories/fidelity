// HELM between the stars (#42): the USS Fidelity flown on in the Navigation, Quadrant and Galaxy views,
// with the System View helm's controls (throttle, steering, CHASE / BRIDGE / ORBIT, IMPULSE / WARP or
// REAL PHYSICS, SET COURSE). One ship: its state is shipState.js (heliocentric galactic light-years,
// today's frame), so each view's controller reads it on engage and writes it every frame.
//
// Drawing: a 352 m ship cannot share a depth buffer with a light-year chart, so the chart is rendered
// from a camera sitting at the ship's position and the ship itself is drawn over it in its own scene, in
// metres, from a chase or bridge camera with the same orientation (an overlay, depth cleared between).
// In ORBIT the camera circles the ship's position at chart scale, and a marker (dot, heading, label)
// shows where it is. The warp streaks ride in the overlay like the System View's.
//
// Time: warp at the TNG scale is slow for light-years (warp 9.9 ≈ 3,053 c: 12 hours to Alpha Centauri,
// 9 years to the galactic centre). The HUD always gives the real flight time at the chosen warp; a SIM
// speed-up (IMAGINED: a viewing aid, not the ship's) lets the trip be watched in seconds, and the ship's
// clocks in the log count flight time, not watching time. The app clock is not moved.
//
// The view hands over (ctx): key, label, scene, camera, controls, dom, container, renderer, rig,
// toScene(gal) → Vector3 (heliocentric galactic ly → scene), nearChase (scene units), orbitDist,
// simDefault (s/s with no course), targets() → [{ id, name, kind, gal, standoffLy }], selected() → a
// target or null, decide(state) → a hand-over or null (handover.js), epochNote() → text or null, and
// on(kind, data): 'hand' (decide's verdict; main.js routes), 'change' (panels), 'flash' (into warp).

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createShipModel, SHIP, BRIDGE_EYE } from './shipModel.js';
import { VIEWS } from './helm.js';
import { badge } from '../../data/provenance.js';
import { shipState as S, logEntry as logShip, SIM_SPEEDS, autoSim, simLabel, galToScene, sceneToGal, STAR_STANDOFF_LY, pinchZoom } from './shipState.js';
import { C_KM_S, LY_KM, gamma, regime, throttleToSpeed, speedToThrottle, cToWarp, warpToC, autoCruise, FULL_IMPULSE_C, fmtSpeed, fmtDistance, fmtDuration } from '../../astro/warp.js';

const DEG = Math.PI / 180;
const L_M = SHIP.lengthM;
const CRUISES = [['auto', 'AUTO'], ['impulse', 'FULL IMPULSE'], [5, 'WARP 5'], [8, 'WARP 8'], [9.9, 'WARP 9.9'], [9.99, 'WARP 9.99']];
const THRUSTS = [1, 10, 100, 1000];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);

export function createDeepHelm(ctx) {
  const { scene, camera, controls, dom, container, renderer, rig } = ctx;
  let active = false, ship = null, handing = false, t0 = 0;

  // ---- the overlay: the ship in metres, drawn over the chart -----------------------------------------
  const ov = new THREE.Scene();
  const ovCam = new THREE.PerspectiveCamera(50, 1, 0.5, 4e5);
  ov.add(ovCam, new THREE.HemisphereLight(0xdde8ff, 0x1c2030, 0.7));
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.4);
  keyLight.position.set(-0.7, 0.9, 0.4);
  ovCam.add(keyLight); // lit from over the viewer's shoulder, wherever the ship points
  const shipRoot = new THREE.Group();
  ov.add(shipRoot);
  function build() {
    if (ship) return;
    ship = createShipModel();
    shipRoot.add(ship.group);
    const room = new RoomEnvironment(), gen = new THREE.PMREMGenerator(renderer);
    ov.environment = gen.fromScene(room, 0.04).texture;
    ov.environmentIntensity = 0.7;
    room.dispose(); gen.dispose();
  }

  // ---- the marker on the chart (ORBIT view) and the course line ----------------------------------------
  const mark = new THREE.Group();
  mark.visible = false;
  const dotGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const dot = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0xffcc66, size: 10, sizeAttenuation: false, depthTest: false, transparent: true }));
  const nose = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffcc66, depthTest: false, transparent: true }));
  dot.renderOrder = nose.renderOrder = 6;
  const tagEl = document.createElement('div');
  tagEl.className = 'nav-label ship-tag';
  const tag = new CSS2DObject(tagEl);
  tag.center.set(-0.12, 0.5);
  tag.visible = false;
  mark.add(dot, nose, tag);
  const courseGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const courseLine = new THREE.Line(courseGeo, new THREE.LineDashedMaterial({ color: 0x99ddff, transparent: true, opacity: 0.7, dashSize: 1, gapSize: 0.6, depthTest: false }));
  courseLine.visible = false;
  courseLine.frustumCulled = false;
  scene.add(mark, courseLine);

  // ---- ship state (read from and written to shipState) -------------------------------------------------
  let gal = [0, 0, 0];
  const quat = new THREE.Quaternion();
  let speed = 0, model = 'impulse', thrustG = 1, throttle = 0, allStop = false, view = 'chase', cruiseSel = 'auto', simSel = 'auto', course = null;
  const vel = new THREE.Vector3(); // km/s, scene axes (REAL PHYSICS)
  let chaseZoom = 1, arrived = false;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const fwd = (q = quat, v = v1) => v.set(0, 0, -1).applyQuaternion(q);
  const shipUp = (v = v2) => v.set(0, 1, 0).applyQuaternion(quat);
  function facing(dir, up, out = new THREE.Quaternion()) {
    m4.lookAt(v3.set(0, 0, 0), dir, Math.abs(dir.clone().normalize().dot(up)) > 0.999 ? new THREE.Vector3(1, 0, 0) : up);
    return out.setFromRotationMatrix(m4);
  }
  const shipScene = new THREE.Vector3();
  const log = (text) => { logShip(text); ctx.on?.('change'); };

  // ---- engage / release --------------------------------------------------------------------------------
  let saved = null;
  /** Take over the view with the ship from shipState (idempotent: re-reads the state). */
  function engage() {
    build();
    gal = S.gal.slice(); quat.fromArray(S.quat); speed = S.kmS; vel.fromArray(S.vel);
    model = S.model; thrustG = S.thrustG; throttle = S.throttle; view = S.view; cruiseSel = S.cruise; simSel = S.sim; course = S.course;
    allStop = false; arrived = false;
    if (!active) {
      saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), up: camera.up.clone(), fov: camera.fov, near: camera.near, target: controls.target.clone(),
        min: controls.minDistance, max: controls.maxDistance, enabled: controls.enabled };
      active = true;
      rig.el.hidden = true;
      container.classList.add('helm-on'); // hides the orientation gauge under the helm controls
      hud.hidden = false;
      keys.clear();
    }
    handing = false; t0 = performance.now(); last = t0;
    camQ.copy(quat);
    shipScene.copy(ctx.toScene(gal));
    setView(view, true);
    if (S.pendingCourse) { const t = S.pendingCourse; S.pendingCourse = null; setCourse(t); } // e.g. WARP TO A STAR from the System View
    syncHud(true);
    return true;
  }
  /** The ship leaves this view (a hand-over, or nobody at the helm): give the camera back. */
  function release() {
    if (!active) return;
    active = false;
    keys.clear(); drag = null;
    hud.hidden = true; frameEl.hidden = true; flashEl.hidden = true;
    mark.visible = false; tag.visible = false; courseLine.visible = false;
    rig.el.hidden = false;
    container.classList.remove('helm-on');
    if (saved) {
      camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat); camera.up.copy(saved.up);
      camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix();
      controls.target.copy(saved.target); controls.minDistance = saved.min; controls.maxDistance = saved.max; controls.enabled = saved.enabled;
    }
  }
  /** LEAVE HELM out here: the ship is parked where it is (nobody flies it) and the view is as before. */
  function leave() {
    if (!active) return;
    store();
    release();
    S.frame = null; S.course = null;
    log(`HELM DISENGAGED · DEEP SPACE`);
    ctx.on?.('change');
  }
  function store() {
    S.gal = gal.slice(); S.quat = quat.toArray(); S.kmS = speed; S.vel = vel.toArray();
    S.model = model; S.thrustG = thrustG; S.throttle = throttle; S.view = view; S.cruise = cruiseSel; S.sim = simSel; S.course = course;
  }

  // ---- the autopilot -----------------------------------------------------------------------------------
  function cruiseFor(km) {
    if (cruiseSel === 'impulse') return { kmS: FULL_IMPULSE_C * C_KM_S, warp: 0 };
    if (typeof cruiseSel === 'number') return { kmS: warpToC(cruiseSel) * C_KM_S, warp: cruiseSel };
    return km > 0.05 * LY_KM ? { kmS: warpToC(9.9) * C_KM_S, warp: 9.9 } : autoCruise(km);
  }
  /** SET COURSE for a target ({ id, name, kind, gal, standoffLy }). */
  function setCourse(t) {
    if (!active || !t?.gal) return false;
    model = 'impulse'; allStop = false; arrived = false;
    const km = Math.max(0, len3(sub3(t.gal, gal)) - (t.standoffLy ?? STAR_STANDOFF_LY)) * LY_KM;
    const cruise = cruiseFor(km);
    course = { id: t.id, name: t.name, kind: t.kind, gal: t.gal.slice(), standoffLy: t.standoffLy ?? STAR_STANDOFF_LY, phase: 'turn', cruise, simAuto: autoSim(km / cruise.kmS) };
    flash(`COURSE LAID IN · ${t.name.toUpperCase()} · ${fmtDistance(km)}`);
    log(`COURSE SET · ${t.name.toUpperCase()} · ${fmtDistance(km)} · ${cruise.warp ? `WARP ${cruise.warp}` : 'IMPULSE'} · FLIGHT ${fmtDuration(km / cruise.kmS)}`);
    S.course = course;
    return true;
  }
  /** Flight seconds per real second now: the SIM choice, or AUTO (the course's, else the view's default). */
  const simNow = () => (typeof simSel === 'number' ? simSel : course?.simAuto ?? ctx.simDefault ?? 1);

  // ---- input -------------------------------------------------------------------------------------------
  const keys = new Set();
  let shift = false, drag = null;
  const KEYMAP = { KeyW: 'up', KeyR: 'up', KeyS: 'down', KeyF: 'down', KeyA: 'yawL', ArrowLeft: 'yawL', KeyD: 'yawR', ArrowRight: 'yawR',
    ArrowUp: 'pitchU', ArrowDown: 'pitchD', KeyQ: 'rollL', KeyE: 'rollR' };
  const live = () => active && !container.hidden;
  const typing = (e) => e.target.closest?.('input, select, textarea, [contenteditable]') || document.querySelector('.pc-overlay');
  window.addEventListener('keydown', (e) => {
    if (!live() || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    shift = e.shiftKey;
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); manual(k); return; }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyX': case 'Backspace': fullStop(); break;
      case 'Digit1': setView('chase'); break;
      case 'Digit2': setView('bridge'); break;
      case 'Digit3': setView('orbit'); break;
      case 'KeyV': setView(VIEWS[(VIEWS.findIndex(([v]) => v === view) + 1) % VIEWS.length][0]); break;
      case 'KeyH': leave(); break;
      case 'KeyC': { const t = ctx.selected?.(); if (t) setCourse(t); else return; break; }
      case 'Period': stepSim(1); break;
      case 'Comma': stepSim(-1); break;
      case 'Escape': if (course) { course = null; S.course = null; flash('AUTOPILOT OFF'); } else return; break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { shift = e.shiftKey; const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());
  function manual(kind) {
    if (course) { course = null; S.course = null; flash('AUTOPILOT OFF · MANUAL CONTROL'); }
    if (kind === 'up' || kind === 'down') allStop = false;
  }
  // two fingers pinch: CHASE distance or BRIDGE field of view, as the camera rig's pinch
  const touches = new Map();
  dom.addEventListener('pointerdown', (e) => {
    if (!live() || view === 'orbit') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = touches.size === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 } : null;
  });
  dom.addEventListener('pointermove', (e) => {
    if (touches.size >= 2 && touches.has(e.pointerId) && live() && view !== 'orbit') { pinch(e); return; }
    if (!drag || drag.id !== e.pointerId || !live() || view === 'orbit') return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 4) return;
    manual('steer');
    const k = ((camera.fov * DEG) / (dom.clientHeight || 600)) * 0.9;
    quat.multiply(q1.setFromAxisAngle(v1.set(0, 1, 0), -dx * k)).multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), -dy * k)).normalize();
  });
  function pinch(e) {
    const p = touches.get(e.pointerId), other = [...touches].find(([id]) => id !== e.pointerId)?.[1];
    const before = Math.hypot(p.x - other.x, p.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    p.x = e.clientX; p.y = e.clientY;
    const z = pinchZoom(view, before > 0 ? after / before : 1, { chaseZoom, fov: camera.fov });
    chaseZoom = z.chaseZoom;
    if (z.fov !== camera.fov) { camera.fov = z.fov; camera.updateProjectionMatrix(); }
  }
  const endDrag = (e) => { touches.delete(e.pointerId); if (drag?.id === e.pointerId) drag = null; };
  dom.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointercancel', endDrag);
  dom.addEventListener('wheel', (e) => {
    if (!live() || view === 'orbit') return;
    e.preventDefault(); e.stopPropagation();
    if (view === 'chase') chaseZoom = Math.min(400, Math.max(0.45, chaseZoom * Math.exp(e.deltaY * 0.0015)));
    else { camera.fov = Math.min(100, Math.max(5, camera.fov * Math.exp(e.deltaY * 0.001))); camera.updateProjectionMatrix(); }
  }, { passive: false, capture: true });

  function fullStop() { course = null; S.course = null; throttle = 0; allStop = true; flash('FULL STOP'); }
  function setThrottle(t) { manual('up'); throttle = Math.min(1, Math.max(0, t)); allStop = false; }
  function stepSim(d) {
    const list = ['auto', ...SIM_SPEEDS.map(([k]) => k)];
    simSel = list[Math.min(list.length - 1, Math.max(0, list.indexOf(simSel) + d))];
    syncHud(true);
  }
  function setView(v, force = false) {
    if (!VIEWS.some(([x]) => x === v)) return;
    if (v === 'orbit' && (view !== 'orbit' || force)) { // start behind and above the ship at chart scale
      const d = ctx.orbitDist ?? 1;
      camera.position.copy(shipScene).add(fwd(quat, v1).multiplyScalar(-d)).add(shipUp(v2).multiplyScalar(d * 0.35));
      controls.target.copy(shipScene);
      camera.up.set(0, 1, 0);
    }
    view = v;
    controls.enabled = active && v === 'orbit';
    if (v !== 'bridge') { camera.fov = saved?.fov ?? camera.fov; camera.updateProjectionMatrix(); }
    ship?.setBridge(v === 'bridge');
    syncHud(true);
  }
  function setModel(mo) {
    if (mo === model) return;
    model = mo; course = null; S.course = null;
    if (mo === 'physics') { vel.copy(fwd()).multiplyScalar(Math.min(speed, 0.999 * C_KM_S)); throttle = 0; }
    else { speed = Math.min(vel.length(), FULL_IMPULSE_C * C_KM_S); throttle = speedToThrottle(speed); if (speed > 0) quat.copy(facing(vel.clone().normalize(), shipUp(v2).clone())); }
    flash(mo === 'physics' ? `REAL PHYSICS · THRUST ${thrustG} G · NO WARP` : 'IMPULSE AND WARP');
    syncHud(true);
  }

  // ---- per frame ---------------------------------------------------------------------------------------
  let last = performance.now(), hudT = 0, decideT = 0, lastRegime = 'stopped';
  const camQ = new THREE.Quaternion();
  const TAU_UP = 0.15, TAU_DOWN = 0.3, TAU_STOP = 0.14;
  function rampTo(v, target, dt) {
    if (target > v) {
      const lin = v + (target - v) * (1 - Math.exp(-dt / 0.6));
      return Math.min(target, Math.max(Math.max(v, 1e-3) * Math.exp(dt / TAU_UP), lin));
    }
    const tau = allStop ? TAU_STOP : TAU_DOWN;
    const out = Math.max(target, Math.min(v * Math.exp(-dt / tau), v - (v - target) * (1 - Math.exp(-dt / 0.5))));
    return out < 1e-4 && target === 0 ? 0 : out;
  }
  function warpGap(vCmd) {
    const lo = FULL_IMPULSE_C * C_KM_S * 1.0001, hi = C_KM_S * 0.999;
    if (speed > lo && speed < hi) {
      if (vCmd >= hi) { speed = C_KM_S; ctx.on?.('flash'); } else speed = FULL_IMPULSE_C * C_KM_S;
    }
  }
  function steer(dt) {
    const rate = (shift ? 3 : 1) * 32 * DEG * dt;
    let yaw = 0, pitch = 0, roll = 0;
    if (keys.has('yawL')) yaw += rate; if (keys.has('yawR')) yaw -= rate;
    if (keys.has('pitchU')) pitch += rate; if (keys.has('pitchD')) pitch -= rate;
    if (keys.has('rollL')) roll += rate * 1.5; if (keys.has('rollR')) roll -= rate * 1.5;
    if (yaw) quat.multiply(q1.setFromAxisAngle(v1.set(0, 1, 0), yaw));
    if (pitch) quat.multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), pitch));
    if (roll) quat.multiply(q1.setFromAxisAngle(v1.set(0, 0, 1), roll));
    quat.normalize();
    if ((keys.has('up') || keys.has('down')) && model === 'impulse') throttle = Math.min(1, Math.max(0, throttle + (shift ? 0.3 : 0.1) * dt * (keys.has('up') ? 1 : -1)));
  }
  function turnTo(dir, up, dt, rateDeg) {
    const target = facing(dir, up, q1);
    const ang = quat.angleTo(target);
    quat.rotateTowards(target, rateDeg * DEG * dt);
    return ang;
  }
  /** Move the ship `km` along scene direction `dir`. */
  const advance = (dir, km) => { const g = sceneToGal([dir.x, dir.y, dir.z]); for (let k = 0; k < 3; k++) gal[k] += (g[k] * km) / LY_KM; };

  function autopilot(dt, simDt, N) {
    const toT = sub3(course.gal, gal), d = len3(toT), rem = Math.max(0, d - course.standoffLy), remKm = rem * LY_KM;
    const dir = new THREE.Vector3(...galToScene(toT)).normalize();
    const ang = turnTo(dir, shipUp(v3).clone(), dt, course.phase === 'turn' ? 60 : 120);
    if (course.phase === 'turn' && ang < 5 * DEG) course.phase = 'travel';
    let vCmd = 0;
    if (course.phase === 'travel') {
      vCmd = Math.min(course.cruise.kmS, remKm / (0.9 * N) + 0.3); // slow down in proportion to what is left (in watching time)
      if (vCmd > FULL_IMPULSE_C * C_KM_S && vCmd < C_KM_S * 0.999) vCmd = FULL_IMPULSE_C * C_KM_S;
    }
    speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
    const step = course.phase === 'travel' ? Math.min(speed * simDt, remKm) : 0;
    if (step > 0) advance(dir, step);
    course.distLy = rem - step / LY_KM;
    course.etaS = speed > 0 ? (course.distLy * LY_KM) / speed : null;
    if (course.phase === 'travel' && course.distLy * LY_KM < Math.max(1e4, course.standoffLy * LY_KM * 0.03)) {
      const name = course.name.toUpperCase();
      log(`ARRIVED · ${name}`);
      flash(course.kind === 'star' ? `ARRIVING · ${name} SYSTEM` : `ARRIVED · ${name} · ALL STOP`);
      if (course.kind !== 'star') { throttle = 0; allStop = true; S.visited.add(course.id); } else S.lastCourseArrival = true; // handed down under autopilot
      arrived = course.id;
      course = null; S.course = null;
    }
    return step;
  }

  /** Called by the view every frame before it renders: fly, place the camera, decide hand-overs. */
  function frame(now = performance.now()) {
    const dt = Math.min(1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!active) return false;
    steer(dt);
    const N = simNow(), simDt = dt * N;
    let movedKm = 0;
    if (course) movedKm = autopilot(dt, simDt, N);
    else if (model === 'physics') {
      // Newtonian thrust along the nose; no gravity out here (the Galaxy's pull near the Sun is ~2 × 10⁻¹⁰ m/s²)
      const a = thrustG * 9.80665e-3;
      const u = v1.copy(vel).multiplyScalar(gamma(Math.min(0.999999, vel.length() / C_KM_S)));
      if (keys.has('up')) u.addScaledVector(fwd(quat, v2), a * simDt);
      if (keys.has('down')) u.addScaledVector(fwd(quat, v2), -a * simDt);
      if (allStop) { const s = u.length(); if (s <= a * simDt) { u.set(0, 0, 0); allStop = false; } else u.addScaledVector(u.clone().normalize(), -a * simDt); }
      const un = u.length() / C_KM_S;
      vel.copy(u).multiplyScalar(1 / Math.sqrt(1 + un * un));
      const sp = vel.length();
      if (sp > 0) advance(v3.copy(vel).normalize(), sp * simDt);
      movedKm = sp * simDt;
    } else {
      const vCmd = allStop ? 0 : throttleToSpeed(throttle).kmS;
      speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
      if (allStop && speed === 0) allStop = false;
      advance(fwd(quat, v3), speed * simDt);
      movedKm = speed * simDt;
    }
    const v = currentKmS();
    S.earthS += simDt;
    S.shipS += regime(v) === 'warp' ? simDt : simDt / gamma(Math.min(0.999999, v / C_KM_S));
    S.travelledKm += movedKm;
    store();
    shipScene.copy(ctx.toScene(gal));
    placeCamera(dt);
    effects(dt, v);
    if (now - hudT > 120) { hudT = now; syncHud(); }
    if (!handing && now - t0 > 1500 && now - decideT > 200) { decideT = now; decide(); }
    return true;
  }
  const currentKmS = () => (model === 'physics' && !course ? vel.length() : speed);
  /** Direction of motion in the galactic frame (zero when stopped). */
  function motionGal() {
    if (model === 'physics' && !course) return sceneToGal(vel.toArray());
    const f = fwd(quat, v1);
    return sceneToGal([f.x * speed, f.y * speed, f.z * speed]);
  }
  function decide() {
    const verdict = ctx.decide?.({ pos: gal.slice(), vel: motionGal(), stopped: currentKmS() === 0, arrived: !!arrived, arrivedId: arrived || null, courseId: course?.id ?? null });
    arrived = false;
    if (!verdict) return;
    handing = true;
    store();
    ctx.on?.('hand', verdict);
  }

  const chaseOffset = (v) => v.set(0, 0.3 * L_M, 1.6 * L_M).multiplyScalar(chaseZoom);
  function placeCamera(dt) {
    camQ.slerp(quat, 1 - Math.exp(-dt * (view === 'chase' ? 4 : 30)));
    shipRoot.quaternion.copy(quat);
    if (view === 'orbit') {
      controls.enabled = true;
      camera.position.add(v1.copy(shipScene).sub(controls.target));
      controls.target.copy(shipScene);
      controls.minDistance = (ctx.nearChase ?? 1e-5) * 4; controls.maxDistance = (ctx.orbitDist ?? 1) * 400;
      controls.update();
      const dist = camera.position.distanceTo(shipScene);
      camera.near = Math.max((ctx.nearChase ?? 1e-5) * 0.5, dist * 1e-3);
    } else {
      controls.enabled = false;
      if (view === 'chase') {
        ovCam.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
        const look = v2.set(0, 0.06 * L_M, -0.9 * L_M).multiplyScalar(Math.min(chaseZoom, 4)).applyQuaternion(camQ);
        m4.lookAt(ovCam.position, look, v3.set(0, 1, 0).applyQuaternion(camQ));
        ovCam.quaternion.setFromRotationMatrix(m4);
      } else {
        ovCam.position.copy(BRIDGE_EYE).applyQuaternion(quat);
        ovCam.quaternion.copy(quat);
      }
      camera.position.copy(shipScene);
      camera.quaternion.copy(ovCam.quaternion);
      camera.near = ctx.nearChase ?? 1e-5;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // the marker and the course line
    const orbit = view === 'orbit';
    mark.visible = orbit;
    mark.position.copy(shipScene);
    nose.quaternion.copy(quat);
    nose.scale.setScalar(Math.max(1e-9, camera.position.distanceTo(shipScene) * 0.12));
    tag.visible = orbit; // strict boolean for CSS2DRenderer
    const reg = regime(currentKmS());
    const text = `◆ ${SHIP.name}${reg === 'warp' ? ` · WARP ${cToWarp(currentKmS() / C_KM_S).toFixed(2)}` : ''}`;
    if (tagEl.textContent !== text) tagEl.textContent = text;
    courseLine.visible = !!course;
    if (course) {
      const p = courseGeo.attributes.position, T = ctx.toScene(course.gal);
      p.setXYZ(0, shipScene.x, shipScene.y, shipScene.z); p.setXYZ(1, T.x, T.y, T.z); p.needsUpdate = true;
      const L = shipScene.distanceTo(T);
      courseLine.material.dashSize = Math.max(L / 50, 1e-9); courseLine.material.gapSize = courseLine.material.dashSize * 0.6;
      courseLine.computeLineDistances();
    }
  }
  /** Called by the view right after it renders: draw the ship over the chart (CHASE and BRIDGE). */
  function overlay() {
    if (!active || view === 'orbit' || !ship) return;
    ovCam.fov = camera.fov; ovCam.aspect = camera.aspect; ovCam.updateProjectionMatrix();
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(ov, ovCam);
    renderer.autoClear = ac;
  }

  // ---- effects: nacelle glow and warp streaks (IMAGINED), in the overlay -------------------------------
  const N_STREAKS = 900;
  const streakGeo = new THREE.BufferGeometry();
  const streakPos = new Float32Array(N_STREAKS * 6), streakSeed = new Float32Array(N_STREAKS * 3);
  for (let i = 0; i < N_STREAKS; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * Math.random() * 3;
    streakSeed.set([Math.cos(a) * r, Math.sin(a) * r, Math.random()], i * 3);
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  streaks.visible = false;
  ov.add(streaks);
  let streakPhase = 0;
  function effects(dt, v) {
    const beta = v / C_KM_S, w = beta >= 0.999 ? cToWarp(beta) : 0;
    const k = w > 0 ? Math.min(1, 0.35 + w / 14) : beta > 0.05 ? (beta / FULL_IMPULSE_C) * 0.18 : 0;
    ship?.setGlow(w > 0 ? Math.min(1, 0.3 + w / 10) : (beta / FULL_IMPULSE_C) * 0.2);
    const reg = regime(v);
    if (reg === 'warp' && lastRegime !== 'warp') log(`WARP ${w.toFixed(w >= 9.9 ? 2 : 1)}`);
    lastRegime = reg;
    streaks.visible = k > 0.01 && view !== 'orbit';
    if (!streaks.visible) return;
    const len = 0.1 + k * 2.6;
    streakPhase = (streakPhase + dt * (0.15 + k * 1.6)) % 1;
    for (let i = 0; i < N_STREAKS; i++) {
      const x = streakSeed[i * 3], y = streakSeed[i * 3 + 1], z = -12 + 13 * ((streakSeed[i * 3 + 2] + streakPhase) % 1);
      streakPos.set([x, y, z, x, y, z + len], i * 6);
    }
    streakGeo.attributes.position.needsUpdate = true;
    streaks.position.copy(ovCam.position);
    streaks.quaternion.copy(quat);
    streaks.scale.setScalar(20 * L_M);
    streakMat.opacity = Math.min(1, 0.3 + 0.8 * k);
  }

  // ---- HUD (the System View helm's LCARS read-outs and controls) ---------------------------------------
  const el = (t, cls, text) => { const e = document.createElement(t); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hud = el('div', 'helm-hud');
  hud.hidden = true;
  for (const t of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel']) hud.addEventListener(t, (e) => e.stopPropagation());
  const title = el('div', 'helm-title');
  title.append(el('span', '', `HELM · ${SHIP.name} ${SHIP.registry} · ${ctx.label ?? 'DEEP SPACE'}`), badge('imagined', 'The USS Fidelity is a fictional ship, an original design built in code. Positions are real catalogue positions; speeds, distances and relativity are computed; warp is fiction.'));
  const big = el('div', 'helm-speed mono'), sub = el('div', 'helm-sub mono');
  const row = (tier, tip) => { const r = el('div', 'helm-sub mono'); r.append(el('span', 'helm-wt', ''), badge(tier, tip)); return r; };
  const warpRow = row('imagined', 'Warp factor on the TNG scale (v = w^10/3 c to warp 9; Technical Manual figures above). Warp drive is fiction.');
  const relRow = row('computed', 'Lorentz factor γ = 1/√(1 − v²/c²) (special relativity). In a warp field the fiction has no time dilation.');
  const where = row('measured', 'The ship\'s position among real stars: catalogue positions from parallax (HYG, Gaia), in the IAU galactic frame, today\'s epoch.');
  const simRow = row('imagined', 'SIM: a viewing aid, not a ship ability. It plays N seconds of flight per real second so a crossing can be watched. Flight times and the ship\'s clocks are the real figures at this warp. The comma and full-stop keys change it.');
  const auto = el('div', 'helm-auto mono');
  const note = el('div', 'helm-sub mono');
  const readouts = el('div', 'helm-readouts');
  readouts.append(title, big, sub, warpRow, relRow, where, simRow, auto, note);
  const ctl = el('div', 'helm-controls');
  const btn = (text, tip, fn, cls = '') => { const b = el('button', `cam-btn ${cls}`.trim(), text); b.title = tip; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); b.blur(); }); return b; };
  const viewBtns = VIEWS.map(([v, label, tip]) => { const b = btn(label, tip, () => setView(v), 'cam-mode'); b.dataset.view = v; return b; });
  const modelBtns = [btn('IMPULSE / WARP', 'The throttle sets the speed, from 1 m/s to warp 9.99 (warp is fiction)', () => setModel('impulse'), 'cam-mode'),
    btn('REAL PHYSICS', 'Newtonian thrust at a fixed acceleration, relativistic velocities, no warp. Between the stars there is no gravity to speak of.', () => setModel('physics'), 'cam-mode')];
  modelBtns[0].dataset.model = 'impulse'; modelBtns[1].dataset.model = 'physics';
  const thrustBtn = btn('THRUST 1 G', 'REAL PHYSICS acceleration', () => { thrustG = THRUSTS[(THRUSTS.indexOf(thrustG) + 1) % THRUSTS.length]; syncHud(true); });
  const slider = Object.assign(el('input', 'cam-slider helm-throttle'), { type: 'range', min: 0, max: 1000, step: 1, title: 'Throttle (W / S): full stop → 1 m/s → full impulse (0.25 c) → warp 1 → warp 9.99' });
  let sliding = false;
  slider.addEventListener('pointerdown', (e) => { sliding = true; e.stopPropagation(); });
  slider.addEventListener('change', () => { sliding = false; });
  slider.addEventListener('input', () => { if (model === 'impulse') setThrottle(slider.value / 1000); });
  const throttleOut = el('div', 'cam-readout helm-throttle-out mono');
  const stopBtn = btn('FULL STOP', 'All stop [X]', () => fullStop(), 'helm-stop');
  const cruiseBtn = btn('CRUISE · AUTO', 'Autopilot cruise: AUTO is warp 9.9 between the stars', () => {
    cruiseSel = CRUISES[(CRUISES.findIndex(([c]) => c === cruiseSel) + 1) % CRUISES.length][0];
    if (course) { const km = course.distLy * LY_KM; course.cruise = cruiseFor(km); course.simAuto = autoSim(km / course.cruise.kmS); }
    syncHud(true);
  });
  const simBtn = btn('SIM · AUTO', 'Simulation speed-up (a viewing aid, IMAGINED): flight seconds per real second [, / .]', () => stepSim(simSel === SIM_SPEEDS.at(-1)[0] ? -99 : 1));
  const offBtn = btn('LEAVE HELM', 'Leave the ship here and give the view back [H]', () => leave());
  const help = el('div', 'helm-help', 'W/S THROTTLE · A/D ←/→ YAW · ↑/↓ PITCH · Q/E ROLL · DRAG STEER · X FULL STOP · C SET COURSE (SELECTION) · , . SIM · 1/2/3 VIEW · H LEAVE');
  const row1 = el('div', 'cam-row'), row2 = el('div', 'cam-row'), row3 = el('div', 'cam-row');
  row1.append(...viewBtns, simBtn);
  row2.append(stopBtn, slider, throttleOut);
  row3.append(...modelBtns, thrustBtn, cruiseBtn, offBtn);
  ctl.append(row1, row2, row3, help);
  hud.append(readouts, ctl);
  const flashEl = el('div', 'helm-flash');
  flashEl.hidden = true;
  let flashTimer = null;
  function flash(text) { flashEl.textContent = text; flashEl.hidden = false; clearTimeout(flashTimer); flashTimer = setTimeout(() => { flashEl.hidden = true; }, 2600); }
  const frameEl = el('div', 'helm-frame');
  frameEl.hidden = true;
  frameEl.append(el('div', 'hf-elbow hf-tl'), el('div', 'hf-elbow hf-tr'), el('div', 'hf-elbow hf-bl'), el('div', 'hf-elbow hf-br'), el('div', 'hf-reticle'), el('div', 'hf-caption', 'BRIDGE · MAIN VIEWER'));
  container.append(frameEl, hud, flashEl);

  let lastText = {};
  const put = (node, k, text) => { if (lastText[k] !== text) { node.textContent = text; lastText[k] = text; } };
  function syncHud(force = false) {
    if (force) lastText = {};
    if (!active) return;
    const v = currentKmS(), beta = v / C_KM_S, reg = regime(v), w = reg === 'warp' ? cToWarp(beta) : 0;
    put(big, 'big', fmtSpeed(v));
    const label = reg === 'warp' ? 'WARP' : reg === 'impulse' ? 'IMPULSE' : reg === 'manoeuvring' ? 'MANOEUVRING' : 'ALL STOP';
    put(sub, 'sub', `${label} · ${v < C_KM_S * 0.999 ? `${v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 3 : 1 })} KM/S · ` : ''}${beta < 1e-4 ? beta.toExponential(2) : beta.toFixed(beta < 1 ? 4 : 1)} c · ${fmtDistance((v * 3600 * 24 * 365.25))} PER YEAR`);
    put(warpRow.firstChild, 'warp', model === 'physics' && !course ? 'WARP · NOT IN REAL PHYSICS ' : `WARP FACTOR ${w ? w.toFixed(w >= 9.9 ? 3 : 2) : '—'} `);
    const g = reg === 'warp' ? 1 : gamma(Math.min(0.999999, beta));
    put(relRow.firstChild, 'rel', `γ ${g < 1.0001 ? g.toFixed(9) : g.toFixed(4)} · SHIP CLOCK ${reg === 'warp' ? 'AS EARTH (WARP FIELD)' : `${(100 / g).toFixed(g < 1.0001 ? 6 : 2)}% OF EARTH'S`} `);
    const dSol = len3(gal), near = ctx.nearest?.(gal);
    const lon = ((Math.atan2(gal[1], gal[0]) / DEG) + 360) % 360, lat = dSol > 0 ? Math.asin(gal[2] / dSol) / DEG : 0;
    put(where.firstChild, 'where', `${dSol > 0.01 ? `${fmtDistance(dSol * LY_KM)} FROM SOL · l ${lon.toFixed(1)}° b ${lat.toFixed(1)}°` : 'AT SOL'}${near ? ` · NEAREST ${near.name.toUpperCase()} ${fmtDistance(near.d * LY_KM)}` : ''} `);
    const N = simNow();
    put(simRow.firstChild, 'sim', `SIM ${simLabel(N)}${simSel === 'auto' ? ' (AUTO)' : ''} · 1 S HERE = ${N === 1 ? '1 S' : fmtDuration(N)} OF FLIGHT `);
    let a = '';
    if (course) a = `AUTOPILOT · ${course.name.toUpperCase()} · ${course.phase === 'turn' ? 'COMING ABOUT' : `${fmtDistance((course.distLy ?? 0) * LY_KM)} · FLIGHT ETA ${course.etaS != null ? fmtDuration(course.etaS) : '—'}${course.cruise.warp ? ` AT WARP ${course.cruise.warp}` : ''} · WATCH ${course.etaS != null ? fmtDuration(course.etaS / N) : '—'}`}`;
    else if (model === 'physics') a = `REAL PHYSICS · THRUST ${thrustG} G · NO GRAVITY BETWEEN THE STARS · X RETRO-BURN`;
    put(auto, 'auto', a);
    auto.hidden = !a;
    const en = ctx.epochNote?.() ?? '';
    put(note, 'note', en);
    note.hidden = !en;
    for (const b of viewBtns) b.classList.toggle('on', b.dataset.view === view);
    for (const b of modelBtns) b.classList.toggle('on', b.dataset.model === model);
    thrustBtn.hidden = model !== 'physics';
    put(thrustBtn, 'thrust', `THRUST ${thrustG.toLocaleString('en-US')} G`);
    put(cruiseBtn, 'cruise', `CRUISE · ${CRUISES.find(([c]) => c === cruiseSel)?.[1] ?? 'AUTO'}`);
    put(simBtn, 'simb', `SIM · ${simSel === 'auto' ? 'AUTO' : simLabel(simSel)}`);
    cruiseBtn.hidden = model !== 'impulse';
    slider.disabled = model !== 'impulse';
    const cmd = throttleToSpeed(throttle);
    if (!sliding) slider.value = String(Math.round(throttle * 1000));
    put(throttleOut, 'thr', model !== 'impulse' ? 'THROTTLE · OFF' : allStop || throttle === 0 ? 'THROTTLE · STOP' : cmd.warp ? `THROTTLE · WARP ${cmd.warp.toFixed(cmd.warp >= 9.9 ? 2 : 1)}` : `THROTTLE · ${fmtSpeed(cmd.kmS)}`);
    frameEl.hidden = view !== 'bridge';
    hud.classList.toggle('bridge', view === 'bridge');
  }

  return {
    get active() { return active; },
    engage, release, leave, frame, overlay, setCourse, fullStop, setThrottle, setView, setModel,
    setSim(k) { if (k === 'auto' || SIM_SPEEDS.some(([x]) => x === k)) { simSel = k; syncHud(true); } },
    setCruise(c) { if (CRUISES.some(([x]) => x === c)) { cruiseSel = c; syncHud(true); } },
    /** Turn the nose to a scene direction at once (browser checks; the autopilot turns smoothly). */
    pointAt(dir) { quat.copy(facing(new THREE.Vector3(...dir).normalize(), shipUp(v2).clone())); },
    get state() {
      const v = currentKmS();
      return { active, gal: gal.slice(), kmS: v, warp: regime(v) === 'warp' ? cToWarp(v / C_KM_S) : 0, model, view, sim: simNow(), simSel, cruise: cruiseSel,
        course: course ? { id: course.id, name: course.name, kind: course.kind, distLy: course.distLy ?? null, etaS: course.etaS ?? null, warp: course.cruise.warp, kmS: course.cruise.kmS } : null };
    },
    shipObject: shipRoot,
  };
}
