// Thick orbit lines (#27). WebGL ignores LineBasicMaterial.linewidth, so each orbit's thin
// THREE.Line keeps its geometry (and stays the object picking rays hit), and a screen-space
// Line2 twin draws it at a width in pixels. The twin follows the thin line's points, transform,
// colour, opacity and visibility each frame, rewriting its buffer only when the points change.

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export function createFatLines() {
  const twins = new Map(); // thin line → { fat, geo, version, n }
  const resolution = new THREE.Vector2(1, 1);

  function build(t, pos, n) {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = pos.getX(i); arr[i * 3 + 1] = pos.getY(i); arr[i * 3 + 2] = pos.getZ(i); }
    t.fat.geometry.dispose();
    t.fat.geometry = new LineGeometry().setPositions(arr);
    t.n = n;
  }
  function rewrite(t, pos, n) {
    // LineGeometry stores segment pairs [p_i, p_i+1] in one interleaved buffer
    const ib = t.fat.geometry.attributes.instanceStart.data, a = ib.array;
    for (let i = 0; i < n - 1; i++) {
      const o = i * 6;
      a[o] = pos.getX(i); a[o + 1] = pos.getY(i); a[o + 2] = pos.getZ(i);
      a[o + 3] = pos.getX(i + 1); a[o + 4] = pos.getY(i + 1); a[o + 5] = pos.getZ(i + 1);
    }
    ib.needsUpdate = true;
  }

  /** Keep `thin`'s twin in step; `widthPx` is the on-screen width. */
  function sync(thin, widthPx) {
    let t = twins.get(thin);
    if (!t) {
      const fat = new Line2(new LineGeometry(), new LineMaterial({ linewidth: widthPx, transparent: true, depthWrite: false, resolution }));
      fat.frustumCulled = false;
      t = { fat, geo: null, version: -1, n: 0 };
      twins.set(thin, t);
    }
    const { fat } = t;
    if (fat.parent !== thin.parent) thin.parent?.add(fat);
    thin.material.visible = false; // the twin draws it; the thin line stays for picking
    const pos = thin.geometry.attributes.position;
    const n = pos ? Math.min(pos.count, thin.geometry.drawRange.count) : 0;
    fat.visible = thin.visible && n > 1;
    if (!fat.visible) return;
    if (thin.geometry !== t.geo || pos.version !== t.version) {
      if (thin.geometry !== t.geo || n !== t.n) build(t, pos, n); else rewrite(t, pos, n);
      t.geo = thin.geometry; t.version = pos.version;
    }
    fat.position.copy(thin.position); fat.quaternion.copy(thin.quaternion); fat.scale.copy(thin.scale);
    const m = fat.material;
    m.color.copy(thin.material.color); m.opacity = thin.material.opacity; m.linewidth = widthPx;
  }

  /** Forget lines that are gone (a new system was loaded). */
  function prune(alive) {
    for (const [thin, t] of twins) {
      if (alive.has(thin)) continue;
      t.fat.removeFromParent(); t.fat.geometry.dispose(); t.fat.material.dispose();
      twins.delete(thin);
    }
  }
  return { sync, prune, resolution, setSize: (w, h) => resolution.set(w, h) };
}
