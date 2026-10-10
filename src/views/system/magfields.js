// MAG FIELDS layer (#38): dipole field lines that turn with each planet, coloured by field strength
// with chevrons showing the field's direction; the magnetopause and bow shock facing the solar wind
// (Earth's from the live wind and IMF); schematic crustal loops on Mars and the Moon. Field lines live
// in the body's frame (they turn with it); boundaries face the upstream flow. Distances go through
// the same radial compression as moons at ENHANCED scale and are true at TRUE scale.

import * as THREE from 'three';
import { MAGNETIC, CRUSTAL, fieldLines, shue, magnetopauseR, bowShockR } from '../../astro/magnetic.js';
import { latLonToDir } from './surface.js';

// field strength, log scale 10 nT … 10⁶ nT, on a one-hue ramp (dark weak → light strong)
const RAMP = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb'].map((c) => new THREE.Color(c));
export const STRENGTH_SCALE = { min: 1, max: 6, label: 'FIELD STRENGTH · LOG SCALE · 10 nT (DARK) → 1 MILLION nT = 10 G (LIGHT)' };
const strengthColour = (b, out) => {
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(b, 1e-3)) - STRENGTH_SCALE.min) / (STRENGTH_SCALE.max - STRENGTH_SCALE.min)));
  const x = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i);
};
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Unit axis and offset (mesh frame, body radii) for a body's dipole. */
function dipoleFrame(spec) {
  const a = v3(latLonToDir(spec.poleLat ?? 90 - spec.tiltDeg, spec.poleLon)).normalize();
  const e1 = new THREE.Vector3(0, 1, 0).cross(a);
  if (e1.lengthSq() < 1e-8) e1.set(1, 0, 0); else e1.normalize();
  const e2 = a.clone().cross(e1).normalize();
  const off = spec.offset ? v3(latLonToDir(spec.offset[0], spec.offset[1])).multiplyScalar(spec.offset[2]) : new THREE.Vector3();
  return { a, e1, e2, off };
}

/**
 * deps: { radial(body, rRadii) → displayed distance in display radii, toDisplayAU(body, kmVec3) → displayed AU offset,
 *         upstream(body, id) → unit scene vector towards the flow (Sun or corotating plasma) }
 */
export function createMagFields({ radial, toDisplayAU, upstream }) {
  const entries = new Map(); // body id → { lines, base, boundary, built }
  let wind = null; // { Dp, Bz, time }

  function buildLines(spec, body) {
    const { a, e1, e2, off } = dipoleFrame(spec);
    const lines = fieldLines(spec.B0, { maxL: spec.standoff * 0.8 });
    const base = []; const strength = []; const chev = [];
    for (const ln of lines) {
      const pts = ln.points.map(([x, y, z, b]) => ({ p: e1.clone().multiplyScalar(x).add(e2.clone().multiplyScalar(y)).add(a.clone().multiplyScalar(z)).add(off), b }));
      for (let i = 1; i < pts.length; i++) { base.push(pts[i - 1].p, pts[i].p); strength.push(pts[i - 1].b, pts[i].b); }
      // chevron at the apex pointing along the field: from the north end to the south for a north-pointing moment (field lines leave the north)
      const mid = Math.floor(pts.length / 2), p = pts[mid].p, dir = pts[mid + 1].p.clone().sub(pts[mid - 1].p).normalize().multiplyScalar(spec.momentNorth ? 1 : -1);
      const side = dir.clone().cross(p.clone().sub(off).normalize()).normalize();
      const s = 0.06 * ln.L;
      chev.push(p, p.clone().sub(dir.clone().multiplyScalar(s)).add(side.clone().multiplyScalar(s * 0.6)), p, p.clone().sub(dir.clone().multiplyScalar(s)).sub(side.clone().multiplyScalar(s * 0.6)));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(base.length * 3), 3));
    const col = new Float32Array(base.length * 3), c = new THREE.Color();
    strength.forEach((b, i) => strengthColour(b, c).toArray(col, i * 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    const cgeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(chev.length * 3), 3));
    const cobj = new THREE.LineSegments(cgeo, new THREE.LineBasicMaterial({ color: 0xffcc99, transparent: true, opacity: 0.9, depthWrite: false }));
    for (const o of [obj, cobj]) { o.frustumCulled = false; o.renderOrder = 2; }
    return { obj, cobj, base, chev, body };
  }

  function buildLoops(spec) {
    const base = [];
    for (const [lat, lon, span, h] of spec.loops) for (const [dl, dn] of [[0, 1], [1, 0]]) {
      // two crossing loops per anomaly, footpoints `span` degrees apart
      const A = v3(latLonToDir(lat - (span / 2) * dl, lon - (span / 2) * dn)), B = v3(latLonToDir(lat + (span / 2) * dl, lon + (span / 2) * dn));
      let prev = null;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, p = A.clone().lerp(B, t).normalize().multiplyScalar(1 + h * Math.sin(Math.PI * t) * 3); // height ×3 for visibility (IMAGINED exaggeration)
        if (prev) base.push(prev, p);
        prev = p;
      }
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(base.length * 3), 3));
    const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x86b6ef, transparent: true, opacity: 0.9, depthWrite: false }));
    obj.frustumCulled = false;
    return { obj, base };
  }

  /** Map body-frame radii points through the radial compression into display-radius units. */
  function place(geo, base, body) {
    const arr = geo.attributes.position.array;
    base.forEach((p, i) => { const r = p.length(), k = r > 0 ? radial(body, r) / r : 1; arr[i * 3] = p.x * k; arr[i * 3 + 1] = p.y * k; arr[i * 3 + 2] = p.z * k; });
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  /** Magnetopause (rings and meridians) and bow shock in true km around the body, upstream along +x of `basis`. */
  function boundaryPositions(spec, body, up) {
    const R = body.radiusKm;
    let r0 = spec.standoff, alpha = 0.6;
    if (spec.live && wind) { const s = shue(wind.Dp, wind.Bz); r0 = s.r0; alpha = s.alpha; }
    else if (spec.live) { const s = shue(2, 0); r0 = s.r0; alpha = s.alpha; }
    const u = up.clone().normalize(), p1 = new THREE.Vector3(0, 0, 1).cross(u);
    if (p1.lengthSq() < 1e-8) p1.set(0, 1, 0).cross(u);
    p1.normalize(); const p2 = u.clone().cross(p1).normalize();
    const at = (rr, th, ph) => u.clone().multiplyScalar(rr * Math.cos(th)).add(p1.clone().multiplyScalar(rr * Math.sin(th) * Math.cos(ph))).add(p2.clone().multiplyScalar(rr * Math.sin(th) * Math.sin(ph))).multiplyScalar(R);
    const mp = [], bs = [];
    const surf = (out, rf, thMax) => {
      for (let th = 0; th <= thMax + 1e-9; th += (15 * Math.PI) / 180) { // rings
        let prev = null;
        for (let k = 0; k <= 48; k++) { const p = at(rf(th), th, (2 * Math.PI * k) / 48); if (prev) out.push(prev, p); prev = p; }
      }
      for (let k = 0; k < 8; k++) { // meridians
        let prev = null;
        for (let th = 0; th <= thMax + 1e-9; th += (5 * Math.PI) / 180) { const p = at(rf(th), th, (2 * Math.PI * k) / 8); if (prev) out.push(prev, p); prev = p; }
      }
    };
    surf(mp, (th) => magnetopauseR(r0, alpha, th), (140 * Math.PI) / 180);
    if (spec.bowShock) surf(bs, (th) => bowShockR(spec.live ? r0 * 1.3 : spec.bowShock, th), (115 * Math.PI) / 180);
    return { mp, bs, r0 };
  }

  return {
    /** Live solar wind for Earth's boundaries: { Dp nPa, Bz nT, time }. */
    setWind(w) { wind = w; },
    get wind() { return wind; },
    /** Current stand-off (radii) of a body's magnetopause. */
    standoffOf(id) { const s = MAGNETIC[id]; if (!s) return null; return s.live ? shue(wind?.Dp ?? 2, wind?.Bz ?? 0).r0 : s.standoff; },
    /** Per frame for each node with a field: lines in its tilt frame, boundaries around it. */
    update(nodes, show, scaleKey, now) {
      for (const [id, spec] of [...Object.entries(MAGNETIC), ...Object.entries(CRUSTAL)]) {
        const n = nodes[id];
        if (!n) continue;
        let e = entries.get(id);
        if (!show) { if (e) { e.group.visible = false; if (e.bound) e.bound.visible = false; } continue; }
        if (!e) {
          const group = new THREE.Group();
          const built = spec.loops ? buildLoops(spec) : buildLines(spec, n.body);
          group.add(built.obj); if (built.cobj) group.add(built.cobj);
          n.tilt.add(group);
          let bound = null;
          if (!spec.loops) {
            const mk = (color, op) => { const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); l.frustumCulled = false; return l; };
            bound = new THREE.Group(); bound.add(mk(0xcc99cc, 0.32), mk(0xff9966, 0.22));
            n.group.add(bound);
          }
          e = { group, built, bound, key: null, last: 0 };
          entries.set(id, e);
        }
        e.group.visible = true;
        e.group.rotation.copy(n.mesh.rotation); // follows the body's spin like its surface
        if (e.key !== scaleKey) {
          place(e.built.obj.geometry, e.built.base, n.body);
          if (e.built.cobj) place(e.built.cobj.geometry, e.built.chev, n.body);
          e.key = scaleKey; e.last = 0;
        }
        if (e.bound) {
          e.bound.visible = true;
          if (now - e.last > 250) { // boundaries face the flow: refresh a few times a second
            e.last = now;
            const { mp, bs } = boundaryPositions(spec, n.body, upstream(n.body, id));
            const set = (line, pts) => { line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => toDisplayAU(n.body, p))); line.visible = pts.length > 0; };
            set(e.bound.children[0], mp); set(e.bound.children[1], bs);
          }
        }
      }
    },
  };
}
