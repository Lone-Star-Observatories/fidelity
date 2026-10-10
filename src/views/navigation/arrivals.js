// Deep-time arrivals (#29): the stars beyond the chart's radius that can drift into it. Loads
// shells of the catalogue around the centre star (inner up front, outer when deep time needs it),
// integrates their orbits in a worker (the same Milky Way model as the chart's own stars) and
// keeps one track per star. The Navigation View decides each epoch which of them are inside.

import OrbitsWorker from './orbits.worker.js?worker&inline';
import { fetchArrivals } from '../../data/catalog.js';
import { eqToGal, LY_PER_PC } from '../../astro/frames.js';
import { INNER_LY, OUTER_LY, needOuter, spanFor } from './drift.js';

const CHUNK = 4000; // stars per worker message: tracks arrive progressively

export function createArrivals({ onChange }) {
  let worker = null, gen = 0, seq = 0;
  const jobs = new Map();
  let st = null;

  function integrate(stars, span) {
    worker ??= new OrbitsWorker();
    worker.onmessage = (e) => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j?.(e.data); };
    const g = gen;
    for (let i = 0; i < stars.length; i += CHUNK) {
      const part = stars.slice(i, i + CHUNK);
      const pos = new Float64Array(part.length * 3), vel = new Float64Array(part.length * 3);
      part.forEach((s, k) => { pos.set(s.gal, k * 3); vel.set(s.galV, k * 3); });
      const id = ++seq;
      st.pending += part.length;
      jobs.set(id, (r) => {
        if (g !== gen) return;
        st.pending -= part.length;
        part.forEach((s, k) => {
          s.track = { n: r.n, sampleMyr: r.sampleMyr, data: r.data.subarray(k * r.stride, (k + 1) * r.stride) };
          s.spanYears = span.spanMyr * 1e6;
        });
        onChange?.();
      });
      worker.postMessage({ id, pos, vel, ...span }, [pos.buffer, vel.buffer]);
    }
  }

  async function shell(fromLy, toLy) {
    const g = gen, rec = { fromLy, toLy, status: 'loading' };
    st.shells.push(rec);
    onChange?.();
    try {
      const d = await fetchArrivals(st.center, fromLy, toLy);
      if (g !== gen) return;
      rec.status = 'ok';
      st.density = d.density ?? st.density;
      if (d.preview) { st.preview = true; st.previewLy = d.previewLy; }
      const fresh = d.stars.filter((s) => !st.exclude.has(s.id)).map((s) => ({
        ...s, arrival: true,
        gal: eqToGal([s.x * LY_PER_PC, s.y * LY_PER_PC, s.z * LY_PER_PC]), galV: eqToGal(s.v),
        track: null, spanYears: 0,
      }));
      st.stars.push(...fresh);
      integrate(fresh, st.span);
    } catch (err) {
      if (g !== gen) return;
      rec.status = 'error'; rec.error = err.message; rec.at = Date.now();
    }
    onChange?.();
  }

  return {
    /** Start over around `center` (`exclude`: ids already on the chart). */
    reset(center, radiusLy, exclude, solDistLy = 0) {
      gen++; jobs.clear();
      st = { center, radiusLy, exclude: new Set(exclude), stars: [], shells: [], pending: 0, span: spanFor(0), density: null, preview: false, previewLy: 0, solDistLy };
      if (radiusLy < INNER_LY) shell(radiusLy, INNER_LY);
    },
    /** Load or integrate more when deep time reaches `epoch` (years). */
    ensure(epoch) {
      if (!st) return;
      // a failed shell is retried after 30 s
      st.shells = st.shells.filter((s) => !(s.status === 'error' && Date.now() - s.at > 30000));
      if (needOuter(st.radiusLy, epoch) && !st.preview && !st.shells.some((s) => s.toLy === OUTER_LY) && st.shells.every((s) => s.status !== 'loading')) {
        shell(Math.max(INNER_LY, st.radiusLy), OUTER_LY);
      }
      const want = spanFor(epoch);
      if (want.spanMyr > st.span.spanMyr) { st.span = want; integrate(st.stars.filter((s) => s.spanYears < want.spanMyr * 1e6), want); onChange?.(); }
    },
    get stars() { return st?.stars ?? []; },
    /** Status for the chart badge and the panel. */
    get status() {
      if (!st) return null;
      const ok = st.shells.filter((s) => s.status === 'ok');
      const loadingShell = st.shells.find((s) => s.status === 'loading');
      const loadedLy = st.preview ? Math.max(st.radiusLy, st.previewLy - st.solDistLy) : Math.max(st.radiusLy, ...ok.map((s) => s.toLy));
      const loading = loadingShell ? `LOADING ARRIVALS ${loadingShell.fromLy}–${loadingShell.toLy.toLocaleString('en-US')} LY…`
        : st.pending ? `INTEGRATING ORBITS · ${st.pending.toLocaleString('en-US')} STARS TO GO…` : null;
      return { count: st.stars.length, loadedLy, loading, preview: st.preview, previewLy: st.previewLy, density: st.density,
        error: st.shells.find((s) => s.status === 'error')?.error ?? null, spanYears: st.span.spanMyr * 1e6 };
    },
  };
}
