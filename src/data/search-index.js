// Text search (#63): the static index — everything that ships with the app (Sol's bodies, points
// and regions, spacecraft, future missions, surface sites, nebulae, famous clusters, named galaxies
// and galaxy clusters), as search entries with aliases and a route. Pure data, testable in node.

import { smallBodyAliases, BODY_ALIASES, MINOR_PLANET_NUMBERS } from './search.js';
import { solSystem } from './systems.js';
import { SMALL_BODIES } from './moons.js';
import { SITES, SITE_KINDS } from './sites.js';
import { NEBULAE, NEBULA_KIND, FAMOUS_CLUSTERS, GALAXY_NAMES, GALAXY_CLUSTERS } from './deepsky.js';
import { FUTURE_MISSIONS } from './future-missions.js';

const SMALL = new Set(SMALL_BODIES.map((b) => b.id));
// "James Webb Space Telescope" → "JWST" (only for names of three or more words)
const acronym = (name) => { const w = name.split(/[\s–-]+/).filter((x) => /^[A-Za-z]/.test(x)); return w.length >= 3 ? w.map((x) => x[0]).join('') : null; };

/** Static entries: everything that ships with the app. Pure enough to test without a DOM. */
export function staticEntries() {
  const out = [];
  for (const b of solSystem().bodies) {
    if (b.kind === 'spacecraft') { out.push({ kind: 'spacecraft', id: b.id, name: b.name, aliases: [b.agency, b.id.replace(/-/g, ' '), acronym(b.name), `${b.name} spacecraft`, b.id === 'jwst' ? 'Webb' : null].filter(Boolean), sub: `${b.agency ?? ''} · ${b.status ?? ''}`, route: { body: b.id } }); continue; }
    if (b.kind === 'lagrange point' || b.kind === 'region') { out.push({ kind: 'place', id: b.id, name: b.name, aliases: [b.id.toUpperCase()], sub: b.kind.toUpperCase(), route: { body: b.id } }); continue; }
    const small = SMALL.has(b.id);
    out.push({ kind: small ? 'small body' : 'body', id: b.id, name: b.name, aliases: [...(BODY_ALIASES[b.id] ?? []), ...(small ? smallBodyAliases(b.id, b.name) : [])],
      sub: `${(b.kind ?? '').toUpperCase()}${MINOR_PLANET_NUMBERS[b.id] && b.kind !== 'moon' ? ` · (${MINOR_PLANET_NUMBERS[b.id]})` : ''}${b.parent && b.kind === 'moon' ? ` OF ${b.parent.toUpperCase()}` : ''}`, route: { body: b.id }, boost: small ? 0 : 2 });
  }
  for (const m of FUTURE_MISSIONS) out.push({ kind: 'mission', id: m.id, name: m.name, aliases: [m.agency, m.targetName, acronym(m.name), `${m.name} mission`].filter(Boolean), sub: `${m.agency} · ${m.targetName ?? ''} · ${m.launch ?? ''}`.toUpperCase(), route: { mission: m.id } });
  for (const s of SITES) out.push({ kind: 'site', id: s.id, name: s.name, aliases: [s.short, s.agency].filter(Boolean), sub: `${SITE_KINDS[s.kind]?.label ?? s.kind} · ${s.body.toUpperCase()}`, tier: s.tier, route: { site: s.id } });
  for (const [name, kind, , , ly, note] of NEBULAE) out.push({ kind: 'nebula', id: `neb-${name}`, name, aliases: name.split(' · '), sub: `${NEBULA_KIND[kind] ?? kind} · ${ly.toLocaleString('en')} LY`, note, route: { quadrant: `neb-${name}` } });
  for (const [cat, common] of Object.entries(FAMOUS_CLUSTERS)) out.push({ kind: 'cluster', id: `cl-${cat}`, name: common, aliases: [cat, ...common.split(/ \(|\)/).filter(Boolean)], sub: cat.toUpperCase(), route: { quadrant: `cl-${cat}` } });
  for (const [key, common] of Object.entries(GALAXY_NAMES)) if (common) out.push({ kind: 'galaxy', id: `gal-${key}`, name: common, aliases: [key, ...common.split(' · '), key.replace(/^MESSIER0*/, 'M').replace(/^NGC0*/, 'NGC ').replace(/^IC0*/, 'IC ').replace(/a$/, '')], sub: 'UNGC', route: { universe: `gal-${key}` } });
  for (const [name, , , mly] of GALAXY_CLUSTERS) out.push({ kind: 'galaxy cluster', id: `gcl-${name}`, name, aliases: name.split(' · '), sub: `${mly} MLY`, route: { universe: `gcl-${name}` } });
  return out;
}

