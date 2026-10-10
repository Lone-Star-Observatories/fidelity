# Fidelity visual assets

Preference: live imagery → recent actual observations → recent artistic imagery → AI-generated imagery informed by the body's composition, colour, clouds and known features. A recent publication date does not make an old observation recent. Record both dates when known; do not invent missing dates. Credit every asset and retain its source's stated terms.

## Delivered spacecraft batch (2026-10-10)

Local GLBs cover ISS, Hubble, JWST, Voyager 1/2 (shared Voyager model), Juno, Parker Solar Probe, DSCOVR, MRO and LRO. They are published mission visualizations from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), not resolved photography or measured flight attitude. Their MODELLED provenance, credits, exact download URLs, processing, hashes, sizes and triangle counts are in `src/data/models.js`. All are below 50,000 triangles and 2 MB (ISS below 5 MB).

ISS is simplified. Juno, Webb and LRO were welded after removing split normals, simplified and given recomputed normals; fine shading may differ from the originals. Draco and Meshopt decoders are local. The original unsimplified source is linked in every record.

Models load when the craft is focused. While loading, on failure and in the single-file preview the representative IMAGINED craft remains. Normal builds bundle models for offline revisits. Models preserve author axes and are recentered on the bounding box and normalized into the existing catalog-radius envelope. Metres, deployed dimensions, centre of mass and boresight are **not independently calibrated**; attitude remains illustrative. This batch does not meet the final physical registration specification yet.

## Remaining work

- Priority 1: Tiangong, New Horizons, SOHO, Gaia, Euclid, Europa Clipper, JUICE, Curiosity; physical registration and visual review of the delivered batch.
- Priority 2 and 3: remaining craft and satellite class models in the supplied brief.
- Body geometry: Phobos, Deimos, Hyperion, Amalthea, Proteus, Arrokoth, Halley, Haumea; then Vesta and Ceres. Use cited shape reconstructions and document frame, units and centre.
- Maps: improve Titan; document Uranian coverage and Pluto polar night; assess Ceres/Vesta colour. Never silently fabricate unobserved coverage.
- Imagined skins: 6–8 exoplanet classes, brown-dwarf weather and unresolved stellar surfaces. Store composition, temperature assumptions, cloud species, palette and scientific references with each generated map.
- Scene art: satellite galaxies, asymmetric heliosphere, comet coma and tails, Oort cloud.

## Delivery specification

Textures: equirectangular 2:1, north up, planetocentric latitude; east-positive longitude. Record left-edge longitude (`texLon0`) and IAU body frame. Master 2048×1024 JPEG around 700 KB or less; preview 512×256 within the total 16 MB preview budget. Record mission/instrument, observation and processing dates, processing, credit, terms, tier, coverage and gap colour.

Small-body GLBs: km, centre of mass, +Y north pole, +X prime meridian, compatible UV convention or vertex colours, ≤20k triangles (preview ≤2k), citation for the source shape model.

Spacecraft GLBs: metres, deployed configuration, centre of mass, documented body frame; ≤50k triangles, ≤2 MB (ISS ≤5 MB), PBR materials and textures ≤1024². Articulated arrays and preview LODs are optional. Registration limits must stay visible in metadata until verified.
