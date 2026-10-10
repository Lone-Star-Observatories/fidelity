// Launches and spaceflight operations for the weekly feed (#32) from The Space Devs' Launch
// Library 2 (https://thespacedevs.com/llapi; free tier, attribution requested): every launch
// provider (SpaceX, NASA, ESA/Arianespace, Roscosmos, CNSA, JAXA, ISRO, Rocket Lab, Blue Origin…)
// plus dockings, undockings, berthings, spacewalks, landings and deep-space milestones.
// Times, pads, landing zones and webcasts are REPORTED; flight paths are MODELLED
// (src/astro/trajectory.js) from the pad, target orbit and published timeline.

import { ascentTrack, boosterReturn, suborbitalHop, reentryTrack, proximityProfile, destination, compactTrack } from '../../src/astro/trajectory.js';
import { TYPES, youtubeEmbed } from '../../src/data/events-schema.js';

export const LL2 = 'https://ll.thespacedevs.com/2.3.0';

/** ISO 8601 duration (P1DT2H3M4S, optionally negative) → seconds. */
export function isoDuration(s) {
  const m = /^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(s ?? '');
  if (!m) return null;
  const v = (Number(m[2] ?? 0) * 86400) + (Number(m[3] ?? 0) * 3600) + (Number(m[4] ?? 0) * 60) + Number(m[5] ?? 0);
  return m[1] ? -v : v;
}

const PRECISION = { SEC: 'second', MIN: 'minute', HR: 'hour', DAY: 'day', W: 'week', M: 'month', Q: 'quarter', H: 'half-year', Y: 'year', D: 'decade' };
export const precisionOf = (p) => PRECISION[p?.abbrev] ?? (p?.name ? p.name.toLowerCase() : 'minute');
const FINE = new Set(['second', 'minute', 'hour']);

// Stations by name: NORAD id (CelesTrak), inclination.
export const STATIONS = {
  iss: { name: 'International Space Station', norad: 25544, incDeg: 51.64 },
  tiangong: { name: 'Tiangong', norad: 48274, incDeg: 41.47 },
};
export const stationFor = (s) => (/ISS|International Space Station/i.test(s ?? '') ? STATIONS.iss : /Tiangong|CSS|Chinese Space Station/i.test(s ?? '') ? STATIONS.tiangong : null);

// Approximate recovery zones for landings given only by name (MODELLED coordinates).
const RECOVERY = [
  [/Pacific/i, [32.6, -118.9], 'Off Southern California (typical Dragon recovery zone)'],
  [/Gulf of Mexico/i, [27.6, -86.0], 'Gulf of Mexico off Florida'],
  [/Atlantic/i, [29.6, -79.6], 'Atlantic off Florida'],
  [/Kazakh/i, [47.36, 69.59], 'Kazakh steppe, south-east of Dzhezkazgan (Soyuz zone)'],
  [/Dongfeng|Inner Mongolia/i, [41.63, 100.08], 'Dongfeng landing site, Inner Mongolia'],
  [/White Sands/i, [32.94, -106.42], 'White Sands Missile Range, New Mexico'],
  [/Kennedy|Shuttle Landing/i, [28.615, -80.695], 'Shuttle Landing Facility, Kennedy Space Center'],
];
export function recoveryZone(location) {
  for (const [re, ll, name] of RECOVERY) if (re.test(location ?? '')) return { name, lat: ll[0], lon: ll[1] };
  return null;
}

// Organisation tags from any names we have.
const ORG_RULES = [
  [/SpaceX|Falcon|Dragon|Starship|Starlink/i, 'SpaceX'], [/NASA|National Aeronautics|Jet Propulsion|Crew-\d+|\bCRS\b|Commercial Resupply|\bISS\b|International Space Station/i, 'NASA'], [/European Space Agency|\bESA\b/i, 'ESA'],
  [/Arianespace|Ariane|Vega/i, 'Arianespace'], [/ROSCOSMOS|Russian|Progress|Soyuz|Roscosmos/i, 'Roscosmos'], [/China|CASC|CNSA|Long March|Shenzhou|Tianzhou|Tiangong/i, 'CNSA'],
  [/JAXA|Japan|Mitsubishi|H3|H-IIA|HTV/i, 'JAXA'], [/ISRO|Indian Space|GSLV|PSLV|SSLV|LVM3/i, 'ISRO'], [/Rocket Lab|Electron|Neutron/i, 'Rocket Lab'],
  [/Blue Origin|New Shepard|New Glenn/i, 'Blue Origin'], [/United Launch Alliance|Vulcan|Atlas V/i, 'ULA'], [/Northrop|Cygnus|Antares/i, 'Northrop Grumman'],
];
export function orgsFor(names, agencyTypes = []) {
  const s = names.filter(Boolean).join(' | '), out = new Set();
  for (const [re, tag] of ORG_RULES) if (re.test(s)) out.add(tag);
  if (agencyTypes.some((t) => /Commercial|Private/i.test(t ?? ''))) out.add('private');
  if (agencyTypes.some((t) => /Government|Multinational/i.test(t ?? ''))) out.add('agency');
  return [...out];
}

const video = (vids = []) => vids.slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((v) => ({
  url: v.url, embed: youtubeEmbed(v.url) ?? undefined, title: v.title ?? undefined, publisher: v.publisher ?? undefined,
  start: v.start_time ?? undefined, live: !!v.live, kind: v.type?.name ?? undefined })).filter((v) => /^https:\/\//.test(v.url ?? ''));

const isVandenberg = (pad) => pad.latitude > 34 && pad.latitude < 35 && pad.longitude < -119;
const isCape = (pad) => pad.latitude > 28 && pad.latitude < 29 && pad.longitude < -80 && pad.longitude > -81;

/** Target orbit for the ascent model: { incDeg, branch, insertionAltKm, suborbital, basis }. */
export function orbitParams(l) {
  const pad = l.pad, lat = Math.abs(pad.latitude), orbit = l.mission?.orbit?.abbrev ?? '', name = l.name ?? '';
  const dest = (l.rocket?.spacecraft_stage ?? []).map((s) => s.destination).find(Boolean);
  const st = stationFor(dest) ?? stationFor(l.mission?.description?.match(/to the (International Space Station|Tiangong)/)?.[1]);
  const rocket = l.rocket?.configuration?.name ?? '';
  if (/New Shepard/i.test(rocket) || orbit === 'Sub') return { suborbital: true, basis: 'Suborbital hop: straight up to ~107 km and back near the pad (generic profile).' };
  if (st) return { incDeg: st.incDeg, branch: 'north', insertionAltKm: 200, station: st, basis: `Rendezvous launch into the ${st.name}'s ${st.incDeg}° plane; ~200 km insertion orbit (generic profile).` };
  if (orbit === 'SSO') return { incDeg: 97.6, branch: 'south', insertionAltKm: 500, basis: 'Sun-synchronous orbit assumed at 97.6°, ~500 km, southbound.' };
  if (orbit === 'PO') return { incDeg: 90, branch: 'south', insertionAltKm: 400, basis: 'Polar orbit assumed at 90°, ~400 km insertion, southbound.' };
  if (/GTO|GEO|GSO|SSGTO/.test(orbit)) return { incDeg: Math.max(lat, 0.1) + 0.2, branch: 'north', insertionAltKm: 200, basis: 'Due-east parking orbit (~200 km) before the transfer burn to geostationary transfer orbit (burn not drawn).' };
  if (/Mars|Helio|Lunar|TLI|Venus|L1|L2|Escape|Sun/i.test(orbit + ' ' + (l.mission?.orbit?.name ?? ''))) return { incDeg: Math.max(lat, 0.1) + 0.5, branch: 'north', insertionAltKm: 200, basis: 'Due-east parking orbit (~200 km) before the escape burn (departure not drawn).' };
  let inc = Math.max(lat + 1, 45), branch = 'north', why = 'inclination assumed';
  if (/Starlink/i.test(name)) {
    const g = Number(/Group (\d+)/i.exec(name)?.[1]);
    if (isVandenberg(pad)) { inc = g === 11 ? 53 : g === 17 ? 97.6 : 70; branch = 'south'; why = `Starlink shell ${inc}° (from the group number)`; }
    else { inc = [8, 9].includes(g) ? 53 : 43; why = `Starlink shell ${inc}° (from the group number)`; }
  } else if (isVandenberg(pad)) { inc = 70; branch = 'south'; why = 'Vandenberg launches fly south; 70° assumed'; }
  else if (isCape(pad)) { inc = 43; why = 'Cape mid-inclination; 43° assumed'; }
  return { incDeg: inc, branch, insertionAltKm: orbit === 'MEO' ? 300 : 220, basis: `Low Earth orbit: ${why}, ~220 km insertion (generic profile).` };
}

const T = (timeline, re) => { const e = (timeline ?? []).find((x) => re.test(x.type?.abbrev ?? '')); return e ? isoDuration(e.relative_time) : null; };

/** The modelled flight of a launch: phases, ascent/coast track, booster return tracks. */
export function launchModel(l) {
  const pad = l.pad, tl = l.timeline ?? [], op = orbitParams(l);
  const phases = tl.map((x) => ({ name: x.type?.abbrev ?? '?', t: isoDuration(x.relative_time) })).filter((p) => Number.isFinite(p.t) && p.t >= 0);
  const tracks = [];
  if (op.suborbital) {
    tracks.push({ id: 'flight', label: 'Suborbital flight', tier: 'modelled', basis: op.basis, points: compactTrack(suborbitalHop({ lat: pad.latitude, lon: pad.longitude })) });
    return { kind: 'launch', phases, tracks, orbit: op };
  }
  const family = l.rocket?.configuration?.name ?? '';
  const insertionS = T(tl, /^SECO-1$|^SECO$|Orbit Insertion|^Stage 2 Cutoff/i) ?? (/Falcon 9|Falcon Heavy/.test(family) ? 520 : /Electron/.test(family) ? 540 : 600);
  const mecoS = T(tl, /^MECO$|Stage 1 Separation|Stage 2 Separation|Booster Separation/i) ?? Math.round(insertionS * 0.29);
  const deployS = T([...tl].reverse(), /Payload (Separation|Deploy)|Deploy|Dragon Separation|Spacecraft Separation|Payload Sep/i);
  const coastToS = Math.min(insertionS + 7200, Math.max(insertionS + 1200, (deployS ?? 0) + 600));
  const asc = ascentTrack({ lat: pad.latitude, lon: pad.longitude, incDeg: op.incDeg, branch: op.branch, insertionS, insertionAltKm: op.insertionAltKm, mecoS, coastToS });
  tracks.push({ id: 'ascent', label: `${family || 'Launch vehicle'} ascent and upper stage`, tier: 'modelled', basis: `${op.basis} Azimuth ${asc.azimuthDeg.toFixed(1)}° from sin(Az) = cos(i)/cos(lat) corrected for Earth's rotation; key times from the published timeline.`, points: compactTrack(asc.points) });
  const boosters = [];
  for (const s of l.rocket?.launcher_stage ?? []) {
    const ld = s.landing;
    if (!ld?.attempt) continue;
    const loc = ld.landing_location ?? {}, type = ld.type?.abbrev ?? '';
    let lat = loc.latitude, lon = loc.longitude, tier = 'reported';
    if (lat == null || lon == null) {
      const km = ld.downrange_distance ?? (type === 'ASDS' ? 600 : null);
      if (km == null) { boosters.push({ serial: s.launcher?.serial_number ?? null, landing: { type, name: loc.name ?? null, tier: 'reported' } }); continue; }
      [lat, lon] = destination(pad.latitude, pad.longitude, asc.azimuthDeg, km);
      tier = 'modelled';
    }
    const landS = T(tl, /Stage 1 Landing$|Booster Landing$|^Landing$/i) ?? (mecoS + (type === 'RTLS' ? 330 : 380));
    const serial = s.launcher?.serial_number ?? null;
    boosters.push({ serial, landing: { type, name: loc.name ?? null, abbrev: loc.abbrev ?? null, lat: +lat.toFixed(4), lon: +lon.toFixed(4), tier, downrangeKm: ld.downrange_distance ?? null } });
    tracks.push({ id: `booster-${serial ?? boosters.length}`, label: `Booster ${serial ?? ''} return to ${loc.abbrev ?? loc.name ?? type}`.replace(/\s+/g, ' ').trim(), tier: 'modelled',
      basis: `${type} landing ${tier === 'reported' ? `at ${loc.name}` : `~${ld.downrange_distance ?? 600} km downrange (drone-ship position modelled)`}; generic coast-back profile from stage separation.`,
      points: compactTrack(boosterReturn({ from: asc.meco, to: [lat, lon], landS })) });
  }
  return { kind: 'launch', phases, tracks, boosters, orbit: { incDeg: op.incDeg, insertionAltKm: op.insertionAltKm, azimuthDeg: +asc.azimuthDeg.toFixed(2), basis: op.basis }, station: op.station };
}

const STATUS = { Go: 'go', TBD: 'tbd', TBC: 'tbc', Success: 'success', Failure: 'failure', 'Partial Failure': 'partial-failure', 'In Flight': 'in-flight', Hold: 'hold' };

/** One LL2 launch (detailed mode) → feed event. */
export function launchEvent(l) {
  const precision = precisionOf(l.net_precision), pad = l.pad ?? {}, sc = (l.rocket?.spacecraft_stage ?? [])[0];
  const provider = l.launch_service_provider ?? {};
  const names = [provider.name, l.name, l.rocket?.configuration?.name, sc?.spacecraft?.name, ...(l.mission?.agencies ?? []).map((a) => a.name)];
  const orgs = orgsFor(names, [provider.type?.name, ...(l.mission?.agencies ?? []).map((a) => a.type?.name)]);
  const model = FINE.has(precision) && pad.latitude != null ? launchModel(l) : undefined;
  const st = model?.station ?? stationFor(sc?.destination);
  if (model) delete model.station;
  return {
    id: `launch-${l.id}`, category: 'launch', type: 'launch', title: l.name, description: l.mission?.description ?? '',
    time: l.net, start: l.window_start ?? undefined, end: l.window_end ?? undefined, precision, status: STATUS[l.status?.abbrev] ?? (l.status?.abbrev ?? '').toLowerCase(),
    tier: 'reported', orgs, bodies: ['earth'],
    location: { name: `${pad.name}, ${pad.location?.name ?? ''}`.replace(/, $/, ''), lat: pad.latitude, lon: pad.longitude, body: 'earth', tier: 'reported' },
    visibility: { kind: 'region', note: 'Visible from the launch region; webcast worldwide.' },
    video: video(l.vid_urls), links: [...(l.info_urls ?? []).map((u) => ({ url: u.url, title: u.title ?? 'Info' })), l.flightclub_url ? { url: l.flightclub_url, title: 'FlightClub trajectory' } : null].filter((x) => x && /^https:\/\//.test(x.url)),
    vehicle: { rocket: l.rocket?.configuration?.name ?? null, provider: provider.name ?? null, spacecraft: sc?.spacecraft?.name ?? null, boosters: model?.boosters ?? [] },
    mission: l.mission ? { name: l.mission.name, type: l.mission.type ?? null, orbit: l.mission.orbit?.name ?? null } : undefined,
    target: st ? { name: st.name, norad: st.norad } : undefined,
    model, image: l.image?.thumbnail_url ?? undefined,
    source: { name: 'The Space Devs — Launch Library 2', url: `https://thespacedevs.com/llapi`, id: l.id, slug: l.slug },
  };
}

const LL2_TYPES = [[/^Docking$/i, 'docking'], [/Undocking/i, 'undocking'], [/Berthing/i, 'berthing'], [/Release|Unberthing/i, 'release'], [/^EVA|Spacewalk/i, 'eva'],
  [/Landing|Splashdown/i, 'landing'], [/Flyby/i, 'flyby'], [/Orbital Insertion|Orbit Insertion/i, 'orbit-insertion'], [/Static Fire/i, 'static-fire'], [/Press|Briefing|Conference/i, 'press-event'],
  [/Spacecraft Event|Change of Command|Hatch|Relocation/i, 'spacecraft-event']];
export function ll2Type(name, location) {
  for (const [re, t] of LL2_TYPES) if (re.test(name ?? '')) return t === 'spacecraft-event' && stationFor(location) ? 'station-event' : t;
  return 'other';
}
/** Final-approach axis: from the vehicle, or the port named in the descriptions ("space-facing port"). */
export function portFor(name, text = '') {
  if (/Cygnus|HTV|Dream Chaser|Kounotori/i.test(name)) return 'berth';
  if (/space-facing|zenith/i.test(text)) return 'zenith';
  if (/Earth-facing|nadir/i.test(text)) return 'nadir';
  if (/aft port|Zvezda/i.test(text) || /Progress|Soyuz/i.test(name)) return 'aft';
  return 'forward';
}

/** One LL2 event → feed event (null for kinds the feed leaves out). */
export function opsEvent(e, { includePress = false } = {}) {
  const type = ll2Type(e.type?.name, e.location);
  if (type === 'press-event' && !includePress) return null;
  const precision = precisionOf(e.date_precision), st = stationFor(e.location), fine = FINE.has(precision);
  const names = [e.name, e.description, e.location, ...(e.agencies ?? []).map((a) => a.name)];
  const durS = isoDuration(e.duration);
  const ev = {
    id: `ll2-event-${e.id}`, category: TYPES[type], type, title: e.name, description: e.description ?? '', time: e.date, precision,
    status: Date.parse(e.date) < Date.now() ? 'reported' : 'scheduled', tier: 'reported', orgs: orgsFor(names, (e.agencies ?? []).map((a) => a.type?.name)),
    bodies: [st ? 'earth' : (e.location ?? '').toLowerCase()].filter(Boolean),
    location: st ? { name: st.name, body: 'earth', tier: 'reported' } : { name: e.location ?? null, tier: 'reported' },
    video: video(e.vid_urls), links: (e.info_urls ?? []).map((u) => ({ url: u.url, title: u.title ?? 'Info' })).filter((x) => /^https:\/\//.test(x.url)),
    target: st ? { name: st.name, norad: st.norad } : undefined,
    image: e.image?.thumbnail_url ?? undefined,
    source: { name: 'The Space Devs — Launch Library 2', url: 'https://thespacedevs.com/llapi', id: e.id, slug: e.slug },
  };
  if (durS) ev.end = new Date(Date.parse(e.date) + durS * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (type === 'eva' && !ev.end) ev.end = new Date(Date.parse(e.date) + 6.5 * 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (fine && st && ['docking', 'berthing', 'undocking', 'release'].includes(type)) {
    const port = type === 'berthing' || type === 'release' ? 'berth' : portFor(e.name, [e.description, ...(e.vid_urls ?? []).map((v) => v.description)].join(' '));
    ev.model = { kind: type, phases: [{ name: type === 'docking' || type === 'berthing' ? 'Contact' : 'Separation', t: 0 }],
      relative: { norad: st.norad, tier: 'modelled', basis: `Generic ${type === 'docking' || type === 'berthing' ? 'final approach' : 'departure'} in the station's local orbital frame (${port === 'berth' ? 'grappled ~10 m below by the robotic arm' : `${port} port axis`}); real corridors differ per vehicle.`,
        points: proximityProfile({ kind: type === 'docking' || type === 'berthing' ? 'docking' : 'departure', port }) } };
  }
  if (fine && type === 'eva' && st) ev.model = { kind: 'eva', phases: [{ name: 'Hatch open', t: 0 }, ...(ev.end ? [{ name: 'Hatch close', t: Math.round((Date.parse(ev.end) - Date.parse(e.date)) / 1000) }] : [])] };
  if (type === 'landing') {
    const z = recoveryZone(e.location);
    if (z) {
      ev.location = { name: `${e.location} — ${z.name}`, lat: z.lat, lon: z.lon, body: 'earth', tier: 'modelled' };
      ev.bodies = ['earth'];
      if (fine) {
        const inc = /Dongfeng|Inner Mongolia/i.test(e.location) ? STATIONS.tiangong.incDeg : STATIONS.iss.incDeg;
        ev.model = { kind: 'landing', phases: [{ name: 'Deorbit burn', t: -2400 }, { name: 'Entry interface', t: -900 }, { name: 'Parachutes', t: -300 }, { name: 'Touchdown', t: 0 }],
          tracks: [{ id: 'reentry', label: 'Re-entry and descent', tier: 'modelled', basis: `Generic re-entry from a ${inc}° orbit ending at an approximate recovery point (${z.name}); the actual zone is chosen days ahead by weather.`, points: compactTrack(reentryTrack({ lat: z.lat, lon: z.lon, incDeg: inc })) }] };
      }
    }
  }
  return ev;
}

/** Webcasts in the feed: one per YouTube video, linked to its event. */
export function streamsFrom(events, now = Date.now()) {
  const out = new Map();
  for (const e of events) for (const v of e.video ?? []) {
    if (!v.embed) continue;
    const id = v.embed.split('/').pop();
    if (out.has(id)) continue;
    const start = v.start ?? e.time, t = Date.parse(start);
    out.set(id, { id, title: v.title ?? e.title, url: v.url, embed: v.embed, start, publisher: v.publisher ?? null, eventId: e.id,
      status: v.live ? 'live' : t > now ? 'upcoming' : 'recent' });
  }
  return [...out.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
