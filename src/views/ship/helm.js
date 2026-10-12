// HELM (#42): fly the USS Fidelity through the System View. The ship becomes the camera anchor:
// CHASE (third person, lagging behind), BRIDGE (first person with an LCARS frame) or ORBIT (free
// orbit around the ship). Two flight models: IMPULSE / WARP (the throttle sets a speed, from 1 m/s
// through full impulse at 0.25 c to warp 9.99; the warp drive is IMAGINED) and REAL PHYSICS
// (Newtonian thrust at a chosen acceleration with relativistic velocities, no warp; gravity is not
// modelled). The autopilot turns, accelerates, cruises, decelerates and drops out a few radii from
// a body, then holds standard orbit (real period from GM) or keeps station near a craft.
//
// Precision: the ship's state is kept relative to the nearest body (`anchor`, handed over with
// hysteresis like FLY's), and SystemView puts its floating origin on the ship every frame, so the
// ship sits at the scene origin and the camera within a few kilometres of it: millimetres near the
// ISS, the same far out. The scene is in AU; the ship model is in metres, scaled down.
// Ship motion runs on the wall clock (real seconds); the simulation clock and its rate are untouched.
//
// SystemView hands over (ctx): scene, camera, controls, dom (pointer layer), container, rig,
// nodes() / model(), trueRadius(body) (AU), isStar(body), flyable(node), inspect(object),
// exitOthers() (leave the surface view, site views and flights) and on(event, data) for main.js:
// 'select' (arrived at a body), 'flash' (into warp), 'change' (refresh panels), 'interstellar'
// (the ship has gone to warp for another star), 'disengage' (the body to orbit afterwards).

import * as THREE from 'three';
import { createShipModel, SHIP, BRIDGE_EYE } from './shipModel.js';
import { badge } from '../../data/provenance.js';
import { C_KM_S, AU_KM, gamma, regime, throttleToSpeed, speedToThrottle, autoCruise, cToWarp, warpToC, FULL_IMPULSE_C, fmtSpeed, fmtDistance, fmtDuration } from '../../astro/warp.js';

const M_PER_AU = AU_KM * 1000;
const G_KM = 6.674e-20; // km³ / (kg s²)
const SUN_KG = 1.9885e30;
const DEG = Math.PI / 180;
const L_AU = SHIP.lengthM / M_PER_AU;
export const VIEWS = [['chase', 'CHASE', 'Third person: the camera follows behind the ship [1]'], ['bridge', 'BRIDGE', 'First person from the bridge [2]'], ['orbit', 'ORBIT', 'Free orbit around the ship: drag to turn, wheel to zoom [3]']];
const CRUISES = [['auto', 'AUTO'], ['impulse', 'FULL IMPULSE'], [2, 'WARP 2'], [5, 'WARP 5'], [8, 'WARP 8'], [9.9, 'WARP 9.9']];
const THRUSTS = [1, 10, 100, 1000]; // REAL PHYSICS accelerations, g

/** Arrival distance (km) for a body: a few radii for worlds and stars, a couple of kilometres from a craft. */
export function standoffKm(b) {
  if (!b) return 1000;
  if (b.kind === 'spacecraft' || b.kind === 'satellite') return Math.max(0.6, b.radiusKm * 30);
  if (b.starLike || b.kind === 'star') return b.radiusKm * 5;
  if (b.radiusKm < 50) return Math.max(b.radiusKm * 6, 40); // small asteroids and comets
  return b.radiusKm * 3;
}
const massKg = (b) => b?.massKg ?? (b?.massSun ? b.massSun * SUN_KG : null);
/** Hold kind at a body: standard orbit around a world or star with a known mass, station-keeping otherwise. */
const holdKind = (b) => (massKg(b) && b.kind !== 'spacecraft' && b.kind !== 'satellite' && b.radiusKm >= 50 ? 'orbit' : 'station');

export function createHelm(ctx) {
  const { scene, camera, controls, dom, container, rig } = ctx;
  let active = false;
  let ship = null; // the model, built on first engage
  const shipRoot = new THREE.Group(); // at the scene origin (the ship is the floating origin), scaled metres → AU
  shipRoot.scale.setScalar(1 / M_PER_AU);
  shipRoot.visible = false;
  scene.add(shipRoot);

  // ---- ship state ---------------------------------------------------------------------------------
  let anchor = null; // body id the ship's position is kept relative to
  const local = new THREE.Vector3(); // AU from the anchor
  const quat = new THREE.Quaternion(); // ship orientation (scene axes; root only translates)
  let speed = 0; // km/s along the nose (IMPULSE / WARP model)
  const vel = new THREE.Vector3(); // km/s, anchor frame (REAL PHYSICS model)
  let model = 'impulse'; // 'impulse' | 'physics'
  let thrustG = 1;
  let throttle = 0;
  let allStop = false;
  let view = 'chase';
  let chaseZoom = 1;
  let course = null; // { id, phase: 'turn' | 'travel', cruise: { kmS, warp }, label } or { star, dir, phase: 'turn' | 'warp', t0 }
  let hold = null; // { id, kind: 'orbit' | 'station', offset (AU), axis, omega (rad/s), kmS }
  let selected = null; // the body picked while at the helm (SET COURSE target in the panel)
  let cruiseSel = 'auto';
  let pendingArrival = null; // { fromDir, star } after an interstellar jump
  const origin = new THREE.Vector3(); // ship position in root (scene) coordinates, AU
  // the ship's log
  const log = [];
  let travelledKm = 0, earthS = 0, shipS = 0;
  const logEntry = (text) => { log.push({ at: new Date(), text }); if (log.length > 60) log.shift(); ctx.on?.('change'); };

  const nodes = () => ctx.nodes();
  const bodyOf = (id) => nodes()[id]?.body;
  const posOf = (id) => nodes()[id]?.pos;
  const radiusAU = (id) => ctx.trueRadius(bodyOf(id));
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const fwd = (q = quat, v = v1) => v.set(0, 0, -1).applyQuaternion(q);
  /** Orientation whose nose (−Z) points along `dir`, roll set by `up`. */
  function facing(dir, up, out = new THREE.Quaternion()) {
    m4.lookAt(v3.set(0, 0, 0), dir, Math.abs(dir.clone().normalize().dot(up)) > 0.999 ? new THREE.Vector3(1, 0, 0) : up);
    return out.setFromRotationMatrix(m4);
  }
  const shipUp = (v = v2) => v.set(0, 1, 0).applyQuaternion(quat);
  const shipWorld = (out = new THREE.Vector3()) => out.copy(posOf(anchor) ?? v3.set(0, 0, 0)).add(local);

  // ---- engage / disengage -------------------------------------------------------------------------
  function build() {
    if (ship) return;
    ship = createShipModel();
    shipRoot.add(ship.group);
    ctx.inspect?.(ship.group);
  }
  /** Take the helm near body `near` (default: the focus; Sol's overview starts at Earth). */
  function engage({ near = null } = {}) {
    build();
    ctx.exitOthers?.();
    const ns = nodes(), m = ctx.model();
    let id = near && ns[near] && ctx.flyable(ns[near]) ? near : null;
    if (!id) id = m?.isSol ? 'earth' : m?.starId;
    if (!ns[id]) return false;
    if (!active) {
      active = true;
      rig.el.hidden = true;
      setView(view);
      hud.hidden = false;
      shipRoot.visible = true;
      keys.clear();
      logEntry(`HELM ENGAGED · ${bodyOf(id).name.toUpperCase()}`);
    }
    course = null; vel.set(0, 0, 0); speed = 0; throttle = 0; allStop = false;
    placeNear(id);
    syncHud(true);
    ctx.on?.('change');
    return true;
  }
  /** Park at a body's standoff on its day side, facing it, holding orbit or station. */
  function placeNear(id) {
    const b = bodyOf(id), m = ctx.model();
    const star = posOf(m.starId) ?? v3.set(0, 0, 0);
    const toStar = v1.copy(star).sub(posOf(id));
    if (toStar.lengthSq() < 1e-30) toStar.set(0, 0.3, 1); // the star itself: from above the plane
    toStar.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 28 * DEG); // a little off the sub-solar line so the terminator shows
    toStar.y += 0.18; toStar.normalize();
    anchor = id;
    local.copy(toStar).multiplyScalar(standoffKm(b) / AU_KM);
    facing(v2.copy(local).negate(), new THREE.Vector3(0, 1, 0), quat);
    startHold(id, true);
    camQ.copy(quat);
    if (view === 'orbit') camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
  }
  /** Leave the helm; `quiet` when another camera move (a survey, a site, LOOK AT) takes over at once. */
  function disengage({ quiet = false } = {}) {
    if (!active) return;
    active = false;
    course = null; hold = null; speed = 0; throttle = 0; keys.clear(); drag = null;
    shipRoot.visible = false;
    streaks.visible = false;
    hud.hidden = true; frameEl.hidden = true;
    rig.el.hidden = false;
    controls.enabled = rig.mode === 'orbit';
    camera.fov = rig.fov; camera.updateProjectionMatrix();
    logEntry('HELM DISENGAGED');
    // hand the camera back: orbit the nearest body, from where the camera is now
    ctx.on?.('disengage', { quiet, id: nearestBody(), camWorld: v3.copy(origin).add(camera.position).clone() });
  }
  /** A new system was loaded: after an interstellar jump arrive from where we came; otherwise start near its star. */
  function onLoad() {
    if (!active) return;
    const m = ctx.model(), ns = nodes();
    course = null; hold = null; speed = 0; vel.set(0, 0, 0); throttle = 0;
    const star = m.starId;
    if (!ns[star]) { disengage(); return; }
    const from = pendingArrival?.fromDir ?? (m.solDirection ? new THREE.Vector3(...m.solDirection) : new THREE.Vector3(0, 0.2, 1));
    const D = Math.min(60, Math.max(2, (m.survey?.[0]?.au ?? 10) * 0.45));
    anchor = star;
    local.copy(from).normalize().multiplyScalar(D);
    facing(v2.copy(local).negate(), new THREE.Vector3(0, 1, 0), quat);
    camQ.copy(quat);
    if (view === 'orbit') camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
    // drop out of warp at the edge of the system and finish under autopilot
    speed = warpToC(5) * C_KM_S;
    logEntry(`DROPPED OUT OF WARP · ${m.name.toUpperCase()} SYSTEM`);
    pendingArrival = null;
    setCourse(star, { quiet: true });
  }

  // ---- the autopilot -------------------------------------------------------------------------------
  function cruiseFor(distKm) {
    if (cruiseSel === 'impulse') return { kmS: FULL_IMPULSE_C * C_KM_S, warp: 0 };
    if (typeof cruiseSel === 'number') return { kmS: warpToC(cruiseSel) * C_KM_S, warp: cruiseSel };
    return autoCruise(distKm);
  }
  /** Where an autopilot order starts the helm: the focused body, but Earth rather than the Sun in Sol's overview. */
  const startNear = () => { const f = ctx.focusId?.(); return f === ctx.model()?.starId ? null : f; };
  /** SET COURSE for body `id` in this system (engages the helm if needed). */
  function setCourse(id, { quiet = false } = {}) {
    if (!nodes()[id]) return false;
    if (!active) engage({ near: startNear() });
    if (id === hold?.id && !course) { flash(`HOLDING AT ${bodyOf(id).name.toUpperCase()}`); return true; }
    model = 'impulse';
    hold = null; allStop = false;
    const dist = distanceKm(id);
    course = { id, phase: 'turn', cruise: cruiseFor(dist), label: bodyOf(id).name.toUpperCase(), startKm: dist };
    selected = id;
    ctx.prepare?.(id);
    if (!quiet) flash(`COURSE LAID IN · ${course.label}`);
    logEntry(`COURSE SET · ${course.label} · ${fmtDistance(dist)}`);
    return true;
  }
  /** Go to warp towards another star (direction in scene axes); main.js loads the system when the ship has gone. */
  function warpOut(star, dir) {
    if (!active) engage({ near: startNear() });
    model = 'impulse'; hold = null; allStop = false;
    course = { star, dir: dir ? new THREE.Vector3(...dir).normalize() : fwd(quat, new THREE.Vector3()), phase: 'turn', label: star.name.toUpperCase() };
    flash(`COURSE LAID IN · ${course.label} · ${star.distLy.toFixed(2)} LY`);
    logEntry(`COURSE SET · ${course.label} SYSTEM · ${star.distLy.toFixed(2)} LY`);
  }
  /** Ship-to-body distance (km) to the arrival point's body centre. */
  function distanceKm(id) {
    const p = posOf(id);
    if (!p) return null;
    return shipWorld(v3).distanceTo(p) * AU_KM;
  }
  function startHold(id, silent = false) {
    const b = bodyOf(id), p = posOf(id);
    if (!b || !p) return;
    // re-anchor on the body we hold at, so the hold co-moves exactly
    local.copy(shipWorld(v3)).sub(p);
    anchor = id;
    const kind = holdKind(b);
    const r = local.length();
    hold = { id, kind, offset: local.clone(), omega: 0, kmS: 0 };
    if (kind === 'orbit') {
      const pole = v1.set(0, 1, 0);
      const tilt = nodes()[id].tilt;
      if (tilt) tilt.getWorldQuaternion(q1), pole.applyQuaternion(q1);
      const rh = v2.copy(local).normalize();
      const axis = pole.clone().sub(rh.clone().multiplyScalar(pole.dot(rh)));
      if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0).cross(rh);
      hold.axis = axis.normalize();
      const rKm = r * AU_KM;
      hold.omega = Math.sqrt((G_KM * massKg(b)) / rKm ** 3);
      hold.kmS = hold.omega * rKm;
      hold.periodS = (2 * Math.PI) / hold.omega;
    }
    speed = 0; vel.set(0, 0, 0); throttle = 0;
    if (!silent) logEntry(`${kind === 'orbit' ? 'STANDARD ORBIT' : 'STATION-KEEPING'} · ${b.name.toUpperCase()}`);
  }
  function arrive(id) {
    course = null;
    startHold(id);
    flash(hold.kind === 'orbit' ? `STANDARD ORBIT · ${bodyOf(id).name.toUpperCase()}` : `STATION-KEEPING · ${bodyOf(id).name.toUpperCase()}`);
    visited.add(id);
    ctx.on?.('select', id);
  }
  const visited = new Set();

  // ---- input ---------------------------------------------------------------------------------------
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
      case 'KeyH': disengage(); break;
      case 'KeyC': if (selected && nodes()[selected]) setCourse(selected); else return; break;
      case 'Escape': if (course) { course = null; flash('AUTOPILOT OFF'); } else return; break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { shift = e.shiftKey; const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());
  /** Manual input takes over from the autopilot and breaks orbit. */
  function manual(kind) {
    if (course && !course.star) { course = null; flash('AUTOPILOT OFF · MANUAL CONTROL'); }
    if (hold && (kind === 'up' || kind === 'down' || kind === 'steer' || kind?.startsWith('yaw') || kind?.startsWith('pitch') || kind?.startsWith('roll'))) {
      if (hold.kind === 'orbit' && model === 'impulse' && kind === 'up') { speed = hold.kmS; throttle = speedToThrottle(hold.kmS); } // keep the orbital speed as you leave
      hold = null;
    }
    if (kind === 'up' || kind === 'down') allStop = false;
  }
  // drag steers in CHASE and BRIDGE (OrbitControls own ORBIT)
  dom.addEventListener('pointerdown', (e) => {
    if (!live() || view === 'orbit') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  });
  dom.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId || !live() || view === 'orbit') return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 4) return;
    manual('steer');
    const k = ((camera.fov * DEG) / (dom.clientHeight || 600)) * 0.9;
    quat.multiply(q1.setFromAxisAngle(v1.set(0, 1, 0), -dx * k)).multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), -dy * k)).normalize();
  });
  const endDrag = (e) => { if (drag?.id === e.pointerId) drag = null; };
  dom.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointercancel', endDrag);
  dom.addEventListener('wheel', (e) => {
    if (!live() || view === 'orbit') return;
    e.preventDefault();
    if (view === 'chase') chaseZoom = Math.min(400, Math.max(0.45, chaseZoom * Math.exp(e.deltaY * 0.0015)));
    else { camera.fov = Math.min(100, Math.max(5, camera.fov * Math.exp(e.deltaY * 0.001))); camera.updateProjectionMatrix(); }
  }, { passive: false });

  function fullStop() {
    course = null;
    throttle = 0; allStop = true;
    if (!hold) flash('FULL STOP');
  }
  function setThrottle(t) {
    manual('up');
    throttle = Math.min(1, Math.max(0, t));
    allStop = false;
  }
  function setView(v) {
    if (!VIEWS.some(([x]) => x === v)) return;
    if (v === 'orbit' && view !== 'orbit') camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
    view = v;
    controls.enabled = active && v === 'orbit';
    if (v !== 'bridge') { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    ship?.setBridge(v === 'bridge');
    syncHud(true);
  }
  function setModel(mo) {
    if (mo === model) return;
    model = mo;
    course = null;
    if (mo === 'physics') { vel.copy(fwd()).multiplyScalar(Math.min(speed, 0.999 * C_KM_S)); throttle = 0; }
    else { speed = Math.min(vel.length(), FULL_IMPULSE_C * C_KM_S); throttle = speedToThrottle(speed); if (speed > 0) quat.copy(facing(vel.clone().normalize(), shipUp(v2).clone())); }
    hold = null;
    flash(mo === 'physics' ? `REAL PHYSICS · THRUST ${thrustG} G · NO WARP` : 'IMPULSE AND WARP');
    syncHud(true);
  }

  // ---- per frame ----------------------------------------------------------------------------------
  let last = performance.now();
  const camQ = new THREE.Quaternion();
  const chaseOffset = (v) => v.set(0, 0.3 * L_AU, 1.6 * L_AU).multiplyScalar(chaseZoom);
  let lastRegime = 'stopped';
  const TAU_UP = 0.35, TAU_DOWN = 0.3, TAU_STOP = 0.14;

  function rampTo(v, target, dt) {
    if (target > v) {
      const lin = v + (target - v) * (1 - Math.exp(-dt / 0.6));
      return Math.min(target, Math.max(v * Math.exp(dt / TAU_UP), lin));
    }
    const tau = allStop ? TAU_STOP : TAU_DOWN;
    const out = Math.max(target, Math.min(v * Math.exp(-dt / tau), v - (v - target) * (1 - Math.exp(-dt / 0.5))));
    return out < 1e-4 && target === 0 ? 0 : out;
  }
  /** The warp field forms or collapses: no speeds between full impulse and warp 1 (IMAGINED). */
  function warpGap(vCmd) {
    const lo = FULL_IMPULSE_C * C_KM_S * 1.0001, hi = C_KM_S * 0.999;
    if (speed > lo && speed < hi) {
      if (vCmd >= hi) { speed = C_KM_S; ctx.on?.('flash'); }
      else speed = FULL_IMPULSE_C * C_KM_S;
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
    if (keys.has('up') || keys.has('down')) {
      if (model === 'impulse') {
        const d = (shift ? 0.3 : 0.1) * dt * (keys.has('up') ? 1 : -1);
        throttle = Math.min(1, Math.max(0, throttle + d));
      }
    }
  }
  /** Turn towards `dir` at the ship's turn rate (faster under autopilot). Returns the remaining angle. */
  function turnTo(dir, up, dt, rateDeg = 90) {
    const target = facing(dir, up, q1);
    const ang = quat.angleTo(target);
    quat.rotateTowards(target, rateDeg * DEG * dt);
    return ang;
  }

  function nearestBody() {
    const ns = nodes(), c = shipWorld(v3);
    let best = anchor, bestD = Infinity;
    for (const id in ns) {
      const n = ns[id];
      if (!ctx.flyable(n)) continue;
      const d = c.distanceTo(n.pos) - ctx.trueRadius(n.body);
      if (d < bestD) { best = id; bestD = d; }
    }
    return best;
  }
  /** Ride on the nearest body; hand over when another is clearly nearer (like FLY, #39). */
  function updateAnchor(handover = true) {
    const ns = nodes();
    if (!ns[anchor]) { anchor = ctx.model().starId; local.set(0, 0, 0); }
    const c = shipWorld(v3);
    let best = anchor, bestD = c.distanceTo(ns[anchor].pos) - groundAU(anchor, local); // altitude above the terrain where there is a DEM (#80)
    const anchorD = bestD;
    for (const id in ns) {
      const n = ns[id];
      if (id === anchor || !ctx.flyable(n)) continue;
      const d = c.distanceTo(n.pos) - ctx.trueRadius(n.body);
      if (d < bestD) { best = id; bestD = d; }
    }
    if (handover && best !== anchor && bestD < 0.7 * anchorD) {
      local.add(ns[anchor].pos).sub(ns[best].pos);
      anchor = best;
    }
    nearest = { id: best === anchor ? anchor : best, km: Math.max(0, Math.min(bestD, anchorD)) * AU_KM };
  }
  let nearest = null;
  /** Don't fly into the ground: keep 0.2% of a radius (13 km at Earth) above the anchor's surface: the terrain where it has a DEM (#80). */
  const groundAU = (id, off) => (off.lengthSq() > 0 ? ctx.groundRadius?.(id, off) : null) ?? radiusAU(id);
  function collide() {
    const r = groundAU(anchor, local) * 1.002;
    const d = local.length();
    if (d < r && d > 0) {
      local.setLength(r);
      if (model === 'physics') { const n = v1.copy(local).normalize(), vr = vel.dot(n); if (vr < 0) vel.addScaledVector(n, -vr); }
    }
  }

  function update(now = performance.now()) {
    const dt = Math.min(1, Math.max(0, (now - last) / 1000)); // ramps are exponential, so even a 1 fps frame stays stable and on time
    last = now;
    if (!active) return null;
    const ns = nodes();
    if (!ns[anchor]) { anchor = ctx.model()?.starId; if (!ns[anchor]) return null; }
    updateAnchor(!hold && !course?.star);
    steer(dt);
    let moved = 0;

    if (hold && ns[hold.id]) {
      // standard orbit: the offset turns about the orbit axis at the real angular rate; station-keeping holds it
      if (hold.kind === 'orbit') hold.offset.applyAxisAngle(hold.axis, hold.omega * dt);
      local.copy(hold.offset);
      anchor = hold.id;
      // in orbit the ship keeps its attitude (no thrusters needed, as in a real orbit); at a station it faces the craft
      if (hold.kind === 'station') turnTo(v2.copy(hold.offset).normalize().negate(), shipUp(v3).clone(), dt, 20);
      moved = hold.kmS * dt;
    } else if (course?.star) {
      // interstellar: turn to the star, go to warp 9.9, and hand over to main.js after a few seconds
      const ang = turnTo(course.dir, shipUp(v3).clone(), dt, 60);
      if (course.phase === 'turn' && ang < 4 * DEG) { course.phase = 'warp'; course.t0 = now; ctx.on?.('flash'); }
      const vCmd = course.phase === 'warp' ? warpToC(9.9) * C_KM_S : 0;
      speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
      local.addScaledVector(fwd(), (speed * dt) / AU_KM);
      moved = speed * dt;
      if (course.phase === 'warp' && now - course.t0 > 3200) {
        const st = course.star;
        pendingArrival = { fromDir: course.dir.clone().negate(), star: st };
        logEntry(`WARP 9.9 · ${course.label} · ${st.distLy.toFixed(2)} LY`);
        travelledKm += st.distLy * 9460730472580.8;
        course = null;
        ctx.on?.('interstellar', st);
      }
    } else if (course && ns[course.id]) {
      const T = ns[course.id].pos, S = shipWorld(v2.set(0, 0, 0)).clone();
      const away = v1.copy(S).sub(T);
      if (away.lengthSq() === 0) away.set(0, 0, 1);
      const A = away.normalize().multiplyScalar(standoffKm(bodyOf(course.id)) / AU_KM).add(T); // arrival point, between us and it
      const toA = A.clone().sub(S), dKm = toA.length() * AU_KM;
      const dir = toA.clone().normalize();
      const ang = turnTo(dir, shipUp(v3).clone(), dt, course.phase === 'turn' ? 60 : 120);
      if (course.phase === 'turn' && ang < 5 * DEG) course.phase = 'travel';
      let vCmd = 0;
      if (course.phase === 'travel') {
        vCmd = Math.min(course.cruise.kmS, dKm / 0.9 + 0.3); // slow down in proportion to what is left
        if (vCmd > FULL_IMPULSE_C * C_KM_S && vCmd < C_KM_S * 0.999) vCmd = FULL_IMPULSE_C * C_KM_S;
      }
      speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
      const step = Math.min(speed * dt, dKm);
      if (course.phase === 'travel' && dKm > 0) local.addScaledVector(dir, step / AU_KM);
      moved = step;
      course.distKm = dKm - step;
      course.etaS = speed > 0 ? course.distKm / Math.max(speed, 1e-9) : null;
      if (course.phase === 'travel' && (dKm - step < Math.max(0.03, standoffKm(bodyOf(course.id)) * 1e-4))) arrive(course.id);
    } else if (model === 'physics') {
      // Newtonian thrust along the nose (W) or tail (S); FULL STOP burns against the velocity
      const a = thrustG * 9.80665e-3; // km/s²
      const u = v1.copy(vel).multiplyScalar(gamma(Math.min(0.999999, vel.length() / C_KM_S))); // proper velocity
      if (keys.has('up')) u.addScaledVector(fwd(quat, v2), a * dt);
      if (keys.has('down')) u.addScaledVector(fwd(quat, v2), -a * dt);
      if (allStop) {
        const s = u.length();
        if (s <= a * dt) { u.set(0, 0, 0); allStop = false; } else u.addScaledVector(u.clone().normalize(), -a * dt);
      }
      const un = u.length() / C_KM_S;
      vel.copy(u).multiplyScalar(1 / Math.sqrt(1 + un * un));
      local.addScaledVector(vel, dt / AU_KM);
      moved = vel.length() * dt;
    } else {
      const vCmd = allStop ? 0 : throttleToSpeed(throttle).kmS;
      speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
      if (allStop && speed === 0) allStop = false;
      local.addScaledVector(fwd(), (speed * dt) / AU_KM);
      moved = speed * dt;
    }
    collide();

    // the ship's clocks: proper time runs slow at relativistic impulse; at warp it does not (fiction: no dilation in a warp field)
    const v = currentKmS();
    earthS += dt;
    shipS += regime(v) === 'warp' ? dt : dt / gamma(Math.min(0.999999, v / C_KM_S));
    travelledKm += moved;

    origin.copy(shipWorld(v3));
    placeCamera(dt);
    effects(dt, v);
    if (now - hudT > 120) { hudT = now; syncHud(); }
    return origin;
  }
  let hudT = 0;
  const currentKmS = () => (hold ? hold.kmS : model === 'physics' ? vel.length() : speed);

  function placeCamera(dt) {
    // the ship is at the scene origin; the camera within a few kilometres of it
    camQ.slerp(quat, 1 - Math.exp(-dt * (view === 'chase' ? 4 : 30)));
    if (view === 'chase') {
      camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
      const look = v2.set(0, 0.06 * L_AU, -0.9 * L_AU).multiplyScalar(Math.min(chaseZoom, 4)).applyQuaternion(camQ);
      m4.lookAt(camera.position, look, v3.set(0, 1, 0).applyQuaternion(camQ));
      camera.quaternion.setFromRotationMatrix(m4);
    } else if (view === 'bridge') {
      camera.position.copy(BRIDGE_EYE).multiplyScalar(1 / M_PER_AU).applyQuaternion(quat);
      camera.quaternion.copy(quat);
    } else {
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      controls.minDistance = 0.6 * L_AU;
      controls.maxDistance = 5e4 * L_AU;
      controls.update();
    }
    camera.up.set(0, 1, 0);
    shipRoot.quaternion.copy(quat);
  }

  // ---- effects: nacelle glow and warp streaks (IMAGINED) ------------------------------------------
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
  streaks.renderOrder = 5;
  scene.add(streaks);
  let streakPhase = 0;
  function effects(dt, v) {
    const beta = v / C_KM_S;
    const w = beta >= 0.999 ? cToWarp(beta) : 0;
    const k = w > 0 ? Math.min(1, 0.35 + w / 14) : beta > 0.05 ? (beta / FULL_IMPULSE_C) * 0.18 : 0;
    ship?.setGlow(w > 0 ? Math.min(1, 0.3 + w / 10) : beta / FULL_IMPULSE_C * 0.2);
    const reg = regime(v);
    if (reg === 'warp' && lastRegime !== 'warp') logEntry(`WARP ${w.toFixed(1)}`);
    lastRegime = reg;
    streaks.visible = k > 0.01 && view !== 'orbit';
    if (!streaks.visible) return;
    // a tunnel of streaks around the line of flight that rides with the camera (scene units scaled to the ship):
    // long and fast at high warp, short and sparse at high impulse
    const S = 20 * L_AU, len = 0.1 + k * 2.6;
    streakPhase = (streakPhase + dt * (0.15 + k * 1.6)) % 1;
    for (let i = 0; i < N_STREAKS; i++) {
      const x = streakSeed[i * 3], y = streakSeed[i * 3 + 1];
      const z = -12 + 13 * ((streakSeed[i * 3 + 2] + streakPhase) % 1); // 12 S ahead → 1 S behind
      streakPos.set([x, y, z, x, y, z + len], i * 6);
    }
    streakGeo.attributes.position.needsUpdate = true;
    streaks.position.copy(camera.position);
    streaks.quaternion.copy(quat);
    streaks.scale.setScalar(S);
    streakMat.opacity = Math.min(1, 0.3 + 0.8 * k);
  }

  // ---- HUD (LCARS read-outs and controls over the viewport) ---------------------------------------
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const hud = el('div', 'helm-hud');
  hud.hidden = true;
  for (const t of ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel']) hud.addEventListener(t, (e) => e.stopPropagation());
  const title = el('div', 'helm-title');
  title.append(el('span', '', `HELM · ${SHIP.name} ${SHIP.registry}`), badge('imagined', 'The USS Fidelity is a fictional ship, an original design built in code (src/views/ship/shipModel.js). Speeds, distances and relativity read-outs are computed; warp is fiction.'));
  const big = el('div', 'helm-speed mono');
  const sub = el('div', 'helm-sub mono');
  const warpRow = el('div', 'helm-sub mono');
  const warpBadge = badge('imagined', 'Warp factor on the TNG scale (v = w^10/3 c to warp 9; Technical Manual figures above). Warp drive is fiction.');
  const relRow = el('div', 'helm-sub mono');
  const relBadge = badge('computed', 'Lorentz factor γ = 1/√(1 − v²/c²): how much slower the ship\'s clock runs than Earth\'s at this speed (special relativity). In a warp field the fiction has no time dilation.');
  const where = el('div', 'helm-sub mono');
  const auto = el('div', 'helm-auto mono');
  const readouts = el('div', 'helm-readouts');
  readouts.append(title, big, sub, warpRow, relRow, where, auto);
  const ctl = el('div', 'helm-controls');
  const btn = (text, tip, fn, cls = '') => { const b = el('button', `cam-btn ${cls}`.trim(), text); b.title = tip; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); b.blur(); }); return b; };
  const viewBtns = VIEWS.map(([v, label, tip]) => { const b = btn(label, tip, () => setView(v), 'cam-mode'); b.dataset.view = v; return b; });
  const modelBtns = [btn('IMPULSE / WARP', 'Arcade flight: the throttle sets the speed, from 1 m/s to warp 9.99 (warp is fiction)', () => setModel('impulse'), 'cam-mode'),
    btn('REAL PHYSICS', 'Newtonian thrust at a fixed acceleration, relativistic velocities, no warp. Gravity is not modelled.', () => setModel('physics'), 'cam-mode')];
  modelBtns[0].dataset.model = 'impulse'; modelBtns[1].dataset.model = 'physics';
  const thrustBtn = btn('THRUST 1 G', 'REAL PHYSICS acceleration: 1 g is comfortable for a crew; 1000 g only for a probe', () => { thrustG = THRUSTS[(THRUSTS.indexOf(thrustG) + 1) % THRUSTS.length]; syncHud(true); });
  const slider = Object.assign(el('input', 'cam-slider helm-throttle'), { type: 'range', min: 0, max: 1000, step: 1, title: 'Throttle (W / S or R / F): full stop → 1 m/s → full impulse (0.25 c) → warp 1 → warp 9.99' });
  let sliding = false;
  slider.addEventListener('pointerdown', (e) => { sliding = true; e.stopPropagation(); });
  slider.addEventListener('change', () => { sliding = false; });
  slider.addEventListener('input', () => { if (model === 'impulse') setThrottle(slider.value / 1000); });
  const throttleOut = el('div', 'cam-readout helm-throttle-out mono');
  const stopBtn = btn('FULL STOP', 'All stop [X]', () => fullStop(), 'helm-stop');
  const cruiseBtn = btn('CRUISE · AUTO', 'Autopilot cruise speed: AUTO picks impulse or the warp factor that gets there in ~20 s', () => {
    const i = CRUISES.findIndex(([c]) => c === cruiseSel);
    cruiseSel = CRUISES[(i + 1) % CRUISES.length][0];
    if (course && !course.star) course.cruise = cruiseFor(distanceKm(course.id) ?? 0);
    syncHud(true);
  });
  const offBtn = btn('LEAVE HELM', 'Hand the camera back and orbit the nearest body [H]', () => disengage());
  const help = el('div', 'helm-help', 'W/S THROTTLE · A/D ←/→ YAW · ↑/↓ PITCH · Q/E ROLL · DRAG STEER · X FULL STOP · C SET COURSE · 1/2/3 VIEW · H LEAVE · SHIFT FASTER');
  const row1 = el('div', 'cam-row'), row2 = el('div', 'cam-row'), row3 = el('div', 'cam-row');
  row1.append(...viewBtns);
  row2.append(stopBtn, slider, throttleOut);
  row3.append(...modelBtns, thrustBtn, cruiseBtn, offBtn);
  ctl.append(row1, row2, row3, help);
  hud.append(readouts, ctl);
  const flashEl = el('div', 'helm-flash');
  flashEl.hidden = true;
  let flashTimer = null;
  function flash(text) {
    flashEl.textContent = text; flashEl.hidden = false;
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { flashEl.hidden = true; }, 2600);
  }
  // the bridge's LCARS frame: elbows, reticle and a heading caption
  const frameEl = el('div', 'helm-frame');
  frameEl.hidden = true;
  frameEl.append(el('div', 'hf-elbow hf-tl'), el('div', 'hf-elbow hf-tr'), el('div', 'hf-elbow hf-bl'), el('div', 'hf-elbow hf-br'), el('div', 'hf-reticle'), el('div', 'hf-caption', 'BRIDGE · MAIN VIEWER'));
  container.append(frameEl, hud, flashEl);

  let lastText = {};
  const put = (node, key, text) => { if (lastText[key] !== text) { node.textContent = text; lastText[key] = text; } };
  function syncHud(force = false) {
    if (force) lastText = {};
    if (!active) return;
    const v = currentKmS(), beta = v / C_KM_S, reg = regime(v);
    const w = reg === 'warp' ? cToWarp(beta) : 0;
    put(big, 'big', `${fmtSpeed(v)}`);
    const label = hold ? (hold.kind === 'orbit' ? 'STANDARD ORBIT' : 'STATION-KEEPING') : reg === 'warp' ? 'WARP' : reg === 'impulse' ? 'IMPULSE' : reg === 'manoeuvring' ? 'MANOEUVRING' : 'ALL STOP';
    put(sub, 'sub', `${label} · ${v < C_KM_S * 0.999 ? `${v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 3 : 1 })} KM/S · ` : ''}${beta < 1e-4 ? beta.toExponential(2) : beta.toFixed(beta < 1 ? 4 : 1)} c`);
    if (!warpRow.contains(warpBadge)) warpRow.append(el('span', 'helm-wt', ''), warpBadge);
    put(warpRow.firstChild, 'warp', model === 'physics' ? 'WARP · NOT IN REAL PHYSICS ' : `WARP FACTOR ${w ? w.toFixed(w >= 9.9 ? 3 : 2) : '—'} `);
    if (!relRow.contains(relBadge)) relRow.append(el('span', 'helm-wt', ''), relBadge);
    const g = reg === 'warp' ? 1 : gamma(Math.min(0.999999, beta));
    put(relRow.firstChild, 'rel', `γ ${g < 1.0001 ? g.toFixed(9) : g.toFixed(4)} · SHIP CLOCK ${reg === 'warp' ? 'AS EARTH (WARP FIELD)' : `${(100 / g).toFixed(g < 1.0001 ? 6 : 2)}% OF EARTH'S`} `);
    const nb = nearest && bodyOf(nearest.id);
    const anchorName = bodyOf(anchor)?.name?.toUpperCase() ?? '—';
    put(where, 'where', nb ? `NEAREST ${nb.name.toUpperCase()} · ${fmtDistance(nearest.km)} ABOVE · FRAME ${anchorName}` : `FRAME ${anchorName}`);
    let a = '';
    if (course?.star) a = `COURSE ${course.label} · ${course.phase === 'turn' ? 'COMING ABOUT' : 'WARP 9.9 · LEAVING THE SYSTEM'}`;
    else if (course) a = `AUTOPILOT · ${course.label} · ${course.phase === 'turn' ? 'COMING ABOUT' : `${fmtDistance(course.distKm ?? 0)} · ETA ${course.etaS != null ? fmtDuration(course.etaS) : '—'}`}`;
    else if (hold) a = hold.kind === 'orbit' ? `ORBITING ${bodyOf(hold.id)?.name.toUpperCase()} · ${fmtDistance(hold.offset.length() * AU_KM)} FROM CENTRE · PERIOD ${fmtDuration(hold.periodS)}` : `HOLDING ${fmtDistance(hold.offset.length() * AU_KM)} FROM ${bodyOf(hold.id)?.name.toUpperCase()}`;
    else if (model === 'physics') a = `REAL PHYSICS · THRUST ${thrustG} G · W/S BURN · X RETRO-BURN TO STOP`;
    put(auto, 'auto', a);
    auto.hidden = !a;
    for (const b of viewBtns) b.classList.toggle('on', b.dataset.view === view);
    for (const b of modelBtns) b.classList.toggle('on', b.dataset.model === model);
    thrustBtn.hidden = model !== 'physics';
    put(thrustBtn, 'thrust', `THRUST ${thrustG.toLocaleString('en-US')} G`);
    put(cruiseBtn, 'cruise', `CRUISE · ${CRUISES.find(([c]) => c === cruiseSel)[1]}`);
    cruiseBtn.hidden = model !== 'impulse';
    slider.disabled = model !== 'impulse';
    const cmd = throttleToSpeed(throttle);
    if (!sliding) slider.value = String(Math.round(throttle * 1000));
    put(throttleOut, 'thr', model !== 'impulse' ? 'THROTTLE · OFF' : allStop || throttle === 0 ? 'THROTTLE · STOP' : cmd.warp ? `THROTTLE · WARP ${cmd.warp.toFixed(1)}` : `THROTTLE · ${fmtSpeed(cmd.kmS)}`);
    frameEl.hidden = view !== 'bridge';
    hud.classList.toggle('bridge', view === 'bridge');
  }

  const api = {
    get active() { return active; },
    update, engage, disengage, onLoad, setCourse, warpOut, fullStop, setThrottle, setView, setModel,
    setCruise(c) { if (CRUISES.some(([x]) => x === c)) { cruiseSel = c; syncHud(true); } },
    select(id) { selected = id; ctx.prepare?.(id); ctx.on?.('change'); },
    get selected() { return selected; },
    get anchor() { return anchor; },
    distanceKm,
    get view() { return view; },
    /** Read-outs for the panel and the voice context. */
    get state() {
      const v = currentKmS(), beta = v / C_KM_S;
      return {
        active, kmS: v, beta, regime: hold ? 'hold' : regime(v), warp: regime(v) === 'warp' ? cToWarp(beta) : 0, model, view,
        anchor, nearest, course: course ? { id: course.id ?? null, star: course.star ?? null, label: course.label, phase: course.phase, distKm: course.distKm ?? null, etaS: course.etaS ?? null, cruise: course.cruise ?? null } : null,
        hold: hold ? { id: hold.id, kind: hold.kind, periodS: hold.periodS ?? null, kmS: hold.kmS } : null,
        cruise: cruiseSel, log: log.slice(), travelledKm, earthS, shipS, visited: [...visited],
      };
    },
    /** The ship as an object for postcards and checks. */
    shipObject: shipRoot,
    /** Positions (AU, scene axes) for browser checks: the ship, its anchor body and the star. */
    debug: () => ({ ship: origin.toArray(), anchor: posOf(anchor)?.toArray(), star: posOf(ctx.model()?.starId)?.toArray(), nose: fwd(quat, new THREE.Vector3()).toArray() }),
  };
  if (typeof window !== 'undefined') window.__fidelityHelm = api; // for browser checks and the console, like the camera rigs
  return api;
}
