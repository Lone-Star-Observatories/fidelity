// Screen-space picking for point clouds (#23): the point nearest the cursor within `maxPx`.
import * as THREE from 'three';

const v = new THREE.Vector3();
/**
 * @param positions Float32Array (xyz…) in the object's local frame, or a function i → Vector3 (world)
 * @param count number of points
 * @param object the Points (for its world matrix), or null when `positions` returns world coordinates
 * @returns { index, px } or null
 */
export function pickPoint(positions, count, object, camera, rect, clientX, clientY, maxPx = 10) {
  let best = -1, bestD = maxPx;
  const m = object?.matrixWorld;
  for (let i = 0; i < count; i++) {
    if (typeof positions === 'function') v.copy(positions(i));
    else { v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); if (m) v.applyMatrix4(m); }
    v.project(camera);
    if (v.z > 1 || v.z < -1) continue;
    const d = Math.hypot(((v.x + 1) / 2) * rect.width + rect.left - clientX, ((1 - v.y) / 2) * rect.height + rect.top - clientY);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best < 0 ? null : { index: best, px: bestD };
}

/** Wire click (no drag) and double-click handlers onto `el`. */
export function onClicks(el, { click, dblclick }) {
  let down = null, timer = null;
  el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    clearTimeout(timer);
    const ev = { clientX: e.clientX, clientY: e.clientY };
    timer = setTimeout(() => click?.(ev), 250);
  });
  el.addEventListener('dblclick', (e) => { clearTimeout(timer); dblclick?.({ clientX: e.clientX, clientY: e.clientY }); });
}
