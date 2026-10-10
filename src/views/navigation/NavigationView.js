// Navigation View — look outward from the current system: real stars within a radius,
// in the IAU galactic frame (galactic plane horizontal, galactic north up, the galactic
// centre to the right), centred on the current star. Planet hosts wear a ring; Sol is
// always marked as Sector 001.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eqToGal, frameToScene, starTeff, blackbodyRGB, LY_PER_PC } from '../../astro/frames.js';
import { settings } from '../../settings.js';

const DESIGNATION = /^(HIP|HD|HYG|Gliese|GJ|Gl|LHS|LP|G \d|Wolf|Ross|Luyten|Lacaille|Struve|BD|CD|LTT|2MASS|TOI|K2-|Kepler|WASP|HAT)/;

export function createNavigationView(container, { onSelect, onFrame }) {
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
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPixel;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixel; }`,
    fragmentShader: ring
      ? `varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.44, d) * smoothstep(0.34, 0.40, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`
      : `varying vec3 vColor; void main() { float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.22, 0.0, d); float halo = smoothstep(0.5, 0.0, d) * 0.45;
          float a = max(core, halo); if (a < 0.02) discard; gl_FragColor = vec4(vColor * (0.7 + core * 0.6), a); }`,
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

  function label(text, cls, pos, onClick) {
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
    world.add(o);
    return o;
  }

  function line(points, color, opacity) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    world.add(l);
    return l;
  }

  // Galactic-plane chart: distance rings, quadrant spokes (IAU quadrants I–IV by longitude).
  function drawChart(radiusLy) {
    const steps = [5, 10, 25, 50, 100].filter((r) => r <= radiusLy);
    if (!steps.includes(radiusLy)) steps.push(radiusLy);
    for (const r of steps) {
      const pts = [];
      for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      line(pts, 0x9977aa, r === radiusLy ? 0.5 : 0.22);
      label(`${r} LY`, 'ring', new THREE.Vector3(r * Math.cos(-0.35), 0, r * Math.sin(-0.35)));
    }
    const spokes = [[0, 'GALACTIC CENTRE · l 0°'], [90, 'l 90° · ROTATION'], [180, 'ANTICENTRE · l 180°'], [270, 'l 270°']];
    for (const [l, text] of spokes) {
      const v = new THREE.Vector3(...frameToScene([Math.cos(l * Math.PI / 180), Math.sin(l * Math.PI / 180), 0]));
      line([new THREE.Vector3(), v.clone().multiplyScalar(radiusLy * 1.08)], 0xff9966, 0.28);
      label(text, 'spoke', v.clone().multiplyScalar(radiusLy * 1.12));
    }
    ['I', 'II', 'III', 'IV'].forEach((q, i) => {
      const l = (45 + i * 90) * Math.PI / 180;
      label(`QUADRANT ${q}`, 'quadrant', new THREE.Vector3(...frameToScene([Math.cos(l), Math.sin(l), 0])).multiplyScalar(radiusLy * 0.72));
    });
  }

  /** Show stars around `d.center` (from /api/nearby). */
  function load(d) {
    msg = null;
    clearWorld();
    data = d;
    selectedId = null;
    tempLabel = null;
    const c = d.center;
    placed = d.stars.map((s) => ({ star: s, pos: new THREE.Vector3(...lyFrom(s, c)) }));
    drawChart(d.radiusLy);

    const n = placed.length;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    const hostIdx = [];
    placed.forEach(({ star: s, pos: p }, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      // size encodes luminosity (absolute magnitude); colour comes from B−V or spectral class
      const M = s.absmag ?? 12;
      size[i] = Math.max(2.2, Math.min(15, 8.5 - 0.5 * M));
      col.set(blackbodyRGB(starTeff(s).teff), i * 3);
      if (s.planets) hostIdx.push(i);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    world.add(new THREE.Points(g, pointMat(false)));

    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hostIdx.flatMap((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]])), 3));
    hg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(hostIdx.map((i) => size[i] + 11)), 1));
    hg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(hostIdx.flatMap(() => [1, 0.6, 0])), 3));
    world.add(new THREE.Points(hg, pointMat(true)));

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
        line([p.pos.clone(), new THREE.Vector3(p.pos.x, 0, p.pos.z)], isSol ? 0x9999ff : 0xff9900, 0.25); // drop line to the plane
      }
    }

    const r = d.radiusLy;
    controls.maxDistance = r * 6;
    controls.minDistance = 0.2;
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

  let tempLabel = null; // label for a selected star that isn't labelled by default
  function select(id) {
    selectedId = id;
    const p = placed.find((x) => x.star.id === id);
    if (tempLabel) { world.remove(tempLabel); tempLabel.element.remove(); tempLabel = null; }
    for (const q of placed) q.label?.element.classList.toggle('selected', q.star.id === id);
    if (p && !p.label) {
      tempLabel = label(p.star.name.toUpperCase() + (p.star.planets ? ` · ${p.star.planets}` : ''), 'selected', p.pos, () => onSelect(id));
    }
    if (p) target.copy(p.pos);
  }

  // Screen-space picking: nearest star within 14 px of the click.
  let down = null;
  labels.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  labels.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !placed.length) return;
    const r = renderer.domElement.getBoundingClientRect();
    let best = null, bestD = 14;
    for (const p of placed) {
      tmp.copy(p.pos).project(camera);
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

  const beaconV = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    // glide the orbit target to the selected star
    if (controls.target.distanceToSquared(target) > 1e-6) {
      const delta = tmp.copy(target).sub(controls.target).multiplyScalar(0.08);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    controls.update();
    stepMessage(performance.now());
    const show = settings.get('labels');
    for (const p of placed) if (p.label) p.label.visible = show || p.star.id === 'sol' || p.star.id === data.center.id || p.star.id === selectedId;
    renderer.render(scene, camera);
    labels.render(scene, camera);

    const sol = placed.find((p) => p.star.id === 'sol');
    if (sol) {
      beaconV.copy(sol.pos).project(camera);
      const behind = sol.pos.clone().applyMatrix4(camera.matrixWorldInverse).z > 0;
      onFrame?.({ beacon: { x: beaconV.x, y: beaconV.y, behind, atFocus: data.center.id === 'sol',
        visible: !behind && Math.abs(beaconV.x) <= 1 && Math.abs(beaconV.y) <= 1 } });
    }
  }

  return {
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    load, select, sendMessage, clearMessage,
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
