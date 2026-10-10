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
  }
};
const normalize = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function bodyVisualFor(body) {
  if (!body) return null;
  return Object.values(BODY_VISUALS).find(v => v.aliases.some(name => normalize(name) === normalize(body.name))) ?? null;
}
export const BESPOKE_TEXTURES = Object.fromEntries(Object.values(BODY_VISUALS).filter(v => v.surfaceMap).map(v => [v.surfaceMap.key, v.surfaceMap]));
