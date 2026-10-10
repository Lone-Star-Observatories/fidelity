// A volumetric model of the Milky Way (#22), drawn as particles in galactocentric scene
// coordinates (kly; Sgr A* at the origin, the Sun at (−R₀, z₀, 0), rotation towards −z).
// Every component comes from a published structural fit; the far side of the spiral arms
// is extrapolated from our side, which is the part that has been measured. Badged MODELLED.
//
//   Bar / bulge: Wegg & Gerhard 2013 (MNRAS 435, 1874): bar angle ~27° (near end at l > 0),
//     boxy/peanut bulge scale lengths ≈ 1.5 × 0.5 × 0.4 kpc; long bar to ~5 kpc
//     (Wegg, Gerhard & Portail 2015).
//   Discs: Bland-Hawthorn & Gerhard 2016 (ARA&A 54, 529): thin disc R_d ≈ 2.6 kpc,
//     h_z ≈ 0.3 kpc; thick disc R_d ≈ 2.0 kpc, h_z ≈ 0.9 kpc.
//   Spiral arms: Reid et al. 2019 (ApJ 885, 131), log-spiral fits with a kink, to masers in
//     high-mass star-forming regions: ln(R/R_kink) = −(β − β_kink) tan ψ, with β the
//     galactocentric azimuth from the Sun's direction, increasing with Galactic rotation.
//     Arm width w = 0.336 + 0.036 (R − 8.15) kpc. Beyond the fitted β range the arms are
//     continued at a 12° pitch.
//   Stellar halo: ρ ∝ r^−3.5 (Deason et al. 2011) from 1 to 100 kpc.
//
// Spectrum filter (#28): setBand() re-weights every component by its spectrum through the band's
// filter (src/astro/galaxyband.js, MODELLED), turns the dust lanes from absorbing to glowing in the
// far-IR, and shows three components that only exist outside the visible:
//   Gas disc (HI): flat surface density to ~13 kpc then exponential (scale 3.75 kpc) to 30 kpc, a
//     third of it on the arms, flaring as h(R) = 0.15 kpc · e^((R − 8.15)/9.8) (Kalberla & Kerp 2009).
//   Fermi bubbles: two lobes from the centre to ~9 kpc above and below the plane, ~6 kpc wide,
//     edge-brightened (Su, Slatyer & Finkbeiner 2010).
//   eROSITA bubbles: two shells ~14 kpc tall and ~12 kpc wide (Predehl et al. 2020).

import * as THREE from 'three';
import { galaxyBandWeights } from '../../astro/galaxyband.js';
import { PAL_RGB } from '../system/starband.js';
import { paletteIndex } from '../system/bandskin.js';

const KLY_PER_KPC = 3.26156;
const DEG = Math.PI / 180;

// Reid et al. 2019, Table 2 (β in degrees, R in kpc, pitch angles in degrees, fitted β range).
export const ARMS = [
  { name: 'Norma–Outer', bk: 18, rk: 4.46, psiIn: -1.0, psiOut: 19.5, range: [5, 54] },
  { name: 'Scutum–Centaurus', bk: 23, rk: 4.91, psiIn: 14.1, psiOut: 12.1, range: [0, 104] },
  { name: 'Sagittarius–Carina', bk: 24, rk: 6.04, psiIn: 17.1, psiOut: 1.0, range: [-2, 97] },
  { name: 'Local (Orion Spur)', bk: 9, rk: 8.26, psiIn: 11.4, psiOut: 11.4, range: [-8, 34], spur: true },
  { name: 'Perseus', bk: 40, rk: 8.87, psiIn: 10.3, psiOut: 8.7, range: [-23, 115] },
  { name: 'Outer', bk: 18, rk: 12.24, psiIn: 3.0, psiOut: 9.4, range: [-16, 71] },
];
const EXTRA_PITCH = 12; // continuation beyond the fitted range (MODELLED)

/** Arm radius (kpc) at azimuth β (deg): Reid's kinked log spiral, continued at 12° beyond its fitted range. */
export function armRadius(arm, beta) {
  const seg = (b0, r0, psi, b) => r0 * Math.exp(-(b - b0) * DEG * Math.tan(psi * DEG));
  const fit = (b) => (b < arm.bk ? seg(arm.bk, arm.rk, arm.psiIn, b) : seg(arm.bk, arm.rk, arm.psiOut, b));
  const [lo, hi] = arm.range;
  if (beta < lo) return seg(lo, fit(lo), EXTRA_PITCH, beta);
  if (beta > hi) return seg(hi, fit(hi), EXTRA_PITCH, beta);
  return fit(beta);
}
/** Galactocentric scene position (kly) of azimuth β (deg), radius R (kpc), height z (kpc). */
export const armToScene = (beta, Rkpc, zkpc = 0) => [-Rkpc * KLY_PER_KPC * Math.cos(beta * DEG), zkpc * KLY_PER_KPC, -Rkpc * KLY_PER_KPC * Math.sin(beta * DEG)];

// deterministic random numbers so the model looks the same every load
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const VERT = `
  attribute float size; attribute vec3 color; varying vec3 vColor;
  uniform float uPixel; uniform float uScale; uniform float uMaxSize;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uPixel * clamp(uScale / max(-mv.z, 1e-3), 0.5, uMaxSize);
  }`;
const FRAG = `
  varying vec3 vColor; uniform float uGain; uniform float uAlpha; uniform vec3 uTint; uniform float uMono;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); if (a < 0.01) discard;
    vec3 c = mix(vColor, uTint * 0.6, uMono); // false colour in a band (#28)
    gl_FragColor = vec4(c * uGain, a * uAlpha); }`;

/**
 * Build the model. Returns { group, setBrightness(k), components } where components lists
 * each population and its particle count (for the panel's facts).
 */
export function createGalaxyModel({ pixelRatio = 1, seed = 20261010 } = {}) {
  const rand = rng(seed);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const expo = (scale) => -scale * Math.log(1 - rand());
  const group = new THREE.Group();
  const layers = [];
  const components = [], bandComponents = [];

  // key: the component's spectrum in src/astro/galaxyband.js; bandOnly: drawn only outside the visible (#28)
  function layer(name, n, sample, { additive = true, alpha = 1, scale = 60, gain = 1, key = null, bandOnly = false } = {}) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const s = sample(i);
      if (!s) continue;
      pos.set(s.p, k * 3); col.set(s.c, k * 3); size[k] = s.s; k++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(size.subarray(0, k), 1));
    const uniforms = { uPixel: { value: pixelRatio }, uScale: { value: scale }, uMaxSize: { value: 5 }, uGain: { value: 1 }, uAlpha: { value: alpha },
      uTint: { value: new THREE.Color(1, 1, 1) }, uMono: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = additive ? -1 : -2; // dust first, so the starlight adds on top of it
    group.add(pts);
    pts.visible = !bandOnly;
    layers.push({ m, pts, additive, alpha, gain, key, bandOnly });
    (bandOnly ? bandComponents : components).push({ name, count: k });
  }
  const jitter = (c, a = 0.12) => c.map((v) => Math.max(0, v * (1 + (rand() - 0.5) * a)));

  // thin disc: exponential in R (with the inner hole the bar carves out) and in z
  layer('THIN DISC', 60000, () => {
    const R = expo(2.6) + 0.5;
    if (R > 18 || (R < 3 && rand() < 0.7)) return null;
    const phi = rand() * 2 * Math.PI, z = (rand() < 0.5 ? -1 : 1) * expo(0.3);
    return { p: [R * KLY_PER_KPC * Math.cos(phi), z * KLY_PER_KPC, R * KLY_PER_KPC * Math.sin(phi)], c: jitter([0.55, 0.5, 0.42]), s: 2.6 };
  }, { gain: 0.9, key: 'thin' });
  // thick disc
  layer('THICK DISC', 14000, () => {
    const R = expo(2.0) + 0.3;
    if (R > 16) return null;
    const phi = rand() * 2 * Math.PI, z = (rand() < 0.5 ? -1 : 1) * expo(0.9);
    return { p: [R * KLY_PER_KPC * Math.cos(phi), z * KLY_PER_KPC, R * KLY_PER_KPC * Math.sin(phi)], c: jitter([0.45, 0.38, 0.28]), s: 2.4 };
  }, { alpha: 0.7, key: 'thick' });
  // bar and boxy/peanut bulge, rotated so the near end is at positive longitude (towards rotation, scene −z)
  const barAngle = 27 * DEG;
  const ca = Math.cos(barAngle), sa = Math.sin(barAngle);
  const placeBar = (x, y, z) => { // x along the bar, y in the plane, z up (kpc) → scene kly
    const sx = -(x * ca - y * sa), sz = -(x * sa + y * ca);
    return [sx * KLY_PER_KPC, z * KLY_PER_KPC, sz * KLY_PER_KPC];
  };
  layer('BULGE / BAR', 34000, (i) => {
    let x, y, z;
    if (i % 3 === 0) { // long bar: thin, to ~5 kpc
      x = (rand() < 0.5 ? -1 : 1) * Math.min(5.2, expo(1.9)); y = gauss() * 0.35; z = gauss() * 0.18;
    } else { // boxy bulge
      x = (rand() < 0.5 ? -1 : 1) * expo(1.46); y = (rand() < 0.5 ? -1 : 1) * expo(0.49); z = (rand() < 0.5 ? -1 : 1) * expo(0.39);
      if (Math.hypot(x, y) > 4) return null;
    }
    const r = Math.hypot(x, y, z), hot = Math.max(0, 1 - r / 3);
    return { p: placeBar(x, y, z), c: jitter([0.95, 0.72 + 0.15 * hot, 0.42 + 0.2 * hot]), s: 2.4 + 2 * hot };
  }, { gain: 0.7, key: 'bulge' });
  // nuclear star cluster around Sgr A*
  layer('NUCLEAR CLUSTER', 1500, () => {
    const r = expo(0.03); // ~30 pc scale (kpc)
    const u = rand() * 2 - 1, t = rand() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
    return { p: [r * s * Math.cos(t) * KLY_PER_KPC, r * u * KLY_PER_KPC, r * s * Math.sin(t) * KLY_PER_KPC], c: [1, 0.9, 0.7], s: 3 };
  }, { key: 'nuclear' });

  // spiral arms: young stars, dust lanes on the inner edge, HII regions
  const armPoint = (arm) => {
    for (let tries = 0; tries < 20; tries++) {
      const beta = arm.spur ? arm.range[0] - 6 + rand() * (arm.range[1] - arm.range[0] + 12) : -120 + rand() * 520;
      const R = armRadius(arm, beta);
      if (R < 3.2 || R > 17) continue;
      if (!arm.spur && rand() > R / 10) continue; // even density along the arm: sampling by angle over-weights the tight inner turns
      const w = 0.336 + 0.036 * (R - 8.15);
      return { beta, R, w: Math.max(0.15, w) };
    }
    return null;
  };
  const armStars = [], armDust = [], hii = [];
  for (const arm of ARMS) {
    const n = arm.spur ? 3500 : arm.name === 'Outer' ? 5000 : 10000;
    for (let i = 0; i < n; i++) {
      const a = armPoint(arm);
      if (a) armStars.push({ ...a, arm });
      if (i % 2 === 0) { const d = armPoint(arm); if (d) armDust.push(d); }
      if (i % 9 === 0) { const h = armPoint(arm); if (h) hii.push(h); }
    }
  }
  layer('SPIRAL ARMS (YOUNG STARS)', armStars.length, (i) => {
    const a = armStars[i];
    const dR = gauss() * a.w, z = gauss() * 0.09;
    return { p: armToScene(a.beta, a.R + dR, z), c: jitter([0.6, 0.72, 1.0], 0.2), s: 2.4 };
  }, { gain: 0.38, key: 'arms' });
  layer('HII REGIONS', hii.length, (i) => {
    const a = hii[i];
    return { p: armToScene(a.beta, a.R + gauss() * a.w * 0.6, gauss() * 0.05), c: [1, 0.35, 0.55], s: 4 + rand() * 5 };
  }, { gain: 0.55, key: 'hii' });
  layer('DUST LANES', armDust.length, (i) => {
    const a = armDust[i];
    return { p: armToScene(a.beta, a.R - a.w * 0.7 + gauss() * a.w * 0.3, gauss() * 0.05), c: [0.05, 0.035, 0.025], s: 9 };
  }, { additive: false, alpha: 0.38, key: 'dust' });
  // stellar halo: ρ ∝ r^−3.5 ⇒ dN/dr ∝ r^−1.5, sampled by inverse transform between 1 and 100 kpc
  layer('STELLAR HALO', 7000, () => {
    const a = 1 ** -0.5, b = 100 ** -0.5, r = (a - rand() * (a - b)) ** -2;
    const u = rand() * 2 - 1, t = rand() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
    return { p: [r * s * Math.cos(t) * KLY_PER_KPC, r * u * KLY_PER_KPC * 0.75, r * s * Math.sin(t) * KLY_PER_KPC], c: [0.4, 0.36, 0.3], s: 2 };
  }, { alpha: 0.6, key: 'halo' });

  // ---- outside the visible only (#28) ----------------------------------------------------------------
  // the gas disc: flat to 13 kpc, exponential beyond, flaring; a third on the arms
  const gasSigma = (R) => (R < 2 ? 0 : R < 4 ? 0.3 + 0.35 * (R - 2) : R < 13 ? 1 : Math.exp(-(R - 13) / 3.75));
  const flare = (R) => 0.15 * Math.exp((R - 8.15) / 9.8);
  layer('GAS DISC (HI · COSMIC RAYS)', 26000, (i) => {
    if (i % 3 === 0) {
      const a = armStars[(rand() * armStars.length) | 0]; // arms weighted as the young stars are (the Local spur is minor)
      return { p: armToScene(a.beta, a.R + gauss() * a.w * 0.8, gauss() * flare(a.R)), c: [0.6, 0.7, 1], s: 6 };
    }
    for (let tries = 0; tries < 30; tries++) {
      const R = 2 + rand() * 28;
      if (rand() > (R / 30) * gasSigma(R) * 2.3) continue;
      const phi = rand() * 2 * Math.PI, z = gauss() * flare(R);
      return { p: [R * KLY_PER_KPC * Math.cos(phi), z * KLY_PER_KPC, R * KLY_PER_KPC * Math.sin(phi)], c: [0.6, 0.7, 1], s: 6 };
    }
    return null;
  }, { gain: 0.16, key: 'gas', bandOnly: true });
  // bipolar lobes: ellipsoids (semi-axes a in the plane, c up) touching the centre, edge-brightened
  const lobes = (a, c, shell) => () => {
    const up = rand() < 0.5 ? -1 : 1, u = rand() * 2 - 1, t = rand() * 2 * Math.PI, sq = Math.sqrt(1 - u * u);
    const r = rand() < shell ? 0.85 + 0.15 * rand() : Math.cbrt(rand());
    return { p: [a * r * sq * Math.cos(t) * KLY_PER_KPC, up * (c + c * r * u) * KLY_PER_KPC, a * r * sq * Math.sin(t) * KLY_PER_KPC], c: [1, 1, 1], s: 8 };
  };
  layer('FERMI BUBBLES', 9000, lobes(3, 4.5, 0.65), { gain: 0.1, key: 'fermi', bandOnly: true });
  layer('EROSITA BUBBLES', 12000, lobes(6, 7, 0.85), { gain: 0.1, key: 'erosita', bandOnly: true });

  let look = { gain: 1, maxSize: 5, scale: null };
  /** View tuning: an overall gain, the largest point size, the distance scale for point sizes. */
  function tune(o) { look = { ...look, ...o }; for (const l of layers) { l.m.uniforms.uMaxSize.value = look.maxSize; if (look.scale) l.m.uniforms.uScale.value = look.scale; } setBrightness(current); }
  let current = 0.45;
  // the spectrum filter (#28): component weights, dust absorbing or glowing, false colour
  let bw = null, boost = 1, dustGlows = false;
  function setBrightness(k) {
    current = k;
    for (const l of layers) {
      const w = bw && l.key ? (l.key === 'dust' ? (dustGlows ? bw.dustGlow : Math.min(1.6, bw.dustAbsorb)) : bw[l.key] ?? 1) : 1;
      if (l.key === 'dust' && dustGlows) { l.m.uniforms.uGain.value = k * 0.25 * w * boost * look.gain; l.m.uniforms.uAlpha.value = l.alpha; continue; }
      if (l.additive) l.m.uniforms.uGain.value = k * l.gain * look.gain * w * (bw ? boost : 1);
      else l.m.uniforms.uAlpha.value = l.alpha * Math.min(1, 0.4 + k) * w;
    }
  }
  /** Follow the spectrum filter: `cb` is currentBand() ({ band, pass, full }). Returns the weights (null in full). */
  function setBand(cb) {
    const full = !cb || cb.full || !cb.pass?.filter;
    bw = full ? null : galaxyBandWeights(cb.pass.filter);
    const max = bw ? Math.max(...['thin', 'thick', 'bulge', 'nuclear', 'arms', 'hii', 'halo', 'gas', 'fermi', 'erosita'].map((x) => bw[x]), bw.dustAbsorb < 0.1 ? bw.dustGlow * 0.4 : 0) : 1;
    boost = bw && max > 0.01 ? Math.min(4, Math.max(1, 1 / max)) : 1; // faint bands are auto-levelled, never dimmed
    dustGlows = !!bw && bw.dustAbsorb < 0.1 && bw.dustGlow > 0.05;
    const mono = bw && cb.band.palette !== 'visible' ? 1 : 0, tint = PAL_RGB[paletteIndex(cb?.band?.palette)];
    for (const l of layers) {
      l.m.uniforms.uMono.value = mono;
      l.m.uniforms.uTint.value.setRGB(...tint);
      if (l.bandOnly) l.pts.visible = !!bw && (bw[l.key] ?? 0) > 0.005;
      if (l.key === 'dust') {
        const additive = dustGlows;
        if ((l.m.blending === THREE.AdditiveBlending) !== additive) { l.m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; l.m.needsUpdate = true; }
        l.m.uniforms.uMono.value = additive ? 1 : 0; // glowing dust takes the band's colour
        if (additive && !mono) l.m.uniforms.uTint.value.setRGB(1, 0.6, 0.4);
      }
    }
    setBrightness(current);
    return bw;
  }
  setBrightness(0.45);
  return { group, setBrightness, tune, setBand, components, bandComponents, get bandWeights() { return bw; } };
}
