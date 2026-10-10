// The spectrum filter (#28): bands, their common bandpasses, and where real imagery exists.
//   Level 1: FULL · RADIO · MICROWAVE · INFRARED · VISIBLE · ULTRAVIOLET · X-RAY · GAMMA
//   Level 2: a bandpass within the band (the first is the default).
//   sky: an all-sky survey (CDS HiPS id, rendered through hips2fits) for the background.
//   BODY_BAND: real maps of bodies in a band (planetary HiPS, NASA GIBS, SDO via Helioviewer).
// Everything else is predicted from the body's spectrum (src/views/system/bandskin.js).

import { filter, ghz, kev, micron, topHat } from '../astro/bands.js';

const f = filter;
export const BANDS = [
  { id: 'full', label: 'FULL SPECTRUM', short: 'FULL', passes: [] },
  { id: 'radio', label: 'RADIO', short: 'RADIO', palette: 'radio', passes: [
    { id: 'radio-408', label: '408 MHz', filter: ghz(0.38, 0.44), sky: 'CDS/P/Haslam408', skyCredit: 'Haslam et al. 1982, 408 MHz all-sky survey (MPIfR / CDS HiPS)' },
    { id: 'radio-hi', label: 'HI 21 cm', filter: ghz(1.418, 1.422), sky: 'CDS/P/HI4PI/NHI', skyCredit: 'HI4PI Collaboration 2016, neutral-hydrogen column (CDS HiPS)' },
    { id: 'radio-nvss', label: '1.4 GHz (NVSS)', filter: ghz(1.36, 1.44), sky: 'CDS/P/NVSS', skyCredit: 'NRAO VLA Sky Survey, Condon et al. 1998 (dec > −40°; CDS HiPS)' },
    { id: 'radio-s', label: '2.4 GHz · 12.6 cm', filter: ghz(2.3, 2.45) },
  ] },
  { id: 'microwave', label: 'MICROWAVE', short: 'MICRO', palette: 'microwave', passes: [
    { id: 'mw-23', label: '23 GHz (WMAP K)', filter: ghz(20, 26), sky: 'CDS/P/WMAP/K/9yr', skyCredit: 'NASA WMAP 9-year K band (CDS HiPS)' },
    { id: 'mw-33', label: '33 GHz (WMAP Ka)', filter: ghz(28, 37), sky: 'CDS/P/WMAP/Ka/9yr', skyCredit: 'NASA WMAP 9-year Ka band (CDS HiPS)' },
    { id: 'mw-41', label: '41 GHz (WMAP Q)', filter: ghz(35, 46), sky: 'CDS/P/WMAP/Q/9yr', skyCredit: 'NASA WMAP 9-year Q band (CDS HiPS)' },
    { id: 'mw-61', label: '61 GHz (WMAP V)', filter: ghz(53, 69), sky: 'CDS/P/WMAP/V/9yr', skyCredit: 'NASA WMAP 9-year V band (CDS HiPS)' },
    { id: 'mw-94', label: '94 GHz (WMAP W)', filter: ghz(82, 106), sky: 'CDS/P/WMAP/W/9yr', skyCredit: 'NASA WMAP 9-year W band (CDS HiPS)' },
    { id: 'mw-ku', label: '13.8 GHz (Cassini radar)', filter: ghz(13.5, 14.1) },
  ] },
  { id: 'ir', label: 'INFRARED', short: 'IR', palette: 'infrared', passes: [
    { id: 'ir-J', label: '2MASS J 1.25 µm', filter: f('2mass-J'), sky: 'CDS/P/2MASS/color', skyCredit: '2MASS J/H/Ks colour (UMass / IPAC-Caltech; CDS HiPS)' },
    { id: 'ir-H', label: '2MASS H 1.65 µm', filter: f('2mass-H'), sky: 'CDS/P/2MASS/color', skyCredit: '2MASS J/H/Ks colour (CDS HiPS)' },
    { id: 'ir-Ks', label: '2MASS Ks 2.16 µm', filter: f('2mass-Ks'), sky: 'CDS/P/2MASS/color', skyCredit: '2MASS J/H/Ks colour (CDS HiPS)' },
    { id: 'ir-F200W', label: 'JWST F200W 2.0 µm', filter: f('nircam-F200W') },
    { id: 'ir-W1', label: 'WISE W1 3.4 µm', filter: f('wise-W1'), sky: 'CDS/P/allWISE/color', skyCredit: 'AllWISE W1/W2/W3 colour (NASA/JPL-Caltech/UCLA; CDS HiPS)' },
    { id: 'ir-F444W', label: 'JWST F444W 4.4 µm', filter: f('nircam-F444W') },
    { id: 'ir-5', label: '5 µm', filter: micron(4.9, 5.2) },
    { id: 'ir-F770W', label: 'JWST F770W 7.7 µm', filter: f('miri-F770W') },
    { id: 'ir-10', label: '10.3 µm (clean IR window)', filter: micron(10.0, 10.7) },
    { id: 'ir-12', label: 'WISE W3 12 µm', filter: f('wise-W3'), sky: 'CDS/P/allWISE/color', skyCredit: 'AllWISE colour (CDS HiPS)' },
    { id: 'ir-F2100W', label: 'JWST F2100W 21 µm', filter: f('miri-F2100W') },
    { id: 'ir-W4', label: 'WISE W4 22 µm', filter: f('wise-W4') },
    { id: 'ir-90', label: '90 µm (AKARI WIDE-S)', filter: micron(50, 110), sky: 'CDS/P/AKARI/FIS/WideS', skyCredit: 'AKARI FIS WIDE-S all-sky (JAXA; CDS HiPS)' },
    { id: 'ir-140', label: '140 µm (AKARI WIDE-L)', filter: micron(110, 180), sky: 'CDS/P/AKARI/FIS/WideL', skyCredit: 'AKARI FIS WIDE-L all-sky (JAXA; CDS HiPS)' },
  ] },
  { id: 'visible', label: 'VISIBLE', short: 'VIS', palette: 'visible', passes: [
    { id: 'vis-V', label: 'Johnson V', filter: f('johnson-V'), sky: 'CDS/P/Mellinger/color', skyCredit: 'Axel Mellinger, all-sky Milky Way panorama (CDS HiPS)' },
    { id: 'vis-U', label: 'Johnson U', filter: f('johnson-U') },
    { id: 'vis-B', label: 'Johnson B', filter: f('johnson-B') },
    { id: 'vis-R', label: 'Johnson R', filter: f('johnson-R') },
    { id: 'vis-I', label: 'Johnson I', filter: f('johnson-I') },
    { id: 'vis-g', label: 'SDSS g', filter: f('sdss-g') }, { id: 'vis-r', label: 'SDSS r', filter: f('sdss-r') }, { id: 'vis-i', label: 'SDSS i', filter: f('sdss-i') }, { id: 'vis-z', label: 'SDSS z', filter: f('sdss-z') },
    { id: 'vis-ha', label: 'Hα 656 nm', filter: topHat(653, 659) },
    { id: 'vis-oiii', label: '[O III] 501 nm', filter: topHat(499, 503) },
    { id: 'vis-sii', label: '[S II] 672 nm', filter: topHat(669, 675) },
  ] },
  { id: 'uv', label: 'ULTRAVIOLET', short: 'UV', palette: 'ultraviolet', passes: [
    // GALEX's all-sky HiPS is a patchwork at whole-sky resolution, so the UV sky is the catalogue stars, re-weighted
    { id: 'uv-nuv', label: 'GALEX NUV 231 nm', filter: f('galex-NUV') },
    { id: 'uv-fuv', label: 'GALEX FUV 153 nm', filter: f('galex-FUV') },
    { id: 'uv-w1', label: 'Swift UVW1', filter: f('uvot-UVW1') }, { id: 'uv-m2', label: 'Swift UVM2', filter: f('uvot-UVM2') }, { id: 'uv-w2', label: 'Swift UVW2', filter: f('uvot-UVW2') },
    { id: 'uv-f225', label: 'HST F225W', filter: f('wfc3-F225W') }, { id: 'uv-f275', label: 'HST F275W', filter: f('wfc3-F275W') },
    { id: 'uv-1600', label: 'SDO AIA 1600 Å', filter: topHat(155, 165) },
    { id: 'uv-1700', label: 'SDO AIA 1700 Å', filter: topHat(165, 175) },
    { id: 'uv-lya', label: 'Lyman-α 121.6 nm', filter: topHat(120.5, 122.5) },
  ] },
  { id: 'xray', label: 'X-RAY', short: 'X', palette: 'xray', passes: [
    { id: 'x-soft', label: 'Soft 0.1–2.4 keV (ROSAT)', filter: kev(0.1, 2.4), sky: 'CDS/P/RASS', skyCredit: 'ROSAT All-Sky Survey (MPE; CDS HiPS)' },
    { id: 'x-hard', label: 'Hard 14–195 keV (Swift BAT)', filter: kev(14, 195), sky: 'JAXA/P/SWIFT/BAT/Image', skyCredit: 'Swift BAT all-sky (NASA; JAXA DARTS HiPS)' },
    { id: 'x-94', label: 'EUV 94 Å (Sun, 6 MK)', filter: topHat(9.3, 9.5) },
    { id: 'x-131', label: 'EUV 131 Å', filter: topHat(13, 13.2) }, { id: 'x-171', label: 'EUV 171 Å', filter: topHat(17, 17.2) },
    { id: 'x-193', label: 'EUV 193 Å', filter: topHat(19.2, 19.4) }, { id: 'x-211', label: 'EUV 211 Å', filter: topHat(21, 21.2) },
    { id: 'x-304', label: 'EUV 304 Å', filter: topHat(30.3, 30.5) }, { id: 'x-335', label: 'EUV 335 Å', filter: topHat(33.4, 33.6) },
  ] },
  { id: 'gamma', label: 'GAMMA', short: 'γ', palette: 'gamma', passes: [
    { id: 'g-lat', label: 'Fermi-LAT > 100 MeV', filter: kev(1e5, 1e8), sky: 'CDS/P/Fermi/color', skyCredit: 'Fermi-LAT all-sky (NASA/DOE/Fermi LAT Collaboration; CDS HiPS)' },
  ] },
];
export const bandById = (id) => BANDS.find((b) => b.id === id) ?? BANDS[0];
export const passById = (band, id) => band.passes.find((p) => p.id === id) ?? band.passes[0] ?? null;

// Real maps of bodies, by bandpass id (or band id for any pass in the band).
//   hips: a planetary HiPS (equirectangular via hips2fits, longitude −180…180); gibs: NASA GIBS
//   WMS layers (yesterday); feed: a live feed id (server/feeds.js); credit, and a note when the map
//   is in a neighbouring bandpass rather than the selected one; partial: swaths with gaps;
//   range: [nmLo, nmHi], the nominal wavelength span the map itself represents (#61). A band-level
//   key applies to every pass in the band, so it is used only where the map fits them all; the
//   #61 audit (docs/research/band-audit.json) removed fallbacks that put, e.g., a 12.6 µm thermal
//   map on 2MASS J or a 12.6 cm radar image on the 408 MHz sky.
const THEMIS_DAY = { hips: 'CDS/P/Mars/THEMIS-Day-100m-v12', credit: 'NASA/ASU Mars Odyssey THEMIS daytime IR mosaic, band 9 (12.6 µm) (CDS HiPS)', range: [12160, 12980] };
const AIA = (a, extra) => ({ feed: `sdo-${a}`, credit: `NASA SDO AIA ${a} Å via Helioviewer`, range: a > 500 ? [a / 10 - 5, a / 10 + 5] : [a / 10 - 0.1, a / 10 + 0.1], ...extra });
const MDIS_750 = { hips: 'CDS/P/Mercury/MESSENGER-MDIS-LOI-166m', credit: 'NASA/JHUAPL/CIW MESSENGER MDIS low-incidence global mosaic, NAC and WAC 750 nm (CDS HiPS)', range: [700, 800] };
const CLEM_750 = { hips: 'CDS/P/Moon/Clementine-750nm-118m', credit: 'Clementine UVVIS 750 nm mosaic (NASA/USGS; CDS HiPS)', range: [745, 755] };
const WAC_643 = { hips: 'CDS/P/Moon/LROC-WAC-100m', credit: 'NASA/GSFC/ASU LRO Wide Angle Camera global morphologic map, 643 nm band (CDS HiPS)', range: [623, 663] };
const GOES_13 = 'GOES-West_ABI_Band13_Clean_Infrared,GOES-East_ABI_Band13_Clean_Infrared,Himawari_AHI_Band13_Clean_Infrared';
export const BODY_BAND = {
  sun: {
    'uv-1600': AIA(1600), 'uv-1700': AIA(1700),
    'x-94': AIA(94), 'x-131': AIA(131), 'x-171': AIA(171), 'x-193': AIA(193), 'x-211': AIA(211), 'x-304': AIA(304), 'x-335': AIA(335),
    'x-soft': AIA(94, { note: 'EUV 94 Å (6 MK corona): the hottest SDO channel, nearest to soft X-rays' }),
    'uv-fuv': AIA(1600, { note: 'AIA 1600 Å: the nearest solar UV channel' }),
    'uv-lya': AIA(1600, { note: 'AIA 1600 Å: the nearest SDO channel to Lyman-α, the Sun\'s brightest UV line' }),
  },
  earth: {
    'ir-10': { gibs: GOES_13, credit: 'NOAA GOES-16/18 ABI and JMA Himawari-9 AHI band 13 (10.3 µm), via NASA GIBS; Europe/Africa not covered (Meteosat not in GIBS)', partial: true, range: [10100, 10600] },
    'ir-12': { gibs: GOES_13, credit: 'GOES / Himawari 10.3 µm via NASA GIBS', note: '10.3 µm clean IR window, the nearest mapped band: cloud tops cold (bright), ground warm', partial: true, range: [10100, 10600] },
    uv: { gibs: 'OMPS_Aerosol_Index', credit: 'NASA OMPS UV aerosol index (from 340/380 nm radiances), via NASA GIBS', note: 'UV aerosol index: smoke and dust absorbing ultraviolet', partial: true, range: [340, 380] },
  },
  mars: {
    'ir-12': THEMIS_DAY,
    'ir-10': { ...THEMIS_DAY, note: 'THEMIS 12.6 µm, the nearest mapped band' },
    'ir-F770W': { ...THEMIS_DAY, note: 'THEMIS 12.6 µm daytime thermal mosaic, the nearest mapped band' },
    'ir-F2100W': { ...THEMIS_DAY, note: 'THEMIS 12.6 µm daytime thermal mosaic, the nearest mapped band' },
    'ir-W4': { ...THEMIS_DAY, note: 'THEMIS 12.6 µm daytime thermal mosaic, the nearest mapped band' },
  },
  venus: {
    // the 12.6 cm passive radiometer measured the surface's own emission (emissivity × ~735 K); the SAR images in the same band are radar echoes
    'radio-s': { hips: 'CDS/P/Venus/Magellan/Microwave-Emissivity-4641m', credit: 'NASA Magellan 12.6 cm (2.385 GHz) radiometer: surface emissivity, i.e. its thermal radio brightness (CDS HiPS)', note: 'Magellan 12.6 cm radiometry: Venus\'s own surface emission, through the clouds', range: [125e6, 127e6] },
  },
  titan: {
    'mw-ku': { hips: 'CDS/P/Titan/SAR-HiSAR-128ppd', credit: 'NASA/JPL Cassini RADAR SAR/HiSAR, 2.2 cm (CDS HiPS)', note: 'Cassini 2.2 cm radar echoes (active): what reflects, not what glows', partial: true, range: [21.6e6, 22.0e6] },
    'vis-I': { hips: 'CDS/P/Titan/ISS-P19658-4km', credit: 'NASA/JPL/SSI Cassini ISS 938 nm methane-window mosaic (CDS HiPS)', range: [928, 948] },
    'vis-z': { hips: 'CDS/P/Titan/ISS-P19658-4km', credit: 'Cassini ISS 938 nm (CDS HiPS)', note: '938 nm near-IR window through the haze', range: [928, 948] },
  },
  moon: {
    'vis-I': CLEM_750, 'vis-i': CLEM_750,
    'vis-R': { ...WAC_643, note: 'LRO WAC 643 nm, inside the R band' }, 'vis-r': { ...WAC_643, note: 'LRO WAC 643 nm, inside the r band' },
  },
  mercury: {
    'vis-I': { ...MDIS_750, note: 'MDIS 750 nm, on the blue edge of I' }, 'vis-i': MDIS_750, 'vis-R': { ...MDIS_750, note: 'MDIS 750 nm, on the red edge of R' },
  },
};
/** The real map of `body` in this pass (or band), if any. */
export const bodyBandSource = (body, band, pass) => BODY_BAND[body]?.[pass?.id] ?? BODY_BAND[body]?.[band.id] ?? null;
