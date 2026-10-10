// Satellite View: find any active satellite, fly to it, read its computed telemetry, and open
// whatever live feed it has (images, video, crew, solar data). Depends on the shell's helpers.

import { satrecFromRow, precessionToJ2000, temeToEcliptic, subPoint } from '../astro/sgp4.js';
import { fetchSatellites, fetchSatelliteDetail, fetchFeed } from '../data/catalog.js';
import { SAT_FEEDS, FEATURED, SAT_SIZE_KM, CATEGORY_LABEL } from '../data/feeds.js';
import { SAT_COLORS } from '../views/system/satellites.js';
import { lineChart } from './charts.js';

const MU = 398600.4418, R_EQ = 6378.137, R_MEAN = 6371;

export function createSatellitePanel({ h, pill, row, factList, badge, renderLegend, go, system, clock, toast, panel, live, resetLive, $ }) {
  let data = null, byNorad = null, loading = null;

  function load() {
    loading ??= fetchSatellites().then((d) => {
      if (!d?.rows) return null;
      data = d;
      byNorad = new Map(d.rows.map((r) => [r[0], r]));
      return d;
    });
    // (re)attach to the System View: the layer is dropped whenever Sol is reloaded
    return loading.then((d) => { if (d) system.setSatellites(d); return d; });
  }

  const catOf = (r) => data.categories[r[2]];
  const orbitOf = (r) => {
    const n = (r[4] * 2 * Math.PI) / 86400; // rad/s
    const a = Math.cbrt(MU / (n * n));
    return { periodMin: 1440 / r[4], a, apo: a * (1 + r[5]) - R_EQ, peri: a * (1 - r[5]) - R_EQ, inc: r[6], e: r[5] };
  };
  const regime = ({ apo, peri, periodMin }) => (Math.abs(periodMin - 1436) < 15 && apo < 37000 && peri > 34500 ? 'GEOSTATIONARY' : apo < 2000 ? 'LOW EARTH ORBIT' : apo < 35000 && peri > 2000 ? 'MEDIUM EARTH ORBIT' : peri < 2000 && apo > 20000 ? 'HIGHLY ELLIPTICAL' : 'HIGH EARTH ORBIT');

  /** Body for the System View. */
  function bodyFor(r) {
    const o = orbitOf(r);
    return { id: `sat-${r[0]}`, norad: r[0], name: r[1], kind: 'satellite', parent: 'earth', locked: true, periodDays: o.periodMin / 1440,
      radiusKm: SAT_SIZE_KM[r[0]] ?? 0.005, satrec: satrecFromRow(r), orbit: { type: 'sgp4' }, category: catOf(r), facts: {} };
  }

  async function show(norad) {
    await load();
    const r = byNorad?.get(Number(norad));
    if (!r) { toast(data ? `SATELLITE ${norad} IS NOT IN THE ACTIVE CATALOGUE` : 'SATELLITE CATALOGUE UNAVAILABLE'); return null; }
    const b = system.addSatellite(bodyFor(r));
    system.focus(b.id);
    render(r);
    fetchSatelliteDetail(r[0]).then((d) => { if (d && live.satNorad === r[0]) fillSatcat(d); });
    return b;
  }

  function render(r) {
    resetLive();
    live.satNorad = r[0];
    live.satId = `sat-${r[0]}`;
    const o = orbitOf(r), cat = catOf(r);
    const tele = h('dl');
    live.alt = row(tele, 'ALTITUDE', '—', 'computed', 'SGP4 from the latest CelesTrak elements.');
    live.speed = row(tele, 'SPEED', '—', 'computed');
    live.ground = row(tele, 'OVER', '—', 'computed', 'Sub-satellite point (geodetic latitude, longitude).');
    live.sun = row(tele, 'SUNLIGHT', '—', 'computed', 'In Earth\'s shadow (cylinder model) or in sunlight.');
    live.age = row(tele, 'ELEMENTS AGE', '—', 'measured', 'Time since the orbit was measured (element set epoch). Accuracy degrades by ~1–3 km a day in low orbit.');
    live.satEpoch = r[3];
    const feeds = SAT_FEEDS[r[0]] ?? [];
    live.satcat = h('dl');
    panel.replaceChildren(
      h('h2', { textContent: r[1] }),
      h('div', { className: 'kind', textContent: `SATELLITE · NORAD ${r[0]} · ${r[13] ?? ''} · ${CATEGORY_LABEL[cat] ?? cat}` }),
      h('h3', { textContent: 'TELEMETRY · COMPUTED' }), tele,
      h('h3', { textContent: 'ORBIT' }),
      factList([
        { label: 'REGIME', value: regime(o), tier: 'computed' },
        { label: 'PERIOD', value: o.periodMin < 200 ? `${o.periodMin.toFixed(1)} MIN` : `${(o.periodMin / 60).toFixed(2)} H`, tier: 'measured', detail: 'From the mean motion in the element set.' },
        { label: 'PERIGEE · APOGEE', value: `${Math.round(o.peri).toLocaleString()} · ${Math.round(o.apo).toLocaleString()} KM`, tier: 'computed', detail: 'Above the equatorial radius.' },
        { label: 'INCLINATION', value: `${o.inc.toFixed(2)}°`, tier: 'measured', detail: o.inc > 96 && o.inc < 100 ? 'Sun-synchronous: it crosses each latitude at the same local time every day.' : '' },
      ]),
      h('h3', { textContent: 'CATALOGUE' }), live.satcat,
      feeds.length ? h('h3', { textContent: 'LIVE FEEDS' }) : null,
      feeds.length ? h('div', { className: 'body-list' }, feeds.map((f) => pill(`${f.label} ▸`, () => openFeed(f, r)))) : h('p', { className: 'note', textContent: 'No public live imagery or telemetry from this spacecraft. Telemetry above is computed from its orbit.' }),
      h('div', { className: 'body-list' },
        pill('◀ EARTH', () => go({ level: 'system', system: 'sol', body: 'earth' })),
        pill('ALL SATELLITES', () => go({ level: 'system', system: 'sol', body: 'earth' }))),
      h('p', { className: 'note', textContent: 'Model: a representative spacecraft (IMAGINED), drawn at true size in TRUE scale where the size is known.' }),
      renderLegend(),
    );
    if (feeds[0] && feeds[0].kind !== 'video') openFeed(feeds[0], r);
  }

  function fillSatcat(d) {
    const typ = { PAY: 'PAYLOAD', 'R/B': 'ROCKET BODY', DEB: 'DEBRIS' }[d.OBJECT_TYPE] ?? d.OBJECT_TYPE;
    live.satcat.replaceChildren();
    row(live.satcat, 'OWNER', d.OWNER, 'measured', 'SATCAT owner / operator country code.');
    row(live.satcat, 'LAUNCHED', `${d.LAUNCH_DATE} · ${d.LAUNCH_SITE}`, 'measured');
    row(live.satcat, 'TYPE', typ, 'measured');
    if (d.RCS != null) row(live.satcat, 'RADAR SIZE', `${d.RCS.toFixed(2)} M²`, 'measured', 'Radar cross-section: how big it looks to tracking radar.');
  }

  /** Called by the shell's ticker. */
  function tick() {
    if (!live.satId) return;
    const st = system.satelliteState(live.satId);
    if (!st) { if (live.alt) live.alt.textContent = 'NO SOLUTION (DECAYED?)'; return; }
    const jd = clock.jd;
    const g = subPoint(st.position, jd);
    const v = Math.hypot(st.velocity.x, st.velocity.y, st.velocity.z);
    live.alt.textContent = `${Math.round(g.altKm).toLocaleString()} KM`;
    live.speed.textContent = `${v.toFixed(2)} KM/S · ${Math.round(v * 3600).toLocaleString()} KM/H`;
    live.ground.textContent = `${Math.abs(g.lat).toFixed(2)}°${g.lat >= 0 ? 'N' : 'S'} ${Math.abs(g.lon).toFixed(2)}°${g.lon >= 0 ? 'E' : 'W'}`;
    // shadow: behind Earth (relative to the Sun) and within Earth's radius of the Sun–Earth line
    const r = temeToEcliptic(st.position, precessionToJ2000(jd));
    const e = system.positionOf('earth'); // scene axes
    const s = [-e[0], e[2], -e[1]]; // Earth→Sun in ecliptic (scene (x, z, −y) → ecliptic (x, −z, y))
    const sl = Math.hypot(...s), sd = [s[0] / sl, s[1] / sl, s[2] / sl];
    const along = r[0] * sd[0] + r[1] * sd[1] + r[2] * sd[2];
    const perp = Math.hypot(r[0] - along * sd[0], r[1] - along * sd[1], r[2] - along * sd[2]);
    live.sun.textContent = along < 0 && perp < R_MEAN ? 'IN EARTH\'S SHADOW' : 'SUNLIT';
    const ageH = ((jd - 2440587.5) * 86400000 - live.satEpoch) / 3600000;
    live.age.textContent = ageH < 48 ? `${ageH.toFixed(1)} H` : `${(ageH / 24).toFixed(1)} DAYS`;
  }

  // ---- feed viewer ------------------------------------------------------------------------
  const viewer = () => $('feed-viewer');
  const age = (iso) => {
    if (!iso) return '';
    const m = (Date.now() - Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)) / 60000;
    return m < 90 ? `${Math.round(m)} MIN AGO` : m < 2880 ? `${(m / 60).toFixed(1)} H AGO` : `${(m / 1440).toFixed(1)} DAYS AGO`;
  };
  function frame(title, sub, body, credit, tier = 'measured') {
    const v = viewer();
    v.hidden = false;
    v.replaceChildren(
      h('div', { className: 'fv-head' }, h('span', { className: 'fv-title', textContent: title }), h('span', { className: 'fv-sub', textContent: sub }), badge(tier, credit),
        pill('✕', () => { v.hidden = true; v.replaceChildren(); }, 'square')),
      h('div', { className: 'fv-body' }, body),
      h('div', { className: 'fv-credit', textContent: credit }));
  }

  async function openFeed(f, r) {
    const name = r[1];
    if (f.kind === 'video') {
      frame(`${name} · ${f.label}`, 'LIVE', h('div', {}, h('iframe', { src: f.url, allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true, className: 'fv-video', title: f.label }),
        h('a', { href: f.link, target: '_blank', rel: 'noopener', className: 'fv-link', textContent: 'OPEN NASA LIVE ↗' })), f.credit);
      return;
    }
    frame(`${name} · ${f.label}`, 'LOADING…', h('p', { className: 'note', textContent: 'Contacting the spacecraft\'s data service…' }), '');
    try {
      if (f.kind === 'image') {
        const img = await fetchFeed(f.id, 'image');
        if (!img) throw new Error('live feeds need the local backend (npm start)');
        frame(`${name} · ${f.label}`, `${img.time ? img.time.slice(0, 16).replace('T', ' ') + ' UTC · ' + age(img.time) : ''}`, h('img', { src: img.url, className: 'fv-img', alt: f.label }), img.credit);
      } else if (f.kind === 'crew') {
        const j = await fetchFeed(f.id, 'json');
        const people = (j.data.people ?? []).filter((p) => (f.craft === 'ISS' ? p.iss : !p.iss));
        frame(`${name} · ${f.label}`, `${people.length} ABOARD${f.craft === 'ISS' && j.data.expedition ? ` · EXPEDITION ${j.data.expedition}` : ''}`,
          h('div', { className: 'fv-crew' }, people.map((p) => h('div', { className: 'fv-person' }, h('b', { textContent: p.name.toUpperCase() }), h('span', { textContent: [p.position, p.agency, p.spacecraft].filter(Boolean).join(' · ').toUpperCase() })))),
          j.credit);
      } else if (f.kind === 'xray') {
        const j = await fetchFeed(f.id, 'json');
        const pts = j.data.map((x) => ({ t: new Date(x.time_tag), v: x.flux }));
        frame('SUN · X-RAY FLUX', `GOES 0.1–0.8 nm · ${age(j.time)}`, h('div', {},
          lineChart(pts, { unit: 'W/m²', log: true, bands: [[1e-6, 'C'], [1e-5, 'M'], [1e-4, 'X']], format: (v) => v.toExponential(1), title: 'Solar X-ray flux' }),
          h('p', { className: 'note', textContent: 'Flare classes: each letter is ten times stronger. M and X flares can cause radio blackouts on Earth\'s day side.' })), j.credit);
      }
    } catch (err) {
      frame(`${name} · ${f.label}`, 'UNAVAILABLE', h('p', { className: 'warn', textContent: String(err.message || err) }), '', 'imagined');
    }
  }

  /** Solar-wind panel (DSCOVR/ACE at L1), used by the satellite search section. */
  async function openSolarWind() {
    frame('SOLAR WIND AT L1', 'LOADING…', h('p', { className: 'note', textContent: '…' }), '');
    try {
      const j = await fetchFeed('solar-wind', 'json');
      const pts = j.data.map((x) => ({ t: new Date(`${x.time_tag}Z`), v: x.proton_speed }));
      frame('SOLAR WIND AT L1', `DSCOVR / ACE · ${age(j.time)}`, h('div', {},
        lineChart(pts, { unit: 'km/s', title: 'Solar wind speed', format: (v) => v.toFixed(0) }),
        h('p', { className: 'note', textContent: 'Measured 1.5 million km sunward: what reaches Earth in about an hour. Above ~600 km/s, auroras are likely.' })), j.credit);
    } catch (err) { frame('SOLAR WIND AT L1', 'UNAVAILABLE', h('p', { className: 'warn', textContent: String(err.message || err) }), '', 'imagined'); }
  }

  // ---- search section for the System panel ---------------------------------------------------
  function searchSection() {
    const box = h('div', { className: 'sat-search' });
    const input = h('input', { type: 'search', placeholder: 'SEARCH NAME OR NORAD ID', className: 'sat-input' });
    const results = h('div', { className: 'host-list' });
    const counts = h('div', { className: 'body-list sat-cats' });
    const run = () => {
      if (!data) return;
      const q = input.value.trim().toUpperCase();
      results.replaceChildren();
      if (!q) return;
      const hits = data.rows.filter((r) => r[1].toUpperCase().includes(q) || String(r[0]) === q).slice(0, 40);
      for (const r of hits) {
        const b = h('button', { className: 'host-row' }, h('span', { textContent: r[1] }), h('span', { className: 'mono', textContent: `${r[0]} · ${CATEGORY_LABEL[catOf(r)] ?? ''}` }));
        b.addEventListener('click', () => go({ level: 'satellite', system: 'sol', body: String(r[0]) }));
        results.append(b);
      }
      if (!hits.length) results.append(h('p', { className: 'note', textContent: 'NO MATCH IN THE ACTIVE CATALOGUE' }));
    };
    input.addEventListener('input', run);
    load().then((d) => {
      if (!d) { counts.replaceChildren(h('p', { className: 'note', textContent: 'Satellite catalogue unavailable (needs the local backend).' })); return; }
      const n = {};
      for (const r of d.rows) n[catOf(r)] = (n[catOf(r)] ?? 0) + 1;
      counts.replaceChildren(...d.categories.filter((c) => n[c]).map((c) => {
        const b = pill(`${CATEGORY_LABEL[c]} · ${n[c].toLocaleString()}`, () => { b.classList.toggle('off'); system.showSatelliteCategory?.(c, !b.classList.contains('off')); });
        b.style.setProperty('--dot', `#${SAT_COLORS[c].toString(16).padStart(6, '0')}`);
        b.classList.add('cat');
        return b;
      }));
    });
    box.append(
      h('div', { className: 'body-list' }, FEATURED.map(([id, label]) => pill(label, () => go({ level: 'satellite', system: 'sol', body: String(id) }))), pill('SOLAR WIND ▸', openSolarWind)),
      input, results, counts,
      h('p', { className: 'note', textContent: 'Every active satellite from CelesTrak (US Space Force tracking), positioned with SGP4. Tap a category to hide it.' }));
    return box;
  }

  return { show, tick, searchSection, load, closeViewer: () => { const v = viewer(); if (v) { v.hidden = true; v.replaceChildren(); } } };
}
