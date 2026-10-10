// Regions around Sol and its planets: the geostationary ring, the Van Allen belts, Hill
// spheres, the heliosphere and the Oort cloud. Shapes near a planet are defined in that
// planet's radii and re-mapped through the System View's radial compression (ENHANCED) or
// exactly (TRUE), so they line up with the moons and satellites drawn around it.

import * as THREE from 'three';

const DEG = Math.PI / 180;
export const R_EARTH_KM = 6371;
export const GEO_KM = 42164; // geostationary orbit radius from Earth's centre
// IGRF-14 centred-dipole north pole, epoch 2025 (geographic latitude, east longitude)
export const DIPOLE_POLE = { lat: 80.8, lon: -72.6 };
// Van Allen belts as dipole L-shell ranges (Earth radii at the magnetic equator).
export const VAN_ALLEN = { inner: [1.2, 2.5], outer: [3.5, 6.5] };
// Heliosphere crossings by the Voyagers (AU) and the interstellar inflow direction (IBEX).
export const HELIO = { terminationShock: [94, 84], heliopause: [121.6, 119.0], noseLonLat: [255.7, 5.1] };

/** A line or mesh whose vertices are given in parent radii and re-mapped each time the scale changes. */
function localShape(object, unitPositions) {
  const base = Float32Array.from(unitPositions);
  const attr = object.geometry.attributes.position;
  let key = null;
  return {
    object,
    /** `map(x)` → displayed distance (AU) for x parent radii. */
    remap(map, cacheKey) {
      if (cacheKey === key) return;
      key = cacheKey;
      for (let k = 0; k < base.length; k += 3) {
        const x = base[k], y = base[k + 1], z = base[k + 2], r = Math.hypot(x, y, z);
        const s = r ? map(r) / r : 0;
        attr.setXYZ(k / 3, x * s, y * s, z * s);
      }
      attr.needsUpdate = true;
      object.geometry.computeBoundingSphere();
    },
  };
}

function circlePositions(r, n = 256) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = (k / n) * 2 * Math.PI; out.push(r * Math.cos(t), 0, r * Math.sin(t)); }
  return out;
}

/** Geostationary ring in Earth's equatorial plane (local +y = Earth's pole). */
export function geoRing() {
  const pts = circlePositions(GEO_KM / R_EARTH_KM);
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.7 }));
  line.frustumCulled = false;
  return localShape(line, pts);
}

/** Region between two dipole field-line shells L1 < L2 (r = L cos²λ, Earth radii), around local +y. */
function dipoleShell(L1, L2, color, opacity) {
  const profile = [];
  const line = (L, from, to, steps = 48) => {
    const lmax = Math.acos(Math.sqrt(1 / L)); // where the field line meets the surface
    for (let k = 0; k <= steps; k++) {
      const lam = (from + (to - from) * (k / steps)) * lmax;
      const r = L * Math.cos(lam) ** 2;
      profile.push(new THREE.Vector2(Math.max(1e-4, r * Math.cos(lam)), r * Math.sin(lam)));
    }
  };
  line(L2, -1, 1); line(L1, 1, -1);
  const geo = new THREE.LatheGeometry(profile, 96);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.frustumCulled = false;
  return localShape(mesh, Array.from(geo.attributes.position.array));
}

export function vanAllen() {
  return [
    dipoleShell(...VAN_ALLEN.inner, 0xff6644, 0.09), // protons
    dipoleShell(...VAN_ALLEN.outer, 0x4499ff, 0.07), // electrons
  ];
}

/** Hill sphere as three great circles, `x` = radius in planet radii. */
export function hillSphere(x, color) {
  const pts = [];
  const c = circlePositions(x, 128);
  for (let k = 0; k < c.length - 3; k += 3) pts.push(c[k], c[k + 1], c[k + 2], c[k + 3], c[k + 4], c[k + 5]);
  for (let k = 0; k < c.length - 3; k += 3) pts.push(c[k], c[k + 2], 0, c[k + 3], c[k + 5], 0);
  for (let k = 0; k < c.length - 3; k += 3) pts.push(0, c[k + 2], c[k], 0, c[k + 5], c[k + 3]);
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const seg = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }));
  seg.frustumCulled = false;
  return localShape(seg, pts);
}

/**
 * Heliosphere: termination shock and heliopause as blunt shells, nose towards the interstellar
 * inflow. Crossing distances are MEASURED (Voyagers); the overall shape is MODELLED, tail stretched.
 */
export function heliosphere(toScene) {
  const group = new THREE.Group();
  const [lon, lat] = HELIO.noseLonLat;
  const nose = new THREE.Vector3(...toScene([Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)])).normalize();
  const shell = (rNose, color) => {
    const g = new THREE.SphereGeometry(1, 48, 24);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const c = v.dot(nose); // 1 at the nose, −1 down the tail
      v.multiplyScalar(rNose * (1 + 0.9 * (1 - c) ** 1.5));
      p.setXYZ(k, v.x, v.y, v.z);
    }
    const m = new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.12 }));
    m.frustumCulled = false;
    return m;
  };
  const mean = (a) => (a[0] + a[1]) / 2;
  group.add(shell(mean(HELIO.terminationShock), 0x66ccff), shell(mean(HELIO.heliopause), 0xcc99ff));
  return { group, nose };
}

/** Oort cloud: points in a shell, inner 2,000 AU to outer 100,000 AU, denser inward (∝ r^-3.5). */
export function oortCloud(n = 9000) {
  const pos = new Float32Array(n * 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r0 = 2000, r1 = 100000; // number in a shell ∝ r² · r^-3.5 dr, so the CDF goes as r^-0.5
  for (let i = 0; i < n; i++) {
    const u = rand();
    const r = (r0 ** -0.5 + u * (r1 ** -0.5 - r0 ** -0.5)) ** -2;
    const z = rand() * 2 - 1, t = rand() * 2 * Math.PI, s = Math.sqrt(1 - z * z);
    // the inner (Hills) cloud is flattened towards the ecliptic
    const flat = r < 20000 ? 0.55 : 1;
    pos.set([r * s * Math.cos(t), r * z * flat, r * s * Math.sin(t)], i * 3);
  }
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8fa8c8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false }));
  pts.frustumCulled = false;
  return pts;
}
