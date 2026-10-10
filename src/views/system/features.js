// Named surface features (IAU nomenclature, USGS Gazetteer): Olympus Mons, Jezero, Tycho, Caloris…
// Labels on a body's globe, fetched from public/features/<id>.json the first time it is focused.
// A feature is labelled once it spans enough pixels on screen, biggest first, near side only, with
// the same greedy de-clutter as the site labels; clicking one opens its card.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { siteDir } from './sites.js';

const R_LABEL = 1.0008, MAX_LABELS = 70, MIN_PX = 26;
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3(), tS = new THREE.Vector3();

export function createFeatureLayer(body, { onFeature, load }) {
  const group = new THREE.Group();
  group.name = 'features';
  let items = null, requested = false;

  function build(data) {
    items = (data?.features ?? []).map(([name, lat, lon, d, type, gid]) => {
      const el = document.createElement('button');
      el.className = 'feature-label';
      el.textContent = name;
      el.title = `${name} · ${type}${d ? ` · ${d.toLocaleString()} km` : ''}`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      const f = { id: `iau-${gid ?? name}`, body: body.id, name, lat, lon, diameterKm: d, type, gazetteerId: gid, source: data.source };
      el.addEventListener('click', (e) => { e.stopPropagation(); onFeature(f); });
      const obj = new CSS2DObject(el);
      obj.position.set(...siteDir(body, lat, lon).map((c) => c * R_LABEL));
      obj.center.set(0.5, 0.5);
      obj.visible = false;
      group.add(obj);
      return { obj, f };
    });
  }

  /** Per frame: `size` is the viewport in px; `blocked` holds screen boxes already used by site labels. */
  function update({ on, focused, surface, camera, size, blocked = [] }) {
    group.visible = !!(on && focused && !surface);
    if (!group.visible) return;
    if (!requested) { requested = true; load(body.id).then(build).catch(() => { items = []; }); }
    if (!items?.length) return;
    group.getWorldPosition(tA);
    group.getWorldScale(tS);
    const focal = size.h / 2 / Math.tan((camera.fov * Math.PI) / 360);
    // site labels are left-anchored boxes; turn them into centred ones for the overlap test
    const placed = blocked.map((r) => ({ x: r.x + r.w / 2, y: r.y, w: r.w }));
    let shown = 0;
    for (const it of items) { // biggest first
      let show = false;
      if (shown < MAX_LABELS && it.f.diameterKm) {
        it.obj.getWorldPosition(tC);
        const toCam = tB.copy(camera.position).sub(tC);
        const dist = toCam.length();
        const facing = tC.clone().sub(tA).normalize().dot(toCam.normalize());
        const px = ((it.f.diameterKm / body.radiusKm) * tS.x / dist) * focal;
        if (facing > 0.15 && px > MIN_PX) {
          tC.project(camera);
          const x = (tC.x + 1) * 0.5 * size.w, y = (1 - tC.y) * 0.5 * size.h, w = it.f.name.length * 6 + 10;
          show = Math.abs(tC.x) < 1.1 && Math.abs(tC.y) < 1.1 && !placed.some((r) => x - w / 2 < r.x + r.w / 2 && x + w / 2 > r.x - r.w / 2 && Math.abs(y - r.y) < 12);
          if (show) { placed.push({ x, y, w }); shown++; }
        }
      }
      it.obj.visible = show; // CSS2DRenderer hides only on === false
    }
  }

  function dispose() { group.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); }); }
  return { group, update, dispose };
}
