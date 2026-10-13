// Star orbits in a Milky Way mass model, for the Navigation View's deep time (#20).
//
// Potential: gala's MilkyWayPotential (Price-Whelan 2017), the Bovy (2015) fit to the
// Milky Way's rotation curve and mass: Hernquist nucleus and bulge, Miyamoto–Nagai disc and
// NFW dark halo. Every star's present position and measured space velocity are integrated
// with a symplectic leapfrog (kick–drift–kick) backwards and forwards, sampled every 1 Myr
// and read back between samples with cubic Hermite interpolation (positions and velocities),
// so each star's velocity, and so its arrow, changes along its real curved path.
//
// Units inside: kpc, kpc/Myr, M☉. Frame: galactocentric, axes parallel to the IAU galactic
// frame, tilted by asin(z☉/R☉) so the Sun sits z☉ above the disc (as astropy's Galactocentric).

export const R_SUN_KPC = 8.178;   // GRAVITY Collaboration 2019
export const Z_SUN_KPC = 0.0208;  // Bennett & Bovy 2019
// Sun's velocity relative to the Galactic centre, km/s: Schönrich et al. 2010 peculiar motion
// (U, V, W) = (11.1, 12.24, 7.25) plus 233 km/s circular speed (≈ 245 km/s total, matching
// Sgr A*'s reflex proper motion, Reid & Brunthaler 2020).
export const SUN_GAL_KMS = [11.1, 12.24 + 233, 7.25];

const G = 4.498502151469554e-12; // kpc³ / (M☉ Myr²)
export const KPC_PER_MYR = 1.0227121650537077e-3; // 1 km/s
export const LY_PER_KPC = 3261.5637769;
export const MW = {
  nucleus: { m: 1.71e9, c: 0.07 },
  bulge: { m: 5.0e9, c: 1.0 },
  disk: { m: 6.8e10, a: 3.0, b: 0.28 },
  halo: { m: 5.4e11, rs: 15.62 },
  ref: 'gala MilkyWayPotential (Bovy 2015 fit): Hernquist nucleus + bulge, Miyamoto–Nagai disc, NFW halo',
};

/** Acceleration (kpc/Myr²) at galactocentric (x, y, z) kpc. */
export function accel(x, y, z, out = [0, 0, 0]) {
  const R2 = x * x + y * y, r = Math.sqrt(R2 + z * z) || 1e-9;
  // spherical parts: a = −g(r) r̂
  const { nucleus: n, bulge: bu, halo: h, disk: d } = MW;
  let g = G * n.m / (r + n.c) ** 2 + G * bu.m / (r + bu.c) ** 2;
  g += G * h.m * (Math.log(1 + r / h.rs) / (r * r) - 1 / (r * (r + h.rs)));
  const k = -g / r;
  // Miyamoto–Nagai disc
  const zb = Math.sqrt(z * z + d.b * d.b), s = d.a + zb, D3 = (R2 + s * s) ** 1.5;
  const kd = -G * d.m / D3;
  out[0] = k * x + kd * x;
  out[1] = k * y + kd * y;
  out[2] = k * z + kd * z * s / zb;
  return out;
}
/** Potential (kpc²/Myr²) at galactocentric (x, y, z) kpc. */
export function phi(x, y, z) {
  const { nucleus: n, bulge: bu, halo: h, disk: d } = MW;
  const R2 = x * x + y * y, r = Math.sqrt(R2 + z * z) || 1e-9;
  return -G * n.m / (r + n.c) - G * bu.m / (r + bu.c) - G * h.m * Math.log(1 + r / h.rs) / r
    - G * d.m / Math.sqrt(R2 + (d.a + Math.sqrt(z * z + d.b * d.b)) ** 2);
}
/** Circular speed (km/s) in the midplane at radius R (kpc). */
export function vcirc(R) {
  const a = accel(R, 0, 0);
  return Math.sqrt(-a[0] * R) / KPC_PER_MYR;
}

// heliocentric galactic ⇄ galactocentric (kpc), with the tilt that puts the Sun at +z☉
const TH = Math.asin(Z_SUN_KPC / R_SUN_KPC), C = Math.cos(TH), S = Math.sin(TH);
export const toGC = ([x, y, z]) => [C * (x - R_SUN_KPC) + S * z, y, -S * (x - R_SUN_KPC) + C * z];

const KMS2_PER_KPC_MYR2 = 3.0856775814913673e16 / (3.15576e13 ** 2); // 1 kpc/Myr² in km/s²
/**
 * The Milky Way's tide on a ship (#42): its acceleration (km/s², heliocentric galactic axes) relative to the Sun at a
 * heliocentric galactic position in light-years, a(ship) − a(Sun) in this model. The frame of the galaxy-scale views
 * holds the Sun and today's stars still, so the Sun's own fall about the Galaxy is taken out. ~10⁻¹¹ m/s² a thousand
 * light-years out; the full ~2 × 10⁻¹⁰ m/s² of the Galaxy's pull only far from the Sun.
 */
export function tidalAccel(galLy) {
  const k = 1 / LY_PER_KPC, g = toGC([galLy[0] * k, galLy[1] * k, galLy[2] * k]), s0 = toGC([0, 0, 0]);
  const a = accel(...g), a0 = accel(...s0);
  const d = [a[0] - a0[0], a[1] - a0[1], a[2] - a0[2]];
  // back from the tilted galactocentric axes to the galactic ones (toGC's rotation, inverted)
  return [(C * d[0] - S * d[2]) * KMS2_PER_KPC_MYR2, d[1] * KMS2_PER_KPC_MYR2, (S * d[0] + C * d[2]) * KMS2_PER_KPC_MYR2];
}
/** The Galaxy's whole pull at the Sun (km/s²): what the tide is measured against. */
export function sunAccel() {
  const a = accel(...toGC([0, 0, 0]));
  return Math.hypot(...a) * KMS2_PER_KPC_MYR2;
}

/**
 * Integrate an orbit from a heliocentric galactic position (ly) and Sun-relative galactic
 * velocity (km/s). Returns samples of position (ly, heliocentric galactic axes about the Sun's
 * present position) and velocity (km/s, relative to the Galactic centre) every `sampleMyr`.
 */
export function integrateTrack(posLy, velKms, opts = {}) {
  const b = integrateBatch(posLy, velKms, opts);
  return { n: b.n, sampleMyr: b.sampleMyr, data: b.data };
}

/**
 * Integrate many orbits at once (#29): `pos` and `vel` hold 3 numbers per star (as for
 * integrateTrack). No allocation per step, so tens of thousands of stars fit in a worker.
 * `Float` picks the storage (Float32Array halves the memory of a large, far set; its ~1e-7
 * relative precision is ~0.001 ly at 10,000 ly). Star i's track is `trackOf(batch, i)`.
 */
export function integrateBatch(pos, vel, { spanMyr = 50, dtMyr = 0.1, sampleMyr = 1, Float = Float64Array } = {}) {
  const count = Math.floor(pos.length / 3);
  const n = Math.round(spanMyr / sampleMyr), per = Math.max(1, Math.round(sampleMyr / dtMyr));
  const stride = (2 * n + 1) * 6;
  const data = new Float(count * stride);
  const a = [0, 0, 0];
  const L = LY_PER_KPC, K = KPC_PER_MYR, R0 = R_SUN_KPC;
  for (let i = 0; i < count; i++) {
    const hx = pos[3 * i] / L, hy = pos[3 * i + 1] / L, hz = pos[3 * i + 2] / L;
    const ux = (vel[3 * i] + SUN_GAL_KMS[0]) * K, uy = (vel[3 * i + 1] + SUN_GAL_KMS[1]) * K, uz = (vel[3 * i + 2] + SUN_GAL_KMS[2]) * K;
    const p0x = C * (hx - R0) + S * hz, p0y = hy, p0z = -S * (hx - R0) + C * hz;
    const v0x = C * ux + S * uz, v0y = uy, v0z = -S * ux + C * uz;
    const base = i * stride;
    const put = (k, px, py, pz, vx, vy, vz) => { // galactocentric → heliocentric galactic (ly, km/s)
      const o = base + k * 6;
      data[o] = (C * px - S * pz + R0) * L; data[o + 1] = py * L; data[o + 2] = (S * px + C * pz) * L;
      data[o + 3] = (C * vx - S * vz) / K; data[o + 4] = vy / K; data[o + 5] = (S * vx + C * vz) / K;
    };
    put(n, p0x, p0y, p0z, v0x, v0y, v0z);
    for (const dir of [1, -1]) {
      let px = p0x, py = p0y, pz = p0z, vx = v0x, vy = v0y, vz = v0z;
      const dt = dir * dtMyr, h = 0.5 * dt;
      accel(px, py, pz, a);
      for (let k = 1; k <= n; k++) {
        for (let s = 0; s < per; s++) {
          vx += h * a[0]; vy += h * a[1]; vz += h * a[2];
          px += dt * vx; py += dt * vy; pz += dt * vz;
          accel(px, py, pz, a);
          vx += h * a[0]; vy += h * a[1]; vz += h * a[2];
        }
        put(n + dir * k, px, py, pz, vx, vy, vz);
      }
    }
  }
  return { count, n, sampleMyr, stride, data };
}
/** Star i's track in a batch (a view, no copy), usable with trackAt. */
export const trackOf = (batch, i) => ({ n: batch.n, sampleMyr: batch.sampleMyr, data: batch.data.subarray(i * batch.stride, (i + 1) * batch.stride) });

const LY_PER_KMS_MYR = 1.0227121650537077e-3 * 3261.5637769; // ly travelled in 1 Myr at 1 km/s
/** Position (ly) and velocity (km/s) on a track at t years from now (cubic Hermite between samples). */
export function trackAt(track, tYears, out = { pos: [0, 0, 0], vel: [0, 0, 0] }) {
  const { n, sampleMyr: h, data } = track;
  const tm = Math.max(-n * h, Math.min(n * h, tYears / 1e6));
  const f = tm / h + n, i = Math.min(2 * n - 1, Math.max(0, Math.floor(f))), u = f - i;
  const A = i * 6, B = A + 6, hv = h * LY_PER_KMS_MYR; // velocity × h in ly
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = (6 * u2 - 6 * u) / hv, d10 = (3 * u2 - 4 * u + 1), d01 = (-6 * u2 + 6 * u) / hv, d11 = (3 * u2 - 2 * u);
  for (let k = 0; k < 3; k++) {
    const p0 = data[A + k], p1 = data[B + k], v0 = data[A + 3 + k], v1 = data[B + 3 + k];
    out.pos[k] = h00 * p0 + h10 * hv * v0 + h01 * p1 + h11 * hv * v1;
    out.vel[k] = d00 * p0 + d10 * v0 + d01 * p1 + d11 * v1; // dp/dt in km/s
  }
  return out;
}

/**
 * Closest approach of two tracks within ±maxYears: scanned every `stepYears`, then refined
 * by golden-section search. Returns { tYears, dMinLy }.
 */
export function closestApproach(trA, trB, maxYears = 5e6, stepYears = 2e4) {
  const a = { pos: [0, 0, 0], vel: [0, 0, 0] }, b = { pos: [0, 0, 0], vel: [0, 0, 0] };
  const dist = (t) => { trackAt(trA, t, a); trackAt(trB, t, b); return Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]); };
  let best = 0, bestD = Infinity;
  for (let t = -maxYears; t <= maxYears; t += stepYears) { const d = dist(t); if (d < bestD) { bestD = d; best = t; } }
  let lo = Math.max(-maxYears, best - stepYears), hi = Math.min(maxYears, best + stepYears);
  for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (dist(m1) < dist(m2)) hi = m2; else lo = m1; }
  const t = (lo + hi) / 2;
  return { tYears: t, dMinLy: dist(t) };
}

/**
 * Straight-line closest approach, for screening thousands of stars before integrating:
 * relative position (ly) and velocity (km/s) → { tYears, dLy }.
 */
export function linearApproach(dp, dv) {
  const v = dv.map((x) => x * LY_PER_KMS_MYR / 1e6); // ly per year
  const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  const t = vv > 0 ? -(dp[0] * v[0] + dp[1] * v[1] + dp[2] * v[2]) / vv : 0;
  return { tYears: t, dLy: Math.hypot(dp[0] + v[0] * t, dp[1] + v[1] * t, dp[2] + v[2] * t) };
}
