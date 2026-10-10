// The Sun's magnetic field in the solar wind (#19): Parker-spiral field lines and the
// heliospheric current sheet (the "ballerina skirt"), in the Sun's equatorial frame.
//
//   Parker (1958): the wind carries the field radially at v while the Sun turns at Ω, so a
//     field line from longitude φ₀ lies on φ = φ₀ − Ω (r − r₀) / v. With v = 400 km/s and the
//     sidereal Carrington rate (25.38 d) the spiral is ~45° to radial at 1 AU.
//   Strength: |B| = B_r √(1 + (Ω r cosθ / v)²), B_r ∝ r⁻²; ~5 nT at 1 AU (measured, OMNI).
//   Current sheet: tilted-dipole sheet, tan θ_s = tan α · sin(φ₀ − φ_n), carried out along the
//     same spirals. The tilt α follows the solar cycle (~10° at minimum, ~70° near maximum);
//     45° here for the 2026 declining phase of cycle 25 (MODELLED, not today's WSO value).
//     After the 2024 polar-field reversal, the north is the inward (negative) polarity.

import * as THREE from 'three';

const AU_KM = 149597870.7;
export const SOLAR = { windKms: 400, rotationDays: 25.38, tiltDeg: 45, b1AU_nT: 5, northPolarity: -1 };
const OMEGA = (2 * Math.PI) / (SOLAR.rotationDays * 86400); // rad/s
/** Spiral winding (radians of longitude per AU of radius) at latitude θ (rad). */
export const windingPerAU = (windKms = SOLAR.windKms) => (OMEGA * AU_KM) / windKms;
/** Angle between the field and the radial direction at r (AU), latitude θ (rad). */
export const spiralAngleDeg = (rAU, lat = 0, windKms = SOLAR.windKms) => (Math.atan(windingPerAU(windKms) * rAU * Math.cos(lat)) * 180) / Math.PI;
/** Field magnitude (nT) at r (AU) and latitude θ. */
export function fieldStrength(rAU, lat = 0) {
  const k = windingPerAU() * Math.cos(lat);
  const Br1 = SOLAR.b1AU_nT / Math.sqrt(1 + k * k); // so that |B| = 5 nT at 1 AU in the equator
  return (Br1 / (rAU * rAU)) * Math.sqrt(1 + (k * rAU) ** 2);
}
/** Latitude (rad) of the current sheet above a footpoint at longitude φ₀ (rad). */
export const sheetLatitude = (phi0, tiltDeg = SOLAR.tiltDeg) => Math.atan(Math.tan((tiltDeg * Math.PI) / 180) * Math.sin(phi0));

/**
 * Build the field: lines out to `rMax` AU and the current sheet. The group is in the Sun's
 * equatorial frame (+y = solar north); rotate it about +y with `rotate(jd)` and orient it to the
 * Sun's pole outside.
 */
export function createSolarField({ rMax = 60, lines = 10, lats = [-50, -25, 0, 25, 50] } = {}) {
  const group = new THREE.Group();
  const w = windingPerAU();
  const pos = [], col = [];
  const out = [1, 0.62, 0.25], inw = [0.35, 0.75, 1]; // outward / inward polarity
  const bRef = Math.log10(fieldStrength(0.05)), bLow = Math.log10(fieldStrength(rMax));
  for (const latDeg of lats) {
    const lat = (latDeg * Math.PI) / 180;
    for (let i = 0; i < lines; i++) {
      const phi0 = (i / lines) * 2 * Math.PI;
      const north = lat > sheetLatitude(phi0);
      const c = (north ? SOLAR.northPolarity : -SOLAR.northPolarity) > 0 ? out : inw;
      let prev = null;
      for (let r = 0.02; r <= rMax; r *= 1.02) {
        const phi = phi0 - w * r * Math.cos(lat);
        const p = [r * Math.cos(lat) * Math.cos(phi), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(phi)];
        const k = Math.max(0.08, (Math.log10(fieldStrength(r, lat)) - bLow) / (bRef - bLow));
        if (prev) { pos.push(...prev.p, ...p); col.push(...prev.c, ...c.map((v) => v * k)); }
        prev = { p, c: c.map((v) => v * k) };
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const fieldLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  fieldLines.frustumCulled = false;
  // current sheet: wavy rings at a few distances, and its spiral ridges
  const sp = [];
  const sheetPoint = (r, phi0) => { const lat = sheetLatitude(phi0); const phi = phi0 - w * r * Math.cos(lat); return [r * Math.cos(lat) * Math.cos(phi), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(phi)]; };
  for (const r of [0.5, 1, 2, 5, 10, 20, 40]) {
    if (r > rMax) continue;
    for (let i = 0; i < 180; i++) sp.push(...sheetPoint(r, (i / 180) * 2 * Math.PI), ...sheetPoint(r, ((i + 1) / 180) * 2 * Math.PI));
  }
  for (let j = 0; j < 24; j++) {
    const phi0 = (j / 24) * 2 * Math.PI;
    for (let r = 0.05; r < rMax; r *= 1.04) sp.push(...sheetPoint(r, phi0), ...sheetPoint(r * 1.04, phi0));
  }
  const sheet = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)),
    new THREE.LineBasicMaterial({ color: 0xcc99cc, transparent: true, opacity: 0.18, depthWrite: false }));
  sheet.frustumCulled = false;
  group.add(fieldLines, sheet);
  return {
    group,
    /** Turn the pattern with the Sun (sidereal Carrington rate). */
    rotate(jd) { group.rotation.y = (((jd - 2451545) / SOLAR.rotationDays) % 1) * 2 * Math.PI; },
  };
}
