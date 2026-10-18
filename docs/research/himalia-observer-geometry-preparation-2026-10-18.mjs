import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { skyGeometry } from '../../src/astro/appearance.js';
const radiusKm=69911,orbitKm=11439000,heightKm=85;
const guide=skyGeometry({radiusSun:radiusKm/695700,temperatureK:165,distanceAU:(orbitKm-heightKm)/149597870.7,horizontalFovDeg:90});
const sources=['data/research-sources/himalia-jpl-physical-2026-10-18.html','data/research-sources/himalia-jpl-elements-2026-10-18.html'].map(path=>{const b=fs.readFileSync(path);return {path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
console.log(JSON.stringify({sources,helper:'skyGeometry',primaryRadiusKm:radiusKm,nominalOrbitScaleKm:orbitKm,cameraHeightKm:heightKm,referenceWidth:1672,horizontalFovDeg:90,angularDiameterDeg:guide.angularDiameterDeg,centreDiscWidthPixels:guide.centreDiscWidthFraction*1672,limits:'Hypothetical radial near-side camera at nominal mean semimajor scale; not current eccentric distance, normal, dated site, pole, permanent Jupiterface or uncertainty envelope.165K angular helper only, colour/irradiance discarded. Phase/attitude/oblateness/exposure/spectral transfer and registration unverified.'},null,2));
