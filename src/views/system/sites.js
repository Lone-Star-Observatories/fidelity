// Surface sites of note (#37) on a body's globe: one dot layer per kind, labels on the hemisphere
// facing the camera (only the major ones until you zoom in), and rover traverses draped just
// above the surface. The group sits under the body's `tilt`, so it turns and scales with it.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { latLonToDir } from './surface.js';
import { sitesFor, SITE_KINDS } from '../../data/sites.js';

/** Unit direction in the globe's local frame for planetocentric lat / east lon (honours a body's texture offset). */
export const siteDir = (body, lat, lon) => latLonToDir(lat, lon - ((body.texLon0 ?? -180) + 180));

const DOT_R = 1.004, PATH_R = 1.002;
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

export function createSiteLayer(body, { onSite, loadTraverse }) {
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
        if (!t?.points?.length) return;
        s.traverseInfo = { distanceKm: t.distanceKm, sol: t.sol, fetched: t.fetched, credit: t.credit, last: t.points.at(-1) };
        const pos = t.points.flatMap(([lon, lat]) => siteDir(body, lat, lon).map((c) => c * PATH_R));
        const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)),
          new THREE.LineBasicMaterial({ color: SITE_KINDS.rover.color, transparent: true, opacity: 0.95 }));
        line.userData.kind = 'rover';
        // the rover now: a brighter dot at the end of its path
        const now = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(-3), 3)),
          new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, color: 0xffffff }));
        line.add(now);
        group.add(line);
        paths.push(line);
      }).catch(() => {});
    }
  }

  /**
   * Per frame. `focused`: this body is the camera's focus; `hidden`: set of kinds filtered out;
   * `surface`: standing on this body (dots stay, labels go).
   */
  function update({ on, focused, surface, hidden, camera, spin = 0 }) {
    group.rotation.y = spin;
    group.visible = on && (focused || surface);
    if (!group.visible) return;
    if (!pathsRequested) requestPaths();
    for (const [kind, d] of Object.entries(dots)) d.visible = !hidden.has(kind);
    for (const p of paths) p.visible = !hidden.has('rover');
    group.getWorldPosition(tmpA);
    group.getWorldScale(tmpS);
    tmpB.copy(camera.position).sub(tmpA);
    const close = tmpB.length() / tmpS.x < 3.2; // within ~3 radii: every label, otherwise the major ones
    for (const l of labels) {
      const s = l.userData.site;
      let show = !surface && !hidden.has(s.kind) && (close || s.major);
      if (show) { l.getWorldPosition(tmpC).sub(tmpA); show = tmpC.dot(tmpB) > 0; } // near side only
      l.visible = show;
    }
  }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); if (o.isCSS2DObject) o.element.remove(); });
  }
  return { group, update, dispose, sites: list };
}
