// Comets (#19): a coma, a straight ion tail pointing directly away from the Sun and a curved
// dust tail lagging behind along the orbit, all growing as the comet nears the Sun.
//
// Brightness: total magnitude m = M1 + 5 log Δ + K1 log r (Δ from Earth, r from the Sun, AU),
// with M1, K1 from JPL SBDB. Activity: comets switch on as ices sublimate, water within ~3 AU
// (CO and CO2 farther out), so the coma and tails fade in between 5 and 3 AU. Sizes are scaled
// from Halley's 1986 apparition: coma ~10^5 km, ion tail up to ~0.6 AU, dust tail ~0.3 AU
// near perihelion (0.59 AU). The geometry is MODELLED; the particles are illustrative.

import * as THREE from 'three';

export const AU_KM = 149597870.7;
/** Total magnitude of an active comet. */
export const cometMagnitude = ({ M1, K1 }, deltaAU, rAU) => M1 + 5 * Math.log10(deltaAU) + K1 * Math.log10(rAU);
/** Activity 0–1: dormant beyond 5 AU, fully active inside 3 AU. */
export const cometActivity = (rAU) => { const t = Math.max(0, Math.min(1, (5 - rAU) / 2)); return t * t * (3 - 2 * t); };
/** Coma radius (km) and tail lengths (AU) at heliocentric distance r. */
export function cometSizes(rAU) {
  const a = cometActivity(rAU);
  return {
    activity: a,
    comaKm: a * 1.2e5 * Math.pow(Math.max(rAU, 0.3), -1.5),
    ionAU: a * Math.min(0.6, 0.12 * Math.pow(Math.max(rAU, 0.3), -2)),
    dustAU: a * Math.min(0.35, 0.07 * Math.pow(Math.max(rAU, 0.3), -2)),
  };
}

const VERT = `attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uPixel;
  void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPixel; }`;
const FRAG = `varying vec3 vColor; uniform float uAlpha; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * uAlpha; if (a < 0.004) discard; gl_FragColor = vec4(vColor * a, 1.0); }`;

function cloud(n, place, pixelRatio) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  for (let i = 0; i < n; i++) { const p = place(rand, gauss); pos.set(p.p, i * 3); col.set(p.c, i * 3); size[i] = p.s; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uPixel: { value: pixelRatio }, uAlpha: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

/** Build a comet's coma and tails. Local frame: +x away from the Sun, +y towards where it has been. */
export function createComet(pixelRatio = 1) {
  const group = new THREE.Group();
  const coma = cloud(1200, (r, g) => { const k = Math.abs(g()) * 0.45; const u = r() * 2 - 1, t = r() * 6.283, s = Math.sqrt(1 - u * u);
    return { p: [k * s * Math.cos(t), k * u, k * s * Math.sin(t)], c: [0.55, 0.75, 0.6], s: 3 + 6 * Math.max(0, 0.5 - k) }; }, pixelRatio);
  const ion = cloud(1600, (r, g) => { const x = Math.pow(r(), 0.8); return { p: [x, g() * 0.01 * (0.2 + x), g() * 0.01 * (0.2 + x)], c: [0.35, 0.55, 1].map((v) => v * (1 - 0.7 * x)), s: 2.5 }; }, pixelRatio);
  const dust = cloud(2200, (r, g) => { const x = Math.pow(r(), 0.9); return { p: [x, 0.35 * x * x + g() * 0.05 * x, g() * 0.02 * x], c: [1, 0.92, 0.75].map((v) => v * (1 - 0.6 * x)), s: 2.8 }; }, pixelRatio);
  group.add(coma, ion, dust);
  group.visible = false;
  const basis = new THREE.Matrix4(), a = new THREE.Vector3(), t = new THREE.Vector3(), n = new THREE.Vector3();
  return {
    group,
    /**
     * Place the comet: `antiSun` unit vector (Sun → comet), `trailing` (−velocity), heliocentric
     * distance r (AU), display radius of the nucleus (scene units) and the scene units per AU.
     */
    update(antiSun, trailing, rAU, nucleusR, auToScene = 1) {
      const sz = cometSizes(rAU);
      group.visible = sz.activity > 0.01;
      if (!group.visible) return sz;
      a.copy(antiSun).normalize();
      t.copy(trailing).addScaledVector(a, -trailing.dot(a)).normalize(); // trailing direction, perpendicular to the Sun line
      n.crossVectors(a, t);
      basis.makeBasis(a, t, n);
      group.quaternion.setFromRotationMatrix(basis);
      coma.scale.setScalar(Math.max((sz.comaKm / AU_KM) * auToScene, nucleusR * 6));
      ion.scale.setScalar(Math.max(sz.ionAU * auToScene, nucleusR * 20));
      dust.scale.setScalar(Math.max(sz.dustAU * auToScene, nucleusR * 12));
      for (const p of group.children) p.material.uniforms.uAlpha.value = 0.25 + 0.75 * sz.activity;
      return sz;
    },
  };
}
