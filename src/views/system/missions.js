// Mission activity from the events feed (#32) in the System View: rockets lifting off along their
// modelled ascent, boosters flying back to a landing zone or drone ship, payloads coasting to
// deployment, capsules re-entering to splashdown, visiting vehicles closing on (or leaving) a
// station, and spacewalks. Everything runs on the ship's clock, so a launch replays at any rate.
//
// Tracks are Earth-fixed [tS, lat, lon, altKm] (they stay attached to the turning ground, like an
// eclipse path); approach profiles are station-relative LVLH [tS, radialKm, alongKm, crossKm].
// The paths are MODELLED (src/astro/trajectory.js); the pad, landing zones and times are REPORTED.

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { surfacePoint, fixedToInertial } from '../../astro/eclipses.js';
import { sampleTrack } from '../../astro/trajectory.js';
import { modelSpan } from '../../data/events-schema.js';

const COLORS = { ascent: 0xff9900, flight: 0xff9900, booster: 0x99ccff, reentry: 0xffcc66, relative: 0xcc99cc, site: 0xffcc99 };
const colorFor = (id) => COLORS[id.split('-')[0]] ?? 0xff9900;
const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
/** "T−01:02:03" / "T+02:15" style mission clock. */
export function missionClock(dtS) {
  const s = Math.abs(dtS), sign = dtS < 0 ? '−' : '+';
  return s >= 3600 ? `T${sign}${pad2(s / 3600)}:${pad2((s % 3600) / 60)}:${pad2(s % 60)}` : `T${sign}${pad2(s / 60)}:${pad2(s % 60)}`;
}
/** Name of the last phase reached at mission time `dtS`. */
export const phaseAt = (phases = [], dtS) => phases.filter((p) => p.t <= dtS).sort((a, b) => b.t - a.t)[0]?.name ?? null;

/** Earth-fixed lat/lon/alt → inertial geocentric km (J2000 ecliptic) at UT `jd`. */
function earthPoint(jd, lat, lon, altKm) {
  const s = surfacePoint(lat, lon), r = Math.hypot(...s), k = 1 + altKm / r;
  return fixedToInertial(jd, [s[0] * k, s[1] * k, s[2] * k]);
}

/**
 * deps: { root, fat, map(km[3]) → THREE.Vector3 (root coordinates, current scale),
 *         stationState(norad, jd) → { r: km[3], v: km/s[3] } | null }
 */
export function createMissionLayer({ root, fat, map, stationState }) {
  let events = [];
  const actors = new Map(); // event id → actor
  const group = new THREE.Group();
  root.add(group);

  const line = (color, width, opacity) => {
    const l = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, resolution: fat.resolution }));
    l.frustumCulled = false;
    l.renderOrder = 3;
    group.add(l);
    return l;
  };
  const marker = (color, size = 9) => {
    const p = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
      new THREE.PointsMaterial({ color, size, sizeAttenuation: false, depthWrite: false, transparent: true }));
    p.frustumCulled = false;
    p.renderOrder = 4;
    group.add(p);
    return p;
  };
  const label = (cls = '') => {
    const el = document.createElement('div');
    el.className = `nav-label mission-label ${cls}`;
    const o = new CSS2DObject(el);
    group.add(o);
    return o;
  };
  const setLine = (l, pts) => {
    const seg = [];
    for (let i = 1; i < pts.length; i++) seg.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z);
    l.visible = seg.length > 0;
    if (seg.length) { l.geometry.dispose(); l.geometry = new LineSegmentsGeometry().setPositions(seg); }
  };

  function build(e) {
    const m = e.model, a = { e, tracks: [], parts: [] };
    for (const t of m.tracks ?? []) {
      const c = colorFor(t.id);
      const tr = { t, full: line(c, 1.4, 0.35), done: line(c, 2.6, 0.95), dot: marker(c, t.id.startsWith('booster') ? 7 : 9), tag: label(t.id.split('-')[0]) };
      a.tracks.push(tr);
      a.parts.push(tr.full, tr.done, tr.dot, tr.tag);
    }
    if (m.relative) {
      a.rel = { full: line(COLORS.relative, 1.6, 0.6), dot: marker(COLORS.relative, 8), tag: label('relative') };
      a.parts.push(a.rel.full, a.rel.dot, a.rel.tag);
    }
    if (m.kind === 'eva') { a.eva = { dot: marker(0xffffff, 6), tag: label('eva') }; a.parts.push(a.eva.dot, a.eva.tag); }
    const sites = [];
    if (e.type === 'launch' && e.location?.lat != null) sites.push({ lat: e.location.lat, lon: e.location.lon, name: e.location.name.split(',')[0] });
    const near = (b) => sites.some((s) => Math.hypot(s.lat - b.landing.lat, (s.lon - b.landing.lon) * Math.cos(s.lat * Math.PI / 180)) < 0.3); // one label for pad + RTLS zone
    for (const b of e.vehicle?.boosters ?? []) if (b.landing?.lat != null && !near(b)) sites.push({ lat: b.landing.lat, lon: b.landing.lon, name: `${b.landing.abbrev ?? b.landing.type ?? 'LANDING'}${b.landing.tier === 'modelled' ? ' (POSITION MODELLED)' : ''}` });
    if (e.type === 'landing' && e.location?.lat != null) sites.push({ lat: e.location.lat, lon: e.location.lon, name: 'RECOVERY ZONE (APPROX.)' });
    a.sites = sites.map((s) => { const o = { ...s, dot: marker(COLORS.site, 6), tag: label('site') }; o.tag.element.textContent = s.name.toUpperCase(); a.parts.push(o.dot, o.tag); return o; });
    a.lastBuild = -1;
    return a;
  }
  function drop(a) {
    for (const p of a.parts) {
      group.remove(p);
      p.geometry?.dispose(); p.material?.dispose();
      if (p.element) p.element.remove();
    }
  }

  /** Station-relative LVLH offset → inertial km. */
  function lvlh(st, [, rr, al, cr]) {
    const r = st.r, rl = Math.hypot(...r), R = r.map((c) => c / rl);
    const vr = st.v[0] * R[0] + st.v[1] * R[1] + st.v[2] * R[2];
    const A0 = st.v.map((c, i) => c - vr * R[i]), al0 = Math.hypot(...A0), A = A0.map((c) => c / al0);
    const C = [R[1] * A[2] - R[2] * A[1], R[2] * A[0] - R[0] * A[2], R[0] * A[1] - R[1] * A[0]];
    return [0, 1, 2].map((k) => r[k] + rr * R[k] + al * A[k] + cr * C[k]);
  }

  function updateActor(a, jd, rebuild) {
    const e = a.e, dt = (jd - e.jd) * 86400, m = e.model;
    const clockTxt = missionClock(dt), phase = phaseAt(m.phases, dt);
    for (const tr of a.tracks) {
      const pts = tr.t.points, first = pts[0][0], last = pts.at(-1)[0];
      if (rebuild) {
        setLine(tr.full, pts.map((p) => map(earthPoint(jd, p[1], p[2], p[3])).clone()));
        const done = pts.filter((p) => p[0] <= dt);
        const now = sampleTrack(pts, Math.min(Math.max(dt, first), last));
        setLine(tr.done, [...done, ...(now && dt > first && dt < last ? [now] : [])].map((p) => map(earthPoint(jd, p[1], p[2], p[3])).clone()));
      }
      const at = sampleTrack(pts, Math.min(Math.max(dt, first), last));
      const flying = dt >= first && dt <= last;
      const p = map(earthPoint(jd, at[1], at[2], at[3]));
      tr.dot.position.copy(p);
      tr.tag.position.copy(p);
      tr.dot.visible = dt >= first - 600 && dt <= last + 600;
      const isBooster = tr.t.id.startsWith('booster');
      tr.tag.visible = tr.dot.visible && (flying || (isBooster && dt > last && dt <= last + 600) || (!isBooster && dt < first && e.type === 'launch'));
      if (tr.tag.visible) {
        const who = isBooster ? tr.t.label.replace(/ return to.*/, '').toUpperCase() : (e.vehicle?.rocket ?? e.title).toUpperCase();
        tr.tag.element.textContent = isBooster && dt > last ? `${who} · LANDED` : e.type === 'landing' ? `${(e.title || 'CAPSULE').toUpperCase()} · ${clockTxt} · ${Math.round(at[3])} KM${phase ? ` · ${phase.toUpperCase()}` : ''}`
          : `${who} · ${clockTxt}${flying ? ` · ${Math.round(at[3])} KM` : ''}${!isBooster && phase && flying ? ` · ${phase.toUpperCase()}` : ''}`;
      }
    }
    for (const s of a.sites) {
      const p = map(earthPoint(jd, s.lat, s.lon, 0));
      s.dot.position.copy(p); s.tag.position.copy(p);
      s.tag.visible = true;
    }
    const st = (a.rel || a.eva) && e.target?.norad ? stationState(e.target.norad, jd) : null;
    if (a.rel) {
      const rel = m.relative.points, first = rel[0][0], last = rel.at(-1)[0];
      const ok = !!st && dt >= first - 300 && dt <= last + 900;
      a.rel.full.visible = a.rel.dot.visible = a.rel.tag.visible = ok;
      if (ok) {
        if (rebuild) setLine(a.rel.full, rel.map((q) => map(lvlh(st, q)).clone()));
        const q = sampleTrack(rel, Math.min(Math.max(dt, first), last), -1);
        const p = map(lvlh(st, q));
        a.rel.dot.position.copy(p); a.rel.tag.position.copy(p);
        const km = Math.hypot(q[1], q[2], q[3]);
        const joined = m.kind === 'docking' || m.kind === 'berthing';
        a.rel.tag.element.textContent = `${(e.title ?? '').toUpperCase()} · ${clockTxt} · ${joined && dt >= last ? (m.kind === 'berthing' ? 'BERTHED' : 'DOCKED') : km < 1 ? `${Math.round(km * 1000)} M` : `${km.toFixed(1)} KM`}`;
      }
    }
    if (a.eva) {
      const on = !!st && dt >= 0 && (!e.endJd || jd <= e.endJd);
      a.eva.dot.visible = a.eva.tag.visible = on;
      if (on) {
        const p = map(st.r); a.eva.dot.position.copy(p); a.eva.tag.position.copy(p);
        a.eva.tag.element.textContent = `SPACEWALK · ${missionClock(dt).replace('T+', '')} ELAPSED`;
      }
    }
  }

  let lastRebuild = 0;
  return {
    group,
    /** The feed's events (those with a model are drawn when the clock reaches them). */
    setEvents(list) { events = (list ?? []).filter((e) => e.model); for (const a of actors.values()) drop(a); actors.clear(); },
    /** Per frame. `show` false hides everything (surface view, other systems). */
    update(jd, show = true, now = performance.now()) {
      group.visible = show;
      if (!show) return;
      const live = new Set();
      for (const e of events) {
        const s = modelSpan(e);
        if (s && jd >= s.from && jd <= s.to) live.add(e.id);
      }
      for (const [id, a] of actors) if (!live.has(id)) { drop(a); actors.delete(id); }
      const rebuild = now - lastRebuild > 150;
      if (rebuild) lastRebuild = now;
      for (const id of live) {
        if (!actors.has(id)) actors.set(id, build(events.find((e) => e.id === id)));
        updateActor(actors.get(id), jd, rebuild || actors.get(id).lastBuild < 0);
        actors.get(id).lastBuild = now;
      }
    },
    /** Ids of the events on screen now. */
    get active() { return [...actors.keys()]; },
  };
}
