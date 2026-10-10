// Every active Earth satellite as a point. A worker runs SGP4 for the whole catalogue a few
// times a second; between updates the shader moves each point along its velocity, and applies
// the same radial compression as the moons (ENHANCED) so orbits sit correctly around Earth.

import * as THREE from 'three';
import SatWorker from './satellites.worker.js?worker&inline';

export const SAT_COLORS = {
  stations: 0xffcc33, science: 0xcc88ff, weather: 0x66ddff, earth: 0x55dd99, navigation: 0x99ee44,
  starlink: 0x8899bb, oneweb: 0x7799aa, comms: 0xff9966, military: 0xff5555, other: 0xdddddd,
};

const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 vel; attribute float cat; attribute float sel;
  uniform float uDt; uniform float uR; uniform float uRe; uniform float uMix; uniform float uPixel;
  uniform vec3 uColors[10]; uniform float uShow[10];
  varying vec3 vColor; varying float vShow; varying float vSel;
  void main() {
    int c = int(cat + 0.5);
    vColor = uColors[c]; vSel = sel;
    vec3 p = position + vel * uDt;
    float r = length(p);
    vShow = (uShow[c] > 0.5 && r == r && r > 0.0) ? 1.0 : 0.0;
    float x = r / uR;
    float f = x <= 1.0 ? x : 1.0 + 1.6 * log(x);
    float rE = uRe * f;
    float rD = rE * pow(r / rE, uMix);
    vec4 mv = modelViewMatrix * vec4(p * (rD / max(r, 1e-20)), 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = vShow > 0.5 ? (sel > 0.5 ? 9.0 : 2.4) * uPixel : 0.0;
    #include <logdepthbuf_vertex>
  }`;
const FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor; varying float vShow; varying float vSel;
  void main() {
    #include <logdepthbuf_fragment>
    if (vShow < 0.5) discard;
    float d = length(gl_PointCoord - 0.5);
    float ring = vSel > 0.5 ? smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.36, d) : 0.0;
    float a = vSel > 0.5 ? ring + smoothstep(0.2, 0.0, d) : smoothstep(0.5, 0.1, d) * 0.85;
    gl_FragColor = vec4(vSel > 0.5 ? vec3(1.0, 0.85, 0.4) : vColor, a);
  }`;

/** `data` from /api/satellites. Positions are geocentric (the object is placed at Earth each frame). */
export function createSatelliteLayer(data, pixelRatio) {
  const n = data.rows.length;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), cat = new Float32Array(n), sel = new Float32Array(n);
  data.rows.forEach((r, i) => { cat[i] = r[2]; pos[i * 3] = NaN; });
  const geo = new THREE.BufferGeometry();
  const pAttr = new THREE.BufferAttribute(pos, 3), vAttr = new THREE.BufferAttribute(vel, 3), sAttr = new THREE.BufferAttribute(sel, 1);
  pAttr.setUsage(THREE.DynamicDrawUsage); vAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pAttr); geo.setAttribute('vel', vAttr); geo.setAttribute('cat', new THREE.BufferAttribute(cat, 1)); geo.setAttribute('sel', sAttr);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uDt: { value: 0 }, uR: { value: 1 }, uRe: { value: 1 }, uMix: { value: 0 }, uPixel: { value: pixelRatio },
      uColors: { value: data.categories.map((c) => new THREE.Color(SAT_COLORS[c] ?? 0xdddddd)) }, uShow: { value: data.categories.map(() => 1) } },
  });
  // positions are rewritten by the worker (NaN until then): give the sorter a fixed sphere
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const index = new Map(data.rows.map((r, i) => [r[0], i]));

  const worker = new SatWorker();
  worker.postMessage({ rows: data.rows });
  let sampleJd = null, busy = false, lastAsk = 0;
  worker.onmessage = ({ data: { jd, buf } }) => {
    for (let i = 0; i < n; i++) {
      pos[i * 3] = buf[i * 6]; pos[i * 3 + 1] = buf[i * 6 + 1]; pos[i * 3 + 2] = buf[i * 6 + 2];
      vel[i * 3] = buf[i * 6 + 3]; vel[i * 3 + 1] = buf[i * 6 + 4]; vel[i * 3 + 2] = buf[i * 6 + 5];
    }
    pAttr.needsUpdate = vAttr.needsUpdate = true;
    sampleJd = jd; busy = false;
  };
  let selected = -1;
  return {
    points, count: n, index,
    /** Per frame: clock jd, Earth's true and enhanced radii (AU), scale mix. */
    update(jd, R, Re, mix, rateDaysPerSec) {
      const now = performance.now();
      // ask for fresh states: 4 Hz, faster when the clock runs fast (linear extrapolation drifts)
      const interval = Math.abs(rateDaysPerSec) > 0.01 ? 60 : 250;
      if (!busy && (sampleJd == null || now - lastAsk > interval)) { busy = true; lastAsk = now; worker.postMessage({ jd }); }
      mat.uniforms.uDt.value = sampleJd == null ? 0 : jd - sampleJd;
      mat.uniforms.uR.value = R; mat.uniforms.uRe.value = Re; mat.uniforms.uMix.value = mix;
    },
    showCategory(c, on) { const i = data.categories.indexOf(c); if (i >= 0) mat.uniforms.uShow.value[i] = on ? 1 : 0; },
    select(norad) {
      if (selected >= 0) sel[selected] = 0;
      selected = index.get(norad) ?? -1;
      if (selected >= 0) sel[selected] = 1;
      sAttr.needsUpdate = true;
    },
    dispose() { worker.terminate(); geo.dispose(); mat.dispose(); },
  };
}
