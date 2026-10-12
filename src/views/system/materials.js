// Materials for realistic bodies: spacecraft mosaics for Sol's worlds, individual and generated class skins for
// exoplanets, limb-darkened photospheres for stars. Textures load on demand (backend
// cache, or the standalone snapshot) and swap in over a procedural placeholder.

import * as THREE from 'three';
import { textureUrl } from '../../data/catalog.js';
import { bakedFeed } from '../../data/bandbake.js';

const loader = new THREE.TextureLoader();
const cache = new Map();

/** Load texture `key` once; resolves to null if it can't be fetched (placeholder stays). */
export function loadTexture(key) {
  if (!key) return Promise.resolve(null);
  if (!cache.has(key)) {
    const url = textureUrl(key);
    cache.set(key, !url ? Promise.resolve(null) : new Promise((resolve) => {
      loader.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.wrapS = THREE.RepeatWrapping; // seam-split shape UVs may cross 1.0
        resolve(t);
      }, undefined, () => resolve(null));
    }));
  }
  return cache.get(key);
}

const VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }`;

// Globes with an elevation model (#80): the same, plus the local east/north directions for the
// fragment's normal map and, close up, real displacement of the vertices by the DEM's heights.
const DEM_VERT = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform sampler2D uDem; uniform float uDemDisp; uniform float uDemK; uniform float uDemU0;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW; varying vec3 vEastW; varying vec3 vNorthW; varying vec3 vDirL;
  void main() {
    vUv = uv;
    vec3 p = position;
    vDirL = normalize(position);
    if (uDemDisp > 0.5) p *= 1.0 + textureLod(uDem, vec2(uv.x + uDemU0, uv.y), 0.0).r * uDemK;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    // three.js spheres: east (increasing u) is (z, 0, −x) in the mesh frame; north = up × east
    vec3 eL = vec3(position.z, 0.0, -position.x);
    eL = dot(eL, eL) < 1e-12 ? vec3(1.0, 0.0, 0.0) : normalize(eL);
    vEastW = normalize(mat3(modelMatrix) * eL);
    vNorthW = normalize(cross(vNormalW, vEastW));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }`;

// Lambert lighting from the star, a soft terminator, optional night-side emission.
const PLANET_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap; uniform sampler2D uNight; uniform float uHasNight;
  uniform sampler2D uLive; uniform float uHasLive;
  // Earth through time (#54): sea level (m) against ETOPO1 (R elevation, G flood level from the open ocean,
  // B open ocean today; ±400 m in 0–1), PaleoMIST ice-sheet masks blended between two time slices, or a
  // reconstructed land mask (GPlates coastlines) in place of today's continents.
  uniform float uPaleo; uniform sampler2D uElev; uniform float uSea; uniform sampler2D uIceA; uniform sampler2D uIceB; uniform float uIceMix; uniform float uIceOn;
  uniform sampler2D uLand; uniform float uLandOn;
  // The Messinian (#54): uElev alpha marks the Mediterranean (0 outside; west 1–127, east 128–255, each depth
  // 0–4,500 m); uMedLevel = how far each basin's surface fell (m). Deeper floor keeps a brine lake; the rest is exposed.
  uniform float uMedOn; uniform vec2 uMedLevel;
  // Vegetation by epoch (#54): BIOME4 class maps (value = class + 1, 720×360) blended between two slices through
  // a 32×1 palette; and the 6 ka North Africa proxy map (RGB colour, A land fraction) weighted by uAfrW.
  uniform sampler2D uBiomeA; uniform sampler2D uBiomeB; uniform sampler2D uBiomePal; uniform float uBiomeMix; uniform float uBiomeOn;
  uniform sampler2D uAfr; uniform float uAfrW;
  uniform vec3 uTint; uniform vec3 uSunPos; uniform vec3 uSunColor; uniform float uAmbient; uniform float uAlphaFromLuma;
  // Eclipse shadows (#30), in TRUE geometry (km, scene axes, relative to this body's centre) so
  // they are right whatever the display scale: the fraction of the Sun's disc an occluder
  // (the Moon for Earth, Earth for the Moon, a moon for Jupiter…) hides from each point.
  uniform float uOccOn; uniform vec3 uOccRel; uniform float uOccR; uniform vec3 uSunRel; uniform float uSunR;
  uniform float uBodyR; uniform vec3 uCentreW; uniform vec3 uUmbraTint;
  // Planetshine (#49): the parent planet's reflected light on a moon's night side (colour × display exposure)
  uniform vec3 uPsPos; uniform vec3 uPsCol;
  // The spectrum filter (#28): 0 normal; 1 real band map; 2 predicted reflected; 3 predicted thermal;
  // 4 not observed; 5 modelled high-energy glow. Non-visible bands are false colour (palette).
  uniform float uBandMode; uniform sampler2D uBandTex; uniform vec2 uBandLevels; uniform float uBandGain; uniform float uPalette;
  uniform vec4 uThermal; uniform float uBandUm; uniform float uGlow; uniform vec3 uPoleW; uniform float uBandLit;
  // 6: a transmission curve (#66): weights uMix (real map, reflected, thermal, glow), each with its
  // palette (uMixPal) or, in a three-band composite, its hue (uMixHue column, w = 1). uBandTexPrev and
  // uBandFade cross-fade a band map's preview into its full resolution (#62).
  uniform vec4 uMix; uniform vec4 uMixPal; uniform mat4 uMixHue; uniform float uGlowGain;
  uniform sampler2D uBandTexPrev; uniform float uBandFade;
  // A whole-disc image (#28) instead of a map: projected onto the hemisphere facing uDiscE (towards
  // Earth), the body's north uDiscN at position angle uDiscPA in the image; disc centre uDiscC (uv),
  // radii uDiscR and image size uDiscWH in pixels. Its alpha is 0 on the far side (the predicted skin).
  uniform float uDiscOn; uniform vec2 uDiscC; uniform vec2 uDiscR; uniform vec2 uDiscWH; uniform float uDiscPA; uniform vec3 uDiscE; uniform vec3 uDiscN;
  // Clouds and ground (#83): uRadar colours a radar backscatter map after the Venera 13/14 lander images (MODELLED:
  // radar is not colour); uSkyAmb is the diffuse light of an overcast sky (under Venus' clouds the Sun's disc is never
  // seen; uSkyUp the local zenith, world axes); uFogCol / uFogK the aerial perspective (extinction per world unit); uLiveSplit keeps today's imagery's
  // clouds off the ground when they are drawn on their own shell. uAlphaFromLuma: 1 alpha from brightness (a cloud
  // map), 2 alpha from whiteness (clouds picked out of a true-colour mosaic).
  uniform float uRadar; uniform vec3 uSkyAmb; uniform vec3 uSkyUp; uniform vec3 uFogCol; uniform float uFogK; uniform float uLiveSplit;
  // Detail imagery on a close-up terrain chunk (#83: Magellan SAR tiles on Venus): uDetail covers the map's uv rectangle
  // uDetailRect (u0, v0 south edge, du, dv) and replaces uMap inside it.
  uniform sampler2D uDetail; uniform float uDetailOn; uniform vec4 uDetailRect;
  // Earth's cloud volume (#83, clouds.js): this slice's height uSliceKm among uSlices; a column draws in the slices
  // from its base to its top (measured top from uCth's 8-bit code, base modelled; else the assumed uAssumed = top,
  // base km), at least the slice nearest its top. uCth also gates the whiteness mask (no retrieval, no cloud);
  // without it the MODELLED ice prior uSnowMask does.
  uniform float uSliceOn; uniform float uSliceKm; uniform float uSlices[9]; uniform sampler2D uCth; uniform float uCthOn; uniform vec2 uAssumed;
  uniform sampler2D uSnowMask; uniform float uSnowOn;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  float whiteness(vec3 c) {
    float lo = min(c.r, min(c.g, c.b)), hi = max(c.r, max(c.g, c.b));
    return smoothstep(0.2, 0.55, lo) * (1.0 - smoothstep(0.12, 0.3, hi - lo));
  }
  #ifdef DEM
  // Relief (#80): heights (m, half float, mipmapped) → a normal map on the fly. uDemK = exaggeration / radius (m),
  // uDemTexel the step (1 / size), uDemU0 the colour map's longitude offset; uDemClip discards the globe under a
  // close-up terrain patch (xyz = its centre direction in the mesh frame, w = cos of its angular radius).
  uniform sampler2D uDem; uniform float uDemOn; uniform float uDemK; uniform float uDemU0; uniform vec2 uDemTexel; uniform vec4 uDemClip;
  varying vec3 vEastW; varying vec3 vNorthW; varying vec3 vDirL;
  // Cloud shadows on the ground (#83): the cloud shell (height uCloudH body radii, its map uCloudTex turned uCloudU
  // in u against the ground) seen from this point towards the Sun (uSunL, the ground mesh's frame). Mode as uAlphaFromLuma.
  uniform sampler2D uCloudTex; uniform float uCloudMode; uniform float uCloudH; uniform float uCloudU; uniform vec3 uSunL;
  uniform sampler2D uCloudGate; uniform float uCloudGateOn;
  float cloudShadow() {
    float lat = (vUv.y - 0.5) * 3.14159265, ph = vUv.x * 6.2831853;
    vec3 d = vec3(-cos(ph) * cos(lat), sin(lat), sin(ph) * cos(lat)); // this point (the uv works on the globe and the terrain patch)
    vec3 s = normalize(uSunL);
    float b = dot(d, s), rc = 1.0 + uCloudH;
    if (b < -0.2) return 0.0;
    float t = -b + sqrt(max(b * b - 1.0 + rc * rc, 0.0));
    vec3 q = normalize(d + s * t);
    float u = atan(q.z, -q.x) / 6.2831853 + uCloudU;
    vec2 cuv = vec2(fract(u), asin(clamp(q.y, -1.0, 1.0)) / 3.14159265 + 0.5);
    if (uCloudGateOn > 0.5 && texture2D(uCloudGate, cuv).r < 0.5 / 255.0) return 0.0; // no measured cloud top: no cloud (#83)
    vec4 c = texture2D(uCloudTex, cuv);
    return uCloudMode > 1.5 ? whiteness(c.rgb) : clamp(dot(c.rgb, vec3(0.333)) * 1.3, 0.0, 1.0);
  }
  vec3 demNormal(vec3 N) {
    vec2 uv = vec2(vUv.x + uDemU0, vUv.y);
    // step: one texel, or the screen footprint when the globe is small (with the matching mip level)
    vec2 fw = max(fwidth(uv), uDemTexel);
    vec2 d = vec2(min(fw.x, 0.02), min(fw.y, 0.02));
    float lod = log2(max(fw.x / uDemTexel.x, 1.0));
    float hE = textureLod(uDem, uv + vec2(d.x, 0.0), lod).r, hW = textureLod(uDem, uv - vec2(d.x, 0.0), lod).r;
    float hN = textureLod(uDem, uv + vec2(0.0, d.y), lod).r, hS = textureLod(uDem, uv - vec2(0.0, d.y), lod).r;
    float lat = (vUv.y - 0.5) * 3.14159265;
    float sE = (hE - hW) * uDemK / (2.0 * d.x * 6.2831853 * max(cos(lat), 0.02));
    float sN = (hN - hS) * uDemK / (2.0 * d.y * 3.14159265);
    return normalize(N - sE * vEastW - sN * vNorthW);
  }
  #endif
  vec3 pal(float t, float p) {
    t = clamp(t, 0.0, 1.0);
    vec3 a = vec3(0.0), b, c, d = vec3(1.0);
    if (p < 1.5) { b = vec3(0.45, 0.0, 0.0); c = vec3(1.0, 0.55, 0.0); d = vec3(1.0, 1.0, 0.85); }
    else if (p < 2.5) { b = vec3(0.0, 0.05, 0.35); c = vec3(0.0, 0.7, 0.9); d = vec3(0.9, 1.0, 1.0); }
    else if (p < 3.5) { b = vec3(0.3, 0.0, 0.45); c = vec3(0.95, 0.25, 0.1); d = vec3(1.0, 0.95, 0.45); }
    else if (p < 4.5) { b = vec3(0.33); c = vec3(0.66); }
    else if (p < 5.5) { b = vec3(0.15, 0.0, 0.4); c = vec3(0.55, 0.3, 1.0); d = vec3(0.92, 0.88, 1.0); }
    else if (p < 6.5) { b = vec3(0.0, 0.2, 0.3); c = vec3(0.2, 0.75, 0.85); d = vec3(0.9, 1.0, 1.0); }
    else { b = vec3(0.35, 0.0, 0.35); c = vec3(1.0, 0.3, 0.8); d = vec3(1.0, 0.9, 1.0); }
    return t < 0.333 ? mix(a, b, t * 3.0) : t < 0.666 ? mix(b, c, (t - 0.333) * 3.0) : mix(c, d, (t - 0.666) * 3.0);
  }
  vec3 colz(float x, float p, vec4 hue) { return hue.w > 0.5 ? clamp(x, 0.0, 1.0) * hue.rgb : pal(x, p); }
  vec4 bandAt(vec2 uv) { vec4 c = texture2D(uBandTex, uv); return uBandFade < 0.999 ? mix(texture2D(uBandTexPrev, uv), c, uBandFade) : c; }
  vec4 bandSample() {
    if (uDiscOn < 0.5) return bandAt(vUv);
    vec3 N = normalize(vNormalW);
    vec3 up = normalize(uDiscN - uDiscE * dot(uDiscN, uDiscE));
    vec3 right = normalize(cross(-uDiscE, up));
    vec2 p = vec2(dot(N, right), dot(N, up)) * uDiscR;
    float c = cos(uDiscPA), s = sin(uDiscPA);
    vec4 t = bandAt(uDiscC + vec2(p.x * c - p.y * s, p.x * s + p.y * c) / uDiscWH);
    t.a *= smoothstep(0.02, 0.2, dot(N, uDiscE));
    return t;
  }
  float planckRel(float um, float T, float Tref) { // B_λ(T) / B_λ(Tref)
    float x = min(14387.77 / (um * max(T, 1.0)), 80.0), xr = min(14387.77 / (um * max(Tref, 1.0)), 80.0);
    return (exp(xr) - 1.0) / (exp(x) - 1.0);
  }
  float discOverlap(float r1, float r2, float d) { // fraction of disc r1 covered by disc r2 at separation d
    if (d >= r1 + r2) return 0.0;
    if (d <= abs(r1 - r2)) return r2 >= r1 ? 1.0 : (r2 * r2) / (r1 * r1);
    float a1 = r1 * r1 * acos(clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0));
    float a2 = r2 * r2 * acos(clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0));
    float a3 = 0.5 * sqrt(max(0.0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
    return clamp((a1 + a2 - a3) / (3.14159265 * r1 * r1), 0.0, 1.0);
  }
  /** A biome map's colour at uv: the class colours of the four nearest 0.5° cells, blended bilinearly (codes never blend). */
  vec4 biomeColour(sampler2D map, vec2 uv) {
    vec2 size = vec2(720.0, 360.0), f = uv * size - 0.5, i0 = floor(f), w = f - i0;
    vec4 c00 = texture2D(uBiomePal, vec2((texture2D(map, (i0 + vec2(0.5, 0.5)) / size).r * 255.0 + 0.5) / 32.0, 0.5));
    vec4 c10 = texture2D(uBiomePal, vec2((texture2D(map, (i0 + vec2(1.5, 0.5)) / size).r * 255.0 + 0.5) / 32.0, 0.5));
    vec4 c01 = texture2D(uBiomePal, vec2((texture2D(map, (i0 + vec2(0.5, 1.5)) / size).r * 255.0 + 0.5) / 32.0, 0.5));
    vec4 c11 = texture2D(uBiomePal, vec2((texture2D(map, (i0 + vec2(1.5, 1.5)) / size).r * 255.0 + 0.5) / 32.0, 0.5));
    return mix(mix(c00, c10, w.x), mix(c01, c11, w.x), w.y);
  }
  // the opacity of this cloud slice's fragment, or −1 when the column does not reach it (decided first, it is cheap)
  float sliceAlpha() {
    vec4 t = texture2D(uMap, vUv);
    float a = uAlphaFromLuma > 1.5 ? whiteness(t.rgb) : clamp(dot(t.rgb, vec3(0.333)) * 1.3, 0.0, 1.0);
    float top = uAssumed.x, bot = uAssumed.y;
    if (uCthOn > 0.5) {
      float code = floor(texture2D(uCth, vUv).r * 255.0 + 0.5);
      if (code < 0.5) return -1.0; // no cloud-top retrieval: clear sky (snow and ice included)
      top = ((code - 1.0) * 50.0 + 25.0) / 1000.0;
      bot = max(0.3, top - clamp(0.45 * top, 0.8, 4.0));
    } else if (uSnowOn > 0.5) a *= 1.0 - texture2D(uSnowMask, vUv).r;
    float nearest = uSlices[0], n = 0.0;
    for (int i = 0; i < 9; i++) {
      if (abs(uSlices[i] - top) < abs(nearest - top)) nearest = uSlices[i];
      if (uSlices[i] >= bot - 0.001 && uSlices[i] <= top + 0.001) n += 1.0;
    }
    bool nearestIn = nearest >= bot - 0.001 && nearest <= top + 0.001;
    if (!((uSliceKm >= bot - 0.001 && uSliceKm <= top + 0.001) || abs(uSliceKm - nearest) < 0.001)) return -1.0;
    if (!nearestIn) n += 1.0;
    a = 1.0 - pow(1.0 - clamp(a, 0.0, 0.999), 1.0 / max(n, 1.0));
    return a < 0.004 ? -1.0 : a;
  }
  void main() {
    #include <logdepthbuf_fragment>
    float sliceA = 1.0;
    if (uSliceOn > 0.5) { sliceA = sliceAlpha(); if (sliceA < 0.0) discard; }
    vec3 N = normalize(vNormalW);
    #ifdef DEM
    if (uDemClip.w < 1.0 && dot(normalize(vDirL), uDemClip.xyz) > uDemClip.w) discard; // the terrain patch is drawn here
    if (uDemOn > 0.5) N = demNormal(N);
    #endif
    float ndl = dot(N, normalize(uSunPos - vPosW));
    float lightK = 1.0; float umbraK = 0.0;
    if (uOccOn > 0.5) {
      vec3 p = normalize(vPosW - uCentreW) * uBodyR;
      vec3 toS = uSunRel - p, toO = uOccRel - p;
      if (dot(toS, toO) > 0.0) {
        float ls = length(toS), lo = length(toO);
        float rs = asin(min(1.0, uSunR / ls)), ro = asin(min(1.0, uOccR / lo));
        float d = atan(length(cross(toS, toO)), dot(toS, toO));
        float f = discOverlap(rs, ro, d);
        lightK = 1.0 - f;
        umbraK = smoothstep(0.9, 1.0, f);
      }
    }
    #ifdef DEM
    if (uCloudMode > 0.5) lightK *= 1.0 - 0.7 * cloudShadow();
    #endif
    vec4 tex = texture2D(uMap, vUv);
    if (uDetailOn > 0.5) {
      vec2 dd = (vUv - uDetailRect.xy) / uDetailRect.zw;
      if (dd.x >= 0.0 && dd.y >= 0.0 && dd.x <= 1.0 && dd.y <= 1.0) tex = texture2D(uDetail, dd);
    }
    vec3 base = tex.rgb * uTint;
    if (uRadar > 0.5) { // radar brightness → Venera 13/14 rock colours: dark basalt, rough (radar-bright) ground a little paler
      float g = dot(tex.rgb, vec3(0.333));
      float t = mix(0.45, pow(clamp(g * 3.0, 0.0, 1.0), 0.8), smoothstep(0.004, 0.02, g)); // Magellan's gaps (black): the mean ground
      base = mix(vec3(0.1, 0.075, 0.05), vec3(0.46, 0.36, 0.26), t);
    }
    if (uHasLive > 0.5) { // today's imagery where it exists; the base map fills swath gaps and polar night
      vec3 lv = texture2D(uLive, vUv).rgb;
      float w = smoothstep(0.015, 0.06, max(lv.r, max(lv.g, lv.b)));
      if (uLiveSplit > 0.5) w *= 1.0 - whiteness(lv); // its clouds are on their own shell
      base = mix(base, lv, w);
    }
    if (uPaleo > 0.5) {
      vec3 seaCol = vec3(0.012, 0.035, 0.09), shelfCol = vec3(0.31, 0.29, 0.2), iceCol = vec3(0.86, 0.9, 0.95);
      if (uLandOn > 0.5) base = mix(seaCol, vec3(0.34, 0.32, 0.21), step(0.5, texture2D(uLand, vUv).r));
      else {
        vec3 el = texture2D(uElev, vUv).rgb;
        float e = el.r * 800.0 - 400.0, spill = el.g * 800.0 - 400.0;
        if (el.b > 0.5) { if (e > uSea) base = shelfCol; }      // today's sea floor, exposed when the sea falls
        float medA = uMedOn > 0.5 ? texture2D(uElev, (floor(vUv * vec2(1440.0, 720.0)) + 0.5) / vec2(1440.0, 720.0)).a * 255.0 : 0.0; // nearest texel: the classes must not blend
        if (medA > 0.5) {
          bool east = medA > 127.5;
          float depth = east ? (medA - 128.0) / 127.0 * 4500.0 : (medA - 1.0) / 126.0 * 4500.0, level = east ? uMedLevel.y : uMedLevel.x;
          if (depth > level) base = vec3(0.035, 0.1, 0.095);     // residual hypersaline brine in the deep basin
          else base = mix(vec3(0.38, 0.31, 0.24), vec3(0.82, 0.8, 0.74), smoothstep(0.35, 0.95, depth / level)); // exposed floor: margins to salt pans near the brine
        }
        else if (spill < uSea) base = seaCol;                   // land the rising sea reaches
        bool wet = medA > 0.5 || (el.b > 0.5 ? e <= uSea : spill < uSea);
        if (uBiomeOn > 0.0 && !wet) {
          vec4 bc = mix(biomeColour(uBiomeA, vUv), biomeColour(uBiomeB, vUv), uBiomeMix);
          float lum = dot(base, vec3(0.3, 0.59, 0.11));          // keep today's relief shading under the colour
          base = mix(base, bc.rgb * (0.8 + 0.5 * smoothstep(0.04, 0.45, lum)), bc.a * 0.85 * uBiomeOn);
        }
        if (uAfrW > 0.0 && !wet) { vec4 af = texture2D(uAfr, vUv); base = mix(base, af.rgb, af.a * uAfrW * 0.9); }
      }
      if (uIceOn > 0.5) base = mix(base, iceCol, mix(texture2D(uIceA, vUv).r, texture2D(uIceB, vUv).r, uIceMix));
    }
    if (uBandMode > 0.5) {
      float lit = max(ndl, 0.0) * lightK;
      float dayK = uAmbient + lit * 1.3;
      // thermal model (also the fallback where a real map has no data)
      float T = uThermal.w > 0.5 ? (ndl > 0.0 ? max(uThermal.y, uThermal.x * pow(max(ndl, 0.0), 0.25)) : uThermal.y) : uThermal.z * (1.0 + 0.04 * (max(ndl, 0.0) - 0.5));
      // false-colour scale: full brightness at 1.3× the body's hottest modelled temperature
      vec3 thermal = pal(pow(clamp(planckRel(uBandUm, T, 1.3 * max(uThermal.x, uThermal.z)), 0.0, 1.0), 0.35), uPalette);
      vec3 bc;
      if (uBandMode > 5.5) {
        vec3 acc = vec3(0.0); float ws = 0.0;
        if (uMix.x > 0.0) {
          vec4 t = bandSample();
          float l = pow(clamp((dot(t.rgb, vec3(0.333)) - uBandLevels.x) * uBandLevels.y, 0.0, 1.0), 1.4);
          vec3 rc = uMixPal.x < 0.5 && uMixHue[0].w < 0.5 ? t.rgb : colz(l * 0.92, uMixPal.x, uMixHue[0]);
          if (uBandLit > 0.5) rc *= dayK;
          acc += uMix.x * t.a * rc; ws += uMix.x * t.a; // gaps in a partial map: the predicted parts fill in
        }
        if (uMix.y > 0.0) { acc += uMix.y * colz(clamp(dot(base, vec3(0.299, 0.587, 0.114)) * uBandGain * dayK * 1.4, 0.0, 1.0), uMixPal.y, uMixHue[1]); ws += uMix.y; }
        if (uMix.z > 0.0) { acc += uMix.z * colz(pow(clamp(planckRel(uBandUm, T, 1.3 * max(uThermal.x, uThermal.z)), 0.0, 1.0), 0.35), uMixPal.z, uMixHue[2]); ws += uMix.z; }
        if (uMix.w > 0.0) {
          vec3 V = normalize(cameraPosition - vPosW);
          float g = uGlow < 1.5 ? 0.5 : uGlow < 2.5 ? lit : uGlow < 3.5 ? smoothstep(0.8, 0.96, abs(dot(N, uPoleW))) : pow(1.0 - abs(dot(N, V)), 4.0);
          acc += uMix.w * colz(g * uGlowGain, uMixPal.w, uMixHue[3]); ws += uMix.w;
        }
        bc = ws > 0.0 ? acc / ws : vec3(0.012) + base * 0.012;
      } else if (uBandMode < 1.5) {
        vec4 t = bandSample();
        float l = pow(clamp((dot(t.rgb, vec3(0.333)) - uBandLevels.x) * uBandLevels.y, 0.0, 1.0), 1.4);
        // a thermal map of an airless body is a daytime mosaic: the night side is far colder now
        if (uBandLit < 0.5 && uThermal.w > 0.5) l *= mix(0.2, 1.0, pow(clamp(planckRel(uBandUm, T, uThermal.x), 0.0, 1.0), 0.35)); // vs its own day side
        bc = uPalette < 0.5 ? t.rgb : pal(l * 0.92, uPalette);
        if (uBandLit > 0.5) bc *= dayK;
        bc = mix(vec3(dot(uThermal.w + uThermal.z > 0.0 ? thermal : bc, vec3(0.333))) * 0.3, bc, t.a); // gaps in partial maps: dim grey, so they read as no data
      } else if (uBandMode < 2.5) {
        bc = pal(clamp(dot(base, vec3(0.299, 0.587, 0.114)) * uBandGain * dayK * 1.4, 0.0, 1.0), uPalette);
      } else if (uBandMode < 3.5) {
        bc = thermal * uBandGain;
      } else if (uBandMode < 4.5) {
        bc = vec3(0.012) + base * 0.012;
      } else {
        vec3 V = normalize(cameraPosition - vPosW);
        float g = uGlow < 1.5 ? 0.5 : uGlow < 2.5 ? lit : uGlow < 3.5 ? smoothstep(0.8, 0.96, abs(dot(N, uPoleW))) : pow(1.0 - abs(dot(N, V)), 4.0);
        float pz = abs(dot(N, uPoleW));
        if (uGlow > 4.5 && uGlow < 5.5) g = 0.16 * lit + smoothstep(0.86, 0.91, pz) * (1.0 - smoothstep(0.94, 0.985, pz)); // auroral ovals ~15–25° from the poles over a faint disc (#61)
        else if (uGlow > 5.5 && uGlow < 6.5) { // volcanic hot spots: a sketch, scattered over a cold disc (Io, #61)
          vec2 cell = vUv * vec2(40.0, 20.0), cid = floor(cell);
          float h = fract(sin(dot(cid, vec2(12.9898, 78.233))) * 43758.5453);
          g = 0.05 + 0.08 * lit + step(0.9, h) * smoothstep(0.42, 0.0, length(fract(cell) - 0.5)) * (0.4 + 0.6 * fract(h * 37.0));
        } else if (uGlow > 6.5) { // Venus near-IR: sunlit cloud tops by day; heat through the windows by night, clouds in silhouette (#61)
          vec2 q = vUv * vec2(9.0, 6.0);
          float m = 0.5 + 0.25 * sin(q.x * 3.1 + sin(q.y * 2.3) * 2.0) + 0.25 * sin(q.y * 4.7 + sin(q.x * 1.7) * 3.0);
          g = lit * 0.85 + (1.0 - smoothstep(-0.05, 0.12, ndl)) * 0.45 * m;
        }
        bc = pal(g * uBandGain, uPalette);
      }
      gl_FragColor = vec4(bc, uAlphaFromLuma > 0.5 ? 0.0 : 1.0);
      #include <colorspace_fragment>
      return;
    }
    // in an atmosphere's umbra (a lunar eclipse) sunlight bent through Earth's air lights the disc red
    vec3 col = base * (uAmbient + max(ndl, 0.0) * (uSunColor * lightK + uUmbraTint * umbraK) + uSkyAmb * (0.4 + 0.6 * max(dot(N, uSkyUp), 0.0)));
    if (uPsCol.r + uPsCol.g + uPsCol.b > 0.0) col += base * uPsCol * max(dot(N, normalize(uPsPos - vPosW)), 0.0) * (1.0 - smoothstep(-0.05, 0.2, ndl * lightK));
    if (uHasNight > 0.5) {
      float night = 1.0 - smoothstep(-0.12, 0.08, ndl);
      col += texture2D(uNight, vUv).rgb * night * 1.4;
    }
    float a = uAlphaFromLuma > 1.5 ? whiteness(tex.rgb) : uAlphaFromLuma > 0.5 ? clamp(dot(tex.rgb, vec3(0.333)) * 1.3, 0.0, 1.0) : 1.0;
    if (uSliceOn > 0.5) a = sliceA;
    if (!gl_FrontFacing) col *= 0.5; // a cloud shell seen from below: its shaded underside
    if (uFogK > 0.0) col = mix(col, uFogCol, 1.0 - exp(-length(cameraPosition - vPosW) * uFogK));
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

// Photosphere: quadratic limb darkening; other stars use independent procedural illustrations.
const STAR_FRAG = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uRecolour;
  uniform sampler2D uDisk; uniform float uHasDisk; uniform vec3 uEarthDir; uniform vec3 uNorth; uniform float uDiskR;
  uniform vec3 uBandTint; uniform float uBandDisk; // spectrum filter (#28): tint, and 1 when uDisk is a band image shown as-is
  uniform float uBandMix; // its weight over the tinted photosphere (a custom curve that the map covers only in part; 1 otherwise)
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 N = normalize(vNormalW);
    float mu = clamp(dot(N, normalize(cameraPosition - vPosW)), 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 c = (uRecolour > 0.5 ? dot(tex, vec3(0.299, 0.587, 0.114)) * 2.2 * uColor : tex * 1.25) * limb * 1.35;
    vec3 under = c * uBandTint; // the predicted look under a partly weighted band map
    if (uHasDisk > 0.5) {
      // The live full-disk image (solar north up, as seen from Earth) projected onto the Earth-facing hemisphere.
      float facing = dot(N, uEarthDir);
      vec3 up = normalize(uNorth - uEarthDir * dot(uNorth, uEarthDir));
      vec3 right = normalize(cross(-uEarthDir, up));
      vec2 uvd = vec2(0.5 + dot(N, right) * uDiskR, 0.5 + dot(N, up) * uDiskR);
      // HMI continuum is a brightness image: give the disk and the stand-in far side one colour,
      // so the Sun reads as one star (limb darkening is already in the live image)
      vec3 warm = uColor * 1.9;
      vec3 live = dot(texture2D(uDisk, uvd).rgb, vec3(0.299, 0.587, 0.114)) * warm * 1.1;
      vec3 far = dot(tex, vec3(0.299, 0.587, 0.114)) * warm * limb * 1.6;
      c = mix(far, live, smoothstep(0.08, 0.3, facing));
      if (uBandDisk > 0.5) { // SDO (or NoRH, SRH, a modelled radio disc) in its own colours, weighted over the predicted look
        c = mix(under, mix(c * 0.15, texture2D(uDisk, uvd).rgb * 1.2, smoothstep(0.08, 0.3, facing)), uBandMix);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
        return;
      }
    }
    c *= uBandTint;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

const linear = (hexOrArray) => new THREE.Color(hexOrArray).convertSRGBToLinear();

export function planetMaterial(placeholder, { tint = [1, 1, 1], ambient = 0.035, dem = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: dem ? DEM_VERT : VERT, fragmentShader: PLANET_FRAG,
    defines: dem ? { DEM: 1 } : {},
    uniforms: {
      ...(dem ? { uDem: { value: null }, uDemOn: { value: 0 }, uDemDisp: { value: 0 }, uDemK: { value: 0 }, uDemU0: { value: 0 }, uDemTexel: { value: new THREE.Vector2(1 / 1440, 1 / 720) }, uDemClip: { value: new THREE.Vector4(0, 1, 0, 2) },
        uCloudTex: { value: null }, uCloudMode: { value: 0 }, uCloudH: { value: 0 }, uCloudU: { value: 0 }, uSunL: { value: new THREE.Vector3(0, 1, 0) },
        uCloudGate: { value: null }, uCloudGateOn: { value: 0 } } : {}),
      uDetail: { value: null }, uDetailOn: { value: 0 }, uDetailRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uSliceOn: { value: 0 }, uSliceKm: { value: 0 }, uSlices: { value: [1, 2, 3.5, 5, 6.5, 8, 9.5, 11, 12.5] }, uCth: { value: null }, uCthOn: { value: 0 }, uAssumed: { value: new THREE.Vector2(10, 2) },
      uSnowMask: { value: null }, uSnowOn: { value: 0 },
      uRadar: { value: 0 }, uSkyAmb: { value: new THREE.Color(0, 0, 0) }, uSkyUp: { value: new THREE.Vector3(0, 1, 0) }, uFogCol: { value: new THREE.Color(0, 0, 0) }, uFogK: { value: 0 }, uLiveSplit: { value: 0 },
      uMap: { value: placeholder }, uNight: { value: null }, uHasNight: { value: 0 }, uLive: { value: null }, uHasLive: { value: 0 },
      uTint: { value: new THREE.Color(...tint) }, uSunPos: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color(1.3, 1.3, 1.3) }, uAmbient: { value: ambient }, uAlphaFromLuma: { value: 0 },
      uOccOn: { value: 0 }, uOccRel: { value: new THREE.Vector3() }, uOccR: { value: 1 }, uSunRel: { value: new THREE.Vector3() }, uSunR: { value: 696000 },
      uBodyR: { value: 1 }, uCentreW: { value: new THREE.Vector3() }, uUmbraTint: { value: new THREE.Color(0, 0, 0) },
      uPsPos: { value: new THREE.Vector3() }, uPsCol: { value: new THREE.Color(0, 0, 0) },
      uBandMode: { value: 0 }, uBandTex: { value: null }, uBandLevels: { value: new THREE.Vector2(0, 1) }, uBandGain: { value: 1 }, uPalette: { value: 4 },
      uThermal: { value: new THREE.Vector4(0, 0, 0, 0) }, uBandUm: { value: 10 }, uGlow: { value: 0 }, uPoleW: { value: new THREE.Vector3(0, 1, 0) }, uBandLit: { value: 1 },
      uMix: { value: new THREE.Vector4(0, 0, 0, 0) }, uMixPal: { value: new THREE.Vector4(4, 4, 4, 4) }, uMixHue: { value: new THREE.Matrix4().multiplyScalar(0) }, uGlowGain: { value: 1 },
      uBandTexPrev: { value: null }, uBandFade: { value: 1 },
      uDiscOn: { value: 0 }, uDiscC: { value: new THREE.Vector2(0.5, 0.5) }, uDiscR: { value: new THREE.Vector2(1, 1) }, uDiscWH: { value: new THREE.Vector2(2, 2) },
      uDiscPA: { value: 0 }, uDiscE: { value: new THREE.Vector3(0, 0, 1) }, uDiscN: { value: new THREE.Vector3(0, 1, 0) },
      uPaleo: { value: 0 }, uElev: { value: null }, uSea: { value: 0 }, uIceA: { value: null }, uIceB: { value: null }, uIceMix: { value: 0 }, uIceOn: { value: 0 }, uLand: { value: null }, uLandOn: { value: 0 }, uMedOn: { value: 0 }, uMedLevel: { value: new THREE.Vector2(0, 0) }, uBiomeA: { value: null }, uBiomeB: { value: null }, uBiomePal: { value: null }, uBiomeMix: { value: 0 }, uBiomeOn: { value: 0 }, uAfr: { value: null }, uAfrW: { value: 0 },
    },
  });
}

/** A cloud shell: alpha from the map's brightness; `opaque` for a deck that hides the ground entirely (Venus, #83). */
export function cloudMaterial(placeholder, { opaque = false } = {}) {
  const m = planetMaterial(placeholder, { ambient: opaque ? 0.035 : 0.0 });
  m.uniforms.uAlphaFromLuma.value = opaque ? 0 : 1;
  m.transparent = !opaque;
  m.depthWrite = opaque;
  m.side = THREE.DoubleSide; // seen from below on the way down (#83)
  return m;
}

/** The uniforms of the spectrum-filter look (#28): a cloud deck that shares them shows the planet's band look. */
export const BAND_UNIFORMS = ['uBandMode', 'uBandTex', 'uBandLevels', 'uBandGain', 'uPalette', 'uThermal', 'uBandUm', 'uGlow', 'uPoleW', 'uBandLit',
  'uMix', 'uMixPal', 'uMixHue', 'uGlowGain', 'uBandTexPrev', 'uBandFade', 'uDiscOn', 'uDiscC', 'uDiscR', 'uDiscWH', 'uDiscPA', 'uDiscE', 'uDiscN'];

export function starMaterial(placeholder, color, recolour) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: STAR_FRAG,
    uniforms: { uMap: { value: placeholder }, uColor: { value: linear(color) }, uRecolour: { value: recolour ? 1 : 0 },
      uDisk: { value: null }, uHasDisk: { value: 0 }, uEarthDir: { value: new THREE.Vector3(0, 0, 1) }, uNorth: { value: new THREE.Vector3(0, 1, 0) }, uDiskR: { value: 0.39 },
      uBandTint: { value: new THREE.Color(1, 1, 1) }, uBandDisk: { value: 0 }, uBandMix: { value: 1 } },
  });
}

/** Swap a material's map (and optional night map) in when the textures arrive. */
export function applySkin(material, skin) {
  if (!skin) return;
  loadTexture(skin.map).then((t) => { if (t) material.uniforms.uMap.value = t; });
  if (skin.night) {
    loadTexture(skin.night).then((t) => {
      if (!t) return;
      material.uniforms.uNight.value = t;
      material.uniforms.uHasNight.value = 1;
    });
  }
}

// ---- live skins (#17): today's imagery from the backend's feed cache ----------------------------
const live = new Map(); // feed id → Promise<{ texture, time, credit, disk } | null>
export const liveInfo = new Map(); // feed id → { time, credit } once loaded

/** Load live feed `id` as a texture (null in the standalone preview or if unavailable). */
export function loadLive(id, maxAgeMs = 15 * 60000) {
  const c = live.get(id);
  if (c && Date.now() - c.at < maxAgeMs) return c.p;
  const p = (import.meta.env?.MODE === 'standalone' ? loadBakedFeed(id) : fetch(`/api/feed/${id}`).then(async (r) => {
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    const meta = { time: r.headers.get('x-feed-time'), credit: decodeURIComponent(r.headers.get('x-feed-credit') || ''), disk: Number(r.headers.get('x-feed-disk')) || null };
    const texture = await new Promise((res) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
    if (!texture) return null;
    liveInfo.set(id, meta);
    return { texture, ...meta };
  }).catch(() => null));
  live.set(id, { p, at: Date.now() });
  return p;
}

/** The standalone preview: a feed's baked copy (src/data/bandbake.js, #28), with its real date and size; null if none was baked. */
function loadBakedFeed(id) {
  const b = bakedFeed(id);
  if (!b) return Promise.resolve(null);
  return new Promise((res) => loader.load(b.src, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null))).then((texture) => {
    if (!texture) return null;
    const meta = { time: b.time ?? null, credit: b.credit ?? '', disk: b.disk ?? null, baked: b };
    liveInfo.set(id, meta);
    return { texture, ...meta };
  });
}

/** Apply a body's live skin (Earth: daily global mosaic; Sun: full-disk image) if enabled. */
export function applyLiveSkin(material, skin, enabled) {
  if (!skin?.live) return Promise.resolve(null);
  if (!enabled) { material.uniforms.uHasLive && (material.uniforms.uHasLive.value = 0); material.uniforms.uHasDisk && (material.uniforms.uHasDisk.value = 0); return Promise.resolve(null); }
  return loadLive(skin.live, skin.liveDisk ? 15 * 60000 : 6 * 3600000).then((l) => {
    if (!l) return null;
    if (skin.liveDisk) {
      material.uniforms.uDisk.value = l.texture;
      material.uniforms.uHasDisk.value = 1;
      if (l.disk) material.uniforms.uDiskR.value = l.disk;
    } else {
      material.uniforms.uLive.value = l.texture;
      material.uniforms.uHasLive.value = 1;
    }
    return l;
  });
}
