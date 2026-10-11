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
  },
  "proxima-b": {
    "id": "proxima-b",
    "name": "Proxima Cen b",
    "aliases": [
      "Proxima Cen b",
      "Proxima Centauri b",
      "Proxima b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No resolved planetary surface image or measured terrain; 2025 source artwork is artistic context only.",
    "measured": [
      "Radial-velocity planet: period 11.18465 days, minimum mass 1.055±0.055 Earth masses; 2025 multi-instrument confirmation.",
      "Proxima is an active M5.5 dwarf; 2025 analysis adopts effective temperature 2900±100 K and radius 0.141±0.021 solar radii."
    ],
    "modelled": [
      "RV-derived semimajor axis 0.04848 AU; equilibrium temperature 218 K assumes Bond albedo 0.3 and redistribution, not measured surface temperature.",
      "Stellar/planet coplanarity, spin locking, atmospheric survival and climates are hypotheses. No measured radius is available; catalogue radii may be mass-radius estimates.",
      "The illustrated disc size uses adopted radius and semimajor axis. Blackbody-derived flux from these adopted values differs from the paper luminosity-based incident flux; neither is calibrated image photometry."
    ],
    "unknown": [
      "True planetary mass/inclination, physical radius, atmospheric composition/pressure, water inventory, surface chemistry, geology, spin and cloud cover.",
      "Surface colours, thermal structure and magnetic field are not measured; a nominal habitable-zone orbit does not establish habitability."
    ],
    "assumed": [
      "One water-poor airless silicate/iron rocky scenario: subdued charcoal/grey/taupe terrain, no ocean, life, atmospheric clouds or glowing lava. Composition and every geographic feature are chosen, not observed.",
      "Proxima b terrain differs artistically from the other planet; it does not encode a measured difference in mineralogy or crater age.",
      "60° hypothetical rectilinear view with an artist-chosen observer and stellar elevation. Peach/cream bright photosphere and warm reflected ground light are approximate under exposure and adaptation, not a pure red disc.",
      "No dated flare, spots or companion-star alignment is invented. Alpha Centauri A/B are omitted from the chosen sky direction; their positions are not inferred."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2507.21751",
        "title": "Suárez Mascareño et al. 2025, b/d RV confirmation and adopted stellar properties",
        "publicationDate": "2025-07-29"
      },
      {
        "url": "https://arxiv.org/abs/1608.06827",
        "title": "Turbet et al., atmospheric and climate scenarios, not measured climate",
        "publicationDate": "2016-08-24"
      },
      {
        "url": "https://arxiv.org/abs/2605.22925",
        "title": "Navarro-Piñeiro et al. 2026, stellar activity and possible star/planet interaction",
        "publicationDate": "2026-05-21"
      },
      {
        "url": "https://iac.es/en/outreach/news/iac-leads-first-scientific-results-nirps-new-infrared-exoplanet-hunter",
        "title": "IAC 2025 system artwork and source credits",
        "publicationDate": "2025-07-29"
      }
    ],
    "contextImages": [
      {
        "url": "/references/proxima-iac-2025.jpg",
        "source": "https://iac.es/sites/default/files/styles/crop_rectangle_21x9_to_1280/public/images/news/planetas_b_d_proxima_centauri_02.jpg?h=ff3fe7f1&itok=YX9pjzOp",
        "sourcePage": "https://iac.es/en/outreach/news/iac-leads-first-scientific-results-nirps-new-infrared-exoplanet-hunter",
        "credit": "Gabriel Pérez Díaz (IAC)",
        "tier": "imagined",
        "publicationDate": "2025-07-29",
        "observationDate": null,
        "retrieved": "2026-10-10",
        "sha256": "49aa01bf4d40c54ae9eb9a46a0b15dd05ab32ba8fa0590cb63f5b37ae80eff2b",
        "bytes": 55095,
        "description": "2025 artist interpretation of the Proxima b/d system accompanying NIRPS confirmation; not observed terrain, composition or calibrated stellar colour.",
        "terms": "IAC credited source artwork; project owner supplies reuse basis. Original artist credit retained."
      }
    ],
    "skyModel": {
      "star": "Proxima Centauri",
      "radiusSun": 0.141,
      "temperatureK": 2900,
      "distanceAU": 0.04848,
      "angularDiameterDeg": 1.5499545499458383,
      "centreDiscWidthFraction": 0.023428983606485546,
      "irradianceEarth": 0.5390135773818832,
      "approximateSrgb": [
        1,
        0.6816786297548326,
        0.40318515446390524
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "proximaBBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude with no measured surface frame or geographic registration.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/proxima-b-surface-map.jpg",
      "previewUrl": "/bespoke/proxima-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4c21abd3-509b-4d6d-b726-ac5a7a1d5fa7.png",
      "sourceSha256": "3f53bf1e8924f047b086f88ad0298f4690edbe4fb409cee6c07c4d4271599e98",
      "sha256": "96103e81bc61909b490d528ee2dc912700689064db26b37adfcb04b53a30c897",
      "previewSha256": "2c165a95277cfda66902da42689074c2c955f3b31691cc10ea2a4749226cfffb",
      "bytes": 515295,
      "previewBytes": 31825,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual rocky scenario albedo map under neutral lighting and corresponding airless sky view under a 2900 K M dwarf. No Earth analog continents, clouds or life; stellar disc approximate within 60 degree field.",
    "skyImage": {
      "url": "/bespoke/proxima-b-sky-image.jpg",
      "previewUrl": "/bespoke/proxima-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-0821a565-afb3-42e9-a016-98f5193be73e.png",
      "sourceSha256": "2fc98613e2fc3cbd0e850c27bb8f643c9e3bb0d7cb5e35dc9977d9f4f53e0116",
      "sha256": "4231749a7201146b0904b148080f6de07c995a7fd542257c60ab3fd635042760",
      "previewSha256": "ba8d5cbd68ccd453d8a691b28eea9a8f4fd1d8db872a12b641cc1831ad73dd86",
      "bytes": 261450,
      "previewBytes": 44457,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "proxima-d": {
    "id": "proxima-d",
    "name": "Proxima Cen d",
    "aliases": [
      "Proxima Cen d",
      "Proxima Centauri d",
      "Proxima d"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No resolved planetary surface image or measured terrain; 2025 source artwork is artistic context only.",
    "measured": [
      "Radial-velocity planet: period 5.12338 days, minimum mass 0.26±0.038 Earth masses; 2025 multi-instrument confirmation.",
      "Proxima is an active M5.5 dwarf; 2025 analysis adopts effective temperature 2900±100 K and radius 0.141±0.021 solar radii."
    ],
    "modelled": [
      "RV-derived semimajor axis 0.02881 AU; equilibrium temperature 282 K assumes Bond albedo 0.3 and redistribution, not measured surface temperature.",
      "Stellar/planet coplanarity, spin locking, atmospheric survival and climates are hypotheses. No measured radius is available; catalogue radii may be mass-radius estimates.",
      "The illustrated disc size uses adopted radius and semimajor axis. Blackbody-derived flux from these adopted values differs from the paper luminosity-based incident flux; neither is calibrated image photometry."
    ],
    "unknown": [
      "True planetary mass/inclination, physical radius, atmospheric composition/pressure, water inventory, surface chemistry, geology, spin and cloud cover.",
      "Surface colours, thermal structure and magnetic field are not measured; a nominal habitable-zone orbit does not establish habitability."
    ],
    "assumed": [
      "One water-poor airless silicate/iron rocky scenario: subdued charcoal/grey/taupe terrain, no ocean, life, atmospheric clouds or glowing lava. Composition and every geographic feature are chosen, not observed.",
      "Proxima d terrain differs artistically from the other planet; it does not encode a measured difference in mineralogy or crater age.",
      "60° hypothetical rectilinear view with an artist-chosen observer and stellar elevation. Peach/cream bright photosphere and warm reflected ground light are approximate under exposure and adaptation, not a pure red disc.",
      "No dated flare, spots or companion-star alignment is invented. Alpha Centauri A/B are omitted from the chosen sky direction; their positions are not inferred."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2507.21751",
        "title": "Suárez Mascareño et al. 2025, b/d RV confirmation and adopted stellar properties",
        "publicationDate": "2025-07-29"
      },
      {
        "url": "https://arxiv.org/abs/1608.06827",
        "title": "Turbet et al., atmospheric and climate scenarios, not measured climate",
        "publicationDate": "2016-08-24"
      },
      {
        "url": "https://arxiv.org/abs/2605.22925",
        "title": "Navarro-Piñeiro et al. 2026, stellar activity and possible star/planet interaction",
        "publicationDate": "2026-05-21"
      },
      {
        "url": "https://iac.es/en/outreach/news/iac-leads-first-scientific-results-nirps-new-infrared-exoplanet-hunter",
        "title": "IAC 2025 system artwork and source credits",
        "publicationDate": "2025-07-29"
      }
    ],
    "contextImages": [
      {
        "url": "/references/proxima-iac-2025.jpg",
        "source": "https://iac.es/sites/default/files/styles/crop_rectangle_21x9_to_1280/public/images/news/planetas_b_d_proxima_centauri_02.jpg?h=ff3fe7f1&itok=YX9pjzOp",
        "sourcePage": "https://iac.es/en/outreach/news/iac-leads-first-scientific-results-nirps-new-infrared-exoplanet-hunter",
        "credit": "Gabriel Pérez Díaz (IAC)",
        "tier": "imagined",
        "publicationDate": "2025-07-29",
        "observationDate": null,
        "retrieved": "2026-10-10",
        "sha256": "49aa01bf4d40c54ae9eb9a46a0b15dd05ab32ba8fa0590cb63f5b37ae80eff2b",
        "bytes": 55095,
        "description": "2025 artist interpretation of the Proxima b/d system accompanying NIRPS confirmation; not observed terrain, composition or calibrated stellar colour.",
        "terms": "IAC credited source artwork; project owner supplies reuse basis. Original artist credit retained."
      }
    ],
    "skyModel": {
      "star": "Proxima Centauri",
      "radiusSun": 0.141,
      "temperatureK": 2900,
      "distanceAU": 0.02881,
      "angularDiameterDeg": 2.6083302389815133,
      "centreDiscWidthFraction": 0.03943170793318837,
      "irradianceEarth": 1.526294750983559,
      "approximateSrgb": [
        1,
        0.6816786297548326,
        0.40318515446390524
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "proximaDBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude with no measured surface frame or geographic registration.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/proxima-d-surface-map.jpg",
      "previewUrl": "/bespoke/proxima-d-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-09ec1bb1-ae65-4028-8638-ee2029873988.png",
      "sourceSha256": "e38b300d8dbc41f7943630db31bba38588cd1325508ff3de05aa3987fb2d3fc6",
      "sha256": "96c15494d6880c74d556b37b584939eced183332cb758c1f9f3b90aefee02c30",
      "previewSha256": "eea963418ab3a9db7938a8db589bb3259533c96ab218cdc7f88f2c6fa33f590a",
      "bytes": 567136,
      "previewBytes": 36625,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual rocky scenario albedo map under neutral lighting and corresponding airless sky view under a 2900 K M dwarf. No Earth analog continents, clouds or life; stellar disc approximate within 60 degree field.",
    "skyImage": {
      "url": "/bespoke/proxima-d-sky-image.jpg",
      "previewUrl": "/bespoke/proxima-d-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-299e353a-c309-42f7-85ef-fc1ea6e915bd.png",
      "sourceSha256": "aae6a21bfcda9620772d6a201a49d09ac6a11aec6be0db1fc2e1f14d0424d966",
      "sha256": "a1be423c5cf057d5055eae7df1a27076c4caaaebe7807b20f1fe1cb8676fd26f",
      "previewSha256": "a2730ea5f58aa0bae2c3b3bf531a776b54d695a016dd1dc5aa1d981791cf3fcd",
      "bytes": 274252,
      "previewBytes": 47959,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "barnard-c": {
    "id": "barnard-c",
    "name": "Barnard c",
    "aliases": [
      "Barnard c",
      "Barnard's Star c",
      "GJ 699 c",
      "Gl 699 c"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No resolved surface imagery; detection is radial velocity, not a direct terrain image. Archive radius is a mass-radius estimate, not a transit measurement.",
    "measured": [
      "2025 MAROON-X/ESPRESSO RV solution: period 4.1244 days; minimum mass 0.335±0.03 Earth masses. RV observations span 2021–2023.",
      "Host adopted effective temperature 3195±28 K and stellar radius 0.185±0.006 solar radii from the 2024 stellar analysis."
    ],
    "modelled": [
      "RV-derived semimajor axis 0.0274 AU. Equilibrium temperature 400 K assumes zero albedo and full heat redistribution; not measured surface temperature.",
      "The 2026 stability/composition analysis favours rocky planets under its dynamical assumptions; this does not resolve ground chemistry, atmosphere or geography.",
      "Stellar diameter/blackbody flux use representative semimajor-axis distance, not a dated viewpoint. No measured planet radius or physical surface frame is inferred."
    ],
    "unknown": [
      "True mass and inclination, physical radius, atmosphere and pressure, water inventory, minerals, surface colour, spin and climate.",
      "Every basin, fracture, crater, grain and sky viewpoint is unobserved. Transit non-detection does not establish an airless body."
    ],
    "assumed": [
      "One explicitly hypothetical water-poor airless silicate/iron scenario. No clouds, ocean, life, snow or molten lava is inferred from the equilibrium temperature.",
      "Ash-gray/taupe basin and fractured uplands. This distinct artist palette/geography is not evidence of a compositional difference among planets.",
      "60° hypothetical horizontal field; warm cream/peach stellar colour and reflected lighting are approximate under exposure. Raster disc size is checked separately and is not calibrated photometry.",
      "Neutral albedo texture has artistic relief shading and imperfect seam continuity; neither height nor geographic registration is measured. Observer terrain does not identify a coordinate on the generated globe.",
      "Raster bright-core diameter differs from the geometric target: approximately 11% smaller. Exact apparent-size calibration remains refinement work."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2503.08095",
        "title": "Basant et al. 2025, four planets confirmed with independent MAROON-X and ESPRESSO RVs",
        "publicationDate": "2025-03-11",
        "observationDate": "2021–2023"
      },
      {
        "url": "https://www.eso.org/public/archives/releases/sciencepapers/eso2414/eso2414a.pdf",
        "title": "González Hernández et al. 2024, adopted stellar properties; candidates later confirmed",
        "publicationDate": "2024-10-01",
        "dateNote": "ESO release date; linked manuscript bears August 26, 2024 draft date."
      },
      {
        "url": "https://academic.oup.com/mnras/article/550/2/stag1207/8715836",
        "title": "2026 Barnard system stability, composition and evolution; conditional modelling context",
        "publicationDate": null,
        "publicationYear": 2026,
        "dateNote": "Exact publication date not verified; abstract/title and stability assumptions reviewed."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive pscomppars, retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [],
    "archiveConstraints": {
      "pl_name": "Barnard c",
      "hostname": "Barnard's star",
      "sy_dist": 1.82655,
      "pl_rade": 0.743,
      "pl_bmasse": 0.335,
      "pl_bmassprov": "Msini",
      "pl_orbper": 4.1244,
      "pl_orbsmax": 0.0274,
      "pl_eqt": 400,
      "st_teff": 3195,
      "st_rad": 0.185,
      "st_mass": 0.162,
      "st_spectype": "M3.5-4 V",
      "ra": 269.4486144,
      "dec": 4.7379808,
      "disc_year": 2025
    },
    "skyModel": {
      "star": "Barnard's Star",
      "radiusSun": 0.185,
      "temperatureK": 3195,
      "distanceAU": 0.0274,
      "angularDiameterDeg": 3.5986679251053038,
      "centreDiscWidthFraction": 0.05441173529680164,
      "irradianceEarth": 4.279770604338242,
      "approximateSrgb": [
        1,
        0.7194683096347383,
        0.48158519102838504
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "barnardCBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude, no measured planetary frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/barnard-c-surface-map.jpg",
      "previewUrl": "/bespoke/barnard-c-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-6fb0ccb1-efa2-4233-a37f-db4f17b2f46b.png",
      "sourceSha256": "9ee65f443bbabad3862b0173082b1e8e566307c8843a8a15aebfd335ca089b06",
      "sha256": "cda23358793c249f3f59759c569ddf6688577ad4b4b8ed8478dd846317ed08f2",
      "previewSha256": "617fcf18100c1a469fad840fb31021fbbc5c8632a2a5b6d43d015e7a6c093711",
      "bytes": 542009,
      "previewBytes": 32437,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual airless rocky scenario with neutral albedo map and warm M-dwarf observer view. Composition and terrain remain hypothetical; stellar disc diameter constrained geometrically.",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core horizontal bbox in upper 40% of original source image; thresholds R>180/210/240,G>150,B>80 exclude faint glare. Approximate photospheric boundary, not photometry.",
        "sourceWidth": 1671,
        "brightCoreWidthPixels": 81,
        "widthFraction": 0.04847396768402154,
        "limits": "Generated geometry remains approximate; c core is about 11% below target, d about 1% above, e about 17% below. No calibrated angular or spectral rendering claimed."
      },
      "url": "/bespoke/barnard-c-sky-image.jpg",
      "previewUrl": "/bespoke/barnard-c-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-a7d37119-a85b-485e-aedc-063a2126fa2c.png",
      "sourceSha256": "13ee473a0ae0d741fca9e5c63f3e47f620ecf5fb3db6c0a09670d8f5e0fd39e5",
      "sha256": "aaba2dd85e3d7cceabb951bf21753586ffc8376520c0403efeda51692572314d",
      "previewSha256": "08f3aa4e98dec23e874b1311ced57692774865600bae31a5afbef6d4dda8a644",
      "bytes": 217776,
      "previewBytes": 41354,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/barnard-cde-source-records.json"
  },
  "barnard-d": {
    "id": "barnard-d",
    "name": "Barnard d",
    "aliases": [
      "Barnard d",
      "Barnard's Star d",
      "GJ 699 d",
      "Gl 699 d"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No resolved surface imagery; detection is radial velocity, not a direct terrain image. Archive radius is a mass-radius estimate, not a transit measurement.",
    "measured": [
      "2025 MAROON-X/ESPRESSO RV solution: period 2.3402 days; minimum mass 0.263±0.024 Earth masses. RV observations span 2021–2023.",
      "Host adopted effective temperature 3195±28 K and stellar radius 0.185±0.006 solar radii from the 2024 stellar analysis."
    ],
    "modelled": [
      "RV-derived semimajor axis 0.0188 AU. Equilibrium temperature 483 K assumes zero albedo and full heat redistribution; not measured surface temperature.",
      "The 2026 stability/composition analysis favours rocky planets under its dynamical assumptions; this does not resolve ground chemistry, atmosphere or geography.",
      "Stellar diameter/blackbody flux use representative semimajor-axis distance, not a dated viewpoint. No measured planet radius or physical surface frame is inferred."
    ],
    "unknown": [
      "True mass and inclination, physical radius, atmosphere and pressure, water inventory, minerals, surface colour, spin and climate.",
      "Every basin, fracture, crater, grain and sky viewpoint is unobserved. Transit non-detection does not establish an airless body."
    ],
    "assumed": [
      "One explicitly hypothetical water-poor airless silicate/iron scenario. No clouds, ocean, life, snow or molten lava is inferred from the equilibrium temperature.",
      "Light-gray fractured plateau and dark rubble streaks. This distinct artist palette/geography is not evidence of a compositional difference among planets.",
      "60° hypothetical horizontal field; warm cream/peach stellar colour and reflected lighting are approximate under exposure. Raster disc size is checked separately and is not calibrated photometry.",
      "Neutral albedo texture has artistic relief shading and imperfect seam continuity; neither height nor geographic registration is measured. Observer terrain does not identify a coordinate on the generated globe.",
      "Raster bright-core diameter differs from the geometric target: approximately 1% larger. Exact apparent-size calibration remains refinement work."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2503.08095",
        "title": "Basant et al. 2025, four planets confirmed with independent MAROON-X and ESPRESSO RVs",
        "publicationDate": "2025-03-11",
        "observationDate": "2021–2023"
      },
      {
        "url": "https://www.eso.org/public/archives/releases/sciencepapers/eso2414/eso2414a.pdf",
        "title": "González Hernández et al. 2024, adopted stellar properties; candidates later confirmed",
        "publicationDate": "2024-10-01",
        "dateNote": "ESO release date; linked manuscript bears August 26, 2024 draft date."
      },
      {
        "url": "https://academic.oup.com/mnras/article/550/2/stag1207/8715836",
        "title": "2026 Barnard system stability, composition and evolution; conditional modelling context",
        "publicationDate": null,
        "publicationYear": 2026,
        "dateNote": "Exact publication date not verified; abstract/title and stability assumptions reviewed."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive pscomppars, retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [],
    "archiveConstraints": {
      "pl_name": "Barnard d",
      "hostname": "Barnard's star",
      "sy_dist": 1.82655,
      "pl_rade": 0.694,
      "pl_bmasse": 0.263,
      "pl_bmassprov": "Msini",
      "pl_orbper": 2.3402,
      "pl_orbsmax": 0.0188,
      "pl_eqt": 483,
      "st_teff": 3195,
      "st_rad": 0.185,
      "st_mass": 0.162,
      "st_spectype": "M3.5-4 V",
      "ra": 269.4486144,
      "dec": 4.7379808,
      "disc_year": 2025
    },
    "skyModel": {
      "star": "Barnard's Star",
      "radiusSun": 0.185,
      "temperatureK": 3195,
      "distanceAU": 0.0188,
      "angularDiameterDeg": 5.245837088494805,
      "centreDiscWidthFraction": 0.07934623557177979,
      "irradianceEarth": 9.090879863379861,
      "approximateSrgb": [
        1,
        0.7194683096347383,
        0.48158519102838504
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "barnardDBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude, no measured planetary frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/barnard-d-surface-map.jpg",
      "previewUrl": "/bespoke/barnard-d-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-e915db66-ad1c-4e41-8d72-4f3505b1bfec.png",
      "sourceSha256": "77dce10bdd711fd5c070f85f87ce4f7d543cf5fc955637f7e92533b28f94ca88",
      "sha256": "12fa94c2d253491cb9ca4fa3a1ad5adcd427ad99da4ae4b9ac7a2af25afe777b",
      "previewSha256": "4f50af8a8d77bf5bdf6139b901c39af843bd5caadf5c24d873854a93928381cb",
      "bytes": 577193,
      "previewBytes": 35803,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual airless rocky scenario with neutral albedo map and warm M-dwarf observer view. Composition and terrain remain hypothetical; stellar disc diameter constrained geometrically.",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core horizontal bbox in upper 40% of original source image; thresholds R>180/210/240,G>150,B>80 exclude faint glare. Approximate photospheric boundary, not photometry.",
        "sourceWidth": 1672,
        "brightCoreWidthPixels": 134,
        "widthFraction": 0.08014354066985646,
        "limits": "Generated geometry remains approximate; c core is about 11% below target, d about 1% above, e about 17% below. No calibrated angular or spectral rendering claimed."
      },
      "url": "/bespoke/barnard-d-sky-image.jpg",
      "previewUrl": "/bespoke/barnard-d-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-16baaa8b-88d6-4ee2-8666-380f383fce8f.png",
      "sourceSha256": "eabe85fe707fe83be553da0a76393d7fee734e5c6a242e7d0db367e59588135b",
      "sha256": "192db45e35c521befb1df276cb7f0191afe9ccd88d24dcc8ad71665e23dbbd94",
      "previewSha256": "d4a675d6428e18e8fca120cf5384ed9a25d6def87f4c2781a81d9ad427328eab",
      "bytes": 243138,
      "previewBytes": 49116,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/barnard-cde-source-records.json"
  },
  "barnard-e": {
    "id": "barnard-e",
    "name": "Barnard e",
    "aliases": [
      "Barnard e",
      "Barnard's Star e",
      "GJ 699 e",
      "Gl 699 e"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No resolved surface imagery; detection is radial velocity, not a direct terrain image. Archive radius is a mass-radius estimate, not a transit measurement.",
    "measured": [
      "2025 MAROON-X/ESPRESSO RV solution: period 6.7392 days; minimum mass 0.193±0.033 Earth masses. RV observations span 2021–2023.",
      "Host adopted effective temperature 3195±28 K and stellar radius 0.185±0.006 solar radii from the 2024 stellar analysis."
    ],
    "modelled": [
      "RV-derived semimajor axis 0.0381 AU. Equilibrium temperature 340 K assumes zero albedo and full heat redistribution; not measured surface temperature.",
      "The 2026 stability/composition analysis favours rocky planets under its dynamical assumptions; this does not resolve ground chemistry, atmosphere or geography.",
      "Stellar diameter/blackbody flux use representative semimajor-axis distance, not a dated viewpoint. No measured planet radius or physical surface frame is inferred."
    ],
    "unknown": [
      "True mass and inclination, physical radius, atmosphere and pressure, water inventory, minerals, surface colour, spin and climate.",
      "Every basin, fracture, crater, grain and sky viewpoint is unobserved. Transit non-detection does not establish an airless body."
    ],
    "assumed": [
      "One explicitly hypothetical water-poor airless silicate/iron scenario. No clouds, ocean, life, snow or molten lava is inferred from the equilibrium temperature.",
      "Dark gray/brown dust plains and subdued low ridges. This distinct artist palette/geography is not evidence of a compositional difference among planets.",
      "60° hypothetical horizontal field; warm cream/peach stellar colour and reflected lighting are approximate under exposure. Raster disc size is checked separately and is not calibrated photometry.",
      "Neutral albedo texture has artistic relief shading and imperfect seam continuity; neither height nor geographic registration is measured. Observer terrain does not identify a coordinate on the generated globe.",
      "Raster bright-core diameter differs from the geometric target: approximately 17% smaller. Exact apparent-size calibration remains refinement work."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2503.08095",
        "title": "Basant et al. 2025, four planets confirmed with independent MAROON-X and ESPRESSO RVs",
        "publicationDate": "2025-03-11",
        "observationDate": "2021–2023"
      },
      {
        "url": "https://www.eso.org/public/archives/releases/sciencepapers/eso2414/eso2414a.pdf",
        "title": "González Hernández et al. 2024, adopted stellar properties; candidates later confirmed",
        "publicationDate": "2024-10-01",
        "dateNote": "ESO release date; linked manuscript bears August 26, 2024 draft date."
      },
      {
        "url": "https://academic.oup.com/mnras/article/550/2/stag1207/8715836",
        "title": "2026 Barnard system stability, composition and evolution; conditional modelling context",
        "publicationDate": null,
        "publicationYear": 2026,
        "dateNote": "Exact publication date not verified; abstract/title and stability assumptions reviewed."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive pscomppars, retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [],
    "archiveConstraints": {
      "pl_name": "Barnard e",
      "hostname": "Barnard's star",
      "sy_dist": 1.82655,
      "pl_rade": 0.637,
      "pl_bmasse": 0.193,
      "pl_bmassprov": "Msini",
      "pl_orbper": 6.7392,
      "pl_orbsmax": 0.0381,
      "pl_eqt": 340,
      "st_teff": 3195,
      "st_rad": 0.185,
      "st_mass": 0.162,
      "st_spectype": "M3.5-4 V",
      "ra": 269.4486144,
      "dec": 4.7379808,
      "disc_year": 2025
    },
    "skyModel": {
      "star": "Barnard's Star",
      "radiusSun": 0.185,
      "temperatureK": 3195,
      "distanceAU": 0.0381,
      "angularDiameterDeg": 2.587812980433553,
      "centreDiscWidthFraction": 0.03912143021025076,
      "irradianceEarth": 2.2134599368377033,
      "approximateSrgb": [
        1,
        0.7194683096347383,
        0.48158519102838504
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "barnardEBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, north up; illustrative east-positive longitude, no measured planetary frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/barnard-e-surface-map.jpg",
      "previewUrl": "/bespoke/barnard-e-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-c4a036f9-d4b3-47ae-8cda-f9f16ac27278.png",
      "sourceSha256": "408e759ff5c52170879607b1744e9d464238c9de3fbab03d5a33e12cae9b3d43",
      "sha256": "b63669e2ca46344442049a55bb7ca68e01f314b45d77ded72f300f1ff748414c",
      "previewSha256": "eb0db2bde739b6fb27caf8c99c2d0e0e5761d9f2587db10b60f7c91265a1389e",
      "bytes": 545330,
      "previewBytes": 32960,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "promptBrief": "Individual airless rocky scenario with neutral albedo map and warm M-dwarf observer view. Composition and terrain remain hypothetical; stellar disc diameter constrained geometrically.",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core horizontal bbox in upper 40% of original source image; thresholds R>180/210/240,G>150,B>80 exclude faint glare. Approximate photospheric boundary, not photometry.",
        "sourceWidth": 1672,
        "brightCoreWidthPixels": 54,
        "widthFraction": 0.03229665071770335,
        "limits": "Generated geometry remains approximate; c core is about 11% below target, d about 1% above, e about 17% below. No calibrated angular or spectral rendering claimed."
      },
      "url": "/bespoke/barnard-e-sky-image.jpg",
      "previewUrl": "/bespoke/barnard-e-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-929b777a-540f-4a6b-b923-bce3f4af8e70.png",
      "sourceSha256": "6e8630610a54a862ecbec237c9fca8ae6c341e9c7891d565823fd26a37e4f39b",
      "sha256": "be655b00ccfe35b8c457405d91a4bf91fbed7583c03e6eb3398f85cc471a1226",
      "previewSha256": "9b5e130dc970099ab9e96e1f24a14d7bd6cfa85105f120e796f3b88bd03024ea",
      "bytes": 206295,
      "previewBytes": 37525,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/barnard-cde-source-records.json"
  },
  "epsilon-eridani-b": {
    "id": "epsilon-eridani-b",
    "name": "Epsilon Eridani b",
    "aliases": [
      "eps Eri b",
      "Epsilon Eridani b",
      "epsilon Eri b",
      "HD 22049 b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No confirmed direct detection as of September 2026 study. A low-SNR JWST feature remains model-dependent and tentative; no resolved cloud or surface image exists.",
    "measured": [
      "K2V host at archive distance 3.2026 pc; radial velocity and Hipparcos/Hubble/Gaia astrometry establish a planetary companion."
    ],
    "modelled": [
      "2025 joint orbital fit: semimajor axis 3.53±0.04 AU, period 7.32±0.07 years and near-circular orbit. September 2026 updated joint model gives mass 0.91±0.06 Jupiter masses.",
      "Evolutionary/atmospheric inference permits effective temperatures around 150–200 K; water clouds and/or enhanced metallicity can suppress near-infrared emission. Clear enriched models also remain viable. These are conditional constraints, not a measured visible cloud deck.",
      "Archive host radius 0.759106 solar radii and temperature 5020.38 K adopted for representative illumination, not a coherent refit of the host. Archive planet radius is not a transit measurement."
    ],
    "unknown": [
      "Visible colour, cloud altitude and opacity, exact chemistry, geography, winds, spin, radius and pressure of the observer level.",
      "No solid accessible surface is inferred. The tentative infrared feature is not a confirmed visible photograph."
    ],
    "assumed": [
      "H2/He envelope with water-condensate cloud deck is the selected illustrative scenario; clear atmosphere remains an alternative.",
      "Pearl-gray/ivory clouds with subdued buff-gray shear bands and original fluid morphology are invented, not measured colors or borrowed planet imagery.",
      "Hovering observer above upper clouds with a tenuous dark sky; there is no solid ground. Pressure, altitude and sky scattering are unspecified.",
      "Representative distance 3.53 AU and nominal 60° horizontal field imply a tiny approximately 0.115° host disc. Generated disc and colour remain approximate; no calibrated raster photometry.",
      "Map is cloud-top appearance, not terrain or height data; longitude, cloud horizon and scene registration are imagined.",
      "Raster validation: bright-core width is 7–13 pixels versus a geometric target of 2.90 pixels at 1672-pixel source width; glare/anti-aliasing is unresolved. This image does not accurately reproduce the photospheric disc size. Exact apparent-size calibration remains open."
    ],
    "references": [
      {
        "url": "https://arxiv.org/abs/2609.19131",
        "title": "Llop-Sayson et al. 2026, updated joint orbital/atmospheric model and tentative imaging feature",
        "publicationDate": "2026-09-16",
        "observationDate": "NIRCam February 2024 and 2025-08-29; RV baseline 1981–2024"
      },
      {
        "url": "https://arxiv.org/abs/2502.20561v1",
        "title": "Thompson et al. 2025, revised orbit from radial velocities and absolute astrometry",
        "publicationDate": "2025-02-27",
        "dateNote": "Version 1 submission date; revised version 2 was submitted 2025-10-08."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite constraints retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "eps Eri b",
      "hostname": "eps Eri",
      "sy_dist": 3.2026,
      "pl_rade": 13.8,
      "pl_bmasse": 317.828407,
      "pl_bmassprov": "Mass",
      "pl_orbper": 2680,
      "pl_orbsmax": 3.53,
      "pl_eqt": 112.26,
      "st_teff": 5020.38,
      "st_rad": 0.759106,
      "st_mass": 0.82,
      "st_spectype": "K2 V",
      "ra": 53.2284306,
      "dec": -9.4581715,
      "disc_year": 2000
    },
    "skyModel": {
      "star": "Epsilon Eridani",
      "radiusSun": 0.759106,
      "temperatureK": 5020.38,
      "distanceAU": 3.53,
      "angularDiameterDeg": 0.11459799267777887,
      "centreDiscWidthFraction": 0.001732148629626691,
      "irradianceEarth": 0.02646649988147033,
      "approximateSrgb": [
        1,
        0.8957534072789048,
        0.8103308864322694
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "epsilonEridaniBBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular cloud-top hypothesis; north up, no measured planetary frame.",
      "coverage": "Entire cloud deck imagined.",
      "url": "/bespoke/epsilon-eridani-b-surface-map.jpg",
      "previewUrl": "/bespoke/epsilon-eridani-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-650f90f5-10f1-42d9-95b1-551dbeb3b1c5.png",
      "sourceSha256": "217550c10ec0a59a474268de5d5e754c85bd301e0b4db45900a66aba14f5a517",
      "sha256": "c1f732b5918a7b5dc48bfc51f0bc8dc097faf8f3f290081e0e4a68a1ce45a549",
      "previewSha256": "172fa8ed0337ae6f07ba74fd9be8783304c4886cb3691966ee57b2652cb7f93c",
      "bytes": 274298,
      "previewBytes": 22493,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/epsilon-eridani-b-source-records.json",
    "surfaceLabel": "CLOUD-TOP HYPOTHESIS",
    "skyLabel": "SKY ABOVE THE CLOUDS",
    "skyImage": {
      "rasterValidation": {
        "method": "Upper 40% bright-core bounding box, R>180/210/240 G>150 B>80; glare and photosphere unresolved.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          13,
          9,
          7
        ],
        "geometricTargetWidthPixels": 2.89615,
        "limits": "Minimum threshold core about 2.4 times target; do not treat generated core as a calibrated stellar disc."
      },
      "url": "/bespoke/epsilon-eridani-b-sky-image.jpg",
      "previewUrl": "/bespoke/epsilon-eridani-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-19855b24-c314-4eef-8c5f-f043de36ab13.png",
      "sourceSha256": "7e1bbb2276567a13fc668b93653b505e48e7d84ecfb9fc939762c9d7f0a3282d",
      "sha256": "5c1df8c9bae1a257f1a4cf69c9b35ba4887fb6c46cb35d0b371e93ab5417d386",
      "previewSha256": "6ce0f7a2dea007f03cdf6468132695cf91a0f46a7f270f0e2966c6622173f5da",
      "bytes": 136403,
      "previewBytes": 28518,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "gj887-b": {
    "id": "gj887-b",
    "name": "GJ 887 b",
    "aliases": [
      "GJ 887 b",
      "Gliese 887 b",
      "Gl 887 b",
      "HD 217987 b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved scientific surface/cloud map located. Archive radius is a mass-radius estimate, not an observed radius.",
    "measured": [
      "2026 four-planet RV fit: period 9.2619 days; minimum mass 3.9 Earth masses."
    ],
    "modelled": [
      "Derived semimajor axis 0.0683 AU; equilibrium 426 K is not measured surface temperature.",
      "Adopted host: 3688±86 K and 0.468±0.022 solar radii; representative semimajor-axis illumination is not a dated ephemeris."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, surface accessibility, material composition, geography and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Airless silicate/iron scenario; atmosphere and volatile inventory remain unknown.",
      "Charcoal solidified volcanic plains, pale fractured ridges and tan dust; every crater, scarp and fragment is imagined.",
      "Nominal 60° horizontal field; approximate warm cream/peach host colour. Exposure and atmospheric scattering are illustrative.",
      "Invented longitude and north-up orientation, imperfect seam continuity; no measured pole or scene registration.",
      "No chemistry, cloud or terrain shown is claimed to be observed.",
      "Raster validation: bright-core widths 70/70/69 source pixels at thresholds180/210/240 versus geometric target 92.33 pixels in a 1672-pixel image. Disc size, glare and colour remain approximate; exact calibration is refinement work."
    ],
    "references": [
      {
        "url": "https://doi.org/10.1051/0004-6361/202554984",
        "title": "Hartogh et al. 2026, RedDots four-planet fit, Tables 1 and 3",
        "publicationDate": "2026-03-04",
        "observationDate": "HARPS/ESPRESSO time series; individual dates in Table A.1."
      },
      {
        "url": "https://arxiv.org/html/2602.08929v2",
        "title": "Primary author manuscript, version 2"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 887 b",
      "hostname": "GJ 887",
      "sy_dist": 3.28679,
      "pl_rade": 1.8,
      "pl_bmasse": 3.9,
      "pl_bmassprov": "Msini",
      "pl_orbper": 9.2619,
      "pl_orbsmax": 0.0683,
      "pl_eqt": 426,
      "st_teff": 3688,
      "st_rad": 0.468,
      "st_mass": 0.495,
      "st_spectype": "M1 V",
      "ra": 346.5027573,
      "dec": -35.8473489,
      "disc_year": 2020
    },
    "skyModel": {
      "star": "GJ 887",
      "radiusSun": 0.468,
      "temperatureK": 3688,
      "distanceAU": 0.0683,
      "angularDiameterDeg": 3.6521440116004116,
      "centreDiscWidthFraction": 0.0552208356663024,
      "irradianceEarth": 7.825438066610879,
      "approximateSrgb": [
        1,
        0.7754439309284207,
        0.5916472389223643
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj887BBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured surface/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj887-b-surface-map.jpg",
      "previewUrl": "/bespoke/gj887-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-159cdb7b-6a3c-4bcf-9158-5b5a19fd8223.png",
      "sourceSha256": "a020e721298b4bb371c7a04871e905b47b104f2b4532289dd659f829f61959b9",
      "sha256": "e8d5d68e517671f2529269d576c12ad960b778ab9476fb38349e9164a30b28ff",
      "previewSha256": "14ef6025ebcb8708cf285ce11f18f746f71a22d511bf090a4c9dbbe58d470ba4",
      "bytes": 564988,
      "previewBytes": 36203,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj887-source-records.json",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box within star-only central region of original, R>180/210/240 G>150 B>80. Atmospheric glare and photosphere not fully separable.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          70,
          70,
          69
        ],
        "geometricTargetWidthPixels": 92.32923723405762,
        "limits": "Geometric target constrains prompt; raster colour/size remains approximate, not calibrated photometry."
      },
      "url": "/bespoke/gj887-b-sky-image.jpg",
      "previewUrl": "/bespoke/gj887-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-c97bc8c5-d706-4ebf-8a18-db41bafcf006.png",
      "sourceSha256": "e6c51b7b14c1760c5b7fa0556bca0016f66bdea04fa318473211f43e8a19e040",
      "sha256": "d9f80c791ffb15e0518f71950fe2f76cd7cc36a077034aac293bc8333c436527",
      "previewSha256": "8d3ecc5466b380e036a13fbf18ac96f4aeaeb12e2d192d5be96a237df4e4b46b",
      "bytes": 277713,
      "previewBytes": 50452,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "gj887-c": {
    "id": "gj887-c",
    "name": "GJ 887 c",
    "aliases": [
      "GJ 887 c",
      "Gliese 887 c",
      "Gl 887 c",
      "HD 217987 c"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved scientific surface/cloud map located. Archive radius is a mass-radius estimate, not an observed radius.",
    "measured": [
      "2026 four-planet RV fit: period 21.784 days; minimum mass 6.5 Earth masses."
    ],
    "modelled": [
      "Derived semimajor axis 0.121 AU; equilibrium 320 K is not measured surface temperature.",
      "Adopted host: 3688±86 K and 0.468±0.022 solar radii; representative semimajor-axis illumination is not a dated ephemeris."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, surface accessibility, material composition, geography and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Volatile-envelope H2/He scenario with water vapor and unspecified pale aerosol; a rocky scenario is also allowed by current mass constraints.",
      "Cream/peach-gray hazy cloud deck with small shear eddies; pressure, altitude, condensates and aerosol colours are imagined. No accessible solid ground is depicted.",
      "Nominal 60° horizontal field; approximate warm cream/peach host colour. Exposure and atmospheric scattering are illustrative.",
      "Invented longitude and north-up orientation, imperfect seam continuity; no measured pole or scene registration.",
      "No chemistry, cloud or terrain shown is claimed to be observed.",
      "Raster validation: bright-core widths 71/67/63 source pixels at thresholds180/210/240 versus geometric target 52.10 pixels in a 1672-pixel image. Disc size, glare and colour remain approximate; exact calibration is refinement work."
    ],
    "references": [
      {
        "url": "https://doi.org/10.1051/0004-6361/202554984",
        "title": "Hartogh et al. 2026, RedDots four-planet fit, Tables 1 and 3",
        "publicationDate": "2026-03-04",
        "observationDate": "HARPS/ESPRESSO time series; individual dates in Table A.1."
      },
      {
        "url": "https://arxiv.org/html/2602.08929v2",
        "title": "Primary author manuscript, version 2"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 887 c",
      "hostname": "GJ 887",
      "sy_dist": 3.28679,
      "pl_rade": 2.43,
      "pl_bmasse": 6.5,
      "pl_bmassprov": "Msini",
      "pl_orbper": 21.784,
      "pl_orbsmax": 0.121,
      "pl_eqt": 320,
      "st_teff": 3688,
      "st_rad": 0.468,
      "st_mass": 0.495,
      "st_spectype": "M1 V",
      "ra": 346.5027573,
      "dec": -35.8473489,
      "disc_year": 2020
    },
    "skyModel": {
      "star": "GJ 887",
      "radiusSun": 0.468,
      "temperatureK": 3688,
      "distanceAU": 0.121,
      "angularDiameterDeg": 2.0612616478282555,
      "centreDiscWidthFraction": 0.031159319642931935,
      "irradianceEarth": 2.4933274900998854,
      "approximateSrgb": [
        1,
        0.7754439309284207,
        0.5916472389223643
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj887CBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured surface/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj887-c-surface-map.jpg",
      "previewUrl": "/bespoke/gj887-c-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-c896a816-d0e5-4146-bcb1-1f9530dbc45f.png",
      "sourceSha256": "84c1a2dad734aa2c51ebb3e1d67c2c3e11e6a3431819ee0242adf0ad07ce6065",
      "sha256": "fd10321736075019ffb12dae8da6b7fdd0ab3e69f514e3b7d2aa0d9942d2bf4b",
      "previewSha256": "88b44f83ea5ea53570b3d7db3985aff549af06cbeccd47d092520f4934241121",
      "bytes": 241061,
      "previewBytes": 21104,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj887-source-records.json",
    "surfaceLabel": "CLOUD-TOP HYPOTHESIS",
    "skyLabel": "SKY ABOVE THE CLOUDS",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box within star-only central region of original, R>180/210/240 G>150 B>80. Atmospheric glare and photosphere not fully separable.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          71,
          67,
          63
        ],
        "geometricTargetWidthPixels": 52.09838244298219,
        "limits": "Geometric target constrains prompt; raster colour/size remains approximate, not calibrated photometry."
      },
      "url": "/bespoke/gj887-c-sky-image.jpg",
      "previewUrl": "/bespoke/gj887-c-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-18eeb654-1735-41cd-886f-fd202fdb041c.png",
      "sourceSha256": "73984862ebbfafd47c7f29816458a9680f4088016e15e518620ba773d32c2ef2",
      "sha256": "efdbdea48378a1a7288aaee8048d95fbcf9ceda67c910a4a455472bcd3a49b4c",
      "previewSha256": "4d2f3f7224a05f14e9b484f51348a13e9d240c1a731c7da1baeaa9f6b2669c38",
      "bytes": 124114,
      "previewBytes": 26777,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "gj887-d": {
    "id": "gj887-d",
    "name": "GJ 887 d",
    "aliases": [
      "GJ 887 d",
      "Gliese 887 d",
      "Gl 887 d",
      "HD 217987 d"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved scientific surface/cloud map located. Archive radius is a mass-radius estimate, not an observed radius.",
    "measured": [
      "2026 four-planet RV fit: period 50.77 days; minimum mass 6.1 Earth masses."
    ],
    "modelled": [
      "Derived semimajor axis 0.212 AU; equilibrium 241 K is not measured surface temperature.",
      "Adopted host: 3688±86 K and 0.468±0.022 solar radii; representative semimajor-axis illumination is not a dated ephemeris."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, surface accessibility, material composition, geography and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Volatile-envelope H2/He scenario with water-condensate cloud hypothesis; a rocky scenario is also allowed by current mass constraints.",
      "Pearl-gray/ivory broken cloud spirals and dark haze gaps; all cloud chemistry, pressures and morphology are imagined. No accessible solid ground is depicted.",
      "Nominal 60° horizontal field; approximate warm cream/peach host colour. Exposure and atmospheric scattering are illustrative.",
      "Invented longitude and north-up orientation, imperfect seam continuity; no measured pole or scene registration.",
      "No chemistry, cloud or terrain shown is claimed to be observed.",
      "Raster validation: bright-core widths 29/27/26 source pixels at thresholds180/210/240 versus geometric target 29.73 pixels in a 1672-pixel image. Disc size, glare and colour remain approximate; exact calibration is refinement work."
    ],
    "references": [
      {
        "url": "https://doi.org/10.1051/0004-6361/202554984",
        "title": "Hartogh et al. 2026, RedDots four-planet fit, Tables 1 and 3",
        "publicationDate": "2026-03-04",
        "observationDate": "HARPS/ESPRESSO time series; individual dates in Table A.1."
      },
      {
        "url": "https://arxiv.org/html/2602.08929v2",
        "title": "Primary author manuscript, version 2"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 887 d",
      "hostname": "GJ 887",
      "sy_dist": 3.28679,
      "pl_rade": 2.34,
      "pl_bmasse": 6.1,
      "pl_bmassprov": "Msini",
      "pl_orbper": 50.77,
      "pl_orbsmax": 0.212,
      "pl_eqt": 241,
      "st_teff": 3688,
      "st_rad": 0.468,
      "st_mass": 0.495,
      "st_spectype": "M1 V",
      "ra": 346.5027573,
      "dec": -35.8473489,
      "disc_year": 2026
    },
    "skyModel": {
      "star": "GJ 887",
      "radiusSun": 0.468,
      "temperatureK": 3688,
      "distanceAU": 0.212,
      "angularDiameterDeg": 1.1764320304921387,
      "centreDiscWidthFraction": 0.01778238864954261,
      "irradianceEarth": 0.8122287242468944,
      "approximateSrgb": [
        1,
        0.7754439309284207,
        0.5916472389223643
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj887DBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured surface/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj887-d-surface-map.jpg",
      "previewUrl": "/bespoke/gj887-d-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-500bc68f-7264-4502-a3da-d424f1a16fbd.png",
      "sourceSha256": "063e9247840e71c2d42104b17b6750afa68719567d79865261e93a3d0e2c3fbd",
      "sha256": "27b3acda1d26036822f35c3c8db7d500326a4d69521bf7be663166bcb0727c6f",
      "previewSha256": "bab42698e1ad3a4629d7853e3b35b04ebfd80afed41b6b48c61b0497046dcca5",
      "bytes": 380018,
      "previewBytes": 30906,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj887-source-records.json",
    "surfaceLabel": "CLOUD-TOP HYPOTHESIS",
    "skyLabel": "SKY ABOVE THE CLOUDS",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box within star-only central region of original, R>180/210/240 G>150 B>80. Atmospheric glare and photosphere not fully separable.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          29,
          27,
          26
        ],
        "geometricTargetWidthPixels": 29.732153822035244,
        "limits": "Geometric target constrains prompt; raster colour/size remains approximate, not calibrated photometry."
      },
      "url": "/bespoke/gj887-d-sky-image.jpg",
      "previewUrl": "/bespoke/gj887-d-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-f62f46f3-b4eb-4c13-9410-7f347d6d8b0d.png",
      "sourceSha256": "1139eccaf7f65152bc450e215194994161d112d1bee2de5d5d109f33f54ef6c5",
      "sha256": "bd8d478d5041aa4864bb942ee38a73426c8a15efe16f5c73105632fb6b15a936",
      "previewSha256": "d27eab75cc6fb6ad1770da46d0dc6e5cef56b71686972f248f600177e9b6a79f",
      "bytes": 168724,
      "previewBytes": 35805,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "gj887-e": {
    "id": "gj887-e",
    "name": "GJ 887 e",
    "aliases": [
      "GJ 887 e",
      "Gliese 887 e",
      "Gl 887 e",
      "HD 217987 e"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved scientific surface/cloud map located. Archive radius is a mass-radius estimate, not an observed radius.",
    "measured": [
      "2026 four-planet RV fit: period 4.4249 days; minimum mass 1.46 Earth masses."
    ],
    "modelled": [
      "Derived semimajor axis 0.0417 AU; equilibrium 544 K is not measured surface temperature.",
      "Adopted host: 3688±86 K and 0.468±0.022 solar radii; representative semimajor-axis illumination is not a dated ephemeris."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, surface accessibility, material composition, geography and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Dry airless silicate/iron scenario; an atmosphere is not ruled out by radial velocities.",
      "Gray-brown solidified volcanic plateaus, fractured uplands and quiet fissures are imagined; no molten lava is inferred from equilibrium temperature.",
      "Nominal 60° horizontal field; approximate warm cream/peach host colour. Exposure and atmospheric scattering are illustrative.",
      "Invented longitude and north-up orientation, imperfect seam continuity; no measured pole or scene registration.",
      "No chemistry, cloud or terrain shown is claimed to be observed.",
      "Raster validation: bright-core widths 95/95/94 source pixels at thresholds180/210/240 versus geometric target 151.35 pixels in a 1672-pixel image. Disc size, glare and colour remain approximate; exact calibration is refinement work."
    ],
    "references": [
      {
        "url": "https://doi.org/10.1051/0004-6361/202554984",
        "title": "Hartogh et al. 2026, RedDots four-planet fit, Tables 1 and 3",
        "publicationDate": "2026-03-04",
        "observationDate": "HARPS/ESPRESSO time series; individual dates in Table A.1."
      },
      {
        "url": "https://arxiv.org/html/2602.08929v2",
        "title": "Primary author manuscript, version 2"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 887 e",
      "hostname": "GJ 887",
      "sy_dist": 3.28679,
      "pl_rade": 1.12,
      "pl_bmasse": 1.46,
      "pl_bmassprov": "Msini",
      "pl_orbper": 4.4249,
      "pl_orbsmax": 0.0417,
      "pl_eqt": 544,
      "st_teff": 3688,
      "st_rad": 0.468,
      "st_mass": 0.495,
      "st_spectype": "M1 V",
      "ra": 346.5027573,
      "dec": -35.8473489,
      "disc_year": 2026
    },
    "skyModel": {
      "star": "GJ 887",
      "radiusSun": 0.468,
      "temperatureK": 3688,
      "distanceAU": 0.0417,
      "angularDiameterDeg": 5.983515039915205,
      "centreDiscWidthFraction": 0.09052308386332285,
      "irradianceEarth": 20.99316678027501,
      "approximateSrgb": [
        1,
        0.7754439309284207,
        0.5916472389223643
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj887EBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured surface/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj887-e-surface-map.jpg",
      "previewUrl": "/bespoke/gj887-e-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-c2d6df27-d2a0-4aeb-9808-4c922e94ce42.png",
      "sourceSha256": "768882dbe533523ba7f0d9f24878fbd6f0dfad156db4b455cc87c3504b580f4a",
      "sha256": "a5ec43bd1cc83efb5ec15e3c004018ab6a2ed18952e420f3969c14c4d5bac7fb",
      "previewSha256": "8849dab6ead8394462528be84c97a3dcb9fb257721b8a0defe71a8ec0460aea6",
      "bytes": 577316,
      "previewBytes": 34184,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj887-source-records.json",
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box within star-only central region of original, R>180/210/240 G>150 B>80. Atmospheric glare and photosphere not fully separable.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          95,
          95,
          94
        ],
        "geometricTargetWidthPixels": 151.3545962194758,
        "limits": "Geometric target constrains prompt; raster colour/size remains approximate, not calibrated photometry."
      },
      "url": "/bespoke/gj887-e-sky-image.jpg",
      "previewUrl": "/bespoke/gj887-e-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-ddb49f5b-9c90-4fa8-8323-7ca7a1fd34e9.png",
      "sourceSha256": "b59593dc5c4e0bab7bd28294c9c6c7468887668a425ec3d5b1f9fe7e4e563157",
      "sha256": "b18baed24942fff12adea3b2992a7ad23c4a6183371d3eb28be8ec52f0af08ec",
      "previewSha256": "a6f21e77d0675c0f73621e86e899862bcdb095b9ec6ba6a9e13e18c5dff86b91",
      "bytes": 294480,
      "previewBytes": 53918,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "ross128-b": {
    "id": "ross128-b",
    "name": "Ross 128 b",
    "aliases": [
      "Ross 128 b",
      "GJ 447 b",
      "Gliese 447 b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved native scientific surface map located. Archive radius is a mass-radius estimate, not a measured radius.",
    "measured": [
      "HARPS RV discovery gives a projected minimum mass of 1.35 Earth masses; current archive composite adopts 1.4 Earth masses and period 9.8658 days.",
      "Host adopted in discovery: 3192±60 K, radius 0.1967±0.0077 solar radii."
    ],
    "modelled": [
      "Adopted archive semimajor axis 0.0496 AU; host 3192 K, 0.1967 solar radii.",
      "Discovery equilibrium estimates span 213–269 K for different assumed albedos; archive 301 K uses another model. These are not measured ground temperatures."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, composition, surface accessibility, geography and visible colour.",
      "Habitable-zone or temperature estimates do not establish habitability, oceans or life."
    ],
    "assumed": [
      "Hypothetical dry silicate/iron rocky body with a thin 0.2-bar nitrogen/carbon-dioxide atmosphere; gas mixture and pressure are invented, not measured.",
      "Slate-grey fractured uplands, muted buff dust, independent volcanic plains and sparse shallow craters; all geography imagined.",
      "Thin blue-grey haze and a warm cream/peach white star; scattering, exposure and material colour are artistic.",
      "Invented north-up longitude frame and imperfect texture seam; no measured pole or physical terrain registration.",
      "Nominal 60° horizontal camera field; semimajor-axis representative illumination is not a dated ephemeris.",
      "Raster validation: bright-core widths 150/95/67 original pixels versus geometric target 53.42 pixels in a 1672-pixel image. Glare, star size and colour remain approximate; refinement open."
    ],
    "references": [
      {
        "url": "https://www.eso.org/public/archives/releases/sciencepapers/eso1736/eso1736a.pdf",
        "title": "Bonfils et al., A temperate exo-Earth around a quiet M dwarf at 3.4 parsecs",
        "publicationDate": "2017-11-08 (manuscript date)",
        "observationDate": "HARPS: 2005-07-26 to 2016-04-26"
      },
      {
        "url": "https://www.eso.org/public/news/eso1736/",
        "title": "ESO discovery release, research context",
        "publicationDate": "2017-11-15"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "Ross 128 b",
      "hostname": "Ross 128",
      "sy_dist": 3.37454,
      "pl_rade": 1.11,
      "pl_bmasse": 1.4,
      "pl_bmassprov": "Msini",
      "pl_orbper": 9.8658,
      "pl_orbsmax": 0.0496,
      "pl_eqt": 301,
      "st_teff": 3192,
      "st_rad": 0.1967,
      "st_mass": 0.168,
      "st_spectype": "M4",
      "ra": 176.9376036,
      "dec": 0.7992898,
      "disc_year": 2017
    },
    "skyModel": {
      "star": "Ross 128",
      "radiusSun": 0.1967,
      "temperatureK": 3192,
      "distanceAU": 0.0496,
      "angularDiameterDeg": 2.113472128629936,
      "centreDiscWidthFraction": 0.03194874270851919,
      "irradianceEarth": 1.4709286529534111,
      "approximateSrgb": [
        1,
        0.7191018637846154,
        0.48084225935692265
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "ross128BBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured terrain frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/ross128-b-surface-map.jpg",
      "previewUrl": "/bespoke/ross128-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-47d2c500-41ef-4730-847c-e3c29607f24c.png",
      "sourceSha256": "76f0e8a50ca13c2cd3028a4678717118e8f28705e5e7f982d0829f93325c9eea",
      "sha256": "c88f2cec461aafa88c693b76208d08aa81f9d0af3cd6b2dd2d4df8a3ccc7f616",
      "previewSha256": "3dad9afc53a36a1812b6774fa24aa8b33989f59c28b39120aa41a3ee1148cf33",
      "bytes": 514473,
      "previewBytes": 33050,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in central star-only ROI (x40–60%, y8–25%); R>180/210/240, G>150, B>80. Glare and photosphere cannot be fully separated.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          150,
          95,
          67
        ],
        "geometricTargetWidthPixels": 53.418297808644084,
        "limits": "Nominal 60° camera FOV is artistic; angular/raster scale and colour are not photometrically calibrated."
      },
      "url": "/bespoke/ross128-b-sky-image.jpg",
      "previewUrl": "/bespoke/ross128-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-5499a759-6032-4b93-9c08-9bdc90042bb7.png",
      "sourceSha256": "9717e815909e3441203c68aa694a53ee3e3b6aef50419b4002b9e44f8b27fc29",
      "sha256": "fed9994740e761152b376b32f3bc96ce94c899d7915a023820b6cb4f8bcf357c",
      "previewSha256": "5a076e690d5ae3a5ae51d394375bfd1741b710e40b8e9b913bcba4f8be17363a",
      "bytes": 238836,
      "previewBytes": 41343,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/ross128-gl725a-source-records.json"
  },
  "gl725a-b": {
    "id": "gl725a-b",
    "name": "Gl 725 A b",
    "aliases": [
      "Gl 725 A b",
      "Gl 725A b",
      "GJ 725 A b",
      "Gliese 725 A b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved native scientific surface map located. Archive radius is a mass-radius estimate, not a measured radius.",
    "measured": [
      "Independent optical SOPHIE and near-infrared SPIRou RV signal: period 11.2201±0.0051 days, minimum mass 2.78±0.35 Earth masses, amplitude 1.67±0.20 m/s.",
      "No transit found in 27 TESS sectors. Discovery manuscript calls this a candidate; NASA confirmed-planet composite includes it with discovery year 2025."
    ],
    "modelled": [
      "Adopted archive semimajor axis 0.068 AU; host 3433 K, 0.351 solar radii.",
      "Archive equilibrium 376.1 K is a model, not measured surface temperature. Published radius predictions 1.2–2.0 Earth radii are mass-radius estimates, not transit measurements."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmosphere, pressure, composition, surface accessibility, geography and visible colour.",
      "Habitable-zone or temperature estimates do not establish habitability, oceans or life."
    ],
    "assumed": [
      "Hypothetical dry airless silicate/iron surface; actual atmospheric presence and volatile inventory are unknown.",
      "Ash-grey volcanic plates, charcoal braided fractures, shallow rounded basins and taupe regolith are wholly imagined; no active lava is inferred.",
      "Black sky and warm cream star; binary companion B is outside the chosen artistic field. Binary orientation and scene epoch are not registered.",
      "Invented north-up longitude frame and imperfect texture seam; no measured pole or physical terrain registration.",
      "Nominal 60° horizontal camera field; semimajor-axis representative illumination is not a dated ephemeris.",
      "Raster validation: bright-core widths 92/92/90 original pixels versus geometric target 69.54 pixels in a 1672-pixel image. Glare, star size and colour remain approximate; refinement open."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/2411.09506v1",
        "title": "Cortés-Zuleta et al., Gl 725A b: a potential super-Earth detected with SOPHIE and SPIRou",
        "publicationDate": "2024-11-14 (arXiv v1); journal A&A 693 A164, January 2025",
        "observationDate": "SOPHIE March 2021–December 2023; SPIRou February 2019–April 2022; detailed epochs in Appendix A; 27 TESS sectors examined."
      },
      {
        "url": "https://arxiv.org/abs/2411.09506",
        "title": "Primary manuscript bibliographic record"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "Gl 725 A b",
      "hostname": "Gl 725 A",
      "sy_dist": 3.5214,
      "pl_rade": 1.48,
      "pl_bmasse": 2.78,
      "pl_bmassprov": "Msini",
      "pl_orbper": 11.2201,
      "pl_orbsmax": 0.068,
      "pl_eqt": 376.1,
      "st_teff": 3433,
      "st_rad": 0.351,
      "st_mass": 0.33,
      "st_spectype": "M3",
      "ra": 280.6834312,
      "dec": 59.638109,
      "disc_year": 2025
    },
    "skyModel": {
      "star": "Gl 725 A",
      "radiusSun": 0.351,
      "temperatureK": 3433,
      "distanceAU": 0.068,
      "angularDiameterDeg": 2.7509908143939326,
      "centreDiscWidthFraction": 0.041589201626278494,
      "irradianceEarth": 3.334159190653499,
      "approximateSrgb": [
        1,
        0.7474946672513234,
        0.5375045369032464
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gl725ABBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up hypothesis; no measured terrain frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gl725a-b-surface-map.jpg",
      "previewUrl": "/bespoke/gl725a-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-f04b8af1-1825-425a-a92b-3a4d58412d2a.png",
      "sourceSha256": "2660d3d90a400261728d3e8eecc33f5aaaeb0f204a46fc7657aaa58fe8f96106",
      "sha256": "55502fd95550189c7095042d867319bccce2ca089291cd5aa9b7a8ad51456aae",
      "previewSha256": "20f7ef47106078a2b84b1a0276ac64dd80843528a0b3d5e50542840db8de5a3d",
      "bytes": 580744,
      "previewBytes": 37379,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in central star-only ROI (x40–60%, y8–25%); R>180/210/240, G>150, B>80. Glare and photosphere cannot be fully separated.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          92,
          92,
          90
        ],
        "geometricTargetWidthPixels": 69.53714511913765,
        "limits": "Nominal 60° camera FOV is artistic; angular/raster scale and colour are not photometrically calibrated."
      },
      "url": "/bespoke/gl725a-b-sky-image.jpg",
      "previewUrl": "/bespoke/gl725a-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-2bb418bd-e3db-4624-9d6b-47eee1d3087a.png",
      "sourceSha256": "8124d77320c996823bc64276168120e3e65d43a019ad0c60431a0b4a98a3fe8c",
      "sha256": "56c39037ba3a9707f824f931618265306c0f75e493762917efcc2928c89b0f20",
      "previewSha256": "8b516559a6d64962c680aa5a9093ae728d0b1caa1b85d401191bf47cd588fc37",
      "bytes": 308819,
      "previewBytes": 54375,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/ross128-gl725a-source-records.json"
  },
  "gj15a-b": {
    "id": "gj15a-b",
    "name": "GJ 15 A b",
    "aliases": [
      "GJ 15 A b",
      "Gl 15 A b",
      "Gliese 15 A b",
      "GJ 15A b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved native scientific surface/cloud map located. Composite radii are mass-radius estimates, not measured radii.",
    "measured": [
      "Joint HARPS-N/HIRES RV fit: minimum mass 3.03 (+0.46/−0.44) Earth masses; period 11.4407 (+0.0017/−0.0016) days."
    ],
    "modelled": [
      "Adopted composite semimajor axis 0.072 AU; host 3607±68 K and 0.38±0.05 solar radii.",
      "Archive equilibrium 550 K is a heterogeneous model value, not measured surface temperature; albedo, heat redistribution and atmosphere are unconstrained.",
      "Inner RV signal was discussed alongside a CARMENES non-detection; the combined 2018 analysis confirms it with a revised amplitude."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmospheric composition and pressure, visible colour and geography.",
      "Habitability and material chemistry cannot be established from minimum mass or temperature estimates."
    ],
    "assumed": [
      "Dry airless silicate/iron hypothesis; atmosphere, composition and surface accessibility not measured.",
      "Grey segmented uplift blocks, muted copper-tan mineral dust and dark small volcanic basins; every fracture and impact hollow is imagined.",
      "Black airless sky; no lava, oceans or clouds inferred from equilibrium estimates.",
      "Invented longitude frame and approximate texture seams; no measured rotation/pole or physical surface registration.",
      "Nominal 60° horizontal field, representative semimajor-axis illumination; scene not registered to a dated ephemeris. Binary companion B outside chosen field.",
      "Approximate warm cream/peach host colour; spectrum, exposure and transfer are not calibrated.",
      "Raster validation: bright-core widths 52/50/50 source pixels versus nominal centred geometric target 71.101 pixels in 1672-pixel frame. Disc is approximate and smaller than geometric target. Photometric and camera calibration remains open."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/1804.03476v1",
        "title": "Pinamonti et al. 2018, joint RV fit and binary modelling, Tables 1 and 3",
        "publicationDate": "2018-04-10 (arXiv v1); A&A 617 A104, September 2018",
        "observationDate": "HARPS-N 2012-08-27 to 2017-01-18, plus 15 years of archived HIRES RV measurements; Appendix A epochs."
      },
      {
        "url": "https://doi.org/10.1051/0004-6361/201732535",
        "title": "Published HADES paper, A&A 617 A104"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 15 A b",
      "hostname": "GJ 15 A",
      "sy_dist": 3.56228,
      "pl_rade": 1.55,
      "pl_bmasse": 3.03,
      "pl_bmassprov": "Msini",
      "pl_orbper": 11.4407,
      "pl_orbsmax": 0.072,
      "pl_eqt": 550,
      "st_teff": 3607,
      "st_rad": 0.38,
      "st_mass": 0.38,
      "st_spectype": "M1",
      "ra": 4.6126677,
      "dec": 44.0247296,
      "disc_year": 2014
    },
    "skyModel": {
      "star": "GJ 15 A",
      "radiusSun": 0.38,
      "temperatureK": 3607,
      "distanceAU": 0.072,
      "angularDiameterDeg": 2.8128329020406273,
      "centreDiscWidthFraction": 0.04252449559375255,
      "irradianceEarth": 4.247970380958199,
      "approximateSrgb": [
        1,
        0.7667810367635197,
        0.5750265845101851
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj15ABBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up imagined albedo; no measured terrain/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj15a-b-surface-map.jpg",
      "previewUrl": "/bespoke/gj15a-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4f7b0c3c-ebe9-4e64-acec-02f64c4fa9d2.png",
      "sourceSha256": "444678e0b74945f3c2af4b927d37e3c541ff6fee84548f561ab318fdb55ae950",
      "sha256": "85be7ec011844533b4d811852d069b65e15fe2d523fa7cae5e92073e144e913f",
      "previewSha256": "61618fcc64db9eabdea991398d2dd4290326c8948191343dd8b93c525ac18cbf",
      "bytes": 570944,
      "previewBytes": 35309,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in star-only ROI [0.4,0.6,0.08,0.25] (fractions x0,x1,y0,y1), R>180/210/240 G>150 B>80; glare not photosphere.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          52,
          50,
          50
        ],
        "geometricTargetWidthPixels": 71.10095663275426,
        "limits": "Nominal camera FOV artistic; off-centre projection, angular scale and colour not calibrated."
      },
      "url": "/bespoke/gj15a-b-sky-image.jpg",
      "previewUrl": "/bespoke/gj15a-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-996368ef-e9c8-4cbe-a78a-60dc3396c573.png",
      "sourceSha256": "d8bfcccbe8afbd96d5853befa897bc10f8e98c60fec301b20588d6ae75706160",
      "sha256": "d8ef133872763deffebafd1418144f56ec76f040722a65e12c81652ac3853a6e",
      "previewSha256": "40ff6703209c61c3c6549c3acc58479684b665a87b9aa4f92abfa52bb57d342a",
      "bytes": 331080,
      "previewBytes": 57903,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj15a-source-records.json"
  },
  "gj15a-c": {
    "id": "gj15a-c",
    "name": "GJ 15 A c",
    "aliases": [
      "GJ 15 A c",
      "Gl 15 A c",
      "Gliese 15 A c",
      "GJ 15A c"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "RV detection; no resolved native scientific surface/cloud map located. Composite radii are mass-radius estimates, not measured radii.",
    "measured": [
      "Joint HARPS-N/HIRES RV fit: minimum mass 36 (+25/−18) Earth masses; period around 7600 days."
    ],
    "modelled": [
      "Adopted composite semimajor axis 5.4 AU; host 3607±68 K and 0.38±0.05 solar radii.",
      "Archive equilibrium 46.14 K is a heterogeneous model value, not measured surface temperature; albedo, heat redistribution and atmosphere are unconstrained.",
      "2018 observations did not cover a full outer orbit; eccentricity poorly constrained (e<0.40 at 68% confidence)."
    ],
    "unknown": [
      "Physical radius, inclination, true mass, spin, atmospheric composition and pressure, visible colour and geography.",
      "Habitability and material chemistry cannot be established from minimum mass or temperature estimates."
    ],
    "assumed": [
      "Hypothetical hydrogen/helium envelope with trace methane and cold condensate hazes; actual chemistry, pressure, cloud depth and accessible ground unknown.",
      "Cloud-top albedo and hovering observer view; no accessible solid ground is asserted. Every diffuse cell, filament and oval is invented.",
      "Pearl-grey and slate-blue clouds have an artistic exposure lift; faint host represented as a point with unresolved glare.",
      "Invented longitude frame and approximate texture seams; no measured rotation/pole or physical surface registration.",
      "Nominal 60° horizontal field, representative semimajor-axis illumination; scene not registered to a dated ephemeris. Binary companion B outside chosen field.",
      "Approximate warm cream/peach host colour; spectrum, exposure and transfer are not calibrated.",
      "Raster validation: bright-core widths 2/2/2 source pixels versus nominal centred geometric target 0.948 pixels in 1672-pixel frame. Subpixel photosphere cannot be resolved; shown point is glare, at an off-centre artistic position. Photometric and camera calibration remains open."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/1804.03476v1",
        "title": "Pinamonti et al. 2018, joint RV fit and binary modelling, Tables 1 and 3",
        "publicationDate": "2018-04-10 (arXiv v1); A&A 617 A104, September 2018",
        "observationDate": "HARPS-N 2012-08-27 to 2017-01-18, plus 15 years of archived HIRES RV measurements; Appendix A epochs."
      },
      {
        "url": "https://doi.org/10.1051/0004-6361/201732535",
        "title": "Published HADES paper, A&A 617 A104"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 15 A c",
      "hostname": "GJ 15 A",
      "sy_dist": 3.56228,
      "pl_rade": 6.67,
      "pl_bmasse": 36,
      "pl_bmassprov": "Msini",
      "pl_orbper": 7600,
      "pl_orbsmax": 5.4,
      "pl_eqt": 46.14,
      "st_teff": 3607,
      "st_rad": 0.38,
      "st_mass": 0.38,
      "st_spectype": "M1",
      "ra": 4.6126677,
      "dec": 44.0247296,
      "disc_year": 2018
    },
    "skyModel": {
      "star": "GJ 15 A",
      "radiusSun": 0.38,
      "temperatureK": 3607,
      "distanceAU": 5.4,
      "angularDiameterDeg": 0.03750067318433193,
      "centreDiscWidthFraction": 0.0005668224967355936,
      "irradianceEarth": 0.0007551947343925685,
      "approximateSrgb": [
        1,
        0.7667810367635197,
        0.5750265845101851
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj15ACBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up imagined albedo; no measured terrain/cloud frame.",
      "coverage": "Entire globe imagined.",
      "url": "/bespoke/gj15a-c-surface-map.jpg",
      "previewUrl": "/bespoke/gj15a-c-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-2eb817b6-584e-4b16-ac80-eb0a552d878a.png",
      "sourceSha256": "9b1915edac5fe5e2efa7ae2f9201d1544faeb287a3219b52af02618f6e0253ea",
      "sha256": "63c8982a09baec64dd39dcc6b410f75c9e61ac20e8aeefb1ec2d2fe4315f7af0",
      "previewSha256": "c271edd401896f792089a174e4b4a3ef7a9eb9b0a7aeb16f231aead7a7c3b107",
      "bytes": 314611,
      "previewBytes": 26506,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in star-only ROI [0.28,0.34,0.1,0.22] (fractions x0,x1,y0,y1), R>180/210/240 G>150 B>80; glare not photosphere.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          2,
          2,
          2
        ],
        "geometricTargetWidthPixels": 0.9477272145419124,
        "limits": "Nominal camera FOV artistic; off-centre projection, angular scale and colour not calibrated."
      },
      "url": "/bespoke/gj15a-c-sky-image.jpg",
      "previewUrl": "/bespoke/gj15a-c-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-47aa9335-c25c-4a6d-bbf7-50ea974e0bf3.png",
      "sourceSha256": "b62a5c8f7f22c41986a42b5c793e462638f4df6a606e43fe078833e5ac816ccd",
      "sha256": "c8f48f941cfc5d37bb35a09757046fdcb0bd356ff6182482b7a2e599ad63ec83",
      "previewSha256": "f947b118a212662dbd14d77240ac3b595b2f4140743bf552c8b248ad88c06dd5",
      "bytes": 101980,
      "previewBytes": 21321,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj15a-source-records.json",
    "surfaceLabel": "CLOUD-TOP HYPOTHESIS",
    "skyLabel": "SKY ABOVE THE CLOUDS"
  },
  "tau-cet-f": {
    "id": "tau-cet-f",
    "name": "tau Cet f",
    "aliases": [
      "tau Cet f",
      "Tau Ceti f",
      "HD 10700 f",
      "Gliese 71 f"
    ],
    "researchDate": "2026-10-10",
    "statusNote": "ARCHIVE-LISTED, DISPUTED PLANET. The proposed 636-day signal is below the 2025 ESPRESSO detection limits. Non-detection does not rule it out, but independent confirmation remains uncertain. Every image is conditional on this body existing; it is not an observed surface.",
    "nativeSurface": "No resolved native scientific planetary surface map located. Archive membership differs from the independent confirmation evidence; no planet is imaged here.",
    "measured": [
      "2017 study analyses archival HARPS and HIRES radial velocities; physical surfaces, atmospheres and radii were not measured.",
      "2025 ESPRESSO study analyses 136 nightly measurements across 1565.9 days, with no unambiguous planet detections around Tau Ceti."
    ],
    "modelled": [
      "2017 conditional Keplerian fit: period 636.13 days (1%–99% posterior interval 588.44–647.83); projected minimum mass 3.93 Earth masses (interval 2.56–4.98). These values depend on the planetary interpretation of a disputed RV signal.",
      "Adopted archive semimajor axis 1.334 AU, radius estimate 1.81 Earth radii, host 5310 K and 0.83 solar radii. Planet radius is a mass-radius estimate, not a transit measurement.",
      "Archive equilibrium 201.97 K is not measured surface temperature; albedo and atmosphere are unknown.",
      "The proposed 636-day signal is below the 2025 ESPRESSO detection limits. Non-detection does not rule it out, but independent confirmation remains uncertain."
    ],
    "unknown": [
      "Planetary existence and independent confirmation, orbital inclination, true mass, physical radius, spin, atmosphere, pressure, clouds, material chemistry, terrain and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Conditional scene only: the named planet is disputed; its surface is not observed.",
      "Conditional frozen rock/water-ice scenario with an invented thin 0.1-bar nitrogen atmosphere; pressure, ice and atmospheric existence not measured.",
      "Pale-grey silicate highlands, milky frost, blue-grey frozen basins and long tectonic valleys are wholly imagined; no liquid ocean or biology.",
      "Weak blue-grey sky scattering and surface frost are artistic; a volatile envelope is also possible and no accessible ground is established.",
      "Invented longitude/north-up frame and imperfect texture seams; no measured pole or scene registration.",
      "Nominal 60° horizontal camera field, semimajor-axis illumination; no dated observer ephemeris. Warm ivory-white star appearance is an artistic colour guide.",
      "Raster validation after star-size refinement: bright-core widths 17/16/15 source pixels versus geometric target 8.379 pixels in 1672-pixel frame. Glare and photosphere remain incompletely separated; camera, size and colour are not calibrated."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/1708.02051v1",
        "title": "Feng et al. 2017, candidate-signal fits Table 5",
        "publicationDate": "2017-08-07 (arXiv v1)",
        "observationDate": "Archival HARPS and HIRES; Fig. 1 time series; conservative HARPS subset excludes observations before JD2453500. Exact first/last epochs not independently transcribed."
      },
      {
        "url": "https://arxiv.org/html/2507.07514v1",
        "title": "Figueira et al. 2025, independent ESPRESSO limits Section 8.4",
        "publicationDate": "2025-07-10 (arXiv v1)",
        "observationDate": "ESPRESSO GTO: 136 nightly measurements across 1565.9 days (Table 8). Exact start/end dates are not independently transcribed; individual epochs in supplementary tables."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot (membership is not independent confirmation)",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "tau Cet f",
      "hostname": "tau Cet",
      "sy_dist": 3.60304,
      "pl_rade": 1.81,
      "pl_bmasse": 3.93,
      "pl_bmassprov": "Msini",
      "pl_orbper": 636.13,
      "pl_orbsmax": 1.334,
      "pl_eqt": 201.97,
      "st_teff": 5310,
      "st_rad": 0.83,
      "st_mass": 0.783,
      "st_spectype": "G8.5V",
      "ra": 26.0093029,
      "dec": -15.9337987,
      "disc_year": 2017
    },
    "skyModel": {
      "star": "Tau Ceti",
      "radiusSun": 0.83,
      "temperatureK": 5310,
      "distanceAU": 1.334,
      "angularDiameterDeg": 0.3315676018748938,
      "centreDiscWidthFraction": 0.005011656531860919,
      "irradianceEarth": 0.2772792177980726,
      "approximateSrgb": [
        1,
        0.9176316035321856,
        0.8481171538623429
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "CONDITIONAL SURFACE HYPOTHESIS",
    "skyLabel": "CONDITIONAL SKY FROM THE SURFACE",
    "surfaceMap": {
      "key": "tauCetFBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up imagined albedo; no measured surface frame.",
      "coverage": "Entire globe imagined, conditional on planetary existence.",
      "url": "/bespoke/tau-cet-f-surface-map.jpg",
      "previewUrl": "/bespoke/tau-cet-f-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-355500e8-f567-4884-a4dc-1b74a1991634.png",
      "sourceSha256": "2a6bb0e7e5fd95d67d977bfa88993e2b577d7aab8935427ef856dc2baa8bf459",
      "sha256": "650e7334d2fe75b7d71b5e7a7f06e89e54e66db09af12b5415b0741a07412086",
      "previewSha256": "435fe75123fdeeeafe68460a67c7091781df2896ea0803be34ca90abfbecb82a",
      "bytes": 544170,
      "previewBytes": 37365,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in star-only ROI x40–60%, y7–28%; R>180/210/240, G>150, B>80; glare not calibrated photosphere.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          17,
          16,
          15
        ],
        "geometricTargetWidthPixels": 8.379489721271456,
        "limits": "Nominal camera field and angular/raster scale approximate; no calibrated photometry."
      },
      "url": "/bespoke/tau-cet-f-sky-image.jpg",
      "previewUrl": "/bespoke/tau-cet-f-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-dcd63655-a707-4ee7-9199-2ebd3c9bfdb9.png",
      "sourceSha256": "5623f9c6da0844e3a62517e5a8cdcc859c5fac0ecf97cd770d800e965e8f7cad",
      "sha256": "baec7fd54efaf07c65960686c94cf609b4cc49a72c8145c63ee43831b12aa9de",
      "previewSha256": "d6ca0e65965de3fc6ac0fe9a4ee2af28eb4834698907cce772224446398ed74e",
      "bytes": 271758,
      "previewBytes": 50187,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/tau-ceti-source-records.json"
  },
  "tau-cet-g": {
    "id": "tau-cet-g",
    "name": "tau Cet g",
    "aliases": [
      "tau Cet g",
      "Tau Ceti g",
      "HD 10700 g",
      "Gliese 71 g"
    ],
    "researchDate": "2026-10-10",
    "statusNote": "ARCHIVE-LISTED, DISPUTED PLANET. 2025 ESPRESSO finds weak 20-day structure without significant evidence for a planet; stellar rotation harmonics could produce the signal. Independent planetary confirmation remains uncertain. Every image is conditional on this body existing; it is not an observed surface.",
    "nativeSurface": "No resolved native scientific planetary surface map located. Archive membership differs from the independent confirmation evidence; no planet is imaged here.",
    "measured": [
      "2017 study analyses archival HARPS and HIRES radial velocities; physical surfaces, atmospheres and radii were not measured.",
      "2025 ESPRESSO study analyses 136 nightly measurements across 1565.9 days, with no unambiguous planet detections around Tau Ceti."
    ],
    "modelled": [
      "2017 conditional Keplerian fit: period 20 days (1%–99% posterior interval 19.99–20.02); projected minimum mass 1.75 Earth masses (interval 1.35–2.00). These values depend on the planetary interpretation of a disputed RV signal.",
      "Adopted archive semimajor axis 0.133 AU, radius estimate 1.18 Earth radii, host 5310 K and 0.83 solar radii. Planet radius is a mass-radius estimate, not a transit measurement.",
      "Archive equilibrium 639.65 K is not measured surface temperature; albedo and atmosphere are unknown.",
      "2025 ESPRESSO finds weak 20-day structure without significant evidence for a planet; stellar rotation harmonics could produce the signal. Independent planetary confirmation remains uncertain."
    ],
    "unknown": [
      "Planetary existence and independent confirmation, orbital inclination, true mass, physical radius, spin, atmosphere, pressure, clouds, material chemistry, terrain and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Conditional scene only: the named planet is disputed; its surface is not observed.",
      "Conditional dry airless silicate/iron hypothesis; actual atmosphere and chemistry unknown.",
      "Charcoal basaltic shields, muted reddish-brown mineral dust, light sandy streaks and broad low domes are imagined; no active lava is inferred.",
      "Black sky chooses no atmosphere, rather than demonstrating its absence.",
      "Invented longitude/north-up frame and imperfect texture seams; no measured pole or scene registration.",
      "Nominal 60° horizontal camera field, semimajor-axis illumination; no dated observer ephemeris. Warm ivory-white star appearance is an artistic colour guide.",
      "Raster validation after star-size refinement: bright-core widths 55/53/49 source pixels versus geometric target 84.082 pixels in 1672-pixel frame. Glare and photosphere remain incompletely separated; camera, size and colour are not calibrated."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/1708.02051v1",
        "title": "Feng et al. 2017, candidate-signal fits Table 5",
        "publicationDate": "2017-08-07 (arXiv v1)",
        "observationDate": "Archival HARPS and HIRES; Fig. 1 time series; conservative HARPS subset excludes observations before JD2453500. Exact first/last epochs not independently transcribed."
      },
      {
        "url": "https://arxiv.org/html/2507.07514v1",
        "title": "Figueira et al. 2025, independent ESPRESSO limits Section 8.4",
        "publicationDate": "2025-07-10 (arXiv v1)",
        "observationDate": "ESPRESSO GTO: 136 nightly measurements across 1565.9 days (Table 8). Exact start/end dates are not independently transcribed; individual epochs in supplementary tables."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot (membership is not independent confirmation)",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "tau Cet g",
      "hostname": "tau Cet",
      "sy_dist": 3.60304,
      "pl_rade": 1.18,
      "pl_bmasse": 1.75,
      "pl_bmassprov": "Msini",
      "pl_orbper": 20,
      "pl_orbsmax": 0.133,
      "pl_eqt": 639.65,
      "st_teff": 5310,
      "st_rad": 0.83,
      "st_mass": 0.783,
      "st_spectype": "G8.5V",
      "ra": 26.0093029,
      "dec": -15.9337987,
      "disc_year": 2017
    },
    "skyModel": {
      "star": "Tau Ceti",
      "radiusSun": 0.83,
      "temperatureK": 5310,
      "distanceAU": 0.133,
      "angularDiameterDeg": 3.3261103558696257,
      "centreDiscWidthFraction": 0.05028826376071205,
      "irradianceEarth": 27.8949570754631,
      "approximateSrgb": [
        1,
        0.9176316035321856,
        0.8481171538623429
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "CONDITIONAL SURFACE HYPOTHESIS",
    "skyLabel": "CONDITIONAL SKY FROM THE SURFACE",
    "surfaceMap": {
      "key": "tauCetGBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up imagined albedo; no measured surface frame.",
      "coverage": "Entire globe imagined, conditional on planetary existence.",
      "url": "/bespoke/tau-cet-g-surface-map.jpg",
      "previewUrl": "/bespoke/tau-cet-g-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-723e84a4-521d-4535-a941-60987aa1c87d.png",
      "sourceSha256": "bbc0e9f456adfd9e949c83a9502f8409365b297fa3f5020b74fd3aac6e656da6",
      "sha256": "8b837f2721db7debcccd1dc50e3772e3fffa4a52eb9e66f7a4aa34d3a70170cc",
      "previewSha256": "cbb2348e6e239b2045171adff22e0ec44f2ef5ba28d0d0cb059fb78b1c7bbaf1",
      "bytes": 509413,
      "previewBytes": 31422,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in star-only ROI x40–60%, y7–28%; R>180/210/240, G>150, B>80; glare not calibrated photosphere.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          55,
          53,
          49
        ],
        "geometricTargetWidthPixels": 84.08197700791055,
        "limits": "Nominal camera field and angular/raster scale approximate; no calibrated photometry."
      },
      "url": "/bespoke/tau-cet-g-sky-image.jpg",
      "previewUrl": "/bespoke/tau-cet-g-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-7dbb11cb-d471-46e3-a29b-d6bc25ba2983.png",
      "sourceSha256": "b04cea32be231c245d42158e89004bf81ac8ff3cc5dba982bef999795e1d80a7",
      "sha256": "5267ba1bc9a3002055ea93daa95108937c108afbb031dbae9f9011b5f653b058",
      "previewSha256": "1b018ae3253ee90ac0fb0de08414037bd6769bcdf99bb4cff15a1e9d1cf19760",
      "bytes": 270711,
      "previewBytes": 50963,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/tau-ceti-source-records.json"
  },
  "tau-cet-h": {
    "id": "tau-cet-h",
    "name": "tau Cet h",
    "aliases": [
      "tau Cet h",
      "Tau Ceti h",
      "HD 10700 h",
      "Gliese 71 h"
    ],
    "researchDate": "2026-10-10",
    "statusNote": "ARCHIVE-LISTED, DISPUTED PLANET. The proposed 49-day planet is close to the 2025 ESPRESSO compatibility limit, and that study does not unambiguously detect planets around Tau Ceti. Independent confirmation remains uncertain. Every image is conditional on this body existing; it is not an observed surface.",
    "nativeSurface": "No resolved native scientific planetary surface map located. Archive membership differs from the independent confirmation evidence; no planet is imaged here.",
    "measured": [
      "2017 study analyses archival HARPS and HIRES radial velocities; physical surfaces, atmospheres and radii were not measured.",
      "2025 ESPRESSO study analyses 136 nightly measurements across 1565.9 days, with no unambiguous planet detections around Tau Ceti."
    ],
    "modelled": [
      "2017 conditional Keplerian fit: period 49.41 days (1%–99% posterior interval 49.31–49.49); projected minimum mass 1.83 Earth masses (interval 1.57–2.51). These values depend on the planetary interpretation of a disputed RV signal.",
      "Adopted archive semimajor axis 0.243 AU, radius estimate 1.19 Earth radii, host 5310 K and 0.83 solar radii. Planet radius is a mass-radius estimate, not a transit measurement.",
      "Archive equilibrium 473.22 K is not measured surface temperature; albedo and atmosphere are unknown.",
      "The proposed 49-day planet is close to the 2025 ESPRESSO compatibility limit, and that study does not unambiguously detect planets around Tau Ceti. Independent confirmation remains uncertain."
    ],
    "unknown": [
      "Planetary existence and independent confirmation, orbital inclination, true mass, physical radius, spin, atmosphere, pressure, clouds, material chemistry, terrain and visible colour.",
      "Habitable-zone placement does not establish habitability, oceans or life."
    ],
    "assumed": [
      "Conditional scene only: the named planet is disputed; its surface is not observed.",
      "Conditional dry airless silicate/iron hypothesis; actual atmosphere and chemistry unknown.",
      "Light-grey crumpled plates, pale taupe dust, curved wrinkle ridges and isolated darker volcanic patches are imagined; no active lava or water inferred.",
      "Black sky chooses no atmosphere, rather than demonstrating its absence.",
      "Invented longitude/north-up frame and imperfect texture seams; no measured pole or scene registration.",
      "Nominal 60° horizontal camera field, semimajor-axis illumination; no dated observer ephemeris. Warm ivory-white star appearance is an artistic colour guide.",
      "Raster validation after star-size refinement: bright-core widths 49/49/47 source pixels versus geometric target 46.007 pixels in 1672-pixel frame. Glare and photosphere remain incompletely separated; camera, size and colour are not calibrated."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/1708.02051v1",
        "title": "Feng et al. 2017, candidate-signal fits Table 5",
        "publicationDate": "2017-08-07 (arXiv v1)",
        "observationDate": "Archival HARPS and HIRES; Fig. 1 time series; conservative HARPS subset excludes observations before JD2453500. Exact first/last epochs not independently transcribed."
      },
      {
        "url": "https://arxiv.org/html/2507.07514v1",
        "title": "Figueira et al. 2025, independent ESPRESSO limits Section 8.4",
        "publicationDate": "2025-07-10 (arXiv v1)",
        "observationDate": "ESPRESSO GTO: 136 nightly measurements across 1565.9 days (Table 8). Exact start/end dates are not independently transcribed; individual epochs in supplementary tables."
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot (membership is not independent confirmation)",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "tau Cet h",
      "hostname": "tau Cet",
      "sy_dist": 3.60304,
      "pl_rade": 1.19,
      "pl_bmasse": 1.83,
      "pl_bmassprov": "Msini",
      "pl_orbper": 49.41,
      "pl_orbsmax": 0.243,
      "pl_eqt": 473.22,
      "st_teff": 5310,
      "st_rad": 0.83,
      "st_mass": 0.783,
      "st_spectype": "G8.5V",
      "ra": 26.0093029,
      "dec": -15.9337987,
      "disc_year": 2017
    },
    "skyModel": {
      "star": "Tau Ceti",
      "radiusSun": 0.83,
      "temperatureK": 5310,
      "distanceAU": 0.243,
      "angularDiameterDeg": 1.820284633026857,
      "centreDiscWidthFraction": 0.02751590700989427,
      "irradianceEarth": 8.356346351468558,
      "approximateSrgb": [
        1,
        0.9176316035321856,
        0.8481171538623429
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "CONDITIONAL SURFACE HYPOTHESIS",
    "skyLabel": "CONDITIONAL SKY FROM THE SURFACE",
    "surfaceMap": {
      "key": "tauCetHBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular north-up imagined albedo; no measured surface frame.",
      "coverage": "Entire globe imagined, conditional on planetary existence.",
      "url": "/bespoke/tau-cet-h-surface-map.jpg",
      "previewUrl": "/bespoke/tau-cet-h-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-342240b8-6a5a-4cc3-8eef-2aaf2a9f50b8.png",
      "sourceSha256": "37dc741dfb917737a212eff959703b8934f0838bfac98a596ce7f39f461c73bc",
      "sha256": "0fe2afeef6078fe4f31d64c92f7ab05a6387ece571be6eb5d6abdfabc4f29e14",
      "previewSha256": "dd508756c967f1033e7f408d275516a6beda49582fd132883fe9559c88123a3f",
      "bytes": 614386,
      "previewBytes": 39819,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "Bright-core bounding box in star-only ROI x40–60%, y7–28%; R>180/210/240, G>150, B>80; glare not calibrated photosphere.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          49,
          49,
          47
        ],
        "geometricTargetWidthPixels": 46.00659652054322,
        "limits": "Nominal camera field and angular/raster scale approximate; no calibrated photometry."
      },
      "url": "/bespoke/tau-cet-h-sky-image.jpg",
      "previewUrl": "/bespoke/tau-cet-h-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-7d7cbbc1-fb6d-4674-b9ad-82c86924bbcf.png",
      "sourceSha256": "ab44d3681ff362eaa68ab893991cefa0d151eb0c61b7920453247a5352f93db2",
      "sha256": "df559aacb17354a1189fc1539ce749f481e5e72826840526d74ec1935f18fbc4",
      "previewSha256": "00583cf4be51fbfad764f2e01f54d7196354ff6ee9cc088d634c1e6770f0f0b0",
      "bytes": 296825,
      "previewBytes": 54898,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/tau-ceti-source-records.json"
  },
  "epsilon-indi-b": {
    "id": "epsilon-indi-b",
    "name": "Epsilon Indi Ab",
    "aliases": [
      "eps Ind A b",
      "Epsilon Indi Ab",
      "Epsilon Indi A b",
      "HD 209100 b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Native JWST/MIRI infrared images detect an unresolved planet point source in 2023 and 2025. No resolved surface or cloud-top map exists; infrared display colours do not measure visible colour.",
    "measured": [
      "JWST/MIRI directly detected a point source; the second high-significance epoch confirms shared proper motion.",
      "2025-05-10 F1140C photometry combined with earlier 10.6 μm observations gives a 0.88±0.08 mag colour difference, strong photometric evidence for ammonia."
    ],
    "modelled": [
      "Matthews et al. 2026 orbital fit: dynamical mass 7.63(-0.70,+0.73) Jupiter masses, semimajor axis 20.9(-3.3,+5.8) AU, period 108(-25,+49) years, eccentricity 0.244(-0.083,+0.11). These updated models differ from archive composite orbit values; catalogue snapshot is preserved.",
      "Effective temperature around 200–300 K is atmospheric/evolutionary inference, not measured solid-ground temperature. Water-ice clouds are the preferred explanation for shallow ammonia absorption; low metallicity or nitrogen depletion remain alternatives.",
      "Archive host 4700 K and 0.713 solar radius adopted for representative illumination. Archive radius 12.7 Earth radii is not a transit measurement; no resolved planetary radius."
    ],
    "unknown": [
      "Visible colour, actual radius, cloud distribution, pressure, winds, rotation and detailed abundances are not directly measured.",
      "There is no accessible solid ground; the hypothetical observer floats above clouds. Native infrared point-source size is an instrumental response, not the physical planetary disc."
    ],
    "assumed": [
      "An H2/He envelope with trace ammonia and methane and patchy water-ice cirrus is the selected hypothesis, not a measured composition profile.",
      "Pearl-gray/ivory feathered cloud sheets above blue-gray gaps and cellular shear patterns are independently invented; no observed planetary map was reused.",
      "Hovering above the cloud canopy beneath an optically thin upper atmosphere is imagined; altitude, pressure, sky scattering, horizon and exposure are not registered. Clouds are not visibly glowing due to internal heat.",
      "Representative 20.9 AU distance and artistic 60-degree horizontal field give 0.01818-degree host diameter and 0.000512 Earth stellar irradiation. Warm-white stellar colour is an approximate blackbody guide, not calibrated radiometry.",
      "Raster validation: thresholds180/210/240 give bright core widths 3/3/3 original pixels versus geometric target 0.459448 pixels. The photosphere is subpixel and represented by unresolved glare; no calibrated disc-size or field claim."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/2603.08780v1",
        "title": "Matthews et al. 2026: repeat JWST detection, ammonia photometry and cloud models",
        "publicationDate": "2026-03-09 (arXiv v1)",
        "observationDate": "2025-05-10; original JWST epoch 2023"
      },
      {
        "url": "https://esawebb.org/images/weic2421a/",
        "title": "ESA/Webb 2024 native MIRI point-source image, false-colour description and credits",
        "publicationDate": "2024-07-24",
        "observationDate": "2023; exact day not independently verified"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA Exoplanet Archive composite snapshot retrieved 2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "eps Ind A b",
      "hostname": "eps Ind A",
      "sy_dist": 3.63857,
      "pl_rade": 12.7,
      "pl_bmasse": 2065.8846455,
      "pl_bmassprov": "Mass",
      "pl_orbper": 25450,
      "pl_orbsmax": 15.76,
      "pl_eqt": 275,
      "st_teff": 4700,
      "st_rad": 0.713,
      "st_mass": 0.8,
      "st_spectype": "K5 V",
      "ra": 330.8714021,
      "dec": -56.7969023,
      "disc_year": 2019
    },
    "skyModel": {
      "star": "Epsilon Indi A",
      "radiusSun": 0.713,
      "temperatureK": 4700,
      "distanceAU": 20.9,
      "angularDiameterDeg": 0.018179940811235196,
      "centreDiscWidthFraction": 0.00027478971134908446,
      "irradianceEarth": 0.0005116495889261526,
      "approximateSrgb": [
        1,
        0.8700302111801866,
        0.7652210359279604
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "epsilonIndiBBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular hypothetical cloud albedo; no measured frame.",
      "coverage": "Entire cloud morphology invented.",
      "url": "/bespoke/epsilon-indi-b-surface-map.jpg",
      "previewUrl": "/bespoke/epsilon-indi-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-0e8d90f7-b3ed-4ab3-bc38-798a91fe840d.png",
      "sourceSha256": "b6ac5274b2d7eeba6d715b41c713131b7312196627b03188261b84e20b61d2bf",
      "sha256": "4589e441119c627353a522cebebaadfa05d1391fd3d49d7ff0f507dc8531dbc7",
      "previewSha256": "e59a1ba6510c515554b69f7c9efcb069d363580db3d61b2ce3e9cf06275d7e35",
      "bytes": 405572,
      "previewBytes": 32715,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "surfaceLabel": "CLOUD-TOP HYPOTHESIS",
    "skyLabel": "SKY ABOVE THE CLOUDS",
    "skyImage": {
      "rasterValidation": {
        "method": "Central upper sky ROI x40–60%, y8–27%; R>180/210/240 G>150 B>80; threshold widths include glare.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          3,
          3,
          3
        ],
        "geometricTargetWidthPixels": 0.4594483973756692,
        "limits": "Subpixel photosphere represented by uncalibrated glare; artistic camera field and exposure."
      },
      "url": "/bespoke/epsilon-indi-b-sky-image.jpg",
      "previewUrl": "/bespoke/epsilon-indi-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-1d609862-ecf1-41ac-8b82-df515912a1aa.png",
      "sourceSha256": "cfb0373bd441085cbb5754e0350adcc3a22de46f28957a49614472de562fa203",
      "sha256": "70296f315295a8470a5a0b540c17b769f8d68cce3e21361e76f4557a8b5a1fc1",
      "previewSha256": "6cb7ee2417f14293047faf3f0ca56158275be8f9e77ef00be5e9a7968c6ede13",
      "bytes": 145789,
      "previewBytes": 29072,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "contextImages": [
      {
        "url": "/bespoke/epsilon-indi-b-native-2026.jpg",
        "tier": "measured",
        "description": "JWST/MIRI 11.3 μm coronagraphic detection, observed 2025-05-10; grayscale intensity with host-location annotation. Unresolved point source, not a surface photograph.",
        "credit": "E. C. Matthews et al. 2026, Figure 1, arXiv:2603.08780v1",
        "terms": "CC BY 4.0; credit retained adjacent to image.",
        "termsUrl": "https://creativecommons.org/licenses/by/4.0/",
        "sourceUrl": "https://arxiv.org/html/2603.08780v1",
        "observationDate": "2025-05-10",
        "publicationDate": "2026-03-09 (arXiv v1)",
        "sourceSha256": "b8439936319710d230ab7dd25d512d16ad3daca53a8464ff08af3e51a2ce305d",
        "sha256": "97a4e6506a85c681bff7767555bb1de7b19afb12cec9d6e7896b93d97cb99106",
        "bytes": 89216,
        "processing": "Original 600×600 PNG retained in research source cache; JPEG quality 95 derivative, no recolouring or cropping."
      },
      {
        "url": "/bespoke/epsilon-indi-b-native-2024.jpg",
        "tier": "measured",
        "description": "JWST/MIRI 2023 point-source detection released 2024-07-24; 10.6 μm assigned blue and 15.5 μm orange. False colour, not visible planetary colour or a resolved cloud map.",
        "credit": "ESA/Webb, NASA, CSA, STScI, E. Matthews (Max Planck Institute for Astronomy)",
        "terms": "CC BY 4.0; credit retained adjacent to image.",
        "termsUrl": "https://esawebb.org/copyright/",
        "sourceUrl": "https://esawebb.org/images/weic2421a/",
        "observationDate": "2023; exact observing day not independently verified",
        "publicationDate": "2024-07-24",
        "sourceSha256": "c491c3f9136a1bf3288ebe812935a1547941bd37fae8815a3294bb6d1c76688c",
        "sha256": "c491c3f9136a1bf3288ebe812935a1547941bd37fae8815a3294bb6d1c76688c",
        "bytes": 69456,
        "processing": "Publisher screensize JPEG copied byte-for-byte; no recolouring or cropping."
      }
    ],
    "researchSourcesRecord": "docs/research/epsilon-indi-b-source-records.json"
  },
  "gj1061-b": {
    "id": "gj1061-b",
    "name": "GJ 1061 b",
    "aliases": [
      "GJ 1061 b",
      "Gliese 1061 b",
      "Gl 1061 b"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "No native planetary image or resolved surface map located in the checked discovery/follow-up papers and NASA catalogue. Planet detected by radial velocities; catalogue render is not a photograph.",
    "measured": [
      "HARPS and ESPRESSO radial-velocity time series constrain the compact three-planet system; no measured planetary surface or atmospheric spectrum located."
    ],
    "modelled": [
      "Dreizler et al. 2025 Table 4 coplanar Newtonian Model D5: period 3.2073(-0.0003,+0.0002)days and dynamical mass 1.11(-0.09,+0.11)Earth masses. Stellar-noise model-averaged uncertainty is(-0.11,+0.15). This is interaction-model inference, not a transit mass/radius measurement.",
      "The v1 abstract instead quotes1.07±0.11 Earth masses; this dossier explicitly selects the Table 4 D5 posterior, also used by the archive composite. The discovery2019/2020 minimum-mass value is superseded by the later dynamical model.",
      "Adopted archive orbit 0.021 AU and host 0.156 solarRadius/2953 K. Table 1 also lists an alternate0.19 solarRadius/2999 K parameter set; angular size depends on the chosen host parameters.",
      "Planet radius 1.04 Earth radii is inferred assuming Earth density, not a measured radius. Archive equilibrium388.11 K is not measured surface temperature; adopted albedo changes equilibrium models."
    ],
    "unknown": [
      "Physical radius, bulk composition, atmosphere, pressure, visible colour, terrain, rotation and observer location remain unmeasured.",
      "A rocky composition is plausible from mass but not directly established; atmosphere or volatile-rich alternatives remain possible. Companion planets are outside the chosen field, not registered to an observing date."
    ],
    "assumed": [
      "Selected dry airless silicate/iron scenario; atmospheric absence and chemistry are invented, not detected.",
      "Pale taupe folded crust belts, slate-gray fractured rock slabs, dark iron-mineral seams and muted warm-brown dust are original invented geography. No liquid water, active lava or vegetation inferred.",
      "Black sky assumes negligible atmosphere; photospheric mottling, surface illumination, foreground shadows and colour adaptation are artistic.",
      "Representative semimajor-axis illumination, centred nominal 60-degree rectilinear field; not a dated ephemeris or calibrated camera.",
      "Raster validation: source width 1672, threshold180/210/240 core widths 87/87/87 pixels versus skyGeometry target 100.105538 pixels. Core/glare and photospheric texture remain approximate; exact field and angular-size calibration open."
    ],
    "references": [
      {
        "url": "https://arxiv.org/html/2504.10926v1",
        "title": "Dreizler et al. 2025, interaction-based masses and unmeasured radii",
        "publicationDate": "2025-04-15 (arXiv v1)",
        "observationDate": "HARPS about20-year baseline; ESPRESSO Table5 BJD2460219.807560–2460301.566125"
      },
      {
        "url": "https://arxiv.org/abs/1908.04717v1",
        "title": "Dreizler et al. 2019/2020, HARPS discovery campaign",
        "publicationDate": "2019-08-13 (arXiv v1); journal2020-01-29",
        "observationDate": "RedDots2018 plus archival HARPS"
      },
      {
        "url": "https://science.nasa.gov/exoplanet-catalog/gj-1061-b/",
        "title": "NASA catalogue: radius labelled estimate, not native surface photography",
        "publicationDate": "2026-03-13 (page update)"
      },
      {
        "url": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name%2Chostname%2Csy_dist%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_orbper%2Cpl_orbsmax%2Cpl_eqt%2Cst_teff%2Cst_rad%2Cst_mass%2Cst_spectype%2Cra%2Cdec%2Cdisc_year+from+pscomppars+where+sy_dist+is+not+null+and+sy_dist+%3C+10&format=json",
        "title": "NASA archive composite snapshot retrieved2026-10-10",
        "retrieved": "2026-10-10"
      }
    ],
    "archiveConstraints": {
      "pl_name": "GJ 1061 b",
      "hostname": "GJ 1061",
      "sy_dist": 3.67278,
      "pl_rade": 1.04,
      "pl_bmasse": 1.11,
      "pl_bmassprov": "Mass",
      "pl_orbper": 3.2073,
      "pl_orbsmax": 0.021,
      "pl_eqt": 388.11,
      "st_teff": 2953,
      "st_rad": 0.156,
      "st_mass": 0.12,
      "st_spectype": "M5.5 V",
      "ra": 54.0032486,
      "dec": -44.5143104,
      "disc_year": 2020
    },
    "skyModel": {
      "star": "GJ 1061",
      "radiusSun": 0.156,
      "temperatureK": 2953,
      "distanceAU": 0.021,
      "angularDiameterDeg": 3.9595054541638004,
      "centreDiscWidthFraction": 0.059871733289288506,
      "irradianceEarth": 3.7805858577808165,
      "approximateSrgb": [
        1,
        0.6887433448670173,
        0.41813027559137395
      ],
      "horizontalFovDeg": 60,
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "gj1061BBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular albedo hypothesis; no measured physical frame.",
      "coverage": "All terrain invented.",
      "url": "/bespoke/gj1061-b-surface-map.jpg",
      "previewUrl": "/bespoke/gj1061-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-5e35c47a-3f2f-497d-a828-bbd275a7b00c.png",
      "sourceSha256": "a8c425363c2dea5d57cff50b20a00c74d0ff91b2adf31f0a63775f9f2b4f8f42",
      "sha256": "74ef56e0145b02bad9a83b3fca610775fcd432068e0a0c411c56bb0326ec0169",
      "previewSha256": "5a064c2904ca69fdde2af61fd462e409b9681d8fea1b07e2dc85171ebcb52362",
      "bytes": 529631,
      "previewBytes": 33547,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "method": "ROI x30–70%, y7–32%; R>180/210/240 G>150 B>80; includes unresolved glare/exposure effects.",
        "sourceWidth": 1672,
        "thresholdWidthsPixels": [
          87,
          87,
          87
        ],
        "geometricTargetWidthPixels": 100.10553805969039,
        "limits": "Nominal FOV, angular/raster registration and colour remain artistic; photospheric texture imagined."
      },
      "url": "/bespoke/gj1061-b-sky-image.jpg",
      "previewUrl": "/bespoke/gj1061-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-92c3cbb9-a53f-4e3d-855c-666fa20412c7.png",
      "sourceSha256": "3e0184443e8718f216ff93d72e6cf4413a0ace4a5a8955785f857f6dd18a43d0",
      "sha256": "d584ff01de1d136252545148dd020f4fd6bc6cf2ca0b44d329d11c72453c4de9",
      "previewSha256": "16a9a2b1d2c0ceaadd1e4d7fbe9fc205922c5add5241bc542738695b3ea44924",
      "bytes": 302554,
      "previewBytes": 55839,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "researchSourcesRecord": "docs/research/gj1061-b-source-records.json"
  },
  "proxima-star": {
    "id": "proxima-star",
    "name": "Proxima Centauri",
    "kind": "star",
    "aliases": [
      "Proxima Cen",
      "Proxima Centauri",
      "Proxima",
      "GJ 551",
      "Gliese 551",
      "HIP 70890"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Native Hubble WFPC2 point-source image, not a resolved photosphere. R675/I814 filters include near infrared; displayed colour is not calibrated visible colour.",
    "measured": [
      "Ribas et al. 2017 infer effective temperature 2980±80 K, radius 0.146±0.007 solar radii, mass 0.120±0.003 solar masses and luminosity 0.00151±0.00008 solar luminosities from radiative observations/models.",
      "Hubble WFPC2 records the unresolved star; release 2013-10-28. Exact observation date is not independently verified."
    ],
    "modelled": [
      "A fully convective low-mass hydrogen/helium plasma star; effective temperature is a spectral fit, not a resolved surface thermometer."
    ],
    "unknown": [
      "Resolved magnetic-region geography, convective cell sizes and contrast, detailed abundance fractions, chromospheric geometry and calibrated visible raster colour."
    ],
    "assumed": [
      "Independent photospheric intensity map with invented convective mottling and two dimmer magnetic regions; no observed solar map reused.",
      "Observer at two photospheric radii from centre, one radius above the photosphere, with artistic 120-degree horizontal field. No ground or physically survivable observer implied.",
      "Ribas 2017 adopted values differ from earlier planetary dossiers (2900 K / 0.141 solar radii); those dossiers and catalogue fits remain preserved."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/1704.08449v1",
        "title": "Ribas et al. 2017, full spectral radiative properties",
        "publicationDate": "2017-04-27"
      },
      {
        "url": "https://esahubble.org/images/potw1343a/",
        "title": "ESA/Hubble native Proxima observation",
        "publicationDate": "2013-10-28"
      },
      {
        "url": "https://gruze.org/10pc/The10pcSample_v2.json",
        "title": "Gaia-era 10 pc sample v2; historical component inventory"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/proxima-star-native.jpg",
        "source": "https://cdn.esahubble.org/archives/images/large/potw1343a.jpg",
        "sourcePage": "https://esahubble.org/images/potw1343a/",
        "termsUrl": "https://esahubble.org/copyright/",
        "terms": "CC BY 4.0; full credit retained.",
        "credit": "ESA/Hubble & NASA",
        "tier": "measured",
        "description": "Unresolved WFPC2 point source, R675/I814 false colour including near infrared; not a resolved photosphere.",
        "publicationDate": "2013-10-28",
        "observationDate": null,
        "sha256": "163774dc420405e6b15e0cbc3fac0b87dc93f405a7e39c4b5d14dcbcfb19a136",
        "bytes": 69746
      }
    ],
    "skyModel": {
      "star": "Proxima Centauri",
      "radiusSun": 0.146,
      "temperatureK": 2980,
      "distanceAU": 0.00135793644020095,
      "horizontalFovDeg": 120,
      "observerNote": "Conceptual camera one photospheric radius above plasma; orientation and exposure imagined.",
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 821.3090203565752,
      "approximateSrgb": [
        1,
        0.6922937494969719,
        0.42558860954259126
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "proximaStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, invented longitude, no measured stellar frame.",
      "coverage": "Entire photosphere imagined; intensity tinted by approximate catalogue colour.",
      "url": "/bespoke/proxima-star-surface-map.jpg",
      "previewUrl": "/bespoke/proxima-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-ac961f63-ff96-4bea-86f2-b616a7e25af6.png",
      "sourceSha256": "349fdb62b483f93a6aad9b709996c7b95d091d5c2a01650ed18bf0e03b6457ff",
      "sha256": "bdaff087b5f638e8e6bbe73003876edd7b8f2a629e186be13e3c1fa808ab4f4b",
      "previewSha256": "56234b436fc49b2e0f4cbe4149c1613f80df3da94314c3d934336c9865947d1f",
      "bytes": 382433,
      "previewBytes": 35309,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          545,
          545,
          545
        ],
        "limits": "Threshold cores do not locate a calibrated photospheric limb. Field, exposure, colour and magnetic geography remain artistic."
      },
      "url": "/bespoke/proxima-star-sky-image.jpg",
      "previewUrl": "/bespoke/proxima-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-26e6f6e4-cce8-4e82-b7cc-b9b779351033.png",
      "sourceSha256": "9b10e5d1a9c7d46c0109f1d4ab1258572f98c2360580c658b491ca2f6933faf9",
      "sha256": "9ba2032fb5bba03666c8ab8c29a75c89778271f5c876fdafc94093360999801d",
      "previewSha256": "4fe25f5373488bc9f869d3d28096f1963d95e83e042d7b5cf861486cd54e6245",
      "bytes": 63547,
      "previewBytes": 12601,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "alpha-centauri-a-star": {
    "id": "alpha-centauri-a-star",
    "name": "Alpha Centauri A",
    "kind": "star",
    "aliases": [
      "Alpha Centauri A",
      "Alpha Cen A",
      "alf Cen A",
      "Rigil Kentaurus",
      "HD 128620"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "A is Rigil Kentaurus / G2V, left in Hubble portrait.",
    "nativeSurface": "Hubble optical/near-infrared unresolved binary point sources plus Webb infrared observational graphic. Neither resolves photospheric geography; displayed false colours are not calibrated visible colours.",
    "measured": [
      "Kervella2017 H-band interferometric limb-darkened diameter8.502±0.038mas; radius1.2234±0.0053 solar radii using747.17±0.61mas parallax.",
      "The Hubble portrait records A left and B right; released2016-08-29, filters457nm and850nm; exact observing day unverified."
    ],
    "modelled": [
      "Adopted representative effective temperature5795K (±19K reference uncertainty) from interferometric radii and bolometric flux, reviewed by Thévenin2023 quoting Morel2018/Kervella2017. Hydrogen/helium plasma and outer convection are stellar-model context, not measured abundance mass fractions.",
      "Thévenin2023 also reports updated radius/temperature alternatives A1.2175Rsun5800K/B0.8591Rsun5236K using Akeson2021 astrometry; catalogue and orbit values preserved.",
      "Webb2025 graphic combines infrared data, subtraction and annotations; source publisher classifies Artwork. S1 remains a candidate, not a confirmed planet or observed stellar surface."
    ],
    "unknown": [
      "Resolved convection, actual magnetic spot pattern, calibrated visible intensity/colour, precise abundance fractions and chromospheric geometry."
    ],
    "assumed": [
      "Independent two modest dim magnetic patches and finer granulation; all photospheric geography invented, no Sun or another component map reused.",
      "Conceptual observer two photospheric radii from centre, one radius above plasma, artistic120-degree field; no solid ground or physically survivable landing.",
      "Companion lies outside this chosen field; no dated binary orientation, companion angular location or photometric calibration is claimed."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/1610.06185v1",
        "title": "Kervella et al., interferometric radii and limb darkening",
        "publicationDate": "2016-10-19"
      },
      {
        "url": "https://alphacen2023.sciencesconf.org/data/pages/alphaCen_thevenin.pdf",
        "title": "Thévenin2023, fundamental parameters and alternative atmosphere fits",
        "publicationDate": "2023-06"
      },
      {
        "url": "https://esahubble.org/images/potw1635a/",
        "title": "ESA/Hubble native binary portrait",
        "publicationDate": "2016-08-29"
      },
      {
        "url": "https://esawebb.org/images/weic2515c/",
        "title": "ESA/Webb2025 annotated infrared observation graphic",
        "publicationDate": "2025-08-07"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/alpha-centauri-native.jpg",
        "source": "https://cdn.esahubble.org/archives/images/large/potw1635a.jpg",
        "sourcePage": "https://esahubble.org/images/potw1635a/",
        "credit": "ESA/Hubble & NASA",
        "terms": "CC BY4.0; complete publisher credit retained.",
        "termsUrl": "https://esahubble.org/copyright/",
        "publicationDate": "2016-08-29",
        "observationDate": null,
        "sha256": "bcf60e265c67955f35b8dd7b490de2902da5499c110961a78cb0671619e3162b",
        "bytes": 107856,
        "tier": "measured",
        "description": "A left, B right: unresolved optical/near-infrared point sources, not resolved surfaces."
      },
      {
        "url": "/bespoke/alpha-centauri-webb.jpg",
        "source": "https://cdn.esawebb.org/archives/images/screen/weic2515c.jpg",
        "sourcePage": "https://esawebb.org/images/weic2515c/",
        "credit": "NASA, ESA, CSA, STScI, A. Sanghi (Caltech), C. Beichman (JPL), D. Mawet (Caltech), J. DePasquale (STScI)",
        "terms": "CC BY4.0; complete publisher credit retained.",
        "termsUrl": "https://esawebb.org/copyright/",
        "publicationDate": "2025-08-07",
        "observationDate": null,
        "sha256": "1f3ddd5a2a5ad003960b710a84d1fe45423d6ba24135c784661674dd98c5536f",
        "bytes": 122690,
        "tier": "modelled",
        "description": "2025 annotated infrared observational composite; diffraction, coronagraph and subtraction patterns are instrumental. A/B and candidate S1 identified by original publisher; no visible-colour photosphere.",
        "label": "NATIVE INFRARED DATA · ANNOTATED GRAPHIC"
      }
    ],
    "skyModel": {
      "star": "Alpha Centauri A",
      "radiusSun": 1.2234,
      "temperatureK": 5795,
      "distanceAU": 0.011378763294122208,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 11745.061564082493,
      "approximateSrgb": [
        1,
        0.9517261540134383,
        0.9060424466767338
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "alphaCentauriABespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, invented longitude; no measured stellar geography/frame.",
      "coverage": "Entire photosphere imagined; neutral intensity tinted by approximate catalogue colour.",
      "url": "/bespoke/alpha-centauri-a-star-surface-map.jpg",
      "previewUrl": "/bespoke/alpha-centauri-a-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-e8457ef9-f92a-4b1e-9956-6172d1c8aa1b.png",
      "sourceSha256": "75ce390124ca460733e4ead25c31e9c97d33dee65e5c207ee0ee88a468a89a63",
      "sha256": "18c734022d7a7a1220620ccc9c35dd9ac84366eafee7a377db4417456a849724",
      "previewSha256": "baf17362a82b86f2e3d7be121fe190768b487798eef9d3ec9cbff8d9922ba812",
      "bytes": 367537,
      "previewBytes": 35177,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          453,
          453,
          451
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Bright thresholds do not establish a calibrated limb. Colour, exposure, magnetic regions, FOV and orientation are artistic."
      },
      "url": "/bespoke/alpha-centauri-a-star-sky-image.jpg",
      "previewUrl": "/bespoke/alpha-centauri-a-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-9119edd6-c736-43aa-9ecd-a27079300643.png",
      "sourceSha256": "96a20e6fd8698ab22697255629ab59e4ef88b49b23747d1b375938c258de675c",
      "sha256": "098c42b771cb3f7a6c516d764030c4454acf66b309d36b5d55ef0b1cd563adf9",
      "previewSha256": "d1bfe9a1bd14d1e69e2dbf7700773397f7f09684974b8525899d696bc051f152",
      "bytes": 59078,
      "previewBytes": 11641,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "alpha-centauri-b-star": {
    "id": "alpha-centauri-b-star",
    "name": "Alpha Centauri B",
    "kind": "star",
    "aliases": [
      "Alpha Centauri B",
      "Alpha Cen B",
      "alf Cen B",
      "Toliman",
      "HD 128621"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "B is Toliman / K1V, right in Hubble portrait.",
    "nativeSurface": "Hubble optical/near-infrared unresolved binary point sources plus Webb infrared observational graphic. Neither resolves photospheric geography; displayed false colours are not calibrated visible colours.",
    "measured": [
      "Kervella2017 H-band interferometric limb-darkened diameter5.999±0.025mas; radius0.8632±0.0037 solar radii using747.17±0.61mas parallax.",
      "The Hubble portrait records A left and B right; released2016-08-29, filters457nm and850nm; exact observing day unverified."
    ],
    "modelled": [
      "Adopted representative effective temperature5231K (±21K reference uncertainty) from interferometric radii and bolometric flux, reviewed by Thévenin2023 quoting Morel2018/Kervella2017. Hydrogen/helium plasma and outer convection are stellar-model context, not measured abundance mass fractions.",
      "Thévenin2023 also reports updated radius/temperature alternatives A1.2175Rsun5800K/B0.8591Rsun5236K using Akeson2021 astrometry; catalogue and orbit values preserved.",
      "Webb2025 graphic combines infrared data, subtraction and annotations; source publisher classifies Artwork. S1 remains a candidate, not a confirmed planet or observed stellar surface."
    ],
    "unknown": [
      "Resolved convection, actual magnetic spot pattern, calibrated visible intensity/colour, precise abundance fractions and chromospheric geometry."
    ],
    "assumed": [
      "Independent three irregular dim magnetic groups and distinct tangled cells; all photospheric geography invented, no Sun or another component map reused.",
      "Conceptual observer two photospheric radii from centre, one radius above plasma, artistic120-degree field; no solid ground or physically survivable landing.",
      "Companion lies outside this chosen field; no dated binary orientation, companion angular location or photometric calibration is claimed."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/1610.06185v1",
        "title": "Kervella et al., interferometric radii and limb darkening",
        "publicationDate": "2016-10-19"
      },
      {
        "url": "https://alphacen2023.sciencesconf.org/data/pages/alphaCen_thevenin.pdf",
        "title": "Thévenin2023, fundamental parameters and alternative atmosphere fits",
        "publicationDate": "2023-06"
      },
      {
        "url": "https://esahubble.org/images/potw1635a/",
        "title": "ESA/Hubble native binary portrait",
        "publicationDate": "2016-08-29"
      },
      {
        "url": "https://esawebb.org/images/weic2515c/",
        "title": "ESA/Webb2025 annotated infrared observation graphic",
        "publicationDate": "2025-08-07"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/alpha-centauri-native.jpg",
        "source": "https://cdn.esahubble.org/archives/images/large/potw1635a.jpg",
        "sourcePage": "https://esahubble.org/images/potw1635a/",
        "credit": "ESA/Hubble & NASA",
        "terms": "CC BY4.0; complete publisher credit retained.",
        "termsUrl": "https://esahubble.org/copyright/",
        "publicationDate": "2016-08-29",
        "observationDate": null,
        "sha256": "bcf60e265c67955f35b8dd7b490de2902da5499c110961a78cb0671619e3162b",
        "bytes": 107856,
        "tier": "measured",
        "description": "A left, B right: unresolved optical/near-infrared point sources, not resolved surfaces."
      },
      {
        "url": "/bespoke/alpha-centauri-webb.jpg",
        "source": "https://cdn.esawebb.org/archives/images/screen/weic2515c.jpg",
        "sourcePage": "https://esawebb.org/images/weic2515c/",
        "credit": "NASA, ESA, CSA, STScI, A. Sanghi (Caltech), C. Beichman (JPL), D. Mawet (Caltech), J. DePasquale (STScI)",
        "terms": "CC BY4.0; complete publisher credit retained.",
        "termsUrl": "https://esawebb.org/copyright/",
        "publicationDate": "2025-08-07",
        "observationDate": null,
        "sha256": "1f3ddd5a2a5ad003960b710a84d1fe45423d6ba24135c784661674dd98c5536f",
        "bytes": 122690,
        "tier": "modelled",
        "description": "2025 annotated infrared observational composite; diffraction, coronagraph and subtraction patterns are instrumental. A/B and candidate S1 identified by original publisher; no visible-colour photosphere.",
        "label": "NATIVE INFRARED DATA · ANNOTATED GRAPHIC"
      }
    ],
    "skyModel": {
      "star": "Alpha Centauri B",
      "radiusSun": 0.8632,
      "temperatureK": 5231,
      "distanceAU": 0.00802856667932507,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 7797.949466399684,
      "approximateSrgb": [
        1,
        0.9117845260802663,
        0.8380680822793982
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceMap": {
      "key": "alphaCentauriBBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, invented longitude; no measured stellar geography/frame.",
      "coverage": "Entire photosphere imagined; neutral intensity tinted by approximate catalogue colour.",
      "url": "/bespoke/alpha-centauri-b-star-surface-map.jpg",
      "previewUrl": "/bespoke/alpha-centauri-b-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-3155d3d2-5ad9-44cf-bdf9-4f7b002310b8.png",
      "sourceSha256": "3d3528ebbebbad777302c8c543452026666a41ba805fa82d9ebf3bb452cee2e7",
      "sha256": "510b8ce1463f77cddab7b22ce34dc1ffa6ec03214f4102d2fd18426296106189",
      "previewSha256": "83b90aa3a213be4ed63e3179f9eacf769c11b97c17d54904ed719b277d15d723",
      "bytes": 388277,
      "previewBytes": 36794,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          443,
          443,
          443
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Bright thresholds do not establish a calibrated limb. Colour, exposure, magnetic regions, FOV and orientation are artistic."
      },
      "url": "/bespoke/alpha-centauri-b-star-sky-image.jpg",
      "previewUrl": "/bespoke/alpha-centauri-b-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-5926dfa7-f63b-4442-8497-21653219e388.png",
      "sourceSha256": "ac81b599b4bf31bc77b8f6a628a62eb6f4218e4621ea1fe5537a574818cd16b5",
      "sha256": "0d1da2abd079a03cd84d9a22427df4d2544050718b13257ec64d4b34e04f6958",
      "previewSha256": "10edecfab26a2f1645e7085f46894758855cf178b3499dd1b27b6cf0b9b66c8d",
      "bytes": 55244,
      "previewBytes": 10992,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "barnard-star": {
    "id": "barnard-star",
    "name": "Barnard's Star",
    "kind": "star",
    "aliases": [
      "Barnard's Star",
      "Barnard Star",
      "Barnards Star",
      "GJ 699",
      "Gliese 699",
      "HIP 87937"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Native DSS2 multi-epoch point-source field; displayed red/yellow/blue locations encode motion, not calibrated stellar colour.",
    "measured": [
      "BarnardStar/GJ699 is a nearby M dwarf with rapid proper motion; DSS2 exposures show distinct epoch positions.",
      "Native ESO survey composite released2018-11-14; precise three plate observing epochs are not independently verified."
    ],
    "modelled": [
      "Adopted3195±28K and0.185±0.006solar radii from Stefanov2025 Table1; atmospheric/interferometric fits, not resolved surface geography. Primary values checked through published table; direct publisher PDF download returned403, no figure reused.",
      "Cool molecular photospheric gas is only partly ionized. Hydrogen/helium is a broad stellar-model composition, not a fully ionized outer-layer or measured abundance-fraction claim."
    ],
    "unknown": [
      "Actual convective morphology, magnetic patch geography, photospheric intensity contrast, detailed hydrogen/helium/metal abundance fractions and calibrated visible colour."
    ],
    "assumed": [
      "Independent weak sparse magnetic dimming and subtle fine convective mottling; hydrogen/helium plasma stellar-model context. No measured spots or dated flare are claimed.",
      "Conceptual observer two photospheric radii from centre, one radius above plasma, artistic120-degree horizontal field; no solid ground or survivable landing.",
      "Independent intensity and observer images; no observed Sun or another star map reused. Stellar tint, exposure, magnetic geometry and raster registration remain approximate."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://www.aanda.org/articles/aa/pdf/2025/01/aa52450-24.pdf",
        "title": "Stefanov2025 Table1 stellar parameters",
        "publicationDate": "2025-01"
      },
      {
        "url": "https://arxiv.org/html/2503.08095v1",
        "title": "Basant2025 four-planet confirmation and stellar activity",
        "publicationDate": "2025-03-11"
      },
      {
        "url": "https://eso.org/public/images/eso1837d/",
        "title": "ESO/DSS2 native multi-epoch stellar field",
        "publicationDate": "2018-11-14"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/barnard-star-native.jpg",
        "source": "https://cdn.eso.org/images/screen/eso1837d.jpg",
        "sourcePage": "https://eso.org/public/images/eso1837d/",
        "credit": "ESO/Digitized Sky Survey 2 · Acknowledgement: Davide De Martin · E — Red Dots",
        "terms": "CC BY4.0; full ESO/DSS2 credits retained.",
        "termsUrl": "https://www.eso.org/public/outreach/copyright/",
        "publicationDate": "2018-11-14",
        "observationDate": null,
        "sha256": "a940f7110f626b0e62829b84ef26de80e5b7db5feae82f47fe4e1dd0ed276446",
        "bytes": 633054,
        "tier": "measured",
        "description": "DSS2 multi-epoch wide-field image shows BarnardStar at three positions. Red/yellow/blue depict time/motion, not calibrated visible colour or resolved photosphere."
      }
    ],
    "skyModel": {
      "star": "Barnard's Star",
      "radiusSun": 0.185,
      "temperatureK": 3195,
      "distanceAU": 0.0017206728865559984,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 1085.2379850224106,
      "approximateSrgb": [
        1,
        0.7194683096347383,
        0.48158519102838504
      ],
      "limits": "Conceptual observer altitude is assumed, not a planetary semimajor axis. Camera field, spectra, molecular absorption, exposure and adaptation prevent calibrated colour/raster claims."
    },
    "surfaceMap": {
      "key": "barnardStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, invented longitude; no measured surface frame.",
      "coverage": "Entire photosphere imagined; intensity tinted by approximate catalogue colour.",
      "url": "/bespoke/barnard-star-surface-map.jpg",
      "previewUrl": "/bespoke/barnard-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-26853285-09fb-46af-9f28-bdd5f10e8d82.png",
      "sourceSha256": "6a07b46f2ece9848b18522e4667683784b806416ede2fe1ef4dc5fe5774368a5",
      "sha256": "c2641a5f041991b067961c2aa529d51e78565bfb68ec0ace0aa30fb004787d7a",
      "previewSha256": "1633a0de5237237f9434fef734aaadf9ba77c2af987129f4a729d5828a8d7ea3",
      "bytes": 396406,
      "previewBytes": 36009,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          526,
          526,
          518
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Threshold widths do not locate a calibrated stellar limb. FOV, colour, spectral tint and exposure remain artistic."
      },
      "url": "/bespoke/barnard-star-sky-image.jpg",
      "previewUrl": "/bespoke/barnard-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-b2079f13-1e64-47d5-a5ab-ea992cd14337.png",
      "sourceSha256": "25d233b7517758983ddc390aea0d752632c01ede0fed61aea42e72adad168983",
      "sha256": "c547fc86b242916527fed6e7efc3d4570d1fdfb75578e8599fe6f1320c5df209",
      "previewSha256": "22a272fb302332edb44c8263661c5869a1d089b01e70be0a5ecf9d6fc67a68db",
      "bytes": 58608,
      "previewBytes": 11607,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "wolf-star": {
    "id": "wolf-star",
    "name": "Wolf 359",
    "kind": "star",
    "aliases": [
      "Wolf 359",
      "CN Leo",
      "GJ 406",
      "Gliese 406"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Native New Horizons/Earth processed grayscale stereo point-source scene, not resolved photosphere.",
    "measured": [
      "Wolf359/CNLeo/GJ406 is the same M6 active dwarf; Gaia-era parallax415.18±0.07mas gives2.4086±0.0004pc in Bowens-Rubin2023.",
      "Native LORRI Wolf359 frames were observed2020-04-23 at7:45:07/12/17UT; processed NewHorizons/Earth stereo product released2020-06-10."
    ],
    "modelled": [
      "Pineda2021 Table8 empirical Bayesian stellar fits give0.110±0.003solar masses,0.144±0.004solar radii and2749+44/-41K. These are inferred stellar parameters, not resolved surface measurements.",
      "Bowens-Rubin2023 Table1 mislabels radius with a mass unit; original Pineda radius-column units checked as solar radii. Lin2025 uses alternative0.16Rsun2800K; both are disclosed, catalogue values preserved.",
      "Lin2025 observed quiescent optical spectra2021-04-20: strong TiO absorption means an ideal blackbody overestimates optical output. Approximate blackbody tint is not a measured visible spectrum.",
      "Cool molecular photospheric gas is only partly ionized. Hydrogen/helium is a broad stellar-model composition, not a fully ionized outer-layer or measured abundance-fraction claim."
    ],
    "unknown": [
      "Actual convective morphology, magnetic patch geography, photospheric intensity contrast, detailed hydrogen/helium/metal abundance fractions and calibrated visible colour."
    ],
    "assumed": [
      "Independent three modest asymmetric magnetic patches and fine emissive mottling; fully convective hydrogen/helium stellar-model context. No dated flare is simulated.",
      "Conceptual observer two photospheric radii from centre, one radius above plasma, artistic120-degree horizontal field; no solid ground or survivable landing.",
      "Independent intensity and observer images; no observed Sun or another star map reused. Stellar tint, exposure, magnetic geometry and raster registration remain approximate."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/pdf/2106.07656",
        "title": "Pineda2021 Table8 inferred stellar parameters",
        "publicationDate": "2021-06-14"
      },
      {
        "url": "https://arxiv.org/pdf/2309.03402",
        "title": "Bowens-Rubin2023 Wolf359 imaging/RV and identification",
        "publicationDate": "2023-09-06"
      },
      {
        "url": "https://arxiv.org/html/2509.21505v1",
        "title": "Lin2025 optical spectra, flares and blackbody limitations",
        "publicationDate": "2025-09-25"
      },
      {
        "url": "https://pluto.jhuapl.edu/Learn/Parallax/Parallax-Images.php",
        "title": "Primary mission image dates, processing and credit instructions"
      },
      {
        "url": "https://arxiv.org/abs/2506.21666",
        "title": "2025 NewHorizons interstellar navigation demonstration",
        "publicationDate": "2025-06"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/wolf-star-native.jpg",
        "source": "https://www.nasa.gov/wp-content/uploads/2020/06/nh-wolf359-parallel.jpg?resize=1024,529",
        "sourcePage": "https://www.nasa.gov/solar-system/nasas-new-horizons-conducts-the-first-interstellar-parallax-experiment/",
        "credit": "NASA/Johns Hopkins Applied Physics Laboratory/Southwest Research Institute; Earth image: Mt. Lemmon Observatory, John F. Kielkopf (University of Louisville), Karen A. Collins (Harvard and Smithsonian Center for Astrophysics); stereo assembly: Tod Lauer, John Spencer, Brian May.",
        "terms": "NASA published image and mission image-use permission; complete primary credits retained.",
        "termsUrl": "https://pluto.jhuapl.edu/Learn/Parallax/Parallax-Images.php",
        "publicationDate": "2020-06-10",
        "observationDate": "2020-04-23",
        "sha256": "284b2cf89a55a6c4f5be4eb61b467f4f3521fc0dd7676cd95f2c9f411bb59c11",
        "bytes": 67049,
        "tier": "measured",
        "description": "Processed grayscale NewHorizons/Earth parallel stereo: NewHorizons left. Unresolved stellar point source; no visible-colour or photospheric surface information. Publisher1024px JPEG rendition copied unchanged."
      }
    ],
    "skyModel": {
      "star": "Wolf 359",
      "radiusSun": 0.144,
      "temperatureK": 2749,
      "distanceAU": 0.0013393345711571014,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 594.7582784950865,
      "approximateSrgb": [
        1,
        0.6608195916046241,
        0.35820236857795673
      ],
      "limits": "Conceptual observer altitude is assumed, not a planetary semimajor axis. Camera field, spectra, molecular absorption, exposure and adaptation prevent calibrated colour/raster claims."
    },
    "surfaceMap": {
      "key": "wolfStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular, invented longitude; no measured surface frame.",
      "coverage": "Entire photosphere imagined; intensity tinted by approximate catalogue colour.",
      "url": "/bespoke/wolf-star-surface-map.jpg",
      "previewUrl": "/bespoke/wolf-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-b547e1ac-9e49-42a0-b851-b923b3f45473.png",
      "sourceSha256": "251533e6c178763da3ad649b0236534f980d713d21ffbf45adfb4bdd17895f57",
      "sha256": "49616c692578ca2fba39774aef1387ab8e0fb6e5150815e25aad5a50cc3a6329",
      "previewSha256": "57a949ff4993b0743fec0fc0c2c620bb206b7f55fa9d7e257b4e962d49f8ddea",
      "bytes": 366367,
      "previewBytes": 33075,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          553,
          553,
          525
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Threshold widths do not locate a calibrated stellar limb. FOV, colour, spectral tint and exposure remain artistic."
      },
      "url": "/bespoke/wolf-star-sky-image.jpg",
      "previewUrl": "/bespoke/wolf-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-06261d3d-5ea3-4a8c-95c5-26a408022e5c.png",
      "sourceSha256": "acd6b8b6421c936cf62b85ea4a1a7d3285267d0be4c9f48d163afea770abaf52",
      "sha256": "0b75c2ba089141a882aa3a9d6ae1c1760a10e334b0d1827c3d1c7c1e70558c5a",
      "previewSha256": "53f06bfc024f326e3e00a5428595424da87bdd13a5d7e80f1831ff21dca769f6",
      "bytes": 69844,
      "previewBytes": 13717,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "lalande-star": {
    "id": "lalande-star",
    "name": "Lalande 21185",
    "kind": "star",
    "aliases": [
      "Lalande 21185",
      "HD 95735",
      "GJ 411",
      "Gliese 411",
      "Gl 411",
      "HIP 54035"
    ],
    "researchDate": "2026-10-10",
    "nativeSurface": "Native2MASS K_s infrared survey finding chart retained unchanged; saturated unresolved stellar source, not a resolved photospheric map or visible-colour measurement.",
    "measured": [
      "Hurt2022 Table2 GaiaEDR3 parallax392.753±0.032mas and distance2.54613±0.00021pc; body identity HD95735/GJ411/Lalande21185 is preserved.",
      "Historical HYG render snapshot has10.46light-years, inconsistent with this primary astrometry; preserved pending catalogue reconciliation, not claimed a current distance ranking.",
      "Native2MASS northern coadd1154968 K_s atlas FITS UT_DATE991111 matches preview metadata:1999-11-11. Publication day of this service rendering is unknown."
    ],
    "modelled": [
      "Adopted Pineda2021 Table3 empirical Bayesian/interferometry-constrained fits: radius0.392±0.004solar radii, temperature3547±18K, mass0.389±0.008solar masses.",
      "Hurt2022 Table2 alternative spectroscopic/isochrone fits: radius0.3685+0.0081/-0.0054solar radii and3719+21/-31K; different methodology, both histories retained.",
      "M2 photospheric gas is partly ionized and molecular; hydrogen/helium is broad stellar-model composition, not measured elemental fractions. Approximate blackbody tint omits molecular absorption and is not calibrated visible colour."
    ],
    "unknown": [
      "Resolved photospheric geography, dated spot distribution, convective appearance, atmospheric elemental fractions and calibrated visible colour."
    ],
    "assumed": [
      "Entire independent intensity map and observer scene are imagined; fine convection and weak magnetic dimming are illustrative, no dated flare or observed Sun map is reused.",
      "Conceptual observer two photospheric radii from centre, one radius above plasma; no solid ground or survivable landing. Artistic120-degree horizontal field, exposure and colour remain approximate."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/pdf/2106.07656",
        "title": "Pineda2021 Table3 empirical stellar parameters and Table5 astrometric inputs",
        "publicationDate": "2021-06-14"
      },
      {
        "url": "https://arxiv.org/html/2107.09087v2",
        "title": "Hurt2022 Table2 GaiaEDR3 and alternative stellar fits",
        "publicationDate": "2022-04-05"
      },
      {
        "url": "https://irsa.ipac.caltech.edu/applications/2MASS/IM/",
        "title": "Primary 2MASS image inventory and photometric limitations"
      },
      {
        "url": "https://science.nasa.gov/image-article/apod-1996-october-19-lalande-21185-the-nearest-planetary-system/",
        "title": "Historical1996 JohnWhatmough planetary artwork, not observed star surface",
        "publicationDate": "1996-10-19"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/lalande-star-native.jpg",
        "source": "https://irsa.ipac.caltech.edu/cgi-bin/2MASS/IM/nph-jpeg?file=%2Fwork%2FTMP_Zc3VSu_2428428%2FIM%2Fkey_41V1kv%2FaK_asky_991111n1530266.jpg",
        "sourcePage": "https://irsa.ipac.caltech.edu/cgi-bin/2MASS/IM/nph-im_key?ds=asky&key=1154968&band=K",
        "label": "NATIVE INFRARED FINDING CHART",
        "tier": "measured",
        "credit": "Two Micron All Sky Survey (2MASS), a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by NASA and the National Science Foundation; image service: NASA/IPAC Infrared Science Archive.",
        "terms": "Public2MASS science data; primary survey acknowledgement and full credit retained. No calibrated visible colour claimed.",
        "termsUrl": "https://irsa.ipac.caltech.edu/data/2MASS/docs/releases/allsky/doc/sec1_7.html",
        "publicationDate": null,
        "observationDate": "1999-11-11",
        "sha256": "d228f1d179b6bafc7725ee337b805d04df77c6356136f25cab3262c4168e5a7d",
        "bytes": 34475,
        "description": "Unchanged IRSA annotated K_s-band preview, coadd1154968, northern scan153 image266. FITS UT_DATE independently verifies1999-11-11. Saturated unresolved Lalande21185 lies near RA11h03m20s Dec+35d58m; grayscale/inverted infrared stretch, coordinate grid and coloured persistence/glint marks are service annotations, not visible colour, resolved photosphere or companions."
      }
    ],
    "skyModel": {
      "star": "Lalande 21185",
      "radiusSun": 0.392,
      "temperatureK": 3547,
      "distanceAU": 0.003645966332594332,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 1648.4898985067396,
      "approximateSrgb": [
        1,
        0.7602377201521329,
        0.5623785907931205
      ],
      "limits": "Conceptual observer altitude two photospheric radii from centre; not a planetary semimajor axis. Approximate blackbody colour omits molecular lines, transfer, exposure and adaptation. Nominal FOV and raster geometry remain artistic."
    },
    "surfaceMap": {
      "key": "lalandeStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular invented longitude; no measured photospheric frame.",
      "coverage": "Entire intensity/magnetic morphology imagined; renderer applies approximate catalogue tint.",
      "url": "/bespoke/lalande-star-surface-map.jpg",
      "previewUrl": "/bespoke/lalande-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-de1345a0-c985-49f9-b2e5-4d364c86c6ad.png",
      "sourceSha256": "f5b2eb9ce2063f3a03336e79e69cc5d46fd3b97a543291114619ab94e1b93635",
      "sha256": "3712108a1658da2b465f11dfb85201dfeacdab9d650a29b4772b085b60ca3cc5",
      "previewSha256": "7f7a08bc592160dce580acce2b9d3709cecfbd94724ce8e66c7751ad8a87aa14",
      "bytes": 412130,
      "previewBytes": 40199,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          514,
          514,
          514
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Thresholds do not establish a calibrated limb. Nominal FOV, tint, exposure and registration remain artistic."
      },
      "url": "/bespoke/lalande-star-sky-image.jpg",
      "previewUrl": "/bespoke/lalande-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-1d3d89e2-992d-4594-9b55-75160bd7b631.png",
      "sourceSha256": "8bc6bfc33a303e2591ca232ddef3a71652b3fdf8a3c350e5aa823af9a753db7e",
      "sha256": "0d4b05a8dbac1193758a6a613038d311f2e3dfafd62c532388701a625aea4fe3",
      "previewSha256": "5e9b5280619e174abe1abc2ac337f9ccf54c79974786ec153949bdcc3b246d46",
      "bytes": 66383,
      "previewBytes": 12844,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "sirius-a-star": {
    "id": "sirius-a-star",
    "name": "Sirius A",
    "kind": "star",
    "stellarClass": "A-type main-sequence",
    "aliases": [
      "Sirius",
      "Sirius A",
      "alf CMa A",
      "Alpha Canis Majoris A",
      "HD 48915",
      "HIP 32349",
      "Gl 244A",
      "GJ 244 A"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Native Hubble SiriusA is the overexposed central object; separate A-type main-sequence component, not SiriusB.",
    "nativeSurface": "Native unresolved stellar observations retained as context; no resolved photospheric geography or visible-colour calibration established.",
    "measured": [
      "Bond2017 dynamical mass2.063±0.023solar masses; interferometric angular diameter constrains inferred radius.",
      "Bond2017 adopted system parallax378.9±1.4mas; current component astrometry and exhaustive nearest20boundary remain unverified.",
      "Native Hubble image observed2003-10-15, released2005-12-13; bright centralA and faint lower-leftB are explicitly distinguished."
    ],
    "modelled": [
      "Bond2017 adopted interferometry/flux estimates1.7144±0.0090solar radii and9845±64K. Other compilations differ by several percent.",
      "A-type photospheric hydrogen/helium gas and observed metal-line peculiarities do not establish literal metal terrain or measured abundance fractions here.",
      "Existing binary renderer uses1.711Rsun9940K; catalogue/binary parameters remain preserved as an alternative history."
    ],
    "unknown": [
      "Resolved photospheric intensity geography, actual magnetic/convective morphology and calibrated visible colour/exposure; component distance ranking remains open."
    ],
    "assumed": [
      "Independent weak photospheric intensity mottling and observer disc; all morphology imagined, no observed Sun map or another body map reused.",
      "Conceptual camera two photospheric radii from centre, one radius above gas; no solid ground or survivable landing. Companion outside chosen viewing direction/FOV; no dated binary scene registration claimed.",
      "Nominal120-degree FOV, exposure, spectral transfer and approximate blue-white tint remain artistic."
    ],
    "surfaceLabel": "PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/1703.10625",
        "title": "Bond2017 Sirius orbital masses and inferred atmosphere/radii",
        "publicationDate": "2017-03-30"
      },
      {
        "url": "https://arxiv.org/pdf/1809.01240",
        "title": "Joyce2018 differential redshift and alternative SiriusB fit",
        "publicationDate": "2018"
      },
      {
        "url": "https://esahubble.org/images/heic0516a/",
        "title": "Primary Hubble binary image, component identities and observation date",
        "publicationDate": "2005-12-13"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/sirius-binary-native.jpg",
        "source": "https://cdn.esahubble.org/archives/images/screen/heic0516a.jpg",
        "sourcePage": "https://esahubble.org/images/heic0516a/",
        "label": "NATIVE BINARY OBSERVATION",
        "credit": "NASA, ESA, H. Bond (STScI), and M. Barstow (University of Leicester)",
        "terms": "ESA/Hubble CC BY4.0; full original credit retained.",
        "termsUrl": "https://esahubble.org/copyright/",
        "publicationDate": "2005-12-13",
        "observationDate": "2003-10-15",
        "tier": "measured",
        "sha256": "2dd03a9780603d6896826eea6e29f2c74d415831cf3d29bfabee91ce05befe62",
        "bytes": 176877,
        "description": "HST/WFPC2 observing date2003-10-15 verified by publisher: overexposed SiriusA at centre, unresolved SiriusB lower left. Diffraction spikes and rings are instrument artifacts. Publisher lists430/750nmSTIS and1.042micronWFPC2 bands; exact channel assignment is not independently reconstructed. Processed colour is not calibrated visible photospheric colour. Publisher JPEG copied unchanged."
      }
    ],
    "skyModel": {
      "star": "Sirius A",
      "radiusSun": 1.7144,
      "temperatureK": 9845,
      "distanceAU": 0.015945522144387044,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 97837.29081294339,
      "approximateSrgb": [
        0.7951725044392769,
        0.8577353072314808,
        1
      ],
      "limits": "Conceptual observer2photospheric radii from centre; no planetary semimajor axis. Approximate spectral tint omits lines, transfer, exposure and adaptation. Nominal FOV and raster limb remain artistic."
    },
    "surfaceMap": {
      "key": "siriusAStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular invented longitude; no measured surface frame.",
      "coverage": "Entire photospheric intensity morphology imagined; approximate catalogue tint applied.",
      "url": "/bespoke/sirius-a-star-surface-map.jpg",
      "previewUrl": "/bespoke/sirius-a-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-25f6f456-b3b4-45c9-a18a-18845a667577.png",
      "sourceSha256": "0874c6f5d691c4352efc3132334618ec5870f9e12c059fbca4a37ca2cddeee0c",
      "sha256": "aa0f70a61ed47f5e9f7ac1db584ff83ccd396dbae031eaecb237a6b6a5426a0d",
      "previewSha256": "280fc6d80f286d851ec7dcb53996d1c468a01782bafa1eaf81942d6f8ee7b62c",
      "bytes": 279933,
      "previewBytes": 23492,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          544,
          538,
          477
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Edited luminous disc remains an approximate illustration; thresholds, FOV, limb, exposure and tint do not establish calibration."
      },
      "url": "/bespoke/sirius-a-star-sky-image.jpg",
      "previewUrl": "/bespoke/sirius-a-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-141d8dfc-acf1-483b-9f3a-5881165978a0.png",
      "sourceSha256": "17ee43796fb61183177c46fce8e113c6f5efb380843f15237e4142b3ee0c007c",
      "sha256": "e68c2e440b306c734b349a14178ef47470db32dc7e368b9b613287f8705f0efa",
      "previewSha256": "1fdc9e2fb7cd5d08faa9408580533e154ebb5f8042a41011f931f2126ce35247",
      "bytes": 41804,
      "previewBytes": 8875,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "sirius-b-star": {
    "id": "sirius-b-star",
    "name": "Sirius B",
    "kind": "star",
    "stellarClass": "DA white dwarf",
    "aliases": [
      "Sirius B",
      "alf CMa B",
      "Alpha Canis Majoris B",
      "Gl 244B",
      "GJ 244 B",
      "Gliese 244 B"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Native Hubble SiriusB is the tiny dot lower left; separate hot DA hydrogen-atmosphere white dwarf, not SiriusA.",
    "nativeSurface": "Native unresolved stellar observations retained as context; no resolved photospheric geography or visible-colour calibration established.",
    "measured": [
      "Bond2017 dynamical mass1.018±0.011solar masses; DA hydrogen-line spectrum supports a hydrogen-dominated atmosphere.",
      "Bond2017 adopted system parallax378.9±1.4mas; current component astrometry and exhaustive nearest20boundary remain unverified.",
      "Native Hubble image observed2003-10-15, released2005-12-13; bright centralA and faint lower-leftB are explicitly distinguished."
    ],
    "modelled": [
      "Bond2017 STIS atmosphere/absolute-flux fits:25369±46K and0.008098±0.000046solar radii. Carbon/oxygen degenerate interior is theoretical and hidden beneath gaseous hydrogen atmosphere; no solid surface is asserted.",
      "Joyce2018 alternative radius0.00803±0.00011solar radii and25922K, differential gravitational-redshift mass1.017±0.025solar masses. Authors prefer binary-aware Bond parallax over linear GaiaDR2 astrometry.",
      "Existing binary renderer uses0.0084Rsun25000K; catalogue/binary parameters remain preserved as an alternative history."
    ],
    "unknown": [
      "Resolved photospheric intensity geography, actual magnetic/convective morphology and calibrated visible colour/exposure; component distance ranking remains open."
    ],
    "assumed": [
      "Independent almost-smooth hot hydrogen photospheric intensity map and observer disc; all faint mottling imagined. No dramatic solar granulation, hidden carbon/oxygen-core terrain or observed Sun map reuse.",
      "Conceptual camera two photospheric radii from centre, one radius above gas; no solid ground or survivable landing. Companion outside chosen viewing direction/FOV; no dated binary scene registration claimed.",
      "Nominal120-degree FOV, exposure, spectral transfer and approximate blue-white tint remain artistic."
    ],
    "surfaceLabel": "WHITE-DWARF PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/1703.10625",
        "title": "Bond2017 Sirius orbital masses and inferred atmosphere/radii",
        "publicationDate": "2017-03-30"
      },
      {
        "url": "https://arxiv.org/pdf/1809.01240",
        "title": "Joyce2018 differential redshift and alternative SiriusB fit",
        "publicationDate": "2018"
      },
      {
        "url": "https://esahubble.org/images/heic0516a/",
        "title": "Primary Hubble binary image, component identities and observation date",
        "publicationDate": "2005-12-13"
      },
      {
        "url": "https://arxiv.org/pdf/2112.05234",
        "title": "Lucas2021/2022 Keck2020 images, PSF and nondetection limits",
        "publicationDate": "2021-12-09"
      },
      {
        "url": "https://github.com/mileslucas/sirius-b",
        "title": "Primary author figure2 and CC BY4 data licence"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/sirius-binary-native.jpg",
        "source": "https://cdn.esahubble.org/archives/images/screen/heic0516a.jpg",
        "sourcePage": "https://esahubble.org/images/heic0516a/",
        "label": "NATIVE BINARY OBSERVATION",
        "credit": "NASA, ESA, H. Bond (STScI), and M. Barstow (University of Leicester)",
        "terms": "ESA/Hubble CC BY4.0; full original credit retained.",
        "termsUrl": "https://esahubble.org/copyright/",
        "publicationDate": "2005-12-13",
        "observationDate": "2003-10-15",
        "tier": "measured",
        "sha256": "2dd03a9780603d6896826eea6e29f2c74d415831cf3d29bfabee91ce05befe62",
        "bytes": 176877,
        "description": "HST/WFPC2 observing date2003-10-15 verified by publisher: overexposed SiriusA at centre, unresolved SiriusB lower left. Diffraction spikes and rings are instrument artifacts. Publisher lists430/750nmSTIS and1.042micronWFPC2 bands; exact channel assignment is not independently reconstructed. Processed colour is not calibrated visible photospheric colour. Publisher JPEG copied unchanged."
      },
      {
        "url": "/bespoke/sirius-b-keck-native.png",
        "source": "https://raw.githubusercontent.com/mileslucas/sirius-b/eb0bc6fa31836506bf755662677e00842db92358/paper/figures/psf.pdf",
        "sourcePage": "https://github.com/mileslucas/sirius-b/blob/eb0bc6fa31836506bf755662677e00842db92358/paper/figures/psf.pdf",
        "label": "NATIVE INFRARED POINT-SOURCE FIGURE",
        "credit": "Miles Lucas, Michael Bottom, Garreth Ruane and Sam Ragland; W. M. Keck Observatory/NIRC2.",
        "terms": "CC BY4.0 author arXiv paper and primary data release; full author attribution retained.",
        "termsUrl": "https://arxiv.org/abs/2112.05234",
        "publicationDate": "2021-12-09",
        "observationDate": "2020-11-21",
        "tier": "measured",
        "sha256": "2ca59de44b14beea64839071fa9bac884af6f848cc424b54ca518d426ffd99e8",
        "sourceSha256": "188854788be3044e1e510a340bf327de470ca354b24a0bf81bf9a731637cd68e",
        "bytes": 101362,
        "description": "Lucasetal Figure2 median frame from second Keck/NIRC2 epoch2020-11-21, L-prime3.776microns. Unresolved instrumentalPSF with speckles/diffraction, not photospheric geography, calibrated visible colour or companions. Entire author PDF figure rendered to lossless576x477PNG withPDF.js2x; no crop/image content edit, original PDF hash retained. Paper reports no confirmed companions in2020three-epoch search; this is not proof none exist."
      }
    ],
    "skyModel": {
      "star": "Sirius B",
      "radiusSun": 0.008098,
      "temperatureK": 25369,
      "distanceAU": 0.0000753189677585431,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 4313749.581769146,
      "approximateSrgb": [
        0.6410966783412286,
        0.7591471057593826,
        1
      ],
      "limits": "Conceptual observer2photospheric radii from centre; no planetary semimajor axis. Approximate spectral tint omits lines, transfer, exposure and adaptation. Nominal FOV and raster limb remain artistic."
    },
    "surfaceMap": {
      "key": "siriusBStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular invented longitude; no measured surface frame.",
      "coverage": "Entire photospheric intensity morphology imagined; approximate catalogue tint applied.",
      "url": "/bespoke/sirius-b-star-surface-map.jpg",
      "previewUrl": "/bespoke/sirius-b-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-e3d5dd9b-161c-4035-812e-cb3c7895352d.png",
      "sourceSha256": "a5a476a5fad319e1d16a33a3ff8d315ac0c37e938337968638f8b55763d5884e",
      "sha256": "866b41f0e5cc6a8cd47b33c945e4a041957832f58e2ff8dac331b6344982121f",
      "previewSha256": "f2170e0accbfb7964deb9aafe26e7725aabb748aca38948f6b1e65566c7ffe4e",
      "bytes": 113594,
      "previewBytes": 8712,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          507,
          497,
          382
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Edited luminous disc remains an approximate illustration; thresholds, FOV, limb, exposure and tint do not establish calibration."
      },
      "url": "/bespoke/sirius-b-star-sky-image.jpg",
      "previewUrl": "/bespoke/sirius-b-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-72e4d5f1-3fcd-4ad8-9d06-efec4e52d149.png",
      "sourceSha256": "e17338a7e807b3bc8f316db9c4b639efc2d8fc449b618c3549b3114ca9b89ad3",
      "sha256": "052cff8ce35cff5374c5938b705374aabcd4afd9fb9492c12df5673f54e12f4d",
      "previewSha256": "4e087558a1535b48106a9d82ea43bd539a461c39ff48b43f42a6c057421e5aac",
      "bytes": 30030,
      "previewBytes": 6584,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "luyten-a-star": {
    "id": "luyten-a-star",
    "name": "BL Ceti",
    "kind": "star",
    "aliases": [
      "BL Ceti",
      "BL Cet",
      "G 272-61 A",
      "G272-61 A",
      "GJ 65 A",
      "GJ65A",
      "Gliese 65A",
      "Gl 65A",
      "Luyten 726-8 A"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Kochukhov2017 Table1 explicitly verifies BL Ceti=GJ65A; native NACO A/B annotations retained. Not Luhman16.",
    "nativeSurface": "Native NACO binary point-source panels preserved; no native resolved visible photospheric geography or calibrated visible colour established.",
    "measured": [
      "Kervella2016 interferometric limb-darkened radius 0.165±0.006Rsun, dynamical mass0.1225±0.0043Msun. Radius depends on limb-darkening model and adopted373.70±2.70mas parallax.",
      "Kochukhov2017 inferred total magnetic flux5.2kG from Zeeman intensification; large-scale field inversion differs from total flux.",
      "Historical selected catalogue parallax367.711896181477mas differs between bound components; binary-aware distance reconciliation and current nearest20ranking remain open."
    ],
    "modelled": [
      "MacDonald/Mullan/Dieterich2018 revised arXiv1711.09434 Section2 flux/radius analysis infers2784±58K with Kervella radii. Alternative Barnes radii infer2842±98K. Spectral/bolometric corrections are model-dependent; not a direct colour measurement.",
      "Kochukhov2017 global field inversion0.3kG complex non-axisymmetric; do not depict field lines as directly observed.",
      "Barnes2017 Doppler reconstruction uses2800K photosphere/2400K spots, not independent Teff measurement. Sparse midlatitude and some highlatitude spots, mean inferred filling1.7%. These2015epoch inversions are not native optical photos or current fixed geography."
    ],
    "unknown": [
      "Current resolved photospheric morphology, measured composition fractions, calibrated visible colour/exposure and dated observer companion registration.",
      "2011NACO panel exactH versusKs band selection; publisher false-colour transfer function unverified.",
      "Current binary-aware component astrometry and exhaustive present-day nearest20 boundary."
    ],
    "assumed": [
      "Independent cool molecular, partly ionized hydrogen/helium stellar photosphere intensity pattern; gas and spots invented, no solid ground or survivable landing.",
      "Sparse smaller spots with some highlatitude dim groups; exact longitudes and convection invented.",
      "No observed Sun or other-body map reused. Conceptual camera2Rfromcentre, companion outside selected FOV; no dated binary registration. Nominal120degreeFOV, spectral transfer, tint and exposure artistic."
    ],
    "surfaceLabel": "INDIVIDUAL PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/1607.04351",
        "title": "Kervella2016 interferometry, masses and NACO Figure3/Table2/3",
        "publicationDate": "2016-08-02"
      },
      {
        "url": "https://arxiv.org/html/1702.02946",
        "title": "Kochukhov/Lavail2017 component-labelled magnetic analysis",
        "publicationDate": "2017-02-09"
      },
      {
        "url": "https://arxiv.org/pdf/1711.09434",
        "title": "MacDonald/Mullan/Dieterich2018 temperature inference and alternatives",
        "publicationDate": "2018-05-04"
      },
      {
        "url": "https://arxiv.org/html/1706.03979",
        "title": "Barnesetal2017 epoch-dependent modelled spot distributions",
        "publicationDate": "2017-06-13"
      },
      {
        "url": "https://arxiv.org/html/2406.17280",
        "title": "Plant/Hallinan/Bastian2024 radio analysis of2011/2014epochs",
        "publicationDate": "2024-06-25"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/luyten-naco-1-native.png",
        "source": "https://arxiv.org/html/1607.04351v3/x1.png",
        "sourcePage": "https://arxiv.org/html/1607.04351",
        "label": "NATIVE INFRARED BINARY OBSERVATION",
        "tier": "measured",
        "sha256": "25c574c0322f54478686415f3beca890291ec6ded3beceeabe0542e57f2b84e2",
        "bytes": 94353,
        "publicationDate": "2016-08-02",
        "observationDate": "2007-08-29",
        "credit": "P. Kervella, A. Mérand, C. Ledoux, B.-O. Demory and J.-B. Le Bouquin; ESO/VLT/NACO.",
        "terms": "Author scientific figure, original full credit retained under user-authorized attributed use. arXiv distribution licence is not asserted to be CC BY.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "description": "Original Figure3 first panel unchanged, A lower right/B upper left. Table2 verifies08:15UT. Table3 associates this epoch with narrowband1.64micron; orange stretch, PSF and annotation are not visible colour or surface geography."
      },
      {
        "url": "/bespoke/luyten-naco-2-native.png",
        "source": "https://arxiv.org/html/1607.04351v3/x2.png",
        "sourcePage": "https://arxiv.org/html/1607.04351",
        "label": "NATIVE INFRARED BINARY OBSERVATION",
        "tier": "measured",
        "sha256": "052d39faf6f44b8746a173af14667dea06e03ca8c2422c9c3e7a86e8b48a4e3f",
        "bytes": 95832,
        "publicationDate": "2016-08-02",
        "observationDate": "2011-09-23",
        "credit": "P. Kervella, A. Mérand, C. Ledoux, B.-O. Demory and J.-B. Le Bouquin; ESO/VLT/NACO.",
        "terms": "Author scientific figure, original full credit retained under user-authorized attributed use. arXiv distribution licence is not asserted to be CC BY.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "description": "Original Figure3 second panel unchanged, A lower right/B upper left. Table2 verifies06:28UT. Table3 has bothH1.66 andKs2.18micron this epoch; exact panel filter remains unverified. Orange stretch and instrumental PSF do not establish visible colour or surface geography."
      }
    ],
    "skyModel": {
      "star": "BL Ceti",
      "radiusSun": 0.165,
      "temperatureK": 2784,
      "distanceAU": 0.001534654196117512,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 625.6312884753454,
      "approximateSrgb": [
        1,
        0.6657547216838713,
        0.36896537996380596
      ],
      "limits": "Conceptual observer2photospheric radii fromcentre;60degree geometry verified through skyGeometry. Nominal120degreeFOV, colour/spectral transfer/exposure and raster disc remain artistic, not a survivable landing or dated binary registration."
    },
    "surfaceMap": {
      "key": "luytenAStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular invented longitude, unregistered.",
      "coverage": "Entire photospheric intensity geography imagined; component-specific spectral tint approximate.",
      "url": "/bespoke/luyten-a-star-surface-map.jpg",
      "previewUrl": "/bespoke/luyten-a-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-01eaa3a5-0dc7-4f0f-a24f-8a109cc1e58a.png",
      "sourceSha256": "ceffac1f7b7d6d05507ca83710d2d18127f2cbd4d0cc624e02eabeac6706b467",
      "sha256": "e55ce7c5b8f67bbd20ceb6f22a0d74bbac26f8165d326bc695ca9675513233b4",
      "previewSha256": "0fa1c48c267bed7303974e4c4baae4675de405824d3905909048dfea2ff950c1",
      "bytes": 403483,
      "previewBytes": 36819,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          471,
          471,
          471
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Threshold core widths are approximate; cameraFOV/colour/exposure artistic, not calibrated or dated registration."
      },
      "url": "/bespoke/luyten-a-star-sky-image.jpg",
      "previewUrl": "/bespoke/luyten-a-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-7d166371-1ed2-4b26-96c2-02a3c0e12377.png",
      "sourceSha256": "3d4322e1844793bfc280d4ee7a55908b47e0c34c8a00d09e1259206b5fac6b23",
      "sha256": "436e79dcb95d0aae5b534a0e1c418b61ba279cf2aecb37dad943b146cbc6ff81",
      "previewSha256": "a8c64e4b0fa850e7994ecd54ec8990156c7b432d7fc74888c89edd6d3d24ddfc",
      "bytes": 59633,
      "previewBytes": 11622,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "luyten-b-star": {
    "id": "luyten-b-star",
    "name": "UV Ceti",
    "kind": "star",
    "aliases": [
      "UV Ceti",
      "UV Cet",
      "G 272-61 B",
      "G272-61 B",
      "GJ 65 B",
      "GJ65B",
      "Gliese 65B",
      "Gl 65B",
      "Luyten 726-8 B"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Kochukhov2017 Table1 explicitly verifies UV Ceti=GJ65B; native NACO A/B annotations retained. Not Luhman16.",
    "nativeSurface": "Native NACO binary point-source panels preserved; no native resolved visible photospheric geography or calibrated visible colour established.",
    "measured": [
      "Kervella2016 interferometric limb-darkened radius 0.159±0.006Rsun, dynamical mass0.1195±0.0043Msun. Radius depends on limb-darkening model and adopted373.70±2.70mas parallax.",
      "Kochukhov2017 inferred total magnetic flux6.7kG from Zeeman intensification; large-scale field inversion differs from total flux.",
      "Historical selected catalogue parallax373.844312268399mas differs between bound components; binary-aware distance reconciliation and current nearest20ranking remain open."
    ],
    "modelled": [
      "MacDonald/Mullan/Dieterich2018 revised arXiv1711.09434 Section2 flux/radius analysis infers2728±60K with Kervella radii. Alternative Barnes radii infer2715±81K. Spectral/bolometric corrections are model-dependent; not a direct colour measurement.",
      "Kochukhov2017 global field inversion1.3kG approximately axisymmetric dipolar; do not depict field lines as directly observed.",
      "Barnes2017 Doppler reconstruction uses2800K photosphere/2400K spots, not independent Teff measurement. Larger intermediate-latitude spot groups, mean inferred filling5.6%, little polar structure. These2015epoch inversions are not native optical photos or current fixed geography."
    ],
    "unknown": [
      "Current resolved photospheric morphology, measured composition fractions, calibrated visible colour/exposure and dated observer companion registration.",
      "2011NACO panel exactH versusKs band selection; publisher false-colour transfer function unverified.",
      "Current binary-aware component astrometry and exhaustive present-day nearest20 boundary."
    ],
    "assumed": [
      "Independent cool molecular, partly ionized hydrogen/helium stellar photosphere intensity pattern; gas and spots invented, no solid ground or survivable landing.",
      "More extensive intermediate-latitude dim groups; exact longitudes and convection invented.",
      "No observed Sun or other-body map reused. Conceptual camera2Rfromcentre, companion outside selected FOV; no dated binary registration. Nominal120degreeFOV, spectral transfer, tint and exposure artistic."
    ],
    "surfaceLabel": "INDIVIDUAL PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/1607.04351",
        "title": "Kervella2016 interferometry, masses and NACO Figure3/Table2/3",
        "publicationDate": "2016-08-02"
      },
      {
        "url": "https://arxiv.org/html/1702.02946",
        "title": "Kochukhov/Lavail2017 component-labelled magnetic analysis",
        "publicationDate": "2017-02-09"
      },
      {
        "url": "https://arxiv.org/pdf/1711.09434",
        "title": "MacDonald/Mullan/Dieterich2018 temperature inference and alternatives",
        "publicationDate": "2018-05-04"
      },
      {
        "url": "https://arxiv.org/html/1706.03979",
        "title": "Barnesetal2017 epoch-dependent modelled spot distributions",
        "publicationDate": "2017-06-13"
      },
      {
        "url": "https://arxiv.org/html/2406.17280",
        "title": "Plant/Hallinan/Bastian2024 radio analysis of2011/2014epochs",
        "publicationDate": "2024-06-25"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/luyten-naco-1-native.png",
        "source": "https://arxiv.org/html/1607.04351v3/x1.png",
        "sourcePage": "https://arxiv.org/html/1607.04351",
        "label": "NATIVE INFRARED BINARY OBSERVATION",
        "tier": "measured",
        "sha256": "25c574c0322f54478686415f3beca890291ec6ded3beceeabe0542e57f2b84e2",
        "bytes": 94353,
        "publicationDate": "2016-08-02",
        "observationDate": "2007-08-29",
        "credit": "P. Kervella, A. Mérand, C. Ledoux, B.-O. Demory and J.-B. Le Bouquin; ESO/VLT/NACO.",
        "terms": "Author scientific figure, original full credit retained under user-authorized attributed use. arXiv distribution licence is not asserted to be CC BY.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "description": "Original Figure3 first panel unchanged, A lower right/B upper left. Table2 verifies08:15UT. Table3 associates this epoch with narrowband1.64micron; orange stretch, PSF and annotation are not visible colour or surface geography."
      },
      {
        "url": "/bespoke/luyten-naco-2-native.png",
        "source": "https://arxiv.org/html/1607.04351v3/x2.png",
        "sourcePage": "https://arxiv.org/html/1607.04351",
        "label": "NATIVE INFRARED BINARY OBSERVATION",
        "tier": "measured",
        "sha256": "052d39faf6f44b8746a173af14667dea06e03ca8c2422c9c3e7a86e8b48a4e3f",
        "bytes": 95832,
        "publicationDate": "2016-08-02",
        "observationDate": "2011-09-23",
        "credit": "P. Kervella, A. Mérand, C. Ledoux, B.-O. Demory and J.-B. Le Bouquin; ESO/VLT/NACO.",
        "terms": "Author scientific figure, original full credit retained under user-authorized attributed use. arXiv distribution licence is not asserted to be CC BY.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "description": "Original Figure3 second panel unchanged, A lower right/B upper left. Table2 verifies06:28UT. Table3 has bothH1.66 andKs2.18micron this epoch; exact panel filter remains unverified. Orange stretch and instrumental PSF do not establish visible colour or surface geography."
      }
    ],
    "skyModel": {
      "star": "UV Ceti",
      "radiusSun": 0.159,
      "temperatureK": 2728,
      "distanceAU": 0.0014788485889859662,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 576.7916973660537,
      "approximateSrgb": [
        1,
        0.6578282630316081,
        0.35164068823314665
      ],
      "limits": "Conceptual observer2photospheric radii fromcentre;60degree geometry verified through skyGeometry. Nominal120degreeFOV, colour/spectral transfer/exposure and raster disc remain artistic, not a survivable landing or dated binary registration."
    },
    "surfaceMap": {
      "key": "luytenBStarBespoke",
      "texLon0": -180,
      "projection": "2:1 equirectangular invented longitude, unregistered.",
      "coverage": "Entire photospheric intensity geography imagined; component-specific spectral tint approximate.",
      "url": "/bespoke/luyten-b-star-surface-map.jpg",
      "previewUrl": "/bespoke/luyten-b-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-36792275-4cb8-4dba-84d1-abd48acae74b.png",
      "sourceSha256": "66d1ad5c2dc2ae90455a905857681e9ed3517bb085fc56f79bb6017796ca30aa",
      "sha256": "8504989d97c7788b29ed41843050f32a7e833c474c8e1a532d7e77ae4c8394b6",
      "previewSha256": "98055995fc4a33099b3606f09072dec05ea610b2692c5f6ac9065afd2e8d535c",
      "bytes": 444731,
      "previewBytes": 39460,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          498,
          498,
          498
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Threshold core widths are approximate; cameraFOV/colour/exposure artistic, not calibrated or dated registration."
      },
      "url": "/bespoke/luyten-b-star-sky-image.jpg",
      "previewUrl": "/bespoke/luyten-b-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-926f3713-4162-4b64-88e4-4ac5fd31ce0c.png",
      "sourceSha256": "3eef671f60e53157dedd498b7d17c7fa50b9a073ba42b9c40e8d78d2d35e17ea",
      "sha256": "ac8ab24efa322b804f7366af67c2b53f4f190ea4545ddce59f1fb44dc27802fb",
      "previewSha256": "4e486a65e435014aa25ee80afd70285954e87e5386c2527519bf92ddc84ce714",
      "bytes": 65523,
      "previewBytes": 13003,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "ross154-star": {
    "id": "ross154-star",
    "name": "Ross 154",
    "kind": "star",
    "aliases": [
      "Ross 154",
      "GJ 729",
      "Gliese 729",
      "Gl 729",
      "V1216 Sgr",
      "V 1216 Sgr",
      "HIP 92403"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Wargelin2007/2008 SectionII explicitly identifies Ross154 with Gliese729 and V1216Sgr; not Ross128b or Ross248.",
    "nativeSurface": "Native Chandra X-ray point-source/extraction-region figure retained; no native resolved photospheric geography or calibrated visible colour found in checked sources.",
    "measured": [
      "Wargelin2007/2008 ACIS-S3 ObsID2561 begins2002-09-09T00:01:20UT. X-ray flare and readout streak are detector/source context, not visible photospheric geography.",
      "Pineda2021 Table5 GaiaEDR3 parallax336.1228±0.0641mas; historical snapshot distance retained and current exhaustive nearest20ranking open."
    ],
    "modelled": [
      "Pineda2021 Table3 continued empirical Bayesian inference:3248+68/-66K,0.200±0.008Rsun and0.177±0.004Msun; bolometric luminosity(1.537±0.018)×10^31erg/s. Radius/mass/temperature are correlated empirical estimates, not resolved photosphere measurements.",
      "Cool partlyionized molecular hydrogen/helium photospheric gas is broad stellar-model composition, not measured abundance fractions. Coronal X-ray temperatures/abundances must not be treated as photospheric temperature/colour."
    ],
    "unknown": [
      "Resolved visible intensity/spot geography, exact magnetic/convection morphology, measured composition fractions and calibrated visible colour/exposure.",
      "Current exhaustive nearest20stellar ranking; dated hypothetical observer registration."
    ],
    "assumed": [
      "Independent quiescent photospheric intensity pattern and observer disc; spots/convection/longitudes invented despite historical flare evidence.",
      "Conceptual camera2photosphericradii fromcentre; no solid ground or survivable landing. No observed Sun or another-body map reuse.",
      "Nominal120degreeFOV, tint, molecular radiative transfer and exposure artistic; no recreation of2002flare in visible colour."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERE HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/pdf/2106.07656",
        "title": "Pineda/Youngblood/France2021 empirical stellar parameters, Table3/5",
        "publicationDate": "2021-06-14"
      },
      {
        "url": "https://arxiv.org/html/0712.2791",
        "title": "Wargelin/Kashyap/Drake/García-Alvarez/Ratzlaff2007/2008 native Chandra figure and observation epochs",
        "publicationDate": "2007-12-17"
      },
      {
        "url": "https://hea-www.cfa.harvard.edu/~bradw/cv/papers/Ross154.pdf",
        "title": "Primary author published ApJ2008 article",
        "publicationDate": "2008-03-20"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/ross154-chandra-native.png",
        "source": "https://arxiv.org/html/0712.2791v1/f1a.png",
        "sourcePage": "https://arxiv.org/html/0712.2791",
        "label": "NATIVE X-RAY POINT-SOURCE FIELD",
        "credit": "B. J. Wargelin, V. L. Kashyap, J. J. Drake, D. García-Alvarez and P. W. Ratzlaff; Chandra X-ray Observatory/ACIS-S3.",
        "terms": "Original author figure with full attribution under user-authorized credited use; no CC licence inferred from arXiv distribution licence.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "publicationDate": "2007-12-17",
        "observationDate": "2002-09-09",
        "tier": "measured",
        "sha256": "e762dcc090e09a894253d9f4325d0e314e7e953976ce5eb60daa8a30d6db570b",
        "bytes": 42685,
        "description": "Unchanged author Figure1a native ACIS source field, core pileup/readout streak and extraction-region annotation. Annulus aroundRoss154; weak unrelated secondary point sources/background boxes are analysis regions, not stellar companions or photospheric features. Observed2002-09-09 beginning00:01:20UT. Inverted X-ray intensity does not establish visible colour or photospheric geography."
      }
    ],
    "skyModel": {
      "star": "Ross 154",
      "radiusSun": 0.2,
      "temperatureK": 3248,
      "distanceAU": 0.0018601869043848632,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 1159.059200331253,
      "approximateSrgb": [
        1,
        0.7258860622392057,
        0.4945454996149291
      ],
      "limits": "Conceptual observer2photosphericradii fromcentre,60degree geometry verified through skyGeometry; nominal120degreeFOV, spectraltransfer, tint, exposure and raster core approximate, not calibrated or dated registration."
    },
    "surfaceMap": {
      "key": "ross154StarBespoke",
      "texLon0": -180,
      "projection": "2:1 invented longitude/latitude intensity map; no measured stellar surface frame.",
      "coverage": "Entire gas/spot morphology imagined; approximate catalogue tint.",
      "url": "/bespoke/ross154-star-surface-map.jpg",
      "previewUrl": "/bespoke/ross154-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-bd6980c3-ac30-42ae-a492-7832afe35d95.png",
      "sourceSha256": "2efcb9985e7c29d234b6fe31f78addaeeb9ad16a3eda627b865ce1c53a351e7e",
      "sha256": "e0092e71a86bec57d6f5bbf3f64f64d1dde88ed2a8c464f70e96e4de156a9bfa",
      "previewSha256": "abc95abf7d3c866eed7cc61084c8114f8bf937638a26a646c3e0dc6a3d5c0fd1",
      "bytes": 409483,
      "previewBytes": 39039,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1671,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "brightCoreWidths": [
          527,
          527,
          527
        ],
        "geometricTargetPixels": 557.0000000000002,
        "limits": "Nominal cameraFOV, threshold/limb/exposure and colour remain approximate, not calibrated."
      },
      "url": "/bespoke/ross154-star-sky-image.jpg",
      "previewUrl": "/bespoke/ross154-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-d511a8c2-d965-40fc-b12e-1b8f5248a1d2.png",
      "sourceSha256": "8def0379058a4f792a5fca429c2dfb85e2a2956c9ac69cc2767b142c2b90fe72",
      "sha256": "3541c29bfd32bf0bb88bf428cd60839fa359d333061251a4143930eedda66a37",
      "previewSha256": "c016ec51025c2bb3b697e57a61406d239cdc427a6b24101d6af65bdc54f614eb",
      "bytes": 59393,
      "previewBytes": 11778,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "ross248-star": {
    "id": "ross248-star",
    "name": "Ross 248",
    "kind": "star",
    "aliases": [
      "Ross 248",
      "HH And",
      "HH Andromedae",
      "GJ 905",
      "Gl 905",
      "Gliese 905",
      "LHS 549"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Ross248=HHAnd=Gl905/GJ905, actual historical HYG hyg-119585. Mann2015 Table5 Gl905 coordinates23:41:55.0 +44:10:38 match this field. Not Gliese905.2A/B; historical selection preserved pending current ranking reconciliation.",
    "nativeSurface": "Unchanged native2MASS infrared finding chart retained; no resolved photospheric geography or calibrated visible colour found in checked primary sources.",
    "measured": [
      "Native2MASS K_s atlas coadd532189, northern scan42 image173 observed1998-10-29. Gzip-compressed original FITS header UT_DATE981029 and interactive service UTDate corroborate epoch; rendering publication day unknown.",
      "Schweitzer2019 Table2 continued J23419+441/Gl905 distance3.155±0.001pc; historical catalogue selection preserved, exhaustive current astrometric ranking open."
    ],
    "modelled": [
      "Selected Schweitzer2019 spectroscopic stellar-model estimate3142±51K, radius0.158±0.005Rsun and luminosity0.00220±0.00003Lsun. Distinct photometric radius column0.191±0.001Rsun is retained as an alternative, not combined with spectroscopic temperature.",
      "Mann2015 Table5 continued independent optical-spectrum/BT-Settl plus bolometric-flux approach:2930±60K, radius0.1894±0.0079Rsun, empirical mass0.145±0.015Msun and metallicity+0.23±0.08. These model-dependent estimates disagree with the selected spectroscopic pair; not direct resolved surface measurements.",
      "Khata2020 Table5 reproduces Mann2015 calibration values2930±60K and rounded radius0.189±0.007Rsun; its separately inferred values2904±125K and0.171±0.069Rsun are not the original measured/calibration columns.",
      "Cool partlyionized molecular hydrogen/helium photospheric gas is broad model composition, not measured abundance fractions. Pineda2021 MUSS has no GJ905 row; no Ross154 parameters extrapolated."
    ],
    "unknown": [
      "Resolved convection/magnetic/spot geography, calibrated visible colour and spectral transfer; measured elemental fractions and dated observer registration.",
      "Current exhaustive nearest20 ranking and reconciliation of alternative atmosphere/temperature/radius methods."
    ],
    "assumed": [
      "Independent grayscale intensity pattern and quiescent observer; longitudes, gas cells and magnetic patches invented. No observed Sun or another-body map reused.",
      "Conceptual camera2photosphericradii fromcentre; no solid ground or survivable landing.",
      "Nominal120degreeFOV, exposure, tint and molecular radiative transfer remain artistic. Infrared chart intensity/overlays do not establish photospheric geography, visible colour or companions."
    ],
    "surfaceLabel": "PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/1904.03231",
        "title": "Schweitzer etal2019 CARMENES stellar radii, Table2 J23419+441",
        "publicationDate": "2019-04-05"
      },
      {
        "url": "https://arxiv.org/pdf/1501.01635",
        "title": "Mann etal2015 How to Constrain Your M Dwarf, Table5 continued",
        "publicationDate": "2015-01-07"
      },
      {
        "url": "https://arxiv.org/html/2002.05762",
        "title": "Khata etal2020 NIR parameter calibrations, Table5 distinct columns",
        "publicationDate": "2020-02-13"
      },
      {
        "url": "https://irsa.ipac.caltech.edu/cgi-bin/2MASS/IM/nph-im_key?ds=asky&key=532189&band=K",
        "title": "IRSA primary2MASS atlas finding chart and epoch metadata",
        "publicationDate": null
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/ross248-2mass-native.jpg",
        "source": "https://irsa.ipac.caltech.edu/cgi-bin/2MASS/IM/nph-jpeg?file=%2Fwork%2FTMP_SJrKJF_2888310%2FIM%2Fkey_iY53XD%2FaK_asky_981029n0420173.jpg",
        "sourcePage": "https://irsa.ipac.caltech.edu/cgi-bin/2MASS/IM/nph-im_key?ds=asky&key=532189&band=K",
        "label": "NATIVE INFRARED FINDING CHART",
        "credit": "Two Micron All Sky Survey (2MASS), joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by NASA and the National Science Foundation; NASA/IPAC Infrared Science Archive.",
        "terms": "2MASS/IRSA survey use with full required acknowledgement; unmodified publisher finding-chart JPEG.",
        "termsUrl": "https://irsa.ipac.caltech.edu/data/2MASS/docs/releases/allsky/doc/sec1_7.html",
        "publicationDate": null,
        "observationDate": "1998-10-29",
        "tier": "measured",
        "sha256": "2512bc552dc1b90eb7e07d27198cbe1ae08dc0611ab4d4b8289bf02dfb4d031c",
        "bytes": 43453,
        "description": "Unchanged2MASS K_s2.159micron atlas finding chart forRoss248 coordinates, observed1998-10-29 northern scan42 image173/coadd532189. Inverted infrared intensity, coordinate grid and persistence/filter-glint artifact overlays are instrumental/finding-chart context, not companions or visible photospheric geography. The target is unresolved; no calibrated visible colour claimed. Rendering publication day unknown."
      }
    ],
    "skyModel": {
      "star": "Ross 248",
      "radiusSun": 0.158,
      "temperatureK": 3142,
      "distanceAU": 0.001469547654464042,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 59.99999999999999,
      "centreDiscWidthFraction": 0.3333333333333334,
      "irradianceEarth": 1015.0005069897328,
      "approximateSrgb": [
        1,
        0.7129432013034972,
        0.468308090219191
      ],
      "limits": "Hypothetical camera2photosphericradii fromcentre;60degree geometric diameter. Nominal120degreeFOV, molecular spectral transfer, exposure, threshold core and colour remain artistic and uncalibrated."
    },
    "surfaceMap": {
      "key": "ross248StarBespoke",
      "texLon0": -180,
      "projection": "2:1 invented longitude/latitude intensity map; no measured stellar surface frame.",
      "coverage": "Entire gas/spot morphology imagined; approximate catalogue tint.",
      "url": "/bespoke/ross248-star-surface-map.jpg",
      "previewUrl": "/bespoke/ross248-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-e29c7bac-a984-46f8-94f9-f2ef43a18938.png",
      "sourceSha256": "f84244a6a2c9997e9c5acc0abdbb5485e254cad0d51777ddafda2225425022ae",
      "sha256": "cebf97d5eaf1e8ccdb27e6e5c33e54675ee4deea023e76abf58e13e24d7df01d",
      "previewSha256": "25b1ff01b1a0bc493b918c311d93fec7a5ab4e6b02d825f11bc38aaed072e481",
      "bytes": 449418,
      "previewBytes": 41508,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Four-neighbour bright component connected to central photosphere; excludes disconnected background stars.",
        "brightCoreWidths": [
          499,
          499,
          499
        ],
        "geometricTargetPixels": 557.3333333333335,
        "limits": "Nominal cameraFOV, threshold/limb/exposure, molecular transfer and colour remain approximate, not calibrated."
      },
      "url": "/bespoke/ross248-star-sky-image.jpg",
      "previewUrl": "/bespoke/ross248-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-69354a9f-78ea-477b-b934-5a1c7798a47a.png",
      "sourceSha256": "387de09569e6fdbe3c036c2fa1c8620138d89a31c186a917ecd97cf5ace06469",
      "sha256": "c56d62d6706233dda16a9dc656aa7e5f6a518ab5155462c89dac9e5bfc04108a",
      "previewSha256": "c3e08b69ad6b1486e03310ba9a369f09aecde23c2b711a040799491e28f79b7a",
      "bytes": 69210,
      "previewBytes": 14304,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "epsilon-eridani-star": {
    "id": "epsilon-eridani-star",
    "name": "Epsilon Eridani",
    "kind": "star",
    "aliases": [
      "Epsilon Eridani",
      "eps Eri",
      "epsilon Eri",
      "Ran",
      "HD 22049",
      "GJ 144",
      "Gl 144",
      "Gliese 144",
      "HIP 16537"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "SIMBAD identifiers verify Ran=epsEri=HD22049=GJ144/HIP16537; actualHYG hyg-16496. Not Rana/deltaEridani or EpsilonEridanib, whose earlier dossier remains unchanged.",
    "nativeSurface": "NativeALMA star/debrisbelt point-source image retained. No resolved visible photospheric geography found in checked sources. Recent2026 JWST coronagraph analysis targets the planet and retains a tentative low-SNR feature, not a confirmed planet/visible stellar surface image.",
    "measured": [
      "Baines/Armstrong2011 preprint/2012 Table3 optical interferometry limb-darkened angular diameter2.153±0.028mas, uniform-disk2.080±0.028mas. Three observing nights in2010; exampleTable2 begins2010-11-18, exact complete epoch list not inferred from partialtable.",
      "Booth etal2023 Table1 nativeALMA Band6 1.29mm observations2019-12-16/17/18/22/23, project2019.1.00696.S, beam1.6×1.2arcsec; unresolved central star and resolved dustbelt.",
      "SIMBAD primary identifier/astrometry entry indexes GaiaEDR3 parallax310.5773±0.1355mas; propermotionRAcosDec−974.758±0.160 andDec20.876±0.120mas/yr. This is not a recomputed exhaustive nearest20ranking."
    ],
    "modelled": [
      "Baines/Armstrong Table3 radius0.74±0.01Rsun, effective temperature5039±126K, luminosity0.32±0.03Lsun, mass0.82±0.05Msun. Radius combines angular diameter with adopted Benedict2006 parallax311.73±0.11mas; temperature uses bolometric flux, mass Yonsei-Yale isochrones. Estimated age~1Gyr is model-dependent.",
      "Existing planet illumination adopted NASA archive composite0.759106Rsun/5020.38K; preserved without overwriting. Stellar catalogue rendering parameters and historical coordinates remain unchanged. Differences reflect measurement/reference histories, not a coherent joint refit.",
      "ALMA CLEAN interferometric reconstruction is observational intensity, without primary-beam correction inFigure1a; starposition has53percent beam response. Two off-centre point sources are consistent with background galaxies, not companion planets. Resolved belt/clump models are not photospheric morphology.",
      "Hydrogen/helium partlyionized photospheric gas and convection/magneticregions are general Kdwarf-model context, not measured gas abundance fractions or fixed surface geography."
    ],
    "unknown": [
      "Resolved photospheric spot/convection geography, magnetic longitudes, measured composition fractions, calibrated visible colour/exposure and dated observer registration.",
      "Current exhaustive nearest20stellar ranking and reconciliation of bright-star/planet-aware astrometry; exact updated coherent stellar fit."
    ],
    "assumed": [
      "Independent invented gas intensity/spot morphology and conceptual observer; no observed Sun or another-body skin reuse.",
      "Hypothetical camera2photosphericradii fromcentre; no solid ground or survivable landing.",
      "Nominal120degreehorizontalFOV, colour, exposure and spectraltransfer remain artistic. Debrisbelt/planet outside assumed observer direction; no dated orbital registration claimed."
    ],
    "surfaceLabel": "PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/pdf/1112.0447",
        "title": "Baines/Armstrong optical interferometry and inferred stellar parameters, Table3",
        "publicationDate": "2011-12-02"
      },
      {
        "url": "https://arxiv.org/html/2303.13584",
        "title": "Booth etal2023 nativeALMA star/debrisbelt, Figure1 and Table1",
        "publicationDate": "2023-03-23"
      },
      {
        "url": "https://arxiv.org/html/2609.19131v1",
        "title": "Llop-Sayson etal2026 updated planet model; tentative feature remains unconfirmed",
        "publicationDate": "2026-09-16"
      },
      {
        "url": "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eps+Eri",
        "title": "CDS/SIMBAD component aliases and GaiaEDR3 reference history",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/epsilon-star-alma-native.png",
        "source": "https://arxiv.org/html/2303.13584v1/fig1a.png",
        "sourcePage": "https://arxiv.org/html/2303.13584",
        "label": "NATIVE MILLIMETRE STAR AND DEBRIS BELT",
        "credit": "Mark Booth, Tim D. Pearce, Alexander V. Krivov, Mark C. Wyatt, William R. F. Dent, Antonio S. Hales, Jean-François Lestrade, Fernando Cruz-Sáenz de Miera, Virginie C. Faramaz, Torsten Löhne and Miguel Chavez-Dagostino; ALMA (ESO/NAOJ/NRAO), project2019.1.00696.S.",
        "terms": "Unchanged author Figure1a with full attribution in user-authorized credited-use context; arXiv distribution licence is not asserted as CC BY.",
        "termsUrl": "https://info.arxiv.org/help/license/index.html",
        "publicationDate": "2023-03-23",
        "observationDate": "2019-12-16/2019-12-23",
        "tier": "measured",
        "sha256": "a2db47771bbab7aa025841cf8229aa7ee073c6df0462639ad489f5cadcf9cfbf",
        "bytes": 319546,
        "description": "Unchanged nativeALMA1.29mm Figure1a CLEAN image, observed2019-12-16/17/18/22/23. Central point is the unresolved star; off-centre points are consistent with background galaxies, not planets/stellar companions. Belt is resolved dust emission. False-colour scale, beam and uncorrected primary-beam sensitivity are instrumental/reconstruction context, not calibrated visible colour or photospheric geography."
      }
    ],
    "skyModel": {
      "star": "Epsilon Eridani",
      "radiusSun": 0.74,
      "temperatureK": 5039,
      "distanceAU": 0.006882691546223994,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 6714.581812732347,
      "approximateSrgb": [
        1,
        0.8971974977282111,
        0.8128408880476404
      ],
      "limits": "Conceptual camera2photosphericradii fromcentre;60degree diameter, nominal120degreeFOV. Raster size, exposure, visible colour and spectral transfer remain artistic and uncalibrated."
    },
    "surfaceMap": {
      "key": "epsilonEridaniStarBespoke",
      "texLon0": -180,
      "projection": "2:1 invented longitude/latitude photospheric intensity map; no measured surface frame.",
      "coverage": "Entire gas/spot morphology invented; approximate catalogue tint.",
      "url": "/bespoke/epsilon-eridani-star-surface-map.jpg",
      "previewUrl": "/bespoke/epsilon-eridani-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-41598aaa-d4c4-40f3-913f-d8d4960e65ac.png",
      "sourceSha256": "3f431cd2a72b4451bff913e6df7e119b0df5a654489371bdda4b1b38ffcc6820",
      "sha256": "ea4859a5a8025bffcffa37430d655441ce6d5ea1a10a7ea2bf0f1d605975199c",
      "previewSha256": "db9cc1cfadd65325572646f8763a4644efbac7acedc402aec222a9f046d11500",
      "bytes": 551118,
      "previewBytes": 46445,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Central four-neighbour bright component excludes disconnected background stars.",
        "brightCoreWidths": [
          427,
          426,
          424
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Nominal camera FOV, exposure, spectral transfer, colour and bright limb threshold remain approximate and uncalibrated."
      },
      "url": "/bespoke/epsilon-eridani-star-sky-image.jpg",
      "previewUrl": "/bespoke/epsilon-eridani-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-82ccedc1-7515-49eb-9132-7d38222aac78.png",
      "sourceSha256": "35c209b529f7deb0fbe5320e8160d208ab1fe9bd7c5f3e50e1518ba230e4c52a",
      "sha256": "8b80006534504d1f949ac8dc269de27c2db190ed6ec1f9469b679b097c46177e",
      "previewSha256": "7ce66969e19e1d365ae4388c12a005d5ec1c852befed70bcad279f3b2b4e9e37",
      "bytes": 88063,
      "previewBytes": 20633,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "gj887-star": {
    "id": "gj887-star",
    "name": "GJ 887",
    "kind": "star",
    "aliases": [
      "GJ 887",
      "Gl 887",
      "Gliese 887",
      "Lacaille 9352",
      "HD 217987",
      "HIP 114046"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Hartogh2026 Section2 and SIMBAD verify GJ887=HD217987=Lacaille9352; actualHYG hyg-113687. Not the four planetsGJ887b/c/d/e, whose prior dossiers remain unchanged.",
    "nativeSurface": "NativeESO interferometric fringe graphic retained as measurement/processing context; no resolved photospheric geography found in checked primary sources. No borrowed Sun map.",
    "measured": [
      "ESO eso0232d graphic shows raw black interferometric fringes and wavelet-denoised red data, released2002-11-29; exact observing day unknown. Neither curve is calibrated visible colour or a stellar surface photograph.",
      "SIMBAD indexes GaiaEDR3 parallax304.1354±0.0200mas; Hartogh2026 Table1 rounds304.135±0.020mas, distance3.2877pc. Historical selection preserved; current exhaustive nearest20ranking remains open.",
      "Jeffers2020 TESS2018 optical monitoring showed very low brightness variability. Loyd/Shkolnik/France/Wood/Youngblood2020 author-institution abstract reports two far-UV flares in2.8hoursHST monitoring despite optical quietness; no flare-free claim."
    ],
    "modelled": [
      "Hartogh2026 Table1 adopts3688±86K,0.468±0.022Rsun,0.495±0.049Msun,0.0368±0.0040Lsun and[Fe/H]−0.06±0.08 from Mann2015. Primary Mann Table5 continued Gl887 row independently verifies temperature/radius/mass/metallicity. Optical spectrum/bolometric-flux/empirical estimates are not direct resolved photospheric geography.",
      "Jeffers2020 Table1 alternate radius0.4712±0.086Rsun and mass0.489±0.05Msun retained as different reference histories; prior planet illumination and catalogue rendering parameters unchanged.",
      "Hartogh2026 age2.9−2.2/+8.0Gyr is model-dependent. Spectral labelsM1V inplanetpapers, MannM1.1 and SIMBADM2V differ; no new resolved classification asserted.",
      "Hydrogen/helium partlyionized molecular photospheric gas is general stellar-model context, not measured elemental fractions. Optical quietness does not determine UV radiative transfer or exact magnetic patches."
    ],
    "unknown": [
      "Resolved photospheric convection/spot geography, measured composition fractions, calibrated visible colour/exposure, molecular spectral transfer and dated observer registration.",
      "Current exhaustive nearest20boundary, exact flare location, current spot pattern and native fringe observationday."
    ],
    "assumed": [
      "Independent quiescent intensity pattern with fine gas cells and sparse small magnetic patches; all morphology/longitudes invented, no observed Sun/other-body map reuse.",
      "Hypothetical freecamera2photosphericradii fromcentre; no solid ground or survivable landing.",
      "Nominal120degreehorizontalFOV, gas tint/exposure/spectraltransfer and scene registration remain artistic; no actual UVflare recreated as visible image."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/2602.08929v2",
        "title": "Hartogh etal2026 RedDots, Table1 and Section2 stellar parameters",
        "publicationDate": "2026-03-04"
      },
      {
        "url": "https://arxiv.org/pdf/1501.01635",
        "title": "Mann2015 Table5 continued Gl887 parameter row",
        "publicationDate": "2015-01-07"
      },
      {
        "url": "https://arxiv.org/html/2006.16372",
        "title": "Jeffers2020 optical variability and alternative parameter history",
        "publicationDate": "2020-06-29"
      },
      {
        "url": "https://experts.colorado.edu/display/pubid_300174",
        "title": "Loyd etal2020 author-institution primary abstract, UV flares despite optical quietness",
        "publicationDate": null
      },
      {
        "url": "https://www.eso.org/public/images/eso0232d/",
        "title": "ESO native interferometric fringe data and processing graphic",
        "publicationDate": "2002-11-29"
      },
      {
        "url": "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=GJ+887",
        "title": "CDS primary identifier and GaiaEDR3 indexed astrometry",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/gj887-star-fringes-native.jpg",
        "source": "https://cdn.eso.org/images/large/eso0232d.jpg",
        "sourcePage": "https://www.eso.org/public/images/eso0232d/",
        "label": "NATIVE INTERFEROMETRIC MEASUREMENT GRAPHIC",
        "credit": "ESO; GJ887 optical long-baseline interferometric fringes and wavelet noise reduction, imageeso0232d.",
        "terms": "ESO public image, Creative Commons Attribution4.0; unchanged publisher largeJPEG. Credit retained visibly.",
        "termsUrl": "https://www.eso.org/public/outreach/copyright/",
        "publicationDate": "2002-11-29",
        "observationDate": null,
        "tier": "measured",
        "sha256": "bdeec28cb01cf487ce676d1345b3c732215d405a354b3e9a6e8a69fb0f567098",
        "bytes": 130498,
        "description": "Unchanged ESO graphic released2002-11-29: black rawfringes include atmospheric perturbation, red wavelet-denoised curve is processed measurement. Exact observationday unknown. These are data curves, not a resolved photosphere photograph, measured surface geography or visible-colour reproduction."
      }
    ],
    "skyModel": {
      "star": "GJ 887",
      "radiusSun": 0.468,
      "temperatureK": 3688,
      "distanceAU": 0.00435283735626058,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 1926.660465542755,
      "approximateSrgb": [
        1,
        0.7754439309284207,
        0.5916472389223643
      ],
      "limits": "Conceptual camera2photosphericradii fromcentre;60degree diameter. Nominal120degreeFOV, visible colour, molecular spectral transfer, exposure and bright-core threshold remain artistic/approximate and uncalibrated."
    },
    "surfaceMap": {
      "key": "gj887StarBespoke",
      "texLon0": -180,
      "projection": "2:1 invented longitude/latitude photospheric intensity map; no observed stellar frame.",
      "coverage": "Entire gas/spot morphology imagined; approximate catalogue tint.",
      "url": "/bespoke/gj887-star-surface-map.jpg",
      "previewUrl": "/bespoke/gj887-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-a80b25c2-27b6-44d8-b4d2-00bf307e6ef9.png",
      "sourceSha256": "2c4490eed3c831c53643152eba4529b6a3218d0e42be995dae1b2cb2a3893426",
      "sha256": "78b5b12af2c6e48d46808c70714bf41a5c2ab9d66c9af28548ff14dfa9f7ed3d",
      "previewSha256": "1bce0ed90adce204fe1ab681876be8437d1f2a40749ab763cd1b9dee48842c8d",
      "bytes": 423659,
      "previewBytes": 38877,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Central four-neighbour bright component excludes disconnected background stars.",
        "brightCoreWidths": [
          556,
          556,
          556
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Nominal camera FOV, exposure, spectral transfer, colour and bright limb threshold remain approximate and uncalibrated."
      },
      "url": "/bespoke/gj887-star-sky-image.jpg",
      "previewUrl": "/bespoke/gj887-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4eabaa25-7ab6-413c-a903-b08452efaa1d.png",
      "sourceSha256": "eb2cf41c6e3b29efd4f621fbe923e3aabb8447b9f9b5f424c4999b2d93d03123",
      "sha256": "496893083508cf6fda5b691f5e7f62148cc04dd667dd05e7b6d2ea1ceccb1b2c",
      "previewSha256": "3b33476cf2c13c2cc95ce4a16afc8312ec9076d090f3d890b840ba650b934d36",
      "bytes": 86874,
      "previewBytes": 17281,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "ross128-star": {
    "id": "ross128-star",
    "name": "Ross 128",
    "kind": "star",
    "aliases": [
      "Ross 128",
      "FI Vir",
      "GJ 447",
      "Gl 447",
      "Gliese 447",
      "HIP 57548",
      "LHS 315"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "SIMBAD verifies FI Vir/GJ447/HIP57548; actualHYG hyg-57375. Bonfils manuscript prose FY Virginis conflicts with verified FI Vir and is not adopted. Distinct from planet Ross128b.",
    "nativeSurface": "Native DSS2 multi-epoch point-source field retained unchanged. No resolved photospheric map found in checked primary sources; ESO planet artwork assessed, not used as stellar skin.",
    "measured": [
      "ESO DSS2 optical630/797nm field combines photographs spanning more than40years; multiple central appearances are proper motion across epochs, not companions. Released2017-11-15; exact individual observationdays unknown.",
      "SIMBAD indexes GaiaEDR3 parallax296.3053±0.0302mas; older BonfilsTable1 Gaia2016parallax295.80±0.54mas is a distinct history. Current exhaustive nearest20boundary remains open.",
      "Bonfils2017/2018 describes slow rotation and weak magnetic activity from K2/ASAS/HARPS. Quiescent illustration does not claim flare-free emission."
    ],
    "modelled": [
      "BonfilsTable1 adopts Mann2015 optical-spectrum/flux/empirical3192±60K,0.1967±0.0077Rsun,0.168±0.017Msun,[M/H]−0.02±0.08,L0.00362±0.00039Lsun. These are model-dependent estimates, not resolved surface measurements. Primary Mann2015Table5 continued Gl447 row independently verifies these adopted values.",
      "Souto2018Table1 alternate MARCS3231±100K/logg4.96±0.11 versusPHOENIX3223±100K/logg4.89±0.11; near-solar metallicity+0.03±0.09. 1D LTE spectral synthesis, APOGEE1.5–1.7micron spectra observed2014-01-28. These alternatives remain distinct; earlier planet illumination and catalogue fields unchanged.",
      "Hydrogen/helium partlyionized molecular photospheric gas is broad stellar model context, not measured bulk fractions. Molecular opacity prevents a blackbody tint from establishing calibrated visible colour."
    ],
    "unknown": [
      "Resolved convection/spot geography, photospheric bulk fractions, calibrated visible colour/exposure/FOV and dated observer registration.",
      "Current exhaustive nearest20boundary and exact native DSS2 plate days."
    ],
    "assumed": [
      "Independent imagined fine gas convection with sparse small darker magnetic patches; all longitudes/morphology invented, no observed Sun/otherbody map reused.",
      "Hypothetical freecamera2photosphericradii fromcentre; no solid ground or survivable landing.",
      "Nominal120degreehorizontalFOV, colour/exposure and molecularspectraltransfer remain approximate."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://www.eso.org/public/archives/releases/sciencepapers/eso1736/eso1736a.pdf",
        "title": "Bonfils2017/2018 Table1 adopted stellar parameters",
        "publicationDate": "2017-11-08"
      },
      {
        "url": "https://arxiv.org/html/1805.11633v2",
        "title": "Souto2018 APOGEE spectral analysis and alternate Table1 models",
        "publicationDate": "2018-06-14"
      },
      {
        "url": "https://www.eso.org/public/images/eso1736b/",
        "title": "Native DSS2 multi-epoch optical field",
        "publicationDate": "2017-11-15"
      },
      {
        "url": "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Ross+128",
        "title": "CDS primary identity and indexed GaiaEDR3 astrometry",
        "retrieved": "2026-10-10"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/ross128-star-dss-native.jpg",
        "source": "https://cdn.eso.org/images/screen/eso1736b.jpg",
        "sourcePage": "https://www.eso.org/public/images/eso1736b/",
        "label": "NATIVE MULTI-EPOCH DSS2 FIELD",
        "credit": "Digitized Sky Survey2. Acknowledgement: Davide De Martin; via ESO imageeso1736b.",
        "terms": "ESO public image CC BY4.0; unchanged publisher screensize JPEG, credit retained.",
        "termsUrl": "https://www.eso.org/public/outreach/copyright/",
        "publicationDate": "2017-11-15",
        "observationDate": null,
        "tier": "measured",
        "sha256": "f7a3f67f8dd667a83c1efefe4fdd35f47ba186777cd49552f88f5b81f3fd9780",
        "bytes": 287611,
        "description": "Unchanged DSS2 optical630/797nm composite released2017-11-15. More than40years of plate epochs create multiple central Ross128 appearances through proper motion, not companions. Exact plate days unknown; unresolved field is not photospheric geography or calibrated visible colour."
      }
    ],
    "skyModel": {
      "star": "Ross 128",
      "radiusSun": 0.1967,
      "temperatureK": 3192,
      "distanceAU": 0.001829493820462513,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 1081.1677110791106,
      "approximateSrgb": [
        1,
        0.7191018637846154,
        0.48084225935692265
      ],
      "limits": "Hypothetical camera at2photosphericradii, no solid ground or survivable landing. Nominal120degreeFOV, colour, moleculartransfer, exposure and scene registration remain approximate;617pixel cores versus557.333target, not calibrated."
    },
    "surfaceMap": {
      "key": "ross128StarBespoke",
      "texLon0": -180,
      "projection": "2:1 invented longitude/latitude gas intensity map; no observed stellar frame.",
      "coverage": "All gas morphology/longitudes imagined; approximate renderer tint.",
      "url": "/bespoke/ross128-star-surface-map.jpg",
      "previewUrl": "/bespoke/ross128-star-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-8679eccb-0fe4-4b17-b146-8a4c4d10c14b.png",
      "sourceSha256": "7793e718cc077e1cc9dbf74f78f2c8a8eb64b51e280f41c92504fae0d1a8508a",
      "sha256": "19442aabfe144b90143acf501d577d53d824324e806f0aef0ec680a5b2a89ba2",
      "previewSha256": "52e68b7a981809b2a7f878aaaebbfed8f1d65bafa48b8f59f114716f87065c8d",
      "bytes": 404967,
      "previewBytes": 35542,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Central four-neighbour bright component excludes disconnected background stars.",
        "brightCoreWidths": [
          617,
          617,
          617
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Nominal camera FOV, exposure, spectral transfer, colour and bright limb threshold remain approximate and uncalibrated."
      },
      "url": "/bespoke/ross128-star-sky-image.jpg",
      "previewUrl": "/bespoke/ross128-star-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-9f0e7625-f310-4f57-bce1-5e18c1d6b66b.png",
      "sourceSha256": "323200527045e5aca5132548344c9c01595ea6014db8fbbff21fe1a1fd141fb8",
      "sha256": "60b6616a3cc38a2758683f5a477748afd77681d39c49b9eed086af4c0b02a173",
      "previewSha256": "d039ab93c56516f231233fc832590132cc08116345aa839e62d4da9c40ab4892",
      "bytes": 69140,
      "previewBytes": 14393,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "ez-aquarii-a": {
    "id": "ez-aquarii-a",
    "name": "EZ Aquarii A",
    "kind": "star",
    "aliases": [
      "EZ Aqr A",
      "EZ Aquarii A",
      "GJ 866 A",
      "Gl 866 A",
      "Gliese 866 A",
      "EZ Aqr"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Delfosse1999 labels A-C inner binary and AC-B outer orbit. ExistingHYG hyg-119518 EZ Aqr represents the unresolved system; this primary visual represents A explicitly, not a resolved identification or companion B/C skin. Bare EZ Aqr alias retained only for that existing primary route. Current component-aware astrometry/ranking unresolved.",
    "nativeSurface": "Native ELODIE cross-correlation measurement with ORBIT fit retained unchanged as spectroscopy/model context. No resolved A photospheric geography found in checked sources. SIMBAD component page unavailable via web tool; no invented astrometry.",
    "measured": [
      "Delfosse1999Table1 dynamicalmass A0.1216±0.0029Msun, B0.1161±0.0029Msun,C0.0957±0.0023Msun. A-C is inner pair; do not infer B/C brown-dwarf status from catalogue LM? category.",
      "CFHTPUEO/KIR1998-07-23 angular measurement resolves AC photocentre fromB, notAfromC. ELODIE spectra collected1995-09 to1999-07.",
      "Figure1 contains triple-lined spectral cross-correlation and ORBIT adjustment, not a spatial photograph. Caption JD2550389.3191 conflicts with Table3 JD2450389.319 dated1996-11-01; exact figureepoch not asserted."
    ],
    "modelled": [
      "Delfosse1999Table2 innerP3.78652days, outerP822.6days; Table1 orbitalparallax290.4±2.7mas. Historical10pcA selection uses293.6±0.9mas from2010reference; distinct fits preserved, no current astrometry replacement.",
      "Combined spectral type M5.5V from historical system reference. Independent A-only radius/temperature not verified; common2650K not in checkedDelfosse1999paper. Older binary-only estimates may blendA+C.",
      "Partlyionized molecularHHe photospheric gas is broad stellar model context, not measured bulkfractions or resolved chemical map.",
      "Delfosse2000Table1 adopts revisedSeg00a masses A0.1187±0.0011,B0.1145±0.0012,C0.0930±0.0008Msun; distinct later reference history, no catalogue update."
    ],
    "unknown": [
      "Independent current A-only effective temperature/radius, precise bulkcomposition, resolved cells/spotlongitudes, calibrated visible colour and exposure.",
      "Current component-aware astrometry/exhaustive nearest20boundary, observerepoch and exact companion viewgeometry.",
      "Modern WDS/SIMBAD component lettering versus historical DelfosseA-C convention needs reconciliation; no modern WDS alias attached."
    ],
    "assumed": [
      "Explicit illustrative A-only2900K and0.15Rsun, not measured or uniquely inferred from combined spectrum. This does not alter catalogue fields or other components.",
      "Independent invented fine gasconvection/smallmagneticpatches; no observedSun/otherbodymapreuse, no solid ground or survivable landing.",
      "Freecamera at2assumedphotosphericradii, nominal120degreeHFOV; companions outside an arbitrary viewing direction, not an epochregistered scene. Colour/moleculartransfer/exposure/FOV remain approximate."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/html/astro-ph/9909409",
        "title": "Delfosse/Forveille/Udry/Beuzit/Mayor/Perrier1999, component masses and hierarchical orbits",
        "publicationDate": "1999-09-23"
      },
      {
        "url": "https://gruze.org/10pc/The10pcSample_v2.json",
        "title": "Historical10pc component identities and selection; current reconciliation remains open"
      },
      {
        "url": "https://cdsarc.u-strasbg.fr/ftp/vizier/aa/papers/0364001/2300217.pdf",
        "title": "Delfosse2000 revised component mass table citingSeg00a, primary indexed text checked"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/ez-aquarii-a-correlation-native.png",
        "source": "https://arxiv.org/html/astro-ph/9909409v1/correlation_6.png",
        "sourcePage": "https://arxiv.org/html/astro-ph/9909409",
        "label": "NATIVE SPECTROSCOPY WITH ORBIT MODEL FIT",
        "credit": "X.Delfosse,T.Forveille,S.Udry,J.-L.Beuzit,M.Mayor,C.Perrier; OHP1.93m/ELODIE, ORBIT adjustment, Figure1(1999).",
        "terms": "Unchanged author Figure1 from arXiv; distribution licence not asserted CC BY. Credited reuse in user-authorized project context.",
        "termsUrl": "https://arxiv.org/abs/astro-ph/9909409",
        "publicationDate": "1999-09-23",
        "observationDate": null,
        "tier": "modelled",
        "sha256": "f656bdf79fc322861298cf2a7072582889473e87dbca70df6d585346c80e942d",
        "bytes": 29471,
        "description": "Unchanged triple-lined ELODIE cross-correlation measurement with ORBIT adjustment, not a spatial photograph or visible-colour photosphere. Caption JD2550389.3191 conflicts with Table3 JD2450389.319/1996-11-01; precise figuredate unasserted. General ELODIE epochs1995-09 to1999-07."
      }
    ],
    "skyModel": {
      "star": "EZ Aquarii A",
      "radiusSun": 0.15,
      "temperatureK": 2900,
      "distanceAU": 0.0013951401782886473,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 736.6030757519585,
      "approximateSrgb": [
        1,
        0.6816786297548326,
        0.40318515446390524
      ],
      "limits": "Assumed A-only2900K/.15Rsun illustration; hypothetical camera at2photosphericradii, no solid ground or survivable landing. Nominal120degreeFOV, colour, moleculartransfer, exposure and scene registration remain approximate;529/529/528pixel cores versus557.333target, not calibrated."
    },
    "surfaceMap": {
      "key": "ezAquariiABespoke",
      "texLon0": -180,
      "projection": "2:1 invented primary gas intensity map, no measured stellar frame.",
      "coverage": "All gas morphology/longitudes imagined; assumed A-only temperature/radius.",
      "url": "/bespoke/ez-aquarii-a-surface-map.jpg",
      "previewUrl": "/bespoke/ez-aquarii-a-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-69d63e7e-e52f-4faf-aa73-0a6c63d52e7d.png",
      "sourceSha256": "2be91186da6aa56087bf309146b24805c63adc75c7edeb8642a3a1c6c1b301fe",
      "sha256": "59423bdf07421665de495ed0d7071683aa9f3c5d4240a5a12d5a144103fa7360",
      "previewSha256": "3b92d000d5b32b1d069e611b91e32524279c6befedc188d88d8781b0a1791f22",
      "bytes": 309245,
      "previewBytes": 28092,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Central four-neighbour bright component excludes disconnected background stars.",
        "brightCoreWidths": [
          529,
          529,
          528
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "Nominal camera FOV, exposure, spectral transfer, colour and bright limb threshold remain approximate and uncalibrated."
      },
      "url": "/bespoke/ez-aquarii-a-sky-image.jpg",
      "previewUrl": "/bespoke/ez-aquarii-a-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-fc33789f-bbdc-4118-b793-82953dd9e6b4.png",
      "sourceSha256": "387edd94d8acfd3e517946187c6522dbf9a5ad12ce979858a58bf73c8e1cf024",
      "sha256": "4d55be84584cdd02e60212bf43c5aea44cf977120da9a0701e215ff06d782b4b",
      "previewSha256": "8cd6b5d1237c6c792956f031e51ec2970c184ac7ba5a998b944368d69fddf126",
      "bytes": 66404,
      "previewBytes": 13566,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    }
  },
  "61-cygni-a": {
    "id": "61-cygni-a",
    "name": "61 Cygni A",
    "kind": "star",
    "aliases": [
      "61 Cygni A",
      "61 Cyg A",
      "GJ 820 A",
      "Gl 820 A",
      "HD 201091"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "61 Cygni A is the northern brighter K5V component in the 2025-01-10 Gaia portrait. Component aliases are separate; catalogue binary fields remain unchanged.",
    "nativeSurface": "Native Gaia 2025 image resolves the two stars as point sources, not photospheric geography. No resolved photospheric map found in checked primary sources. September2026 third companion remains a candidate with host A versus B unresolved.",
    "measured": [
      "Kervella2008 CHARA/FLUOR K-prime interferometry limb-darkened angular diameters A1.775±0.013mas/B1.581±0.022mas. Disc size measurement does not resolve gas-cell geography.",
      "Gaia special calibration image observed2025-01-10, released2025-01-15. North up/east left, A north of B. False colour represents intensity only; diffraction and background points are not photospheric structure or planets."
    ],
    "modelled": [
      "Kervella2008 radii A0.665±0.005/B0.595±0.008Rsun from angular size and adopted parallax. BVRI surface-brightness temperatures A4400±100/B4040±80K, equations10/11. K-band limb-darkening lookup rounded4400/4000K is not a separate temperature measurement.",
      "Sanghi2026 Table1 adopts distinct references: radii0.667±0.005/0.594±0.008Rsun and Soubiran temperatures4398±34/4174±47K. These are alternative reference histories; preserved catalogue values not replaced.",
      "Sanghi2026 Table1 GaiaDR3 component parallaxes285.9949±0.0599/286.0054±0.0289mas; distances3.49624/3.49607pc. Current exhaustive nearest20 ranking remains open.",
      "September2026 candidate third companion has broad model constraints about8±3MJup and8±3AU; host A versus B unresolved and confirmation required. Not inserted as a confirmed planet.",
      "Broad hydrogen/helium partly ionized photospheric gas context, not measured bulk fractions or a chemical map."
    ],
    "unknown": [
      "Resolved convective cells, magnetic patch locations, calibrated visible colour/exposure, exact observer epoch and viewing direction.",
      "Confirmed third companion and host identity; exhaustive current nearest20 boundary."
    ],
    "assumed": [
      "Independent invented gas convection and sparse magnetic patches, no observed Sun or other body map reuse, no solid ground or survivable landing.",
      "Conceptual free camera at2photosphericradii, nominal120degree horizontal FOV and angular60degrees. Colour, spectral transfer, exposure and registration remain approximate. Binary companion outside arbitrary viewing direction, not dated geometry."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/0806.4049",
        "title": "Kervella et al.2008, CHARA radii and BVRI surface-brightness temperatures",
        "publicationDate": "2008-06-25"
      },
      {
        "url": "https://www.cosmos.esa.int/web/gaia/iow_20250115",
        "title": "ESA/Gaia/DPAC2025, final61Cygni calibration image",
        "publicationDate": "2025-01-15"
      },
      {
        "url": "https://arxiv.org/html/2609.32893v1",
        "title": "Sanghi et al.2026, candidate third companion with unresolved host",
        "publicationDate": "2026-09-26"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/61-cygni-gaia-native.png",
        "source": "https://www.cosmos.esa.int/documents/29201/18625858/2024-10-14_SIF_61Cyg.png/043a4d36-adf2-2510-fe6b-8c2922f74ef7?t=1734512442613",
        "sourcePage": "https://www.cosmos.esa.int/web/gaia/iow_20250115",
        "label": "NATIVE GAIA BINARY IMAGE · INTENSITY FALSE COLOUR",
        "credit": "ESA/Gaia/DPAC; full Gaia collaboration.",
        "terms": "CC BY-SA3.0IGO; original publisher image copied unchanged, shared under the original terms.",
        "termsUrl": "https://creativecommons.org/licenses/by-sa/3.0/igo/",
        "publicationDate": "2025-01-15",
        "observationDate": "2025-01-10",
        "tier": "measured",
        "sha256": "1c09e4adede1f135b1087b651691b0ade07b8c8f853dfb18c2bd1b9d37e91db6",
        "bytes": 176033,
        "description": "Native special Gaia calibration image: northern brighter A and southern fainter B, north up/east left. Intensity-only false colour, diffraction spikes and background stars; not calibrated visible colour or resolved photospheric geography."
      }
    ],
    "skyModel": {
      "star": "61 Cygni A",
      "radiusSun": 0.665,
      "temperatureK": 4400,
      "distanceAU": 0.00618512145707967,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 3903.4825505189765,
      "approximateSrgb": [
        1,
        0.8443012229715662,
        0.7192888886816914
      ],
      "limits": "Hypothetical camera2photosphericradii, no ground/survivable landing; nominal120degreeFOV, colour/exposure/spectral transfer/registration approximate. Bright cores 664/664/662px versus557.333px geometric target, uncalibrated."
    },
    "surfaceMap": {
      "key": "cyg61ABespoke",
      "texLon0": -180,
      "projection": "2:1 invented stellar gas intensity map; no measured longitude frame.",
      "coverage": "All convection and magnetic patch morphology imagined.",
      "url": "/bespoke/61-cygni-a-surface-map.jpg",
      "previewUrl": "/bespoke/61-cygni-a-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4387b1f2-4896-406d-b7df-7dbe80555e82.png",
      "sourceSha256": "fad447c4a723ea8b30f061ae902d221d659f3d361c6f53964f50b181edd10d42",
      "sha256": "e1dc8ac8637fec18da40930a8e0d7fc45d09c60bc36c03ab773b2eaa19414e06",
      "previewSha256": "871154a87b126070abbc8f0e8283252f54b709d50dd6e3eb7b77b408f2de9a27",
      "bytes": 447600,
      "previewBytes": 40867,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/61-cygni-a-sky-image.jpg",
      "previewUrl": "/bespoke/61-cygni-a-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-ff07e86c-7f94-43d5-b874-362f6192da76.png",
      "sourceSha256": "899708aa9aa70e4be16ab7a7e401205dbf5a512df67ea55921ee7ce10250a5f2",
      "sha256": "feb32ab0aca7d66a8fb2e7e48cb0a14164b69234942f9bb5075fe05ca4085497",
      "previewSha256": "613491a21c6093c74db316fc0c5a7ec4fda02ead7b618cb24001818ce762652d",
      "bytes": 96563,
      "previewBytes": 18333,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Largest four-neighbour bright component at each threshold, excluding isolated gas-cell highlights and background; R>threshold/G>150/B>80.",
        "brightCoreWidths": [
          664,
          664,
          662
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "NominalFOV, exposure, spectral transfer, colour, threshold and registration approximate; no calibration claim."
      }
    }
  },
  "61-cygni-b": {
    "id": "61-cygni-b",
    "name": "61 Cygni B",
    "kind": "star",
    "aliases": [
      "61 Cygni B",
      "61 Cyg B",
      "GJ 820 B",
      "Gl 820 B",
      "HD 201092"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "61 Cygni B is the southern fainter K7V component in the 2025-01-10 Gaia portrait. Component aliases are separate; catalogue binary fields remain unchanged.",
    "nativeSurface": "Native Gaia 2025 image resolves the two stars as point sources, not photospheric geography. No resolved photospheric map found in checked primary sources. September2026 third companion remains a candidate with host A versus B unresolved.",
    "measured": [
      "Kervella2008 CHARA/FLUOR K-prime interferometry limb-darkened angular diameters A1.775±0.013mas/B1.581±0.022mas. Disc size measurement does not resolve gas-cell geography.",
      "Gaia special calibration image observed2025-01-10, released2025-01-15. North up/east left, A north of B. False colour represents intensity only; diffraction and background points are not photospheric structure or planets."
    ],
    "modelled": [
      "Kervella2008 radii A0.665±0.005/B0.595±0.008Rsun from angular size and adopted parallax. BVRI surface-brightness temperatures A4400±100/B4040±80K, equations10/11. K-band limb-darkening lookup rounded4400/4000K is not a separate temperature measurement.",
      "Sanghi2026 Table1 adopts distinct references: radii0.667±0.005/0.594±0.008Rsun and Soubiran temperatures4398±34/4174±47K. These are alternative reference histories; preserved catalogue values not replaced.",
      "Sanghi2026 Table1 GaiaDR3 component parallaxes285.9949±0.0599/286.0054±0.0289mas; distances3.49624/3.49607pc. Current exhaustive nearest20 ranking remains open.",
      "September2026 candidate third companion has broad model constraints about8±3MJup and8±3AU; host A versus B unresolved and confirmation required. Not inserted as a confirmed planet.",
      "Broad hydrogen/helium partly ionized photospheric gas context, not measured bulk fractions or a chemical map."
    ],
    "unknown": [
      "Resolved convective cells, magnetic patch locations, calibrated visible colour/exposure, exact observer epoch and viewing direction.",
      "Confirmed third companion and host identity; exhaustive current nearest20 boundary."
    ],
    "assumed": [
      "Independent invented gas convection and sparse magnetic patches, no observed Sun or other body map reuse, no solid ground or survivable landing.",
      "Conceptual free camera at2photosphericradii, nominal120degree horizontal FOV and angular60degrees. Colour, spectral transfer, exposure and registration remain approximate. Binary companion outside arbitrary viewing direction, not dated geometry."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/0806.4049",
        "title": "Kervella et al.2008, CHARA radii and BVRI surface-brightness temperatures",
        "publicationDate": "2008-06-25"
      },
      {
        "url": "https://www.cosmos.esa.int/web/gaia/iow_20250115",
        "title": "ESA/Gaia/DPAC2025, final61Cygni calibration image",
        "publicationDate": "2025-01-15"
      },
      {
        "url": "https://arxiv.org/html/2609.32893v1",
        "title": "Sanghi et al.2026, candidate third companion with unresolved host",
        "publicationDate": "2026-09-26"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/61-cygni-gaia-native.png",
        "source": "https://www.cosmos.esa.int/documents/29201/18625858/2024-10-14_SIF_61Cyg.png/043a4d36-adf2-2510-fe6b-8c2922f74ef7?t=1734512442613",
        "sourcePage": "https://www.cosmos.esa.int/web/gaia/iow_20250115",
        "label": "NATIVE GAIA BINARY IMAGE · INTENSITY FALSE COLOUR",
        "credit": "ESA/Gaia/DPAC; full Gaia collaboration.",
        "terms": "CC BY-SA3.0IGO; original publisher image copied unchanged, shared under the original terms.",
        "termsUrl": "https://creativecommons.org/licenses/by-sa/3.0/igo/",
        "publicationDate": "2025-01-15",
        "observationDate": "2025-01-10",
        "tier": "measured",
        "sha256": "1c09e4adede1f135b1087b651691b0ade07b8c8f853dfb18c2bd1b9d37e91db6",
        "bytes": 176033,
        "description": "Native special Gaia calibration image: northern brighter A and southern fainter B, north up/east left. Intensity-only false colour, diffraction spikes and background stars; not calibrated visible colour or resolved photospheric geography."
      }
    ],
    "skyModel": {
      "star": "61 Cygni B",
      "radiusSun": 0.595,
      "temperatureK": 4040,
      "distanceAU": 0.005534056040544968,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 59.99999999999999,
      "centreDiscWidthFraction": 0.3333333333333334,
      "irradianceEarth": 2774.3867188273152,
      "approximateSrgb": [
        1,
        0.8110039183292141,
        0.6584943167766204
      ],
      "limits": "Hypothetical camera2photosphericradii, no ground/survivable landing; nominal120degreeFOV, colour/exposure/spectral transfer/registration approximate. Bright cores 644/644/644px versus557.333px geometric target, uncalibrated."
    },
    "surfaceMap": {
      "key": "cyg61BBespoke",
      "texLon0": -180,
      "projection": "2:1 invented stellar gas intensity map; no measured longitude frame.",
      "coverage": "All convection and magnetic patch morphology imagined.",
      "url": "/bespoke/61-cygni-b-surface-map.jpg",
      "previewUrl": "/bespoke/61-cygni-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-128a1d59-e94e-4874-a783-a9c6b27fecdf.png",
      "sourceSha256": "ebc31582fd4eeac7d0689ca73537878e49719faddf4c728f90fb9f3e3db41a06",
      "sha256": "d9832610e1dcf2ed8bec3a07dd956fc287344bd77948a2a34e4150850c81a9ec",
      "previewSha256": "a4dfe4187fdacfead040a6a7d2ce2fa59242fd2b31104eeb39647887659b30ba",
      "bytes": 428769,
      "previewBytes": 43138,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/61-cygni-b-sky-image.jpg",
      "previewUrl": "/bespoke/61-cygni-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-aa993dbf-040e-42ce-ab59-f35598d1306c.png",
      "sourceSha256": "cd3bbaad5b1a34b6569b8c9bb813617bb209e5ba839df3e186eb7f6d8899bd30",
      "sha256": "5c28248430b329174f312c1d9dadd2aa215f3ed79616d9ff0e4bb9c45e338335",
      "previewSha256": "c2b6ad748aafd76061040ccf6883ea2c5f4677032aa4ef1f757d3a83622b1de7",
      "bytes": 83612,
      "previewBytes": 17121,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Largest four-neighbour bright component at each threshold, excluding isolated gas-cell highlights and background; R>threshold/G>150/B>80.",
        "brightCoreWidths": [
          644,
          644,
          644
        ],
        "geometricTargetPixels": 557.3333333333335,
        "limits": "NominalFOV, exposure, spectral transfer, colour, threshold and registration approximate; no calibration claim."
      }
    }
  },
  "procyon-a": {
    "id": "procyon-a",
    "name": "Procyon A",
    "kind": "star",
    "aliases": [
      "Procyon A",
      "GJ 280 A",
      "Gliese 280 A",
      "alf CMi A",
      "Procyon",
      "HD 61421",
      "HIP 37279"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Procyon A is HD61421/HIP37279/GJ280A F5IV-V subgiant; Procyon B is GJ280B/WD0736+053 helium-atmosphere DQZ white dwarf. Historical selection retained pending EZ Aquarii B/C/current binary astrometry reconciliation.",
    "nativeSurface": "Native near-UV binary image resolves point sources, not photospheric geography. Recent native imagery assessed; independent conceptual gas map needed.",
    "measured": [
      "Bond2015 Table10 dynamical masses A1.478±.012/B.592±.006Msun; Table9 weighted parallax285.0±.7mas. Distinct historical archive284.56±1.26mas retained, no exhaustive current ranking claim.",
      "Native HST/WFPC2 F218W1997-11-27 resolves central A and left B, separation4.706arcsec, near-UV contrast8.5mag. PDF page45 Figure1 caption and Table1 verify0.14second A inset/100second B frame. 0.11second is detector minimum and later visits, not an epoch conflict."
    ],
    "modelled": [
      "Kervella2003 adopts spectroscopic 6530±50K (Allende Prieto2002); Hipparcos/interferometric radius 2.048±0.025Rsun. Its older model mass1.42±.04 is distinct from Bond2015 dynamical1.478±.012. No catalogue overwrite.",
      "Liebert2013 age1.87±.13Gyr/cooling1.19±.11 uses older preliminary B mass.553±.015; Bond2015 revised masses/overshoot age~2.7Gyr remain distinct.",
      "Bond2015 orbit40.840±.022yr, eccentricity.39785±.00025; catalogue orbital fields preserved. No registered companion position claimed in conceptual scene."
    ],
    "unknown": [
      "Resolved photospheric geography, convection/magnetic patch positions, calibrated visible colour, bulk fractions and scene epoch registration.",
      "Current binary-aware astrometry and physical nearest20 boundary remain open, including EZ Aquarii B/C reconciliation."
    ],
    "assumed": [
      "Independent invented gaseous intensity cells and emissive appearance, no observed Sun/other-body map reused; no solid ground or survivable landing.",
      "Broad H/He gas context for A; helium-dominated DQZ gas with trace carbon/metals for B. Theoretical C/O degenerate interior hidden, not exposed terrain.",
      "Free camera2photosphericradii, nominal120degreeHFOV, arbitrary direction excluding companion; colour, exposure and spectral transfer remain approximate."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/1510.00485",
        "title": "Bond et al.2015, HST Procyon binary astrometry and component models",
        "publicationDate": "2015-10-02"
      },
      {
        "url": "https://arxiv.org/abs/astro-ph/0309148",
        "title": "Kervella et al.2003/2004, Procyon A interferometry and adopted spectroscopy",
        "publicationDate": "2003-09-04"
      },
      {
        "url": "https://arxiv.org/abs/1305.0587",
        "title": "Liebert et al.2013, distinct earlier Procyon age and preliminary mass assumptions",
        "publicationDate": "2013-05-03"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/procyon-hubble-native.png",
        "source": "https://arxiv.org/html/1510.00485v1/blueprocyon_cropcrop.png",
        "sourcePage": "https://arxiv.org/abs/1510.00485",
        "label": "NATIVE HST BINARY · NEAR-UV FALSE COLOUR",
        "credit": "Howard E. Bond; Ronald L. Gilliland; Gail H. Schaefer; Pierre Demarque; Terrence M. Girard; Jay B. Holberg; Donald Gudehus; Brian D. Mason; Vera Kozhurina-Platais; Matthew R. Burleigh; Martin A. Barstow; Edmund P. Nelan; NASA/ESA HST/WFPC2; STScI/MAST/AURA, NASA contract NAS5-26555.",
        "terms": "arXiv perpetual non-exclusive distribution licence is not asserted CC BY. Retain full credits and authorized research context.",
        "termsUrl": "https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html",
        "publicationDate": "2015-10-02",
        "observationDate": "1997-11-27",
        "tier": "measured",
        "sha256": "7875491b035348c37e719035ee5de658c4d3a6309ce3f396b175288ba51580d6",
        "bytes": 92927,
        "description": "Author-paper release2015-10-02; exact raster publication day unknown. Central A0.14s inset, B left100s exposure, near-UV F218W false colour/PSF/diffraction. Not calibrated visible colour or resolved photospheric geography."
      }
    ],
    "skyModel": {
      "star": "Procyon A",
      "radiusSun": 2.048,
      "temperatureK": 6530,
      "distanceAU": 0.019048313900901,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 18936.262333565097,
      "approximateSrgb": [
        1,
        0.9983063673875654,
        0.9835113979300341
      ],
      "limits": "Hypothetical camera2photosphericradii, no ground/survivable landing; nominal120degreeFOV, colour/exposure/spectral transfer/registration approximate. Bright cores 549/548/543px versus557.333px geometric target, uncalibrated."
    },
    "surfaceMap": {
      "key": "procyonABespoke",
      "texLon0": -180,
      "projection": "2:1 independent imagined gaseous intensity; longitude frame invented.",
      "coverage": "Photospheric morphology imagined; no calibrated chemical/brightness map.",
      "url": "/bespoke/procyon-a-surface-map.jpg",
      "previewUrl": "/bespoke/procyon-a-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-0f6d1026-3c80-4998-ac39-70a6cc92cd12.png",
      "sourceSha256": "7166a03b029a28872d66611a8cbc4871166a13fe3f67e8bb98d6b8fd16dc788e",
      "sha256": "250003bc9de8222d517564c9baf40351f5ac4ebd8be5700f9a8c41b4be5990ec",
      "previewSha256": "cad147b89d3eddf32fd114eaea71bdd01917066f3fafc0891dcc13580a92c21f",
      "bytes": 445311,
      "previewBytes": 41862,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/procyon-a-sky-image.jpg",
      "previewUrl": "/bespoke/procyon-a-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-0e56b1de-938f-404b-ad25-f8ad1c9cc68f.png",
      "sourceSha256": "644c92d9bc58a9bf0acc6f61adeacc96ee46c8b2388f0566c3e090c0b1596949",
      "sha256": "b9ab797821c7b242c01816f9ae7e71ae7792b2e3c1ca71252f20d2ea350ae05c",
      "previewSha256": "05980291b1b0c7a76c0b9ea7593d0cb56710aff21fe4b4cef1cc74d41cde5b55",
      "bytes": 72678,
      "previewBytes": 15303,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Largest four-neighbour bright component at each threshold, excluding isolated gas-cell highlights and background; R>threshold/G>150/B>80.",
        "brightCoreWidths": [
          549,
          548,
          543
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "NominalFOV, exposure, spectral transfer, colour, threshold and registration approximate; no calibration claim."
      }
    }
  },
  "procyon-b": {
    "id": "procyon-b",
    "name": "Procyon B",
    "kind": "star",
    "aliases": [
      "Procyon B",
      "GJ 280 B",
      "Gliese 280 B",
      "alf CMi B"
    ],
    "researchDate": "2026-10-10",
    "identityNote": "Procyon A is HD61421/HIP37279/GJ280A F5IV-V subgiant; Procyon B is GJ280B/WD0736+053 helium-atmosphere DQZ white dwarf. Historical selection retained pending EZ Aquarii B/C/current binary astrometry reconciliation.",
    "nativeSurface": "Native near-UV binary image resolves point sources, not photospheric geography. Recent native imagery assessed; independent conceptual gas map needed.",
    "measured": [
      "Bond2015 Table10 dynamical masses A1.478±.012/B.592±.006Msun; Table9 weighted parallax285.0±.7mas. Distinct historical archive284.56±1.26mas retained, no exhaustive current ranking claim.",
      "Native HST/WFPC2 F218W1997-11-27 resolves central A and left B, separation4.706arcsec, near-UV contrast8.5mag. PDF page45 Figure1 caption and Table1 verify0.14second A inset/100second B frame. 0.11second is detector minimum and later visits, not an epoch conflict."
    ],
    "modelled": [
      "Bond2015 atmosphere/STIS fit7740±50K, radius.01232±.00032Rsun adjusted from Provencal2002 .01234±.00032. Helium photosphere with carbon and trace metals; theoretical C/O degenerate interior hidden. Cooling age1.37±.04Gyr.",
      "Liebert2013 age1.87±.13Gyr/cooling1.19±.11 uses older preliminary B mass.553±.015; Bond2015 revised masses/overshoot age~2.7Gyr remain distinct.",
      "Bond2015 orbit40.840±.022yr, eccentricity.39785±.00025; catalogue orbital fields preserved. No registered companion position claimed in conceptual scene.",
      "Preserved HYG actual route hyg-118493 labels B spectral DA and distance3.4974pc; primary Bond2015 establishes helium-atmosphere DQZ and shared weighted285mas. This catalogue conflict is disclosed, not silently overwritten or used to select hydrogen gas. A actualhyg-37173 distance3.5142pc; binary-aware reconciliation open."
    ],
    "unknown": [
      "Resolved photospheric geography, convection/magnetic patch positions, calibrated visible colour, bulk fractions and scene epoch registration.",
      "Current binary-aware astrometry and physical nearest20 boundary remain open, including EZ Aquarii B/C reconciliation."
    ],
    "assumed": [
      "Independent invented gaseous intensity cells and emissive appearance, no observed Sun/other-body map reused; no solid ground or survivable landing.",
      "Broad H/He gas context for A; helium-dominated DQZ gas with trace carbon/metals for B. Theoretical C/O degenerate interior hidden, not exposed terrain.",
      "Free camera2photosphericradii, nominal120degreeHFOV, arbitrary direction excluding companion; colour, exposure and spectral transfer remain approximate."
    ],
    "surfaceLabel": "QUIESCENT PHOTOSPHERIC INTENSITY HYPOTHESIS",
    "skyLabel": "NEAR-PHOTOSPHERE OBSERVER HYPOTHESIS",
    "references": [
      {
        "url": "https://arxiv.org/abs/1510.00485",
        "title": "Bond et al.2015, HST Procyon binary astrometry and component models",
        "publicationDate": "2015-10-02"
      },
      {
        "url": "https://arxiv.org/abs/astro-ph/0309148",
        "title": "Kervella et al.2003/2004, Procyon A interferometry and adopted spectroscopy",
        "publicationDate": "2003-09-04"
      },
      {
        "url": "https://arxiv.org/abs/1305.0587",
        "title": "Liebert et al.2013, distinct earlier Procyon age and preliminary mass assumptions",
        "publicationDate": "2013-05-03"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/procyon-hubble-native.png",
        "source": "https://arxiv.org/html/1510.00485v1/blueprocyon_cropcrop.png",
        "sourcePage": "https://arxiv.org/abs/1510.00485",
        "label": "NATIVE HST BINARY · NEAR-UV FALSE COLOUR",
        "credit": "Howard E. Bond; Ronald L. Gilliland; Gail H. Schaefer; Pierre Demarque; Terrence M. Girard; Jay B. Holberg; Donald Gudehus; Brian D. Mason; Vera Kozhurina-Platais; Matthew R. Burleigh; Martin A. Barstow; Edmund P. Nelan; NASA/ESA HST/WFPC2; STScI/MAST/AURA, NASA contract NAS5-26555.",
        "terms": "arXiv perpetual non-exclusive distribution licence is not asserted CC BY. Retain full credits and authorized research context.",
        "termsUrl": "https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html",
        "publicationDate": "2015-10-02",
        "observationDate": "1997-11-27",
        "tier": "measured",
        "sha256": "7875491b035348c37e719035ee5de658c4d3a6309ce3f396b175288ba51580d6",
        "bytes": 92927,
        "description": "Author-paper release2015-10-02; exact raster publication day unknown. Central A0.14s inset, B left100s exposure, near-UV F218W false colour/PSF/diffraction. Not calibrated visible colour or resolved photospheric geography."
      }
    ],
    "skyModel": {
      "star": "Procyon B",
      "radiusSun": 0.01232,
      "temperatureK": 7740,
      "distanceAU": 0.00011458751331010756,
      "horizontalFovDeg": 120,
      "angularDiameterDeg": 60.00000000000001,
      "centreDiscWidthFraction": 0.3333333333333335,
      "irradianceEarth": 37377.08077473294,
      "approximateSrgb": [
        0.8837512204317549,
        0.9106607244711423,
        1
      ],
      "limits": "Hypothetical camera2photosphericradii, no ground/survivable landing; nominal120degreeFOV, colour/exposure/spectral transfer/registration approximate. Bright cores 642/548/248px versus557.333px geometric target, uncalibrated."
    },
    "surfaceMap": {
      "key": "procyonBBespoke",
      "texLon0": -180,
      "projection": "2:1 independent imagined gaseous intensity; longitude frame invented.",
      "coverage": "Photospheric morphology imagined; no calibrated chemical/brightness map.",
      "url": "/bespoke/procyon-b-surface-map.jpg",
      "previewUrl": "/bespoke/procyon-b-surface-map-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-72fbe319-9f90-494d-8402-74eabab475d1.png",
      "sourceSha256": "bcca4018651598835129bcceb2667e2c14b60696c23b7c5f4719d443efdb63e6",
      "sha256": "ff75c5bc133fd01edbe562063cee996250d04480ec01dfd188278023574c5cf9",
      "previewSha256": "ec13810f367cc0e01181e94693d4a1b0445b48a8206b5d5066700eb7f7078266",
      "bytes": 325437,
      "previewBytes": 26224,
      "width": 2048,
      "height": 1024,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/procyon-b-sky-image.jpg",
      "previewUrl": "/bespoke/procyon-b-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-44bc9437-4e71-4c19-8f6b-afc36adcf36b.png",
      "sourceSha256": "53c76479180606e1538da1515129a696834f3a559bd154110202ac87e3fc2dd6",
      "sha256": "c6f9b924bddc89dc3635e4c5b08a6f28f7608d03617d476e7473e2f583862518",
      "previewSha256": "99a252d69025057276ca403781a6771ef759967c8da7f786841085d5c08c9073",
      "bytes": 87081,
      "previewBytes": 17510,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; photospheric morphology, magnetic regions and emissive appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "thresholds": [
          180,
          210,
          240
        ],
        "method": "Largest four-neighbour bright component at each threshold, excluding isolated gas-cell highlights and background; R>threshold/G>150/B>80.",
        "brightCoreWidths": [
          642,
          548,
          248
        ],
        "geometricTargetPixels": 557.3333333333336,
        "limits": "NominalFOV, exposure, spectral transfer, colour, threshold and registration approximate; no calibration claim."
      }
    }
  },
  "phobos": {
    "id": "phobos",
    "name": "Phobos",
    "aliases": [
      "Phobos"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own-body NASA3D Viking/MGS mosaic and existing Gaskell PDS shape preserved. HiRISE native2008 context is unchanged enhanced-colour resolved imagery. Exact map coverage/frame/photometric transfer and shape/albedo registration remain unverified.",
    "surfaceLabel": "HYPOTHETICAL LOCAL REGOLITH",
    "skyLabel": "HYPOTHETICAL SKY FROM PHOBOS",
    "measured": [
      "Phobos is a dark, cratered irregular moon with grooves and fragmental surface material. Native HiRISE observes resolved relief; enhanced bands are not calibrated naked-eye colour.",
      "Existing catalogue radius11.08km and orbital semimajor axis9375km are preserved, not revised by this illustration."
    ],
    "modelled": [
      "Representative Sun geometry at1.524AU uses skyGeometry; nominal90degree horizontal FOV. Sun is outside the sky illustration.",
      "Spherical Mars angular guide42.531degrees uses skyGeometry with radius3396.2km and assumed observer distance9375−11.08km. This is a geometry guide, not dated Mars/Phobos alignment."
    ],
    "assumed": [
      "Airless hypothetical locality with gray granular regolith and invented stones, grooves and slopes; no registered landing site or measured metre-scale geography.",
      "Mars-facing observer near the sub-Mars hemisphere; invented Mars phase/orientation and independently imagined broad surface pattern, not a native Mars map. Exposure, reflected light and colour are artistic.",
      "Approximate Mars row width709px versus650.726px geometric guide at1672x941; observer disc remains oversized and uncalibrated."
    ],
    "unknown": [
      "Material fractions, small-scale fragment placement, exact albedo, local horizon and camera registration are not measured.",
      "Groove formation remains uncertain; historical2008 impact-ejecta interpretation differs from later tidal/rolling-debris hypotheses. No dated alignment, photometric calibration or survivable landing claimed."
    ],
    "references": [
      {
        "title": "NASA Phobos facts",
        "url": "https://science.nasa.gov/mars/moons/phobos/"
      },
      {
        "title": "NASA HiRISE Phobos PIA10368",
        "url": "https://science.nasa.gov/photojournal/phobos-from-6800-kilometers-color/",
        "publicationDate": "2008-04-09",
        "observationDate": "2008-03-23"
      },
      {
        "title": "ESA Mars Express phase observations and groove uncertainty",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Mars_Express/Mars_Express_tracks_the_phases_of_Phobos",
        "publicationDate": "2019-12-12",
        "observationDate": "2019-11-17"
      },
      {
        "title": "NASA3D own-body texture source; original mosaic registration audit open",
        "url": "https://science.nasa.gov/3d-resources/mars-phobos/"
      },
      {
        "title": "Gaskell PDS Phobos shape archive",
        "url": "https://sbnarchive.psi.edu/pds4/non_mission/gaskell.phobos.shape-model/"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/phobos-hirise-native.jpg",
        "label": "NATIVE HiRISE RESOLVED CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/phobos-from-6800-kilometers-color/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia10/pia10368/PIA10368.jpg?crop=faces%2Cfocalpoint&fit=clip&h=3300&w=3374",
        "publicationDate": "2008-04-09",
        "observationDate": "2008-03-23",
        "credit": "NASA/JPL-Caltech/University of Arizona · MRO/HiRISE; instrument Ball Aerospace, spacecraft Lockheed Martin",
        "terms": "NASA image/media usage guidelines; full mission/instrument credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "d13bc76888c8683172cd4a6f4d722fd85c207130381e2e1dd82629b051e19549",
        "bytes": 652671,
        "description": "PSP_007769_9010 / PIA10368: resolved2008 Phobos image, near-infrared/red/blue-green enhanced channel composite, not calibrated naked-eye colour. Publisher JPEG rendition preserved unchanged; no equivalence to archival TIFF asserted.",
        "processing": "Copied unchanged from the recorded NASA publisher rendition URL; no local crop, resize or recolour."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 1.524,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.34967527602832627,
      "centreDiscWidthFraction": 0.0030515019112243072,
      "irradianceEarth": 0.43055641666838884,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/phobos-surface-image.jpg",
      "previewUrl": "/bespoke/phobos-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-eb733a77-527c-4fca-8742-26c0cac79674.png",
      "sourceSha256": "ade9fe90bca5569170debe444709eb17c123474ac60e9b8e6abaafbd91affbba",
      "sha256": "696cd8120ff3229af604a9792a05f5e788ccb5f5e2c7f708c3e5bf30eadc387a",
      "previewSha256": "97041ce176acf944b7b7f0205aafe44f2f511026811ea10a5268efa80c737e42",
      "bytes": 351309,
      "previewBytes": 64645,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/phobos-sky-image.jpg",
      "previewUrl": "/bespoke/phobos-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-072e5df4-2443-4aa3-9fb5-213bc3999545.png",
      "sourceSha256": "ef5e1e6f84216e7748182ca0c5359333cf7320a32c6ffa561fbc7fd673885d06",
      "sha256": "c888f2cf0a7973a674971635dbcde4d190daad0c7e9db21518cd3123a3559d38",
      "previewSha256": "c5e456d7c3b08000e2fa72b02b6069b1251ae5747eaeda165cb03d1e793f48cd",
      "bytes": 175826,
      "previewBytes": 31596,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "approximateMarsWidthPixels": 709,
        "geometricMarsTargetWidthPixels": 650.7256596161664,
        "method": "Source row350, RGB lower thresholds35/25/20, includes modelled atmospheric limb; spherical42.531degree guide via skyGeometry at nominal90degreeHFOV.",
        "limits": "Mars is oversized by this approximate row check. Raster size, exposure, visible colour, phase and viewpoint are not calibrated. Sun is outside frame."
      }
    }
  },
  "deimos": {
    "id": "deimos",
    "name": "Deimos",
    "aliases": [
      "Deimos"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own-body NASA3D mosaic preserved; unchanged native Hera AFC2025 monochrome projected context and HiRISE2009 enhanced-colour resolved context. Exact mosaic coverage/frame/photometric transfer and shape/albedo registration remain unaudited.",
    "surfaceLabel": "HYPOTHETICAL LOCAL REGOLITH",
    "skyLabel": "HYPOTHETICAL SKY FROM DEIMOS",
    "measured": [
      "Deimos is a small irregular, heavily cratered moon with a smoother appearance from partly filled craters; NASA describes dark dusty surface material, not measured metre-scale grain placement.",
      "Existing catalogue radius6.2km and orbital semimajor axis23457km preserved. Hera AFC acquired visible monochrome context2025-03-12, released2025-03-13."
    ],
    "modelled": [
      "Representative Sun at1.524AU uses skyGeometry, nominal90degree horizontal FOV; Sun outside frame.",
      "Spherical Mars guide16.653984degrees at assumed observer distance23457−6.2km uses skyGeometry with3396.2km radius. This is not dated orbital alignment.",
      "Wargnier et al.2025 HRSC/SRC photometry uses Hapke modelling of2004–2024 images. Reported darkness/porous dust interpretation is model dependent, not a calibrated transfer used in these illustrations; full parameter/shape audit remains open."
    ],
    "assumed": [
      "Hypothetical airless locality with dark gray fine regolith, shallow smooth slopes and sparse stones. Dust colour, grain sizes, fragments and slopes invented; no copied Moon/Mars/Phobos photograph or map.",
      "Mars-facing observer with invented Mars pattern, phase/orientation and lighting. Exposure, field of view and reflected illumination artistic; no registered landing site or survivable landing claimed."
    ],
    "unknown": [
      "Exact surface composition, dust depth and local grain sizes are unknown; carbonaceous spectral analogy is not a measured compositional recipe.",
      "Native globe longitude/frame, coverage gaps, radiometry and irregular shape registration require further audit. Hera monochrome exposure contrast and HiRISE enhanced channels do not establish calibrated naked-eye colour.",
      "No live Deimos-specific scientific image stream verified. Hera2025 context is newer than HiRISE2009; no exhaustive newest-observation claim."
    ],
    "references": [
      {
        "title": "NASA Deimos facts",
        "url": "https://science.nasa.gov/mars/moons/deimos/"
      },
      {
        "title": "ESA Hera AFC Deimos context",
        "url": "https://www.esa.int/ESA_Multimedia/Images/2025/03/Mars_and_Deimos_viewed_by_Hera_s_Asteroid_Framing_Camera",
        "observationDate": "2025-03-12",
        "publicationDate": "2025-03-13"
      },
      {
        "title": "NASA HiRISE Deimos PIA11826",
        "url": "https://science.nasa.gov/resource/martian-moon-deimos-in-high-resolution-2/",
        "observationDate": "2009-02-21",
        "publicationDate": "2009-03-09"
      },
      {
        "title": "Wargnier, Simon, Fornasier, El-Bez-Sebastien, Tirsch, Matz, Gautier, Doressoundiram and Barucci2025 HRSC/SRC photometry",
        "url": "https://arxiv.org/abs/2509.12804",
        "publicationDate": "2025-09-16"
      },
      {
        "title": "NASA3D own-body texture; coverage/frame audit open",
        "url": "https://science.nasa.gov/3d-resources/mars-deimos/"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/deimos-hera-afc-native.png",
        "label": "NATIVE HERA AFC MONOCHROME CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://www.esa.int/ESA_Multimedia/Images/2025/03/Mars_and_Deimos_viewed_by_Hera_s_Asteroid_Framing_Camera",
        "source": "https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2025/03/mars_and_deimos_viewed_by_hera_s_asteroid_framing_camera/26615627-1-eng-GB/Mars_and_Deimos_viewed_by_Hera_s_Asteroid_Framing_Camera.png",
        "publicationDate": "2025-03-13",
        "observationDate": "2025-03-12",
        "credit": "©ESA / Hera Asteroid Framing Camera",
        "terms": "ESA Standard Licence: educational, editorial and informational use with attribution; not asserted Creative Commons.",
        "termsUrl": "https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website",
        "sha256": "4962226afb3d7529b43648eaee0a63cc90bc96ce805a7646e91d98af97717849",
        "bytes": 442932,
        "description": "Dark Deimos against bright Mars, visible monochromatic AFC image. Publisher1020×1020 PNG from the caption's original-download href, unchanged. Less-seen hemisphere; spacecraft approximately1000km from Deimos. Not a surface map or calibrated visible reflectance.",
        "processing": "No local crop, resize, conversion or recolour. Caption's23500km from Mars surface wording is not adopted as catalogue semimajor axis."
      },
      {
        "url": "/bespoke/deimos-hirise-native.jpg",
        "label": "NATIVE HiRISE RESOLVED CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/resource/martian-moon-deimos-in-high-resolution-2/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/mars/downloadable_items/3/7/37713_Deimos-Mars-Moon-MRO-HiRISE-PIA11826.jpg?crop=faces%2Cfocalpoint&fit=clip&h=772&w=1505",
        "publicationDate": "2009-03-09",
        "observationDate": "2009-02-21",
        "credit": "NASA/JPL-Caltech/University of Arizona · MRO/HiRISE; instrument Ball Aerospace, spacecraft Lockheed Martin",
        "terms": "NASA image/media usage guidelines; full mission/instrument credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "7950457a7d227d84ed8e823cfcacb36080f88485b2cbd547504c0427d691ad71",
        "bytes": 49295,
        "description": "PIA11826 / ESP_012065_9000 and ESP_012068_9000, two observations5h35apart. Near-infrared/red/blue-green enhanced channels, not calibrated naked-eye colour. Publisher JPEG rendition unchanged, not equivalence to archival TIFF.",
        "processing": "Copied unchanged; original publisher scale bars and composite retained."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 1.524,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.34967527602832627,
      "centreDiscWidthFraction": 0.0030515019112243072,
      "irradianceEarth": 0.43055641666838884,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/deimos-surface-image.jpg",
      "previewUrl": "/bespoke/deimos-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-80712b7b-66c2-44c4-a238-b0a30ba63b59.png",
      "sourceSha256": "e669f81cc697839e5d9205a1026c62d6c247aa5cfb545004ba48213a1805a435",
      "sha256": "083649bb280e02a6d46f5ebdfab3617282b631267c9e99074155942b298f621c",
      "previewSha256": "6ee219bc2c56b5065468e98e8d5f930f3a3a086025263c597f5aec1f350a2db1",
      "bytes": 328462,
      "previewBytes": 54806,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/deimos-sky-image.jpg",
      "previewUrl": "/bespoke/deimos-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-062263e2-beb8-4fd3-ad88-b66e0d4c30fc.png",
      "sourceSha256": "0e4f303534524e079b16adff2fab26c00290e69e4e0ada1c6967d6c1ab28cbf9",
      "sha256": "cd869846ea037aa05894e4e78c205672b7ad7a9145f39306089b3fdc45717193",
      "previewSha256": "7a343543717ee6b887e7b346e07ea5fc6d804abe2f1d5dd79ec58e582b455606",
      "bytes": 166590,
      "previewBytes": 28721,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "row": 260,
        "approximateMarsWidthPixels": 230,
        "thresholdWidthsPixels": [
          275,
          272,
          271,
          240
        ],
        "thresholds": [
          2,
          5,
          10,
          20
        ],
        "targetWidthPixels": 244.72292074121026,
        "angularGuideDeg": 16.65398418909945,
        "method": "Single row RGB thresholds35/25/20 in black sky; includes artistic atmospheric limb.",
        "limits": "Low-threshold full limb widths275/272/271pixels exceed nominal244.723pixel guide; bright core230/240pixels is smaller. Threshold-sensitive and uncalibrated. FOV, phase, colour, illumination, limb and exposure remain artistic; no calibrated or dated geometry."
      }
    }
  },
  "io": {
    "id": "io",
    "name": "Io",
    "aliases": [
      "Io"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own-body NASA3D Galileo/Voyager mosaic preserved. Unchanged JIRAM2024 infrared publisher still and Galileo1999/JunoSRU2023 comparison provide measured context, not calibrated visible albedo. Mosaic frame, coverage, source association and photometric registration remain open.",
    "surfaceLabel": "HYPOTHETICAL LOCAL VOLCANIC TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM IO",
    "measured": [
      "Juno JIRAM observed strong southern-hemisphere infrared emission2024-12-27; saturation and missing field of view remain instrument limits, not surface colours or gaps.",
      "Juno SRU observed2023-12-30 night-side thermal glow near South Zal Mons under Jupiter-shine. Comparison Galileo panel is circa1999, exact day unverified.",
      "Catalogue radius1821.6km and semimajor axis421800km preserved. Sulfur dioxide dominates Io's tenuous atmosphere; its surface includes volcanic deposits and SO2 frost."
    ],
    "modelled": [
      "Mura et al.2026 first published2026-01-10 interpret synchronized activity as possible regional reservoir connections, not directly imaged plumbing. Deep magma ocean not ruled out; a shallow global molten layer is disfavoured by referenced tidal-response modelling.",
      "Representative Sun geometry at5.2044AU via skyGeometry, nominal90degree HFOV, Sun outside frame.",
      "Spherical Jupiter69911km radius at assumed observer distance421800−1821.6km gives19.164505degrees via skyGeometry; geometry guide only, no dated registration."
    ],
    "assumed": [
      "Invented local pale sulfur-associated deposits, charcoal cooled silicate lava, rocks, cracks and a small glowing fissure. Fractions, visible colours, lava temperature and eruption state unmeasured; no mapped named locality.",
      "Jupiter-facing hypothetical observer with independently invented cloud bands, phase, orientation, reflected light and exposure; no observed Jupiter map reused. Tenuous atmosphere represented by black sky without Earthlike haze."
    ],
    "unknown": [
      "Local chemistry, rock/grain placement, lava crust age, radiometry, scene registration and actual spectral transfer remain unverified.",
      "Reservoir topology and global melt geometry remain hypotheses; local connections do not establish a globally molten ocean. No survivable landing claim.",
      "No verified live Io-specific scientific stream; recent mission images assessed without an exhaustive newest-observation claim."
    ],
    "references": [
      {
        "title": "NASA Io facts",
        "url": "https://science.nasa.gov/jupiter/jupiter-moons/io/facts/"
      },
      {
        "title": "JPL JIRAM PIA26594",
        "url": "https://www.jpl.nasa.gov/images/pia26594-junos-jiram-captures-hots-spots-on-io/",
        "observationDate": "2024-12-27",
        "publicationDate": "2025-04-29"
      },
      {
        "title": "JPL Galileo/SRU PIA26522",
        "url": "https://www.jpl.nasa.gov/images/pia26522-nasas-juno-sees-glowing-lava-on-io/",
        "observationDate": "2023-12-30",
        "publicationDate": "2024-12-12"
      },
      {
        "title": "Mura et al.2026 Synchronized Eruptions: Possible Evidence of Interconnected Subsurface Magma Reservoirs",
        "url": "https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025JE009047",
        "publicationDate": "2026-01-10"
      },
      {
        "title": "Mura et al.2026 lava-lake crust-age modelling",
        "url": "https://arxiv.org/abs/2603.22062",
        "publicationDate": "2026-03-23"
      },
      {
        "title": "USGS Galileo/Voyager merged mosaic description; exactNASA3D association open",
        "url": "https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/io-jiram-native.jpg",
        "label": "NATIVE JIRAM INFRARED CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://www.jpl.nasa.gov/images/pia26594-junos-jiram-captures-hots-spots-on-io/",
        "source": "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA26594.jpg",
        "observationDate": "2024-12-27",
        "publicationDate": "2025-04-29",
        "credit": "NASA/JPL/SwRI/ASI — JIRAM Team (A.M.)",
        "terms": "NASA image/media guidelines; full JPL instrument/team credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "16123079d1ad21cb0b3c566210755f613a0b16e465926cedcd0d538b00863f3d",
        "bytes": 43806,
        "description": "PIA26594 publisher static JPG. Infrared false-colour intensity, not visible surface colour. Bright emission saturates detector; gray region is outside field of view. JPEG is the linked still, not the full animation.",
        "processing": "Copied unchanged from publisher download; no crop, resize, recolour or removal of instrument artifacts."
      },
      {
        "url": "/bespoke/io-sru-native.jpg",
        "label": "NATIVE GALILEO/SRU COMPARISON",
        "tier": "measured",
        "sourceUrl": "https://www.jpl.nasa.gov/images/pia26522-nasas-juno-sees-glowing-lava-on-io/",
        "source": "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA26522.jpg",
        "observationDate": "2023-12-30",
        "publicationDate": "2024-12-12",
        "credit": "NASA/Caltech-JPL/SwRI/LPI/USRA",
        "terms": "NASA image/media guidelines; full instrument/team credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "52b5dbe3595aecd0d7bfe68bb2f855b1faea2746454a61613ab735e569095a72",
        "bytes": 186747,
        "description": "PIA26522: sunlit Galileo circa1999 panel versus Jupiter-shine JunoSRU2023-12-30. Red arrows/20km scale are publisher annotations, not lava colour. A mountain-fracture fissure connection is a hypothesis; not measured internal plumbing.",
        "processing": "Original comparison copied unchanged, no conversion/recolour. Exact Galileo observing day unknown."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 5.2044,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.10239496667257103,
      "centreDiscWidthFraction": 0.0008935648907777419,
      "irradianceEarth": 0.03691974252277894,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/io-surface-image.jpg",
      "previewUrl": "/bespoke/io-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-fc8747f5-e356-46b0-b3bd-ab8ceb5b163f.png",
      "sourceSha256": "356985ea84e1c706b410c6d881f1656de38015e76a517266f98a9198c74c3dc7",
      "sha256": "b1ff371b5c868f3e387aa9bce071cb037126ab9388b2d32c5fa20722bb5e3a77",
      "previewSha256": "275829f095c0c59b8db41fcc626e7d8ddabb57fc2f1b1d0bc7e8bbca86343cce",
      "bytes": 375609,
      "previewBytes": 65870,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/io-sky-image.jpg",
      "previewUrl": "/bespoke/io-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-36ff3334-e6fd-4300-80fd-1f0c4f2f7e89.png",
      "sourceSha256": "34742519a7ec505d2c2316c420d4971ef315e209e245408fae577a72410848a3",
      "sha256": "dd9e094cda0d0be8a748249051db6de07ab6cfbceea9e436e149a777e11ed38e",
      "previewSha256": "37f713119ff3f46c89e34233f558a7e55c6485274a93b6b134eda2e835d8a61d",
      "bytes": 212550,
      "previewBytes": 38835,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated.",
      "rasterValidation": {
        "sourceWidth": 1672,
        "sourceHeight": 941,
        "row": 270,
        "thresholds": [
          5,
          10,
          20
        ],
        "longestBrightRunWidthsPixels": [
          327,
          318,
          278
        ],
        "targetWidthPixels": 282.26493587538596,
        "angularGuideDeg": 19.16450484941697,
        "method": "Longest contiguous central-row RGB-above-threshold run excludes disconnected stars; atmospheric limb and dark terminator remain artistic.",
        "limits": "Oversized relative to nominal skyGeometry guide; threshold-dependent, not calibrated colour/FOV/phase/lighting/exposure or dated registration."
      }
    }
  },
  "europa": {
    "id": "europa",
    "name": "Europa",
    "aliases": [
      "Europa"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own-body NASA3D Galileo/Voyager globe preserved; source association/coverage/frame/epochs/photometry audit open. Local SRU photograph is not full globe or calibrated visible colour.",
    "surfaceLabel": "HYPOTHETICAL LOCAL ICE TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM EUROPA",
    "measured": [
      "Juno SRU observed2022-09-29 under Jupiter-shine; white dots are radiation-particle artifacts, not terrain. Monochrome450–1100nm, not calibrated visible colour.",
      "Catalogue radius1560.8km/semimajor axis671100km preserved. Ridges and chaos are observed; possible plume stains do not confirm activity."
    ],
    "modelled": [
      "Levin et al. published2025-12-17 infer29±10km thermally conductive shell for idealized pure-water ice from2022 MWR data; salinity15mg/kg reduces~5km and possible convective layer adds total thickness. Not universal directly measured thickness.",
      "skyGeometry Jupiter69911km at671100−1560.8km gives11.98711degrees/90HFOV175.544px at1672wide;165K placeholder only for angular geometry, no photometric transfer.",
      "Representative Sun5.2044AU off frame via skyGeometry."
    ],
    "assumed": [
      "Invented ice ridges, fractures, sparse blocks and brown non-ice deposits; local chemistry/fractions/colour unmeasured.",
      "Independent invented Jupiter bands/phase/orientation/light; no observed Jupiter/Moon/Mars/Io map reused. Thin exosphere has black sky."
    ],
    "unknown": [
      "Native map coverage/frame/epochs and observer registration open; local chemistry/biology unmeasured, no active plume or exposed ocean implied.",
      "No survivable landing claim, no verified live scientific image stream or exhaustive newest-observation claim."
    ],
    "references": [
      {
        "title": "NASA SRU source",
        "url": "https://science.nasa.gov/photojournal/europa-seen-up-close-by-junos-sru/"
      },
      {
        "title": "Levin et al. primary ice-shell model",
        "url": "https://www.nature.com/articles/s41550-025-02718-0"
      },
      {
        "title": "NASA2026-01-27 release,2022 observations",
        "url": "https://www.nasa.gov/missions/juno/nasas-juno-measures-thickness-of-europas-ice-shell/"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/europa-sru-native.jpg",
        "label": "NATIVE SRU MONOCHROME CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/europa-seen-up-close-by-junos-sru/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia26/pia26332/PIA26332.jpg?w=1020&fit=clip",
        "observationDate": "2022-09-29",
        "publicationDate": "2024-05-15",
        "credit": "NASA/JPL-Caltech/SwRI",
        "terms": "NASA image/media guidelines; full mission credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "a7d05402986eaceda50c71ee4cdff1d1d2fef11cd19eadac5690d6db45913a3f",
        "bytes": 195650,
        "description": "NASA-served1020px display rendition, not full4059px raster. Monochrome Jupiter-shine photograph; white dots are radiation-particle artifacts, plume stains unconfirmed. Not calibrated visible colour. Full-resolution PNG/JPEG originals retained separately.",
        "processing": "Copied unchanged from NASA dynamicimage response; publisher resizing/re-encoding disclosed. No local crop/recolour/artifact removal."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 5.2044,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.10239496667257103,
      "centreDiscWidthFraction": 0.0008935648907777419,
      "irradianceEarth": 0.03691974252277894,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/europa-surface-image.jpg",
      "previewUrl": "/bespoke/europa-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-dd6ea2f6-3608-4f1a-8bde-0d6b13c61401.png",
      "sourceSha256": "6c51a34930593b2e68a00bfd8c9bccdc16489ed11d3bb51b9ef82484a0946d35",
      "sha256": "df651248619f3c1169b4a797dc2ac658a52eb1dca8825c00a215f793c135846c",
      "previewSha256": "701dc3f3f2690e16cb7e7e3647954e8ed9ce76ec0565d18e2ddbfd44fbdebe25",
      "bytes": 292119,
      "previewBytes": 50940,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/europa-sky-image.jpg",
      "previewUrl": "/bespoke/europa-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-4cac412c-8e52-4968-b9d6-9bb71cbe6993.png",
      "sourceSha256": "8b65925ed54f38ba5d88014b074a51cbeb70d8bfdba9361d188f0d8bba37176b",
      "sha256": "cb755d2afb46190473d16af51ec3ea56164fc75b47103b033817524ae096100a",
      "previewSha256": "2d7c0f59728dd237b0d5024bc28fe8b4d70fabf714164873a9fbb819bdb38ad8",
      "bytes": 195356,
      "previewBytes": 35428,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "ganymede": {
    "id": "ganymede",
    "name": "Ganymede",
    "aliases": [
      "Ganymede"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own NASA3D Galileo/Voyager globe unchanged and source-byte equal; exact coverage/frame/epochs/photometry audit open. JIRAM optical-overlay context is not a new full globe.",
    "surfaceLabel": "HYPOTHETICAL LOCAL GROOVED ICE",
    "skyLabel": "HYPOTHETICAL SKY FROM GANYMEDE",
    "measured": [
      "JIRAM spectra observed2021-06-07; processed2.08micron band-depth line over older Galileo/Voyager optical mosaic, not visible colour.",
      "Catalogue radius2634.1km/semimajor axis1070400km preserved; grooved and cratered terrain observed."
    ],
    "modelled": [
      "Tosi et al. published2023-10-30 (January2024 issue) assign infrared bands through laboratory comparisons to salts and possible organic compounds; brine-origin interpretation is not directly observed plumbing or biology. No measured local ingredient fractions.",
      "skyGeometry sphericalJupiter69911km at1070400−2634.1km gives7.5081489degrees at90HFOV;165K helper placeholder only for angular geometry, not photometric transfer.",
      "Representative Sun5.2044AU outside field via skyGeometry."
    ],
    "assumed": [
      "Independent invented worn grooved ice bedrock, blocks, dust and dark impurity patches; morphology/chemistry/fractions/colour/exposure are imagined.",
      "Independent invented Jupiter bands/phase/orientation/light; no observed Moon/Mars/Pluto/Europa/Io/Jupiter skins or analog maps. Tenuous exosphere represented by black sky."
    ],
    "unknown": [
      "Local terrain registration, material fractions/chemistry, albedo/visible colour/exposure and dated observer geometry remain unknown.",
      "Native map exact product association/coverage/frame/epochs and full photometric transfer remain open; no exposed ocean, active plume, biology or survivable landing implied."
    ],
    "references": [
      {
        "title": "NASA JIRAM native caption",
        "url": "https://science.nasa.gov/photojournal/ganymede-grooved-terrain-as-seen-by-junos-jiram/"
      },
      {
        "title": "Tosi et al. primary spectral analysis",
        "url": "https://orbi.uliege.be/bitstream/2268/338794/1/s41550-023-02107-5.pdf"
      },
      {
        "title": "Publisher enhanced JunoCam artwork assessment",
        "url": "https://www.jpl.nasa.gov/images/pia25028-enhanced-ganymede-enhanced-image/"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/ganymede-jiram-native.jpg",
        "label": "NATIVE JIRAM SPECTRAL CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/ganymede-grooved-terrain-as-seen-by-junos-jiram/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia26/pia26075/PIA26075.jpg?w=1020&fit=clip",
        "observationDate": "2021-06-07",
        "publicationDate": "2023-10-30",
        "credit": "NASA/JPL-Caltech/SwRI/ASI/INAF/JIRAM/Brown University",
        "terms": "NASA image/media guidelines; full instrument/mission credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "9f18bdf6cfca3f53210d7802d8125059385d3e67a323dc41f040c61ca38a3e1d",
        "bytes": 61533,
        "description": "NASA-served1020px display rendition; resized/re-encoded publisher response, not full6385px raster. Processed2.08micron band-depth colored line over older Galileo/Voyager optical mosaic. Possibly ammonium chloride, not unique chemistry, visible colour or biology. Older optical observing epochs unknown. Original full JPEG retained separately.",
        "processing": "Copied unchanged from NASA dynamicimage response; no local crop/recolour/annotation removal. Publisher display resizing/re-encoding disclosed."
      }
    ],
    "skyModel": {
      "radiusSun": 0.10049015380192612,
      "temperatureK": 165,
      "distanceAU": 0.007137574184737376,
      "horizontalFovDeg": 90,
      "interpretation": "Jupiter angular size only.165K positive helper input does not define visible colour/emission/irradiance; those computed helper outputs are not adopted photometry.",
      "angularDiameterDeg": 7.508148903427891,
      "centreDiscWidthFraction": 0.06561488124170436,
      "irradianceEarth": 0.00013236593713086503,
      "approximateSrgb": [
        1,
        0.2663545845364998,
        0
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/ganymede-surface-image.jpg",
      "previewUrl": "/bespoke/ganymede-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-05ffeb69-1a5a-4f84-a1bc-087383cef061.png",
      "sourceSha256": "9dd0818c5e193e202b06d265ea9a92778f03bcbd6b8aa5c1b83345c4149f883d",
      "sha256": "e1f39469f67c5bbfbefeef788d0a881a0a5df22562d2327d1009ba7d48896070",
      "previewSha256": "4d44d38c5708db33fd18a4071a5d6aa7d06562e4b24086cad38531c467e2ef06",
      "bytes": 359335,
      "previewBytes": 63495,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/ganymede-sky-image.jpg",
      "previewUrl": "/bespoke/ganymede-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-668b48c6-3052-46da-b57f-97c2076b115c.png",
      "sourceSha256": "7d1acefb825d834d0a392a87dba8350d9c7664a95eeaf58cad8a8153ba7303cd",
      "sha256": "de9022e5ce8088027176df90ebb04ca24f583cde7489c0d13d3ba6b5a332949b",
      "previewSha256": "bcfca5eab4cbaa431c5ebacea2731ff15c04d9e520e44fea20fc1f9c228349aa",
      "bytes": 246285,
      "previewBytes": 44602,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "callisto": {
    "id": "callisto",
    "name": "Callisto",
    "aliases": [
      "Callisto"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own NASA3D Callisto globe preserved byte-equal to source; product association, coverage, frame, input epochs and photometry remain open.",
    "surfaceLabel": "HYPOTHETICAL LOCAL KNOBBY TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM CALLISTO",
    "measured": [
      "Galileo SSI close-up observed2001-05-25, released2001-08-22; monochrome panel presentation not calibrated visible colour.",
      "Existing catalogue radius2410.3km and semimajor axis1882700km preserved. Native source byte equality verified."
    ],
    "modelled": [
      "Caption estimates bright knobs80–100m high and smallest discernible features about3m; these are source statements, not new raster measurements.",
      "Sublimation, dust migration and impact-ejecta origins are interpretations/hypotheses, not measured local chemistry or erosion rates.",
      "skyGeometry spherical Jupiter69911km at1882700−2410.3km:4.2616079degrees for90HFOV.165K positive angular-helper input only; computed colour/irradiance not adopted photometry.",
      "Representative Sun5.2044AU outside frame; illumination/phase/registration artistic."
    ],
    "assumed": [
      "Independent invented ice-rich rocky worn hummocks, fragments, dust and local terrain; exact morphology, chemistry/fractions, colour and exposure imagined.",
      "Independent invented schematic Jupiter atmospheric bands/phase/orientation/light; no observed-body analog skins or reused geography. Tenuous exosphere represented by black sky."
    ],
    "unknown": [
      "Local terrain geographic registration, material fractions/chemistry, visible albedo, photometric transfer and dated observer geometry unknown.",
      "Native map product association/coverage/frame/input epochs remain open; no active plume, exposed ocean, biology or survivable landing implied."
    ],
    "references": [
      {
        "title": "NASA native SSI caption",
        "url": "https://science.nasa.gov/photojournal/callisto-close-up-with-jagged-hills/"
      },
      {
        "title": "Contemporary JPL Universe observation/credit audit, PDF page9",
        "url": "https://www.jpl.nasa.gov/universe/archive/un0108.pdf"
      },
      {
        "title": "ESA Juice factsheet: future observations",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Juice/Juice_factsheet"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/callisto-ssi-native.jpg",
        "label": "NATIVE GALILEO SSI TERRAIN CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/callisto-close-up-with-jagged-hills/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia03/pia03455/PIA03455.jpg?w=1020&fit=clip",
        "observationDate": "2001-05-25",
        "publicationDate": "2001-08-22",
        "credit": "NASA/JPL/Arizona State University, Academic Research Lab",
        "terms": "NASA image/media guidelines; full mission/institution credits retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "37ea73e715c8ebd7d35cefb8f030cc72a5d3c533e51856f60bea67fe0685dea6",
        "bytes": 134419,
        "description": "Unchanged NASA-served1020x770 display rendition; publisher resize/re-encoding, not original full-pixel preservation. Monochrome intensity stored RGB, not calibrated visible colour. Strip gaps/seams, panel outlines, scale and globe locator are processing/presentation context, not seamless terrain. Original2000x1510JPEG retained. Sublimation/dust/impact origins hypothetical. Historical JPL newsletter verifies Academic Research Lab credit; current external credit-link ownership unverified, not adopted as a terms link.",
        "processing": "Copied unchanged from NASA served response; no local crop/recolour/annotation removal."
      }
    ],
    "skyModel": {
      "radiusSun": 0.10049015380192612,
      "temperatureK": 165,
      "distanceAU": 0.012568960314754,
      "horizontalFovDeg": 90,
      "interpretation": "Jupiter angular size only;165K is positive helper input not visible photometry. Colour/irradiance outputs not adopted.",
      "angularDiameterDeg": 4.26160790446575,
      "centreDiscWidthFraction": 0.03720669932298657,
      "irradianceEarth": 0.00004268534530573517,
      "approximateSrgb": [
        1,
        0.2663545845364998,
        0
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/callisto-surface-image.jpg",
      "previewUrl": "/bespoke/callisto-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-dbae7908-5ec8-4b41-bfaa-1177bba5bfb3.png",
      "sourceSha256": "1c15ddedae317c955a273066bf9a7c0a8abc83da35eabbe53aee5ef580ef5da5",
      "sha256": "a29acd57b4cab74abf5d997a81155a35b94348b22253e0dfb81425de0efce907",
      "previewSha256": "ce8151768c67b8fd9974a3e0fa9dd991fe23403eb2b26923138ce47ea86501f7",
      "bytes": 366095,
      "previewBytes": 65544,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/callisto-sky-image.jpg",
      "previewUrl": "/bespoke/callisto-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-312cbc7d-4502-4597-a385-51392c24dd45.png",
      "sourceSha256": "0b372d3a50779956f1d63bca604b4a9ff2c0cd28f86fa36caabecabcbbf37b70",
      "sha256": "60835dc33c3a05c55d9b4acc218394ed74c0fcbd5f89fdd3b8c942282609fbb0",
      "previewSha256": "adb4ff542a86009ea5f06c96ebc82768edd5a3af809bdf31be559ced4ccac585",
      "bytes": 217891,
      "previewBytes": 39778,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "amalthea": {
    "id": "amalthea",
    "name": "Amalthea",
    "aliases": [
      "Amalthea"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "No verified resolved globe texture adopted. Catalogue surfacePending retained; historical Voyager-only PDS shape unchanged. Native Juno detection and Galileo stereo supplied as context.",
    "surfaceLabel": "HYPOTHETICAL LOCAL AMALTHEA TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM AMALTHEA",
    "measured": [
      "JunoCam PIA25728 observed2024-03-07 released2024-05-13: processed tiny moon against Jupiter, not resolved surface geography.",
      "Galileo SSI PIA02532 observed1999-08-12/1999-11-26 released2000-04-24: monochrome stereo pair.",
      "Catalogue nominal radius83.5km, mass2.08e18kg and semimajor axis181400km retained. Anderson2005 reports Doppler mass(2.08±0.15)e18kg from2002-11-05 encounter."
    ],
    "modelled": [
      "Anderson2005 image-derived volume(2.43±0.22)e6km3 and density857±99kg/m3; porous ice/rock and cold formation are interpretations, not measured local fractions.",
      "PDS Stooke model explicitly Voyager1/2 only, corrected smeared-limb bulge, no Galileo incorporation; decimal places do not indicate uncertainty.",
      "skyGeometry Jupiter69911km at181400minus83.5km gives45.358808degrees at90HFOV;165K angular-only helper, computed colour/irradiance not adopted. Representative Sun5.2044AU off frame."
    ],
    "assumed": [
      "Independent invented dark reddish-brown regolith, rocks, ridges, pores and local morphology, fractions/chemistry/albedo/light/exposure.",
      "Independent schematic Jupiter bands/phase/orientation; no observed-body map reuse."
    ],
    "unknown": [
      "Resolved global texture, local chemistry/fractions, optical calibration and local geographic registration remain unknown.",
      "Modern shape alternatives, model uncertainty, observer registration and dated scene geometry remain open. No active plume, exposed ocean, biology or survivable landing implied."
    ],
    "references": [
      {
        "title": "NASA JunoCam caption",
        "url": "https://science.nasa.gov/photojournal/nasas-juno-mission-spots-jupiters-tiny-moon-amalthea/"
      },
      {
        "title": "NASA Galileo stereo caption",
        "url": "https://science.nasa.gov/photojournal/bright-streak-on-amalthea/"
      },
      {
        "title": "PDS individual model label",
        "url": "https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/j5amalthea.xml"
      },
      {
        "title": "Anderson et al.2005 primary author abstract",
        "url": "https://pubmed.ncbi.nlm.nih.gov/15919987/"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/amalthea-juno-native.jpg",
        "label": "NATIVE JUNOCAM AMALTHEA DETECTION",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/nasas-juno-mission-spots-jupiters-tiny-moon-amalthea/",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia25/pia25728/PIA25728.jpg?w=1020&fit=clip",
        "observationDate": "2024-03-07",
        "publicationDate": "2024-05-13",
        "credit": "Image data: NASA/JPL-Caltech/SwRI/MSSS; image processing by Gerald Eichstädt",
        "terms": "NASA media guidelines; full data and processing credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "b2a5e482d427a58d9d12aa240b04f1399dbfa8fa21a3989c9a62f10ac58a5517",
        "bytes": 118764,
        "description": "Unchanged NASA-served1020display JPEG; publisher resizing/reencoding not full-pixel preservation. Tiny moon detections against processed Jupiter cloud views do not establish resolved Amalthea geography or calibrated visible colour. Original3600JPEG and distinct dynamic3600JPEG retained separately.",
        "processing": "Copied unchanged; no local crop, recolour or annotation removal."
      },
      {
        "url": "/bespoke/amalthea-galileo-native.jpg",
        "label": "NATIVE GALILEO SSI STEREO CONTEXT",
        "tier": "measured",
        "sourceUrl": "https://science.nasa.gov/photojournal/bright-streak-on-amalthea/",
        "source": "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia02/pia02532/PIA02532.jpg",
        "observationDate": "1999-08-12 / 1999-11-26",
        "publicationDate": "2000-04-24",
        "credit": "NASA/JPL/Cornell University",
        "terms": "NASA media guidelines; full mission and institution credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "sha256": "6fd64988baebfe61906ca8bb0ca58fabb9aec75facd9e3110d71dc7d68fe8060",
        "bytes": 14865,
        "description": "Unchanged860x410publisherJPEG stereo pair. Monochrome presentation, differing viewpoints, right north pole truncated by frame; not a seamless map or calibrated visible colour. Ida ejecta/ridge crest alternatives not unique chemistry.",
        "processing": "Copied unchanged; source pairs and frame truncation retained."
      }
    ],
    "skyModel": {
      "radiusSun": 0.10049015380192612,
      "temperatureK": 165,
      "distanceAU": 0.0012120259409547868,
      "horizontalFovDeg": 90,
      "interpretation": "Jupiter angular-only helper;165K not calibrated visible photometry.",
      "angularDiameterDeg": 45.358808209600525,
      "centreDiscWidthFraction": 0.41788675843766276,
      "irradianceEarth": 0.004590433272400362,
      "approximateSrgb": [
        1,
        0.2663545845364998,
        0
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/amalthea-surface-image.jpg",
      "previewUrl": "/bespoke/amalthea-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-fd6d007a-777d-402c-b993-83cda1a1139a.png",
      "sourceSha256": "2e96201c2464678ed334be58f2aec2a5b7294d05b87ebc9d4cc4366afecaf055",
      "sha256": "95211a4bb5fbb0cc7b8243ac038cf2ff75eb92599968750a19a477ceeb438f00",
      "previewSha256": "07f203768a4fc1c653b2cfc645249df583913bbd464555c5d46e3e9f4c8b96b6",
      "bytes": 334609,
      "previewBytes": 56108,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/amalthea-sky-image.jpg",
      "previewUrl": "/bespoke/amalthea-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "exec-83decfd9-2495-4dd2-af9f-8d6fd17f74e8.png",
      "sourceSha256": "d6f53e912e69390dbb309d5d9bf92efc65e1ba80b0d8baa1cc9d67d0b8e4fb07",
      "sha256": "48c3befffb97ffef0ab554a1cd55890b165298df52007674023132cb900bce97",
      "previewSha256": "81d16f2b322e14cc13cb7776aa7e1cdf249b71c163b5dc4a53da11856abbac8a",
      "bytes": 187883,
      "previewBytes": 33558,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "mimas": {
    "id": "mimas",
    "name": "Mimas",
    "aliases": [
      "Mimas"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "nativeSurface": "Own NASA3D Mimas globe unchanged, SHA0836f8f98719dc1cb1ccc58b23d5f3e50cc3ba01d1a7f0535b4f7d11695a378b; coverage/inputepochs/frame/photometry audit open. No generated globe.",
    "measured": [
      "Cassini ISS cratered surface mosaic observed2017-01-30; published2017-03-14.",
      "Catalogue representative radius198.2km and semimajor axis186000km; no dated local scene registration. NASA overview rounds mean diameter394km/distance186000km; preserve parameter precision alternatives."
    ],
    "modelled": [
      "Lainey2024 orbital/periapsis analysis infers an ocean below20–30km shell, age<25Myr and recent2–3Myr interface evolution; dynamical/thermal inference, not direct ocean imaging.",
      "Denton/Rhoden2025 Herschel impact models permit ocean-bearing or warm fully frozen shells near melting; morphology alone does not uniquely establish ocean at impact time."
    ],
    "unknown": [
      "Local material fractions/chemistry, subsurface plumbing, registered observer site, calibrated colour/exposure and all globe input epochs/frame details.",
      "Lainey fullpaper and Denton supplement detailedparameter audit remain open."
    ],
    "assumed": [
      "Invented grey ice-rich local regolith/craters/blocks; no analog map reuse, exposed ocean, active plume, biology or survivable landing.",
      "Independent schematic Saturn cream bands, approximate oblateness and nearly edge-on rings. Ringextent/phase/orientation/lighting/exposure artistic; no observed Saturn map reused.",
      "Nominal90degree horizontal FOV; Saturn58232km representative mean spherical radius at186000minus198.2km near-side surface distance.95K helper angular-only, blackbody RGB/irradiance not photometry. Sun9.58AU representative off-frame, not dated scene."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/photojournal/farewell-to-mimas/",
        "title": "Cassini Farewell to Mimas / Figure1",
        "observationDate": "2017-01-30",
        "publicationDate": "2017-03-14"
      },
      {
        "url": "https://science.nasa.gov/saturn/moons/mimas/",
        "title": "NASA Mimas overview; older frozen-solid prose differs from later interior models"
      },
      {
        "url": "https://www.nature.com/articles/s41586-023-06975-9",
        "title": "Lainey2024 orbital ocean inference",
        "publicationDate": "2024-02-07"
      },
      {
        "url": "https://static1.squarespace.com/static/5669bdc61c1210f372a5014b/t/6954367e3a4062070665bd26/1767126654169/dentonrhoden2025.pdf",
        "title": "Denton/Rhoden2025 impact alternatives; allrightsreserved researchinput only",
        "publicationDate": "2025-09-09"
      }
    ],
    "contextImages": [
      {
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia17/pia17213/figures/PIA17213_fig1.jpg?w=640&fit=clip",
        "bytes": 33774,
        "width": 640,
        "height": 640,
        "sha256": "1f61d1a5a5c3f777916a05368805278e1382e9c6dde6993d3d2ebd07676a2d68",
        "observationDate": "2017-01-30",
        "publicationDate": "2017-03-14",
        "credit": "NASA/JPL-Caltech/Space Science Institute",
        "terms": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "url": "/bespoke/mimas-cassini-native.jpg",
        "tier": "measured",
        "sourcePage": "https://science.nasa.gov/photojournal/farewell-to-mimas/",
        "description": "Cassini ISS ten-frame orthographic mosaic, publisher Figure1 more-natural illumination. RGB-storage monochrome, not calibrated visible colour/photometry;640 display resizing/reencoding does not preserve original pixels. Larger1700/1280/1020 originals retained.",
        "processing": "Unchanged publisher640 JPEG rendition; no local reencoding.",
        "sourceUrl": "https://science.nasa.gov/photojournal/farewell-to-mimas/",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/"
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 9.58,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.05562675517362789,
      "centreDiscWidthFraction": 0.00048543505312076185,
      "irradianceEarth": 0.010896047349863365,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceImage": {
      "url": "/bespoke/mimas-surface-image.jpg",
      "previewUrl": "/bespoke/mimas-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "mimas-generated-surfaceImage-original.png",
      "sourceSha256": "699fa925e0d72d8507f4955f0c91d6cd9825f0e04e6b4296ef5fbbd916e14730",
      "sha256": "e3073f35a14ebe7bc9bbc9d26966ee87e79d77b7aae6bf03d280d9b5d6fde4f8",
      "previewSha256": "ac5b6614e8afb64e3560c188f5df10d19b25a22d82e8bfb482d6f9a006f058cf",
      "bytes": 352614,
      "previewBytes": 65686,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/mimas-sky-image.jpg",
      "previewUrl": "/bespoke/mimas-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "mimas-generated-skyImage-original.png",
      "sourceSha256": "9fd6ed37e088d1814bebdd88d113736ad415ffdd87ffbfd710e1ec9d3ad244c0",
      "sha256": "bac070f531f3ddc279f7e5eeb5bed34400a9c54a78331be91b68dbd62c96a07c",
      "previewSha256": "d1c457388ffdb6825fded8243f4afd2ecc4b0c4316f60e64cfb99866798abc93",
      "bytes": 200693,
      "previewBytes": 36318,
      "width": 1536,
      "height": 864,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "surfaceLabel": "HYPOTHETICAL LOCAL MIMAS TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM MIMAS"
  },
  "enceladus": {
    "id": "enceladus",
    "name": "Enceladus",
    "aliases": [
      "Enceladus"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "previewWidth": 256,
    "nativeSurface": "Own NASA3D globe unchanged SHA4e16d38b98b788468e4f005b56d04282ccfe2f086eebfb1c0e5d20d8fd65ebef; coverage/frame/inputepochs/photometry open. White/blurred gaps are not measured smooth terrain. No generated globe.",
    "measured": [
      "Catalogue radius252.1km and semimajor axis238400km are representative, not dated scene registration.",
      "Webb NIRSpec IFU program1250 water-emission product observed2022-11-09 released2023-05-30; separate Cassini inset epoch unverified. ESA NIRCam caption conflict retained; NASA detailed record and primary paper identify NIRSpec."
    ],
    "modelled": [
      "Khawaja2025 E5 Cassini ice-grain impact spectra acquired2008-283T19:06:40UTC at17.7km/s constrain organic classes through laboratory comparisons; tentative N/O assignments, quantitative fractions unavailable. No biology or directly observed plumbing follows.",
      "Villanueva2023 column/outgassing values are model-derived;25±3K rotational excitation is not ambient kinetic gas temperature. Primary plume extent wording40 Enceladus radii; retain publisher radius/size wording differences and non-detection limits."
    ],
    "unknown": [
      "Local composition/fractions, registered observer site, calibrated photometry, globe frame/coverage/epochs, and inset observation epoch."
    ],
    "assumed": [
      "Independent invented ice fractures/blocks/craters and Saturn bands/nearly edge-on rings/phase/light/exposure; no analog map reuse, atmosphere, plume, exposed ocean, biology or survivable landing.",
      "Saturn spherical58232km at238400minus252.1km, nominal90HFOV: skyGeometry28.30697547degrees/421.637115px target at1672px. Row200 upper-globe chords318/313/313 are not full calibrated diameter; rings excluded.95K helper angular-only, Sun9.58AU off-frame."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/asset/webb/enceladus-plume-webb-nirspec-and-cassini-image/",
        "title": "NASA detailed Webb product record",
        "publicationDate": "2023-05-30"
      },
      {
        "url": "https://esawebb.org/images/weic2314a/",
        "title": "ESA publisher collage; conflicting NIRCam caption preserved",
        "publicationDate": "2023-05-30"
      },
      {
        "url": "https://mmhedman.github.io/papers_published/Villanueva_Enc_NA_2023.pdf",
        "title": "JWST molecular mapping and characterization of Enceladus’ water plume feeding its torus; author-hosted PDF, exclusive publisher/Government-work rights, not asserted CC BY"
      },
      {
        "url": "https://www.nature.com/articles/s41550-025-02655-y",
        "title": "Khawaja et al organic classes; article CC BY4 with third-party exceptions, no figure adopted",
        "publicationDate": "2025-10-01"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/enceladus-webb-native.png",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2023/05/STScI-01GYJ8KXBB9GYG58KF9V7WRSGT.png?w=160&fit=clip",
        "sourcePage": "https://science.nasa.gov/asset/webb/enceladus-plume-webb-nirspec-and-cassini-image/",
        "sourceUrl": "https://science.nasa.gov/asset/webb/enceladus-plume-webb-nirspec-and-cassini-image/",
        "credit": "NASA, ESA, CSA, Gerónimo Villanueva (NASA-GSFC); Image Processing: Alyssa Pagan (STScI)",
        "terms": "NASA image/media usage guidelines; full credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "tier": "measured",
        "observationDate": "2022-11-09",
        "publicationDate": "2023-05-30",
        "bytes": 24001,
        "sha256": "da674c36f769e0dd330e19fcab6621bb35b261cba6c9f033e0ee5caf059aa4fc",
        "width": 160,
        "height": 160,
        "description": "NIRSpec IFU monochrome water-emission map assigned blue, collage with separate Cassini inset; not visible colour or resolved geography. Publisher160 display rendition reduces annotation readability; resizing/reencoding does not preserve full pixels. NASA1500PNG/ESA1500JPEG and320PNG retained.",
        "processing": "Unchanged publisher160 PNG bytes; no local native reencoding."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 9.58,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.05562675517362789,
      "centreDiscWidthFraction": 0.00048543505312076185,
      "irradianceEarth": 0.010896047349863365,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "HYPOTHETICAL LOCAL ENCELADUS TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM ENCELADUS",
    "surfaceImage": {
      "url": "/bespoke/enceladus-surface-image.jpg",
      "previewUrl": "/bespoke/enceladus-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "enceladus-generated-surfaceImage-original.png",
      "sourceSha256": "622689106b2f96880f8ad12ef168a90f96077d7a097f5bfcb2a20f8c0a25bad9",
      "sha256": "32d65cd8fb5834bbd7fcddefd8d2b3397a5995fbdc2596fe950ac809dae7b86b",
      "previewSha256": "4691b8485d132685bf755aa185d245a73b8c9d1b04bc5a32e366593ef2ca1835",
      "bytes": 243457,
      "previewBytes": 8322,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/enceladus-sky-image.jpg",
      "previewUrl": "/bespoke/enceladus-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "enceladus-generated-skyImage-original.png",
      "sourceSha256": "bc3119076dd49f3ae0945eb8a8f92956dff4d3d3577eb21097e1e176b100c278",
      "sha256": "e237ed2844de9ede61dcbaf29c9949eead2d30bf2bfb72f67bc86dd557cd9b82",
      "previewSha256": "dbdf9ca40fcdb19d9e602b402f2d7f1ea1fbb9b85bc893def3cd534218e24c41",
      "bytes": 164287,
      "previewBytes": 5400,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "tethys": {
    "id": "tethys",
    "name": "Tethys",
    "aliases": [
      "Tethys"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "previewWidth": 256,
    "nativeSurface": "Own NASA3D globe unchanged SHA84f70e3fe6fa48661df4d973f78a540771e629ebbc68e032539d2e28e1d8eea1 source-byte equal; underlying mosaic association/frame/coverage/epochs/photometry open. White/blurred gaps do not measure smooth terrain. No generated globe.",
    "measured": [
      "Catalogue radius531.1km, mass6.1745e20kg and semimajor axis295000km are representative catalogue values, not dated observer registration.",
      "Cassini ISS PIA20518 leading-hemisphere green-filter image observed2016-11-10 released2017-01-23; cratered surface, Odysseus basin and Scheria Montes central peaks visible. Monochrome not calibrated visible colour. Sourcecaption2km/pixel is its own estimate, not recomputed here.",
      "PIA21342 wide-angle visible image observed2017-05-13 released2017-08-21 shows tiny Tethys in Saturnshine near rings; publisher brightened moon2x. Retained as research context, not local terrain or calibrated photometry."
    ],
    "modelled": [
      "Spherical Saturn angular geometry is an observer guide, not a physically registered Cassini reconstruction. No new interior, chemistry or activity model is inferred from the adopted monochrome image."
    ],
    "unknown": [
      "Local material fractions and chemistry, registered observer site/phase, true-colour and photometric calibration, own globe mosaic input epochs/frame/coverage. Additional recent primary/scientific-product audit remains open; no exhaustive newest-observation claim."
    ],
    "assumed": [
      "Independent invented local craters/blocks/regolith, material fractions/chemistry, Saturn bands/nearly-edge-on rings/phase/lighting/exposure; no observed-body analog map reused. No atmosphere, plume, exposed ocean, biology or survivable landing.",
      "Saturn mean radius58232km at295000minus531.1km, nominal90HFOV: skyGeometry22.81113948degrees/337.303485px target at1672px; source row200 globe chords364/362/361px at thresholds5/10/20 are oversized relative to guide and not full calibrated diameter; rings excluded.95K helper angular-only; Sun9.58AU off-frame."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/photojournal/heres-looking-at-you-tethys/",
        "title": "Cassini PIA20518 own Tethys leading hemisphere",
        "publicationDate": "2017-01-23"
      },
      {
        "url": "https://science.nasa.gov/photojournal/saturn-lit-tethys/",
        "title": "PIA21342 Saturnshine context; moon enhanced2x",
        "publicationDate": "2017-08-21"
      },
      {
        "url": "https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Saturn%20-%20Tethys",
        "title": "NASA3D own globe file association; scientific mosaic audit remains open"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/tethys-cassini-native.jpg",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia20/pia20518/PIA20518.jpg?w=640&fit=clip",
        "sourcePage": "https://science.nasa.gov/photojournal/heres-looking-at-you-tethys/",
        "sourceUrl": "https://science.nasa.gov/photojournal/heres-looking-at-you-tethys/",
        "credit": "NASA/JPL-Caltech/Space Science Institute",
        "terms": "NASA image/media usage guidelines; full credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "tier": "measured",
        "observationDate": "2016-11-10",
        "publicationDate": "2017-01-23",
        "bytes": 24614,
        "sha256": "1e046b5d32da92ee49886d247efd7776159b41059f42b75e26af171900a89eca",
        "width": 640,
        "height": 640,
        "description": "Cassini ISS green-filter monochrome view of cratered Tethys including Odysseus/Scheria Montes. Not calibrated visible colour or a seamless globe. Publisher640 display rendition is resized/reencoded, not full pixel preservation; original JPEG retained.",
        "processing": "Unchanged NASA-served640 JPEG bytes; no local native reencoding."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 9.58,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.05562675517362789,
      "centreDiscWidthFraction": 0.00048543505312076185,
      "irradianceEarth": 0.010896047349863365,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "HYPOTHETICAL LOCAL TETHYS TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM TETHYS",
    "surfaceImage": {
      "url": "/bespoke/tethys-surface-image.jpg",
      "previewUrl": "/bespoke/tethys-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "tethys-generated-surfaceImage-original.png",
      "sourceSha256": "21ebd7596ea983a1eba6afe4cebe7c599b41409b5940d2565a33c169ac881f4d",
      "sha256": "ca6070f37305502968bffb093bcaf3b4b432f8e38dfbc39040a591b615c5d93c",
      "previewSha256": "76738d458cbd5fc0982c4edae9ebcf281c30c84bb0c8daf4900a2dea3967ba14",
      "bytes": 390576,
      "previewBytes": 10860,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/tethys-sky-image.jpg",
      "previewUrl": "/bespoke/tethys-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "tethys-generated-skyImage-original.png",
      "sourceSha256": "f316bef5552be0c159f7f6437423ec7b1ab174fc7b57f05c09fd35c0bda9dcf9",
      "sha256": "c80ceb68e1255dedff9e716ccc9b85290adfbd8c6c1361c7fcb2bfbdff9c81fd",
      "previewSha256": "4cb93bdeada9ac383cf3c5911ee8144285be0bd8c994eaba031855aa4f4fa425",
      "bytes": 198894,
      "previewBytes": 6569,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "dione": {
    "id": "dione",
    "name": "Dione",
    "aliases": [
      "Dione"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "previewWidth": 256,
    "nativeSurface": "Own NASA3D globe unchanged SHA c55d228900524557b6aff323f4b9391fc9816433e213a24ccf348c9b4291f89e source-byte equal; underlying mosaic association/frame/coverage/epochs/photometry open. No generated globe.",
    "measured": [
      "Catalogue radius561.4km, mass1.0955e21kg and semimajor axis377700km are representative catalogue values, not dated observer registration.",
      "Cassini PIA19653 own Dione cratered terrain observed2015-08-17 released2015-08-20. Monochrome not calibrated visible colour. Caption describes simultaneous WAC/NAC composite; adopted portrait download lacks an obvious inset. Exact camera/panel-to-file association remains open. North-down and32/3m per pixel are source-caption descriptions/estimates, not a new raster calculation or a camera assignment to this file.",
      "PIA17197 observed2012-07-23 released2018-03-12 is an older polarized/green-sensitive monochrome observation retained as research context; release date is not observation date."
    ],
    "modelled": [
      "Spherical Saturn angular geometry is an observer guide, not a physically registered Cassini reconstruction. Bulk core/ice composition inference does not measure local fractions, chemistry or visible colour."
    ],
    "unknown": [
      "Local material fractions/chemistry, registered observer site/phase, calibrated visible colour/photometry, own globe input epochs/frame/coverage and exact PIA19653 camera/panel association. Additional recent primary/scientific-product audit remains open; no exhaustive newest-observation claim."
    ],
    "assumed": [
      "Independent invented local craters/blocks/regolith/fractures, material fractions/chemistry, Saturn bands/nearly-edge-on rings/phase/light/exposure. No observed-body analog map reused; no atmosphere, plume, exposed ocean, biology or survivable landing.",
      "Saturn mean radius58232km at377700minus561.4km nominal90HFOV: skyGeometry17.76455338degrees/261.298356targetpx at1672px. Row150 upper-globe chords301/299/297px threshold5/10/20 exceed guide, not full calibrated diameter; rings excluded.95K helper angular-only; Sun9.58AU off-frame."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/photojournal/cassinis-closest-views-of-dione-i/",
        "title": "Cassini PIA19653 own Dione terrain; exact camera/panel association open",
        "publicationDate": "2015-08-20"
      },
      {
        "url": "https://science.nasa.gov/photojournal/dramatic-dione/",
        "title": "Cassini PIA17197 polarized/green monochrome context",
        "publicationDate": "2018-03-12"
      },
      {
        "url": "https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Saturn%20-%20Dione",
        "title": "NASA3D own Dione globe; frame/coverage/epochs/photometry audit open"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/dione-cassini-native.jpg",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia19/pia19653/PIA19653.jpg?w=377&h=640&fit=clip&crop=faces%2Cfocalpoint&format=jpeg",
        "sourcePage": "https://science.nasa.gov/photojournal/cassinis-closest-views-of-dione-i/",
        "sourceUrl": "https://science.nasa.gov/photojournal/cassinis-closest-views-of-dione-i/",
        "credit": "NASA/JPL-Caltech/Space Science Institute",
        "terms": "NASA image/media usage guidelines; full credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "tier": "measured",
        "observationDate": "2015-08-17",
        "publicationDate": "2015-08-20",
        "bytes": 39526,
        "sha256": "b095fce60ac09c67dc9525227f6abcc16a93840a32928afb87ed0ff2674a3c81",
        "width": 377,
        "height": 640,
        "description": "Cassini PIA19653 monochrome cratered Dione terrain, not calibrated visible colour or registered globe. Caption describes WAC/NAC composite; exact camera/panel association to adopted portrait file remains open. NASA-served377x640 display rendition resized/reencoded, not full pixel preservation; original602x1022 and separate1024 figure retained.",
        "processing": "Unchanged NASA-served JPEG bytes; no local native reencoding."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 9.58,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.05562675517362789,
      "centreDiscWidthFraction": 0.00048543505312076185,
      "irradianceEarth": 0.010896047349863365,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "HYPOTHETICAL LOCAL DIONE TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM DIONE",
    "surfaceImage": {
      "url": "/bespoke/dione-surface-image.jpg",
      "previewUrl": "/bespoke/dione-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "dione-generated-surfaceImage-original.png",
      "sourceSha256": "58e4ffc6ee790386ec9159a7a6b164fc4c9b474398061d3eb22342d8c04808c1",
      "sha256": "76146b3eab0cacdb5a82f6dec7cc1813e41b60a21f4a49abce8838964863cf64",
      "previewSha256": "9246064a2c06df1da5b62e14538c0591d69abc8151cb21d8fe3707e8eca46b3a",
      "bytes": 360668,
      "previewBytes": 10879,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/dione-sky-image.jpg",
      "previewUrl": "/bespoke/dione-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "dione-generated-skyImage-original.png",
      "sourceSha256": "8f603b59de7c7c9d5257304ac4fad13f7848ddc9d6d99c723291a21573881219",
      "sha256": "bcdef91c39052c37feadbd467908de6d970541681d62563fdd3982093212d0d8",
      "previewSha256": "bb2c114e37d6ab9afde97e1fa45631be3c13bff3c0f615c732d06c28e620beb8",
      "bytes": 230319,
      "previewBytes": 7625,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  },
  "rhea": {
    "id": "rhea",
    "name": "Rhea",
    "aliases": [
      "Rhea"
    ],
    "kind": "moon",
    "researchDate": "2026-10-10",
    "previewWidth": 256,
    "nativeSurface": "Own NASA3D globe unchanged/source-byte equal SHA487f642639a3a4b2e8e21c2aaf9dc5cd010e5e4a91d2e6b6ff61aff97bc157ac; frame/coverage/input epochs/photometry open. No generated globe.",
    "measured": [
      "Representative catalogue radius763.8km, mass2.3065e21kg, semimajor axis527200km; not dated scene registration.",
      "Cassini NAC visible-light PIA21354 observed2017-05-02/released2017-11-20, monochrome northern hemisphere. Caption370000km/2km per pixel estimates are publisher values, not new raster calculations; rounded1527km caption diameter preserved separately.",
      "NASA overview reports tenuous O2/CO2 exosphere detected2010; no strict gasless claim or visible haze/cloud inference."
    ],
    "modelled": [
      "Bulk ice/rock and sputtering/radiolysis interpretations do not establish local chemical fractions.",
      "Tiscareno/Burns/Cuzzi/Hedman2010 imaging-search abstract rejects earlier ring explanation; no confirmed Rhea ring. Abstract-only assessment, full paper audit open; no CC licence assertion."
    ],
    "unknown": [
      "Globe input epochs/frame/coverage/photometry, local material fractions, registered site/orientation/phase, calibrated visible colour and further recent primary/product audit. No exhaustive newest-observation claim."
    ],
    "assumed": [
      "Independent invented terrain/material chemistry/fractions/lighting/exposure, without analog-map reuse or dated site registration.",
      "Rhea's detected tenuous O2/CO2 exosphere does not establish visible haze/clouds; no strictly gasless claim.",
      "No active plume/exposed ocean/biology/survivable landing or confirmed Rhea ring.",
      "No celestial disk in frame; no angular/raster computation performed.",
      "Independent invented terrain/material fractions/chemistry/Saturn bands/rings/phase/lighting/exposure; no observed-body map or analog reuse.",
      "No dated site or orientation registration, visible atmosphere/haze/clouds, active plume/ocean/biology/landing claim; tenuous Rhea exosphere detection preserved.",
      "No confirmed Rhea ring; only schematic Saturn rings.",
      "95K helper used for angular guide only, not visible colour/irradiance/exposure calibration. Sun off-frame.",
      "skyGeometry Saturn58232km radius at527200minus763.8km nominal90HFOV12.70159454degrees186.091095targetpx1672. Row200 thresholds5/10/20 upper-globe chords76/68/56 substantially undersized, not full calibrated diameter; rings excluded95K angular-only Sun off-frame. Small preview footer labels limited; readable card labels required."
    ],
    "references": [
      {
        "url": "https://science.nasa.gov/photojournal/above-rhea/",
        "title": "Cassini PIA21354 Above Rhea",
        "publicationDate": "2017-11-20"
      },
      {
        "url": "https://science.nasa.gov/saturn/moons/rhea/",
        "title": "Rhea overview and tenuous exosphere"
      },
      {
        "url": "https://arxiv.org/abs/1008.1764",
        "title": "Tiscareno et al2010 no imaging evidence of rings: abstract-only"
      },
      {
        "url": "https://github.com/nasa/NASA-3D-Resources/tree/master/Images%20and%20Textures/Saturn%20-%20Rhea",
        "title": "Own NASA3D Rhea globe; registration audit open"
      }
    ],
    "contextImages": [
      {
        "url": "/bespoke/rhea-cassini-native.jpg",
        "source": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia21/pia21354/PIA21354.jpg?crop=faces%2Cfocalpoint&fit=clip&h=320&w=320",
        "sourcePage": "https://science.nasa.gov/photojournal/above-rhea/",
        "sourceUrl": "https://science.nasa.gov/photojournal/above-rhea/",
        "credit": "NASA/JPL-Caltech/Space Science Institute",
        "terms": "NASA image/media usage guidelines; full credit retained.",
        "termsUrl": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        "tier": "measured",
        "observationDate": "2017-05-02",
        "publicationDate": "2017-11-20",
        "bytes": 6768,
        "sha256": "b069c32ec66e94575d499a28711bb8dd1e7d9bc05c4824c33f676256170677d5",
        "width": 320,
        "height": 320,
        "description": "Cassini NAC PIA21354 northern Rhea in visible monochrome, not calibrated colour/registered geography. Unchanged NASA320 display rendition: publisher resizing/re-encoding is not full pixel preservation;640 and both1020 originals retained.",
        "processing": "Unchanged NASA-served JPEG; no local native reencoding."
      }
    ],
    "skyModel": {
      "star": "Sun",
      "radiusSun": 1,
      "temperatureK": 5772,
      "distanceAU": 9.58,
      "horizontalFovDeg": 90,
      "angularDiameterDeg": 0.05562675517362789,
      "centreDiscWidthFraction": 0.00048543505312076185,
      "irradianceEarth": 0.010896047349863365,
      "approximateSrgb": [
        1,
        0.9501748635948273,
        0.9034305975663324
      ],
      "limits": "Semimajor-axis representative geometry; sky image is artistic. Blackbody colour guide omits spectral lines, atmospheric transfer, exposure and adaptation."
    },
    "surfaceLabel": "HYPOTHETICAL LOCAL RHEA TERRAIN",
    "skyLabel": "HYPOTHETICAL SKY FROM RHEA",
    "surfaceImage": {
      "url": "/bespoke/rhea-surface-image.jpg",
      "previewUrl": "/bespoke/rhea-surface-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "rhea-generated-surfaceImage-original.png",
      "sourceSha256": "eb8d87eb80d273f42db4b752761ec30ba8e05239c90e6493e93eae94d4ba6621",
      "sha256": "e92856a60c8d4ca6ccf012739e67f50ce4cf8c9d1458f6bafb39f54b9447c730",
      "previewSha256": "868ca0df0c077d964b2f932253c22af2d7a2869263c4d76188b56d7db6f2eac6",
      "bytes": 392520,
      "previewBytes": 11342,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    },
    "skyImage": {
      "url": "/bespoke/rhea-sky-image.jpg",
      "previewUrl": "/bespoke/rhea-sky-image-preview.jpg",
      "tier": "imagined",
      "generated": "2026-10-10",
      "observationDate": null,
      "credit": "Fidelity / OpenAI image generation · researched hypothetical illustration",
      "terms": "Generated for Fidelity; cited measurements constrain the hypothesis, not measured geography.",
      "sourceFile": "rhea-generated-skyImage-original.png",
      "sourceSha256": "2f40f779bc25f8b21231aadacfc5831fa1b07004f1dbb0cd51b9cc03e6178807",
      "sha256": "26feedfd553dff92bc28d5f1f92280c8c5dde0bc410b35fcf5937c89de0f1424",
      "previewSha256": "99c9d9a76437839cf143d6da2d1a51d245565b6912c4d22970362a6eb2a9007e",
      "bytes": 205187,
      "previewBytes": 6791,
      "width": 1536,
      "height": 864,
      "previewWidth": 256,
      "previewHeight": 144,
      "processing": "Resampled JPEG. Original generated PNG retained; terrain, albedo pattern and material appearance are artistic and not radiometrically calibrated."
    }
  }
};

const normalize = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function bodyVisualFor(body) {
  if (!body) return null;
  const catalog = body.catalog ?? body.star ?? body;
  const names = [body.name, catalog.hd && `HD ${catalog.hd}`, catalog.gl].filter(Boolean);
  for (const name of names) {
    const visual = Object.values(BODY_VISUALS).find(v => v.aliases.some(alias => normalize(alias) === normalize(name)));
    if (visual) return visual;
  }
  return null;
}
export const BESPOKE_TEXTURES = Object.fromEntries(Object.values(BODY_VISUALS).filter(v => v.surfaceMap).map(v => [v.surfaceMap.key, v.surfaceMap]));
