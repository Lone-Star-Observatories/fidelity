// The Magellanic Clouds across the spectrum (#28): which real image the Galaxy View draws for each
// band. All MEASURED, all through the backend's whitelisted survey cutouts (CDS hips2fits,
// `/api/survey/:key`) or the downloaded Spitzer mosaics (`/api/texture/lmc|smc`).
//   range: the image's own wavelength span (nm); serves: the span of bandpasses it stands in for
//   (outside its range the panel says it is the nearest mapped band). The choice is made from the
//   band's effective wavelength, so it works for a custom transmission curve too (#66).
//   uv: GALEX skipped the LMC's bright bar, so the Swift UVOT Magellanic Clouds Survey fills it.

import { effectiveNm } from '../astro/bands.js';

const K = 1.23984198; // nm·keV
const ghz = (g) => 299792458 / g;
// Fields: 1.3 × each Cloud's angular diameter (the image quad is 1.3 × its true diameter).
export const CLOUDS = {
  lmc: { ra: 80.894, dec: -69.756, fov: 14.5 },
  smc: { ra: 13.187, dec: -72.829, fov: 7 },
};
export const CLOUD_IMAGES = [
  { id: 'fermi', survey: 'fermi', range: [K / 3e5, K / 1e3], serves: [0, 0.01], label: 'FERMI-LAT GAMMA RAYS',
    credit: 'NASA/DOE Fermi LAT all-sky (> 1 GeV), via CDS hips2fits. The LMC is a resolved gamma-ray source (Abdo et al. 2010); the SMC is faint (Abdo et al. 2010).' },
  { id: 'rass', survey: 'rass', range: [K / 2.4, K / 0.1], serves: [0.01, 15], label: 'ROSAT ALL-SKY SURVEY · X-RAYS',
    credit: 'ROSAT All-Sky Survey 0.1–2.4 keV (MPE), via CDS hips2fits. Supernova remnants, hot gas and X-ray binaries; the bright patch near the LMC is the survey\'s deep exposure at the south ecliptic pole.' },
  { id: 'uv', survey: 'galexnuv', under: 'uvotw1', range: [175, 280], serves: [91.2, 330], label: 'GALEX NUV + SWIFT UVOT',
    credit: 'NASA GALEX near-UV (175–280 nm), with the Swift UVOT UVW1 (260 nm) Magellanic Clouds Survey filling the bright bar that GALEX avoided (Siegel et al. 2015); HEASARC/CDS HiPS via hips2fits. Young, hot stars.' },
  { id: 'dss2', survey: 'dss2', range: [385, 900], serves: [330, 1000], label: 'DSS2 COLOUR · VISIBLE',
    credit: 'Digitized Sky Survey 2 (UK Schmidt plates, blue/red/near-IR; STScI/AAO/ROE), via CDS hips2fits.' },
  { id: '2mass', survey: 'twomass', range: [1100, 2400], serves: [1000, 3000], label: '2MASS · NEAR INFRARED',
    credit: '2MASS J/H/Ks (UMass / IPAC-Caltech, NASA/NSF), via CDS hips2fits. Old red giants.' },
  { id: 'spitzer', texture: true, range: [3200, 2.4e4], serves: [3000, 4e4], label: 'SPITZER · INFRARED',
    credit: { lmc: 'NASA/JPL-Caltech/M. Meixner (STScI) & the SAGE Legacy Team, PIA07136: Spitzer 3.6–24 µm mosaic (dust and young stars).',
      smc: 'NASA/JPL-Caltech/STScI, PIA12485: Spitzer infrared mosaic (dust and young stars).' } },
  { id: 'akari', survey: 'akari', range: [5e4, 1.8e5], serves: [4e4, 3e5], label: 'AKARI · FAR INFRARED',
    credit: 'JAXA AKARI FIS 65–160 µm all-sky, via CDS hips2fits. Cold dust.' },
  { id: 'planck', survey: 'planck', range: [ghz(857), ghz(100)], serves: [3e5, 3e7], label: 'PLANCK HFI · MICROWAVE',
    credit: 'ESA Planck HFI 100–857 GHz (R2), via CDS hips2fits. Cold dust; at longer wavelengths free-free and synchrotron take over.' },
  { id: 'hi4pi', survey: 'hi4pi', range: [ghz(1.4206), ghz(1.4204)], serves: [3e7, Infinity], label: 'HI4PI · 21 CM HYDROGEN',
    credit: 'HI4PI (EBHIS + GASS, Parkes) neutral-hydrogen column, via CDS hips2fits. The Clouds\' gas, and the Magellanic Bridge between them.' },
];

/** The image of a Cloud for a band: { …image, nm, nearest } (nearest: the band falls outside the image's own range); null for none. */
export function cloudImageFor(cb) {
  if (!cb || cb.full || !cb.pass?.filter) return { ...CLOUD_IMAGES.find((i) => i.id === 'dss2'), nm: null, nearest: false };
  const nm = effectiveNm(cb.pass.filter);
  if (nm > 15 && nm < 91.2) return null; // extreme UV: interstellar hydrogen absorbs it; never observed
  const img = CLOUD_IMAGES.find((i) => nm >= i.serves[0] && nm < i.serves[1]);
  return img ? { ...img, nm, nearest: nm < img.range[0] * 0.8 || nm > img.range[1] * 1.25 } : null;
}
export const cloudCredit = (img, id) => (typeof img.credit === 'string' ? img.credit : img.credit[id]);
/** Backend URL of a Cloud's cutout from survey `key`. */
export const cloudSurveyUrl = (key, id, size = 512) => { const c = CLOUDS[id]; return `/api/survey/${key}?ra=${c.ra}&dec=${c.dec}&fov=${c.fov}&size=${size}`; };
