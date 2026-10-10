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
 * inflow, tail stretched. Each shell is fitted to the two places it has been measured: the
 * Voyagers crossed at different distances (V1 north, V2 south: 94 vs 84 AU, 121.6 vs 119 AU),
 * because the interstellar magnetic field pushes harder on the southern flank. A linear
 * north–south term through the two crossing directions fits both exactly. Plus the IBEX ribbon
 * (a ring of energetic-neutral-atom emission, centre ecliptic 221°, +39°, radius ~74°;
 * McComas et al. 2009) and the interstellar field draped around the heliopause (potential
 * field around the nose sphere: SCHEMATIC). Crossings MEASURED; the shapes MODELLED.
 */
export const VOYAGER_DIRS = { v1: { ra: 257.5, dec: 12.2 }, v2: { ra: 297.0, dec: -56.9 } }; // approximate outbound directions (J2000)
export const IBEX_RIBBON = { lon: 221, lat: 39, radiusDeg: 74 };
const shellBase = (c) => 1 + 0.9 * (1 - c) ** 1.5; // 1 at the nose, ~3.5 down the tail
/** Fit nose radius rN and asymmetry k so r(dir) = rN·base(c)·(1 + k·(dir·ŝ)) passes both crossings. */
export function fitShell(R1, R2, c1, c2, s1, s2) {
  // R1 / (rN b1) − 1 = k s1 ; R2 / (rN b2) − 1 = k s2  →  solve for rN, k
  const b1 = shellBase(c1), b2 = shellBase(c2);
  const rN = (R1 * s2 / b1 - R2 * s1 / b2) / (s2 - s1);
  return { rN, k: (R1 / (rN * b1) - 1) / s1 };
}
export function heliosphere(toScene, eqToEclFn) {
  const group = new THREE.Group();
  const dirLL = (lon, lat) => new THREE.Vector3(...toScene([Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)])).normalize();
  const dirEq = ({ ra, dec }) => new THREE.Vector3(...toScene(eqToEclFn([Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)]))).normalize();
  const nose = dirLL(...HELIO.noseLonLat);
  const v1 = dirEq(VOYAGER_DIRS.v1), v2 = dirEq(VOYAGER_DIRS.v2);
  const sAxis = v1.clone().sub(v2).normalize();
  const fits = {};
  const shell = (name, [R1, R2], color) => {
    const f = fitShell(R1, R2, v1.dot(nose), v2.dot(nose), v1.dot(sAxis), v2.dot(sAxis));
    fits[name] = f;
    const g = new THREE.SphereGeometry(1, 48, 24);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      v.multiplyScalar(f.rN * shellBase(v.dot(nose)) * (1 + f.k * v.dot(sAxis)));
      p.setXYZ(k, v.x, v.y, v.z);
    }
    const m = new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.12 }));
    m.frustumCulled = false;
    return m;
  };
  group.add(shell('terminationShock', HELIO.terminationShock, 0x66ccff), shell('heliopause', HELIO.heliopause, 0xcc99ff));
  // where the Voyagers crossed
  const marks = [];
  for (const [v, ts, hp] of [[v1, HELIO.terminationShock[0], HELIO.heliopause[0]], [v2, HELIO.terminationShock[1], HELIO.heliopause[1]]]) {
    for (const r of [ts, hp]) marks.push(...v.clone().multiplyScalar(r).toArray());
  }
  const crossings = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(marks, 3)),
    new THREE.PointsMaterial({ color: 0xffcc66, size: 7, sizeAttenuation: false }));
  crossings.frustumCulled = false;
  group.add(crossings);
  // IBEX ribbon: a circle on the sky, drawn just outside the heliopause
  const rc = dirLL(IBEX_RIBBON.lon, IBEX_RIBBON.lat);
  const u = new THREE.Vector3().crossVectors(rc, Math.abs(rc.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(rc, u);
  const rib = [], ra = IBEX_RIBBON.radiusDeg * DEG, R = 150;
  for (let i = 0; i <= 180; i++) {
    const t = (i / 180) * 2 * Math.PI;
    const d = rc.clone().multiplyScalar(Math.cos(ra)).addScaledVector(u, Math.sin(ra) * Math.cos(t)).addScaledVector(w, Math.sin(ra) * Math.sin(t));
    rib.push(d.multiplyScalar(R));
  }
  const ribbon = new THREE.Line(new THREE.BufferGeometry().setFromPoints(rib), new THREE.LineBasicMaterial({ color: 0xffaa55, transparent: true, opacity: 0.45 }));
  ribbon.frustumCulled = false;
  group.add(ribbon);
  // interstellar field draped over the nose: field lines of a uniform field bent around a sphere
  // of the heliopause nose radius (ψ = sin²θ (r² − R³/r) = const), in planes through the field axis
  const b = rc.clone(), Rn = fits.heliopause.rN, drape = [];
  const side0 = new THREE.Vector3().crossVectors(b, nose).normalize();
  for (let plane = 0; plane < 4; plane++) {
    const side = side0.clone().applyAxisAngle(b, (plane / 4) * Math.PI);
    for (const C of [0.15, 0.5, 1.2, 2.4].map((x) => x * Rn * Rn)) {
      for (const sgn of [1, -1]) {
        let prev = null;
        for (let i = 1; i < 120; i++) {
          const th = (i / 120) * Math.PI, s2 = Math.sin(th) ** 2;
          let r = Math.sqrt(C / s2) + Rn; // Newton on r³ − (C/s²) r − R³ = 0
          for (let it = 0; it < 12; it++) r -= (r ** 3 - (C / s2) * r - Rn ** 3) / (3 * r * r - C / s2);
          if (!(r > Rn) || r > 8 * Rn) { prev = null; continue; }
          const p = b.clone().multiplyScalar(r * Math.cos(th)).addScaledVector(side, sgn * r * Math.sin(th));
          if (prev) drape.push(prev, p);
          prev = p;
        }
      }
    }
  }
  const ismf = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(drape), new THREE.LineBasicMaterial({ color: 0x9999ff, transparent: true, opacity: 0.18 }));
  ismf.frustumCulled = false;
  group.add(ismf);
  return { group, nose, fits };
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
