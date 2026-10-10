import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUcs } from '../server/ucs.js';

// Two rows in the UCS text layout (tab-separated, quoted thousands, trailing source columns).
const H = ['"Name of Satellite, Alternate Names"', 'Current Official Name of Satellite', 'Country/Org of UN Registry', 'Country of Operator/Owner', 'Operator/Owner',
  'Users', 'Purpose', 'Detailed Purpose', 'Class of Orbit', 'Type of Orbit', 'Longitude of GEO (degrees)', 'Perigee (km)', 'Apogee (km)', 'Eccentricity',
  'Inclination (degrees)', 'Period (minutes)', 'Launch Mass (kg.)', ' Dry Mass (kg.) ', 'Power (watts)', 'Date of Launch', 'Expected Lifetime (yrs.)',
  'Contractor', 'Country of Contractor', 'Launch Site', 'Launch Vehicle', 'COSPAR Number', 'NORAD Number', 'Comments', '', 'Source Used for Orbital Data', 'Source', 'Source'];
const row = (o) => H.map((h) => o[h] ?? '').join('\t');
const text = [H.join('\t'),
  row({ [H[0]]: 'Landsat 9', [H[1]]: 'Landsat 9', [H[4]]: 'NASA/USGS', [H[5]]: 'Government', [H[6]]: 'Earth Observation', [H[16]]: '"2,710"', [H[17]]: '" 2,390 "',
    [H[19]]: '9/27/21', [H[20]]: '5', [H[26]]: '49260', [H[30]]: 'https://landsat.gsfc.nasa.gov/satellites/landsat-9/' }),
  row({ [H[0]]: 'Old Bird', [H[3]]: 'NR', [H[10]]: '-75.2', [H[19]]: '3/1/98', [H[26]]: '25000' }),
].join('\r\n');

test('UCS rows parse to records keyed by NORAD id', () => {
  const db = parseUcs(text);
  const l9 = db[49260];
  assert.equal(l9.name, 'Landsat 9');
  assert.equal(l9.launchMassKg, 2710);
  assert.equal(l9.dryMassKg, 2390);
  assert.equal(l9.launched, '2021-09-27');
  assert.equal(l9.lifetimeYears, 5);
  assert.deepEqual(l9.links, ['https://landsat.gsfc.nasa.gov/satellites/landsat-9/']);
  const old = db[25000];
  assert.equal(old.country, null, 'NR means not reported');
  assert.equal(old.geoLonDeg, -75.2);
  assert.equal(old.launched, '1998-03-01', 'two-digit years before 51 are 19xx');
  assert.equal(old.launchMassKg, null);
});
