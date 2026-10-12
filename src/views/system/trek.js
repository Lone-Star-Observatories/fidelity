// The Star Trek layer in the System View (#41), IMAGINED: stations circling Sol's bodies (Utopia
// Planitia, Earth Spacedock, Jupiter Station …) and, in a real star system that Star Trek gives a
// homeworld (Vulcan at 40 Eridani A …), a dashed ring where that imagined planet would orbit. It never
// touches the real bodies: each piece hangs off a body's position, re-mapped every frame through the
// view's radial compression so it stays outside the enlarged globe.

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { TREK, trekAtStar, trekOrbitAU } from '../../data/trek.js';
import { AU_KM } from '../../data/sol.js';

export const TREK_COLOR = 0xff88aa;
const CIRCLE = Array.from({ length: 161 }, (_, i) => { const a = (i / 160) * Math.PI * 2; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); });
const isStar = (b) => b.starLike || b.kind === 'star';

export function createTrekSystemLayer({ onTrek }) {
  const group = new THREE.Group();
  group.name = 'trek';
  let items = [];

  function label(t, text) {
    const el = document.createElement('button');
    el.className = 'trek-label';
    el.textContent = text;
    el.title = `${t.name} · Star Trek · IMAGINED`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); onTrek?.(t.id); });
    const o = new CSS2DObject(el);
    o.center.set(-0.1, 0.5);
    o.visible = false;
    return o;
  }

  function dispose() {
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); if (o.isCSS2DObject) o.element.remove(); });
    group.clear();
    items = [];
  }

  /** Build the pieces for a system model: Sol's stations, or rings at a real star with a Star Trek world. */
  function load(model) {
    dispose();
    const add = (t, parent, extra) => {
      const holder = new THREE.Group(), tilt = new THREE.Group();
      holder.add(tilt);
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(CIRCLE),
        new THREE.LineDashedMaterial({ color: TREK_COLOR, transparent: true, opacity: 0.75, dashSize: 0.045, gapSize: 0.035, depthWrite: false }));
      ring.computeLineDistances();
      const pip = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)),
        new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, color: TREK_COLOR }));
      const tag = label(t, extra.text);
      tilt.add(ring, pip, tag);
      group.add(holder);
      items.push({ t, parent, holder, tilt, ring, pip, tag, ...extra });
    };
    if (model.isSol) {
      TREK.filter((t) => t.placement.type === 'orbit').forEach((t, i) => add(t, t.placement.body, {
        kind: 'orbit', altKm: t.placement.altKm, phase: (t.placement.phaseDeg * Math.PI) / 180, incl: ((i % 3) * 22 * Math.PI) / 180, lead: ((22 + 60 * i) * Math.PI) / 180,
        text: `◇ ${t.name.toUpperCase()}`,
      }));
    } else {
      for (const b of model.bodies.filter(isStar)) {
        for (const t of trekAtStar(b.id)) add(t, b.id, { kind: 'hz', rAU: trekOrbitAU(b.lum), phase: 0.6, incl: 0, lead: 0.8, text: `◇ ${t.name.toUpperCase()} · IMAGINED ORBIT` });
      }
    }
  }

  const n0 = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), cam = new THREE.Vector3();
  /**
   * Per frame. `nodes`: the view's body nodes (pos, body); `mapRadius(body, au)`: displayed distance of a
   * true offset from that body; `focusId`: Sol stations show around the focused body only.
   */
  function update({ on, nodes, focusId, mapRadius, planeNormal, hideAll, camera }) {
    group.visible = !!on && !hideAll;
    if (!group.visible) { for (const it of items) it.tag.visible = false; return; }
    nv.set(...(planeNormal ?? [0, 1, 0])).normalize();
    for (const it of items) {
      const n = nodes[it.parent];
      const show = !!n && (it.kind === 'hz' || focusId === it.parent);
      it.holder.visible = show;
      it.tag.visible = show; // CSS2DRenderer hides only on === false
      if (!show) continue;
      it.holder.position.copy(n.pos);
      it.holder.quaternion.setFromUnitVectors(n0, nv);
      it.tilt.rotation.set(it.incl, 0, 0);
      const r = it.kind === 'orbit' ? mapRadius(n.body, (n.body.radiusKm + it.altKm) / AU_KM) : it.rAU;
      it.ring.scale.setScalar(r);
      // No real orbit to follow, so the marker sits on the camera's side of its ring, a little round from
      // the line of sight, where it can be seen and read (the ring shows the orbit itself).
      if (camera) {
        it.tilt.updateWorldMatrix(true, false);
        it.tilt.worldToLocal(cam.copy(camera.position));
        if (Math.hypot(cam.x, cam.z) > 1e-12) it.phase = Math.atan2(cam.z, cam.x) + it.lead;
      }
      it.pip.position.set(Math.cos(it.phase) * r, 0, Math.sin(it.phase) * r);
      it.tag.position.copy(it.pip.position);
    }
  }

  return { group, load, update, dispose, get items() { return items; } };
}
