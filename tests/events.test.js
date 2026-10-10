// Events feed (#32): the published file, the modelled flight paths, the LL2 mapping, the sky
// computations (checked against JPL Horizons) and the YouTube stream helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateFeed, youtubeId, youtubeEmbed, TYPES } from '../src/data/events-schema.js';
import { launchAzimuth, headingForInclination, ascentTrack, boosterReturn, reentryTrack, proximityProfile, sampleTrack, inverse, destination, inclinationOf } from '../src/astro/trajectory.js';
import { isoDuration, orbitParams, launchEvent, opsEvent, ll2Type, portFor, recoveryZone, streamsFrom } from '../scripts/events/ll2.js';
import { cometPosition, solarLongitude, whenSolarLongitude, auroraEvents, auroraLatitude } from '../scripts/events/sky.js';
import { parseRss, mergeStreams } from '../server/youtube.js';
import { missionClock, phaseAt } from '../src/views/system/missions.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('the published feed is valid and every event has a known type', () => {
  const feed = JSON.parse(fs.readFileSync(new URL('../events/events.json', import.meta.url), 'utf8'));
  const v = validateFeed(feed);
  assert.ok(v.ok, v.problems.slice(0, 10).join('\n'));
  for (const e of feed.events) assert.ok(TYPES[e.type]);
  // published schedules are never badged as measured
  for (const e of feed.events.filter((x) => x.category === 'launch')) assert.equal(e.tier, 'reported');
  for (const e of feed.events) for (const t of e.model?.tracks ?? []) assert.equal(t.tier, 'modelled');
});

test('launch azimuth: Cape Canaveral to the ISS', () => {
  // inertial: sin Az = cos 51.64° / cos 28.56° → 45.0°; the Earth's spin pulls the ground-relative heading north
  close(headingForInclination(28.56, 51.64), 45.0, 0.1);
  const az = launchAzimuth(28.56, 51.64);
  assert.ok(az < 45 && az > 40, `rotating-frame azimuth ${az}`);
  close(inclinationOf(28.56, 45.0), 51.64, 0.1);
  // southbound polar/SSO from Vandenberg heads a little west of south
  const sso = launchAzimuth(34.63, 97.6, 'south');
  assert.ok(sso > 180 && sso < 205, `SSO azimuth ${sso}`);
});

test('great-circle helpers invert each other', () => {
  const [la, lo] = destination(28.5, -80.6, 45, 1500);
  const r = inverse([28.5, -80.6], [la, lo]);
  close(r.distKm, 1500, 0.01); close(r.azDeg, 45, 0.01);
});

test('ascent reaches orbit and the coast stays on the requested inclination', () => {
  const a = ascentTrack({ lat: 28.56, lon: -80.58, incDeg: 51.64, insertionS: 520, insertionAltKm: 210, coastToS: 520 + 5600 });
  close(a.points[0][1], 28.56, 1e-9); close(a.points[0][2], -80.58, 1e-9);
  close(a.insertion[3], 210, 1e-6);
  const maxLat = Math.max(...a.points.map((p) => Math.abs(p[1])));
  close(maxLat, 51.64, 0.6, 'max latitude on the coast');
  // altitude climbs monotonically during the burn
  const burn = a.points.filter((p) => p[0] <= 520);
  for (let i = 1; i < burn.length; i++) assert.ok(burn[i][3] >= burn[i - 1][3]);
  close(sampleTrack(a.points, 260)[0], 260, 0);
});

test('booster return and re-entry end on their sites', () => {
  const a = ascentTrack({ lat: 28.56, lon: -80.58, incDeg: 51.64 });
  const b = boosterReturn({ from: a.meco, to: [28.5634, -80.5753], landS: 441 });
  assert.equal(b.at(-1)[0], 441); close(b.at(-1)[1], 28.5634, 1e-6); close(b.at(-1)[2], -80.5753, 1e-6); assert.equal(b.at(-1)[3], 0);
  const r = reentryTrack({ lat: 32.6, lon: -118.9 });
  assert.equal(r.at(-1)[0], -0); close(r.at(-1)[1], 32.6, 1e-6); close(r.at(-1)[3], 0, 1e-9);
  close(r[0][3], 400, 1e-6, 'starts in orbit');
  const d = proximityProfile({ kind: 'docking', port: 'zenith' });
  assert.deepEqual(d.at(-1).slice(1), [0, 0, 0]);
  assert.ok(d.at(-3)[1] > 0, 'zenith approach comes from above');
});

test('LL2 mapping: durations, types, ports, orbits and recovery zones', () => {
  assert.equal(isoDuration('PT8M30S'), 510); assert.equal(isoDuration('-PT38M'), -2280); assert.equal(isoDuration('P0D'), 0); assert.equal(isoDuration('PT1H11M12S'), 4272);
  assert.equal(ll2Type('Spacecraft Undocking'), 'undocking'); assert.equal(ll2Type('Docking'), 'docking'); assert.equal(ll2Type('EVA'), 'eva');
  assert.equal(ll2Type('Spacecraft Event', 'International Space Station'), 'station-event'); assert.equal(ll2Type('Spacecraft Event', 'Mercury'), 'spacecraft-event');
  assert.equal(portFor('SpaceX CRS-35 Dragon Docking', 'dock to the space-facing port of Harmony'), 'zenith');
  assert.equal(portFor('Progress MS-36 Docking'), 'aft'); assert.equal(portFor('NG-25 Cygnus Berthing'), 'berth');
  assert.equal(recoveryZone('Pacific Ocean').lat, 32.6); assert.equal(recoveryZone('Mars'), null);
  const pad = { latitude: 34.632, longitude: -120.611, name: 'SLC-4E' };
  assert.equal(orbitParams({ pad, name: 'Falcon 9 | Starlink Group 15-25', mission: { orbit: { abbrev: 'LEO' } } }).incDeg, 70);
  assert.equal(orbitParams({ pad, name: 'X', mission: { orbit: { abbrev: 'SSO' } } }).branch, 'south');
  assert.equal(orbitParams({ pad: { latitude: 28.56, longitude: -80.58 }, name: 'CRS', mission: { orbit: { abbrev: 'LEO' } }, rocket: { spacecraft_stage: [{ destination: 'ISS' }] } }).incDeg, 51.64);
});

const LAUNCH = {
  id: 'abc', name: 'Falcon 9 Block 5 | Test', net: '2026-10-13T10:33:44Z', net_precision: { abbrev: 'SEC' }, status: { abbrev: 'Go' },
  launch_service_provider: { name: 'SpaceX', type: { name: 'Commercial' } },
  pad: { name: 'Space Launch Complex 40', latitude: 28.5619, longitude: -80.5774, location: { name: 'Cape Canaveral SFS, FL, USA' } },
  mission: { name: 'Test', description: 'A test.', orbit: { abbrev: 'LEO', name: 'Low Earth Orbit' }, agencies: [{ name: 'National Aeronautics and Space Administration', type: { name: 'Government' } }] },
  rocket: { configuration: { name: 'Falcon 9' }, spacecraft_stage: [{ destination: 'ISS', spacecraft: { name: 'Cargo Dragon C211' } }],
    launcher_stage: [{ launcher: { serial_number: 'B1096' }, landing: { attempt: true, type: { abbrev: 'RTLS' }, downrange_distance: 0.3, landing_location: { name: 'Landing Zone 40', abbrev: 'LZ-40', latitude: 28.5634, longitude: -80.5753 } } },
      { launcher: { serial_number: 'B9999' }, landing: { attempt: true, type: { abbrev: 'ASDS' }, downrange_distance: 610, landing_location: { name: 'A Shortfall of Gravitas', abbrev: 'ASOG' } } }] },
  timeline: [{ type: { abbrev: 'Liftoff' }, relative_time: 'P0D' }, { type: { abbrev: 'MECO' }, relative_time: 'PT2M15S' }, { type: { abbrev: 'Stage 1 Landing' }, relative_time: 'PT7M21S' },
    { type: { abbrev: 'SECO-1' }, relative_time: 'PT8M30S' }, { type: { abbrev: 'Dragon Separation' }, relative_time: 'PT9M18S' }],
  vid_urls: [{ priority: 1, url: 'https://www.youtube.com/watch?v=f8FE2R7esZ0', title: 'Launch', publisher: 'NASA', start_time: '2026-10-13T10:15:00Z', live: false }],
};

test('LL2 launch → event with a modelled flight', () => {
  const e = launchEvent(LAUNCH);
  assert.equal(e.category, 'launch'); assert.equal(e.tier, 'reported'); assert.deepEqual(e.target, { name: 'International Space Station', norad: 25544 });
  assert.ok(e.orgs.includes('SpaceX') && e.orgs.includes('NASA'));
  assert.equal(e.video[0].embed, 'https://www.youtube-nocookie.com/embed/f8FE2R7esZ0');
  const ascent = e.model.tracks.find((t) => t.id === 'ascent');
  assert.ok(ascent.points.some((p) => p[0] === 510), 'insertion at SECO-1');
  const rtls = e.model.tracks.find((t) => t.id === 'booster-B1096');
  assert.equal(rtls.points.at(-1)[0], 441);
  const asds = e.vehicle.boosters.find((b) => b.serial === 'B9999');
  assert.equal(asds.landing.tier, 'modelled', 'drone-ship position derived from the downrange distance');
  close(inverse([28.5619, -80.5774], [asds.landing.lat, asds.landing.lon]).distKm, 610, 1);
  assert.ok(validateFeed({ schema: 'fidelity.events/1', generated: '2026-10-10T00:00:00Z', events: [e] }).ok);
  // an imprecise date carries no flight model
  assert.equal(launchEvent({ ...LAUNCH, net_precision: { abbrev: 'M' } }).model, undefined);
  assert.equal(streamsFrom([e], Date.parse('2026-10-10T00:00:00Z'))[0].status, 'upcoming');
});

test('LL2 docking and splashdown events get relative and re-entry models', () => {
  const dock = opsEvent({ id: 1, name: 'SpaceX CRS-35 Dragon Docking', type: { name: 'Docking' }, date: '2026-10-15T15:00:00Z', date_precision: { abbrev: 'MIN' }, location: 'International Space Station',
    description: 'docks to the space-facing port', vid_urls: [] });
  assert.equal(dock.type, 'docking'); assert.equal(dock.target.norad, 25544); assert.ok(dock.model.relative.points.length > 4);
  const land = opsEvent({ id: 2, name: 'Crew Dragon Splashdown', type: { name: 'Spacecraft Landing' }, date: '2026-10-08T15:34:00Z', date_precision: { abbrev: 'MIN' }, location: 'Pacific Ocean', vid_urls: [] });
  assert.equal(land.location.tier, 'modelled'); assert.equal(land.model.tracks[0].points.at(-1)[3], 0);
  assert.equal(opsEvent({ id: 3, name: 'News conference', type: { name: 'Press Event' }, date: '2026-10-08T15:34:00Z' }), null);
});

test('comet two-body positions against JPL Horizons (12P/Pons-Brooks at perihelion)', () => {
  // SBDB osculating elements (epoch 2023-09-24); Horizons heliocentric ecliptic J2000, 2024-04-21 00:00 TDB
  const el = { q: 0.7808611337784586, e: 0.954561244241766, i: 74.19091025149504, om: 255.8553515784109, w: 198.9879991135792, tp: 2460421.6311579808 };
  const p = cometPosition(el, 2460421.5), ref = [0.1144154257630652, 0.7336811575122405, -0.241364416687912];
  assert.ok(Math.hypot(p[0] - ref[0], p[1] - ref[1], p[2] - ref[2]) < 0.001, `${p} vs ${ref}`);
  // hyperbolic and parabolic branches are continuous with the elliptic one near e = 1
  const near = (e) => cometPosition({ ...el, e }, 2460421.5 + 30);
  const a = near(0.9999), b = near(1.0), c = near(1.0001);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.01 && Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]) < 0.01);
});

test('solar longitude against JPL Horizons and the Perseid peak date', () => {
  // Horizons geometric geocentric Sun, ecliptic J2000, 2026-08-12 00:00 TDB
  const ref = (Math.atan2(9.954430758214843e7, -1.143459250545978e8) * 180) / Math.PI;
  close(solarLongitude(2461264.5 - 69.2 / 86400), ref, 0.01);
  // IMO: Perseids peak at λ☉ = 140.0°, 2026 Aug 12–13
  const jd = whenSolarLongitude(140.0, 2461250.5, 2461280.5);
  const d = new Date((jd - 2440587.5) * 86400000).toISOString();
  assert.ok(d >= '2026-08-12T12:00' && d <= '2026-08-13T12:00', d);
});

test('aurora watches from SWPC forecasts', () => {
  assert.equal(auroraLatitude(5), 57); assert.equal(auroraLatitude(9), 49);
  const ev = auroraEvents({ kpForecast: [{ time_tag: '2026-10-12T03:00:00', kp: 5.67, observed: 'predicted' }, { time_tag: '2026-10-12T06:00:00', kp: 3, observed: 'predicted' }],
    outlookText: '2026 Oct 21      90          18          5\n2026 Oct 22      90          5          2' }, 2461320, 2461350);
  assert.deepEqual(ev.map((e) => e.id), ['aurora-2026-10-12', 'aurora-2026-10-21']);
  assert.ok(ev.every((e) => e.tier === 'modelled'));
});

test('YouTube helpers', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=-jPQmjMWy9I'), '-jPQmjMWy9I');
  assert.equal(youtubeId('https://youtu.be/IoL51xLkMSY?t=3'), 'IoL51xLkMSY');
  assert.equal(youtubeEmbed('https://plus.nasa.gov/scheduled-video/x/'), null);
  const rss = parseRss('<feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>Crew &amp; Cargo Launch</title><published>2026-10-09T14:36:38+00:00</published></entry></feed>');
  assert.deepEqual(rss, [{ videoId: 'abcdefghijk', title: 'Crew & Cargo Launch', published: '2026-10-09T14:36:38+00:00' }]);
  const m = mergeStreams([{ id: 'a', status: 'posted', start: '2026-10-09T00:00:00Z' }], [{ id: 'a', status: 'live', start: '2026-10-09T00:00:00Z', eventId: 'x' }]);
  assert.equal(m.length, 1); assert.equal(m[0].status, 'live'); assert.equal(m[0].eventId, 'x');
});

test('mission clock and phases', () => {
  assert.equal(missionClock(-60), 'T−01:00'); assert.equal(missionClock(135), 'T+02:15'); assert.equal(missionClock(4272), 'T+01:11:12');
  assert.equal(phaseAt([{ name: 'MECO', t: 135 }, { name: 'SECO-1', t: 510 }], 200), 'MECO');
});
