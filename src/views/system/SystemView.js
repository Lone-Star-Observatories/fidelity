// System View — the star system around the ship: Sol (Sector 001) with real planet
// positions, or any other star with its known planets (see src/data/systems.js).
//
// Scale strategy: the scene is in AU with a floating origin — the focused body sits
// at (0,0,0) and the whole system is offset around it — plus a logarithmic depth
// buffer, so true-scale Earth (4e-5 AU) and Neptune's orbit (30 AU) coexist.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { heliocentric, orbitPath, positionAt, ellipse } from '../../astro/kepler.js';
import { relativeSky, hierarchy, place, besselianYear } from '../../astro/binary.js';
import { eqToEcl, frameToScene, teffFromBV, blackbodyRGB } from '../../astro/frames.js';
import { AU_KM } from '../../data/sol.js';
import { createHorizonsEphemeris } from '../../data/horizons.js';
import { settings } from '../../settings.js';
import { planetTexture, glowTexture, ringTexture } from './textures.js';
import { planetMaterial, cloudMaterial, starMaterial, applySkin, loadTexture } from './materials.js';
import { bodyAxes } from '../../astro/rotation.js';
import { moonOffsetKm } from '../../astro/moons.js';
import { smallBodyPosition, smallBodyOrbit } from '../../astro/smallbodies.js';

const DEG = Math.PI / 180;
const ORBIT_COLORS = { mercury: 0x9999ff, venus: 0xffcc99, earth: 0x99ccff, mars: 0xcc6666,
  jupiter: 0xff9966, saturn: 0xffcc66, uranus: 0x99cccc, neptune: 0x9999ff, pluto: 0xcc99cc };
const EXO_ORBIT_COLORS = [0x9999ff, 0xffcc99, 0x99ccff, 0xcc6666, 0xff9966, 0xffcc66, 0x99cccc, 0xcc99cc];

// J2000 ecliptic [x, y, z] → three.js (ecliptic plane = XZ, ecliptic north = +Y).
const toScene = ([x, y, z], v = new THREE.Vector3()) => v.set(x, z, -y);

function poleVector([raDeg, decDeg]) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return new THREE.Vector3(...frameToScene(eqToEcl([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]))).normalize();
}

/** Display radius in AU. Enhanced mode enlarges bodies (relative to the system's scale) so they are visible. */
const trueRadius = (b) => b.radiusKm / AU_KM;
const enhancedRadius = (b, scale) => Math.max(trueRadius(b),
  (b.starLike || b.kind === 'star'
    ? (scale < 1 ? 0.045 : 0.07) * Math.pow(b.radiusKm / 695700, 0.4) // keeps a white dwarf visibly smaller than its companion
    : 0.022 * Math.pow(b.radiusKm / 6371, 0.42)) * scale);
export const enhancement = (b, scale = 1) => enhancedRadius(b, scale) / trueRadius(b);

/**
 * Distances around a planet (moons, satellites, belts) in ENHANCED mode: the planet is drawn
 * hundreds of times too big, so x = r / R is compressed logarithmically outside the surface
 * (keeps every moon outside its planet and in order). TRUE mode is exact.
 */
export const compressRadii = (x) => (x <= 1 ? x : 1 + 1.6 * Math.log(x));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createSystemView(container, { clock, onSelect, onFrame }) {
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

  // Everything orbiting lives in `root`, which is shifted so the focus is at origin.
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06)); // rendering aid: keep night sides faintly visible
  const starLight = new THREE.PointLight(0xfff4e0, 2.4, 0, 0);
  root.add(starLight);

  // ---- sky: real stars as seen from this system (falls back to a decorative field) ----
  const SKY_R = 2e5;
  const skyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixel: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPixel;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixel; }`,
    fragmentShader: `varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor, a); }`,
  });
  const sky = new THREE.Points(new THREE.BufferGeometry(), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  let skySource = 'decorative';

  function setSkyPoints(dirs, mags, colors) {
    const n = mags.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([dirs[i * 3] * SKY_R, dirs[i * 3 + 1] * SKY_R, dirs[i * 3 + 2] * SKY_R], i * 3);
      size[i] = Math.max(1.2, 6.2 - 0.85 * mags[i]);
      const dim = Math.min(1, Math.max(0.35, 1.25 - mags[i] * 0.13));
      col.set([colors[i * 3] * dim, colors[i * 3 + 1] * dim, colors[i * 3 + 2] * dim], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sky.geometry.dispose();
    sky.geometry = g;
  }

  function decorativeSky() {
    const n = 3000, dirs = new Float32Array(n * 3), mags = new Float32Array(n), cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      dirs.set([s * Math.cos(t), u, s * Math.sin(t)], i * 3);
      mags[i] = 3 + Math.random() * 3.5;
      cols.set([0.6, 0.62, 0.78], i * 3);
    }
    setSkyPoints(dirs, mags, cols);
    skySource = 'decorative';
  }
  decorativeSky();

  /** rows: [dx, dy, dz (equatorial unit), mag, ci, name] as seen from this system. */
  function setSky(rows) {
    const n = rows.length, dirs = new Float32Array(n * 3), mags = new Float32Array(n), cols = new Float32Array(n * 3);
    rows.forEach(([x, y, z, m, ci], i) => {
      dirs.set(frameToScene(eqToEcl([x, y, z])), i * 3);
      mags[i] = m;
      cols.set(blackbodyRGB(teffFromBV(ci ?? 0.6)), i * 3);
    });
    setSkyPoints(dirs, mags, cols);
    skySource = 'catalogue';
  }

  // ---- bodies -------------------------------------------------------------------------
  let model = null;
  let nodes = {}; // id → { body, group, tilt, mesh, label, orbit, pos }
  let pickables = [];
  let lit = []; // planet materials that need the star's position each frame

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

  function orbitColor(body, i) {
    return ORBIT_COLORS[body.id] ?? EXO_ORBIT_COLORS[i % EXO_ORBIT_COLORS.length];
  }

  function addBody(body, i) {
    const group = new THREE.Group();
    const tilt = new THREE.Group();
    const pole = body.pole ? poleVector(body.pole) : new THREE.Vector3(...model.planeNormal);
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
    group.add(tilt);
    let mesh, clouds = null;
    const placeholder = planetTexture(isStar(body) ? { id: body.id, palette: ['#d9a35a', '#f2c879', '#b97a3a'] } : body);
    if (isStar(body)) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), starMaterial(placeholder, body.color, body.skin?.recolour));
      loadTexture(body.skin?.map).then((t) => { if (t) mesh.material.uniforms.uMap.value = t; });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: body.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      glow.scale.setScalar(6);
      mesh.add(glow);
    } else {
      const mat = planetMaterial(placeholder, { tint: body.skin?.tint });
      mat.userData.host = body.orbit?.host ?? model.starId;
      applySkin(mat, body.skin);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), mat);
      lit.push(mat);
      if (body.skin?.clouds) {
        const cm = cloudMaterial(placeholder);
        cm.userData.host = mat.userData.host;
        clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 48), cm);
        cm.uniforms.uMap.value = new THREE.Texture(); // invisible until the cloud map arrives
        loadTexture(body.skin.clouds).then((t) => { if (t) cm.uniforms.uMap.value = t; });
        lit.push(cm);
        tilt.add(clouds);
      }
      if (body.rings) {
        const inner = body.rings.innerKm / body.radiusKm, outer = body.rings.outerKm / body.radiusKm;
        const geo = new THREE.RingGeometry(inner, outer, 160, 1);
        const p = geo.attributes.position, uv = geo.attributes.uv;
        for (let k = 0; k < p.count; k++) uv.setXY(k, (Math.hypot(p.getX(k), p.getY(k)) - inner) / (outer - inner), 0.5);
        const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false });
        loadTexture(body.skin?.ring).then((t) => { if (t) { ringMat.map = t; ringMat.needsUpdate = true; } });
        const ring = new THREE.Mesh(geo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        tilt.add(ring); // scaled with the planet via `tilt.scale`
      }
    }
    mesh.userData.id = body.id;
    tilt.add(mesh);
    // A fixed-size pip keeps true-scale worlds findable when they are sub-pixel.
    const pipGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const minor = body.kind === 'moon' || body.orbit?.type === 'elements';
    group.add(new THREE.Points(pipGeo, new THREE.PointsMaterial({
      size: isStar(body) ? 6 : minor ? 3 : 4, sizeAttenuation: false, color: body.color ?? (minor ? 0xbbbbbb : orbitColor(body, i)) })));
    pickables.push(mesh);
    const label = makeLabel(body);
    group.add(label);
    root.add(group);
    const color = body.kind === 'moon' ? 0x8899aa : body.orbit?.type === 'elements' ? (body.kind === 'comet' ? 0x66ccff : 0xaa9977) : orbitColor(body, i);
    nodes[body.id] = { body, group, tilt, mesh, clouds, label, pos: new THREE.Vector3(), orbit: null, orbitJd: null, color };
  }

  function clear() {
    for (const id in nodes) {
      const n = nodes[id];
      root.remove(n.group);
      n.label.element.remove();
      // Geometries and materials are per-body; textures are shared through the loader cache.
      n.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      if (n.orbit) { root.remove(n.orbit); n.orbit.geometry.dispose(); n.orbit.material.dispose(); }
    }
    nodes = {};
    pickables = [];
    lit = [];
    for (const tr of tracks) for (const l of [tr.a, tr.b]) { root.remove(l); l.geometry.dispose(); l.material.dispose(); }
    tracks.length = 0;
  }

  /** Show a system model (see src/data/systems.js). */
  function load(m) {
    clear();
    model = m;
    tree = m.binary ? hierarchy(m.binary.orbits, m.binary.mass) : null;
    m.bodies.forEach(addBody);
    for (const o of m.binary?.orbits ?? []) addBinaryTrack(o);
    const star = m.bodies.find((x) => x.id === m.starId);
    starLight.color.setHex(star.color ?? 0xfff4e0);
    const outer = Math.max(...m.survey.map((x) => x.au ?? 0));
    controls.maxDistance = outer * 40;
    focusId = m.starId;
    focusPos.set(0, 0, 0);
    flight = null;
    overviewAU = m.survey[0].au;
    camera.position.set(0, 0.45, 0.9).setLength(overviewAU);
    framedRadius = null;
    placedJd = null;
  }

  const isStar = (b) => b.starLike || b.kind === 'star';
  const elementsOf = (o) => ({ a: o.a, e: o.e, I: 0, node: 0, peri: o.omega });
  const basisToScene = ([x, y, z], { u, v, n }, out = new THREE.Vector3()) =>
    out.set(u[0] * x + v[0] * y + n[0] * z, u[1] * x + v[1] * y + n[1] * z, u[2] * x + v[2] * y + n[2] * z);

  // ---- multiple stars: barycentric positions from the ORB6 orbits -------------------------
  let tree = null;
  let placedJd = null, placed = null;
  const relScene = (o, t) => {
    const [nn, ee, zz] = relativeSky(o, t).map((v) => v * o.distPc); // AU
    return [0, 1, 2].map((k) => o.basis.n[k] * nn + o.basis.e[k] * ee + o.basis.r[k] * zz);
  };
  function starPlacement(jd) {
    if (placedJd !== jd) { placed = place(tree, besselianYear(jd), relScene); placedJd = jd; }
    return placed;
  }

  // Each binary orbit is drawn as the two barycentric ellipses about the pair's centre.
  const tracks = [];
  function addBinaryTrack(o) {
    const P = o.periodYears;
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(new THREE.Vector3(...relScene(o, o.periastronYear + (k / 256) * P)));
    const mk = (color) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }));
      root.add(line);
      return line;
    };
    tracks.push({ orbit: o, a: mk(0xffcc66), b: mk(0x9999ff) });
  }

  function updateTracks(jd) {
    if (!tracks.length) return;
    const { centres } = starPlacement(jd);
    for (const tr of tracks) {
      const c = centres.find((x) => x.orbit === tr.orbit);
      if (!c) continue;
      tr.a.position.set(...c.centre); tr.a.scale.setScalar(-c.fa); // primary: opposite side, scaled
      tr.b.position.set(...c.centre); tr.b.scale.setScalar(c.fb);
      tr.a.visible = tr.b.visible = settings.get('orbits');
    }
  }

  // Moon orbits: one period of true parent-relative positions, re-mapped every frame (the
  // ENHANCED compression depends on the scale mix).
  function updateMoonOrbit(node, jd) {
    const b = node.body, P = b.moon.elements.P;
    if (!node.samples || Math.abs(jd - node.orbitJd) > P / 6) {
      node.samples = [];
      for (let k = 0; k <= 160; k++) node.samples.push(toScene(moonOffsetKm(b.moon, jd + (k / 160 - 0.5) * P)).multiplyScalar(1 / AU_KM));
      node.orbitJd = jd;
      if (!node.orbit) {
        const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(161 * 3), 3));
        node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: 0.4 }));
        node.orbit.frustumCulled = false;
        root.add(node.orbit);
      }
    }
    const parent = nodes[b.parent], attr = node.orbit.geometry.attributes.position;
    node.samples.forEach((v, k) => { localMap(parent.body, tmp4.copy(v)); attr.setXYZ(k, tmp4.x, tmp4.y, tmp4.z); });
    attr.needsUpdate = true;
    node.orbit.position.copy(parent.pos);
  }
  const tmp4 = new THREE.Vector3();

  function updateOrbit(node, jd) {
    const o = node.body.orbit;
    if (!o) return;
    if (o.type === 'moon') return updateMoonOrbit(node, jd);
    if (o.type === 'kepler' && node.orbit) { node.orbit.position.copy(hostScene(o.host, jd)); return; }
    if (node.orbit && Math.abs(jd - node.orbitJd) < 365) return;
    const pts = o.type === 'sol'
      ? orbitPath(node.body.id, jd, 512).map((p) => toScene(p))
      : o.type === 'elements' ? smallBodyOrbit(o.el, 512).map((p) => toScene(p))
      : ellipse(elementsOf(o), 256).map((p) => basisToScene(p, o.basis));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (node.orbit) { node.orbit.geometry.dispose(); node.orbit.geometry = geo; }
    else {
      // small bodies' orbits stay faint so the planets read first
      node.orbit = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: o.type === 'elements' ? 0.16 : 0.45 }));
      root.add(node.orbit);
    }
    node.orbitJd = jd;
    if (o.type === 'kepler') node.orbit.position.copy(hostScene(o.host, jd));
  }

  // ---- ephemeris --------------------------------------------------------------------
  let horizonsStatus = { pending: 0, failed: false };
  let horizons = null; // created lazily for Sol (needs the body table)
  const sourceOf = {}; // per body: 'horizons' | 'kepler'

  /** Scene position (AU) of a star in this system. */
  function hostScene(id, jd, out = new THREE.Vector3()) {
    if (!tree) return out.set(0, 0, 0);
    const p = starPlacement(jd).leaves[id];
    return p ? out.set(...p) : out.set(0, 0, 0);
  }

  /** Scene position (AU) of body `id` at `jd`. */
  function scenePosition(id, jd, v = new THREE.Vector3()) {
    const b = nodes[id]?.body;
    if (!b) return v.set(0, 0, 0);
    if (isStar(b)) return model.isSol ? v.set(0, 0, 0) : hostScene(id, jd, v);
    const o = b.orbit;
    if (o.type === 'moon') {
      toScene(moonOffsetKm(b.moon, jd), v).multiplyScalar(1 / AU_KM);
      localMap(nodes[o.parent].body, v);
      return v.add(scenePosition(o.parent, jd, tmp5));
    }
    if (o.type === 'elements') { sourceOf[id] = 'kepler'; return toScene(smallBodyPosition(o.el, jd), v); }
    if (o.type === 'sol') {
      if (settings.get('ephemeris') === 'horizons') {
        horizons ??= createHorizonsEphemeris(Object.fromEntries(model.bodies.map((x) => [x.id, x])), (st) => { horizonsStatus = st; });
        const p = horizons.positionOf(id, jd);
        if (p) { sourceOf[id] = 'horizons'; return toScene(p, v); }
      }
      sourceOf[id] = 'kepler';
      return toScene(heliocentric(id, jd), v);
    }
    sourceOf[id] = 'kepler';
    basisToScene(positionAt(elementsOf(o), o.M0 + (2 * Math.PI * (jd - o.epochJd)) / o.periodDays), o.basis, v);
    return v.add(hostScene(o.host, jd, tmp3));
  }
  const tmp3 = new THREE.Vector3(), tmp5 = new THREE.Vector3();

  /** Map a true parent-relative offset (AU, in place) to its displayed offset at the current scale mix. */
  function localMap(parent, v) {
    const r = v.length();
    if (!r) return v;
    const R = trueRadius(parent), Re = enhancedRadius(parent, model.scale);
    const rE = Re * compressRadii(r / R);
    return v.multiplyScalar((rE * Math.pow(r / rE, scaleMix)) / r);
  }

  // ---- focus & camera flight ---------------------------------------------------------
  let focusId = 'sun';
  let flight = null; // { from: Vector3 (scene), t0, dur, d0 }
  const focusPos = new THREE.Vector3();
  let scaleMix = settings.get('scale') === 'true' ? 1 : 0;

  const displayRadius = (b) => {
    const t = trueRadius(b), e = enhancedRadius(b, model.scale);
    return e * Math.pow(t / e, scaleMix); // log-interpolate between modes
  };
  const viewDistance = (id) => displayRadius(nodes[id].body) * (isStar(nodes[id].body) ? 14 : 7);

  let overviewAU = null; // set when framing the whole system rather than one body
  let framedRadius = null; // focus radius the camera distance was last fitted to

  function flyTo(id, { overview = null } = {}) {
    if (!nodes[id]) return;
    flight = { from: focusPos.clone(), t0: performance.now(), dur: 1600, d0: camera.position.length() };
    focusId = id;
    overviewAU = overview;
    framedRadius = null;
  }

  // ---- picking --------------------------------------------------------------------------
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

  // ---- frame loop -------------------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp6 = new THREE.Vector3(), tmp7 = new THREE.Vector3(), tmp8 = new THREE.Vector3(), tmp9 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const beaconScreen = new THREE.Vector3();
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
    if (!model) return;
    const jd = clock.jd;

    const targetMix = settings.get('scale') === 'true' ? 1 : 0;
    scaleMix += (targetMix - scaleMix) * 0.08;
    if (Math.abs(targetMix - scaleMix) < 1e-3) scaleMix = targetMix;
    const showLabels = settings.get('labels'), showOrbits = settings.get('orbits');

    for (const id in nodes) {
      const n = nodes[id];
      scenePosition(id, jd, n.pos);
      n.group.position.copy(n.pos);
      n.tilt.scale.setScalar(displayRadius(n.body));
      if (n.body.locked) {
        // Tidally locked: the prime meridian (texture centre) faces the planet; spin axis = orbit normal.
        const to = tmp6.copy(nodes[n.body.parent].pos).sub(n.pos).normalize();
        const ahead = scenePosition(id, jd + n.body.moon.elements.P / 50, tmp7).sub(n.pos);
        const up = tmp8.copy(to).negate().cross(ahead).normalize(); // r × v
        const x = to.sub(tmp9.copy(up).multiplyScalar(to.dot(up))).normalize();
        basis.makeBasis(x, up, tmp9.copy(x).cross(up));
        n.tilt.quaternion.setFromRotationMatrix(basis);
        n.mesh.rotation.y = 0;
      } else if (n.body.iau && n.body.pole) {
        // Real orientation: IAU pole + prime meridian (Earth by sidereal time).
        const ax = bodyAxes(n.body.pole, n.body.iau, jd, n.body.texLon0 ?? -180);
        const toS = (v) => new THREE.Vector3(...frameToScene(eqToEcl(v)));
        basis.makeBasis(toS(ax.x), toS(ax.y), toS(ax.z));
        n.tilt.quaternion.setFromRotationMatrix(basis);
        n.mesh.rotation.y = 0;
      } else {
        n.mesh.rotation.y = ((jd * 24) / n.body.rotationHours) * Math.PI * 2 % (Math.PI * 2);
      }
      const fb = nodes[focusId].body;
      const near = n.body.kind !== 'moon' || fb.id === n.body.parent || fb.parent === n.body.parent;
      const minorFar = n.body.orbit?.type === 'elements' && overviewAU != null && overviewAU < 6 && n.body.belt !== 'MAIN BELT';
      n.label.visible = (showLabels && near && !minorFar) || id === focusId;
      n.group.visible = n.body.kind !== 'moon' || near || overviewAU == null || camera.position.length() < 3;
      n.label.element.classList.toggle('focused', id === focusId);
      if (n.body.orbit) {
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
    for (const m of lit) m.uniforms.uSunPos.value.copy((nodes[m.userData.host] ?? nodes[model.starId]).pos).add(root.position);
    updateTracks(jd);
    for (const id in nodes) {
      const c = nodes[id].clouds;
      if (c) c.rotation.y = (now / 1000) * 0.004; // clouds: a static 2004 snapshot, drifted gently so they read as weather
    }
    controls.minDistance = displayRadius(nodes[focusId].body) * 1.3;
    controls.update();

    renderer.render(scene, camera);
    labels.render(scene, camera);

    // Sector-001 edge beacon: Sol's star in Sector 001, otherwise the direction to Sol.
    if (model.isSol) tmp.copy(nodes[model.starId].pos).sub(focusPos);
    else tmp.set(...model.solDirection).multiplyScalar(1000).add(camera.position);
    beaconScreen.copy(tmp).project(camera);
    const behind = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
    onFrame?.({
      jd, focusId, scaleMix, horizonsStatus, skySource,
      sources: { ...sourceOf },
      beacon: {
        x: beaconScreen.x, y: beaconScreen.y, behind,
        visible: !behind && Math.abs(beaconScreen.x) <= 1 && Math.abs(beaconScreen.y) <= 1,
        atFocus: model.isSol && focusId === model.starId,
      },
    });
  }

  return {
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    load,
    setSky, decorativeSky,
    get model() { return model; },
    focus(id, opts) { flyTo(id, opts); },
    overview(au, centre, localKm) {
      if (localKm && nodes[centre]) au = 2.4 * localMap(nodes[centre].body, new THREE.Vector3(localKm / AU_KM, 0, 0)).length();
      flyTo(centre && nodes[centre] ? centre : model.starId, { overview: au });
    },
    get focusId() { return focusId; },
    /** Scene position of a body, AU. */
    positionOf: (id) => scenePosition(id, clock.jd, new THREE.Vector3()).toArray(),
    /** Distance (AU) from a body to its own star (planets) or to the system's centre (stars). */
    hostDistance(id) {
      const b = nodes[id]?.body;
      const p = scenePosition(id, clock.jd, new THREE.Vector3());
      if (!b || isStar(b)) return p.length();
      if (b.orbit?.type === 'moon') return Math.hypot(...moonOffsetKm(b.moon, clock.jd)) / AU_KM;
      return p.distanceTo(b.orbit?.host ? hostScene(b.orbit.host, clock.jd, new THREE.Vector3()) : new THREE.Vector3());
    },
    enhancementOf: (id) => enhancement(nodes[id].body, model.scale),
  };
}
