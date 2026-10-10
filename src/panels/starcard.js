// The SELECTED STAR card (#23): the most accurate data we can find for any star clicked in the
// Galaxy, Quadrant or System (sky) views. HYG stars bring their catalogue detail (and planets);
// every star gets a SIMBAD identification; stars beyond HYG get Gaia DR3 astrometry and
// astrophysical parameters. Each value carries its provenance badge.

import { LY_PER_PC, galToEq, raDec } from '../astro/frames.js';

/**
 * `pick`: { kind: 'hyg' | 'gaia' | 'sky', id?, gal?: [x, y, z] ly heliocentric galactic,
 *   eq?: [x, y, z] equatorial unit or ly vector, distLy?, mag?, name? }
 */
export function createStarCard({ h, row, fmt, go, fetchStar, fetchStarLookup, onUpdate }) {
  let pick = null, detail = null, lookup = null, loading = false, token = 0;

  async function select(p) {
    pick = p; detail = null; lookup = null; loading = true;
    const my = ++token;
    onUpdate();
    if (p.id) detail = await fetchStar(p.id).catch(() => null);
    if (my !== token) return;
    // the catalogue position (from Sol) beats a direction seen from another system
    let eq = detail?.star ? [detail.star.x, detail.star.y, detail.star.z] : p.eq;
    if (!eq && p.gal) eq = galToEq(p.gal);
    const dist = detail?.star?.distLy ?? p.distLy ?? null;
    if (eq) {
      const { ra, dec } = raDec(eq);
      pick.ra = ra; pick.dec = dec;
      lookup = await fetchStarLookup(ra, dec, dist, p.kind === 'gaia');
    }
    if (my !== token) return;
    loading = false;
    onUpdate();
  }
  const clear = () => { pick = null; token++; onUpdate(); };

  function section() {
    if (!pick) return [];
    const s = detail?.star, sim = lookup?.simbad?.found ? lookup.simbad : null, g = lookup?.gaia?.found ? lookup.gaia : null;
    const name = sim?.name ?? s?.name ?? pick.name ?? (g ? `Gaia DR3 ${g.sourceId}` : 'UNNAMED STAR');
    const dl = h('dl');
    const distLy = s?.distLy ?? g?.distLy ?? pick.distLy;
    if (distLy) row(dl, 'DISTANCE', `${fmt(distLy, distLy < 100 ? 2 : 0)} LY`, 'measured', s ? 'Parallax distance (HYG: Hipparcos / Gaia).' : g ? `Gaia DR3 parallax ${fmt(g.parallaxMas, 3)} ± ${fmt(g.parallaxErrorMas, 3)} mas.` : 'From the catalogue position.');
    if (pick.ra != null) row(dl, 'RA · DEC', `${fmt(pick.ra, 4)}° · ${fmt(pick.dec, 4)}°`, 'measured', 'J2000 equatorial coordinates.');
    if (sim?.type) row(dl, 'OBJECT TYPE', sim.type, 'measured', 'SIMBAD object type.');
    const spect = s?.spect ?? sim?.spectral ?? g?.spectral;
    if (spect) row(dl, 'SPECTRAL TYPE', spect, 'measured', s?.spect ? 'HYG catalogue.' : sim?.spectral ? 'SIMBAD (MK classification).' : 'Gaia DR3 ESP-HS estimate from low-resolution spectra.');
    if (s?.mag != null) row(dl, 'APPARENT MAG', fmt(s.mag, 2), 'measured', 'Visual magnitude from Earth (HYG).');
    else if (g?.gMag != null) row(dl, 'GAIA G MAG', fmt(g.gMag, 2), 'measured', 'Gaia G-band magnitude from Earth.');
    else if (pick.mag != null) row(dl, 'APPARENT MAG', fmt(pick.mag, 2), 'computed', 'As seen from this system.');
    if (s?.absmag != null) row(dl, 'ABSOLUTE MAG', fmt(s.absmag, 2), 'computed', 'Brightness at 10 parsecs.');
    if (g?.teffK) row(dl, 'TEMPERATURE', `${fmt(g.teffK, 0)} K`, 'modelled', 'Gaia DR3 GSP-Phot, fitted to its low-resolution spectrum.');
    if (g?.radiusSun) row(dl, 'RADIUS', `${fmt(g.radiusSun, 2)} × SUN`, 'modelled', 'Gaia DR3 FLAME.');
    if (g?.lumSun) row(dl, 'LUMINOSITY', `${fmt(g.lumSun, g.lumSun < 10 ? 2 : 0)} × SUN`, 'modelled', 'Gaia DR3 FLAME.');
    else if (s?.lum) row(dl, 'LUMINOSITY', `${fmt(s.lum, s.lum < 10 ? 3 : 0)} × SUN`, 'computed', 'From absolute magnitude (HYG).');
    if (g?.massSun) row(dl, 'MASS', `${fmt(g.massSun, 2)} × SUN`, 'modelled', 'Gaia DR3 FLAME, from evolutionary models.');
    if (g?.ageGyr) row(dl, 'AGE', `${fmt(g.ageGyr, 1)} BILLION YR`, 'modelled', 'Gaia DR3 FLAME (large uncertainties).');
    if (g?.radialVelocityKms != null) row(dl, 'RADIAL VELOCITY', `${fmt(g.radialVelocityKms, 1)} KM/S`, 'measured', 'Gaia DR3 RVS.');
    const multiple = (detail?.group?.members?.length ?? 0) > 1 ? `${detail.group.members.length} STARS` : g?.multiple ? 'LIKELY (GAIA)' : null;
    if (multiple) row(dl, 'MULTIPLICITY', multiple, g?.multiple && !detail?.group ? 'modelled' : 'measured', g?.multiple ? `Gaia flags a companion (non-single-star flag or RUWE ${fmt(g.ruwe ?? 0, 2)} > 1.4).` : 'Stars sharing its system (catalogue grouping and ORB6 orbits).');
    if (g?.variable) row(dl, 'VARIABLE', 'YES', 'measured', 'Gaia DR3 photometric variability flag.');
    if (s) row(dl, 'KNOWN PLANETS', String(s.planetCount ?? detail.planets?.length ?? 0), 'measured', 'NASA Exoplanet Archive.');
    if (sim?.ids?.length) row(dl, 'ALSO KNOWN AS', sim.ids.filter((x) => x !== sim.name).slice(0, 5).join(' · '), 'measured', 'SIMBAD identifiers.');
    const sources = [s ? 'HYG v4.4' : null, sim ? 'SIMBAD (CDS)' : null, g ? 'Gaia DR3 (ESA)' : null].filter(Boolean).join(' · ');
    return [
      h('h3', { textContent: 'SELECTED STAR' }),
      h('h2', { className: 'sel-name', textContent: name.toUpperCase() }),
      dl,
      loading ? h('p', { className: 'note', textContent: 'LOOKING UP SIMBAD AND GAIA…' }) : null,
      !loading && !lookup ? h('p', { className: 'note', textContent: 'Live lookups need the local backend; showing catalogue data only.' }) : null,
      sources ? h('p', { className: 'note', textContent: `SOURCES: ${sources}` }) : null,
      h('div', { className: 'body-list' },
        pick.id ? h('button', { className: 'pill', textContent: 'NAVIGATE FROM HERE ▸', onclick: () => go({ level: 'navigation', system: pick.id }) }) : null,
        pick.id ? h('button', { className: 'pill', textContent: 'WARP TO SYSTEM ▸', onclick: () => go({ level: 'system', system: pick.id }) }) : null,
        sim?.url ? h('a', { className: 'pill', href: sim.url, target: '_blank', rel: 'noopener', textContent: 'SIMBAD ↗' }) : null,
        h('button', { className: 'pill', textContent: 'CLEAR', onclick: clear })),
    ];
  }
  return { select, clear, section, get current() { return pick; } };
}

/** Heliocentric galactic position (ly) of a /api/galaxy-style row. */
export const galOf = (row) => [row[0], row[1], row[2]];
export { LY_PER_PC };
