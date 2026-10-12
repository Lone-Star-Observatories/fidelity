// HELM panel sections (#42): SET COURSE and HONEST TRAVEL in every System View body panel, and the
// helm's status, SHIP'S LOG and WARP TO A STAR in the system panel. Honest travel compares a trip at
// the speed of light, by real propulsion (chemical, ion, nuclear pulse, Starshot; COMPUTED from the
// stated speeds in src/astro/warp.js) and at relativistic impulse (ship time vs Earth time, COMPUTED)
// with warp (IMAGINED: warp drive is fiction).

import { honestTrip, burnCoastBurn, fmtDuration, fmtDistance, fmtSpeed, warpToC, autoCruise, C_KM_S, LY_KM, FULL_IMPULSE_C } from '../astro/warp.js';
import { eqToEcl, frameToScene, LY_PER_PC } from '../astro/frames.js';

const STRAIGHT = 'Straight line at constant speed, from the ship\'s position now (bodies keep moving).';

export function createHelmPanel({ h, pill, row, system, go, toast, fetchNearby, currentSystem }) {
  let live = null; // { kind: 'body' | 'system', id, els… } for the open panel's section
  const helm = () => system.helm;

  /** Where honest-travel distances are measured from: the ship at the helm, else Earth (Sol) or the system's star. */
  function originLabel() {
    const m = system.model;
    if (helm()?.active) return 'FROM THE SHIP';
    return m?.isSol ? 'FROM EARTH' : `FROM ${(m?.bodies.find((b) => b.id === m.starId)?.name ?? 'THE STAR').toUpperCase()}`;
  }
  function distanceKm(id) {
    const m = system.model;
    if (!m) return null;
    if (helm()?.active) return helm().distanceKm(id);
    const from = m.isSol ? 'earth' : m.starId;
    if (from === id) return null;
    const a = system.positionOf(id), b = system.positionOf(from);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1.495978707e8;
  }

  /** The honest-travel rows for a distance: dd elements updated by `fill`. */
  function honestCard() {
    const dl = h('dl');
    const els = {
      dist: row(dl, 'DISTANCE', '—', 'computed', `${STRAIGHT} At the helm the scale is TRUE.`),
      light: row(dl, 'AT LIGHT SPEED', '—', 'computed', 'The speed of light, 299,792.458 km/s: the limit for anything with mass, and how long a radio message takes.'),
    };
    const trip0 = honestTrip(1);
    for (const r of trip0.rows.slice(1)) els[r.id] = row(dl, `${r.label} · ${r.kmS > 1000 ? `${+(r.kmS / C_KM_S * 100).toFixed(1)}% c` : `${r.kmS} KM/S`}`, '—', r.tier, `${r.detail}\n${STRAIGHT}`);
    els.impulse = row(dl, 'FULL IMPULSE · 0.25 c', '—', 'computed', 'Earth time and ship time at a constant quarter of light speed: the ship is fiction, the time dilation is real special relativity (γ = 1.0328, the crew ages 3% less). Acceleration not included.');
    els.rocket = row(dl, '1 G BURN · 0.25 c COAST · 1 G BRAKE', '—', 'computed', 'A relativistic rocket accelerating at a comfortable 1 g to 0.25 c (or to the midpoint if the trip is shorter), coasting, then braking at 1 g: Earth time and ship (proper) time.');
    els.warp = row(dl, 'WARP', '—', 'imagined', 'Warp drive is fiction (TNG scale: v = w^10/3 c to warp 9, the Technical Manual\'s figures above). No known physics allows it.');
    return { dl, els };
  }
  function fill(els, km, cruiseWarp) {
    if (!(km > 0)) { for (const k in els) els[k].textContent = '—'; return; }
    const t = honestTrip(km, { warp: cruiseWarp });
    els.dist.textContent = fmtDistance(km);
    for (const r of t.rows) {
      const dd = els[r.id === 'light' ? 'light' : r.id];
      if (!dd) continue;
      dd.textContent = r.id === 'starshot' ? `${fmtDuration(r.earthS)} · SHIP ${fmtDuration(r.shipS)}` : fmtDuration(r.earthS);
    }
    els.impulse.textContent = `EARTH ${fmtDuration(t.impulse.earthS)} · SHIP ${fmtDuration(t.impulse.shipS)}`;
    const rk = burnCoastBurn(km, FULL_IMPULSE_C);
    els.rocket.textContent = `EARTH ${fmtDuration(rk.earthS)} · SHIP ${fmtDuration(rk.shipS)}${rk.peakBeta < FULL_IMPULSE_C ? ` · PEAK ${fmtSpeed(rk.peakBeta * C_KM_S)}` : ''}`;
    els.warp.previousSibling.textContent = `WARP ${cruiseWarp.toFixed(1)} · ${Math.round(warpToC(cruiseWarp)).toLocaleString('en-US')} c`;
    els.warp.textContent = fmtDuration(t.warp.earthS);
  }
  /** The warp factor quoted for a trip: the helm's cruise choice, or AUTO's pick (at least warp 1). */
  function quoteWarp(km) {
    const c = helm()?.state.cruise;
    if (typeof c === 'number') return c;
    return Math.max(1, autoCruise(km).warp || 1);
  }

  /** Body panel: SET COURSE and HONEST TRAVEL for body `b`. */
  function section(b) {
    if (b.marker) return [];
    const at = helm()?.active, st = helm()?.state;
    const here = st?.hold?.id === b.id;
    const card = honestCard();
    live = { kind: 'body', id: b.id, card, note: h('p', { className: 'note' }) };
    const out = [
      h('h3', { textContent: at ? 'HELM' : 'FLY THERE' }),
      h('div', { className: 'body-list' },
        pill(here ? `HOLDING AT ${b.name.toUpperCase()}` : `SET COURSE · ${b.name.toUpperCase()} ▸`, () => { helm().setCourse(b.id); }, here ? 'on' : ''),
        at ? pill('FULL STOP', () => helm().fullStop(), 'square') : pill('TAKE THE HELM HERE', () => helm().engage({ near: b.id })),
        at ? pill('LEAVE HELM', () => helm().disengage()) : null),
      h('h3', { textContent: `HONEST TRAVEL · ${originLabel()}` }),
      card.dl,
      live.note,
    ];
    tick(true);
    return out;
  }

  /** System panel: the helm's status, the ship's log and WARP TO A STAR. */
  function systemSection(m) {
    const at = helm()?.active;
    const status = h('p', { className: 'note' });
    const logBox = h('div', { className: 'host-list helm-log' });
    const card = honestCard();
    const starBox = h('div', { className: 'body-list' });
    const starNote = h('p', { className: 'note', textContent: 'Loading nearby stars…' });
    live = { kind: 'system', status, logBox, card, starCard: h('div'), starNote };
    live.starCard.append(h('h3', { textContent: 'HONEST TRAVEL · TO THE STAR' }), card.dl);
    live.starCard.hidden = true;
    const out = [
      h('h3', { textContent: 'HELM · USS FIDELITY' }),
      h('div', { className: 'body-list' },
        at ? pill('LEAVE HELM', () => helm().disengage()) : pill('TAKE THE HELM ▸', () => helm().engage({ near: system.focusId })),
        at ? pill('FULL STOP', () => helm().fullStop(), 'square') : null),
      status,
      h('p', { className: 'note', textContent: 'Fly the ship yourself (W/S throttle, A/D and arrows to steer, Q/E roll, X full stop) or pick a body and SET COURSE: the autopilot drops out a few radii away and holds orbit. The scale is TRUE at the helm. The ship and warp are IMAGINED; distances, speeds and relativity are COMPUTED.' }),
      h('h3', { textContent: 'WARP TO A STAR' }),
      starBox, starNote, live.starCard,
      h('h3', { textContent: 'SHIP\'S LOG' }),
      logBox,
    ];
    const box = live;
    fetchNearby(currentSystem(), 25).then((d) => {
      if (live !== box) return;
      const c = d.center ?? d.stars.find((s) => s.id === currentSystem());
      const list = d.stars.filter((s) => s.id !== currentSystem() && s.x != null)
        .map((s) => ({ ...s, distLy: Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) * LY_PER_PC }))
        .filter((s) => s.distLy > 0).sort((a, b) => a.distLy - b.distLy).slice(0, 14);
      starBox.replaceChildren(...list.map((s) => pill(`${s.name.toUpperCase()} · ${s.distLy.toFixed(2)} LY${s.planets ? ' ◉' : ''}`, () => warpTo(s, c))));
      starNote.textContent = `The ${list.length} nearest catalogued stars (HYG; ◉ known planets). The helm goes to warp 9.9 towards the star and drops out at the edge of its system.`;
    }).catch(() => { if (live === box) starNote.textContent = 'Nearby stars need the local backend (npm start).'; });
    tick(true);
    return out;
  }
  /** Warp to star `s` from the current system's star `c` (catalogue positions, J2000 equatorial parsecs). */
  function warpTo(s, c) {
    const d = [s.x - c.x, s.y - c.y, s.z - c.z], n = Math.hypot(...d);
    const dir = frameToScene(eqToEcl(d.map((v) => v / n)));
    helm().warpOut({ id: s.id, name: s.name, distLy: s.distLy }, dir);
  }

  let tT = 0;
  /** Refresh the open section (called from main.js's 200 ms loop and on helm changes). */
  function tick(force = false) {
    if (!live) return;
    const now = performance.now();
    if (!force && now - tT < 900) return;
    tT = now;
    const H = helm(), st = H?.state;
    if (live.kind === 'body') {
      if (!live.card.dl.isConnected && !force) { live = null; return; }
      const km = distanceKm(live.id);
      fill(live.card.els, km, quoteWarp(km ?? 0));
      live.note.textContent = st?.active && st.course?.id === live.id
        ? `AUTOPILOT ENGAGED · ${st.course.phase === 'turn' ? 'COMING ABOUT' : `${fmtDistance(st.course.distKm ?? km)} TO GO · ETA ${st.course.etaS != null ? fmtDuration(st.course.etaS) : '—'}`}`
        : 'Real missions do not fly straight: they follow transfer orbits and must brake at the end (see LAUNCH WINDOWS). These times compare how fast each kind of propulsion is.';
    } else {
      if (!live.logBox.isConnected && !force) { live = null; return; }
      live.status.textContent = st?.active
        ? `AT THE HELM · ${fmtSpeed(st.kmS)}${st.hold ? ` · ${st.hold.kind === 'orbit' ? 'STANDARD ORBIT' : 'STATION-KEEPING'}` : ''}${st.course ? ` · COURSE ${st.course.label}` : ''} · ${st.model === 'physics' ? 'REAL PHYSICS' : 'IMPULSE / WARP'}`
        : 'The helm is free. Take it to fly the USS Fidelity from here.';
      const star = st?.course?.star;
      live.starCard.hidden = !star;
      if (star) fill(live.card.els, star.distLy * LY_KM, 9.9);
      const L = st?.log ?? [];
      const summary = h('div', { className: 'host-row' }, h('span', { textContent: 'DISTANCE TRAVELLED' }), h('span', { className: 'mono', textContent: fmtDistance(st?.travelledKm ?? 0) }));
      const clocks = h('div', { className: 'host-row' }, h('span', { textContent: 'SHIP TIME · EARTH TIME' }),
        h('span', { className: 'mono', textContent: st ? `${fmtDuration(st.shipS)} · ${fmtDuration(st.earthS)}` : '—' }));
      const places = h('div', { className: 'host-row' }, h('span', { textContent: 'PLACES VISITED' }), h('span', { className: 'mono', textContent: String(st?.visited.length ?? 0) }));
      live.logBox.replaceChildren(summary, clocks, places, ...L.slice(-14).reverse().map((e) =>
        h('div', { className: 'host-row event-row' }, h('span', { textContent: e.text }), h('span', { className: 'mono', textContent: `${e.at.toISOString().slice(11, 19)} UTC` }))));
    }
  }
  return { section, systemSection, tick, refresh: () => tick(true) };
}
