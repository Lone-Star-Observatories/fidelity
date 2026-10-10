import { modelFor } from '../data/models.js';
// Satellite View: find any active satellite, fly to it, read its computed telemetry, and open
// whatever live feed it has (images, video, crew, solar data). Depends on the shell's helpers.

import { satrecFromRow, precessionToJ2000, temeToEcliptic, subPoint } from '../astro/sgp4.js';
import { fetchSatellites, fetchSatelliteDetail, fetchFeed, fetchObserving } from '../data/catalog.js';
import { SAT_FEEDS, FEATURED, SAT_SIZE_KM, CATEGORY_LABEL, hasFeed, youtubeEmbed, youtubeWatch } from '../data/feeds.js';
import { SAT_COLORS } from '../views/system/satellites.js';
import { lineChart } from './charts.js';

const MU = 398600.4418, R_EQ = 6378.137, R_MEAN = 6371;
const STALE_DAYS = 7; // older element sets are flagged: SGP4 error grows ~1–3 km a day in low orbit
const LIVE_DOT = '● LIVE FEED';

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
    fetchSatelliteDetail(r[0]).then((d) => {
      if (live.satNorad !== r[0]) return;
      if (d) fillSatcat(d);
      else live.satMission?.replaceChildren(h('p', { className: 'note', textContent: 'Catalogue and mission detail for this satellite need the local backend (npm start); this preview carries them for the featured and live-feed satellites only.' }));
    });
    return b;
  }

  function render(r) {
    resetLive();
    live.satNorad = r[0];
    live.satId = `sat-${r[0]}`;
    const o = orbitOf(r), cat = catOf(r), asset = modelFor(`sat-${r[0]}`);
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
      h('div', { className: 'kind', textContent: `SATELLITE · NORAD ${r[0]} · ${r[13] ?? ''} · ${CATEGORY_LABEL[cat] ?? cat}${feeds.length ? ` · ${LIVE_DOT}` : ' · NO PUBLIC FEED'}` }),
      h('h3', { textContent: 'TELEMETRY · COMPUTED' }), tele,
      h('h3', { textContent: 'ORBIT' }),
      factList([
        { label: 'REGIME', value: regime(o), tier: 'computed' },
        { label: 'PERIOD', value: o.periodMin < 200 ? `${o.periodMin.toFixed(1)} MIN` : `${(o.periodMin / 60).toFixed(2)} H`, tier: 'measured', detail: 'From the mean motion in the element set.' },
        { label: 'PERIGEE · APOGEE', value: `${Math.round(o.peri).toLocaleString()} · ${Math.round(o.apo).toLocaleString()} KM`, tier: 'computed', detail: 'Above the equatorial radius.' },
        { label: 'INCLINATION', value: `${o.inc.toFixed(2)}°`, tier: 'measured', detail: o.inc > 96 && o.inc < 100 ? 'Sun-synchronous: it crosses each latitude at the same local time every day.' : '' },
      ]),
      h('h3', { textContent: 'CATALOGUE' }), live.satcat,
      h('h3', { textContent: feeds.length ? 'LIVE FEEDS' : 'LIVE FEEDS · NONE PUBLIC' }),
      feeds.length ? h('div', { className: 'body-list' }, feeds.map((f) => pill(`${f.label} ▸`, () => openFeed(f, r)))) : h('p', { className: 'note', textContent: 'No public live imagery or telemetry from this spacecraft. Telemetry above is computed from its orbit.' }),
      live.satMission = h('div'),
      h('div', { className: 'body-list' },
        pill('◀ EARTH', () => go({ level: 'system', system: 'sol', body: 'earth' })),
        pill('ALL SATELLITES', () => go({ level: 'system', system: 'sol', body: 'earth' }))),
      h('p', { className: 'note', textContent: asset ? `Model: ${asset.credit} (MODELLED). Published visualization loaded on focus; representative IMAGINED fallback while loading, or on failure. Offline previews embed compact mission geometry. Catalog size, illustrative attitude and inspection lighting.` : 'Model: a representative spacecraft (IMAGINED), drawn at catalog size in TRUE scale where the size is known.' }),
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
    fillUcs(d.UCS, d.LAUNCH_DATE);
  }

  /** The UCS Satellite Database record: what the satellite is for, who runs and built it. */
  function fillUcs(u, launchDate) {
    const box = live.satMission;
    if (!box) return;
    if (!u) {
      box.replaceChildren(h('h3', { textContent: 'MISSION' }), h('p', { className: 'note', textContent: 'No UCS Satellite Database record: launched after its last edition (1 May 2023), or not listed there.' }));
      return;
    }
    const dl = h('dl'), src = `UCS Satellite Database, ${u.edition} edition.`;
    if (u.operator) row(dl, 'OPERATOR', `${u.operator}${u.country ? ` · ${u.country}` : ''}`, 'measured', src);
    if (u.users) row(dl, 'USERS', u.users, 'measured', src);
    if (u.purpose) row(dl, 'PURPOSE', [u.purpose, u.detail].filter(Boolean).join(' · '), 'measured', src);
    if (u.contractor) row(dl, 'BUILT BY', `${u.contractor}${u.contractorCountry ? ` · ${u.contractorCountry}` : ''}`, 'measured', src);
    const mass = [u.launchMassKg != null ? `${u.launchMassKg.toLocaleString()} KG AT LAUNCH` : null, u.dryMassKg != null ? `${u.dryMassKg.toLocaleString()} KG DRY` : null].filter(Boolean).join(' · ');
    if (mass) row(dl, 'MASS', mass, 'measured', src);
    if (u.powerW != null) row(dl, 'POWER', `${u.powerW.toLocaleString()} W`, 'measured', `${src} Beginning-of-life electrical power.`);
    if (u.lifetimeYears != null) {
      const launched = Date.parse(launchDate || u.launched || '');
      const age = Number.isFinite(launched) ? (Date.now() - launched) / (365.25 * 86400000) : null;
      const past = age != null && age > u.lifetimeYears;
      row(dl, 'DESIGN LIFE', `${u.lifetimeYears} YR${age != null ? ` · ${age.toFixed(1)} YR IN ORBIT${past ? ' (EXTENDED)' : ''}` : ''}`, 'measured', `${src}${past ? ' Still operating beyond its expected lifetime.' : ''}`);
    }
    if (u.vehicle || u.site) row(dl, 'LAUNCH', [u.vehicle, u.site].filter(Boolean).join(' · '), 'measured', src);
    if (u.orbitType) row(dl, 'ORBIT (UCS)', [u.orbitClass, u.orbitType, u.geoLonDeg ? `${u.geoLonDeg}° LONGITUDE` : null].filter(Boolean).join(' · '), 'measured', `${src} Class and type as catalogued.`);
    box.replaceChildren(...[
      h('h3', { textContent: 'MISSION' }), dl,
      u.comments ? h('p', { className: 'note', textContent: u.comments }) : null,
      u.links?.length ? h('div', { className: 'body-list' }, u.links.map((url) => h('a', { className: 'pill', href: url, target: '_blank', rel: 'noopener', textContent: `${new URL(url).hostname.replace(/^www\./, '').toUpperCase()} ↗` }))) : null,
      h('p', { className: 'note', textContent: 'Mission detail: UCS Satellite Database (Union of Concerned Scientists), joined to SATCAT by NORAD number.' })].filter(Boolean));
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
    const stale = ageH / 24 > STALE_DAYS;
    live.age.textContent = `${ageH < 48 ? `${ageH.toFixed(1)} H` : `${(ageH / 24).toFixed(1)} DAYS`}${stale ? ' · STALE' : ''}`;
    live.age.classList.toggle('warn', stale);
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
      const show = (st) => frame(`${name} · ${f.label}`, `LIVE · ${st.label}`, h('div', {},
        h('iframe', { src: youtubeEmbed(st.id), allow: 'autoplay; encrypted-media; picture-in-picture', allowFullscreen: true, className: 'fv-video', title: `${f.label} · ${st.label}` }),
        h('div', { className: 'body-list' }, f.streams.map((s) => pill(s === st ? `● ${s.label}` : s.label, () => show(s)))),
        h('a', { href: youtubeWatch(st.id), target: '_blank', rel: 'noopener', className: 'fv-link', textContent: 'OPEN ON YOUTUBE ↗' })), st.credit);
      show(f.streams[0]);
      return;
    }
    frame(`${name} · ${f.label}`, 'LOADING…', h('p', { className: 'note', textContent: 'Contacting the spacecraft\'s data service…' }), '');
    try {
      if (f.kind === 'image') {
        const img = await fetchFeed(f.id, 'image');
        if (!img) throw new Error('live feeds need the local backend (npm start)');
        frame(`${name} · ${f.label}`, `${img.time ? img.time.slice(0, 16).replace('T', ' ') + ' UTC · ' + age(img.time) : ''}`, h('img', { src: img.url, className: 'fv-img', alt: f.label }), img.credit);
      } else if (f.kind === 'observing') {
        const o = await fetchObserving(f.mission);
        if (!o) throw new Error('needs the local backend (npm start)');
        frame(`${name} · ${f.label}`, f.mission === 'jwst' ? 'SCHEDULE · RECENT IMAGES' : 'RECENT IMAGES', observingBody(f.mission, o), o.recent?.source ?? '');
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

  // ---- space telescopes: what it is pointed at, and its newest public images ------------------
  const utc = (iso) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;
  const hm = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} H ${Math.round((s % 3600) / 60)} MIN` : `${Math.round(s / 60)} MIN`);
  function observingBody(mission, { schedule, recent }) {
    const parts = [];
    if (mission === 'jwst' && schedule) {
      const n = schedule.now;
      if (n) {
        const end = Date.parse(n.start) + n.durationSec * 1000, left = Math.max(0, (end - Date.now()) / 1000);
        const pct = Math.min(100, Math.max(0, 100 * (1 - left / n.durationSec)));
        parts.push(h('div', { className: 'obs-now' },
          h('div', { className: 'obs-tag' }, 'POINTED AT NOW ', badge('planned', 'From STScI\'s published weekly schedule: the plan, which can shift if a visit fails or is rescheduled.')),
          h('div', { className: 'obs-target', textContent: n.target }),
          h('div', { className: 'obs-meta', textContent: [n.instrument, n.category, n.keywords].filter(Boolean).join(' · ').toUpperCase() }),
          h('div', { className: 'obs-bar' }, h('span', { style: `width:${pct.toFixed(1)}%` })),
          h('div', { className: 'obs-meta', textContent: `STARTED ${utc(n.start)} · ${hm(left)} LEFT${n.parallels?.length ? ` · PARALLEL: ${n.parallels.map((p) => p.instrument).join(', ').toUpperCase()}` : ''}` })));
      } else parts.push(h('p', { className: 'note', textContent: 'Between science visits now (slewing, calibrating or momentum management).' }));
      if (schedule.next?.length) parts.push(h('div', { className: 'obs-list' }, h('div', { className: 'obs-tag', textContent: 'UP NEXT' }),
        ...schedule.next.slice(0, 6).map((v) => h('div', { className: 'obs-row' }, h('span', { className: 'mono', textContent: utc(v.start).slice(11) }), h('b', { textContent: v.target || '—' }), h('span', { textContent: v.instrument.toUpperCase() })))));
    }
    if (mission === 'hst') parts.push(h('p', { className: 'note' }, 'Hubble\'s live timeline is not published as open data; ',
      h('a', { href: 'https://spacetelescopelive.org/', target: '_blank', rel: 'noopener', textContent: 'Space Telescope Live ↗' }), ' (STScI) shows what it is observing right now.'));
    const imgs = recent?.images ?? [];
    if (imgs.length) {
      const big = h('div', { className: 'obs-big' });
      const show = (im) => big.replaceChildren(h('img', { src: im.preview, className: 'fv-img', alt: im.target }),
        h('div', { className: 'obs-meta', textContent: `${im.target} · ${im.instrument} · ${im.filters} · OBSERVED ${utc(im.observed)} · ${Math.round(im.exposureSec ?? 0)} S${im.pi ? ` · PI ${im.pi}` : ''}`.toUpperCase() }),
        im.title ? h('div', { className: 'note', textContent: im.title }) : null);
      parts.push(h('div', { className: 'obs-tag' }, 'NEWEST PUBLIC IMAGES ', badge('measured', 'Calibrated MAST previews (single filter, grayscale), newest first, one per target and instrument. Many programmes keep data private for up to a year, so the very latest pointings appear later.')),
        h('div', { className: 'obs-grid' }, imgs.map((im) => { const t = h('button', { className: 'obs-thumb', title: `${im.target} · ${im.instrument} · ${utc(im.observed)}` }, h('img', { src: im.preview, alt: im.target, loading: 'lazy' }), h('span', { textContent: im.target })); t.addEventListener('click', () => show(im)); return t; })), big);
    } else parts.push(h('p', { className: 'note', textContent: 'No recent public images could be loaded.' }));
    return h('div', { className: 'obs' }, parts);
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
        const b = h('button', { className: 'host-row' }, h('span', { textContent: r[1] }), h('span', { className: 'mono', textContent: `${hasFeed(r[0]) ? `${LIVE_DOT} · ` : ''}${r[0]} · ${CATEGORY_LABEL[catOf(r)] ?? ''}` }));
        b.addEventListener('click', () => go({ level: 'satellite', system: 'sol', body: String(r[0]) }));
        results.append(b);
      }
      if (!hits.length) results.append(h('p', { className: 'note', textContent: 'NO MATCH IN THE ACTIVE CATALOGUE' }));
    };
    input.addEventListener('input', run);
    load().then((d) => {
      if (!d) { counts.replaceChildren(h('p', { className: 'note', textContent: 'Satellite catalogue unavailable (needs the local backend).' })); return; }
      const n = {}, liveN = {};
      for (const r of d.rows) { n[catOf(r)] = (n[catOf(r)] ?? 0) + 1; if (hasFeed(r[0])) liveN[catOf(r)] = (liveN[catOf(r)] ?? 0) + 1; }
      counts.replaceChildren(...d.categories.filter((c) => n[c]).map((c) => {
        const b = pill(`${CATEGORY_LABEL[c]} · ${n[c].toLocaleString()}${liveN[c] ? ` · ${liveN[c]} LIVE` : ''}`, () => { b.classList.toggle('off'); system.showSatelliteCategory?.(c, !b.classList.contains('off')); });
        b.style.setProperty('--dot', `#${SAT_COLORS[c].toString(16).padStart(6, '0')}`);
        b.classList.add('cat');
        return b;
      }));
    });
    box.append(
      h('div', { className: 'body-list' }, FEATURED.map(([id, label]) => pill(hasFeed(id) ? `● ${label}` : label, () => go({ level: 'satellite', system: 'sol', body: String(id) }))), pill('SOLAR WIND ▸', openSolarWind)),
      input, results, counts,
      h('p', { className: 'note', textContent: `Every active satellite from CelesTrak (US Space Force tracking), positioned with SGP4; mission detail from the UCS Satellite Database. ● marks the ${Object.keys(SAT_FEEDS).length} with a public live feed. Tap a category to hide it.` }));
    return box;
  }

  // Other panels (surface sites) reuse the viewer: viewFeed(feed, title)
  return { show, tick, searchSection, load, viewFeed: (f, name) => openFeed(f, [null, name]), closeViewer: () => { const v = viewer(); if (v) { v.hidden = true; v.replaceChildren(); } } };
}
