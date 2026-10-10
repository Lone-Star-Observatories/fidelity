// Surface sites of note (#37) on a body's globe: one dot layer per kind, labels on the hemisphere
// facing the camera (only the major ones until you zoom in), and rover traverses draped just
// above the surface. The group sits under the body's `tilt`, so it turns and scales with it.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { latLonToDir } from './surface.js';
import { sitesFor, SITE_KINDS } from '../../data/sites.js';

/** Unit direction in the globe's local frame for planetocentric lat / east lon (honours a body's texture offset). */
export const siteDir = (body, lat, lon) => latLonToDir(lat, lon - ((body.texLon0 ?? -180) + 180));

// Just above the faceted globe (a 96-segment sphere dips ≤ 0.054% below radius 1 between vertices),
// so paths sit on the ground when you fly down to a site rather than kilometres up.
const DOT_R = 1.0008, PATH_R = 1.0006;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpS = new THREE.Vector3();

/** Just the dots (Planet / Moon / Object View globes): a group per kind, or null if the body has no sites. */
export function siteDots(body, hidden = new Set()) {
  const list = sitesFor(body.id).filter((s) => !hidden.has(s.kind));
  if (!list.length) return null;
  const group = new THREE.Group();
  const byKind = {};
  for (const s of list) (byKind[s.kind] ??= []).push(...siteDir(body, s.lat, s.lon).map((c) => c * DOT_R));
  for (const [kind, pos] of Object.entries(byKind)) {
    group.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, color: SITE_KINDS[kind].color })));
  }
  return group;
}

export function createSiteLayer(body, { onSite, loadTraverse, loadModel }) {
  const list = sitesFor(body.id);
  if (!list.length) return null;
  const group = new THREE.Group();
  group.name = 'sites';
  const byKind = {};
  for (const s of list) (byKind[s.kind] ??= []).push(s);
  const dots = {};
  for (const [kind, sites] of Object.entries(byKind)) {
    const pos = sites.flatMap((s) => siteDir(body, s.lat, s.lon).map((c) => c * DOT_R));
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dots[kind] = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, color: SITE_KINDS[kind].color }));
    group.add(dots[kind]);
  }
  const labels = list.map((s) => {
    const el = document.createElement('button');
    el.className = `site-label site-${s.kind}`;
    el.textContent = s.short ?? s.name.toUpperCase();
    el.title = `${s.name} · ${SITE_KINDS[s.kind].label}`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); onSite(s); });
    const obj = new CSS2DObject(el);
    obj.position.set(...siteDir(body, s.lat, s.lon).map((c) => c * DOT_R));
    obj.center.set(-0.08, 0.5);
    obj.visible = false;
    obj.userData.site = s;
    group.add(obj);
    return obj;
  });

  // Traverses load the first time the body is focused with sites on.
  const paths = [];
  let pathsRequested = false;
  function requestPaths() {
    pathsRequested = true;
    for (const s of list.filter((x) => x.traverse)) {
      loadTraverse(s.traverse).then((t) => {
        const segs = (t?.paths ?? (t?.points ? [t.points] : [])).filter((p) => p.length > 1);
        if (!segs.length) return;
        const last = segs.at(-1).at(-1);
        // extent of the paths around the site (km), for framing VIEW FROM ABOVE
        const R = body.radiusKm, c = Math.cos(s.lat * Math.PI / 180);
        const spanKm = Math.max(...segs.flat().map(([lon, lat]) => Math.hypot((((lon - s.lon + 540) % 360) - 180) * c, lat - s.lat) * Math.PI / 180 * R));
        s.traverseInfo = { distanceKm: t.distanceKm, sol: t.sol, fetched: t.fetched, credit: t.credit ?? t.source, last, live: !!t.points, spanKm };
        const mat = new THREE.LineBasicMaterial({ color: s.traverseColor ?? SITE_KINDS.rover.color, transparent: true, opacity: 0.95 });
        const line = new THREE.Group();
        line.userData.kind = s.kind;
        for (const seg of segs) {
          const pos = seg.flatMap(([lon, lat]) => siteDir(body, lat, lon).map((c) => c * PATH_R));
          line.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), mat));
        }
        // a live rover's position now: a brighter dot at the end of its path
        if (t.points) line.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(siteDir(body, last[1], last[0]).map((c) => c * PATH_R), 3)),
          new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, color: 0xffffff })));
        group.add(line);
        paths.push(line);
        // a live rover gets its NASA model at the end of its path, hugely enlarged so it can be found
        if (t.points && s.model && loadModel) loadModel(s.model).then((m) => {
          if (!m) return;
          const sizeKm = Math.max(0.4, spanKm * 0.07), up = new THREE.Vector3(...siteDir(body, last[1], last[0]));
          const holder = new THREE.Group();
          holder.position.copy(up).multiplyScalar(PATH_R + sizeKm / R * 0.6);
          holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
          holder.scale.setScalar(sizeKm / R);
          holder.add(m);
          holder.userData.kind = s.kind;
          line.add(holder);
          s.traverseInfo.modelScale = Math.round((sizeKm * 1000) / (s.modelSizeM ?? 3));
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  /**
   * Per frame. `focused`: this body is the camera's focus; `hidden`: set of kinds filtered out;
   * `surface`: standing on this body (dots stay, labels go).
   */
  function update({ on, focused, surface, hidden, camera, size, spin = 0 }) {
    group.rotation.y = spin;
    // From orbit only: dots and paths float a few kilometres up so they read on the globe, which from
    // the ground would put them in the sky.
    group.visible = on && focused && !surface;
    if (!group.visible) return;
    if (!pathsRequested) requestPaths();
    for (const [kind, d] of Object.entries(dots)) d.visible = !hidden.has(kind);
    for (const p of paths) p.visible = !hidden.has(p.userData.kind);
    group.getWorldPosition(tmpA);
    group.getWorldScale(tmpS);
    tmpB.copy(camera.position).sub(tmpA);
    const dist = tmpB.length() / tmpS.x;
    const close = dist < 1.8; // within ~0.8 radii of the surface: every label, otherwise the major ones
    // Near side only (and not right on the limb), majors first, and no two labels overlapping on screen.
    const placed = [];
    const order = labels.slice().sort((a, b) => (b.userData.site.major ? 1 : 0) - (a.userData.site.major ? 1 : 0));
    for (const l of order) {
      const s = l.userData.site;
      let show = !surface && !hidden.has(s.kind) && (close || !!s.major);
      if (show) { l.getWorldPosition(tmpC); show = tmpC.clone().sub(tmpA).normalize().dot(tmpB.clone().normalize()) > 0.2; }
      if (show && size) {
        tmpC.project(camera);
        const x = (tmpC.x + 1) * 0.5 * size.w, y = (1 - tmpC.y) * 0.5 * size.h, w = (l.element.textContent.length * 6.4) + 12;
        show = !placed.some((r) => x < r.x + r.w && x + w > r.x && Math.abs(y - r.y) < 13);
        if (show) placed.push({ x, y, w });
      }
      l.visible = !!show; // CSS2DRenderer hides only on === false
    }
  }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); if (o.isCSS2DObject) o.element.remove(); });
  }
  return { group, update, dispose, sites: list };
}
