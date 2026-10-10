// The detail views' extra cards: FROM EARTH (observing data), IMAGERY (live, all wavelengths,
// archive) and SPECTRA (modelled for Sol bodies, measured for stars and exoplanets). Built
// here from a system model so the views stay agnostic of where the data comes from.

import { createFromEarthCard } from './fromearth.js';
import { createImageryCard } from './imagery.js';
import { createSurfaceCard } from './surface.js';
import { bodySpectrumCard, starSpectrumCard, exoSpectraCard } from './spectra.js';
import { toRaDec } from '../astro/observe.js';
import { createCommsCard } from './comms.js';

const isStarBody = (b) => !!(b.starLike || b.kind === 'star' || b.kind === 'white dwarf' || b.kind === 'brown dwarf');

/** J2000 RA/Dec and distance of a catalogue star (HYG x, y, z equatorial parsecs). */
export function catalogSky(c) {
  if (!c || c.x == null) return null;
  const { ra, dec } = toRaDec([c.x, c.y, c.z]);
  return { ra, dec, distPc: c.distPc ?? Math.hypot(c.x, c.y, c.z), mag: c.mag ?? null };
}

// what to search NASA's library for, and the word a caption must contain
function archiveQuery(b, m) {
  if (!m.isSol) {
    // named stars and famous systems have images (often artists' concepts, badged)
    const name = b.name.replace(/\s+[a-h]$/i, '');
    return /^(HD|HIP|Gl|GJ|LHS|LP|G|BD|CD|Wolf|Ross|LTT|L)\s?\d/i.test(name) && !/^(GJ 1214|GJ 1132|LHS 1140|LHS 3844)/i.test(name) ? null : { q: name, must: firstWord(name) };
  }
  if (b.id === 'sun') return { q: 'Sun solar', must: 'sun' };
  if (b.kind === 'moon' && b.id !== 'moon') return { q: `${b.name} ${b.parent}`, must: firstWord(b.name) };
  if (b.id === 'moon') return { q: 'Moon lunar surface', must: 'moon' };
  return { q: b.name.replace(/^\dP\//, ''), must: firstWord(b.name.replace(/^\dP\//, '')) };
}
const firstWord = (s) => s.toLowerCase().match(/[a-z0-9-]+/)?.[0] ?? s.toLowerCase();

/**
 * Cards for body `b` of model `m`. `system` gives positions (Sol), `clock` the ship's time.
 * Returns { top, spectrum, tick(), dispose() }.
 */
export function detailCards(b, m, { system, clock, surface = null }) {
  const getJd = () => clock.jd;
  const parts = [];
  let sky = null;
  const star = isStarBody(b);
  let fe = null, target = null, imageryTarget = null;

  if (m.isSol) {
    if (b.id !== 'earth' && b.kind !== 'comet') {
      // System View scene axes (x, y, z) = ecliptic (x, z, −y)
      const positionAt = (id, jd) => { const s = system.positionOf(id, jd); return [s[0], -s[2], s[1]]; };
      const moons = m.bodies.filter((x) => x.kind === 'moon' && x.parent === b.id).map((x) => ({ id: x.id, name: x.name }));
      target = { kind: 'sol', id: b.id, radiusKm: b.radiusKm, pole: b.pole, rings: b.rings, palette: b.palette, moons, positionAt };
      fe = createFromEarthCard(target, { getJd, onSky: (s) => { sky = s; } });
    }
    imageryTarget = { id: b.id, name: b.name, kind: 'sol', moving: b.id !== 'earth', surveys: b.id !== 'earth', defaultFov: b.id === 'sun' || b.id === 'moon' ? 1 : 0.33,
      sky: () => (b.id === 'earth' ? null : sky), archive: archiveQuery(b, m) };
  } else {
    const host = star ? b : m.bodies.find((x) => x.id === (b.orbit?.host ?? b.host ?? m.starId));
    const c = catalogSky(host?.catalog);
    if (c) {
      const sepArcsec = !star && b.orbit?.a ? (b.orbit.a * (1 + (b.orbit.e ?? 0))) / c.distPc : null;
      target = { kind: 'star', ...c, sepArcsec };
      fe = createFromEarthCard(target, { getJd, onSky: (s) => { sky = s; } });
      imageryTarget = { id: b.id, name: star ? b.name : host.name, kind: star ? 'star' : 'exoplanet', moving: false, defaultFov: 0.33,
        sky: () => c, archive: archiveQuery(star ? b : host, m) };
    }
  }
  if (fe) parts.push(fe);
  const imagery = imageryTarget && (imageryTarget.sky() || imageryTarget.id === 'earth' || imageryTarget.id === 'sun') ? createImageryCard(imageryTarget) : null;
  if (imagery) parts.push(imagery);
  // COMMS (#35): live links for Earth, the Moon and Mars; Earth also gets the live-signals map
  const comms = m.isSol ? createCommsCard(b.id, { system }) : null;
  if (comms) parts.push(comms, ...(comms.extra ? [comms.extra] : []));
  // FROM THE SURFACE (#36): landed imagery or an in-app render, for anything with a surface view
  if (!star && surface) parts.push(createSurfaceCard(b, m, { system, hooks: surface }));

  const spectrum = [];
  if (star && !m.isSol) {
    const c = catalogSky(b.catalog);
    if (c) spectrum.push(starSpectrumCard({ name: b.name, ra: c.ra, dec: c.dec, distLy: c.distPc * 3.26156 }));
  } else if (!star && m.isSol) spectrum.push(bodySpectrumCard(b, clock.jd));
  else if (!star) spectrum.push(exoSpectraCard(b.name));

  return {
    top: parts.map((p) => p.node),
    spectrum: spectrum.filter(Boolean),
    tick() { fe?.tick(); imagery?.tick(); comms?.tick(); },
    dispose() { for (const p of parts) p.dispose?.(); },
  };
}
