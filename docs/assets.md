# Fidelity visual assets

Preference: live imagery → recent actual observations → recent artistic imagery → AI-generated imagery informed by the body's composition, colour, clouds and known features. A recent publication date does not make an old observation recent. Record both dates when known; do not invent missing dates. Credit every asset and retain its source's stated terms.

## Delivered spacecraft batch (2026-10-10)

Local GLBs cover ISS, Hubble, JWST, Voyager 1/2 (shared Voyager model), Juno, Parker Solar Probe, DSCOVR, MRO and LRO. They are published mission visualizations from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), not resolved photography or measured flight attitude. Their MODELLED provenance, credits, exact download URLs, processing, hashes, sizes and triangle counts are in `src/data/models.js`. All are below 50,000 triangles and 2 MB (ISS below 5 MB).

ISS is simplified. Juno, Webb and LRO were welded after removing split normals, simplified and given recomputed normals; fine shading may differ from the originals. Draco and Meshopt decoders are local. The original unsimplified source is linked in every record.

Models load when the craft is focused. While loading or on failure the representative IMAGINED craft remains. The single-file preview now embeds compact mission geometry for all 24 registered files. Normal builds bundle models for offline revisits. Models preserve author axes and are recentered on the bounding box and normalized into the existing catalog-radius envelope. Metres, deployed dimensions, centre of mass and boresight are **not independently calibrated**; attitude remains illustrative. This batch does not meet the final physical registration specification yet.

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

## Individual body imagery expansion (2026-10-10)

Generic skins remain fallbacks. The user expanded the work to individual researched surface and hypothetical observer/sky imagery for Solar System bodies (including every moon and dwarf planet) and the nearest 20 known exoplanets and 20 stars. `docs/research/bespoke-workflow.md` specifies the method; `docs/research/bespoke-queue.json` tracks 528 initial tasks. The separate inventory of minor-planet satellites and current nearest-star boundary verification remain open.

First dossiers: Ceres and current confirmed Barnard b. Ceres retains its native Dawn globe and adds generated salt-terrain detail and a hypothetical sky view. Barnard b has an individual generated equirectangular surface map and observer view. All generated visuals are IMAGINED, with assumptions and unknowns visible in Planet/Object View. NASA Dawn-derived terrain context is MODELLED/colour-enhanced; ESO artwork is IMAGINED and credited to M. Kornmesser. Do not reuse the superseded 2018 Barnard candidate's cold-world constraints.

`src/data/bespoke.js` holds the dossiers, assets, sources, hashes and sky constraints. `src/astro/appearance.js` calculates angular size and bolometric flux; the raster colour/diameter is still approximate. Known chemistry constrains Ceres, whereas Barnard's silicate/iron ground is a chosen scenario with no measured surface chemistry. The normal build and 99 passing tests (one catalogue-dependent skip) pass. Browser checks confirm the individual cards, decoded images, badges and calculated disc values. Full catalogue preview size remains unverified.

## Outer dwarf-planet batch (2026-10-10)

Eris, Haumea and Makemake now have individual 2048×1024 hypothetical surface maps and 1536×864 observer/sky images, with smaller embedded-preview variants. These replace unrelated Moon/Pluto analogs. Every spatial feature is IMAGINED; disk-integrated spectra constrain composition but not geography. Native telescope observations accompany the dossiers as MEASURED processed detection images, explicitly not resolved terrain or true-colour close-ups. Original source credits, dates and image hashes are retained.

Eris uses low-contrast pale methane/nitrogen frost. Haumea uses crystalline water ice and one artist-positioned subdued reddish region; the existing sphere remains a shape limitation and the map does not supply an occultation-derived ellipsoid. Makemake uses muted cream/ochre methane-rich ice. Its dossier incorporates the 2025 methane-gas detection, tenuous atmosphere/coma alternatives, and the unresolved 2024 thermal excess; it does not claim the body has no gas or draw a uniquely located volcano. Methane origin and activity interpretations remain modelled.

Sun sizes and bolometric flux are computed at catalogue semimajor-axis distances. The solar disc is subpixel at the chosen 60° view; illustrated point-source glare remains artistic. No epoch, surface coordinate, moon position, ring visibility, calibrated reflectance or spectral exposure is claimed. Seam continuity and natural visible colour remain approximations.

The additive importer `scripts/assets/import-body-batch.mjs <manifest.json> <generated-PNG-directory>` validates all inputs before publishing, rejects aspect/budget mismatches and existing dossier IDs, and preserves earlier dossiers. The source manifest is `docs/research/dwarf-batch-2026-10-10.json`; generated originals remain identified by source filename and SHA-256. Research cards now display modelled interpretations alongside measured constraints.

Validation for this batch: 100 tests pass, one catalogue-dependent skip; production build passes. Browser checks decode all three individual maps and all nine hypothesis/context images and verify the modelled gas alternatives are visible. Full catalogue standalone size remains unverified.

## Proxima b/d batch (2026-10-10)

The two closest confirmed archive planets receive separate researched albedo maps and observer views under explicit water-poor, airless silicate/iron scenarios. No terrain, mineralogy, atmosphere, ocean, rotation state or measured radius is claimed. The dossiers use the 2025 NIRPS multi-instrument masses/periods and adopted stellar values; Proxima d was independently confirmed then. The 2026 stellar-interaction work is context, not an observed planetary magnetic field or rendered flare. Companion imagery includes the credited 2025 IAC artist interpretation by Gabriel Pérez Díaz.

Representative stellar diameter is 1.550° at b and 2.608° at d. Raster disc size and colour are approximate. The blackbody flux calculation from adopted radius/temperature differs from the paper luminosity-based flux; this difference is recorded rather than silently claiming exact photometry. Maps use neutral albedo illumination; observer images use warm stellar illumination. No Alpha Centauri companion alignment is invented. Source manifest: `docs/research/proxima-batch-2026-10-10.json`.

Proxima validation: 101 passing tests, one catalogue-dependent skip; production build and browser decoding/individual cards pass for both planets. The full offline preview check is in progress.

## Full offline preview verification (2026-10-10)

The full catalogue build now produces a verified 8,996,540-byte `dist-standalone/fidelity.html`, below the 16 MB target. It includes 4,368 nearby stars, 330 planetary systems, 51 textures, five shape previews, and 20 dossier/context images representing all seven current dossiers. With networking disabled, the single-file app opens Makemake, shows its gas alternatives, and decodes all 71 embedded surface/companion images. This resolves the earlier unverified full-snapshot size concern for the present library. The remaining body queue is not complete.

Upstream surfaces are reduced to fit within 512×256 for the offline preview; normal app textures remain full resolution. Ring alpha is retained. Sharp replaces the builder’s optional Python/Pillow dependency, which silently dropped valid native lunar maps on this machine. Missing cached Ceres/Vesta mosaics are now sampled directly from their native USGS TIFFs into separately cached previews; these do not overwrite the normal 2048-pixel backend cache. Preview compression preserves the actual selected source credit, including Solar System Scope fallbacks. The builder rejects a single-file artifact exceeding 16,000,000 bytes. Future image batches must recheck the budget.

## Haumea overall shape (2026-10-10)

The earlier spherical Haumea limitation is now corrected by a smooth occultation/photometry ellipsoid: long, intermediate and polar semiaxes 1161, 852 and 513 km from the Ortiz et al. 2017 fit. This is MODELLED, not a resolved terrain reconstruction. Native kilometres and geometric centre are retained; +X is long equatorial axis, +Y polar axis, −Z east along the intermediate axis. The inertial pole, spin phase, centre of mass and texture registration remain unverified. Alternative shape fits and uncertainties remain; the ring is still separate outstanding work.

Master 3968 triangles, preview 960; both use planetocentric seam-split UVs and bundled Meshopt. System and Planet views load the existing native-km path, now using the distinct OCCULTATION ELLIPSOID provenance label. `scripts/assets/build-haumea-shape.mjs` reproduces it. Importing the PDS conversion helper no longer triggers downloads, and subsequent PDS imports preserve this registry entry.

Haumea verification: 102 tests pass (one catalogue-dependent skip), including both GLBs’ published axis lengths and smooth ellipsoid equation. Browser loading confirms native-km scaling and the source-specific label. The updated full offline artifact is 9.04 MB with six embedded shape previews; all 71 images still decode without networking, and embedded Haumea preview bytes match the verified model.

Borrowed observed-body skins are prohibited: Moon, Mars, Pluto, Sun and Jupiter imagery is never assigned to a different body. Unfinished Solar System maps use independent procedural IMAGINED placeholders labelled BESPOKE QUEUED; existing native maps and completed individual dossiers retain priority. Non-Solar photospheres also use independent procedural illustrations.

Offline spacecraft rendering: the standalone snapshot embeds Meshopt mission preview GLBs keyed by their normal asset URL. The loader selects these data URIs instead of disabling mission models. Previews preserve credited source geometry with reduced detail and existing illustrative attitude/size limits. `scripts/assets/build-craft-previews.mjs` records preview processing, byte counts and SHA-256 hashes; the 16 MB HTML gate remains enforced.

Satellite panel rendering also fixes an undefined body reference in the model credit line. Craft materials receive a dedicated studio environment map so dark metal materials remain legible without changing planet illumination; this lighting is illustrative, not telemetry. Browser checks decode all 24 normal and embedded GLBs, render the ISS route with networking disabled, and verify all 71 offline images. Current standalone size is 14.25 MB.

Barnard c/d/e batch (2026-10-10): three independent IMAGINED albedo maps and observer images now replace generic class skins by full-name matching. Basant et al. 2025 supplies confirmed RV constraints, the 2024 stellar analysis supplies adopted host parameters, and the 2026 dynamical study is conditional modelling context. No observed radius, terrain, atmosphere or chemistry is implied. Geometric host diameters at representative distances are 3.599°, 5.246° and 2.588° respectively. Source bright-core widths were checked after image generation edits: approximately 11% below, 1% above and 17% below the target. These remain explicitly approximate raster sizes; exact calibration is refinement work. Primary downloads and generated originals retain SHA-256 records. The additive manifest is `docs/research/barnard-cde-batch-2026-10-10.json`; all previous dossiers remain unchanged.

Rebase integration preserves upstream live skins, surface controls, nearby planet lists, Galactic deep time and Quadrant/Universe snapshot fields alongside local shapes, models and body imagery. Normal tests/build and offline browser checks cover the combined version. Current full standalone is 15.76 MB, under the 16 MB gate but with little headroom; subsequent batches need preview compression or size budgeting.

Batch validation: 119 tests pass, one catalogue-dependent skip; production build passes. Offline Barnard c/d/e routes each decode two unique hypothesis images and display size/chemistry limits. The combined upstream catalogue has 4,289 nearby stellar rows; model and shape registries remain embedded.

Epsilon Eridani b (2026-10-10): an independent IMAGINED cloud-top map and hovering observer image bring the registry to 11 dossiers. The 2026 atmospheric study permits clouds or enriched clear atmospheres; this is a selected cloudy hypothesis, with no solid ground. Separate cloud/sky card labels prevent a terrain claim. Source versions, dates, terms and download hashes accompany the additive manifest. The star bright core is 7–13 source pixels versus a 2.90-pixel geometric target; glare is unresolved and accurate raster disc size remains open.

Batch validation after rebasing the new upstream Milky Way model: 122 tests pass with one catalogue-dependent skip; normal and standalone builds pass. Full offline HTML is 15,473,964 bytes, below 16 MB, with 75 unique images decoded, 24 mission model entries preserved, and cloud labels/assumptions/raster limits checked on the Epsilon Eridani b route. ISS and earlier Barnard c/d/e routes also work offline.
