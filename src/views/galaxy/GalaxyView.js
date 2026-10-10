// Galaxy View — the Milky Way face-on, with Sol and the catalogue stars where they really are.
//
// The image is NASA/JPL-Caltech/R. Hurt's artist's concept (PIA10748), built from Spitzer
// data: no one has photographed our galaxy from outside, so it is badged IMAGINED. It is
// calibrated against the annotated version (PIA19341: the same artwork, rotated, with the
// Sun marked) so that the galactic centre is at the image centre and Sol lands at the
// measured R₀ = 26.7 kly (GRAVITY Collaboration 2019). Units: thousands of light-years.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { teffFromBV, blackbodyRGB } from '../../astro/frames.js';
import { R0_KLY, Z_SUN_KLY, IMAGE, galToScene, imageMapper } from '../../astro/galaxy.js';

export { R0_KLY, Z_SUN_KLY, IMAGE, galToScene };
import { loadTexture } from '../system/materials.js';
import { settings } from '../../settings.js';

// Arm names, at PIA19341's label positions (1308 px image, centre 653.5).
const PIA19341 = { size: 1308, sun: [416.0, 668.8], labels: [
  ['PERSEUS ARM', 553, 418], ['ORION–CYGNUS SPUR', 470, 590], ['SCUTUM–CENTAURUS ARM', 800, 917],
  ['SAGITTARIUS–CARINA ARM', 788, 1033], ['OUTER ARM', 200, 503],
] };
// Satellite galaxies: galactic longitude, latitude (deg) and distance (kly).
const SATELLITES = [
  ['LARGE MAGELLANIC CLOUD', 280.47, -32.89, 163], ['SMALL MAGELLANIC CLOUD', 302.8, -44.3, 203],
  ['SAGITTARIUS DWARF', 5.6, -14.2, 85],
];

const DEG = Math.PI / 180;
const lbdToGal = (l, b, d) => [d * Math.cos(b * DEG) * Math.cos(l * DEG), d * Math.cos(b * DEG) * Math.sin(l * DEG), d * Math.sin(b * DEG)];

export function createGalaxyView(container, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels-layer';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 3000);
  const controls = new OrbitControls(camera, labels.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.05;
  controls.maxDistance = 900;

  // ---- the image, in the galactic plane --------------------------------------------------
  const W = IMAGE.widthKly;
  const map = imageMapper(IMAGE.sunOffset[0], IMAGE.sunOffset[1]);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, depthWrite: false }));
  // Orient the plane: image right → map(1,0), image down → map(0,1), normal → galactic north.
  {
    const [rx, rz] = map(1, 0), [dx, dz] = map(0, 1);
    const right = new THREE.Vector3(rx, 0, rz), up = new THREE.Vector3(-dx, 0, -dz), normal = new THREE.Vector3().crossVectors(right, up);
    plane.rotation.set(0, 0, 0);
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  }
  scene.add(plane);
  loadTexture('milkyWay').then((t) => {
    if (!t) return;
    plane.material.map = t;
    plane.material.color.set(0xffffff);
    plane.material.needsUpdate = true;
  });

  // ---- labels ------------------------------------------------------------------------------
  const tags = [];
  function tag(text, cls, pos, always = false) {
    const el = document.createElement('div');
    el.className = `nav-label ${cls}`;
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.position.set(...pos);
    o.center.set(-0.08, 0.5);
    scene.add(o);
    tags.push({ o, always });
    return o;
  }
  const sol = galToScene([0, 0, 0]);
  tag('◆ SOL · SECTOR 001', 'sol', sol, true);
  tag('SGR A* · GALACTIC CENTRE', 'center', [0, 0, 0], true);
  for (const [name, px, py] of PIA19341.labels) {
    // PIA19341 is PIA10748 rotated 90° clockwise; express its label in PIA10748 fractions first
    const c = (PIA19341.size - 1) / 2;
    const du = (px - c) / PIA19341.size, dv = (py - c) / PIA19341.size;
    const [x, z] = map(dv, -du).map((v) => v * W); // undo the 90° turn
    tag(name, 'spoke', [x, 0, z]);
  }
  for (const [name, l, b, d] of SATELLITES) {
    const p = galToScene(lbdToGal(l, b, d));
    tag(`${name} · ${d} KLY`, 'host', p, true);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x9999ff }));
    dot.position.set(...p);
    scene.add(dot);
  }

  // ---- quadrants ------------------------------------------------------------------------------
  const quadGroup = new THREE.Group(), fleetGroup = new THREE.Group();
  scene.add(quadGroup, fleetGroup);
  const line = (group, a, b, color, opacity = 0.45, dashed = false) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const m = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 1.5, gapSize: 1 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    group.add(l);
  };
  // IAU galactic quadrants: longitude spokes from the Sun
  const reach = 60;
  for (const l of [0, 90, 180, 270]) {
    const end = galToScene(lbdToGal(l, 0, reach));
    line(quadGroup, sol, end, 0xff9966, 0.5);
  }
  ['I', 'II', 'III', 'IV'].forEach((q, i) => {
    const p = galToScene(lbdToGal(45 + 90 * i, 0, 22));
    const o = tag(`QUADRANT ${q}`, 'quadrant', p);
    quadGroup.add(o);
  });
  // Starfleet's quadrants: centred on the galactic core, split along the core–Sol line (IMAGINED)
  {
    const R = 60;
    line(fleetGroup, [-R, 0, 0], [R, 0, 0], 0xcc6666, 0.7, true);
    line(fleetGroup, [0, 0, -R], [0, 0, R], 0xcc6666, 0.7, true);
    // seen from galactic north with Sol at the bottom: Alpha bottom-left, Beta bottom-right
    const fleet = [['ALPHA', -30, 30], ['BETA', -30, -30], ['GAMMA', 30, 30], ['DELTA', 30, -30]];
    for (const [n, x, z] of fleet) fleetGroup.add(tag(`${n} QUADRANT`, 'fleet', [x, 0, z]));
  }

  // ---- catalogue stars around Sol ------------------------------------------------------------
  let stars = null, reachRing = null;
  function setStars(d) {
    if (stars) { scene.remove(stars); stars.geometry.dispose(); stars.material.dispose(); }
    if (!d) return;
    const n = d.stars.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    d.stars.forEach(([gx, gy, gz, m10, ci100], i) => {
      pos.set(galToScene([gx, gy, gz], 0.001), i * 3);
      const c = blackbodyRGB(teffFromBV(ci100 != null ? ci100 / 100 : 0.6));
      const k = Math.min(1, Math.max(0.35, 0.9 - m10 / 40));
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    scene.add(stars);
    if (!reachRing) {
      const pts = [];
      for (let k = 0; k <= 128; k++) { const a = (k / 128) * Math.PI * 2; pts.push(new THREE.Vector3(sol[0] + Math.cos(a) * d.maxLy / 1000, sol[1], sol[2] + Math.sin(a) * d.maxLy / 1000)); }
      reachRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x9999ff, transparent: true, opacity: 0.7 }));
      scene.add(reachRing);
      tag(`STAR CATALOGUE REACH · ${(d.maxLy / 1000).toFixed(1)} KLY`, 'ring', [sol[0], sol[1], sol[2] - d.maxLy / 1000 - 0.2]);
    }
  }

  // ---- camera presets --------------------------------------------------------------------------
  const target = new THREE.Vector3(), want = { pos: null };
  function frameOn(centre, dist, tilt = 0.55) {
    target.set(...centre);
    want.pos = new THREE.Vector3(centre[0] - dist * 0.25, centre[1] + dist * Math.cos(tilt), centre[2] + dist * Math.sin(tilt));
  }
  frameOn([0, 0, 0], 150);
  camera.position.copy(want.pos);

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

  const tmp = new THREE.Vector3();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (want.pos) {
      controls.target.lerp(target, 0.08);
      camera.position.lerp(want.pos, 0.08);
      if (camera.position.distanceTo(want.pos) < 0.01 * want.pos.distanceTo(target) + 1e-4) want.pos = null;
    }
    controls.update();
    fleetGroup.visible = !!settings.get('starfleet');
    const show = settings.get('labels');
    for (const t of tags) if (!t.o.parent || t.o.parent === scene) t.o.visible = show || t.always;
    renderer.render(scene, camera);
    labels.render(scene, camera);
    tmp.set(...sol).project(camera);
    const behind = new THREE.Vector3(...sol).applyMatrix4(camera.matrixWorldInverse).z > 0;
    onFrame?.({ beacon: { x: tmp.x, y: tmp.y, behind, atFocus: false, visible: !behind && Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1 } });
  }

  return {
    show() { container.hidden = false; resize(); if (!running) { running = true; requestAnimationFrame(frame); } },
    hide() { container.hidden = true; running = false; },
    setStars,
    view(which) {
      if (which === 'galaxy') frameOn([0, 0, 0], 150);
      else if (which === 'sol') frameOn(sol, 5.5, 0.7);
      else if (which === 'centre') frameOn([0, 0, 0], 18, 0.6);
      else if (which === 'satellites') frameOn([-10, -40, -40], 320, 0.9);
    },
  };
}
