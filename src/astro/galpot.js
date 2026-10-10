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
const toGCv = ([x, y, z]) => [C * x + S * z, y, -S * x + C * z];
const fromGC = ([x, y, z]) => [C * x - S * z + R_SUN_KPC, y, S * x + C * z];
const fromGCv = ([x, y, z]) => [C * x - S * z, y, S * x + C * z];

/**
 * Integrate an orbit from a heliocentric galactic position (ly) and Sun-relative galactic
 * velocity (km/s). Returns samples of position (ly, heliocentric galactic axes about the Sun's
 * present position) and velocity (km/s, relative to the Galactic centre) every `sampleMyr`.
 */
export function integrateTrack(posLy, velKms, { spanMyr = 50, dtMyr = 0.1, sampleMyr = 1 } = {}) {
  const p0 = toGC(posLy.map((v) => v / LY_PER_KPC));
  const v0 = toGCv(velKms.map((v, i) => (v + SUN_GAL_KMS[i]) * KPC_PER_MYR));
  const n = Math.round(spanMyr / sampleMyr), per = Math.round(sampleMyr / dtMyr);
  const data = new Float64Array((2 * n + 1) * 6);
  const put = (k, p, v) => {
    const q = fromGC(p), u = fromGCv(v);
    data.set([q[0] * LY_PER_KPC, q[1] * LY_PER_KPC, q[2] * LY_PER_KPC, u[0] / KPC_PER_MYR, u[1] / KPC_PER_MYR, u[2] / KPC_PER_MYR], k * 6);
  };
  put(n, p0, v0);
  const a = [0, 0, 0];
  for (const dir of [1, -1]) {
    const p = [...p0], v = [...v0], dt = dir * dtMyr;
    accel(p[0], p[1], p[2], a);
    for (let k = 1; k <= n; k++) {
      for (let s = 0; s < per; s++) {
        v[0] += 0.5 * dt * a[0]; v[1] += 0.5 * dt * a[1]; v[2] += 0.5 * dt * a[2];
        p[0] += dt * v[0]; p[1] += dt * v[1]; p[2] += dt * v[2];
        accel(p[0], p[1], p[2], a);
        v[0] += 0.5 * dt * a[0]; v[1] += 0.5 * dt * a[1]; v[2] += 0.5 * dt * a[2];
      }
      put(n + dir * k, p, v);
    }
  }
  return { n, sampleMyr, data };
}

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
