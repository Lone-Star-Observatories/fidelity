// Orbit integration off the main thread (#29): a batch of stars (heliocentric galactic ly,
// Sun-relative km/s) → Float32 tracks in the Milky Way model (src/astro/galpot.js).
// In: { id, pos, vel, spanMyr, dtMyr, sampleMyr }. Out: { id, n, sampleMyr, stride, count, data }.
import { integrateBatch } from '../../astro/galpot.js';

self.onmessage = (e) => {
  const { id, pos, vel, spanMyr, dtMyr, sampleMyr } = e.data;
  const b = integrateBatch(pos, vel, { spanMyr, dtMyr, sampleMyr, Float: Float32Array });
  self.postMessage({ id, n: b.n, sampleMyr: b.sampleMyr, stride: b.stride, count: b.count, data: b.data }, [b.data.buffer]);
};
