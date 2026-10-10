import test from 'node:test';
import assert from 'node:assert/strict';
import { skyGeometry } from '../src/astro/appearance.js';
test('observer star diameter and flux obey physical scaling',()=>{
 const earth=skyGeometry({radiusSun:1,temperatureK:5772,distanceAU:1});
 assert.ok(Math.abs(earth.angularDiameterDeg-0.5329)<0.001);assert.equal(earth.irradianceEarth,1);
 const ceres=skyGeometry({radiusSun:1,temperatureK:5772,distanceAU:2.77});
 assert.ok(Math.abs(ceres.angularDiameterDeg-0.1924)<0.001);
 const barnard=skyGeometry({radiusSun:0.185,temperatureK:3195,distanceAU:0.0229});
 assert.ok(Math.abs(barnard.angularDiameterDeg-4.3057)<0.01);
 assert.ok(barnard.centreDiscWidthFraction>0.06&&barnard.centreDiscWidthFraction<0.07);
 assert.ok(barnard.irradianceEarth>6&&barnard.irradianceEarth<7);
 assert.throws(()=>skyGeometry({radiusSun:1,temperatureK:5772,distanceAU:0.001}),RangeError);
 assert.throws(()=>skyGeometry({radiusSun:1,temperatureK:5772,distanceAU:1,horizontalFovDeg:180}),RangeError);
});

test('solar angular diameter agrees with recorded JPL Horizons observer values',async()=>{
 const fs=await import('node:fs/promises');
 const reference=JSON.parse(await fs.readFile(new URL('fixtures/ceres-sun-diameter.json',import.meta.url),'utf8'));
 for(const row of reference.rows){
  const actual=skyGeometry({radiusSun:1,temperatureK:5772,distanceAU:row.rangeAU}).angularDiameterDeg*3600;
  assert.ok(Math.abs(actual-row.angularDiameterArcsec)/row.angularDiameterArcsec<0.001);
 }
});
