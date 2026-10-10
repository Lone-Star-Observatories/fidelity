// Navigation View — look outward from the current system: real stars within a radius,
// in the IAU galactic frame (galactic plane horizontal, galactic north up, the galactic
// centre to the right), centred on the current star. Planet hosts wear a ring; Sol is
// always marked as Sector 001.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eqToGal, frameToScene, LY_PER_PC } from '../../astro/frames.js';
import { navStarLook } from './starlook.js';
import { currentBand } from '../../data/bandstate.js';
import { settings } from '../../settings.js';
import { systemName } from '../../panels/navlist.js';
import { integrateTrack, trackAt, closestApproach, linearApproach } from '../../astro/galpot.js';
import { badge } from '../../data/provenance.js';
import { createArrivals } from './arrivals.js';
import { badgeLines, brightLimit } from './drift.js';
import { createCameraRig, motionK, nearestPoint, aheadPoint } from '../cameraControls.js';
import { METERS } from '../cameraMath.js';

const TRACKS = new Map(); // orbit cache: `${star}|${motion source}` → track

const DESIGNATION = /^(HIP|HD|HYG|Gliese|GJ|Gl|LHS|LP|G \d|Wolf|Ross|Luyten|Lacaille|Struve|BD|CD|LTT|2MASS|TOI|K2-|Kepler|WASP|HAT)/;

export function createNavigationView(container, { onSelect, onFrame, onDrill, onArrivals }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.zoomSpeed = 1.2;

  const world = new THREE.Group();
  scene.add(world);

  const pointMat = (ring) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixel: { value: renderer.getPixelRatio() } },
    // `dark` (0/1): a star that emits essentially nothing in the spectrum band, drawn as a hollow marker
    vertexShader: `attribute float size; attribute vec3 color; attribute float dark; varying vec3 vColor; varying float vDark; uniform float uPixel;
      void main() { vColor = color; vDark = dark; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixel; }`,
    fragmentShader: ring
      ? `varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.44, d) * smoothstep(0.34, 0.40, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`
      // a solid disc with a white-hot centre and a soft halo, so even a 6 px M dwarf reads on the chart
      : `varying vec3 vColor; varying float vDark; void main() { float d = length(gl_PointCoord - 0.5);
          if (vDark > 0.5) { float r = smoothstep(0.5, 0.42, d) * smoothstep(0.24, 0.32, d); if (r < 0.02) discard; gl_FragColor = vec4(vColor, r * 0.8); return; }
          float core = smoothstep(0.34, 0.12, d); float halo = smoothstep(0.5, 0.15, d) * 0.55;
          float a = max(core, halo); if (a < 0.02) discard; gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.18) * (0.9 + core * 0.25), a); }`,
  });

  let data = null;       // { center, stars, radiusLy, ... }
  let placed = [];       // { star, pos: Vector3 (ly, scene) }
  let selectedId = null;
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function clearWorld() {
    for (const o of [...world.children]) {
      world.remove(o);
      o.traverse((c) => { c.geometry?.dispose(); c.material?.dispose(); if (c.isCSS2DObject) c.element.remove(); });
    }
  }

  const lyFrom = (s, c) => frameToScene(eqToGal([(s.x - c.x) * LY_PER_PC, (s.y - c.y) * LY_PER_PC, (s.z - c.z) * LY_PER_PC]));

  function label(text, cls, pos, onClick, parent = world) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    if (onClick) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    }
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    o.center.set(-0.12, 0.5);
    parent.add(o);
    return o;
  }

  function line(points, color, opacity, parent = world) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    parent.add(l);
    return l;
  }
  // The chart (rings, spokes) rides with the centre star through deep time; drop lines only
  // make sense at the present epoch.
  let chartGroup = null, dropGroup = null;

  // Galactic-plane chart: distance rings, quadrant spokes (IAU quadrants I–IV by longitude).
  function drawChart(radiusLy) {
    const steps = [5, 10, 25, 50, 100].filter((r) => r <= radiusLy);
    if (!steps.includes(radiusLy)) steps.push(radiusLy);
    for (const r of steps) {
      const pts = [];
      for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      line(pts, 0x9977aa, r === radiusLy ? 0.5 : 0.22, chartGroup);
      label(`${r} LY`, 'ring', new THREE.Vector3(r * Math.cos(-0.35), 0, r * Math.sin(-0.35)), null, chartGroup);
    }
    const spokes = [[0, 'GALACTIC CENTRE · l 0°'], [90, 'l 90° · ROTATION'], [180, 'ANTICENTRE · l 180°'], [270, 'l 270°']];
    for (const [l, text] of spokes) {
      const v = new THREE.Vector3(...frameToScene([Math.cos(l * Math.PI / 180), Math.sin(l * Math.PI / 180), 0]));
      line([new THREE.Vector3(), v.clone().multiplyScalar(radiusLy * 1.08)], 0xff9966, 0.28, chartGroup);
      label(text, 'spoke', v.clone().multiplyScalar(radiusLy * 1.12), null, chartGroup);
    }
    ['I', 'II', 'III', 'IV'].forEach((q, i) => {
      const l = (45 + i * 90) * Math.PI / 180;
      label(`QUADRANT ${q}`, 'quadrant', new THREE.Vector3(...frameToScene([Math.cos(l), Math.sin(l), 0])).multiplyScalar(radiusLy * 0.72), null, chartGroup);
    });
  }

  /** Show stars around `d.center` (from /api/nearby). */
  function load(d) {
    msg = null; arrows = null; sunArrow = null; sunTag = null; proxLines = null; epoch = 0;
    // arrow length follows the range (10 kyr up to 25 ly, 100 kyr beyond) until one is picked
    if (!motion.pickedWindow) motion = { ...motion, window: d.radiusLy <= 25 ? 1e4 : 1e5 };
    clearWorld();
    proxTags.clear();
    chartGroup = new THREE.Group(); dropGroup = new THREE.Group();
    world.add(chartGroup, dropGroup);
    chartOffset.set(0, 0, 0);
    data = d;
    selectedId = null;
    tempLabel = null;
    const c = d.center;
    placed = d.stars.map((s) => ({ star: s, pos: new THREE.Vector3(...lyFrom(s, c)) }));
    drawChart(d.radiusLy);

    const n = placed.length;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3), dark = new Float32Array(n);
    const hostIdx = [];
    placed.forEach(({ star: s, pos: p }, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      // size encodes luminosity in the spectrum band (#28); colour comes from B−V or spectral class
      const look = navStarLook(s);
      size[i] = placed[i].size0 = look.size;
      col.set(look.rgb, i * 3);
      dark[i] = look.dark ? 1 : 0;
      if (s.planets) hostIdx.push(i);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('dark', new THREE.BufferAttribute(dark, 1));
    world.add(new THREE.Points(g, pointMat(false)));
    ptsGeo = g;

    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hostIdx.flatMap((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]])), 3));
    hg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(hostIdx.map((i) => size[i] + 11)), 1));
    hg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(hostIdx.flatMap(() => [1, 0.6, 0])), 3));
    world.add(new THREE.Points(hg, pointMat(true)));
    hostGeo = hg; hostIdxs = hostIdx;
    drawBandKey();

    // Labels: the current system, Sol, the nearest planet hosts and the brightest named
    // stars. Everything else is labelled on selection, so the chart stays readable.
    const others = placed.filter(({ star: s }) => s.id !== c.id && s.id !== 'sol');
    const near = (a, b) => a.pos.lengthSq() - b.pos.lengthSq();
    const hosts = others.filter(({ star: s }) => s.planets).sort(near).slice(0, 12);
    const named = others
      .filter(({ star: s }) => !s.planets && !DESIGNATION.test(s.name) && s.absmag != null)
      .sort((a, b) => a.star.absmag - b.star.absmag).slice(0, 8);
    for (const p of placed) {
      const s = p.star;
      const isCenter = s.id === c.id, isSol = s.id === 'sol';
      if (!(isCenter || isSol || hosts.includes(p) || named.includes(p))) continue;
      const cls = isSol ? 'sol' : isCenter ? 'center' : s.planets ? 'host' : 'named';
      const text = isSol ? (isCenter ? 'SOL · SECTOR 001 · YOU ARE HERE' : 'SOL · SECTOR 001')
        : isCenter ? `${s.name.toUpperCase()} · YOU ARE HERE` : s.name.toUpperCase() + (s.planets ? ` · ${s.planets}` : '');
      p.label = label(text, cls, p.pos, () => onSelect(s.id));
      if (!isCenter && Math.abs(p.pos.y) > 0.3 && (s.planets || isSol)) {
        line([p.pos.clone(), new THREE.Vector3(p.pos.x, 0, p.pos.z)], isSol ? 0x9999ff : 0xff9900, 0.25, dropGroup); // drop line to the plane
      }
    }

    const r = d.radiusLy;
    controls.maxDistance = r * 6;
    controls.minDistance = 0.2;
    attachTracks();
    // stars beyond the radius that deep time can bring in (#29)
    shown = [];
    if (visitorGeo) visitorGeo.setDrawRange(0, 0);
    const solStar = d.stars.find((s) => s.id === 'sol');
    drift.reset(c.id, r, d.stars.map((s) => s.id), solStar ? Math.hypot(solStar.x - c.x, solStar.y - c.y, solStar.z - c.z) * LY_PER_PC : 0);
    encCache = null;
    computeEpoch();
    refreshMotion();
    target.set(0, 0, 0);
    controls.target.set(0, 0, 0);
    camera.position.set(r * 0.8, r * 1.1, r * 1.9);
  }

  // ---- a light-speed message and its reply ------------------------------------------------
  // The pulse covers `lyPerSec` light-years per real second: out to the far end, then back.
  let msg = null;
  const glow = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function clearMessage() {
    if (!msg) return;
    for (const o of [msg.sprite, msg.trail, msg.path, msg.tag]) { world.remove(o); o.geometry?.dispose(); o.material?.dispose(); if (o.isCSS2DObject) o.element.remove(); }
    msg = null;
  }
  /** Start a message from star `fromId` to `toId`; returns the distance (ly) or null. */
  function sendMessage(fromId, toId, lyPerSec = 0.1) {
    clearMessage();
    const a = placed.find((p) => p.star.id === fromId), b = placed.find((p) => p.star.id === toId);
    if (!a || !b) return null;
    const dist = a.pos.distanceTo(b.pos);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x99ddff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.scale.setScalar(Math.max(0.35, dist * 0.04));
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.pos, a.pos]), new THREE.LineBasicMaterial({ color: 0x99ddff, transparent: true, opacity: 0.9 }));
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.pos, b.pos]), new THREE.LineDashedMaterial({ color: 0x99ddff, dashSize: dist / 60, gapSize: dist / 60, transparent: true, opacity: 0.35 }));
    path.computeLineDistances();
    const el = document.createElement('div');
    el.className = 'nav-label message';
    const tag = new CSS2DObject(el);
    tag.center.set(-0.15, 1.4);
    world.add(path, trail, sprite, tag);
    msg = { a: a.pos.clone(), b: b.pos.clone(), dist, lyPerSec, t0: performance.now(), sprite, trail, path, tag, el, from: a.star, to: b.star, paused: 0 };
    return dist;
  }
  function stepMessage(now) {
    if (!msg) return;
    const travelled = Math.min(2 * msg.dist, ((now - msg.t0) / 1000) * msg.lyPerSec);
    const out = travelled <= msg.dist;
    const f = out ? travelled / msg.dist : 2 - travelled / msg.dist;
    msg.sprite.position.lerpVectors(msg.a, msg.b, f);
    msg.sprite.material.color.setHex(out ? 0x99ddff : 0xffcc66);
    msg.trail.material.color.setHex(out ? 0x99ddff : 0xffcc66);
    msg.trail.geometry.setFromPoints([out ? msg.a : msg.b, msg.sprite.position]);
    msg.tag.position.copy(msg.sprite.position);
    msg.state = { travelled, dist: msg.dist, out, done: travelled >= 2 * msg.dist, from: msg.from, to: msg.to };
    msg.el.textContent = msg.state.done ? 'REPLY RECEIVED' : out ? `MESSAGE · ${(msg.dist - travelled).toFixed(2)} LY TO GO` : `REPLY · ${(2 * msg.dist - travelled).toFixed(2)} LY TO GO`;
  }

  // ---- space motion & deep time (#20) ------------------------------------------------------
  // Every star with a measured space velocity (HYG: Hipparcos proper motion + catalogue radial
  // velocity; sideways only where no radial velocity is known) is integrated on its real orbit
  // through the Milky Way (src/astro/galpot.js), ±50 Myr. Stars of one system share the system's
  // best-measured motion (they are bound). Stars with no measured motion are hidden in deep time.
  const LY_PER_KMS_YR = 3.3356e-6;
  const MAT = {
    arrows: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
    sun: new THREE.LineBasicMaterial({ vertexColors: true }),
    prox: new THREE.LineBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.55 }),
  };
  let motion = { mode: 'relative', window: 100000 }, epoch = 0;
  let arrows = null, ptsGeo = null, sunArrow = null, sunTag = null;
  const galOf = (s) => eqToGal([s.x * LY_PER_PC, s.y * LY_PER_PC, s.z * LY_PER_PC]);
  /** Shaft plus a four-barbed head (visible from any angle) from a to b, pushed into pos/col. */
  function pushArrow(pos, col, a, b, cTail, cHead, headLen) {
    const d = b.clone().sub(a), len = d.length();
    if (len < 1e-6) return;
    d.divideScalar(len);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); col.push(...cTail, ...cHead);
    const h = Math.min(len * 0.3, headLen);
    const p1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const p2 = new THREE.Vector3().crossVectors(d, p1);
    for (const q of [p1, p2, p1.clone().negate(), p2.clone().negate()]) {
      const e = b.clone().addScaledVector(d, -h).addScaledVector(q, h * 0.45);
      pos.push(b.x, b.y, b.z, e.x, e.y, e.z); col.push(...cHead, ...cHead);
    }
  }
  // Orbits are integrated ±5 Myr up front and extended to ±50 Myr only when deep time goes further.
  let trackSpan = 5;
  /** Attach an orbit to every placed star (cached across loads by star id). */
  function attachTracks() {
    const bySystem = new Map();
    for (const p of placed) { const k = p.star.system ?? p.star.id; if (!bySystem.has(k)) bySystem.set(k, []); bySystem.get(k).push(p.star); }
    for (const p of placed) {
      const members = bySystem.get(p.star.system ?? p.star.id);
      // the system's motion: measured radial velocity first, then the brightest member
      const src = [...members].filter((m) => m.vKms).sort((a, b) => (b.rvKnown - a.rvKnown) || ((a.vSrc ? 0 : 1) - (b.vSrc ? 0 : 1)) || ((a.absmag ?? 99) - (b.absmag ?? 99)))[0];
      p.motionFrom = src ?? null;
      if (!src) { p.track = null; continue; }
      const key = `${p.star.id}|${src.id}|${trackSpan}`;
      if (!TRACKS.has(key)) TRACKS.set(key, integrateTrack(galOf(p.star), eqToGal(src.vKms), { spanMyr: trackSpan }));
      p.track = TRACKS.get(key);
    }
  }
  const cur = { pos: [0, 0, 0], vel: [0, 0, 0] }, cRef = { pos: [0, 0, 0], vel: [0, 0, 0] };
  // Arrivals (#29): far stars integrated in a worker; `shown` holds those inside the sphere now.
  const drift = createArrivals({ onChange: () => { encCache = null; if (data) setEpoch(epoch); onArrivals?.(drift.status); } });
  let shown = [], visitorGeo = null, departed = 0;
  /** Positions (scene, ly) and velocities (scene, km/s) of every star at the current epoch. */
  function computeEpoch() {
    if (!data) return;
    const c = placed.find((x) => x.star.id === data.center.id);
    const cg0 = galOf(data.center);
    const rel = motion.mode !== 'galactic' && c?.track;
    if (c?.track) trackAt(c.track, epoch, cRef);
    const R2 = data.radiusLy ** 2, sphere = epoch !== 0 && c?.track; // who is inside the sphere around the centre now
    departed = 0;
    for (const p of placed) {
      p.hidden = epoch !== 0 && !p.track;
      if (!p.track) { p.now = p.pos.clone(); p.vnow = null; continue; }
      trackAt(p.track, epoch, cur);
      if (sphere && p !== c && p.star.id !== 'sol' && (cur.pos[0] - cRef.pos[0]) ** 2 + (cur.pos[1] - cRef.pos[1]) ** 2 + (cur.pos[2] - cRef.pos[2]) ** 2 > R2) { p.hidden = true; departed++; }
      const d = rel ? cur.pos.map((x, k) => x - cRef.pos[k]) : cur.pos.map((x, k) => x - cg0[k]);
      const v = rel ? cur.vel.map((x, k) => x - cRef.vel[k]) : cur.vel;
      p.now = epoch === 0 && rel ? p.pos.clone() : new THREE.Vector3(...frameToScene(d));
      p.vnow = new THREE.Vector3(...frameToScene(v));
      p.vabs = new THREE.Vector3(...frameToScene(cur.vel));
    }
    shown = [];
    if (sphere) {
      // Screen tens of thousands of far stars cheaply at their nearest orbit sample (relative
      // distance minus how far they can close in half a sample), then interpolate the few left.
      const atSample = new Map(), cS = { pos: [0, 0, 0], vel: [0, 0, 0] };
      for (const s of drift.stars) {
        const tr = s.track;
        if (!tr || Math.abs(epoch) > s.spanYears) continue;
        const h = tr.sampleMyr, f = epoch / 1e6 / h + tr.n, k = Math.round(f), key = tr.n * 1000 + h;
        let ref = atSample.get(key);
        if (!ref) { trackAt(c.track, (k - tr.n) * h * 1e6, cS); ref = [...cS.pos, ...cS.vel]; atSample.set(key, ref); }
        const sd = tr.data, o = k * 6;
        const ex = sd[o] - ref[0], ey = sd[o + 1] - ref[1], ez = sd[o + 2] - ref[2];
        const close = Math.hypot(sd[o + 3] - ref[3], sd[o + 4] - ref[4], sd[o + 5] - ref[5]) * Math.abs(f - k) * h * 3.3356 + 1;
        if (Math.sqrt(ex * ex + ey * ey + ez * ez) - close > data.radiusLy) continue;
        trackAt(tr, epoch, cur);
        const dx = cur.pos[0] - cRef.pos[0], dy = cur.pos[1] - cRef.pos[1], dz = cur.pos[2] - cRef.pos[2];
        if (dx * dx + dy * dy + dz * dz > R2) continue;
        const d = rel ? [dx, dy, dz] : cur.pos.map((x, k) => x - cg0[k]);
        const v = rel ? cur.vel.map((x, k) => x - cRef.vel[k]) : cur.vel;
        shown.push({ star: s, visitor: true, motionFrom: s, now: new THREE.Vector3(...frameToScene(d)), vnow: new THREE.Vector3(...frameToScene(v)), vabs: new THREE.Vector3(...frameToScene(cur.vel)) });
      }
    }
  }
  /** Points for the arrivals inside the sphere (the buffer grows as more far stars load). */
  function drawVisitors() {
    const need = drift.stars.length;
    if (!visitorGeo || visitorGeo.userData.cap < need) {
      if (visitorGeo) { world.remove(visitorGeo.userData.points); visitorGeo.dispose(); }
      const cap = Math.max(1024, need);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(cap), 1));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      g.setAttribute('dark', new THREE.BufferAttribute(new Float32Array(cap), 1));
      const pts = new THREE.Points(g, pointMat(false));
      pts.frustumCulled = false;
      g.userData = { cap, points: pts };
      visitorGeo = g;
    }
    if (visitorGeo.userData.points.parent !== world) world.add(visitorGeo.userData.points); // clearWorld() drops it on load
    const pa = visitorGeo.attributes.position, sa = visitorGeo.attributes.size, ca = visitorGeo.attributes.color, da = visitorGeo.attributes.dark;
    shown.forEach((p, i) => {
      const s = p.star;
      if (!s.rgb) { const look = navStarLook(s); s.rgb = look.rgb; s.size0 = look.size; s.dark = look.dark ? 1 : 0; }
      pa.setXYZ(i, p.now.x, p.now.y, p.now.z); sa.setX(i, s.size0); ca.setXYZ(i, ...s.rgb); da.setX(i, s.dark);
    });
    visitorGeo.setDrawRange(0, shown.length);
    for (const [a, w] of [[pa, 3], [sa, 1], [ca, 3], [da, 1]]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, shown.length) * w); a.needsUpdate = true; }
  }
  /** Every star on the chart right now: today's neighbours still inside, plus arrivals. */
  const onChart = () => [...placed.filter((p) => !p.hidden), ...shown];
  const findPlaced = (id) => placed.find((x) => x.star.id === id) ?? shown.find((x) => x.star.id === id);
  function refreshMotion() {
    if (!data) return;
    for (const o of [arrows, sunArrow]) if (o) { world.remove(o); o.geometry.dispose(); } // materials are reused: disposing them every frame recompiled their shaders
    arrows = sunArrow = null;
    if (motion.mode !== 'off') {
      const pos = [], col = [], head = data.radiusLy * 0.035;
      for (const p of [...placed, ...shown]) {
        if (!p.vnow || p.hidden) continue;
        const a = p.now, b = a.clone().addScaledVector(p.vnow, motion.window * LY_PER_KMS_YR);
        const k = p.motionFrom?.rvKnown ? 1 : 0.45; // dimmer where only the sideways motion is known
        pushArrow(pos, col, a, b, [0.15, 0.25, 0.4], [0.6 * k, 0.85 * k, 1 * k], head);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      arrows = new THREE.LineSegments(g, MAT.arrows);
      world.add(arrows);
      // Sol's own path around the galaxy, in gold, whichever frame the other arrows use
      const sol = placed.find((p) => p.star.id === 'sol');
      if (sol?.vabs && motion.mode !== 'galactic') {
        const a = sol.now, full = motion.window * LY_PER_KMS_YR * sol.vabs.length(), cap = data.radiusLy * 0.6;
        const b = a.clone().addScaledVector(sol.vabs.clone().normalize(), Math.min(full, cap));
        const sp = [], sc = [];
        pushArrow(sp, sc, a, b, [0.5, 0.35, 0.1], [1, 0.8, 0.3], head * 1.4);
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
        sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
        sunArrow = new THREE.LineSegments(sg, MAT.sun);
        world.add(sunArrow);
        if (!sunTag) sunTag = label('', 'motion', b);
        sunTag.element.textContent = `SOL → ${Math.round(sol.vabs.length())} KM/S AROUND THE GALAXY${full > cap ? ' · ARROW SHORTENED' : ''}`;
        sunTag.position.copy(b);
        sunTag.visible = true;
      } else if (sunTag) sunTag.visible = false;
    } else if (sunTag) sunTag.visible = false;
    updateProximity();
  }
  const posAt = (p) => (p.now ?? p.pos).clone();
  const chartOffset = new THREE.Vector3();

  // ---- anything within 8 ly of Sol gets a line and its distance ------------------------------
  const NEAR_SOL_LY = 8;
  let proxLines = null;
  const proxTags = new Map(); // system key → label
  function updateProximity() {
    if (proxLines) { world.remove(proxLines); proxLines.geometry.dispose(); proxLines = null; }
    const sol = placed.find((p) => p.star.id === 'sol');
    const keep = new Set();
    if (sol) {
      const sp = posAt(sol), best = new Map();
      for (const p of [...placed, ...shown]) {
        if (p === sol || p.hidden) continue;
        const q = posAt(p), d = q.distanceTo(sp);
        if (d > NEAR_SOL_LY) continue;
        const k = p.star.system ?? p.star.id;
        if (!best.has(k) || d < best.get(k).d) best.set(k, { p, q, d });
      }
      const pts = [];
      for (const [k, { p, q, d }] of best) {
        pts.push(sp, q);
        keep.add(k);
        const mid = sp.clone().lerp(q, 0.5);
        let t = proxTags.get(k);
        if (!t) { t = label('', 'prox', mid, () => onSelect(p.star.id)); proxTags.set(k, t); }
        t.position.copy(mid);
        const members = [...placed, ...shown].filter((x) => (x.star.system ?? x.star.id) === k).map((x) => x.star).sort((x, y) => (x.absmag ?? 99) - (y.absmag ?? 99));
        t.element.textContent = `${systemName(members).toUpperCase()} · ${d.toFixed(2)} LY`;
      }
      if (pts.length) {
        proxLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), MAT.prox);
        world.add(proxLines);
      }
    }
    for (const [k, t] of proxTags) if (!keep.has(k)) { world.remove(t); t.element.remove(); proxTags.delete(k); }
  }
  /** Move every star to epoch `t` years from now along its integrated orbit. */
  function setEpoch(t) {
    epoch = t;
    if (!ptsGeo) return;
    if (Math.abs(t) > trackSpan * 1e6 && trackSpan < 50) { trackSpan = 50; attachTracks(); }
    if (t !== 0) drift.ensure(t);
    computeEpoch();
    drawVisitors();
    drawBadge();
    const attr = ptsGeo.attributes.position, sz = ptsGeo.attributes.size;
    placed.forEach((p, i) => {
      attr.setXYZ(i, p.now.x, p.now.y, p.now.z);
      sz.setX(i, p.hidden ? 0 : p.size0);
      if (p.label) p.label.position.copy(p.now);
    });
    attr.needsUpdate = true; sz.needsUpdate = true;
    // keep the chart and camera with the centre star (it only moves in the galactic frame)
    const cp = placed.find((x) => x.star.id === data.center.id);
    if (cp && chartGroup) {
      const off = posAt(cp).sub(cp.pos), d = off.clone().sub(chartOffset);
      chartOffset.copy(off);
      chartGroup.position.copy(off);
      target.add(d); controls.target.add(d); camera.position.add(d);
    }
    if (dropGroup) dropGroup.visible = t === 0;
    if (tempLabel && selectedId) {
      const sp = findPlaced(selectedId);
      tempLabel.visible = !!sp && !sp.hidden;
      if (sp) tempLabel.position.copy(posAt(sp));
    }
    if (hostGeo) {
      const ha = hostGeo.attributes.position, hs = hostGeo.attributes.size;
      hostIdxs.forEach((i, k) => { ha.setXYZ(k, attr.getX(i), attr.getY(i), attr.getZ(i)); hs.setX(k, placed[i].hidden ? 0 : placed[i].size0 + 11); });
      ha.needsUpdate = true; hs.needsUpdate = true;
    }
    refreshMotion();
  }
  let hostGeo = null, hostIdxs = [];
  /** Hidden in deep time: stars with no measured motion. */
  const unmovedCount = () => placed.filter((p) => !p.track).length;
  /**
   * Closest approaches to the centre star within ±maxYears along the integrated orbits:
   * scanned every 20 kyr, then refined by golden-section search. Cached per centre.
   */
  let encCache = null;
  function encounters(maxYears = 5e6) {
    const c = placed.find((x) => x.star.id === data?.center.id);
    if (!c?.track) return [];
    const ds = drift.status, n = `${placed.length}|${ds?.count}|${ds?.loading}`;
    if (encCache?.center === c.star.id && encCache.max === maxYears && encCache.n === n) return encCache.out;
    const sys = c.star.system ?? c.star.id;
    const out = [];
    for (const p of placed) {
      if (p === c || !p.track || (p.star.system ?? p.star.id) === sys) continue;
      const { tYears, dMinLy } = closestApproach(p.track, c.track, maxYears);
      out.push({ star: p.star, tYears, dMinLy, nowLy: p.pos.length(), rvKnown: !!p.motionFrom?.rvKnown });
    }
    // Arrivals from beyond the radius (#29): screened along straight lines (with slack for the
    // galaxy's tidal and vertical pull), then integrated like the rest.
    if (c.motionFrom) {
      const cg = galOf(c.star), cv = eqToGal(c.motionFrom.vKms);
      for (const s of drift.stars) {
        if (!s.track || (s.system ?? s.id) === sys) continue;
        const dp = [s.gal[0] - cg[0], s.gal[1] - cg[1], s.gal[2] - cg[2]], r = Math.hypot(...dp);
        const lin = linearApproach(dp, [s.galV[0] - cv[0], s.galV[1] - cv[1], s.galV[2] - cv[2]]);
        const myr = Math.min(Math.abs(lin.tYears), maxYears) / 1e6;
        if (Math.abs(lin.tYears) > maxYears + 1e6 || lin.dLy > 8 + 0.003 * r * myr * myr) continue;
        const { tYears, dMinLy } = closestApproach(s.track, c.track, Math.min(maxYears, s.spanYears));
        out.push({ star: s, tYears, dMinLy, nowLy: r, rvKnown: !!s.rvKnown, arrival: true });
      }
    }
    encCache = { center: c.star.id, max: maxYears, n, out };
    return out;
  }

  let tempLabel = null; // label for a selected star that isn't labelled by default
  function select(id) {
    selectedId = id;
    const p = findPlaced(id);
    if (tempLabel) { world.remove(tempLabel); tempLabel.element.remove(); tempLabel = null; }
    for (const q of placed) q.label?.element.classList.toggle('selected', q.star.id === id);
    const s = p?.star ?? drift.stars.find((x) => x.id === id);
    if (s && !p?.label) {
      tempLabel = label(s.name.toUpperCase() + (s.planets ? ` · ${s.planets}` : '') + (s.arrival ? ' · ARRIVAL' : ''), 'selected', p ? posAt(p) : new THREE.Vector3(), () => onSelect(id));
      tempLabel.visible = !!p;
    }
    if (p) target.copy(posAt(p));
  }

  // Screen-space picking: nearest star within 14 px of the click.
  let down = null;
  labels.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  const nearestStar = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    let best = null, bestD = 14;
    for (const p of onChart()) {
      tmp.copy(posAt(p)).project(camera);
      if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x + 1) / 2 * r.width + r.left - e.clientX, (1 - tmp.y) / 2 * r.height + r.top - e.clientY);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  };
  // double-click drills down: open that star's system (#23)
  labels.domElement.addEventListener('dblclick', (e) => { const p = nearestStar(e); if (p) onDrill?.(p.star.id); });
  labels.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !placed.length) return;
    const r = renderer.domElement.getBoundingClientRect();
    let best = null, bestD = 14;
    for (const p of onChart()) {
      tmp.copy(posAt(p)).project(camera);
      if (tmp.z > 1) continue;
      const d = Math.hypot((tmp.x + 1) / 2 * r.width + r.left - e.clientX, (1 - tmp.y) / 2 * r.height + r.top - e.clientY);
      if (d < bestD) { best = p; bestD = d; }
    }
    if (best) onSelect(best.star.id);
  });

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

  // ---- orientation gauge: which screen direction is the galactic centre, rotation, north ----------
  const gauge = document.createElement('div');
  gauge.className = 'orient-gauge';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '-60 -60 120 120');
  const readout = document.createElement('div');
  readout.className = 'orient-readout';
  gauge.append(Object.assign(document.createElement('div'), { className: 'orient-title', textContent: 'ORIENTATION' }), svg, readout);
  container.appendChild(gauge);
  const AXES = [ // scene direction, label, colour
    [new THREE.Vector3(...frameToScene([1, 0, 0])), 'GC', '#ff9966'], [new THREE.Vector3(...frameToScene([-1, 0, 0])), 'ANTI', '#996655'],
    [new THREE.Vector3(...frameToScene([0, 1, 0])), 'ROT', '#ffcc66'], [new THREE.Vector3(...frameToScene([0, -1, 0])), '270°', '#998855'],
    [new THREE.Vector3(...frameToScene([0, 0, 1])), 'N', '#99ccff'], [new THREE.Vector3(...frameToScene([0, 0, -1])), 'S', '#667799'],
  ].map(([v, text, color]) => {
    const ln = document.createElementNS(SVGNS, 'line'), tx = document.createElementNS(SVGNS, 'text');
    ln.setAttribute('stroke', color); ln.setAttribute('stroke-width', '2'); ln.setAttribute('x1', '0'); ln.setAttribute('y1', '0');
    tx.setAttribute('fill', color); tx.setAttribute('font-size', String(10 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1))); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dominant-baseline', 'middle');
    tx.textContent = text;
    svg.append(ln, tx);
    return { v, text, ln, tx };
  });
  // ---- deep-time badge (#29): who is in the sphere, how complete, what is not loaded ---------
  const driftBadge = document.createElement('div');
  driftBadge.className = 'drift-badge';
  driftBadge.hidden = true;
  container.appendChild(driftBadge);
  let lastBadge = '';
  /** Bright stars the catalogue holds completely out to the loaded radius: today versus now. */
  function likeForLike(st, vis) {
    if (!st || epoch === 0) return null;
    const mag = brightLimit(st.loadedLy), R = data.radiusLy;
    const bright = (p) => p.star.absmag != null && p.star.absmag <= mag;
    return { mag, today: placed.filter((p) => p.track && p.pos.length() <= R && bright(p)).length, now: vis.filter(bright).length };
  }
  function drawBadge() {
    const st = drift.status;
    const vis = onChart();
    const lines = badgeLines({ epoch, radiusLy: data.radiusLy, shown: vis.length, arrived: shown.length, departed,
      gaia: vis.filter((p) => p.motionFrom?.vSrc === 1 || p.motionFrom?.vSrc === 2).length, gaiaOnly: vis.filter((p) => p.motionFrom?.vSrc === 3).length,
      hyg: vis.filter((p) => p.motionFrom && !p.motionFrom.vSrc).length,
      loadedLy: st?.loadedLy ?? data.radiusLy, loading: st?.loading, preview: st?.preview, previewLy: st?.previewLy, density: st?.density, like: likeForLike(st, vis),
      gaiaRv: st?.gaiaRv, completeness: st?.completeness });
    const key = lines.map((l) => l.text).join('|');
    if (key === lastBadge) return;
    lastBadge = key;
    driftBadge.hidden = !lines.length;
    driftBadge.replaceChildren(...lines.map((l) => {
      const row = document.createElement('div');
      row.className = l.warn ? 'drift-line warn' : 'drift-line';
      row.append(badge(l.tier, 'Deep-time arrivals (#29): catalogue stars integrated through the Milky Way model; the panel lists the sources.'), document.createTextNode(` ${l.text}`));
      return row;
    }));
  }
  const invQ = new THREE.Quaternion(), gv = new THREE.Vector3();
  const screenWord = (x, y) => (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'RIGHT' : 'LEFT') : (y > 0 ? 'UP' : 'DOWN'));
  let lastReadout = '';
  function drawGauge() {
    invQ.copy(camera.quaternion).invert();
    const words = [];
    for (const a of AXES) {
      gv.copy(a.v).applyQuaternion(invQ); // x right, y up, z towards the viewer
      const x = gv.x * 40, y = -gv.y * 40, away = gv.z < 0;
      a.ln.setAttribute('x2', x.toFixed(1)); a.ln.setAttribute('y2', y.toFixed(1));
      a.ln.setAttribute('stroke-dasharray', away ? '3 3' : '');
      a.ln.setAttribute('opacity', away ? '0.55' : '1');
      a.tx.setAttribute('x', (gv.x * 52).toFixed(1)); a.tx.setAttribute('y', (-gv.y * 52).toFixed(1));
      a.tx.setAttribute('opacity', away ? '0.55' : '1');
      if (a.text === 'GC' || a.text === 'N') words.push(Math.hypot(gv.x, gv.y) < 0.35 ? `${a.text} ${away ? 'INTO SCREEN' : 'TOWARDS YOU'}` : `${a.text} ${screenWord(gv.x, gv.y)}`);
    }
    const text = words.join(' · ');
    if (text !== lastReadout) { readout.textContent = text; lastReadout = text; }
  }

  // camera controls (#39): stars are the bodies FLY speeds up near and returns to ORBIT around
  const eachStar = (fn) => { for (const p of placed) if (!p.hidden) { const v = p.now ?? p.pos; fn(v.x, v.y, v.z); } };
  const rig = createCameraRig({
    key: 'navigation', camera, controls, dom: labels.domElement, container, target, metersPerUnit: METERS.ly, className: 'beside-gauge',
    nearest: (pos) => Math.max(0.01, nearestPoint(pos, eachStar)),
    ahead: (pos, dir) => aheadPoint(pos, dir, eachStar),
    fit: () => { if (data) rig.frameSphere(chartOffset, data.radiusLy, 1.04); },
    reset: () => { if (!data) return; const r = data.radiusLy; rig.flyTo({ target: chartOffset, position: chartOffset.clone().add(new THREE.Vector3(r * 0.8, r * 1.1, r * 1.9)) }); },
  });

  const beaconV = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (rig.update()) {
      // glide the orbit target to the selected star
      if (controls.target.distanceToSquared(target) > 1e-6) {
        const delta = tmp.copy(target).sub(controls.target).multiplyScalar(motionK(0.08));
        controls.target.add(delta);
        camera.position.add(delta);
      }
      controls.update();
    }
    stepMessage(performance.now());
    const show = settings.get('labels');
    for (const p of placed) if (p.label) p.label.visible = !p.hidden && !!(show || p.star.id === 'sol' || p.star.id === data.center.id || p.star.id === selectedId);
    renderer.render(scene, camera);
    labels.render(scene, camera);
    drawGauge();

    const sol = placed.find((p) => p.star.id === 'sol');
    if (sol) {
      const solNow = posAt(sol);
      beaconV.copy(solNow).project(camera);
      const behind = solNow.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
      onFrame?.({ beacon: { x: beaconV.x, y: beaconV.y, behind, atFocus: data.center.id === 'sol',
        visible: !behind && Math.abs(beaconV.x) <= 1 && Math.abs(beaconV.y) <= 1 } });
    }
  }

  // In a spectrum band: what size and the hollow markers mean (the System View's sky follows the same rule)
  const bandKey = document.createElement('div');
  bandKey.className = 'drift-badge nav-band-key';
  bandKey.hidden = true;
  container.appendChild(bandKey);
  function drawBandKey() {
    const { band, pass, full } = currentBand();
    bandKey.hidden = full;
    if (full) return;
    const name = band.id === 'custom' ? 'CUSTOM CURVE' : `${band.label}${pass?.label ? ` · ${pass.label}` : ''}`;
    const nDark = placed.filter((p) => navStarLook(p.star).dark).length;
    const line = (tier, text, why) => { const row = document.createElement('div'); row.className = 'drift-line'; row.append(badge(tier, why), document.createTextNode(` ${text}`)); return row; };
    bandKey.replaceChildren(
      line('computed', `${name}: STAR SIZE = BRIGHTNESS IN THIS BAND (BLACKBODY AT T_EFF VS V, VEGA SYSTEM)`, 'Spectrum filter (#28): each star\'s absolute magnitude shifted by its computed band-minus-V colour, as in the System View sky.'),
      ...(nDark ? [line('computed', `○ ${nDark} NOT OBSERVED IN THIS BAND: A PHOTOSPHERE EMITS ALMOST NOTHING HERE · POSITION ONLY`, 'No measured flux of these stars in this band; the hollow marker keeps their place on the chart.')] : []));
  }

  /** Re-colour and re-size the stars for the current spectrum band (#28); the frame loop applies size0. */
  function recolourBand() {
    const c = ptsGeo?.attributes?.color, dk = ptsGeo?.attributes?.dark;
    if (!c) return;
    placed.forEach((p, i) => { const look = navStarLook(p.star); c.setXYZ(i, ...look.rgb); dk.setX(i, look.dark ? 1 : 0); p.size0 = look.size; });
    c.needsUpdate = true; dk.needsUpdate = true;
    for (const s of drift.stars) s.rgb = null;
    if (data) setEpoch(epoch); // re-sizes the chart, its planet-host rings and the arrivals
    drawBandKey();
  }
  return {
    recolourBand,
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    load, select, sendMessage, clearMessage,
    camera: rig,
    setMotion(m) { motion = { ...motion, ...m, pickedWindow: motion.pickedWindow || 'window' in m }; setEpoch(epoch); },
    get unmoved() { return unmovedCount(); },
    setEpoch, encounters,
    /** Deep-time arrivals (#29): load status, and a star (on the chart or far) by id. */
    get arrivals() { return drift.status && { ...drift.status, shown: shown.length, departed }; },
    findStar(id) { return placed.find((x) => x.star.id === id)?.star ?? drift.stars.find((s) => s.id === id) ?? null; },
    get epoch() { return epoch; },
    get motion() { return motion; },
    get message() { return msg?.state ?? null; },
    setMessageSpeed(lyPerSec) { // keep the pulse where it is
      if (!msg) return;
      const travelled = msg.state?.travelled ?? 0;
      msg.lyPerSec = lyPerSec;
      msg.t0 = performance.now() - (travelled / lyPerSec) * 1000;
    },
    get data() { return data; },
    get selectedId() { return selectedId; },
  };
}
