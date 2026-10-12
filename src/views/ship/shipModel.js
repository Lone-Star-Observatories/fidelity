// The USS Fidelity (NCC-001), built in code (#42). An original design, not a copy of any franchise
// ship: a swept arrowhead lifting body with a dorsal spine and bridge blister, a ventral keel carrying
// an amber deflector ring, and two slim nacelles slung *below* and outboard of the wingtips on canted
// pylons, their glow running along the outer flanks. IMAGINED.
//
// Units are metres; the ship is 352 m long, 225 m across the nacelles. Axes: the nose points along −Z
// (the way a three.js camera looks), +Y is dorsal (up), +X is starboard. The origin is the hull's
// centre of mass, roughly. About 7,000 triangles.

import * as THREE from 'three';

export const SHIP = { name: 'USS FIDELITY', registry: 'NCC-001', lengthM: 352, beamM: 225 };

/** Bridge eye point (m, ship axes): just ahead of the bridge blister, looking down the nose. */
export const BRIDGE_EYE = new THREE.Vector3(0, 24, -110);

function registryTexture() {
  if (typeof document === 'undefined') return null;
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 64 });
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 64);
  g.fillStyle = 'rgba(40,44,52,0.85)';
  g.font = '600 40px Antonio, "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`${SHIP.name.replace('USS', 'U.S.S.')}  ·  ${SHIP.registry}`, 256, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Build the ship. Returns { group, setGlow(k), setBridge(on), dispose() }: `setGlow` takes 0 (idle) to
 * 1 (high warp) and brightens and whitens the nacelles and the deflector; `setBridge(true)` hides the
 * bridge blister and spine so the first-person camera can sit there.
 */
export function createShipModel() {
  const group = new THREE.Group();
  group.name = 'uss-fidelity';
  const hull = new THREE.MeshStandardMaterial({ color: 0xc3c7ce, metalness: 0.35, roughness: 0.48 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x8e939c, metalness: 0.45, roughness: 0.42 });
  const glowCol = new THREE.Color(0x4fb8ff), glowHot = new THREE.Color(0xd8f0ff);
  const nacelleGlow = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: glowCol.clone(), emissiveIntensity: 1.4, roughness: 0.3 });
  const deflector = new THREE.MeshStandardMaterial({ color: 0x2a1600, emissive: new THREE.Color(0xffaa33), emissiveIntensity: 1.2, roughness: 0.3 });
  const impulse = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(0xff3322), emissiveIntensity: 1.3 });
  const windows = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(0xfff1c8), emissiveIntensity: 0.9 });
  const portLight = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), starLight = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
  const mats = [hull, darker, nacelleGlow, deflector, impulse, windows, portLight, starLight];
  const add = (geo, mat, setup) => { const m = new THREE.Mesh(geo, mat); setup?.(m); group.add(m); return m; };

  // ---- primary hull: a swept arrowhead with a notched trailing edge, extruded and bevelled ---------
  const half = [[0, 200], [18, 150], [45, 62], [80, -38], [102, -108], [90, -124], [52, -96], [27, -140], [0, -134]];
  const shape = new THREE.Shape();
  shape.moveTo(...half[0]);
  for (const p of half.slice(1)) shape.lineTo(p[0], p[1]);
  for (const p of [...half].reverse().slice(1)) shape.lineTo(-p[0], p[1]);
  const depth = 8, bevel = 5;
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 4 });
  hullGeo.rotateX(-Math.PI / 2); // shape +Y (forward) → −Z; extrusion → +Y
  hullGeo.translate(0, -depth / 2, 0);
  hullGeo.computeVertexNormals();
  add(hullGeo, hull);

  // ---- dorsal spine and bridge blister ------------------------------------------------------------
  const top = depth / 2 + bevel; // dorsal surface height
  const spine = add(new THREE.SphereGeometry(1, 40, 20), hull, (m) => { m.scale.set(12, 6, 104); m.position.set(0, top - 1, -4); });
  const bridge = add(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), darker, (m) => { m.scale.set(10, 7, 14); m.position.set(0, top + 3, -92); });
  // a ring of lit bridge windows
  const bridgeWin = add(new THREE.TorusGeometry(1, 0.08, 6, 48), windows, (m) => { m.scale.set(10.2, 14.2, 4); m.rotation.x = Math.PI / 2; m.position.set(0, top + 5, -92); });

  // ---- ventral keel and deflector -----------------------------------------------------------------
  add(new THREE.SphereGeometry(1, 40, 20), darker, (m) => { m.scale.set(20, 10, 124); m.position.set(0, -top + 1, -22); });
  add(new THREE.TorusGeometry(7.5, 1.9, 10, 40), deflector, (m) => { m.position.set(0, -top - 1, -138); });
  add(new THREE.CircleGeometry(6.6, 32), deflector, (m) => { m.position.set(0, -top - 1, -138.5); m.rotation.y = Math.PI; });

  // ---- nacelles: slung below and outboard of the wingtips -----------------------------------------
  const nacGeo = new THREE.CapsuleGeometry(8.5, 158, 8, 24);
  nacGeo.rotateX(Math.PI / 2);
  const stripGeo = new THREE.BoxGeometry(2.6, 5.5, 148);
  const ringGeo = new THREE.TorusGeometry(8.6, 1.6, 8, 28);
  for (const s of [-1, 1]) {
    const x = s * 104, y = -34, z = 30;
    add(nacGeo, hull, (m) => m.position.set(x, y, z));
    add(stripGeo, nacelleGlow, (m) => m.position.set(x + s * 7.4, y + 1, z)); // glow along the outer flank
    add(ringGeo, nacelleGlow, (m) => m.position.set(x, y, z + 78)); // aft field ring
    add(new THREE.SphereGeometry(4.2, 16, 12), nacelleGlow, (m) => { m.scale.set(1, 1, 0.5); m.position.set(x, y, z - 87); }); // forward intake
    // canted pylon from the wing's underside down and out to the nacelle
    add(new THREE.BoxGeometry(5, 20, 46), darker, (m) => { m.position.set(s * 99, -17, 52); m.rotation.z = s * 0.38; });
  }

  // ---- impulse engines along the trailing notches, running lights, registry, window rows ----------
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(16, 7, 3), impulse, (m) => { m.position.set(s * 39.5, 0, 119.5); m.rotation.y = s * 1.05; });
    add(new THREE.SphereGeometry(1.8, 10, 8), s < 0 ? portLight : starLight, (m) => m.position.set(s * 103, 0, 109));
  }
  add(new THREE.BoxGeometry(14, 6, 3), impulse, (m) => m.position.set(0, 0, 138));
  const reg = registryTexture();
  if (reg) {
    const decal = new THREE.MeshBasicMaterial({ map: reg, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    mats.push(decal);
    for (const s of [-1, 1]) add(new THREE.PlaneGeometry(64, 8), decal, (m) => { m.rotation.x = -Math.PI / 2; m.rotation.z = s * 1.18; m.position.set(s * 50, top + 0.2, 24); });
  }
  const winGeo = new THREE.BoxGeometry(0.9, 0.5, 1.8);
  const rows = new THREE.InstancedMesh(winGeo, windows, 80);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (const s of [-1, 1]) for (let i = 0; i < 40; i++) {
    const t = i / 39, f = 96 - t * 136; // along the leading edge, from abeam the bridge (96 m) to −40 m
    const xEdge = f > 62 ? 18 + ((150 - f) / 88) * 27 : 45 + ((62 - f) / 100) * 35;
    mtx.makeTranslation(s * (xEdge - (i % 2 ? 3 : 8)), top + 0.2, -f); // on the dorsal surface, inside the bevel
    rows.setMatrixAt(k++, mtx);
  }
  group.add(rows);

  return {
    group,
    /** 0 = idle, 1 = high warp: the nacelles brighten and whiten, the deflector flares. */
    setGlow(kGlow) {
      const g = Math.min(1, Math.max(0, kGlow));
      nacelleGlow.emissive.copy(glowCol).lerp(glowHot, g * 0.8);
      nacelleGlow.emissiveIntensity = 1.4 + g * 5;
      deflector.emissiveIntensity = 1.2 + g * 2.5;
    },
    setBridge(on) { spine.visible = bridge.visible = bridgeWin.visible = !on; },
    dispose() {
      group.traverse((o) => o.geometry?.dispose());
      for (const m of mats) { m.map?.dispose(); m.dispose(); }
    },
  };
}
