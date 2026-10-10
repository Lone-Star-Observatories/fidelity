// System View — the star system around the ship. Item 1 renders Sector 001 (Sol):
// the Sun, eight planets and Pluto at their real positions for the ship's clock.
//
// Scale strategy: the scene is in AU with a floating origin — the focused body sits
// at (0,0,0) and the whole system is offset around it — plus a logarithmic depth
// buffer, so true-scale Earth (4e-5 AU) and Neptune's orbit (30 AU) coexist.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { heliocentric, orbitPath } from '../../astro/kepler.js';
import { AU_KM, SUN, PLANETS, byId } from '../../data/sol.js';
import { createHorizonsEphemeris } from '../../data/horizons.js';
import { settings } from '../../settings.js';
import { planetTexture, glowTexture, ringTexture } from './textures.js';

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;
const ORBIT_COLORS = { mercury: 0x9999ff, venus: 0xffcc99, earth: 0x99ccff, mars: 0xcc6666,
  jupiter: 0xff9966, saturn: 0xffcc66, uranus: 0x99cccc, neptune: 0x9999ff, pluto: 0xcc99cc };

// J2000 ecliptic [x, y, z] → three.js (ecliptic plane = XZ, ecliptic north = +Y).
const toScene = ([x, y, z], v = new THREE.Vector3()) => v.set(x, z, -y);

function poleVector([raDeg, decDeg]) {
  const a = raDeg * DEG, d = decDeg * DEG;
  const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
  // equatorial → ecliptic (rotate about x by the obliquity)
  return toScene([x, y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY), -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY)]).normalize();
}

/** Display radius in AU. Enhanced mode compresses sizes so every world is visible. */
const trueRadius = (b) => b.radiusKm / AU_KM;
const enhancedRadius = (b) => (b.kind === 'star' ? 0.07 : 0.022 * Math.pow(b.radiusKm / 6371, 0.42));
export const enhancement = (b) => enhancedRadius(b) / trueRadius(b);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createSystemView(container, { clock, onSelect, onEphemerisStatus, onFrame }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-7, 1e6);
  camera.position.set(0, 1.6, 3.2);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.zoomSpeed = 1.4;
  controls.maxDistance = 3000;

  // Everything orbiting lives in `root`, which is shifted so the focus is at origin.
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06)); // rendering aid: keep night sides faintly visible
  const sunLight = new THREE.PointLight(0xfff4e0, 2.4, 0, 0);
  root.add(sunLight);

  // Decorative backdrop (provenance: IMAGINED) until Navigation View brings real stars.
  {
    const n = 4000, pos = new Float32Array(n * 3), r = 2e5;
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: false, color: 0x8a90b8, transparent: true, opacity: 0.7 }));
    stars.renderOrder = -1;
    scene.add(stars);
  }

  // --- bodies -------------------------------------------------------------------
  const nodes = {}; // id → { body, group, tilt, mesh, label, orbit, pos }
  const pickables = [];

  function makeLabel(body) {
    const el = document.createElement('button');
    el.className = `body-label kind-${body.kind.replace(' ', '-')}`;
    el.textContent = body.name.toUpperCase();
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(body.id); });
    const obj = new CSS2DObject(el);
    obj.center.set(-0.15, 1.2);
    return obj;
  }

  function addBody(body) {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleVector(body.pole));
    group.add(tilt);
    let mesh;
    if (body.kind === 'star') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: body.color }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.setScalar(9);
      mesh.add(glow);
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ map: planetTexture(body), roughness: 0.95, metalness: 0 }));
      if (body.rings) {
        const inner = body.rings.innerKm / body.radiusKm, outer = body.rings.outerKm / body.radiusKm;
        const geo = new THREE.RingGeometry(inner, outer, 128, 1);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - inner) / (outer - inner), 0.5);
        const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        tilt.add(ring); // scaled with the planet via `tilt.scale`
      }
    }
    mesh.userData.id = body.id;
    tilt.add(mesh);
    // A fixed-size pip keeps true-scale worlds findable when they are sub-pixel.
    const pipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    group.add(new THREE.Points(pipGeo, new THREE.PointsMaterial({
      size: body.kind === 'star' ? 6 : 4, sizeAttenuation: false, color: body.color ?? ORBIT_COLORS[body.id] })));
    pickables.push(mesh);
    const label = makeLabel(body);
    group.add(label);
    root.add(group);
    nodes[body.id] = { body, group, tilt, mesh, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null };
  }

  addBody(SUN);
  PLANETS.forEach(addBody);

  function updateOrbit(node, jd) {
    if (node.orbit && Math.abs(jd - node.orbitJd) < 365) return;
    const pts = orbitPath(node.body.id, jd, 512).map((p) => toScene(p));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (node.orbit) { node.orbit.geometry.dispose(); node.orbit.geometry = geo; }
    else {
      node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ORBIT_COLORS[node.body.id], transparent: true, opacity: 0.45 }));
      root.add(node.orbit);
    }
    node.orbitJd = jd;
  }

  // --- ephemeris ----------------------------------------------------------------
  let horizonsStatus = { pending: 0, failed: false };
  const horizons = createHorizonsEphemeris(byId, (s) => { horizonsStatus = s; onEphemerisStatus?.(s); });
  // Per-body: which source produced the position last frame ('horizons' | 'kepler').
  const sourceOf = {};

  function positionOf(id, jd) {
    if (id === 'sun') return [0, 0, 0];
    if (settings.get('ephemeris') === 'horizons') {
      const p = horizons.positionOf(id, jd);
      if (p) { sourceOf[id] = 'horizons'; return p; }
    }
    sourceOf[id] = 'kepler';
    return heliocentric(id, jd);
  }

  // --- focus & camera flight ------------------------------------------------------
  let focusId = 'sun';
  let flight = null; // { from: Vector3 (scene), t0, dur, d0 }
  const focusPos = new THREE.Vector3();
  let scaleMix = settings.get('scale') === 'true' ? 1 : 0;

  const displayRadius = (b) => {
    const t = trueRadius(b), e = enhancedRadius(b);
    return e * Math.pow(t / e, scaleMix); // log-interpolate between modes
  };
  const viewDistance = (id) => displayRadius(byId[id]) * (id === 'sun' ? 14 : 7);

  let overviewAU = null; // set when framing the whole system rather than one body
  let framedRadius = null; // focus radius the camera distance was last fitted to

  function flyTo(id, { overview = null } = {}) {
    if (!nodes[id]) return;
    flight = { from: focusPos.clone(), t0: performance.now(), dur: 1600, d0: camera.position.length() };
    focusId = id;
    overviewAU = overview;
    framedRadius = null;
  }

  // --- picking ---------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  let down = null;
  labels.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  labels.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) onSelect(hit.object.userData.id);
  });

  // --- frame loop --------------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const sunScreen = new THREE.Vector3();
  let running = false;

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    clock.tick(now);
    const jd = clock.jd;

    const targetMix = settings.get('scale') === 'true' ? 1 : 0;
    scaleMix += (targetMix - scaleMix) * 0.08;
    if (Math.abs(targetMix - scaleMix) < 1e-3) scaleMix = targetMix;
    const showLabels = settings.get('labels'), showOrbits = settings.get('orbits');

    for (const id in nodes) {
      const n = nodes[id];
      toScene(positionOf(id, jd), n.pos);
      n.group.position.copy(n.pos);
      const r = displayRadius(n.body);
      n.tilt.scale.setScalar(r);
      n.mesh.rotation.y = ((jd * 24) / n.body.rotationHours) * Math.PI * 2 % (Math.PI * 2);
      n.label.visible = showLabels || id === focusId;
      n.label.element.classList.toggle('focused', id === focusId);
      if (id !== 'sun') {
        updateOrbit(n, jd);
        n.orbit.visible = showOrbits;
      }
    }

    // Camera flight: slide the floating origin from the old focus to the new one
    // while easing the camera's distance (log-space, so 30 AU → 1e-4 AU feels smooth).
    const target = nodes[focusId].pos;
    if (flight) {
      const t = Math.min(1, (now - flight.t0) / flight.dur), k = ease(t);
      focusPos.lerpVectors(flight.from, target, k);
      const d1 = overviewAU ?? viewDistance(focusId); // live, so a scale switch mid-flight still lands well
      const d = Math.exp(Math.log(flight.d0) + (Math.log(d1) - Math.log(flight.d0)) * k);
      camera.position.setLength(d);
      if (t >= 1) { flight = null; framedRadius = displayRadius(nodes[focusId].body); }
    } else {
      focusPos.copy(target);
      // Switching ENHANCED ⇄ TRUE while framing a body: keep it the same size on screen.
      if (overviewAU == null && framedRadius) {
        const r = displayRadius(nodes[focusId].body);
        camera.position.multiplyScalar(r / framedRadius);
        framedRadius = r;
      }
    }
    root.position.copy(focusPos).negate();
    controls.minDistance = displayRadius(nodes[focusId].body) * 1.3;
    controls.update();

    renderer.render(scene, camera);
    labels.render(scene, camera);

    // Sector-001 edge beacon: where is Sol relative to the viewport?
    tmp.copy(nodes.sun.pos).sub(focusPos);
    sunScreen.copy(tmp).project(camera);
    const behind = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
    onFrame?.({
      jd, focusId, scaleMix, horizonsStatus,
      sources: { ...sourceOf },
      sun: { x: sunScreen.x, y: sunScreen.y, behind, visible: !behind && Math.abs(sunScreen.x) <= 1 && Math.abs(sunScreen.y) <= 1 },
      cameraDistanceAU: camera.position.length(),
    });
  }

  return {
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    focus(id, opts) { flyTo(id, opts); },
    overview(au) { flyTo('sun', { overview: au }); },
    get focusId() { return focusId; },
    positionOf: (id) => positionOf(id, clock.jd),
    displayRadius: (id) => displayRadius(byId[id]),
  };
}
