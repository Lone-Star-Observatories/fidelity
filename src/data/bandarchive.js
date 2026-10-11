// Archive band maps and disc images for the spectrum filter (#28), merged into BODY_BAND
// (src/data/bands.js). Each entry is one real image of a body, MEASURED:
//
//   archive: a global equirectangular map the backend builds from an archive product
//     (server/bandarchive.js, GET /api/band-archive?id=…, allowlisted from these entries):
//       kind 'trek'  NASA Solar System Treks WMTS PNG tiles (layer; zoom 0 = 512×256 is the
//                    preview, the full map is at `zoom`, the layer's deepest useful level), mosaicked into one PNG;
//       kind 'img8'  a PDS 8-bit raw raster (simple cylindrical, 0 = no data);
//       kind 'bins'  a PDS ASCII table of binned values (latitude/longitude boxes or a regular
//                    grid of cell centres) drawn as a grey map, bright = more, no data transparent.
//   disc: a whole-disc image (no global map exists), projected onto the Earth-facing hemisphere
//     (the far side shows the predicted skin), like the Sun's SDO disc. GET /api/band-disc?id=…
//     The image's geometry was measured on the image itself (scratch fits, see docs/data-sources.md):
//       w, h      the image size in pixels (any rendition of the same image scales with it);
//       cx, cy    the disc centre (pixels from the top left);
//       re, rp    the equatorial and polar radii in pixels;
//       pa        the position angle of the body's north pole in the image, degrees counter-
//                 clockwise from image-up (0: north up; −90: north to the right).
//     date: when the image was taken; the disc is drawn as if seen from Earth's direction now.
//   range: [nmLo, nmHi], the wavelength (or energy) span the image represents; note: what the
//   colours mean; partial: the map has gaps; unlit: not sunlight (gamma rays from cosmic-ray
//   interactions and radioactivity glow on the night side too); lit: reflected sunlight although
//   beyond 2.6 µm (Titan's 5 µm window).

const KEV_NM = 1.23984198;
const keV = (lo, hi) => [KEV_NM / hi, KEV_NM / lo];
const PDS_GEO = 'https://pds-geosciences.wustl.edu';
const LPGRS = `${PDS_GEO}/lunar/lp-l-grs-5-elem-abundance-v1/lp_9001/data/lpgrs_high1_elem_abundance_2deg.tab`;
const ODYGRS = (el) => `${PDS_GEO}/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/${el}_sr_5x5.tab`;
const XRS = (r) => `${PDS_GEO}/messenger/mess-h-xrs-3-rdr-maps-v1/messxrs_3001/data/maps/xrs_map_${r}_20150424.img`;

// gamma-ray line windows (keV) for the GAMMA band's nuclear-line passes (bands.js)
export const GAMMA_LINES = { k: [1400, 1520], h: [2150, 2300], th: [2540, 2690], fe: [7450, 7800] };

// ---- Moon -------------------------------------------------------------------------------------
const DIVINER_NOON = {
  archive: { id: 'moon-diviner-noon', kind: 'trek', layer: 'Moon/EQ/diviner_tbol_hour12', zoom: 0 },
  credit: 'NASA/GSFC/UCLA LRO Diviner Lunar Radiometer: bolometric brightness temperature at local noon, from its seven thermal channels (7.55–400 µm), Global Cumulative Product 2009–2015 in 0.5° bins (Williams et al. 2017, Icarus 283, 300), via NASA Moon Trek; NASA data, public domain',
  note: 'Diviner noon temperature (7.5–400 µm): bright = hot; the night side is far colder now (shown by the model)',
  range: [7550, 400000],
};
const LP = (col, what, line, lineKeV) => ({
  archive: { id: `moon-lpgrs-${what.toLowerCase()}`, kind: 'bins', url: LPGRS, cols: [1, 2, 3, 4, col] },
  credit: `NASA Lunar Prospector Gamma-Ray Spectrometer: ${what} abundance (2° equal-area bins, Prettyman et al. 2006, JGR 111, E12007; PDS LP-L-GRS-5-ELEM-ABUNDANCE-V1.0); NASA data, public domain`,
  note: `${what} abundance from the ${line} γ-ray line (a derived map of a measured spectrum): bright = more ${what === 'FeO' ? what : what.toLowerCase()}`,
  range: keV(...lineKeV), unlit: true,
});

// ---- Mars -------------------------------------------------------------------------------------
const ODY = (el, what, line, lineKeV) => ({
  archive: { id: `mars-grs-${el}`, kind: 'bins', url: ODYGRS(el), cols: [0, 1, 2], cell: 5 },
  credit: `NASA/University of Arizona Mars Odyssey Gamma Ray Spectrometer: ${what} (Boynton et al. 2007, JGR 112, E12S99; 5° grid smoothed with a 10° boxcar, PDS ODY-M-GRS-5-ELEMENTS-V1.0); NASA data, public domain`,
  note: `${what} from the ${line} γ-ray line (a derived map of a measured spectrum): bright = more; no data near the poles (seasonal CO₂ frost)`,
  range: keV(...lineKeV), partial: true, unlit: true,
});

// ---- Mercury ----------------------------------------------------------------------------------
const XRS_MGSI = {
  archive: { id: 'mercury-xrs-mg-si', kind: 'img8', url: XRS('mg_si'), width: 1440, height: 720 },
  credit: 'NASA/JHUAPL/CIW MESSENGER X-Ray Spectrometer: Mg/Si abundance ratio from solar-induced X-ray fluorescence, 2011–2015, 4 px/°, 0 to 0.78 (Nittler et al. 2020, Icarus 345, 113716; PDS MESS-H-XRS-3-RDR-MAPS-V1.0); NASA data, public domain',
  note: 'MESSENGER XRS Mg/Si from Mg Kα and Si Kα fluorescence (1.25–1.74 keV): bright = magnesium-rich; mostly the northern hemisphere',
  range: keV(1.2, 1.8), partial: true,
};

// ---- Titan ------------------------------------------------------------------------------------
const VIMS = (um, nm, layer) => ({
  archive: { id: `titan-vims-${um}um`, kind: 'trek', layer: `Titan/EQ/${layer}`, zoom: 2 },
  credit: `NASA/JPL/University of Arizona/LPG Nantes Cassini VIMS global mosaic at ${um} µm through a methane window, 2004–2017, 32 px/° (Le Mouélic et al. 2019, Icarus 319, 121), via NASA Titan Trek; NASA data, public domain`,
  note: `Cassini VIMS ${um} µm methane window: Titan's surface through the haze (seams and clouds remain)`,
  range: nm,
});

// ---- disc images ------------------------------------------------------------------------------
const WEBB = (id) => ({ url: `https://cdn.esawebb.org/archives/images/large/${id}.jpg`, preview: `https://cdn.esawebb.org/archives/images/thumb300y/${id}.jpg` });
const HUBBLE = (id) => ({ url: `https://cdn.esahubble.org/archives/images/large/${id}.jpg`, preview: `https://cdn.esahubble.org/archives/images/thumb300y/${id}.jpg` });
const discLabel = (d) => `DISC IMAGE · ${d} · EARTH-FACING SIDE ONLY`;
export { discLabel };

const JWST_JUPITER = {
  disc: { id: 'webb-jupiter-2022', ...WEBB('jupiter-auroras1'), w: 1646, h: 1561, cx: 816, cy: 787, re: 718, rp: 671, pa: 0 },
  date: '2022-07-27',
  credit: 'NASA, ESA, Jupiter ERS Team; image processing by Judy Schmidt — JWST NIRCam F150W2 (blue), F212N (green), F360M (red: aurorae at both poles) (ESA/Webb jupiter-auroras1, CC BY 4.0)',
  note: 'Webb NIRCam 1.5–3.6 µm composite: aurorae (red) above both poles, polar hazes (green), the Great Red Spot white',
  range: [1000, 3830],
};
const HST_JUPITER_UV = {
  disc: { id: 'hubble-jupiter-aurora-2016', ...HUBBLE('heic1613a'), w: 1000, h: 1000, cx: 515, cy: 501, re: 434, rp: 406, pa: 0 },
  date: '2016',
  credit: 'NASA, ESA — Hubble STIS far-UV auroral ovals (F25SRF2, ~125–170 nm), from a month of daily observations in 2016, over a WFC3 visible-light disc (395, 502, 631 nm) (ESA/Hubble heic1613a, CC BY 4.0)',
  note: 'Hubble far-UV aurora (blue, STIS ~125–170 nm) over a visible-light disc: only the aurora is ultraviolet',
  range: [125, 170],
};
const JWST_SATURN = {
  disc: { id: 'webb-saturn-2023', ...WEBB('saturn1'), w: 2586, h: 1454, cx: 1445, cy: 770, re: 283, rp: 255, pa: 6.5 },
  date: '2023-06-25',
  credit: 'NASA, ESA, CSA, STScI, M. Tiscareno (SETI Institute), M. Hedman (University of Idaho), M. El Moutamid (Cornell University), M. Showalter (SETI Institute), L. Fletcher (University of Leicester), H. Hammel (AURA), J. DePasquale (STScI) — JWST NIRCam F323N 3.23 µm (ESA/Webb saturn1, CC BY 4.0)',
  note: 'Webb 3.23 µm: methane absorbs nearly all sunlight, so Saturn is dark and patchy high hazes show; the rings in front of the disc are drawn on it',
  range: [3200, 3260],
};
const JWST_NEPTUNE = {
  disc: { id: 'webb-neptune-2022', ...WEBB('weic2214c'), w: 1680, h: 1120, cx: 846, cy: 543, re: 152, rp: 150, pa: 0 },
  date: '2022-07-12',
  credit: 'NASA, ESA, CSA, STScI — JWST NIRCam F140M, F210M, F300M, F460M composite (ESA/Webb weic2214c, CC BY 4.0)',
  note: 'Webb NIRCam 1.4–4.6 µm composite: methane-ice clouds bright in the south, the disc otherwise dark in methane bands',
  range: [1330, 4750],
};
const JWST_URANUS = {
  disc: { id: 'webb-uranus-2023', ...WEBB('weic2310a'), w: 1268, h: 1268, cx: 654.5, cy: 641, re: 239, rp: 237, pa: -94 },
  date: '2023-02-06',
  credit: 'NASA, ESA, CSA, STScI, J. DePasquale (STScI) — JWST NIRCam F140M (blue) and F300M (orange) (ESA/Webb weic2310a, CC BY 4.0)',
  note: 'Webb NIRCam 1.4 and 3.0 µm: the bright north polar cap (right) and storms at its edge',
  range: [1330, 3160],
};

// #72: more whole-disc images, each measured on the image (docs/data-sources.md, "Band disc images").
// Chandra publishes the X-ray-only frame beside the X-ray + Hubble composite at the same size; the
// limb is only visible in the composite, so the geometry was fitted there (the two register at zero
// shift) and the North angle from the belts (7°, as Jupiter's pole stood on the sky in Feb 2007).
// Its thumbnail is a crop, so the 62 kB full image is also the preview (no `preview`).
const NOIRLAB = (id) => ({ url: `https://storage.noirlab.edu/media/archives/images/large/${id}.jpg`, preview: `https://storage.noirlab.edu/media/archives/images/thumb300y/${id}.jpg` });
const CXC_JUPITER = {
  disc: { id: 'chandra-jupiter-2007', url: 'https://chandra.harvard.edu/photo/2007/jupiter/jupiter_xray.jpg', w: 576, h: 572, cx: 290.4, cy: 272.7, re: 175, rp: 164, pa: 7 },
  date: '2007-02',
  credit: 'NASA/CXC/SwRI/R. Gladstone et al. — Chandra ACIS X-ray image, 8, 10 and 24 Feb 2007 (15 h), the X-ray-only frame of chandra.harvard.edu/photo/2007/jupiter; Chandra materials carry no copyright claim (NASA guidelines), public domain',
  note: 'Chandra soft X-rays (~0.3–2 keV) alone: auroral hot spots at both poles, the rest of the disc only a few scattered counts (reflected solar X-rays)',
  range: keV(0.3, 2),
};
const GEMINI_JUPITER_M = {
  disc: { id: 'gemini-jupiter-m-2017', ...NOIRLAB('noirlab2116a'), w: 1400, h: 1304, cx: 697, cy: 652, re: 646, rp: 611, pa: 0 },
  date: '2017-01-11',
  credit: 'International Gemini Observatory/NOIRLab/NSF/AURA, M.H. Wong (UC Berkeley) et al.; acknowledgment M. Zamani — Gemini North NIRI M′ 4.68 µm mosaic, lucky imaging (NOIRLab noirlab2116a, CC BY 4.0)',
  note: 'Gemini M′ 4.68 µm: heat from below the clouds; bright where the clouds are thin (the hot spots north of the equator), the Great Red Spot dark',
  range: [4550, 4790],
};
const GEMINI_IO_L = {
  disc: { id: 'gemini-io-l-2013', ...NOIRLAB('gemini1405a'), w: 434, h: 479, cx: 193.5, cy: 268.3, re: 120, rp: 120, pa: 0 },
  date: '2013-08-29',
  credit: 'Katherine de Kleer/UC Berkeley/Gemini Observatory/AURA — Gemini North NIRI + Altair adaptive optics, L′ 3.78 µm (the filter per UC Berkeley\'s release of the same frame; de Kleer et al. 2014, Icarus 242, 352) (NOIRLab gemini1405a, CC BY 4.0)',
  note: 'Gemini L′ 3.78 µm: volcanic heat — the 29 Aug 2013 outburst 201308C (upper right), Loki (centre), the fading Rarog/Heno outbursts (bottom); the disc glows faintly in reflected sunlight',
  range: [3420, 4120],
};

export const ARCHIVE_BAND = {
  moon: {
    'ir-F770W': { ...DIVINER_NOON, note: `${DIVINER_NOON.note} · F770W is inside Diviner's channel 3` },
    'ir-10': DIVINER_NOON, 'ir-12': DIVINER_NOON, 'ir-F2100W': DIVINER_NOON, 'ir-W4': DIVINER_NOON, 'ir-90': DIVINER_NOON, 'ir-140': DIVINER_NOON,
    'g-k': LP(13, 'Potassium', '1.46 MeV ⁴⁰K', GAMMA_LINES.k),
    'g-th': LP(14, 'Thorium', '2.61 MeV ²⁰⁸Tl (Th decay chain)', GAMMA_LINES.th),
    'g-fe': LP(12, 'FeO', '7.63 MeV Fe neutron-capture', GAMMA_LINES.fe),
  },
  mars: {
    'g-h': ODY('h2o', 'water-equivalent hydrogen', '2.22 MeV H neutron-capture', GAMMA_LINES.h),
    'g-k': ODY('k', 'potassium', '1.46 MeV ⁴⁰K', GAMMA_LINES.k),
    'g-th': ODY('th', 'thorium', '2.61 MeV ²⁰⁸Tl (Th decay chain)', GAMMA_LINES.th),
    'g-fe': ODY('fe', 'iron', '7.63 MeV Fe neutron-capture', GAMMA_LINES.fe),
  },
  mercury: { 'x-soft': XRS_MGSI },
  titan: {
    'ir-F200W': VIMS(2, [1990, 2110], 'Titan_global_32ppd_2microns_v2'),
    'ir-Ks': { ...VIMS(2, [1990, 2110], 'Titan_global_32ppd_2microns_v2'), note: 'Cassini VIMS 2 µm methane window, inside Ks: Titan\'s surface through the haze' },
    'ir-5': { ...VIMS(5, [4900, 5150], 'Titan_global_32ppd_5microns_v2'), lit: true }, // Titan's 5 µm light is reflected sunlight (at ~94 K it barely glows there)
  },
  jupiter: {
    'ir-H': JWST_JUPITER, 'ir-Ks': JWST_JUPITER, 'ir-F200W': JWST_JUPITER, 'ir-W1': JWST_JUPITER,
    'uv-fuv': HST_JUPITER_UV,
    'x-soft': CXC_JUPITER,
    'ir-F444W': GEMINI_JUPITER_M,
    'ir-5': { ...GEMINI_JUPITER_M, note: `${GEMINI_JUPITER_M.note} · M′ is the short side of the same 5 µm window, just below this 4.9–5.2 µm pass` },
  },
  io: { 'ir-W1': { ...GEMINI_IO_L, note: `${GEMINI_IO_L.note} · L′ lies on the red edge of W1` } },
  saturn: { 'ir-W1': { ...JWST_SATURN, note: `${JWST_SATURN.note} · 3.23 µm, inside WISE W1` } },
  neptune: { 'ir-H': JWST_NEPTUNE, 'ir-Ks': JWST_NEPTUNE, 'ir-F200W': JWST_NEPTUNE, 'ir-W1': JWST_NEPTUNE, 'ir-F444W': JWST_NEPTUNE },
  uranus: { 'ir-J': { ...JWST_URANUS, note: `${JWST_URANUS.note} · F140M on the red edge of J` }, 'ir-W1': JWST_URANUS },
};

/**
 * Where a point of the body (unit normal N) falls in a disc image (uv, origin bottom left), seen
 * from direction E (unit, body → Earth) with the body's north pole P: the projection the planet
 * shader does (materials.js bandSample). Also returns `facing` = N·E (≤ 0: the far side).
 */
export function discUv(d, N, E, P) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const up = norm(P.map((p, i) => p - E[i] * dot(P, E)));
  const f = E.map((x) => -x), right = norm([f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]);
  const px = dot(N, right) * d.re, py = dot(N, up) * d.rp, a = ((d.pa ?? 0) * Math.PI) / 180;
  return { u: d.cx / d.w + (px * Math.cos(a) - py * Math.sin(a)) / d.w, v: 1 - d.cy / d.h + (px * Math.sin(a) + py * Math.cos(a)) / d.h, facing: dot(N, E) };
}
