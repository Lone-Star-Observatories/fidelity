// The sky seen from a surface (#48): the Milky Way image, and the geometry that places deep-sky
// images and outlines on the celestial sphere. Pure, shared by the view, the backend and the tests.

const DEG = Math.PI / 180;

/** The Milky Way band: ESA's Gaia DR3 colour flux map, rendered equirectangular in RA/Dec by CDS hips2fits. */
export const MILKY_WAY = {
  hips: 'ESAVO/P/GAIA/DR3-RGB',
  credit: 'ESA/Gaia/DPAC: Gaia DR3 colour flux map (integrated BP, G, RP fluxes of 1.8 billion sources), via CDS hips2fits',
  licence: 'CC BY-SA 3.0 IGO',
  doi: 'https://doi.org/10.5270/esa-qa4lep3',
};

/** Unit vector (equatorial J2000) for RA, Dec in degrees. */
export const raDecToUnit = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

/** Local north and east unit vectors (equatorial) on the sky at RA, Dec. */
export function skyBasis(ra, dec) {
  const a = ra * DEG, d = dec * DEG;
  return { north: [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)], east: [-Math.sin(a), Math.cos(a), 0] };
}

/**
 * The 'up' and 'right' directions of an image on the sky, as seen from inside the sphere (east to
 * the left of north). `northDeg` is the angle north makes with the image's vertical, positive to the
 * left (the ESA/ESO AVM convention), so the image's up is north turned towards the west by that angle.
 */
export function imageAxes(ra, dec, northDeg = 0) {
  const { north, east } = skyBasis(ra, dec), c = Math.cos(northDeg * DEG), s = Math.sin(northDeg * DEG);
  const up = north.map((v, i) => c * v - s * east[i]);
  const right = east.map((v, i) => -(c * v + s * north[i])); // west is to the right, as seen from inside
  return { up, right };
}

/** Ellipse axes on the sky for a position angle (north through east): unit major and minor directions. */
export function paAxes(ra, dec, paDeg) {
  const { north, east } = skyBasis(ra, dec), c = Math.cos(paDeg * DEG), s = Math.sin(paDeg * DEG);
  return { major: north.map((v, i) => c * v + s * east[i]), minor: north.map((v, i) => -s * v + c * east[i]) };
}

/** Angular diameter (arcmin) of an object of physical size `sizeKpc` at `distMpc`. */
export const angularSizeArcmin = (sizeKpc, distMpc) => (2 * Math.atan(sizeKpc / 2 / (distMpc * 1000)) / DEG) * 60;

/** Galactic (l, b) → equatorial (RA, Dec), degrees (IAU 1958 pole, J2000 constants). */
export function galToRaDec(l, b) {
  const lr = l * DEG, br = b * DEG, aNGP = 192.85948 * DEG, dNGP = 27.12825 * DEG, lNCP = 122.93192 * DEG;
  const sd = Math.sin(br) * Math.sin(dNGP) + Math.cos(br) * Math.cos(dNGP) * Math.cos(lNCP - lr);
  const y = Math.cos(br) * Math.sin(lNCP - lr), x = Math.sin(br) * Math.cos(dNGP) - Math.cos(br) * Math.sin(dNGP) * Math.cos(lNCP - lr);
  return [((Math.atan2(y, x) + aNGP) / DEG + 360) % 360, Math.asin(sd) / DEG];
}
