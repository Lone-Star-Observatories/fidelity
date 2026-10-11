// Today's coastlines and country borders for the line-art map (COMMS, #69): Natural Earth 1:50m
// (public domain) via world-atlas TopoJSON, bundled at public/shapes/world-50m.json
// (scripts/build-worldmap.mjs). Arcs used by one country are coastline, by two a border.
// TopoJSON doesn't cut at the antimeridian, so rings and arcs are unwrapped (continuous longitude,
// possibly beyond ±180°); draw them again shifted by ±360° to fill in the other edge.

/** Make longitudes continuous along a line (no 360° jumps). */
export function unwrap(pts) {
  const out = [];
  let off = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) { const d = pts[i][0] - pts[i - 1][0]; if (d > 180) off -= 360; else if (d < -180) off += 360; }
    out.push(off ? [pts[i][0] + off, pts[i][1]] : pts[i]);
  }
  return out;
}

/** Decode a TopoJSON topology → { arcs: [[lon, lat]…][] (unwrapped), countries: [{ name, polys, bbox }], coast, borders }. */
export function decodeWorld(topo) {
  const [sx, sy] = topo.transform?.scale ?? [1, 1], [tx, ty] = topo.transform?.translate ?? [0, 0];
  const arcs = topo.arcs.map((a) => {
    let x = 0, y = 0;
    return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const uses = new Uint8Array(arcs.length);
  const ring = (refs) => {
    const pts = [];
    for (const r of refs) {
      const i = r < 0 ? ~r : r;
      uses[i] = Math.min(255, uses[i] + 1);
      const a = r < 0 ? [...arcs[i]].reverse() : arcs[i];
      pts.push(...(pts.length ? a.slice(1) : a)); // consecutive arcs share their end point
    }
    return unwrap(pts);
  };
  const countries = topo.objects.countries.geometries.map((g) => {
    const polys = (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []).map((p) => p.map(ring));
    const bbox = [180, 90, -180, -90];
    for (const p of polys) for (const [lon, lat] of p[0] ?? []) { bbox[0] = Math.min(bbox[0], lon); bbox[1] = Math.min(bbox[1], lat); bbox[2] = Math.max(bbox[2], lon); bbox[3] = Math.max(bbox[3], lat); }
    return { name: g.properties?.name ?? '', polys, bbox };
  });
  // the projection's cut lines (the antimeridian, Antarctica's bottom edge) are not coastline
  const cut = (a) => a.every(([lon, lat]) => Math.abs(Math.abs(lon) - 180) < 1e-6 || lat < -89.99);
  const coast = [], borders = [];
  uses.forEach((n, i) => { if (n === 1 && !cut(arcs[i])) coast.push(i); else if (n >= 2) borders.push(i); });
  return { arcs: arcs.map(unwrap), countries, coast, borders };
}

/** Even-odd point-in-ring test (lon, lat). */
function inRing(lon, lat, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** The country containing (lat, lon), or null. Holes (lakes, enclaves) are respected. */
export function countryAt(world, lat, lon) {
  for (const c of world.countries) {
    const [x0, y0, x1, y1] = c.bbox;
    if (lat < y0 || lat > y1) continue;
    for (const L of [lon, lon - 360, lon + 360]) { // an unwrapped ring may run past ±180°
      if (L < x0 || L > x1) continue;
      for (const [outer, ...holes] of c.polys) if (inRing(L, lat, outer) && !holes.some((h) => inRing(L, lat, h))) return c;
    }
  }
  return null;
}
