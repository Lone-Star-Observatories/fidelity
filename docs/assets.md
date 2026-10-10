# Fidelity visual assets

Preference: live imagery → recent actual observations → recent artistic imagery → AI-generated imagery informed by the body's composition, colour, clouds and known features. A recent publication date does not make an old observation recent. Record both dates when known; do not invent missing dates. Credit every asset and retain its source's stated terms.

## Delivered spacecraft batch (2026-10-10)

Local GLBs cover ISS, Hubble, JWST, Voyager 1/2 (shared Voyager model), Juno, Parker Solar Probe, DSCOVR, MRO and LRO. They are published mission visualizations from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), not resolved photography or measured flight attitude. Their MODELLED provenance, credits, exact download URLs, processing, hashes, sizes and triangle counts are in `src/data/models.js`. All are below 50,000 triangles and 2 MB (ISS below 5 MB).

ISS is simplified. Juno, Webb and LRO were welded after removing split normals, simplified and given recomputed normals; fine shading may differ from the originals. Draco and Meshopt decoders are local. The original unsimplified source is linked in every record.

Models load when the craft is focused. While loading, on failure and in the single-file preview the representative IMAGINED craft remains. Normal builds bundle models for offline revisits. Models preserve author axes and are recentered on the bounding box and normalized into the existing catalog-radius envelope. Metres, deployed dimensions, centre of mass and boresight are **not independently calibrated**; attitude remains illustrative. This batch does not meet the final physical registration specification yet.

## Remaining work

- Priority 1: Tiangong, New Horizons, Gaia, Euclid, JUICE; physical registration and visual review of the delivered batch.
- Priority 2 and 3: remaining craft and satellite class models in the supplied brief.
- Body geometry: Deimos, Arrokoth, Haumea; then Vesta and Ceres. Use cited shape reconstructions and document frame, units and centre.
- Maps: improve Titan; document Uranian coverage and Pluto polar night; assess Ceres/Vesta colour. Never silently fabricate unobserved coverage.
- Imagined skins: brown-dwarf weather and unresolved stellar surfaces; further review of generated exoplanet class skins. Store composition, temperature assumptions, cloud species, palette and scientific references with each generated map.
- Scene art: satellite galaxies, asymmetric heliosphere, comet coma and tails, Oort cloud.

## Delivery specification

Textures: equirectangular 2:1, north up, planetocentric latitude; east-positive longitude. Record left-edge longitude (`texLon0`) and IAU body frame. Master 2048×1024 JPEG around 700 KB or less; preview 512×256 within the total 16 MB preview budget. Record mission/instrument, observation and processing dates, processing, credit, terms, tier, coverage and gap colour.

Small-body GLBs: km, centre of mass, +Y north pole, +X prime meridian, compatible UV convention or vertex colours, ≤20k triangles (preview ≤2k), citation for the source shape model.

Spacecraft GLBs: metres, deployed configuration, centre of mass, documented body frame; ≤50k triangles, ≤2 MB (ISS ≤5 MB), PBR materials and textures ≤1024². Articulated arrays and preview LODs are optional. Registration limits must stay visible in metadata until verified.

## Second batch (2026-10-10)

Added fifteen NASA mission/class GLBs: SOHO, ACE, STEREO-A, Pioneer 10 (also an approximate Pioneer 11), Mars Odyssey, SDO, Aqua, Terra, Suomi NPP, Landsat 8, Europa Clipper, Curiosity, 1U/2U CubeSats and a historical GOES class model. NORAD aliases select the five additional Earth-observation missions. Generic classes are available in the library but await reliable catalogue identification; GOES geometry is not a claim of GOES-R configuration. All meet the 50k/2 MB budgets. Clipper uses 512-pixel WebP textures; Curiosity uses 512-pixel textures. Fine details lost through decimation remain accessible in the credited originals. `scripts/assets/import-craft.mjs` reproduces imports with build-time dependencies; the runtime backend remains dependency-free.

Five PDS shape reconstructions now replace spheres on focus in System and Planet views: Phobos (Gaskell), Hyperion (Thomas/Cassini), Amalthea, Proteus and Halley (Stooke). `src/data/shapes.js` records native kilometres, historical frames, source epochs, source hashes and geometry limits. Full meshes have ≤20k triangles; previews ≤2k. Source origins are retained and are not all centres of mass. Current Hyperion attitude is illustrative because its rotation is chaotic. Stooke models are coarse historical reconstructions. UVs split the longitude seam and average longitude at pole-enclosing triangles. Surface textures retain their existing measured/analog provenance; geometric and albedo registration has not been independently established. Lazy-load failures retain the sphere. Camera framing includes the native shape envelope.

Eight generated albedo maps cover nine radius/temperature classes (the hot sub-Neptune shares the sub-Neptune map with a warm tint). Every feature is IMAGINED. `src/data/skins.js` records composition hypotheses, temperature thresholds, colour/cloud choices, generation date, references and original PNG hashes. Radius and equilibrium temperature alone do not establish composition, cloud species, water or habitability. Masters are 2048×1024 JPEG, each below 700 KB; previews are 512×256. Maps were requested as uniform albedo with continuous edges, but perfect seam continuity is not claimed. NASA's planet-type overview supplies class context; it does not predict these illustrated features.

The standalone builder embeds the eight texture previews and five Meshopt shape previews as data URIs. This adds approximately 0.8 MB before HTML overhead; the final catalogue-inclusive 16 MB target still needs verification with a full snapshot build. Spacecraft continue using lightweight representatives there.

OSIRIS-REx/APEX import remains unresolved: the current source still exceeds the triangle budget after simplification. Do not treat it as delivered. Remaining ESA/JAXA/ISRO spacecraft, newer actual maps, physical registration and scene art remain in the queue above.

Validation: 94 tests pass, one catalogue-dependent test is skipped; normal production build passes. Browser loaders decoded all 24 craft files, five full shapes and eight maps. An asset-only standalone fixture also built successfully and decoded all 13 embedded shape/texture previews without an API. This verifies asset packaging, not the size or completeness of the full catalogue snapshot. The fixture is not a delivered preview.

Reproduce imports after `npm install`: `node scripts/assets/import-craft.mjs <craft-id>`; `node scripts/assets/import-shapes.mjs`; `node scripts/assets/import-skins.mjs <directory-of-generated-PNGs>`. Failed craft imports preserve earlier failure records and exit unsuccessfully; no oversized model is written. Generated source PNGs are retained in the Codex image archive, and their names/hashes identify the inputs.
