import fs from 'node:fs';import{skyGeometry}from'../../src/astro/appearance.js';
const width=1706,primaryRadiusKm=69911,primaryCentreDistanceKm=11710700-39.95,horizontalFovDeg=90;
const g=skyGeometry({radiusSun:primaryRadiusKm/695700,temperatureK:165,distanceAU:primaryCentreDistanceKm/149597870.7,horizontalFovDeg});
console.log(JSON.stringify({helper:'skyGeometry',referenceWidth:width,horizontalFovDeg,primaryRadiusKm,primaryCentreDistanceKm,angularDiameterDeg:g.angularDiameterDeg,centreDiscWidthPixels:g.centreDiscWidthFraction*width,limits:'Angular guide only for actual original width1706; not a measured generateddisk fit or calibrated photometry/colour.165K helpercolour/irradiance discarded; phase/attitude/currenteccentricdistance/normal unknown.'},null,2));
