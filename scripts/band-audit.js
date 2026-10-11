#!/usr/bin/env node
// Spectrum filter audit (#61): every Sol body we draw × every band (and bandpass where the verdict
// differs), with what has been observed, what imagery exists, the emission mechanism, what the app
// shows and the fix. Writes docs/research/band-audit.json.
//
//   node scripts/band-audit.js [--before <dir>]
//
// The literature below was checked during the audit (Crossref / arXiv / publisher abstracts, CDS
// MocServer for HiPS); `verified: false` marks a reference or number we could not confirm, which
// the app then treats as an estimate. `--before` points at a copy of the pre-#61 src/ tree to record
// what the app showed before the fixes (the committed JSON carries that snapshot).
import fs from 'node:fs/promises';
import { BANDS } from '../src/data/bands.js';
import { bandLook, ringBandLook } from '../src/views/system/bandskin.js';
import { sunBandLook } from '../src/views/system/starband.js';
import { REFS } from '../src/data/band-physics.js';
import { SUN, PLANETS } from '../src/data/sol.js';
import { MOONS, SMALL_BODIES } from '../src/data/moons.js';

const beforeDir = process.argv.includes('--before') ? process.argv[process.argv.indexOf('--before') + 1] : null;
const before = beforeDir ? await import(`${beforeDir}/src/views/system/bandskin.js`) : null;
const prev = beforeDir ? null : JSON.parse(await fs.readFile(new URL('../docs/research/band-audit.json', import.meta.url), 'utf8').catch(() => 'null'));

// ---- sources ----------------------------------------------------------------------------------
const S = (cite, id, verified = true) => ({ cite, ...(id?.startsWith('http') ? { url: id } : id ? { doi: id } : {}), verified });
const SRC = {
  ...Object.fromEntries(Object.entries(REFS).map(([k, r]) => [k, { cite: r.cite, ...(r.doi ? { doi: r.doi } : { url: r.url }), verified: true }])),
  Schmitt91: S('Schmitt et al. 1991, Nature 349, 583 — ROSAT soft X-ray image of the Moon', '10.1038/349583a0'),
  Dennerl02V: S('Dennerl et al. 2002, A&A 386, 319 — Discovery of X-rays from Venus with Chandra', '10.1051/0004-6361:20020097'),
  Dennerl08V: S('Dennerl 2008, PSS 56, 1414 — X-rays from Venus observed with Chandra', '10.1016/j.pss.2008.03.008'),
  Dennerl02M: S('Dennerl 2002, A&A 394, 1119 — Discovery of X-rays from Mars with Chandra', '10.1051/0004-6361:20021116'),
  Dennerl06: S('Dennerl et al. 2006, A&A 451, 709 — First observation of Mars with XMM-Newton (exospheric halo)', '10.1051/0004-6361:20054253'),
  Nittler11: S('Nittler et al. 2011, Science 333, 1847 — Mercury major elements from MESSENGER XRS', '10.1126/science.1211567'),
  Nittler20: S('Nittler et al. 2020, Icarus 345, 113716 — global major-element maps of Mercury (XRS)', '10.1016/j.icarus.2020.113716'),
  Gladstone02: S('Gladstone et al. 2002, Nature 415, 1000 — a pulsating auroral X-ray hot spot on Jupiter', '10.1038/4151000a'),
  Bhardwaj05d: S('Bhardwaj et al. 2005, ApJ 624, L121 — Saturn disc X-ray flare', '10.1086/430521'),
  Bhardwaj05r: S('Bhardwaj et al. 2005, ApJ 627, L73 — oxygen Kα X-rays from Saturn\'s rings', '10.1086/431933'),
  Dunn21: S('Dunn et al. 2021, JGR Space Physics 126 — a low-signal detection of X-rays from Uranus', '10.1029/2020ja028739'),
  Elsner02: S('Elsner et al. 2002, ApJ 572, 1077 — soft X-rays from Io, Europa and the Io plasma torus', '10.1086/340434'),
  Lisse17: S('Lisse et al. 2017, Icarus 287, 103 — the puzzling detection of X-rays from Pluto by Chandra', '10.1016/j.icarus.2016.07.008'),
  Lisse96: S('Lisse et al. 1996, Science 274, 205 — X-ray and EUV emission from comet Hyakutake', '10.1126/science.274.5285.205'),
  Lim09: S('Lim & Nittler 2009, Icarus 200, 129 — Eros composition, NEAR XRS recalibration', '10.1016/j.icarus.2008.09.018'),
  Okada06: S('Okada et al. 2006, Science 312, 1338 — X-ray fluorescence of Itokawa by Hayabusa', '10.1126/science.1125731'),
  Peplowski16: S('Peplowski 2016, PSS 134, 36 — Eros composition from the NEAR gamma-ray spectrometer', '10.1016/j.pss.2016.10.006'),
  Lawrence98: S('Lawrence et al. 1998, Science 281, 1484 — Lunar Prospector gamma-ray elemental maps', '10.1126/science.281.5382.1484'),
  Evans06: S('Evans et al. 2006, JGR Planets 111 — Mars Odyssey gamma-ray spectra', '10.1029/2005je002657'),
  Taylor10: S('Taylor et al. 2010, GRL 37 — K and Cl on Mars from the Odyssey GRS', '10.1029/2010gl043528'),
  Abdo09E: S('Abdo et al. (Fermi-LAT) 2009 — cosmic-ray-induced gamma rays from Earth\'s atmosphere', '10.2172/1035805'),
  Loparco15: S('Loparco et al. 2015, ICRC — Fermi-LAT high-energy gamma rays from the Moon', '10.22323/1.236.0816'),
  AbdoSun11: S('Abdo et al. 2011, ApJ 734, 116 — Fermi-LAT gamma rays from the quiet Sun', null, false),
  LeaneLinden23: S('Leane & Linden 2023 — tentative Fermi-LAT gamma rays from Jupiter', null, false),
  Feldman00: S('Feldman et al. 2000, ApJ 535, 1085 — HST/STIS UV imaging of Ganymede\'s polar aurora', '10.1086/308889'),
  Saur15: S('Saur et al. 2015, JGR Space Physics 120, 1715 — Ganymede\'s ocean from its auroral ovals', '10.1002/2014ja020778'),
  Hall95: S('Hall et al. 1995, Nature 373, 677 — an oxygen atmosphere on Europa', '10.1038/373677a0'),
  Roth14: S('Roth et al. 2014, Science 343, 171 — transient water vapour at Europa\'s south pole', '10.1126/science.1247051'),
  Lamy12: S('Lamy et al. 2012, GRL 39 — Earth-based detection of Uranus\' aurorae', '10.1029/2012gl051312'),
  Chaffin14: S('Chaffin et al. 2014, GRL 41, 314 — variability of Martian hydrogen escape (Lyman-α corona)', '10.1002/2013gl058578'),
  Gladstone12: S('Gladstone et al. 2012, JGR Planets 117 — far-UV reflectance of the Moon\'s permanently shadowed regions (LRO LAMP)', '10.1029/2011je003913'),
  GladstoneYoung19: S('Gladstone & Young 2019, Annu. Rev. Earth Planet. Sci. 47, 119 — New Horizons observations of Pluto\'s atmosphere', '10.1146/annurev-earth-053018-060128'),
  Combi00: S('Combi et al. 2000, Icarus 144, 191 — SOHO/SWAN Lyman-α coma of Hale–Bopp', '10.1006/icar.1999.6335'),
  deKleer23: S('de Kleer et al. 2023, PSJ 4, 37 — optical aurorae of Europa, Ganymede and Callisto', '10.3847/psj/acb53c'),
  Lee21: S('Lee et al. 2021, GRL 48 — Venus UV absorbers from Akatsuki 283/365 nm phase curves', '10.1029/2020gl090577'),
  AllenCrawford84: S('Allen & Crawford 1984, Nature 307, 222 — cloud structure on the dark side of Venus (near-IR windows)', '10.1038/307222a0'),
  Crisp89: S('Crisp et al. 1989, Science 246, 506 — the nature of the Venus night-side near-IR features', '10.1126/science.246.4929.506'),
  Mueller20: S('Mueller et al. 2020, Icarus 335, 113400 — multispectral surface emissivity from VIRTIS', '10.1016/j.icarus.2019.113400'),
  deKleer16: S('de Kleer & de Pater 2016, Icarus 280, 405 — Io\'s volcanic activity from 100 nights of Keck AO', '10.1016/j.icarus.2016.06.018'),
  Veeder94: S('Veeder et al. 1994, JGR 99, 17095 — Io\'s heat flow from infrared radiometry 1983–1993', '10.1029/94je00637'),
  Spencer00: S('Spencer et al. 2000, Science 288, 1198 — Io\'s thermal emission from the Galileo PPR', '10.1126/science.288.5469.1198'),
  Karkoschka94: S('Karkoschka 1994, Icarus 111, 174 — spectrophotometry of the jovian planets and Titan, 300–1000 nm', '10.1006/icar.1994.1139'),
  Karkoschka98: S('Karkoschka 1998, Icarus 133, 134 — methane, ammonia and temperature of the jovian planets and Titan (PDS data set doi:10.17189/2bp8-k793)', '10.1006/icar.1998.5913'),
  KiefferStone05: S('Kieffer & Stone 2005, AJ 129, 2887 — the spectral irradiance of the Moon (ROLO)', '10.1086/430185'),
  McClintock07: S('McClintock & Lankton 2007 — MASCS for MESSENGER (Space Sci. Rev.)', '10.1007/978-0-387-77214-1_14'),
  Harmon92: S('Harmon & Slade 1992, Science 258, 640 — radar mapping of Mercury: polar anomalies', '10.1126/science.258.5082.640'),
  Slade92: S('Slade et al. 1992, Science 258, 635 — Mercury radar imaging: evidence for polar ice', '10.1126/science.258.5082.635'),
  Nozette10: S('Nozette et al. 2010, Space Sci. Rev. 150, 285 — LRO Mini-RF', '10.1007/s11214-009-9607-5'),
  Hayne10: S('Hayne et al. 2010, Science 330, 477 — Diviner observations of the LCROSS impact', '10.1126/science.1197135'),
  Bandfield15: S('Bandfield et al. 2015, Icarus 248, 357 — lunar roughness from Diviner', '10.1016/j.icarus.2014.11.009'),
  Seu08: S('Seu et al. 2008, IEEE Radar Conf. — SHARAD shallow radar sounder', '10.1109/radar.2008.4721074'),
  Picardi08: S('Picardi et al. 2008, IEEE Radar Conf. — MARSIS subsurface sounding', '10.1109/radar.2008.4720759'),
  Zebker14: S('Zebker et al. 2014, GRL 41, 308 — Ligeia Mare from Cassini altimeter and radiometer', '10.1002/2013gl058877'),
  LeGall20: S('Le Gall et al. 2020, EPSC — diurnal variation of Titan\'s near-surface temperature from the Cassini radiometer', '10.5194/epsc2020-618'),
  Zhang23: S('Zhang et al. 2023, GRL — Microwave observations of Ganymede\'s sub-surface ice 2: reflected radiation', '10.1029/2022gl101565'),
  Ermakov24: S('Ermakov et al. 2024, EGU — Juno MWR into the ice shells of Io, Europa and Ganymede', '10.5194/egusphere-egu24-6820'),
  Tapping13: S('Tapping 2013, Space Weather 11, 394 — the 10.7 cm solar radio flux', '10.1002/swe.20064'),
  Grefenstette16: S('Grefenstette et al. 2016, ApJ 826, 20 — the first focused hard X-ray images of the Sun (NuSTAR)', '10.3847/0004-637x/826/1/20'),
  Shimojo24: S('Shimojo et al. 2024, Sol. Phys. 299 — observing the Sun with ALMA: 3 mm polarisation', '10.1007/s11207-024-02265-3'),
  Molter21: S('Molter et al. 2021, PSJ 2, 3 — Uranus with ALMA and the VLA, 1.3 mm–10 cm', '10.3847/psj/abc48a'),
  deP84: S('de Pater et al. 1984, Icarus 57, 93 — VLA observations of the Galilean satellites', '10.1016/0019-1035(84)90011-3'),
  Fa10: S('Fa & Jin 2010, Icarus 207, 605 — Chang\'e-1 multichannel radiometer lunar brightness temperatures', '10.1016/j.icarus.2009.11.034'),
  CDS_HiPS: S('CDS MocServer listing of planetary HiPS (queried 2026-10-10)', 'https://alasky.cds.unistra.fr/MocServer/query?ID=CDS/P/*&get=id'),
  // #28: archive maps and disc images wired as real band imagery
  Williams17: S('Williams et al. 2017, Icarus 283, 300 — the global surface temperatures of the Moon measured by Diviner', '10.1016/j.icarus.2016.08.012'),
  Prettyman06: S('Prettyman et al. 2006, JGR 111, E12007 — elemental composition of the lunar surface from Lunar Prospector gamma-ray spectroscopy', '10.1029/2005JE002656'),
  Boynton07: S('Boynton et al. 2007, JGR 112, E12S99 — H, Si, Cl, K, Fe and Th in the low- and mid-latitude regions of Mars (Odyssey GRS)', '10.1029/2007JE002887'),
  LeMouelic19: S('Le Mouélic et al. 2019, Icarus 319, 121 — the Cassini VIMS archive of Titan: global infrared colour maps', '10.1016/j.icarus.2018.09.017'),
  Trek: S('NASA Solar System Treks layer catalogues (Moon, Mars, Mercury, Titan, Venus…; queried 2026-10-10)', 'https://trek.nasa.gov/'),
  ESAWebb: S('ESA/Webb image archive, CC BY 4.0 (jupiter-auroras1, saturn1, weic2214c, weic2310a)', 'https://esawebb.org/images/'),
  CXC07: S('Chandra photo album, Jupiter 2007 (X-ray-only frame jupiter_xray.jpg; X-ray: NASA/CXC/SwRI/R. Gladstone et al.); no copyright asserted (NASA guidelines)', 'https://chandra.harvard.edu/photo/2007/jupiter/'),
  NOIRLabJ: S('NOIRLab noirlab2116a, Gemini North NIRI M′ 4.68 µm Jupiter, 11 Jan 2017 (M.H. Wong et al.), CC BY 4.0', 'https://noirlab.edu/public/images/noirlab2116a/'),
  NOIRLabIo: S('NOIRLab gemini1405a, Gemini North NIRI/Altair Io, 29 Aug 2013 (K. de Kleer); L′ 3.78 µm per UC Berkeley\'s release of the same frame; CC BY 4.0', 'https://noirlab.edu/public/images/gemini1405a/'),
  deKleer14: S('de Kleer et al. 2014, Icarus 242, 352 — near-infrared monitoring of Io and the 29 Aug 2013 outburst', '10.1016/j.icarus.2014.06.006'),
  dePater19A: S('de Pater et al. 2019, AJ 158, 139 — first ALMA millimetre maps of Jupiter (Bands 3 and 6, Jan 2017)', 'https://arxiv.org/abs/1907.11820'),
  ESAHubble: S('ESA/Hubble image heic1613a (Jupiter\'s far-UV aurorae), CC BY 4.0', 'https://esahubble.org/images/heic1613a/'),
};

// ---- what exists, body by body ----------------------------------------------------------------
// obs: map | image | disc (disc-integrated flux) | detected (signal, no usable image) | upper-limit | none
// img: imagery that exists [{ archive, what, licence, res, proj, fetch }]
const HIPS = (id, what, res) => ({ archive: 'CDS HiPS (hips2fits)', id, what, licence: 'NASA/ESA/JAXA mission data, public; credit the mission', res, proj: 'HEALPix → equirectangular via hips2fits', fetch: 'yes: /api/hips (allowlisted from BODY_BAND)' });
const PDS = (what, fetch = 'not yet: needs an allowlisted PDS route (GeoTIFF/IMG) in the backend') => ({ archive: 'NASA PDS', what, licence: 'public domain (NASA)', proj: 'equirectangular/polar stereographic', fetch });
const K = {
  // Sun
  'sun|radio': { obs: 'map', what: 'Daily disc flux F10.7 since 1947 (DRAO); radioheliograph images at 17/34 GHz (Nobeyama 1992–2020), 3–24 GHz (Siberian Radioheliograph, daily) and metre wavelengths (Nançay, LOFAR).', mech: 'thermal free-free from chromosphere/corona (10⁴–10⁶ K), gyroresonance over sunspots, non-thermal bursts', img: [{ archive: 'Siberian Radioheliograph', what: '3.0 GHz daily full-disc map', fetch: 'yes: live feed srh-3000 (#28)' }, { archive: 'Nançay / LOFAR / EOVSA', what: 'metre-wave and 1–18 GHz images', fetch: 'no: not fetchable (re-checked 2026-10-10)' }], src: ['Tapping13'], fix: 'Measured SRH 3 GHz map; below 3 GHz (408 MHz, 1.4, 2.4 GHz) MODELLED · PREDICTED discs from measured inputs (quiet-Sun Tb, HMI-placed active regions, F10.7/RSTN total), never MEASURED (#28).' },
  'sun|microwave': { obs: 'map', what: 'ALMA single-dish full-disc maps at 3 mm and 1.3 mm; Nobeyama 17/34 GHz.', mech: 'chromospheric free-free, 6,000–10,000 K', img: [{ archive: 'Nobeyama Radioheliograph', what: '17/34 GHz archival maps', fetch: 'yes: norh-17 / norh-34 (#28)' }], src: ['Shimojo24'], fix: 'Archival Nobeyama 17/34 GHz maps (MEASURED, dated); ALMA mm maps not fetched.' },
  'sun|ir': { obs: 'image', what: 'Photosphere seen by many IR telescopes (limb darkening, opacity minimum at 1.6 µm).', mech: 'photospheric thermal', fix: 'Computed blackbody colour is appropriate.' },
  'sun|visible': { obs: 'image', what: 'SDO HMI continuum, live.', mech: 'photospheric thermal', img: [{ archive: 'Helioviewer (SDO)', what: 'HMI continuum', fetch: 'yes: live skin' }] },
  'sun|uv': { obs: 'image', what: 'SDO AIA 1600/1700 Å live; Lyman-α imaged by Solar Orbiter EUI HRI-Lyα and PROBA2 LYRA (disc flux).', mech: 'upper photosphere/chromosphere continuum and lines', img: [{ archive: 'Helioviewer (SDO AIA)', what: '1600/1700 Å', fetch: 'yes: live feed' }], fix: 'FUV and Lyman-α now take AIA 1600 as the nearest channel (labelled); NUV/UVW1/UVM2/F225W/F275W are the photosphere\'s computed colour (the band-level AIA fallback on them was removed).' },
  'sun|xray': { obs: 'map', what: 'SDO AIA EUV channels live; whole-disc GOES XRS 0.1–0.8 nm since the 1970s; hard X-ray images from RHESSI (2002–18) and NuSTAR.', mech: 'coronal thermal bremsstrahlung and lines; non-thermal bremsstrahlung in flares', src: ['Grefenstette16'], fix: 'Soft X-ray keeps AIA 94 Å (nearest); hard X-ray (14–195 keV) no longer shows the 94 Å map: a cited flare/quiet-Sun sketch (SUN_SIGNATURES.xray). Hinode XRT images via Helioviewer would be a real soft X-ray map (deferred).' },
  'sun|gamma': { obs: 'detected', what: 'Fermi-LAT quiet-Sun disc and inverse-Compton halo; flares > 1 GeV.', mech: 'cosmic-ray hadronic interactions in the photosphere; inverse-Compton of cosmic-ray electrons', src: ['AbdoSun11'] },
  // Mercury
  'mercury|radio': { obs: 'map', what: 'VLA thermal maps 0.3–20.5 cm (subsurface, hot poles visible); Arecibo/Goldstone radar maps of polar ice deposits.', mech: 'subsurface thermal (damped diurnal wave); radar backscatter', src: ['MdP94', 'Harmon92', 'Slade92'], fix: 'Was the 700 K/100 K surface model; now the damped subsurface model (mean ~360 K, estimate).' },
  'mercury|microwave': { obs: 'map', what: 'VLA/BIMA mm maps (Mitchell & de Pater 1994).', mech: 'subsurface thermal', src: ['MdP94'], fix: 'Damped subsurface model.' },
  'mercury|ir': { obs: 'disc', what: 'Ground-based mid-IR; MESSENGER MASCS VIRS (0.3–1.45 µm); BepiColombo MERTIS (7–14 µm) from orbit after Nov 2026.', mech: 'reflected < 3 µm, thermal beyond', src: ['McClintock07'], img: [{ archive: 'ESA PSA', what: 'MERTIS maps (future)', fetch: 'no' }] },
  'mercury|visible': { obs: 'map', what: 'MESSENGER MDIS global mosaics (750 nm LOI, enhanced colour).', mech: 'reflected', img: [HIPS('CDS/P/Mercury/MESSENGER-MDIS-LOI-166m', '750 nm monochrome', '166 m'), HIPS('CDS/P/Mercury/MDIS-enhanced-color', '1000/750/430 nm false colour', '665 m')], src: ['CDS_HiPS'], fix: 'New real map: MDIS 750 nm for SDSS i, Johnson I and R. The enhanced-colour composite (a 3-filter false colour) no longer stands in for Johnson I.' },
  'mercury|uv': { obs: 'detected', what: 'MASCS UVVS exosphere (Na, Ca, Mg) and surface reflectance.', mech: 'reflected; resonant scattering in the exosphere', src: ['McClintock07'] },
  'mercury|xray': { obs: 'map', what: 'MESSENGER XRS global Mg/Si, Al/Si, S/Si, Ca/Si, Fe/Si maps.', mech: 'solar-induced X-ray fluorescence', img: [PDS('XRS element-ratio maps')], src: ['Nittler11', 'Nittler20'], fix: 'Was missing (NOT OBSERVED); now a detected day-side fluorescence sketch.' },
  'mercury|gamma': { obs: 'map', what: 'MESSENGER GRS (K, Th, U) and neutron spectrometer polar hydrogen.', mech: 'cosmic-ray-induced nuclear lines', src: [] , unverified: 'Peplowski et al. 2011 (Science) / Lawrence et al. 2013 not re-checked in this audit.' },
  // Venus
  'venus|radio': { obs: 'map', what: 'Magellan 12.6 cm passive radiometry (emissivity) and SAR; VLA and GMRT disc temperatures 554–680 K (0.6–4.9 GHz).', mech: 'surface thermal emission through the clouds (~735 K × emissivity); radar backscatter (SAR)', img: [HIPS('CDS/P/Venus/Magellan/Microwave-Emissivity-4641m', '12.6 cm emissivity', '4.6 km'), HIPS('CDS/P/Venus/Magellan/C3-MDIR-2025m', '12.6 cm SAR (radar echoes)', '2 km')], src: ['M19', 'B01', 'CDS_HiPS'], fix: 'radio-s now shows the emissivity map (the surface\'s own 12.6 cm emission) instead of the SAR echo image; the band-level fallback that put the radar image on 408 MHz, 21 cm and NVSS was removed; those passes use the measured Tb spectrum (554–626 K).' },
  'venus|microwave': { obs: 'disc', what: 'CLASS 39–218 GHz, VLA cm: Tb falls from ~680 K at 6 cm to ~295 K at 1.4 mm as CO₂ and H₂SO₄ opacity rise.', mech: 'atmospheric thermal emission from progressively higher layers', src: ['D23', 'B01'], fix: 'Was the 12.6 cm emissivity map (wrong layer) and a single 700 K; now the measured Tb spectrum.' },
  'venus|ir': { obs: 'map', what: 'Night-side windows at 1.0–1.2, 1.74, 2.3 µm (ground, Galileo NIMS, VEx VIRTIS, Akatsuki IR1/IR2); cloud tops ~230 K at 10 µm (Akatsuki LIR).', mech: 'reflected by day; thermal from the lower atmosphere/surface through windows by night; cloud-top thermal at > 3 µm', img: [{ archive: 'JAXA DARTS', what: 'Akatsuki IR2/LIR images', licence: 'JAXA, credit required', fetch: 'not yet (no HiPS)' }, { archive: 'ESA PSA', what: 'VIRTIS cubes', fetch: 'no' }], src: ['AllenCrawford84', 'Crisp89', 'Mueller20'], fix: '1–2.3 µm passes now show day-side reflection plus a night-side window glow (kind 7, sketch).' },
  'venus|visible': { obs: 'image', what: 'Featureless cloud deck; reflected.', mech: 'reflected' },
  'venus|uv': { obs: 'map', what: 'The unknown UV absorber at 283/365 nm (Akatsuki UVI, VEx VMC, Pioneer Venus); Lyman-α corona.', mech: 'reflected with absorber contrast; resonant scattering', img: [{ archive: 'JAXA DARTS', what: 'Akatsuki UVI 283/365 nm', fetch: 'not yet' }], src: ['Lee21'], fix: 'Lyman-α was NOT OBSERVED; now the detected H corona (limb sketch).' },
  'venus|xray': { obs: 'image', what: 'Chandra 2001 and 2006: C/O fluorescence on the day side, charge-exchange halo.', mech: 'fluorescence; solar-wind charge exchange', src: ['Dennerl02V', 'Dennerl08V'] },
  // Earth
  'earth|radio': { obs: 'detected', what: 'Thermal ~285 K plus anthropogenic emission; auroral kilometric radiation (below our bands).', mech: 'thermal; non-thermal (AKR, out of band)', fix: 'Unchanged; Earth microwave/radio maps are the #28 agent\'s.' },
  'earth|microwave': { obs: 'map', what: 'Passive microwave imagers (AMSR2, SMAP, GMI) mapped daily.', mech: 'surface emission (emissivity × T), water vapour, ice', img: [{ archive: 'NASA GIBS', what: 'AMSR2 / SMAP layers', fetch: 'belongs to the #28 agent (Earth microwave)' }] },
  'earth|ir': { obs: 'map', what: 'GOES/Himawari ABI/AHI 3.9–13.3 µm every 10 min.', mech: 'reflected < 3 µm; thermal beyond', img: [{ archive: 'NASA GIBS', what: 'ABI/AHI band 13 (10.3 µm)', fetch: 'yes: /api/gibs-band' }], fix: 'The band-level 10.3 µm fallback no longer paints 2MASS J/H/Ks and W1 (reflected light) with a thermal map; it now covers 10.3 and 12 µm only.' },
  'earth|uv': { obs: 'map', what: 'OMPS aerosol index; geocorona (Lyman-α); auroral FUV (IMAGE, DMSP SSUSI, GOLD).', mech: 'reflected/absorbed; resonant scattering; aurora', src: [], fix: 'Lyman-α and FUV now show the geocorona/aurora (detected sketches).' },
  'earth|xray': { obs: 'detected', what: 'Auroral bremsstrahlung (Polar PIXIE), fluorescence, exospheric charge exchange.', mech: 'bremsstrahlung, fluorescence, charge exchange' },
  'earth|gamma': { obs: 'detected', what: 'Fermi-LAT limb, the brightest gamma-ray source seen from LEO; TGFs.', mech: 'cosmic-ray air showers; lightning', src: ['Abdo09E'] },
  // Moon
  'moon|radio': { obs: 'map', what: 'Disc emission ~220–230 K with a small, lagged phase swing (Piddington & Minnett 1949); Arecibo 70 cm and LRO Mini-RF radar maps.', mech: 'subsurface thermal; radar backscatter', src: ['PM49', 'Nozette10'], fix: 'Was 390 K day / 95 K night (surface); now the damped subsurface model.' },
  'moon|microwave': { obs: 'map', what: 'Chang\'e-1/-2 radiometers mapped 3, 7.8, 19.35, 37 GHz globally, day and night.', mech: 'subsurface thermal', img: [{ archive: 'CLPDS (China)', what: 'Chang\'e MRM brightness-temperature maps', licence: 'CNSA data policy', fetch: 'not yet (registration; no HiPS)' }], src: ['Fa10'], fix: 'Damped subsurface model; Chang\'e maps as real imagery deferred.' },
  'moon|ir': { obs: 'map', what: 'LRO Diviner global thermal maps (7 IR channels, day and night).', mech: 'thermal (reflected < 3 µm)', img: [PDS('Diviner GDR temperature maps')], src: ['Hayne10', 'Bandfield15'], fix: 'Diviner as real imagery deferred (no HiPS; needs a PDS route).' },
  'moon|visible': { obs: 'map', what: 'Clementine 750 nm, LRO WAC 643 nm, Kaguya TC.', mech: 'reflected', img: [HIPS('CDS/P/Moon/Clementine-750nm-118m', '750 nm', '118 m'), HIPS('CDS/P/Moon/LROC-WAC-100m', '643 nm', '100 m'), HIPS('CDS/P/Moon/Kaguya-Evening-V04-474m', 'Terrain Camera', '474 m')], src: ['KiefferStone05', 'CDS_HiPS'], fix: 'New real map: LRO WAC 643 nm for Johnson R and SDSS r (was Clementine 750 nm); Clementine now also on SDSS i.' },
  'moon|uv': { obs: 'map', what: 'LRO LAMP far-UV maps, including permanently shadowed craters lit by Lyman-α sky glow.', mech: 'reflected', img: [PDS('LAMP far-UV albedo maps')], src: ['Gladstone12'] },
  'moon|xray': { obs: 'image', what: 'ROSAT 1990 soft X-ray image; Chandrayaan-1 C1XS, Chang\'e-2 XRS.', mech: 'solar-induced fluorescence; night side: foreground charge exchange', src: ['Schmitt91'] },
  'moon|gamma': { obs: 'map', what: 'Fermi-LAT detection from Earth orbit; Lunar Prospector and Kaguya GRS element maps.', mech: 'cosmic-ray albedo', img: [PDS('Lunar Prospector GRS maps')], src: ['Lawrence98', 'Loparco15'] },
  // Mars
  'mars|radio': { obs: 'disc', what: 'VLA 2/6 cm maps (polarisation, subsurface); SHARAD and MARSIS radar sounding; Goldstone/Arecibo radar.', mech: 'subsurface thermal; radar', src: ['Seu08', 'Picardi08'], fix: 'Was 290/180 K surface; now damped subsurface (WMAP-anchored mean 195 K).' },
  'mars|microwave': { obs: 'disc', what: 'WMAP 23–94 GHz: 178–204 K (2001–08).', mech: 'subsurface thermal', src: ['W11'], fix: 'Damped subsurface model, mean from WMAP.' },
  'mars|ir': { obs: 'map', what: 'Odyssey THEMIS day and night 12.6 µm mosaics; MGS TES albedo, thermal inertia, dust cover.', mech: 'thermal > 3 µm; reflected < 3 µm', img: [HIPS('CDS/P/Mars/THEMIS-Day-100m-v12', 'THEMIS day 12.6 µm', '100 m'), HIPS('CDS/P/Mars/THEMIS-IR-Night-100m-v14', 'THEMIS night 12.6 µm', '100 m'), HIPS('CDS/P/Mars/MGS-TES-Dust', 'TES dust-cover index (derived)', '3.5 km')], src: ['CDS_HiPS'], fix: 'THEMIS day no longer shown for 2MASS J/H/Ks, F200W, W1, F444W, 5 µm (reflected/mixed light); it now covers 7.7–22 µm. THEMIS night (verified renderable) is recorded for a future night-side layer.' },
  'mars|visible': { obs: 'map', what: 'Viking MDIM, MRO CTX, Tianwen-1 MoRIC mosaics.', mech: 'reflected', img: [HIPS('CDS/P/Mars/Viking-MDIM21-color', 'Viking colour', '~230 m'), HIPS('CDS/P/Mars/MRO-CTX', 'CTX', '5 m')] },
  'mars|uv': { obs: 'map', what: 'MAVEN IUVS, SPICAM: ozone, aurorae, Lyman-α corona.', mech: 'reflected; resonant scattering; aurora', src: ['Chaffin14'], fix: 'Lyman-α now the detected corona.' },
  'mars|xray': { obs: 'image', what: 'Chandra day-side fluorescence; XMM-Newton exospheric halo to ~8 R.', mech: 'fluorescence; charge exchange', src: ['Dennerl02M', 'Dennerl06'] },
  'mars|gamma': { obs: 'map', what: 'Mars Odyssey GRS element and hydrogen maps.', mech: 'cosmic-ray nuclear lines', img: [PDS('GRS element maps')], src: ['Evans06', 'Taylor10'] },
  // Jupiter
  'jupiter|radio': { obs: 'map', what: 'VLA/LOFAR images of the synchrotron belts (a few Jy, 0.1–5 GHz); thermal disc 270 K at 3 GHz rising at longer λ; Juno MWR 0.6–22 GHz maps; Io-controlled decametric bursts (< 40 MHz, out of band).', mech: 'synchrotron (non-thermal) + deep-atmosphere thermal', src: ['dP03', 'G16', 'B02', 'SC14', 'dP19'], fix: 'Was a single 350 K and "non-thermal not modelled"; now the measured Tb spectrum plus a modelled belt glow sized by the synchrotron share of the flux (85–98% below 1.5 GHz).' },
  'jupiter|microwave': { obs: 'map', what: 'VLA 3–37 GHz longitude-resolved maps; WMAP 23–94 GHz disc; Juno MWR.', mech: 'thermal from 0.5–20 bar (NH₃ opacity)', src: ['dP19', 'W11', 'D23'], fix: 'Measured Tb spectrum (136 K at the 23 GHz NH₃ band to 173 K at 94 GHz) replaces 350 K.' },
  'jupiter|ir': { obs: 'map', what: 'JWST, Juno JIRAM, ground: 5 µm hot spots, auroral H₃⁺ at 3–4 µm, stratospheric 7–8 µm.', mech: 'reflected < 3 µm; thermal; H₃⁺ auroral emission', fix: '5 µm window now ~220 K (estimate) instead of 125 K cloud tops.' },
  'jupiter|visible': { obs: 'map', what: 'Cassini/Juno/HST maps; measured disc spectrum (Karkoschka).', mech: 'reflected', src: ['Karkoschka98'], fix: 'Reflectance now the measured 300–1050 nm spectrum (e.g. 1000 nm was ×0.82 of 550 nm, measured ×0.20).' },
  'jupiter|uv': { obs: 'map', what: 'HST STIS/Juno UVS auroral ovals; Lyman-α bulge.', mech: 'aurora (H₂ Lyman/Werner, Lyα); reflected NUV', fix: 'FUV and Lyman-α now auroral sketches (were reflected/NOT OBSERVED).' },
  'jupiter|xray': { obs: 'image', what: 'Chandra/XMM auroral hot spots, disc scattering.', mech: 'ion charge exchange (aurora), scattering', src: ['Gladstone02'] },
  'jupiter|gamma': { obs: 'upper-limit', what: 'Tentative Fermi-LAT signal only.', mech: 'cosmic-ray albedo (predicted)', src: ['LeaneLinden23'] },
  // Saturn
  'saturn|radio': { obs: 'map', what: 'VLA cm maps; Cassini 2.2 cm radiometer maps (Janssen 2013).', mech: 'deep thermal (NH₃ opacity)', img: [PDS('Cassini RADAR radiometry of Saturn')], src: ['J13'], fix: 'Tb spectrum; cm values are estimates (not read from a table).' },
  'saturn|microwave': { obs: 'disc', what: 'WMAP disc 134–146 K, rings 7–20 K (23–94 GHz).', mech: 'thermal; rings cold and blocking', src: ['W11'], fix: 'Measured Tb; rings now shown in the microwave at their measured fraction of the disc.' },
  'saturn|ir': { obs: 'map', what: 'Cassini VIMS 5 µm silhouettes, CIRS thermal maps.', mech: 'reflected; thermal; 5 µm window', fix: '5 µm window ~170 K (estimate).' },
  'saturn|visible': { obs: 'map', what: 'Cassini ISS; Karkoschka spectrum.', mech: 'reflected', src: ['Karkoschka98'] },
  'saturn|uv': { obs: 'map', what: 'HST and Cassini UVIS aurorae.', mech: 'aurora; reflected', fix: 'FUV/Lyα auroral sketches.' },
  'saturn|xray': { obs: 'image', what: 'Chandra: disc X-rays tracking solar flares; rings in O Kα.', mech: 'scattering/fluorescence', src: ['Bhardwaj05d', 'Bhardwaj05r'], fix: 'Was NOT OBSERVED; now detected disc sketch, rings shown.' },
  'saturn|gamma': { obs: 'none', what: 'Not detected.', mech: 'cosmic-ray albedo (predicted)' },
  // Uranus / Neptune
  'uranus|radio': { obs: 'map', what: 'VLA maps 1981–2012 showing seasonal change; Tb rises to ~250+ K at 6–20 cm.', mech: 'deep thermal (H₂S, NH₃)', src: ['HB03', 'Molter21'], fix: 'Tb spectrum; cm values estimates.' },
  'uranus|microwave': { obs: 'map', what: 'WMAP 23–94 GHz (121–168 K); ALMA maps (bright north pole).', mech: 'thermal', src: ['W11', 'Molter21'] },
  'uranus|visible': { obs: 'image', what: 'Voyager 2, HST, Keck; Karkoschka spectrum.', mech: 'reflected', src: ['Karkoschka98'], fix: 'Measured spectrum: 1000 nm ×0.02 of 550 nm (was ×0.2).' },
  'uranus|uv': { obs: 'detected', what: 'HST aurorae; Voyager UVS.', mech: 'aurora', src: ['Lamy12'] },
  'uranus|xray': { obs: 'detected', what: '5 ± 2 photons, Chandra 2002 (low signal).', mech: 'scattering/fluorescence, possibly auroral', src: ['Dunn21'], fix: 'Was NOT OBSERVED; now detected (low-signal) sketch.' },
  'neptune|microwave': { obs: 'disc', what: 'WMAP (noisy, ±8–17%), VLA, ALMA.', mech: 'thermal', src: ['W11'] },
  'neptune|xray': { obs: 'none', what: 'No detection (the only planet without one).', mech: 'scattering (predicted)', src: ['Dunn21'], fix: 'Now PREDICTED · NOT DETECTED instead of a silent dark disc.' },
  'neptune|visible': { obs: 'image', what: 'Voyager 2, HST; Karkoschka spectrum.', mech: 'reflected', src: ['Karkoschka98'] },
  // Pluto
  'pluto|visible': { obs: 'map', what: 'New Horizons global mosaic.', mech: 'reflected', img: [HIPS('CDS/P/Pluto/NewHorizons-Jul2017-300m', 'New Horizons mosaic', '300 m')] },
  'pluto|uv': { obs: 'image', what: 'New Horizons Alice Lyman-α (night side lit by the sky glow).', mech: 'resonant scattering', src: ['GladstoneYoung19'] },
  'pluto|xray': { obs: 'detected', what: 'A handful of Chandra photons (2014–15).', mech: 'charge exchange (puzzling excess)', src: ['Lisse17'], fix: 'Was NOT OBSERVED; now detected sketch.' },
  'pluto|radio': { obs: 'disc', what: 'New Horizons REX 4.2 cm night-side radiometry; ALMA Pluto–Charon.', mech: 'subsurface thermal', unverified: 'REX and ALMA Pluto references not re-checked in this audit.' },
  // Galilean moons
  'io|ir': { obs: 'map', what: 'Volcanic hot spots dominate 3–5 µm (Keck AO, Juno JIRAM); Galileo PPR passive surface.', mech: 'volcanic thermal (lava 1,000+ K) over a ~130 K surface', src: ['deKleer16', 'Veeder94', 'Spencer00'], fix: '3–5 µm now a detected hot-spot sketch (was a 130 K surface).' },
  'io|microwave': { obs: 'map', what: 'Juno MWR flybys (Dec 2023, Feb 2024); ALMA SO₂ maps.', mech: 'subsurface thermal', src: ['Z24', 'Ermakov24'] },
  'io|uv': { obs: 'image', what: 'HST STIS O and S emission of the SO₂ atmosphere.', mech: 'aurora (plasma torus)', fix: 'FUV detected limb/flank sketch.' },
  'io|xray': { obs: 'detected', what: 'Chandra 2000.', mech: 'ion impacts / fluorescence', src: ['Elsner02'], fix: 'Was NOT OBSERVED; now detected.' },
  'europa|microwave': { obs: 'map', what: 'Juno MWR 2022: Tb below the surface temperature at 0.6–22 GHz, rising with frequency; 29 ± 10 km conductive shell; ALMA 233 GHz maps. Europa Clipper REASON (9 and 60 MHz radar) will sound the shell.', mech: 'subsurface thermal from metres (22 GHz) to ~28 km (0.6 GHz), scattered by cm-scale cracks/pores', src: ['L25', 'Z24', 'T18', 'S99'], fix: 'Was one 113 K surface temperature; now the damped subsurface model × a frequency-dependent effective emissivity (trend cited, amplitudes estimates).' },
  'europa|radio': { obs: 'map', what: 'Juno MWR 0.6–2.5 GHz channels (deep ice).', mech: 'deep-ice thermal + reflected sky/synchrotron', src: ['L25', 'Zhang23'] },
  'europa|uv': { obs: 'image', what: 'HST O emission, plumes reported.', mech: 'aurora; plume absorption', src: ['Hall95', 'Roth14'] },
  'europa|xray': { obs: 'detected', what: 'Chandra 2000.', mech: 'ion impacts', src: ['Elsner02'] },
  'ganymede|microwave': { obs: 'map', what: 'Juno MWR 2021 maps: Tb anti-correlated with albedo, falling with frequency, bright terrain up to half the blackbody temperature; ALMA mm emissivity 0.75–0.78.', mech: 'subsurface thermal with volume scattering', src: ['Br23', 'Zhang23', 'Z24', 'dK21'], fix: 'Subsurface model with falling emissivity (trend cited).' },
  'ganymede|uv': { obs: 'image', what: 'HST STIS auroral ovals.', mech: 'aurora', src: ['Feldman00', 'Saur15'], fix: 'FUV now auroral ovals (kind 5).' },
  'callisto|microwave': { obs: 'map', what: 'ALMA 343 GHz leading hemisphere: 116 ± 5 K disc.', mech: 'subsurface thermal', src: ['C23', 'deP84'] },
  'callisto|visible': { obs: 'image', what: 'Voyager/Galileo mosaics; optical aurora in eclipse (Keck).', mech: 'reflected; O aurora', src: ['deKleer23'] },
  // Saturn's moons, Titan
  'titan|microwave': { obs: 'map', what: 'Cassini 2.18 cm radiometry global map; SAR swaths (radar).', mech: 'surface thermal (atmosphere transparent at cm); radar backscatter', img: [HIPS('CDS/P/Titan/SAR-HiSAR-128ppd', 'SAR (radar)', '128 px/deg')], src: ['J16', 'Zebker14', 'LeGall20'], fix: 'mw-ku keeps the SAR, now labelled as radar echoes; WMAP passes no longer borrow the radar map.' },
  'titan|ir': { obs: 'map', what: 'Cassini VIMS windows 1.08–5 µm (global mosaics), ISS 938 nm, CIRS 19 µm surface temperature.', mech: 'reflected through methane windows; thermal', img: [HIPS('CDS/P/Titan/ISS-P19658-4km', 'ISS 938 nm', '4 km')], fix: 'The 938 nm map no longer stands in for every IR pass (incl. 22 µm thermal); it now covers Johnson I and SDSS z.' },
  'titan|visible': { obs: 'map', what: 'Cassini ISS 938 nm; haze-dominated in the visible; Karkoschka spectrum.', mech: 'reflected', src: ['Karkoschka98'] },
  'enceladus|microwave': { obs: 'map', what: 'Cassini 2.2 cm radiometry: a large-scale anomaly; CIRS south-polar heat.', mech: 'subsurface thermal; endogenic heat', src: ['RJ15'] },
  'iapetus|microwave': { obs: 'map', what: 'Cassini 2.2 cm radiometry.', mech: 'subsurface thermal', src: ['LG14'] },
  // small bodies
  'eros|xray': { obs: 'detected', what: 'NEAR XRS from orbit.', mech: 'fluorescence', src: ['Lim09'] },
  'eros|gamma': { obs: 'detected', what: 'NEAR GRS (best after landing).', mech: 'cosmic-ray nuclear lines', src: ['Peplowski16'] },
  'itokawa|xray': { obs: 'detected', what: 'Hayabusa XRS.', mech: 'fluorescence', src: ['Okada06'] },
  '67p|microwave': { obs: 'map', what: 'Rosetta MIRO 0.5 and 1.6 mm subsurface temperatures.', mech: 'subsurface thermal', src: ['G15'] },
  'rings|microwave': { obs: 'disc', what: 'WMAP: 7–20 K at 23–94 GHz.', mech: 'thermal ice (cold); scattering/blocking the planet', src: ['W11'], fix: 'Rings now drawn at their measured fraction of the disc (were hidden).' },
  'rings|xray': { obs: 'detected', what: 'Chandra O Kα (0.53 keV).', mech: 'fluorescence', src: ['Bhardwaj05r'], fix: 'Rings now shown (were hidden).' },
  'rings|uv': { obs: 'image', what: 'HST and Cassini UVIS ring images.', mech: 'reflected', fix: 'Rings now shown in UV (were hidden).' },
};
// #28: real band imagery added after the #61 audit (src/data/bandarchive.js, server/bandarchive.js),
// and archives looked at but not wired, with the reason. `replace` drops the row's older imagery list.
const WIRED = (archive, what, licence, fetch, extra = {}) => ({ archive, what, licence, fetch: `yes (#28): ${fetch}`, ...extra });
const NOT_WIRED = (archive, what, why) => ({ archive, what, fetch: `not wired (#28): ${why}` });
const TREK = 'NASA Solar System Treks WMTS', PDSG = 'NASA PDS Geosciences Node', PD = 'public domain (NASA)', CCBY = 'CC BY 4.0 (credit the full line)';
const K28 = {
  'moon|ir': { replace: true, img: [WIRED(TREK, 'Diviner bolometric brightness temperature at local noon (diviner_tbol_hour12, 0.5°)', PD, '/api/band-archive?id=moon-diviner-noon (PNG tiles mosaicked)'),
    NOT_WIRED(TREK, 'Diviner midnight temperature, rock abundance, H-parameter', 'one map per bandpass; the noon map is drawn and the model sets the night side')], src: ['Williams17', 'Trek'], fix: '#28: Diviner noon temperature is now the real map from 7.7 to 140 µm.' },
  'moon|gamma': { replace: true, img: [WIRED(PDSG, 'Lunar Prospector GRS Th, K, FeO abundances (2° equal-area bins, ASCII table)', PD, '/api/band-archive?id=moon-lpgrs-{thorium,potassium,feo} on the new nuclear-line passes'),
    NOT_WIRED(TREK, 'LP GRS colourised layers', 'colour ramps without a legend; the PDS table is drawn instead')], src: ['Prettyman06'], fix: '#28: new nuclear-line passes (K 1.46, Th 2.61, Fe 7.6 MeV) show the Lunar Prospector maps; > 100 MeV keeps the Fermi glow.' },
  'moon|uv': { replace: true, img: [NOT_WIRED('NASA PDS Imaging (LROLAM_2001 GDR)', 'LAMP far-UV and Lyman-α albedo maps', 'polar stereographic caps poleward of 80° only, no global map')] },
  'moon|microwave': { replace: true, img: [NOT_WIRED('NASA PDS Geosciences (chang_e_microwave_processed)', 'Chang\'e-1/-2 MRM brightness temperature maps, 3–37 GHz', 'the maps are 2.6 GB FITS cubes and the browse PNGs are plotted figures (axes, grid, colour bar); no fetchable plain map')] },
  'mercury|xray': { replace: true, img: [WIRED(PDSG, 'MESSENGER XRS Mg/Si map (8-bit IMG, 4 px/°)', PD, '/api/band-archive?id=mercury-xrs-mg-si on Soft 0.1–2.4 keV'),
    NOT_WIRED(PDSG, 'XRS Al/Si, S/Si, Ca/Si, Fe/Si maps', 'one map per bandpass; Mg/Si (1.25–1.74 keV lines) is inside the soft band')], src: ['Nittler11', 'Nittler20'], fix: '#28: the XRS Mg/Si map is now the real soft X-ray map (day side, northern hemisphere best).' },
  'mars|gamma': { replace: true, img: [WIRED(PDSG, 'Mars Odyssey GRS water-equivalent H, K, Th, Fe (5° grid, ASCII table)', PD, '/api/band-archive?id=mars-grs-{h2o,k,th,fe} on the nuclear-line passes')], src: ['Evans06', 'Taylor10', 'Boynton07'], fix: '#28: the Odyssey GRS maps are the real maps on the K, H, Th and Fe line passes.' },
  'titan|ir': { img: [WIRED(TREK, 'Cassini VIMS global mosaics at 2 and 5 µm (32 px/°)', PD, '/api/band-archive?id=titan-vims-{2um,5um} on Ks, F200W and 5 µm')], src: ['LeMouelic19', 'Trek'], fix: '#28: VIMS 2 and 5 µm methane-window mosaics are real maps.' },
  'titan|microwave': { img: [NOT_WIRED('NASA PDS Imaging (Cassini RADAR BIDR)', 'Cassini 2.2 cm radiometry', 'per-flyby swaths only; no global brightness-temperature mosaic in CDS HiPS, Trek or a single PDS product')] },
  'enceladus|microwave': { img: [NOT_WIRED('NASA PDS Imaging (Cassini RADAR)', 'Cassini 2.2 cm radiometry', 'per-flyby swaths only; no global map product found')] },
  'iapetus|microwave': { img: [NOT_WIRED('NASA PDS Imaging (Cassini RADAR)', 'Cassini 2.2 cm radiometry', 'per-flyby swaths only; no global map product found')] },
  'venus|uv': { replace: true, img: [NOT_WIRED('JAXA DARTS (vco-v-uvi-3-cdr)', 'Akatsuki UVI 283/365 nm', 'calibrated single images (L2b) only in the public PDS3 archive, no longitude–latitude maps or HiPS; a disc image would need per-frame geometry')] },
  'venus|ir': { replace: true, img: [NOT_WIRED('JAXA DARTS (vco-v-ir2-3-cdr, vco-v-lir-3-cdr)', 'Akatsuki IR2 night side, LIR 10 µm', 'calibrated single images only, no global maps or HiPS'), { archive: 'ESA PSA', what: 'VIRTIS cubes', fetch: 'no' }] },
  'jupiter|ir': { img: [WIRED('ESA/Webb', 'JWST NIRCam 1.5–3.6 µm disc image, 27 Jul 2022 (jupiter-auroras1)', CCBY, '/api/band-disc?id=webb-jupiter-2022, Earth-facing side')], src: ['ESAWebb'], fix: '#28: the Webb disc image on H, Ks, F200W and W1 (Earth-facing side; the far side predicted).' },
  'jupiter|uv': { img: [WIRED('ESA/Hubble', 'HST STIS far-UV aurora over a WFC3 visible disc, 2016 (heic1613a)', CCBY, '/api/band-disc?id=hubble-jupiter-aurora-2016 on GALEX FUV, Earth-facing side')], src: ['ESAHubble'], fix: '#28: the Hubble aurora disc image on far-UV (only the aurora is ultraviolet; the disc is visible light).' },
  'saturn|ir': { img: [WIRED('ESA/Webb', 'JWST NIRCam F323N 3.23 µm disc image, 25 Jun 2023 (saturn1)', CCBY, '/api/band-disc?id=webb-saturn-2023 on W1, Earth-facing side')], src: ['ESAWebb'], fix: '#28: the Webb 3.23 µm disc image on W1.' },
  'uranus|ir': { obs: 'image', what: 'JWST NIRCam, Keck, HST near-IR images (rings, polar cap).', mech: 'reflected (methane bands dark)', img: [WIRED('ESA/Webb', 'JWST NIRCam F140M/F300M disc image, 6 Feb 2023 (weic2310a)', CCBY, '/api/band-disc?id=webb-uranus-2023 on J and W1, Earth-facing side')], src: ['ESAWebb'], fix: '#28: the Webb disc image on J and W1.' },
  'neptune|ir': { obs: 'image', what: 'JWST NIRCam, Keck, HST near-IR images (rings, methane-ice clouds).', mech: 'reflected (methane bands dark)', img: [WIRED('ESA/Webb', 'JWST NIRCam 1.4–4.6 µm disc image, 12 Jul 2022 (weic2214c)', CCBY, '/api/band-disc?id=webb-neptune-2022 on H, Ks, F200W, W1 and F444W, Earth-facing side')], src: ['ESAWebb'], fix: '#28: the Webb disc image on H, Ks, F200W, W1 and F444W.' },
};
// #72 (follow-ups to #28): more whole-disc images, and what was looked at but not wired, with the reason.
const WIRED72 = (archive, what, licence, fetch) => ({ archive, what, licence, fetch: `yes (#72): ${fetch}` });
const NOT72 = (archive, what, why) => ({ archive, what, fetch: `not wired (#72): ${why}` });
const K72 = {
  'jupiter|xray': { img: [WIRED72('NASA/CXC (Chandra photo album)', 'Chandra ACIS X-ray-only frame, 8/10/24 Feb 2007 (photo/2007/jupiter/jupiter_xray.jpg); geometry fitted on the same-size X-ray + Hubble composite', 'public domain (no copyright asserted, NASA guidelines)', '/api/band-disc?id=chandra-jupiter-2007 on Soft 0.1–2.4 keV, Earth-facing side'),
    NOT72('NASA/CXC (Chandra photo album)', 'Chandra 2016 (Dunn et al., Oct 2011) X-ray + Hubble pair', 'two-panel composite; its X-ray-only frame is a different, unregistered crop — the 2007 frame is wired instead'),
    NOT72('NASA/CXC (Chandra photo album)', 'Chandra 2017 polar X-ray images (May/Jun 2016)', 'reprojected onto Juno polar views, not as seen from Earth')], src: ['CXC07', 'Gladstone02'], fix: '#72: the Chandra 2007 X-ray image (X-rays only: polar aurorae, a faint disc) is the real soft X-ray look on the Earth-facing side.' },
  'jupiter|radio': { img: [NOT72('NRAO (public.nrao.edu, CC BY 4.0)', 'VLA 20 cm synchrotron belts, Jun/Jul 1994 (jupsynch_large) and "Jupiter in radio waves" (Jupiter_VR48_hi_large)', 'no limb in the image (the belts reach 2–3 Jupiter radii), and neither scale nor north is given, so the disc cannot be measured; the emission is off the planet, so drawing it on the sphere would misplace it'),
    NOT72('NRAO (VLASS)', 'VLASS 3 GHz image of Jupiter', 'the gallery page serves a logo instead of the image; no fetchable file')] },
  'jupiter|microwave': { img: [NOT72('NRAO / ALMA (CC BY 4.0)', 'ALMA 1.3 mm (Band 6, 223–243 GHz) longitude-smeared disc image, 3–5 Jan 2017 (jupiter_ALMA_redfig2)', 'no spectrum-filter pass at 1.3 mm (the highest is 82–106 GHz) — needs a new pass; also a limb-darkened disc was subtracted'),
    NOT72('NRAO / ALMA', 'ALMA 3 mm (Band 3, 90–105 GHz) disc', 'published only as a panel of the paper\'s Fig. 2 (de Pater et al. 2019), not as a fetchable image'),
    NOT72('NRAO', 'VLA 2–3 cm maps (2013–2016, de Pater et al.)', 'released as cylindrical crops and close-ups, not a whole disc or global map')], src: ['dePater19A'] },
  'jupiter|ir': { img: [WIRED72('NOIRLab (Gemini North)', 'Gemini NIRI M′ 4.68 µm lucky-imaging mosaic, 11 Jan 2017 (noirlab2116a)', 'CC BY 4.0', '/api/band-disc?id=gemini-jupiter-m-2017 on F444W and 5 µm, Earth-facing side'),
    NOT72('ESO (CC BY 4.0)', 'VLT VISIR 10.7/8.6 µm images (eso1623b, eso1010a)', 'two-wavelength composites and close-ups, not one whole disc in one band')], src: ['NOIRLabJ'], fix: '#72: the Gemini 4.68 µm disc replaces the 220 K estimate on F444W and 5 µm (Earth-facing side).' },
  'jupiter|visible': { img: [NOT72('NASA/JPL-Caltech/SwRI/MSSS (JunoCam)', 'JunoCam whole-disc frames', 'Jupiter\'s visible passes already show a measured global map; JunoCam\'s whole-disc frames are from Juno\'s polar, high-phase vantage, not Earth\'s, so they would be misplaced on the Earth-facing hemisphere')] },
  'io|ir': { img: [WIRED72('NOIRLab (Gemini North)', 'Gemini NIRI/Altair L′ 3.78 µm image, 29 Aug 2013 (gemini1405a): 201308C, Loki, Rarog/Heno', 'CC BY 4.0', '/api/band-disc?id=gemini-io-l-2013 on W1, Earth-facing side'),
    NOT72('ESO (CC BY 4.0)', 'VLT NACO Brγ 2.17 µm and Brγ + L′ images, 5 Dec 2001 (eso0204b/c)', 'Brγ alone is reflected light (no hot spots); the L′ composite has a latitude–longitude grid and labels drawn in'),
    NOT72('W. M. Keck Observatory', 'Keck AO Io images (de Kleer & de Pater)', 'no open licence on the published images'),
    NOT72('NASA/JPL-Caltech/SwRI/ASI/INAF (Juno JIRAM)', 'JIRAM 4.8 µm Io images', 'taken from Juno, far from Earth\'s direction (high sub-spacecraft latitudes); a disc image is drawn as seen from Earth')], src: ['NOIRLabIo', 'deKleer14'], fix: '#72: the Gemini L′ disc image is the real look on W1 (Earth-facing side; the far side keeps the hot-spot sketch).' },
};
for (const [k, v] of Object.entries(K72)) K28[k] = K28[k] ? { ...K28[k], img: [...K28[k].img, ...v.img], src: [...(K28[k].src ?? []), ...(v.src ?? [])], fix: [K28[k].fix, v.fix].filter(Boolean).join(' ') || undefined } : v;
for (const [k, v] of Object.entries(K28)) {
  const o = K[k] ?? {};
  K[k] = { ...o, ...(v.obs && !K[k] ? { obs: v.obs, what: v.what, mech: v.mech } : {}), img: [...(v.replace ? [] : o.img ?? []), ...v.img],
    src: [...(o.src ?? []), ...(v.src ?? [])], fix: [o.fix, v.fix].filter(Boolean).join(' ') || null };
}

// class defaults where nothing body-specific was found in this audit
const CLASS = {
  planet: { obs: 'none', what: 'No specific observation found in this audit.' },
  icy: { radio: { obs: 'none', what: 'No radio observation found in this audit; icy surfaces are radar-bright and microwave-cold (cf. Europa, Ganymede, Iapetus).' }, microwave: { obs: 'none', what: 'No measurement found in this audit (Cassini radiometry exists for several Saturnian moons; not individually checked).' }, ir: { obs: 'disc', what: 'Reflected (water-ice bands) and thermal; spacecraft spectra (VIMS, CIRS, NIMS) for most.' }, visible: { obs: 'map', what: 'Spacecraft mosaics (Voyager, Galileo, Cassini, New Horizons).' }, uv: { obs: 'none', what: 'No specific UV observation found in this audit.' }, xray: { obs: 'none', what: 'Not detected.' }, gamma: { obs: 'none', what: 'Not detected; cosmic-ray glow predicted.' } },
  rock: { radio: { obs: 'none', what: 'None found in this audit (large asteroids have VLA/ALMA thermal fluxes; near-Earth asteroids have Arecibo/Goldstone radar images, which are echoes, not emission).' }, microwave: { obs: 'none', what: 'ALMA/VLA thermal fluxes exist for the largest asteroids (calibrators); not individually checked.' }, ir: { obs: 'disc', what: 'Thermal IR (IRAS, WISE/NEOWISE, Spitzer, AKARI) gives diameters and albedos for most catalogued asteroids; reflected near-IR spectra for many.' }, visible: { obs: 'disc', what: 'Light curves and spectra; resolved images only where a spacecraft flew past.' }, uv: { obs: 'none', what: 'No specific UV observation found in this audit.' }, xray: { obs: 'none', what: 'Not detected from Earth.' }, gamma: { obs: 'none', what: 'Not detected; cosmic-ray glow predicted.' } },
  comet: { radio: { obs: 'detected', what: 'OH 18 cm lines and molecular lines from the coma (not the nucleus).' }, microwave: { obs: 'detected', what: 'Coma molecular lines; nucleus thermal at mm (67P: MIRO).' }, ir: { obs: 'image', what: 'Dust coma and nucleus thermal (Spitzer, WISE; spacecraft).' }, visible: { obs: 'image', what: 'Nucleus imaged by spacecraft (Giotto, Vega for Halley; Rosetta for 67P).' }, uv: { obs: 'detected', what: 'Hydrogen Lyman-α coma (SOHO SWAN for many comets).', src: ['Combi00'] }, xray: { obs: 'none', what: 'Comets glow in charge-exchange X-rays (class discovered in Hyakutake); not observed for this comet.', src: ['Lisse96'] }, gamma: { obs: 'none', what: 'Not detected.' } },
};
const ICY_IDS = new Set(['europa', 'ganymede', 'callisto', 'enceladus', 'tethys', 'dione', 'rhea', 'iapetus', 'mimas', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'pluto', 'charon', 'eris', 'haumea', 'makemake', 'hyperion', 'phoebe', 'proteus', 'nereid', 'gonggong', 'quaoar', 'orcus', 'sedna', 'arrokoth', 'chariklo', 'chiron', 'ceres']);
const classOf = (b) => (b.id === 'rings' ? 'ring' : b.kind === 'star' ? 'sun' : b.comet || b.kind === 'comet' ? 'comet' : ICY_IDS.has(b.id) ? 'icy' : ['planet'].includes(b.kind) ? 'planet' : 'rock');
const HIPS_VIS = { europa: 'CDS/P/Europa/Voyager-GalileoSSI-500m', ganymede: 'CDS/P/Ganymede/VoyagerGalileo-SSI-1km', callisto: 'CDS/P/Callisto/Voyager-Galileo-simp-1km', io: 'CDS/P/Io/Galileo-SSI-1km', enceladus: 'CDS/P/Enceladus/Cassini-110m', mimas: 'CDS/P/Mimas/Cassini-PIA17214', tethys: 'CDS/P/Tethys/Cassini-PIA18439', dione: 'CDS/P/Dione/Cassini-PIA12577', rhea: 'CDS/P/Rhea/Cassini-PIA12803', iapetus: 'CDS/P/Iapetus/Cassini-PIA18436', triton: 'CDS/P/Triton/Voyager2-600m', charon: 'CDS/P/Charon/NewHorizon-PIA19866', miranda: 'CDS/P/Miranda/Voyager', ariel: 'CDS/P/Ariel/Voyager', umbriel: 'CDS/P/Umbriel/Voyager', titania: 'CDS/P/Titania/Voyager', oberon: 'CDS/P/Oberon/Voyager', ceres: 'IAPS/P/Ceres/Dawn/FC-CE-LAMO-CLR', jupiter: 'CDS/P/Jupiter/PIA07782' };

// ---- rows ---------------------------------------------------------------------------------------
const bodies = [{ ...SUN }, ...PLANETS, ...MOONS.map((m) => ({ ...m, kind: m.kind ?? 'moon' })), ...SMALL_BODIES, { id: 'rings', name: "Saturn's rings", kind: 'rings' }];
const current = { bandLook, ringBandLook };
const looks = (mod, b, band) => band.passes.map((p) => {
  if (b.id === 'rings') { const r = mod.ringBandLook ? mod.ringBandLook({ id: 'saturn' }, band, p) : { visible: ['visible', 'ir'].includes(band.id), label: ['visible', 'ir'].includes(band.id) ? 'SHOWN (VISIBLE/IR ONLY)' : 'HIDDEN' }; return { pass: p.id, mode: r.visible ? 'ring' : 'hidden', tier: r.tier ?? 'computed', label: r.label }; }
  if (b.kind === 'star') {
    if (mod !== current) return { pass: p.id, mode: 'star', tier: '—', label: 'Sun: see SystemView applyStarBand (BODY_BAND.sun, SUN_SIGNATURES, blackbody)' };
    const l = sunBandLook(band, p);
    return { pass: p.id, mode: l?.feed ? 'real' : 'star', tier: l?.tier ?? '—', label: l?.label ?? 'FULL', ...(l?.feed ? { map: l.feed } : {}) };
  }
  const l = mod.bandLook(b, band, p);
  return { pass: p.id, mode: l.mode, tier: l.tier, label: l.label, ...(l.source ? { map: l.source.hips ?? l.source.gibs ?? l.source.feed ?? (l.source.archive && `archive:${l.source.archive.id}`) ?? (l.source.disc && `disc:${l.source.disc.id}`) } : {}), ...(l.belts ? { belts: +l.belts.toFixed(2) } : {}) };
});
// looks with the same mode, tier, label and map are listed once with their passes
const grouped = (ls) => {
  const m = new Map();
  for (const { pass, ...rest } of ls) { const k = JSON.stringify(rest); if (!m.has(k)) m.set(k, { passes: [], ...rest }); m.get(k).passes.push(pass); }
  return [...m.values()];
};
const ungroup = (gs) => gs.flatMap(({ passes, ...rest }) => passes.map((pass) => ({ pass, ...rest })));
const groupKey = (l) =>`${l.mode}|${l.map ?? ''}|${l.label.replace(/[0-9.×]+/g, '#')}`;
const rows = [];
for (const b of bodies) for (const band of BANDS.filter((x) => x.id !== 'full')) {
  const cls = classOf(b), k = K[`${b.id}|${band.id}`] ?? (b.id === 'sun' ? null : CLASS[cls]?.[band.id]) ?? { obs: 'none', what: 'No observation found in this audit.' };
  const after = looks(current, b, band);
  const prevRow = prev?.rows?.filter((r) => r.body === b.id && r.band === band.id) ?? [];
  const bef = before ? looks(before, b, band) : null;
  const groups = new Map();
  for (const l of after) { const g = groupKey(l); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(l); }
  for (const ls of groups.values()) {
    const passes = ls.map((l) => l.pass);
    const img = [...(k.img ?? []), ...(band.id === 'visible' && HIPS_VIS[b.id] ? [HIPS(HIPS_VIS[b.id], 'visible mosaic (the body\'s base map)', '—')] : [])];
    const srcKeys = [...new Set(k.src ?? [])];
    const beforeLooks = bef ? bef.filter((l) => passes.includes(l.pass)) : ungroup(prevRow.flatMap((r) => r.app?.before ?? [])).filter((l) => passes.includes(l.pass));
    const now = new Map(ls.map((l) => [l.pass, l]));
    const changed = beforeLooks.length ? beforeLooks.some((l) => l.mode !== now.get(l.pass)?.mode || l.label !== now.get(l.pass)?.label) : null;
    rows.push({
      body: b.id, name: b.name, class: cls, band: band.id, passes: passes.length === band.passes.length ? 'all' : passes,
      observed: { status: k.obs, what: k.what },
      imagery: img.length ? img : [{ archive: '—', what: 'No band imagery found in this audit for this body.' }],
      mechanism: k.mech ?? null,
      app: { before: grouped(beforeLooks), after: grouped(ls) },
      verdict: changed === null ? 'unchanged' : changed ? 'corrected' : 'unchanged',
      fix: k.fix ?? null,
      sources: srcKeys, // keys into the top-level `sources`
      ...(k.unverified ? { unverified: k.unverified } : {}),
    });
  }
}
const cited = rows.filter((r) => r.sources.length);
const out = {
  schema: 'fidelity.band-audit/1', issue: 61, generated: new Date().toISOString().slice(0, 10), generator: 'scripts/band-audit.js',
  method: 'Each Sol body we draw × each spectrum-filter band; a row per group of bandpasses that share one verdict. observed.status: map | image | disc (disc-integrated) | detected | upper-limit | none. app.before is the pre-#61 look, app.after the look now. sources[].verified = the reference was checked against Crossref, arXiv or the publisher during the audit; class-level rows describe what exists for the class, not for the body.',
  summary: { bodies: bodies.length, bands: BANDS.length - 1, rows: rows.length, rowsWithSources: cited.length, corrected: rows.filter((r) => r.verdict === 'corrected').length, sources: Object.keys(SRC).length, verifiedSources: Object.values(SRC).filter((s) => s.verified).length },
  sources: SRC,
  rows,
};
// one row per line, so diffs stay readable
const head = JSON.stringify({ ...out, rows: [] }, null, 1).replace(/,\s*"rows": \[\]\s*\}$/, '');
await fs.writeFile(new URL('../docs/research/band-audit.json', import.meta.url), `${head},\n "rows": [\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n ]\n}\n`);
console.log(out.summary);
