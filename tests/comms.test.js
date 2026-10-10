// COMMS (#35): parsers for SatNOGS, the Mars rover feeds and the live-signals layers, and the
// DSN helpers. Fixtures are trimmed copies of real responses (2026-10-10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTransmitters, parseObservations, parseWeather } from '../server/comms.js';
import { parseRadioBrowser, parseKiwiList, parseTfl, parseCaltrans, parseNzta, parseWindy, signalLayers } from '../server/signals.js';
import { updateLastSeen } from '../server/dsn.js';
import { contactsFor, lastSeenFor, dishSize, ago, lightSeconds, formatLight } from '../src/data/comms.js';

test('SatNOGS transmitters: MHz, active first, invalid dropped', () => {
  const rows = parseTransmitters([
    { description: 'Old beacon', status: 'inactive', alive: false, downlink_low: 145800000, mode: 'FM' },
    { description: 'Mode V APRS', status: 'active', alive: true, uplink_low: 145825000, downlink_low: 145825000, mode: 'AFSK', baud: 1200 },
    { description: 'Bad', status: 'invalid', alive: false, downlink_low: 1 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, 'Mode V APRS');
  assert.equal(rows[0].downlink, 145.825);
  assert.equal(rows[0].baud, 1200);
});

test('SatNOGS observations: this satellite only, finished, newest first, with products', () => {
  const obs = (id, end, norad = 25544) => ({ id, start: end, end, norad_cat_id: norad, status: 'good', station_name: `st${id}`, station_lat: 1, station_lng: 2,
    waterfall: `https://w/${id}.png`, payload: `https://a/${id}.ogg`, demoddata: [{}], observation_frequency: 437825000, transmitter_mode: 'AFSK' });
  const now = Date.parse('2026-10-10T15:00:00Z');
  const rows = parseObservations([obs(1, '2026-10-10T10:00:00Z'), obs(2, '2026-10-10T14:00:00Z'), obs(3, '2026-10-12T14:00:00Z'), obs(4, '2026-10-10T14:30:00Z', 68446)], 25544, now);
  assert.deepEqual(rows.map((r) => r.id), [2, 1]);
  assert.equal(rows[0].frequencyMhz, 437.825);
  assert.equal(rows[0].url, 'https://network.satnogs.org/observations/2/');
  assert.equal(rows[0].decoded, 1);
});

test('Mars weather: newest sol with a reading (REMS newest-first, MEDA oldest-first, "--" = none)', () => {
  const rems = parseWeather({ soles: [{ sol: '4996', terrestrial_date: '2026-08-26', min_temp: '--', max_temp: '--', pressure: '--' },
    { sol: '4995', terrestrial_date: '2026-08-25', min_temp: '-71', max_temp: '-5', pressure: '777', atmo_opacity: 'Sunny', local_uv_irradiance_index: 'Moderate' }] });
  assert.equal(rems.sol, 4995);
  assert.equal(rems.minC, -71);
  assert.equal(rems.opacity, 'Sunny');
  const meda = parseWeather({ sols: [{ sol: '1127', min_temp: '--', max_temp: '--', pressure: '--' }, { sol: '1133', terrestrial_date: '2024-04-27', min_temp: -79.3, max_temp: -24.7, pressure: 778.9 }] });
  assert.equal(meda.sol, 1133);
  assert.equal(meda.pressurePa, 778.9);
  assert.equal(parseWeather({ soles: [] }), null);
});

test('Radio Browser: geolocated stations with a stream, deduplicated', () => {
  const st = { stationuuid: 'a', name: 'GoRadio', geo_lat: 6.43, geo_long: 3.38, url_resolved: 'https://s/radio.mp3', homepage: 'https://goradio/', country: 'Nigeria', tags: 'afrobeat', codec: 'MP3', bitrate: 192 };
  const rows = parseRadioBrowser([st, st, { ...st, stationuuid: 'b', geo_lat: null }, { ...st, stationuuid: 'c', url_resolved: 'javascript:x', url: '' }]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(0, 4), [6.43, 3.38, 'GoRadio', 'https://goradio/']);
  assert.equal(rows[0][5], 'https://s/radio.mp3');
});

test('KiwiSDR list: the JS file with trailing commas, active receivers only, free-slot flag', () => {
  const js = `// header\nvar kiwisdr_com =\n[\n\t{\n\t\t"status":"active","offline":"no","name":"14 MHz SDR | Kuriyama","bands":"10000000-15000000","users":"4","users_max":"6","gps":"(43.057154, 141.776868)","antenna":"dipole","url":"http://jj8ntm.proxy.kiwisdr.com"\n\t},\n\t{\n\t\t"status":"active","offline":"yes","name":"Down","gps":"(1, 2)","url":"http://x"\n\t},\n\t{\n\t\t"status":"active","offline":"no","name":"Full","gps":"(-34.27, 138.77)","users":"8","users_max":"8","url":"http://y"\n\t},\n]\n;\n`;
  const rows = parseKiwiList(js);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][2], '14 MHz SDR | Kuriyama');
  assert.match(rows[0][4], /10–15 MHz · 4\/6 LISTENING/);
  assert.equal(rows[0][5], 1);
  assert.equal(rows[1][5], 0);
});

test('Traffic cameras: TfL, Caltrans and NZTA', () => {
  const tfl = parseTfl([{ commonName: 'A406 Billet Upass E', lat: 51.60067, lon: -0.01594, additionalProperties: [
    { key: 'available', value: 'true' }, { key: 'imageUrl', value: 'https://s3/x.jpg' }, { key: 'videoUrl', value: 'https://s3/x.mp4' }, { key: 'view', value: 'West' }] },
  { commonName: 'Off', lat: 51, lon: 0.1, additionalProperties: [{ key: 'available', value: 'false' }, { key: 'imageUrl', value: 'https://s3/y.jpg' }] }]);
  assert.equal(tfl.length, 1);
  assert.equal(tfl[0][3], 'https://s3/x.jpg');
  const ct = parseCaltrans({ data: [{ cctv: { inService: 'true', location: { district: '7', locationName: 'I-110 : Avenue 26', nearbyPlace: 'Cypress Park', latitude: '34.0837', longitude: '-118.2215' },
    imageData: { streamingVideoURL: 'https://wz/x.m3u8', static: { currentImageURL: 'https://cwwp2/x.jpg' } } } }, { cctv: { inService: 'false', location: {} } }] });
  assert.equal(ct.length, 1);
  assert.equal(ct[0][0], 34.0837);
  const nz = parseNzta('<response><camera><description>South along SH1</description><id>714</id><imageUrl>/camera/714.jpg</imageUrl><journey><startLatitude>-41.9</startLatitude><startLongitude>174.06</startLongitude></journey><latitude>-43.919632</latitude><longitude>171.721055</longitude><name>SH1 Tinwald </name><offline>false</offline><underMaintenance>false</underMaintenance></camera></response>');
  assert.deepEqual(nz[0].slice(0, 4), [-43.9196, 171.7211, 'SH1 Tinwald', 'https://trafficnz.info/camera/714.jpg']);
});

test('Windy is optional: listed as needing a key, parsed when present', () => {
  const saved = process.env.FIDELITY_WINDY_KEY;
  delete process.env.FIDELITY_WINDY_KEY;
  const w = signalLayers().layers.find((l) => l.id === 'windy');
  assert.equal(w.available, false);
  assert.equal(w.needsKey, 'FIDELITY_WINDY_KEY');
  assert.ok(!JSON.stringify(signalLayers()).includes('x-windy-api-key'));
  if (saved) process.env.FIDELITY_WINDY_KEY = saved;
  const rows = parseWindy({ webcams: [{ title: 'Zermatt', location: { latitude: 46.02, longitude: 7.75, city: 'Zermatt', country: 'Switzerland' }, urls: { detail: 'https://windy.com/webcams/1' } }] });
  assert.equal(rows[0][3], 'https://windy.com/webcams/1');
});

test('DSN helpers: body filters by code, last seen, dish size, ages and light time', () => {
  const contacts = [{ code: 'TGO', spacecraftId: -143, station: 'Goldstone', dish: 'DSS25', down: { band: 'X' } }, { code: 'VGR1', spacecraftId: -31, station: 'Madrid', dish: 'DSS63' }, { code: 'KPLO', spacecraftId: -155, station: 'Madrid', dish: 'DSS53' }];
  assert.deepEqual(contactsFor('mars', contacts).map((c) => c.code), ['TGO']);
  assert.deepEqual(contactsFor('moon', contacts).map((c) => c.code), ['KPLO']);
  const seen = updateLastSeen({}, contacts, '2026-10-10T15:00:00Z');
  assert.equal(seen[-143].band, 'X');
  assert.equal(lastSeenFor('mars', seen)[0].name, 'ExoMars TGO');
  assert.equal(dishSize('DSS63'), 70);
  assert.equal(dishSize('DSS25'), 34);
  const now = Date.parse('2026-10-10T15:00:00Z');
  assert.equal(ago('2026-10-10T14:59:48Z', now), '12 S AGO');
  assert.equal(ago('2026-10-10T14:56:00Z', now), '4 MIN AGO');
  assert.equal(ago('2026-10-04T15:00:00Z', now), '6 DAYS AGO');
  assert.ok(Math.abs(lightSeconds(1) - 499.005) < 0.01); // 1 AU ≈ 8 min 19 s
  assert.equal(formatLight(lightSeconds(1)), '8 MIN 19 S');
});

test('Radio Garden export: places with streams, NaN names tolerated (#69)', async () => {
  const { parseRadioGarden } = await import('../server/signals.js');
  const text = '{"Aachen,DE": {"coords": {"n": 50.7753, "e": 6.0839}, "urls": [{"name": "Antenne Ac", "url": "https://a.example/live"}, {"name": NaN, "url": "http://b.example:8000/x"}, {"name": "Bad", "url": "ftp://nope"}]}, "Nowhere,XX": {"coords": {"n": 0, "e": 0}, "urls": [{"name": "Z", "url": "https://z"}]}}';
  const { places, urls } = parseRadioGarden(text);
  assert.equal(places.length, 1);
  assert.equal(places[0].name, 'Aachen');
  assert.equal(places[0].country, 'DE');
  assert.deepEqual(places[0].streams.map((s) => s.name), ['Antenne Ac', 'Unnamed station']);
  assert.ok(urls.has('http://b.example:8000/x') && !urls.has('ftp://nope'));
});
