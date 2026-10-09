// Procedural, deliberately stylised planet textures (provenance: IMAGINED).
// Planet View replaces these with NASA/USGS global mosaics, loaded on demand.

import * as THREE from 'three';

function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function planetTexture(body) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = rng(body.id);
  const [base, ...accents] = body.palette;
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  if (body.banded) {
    let y = 0;
    while (y < h) {
      const bh = 4 + r() * 22;
      g.globalAlpha = 0.35 + r() * 0.5;
      g.fillStyle = accents[Math.floor(r() * accents.length)] || base;
      g.fillRect(0, y, w, bh);
      y += bh;
    }
    g.globalAlpha = 1;
    if (body.id === 'jupiter') { // the Great Red Spot is real; its look here is stylised
      g.fillStyle = '#c1583a';
      g.beginPath(); g.ellipse(w * 0.62, h * 0.64, 26, 13, 0, 0, Math.PI * 2); g.fill();
    }
  } else {
    for (let i = 0; i < (body.earthlike ? 26 : 220); i++) {
      g.globalAlpha = body.earthlike ? 0.9 : 0.15 + r() * 0.35;
      g.fillStyle = accents[body.earthlike ? 0 : Math.floor(r() * accents.length)];
      const x = r() * w, yy = h * (0.15 + r() * 0.7), rad = (body.earthlike ? 10 : 3) + r() * (body.earthlike ? 30 : 16);
      g.beginPath(); g.ellipse(x, yy, rad * 1.6, rad, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    if (body.earthlike || body.id === 'mars') { // polar caps
      g.fillStyle = body.earthlike ? '#eef3f6' : '#f1e9e1';
      g.fillRect(0, 0, w, h * 0.06);
      g.fillRect(0, h * 0.94, w, h * 0.06);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function glowTexture(inner = 'rgba(255,230,170,1)', outer = 'rgba(255,150,40,0)') {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.18, 'rgba(255,200,110,0.65)');
  grad.addColorStop(0.45, 'rgba(255,140,40,0.14)');
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ringTexture() {
  // Radial profile loosely following the C, B, Cassini Division and A rings.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1;
  const g = c.getContext('2d');
  const stops = [[0, 0.15], [0.23, 0.25], [0.3, 0.75], [0.62, 0.9], [0.64, 0.05], [0.7, 0.05], [0.72, 0.6], [0.93, 0.55], [0.95, 0.1], [0.97, 0.45], [1, 0.0]];
  const grad = g.createLinearGradient(0, 0, 512, 0);
  for (const [p, a] of stops) grad.addColorStop(p, `rgba(226,210,170,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
