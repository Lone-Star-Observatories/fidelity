// HELM (#42): fly the USS Fidelity through the System View. The ship becomes the camera anchor:
// CHASE (third person, lagging behind), BRIDGE (first person with an LCARS frame) or ORBIT (free
// orbit around the ship). Two flight models: IMPULSE / WARP (the throttle sets a speed, from 1 m/s
// through full impulse at 0.25 c to warp 9.99; the warp drive is IMAGINED) and REAL PHYSICS
// (Newtonian thrust at a chosen acceleration with relativistic velocities, no warp, under the gravity
// of the system's star, planets and moons; src/astro/orbit.js). The autopilot turns, accelerates, cruises, decelerates and drops out a few radii from
// a body, then holds standard orbit (real period from GM) or keeps station near a craft.
//
// Precision: the ship's state is kept relative to the nearest body (`anchor`, handed over with
// hysteresis like FLY's), and SystemView puts its floating origin on the ship every frame, so the
// ship sits at the scene origin and the camera within a few kilometres of it: millimetres near the
// ISS, the same far out. The scene is in AU; the ship model is in metres, scaled down.
// Ship motion runs on the wall clock (real seconds); the simulation clock and its rate are untouched.
// In REAL PHYSICS the ship follows the clock's rate when it runs faster than real time (capped at
// ×10,000, sub-stepped), so planets and ship keep one time; the HUD says which rate it uses.
//
// SystemView hands over (ctx): scene, camera, controls, dom (pointer layer), container, rig,
// nodes() / model(), trueRadius(body) (AU), isStar(body), flyable(node), inspect(object),
// positionAt(id, jd, out) (AU, root coordinates), jd(), clockRate() (days per real second),
// exitOthers() (leave the surface view, site views and flights) and on(event, data) for main.js:
// 'select' (arrived at a body), 'flash' (into warp), 'change' (refresh panels), 'deepspace' (the ship
// has left the system, past its edge or at warp for another star: the Navigation View carries it on,
// see deepHelm.js), 'disengage' (the body to orbit afterwards). `arriveFrom` + `onLoad` take it back.

import * as THREE from 'three';
import { createShipModel, SHIP, BRIDGE_EYE } from './shipModel.js';
import { shipState, logEntry as logShip, systemEdgeAU } from './shipState.js';
import { badge } from '../../data/provenance.js';
import { gmOf, G_KM, gravAccel, verletStep, stateToElements, segmentHitsSphere, dominantBody } from '../../astro/orbit.js';
import { C_KM_S, AU_KM, gamma, regime, throttleToSpeed, speedToThrottle, autoCruise, cToWarp, warpToC, FULL_IMPULSE_C, fmtSpeed, fmtDistance, fmtDuration } from '../../astro/warp.js';

const M_PER_AU = AU_KM * 1000;
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
  let pendingArrival = null; // { fromDir (scene), manual, quat, view, cruise, thrustG } when the ship is handed down from the Navigation View
  const origin = new THREE.Vector3(); // ship position in root (scene) coordinates, AU
  // the ship's log, distance and clocks are shared with the galaxy-scale views (shipState.js)
  const S = shipState, log = S.log, visited = S.visited;
  const logEntry = (text) => { logShip(text); ctx.on?.('change'); };

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
  function activate() {
    build();
    active = true;
    S.frame = 'system';
    handedUp = false;
    rig.el.hidden = true;
    setView(view);
    hud.hidden = false;
    shipRoot.visible = true;
    keys.clear();
  }
  /** Take the helm near body `near` (default: the focus; Sol's overview starts at Earth). */
  function engage({ near = null } = {}) {
    build();
    ctx.exitOthers?.();
    const ns = nodes(), m = ctx.model();
    let id = near && ns[near] && ctx.flyable(ns[near]) ? near : null;
    if (!id) id = m?.isSol ? 'earth' : m?.starId;
    if (!ns[id]) return false;
    if (!active) { activate(); logEntry(`HELM ENGAGED · ${bodyOf(id).name.toUpperCase()}`); }
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
    if (model === 'physics') freeOrbit(); // REAL PHYSICS: a free circular orbit under gravity, not a held one
    camQ.copy(quat);
    if (view === 'orbit') camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
  }
  /** Leave the helm; `quiet` when another camera move (a survey, a site, LOOK AT) takes over at once. */
  function deactivate() {
    active = false;
    course = null; hold = null; speed = 0; throttle = 0; keys.clear(); drag = null; landed = null;
    shipRoot.visible = false;
    streaks.visible = false;
    hud.hidden = true; frameEl.hidden = true;
    rig.el.hidden = false;
    controls.enabled = rig.mode === 'orbit';
    camera.fov = rig.fov; camera.updateProjectionMatrix();
  }
  function disengage({ quiet = false } = {}) {
    if (!active) return;
    deactivate();
    S.frame = null;
    logEntry('HELM DISENGAGED');
    // hand the camera back: orbit the nearest body, from where the camera is now
    ctx.on?.('disengage', { quiet, id: nearestBody(), camWorld: v3.copy(origin).add(camera.position).clone() });
  }
  /**
   * A new system was loaded (or the ship is handed down into this one from the Navigation View): arrive from
   * where we came, at the system's edge. After a course for the star the autopilot finishes the approach; a
   * ship flown by hand keeps its heading at full impulse. Without a pending arrival, nothing happens.
   */
  function onLoad() {
    if (!active && !pendingArrival) return;
    const m = ctx.model(), ns = nodes();
    const star = m.starId;
    if (!ns[star]) { if (active) disengage(); pendingArrival = null; return; }
    const pa = pendingArrival;
    if (!active) activate();
    if (pa?.view) setView(pa.view);
    if (pa?.thrustG) thrustG = pa.thrustG;
    if (pa?.cruise) cruiseSel = pa.cruise;
    course = null; hold = null; speed = 0; vel.set(0, 0, 0); throttle = 0; model = 'impulse'; landed = null; prevRel.clear();
    const from = pa?.fromDir ? new THREE.Vector3(...pa.fromDir) : m.solDirection ? new THREE.Vector3(...m.solDirection) : new THREE.Vector3(0, 0.2, 1);
    const D = Math.min(60, Math.max(2, (m.survey?.[0]?.au ?? 10) * 0.45));
    anchor = star;
    local.copy(from).normalize().multiplyScalar(D);
    if (pa?.manual && pa.quat) quat.fromArray(pa.quat);
    else facing(v2.copy(local).negate(), new THREE.Vector3(0, 1, 0), quat);
    camQ.copy(quat);
    if (view === 'orbit') camera.position.copy(chaseOffset(v1)).applyQuaternion(camQ);
    logEntry(`DROPPED OUT OF WARP · ${m.name.toUpperCase()} SYSTEM`);
    S.visited.add(m.id);
    pendingArrival = null;
    if (pa?.manual) { // flown by hand: keep the heading, out of warp at full impulse
      speed = FULL_IMPULSE_C * C_KM_S; throttle = Math.min(speedToThrottle(speed), 0.4999); // just below the warp detent
      flash(`DROPPED OUT OF WARP · ${m.name.toUpperCase()}`);
    } else { // drop out of warp at the edge of the system and finish under autopilot
      speed = warpToC(5) * C_KM_S;
      setCourse(star, { quiet: true });
    }
    syncHud(true);
    ctx.on?.('change');
  }
  // ---- leaving the system: hand the ship to the Navigation View (#42) --------------------------------
  let handedUp = false;
  /** Beyond the system's edge (or after the warp-out for another star) main.js carries the ship into Navigation. */
  function handUp(star = null) {
    if (handedUp) return;
    handedUp = true;
    const m = ctx.model();
    const off = shipWorld(new THREE.Vector3()).sub(posOf(m.starId) ?? new THREE.Vector3());
    const v = model === 'physics' ? vel.clone() : fwd(quat, new THREE.Vector3()).multiplyScalar(speed);
    const data = { system: m.id, offsetAU: off.toArray(), quat: quat.toArray(), kmS: currentKmS(), vel: v.toArray(), model, thrustG, throttle, view, cruise: cruiseSel, star };
    logEntry(`LEFT THE ${m.name.toUpperCase()} SYSTEM · ${fmtDistance(off.length() * AU_KM)} FROM ${(bodyOf(m.starId)?.name ?? 'THE STAR').toUpperCase()}`);
    deactivate();
    S.frame = 'deep';
    ctx.on?.('deepspace', data);
  }
  /** At the system's edge and still heading out: hand over. */
  function checkDeparture() {
    if (!active || handedUp || hold || (course && !course.star)) return;
    const m = ctx.model(), sp = posOf(m.starId);
    if (!sp) return;
    const off = shipWorld(v3).sub(sp);
    if (off.length() < systemEdgeAU(m)) return;
    const v = model === 'physics' ? vel : fwd(quat, v1).multiplyScalar(speed);
    if (v.dot(off) > 0 || course?.star) handUp(course?.star ?? null);
  }
  /** main.js: the ship is about to be handed down into a system (call before the system loads, or then onLoad()). */
  function arriveFrom(info) { pendingArrival = info; }

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
      if (model === 'physics') freeOrbit(); // in REAL PHYSICS the orbit carries on under gravity
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
    if (model === 'physics' && hold) freeOrbit(); // REAL PHYSICS: X burns to match the body's velocity, then gravity has the ship
    if (!hold) flash(model === 'physics' ? `RETRO-BURN · MATCHING ${bodyOf(anchor)?.name.toUpperCase() ?? 'FRAME'}` : 'FULL STOP');
  }
  /** REAL PHYSICS: leave a held standard orbit for a free one with the same velocity (it carries on under gravity). */
  function freeOrbit() {
    if (!hold) return;
    if (hold.kind === 'orbit') vel.copy(hold.axis).cross(hold.offset).setLength(hold.kmS); else vel.set(0, 0, 0);
    anchor = hold.id; local.copy(hold.offset);
    hold = null; prevRel.clear();
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
    landed = null; prevRel.clear(); elements = null;
    if (mo === 'physics') {
      // from a standard orbit keep the orbital velocity (a real, stable orbit under gravity); else carry the speed along the nose
      if (hold?.kind === 'orbit') vel.copy(hold.axis).cross(hold.offset).setLength(hold.kmS);
      else vel.copy(fwd()).multiplyScalar(Math.min(speed, 0.999 * C_KM_S));
      if (hold) anchor = hold.id;
      throttle = 0;
    }
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
    let best = anchor, bestD = c.distanceTo(ns[anchor].pos) - radiusAU(anchor);
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
  /** IMPULSE / WARP: don't fly into the ground: keep 0.2% of a radius (13 km at Earth) above any body's surface. */
  function collide() {
    const ns = nodes(), c = shipWorld(v3);
    for (const id in ns) {
      const n = ns[id];
      if (!ctx.flyable(n)) continue;
      const r = ctx.trueRadius(n.body) * 1.002;
      const off = v1.copy(c).sub(n.pos), d = off.length();
      if (d < r && d > 0) { local.add(off.setLength(r - d)); shipWorld(c); }
    }
  }

  // ---- REAL PHYSICS: n-body gravity, the dominant body's frame, collisions (#42) -------------------
  // The ship moves in the frame of the dominant body (the smallest sphere of influence containing it).
  // Its acceleration there is every body's pull minus the frame body's own acceleration (the tidal
  // form), so the accelerating frame is handled exactly. Bodies are point masses (uniform spheres
  // inside) at the app's own positions for the clock time, interpolated across the frame; velocity
  // Verlet, sub-stepped to 1% of the local dynamical time and 10% of the time to the nearest surface.
  // When the frame body changes the velocity gains the old body's velocity minus the new one's (central
  // differences of the ephemeris), so the inertial velocity is continuous. A swept test against every
  // body stops the ship at a surface: IMPACT, or LANDED at ≤ 10 m/s.
  const RATE_CAP = 10000, MAX_SUB = 4000, LAND_KMS = 0.01;
  let rate = { k: 1, note: 'REAL TIME' };
  let landed = null; // { id, kind: 'impact' | 'landed', kmS }
  let elements = null; // the orbit about the dominant body, for the HUD
  let simDt = 0; // seconds of flight in the last REAL PHYSICS frame (the wall clock × the time rate)
  let massCache = null; // { model, n, list: [{ id, gm, R (km), parent }] }
  const prevRel = new Map(); // body id → km from the anchor at the end of the last physics frame
  let prevAnchor = null, lastJd = null;
  function massive() {
    const m = ctx.model(), ns = nodes(), count = Object.keys(ns).length;
    if (massCache?.model === m && massCache.n === count) return massCache.list;
    const list = [];
    for (const id in ns) {
      const b = ns[id].body;
      if (b.marker || !ctx.flyable(ns[id]) || b.kind === 'spacecraft' || b.kind === 'satellite') continue;
      const gm = gmOf(massKg(b));
      if (!(gm > 0)) continue;
      const parent = ctx.isStar(b) ? (id === m.starId ? null : m.starId) : ns[b.parent] ? b.parent : m.starId;
      list.push({ id, gm, R: b.radiusKm, parent: parent && ns[parent] && parent !== id ? parent : null });
    }
    for (const x of list) x.parentGm = list.find((y) => y.id === x.parent)?.gm ?? 0;
    massCache = { model: m, n: count, list };
    return list;
  }
  /** A body's velocity (km/s, scene axes) from the ephemeris: a central difference over ±1 minute. */
  function bodyVel(id, out = new THREE.Vector3()) {
    const jd = ctx.jd?.(), h = 1 / 1440;
    if (jd == null || !ctx.positionAt || !nodes()[id]) return out.set(0, 0, 0);
    const a = ctx.positionAt(id, jd + h, new THREE.Vector3()), b = ctx.positionAt(id, jd - h, new THREE.Vector3());
    return out.copy(a).sub(b).multiplyScalar(AU_KM / (2 * h * 86400));
  }
  /** Move the ship's frame to body `id`, keeping its position and its inertial velocity. */
  function reframe(id) {
    if (id === anchor || !posOf(id)) return;
    if (posOf(anchor)) { local.add(posOf(anchor)).sub(posOf(id)); vel.add(bodyVel(anchor, v1)).sub(bodyVel(id, v2)); }
    anchor = id;
  }
  function dominantNow() {
    const list = massive(), ns = nodes();
    const km = (id) => [ns[id].pos.x * AU_KM, ns[id].pos.y * AU_KM, ns[id].pos.z * AU_KM];
    const rows = list.map((x) => ({ id: x.id, pos: km(x.id), gm: x.gm, parentPos: x.parent ? km(x.parent) : null, parentGm: x.parentGm }));
    return dominantBody(shipWorld(new THREE.Vector3()).multiplyScalar(AU_KM).toArray(), rows, ctx.model().starId);
  }
  /** The time rate the ship uses: the clock's when it runs faster than real time (capped), else real time. */
  function timeRate() {
    const r = (ctx.clockRate?.() ?? 1 / 86400) * 86400;
    const fmtK = (k) => `×${Math.round(k).toLocaleString('en-US')}`;
    if (r >= 1.5) return r > RATE_CAP ? { k: RATE_CAP, note: `${fmtK(RATE_CAP)} · CAPPED (CLOCK ${fmtK(r)})` } : { k: r, note: `${fmtK(r)} WITH THE CLOCK` };
    return { k: 1, note: r > 0.5 ? 'REAL TIME' : 'REAL TIME · THE CLOCK IS HELD, SLOWER OR REVERSED' };
  }
  function touchDown(id, at, relKmS) {
    const b = bodyOf(id);
    local.copy(at).sub(posOf(id)).setLength(ctx.trueRadius(b) * 1.0005);
    anchor = id; vel.set(0, 0, 0); allStop = false; prevRel.clear();
    const kind = relKmS <= LAND_KMS ? 'landed' : 'impact';
    landed = { id, kind, kmS: relKmS };
    const text = `${kind === 'landed' ? 'LANDED' : 'IMPACT'} · ${b.name.toUpperCase()} · ${fmtSpeed(relKmS)}`;
    flash(text); logEntry(text);
    if (kind === 'landed') visited.add(id);
  }
  /** One frame of REAL PHYSICS over dt real seconds × the time rate: thrust, gravity, collisions. Returns km moved. */
  function physicsStep(dt) {
    rate = timeRate();
    simDt = dt * rate.k;
    const burning = keys.has('up') || keys.has('down');
    if (landed && !burning) { elements = null; return 0; } // resting on the surface until a burn lifts off
    landed = null;
    const ns = nodes();
    const dom = dominantNow();
    if (dom !== anchor) reframe(dom);
    const list = massive(), A = posOf(anchor), n = list.length;
    const jd = ctx.jd?.() ?? 0;
    // a jump of the clock (scrubbing, a new date) moves the bodies at once: don't sweep them through the ship
    const jumped = prevAnchor !== anchor || lastJd == null || Math.abs(jd - lastJd) > Math.abs((ctx.clockRate?.() ?? 0) * dt) * 3 + 1e-4;
    prevAnchor = anchor; lastJd = jd;
    const cur = new Float64Array(n * 3), prev = new Float64Array(n * 3);
    list.forEach((x, i) => {
      const p = ns[x.id].pos;
      cur[i * 3] = (p.x - A.x) * AU_KM; cur[i * 3 + 1] = (p.y - A.y) * AU_KM; cur[i * 3 + 2] = (p.z - A.z) * AU_KM;
      const q = !jumped && prevRel.get(x.id);
      prev.set(q || cur.subarray(i * 3, i * 3 + 3), i * 3);
    });
    // thrust along the nose (W) or tail (S); FULL STOP burns to match the dominant body's velocity
    if (burning || allStop) {
      const a = thrustG * 9.80665e-3; // km/s²
      const u = v1.copy(vel).multiplyScalar(gamma(Math.min(0.999999, vel.length() / C_KM_S))); // proper velocity
      if (keys.has('up')) u.addScaledVector(fwd(quat, v2), a * simDt);
      if (keys.has('down')) u.addScaledVector(fwd(quat, v2), -a * simDt);
      if (allStop) { const s = u.length(); if (s <= a * simDt) { u.set(0, 0, 0); allStop = false; } else u.addScaledVector(u.clone().normalize(), -a * simDt); }
      const un = u.length() / C_KM_S;
      vel.copy(u).multiplyScalar(1 / Math.sqrt(1 + un * un));
    }
    // sub-steps: 1% of the dynamical time about the frame body, 10% of the time to the nearest surface
    const anc = list.find((x) => x.id === anchor);
    const r0 = local.length() * AU_KM, sp = Math.max(vel.length(), 1e-6);
    const tDyn = anc ? Math.sqrt(r0 ** 3 / anc.gm) : Infinity;
    const h = Math.max(1e-3, Math.min(60, 0.01 * tDyn, (0.1 * Math.max(0.05, nearest?.km ?? r0)) / sp));
    let steps = Math.ceil(simDt / h);
    if (steps > MAX_SUB) { // too much flight for one frame: slow the ship's time and say so
      steps = MAX_SUB; simDt = MAX_SUB * h;
      rate = { k: simDt / Math.max(dt, 1e-9), note: `×${Math.round(simDt / Math.max(dt, 1e-9)).toLocaleString('en-US')} · CAPPED BY THE STEP SIZE` };
    }
    const hs = steps > 0 ? simDt / steps : 0;
    const bodies = list.map((x) => ({ pos: [0, 0, 0], gm: x.gm, radius: x.R }));
    const others = bodies.filter((_, i) => list[i].id !== anchor);
    let tPlaced = -1;
    const place = (t) => {
      if (t === tPlaced) return;
      tPlaced = t;
      const f = simDt > 0 ? t / simDt : 1;
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) bodies[i].pos[k] = prev[i * 3 + k] + (cur[i * 3 + k] - prev[i * 3 + k]) * f;
    };
    const g = [0, 0, 0], g0 = [0, 0, 0], zero = [0, 0, 0];
    const acc = (p, t) => {
      place(t);
      gravAccel(p, bodies, g);
      gravAccel(zero, others, g0); // the frame body's own acceleration
      return [g[0] - g0[0], g[1] - g0[1], g[2] - g0[2]];
    };
    const st = { pos: [local.x * AU_KM, local.y * AU_KM, local.z * AU_KM], vel: [vel.x, vel.y, vel.z] };
    const start = st.pos.slice();
    let t = 0, hit = null;
    for (let s = 0; s < steps && !hit; s++) {
      const p0 = st.pos.slice();
      verletStep(st, hs, acc, t, s > 0 ? st.acc : null);
      t += hs;
      place(t);
      for (let i = 0; i < n; i++) { // swept test against every massive body
        const f = segmentHitsSphere(p0, st.pos, bodies[i].pos, bodies[i].radius);
        if (f == null) continue;
        const bv = [0, 1, 2].map((k) => (cur[i * 3 + k] - prev[i * 3 + k]) / Math.max(simDt, 1e-9));
        hit = { id: list[i].id, at: p0.map((x, k) => x + (st.pos[k] - x) * f), rel: Math.hypot(st.vel[0] - bv[0], st.vel[1] - bv[1], st.vel[2] - bv[2]) };
        break;
      }
    }
    for (let i = 0; i < n; i++) prevRel.set(list[i].id, [cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]]);
    if (hit) touchDown(hit.id, new THREE.Vector3(...hit.at).multiplyScalar(1 / AU_KM).add(A), hit.rel);
    else {
      local.set(st.pos[0], st.pos[1], st.pos[2]).multiplyScalar(1 / AU_KM);
      vel.set(st.vel[0], st.vel[1], st.vel[2]);
      if (vel.length() > 0.999999 * C_KM_S) vel.setLength(0.999999 * C_KM_S);
      // craft and other bodies without a known mass have no pull, but the ship still stops at them
      const c = shipWorld(new THREE.Vector3());
      for (const id in ns) {
        const nd = ns[id];
        if (nd.body.marker || !ctx.flyable(nd) || list.some((x) => x.id === id)) continue;
        if (c.distanceTo(nd.pos) < ctx.trueRadius(nd.body)) { touchDown(id, c, vel.length()); break; }
      }
    }
    const gmA = list.find((x) => x.id === anchor)?.gm;
    elements = gmA && !landed ? { id: anchor, R: bodyOf(anchor).radiusKm, ...stateToElements([local.x * AU_KM, local.y * AU_KM, local.z * AU_KM], [vel.x, vel.y, vel.z], gmA) } : null;
    return Math.hypot(st.pos[0] - start[0], st.pos[1] - start[1], st.pos[2] - start[2]);
  }

  function update(now = performance.now()) {
    const dt = Math.min(1, Math.max(0, (now - last) / 1000)); // ramps are exponential, so even a 1 fps frame stays stable and on time
    last = now;
    if (!active) return null;
    const ns = nodes();
    if (!ns[anchor]) { anchor = ctx.model()?.starId; if (!ns[anchor]) return null; }
    updateAnchor(!hold && !course?.star && !(model === 'physics' && !course)); // REAL PHYSICS picks its frame by gravity
    steer(dt);
    let moved = 0, flightS = dt;

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
      if (course.phase === 'warp' && now - course.t0 > 3200) { // out of the system: the Navigation View carries on to the star
        logEntry(`WARP 9.9 · ${course.label} · ${course.star.distLy.toFixed(2)} LY`);
        handUp(course.star);
        return null;
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
      moved = physicsStep(dt); // thrust, gravity, the dominant body's frame and collisions
      flightS = simDt;
    } else {
      const vCmd = allStop ? 0 : throttleToSpeed(throttle).kmS;
      speed = rampTo(speed, vCmd, dt); warpGap(vCmd);
      if (allStop && speed === 0) allStop = false;
      local.addScaledVector(fwd(), (speed * dt) / AU_KM);
      moved = speed * dt;
    }
    if (model !== 'physics' || hold || course) collide();
    checkDeparture();
    if (!active) return null; // handed over to the Navigation View

    // the ship's clocks: proper time runs slow at relativistic impulse; at warp it does not (fiction: no dilation in a warp field)
    const v = currentKmS();
    S.earthS += flightS;
    S.shipS += regime(v) === 'warp' ? flightS : flightS / gamma(Math.min(0.999999, v / C_KM_S));
    S.travelledKm += moved;

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
    if (reg === 'warp' && lastRegime !== 'warp') logEntry(`WARP ${w.toFixed(w >= 9.9 ? 2 : 1)}`);
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
  // REAL PHYSICS: the orbit about the dominant body and the time rate the ship follows (COMPUTED)
  const orbitRow = el('div', 'helm-sub mono');
  const orbitBadge = badge('computed', 'Osculating orbit about the dominant body from the ship\'s position and velocity relative to it (src/astro/orbit.js: two-body elements; the n-body integration includes every star, planet and moon with a known mass, so the orbit drifts as they pull). Altitudes are above the mean radius.');
  orbitRow.append(el('span', 'helm-wt', ''), orbitBadge);
  orbitRow.hidden = true;
  const readouts = el('div', 'helm-readouts');
  readouts.append(title, big, sub, warpRow, relRow, where, orbitRow, auto);
  const ctl = el('div', 'helm-controls');
  const btn = (text, tip, fn, cls = '') => { const b = el('button', `cam-btn ${cls}`.trim(), text); b.title = tip; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); b.blur(); }); return b; };
  const viewBtns = VIEWS.map(([v, label, tip]) => { const b = btn(label, tip, () => setView(v), 'cam-mode'); b.dataset.view = v; return b; });
  const modelBtns = [btn('IMPULSE / WARP', 'Arcade flight: the throttle sets the speed, from 1 m/s to warp 9.99 (warp is fiction)', () => setModel('impulse'), 'cam-mode'),
    btn('REAL PHYSICS', 'Newtonian thrust at a fixed acceleration, relativistic velocities, no warp, under the gravity of the star, planets and moons (n-body, velocity Verlet). The ship follows the clock\'s rate up to ×10,000.', () => setModel('physics'), 'cam-mode')];
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

  /** The osculating orbit in words: periapsis and apoapsis altitude, eccentricity and period, or ESCAPE. */
  function orbitText() {
    const el0 = elements;
    if (!el0) return '';
    const name = bodyOf(el0.id)?.name.toUpperCase() ?? '—';
    const alt = (r) => fmtDistance(Math.max(0, r - el0.R));
    if (!el0.bound) return `ESCAPE · ${name} · E ${el0.e.toFixed(3)} · PERIAPSIS ${el0.periapsis < el0.R ? 'BELOW SURFACE' : alt(el0.periapsis)} · V∞ ${fmtSpeed(Math.sqrt(Math.max(0, 2 * el0.energy)))}`;
    const crash = el0.periapsis < el0.R ? ' · PERIAPSIS BELOW SURFACE' : '';
    return `ORBIT · ${name} · PE ${alt(el0.periapsis)} · AP ${alt(el0.apoapsis)} · E ${el0.e < 0.001 ? el0.e.toExponential(1) : el0.e.toFixed(3)} · PERIOD ${fmtDuration(el0.periodS)}${crash}`;
  }
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
    else if (model === 'physics') a = landed ? `${landed.kind === 'landed' ? 'LANDED ON' : 'IMPACT ·'} ${bodyOf(landed.id)?.name.toUpperCase()} · W BURNS TO LIFT OFF` : `REAL PHYSICS · THRUST ${thrustG} G · TIME ${rate.note} · X MATCH ${bodyOf(anchor)?.name.toUpperCase() ?? 'FRAME'}`;
    put(auto, 'auto', a);
    auto.hidden = !a;
    const orb = model === 'physics' && !hold && !course ? orbitText() : '';
    put(orbitRow.firstChild, 'orbit', orb ? `${orb} ` : '');
    orbitRow.hidden = !orb;
    for (const b of viewBtns) b.classList.toggle('on', b.dataset.view === view);
    for (const b of modelBtns) b.classList.toggle('on', b.dataset.model === model);
    thrustBtn.hidden = model !== 'physics';
    put(thrustBtn, 'thrust', `THRUST ${thrustG.toLocaleString('en-US')} G`);
    put(cruiseBtn, 'cruise', `CRUISE · ${CRUISES.find(([c]) => c === cruiseSel)[1]}`);
    cruiseBtn.hidden = model !== 'impulse';
    slider.disabled = model !== 'impulse';
    const cmd = throttleToSpeed(throttle);
    if (!sliding) slider.value = String(Math.round(throttle * 1000));
    put(throttleOut, 'thr', model !== 'impulse' ? 'THROTTLE · OFF' : allStop || throttle === 0 ? 'THROTTLE · STOP' : cmd.warp ? `THROTTLE · WARP ${cmd.warp.toFixed(cmd.warp >= 9.9 ? 2 : 1)}` : `THROTTLE · ${fmtSpeed(cmd.kmS)}`);
    frameEl.hidden = view !== 'bridge';
    hud.classList.toggle('bridge', view === 'bridge');
  }

  const api = {
    get active() { return active; },
    update, engage, disengage, onLoad, arriveFrom, get pendingArrival() { return pendingArrival; }, setCourse, warpOut, fullStop, setThrottle, setView, setModel,
    setCruise(c) { if (CRUISES.some(([x]) => x === c)) { cruiseSel = c; syncHud(true); } },
    select(id) { selected = id; ctx.prepare?.(id); ctx.on?.('change'); },
    /** Turn the nose to a scene direction at once (browser checks; steering is the keys, drag or autopilot). */
    pointAt(dir) { quat.copy(facing(new THREE.Vector3(...dir).normalize(), shipUp(v2).clone())); camQ.copy(quat); },
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
        cruise: cruiseSel, log: log.slice(), travelledKm: S.travelledKm, earthS: S.earthS, shipS: S.shipS, visited: [...visited], landed, rate: rate.note, orbit: elements && { body: elements.id, bound: elements.bound, e: elements.e, periapsisKm: elements.periapsis, apoapsisKm: elements.apoapsis, periodS: elements.periodS, radiusKm: elements.R },
      };
    },
    /** The ship as an object for postcards and checks. */
    shipObject: shipRoot,
    /** Positions (AU, scene axes) for browser checks: the ship, its anchor body and the star. */
    debug: () => ({ ship: origin.toArray(), anchor: posOf(anchor)?.toArray(), star: posOf(ctx.model()?.starId)?.toArray(), nose: fwd(quat, new THREE.Vector3()).toArray(), local: local.toArray(), vel: vel.toArray(), anchorId: anchor }),
  };
  if (typeof window !== 'undefined') window.__fidelityHelm = api; // for browser checks and the console, like the camera rigs
  return api;
}
