import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDsn } from '../server/dsn.js';
import { SPACECRAFT } from '../src/data/spacecraft.js';

const XML = `<dsn>
  <station name="gdscc" friendlyName="Goldstone" timeUTC="1791607149000" timeZoneOffset="-25200000.0"/>
  <dish name="DSS14" azimuthAngle="0" elevationAngle="90" activity="Engineering Upgrades">
    <target name="DSN" id="99" uplegRange="-1" downlegRange="-1" rtlt="-1"/>
  </dish>
  <dish name="DSS24" azimuthAngle="223" elevationAngle="21" activity="Spacecraft Telemetry, Tracking, and Command">
    <upSignal active="true" signalType="data" dataRate="0" band="X" power="18" spacecraft="NHPC" spacecraftID="-98"/>
    <downSignal active="true" signalType="data" dataRate="49.99" band="X" power="-160" spacecraft="NHPC" spacecraftID="-98"/>
    <target name="NHPC" id="98" uplegRange="9840000000" downlegRange="9840000000" rtlt="-1"/>
  </dish>
  <station name="cdscc" friendlyName="Canberra" timeUTC="1791607149000" timeZoneOffset="36000000.0"/>
  <dish name="DSS43" azimuthAngle="160" elevationAngle="40" activity="Spacecraft Telemetry, Tracking, and Command">
    <downSignal active="true" signalType="data" dataRate="160" band="X" power="-150" spacecraft="VGR1" spacecraftID="-31"/>
    <target name="VGR1" id="31" uplegRange="25700000000" downlegRange="25700000000" rtlt="171900"/>
  </dish>
</dsn>`;

test('DSN Now: contacts carry station, dish, rates and the NAIF id', () => {
  const c = parseDsn(XML);
  assert.equal(c.length, 2); // the maintenance dish has no spacecraft
  const nh = c.find((x) => x.code === 'NHPC');
  assert.equal(nh.station, 'Goldstone'); assert.equal(nh.dish, 'DSS24'); assert.equal(nh.spacecraftId, -98);
  assert.equal(nh.down.rate, 49.99); assert.equal(nh.rangeKm, 9.84e9);
  const v1 = c.find((x) => x.code === 'VGR1');
  assert.equal(v1.station, 'Canberra'); assert.equal(v1.rtltSec, 171900);
  // the same ids as our fleet's Horizons ids
  assert.ok(SPACECRAFT.find((s) => s.horizons === String(v1.spacecraftId)).name.startsWith('Voyager 1'));
});
