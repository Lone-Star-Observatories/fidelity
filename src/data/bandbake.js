// Band images baked into the standalone preview (#28): a few small previews carried in the snapshot
// (`snapshot.bandImages`, written by scripts/build-standalone.js), keyed by the backend URL the app
// would otherwise ask for, so the offline file can still show some real (or modelled) band imagery.
//   { [url]: { src: data URI, w, h, time, credit, disk?, predicted? } }
// Normal builds have no snapshot: every lookup is null and the backend serves the images.

import snapshot from '#snapshot';

/** The baked copy of a backend band-image URL, or null. */
export const bakedBand = (url) => (url && snapshot?.bandImages?.[url]) || null;
/** A live feed's baked 256×256 preview (SDO, SRH, the modelled radio discs), or null. */
export const bakedFeed = (id) => bakedBand(`/api/feed/${id}?size=preview`);
/** An all-sky survey's baked 256×128 preview, or null. */
export const bakedHips = (id) => bakedBand(`/api/hips?id=${encodeURIComponent(id)}&size=preview`);
/** "BAKED 256×128 · 2026-10-10": what the offline copy is. */
export const bakedText = (b) => (b ? `BAKED ${b.w}×${b.h}${b.time ? ` · ${String(b.time).slice(0, 10)}` : ''}` : '');
