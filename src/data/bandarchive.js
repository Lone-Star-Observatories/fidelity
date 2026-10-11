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
//   archive.scale (#72): the map's physical scale, grey 0 → min, 255 → max, linear (GET
//     /api/band-archive?id=…&meta=1): unit, what (the quantity), tier (MEASURED or COMPUTED: an
//     abundance derived from a measured spectrum), source; min/max where the product documents them
//     (a raster's PDS label, a Trek layer's raster), else the backend's stretch of the table
//     (1st–99th percentile of its bins) times factor (the table's units → unit).
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
  archive: {
    id: 'moon-diviner-noon', kind: 'trek', layer: 'Moon/EQ/diviner_tbol_hour12', zoom: 0,
    scale: { unit: 'K', what: '', min: 0, max: 400, tier: 'measured', source: 'Moon Trek layer diviner_tbol_hour12: its Float64 raster (Trek ImageServer) spans 0 to 400.08 K, and its tiles are grey linear over that span (checked 2026-10-11 against the raster: 0.0 K + 1.563 K per grey level, median residual 1.4 K)' },
  },
  credit: 'NASA/GSFC/UCLA LRO Diviner Lunar Radiometer: bolometric brightness temperature at local noon, from its seven thermal channels (7.55–400 µm), Global Cumulative Product 2009–2015 in 0.5° bins (Williams et al. 2017, Icarus 283, 300), via NASA Moon Trek; NASA data, public domain',
  note: 'Diviner noon temperature (7.5–400 µm): bright = hot; the night side is far colder now (shown by the model)',
  range: [7550, 400000],
};
// scale: the PDS label's units (W_K and W_TH in ppm, W_FEO a weight fraction in g/g, shown as wt%)
const LP = (col, what, line, lineKeV, scale) => ({
  archive: { id: `moon-lpgrs-${what.toLowerCase()}`, kind: 'bins', url: LPGRS, cols: [1, 2, 3, 4, col], scale: { tier: 'computed', source: 'Prettyman et al. 2006 abundances (PDS LP-L-GRS-5-ELEM-ABUNDANCE-V1.0, label units)', ...scale } },
  credit: `NASA Lunar Prospector Gamma-Ray Spectrometer: ${what} abundance (2° equal-area bins, Prettyman et al. 2006, JGR 111, E12007; PDS LP-L-GRS-5-ELEM-ABUNDANCE-V1.0); NASA data, public domain`,
  note: `${what} abundance from the ${line} γ-ray line (a derived map of a measured spectrum): bright = more ${what === 'FeO' ? what : what.toLowerCase()}`,
  range: keV(...lineKeV), unlit: true,
});

// ---- Mars -------------------------------------------------------------------------------------
// scale: the PDS label's CONCENTRATION unit (WEIGHT PERCENT for H2O, K and Fe; PARTS PER MILLION for Th)
const ODY = (el, what, line, lineKeV, scale) => ({
  archive: { id: `mars-grs-${el}`, kind: 'bins', url: ODYGRS(el), cols: [0, 1, 2], cell: 5, scale: { tier: 'computed', source: 'Boynton et al. 2007 concentrations (PDS ODY-M-GRS-5-ELEMENTS-V1.0, label units)', ...scale } },
  credit: `NASA/University of Arizona Mars Odyssey Gamma Ray Spectrometer: ${what} (Boynton et al. 2007, JGR 112, E12S99; 5° grid smoothed with a 10° boxcar, PDS ODY-M-GRS-5-ELEMENTS-V1.0); NASA data, public domain`,
  note: `${what} from the ${line} γ-ray line (a derived map of a measured spectrum): bright = more; no data near the poles (seasonal CO₂ frost)`,
  range: keV(...lineKeV), partial: true, unlit: true,
});

// ---- Mercury ----------------------------------------------------------------------------------
const XRS_MGSI = {
  archive: {
    id: 'mercury-xrs-mg-si', kind: 'img8', url: XRS('mg_si'), width: 1440, height: 720,
    // drawn grey = DN, so grey 255 is the label's maximum (DN 0 is no data, transparent)
    scale: { unit: 'Mg/Si', what: '', min: 0, max: 0.782055, tier: 'computed', source: 'PDS label XRS_MAP_MG_SI_20150424: value = DN × 0.0030668824 (SCALING_FACTOR), DERIVED_MAXIMUM 0.782055 at DN 255, MISSING_CONSTANT 0. The label calls the ratio unitless; Nittler et al. 2020 give the XRS ratios by weight' },
  },
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

export const ARCHIVE_BAND = {
  moon: {
    'ir-F770W': { ...DIVINER_NOON, note: `${DIVINER_NOON.note} · F770W is inside Diviner's channel 3` },
    'ir-10': DIVINER_NOON, 'ir-12': DIVINER_NOON, 'ir-F2100W': DIVINER_NOON, 'ir-W4': DIVINER_NOON, 'ir-90': DIVINER_NOON, 'ir-140': DIVINER_NOON,
    'g-k': LP(13, 'Potassium', '1.46 MeV ⁴⁰K', GAMMA_LINES.k, { unit: 'ppm', what: 'K' }),
    'g-th': LP(14, 'Thorium', '2.61 MeV ²⁰⁸Tl (Th decay chain)', GAMMA_LINES.th, { unit: 'ppm', what: 'Th' }),
    'g-fe': LP(12, 'FeO', '7.63 MeV Fe neutron-capture', GAMMA_LINES.fe, { unit: 'wt%', what: 'FeO', factor: 100 }),
  },
  mars: {
    'g-h': ODY('h2o', 'water-equivalent hydrogen', '2.22 MeV H neutron-capture', GAMMA_LINES.h, { unit: 'wt%', what: 'H₂O' }),
    'g-k': ODY('k', 'potassium', '1.46 MeV ⁴⁰K', GAMMA_LINES.k, { unit: 'wt%', what: 'K' }),
    'g-th': ODY('th', 'thorium', '2.61 MeV ²⁰⁸Tl (Th decay chain)', GAMMA_LINES.th, { unit: 'ppm', what: 'Th' }),
    'g-fe': ODY('fe', 'iron', '7.63 MeV Fe neutron-capture', GAMMA_LINES.fe, { unit: 'wt%', what: 'Fe' }),
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
  },
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

// ---- the physical scale on screen (#72) -------------------------------------------------------
const srgbEncode = (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
/** A scale value for a legend: integers from 100, else two significant figures. */
export const fmtScaleValue = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Number(v.toPrecision(2))));
/**
 * The values at the ends of the false-colour bar for an archive map with `scale` (grey 0 → min,
 * 255 → max, linear; from GET /api/band-archive?id=…&meta=1) drawn with the auto-levels `levels`
 * ([lo, gain] in linear light, bandtextures.js bandTexture): the bar's FAINT end is linear light lo, its
 * BRIGHT end lo + 1/gain; the texture is sRGB, so grey/255 = sRGB-encode(linear). Values past the ends
 * are clipped (clipLo/clipHi). Returns null without a usable scale.
 */
export function shownScale(scale, levels = [0, 1]) {
  if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max) || !(scale.max > scale.min)) return null;
  const [lo, gain] = levels, hi = lo + 1 / gain, c = (x) => Math.min(1, Math.max(0, x));
  const at = (lin) => scale.min + srgbEncode(c(lin)) * (scale.max - scale.min);
  const a = at(lo), b = at(hi), unit = `${scale.unit}${scale.what ? ` ${scale.what}` : ''}`;
  const clipLo = lo > 1e-4 || scale.stretch === 'p1-p99', clipHi = hi < 1 - 1e-4 || scale.stretch === 'p1-p99';
  return { lo: a, hi: b, unit, clipLo, clipHi, text: `${fmtScaleValue(a)} – ${fmtScaleValue(b)} ${unit}`,
    loText: `${clipLo ? '≤ ' : ''}${fmtScaleValue(a)} ${unit}`, hiText: `${clipHi ? '≥ ' : ''}${fmtScaleValue(b)} ${unit}` };
}
/** The tooltip of a shown scale: where the numbers come from and what the bar does with them. */
export function scaleDetail(scale, s) {
  const f = fmtScaleValue, u = s.unit;
  const grey = scale.stretch === 'p1-p99'
    ? `The map's grey runs linearly from ${f(scale.min)} (black) to ${f(scale.max)} ${u} (white): the 1st and 99th percentiles of the table's ${scale.bins} bins (all of them span ${f(scale.dataMin)}–${f(scale.dataMax)}); values beyond are clipped.`
    : `The map's grey runs linearly from ${f(scale.min)} (black) to ${f(scale.max)} ${u} (white).`;
  return `${scale.source}.\n${grey}\nOn screen the image is auto-levelled: the bar's ends are the values at its black and white points (clipped beyond), and its colours follow the image's light, not the value in equal steps.`;
}
