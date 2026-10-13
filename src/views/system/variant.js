// A planet material's shader variant (defines: PALEO, SLICE; see the texture-unit note above PLANET_FRAG in
// materials.js). Its own module so clouds.js and paleoearth.js can use it without materials.js's imports.

/** Switch a planet material's shader variant (PALEO, SLICE): recompiles once, only when it changes. */
export function setVariant(material, name, on) {
  const has = !!material.defines?.[name];
  if (has === !!on) return;
  material.defines = { ...(material.defines ?? {}) };
  if (on) material.defines[name] = 1; else delete material.defines[name];
  material.needsUpdate = true;
}
