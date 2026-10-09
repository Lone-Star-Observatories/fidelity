# Architecture

```
browser (Vite-built SPA, three.js)                 local backend (Node ≥20, no deps)
┌──────────────────────────────────────┐           ┌───────────────────────────────────┐
│ LCARS shell  src/main.js, styles/    │  /api/*   │ server/index.js   static + API    │
│ router       #/system/sol/earth …    │ ────────▶ │ server/horizons.js  JPL proxy     │
│ clock        src/astro/clock.js      │           │ server/catalogs.js  RAID scanner  │
│ views        src/views/<level>/      │           │ server/cache.js     disk cache    │
│ astro math   src/astro/kepler.js     │           └──────────────┬────────────────────┘
└──────────────────────────────────────┘                          │ on demand
                                                     data/cache/  ◀─┘  (+ FIDELITY_CATALOG_DIRS)
```

- **Local only.** The backend binds to `127.0.0.1:4011`. `npm start` serves the built app
  and the API. `npm run dev` runs Vite on `:5173`, which proxies `/api` to the backend.
- **On demand, stored locally.** Each upstream request is cached as JSON in `data/cache/<ns>/`.
  If an upstream fails, a stale copy is served. Horizons data is cached per body per
  calendar month.
- **Scale.** Each level is its own scene in its natural unit (km, AU, ly, Mly). The System
  View uses AU with a *floating origin*: the focused body sits at (0,0,0). It also uses a
  logarithmic depth buffer, so true-scale Earth (4×10⁻⁵ AU) and Neptune's orbit (30 AU)
  render together. Camera flights ease distance in log space.
- **Provenance.** Each value shown in the UI carries a tier badge from `src/data/provenance.js`.
- **Routes.** `#/system/<system>[/<body>]`, `#/navigation`, `#/quadrant`, `#/galaxy`,
  `#/universe`. The Sector 001 beacon is `#/system/sol`.

## Adding a view

1. Create `src/views/<level>/<Name>View.js` exporting `create…View(container, deps)` with
   `show()` and `hide()`.
2. Mount it in `src/main.js` routing; remove its entry from `src/roadmap.js`.
3. Add any upstream it needs as a backend route with a cache namespace. Don't fetch
   non-CORS upstreams from the browser.
4. Tag every displayed value with a provenance badge, and update `docs/data-sources.md`.
