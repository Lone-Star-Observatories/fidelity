// "Visible from my location" for the events panel (#33).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventVisibility, altitude, geomagneticLat, solarEclipseAt, hhmm } from '../src/astro/eventvis.js';
import { solarEclipses, lunarEclipses, lunarOccultations } from '../src/astro/eclipses.js';

const JD = (iso) => Date.parse(iso) / 86400000 + 2440587.5;
const iso = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString();
/** A feed-shaped event (as the client holds it: jd and endJd set) from an eclipses.js result. */
const asEvent = (type, x) => ({ id: `${type}-${x.greatest}`, type, category: 'celestial', jd: x.greatest,
  start: x.contacts?.P1 ? iso(x.contacts.P1) : undefined, end: x.contacts?.P4 ? iso(x.contacts.P4) : undefined, endJd: x.contacts?.P4 ?? null, bodies: ['sun', 'moon', 'earth'] });

const LUXOR = { lat: 25.70, lon: 32.65 }, CAIRO = { lat: 30.04, lon: 31.24 }, SYDNEY = { lat: -33.87, lon: 151.21 }, LONDON = { lat: 51.48, lon: 0 },
  NEW_YORK = { lat: 40.71, lon: -74.01 }, MUMBAI = { lat: 19.08, lon: 72.88 }, LOS_ANGELES = { lat: 34.05, lon: -118.24 };

test('altitudes: the Sun overhead at noon on the equator at the equinox, below the horizon at midnight', () => {
  const noon = JD('2026-03-20T12:07:00Z'); // equinox 14:46 UT; equation of time ≈ −7 min
  assert.ok(altitude('sun', noon, 0, 0) > 88, String(altitude('sun', noon, 0, 0)));
  assert.ok(altitude('sun', noon + 0.5, 0, 0) < -85);
  assert.equal(altitude('unknown-thing', noon, 0, 0), null);
  // a star's altitude repeats each sidereal day
  const a = altitude('aldebaran', noon, LONDON.lat, LONDON.lon), b = altitude('aldebaran', noon + 0.99727, LONDON.lat, LONDON.lon);
  assert.ok(Math.abs(a - b) < 0.1, `${a} ${b}`);
});

test('solar eclipse 2027-08-02: Luxor in the path of totality, Cairo partial, Sydney outside the penumbra', () => {
  const [ecl] = solarEclipses(JD('2027-08-01T00:00Z'), JD('2027-08-03T00:00Z'));
  assert.equal(ecl.kind, 'total');
  const e = asEvent('solar-eclipse', ecl);
  const lux = eventVisibility(e, LUXOR);
  assert.equal(lux.visible, true);
  assert.match(lux.reason, /^IN THE PATH OF TOTALITY · MAXIMUM 10:\d\d UTC, SUN \d+° UP$/);
  assert.ok(lux.inPath);
  // NASA/GSFC: totality at Luxor ≈ 10:07 UT, the Sun ~80° up
  assert.ok(Math.abs(lux.max.jd - JD('2027-08-02T10:07:30Z')) < 3 / 1440, hhmm(lux.max.jd));
  assert.ok(lux.max.sunAlt > 75);
  const cai = eventVisibility(e, CAIRO);
  assert.equal(cai.visible, true);
  assert.equal(cai.inPath, false);
  const pct = Number(/(\d+)% OF THE SUN COVERED/.exec(cai.reason)?.[1]);
  assert.ok(pct > 80 && pct < 100, cai.reason);
  const syd = eventVisibility(e, SYDNEY);
  assert.equal(syd.visible, false);
  assert.match(syd.reason, /OUTSIDE THE PENUMBRA|SUN IS BELOW THE HORIZON HERE/); // 20:00 in Sydney
});

test('annular eclipse 2027-02-06: a point on the centreline at greatest eclipse sees annularity', () => {
  const [ecl] = solarEclipses(JD('2027-02-05T00:00Z'), JD('2027-02-07T00:00Z'));
  assert.equal(ecl.kind, 'annular');
  const e = asEvent('solar-eclipse', ecl);
  const v = eventVisibility(e, { lat: ecl.place.lat, lon: ecl.place.lon });
  assert.equal(v.visible, true);
  assert.match(v.reason, /IN THE PATH OF ANNULARITY/);
  const m = solarEclipseAt(e, ecl.place.lat, ecl.place.lon);
  assert.ok(Math.abs(m.jd - ecl.greatest) < 2 / 1440, `${hhmm(m.jd)} vs ${hhmm(ecl.greatest)}`);
});

test('lunar eclipse 2025-09-07: high from Mumbai, rising mid-eclipse in London, unseen from New York', () => {
  const [ecl] = lunarEclipses(JD('2025-09-06T00:00Z'), JD('2025-09-09T00:00Z'));
  assert.equal(ecl.kind, 'total');
  const e = { ...asEvent('lunar-eclipse', ecl), bodies: ['moon', 'earth', 'sun'] };
  const mum = eventVisibility(e, MUMBAI);
  assert.equal(mum.visible, true);
  assert.match(mum.reason, /^MOON \d+° UP AT MAXIMUM/);
  const lon = eventVisibility(e, LONDON);
  assert.equal(lon.visible, true);
  assert.match(lon.reason, /BELOW THE HORIZON AT MAXIMUM .* UP 1[89]:\d\d UTC/); // moonrise ≈ 18:3x UT, before the end
  const ny = eventVisibility(e, NEW_YORK);
  assert.equal(ny.visible, false);
  assert.match(ny.reason, /BELOW THE HORIZON THROUGHOUT/);
});

test('occultation of Mars, 2022-12-08: covered from Los Angeles, not from Sydney', () => {
  const occ = lunarOccultations(JD('2022-12-07T12:00Z'), JD('2022-12-08T12:00Z')).find((o) => o.body === 'mars');
  assert.ok(occ, 'the occultation is found');
  const e = { id: 'occ', type: 'occultation', category: 'celestial', jd: occ.greatest, bodies: ['moon', 'mars'] };
  const dc = eventVisibility(e, LOS_ANGELES); // ~11′ inside the limb here (Washington is a near-graze)
  assert.equal(dc.visible, true);
  assert.match(dc.reason, /^OCCULTED FROM HERE AROUND 0[2-3]:\d\d UTC · MOON \d+°, MARS \d+° UP/);
  assert.ok(dc.covered);
  const syd = eventVisibility(e, SYDNEY);
  assert.notEqual(syd.covered, true);
  assert.match(syd.reason, /NOT OCCULTED FROM HERE|BELOW THE HORIZON/);
});

test('planetary events: up in a dark sky at the time, or that night, or not at all', () => {
  // Saturn at opposition, 2025-09-21: up all night everywhere it rises
  const opp = { type: 'opposition', category: 'celestial', jd: JD('2025-09-21T04:00Z'), bodies: ['saturn'] };
  const fromLondon = eventVisibility(opp, LONDON); // 05:00 BST, Saturn low in the west, sky still dark
  assert.equal(fromLondon.visible, true);
  const fromSydney = eventVisibility(opp, SYDNEY); // 14:00 local: daylight, but up that night
  assert.equal(fromSydney.visible, true);
  assert.match(fromSydney.reason, /^BELOW THE HORIZON AT 04:00 UTC · UP IN A DARK SKY \d\d:\d\d UTC–\d\d:\d\d UTC$/);
  // a conjunction of Mercury with the Sun's neighbourhood never gets a dark sky far north in summer
  const conj = { type: 'conjunction', category: 'celestial', jd: JD('2026-06-21T12:00Z'), bodies: ['mercury', 'venus'] };
  const north = eventVisibility(conj, { lat: 78.2, lon: 15.6 }); // Svalbard, midnight sun
  assert.equal(north.visible, false);
  assert.equal(eventVisibility({ type: 'conjunction', category: 'celestial', jd: opp.jd, bodies: ['saturn', 'vulcan'] }, LONDON).visible, null);
});

test('transits need the Sun up; meteor showers the radiant up in the dark; aurora the geomagnetic latitude', () => {
  // Mercury's 2032-11-13 transit (06:41–11:07 UT): seen from Europe, not from Hawaii
  const tr = { type: 'transit', category: 'celestial', jd: JD('2032-11-13T08:54Z'), start: '2032-11-13T06:41:00Z', end: '2032-11-13T11:07:00Z', endJd: JD('2032-11-13T11:07Z'), bodies: ['mercury', 'sun'] };
  assert.equal(eventVisibility(tr, LONDON).visible, true);
  assert.equal(eventVisibility(tr, { lat: 21.3, lon: -157.86 }).visible, false);
  // Perseids (radiant RA 48°, Dec +58°): fine from London, never above Sydney's horizon
  const per = { type: 'meteor-shower', category: 'celestial', jd: JD('2026-08-12T20:00Z'), description: 'ZHR ≈ 100 under ideal dark skies; 59 km/s meteors from RA 48°, Dec +58°.' };
  assert.equal(eventVisibility(per, LONDON).visible, true);
  assert.equal(eventVisibility(per, SYDNEY).visible, false);
  // aurora: Fairbanks is near 65° geomagnetic; Singapore near the geomagnetic equator
  assert.ok(Math.abs(geomagneticLat(64.84, -147.72) - 65) < 2.5, String(geomagneticLat(64.84, -147.72)));
  const aur = { type: 'aurora', category: 'celestial', jd: JD('2026-10-12T03:00Z'), visibility: { minGeomagLat: 55 } };
  const fb = eventVisibility(aur, { lat: 64.84, lon: -147.72 });
  assert.equal(fb.visible, true);
  assert.equal(fb.tier, 'modelled');
  assert.equal(eventVisibility(aur, { lat: 1.35, lon: 103.82 }).visible, false);
});

test('launches and webcasts are always watchable; comets are not computed; no location, no answer', () => {
  const launch = { type: 'launch', category: 'launch', jd: JD('2026-10-20T12:00Z'), video: [{ url: 'https://youtube.com/watch?v=x' }], location: { lat: 28.56, lon: -80.58 } };
  const orlando = eventVisibility(launch, { lat: 28.54, lon: -81.38 });
  assert.equal(orlando.visible, true);
  assert.equal(orlando.tier, 'reported');
  assert.match(orlando.reason, /^WATCHABLE · WEBCAST LISTED · PAD \d+ KM AWAY/);
  const far = eventVisibility({ ...launch, video: [] }, SYDNEY);
  assert.deepEqual([far.visible, far.reason], [true, 'WATCHABLE ONLINE · NO WEBCAST LISTED YET']);
  assert.equal(eventVisibility({ type: 'docking', category: 'station', jd: launch.jd }, SYDNEY).visible, true);
  assert.equal(eventVisibility({ type: 'comet', category: 'celestial', jd: launch.jd }, SYDNEY).visible, null);
  assert.equal(eventVisibility(launch, { lat: NaN, lon: 0 }).visible, null);
});
