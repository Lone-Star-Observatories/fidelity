// Individual researched hypotheses; actual maps retain priority.
export const BODY_VISUALS = {
  "ceres": {
    "id": "ceres",
    "name": "Ceres",
    "aliases": [
      "Ceres"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Existing Dawn FC global mosaic remains the globe texture; no generated replacement.",
    "measured": [
      "Dawn mapped a dark cratered surface with hydrated/ammoniated minerals and bright sodium-carbonate salt deposits.",
      "Only a tenuous exosphere; no substantial visible sky scattering is expected."
    ],
    "assumed": [
      "A hypothetical metre-scale locality near an Occator salt deposit; exact geometry and fragment placement are invented.",
      "Representative heliocentric distance 2.77 AU, not a dated landing scene. Camera field of view nominally 60°, with artistic raster star size."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/dwarf-planets/ceres/facts/",
        "title": "NASA Ceres facts"
      },
      {
        "url": "https://www.nasa.gov/centers-and-facilities/jpl/mystery-solved-bright-areas-on-ceres-come-from-salty-water-below/",
        "title": "Dawn salts and brine analysis",
        "publicationDate": "2020-08-10"
      },
      {
        "url": "https://science.nasa.gov/photojournal/hints-at-ceres-composition-from-color/",
        "title": "Enhanced versus natural visible colour",
        "observationDate": "2015-08–2015-09"
      }
    ],
    "contextImages": [
      {
        "url": "/references/ceres-dawn-occator-pia24021.jpg",
        "credit": "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA",
        "source": "https://www.nasa.gov/wp-content/uploads/2020/08/pia24021-1041.jpg",
        "tier": "modelled",
        "description": "Dawn-image/topography perspective rendering, colour enhanced. Pink is not natural surface colour.",
        "publicationDate": "2020-08-10",
        "terms": "NASA image usage guidelines; source credits retained."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 2.77,
      "angularDiameterDeg": 0.19238431190429459,
      "centreDiscWidthFraction": 0.0029078905872365135,
      "irradianceEarth": 0.13032881961188078,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/ceres-surface.jpg",
      "previewUrl": "/bespoke/ceres-surface-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "sourceFile": "exec-4701d841-14d4-43c2-adbf-d9f4f8d9488c.png",
      "sourceSha256": "aaa599c905ac99d1ee6b5983632d744f911fac56dd60fd8ccae65b136afafc0f",
      "sha256": "a14292c5b8477b96ec266891b40a2d92c4b1e2cd10ce06f6337159b1b0283602",
      "previewSha256": "112abd083078aae9a4a93650978a6058be9ecf2896c6072aa3ac991df30f4b9a",
      "bytes": 526277,
      "previewBytes": 91586,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG; original generated PNG retained. Artistic light/material appearance is not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/ceres-sky.jpg",
      "previewUrl": "/bespoke/ceres-sky-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "sourceFile": "exec-d88cc01d-57da-45b7-bc70-f430654ba1e8.png",
      "sourceSha256": "2915937cc4ef40b65288a793fc36003e79380e716231404f5ab881808ce73370",
      "sha256": "05944176a81114fe1e5bf32994a0623747b35e4a00b1d621756a43eb30cb6de2",
      "previewSha256": "66e137fa629162f3651f4dd2d91e0d59fc1cf31ac2a4efcf0220484e85e44765",
      "bytes": 329680,
      "previewBytes": 62852,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG; original generated PNG retained. Artistic light/material appearance is not radiometrically calibrated."
    }
  },
  "barnard-b": {
    "id": "barnard-b",
    "name": "Barnard b",
    "aliases": [
      "Barnard b",
      "Barnard's Star b",
      "Barnards Star b"
    ],
    "researchDate": "2026-10-10",
    "measured": [
      "Radial-velocity planet; P=3.154 d, minimum mass 0.299±0.026 Earth masses, orbital semimajor axis 0.0229±0.0003 AU.",
      "Host effective temperature 3195±28 K, radius 0.185±0.006 solar radii."
    ],
    "modelled": [
      "Equilibrium temperature 438 K assumes zero albedo and full heat redistribution; it is not a measured surface temperature."
    ],
    "unknown": [
      "True mass/inclination, measured planetary radius, atmosphere, surface chemistry, geology, albedo and spin."
    ],
    "assumed": [
      "Dry airless silicate/iron rocky surface, charcoal basaltic regolith and subdued grey/taupe minerals. This is one scenario, not an inferred composition measurement.",
      "Nominal 60° rectilinear view; star elevation and observer location chosen artistically. Star raster diameter and colour are approximate; no calibrated spectral rendering or observer white balance."
    ],
    "identityNote": "This is the short-period 2024 discovery confirmed in 2025. The cold 233-day 2018 candidate is superseded and must not supply visual constraints.",
    "references": [
      {
        "url": "https://arxiv.org/abs/2503.08095",
        "title": "Basant et al. 2025, MAROON-X/ESPRESSO confirmation",
        "observationDate": "2021–2023",
        "publicationDate": "2025-03-11"
      },
      {
        "url": "https://www.aanda.org/articles/aa/pdf/2025/01/aa52450-24.pdf",
        "title": "Stefanov et al. 2025, no detected TESS transits and stellar properties"
      },
      {
        "url": "https://www.eso.org/public/news/eso2414/",
        "title": "ESO 2024 discovery and superseded candidate context"
      }
    ],
    "contextImages": [
      {
        "url": "/references/barnard-b-eso2414a.jpg",
        "credit": "ESO/M. Kornmesser",
        "source": "https://cdn.eso.org/images/screen/eso2414a.jpg",
        "sourcePage": "https://www.eso.org/public/images/eso2414a/",
        "tier": "imagined",
        "description": "Existing 2024 artist interpretation, not measured terrain or colours.",
        "publicationDate": "2024-10-01",
        "terms": "ESO image usage policy; credit retained."
      }
    ],
    "skyModel": {
      "star": "Barnard's Star",
      "radiusSun": 0.185,
      "temperatureK": 3195,
      "distanceAU": 0.0229,
      "angularDiameterDeg": 4.306135411086009,
      "centreDiscWidthFraction": 0.06511786811951176,
      "irradianceEarth": 6.127039108546707,
      "approximateSrgb": [
        1,
        0.7194683096347383,
        0.48158519102838504
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "barnardBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; artistic east-positive longitude. No measured body frame or terrain registration.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/barnard-b-surface-map.jpg",
      "previewUrl": "/bespoke/barnard-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "sourceFile": "exec-7ac88b63-86e2-46bb-bfd4-1b79625a05a9.png",
      "sourceSha256": "55b2637ed9d36050a465db9fda16877b72b86cdad965a4d4a1a6f650053847a5",
      "sha256": "5c378fc6871ff700333ee1c053b89c936fd383599148432a0c79537854a451ea",
      "previewSha256": "bb53b41a609fc08431dfaf206524860ab3299e228bf7cf41b3d902a5b734bd0c",
      "bytes": 529559,
      "previewBytes": 34877,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG; original generated PNG retained. Artistic light/material appearance is not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/barnard-b-sky.jpg",
      "previewUrl": "/bespoke/barnard-b-sky-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "sourceFile": "exec-d8a341eb-fac1-4845-89fa-3df4a64ed9b5.png",
      "sourceSha256": "29569f337cbea9959baf19bcae03476e0eb7b751a568743e5f24d7e396eb5985",
      "sha256": "8b0834f3ea54b11d71f60a94fa9bef7d508614ce158c77c5c2c4279144c39fde",
      "previewSha256": "64dbbf417df13a8d46c5107fe38f2ef0225d7f3b890dba7648f57e36f1d1f385",
      "bytes": 316590,
      "previewBytes": 54762,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG; original generated PNG retained. Artistic light/material appearance is not radiometrically calibrated."
    }
  },
  "eris": {
    "id": "eris",
    "name": "Eris",
    "aliases": [
      "Eris"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Existing telescope detections and spectra do not resolve geography; replace the catalogue analog with a bespoke hypothetical map.",
    "measured": [
      "JWST NIRSpec spectra show methane-rich surface ice and nitrogen-ice absorption; visible observations indicate a bright, approximately neutral-colour surface.",
      "November 2010 stellar occultation constrains diameter to about 2326 km and high visible geometric albedo."
    ],
    "modelled": [
      "Interior thermal processing and surface refresh are proposed explanations for isotope chemistry, not resolved eruption observations."
    ],
    "unknown": [
      "No resolved global terrain map; geography, metre-scale relief, grain structure and precise visible colours are unknown.",
      "True material reflectance and observer exposure/white balance are not calibrated.",
      "Atmospheric variability, exact local terrain and sky appearance at a specified epoch."
    ],
    "assumed": [
      "Cold distant-epoch scenario with no optically appreciable atmosphere; pale methane/nitrogen frost covers a low-contrast hypothetical terrain.",
      "Every crater, ridge and spatial albedo pattern is imagined; illustrative east-positive longitude is not registered to measured terrain.",
      "Representative semimajor-axis illumination, not a dated landing. Hypothetical 60° camera field; subpixel Sun rendered with restrained glare, not an enlarged stellar disc.",
      "Observer longitude and latitude are unspecified; moons and rings are omitted from the selected sky direction rather than given invented positions."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2309.05085",
        "title": "Grundy et al., JWST methane isotopes and nitrogen ice",
        "publicationDate": "2023-09-10"
      },
      {
        "url": "https://www.eso.org/public/news/eso1142/",
        "title": "ESO occultation size and reflective surface",
        "publicationDate": "2011-10-26",
        "observationDate": "2010-11"
      },
      {
        "url": "https://arxiv.org/abs/2309.05549",
        "title": "Glein et al., competing methane-origin hypotheses",
        "publicationDate": "2023-09-11"
      },
      {
        "url": "https://science.gsfc.nasa.gov/690/KuiperBelt.html",
        "title": "Eris Hubble observation and credits",
        "observationDate": "2006-08-30"
      }
    ],
    "contextImages": [
      {
        "url": "/references/eris-hubble.jpg",
        "source": "https://science.gsfc.nasa.gov/690/images/hs-2007-24-c-web.jpg",
        "sourcePage": "https://science.gsfc.nasa.gov/690/KuiperBelt.html",
        "credit": "NASA/ESA/M. Brown",
        "tier": "measured",
        "observationDate": "2006-08-30",
        "retrieved": "2026-10-10",
        "sha256": "2c00af3b10360f85168d7e299deef170b232ea07074980601205290c5a009c5d",
        "bytes": 15011,
        "description": "Processed Hubble telescope detection of the dwarf planet and companion(s); point-source glare does not resolve terrain or establish natural surface colour.",
        "terms": "NASA image usage guidelines; NASA/ESA and individual source credits retained.",
        "processing": "HTTP gzip transfer decoded; source JPEG otherwise retained."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 67.93394687853566,
      "angularDiameterDeg": 0.007844447710403558,
      "centreDiscWidthFraction": 0.00011856878576769961,
      "irradianceEarth": 0.00021668373123117615,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "erisBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude. No measured terrain registration.",
      "coverage": "Entire globe imagined; spectral constraints are disk integrated.",
      "url": "/bespoke/eris-surface-map.jpg",
      "previewUrl": "/bespoke/eris-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-b6bf14b1-39ea-46b3-9e31-edfc46b91539.png",
      "sourceSha256": "89bca36cef634ed2fd19b94bd23c6e6fcc39b61d447c98600ef58d8577ac6acf",
      "sha256": "bcd4c32cc9eb330b31a6b27297a49fe2dd7a066c4b06edd493a5588851a93ecb",
      "previewSha256": "aafdc734cee20106499dcd5313eda2fef34d53a7ad5205811d76905913c6a1f1",
      "bytes": 358424,
      "previewBytes": 19970,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual research-guided albedo texture and observer image; composition and palette as stated in assumptions, no invented atmosphere clouds, 60 degree hypothetical view, unresolved white solar point and exposure-adapted foreground; geometry and spectral photometry not calibrated.",
    "skyImage": {
      "url": "/bespoke/eris-sky-image.jpg",
      "previewUrl": "/bespoke/eris-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-e3d994ec-44b4-40d1-a74f-6178a084fb7e.png",
      "sourceSha256": "594f4484eb90994614b9a39fbb0c8b9e5f4b21b5cf9a1d904e5bc9c88f9f3c2a",
      "sha256": "7882d0e450b54e5c45ecc81d82166464b6ae6c671c16c3fb2827497038775abf",
      "previewSha256": "defc68aacb5ccc2603ce5c71478f2e6ab1931a96ebf1867e5bce609d5b3fbf14",
      "bytes": 212504,
      "previewBytes": 36864,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "haumea": {
    "id": "haumea",
    "name": "Haumea",
    "aliases": [
      "Haumea"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Existing telescope detections and spectra do not resolve geography; replace the catalogue analog with a bespoke hypothetical map.",
    "measured": [
      "Near-infrared spectroscopy identifies crystalline water ice; rotational photometry indicates a relatively dark reddish region.",
      "2017 occultation constrains an elongated body and an equatorial ring; rotation period is about 3.9 hours."
    ],
    "modelled": [
      "Dark-region chemistry and geographic outline are not uniquely inferred from unresolved rotational photometry."
    ],
    "unknown": [
      "No resolved global terrain map; geography, metre-scale relief, grain structure and precise visible colours are unknown.",
      "True material reflectance and observer exposure/white balance are not calibrated.",
      "Atmospheric variability, exact local terrain and sky appearance at a specified epoch."
    ],
    "assumed": [
      "Water-ice-dominated ivory/neutral-grey surface, one subdued reddish-brown region with arbitrary map position and boundary.",
      "Negligible visible atmospheric scattering is a chosen scenario; Haumea atmosphere properties are poorly known. Surface-view horizon is a local hypothetical locality, not a calibrated ellipsoid landing site.",
      "Every crater, ridge and spatial albedo pattern is imagined; illustrative east-positive longitude is not registered to measured terrain.",
      "Representative semimajor-axis illumination, not a dated landing. Hypothetical 60° camera field; subpixel Sun rendered with restrained glare, not an enlarged stellar disc.",
      "Observer longitude and latitude are unspecified; moons and rings are omitted from the selected sky direction rather than given invented positions."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/1605.04145",
        "title": "Dumas et al., Haumea crystalline ice spectroscopy",
        "publicationDate": "2016-05-13"
      },
      {
        "url": "https://arxiv.org/abs/0911.0009",
        "title": "Lacerda, rotational dark red spot constraints",
        "publicationDate": "2009-10-30"
      },
      {
        "url": "https://arxiv.org/abs/2006.03113",
        "title": "Ortiz et al., 2017 occultation size, shape and ring",
        "observationDate": "2017-01-21"
      },
      {
        "url": "https://science.nasa.gov/dwarf-planets/haumea/",
        "title": "NASA Haumea facts and atmospheric limits"
      },
      {
        "url": "https://science.nasa.gov/image-detail/haumea-30jun2015-22-28ok2-final-16x9/",
        "title": "Haumea Hubble observation and credits",
        "observationDate": "2015-06-30"
      }
    ],
    "contextImages": [
      {
        "url": "/references/haumea-hubble.jpg",
        "source": "https://science.nasa.gov/wp-content/uploads/2024/03/haumea-30jun2015-22-28ok2-final-16x9-1.jpg",
        "sourcePage": "https://science.nasa.gov/image-detail/haumea-30jun2015-22-28ok2-final-16x9/",
        "credit": "NASA, ESA, D. Ragozzine (Brigham Young University); processing Gladys Kober (NASA/Catholic University of America)",
        "tier": "measured",
        "observationDate": "2015-06-30",
        "retrieved": "2026-10-10",
        "sha256": "a00aa2da6fea9576721907b21395457fff9a2967dd54cb99129cb43d8a736cbc",
        "bytes": 1829,
        "description": "Processed Hubble telescope detection of the dwarf planet and companion(s); point-source glare does not resolve terrain or establish natural surface colour.",
        "terms": "NASA image usage guidelines; NASA/ESA and individual source credits retained."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 43.06029023650952,
      "angularDiameterDeg": 0.012375771081494107,
      "centreDiscWidthFraction": 0.00018705971505662632,
      "irradianceEarth": 0.0005393194643524682,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "haumeaBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude. No measured terrain registration.",
      "coverage": "Entire globe imagined; spectral constraints are disk integrated.",
      "url": "/bespoke/haumea-surface-map.jpg",
      "previewUrl": "/bespoke/haumea-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4950c8f2-40f9-4e20-9641-a86626aa0518.png",
      "sourceSha256": "bacdffd58befd6c251b5eb43722c92f823748ae2ac794be01dbfe2614f7fb7a8",
      "sha256": "1c1482a106a086ef579af532ffabaddc2b0db15fa9d1fc7dce342da03ae6522e",
      "previewSha256": "84a649acfee301892433c3adb4c9f0f602a69ffd00d8fff2e9cc625d60f42f12",
      "bytes": 473943,
      "previewBytes": 28790,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual research-guided albedo texture and observer image; composition and palette as stated in assumptions, no invented atmosphere clouds, 60 degree hypothetical view, unresolved white solar point and exposure-adapted foreground; geometry and spectral photometry not calibrated.",
    "skyImage": {
      "url": "/bespoke/haumea-sky-image.jpg",
      "previewUrl": "/bespoke/haumea-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-ec98bec3-b0cb-46dc-8cef-6013ee5fded5.png",
      "sourceSha256": "604c550cef5d8a6c4ed5fe6edaaf50996e54951202938138bdc578600b8c0028",
      "sha256": "9fc3cc8555fca716de9985632a88d3b236211624ddb61f33e0aa6adbd5d4e2b6",
      "previewSha256": "2282698a2451658c97ae2358c6037f778648a4ea3e55023e395a24fc25b0a271",
      "bytes": 285051,
      "previewBytes": 52985,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "makemake": {
    "id": "makemake",
    "name": "Makemake",
    "aliases": [
      "Makemake"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Existing telescope detections and spectra do not resolve geography; replace the catalogue analog with a bespoke hypothetical map.",
    "measured": [
      "Methane-rich surface with a red visible spectral slope; JWST spectra support additional hydrocarbon ices.",
      "2023 January 29–30 NIRSpec observations analysed in 2025 detect methane fluorescence and volatile release.",
      "2011 occultation rules out a dense global Pluto-like atmosphere at that epoch, not all gas."
    ],
    "modelled": [
      "2025 gas interpretations include a tenuous bound atmosphere or expanding coma/plume; neither fully reproduces the data.",
      "2024 mid-infrared excess may come from a small active region or dust ring; its origin and surface location remain unresolved."
    ],
    "unknown": [
      "No resolved global terrain map; geography, metre-scale relief, grain structure and precise visible colours are unknown.",
      "True material reflectance and observer exposure/white balance are not calibrated.",
      "Atmospheric variability, exact local terrain and sky appearance at a specified epoch."
    ],
    "assumed": [
      "Pale cream methane frost with muted ochre/peach-brown irradiation colouring and a few low-contrast darker patches. Colour saturation and spatial distribution are chosen.",
      "A tenuous gas scenario with negligible visible sky scattering; no blue haze, thick clouds or visible plume. No unlocated hot spot, glowing lava or speculative ring is drawn.",
      "Every crater, ridge and spatial albedo pattern is imagined; illustrative east-positive longitude is not registered to measured terrain.",
      "Representative semimajor-axis illumination, not a dated landing. Hypothetical 60° camera field; subpixel Sun rendered with restrained glare, not an enlarged stellar disc.",
      "Observer longitude and latitude are unspecified; moons and rings are omitted from the selected sky direction rather than given invented positions."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2509.06772",
        "title": "Protopapa et al., methane gas and hydrocarbon surface",
        "publicationDate": "2025-09-08",
        "observationDate": "2023-01-29–2023-01-30"
      },
      {
        "url": "https://arxiv.org/abs/2410.22544",
        "title": "Kiss et al., mid-infrared excess and alternative explanations",
        "publicationDate": "2024-10-29"
      },
      {
        "url": "https://www.eso.org/public/news/eso1246/",
        "title": "ESO occultation atmospheric constraints",
        "publicationDate": "2012-11-21",
        "observationDate": "2011-04-23"
      },
      {
        "url": "https://arxiv.org/abs/2309.05085",
        "title": "Grundy et al., methane-rich ice and isotope chemistry",
        "publicationDate": "2023-09-10"
      },
      {
        "url": "https://science.nasa.gov/missions/hubble/hubble-discovers-moon-orbiting-the-dwarf-planet-makemake/",
        "title": "Makemake Hubble observation and credits",
        "observationDate": "2015-04"
      }
    ],
    "contextImages": [
      {
        "url": "/references/makemake-hubble.jpg",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/hubble/releases/2016/04/STScI-01EVVGW2FJQAPP4CWDZMTAQMBJ.tif?w=640&f=jpg",
        "sourcePage": "https://science.nasa.gov/missions/hubble/hubble-discovers-moon-orbiting-the-dwarf-planet-makemake/",
        "credit": "NASA, ESA, A. Parker and M. Buie (SwRI)",
        "tier": "measured",
        "observationDate": "2015-04",
        "retrieved": "2026-10-10",
        "sha256": "4edf69e2c930e3381233a758bf5a547f8ecef2214d8aa9430c91dd5c5a1fe014",
        "bytes": 14401,
        "description": "Processed Hubble telescope detection of the dwarf planet and companion(s); point-source glare does not resolve terrain or establish natural surface colour.",
        "terms": "NASA image usage guidelines; NASA/ESA and individual source credits retained."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 45.57093317300052,
      "angularDiameterDeg": 0.011693951768239534,
      "centreDiscWidthFraction": 0.0001767540196353924,
      "irradianceEarth": 0.00048153089451693864,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "makemakeBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude. No measured terrain registration.",
      "coverage": "Entire globe imagined; spectral constraints are disk integrated.",
      "url": "/bespoke/makemake-surface-map.jpg",
      "previewUrl": "/bespoke/makemake-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-49da4465-5d68-4166-af63-8a5f4da0fd31.png",
      "sourceSha256": "f6148b4e0511242c1ca3b633e493dcfef0df70fe722825e7a735b0b3fd5b494a",
      "sha256": "a6f18d3ab42b39354c80b0add6a644beaa6e06cdfedf45e07116ca333434d045",
      "previewSha256": "f515335aea24d887ccfdfc3e890fc7a5e9032f84b63074d17c6ad9b703ff13c0",
      "bytes": 448726,
      "previewBytes": 25247,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual research-guided albedo texture and observer image; composition and palette as stated in assumptions, no invented atmosphere clouds, 60 degree hypothetical view, unresolved white solar point and exposure-adapted foreground; geometry and spectral photometry not calibrated.",
    "skyImage": {
      "url": "/bespoke/makemake-sky-image.jpg",
      "previewUrl": "/bespoke/makemake-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-9490dcf1-7e4f-4faa-a849-28f6dcdea037.png",
      "sourceSha256": "581d97e0fc3a0dd44572cb66cd2b77b35eaa7f3f5f21168558741a725608e746",
      "sha256": "aa7f24784ebdaccec4d8e71b7c282976abe3d411f5729da2b5fa336bc840bdf2",
      "previewSha256": "208d361ba9d9bea451bade39540706b435b9e1a7fee5a99cbce901d879d907c6",
      "bytes": 223352,
      "previewBytes": 41601,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  }
};
const normalize = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function bodyVisualFor(body) {
  if (!body) return null;
  return Object.values(BODY_VISUALS).find(v => v.aliases.some(name => normalize(name) === normalize(body.name))) ?? null;
}
export const BESPOKE_TEXTURES = Object.fromEntries(Object.values(BODY_VISUALS).filter(v => v.surfaceMap).map(v => [v.surfaceMap.key, v.surfaceMap]));
