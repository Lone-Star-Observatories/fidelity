// Quadrant View — our corner of the Milky Way, heliocentric, in the IAU galactic frame
// (plane horizontal, galactic centre to the right): the brightest catalogue stars, 7,000 star
// clusters from Gaia DR3 (Hunt & Reffert 2023) and landmark nebulae, over the calibrated
// Milky Way artwork so the Orion Spur, Perseus and Sagittarius arms sit under them.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eqToGal, frameToScene, teffFromBV, blackbodyRGB, LY_PER_PC } from '../../astro/frames.js';
import { R0_KLY, Z_SUN_KLY } from '../../astro/galaxy.js';
import { createGalaxyPlane } from '../galaxy/plane.js';
import { createGalaxyModel } from '../galaxy/model.js';
import { NEBULAE, FAMOUS_CLUSTERS, ageTeff } from '../../data/deepsky.js';
import { settings } from '../../settings.js';
import { pickPoint, onClicks } from '../pick.js';

const DEG = Math.PI / 180;
export const NEBULA_COLORS = { HII: 0xff6680, PN: 0x55ddbb, SNR: 0xcc99ff, dark: 0xb09a80, reflection: 0x7799ff };
const lbd = (l, b, d) => frameToScene([d * Math.cos(b * DEG) * Math.cos(l * DEG), d * Math.cos(b * DEG) * Math.sin(l * DEG), d * Math.sin(b * DEG)]);
const radec = (ra, dec, d) => frameToScene(eqToGal([d * Math.cos(dec * DEG) * Math.cos(ra * DEG), d * Math.cos(dec * DEG) * Math.sin(ra * DEG), d * Math.sin(dec * DEG)]));
export { ageTeff };

const POINTS_VERT = `
  attribute float size; attribute vec3 color; varying vec3 vColor; varying float vFar; uniform float uPixel; uniform float uRadius;
  void main() { vColor = color; vFar = length(position) > uRadius ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPixel; }`;
const POINTS_FRAG = `
  varying vec3 vColor; varying float vFar;
  void main() { if (vFar > 0.5) discard; float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`;

export function createQuadrantView(container, { onSelect, onFrame, onPickStar, onDrill } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 2e6);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 300000;

  // galaxy artwork under everything: galactocentric kly → heliocentric ly
  const plane = createGalaxyPlane({ opacity: 0.85 });
  plane.scale.setScalar(1000);
  plane.position.set(R0_KLY * 1000, -Z_SUN_KLY * 1000, 0);
  plane.renderOrder = -2;
  scene.add(plane);
  const model = createGalaxyModel({ pixelRatio: renderer.getPixelRatio() });
  model.group.scale.setScalar(1000);
  model.group.position.copy(plane.position);
  // up close each particle stands for millions of stars: keep them faint and small behind the real ones
  model.tune({ scale: 1500, maxSize: 1.6, gain: 0.3 });
  scene.add(model.group);
  const applyLook = () => { plane.visible = !!settings.get('galaxyArt'); model.setBrightness(settings.get('galaxyBright') ?? 0.45); };
  applyLook();

  const uniforms = { uPixel: { value: renderer.getPixelRatio() }, uRadius: { value: 3000 } };
  const pointsMat = () => new THREE.ShaderMaterial({ uniforms, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false });
  function makePoints(rows) { // rows: [x, y, z, size, r, g, b]
    const n = rows.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    rows.forEach((r, i) => { pos.set(r.slice(0, 3), i * 3); size[i] = r[3]; col.set(r.slice(4, 7), i * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, pointsMat());
    p.frustumCulled = false;
    scene.add(p);
    return p;
  }

  // ---- chart: rings, quadrant spokes ----------------------------------------------------------
  const chart = new THREE.Group();
  scene.add(chart);
  const tags = []; // { obj, kind, dist, always }
  function tag(text, cls, pos, { kind = 'chart', always = false, onClick = null } = {}) {
    const el = document.createElement(onClick ? 'button' : 'div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    if (onClick) { el.addEventListener('pointerdown', (e) => e.stopPropagation()); el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); }); }
    const o = new CSS2DObject(el);
    o.position.copy(pos);
    o.center.set(-0.12, 0.5);
    scene.add(o);
    tags.push({ obj: o, kind, dist: pos.length(), always });
    return o;
  }
  function drawChart(R) {
    for (const o of [...chart.children]) { chart.remove(o); o.geometry.dispose(); o.material.dispose(); }
    for (const t of tags.filter((x) => x.kind === 'chart')) { scene.remove(t.obj); t.obj.element.remove(); }
    tags.splice(0, tags.length, ...tags.filter((x) => x.kind !== 'chart'));
    for (const r of [R / 3, R]) {
      const pts = [];
      for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      chart.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9977aa, transparent: true, opacity: 0.35 })));
      tag(`${(r / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} KLY`, 'ring', new THREE.Vector3(r * Math.cos(-0.35), 0, r * Math.sin(-0.35)));
    }
    for (const [l, text] of [[0, 'TO GALACTIC CENTRE'], [90, 'DIRECTION OF ROTATION'], [180, 'ANTICENTRE'], [270, 'l 270°']]) {
      const v = new THREE.Vector3(...lbd(l, 0, 1));
      chart.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), v.clone().multiplyScalar(R * 1.05)]), new THREE.LineBasicMaterial({ color: 0xff9966, transparent: true, opacity: 0.3 })));
      tag(text, 'spoke', v.clone().multiplyScalar(R * 1.1));
    }
    ['I', 'II', 'III', 'IV'].forEach((q, i) => tag(`QUADRANT ${q}`, 'quadrant', new THREE.Vector3(...lbd(45 + i * 90, 0, R * 0.7))));
  }

  // ---- content ----------------------------------------------------------------------------------
  let stars = null, clusterPts = null, nebPts = null, clusterRows = [];
  const objects = []; // selectable: { id, name, kind, pos, facts }

  let starRows = [];
  function setStars(d) { // /api/galaxy rows [gx, gy, gz (ly), absmag×10, ci×100, id]
    if (stars || !d?.stars) return;
    starRows = d.stars;
    stars = makePoints(d.stars.map(([x, y, z, m10, ci]) => {
      const c = blackbodyRGB(teffFromBV(ci == null ? 0.6 : ci / 100));
      return [...frameToScene([x, y, z]), Math.max(1.6, 4.5 - (m10 / 10) * 0.6), c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    }));
  }

  function setClusters(d) { // /api/clusters rows [name, l, b, distPc, members, logAge, type]
    if (clusterPts || !d?.rows) return;
    clusterRows = d.rows;
    clusterPts = makePoints(d.rows.map(([, l, b, pc, n, age, type]) => {
      const c = blackbodyRGB(ageTeff(age));
      return [...lbd(l, b, pc * LY_PER_PC), type === 'g' ? 9 : Math.max(2.5, Math.min(9, 1.6 * Math.log10(n ?? 10) + 1)), c[0], c[1], c[2]];
    }));
    for (const [name, l, b, pc, n, age, type] of d.rows) {
      const common = FAMOUS_CLUSTERS[name];
      if (!common) continue;
      const pos = new THREE.Vector3(...lbd(l, b, pc * LY_PER_PC));
      const id = `cl-${name}`;
      objects.push({ id, name: common, catalogue: name, kind: type === 'g' ? 'globular cluster' : 'open cluster', pos, distLy: pc * LY_PER_PC, members: n, logAge: age });
      tag(common.toUpperCase(), 'host', pos, { kind: 'object', onClick: () => onSelect?.(id) });
    }
  }

  function addNebulae() {
    const rows = NEBULAE.map(([name, kind, ra, dec, ly, note]) => {
      const pos = new THREE.Vector3(...radec(ra, dec, ly));
      const id = `neb-${name}`;
      objects.push({ id, name, kind, pos, distLy: ly, note });
      tag(name.toUpperCase(), `neb neb-${kind}`, pos, { kind: 'object', onClick: () => onSelect?.(id) });
      const c = new THREE.Color(NEBULA_COLORS[kind]);
      return [pos.x, pos.y, pos.z, 11, c.r, c.g, c.b];
    });
    nebPts = makePoints(rows);
  }
  addNebulae();
  tag('SOL · SECTOR 001', 'sol', new THREE.Vector3(), { always: true });

  let radius = 3000;
  function setRadius(R) {
    radius = R;
    uniforms.uRadius.value = R * 1.02;
    drawChart(R);
    controls.maxDistance = R * 6;
    target.set(0, 0, 0);
    camera.position.set(R * 0.35, R * 1.0, R * 1.4);
  }
  const target = new THREE.Vector3();

  // click a star to investigate it (#23); double-click to open Navigation centred on it
  function pickStar(e) {
    if (!stars) return null;
    const pos = stars.geometry.attributes.position.array;
    const hit = pickPoint(pos, pos.length / 3, stars, camera, renderer.domElement.getBoundingClientRect(), e.clientX, e.clientY, 8);
    if (!hit) return null;
    const r = starRows[hit.index];
    if (Math.hypot(r[0], r[1], r[2]) > radius * 1.02) return null; // filtered out of view by the shader
    return { kind: 'hyg', id: r[5] ?? null, gal: [r[0], r[1], r[2]], distLy: Math.hypot(r[0], r[1], r[2]) };
  }
  onClicks(labels.domElement, {
    click: (e) => { const p = pickStar(e); if (p) onPickStar?.(p); },
    dblclick: (e) => onDrill?.(pickStar(e)),
  });

  let selected = null;
  function select(id) {
    selected = objects.find((o) => o.id === id) ?? null;
    for (const t of tags) t.obj.element.classList.toggle('selected', !!selected && t.obj.position.equals(selected.pos));
    if (selected) target.copy(selected.pos);
    return selected;
  }

  let running = false;
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false); labels.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  const tmp = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (controls.target.distanceToSquared(target) > 1) {
      const delta = tmp.copy(target).sub(controls.target).multiplyScalar(0.08);
      controls.target.add(delta); camera.position.add(delta);
    }
    controls.update();
    const show = settings.get('labels');
    for (const t of tags) t.obj.visible = !!(t.always || t.kind === 'chart' || (show && t.dist <= radius * 1.02) || (selected && t.obj.position.equals(selected.pos)));
    renderer.render(scene, camera);
    labels.render(scene, camera);
    onFrame?.({});
  }
  setRadius(3000);

  return {
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    setStars, setClusters, setRadius, select, applyLook,
    get radius() { return radius; },
    get objects() { return objects; },
    /** Counts of what lies within the current radius. */
    counts() {
      const R = radius / LY_PER_PC;
      return { clusters: clusterRows.filter((r) => r[3] <= R).length, nebulae: NEBULAE.filter((n) => n[4] <= radius).length };
    },
  };
}
