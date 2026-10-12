// The 3D corona (#79): a volume ray-marched round the Sun in the System and Star views.
//
// One bounding sphere (radius = the band's extent, in solar radii) carries a shader that walks each pixel's line
// of sight through an emissivity built in the Sun's own frame (y = the rotation axis, so the corona is
// oriented by the real solar pole): src/data/corona.js gives the physics per band (Baumbach K + F corona in
// white light, hydrostatic n² in the EUV, an optically thick radio corona…) and the structure, measured on
// today's SOHO LASCO and SDO AIA images by server/corona.js (feed `corona`) or modelled for the solar cycle.
// Structure from disc images is placed with the same projection the disc images use (materials.js
// uEarthDir/uNorth), so EUV loops sit on the active regions the SDO image shows.
//
// Layers and their honesty (shown in the Sun's CORONA panel, coronaLayers):
//   streamer belt and streamers   MODELLED from MEASURED position angles (LASCO), placed on a belt sheet along each
//                                 line of sight (src/data/corona.js placeStreamer), so they hold from any side
//   active-region loops, holes    MODELLED shapes at MEASURED places (AIA 193 Å), or illustrative (IMAGINED)
//   fall-off                      MODELLED (Baumbach, hydrostatic, radio radius)
//   wisps, plumes, slow outflow   IMAGINED (value noise in direction; drifts outward slowly)
//   brightness                    to scale in EUV and radio; exaggerated (IMAGINED) in white light and IR
//
// Cost: the march takes 20–56 steps (more when the Sun is large on screen), only over the sphere's pixels, and at half
// resolution (createCoronaPass), lowered further on slow machines (createQualityGovernor: frame time → resolution and
// steps); the DETAIL slider's "+ 3D CORONA" step (setting `corona`) turns it off, leaving the old glare sprite.

import * as THREE from 'three';
import { effectiveNm } from '../../astro/bands.js';
import { coronaLook, coronaLayers, structureFromFeed, modelledStructure, resolveStructure, radioAbsorption, losIntegral, euvEmissivity, EMISSIVITY } from '../../data/corona.js';

const MAX_STR = 8, MAX_REG = 8, MAX_HOLE = 6, MAX_OCC = 8;
/** The render layer the corona lives on: the main render skips it, createCoronaPass draws it. */
export const CORONA_LAYER = 5;
const STANDALONE = import.meta.env?.MODE === 'standalone';

// ---- today's structure, shared by every view ------------------------------------------------------------
let feedP = null, feedAt = 0, feedData = null, feedVersion = 0;
const feedListeners = new Set();
/** The backend's measured structure (server/corona.js), refreshed every 30 minutes; null offline or in the standalone preview. */
export function loadCoronaFeed() {
  if (STANDALONE) return Promise.resolve(null);
  if (!feedP || Date.now() - feedAt > 30 * 60000) {
    feedAt = Date.now();
    feedP = fetch('/api/feed/corona').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const changed = JSON.stringify(j?.data ?? null) !== JSON.stringify(feedData);
      feedData = j?.data ?? null;
      if (changed) feedVersion++;
      if (changed) for (const fn of feedListeners) fn(feedData);
      return feedData;
    }).catch(() => null);
  }
  return feedP;
}
export const onCoronaFeed = (fn) => (feedListeners.add(fn), () => feedListeners.delete(fn));

const bandNm = (band, pass) => (!band || band.id === 'full' ? 550 : pass?.filter?.points?.length ? effectiveNm(pass.filter) : null);
/** The corona's look in a band (src/data/corona.js coronaLook), from currentBand()'s band and pass. */
export const lookFor = (band, pass) => coronaLook(band, pass, { effNm: bandNm(band, pass) });
/** The structure at Julian date jd: measured (feed) when within 14 days, else modelled for the cycle. */
export const structureAt = (jd) => structureFromFeed(feedData, jd) ?? modelledStructure(jd);
/** Rows for the Sun's CORONA panel section. */
export const coronaSummary = (band, pass, jd, opts = {}) => coronaLayers(lookFor(band, pass), structureAt(jd), { jd, ...opts });

/**
 * What a postcard (#40) must say about a drawn corona: { modelled: [...], imagined: [...], credit } for the provenance
 * line, or null when it is not drawn. The volume and fall-off are MODELLED; the fine wisps are IMAGINED, and so is the
 * brightness where it is exaggerated (white light, IR) and illustrative active regions (no measured structure).
 */
export function coronaPostcard(corona) {
  if (!corona?.mesh.visible || !corona.look || corona.look.kind === 'none') return null;
  const s = corona.structure, imagined = ['CORONA WISPS'];
  if ((corona.look.exaggeration ?? 1) > 3) imagined.push('CORONA BRIGHTNESS (EXAGGERATED)');
  if (s?.source !== 'measured') imagined.push('CORONA ACTIVE REGIONS (ILLUSTRATIVE)');
  const src = s?.source === 'measured' ? [s.sources?.coronagraph, s.sources?.euv].filter(Boolean) : [];
  return { modelled: ['3D CORONA'], imagined,
    credit: src.length ? `Corona structure measured on ${src.map((x) => x.instrument).join(' and ')} (${[...new Set(src.map((x) => x.credit))].join('; ')})` : null };
}

// ---- the shader ---------------------------------------------------------------------------------------------
const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uR; varying vec3 vPos;
  void main() {
    vPos = position * uR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;

const FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vPos;
  uniform vec3 uCam; uniform float uR; uniform float uTime; uniform float uSteps; uniform float uOpacity;
  uniform vec4 uW;     // weights: K corona, F corona, EUV, radio
  uniform vec4 uP;     // EUV scale height H, radio absorption, weight over the disc, gyro-resonance
  uniform vec4 uS;     // streamers, holes, plumes, wisps
  uniform vec4 uBelt;  // belt pole (xyz), sin(belt latitude offset)
  uniform float uBeltA; // its weight: lower when measured streamers are drawn as well
  uniform vec2 uPolar; // polar-hole edge (sin latitude), depth
  uniform vec4 uStr[${MAX_STR}]; uniform float uStrA[${MAX_STR}]; uniform int uNStr;
  uniform vec4 uStrT[${MAX_STR}]; // each streamer's direction along the belt sheet (xyz) and half-length there (rad)
  uniform vec4 uReg[${MAX_REG}]; uniform float uRegA[${MAX_REG}]; uniform int uNReg;
  uniform vec4 uHole[${MAX_HOLE}]; uniform float uHoleA[${MAX_HOLE}]; uniform int uNHole;
  uniform vec3 uEcl; uniform vec3 uCol; uniform float uGain; uniform float uLoops; uniform float uDustIn;
  uniform float uGamma; uniform float uLog; // display: log stretch, brightness uLog maps to ~0.1 and 1 to ~1 (a radial-filter look; 0 = linear)
  uniform vec3 uKc; uniform vec3 uKp; // Baumbach emissivity terms: F, K1, K2 (coefficient, power)
  uniform float uPix; // the pass's pixel size (rad)
  uniform vec4 uOcc[${MAX_OCC}]; uniform int uNOcc; // bodies in front of the Sun: centre minus camera (xyz) and radius (w), R☉ in the Sun's frame

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // coronal holes: polar caps and measured holes, opening out faster than radially (superradial expansion)
  float holeAt(vec3 d, float r) {
    float edge = uPolar.x - 0.25 * (1.0 - 1.0 / r);
    float h = uPolar.y * smoothstep(edge - 0.1, edge + 0.04, abs(d.y));
    for (int i = 0; i < ${MAX_HOLE}; i++) {
      if (i >= uNHole) break;
      float sz = uHole[i].w * (1.0 + 0.9 * (1.0 - 1.0 / r)); vec3 q = d - uHole[i].xyz;
      h = max(h, uHoleA[i] * exp(-dot(q, q) / (sz * sz)));
    }
    return clamp(h, 0.0, 1.0);
  }
  // helmet streamers: wide domes low down narrowing to stalks; the belt broken into helmets by noise
  float streamers(vec3 d, float r) {
    float helm = exp(-(r - 1.0) / 0.9), w = mix(0.06, 0.32, helm);
    float x = dot(d, uBelt.xyz) - uBelt.w;
    float s = uBeltA * exp(-x * x / (w * w)) * (0.3 + 0.9 * vnoise(d * 2.2 + 3.1));
    for (int i = 0; i < ${MAX_STR}; i++) { // each a fold of the belt sheet: narrow across it, stretched along it
      if (i >= uNStr) break;
      vec3 q = d - uStr[i].xyz; float wi = uStr[i].w * mix(0.8, 2.2, helm), li = max(uStrT[i].w, wi);
      float al = dot(q, uStrT[i].xyz); vec3 qa = q - uStrT[i].xyz * al;
      s += 2.2 * uStrA[i] * sqrt(wi / li) * exp(-dot(qa, qa) / (wi * wi) - al * al / (li * li));
    }
    return s * uS.x;
  }
  // IMAGINED fine structure: radial striations (noise in direction only) and puffs drifting slowly outwards
  float wisps(vec3 d, float r) {
    float a = vnoise(d * 15.0 + vec3(0.0, uTime * 0.004, 0.0)), b = vnoise(d * 43.0 - vec3(uTime * 0.003));
    float puff = vnoise(d * 5.0 + vec3(0.0, 0.0, r * 0.8 - uTime * 0.03));
    return mix(1.0, (0.15 + 1.6 * a * a + 0.9 * b * b) * (0.6 + 0.8 * puff), uS.w);
  }
  float regionGlow(vec3 d, float r) {
    float s = 0.0;
    for (int i = 0; i < ${MAX_REG}; i++) {
      if (i >= uNReg) break;
      vec3 q = d - uReg[i].xyz; float sz = uReg[i].w * 1.5 + 0.22 * (r - 1.0);
      s += uRegA[i] * exp(-dot(q, q) / (sz * sz)) * exp(-(r - 1.0) / 1.4);
    }
    return s;
  }
  // EUV loop arcades over active regions: a fan of near-semicircles across the region, tilted by Joy's law
  float loops(vec3 p, vec3 d, float r) {
    if (r > 1.5) return 0.0;
    float e = 0.0;
    for (int i = 0; i < ${MAX_REG}; i++) {
      if (i >= uNReg) break;
      vec3 c = uReg[i].xyz; float sz = uReg[i].w;
      vec3 q0 = d - c; if (dot(q0, q0) > sz * sz * 6.0 + 0.02) continue;
      vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), c) + vec3(1e-4, 0.0, 0.0)), nn = cross(c, t);
      t = normalize(t + 0.2 * sign(c.y) * nn);
      for (int k = 0; k < 4; k++) {
        float fk = float(k), ang = (fk - 1.5) * 0.24;
        vec3 tk = normalize(t * cos(ang) + nn * sin(ang)), n = normalize(cross(c, tk));
        float rho = sz * (0.4 + 0.3 * fk);
        vec3 q = p - c * (1.0 - 0.3 * rho);
        float dn = dot(q, n); vec3 qp = q - n * dn;
        float dist = length(vec2(dn, length(qp) - rho)), th = 0.009 + 0.004 * fk;
        e += uRegA[i] * exp(-dist * dist / (th * th)) * (1.25 - 0.15 * fk);
      }
    }
    return e;
  }
  float gyro(vec3 p) {
    float e = 0.0;
    for (int i = 0; i < ${MAX_REG}; i++) {
      if (i >= uNReg) break;
      vec3 q = p - uReg[i].xyz * 1.03; float sz = uReg[i].w * 0.5;
      e += uRegA[i] * exp(-dot(q, q) / (sz * sz));
    }
    return e;
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 ro = uCam, rd = normalize(vPos - uCam);
    float b = dot(ro, rd), c = dot(ro, ro) - uR * uR, h = b * b - c;
    if (h <= 0.0) discard;
    h = sqrt(h);
    float t0 = max(0.0, -b - h), t1 = -b + h;
    float h1 = b * b - (dot(ro, ro) - 1.0); bool hit = false;
    if (h1 > 0.0) { float th = -b - sqrt(h1); if (th > 0.0) { t1 = min(t1, th); hit = true; } }
    float cover = 1.0; // anti-aliased limbs: lines of sight grazing a body lose their corona over ~1.5 pass pixels
    for (int i = 0; i < ${MAX_OCC}; i++) { // the Moon in an eclipse, planets in transit or in front: the line of sight ends on them
      if (i >= uNOcc) break;
      vec3 oc = -uOcc[i].xyz; float rr2 = uOcc[i].w * uOcc[i].w, bo = dot(oc, rd), dm = length(cross(oc, rd)), ho = rr2 - dm * dm; // dm: miss distance, without cancellation
      if (ho > 0.0) { float to = -bo - sqrt(ho); if (to > 0.0 && to < t1) { t1 = to; hit = false; } }
      else if (-bo > 0.0 && -bo < t1) cover *= smoothstep(0.0, 1.5 * uPix, (dm - uOcc[i].w) / -bo);
    }
    if (t1 <= t0) discard;
    // samples crowd towards the closest approach to the Sun, where the emissivity peaks
    float tc = clamp(-b, t0, t1), L0 = tc - t0, L1 = t1 - tc;
    float jit = hash(vec3(gl_FragCoord.xy, fract(uTime * 0.37)));
    float L = 0.0, T = 1.0;
    for (int i = 0; i < 64; i++) {
      if (float(i) >= uSteps) break;
      float v = (float(i) + jit) / uSteps * 2.0 - 1.0, s = v * abs(v), side = s < 0.0 ? L0 : L1;
      float t = tc + s * side, ds = 2.0 * abs(v) * side * (2.0 / uSteps);
      vec3 p = ro + rd * t; float rr = length(p), r = max(rr, 1.0); vec3 d = p / rr;
      float hole = holeAt(d, r), str = streamers(d, r), wi = wisps(d, r), reg = regionGlow(d, r);
      float plume = uS.z * hole * pow(vnoise(d * 34.0 + vec3(0.0, uTime * 0.002, 0.0)), 5.0) * 5.0;
      float j = 0.0;
      if (uW.x > 0.0) j += uW.x * (uKc.y * pow(r, -uKp.y) + uKc.z * pow(r, -uKp.z)) * ((0.12 * (1.0 - 0.8 * hole * uS.y) + 2.5 * str + 0.8 * reg) * wi + plume);
      if (uW.y > 0.0) {
        float be = dot(d, uEcl), flt = mix(1.0, 1.0 / (1.0 + 3.0 * be * be), smoothstep(1.5, 8.0, r));
        float zone = uDustIn > 0.0 ? 0.15 + 0.85 * smoothstep(uDustIn * 0.4, uDustIn, r) : 1.0;
        j += uW.y * uKc.x * pow(r, -uKp.x) * flt * zone * mix(1.0, wi, 0.35) * (1.0 + 0.25 * str);
      }
      if (uW.z > 0.0) {
        float base = exp(-2.0 * (r - 1.0) / (uP.x * r));
        j += uW.z * (base * (1.0 - 0.85 * hole * uS.y) * mix(1.0, wi, 0.6) * (0.55 + 0.5 * str + 1.5 * reg) + uLoops * loops(p, d, rr) + plume * base * 0.4);
      }
      if (uW.w > 0.0) {
        float n = (0.036 * pow(r, -1.5) + 1.55 * pow(r, -6.0) + 2.99 * pow(r, -16.0)) / 4.576;
        float a = uP.y * n * n * (0.55 + 0.8 * str + reg) * (1.0 - 0.5 * hole * uS.y) * mix(1.0, wi, 0.5) * ds;
        L += T * (1.0 - exp(-a)) * uW.w; T *= exp(-a);
        j += uP.w * gyro(p) * 6.0;
      }
      L += T * j * ds * smoothstep(uR, uR * 0.6, rr); // nothing at the bounding sphere, so it has no edge
    }
    // over the disc only a share (the disc image already holds it), fading in across the limb so it has no hard edge
    if (hit) L *= mix(uP.z, 1.0, smoothstep(0.97, 1.0, length(ro - rd * b)));
    float I = L * uGain * cover;
    float v = uLog > 0.0 ? log(1.0 + I / uLog) / log(1.0 + 1.0 / uLog) : 1.0 - exp(-I);
    v = pow(min(v, 1.0), uGamma); // darker between the streamers
    vec3 col = uCol * v;
    col = mix(col, vec3(1.0), clamp((v - 0.92) * 2.0, 0.0, 0.4)) * uOpacity; // the brightest parts whiten
    float a = max(col.r, max(col.g, col.b));
    if (a < 0.003) discard;
    gl_FragColor = vec4(col / a, a);
    #include <colorspace_fragment>
  }`;

const v3 = (a) => new THREE.Vector3(...a);
const tmpQ = new THREE.Quaternion();

/** A corona for one Sun mesh: add `mesh` as a child of the photosphere mesh (local unit = 1 R☉, +y = solar north). */
export function createCorona() {
  const vec4s = (n) => Array.from({ length: n }, () => new THREE.Vector4());
  const u = {
    uCam: { value: new THREE.Vector3(0, 0, 10) }, uR: { value: 6 }, uTime: { value: 0 }, uSteps: { value: 32 }, uOpacity: { value: 1 },
    uW: { value: new THREE.Vector4() }, uP: { value: new THREE.Vector4(0.1, 0, 0, 0) }, uS: { value: new THREE.Vector4(1, 1, 1, 1) },
    uBelt: { value: new THREE.Vector4(0, 1, 0, 0) }, uBeltA: { value: 0.7 }, uPolar: { value: new THREE.Vector2(0.85, 0.5) },
    uStr: { value: vec4s(MAX_STR) }, uStrA: { value: new Array(MAX_STR).fill(0) }, uNStr: { value: 0 }, uStrT: { value: vec4s(MAX_STR) },
    uReg: { value: vec4s(MAX_REG) }, uRegA: { value: new Array(MAX_REG).fill(0) }, uNReg: { value: 0 },
    uHole: { value: vec4s(MAX_HOLE) }, uHoleA: { value: new Array(MAX_HOLE).fill(0) }, uNHole: { value: 0 },
    uEcl: { value: new THREE.Vector3(0, 1, 0) }, uCol: { value: new THREE.Color(1, 1, 1) }, uGain: { value: 1 }, uLog: { value: 0.003 }, uGamma: { value: 1 }, uLoops: { value: 0 }, uDustIn: { value: 0 },
    uKc: { value: v3(EMISSIVITY.map((e) => e[0])) }, uKp: { value: v3(EMISSIVITY.map((e) => e[1])) }, uOcc: { value: vec4s(MAX_OCC) }, uNOcc: { value: 0 }, uPix: { value: 0.001 },
  };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false; mesh.userData.corona = true;
  mesh.layers.set(CORONA_LAYER); // drawn by createCoronaPass at reduced resolution, not by the main render
  mesh.raycast = () => {};
  let look = null, structure = null, structKey = '', resolvedKey = '';

  function setLook(l) {
    look = l;
    const w = l.weights ?? {};
    u.uW.value.set(w.k ?? 0, w.f ?? 0, w.euv ?? 0, w.radio ?? 0);
    const absorb = w.radio ? radioAbsorption(Math.max(1.004, l.rTau)) : 0;
    const gain = l.kind === 'euv' ? 1.6 / losIntegral((r) => euvEmissivity(r, l.H), 1 + l.H / 2, { rMax: 4, n: 600 }) : w.radio ? 1 : l.gain * 1e-6;
    u.uP.value.set(l.H ?? 0.1, absorb, l.onDisc ?? 0, l.gyro ?? 0);
    u.uS.value.set(l.structure?.streamers ?? 1, l.structure?.holes ?? 1, l.structure?.plumes ?? 1, l.structure?.wisps ?? 1);
    u.uCol.value.setRGB(...(l.rgb ?? [1, 1, 1]));
    u.uGain.value = gain;
    u.uLog.value = l.kind === 'euv' ? 0.03 : w.radio ? 0.05 : 0.01;
    u.uGamma.value = l.kind === 'euv' || w.radio ? 1.2 : 1.1;
    u.uLoops.value = w.loops ?? 0;
    u.uDustIn.value = l.kind === 'dust' ? 4 : 0;
    u.uR.value = l.extent ?? 6;
    mesh.scale.setScalar(u.uR.value);
  }

  function setStructure(s, E, N) {
    const r = resolveStructure(s, E, N);
    u.uBelt.value.set(...r.belt.n, r.belt.sinLat0);
    u.uBeltA.value = r.streamers.length ? 0.3 : 0.8;
    u.uPolar.value.set(Math.sin((r.polar.lat * Math.PI) / 180), r.polar.depth);
    const fill = (arr, list, amps, n, key) => {
      const k = Math.min(n, list.length);
      for (let i = 0; i < n; i++) {
        const it = list[i];
        if (i < k) { arr[i].set(...it.dir, key(it)); amps[i] = it.strength ?? it.depth ?? 0; } else { arr[i].set(0, 1, 0, 0.1); amps[i] = 0; }
      }
      return k;
    };
    u.uNStr.value = fill(u.uStr.value, r.streamers, u.uStrA.value, MAX_STR, (t) => t.width);
    r.streamers.slice(0, MAX_STR).forEach((t, i) => u.uStrT.value[i].set(...(t.along ?? [1, 0, 0]), t.length ?? t.width));
    u.uNReg.value = fill(u.uReg.value, r.regions, u.uRegA.value, MAX_REG, (t) => t.size);
    u.uNHole.value = fill(u.uHole.value, r.holes, u.uHoleA.value, MAX_HOLE, (t) => t.size);
  }

  return {
    mesh,
    get look() { return look; },
    get structure() { return structure; },
    setBand(band, pass) { setLook(lookFor(band, pass)); },
    setLook,
    /**
     * Per frame. camLocal: the camera in the Sun mesh's frame (R☉); earthLocal: unit direction to Earth in that frame (the
     * disc images face it); eclLocal: ecliptic north; jd: the clock; pxRadius: the Sun's radius on screen (px);
     * occluders: bodies in front of the Sun, [{ rel (Vector3: centre minus camera, R☉ in the Sun's frame, worked out in
     * double precision so the Moon's limb is sharp in an eclipse), radius (R☉) }], largest first (up to 8 are used).
     */
    update({ on = true, camLocal, earthLocal, eclLocal = null, jd, now = performance.now(), pxRadius = 100, opacity = 1, occluders = [] }) {
      const show = on && look && look.kind !== 'none' && pxRadius > 1.5 && opacity > 0.01;
      mesh.visible = !!show;
      if (!show) return;
      const key = `${feedVersion}|${Math.floor(jd * 4)}`; // the structure is worked out again when the feed or the quarter-day changes
      if (key !== structKey) { structure = structureAt(jd); structKey = key; resolvedKey = ''; }
      const E = [earthLocal.x, earthLocal.y, earthLocal.z], rk = `${structKey}|${E.map((x) => x.toFixed(3)).join(',')}`;
      if (rk !== resolvedKey) { setStructure(structure, E, [0, 1, 0]); resolvedKey = rk; }
      u.uCam.value.copy(camLocal);
      if (eclLocal) u.uEcl.value.copy(eclLocal);
      u.uTime.value = (now / 1000) % 100000;
      u.uSteps.value = Math.round(Math.max(20, Math.min(56, 18 + pxRadius * 0.12)));
      u.uOpacity.value = opacity;
      const nOcc = Math.min(MAX_OCC, occluders.length);
      for (let i = 0; i < nOcc; i++) { const o = occluders[i]; u.uOcc.value[i].set(o.rel.x, o.rel.y, o.rel.z, o.radius); }
      u.uNOcc.value = nOcc;
      // from outside, the near side; from inside, the far side (the pass has no depth buffer, so nothing else hides it)
      const side = camLocal.length() < u.uR.value * 1.0001 ? THREE.BackSide : THREE.FrontSide;
      if (material.side !== side) { material.side = side; material.needsUpdate = true; }
    },
  };
}

// Adaptive quality: [resolution scale (× the pass's own), march steps (×)], best first. The pass watches the frame
// interval while the corona is drawn and steps down when frames are slow, back up when there is time to spare.
export const CORONA_QUALITY = [[1, 1], [1, 0.75], [0.75, 0.6], [0.5, 0.5], [0.4, 0.4]];
/**
 * The adaptive quality controller, free of WebGL so it can be tested: tick(dtMs) with each frame interval while the
 * corona is drawn; `level` indexes CORONA_QUALITY. Steps down after ~1 s averaging slower than `slowMs` (default 28 ms,
 * ~35 fps), up after ~4 s faster than `fastMs` (19 ms); a level that proved too slow right after stepping up is not
 * tried again. Each interval counts at most 100 ms (one long frame, such as after a postcard render, cannot decide);
 * intervals over 5 s (a hidden tab) are ignored.
 */
export function createQualityGovernor({ slowMs = 28, fastMs = 19, levels = CORONA_QUALITY.length } = {}) {
  let level = 0, floor = 0, avg = 16.7, frames = 0, sinceUp = Infinity, upTo = -1;
  return {
    get level() { return level; },
    get avg() { return avg; },
    tick(dt) {
      if (!(dt > 0) || dt > 5000) return level;
      avg += (Math.min(dt, 100) - avg) * 0.08; frames++; sinceUp++; // clamped, so one long frame cannot decide
      if (frames >= 30 && avg > slowMs && level < levels - 1) {
        if (sinceUp < 120 && level === upTo) floor = Math.max(floor, level + 1); // stepped up into it and it was too slow: stay below
        level++; frames = 0; avg = (slowMs + fastMs) / 2;
      } else if (frames >= 240 && avg < fastMs && level > floor) { level--; frames = 0; sinceUp = 0; upTo = level; }
      return level;
    },
  };
}

/**
 * Draws the corona at a fraction of the screen resolution and adds it over the frame: the ray march per pixel is the
 * costly part, and the corona is soft, so half resolution (a quarter of the pixels) looks the same. Call after the
 * main render. Bodies in front of it are not depth-tested here; the shader ends each line of sight on the Sun and on
 * the bodies passed to update's `occluders`. Slow frames lower the resolution and step count (createQualityGovernor);
 * render(…, { full: true }) (postcards) always draws at the best level. `edgeFade` (a fraction of the canvas) fades
 * the corona to nothing towards the canvas edges, for views whose canvas is a box on the page (the Star View).
 */
export function createCoronaPass(renderer, { scale = 0.5, edgeFade = 0 } = {}) {
  const rt = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, type: THREE.HalfFloatType });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tMap: { value: rt.texture }, uEdge: { value: edgeFade } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tMap; uniform float uEdge;
      void main() { vec3 c = texture2D(tMap, vUv).rgb;
        if (uEdge > 0.0) { vec2 e = min(vUv, 1.0 - vUv); c *= smoothstep(0.0, uEdge, e.x) * smoothstep(0.0, uEdge, e.y); }
        float a = max(c.r, max(c.g, c.b)); if (a < 0.003) discard;
        gl_FragColor = vec4(c / a, min(a, 1.0));
        #include <colorspace_fragment>
      }` }));
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene().add(quad), quadCam = new THREE.Camera(), size = new THREE.Vector2(), cc = new THREE.Color();
  const governor = createQualityGovernor();
  let last = 0;
  return {
    governor,
    /** `corona`: the createCorona() object (skipped when hidden). `full`: best quality, not timed (postcards). */
    render(scene, camera, corona, { full = false } = {}) {
      if (!corona?.mesh.visible) { last = 0; return; }
      if (!full) {
        const now = performance.now();
        if (last) governor.tick(now - last);
        last = now;
      }
      const [qs, qk] = CORONA_QUALITY[full ? 0 : governor.level];
      renderer.domElement.dataset.coronaQuality = full ? 0 : governor.level;
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, Math.floor(size.x * scale * qs)), h = Math.max(1, Math.floor(size.y * scale * qs));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      const su = corona.mesh.material.uniforms.uSteps, steps = su.value;
      corona.mesh.material.uniforms.uPix.value = ((camera.fov ?? 50) * Math.PI) / 180 / h;
      su.value = Math.max(12, Math.round(steps * qk));
      const mask = camera.layers.mask, bg = scene.background, auto = renderer.autoClear, ca = renderer.getClearAlpha();
      renderer.getClearColor(cc);
      camera.layers.set(CORONA_LAYER); scene.background = null;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.setClearColor(cc, ca);
      camera.layers.mask = mask; scene.background = bg; su.value = steps;
      renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = auto;
    },
    dispose() { rt.dispose(); quad.geometry.dispose(); quad.material.dispose(); },
  };
}

/** The Sun's on-screen radius in pixels for a perspective camera. */
export function sunPixelRadius(camera, worldRadius, distance, heightPx) {
  if (!(distance > worldRadius)) return 1e4;
  return (Math.atan(worldRadius / distance) / ((camera.fov * Math.PI) / 360)) * (heightPx / 2);
}

/** World direction `wDir` in object `obj`'s local frame (its world matrix must be current). */
export function toLocal(obj, wDir, out) {
  return out.copy(wDir).applyQuaternion(obj.getWorldQuaternion(tmpQ).invert()).normalize();
}
