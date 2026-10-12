// Quadrant View — our corner of the Milky Way, heliocentric, in the IAU galactic frame
// (plane horizontal, galactic centre to the right): the brightest catalogue stars, 7,000 star
// clusters from Gaia DR3 (Hunt & Reffert 2023) and landmark nebulae, over the calibrated
// Milky Way artwork so the Orion Spur, Perseus and Sagittarius arms sit under them.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { eqToGal, frameToScene, teffFromBV, blackbodyRGB, LY_PER_PC } from '../../astro/frames.js';
import { bandStarColour, currentBand, onBand } from '../../data/bandstate.js';
import { R0_KLY, Z_SUN_KLY } from '../../astro/galaxy.js';
import { createGalaxyPlane } from '../galaxy/plane.js';
import { createGalaxyModel } from '../galaxy/model.js';
import { NEBULAE, FAMOUS_CLUSTERS, ageTeff } from '../../data/deepsky.js';
import { settings } from '../../settings.js';
import { pickPoint, onClicks } from '../pick.js';
import { createDeepSky3D } from './deepsky3d.js';
import { createCameraRig, motionK, nearestPoint, aheadPoint } from '../cameraControls.js';
import { METERS } from '../cameraMath.js';
import { radecVec } from '../../astro/skyplane.js';
import { fetchClusterMembers, nebulaImageUrl } from '../../data/catalog.js';
import { makeSnapshot } from '../snapshot.js';
import { trekFor, trekGal } from '../../data/trek.js';

const DEG = Math.PI / 180;
export const NEBULA_COLORS = { HII: 0xff6680, PN: 0x55ddbb, SNR: 0xcc99ff, dark: 0xb09a80, reflection: 0x7799ff };
const lbd = (l, b, d) => frameToScene([d * Math.cos(b * DEG) * Math.cos(l * DEG), d * Math.cos(b * DEG) * Math.sin(l * DEG), d * Math.sin(b * DEG)]);
const radec = (ra, dec, d) => frameToScene(eqToGal([d * Math.cos(dec * DEG) * Math.cos(ra * DEG), d * Math.cos(dec * DEG) * Math.sin(ra * DEG), d * Math.sin(dec * DEG)]));
export { ageTeff };

const IMG_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const POINTS_VERT = `
  attribute float size; attribute vec3 color; varying vec3 vColor; varying float vFar; uniform float uPixel; uniform float uRadius;
  void main() { vColor = color; vFar = length(position) > uRadius ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPixel; }`;
const POINTS_FRAG = `
  varying vec3 vColor; varying float vFar;
  void main() { if (vFar > 0.5) discard; float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d); if (a < 0.02) discard; gl_FragColor = vec4(vColor, a); }`;

export function createQuadrantView(container, { onSelect, onFrame, onPickStar, onDrill, onDetail, onTrek } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 2e6);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.05; // close enough to walk round a planetary nebula (#24)
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
  model.setBand(currentBand()); onBand((cb) => model.setBand(cb)); // the spectrum filter (#28)
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
    for (const t of tags.filter((x) => x.kind === 'chart' || x.kind === 'trekchart')) { scene.remove(t.obj); t.obj.element.remove(); }
    tags.splice(0, tags.length, ...tags.filter((x) => x.kind !== 'chart' && x.kind !== 'trekchart'));
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
    drawTrekChart(R);
  }

  // ---- the Star Trek layer (#25, #41), IMAGINED -------------------------------------------------------------
  // Star Trek's Alpha/Beta border runs from the galactic core through Sol (as in Star Charts and the Galaxy
  // View); at 30 kly the Gamma/Delta border through the core comes into range too. Territories are soft
  // discs, places are pink labels (homeworlds and features appear as you zoom in); all clickable for a card.
  const TREK_COLOR = 0xff88aa;
  const trekChart = new THREE.Group(), trekGroup = new THREE.Group();
  scene.add(trekChart, trekGroup);
  const dashed = (pts, opacity = 0.7, dash = 20) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: TREK_COLOR, transparent: true, opacity, dashSize: dash, gapSize: dash * 0.7, depthWrite: false }));
    l.computeLineDistances();
    return l;
  };
  function trekTag(text, cls, pos, extra) {
    const o = tag(text, `trek ${cls}`, pos, extra);
    o.center.set(1.08, 0.5); // left of the point: real labels sit to the right
    return o;
  }
  function drawTrekChart(R) {
    for (const o of [...trekChart.children]) { trekChart.remove(o); o.geometry.dispose(); o.material.dispose(); }
    const gc = new THREE.Vector3(...lbd(0, 0, 1)), rot = new THREE.Vector3(...lbd(90, 0, 1));
    trekChart.add(dashed([gc.clone().multiplyScalar(-R), gc.clone().multiplyScalar(Math.min(R, R0_KLY * 1000))], 0.65, R / 50));
    const q = (text, v) => trekTag(text, 'quad', v, { kind: 'trekchart', onClick: () => onTrek?.('quadrants') }).center.set(0.5, 0.5);
    q('ALPHA QUADRANT · STAR TREK', rot.clone().multiplyScalar(-R * 0.5));
    q('BETA QUADRANT · STAR TREK', rot.clone().multiplyScalar(R * 0.5));
    if (R > R0_KLY * 1000) { // the core: Gamma beyond Alpha, Delta beyond Beta
      const core = gc.clone().multiplyScalar(R0_KLY * 1000), half = Math.sqrt(R * R - (R0_KLY * 1000) ** 2);
      trekChart.add(dashed([core.clone().addScaledVector(rot, -half), core.clone().addScaledVector(rot, half)], 0.65, R / 50));
      q('GAMMA QUADRANT', core.clone().addScaledVector(gc, R * 0.04).addScaledVector(rot, -half * 0.45));
      q('DELTA QUADRANT', core.clone().addScaledVector(gc, R * 0.04).addScaledVector(rot, half * 0.45));
    }
  }
  // a soft disc in the galactic plane for a territory or a region
  const DISC_FRAG = `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
    void main() { float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.55, r) * uOpacity + smoothstep(0.9, 0.97, r) * smoothstep(1.0, 0.97, r) * uOpacity * 1.6;
      if (a < 0.004) discard; gl_FragColor = vec4(uColor, a); }`;
  function softDisc(pos, radius, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(TREK_COLOR) }, uOpacity: { value: opacity } }, vertexShader: IMG_VERT, fragmentShader: DISC_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    m.renderOrder = -1;
    return m;
  }
  const trekPlaces = []; // { t, pos, dist }
  for (const t of trekFor('quadrant')) {
    const p = t.placement;
    if (p.type === 'star' || p.type === 'gal') {
      const pos = new THREE.Vector3(...(p.type === 'star' ? radec(p.raDeg, p.decDeg, p.distLy) : frameToScene(trekGal(p))));
      const territory = t.kind === 'territory';
      if (p.radiusLy) trekGroup.add(softDisc(pos, p.radiusLy, territory ? 0.13 : 0.22));
      const o = trekTag(`${territory ? '' : '◇ '}${t.name.toUpperCase()}${t.confidence === 'fan' && !territory ? ' ≈' : ''}`, territory ? 'territory' : 'world', territory ? pos.clone().add(new THREE.Vector3(0, 0, p.radiusLy * 0.75)) : pos,
        { kind: 'trek', onClick: () => onTrek?.(t.id) });
      if (territory) o.center.set(0.5, 0.5);
      trekPlaces.push({ t, pos, o, dist: pos.length(), lod: p.type === 'star' ? Infinity : territory ? 2600 : 650 });
      if (p.type !== 'star' && !p.radiusLy) { // a pip for a point place
        const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([pos.x, pos.y, pos.z], 3));
        trekGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, color: TREK_COLOR })));
      } else if (p.type === 'star') { // a pink ring round the real star (never a change to the star itself)
        const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([pos.x, pos.y, pos.z], 3));
        trekGroup.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { uPixel: uniforms.uPixel }, transparent: true, depthWrite: false,
          vertexShader: 'uniform float uPixel; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 22.0 * uPixel; }',
          fragmentShader: 'void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.45, d) * smoothstep(0.36, 0.41, d); if (a < 0.02) discard; gl_FragColor = vec4(1.0, 0.53, 0.67, a); }' })));
      }
    } else if (p.type === 'arc') {
      const pts = [];
      for (let l = p.l[0]; l <= p.l[1]; l += 1) pts.push(new THREE.Vector3(...lbd(l, 0, p.distLy)));
      trekGroup.add(dashed(pts, 0.85, 4));
      const mid = new THREE.Vector3(...lbd((p.l[0] + p.l[1]) / 2, 0, p.distLy));
      trekPlaces.push({ t, pos: mid, o: trekTag(`${t.name.toUpperCase()} ≈`, 'world', mid, { kind: 'trek', onClick: () => onTrek?.(t.id) }), dist: mid.length(), lod: 900 });
    } else if (p.type === 'path') { // the Bajoran wormhole: its Alpha end here, a dashed pointer towards the Gamma end
      const a = new THREE.Vector3(...frameToScene(trekGal({ l: p.points[0][0], b: p.points[0][1], distLy: p.points[0][2] })));
      const b = new THREE.Vector3(...frameToScene(trekGal({ l: p.points.at(-1)[0], b: p.points.at(-1)[1], distLy: p.points.at(-1)[2] })));
      trekGroup.add(dashed([a, a.clone().add(b.clone().sub(a).setLength(400))], 0.6, 8));
      const end = a.clone().add(b.clone().sub(a).setLength(400));
      trekPlaces.push({ t, pos: end, o: trekTag(`${t.name.toUpperCase()} → GAMMA QUADRANT`, 'world', end, { kind: 'trek', onClick: () => onTrek?.(t.id) }), dist: end.length(), lod: 900 });
    }
  }

  // ---- content ----------------------------------------------------------------------------------
  let stars = null, clusterPts = null, nebPts = null, clusterRows = [], clusterPos = [];
  const ds = createDeepSky3D({ scene, makePoints, fetchMembers: fetchClusterMembers, imageUrl: nebulaImageUrl });
  ds.onChange = () => { onDetail?.(); };
  const objects = []; // selectable: { id, name, kind, pos, facts }

  let starRows = [];
  function setStars(d) { // /api/galaxy rows [gx, gy, gz (ly), absmag×10, ci×100, id]
    if (stars || !d?.stars) return;
    starRows = d.stars;
    stars = makePoints(d.stars.map(([x, y, z, m10, ci]) => {
      const t = teffFromBV(ci == null ? 0.6 : ci / 100), c = bandStarColour(t, blackbodyRGB(t)); // spectrum filter (#28)
      return [...frameToScene([x, y, z]), Math.max(1.6, 4.5 - (m10 / 10) * 0.6), c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    }));
  }

  function setClusters(d) { // /api/clusters rows [name, l, b, distPc, members, logAge, type]
    if (clusterPts || !d?.rows) return;
    clusterRows = d.rows;
    clusterPos = d.rows.map(([, l, b, pc]) => new THREE.Vector3(...lbd(l, b, pc * LY_PER_PC)));
    ds.addClusterNebulosity(d.rows);
    clusterPts = makePoints(d.rows.map(([, l, b, pc, n, age, type]) => {
      const c = blackbodyRGB(ageTeff(age));
      return [...lbd(l, b, pc * LY_PER_PC), type === 'g' ? 9 : Math.max(2.5, Math.min(9, 1.6 * Math.log10(n ?? 10) + 1)), c[0], c[1], c[2]];
    }));
    for (const [name, l, b, pc, n, age, type] of d.rows) {
      const common = FAMOUS_CLUSTERS[name];
      if (!common) continue;
      const pos = new THREE.Vector3(...lbd(l, b, pc * LY_PER_PC));
      const id = `cl-${name}`;
      objects.push(clusterObject(d.rows.find((r) => r[0] === name), common));
      tag(common.toUpperCase(), 'host', pos, { kind: 'object', onClick: () => onSelect?.(id) });
    }
  }

  function clusterObject([name, l, b, pc, n, age, type, r50], common = null) {
    return { id: `cl-${name}`, name: common ?? name, catalogue: name, kind: type === 'g' ? 'globular cluster' : type === 'm' ? 'moving group' : 'open cluster',
      pos: new THREE.Vector3(...lbd(l, b, pc * LY_PER_PC)), distLy: pc * LY_PER_PC, members: n, logAge: age, r50pc: r50 };
  }
  const extra = new Map(); // clusters selected without a landmark label (clicked dots, navigation list)
  function objectById(id) {
    let o = objects.find((x) => x.id === id) ?? extra.get(id);
    if (!o && id?.startsWith('cl-')) {
      const r = clusterRows.find((x) => x[0] === id.slice(3));
      if (r) { o = clusterObject(r); extra.set(id, o); }
    }
    return o ?? null;
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
    ds.init(NEBULAE);
    // stars inside nebulae: labelled while their nebula is selected, clickable into the star card
    for (const m of ds.starMeta) {
      const el = document.createElement('button');
      el.className = 'nav-label host neb-star';
      el.textContent = m.name.toUpperCase();
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); onPickStar?.(nebulaStarPick(m)); });
      const o = new CSS2DObject(el);
      o.position.copy(m.pos); o.center.set(-0.12, -0.6); o.visible = false; // below the nebula's own label
      scene.add(o);
      starTags.push({ obj: o, nebula: m.nebula });
    }
  }
  const starTags = [];
  const nebulaStarPick = (m) => ({ kind: 'gaia', eq: radecVec(m.ra, m.dec), distLy: m.distLy, name: m.name });
  addNebulae();
  tag('SOL · SECTOR 001', 'sol', new THREE.Vector3(), { kind: 'sol', always: true }); // not 'chart': drawChart clears those

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
    return { kind: 'hyg', id: r[5] ?? null, gal: [r[0], r[1], r[2]], distLy: Math.hypot(r[0], r[1], r[2]), px: hit.px };
  }
  // clicks also reach cluster member stars and stars inside nebulae (#24), and select nebulae and clusters by their dots
  function pickAny(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cands = [];
    const s = pickStar(e);
    if (s) cands.push({ px: s.px, star: s });
    const m = ds.pick(camera, rect, e.clientX, e.clientY, radius);
    if (m) cands.push({ px: m.px - 1, star: m.pick }); // members win ties: they are what is drawn there
    for (const [pts, ids] of [[nebPts, NEBULAE.map((n) => `neb-${n[0]}`)], [clusterPts, clusterRows.map((r) => `cl-${r[0]}`)]]) {
      if (!pts) continue;
      const a = pts.geometry.attributes.position.array, sz = pts.geometry.attributes.size.array;
      const hit = pickPoint((i) => (sz[i] > 0 ? tmpPick.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]) : tmpPick.set(0, 0, 1e9)), a.length / 3, null, camera, rect, e.clientX, e.clientY, 7);
      if (hit && tmpPick.set(a[hit.index * 3], a[hit.index * 3 + 1], a[hit.index * 3 + 2]).length() <= radius * 1.02) cands.push({ px: hit.px + 2, select: ids[hit.index] });
    }
    cands.sort((x, y) => x.px - y.px);
    return cands[0] ?? null;
  }
  const tmpPick = new THREE.Vector3();
  onClicks(labels.domElement, {
    click: (e) => { const p = pickAny(e); if (p?.star) onPickStar?.(p.star); else if (p?.select) onSelect?.(p.select); },
    dblclick: (e) => { const p = pickAny(e); onDrill?.(p?.star?.kind === 'hyg' ? p.star : null); },
  });

  let selected = null;
  let zoomGoal = null, zoomDir = null;
  function select(id) {
    const prev = selected;
    selected = objectById(id);
    for (const t of tags) t.obj.element.classList.toggle('selected', !!selected && t.obj.position.equals(selected.pos));
    if (selected) {
      target.copy(selected.pos);
      // fly in close enough to see its shape (#24): nebulae to ~3.5× their size (closer, parallax inside the volume blurs it), clusters to ~25× r50
      const neb = ds.nebulae.get(id);
      const size = selected.r50pc ? selected.r50pc * LY_PER_PC * 25 : neb ? neb.objectLy * 3.5 : null;
      if (size && prev !== selected) zoomGoal = Math.max(0.3, Math.min(size, 3000));
      // approach a nebula from Sol's side, so it first looks as it does from Earth
      zoomDir = neb && !id.startsWith('cl-') && prev !== selected ? selected.pos.clone().normalize().negate() : null;
      if (neb) neb.load();
      if (id.startsWith('cl-')) { const r = clusterRows.find((x) => `cl-${x[0]}` === id); if (r) ds.loadCluster(r[0], r); }
    }
    return selected;
  }
  controls.addEventListener('start', () => { zoomGoal = null; zoomDir = null; });

  let running = false, lastLazy = 0;
  // lazy 3D detail (#24): load images and member lists of what is big on screen; hide a marker
  // dot once the real thing is drawn there
  function lazyUpdate() {
    ds.update(camera, renderer.domElement.clientHeight || 800, radius, selected?.id ?? null, clusterRows, clusterPos);
    const nsz = nebPts?.geometry.attributes.size;
    if (nsz) {
      NEBULAE.forEach((n, i) => { const h = ds.nebulae.get(`neb-${n[0]}`); nsz.setX(i, h?.state === 'ready' && h.px > 30 ? 0 : 11); });
      nsz.needsUpdate = true;
    }
    const csz = clusterPts?.geometry.attributes.size;
    if (csz) {
      let dirty = false;
      clusterRows.forEach((r, i) => {
        const shown = ds.swarms.get(r[0])?.state === 'ready';
        const want = shown ? 0 : r[6] === 'g' ? 9 : Math.max(2.5, Math.min(9, 1.6 * Math.log10(r[4] ?? 10) + 1));
        if (csz.getX(i) !== want) { csz.setX(i, want); dirty = true; }
      });
      if (dirty) csz.needsUpdate = true;
    }
    for (const t of starTags) t.obj.visible = !!(selected && t.nebula === selected.name);
  }
  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false); labels.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  const tmp = new THREE.Vector3();
  // camera controls (#39): Sol, the clusters and the nebulae are what FLY speeds up near
  const eachObject = (fn) => {
    fn(0, 0, 0, 0);
    for (const o of objects) if (o.distLy <= radius * 1.02) fn(o.pos.x, o.pos.y, o.pos.z, sizeOf(o) / 3.5);
  };
  const sizeOf = (o) => { const neb = ds.nebulae.get(o.id); return o.r50pc ? o.r50pc * LY_PER_PC * 2 : neb ? neb.objectLy : 1; };
  const rig = createCameraRig({
    key: 'quadrant', camera, controls, dom: labels.domElement, container, target, metersPerUnit: METERS.ly, minFov: 0.1,
    nearest: (pos) => Math.max(0.05, nearestPoint(pos, eachObject)),
    ahead: (pos, dir) => aheadPoint(pos, dir, eachObject),
    fit: () => {
      zoomGoal = null; zoomDir = null;
      if (selected) rig.frameSphere(selected.pos, Math.max(0.2, sizeOf(selected)), 1.1);
      else rig.frameSphere(new THREE.Vector3(), radius, 1.02);
    },
    reset: () => { zoomGoal = null; zoomDir = null; rig.flyTo({ target: new THREE.Vector3(), position: new THREE.Vector3(radius * 0.35, radius * 1.0, radius * 1.4) }); },
  });
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (rig.update()) {
      if (controls.target.distanceToSquared(target) > 1) {
        const delta = tmp.copy(target).sub(controls.target).multiplyScalar(motionK(0.08));
        controls.target.add(delta); camera.position.add(delta);
      }
      if (zoomGoal) {
        const k = motionK(0.08);
        const off = tmp.copy(camera.position).sub(controls.target), len = off.length();
        const next = Math.exp(Math.log(len) + (Math.log(zoomGoal) - Math.log(len)) * k);
        off.divideScalar(len);
        if (zoomDir) off.lerp(zoomDir, k).normalize();
        camera.position.copy(controls.target).add(off.multiplyScalar(next));
        if (Math.abs(Math.log(next / zoomGoal)) < 0.01 && (!zoomDir || off.angleTo(zoomDir) < 0.01)) { zoomGoal = null; zoomDir = null; }
      }
      controls.update();
    }
    const camDist = rig.mode === 'orbit' ? camera.position.distanceTo(controls.target) : rig.nearest(); // FLY: the nearest object
    const near = Math.max(0.002, Math.min(1, camDist * 0.01));
    if (Math.abs(near - camera.near) > camera.near * 0.2) { camera.near = near; camera.updateProjectionMatrix(); }
    const now = performance.now();
    if (now - lastLazy > 400) { lastLazy = now; lazyUpdate(); }
    const show = settings.get('labels');
    const trekOn = !!settings.get('starfleet');
    trekGroup.visible = trekOn; trekChart.visible = trekOn;
    for (const t of tags) {
      if (t.kind === 'trekchart') { t.obj.visible = trekOn; continue; }
      if (t.kind === 'trek') continue;
      t.obj.visible = !!(t.always || t.kind === 'chart' || (show && t.dist <= radius * 1.02) || (selected && t.obj.position.equals(selected.pos)));
    }
    for (const p of trekPlaces) p.o.visible = trekOn && p.dist <= radius * 1.02 && camera.position.distanceTo(p.pos) < p.lod; // strict boolean for CSS2DRenderer
    ds.tick(camera, renderer.domElement.clientHeight || 800);
    renderer.render(scene, camera);
    labels.render(scene, camera);
    onFrame?.({});
  }
  setRadius(3000);

  /** Re-colour the stars for the current spectrum band (#28). */
  function recolourBand() {
    const c = stars?.geometry?.attributes?.color;
    if (!c) return;
    starRows.forEach(([, , , , ci], i) => { const t = teffFromBV(ci == null ? 0.6 : ci / 100), rgb = bandStarColour(t, blackbodyRGB(t)); c.setXYZ(i, rgb[0] * 0.8, rgb[1] * 0.8, rgb[2] * 0.8); });
    c.needsUpdate = true;
  }
  return {
    /** #40: re-render at w × h for a postcard (see views/snapshot.js). */
    snapshot: makeSnapshot({ renderer, scene, camera, labels, draw: () => { renderer.render(scene, camera); labels.render(scene, camera); }, restore: resize }),
    recolourBand,
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    setStars, setClusters, setRadius, select, applyLook,
    camera: rig,
    get radius() { return radius; },
    get objects() { return objects; },
    /** Any selectable object, including clusters without a landmark label. */
    object: (id) => objectById(id),
    /** 3D detail state for the panel (#24): the nebula's image stack, the cluster's member swarm, the stars inside. */
    detail(id) {
      const o = objectById(id);
      if (!o) return null;
      const neb = ds.nebulae.get(id) ?? (o.catalogue ? ds.nebulae.get(`cl-${o.catalogue}`) : null);
      return { neb, swarm: o.catalogue ? ds.swarms.get(o.catalogue) ?? null : null,
        stars: ds.starMeta.filter((m) => m.nebula === o.name).map((m) => ({ ...m, pick: () => onPickStar?.(nebulaStarPick(m)) })) };
    },
    /** Counts of what lies within the current radius. */
    counts() {
      const R = radius / LY_PER_PC;
      return { clusters: clusterRows.filter((r) => r[3] <= R).length, nebulae: NEBULAE.filter((n) => n[4] <= radius).length };
    },
  };
}
