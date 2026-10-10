// Deep-time arrivals (#29), the arithmetic: which catalogue shells to load, how far back or
// ahead they cover, and how complete the sphere around the centre star is. No DOM, no worker.

export const INNER_LY = 250;   // loaded with the chart
export const OUTER_LY = 1000;  // loaded once deep time needs it
export const LY_PER_MYR_PER_KMS = 3.3356; // 1 km/s carries a star 3.34 ly in a million years
const SPANS = { near: { spanMyr: 5, dtMyr: 0.1, sampleMyr: 1 }, deep: { spanMyr: 50, dtMyr: 0.25, sampleMyr: 2.5 } };
/** Orbit span (and steps) a far star needs at this epoch: ±5 Myr as the chart's own, else ±50 Myr coarser. */
export const spanFor = (epochYears) => (Math.abs(epochYears) > 5e6 ? SPANS.deep : SPANS.near);

/**
 * Relative speed (km/s) below which every star that can be inside `radiusLy` at `epochYears` was
 * within `loadedLy` today, i.e. the loaded catalogue accounts for it. Infinity now.
 */
export function coverageKms(loadedLy, radiusLy, epochYears) {
  const myr = Math.abs(epochYears) / 1e6;
  return myr ? Math.max(0, loadedLy - radiusLy) / myr / LY_PER_MYR_PER_KMS : Infinity;
}
/** Load the outer shell once the inner one stops covering stars up to 100 km/s. */
export const needOuter = (radiusLy, epochYears) => coverageKms(INNER_LY, radiusLy, epochYears) < 100;
/** Stars shown versus the catalogue's own density near Sol (stars per ly³) over the sphere. */
export function completeness(shown, radiusLy, rho0PerLy3) {
  if (!rho0PerLy3) return null;
  return shown / (rho0PerLy3 * (4 / 3) * Math.PI * radiusLy ** 3);
}
const n = (x) => Math.round(x).toLocaleString('en-US');
/** Hipparcos (and so HYG) is complete to V ≈ 7.5: the faintest absolute magnitude complete out to `ly`. */
export const brightLimit = (ly) => 7.5 - 5 * Math.log10(ly / 3.26156 / 10);

const lyOr = (x, maxLy) => (x == null ? `≥${n(maxLy)}` : n(x));
/**
 * "G 220→325" per absolute-magnitude class: how far out the catalogue alone and the catalogue
 * plus the Gaia DR3 RV slice hold at least half the class's density near Sol.
 */
export function classLine(classes, maxLy = OUTER_LY) {
  return classes.map((c) => (c.hygLy === c.mergedLy ? `${c.label} ${lyOr(c.hygLy, maxLy)}` : `${c.label} ${lyOr(c.hygLy, maxLy)}→${lyOr(c.mergedLy, maxLy)}`)).join(' · ');
}

/**
 * Lines for the chart's deep-time badge: [{ tier, text, warn? }]. `s` = { epoch, radiusLy,
 * shown, arrived, departed, gaia, gaiaOnly, hyg, loadedLy, loading, preview, previewLy,
 * density: { rho0PerLy3, halfLy }, like: { mag, today, now },
 * gaiaRv: { status, error }, completeness: { gaiaLy, classes, density } }.
 */
export function badgeLines(s) {
  if (!s.epoch) return [];
  const out = [{ tier: 'computed', text: `${n(s.shown)} STARS WITHIN ${s.radiusLy} LY · ${n(s.arrived)} ARRIVED FROM BEYOND TODAY'S ${s.radiusLy} LY · ${n(s.departed)} LEFT` }];
  const cm = s.completeness, dens = cm?.density ?? s.density;
  const c = completeness(s.shown, s.radiusLy, dens?.rho0PerLy3);
  const pct = c == null ? '' : c < 0.01 ? ' · UNDER 1%' : ` · ~${Math.min(100, Math.round(c * 100))}%`;
  const ofNear = c == null ? '' : " OF THE CATALOGUE'S STAR DENSITY NEAR SOL";
  if (cm) {
    // with the Gaia DR3 RV slice: the half-density radius before and after, and per class
    out.push({ tier: 'computed', text: `ARRIVALS: HYG + GAIA DR3 RV STARS · DENSITY HALVES BEYOND ~${dens.halfLy ?? n(OUTER_LY)} LY (HYG ALONE ~${s.density?.halfLy ?? 60})${pct}${ofNear}` });
    out.push({ tier: 'computed', text: `HALF-COMPLETE TO, LY (HYG→+GAIA RV, WHICH ENDS AT ${n(cm.gaiaLy)} LY): ${classLine(cm.classes)}` });
  } else out.push({ tier: 'measured', text: `ARRIVALS: BRIGHT STARS ONLY BEYOND ~${s.density?.halfLy ?? 60} LY · CATALOGUE INCOMPLETE${pct}${ofNear}` });
  if (s.gaiaRv?.status === 'loading') out.push({ tier: 'computed', warn: true, text: 'LOADING GAIA DR3 RADIAL-VELOCITY STARS (≤ 326 LY) · ~25 S THE FIRST TIME' });
  else if (s.gaiaRv?.status === 'error') out.push({ tier: 'computed', warn: true, text: `GAIA DR3 RV STARS UNAVAILABLE (${String(s.gaiaRv.error ?? '').slice(0, 60).toUpperCase()}) · HYG ONLY` });
  if (s.like && s.like.today >= 5) out.push({ tier: 'computed', text: `LIKE FOR LIKE, STARS BRIGHTER THAN ABS. MAG ${s.like.mag.toFixed(1)} (IN THE CATALOGUE OUT TO ${n(s.loadedLy)} LY): ${n(s.like.today)} TODAY · ${n(s.like.now)} NOW` });
  if (s.loading) out.push({ tier: 'computed', text: s.loading, warn: true });
  else {
    const v = coverageKms(s.loadedLy, s.radiusLy, s.epoch);
    if (s.preview && v < 100) out.push({ tier: 'computed', warn: true, text: `PREVIEW: ARRIVALS ONLY FROM ITS ${s.previewLy} LY SNAPSHOT · STARS FASTER THAN ${n(v)} KM/S ARE MISSING · RUN THE LOCAL BACKEND FOR ${n(OUTER_LY)} LY` });
    else if (v < 75) out.push({ tier: 'computed', warn: true, text: `STARS FASTER THAN ${n(v)} KM/S ARRIVING FROM BEYOND ${n(s.loadedLy)} LY ARE NOT LOADED · THE SPHERE THINS OUT` });
  }
  out.push({ tier: 'measured', text: s.gaiaOnly
    ? `VELOCITIES SHOWN: ${n(s.gaia)} GAIA DR3 (HIPPARCOS STARS) · ${n(s.gaiaOnly)} GAIA DR3 RV-ONLY · ${n(s.hyg)} HYG · DIM ARROWS: NO RADIAL VELOCITY`
    : `VELOCITIES SHOWN: ${n(s.gaia)} GAIA DR3 · ${n(s.hyg)} HYG (HIPPARCOS) · DIM ARROWS: NO RADIAL VELOCITY` });
  return out;
}
