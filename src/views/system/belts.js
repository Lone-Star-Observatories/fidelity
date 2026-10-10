// Small-body populations drawn from their real orbits: every object is a point whose
// position is solved from its orbital elements on the GPU each frame (Kepler's equation in
// the vertex shader), so tens of thousands of asteroids move correctly as the clock runs.

import * as THREE from 'three';

const DEG = Math.PI / 180;
const GAUSS = 0.01720209895; // rad/day at 1 AU
export const POP_COLORS = { neo: 0xff7a5c, main: 0xc9a36a, trojan: 0x7fcf7f, centaur: 0x66bbee, tno: 0x9a9aff };

const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec4 el1; // a (AU), e, inclination, node (rad)
  attribute vec3 el2; // argument of perihelion, mean anomaly at the reference epoch (rad), mean motion (rad/day)
  attribute float pop;
  uniform float uDt; uniform float uPixel; uniform float uSize; uniform vec3 uColors[5]; uniform float uShow[5];
  varying vec3 vColor; varying float vShow;
  void main() {
    int p = int(pop + 0.5);
    vColor = uColors[p]; vShow = uShow[p];
    float e = el1.y, M = mod(el2.y + el2.z * uDt, 6.28318530718);
    float E = M + e * sin(M);
    for (int k = 0; k < 10; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
    float xp = el1.x * (cos(E) - e), yp = el1.x * sqrt(1.0 - e * e) * sin(E);
    float cw = cos(el2.x), sw = sin(el2.x), cO = cos(el1.w), sO = sin(el1.w), cI = cos(el1.z), sI = sin(el1.z);
    vec3 ecl = vec3((cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
                    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
                    (sw * sI) * xp + (cw * sI) * yp);
    vec4 mv = modelViewMatrix * vec4(ecl.x, ecl.z, -ecl.y, 1.0); // J2000 ecliptic → scene
    gl_Position = projectionMatrix * mv;
    gl_PointSize = vShow > 0.5 ? uSize * uPixel : 0.0;
    #include <logdepthbuf_vertex>
  }`;
const FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor; varying float vShow;
  void main() {
    #include <logdepthbuf_fragment>
    if (vShow < 0.5) discard;
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.15, d) * 0.75);
  }`;

/** Points for `data` from /api/smallbodies. Call `update(jd)` each frame. */
export function createBelts(data, pixelRatio) {
  const n = data.rows.length;
  const el1 = new Float32Array(n * 4), el2 = new Float32Array(n * 3), pop = new Float32Array(n), pos = new Float32Array(n * 3);
  const refJd = data.epochJd;
  data.rows.forEach(([p, a, e, i, node, w, M, dEpoch], k) => {
    const nRad = GAUSS / a ** 1.5;
    el1.set([a, e, i * DEG, node * DEG], k * 4);
    // shift each mean anomaly to the shared reference epoch (in double precision, here)
    el2.set([w * DEG, ((M * DEG - nRad * dEpoch) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), nRad], k * 3);
    pop[k] = p;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // unused: the shader computes positions
  geo.setAttribute('el1', new THREE.BufferAttribute(el1, 4));
  geo.setAttribute('el2', new THREE.BufferAttribute(el2, 3));
  geo.setAttribute('pop', new THREE.BufferAttribute(pop, 1));
  const colors = data.populations.map((k) => new THREE.Color(POP_COLORS[k] ?? 0xaaaaaa));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uDt: { value: 0 }, uPixel: { value: pixelRatio }, uSize: { value: 2.2 }, uColors: { value: colors }, uShow: { value: data.populations.map(() => 1) } },
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const counts = Object.fromEntries(data.populations.map((k, i) => [k, data.rows.filter((r) => r[0] === i).length]));
  return {
    points, counts, populations: data.populations, labels: data.labels,
    update(jd) { mat.uniforms.uDt.value = jd - refJd; },
    show(popKey, on) { const i = data.populations.indexOf(popKey); if (i >= 0) mat.uniforms.uShow.value[i] = on ? 1 : 0; },
  };
}
