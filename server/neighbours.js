// Nearby objects the HYG catalogue misses because they are too faint for Hipparcos: the
// brown dwarfs found by WISE, among the Sun's closest neighbours. Astrometry from the
// discovery and follow-up papers, in the same record shape as parseHyg() produces.

const LY_PER_PC = 3.26156;
const DEG = Math.PI / 180;
const MJUP_PER_MSUN = 1047.57;

function record({ id, name, raDeg, decDeg, parallaxMas, spect, compPrimary = null, gl = null }) {
  const d = 1000 / parallaxMas;
  const c = Math.cos(decDeg * DEG);
  return {
    id, name, hip: null, hd: null, gl,
    x: d * c * Math.cos(raDeg * DEG), y: d * c * Math.sin(raDeg * DEG), z: d * Math.sin(decDeg * DEG),
    distPc: d, mag: null, absmag: null, spect, ci: null, lum: null,
    compPrimary, source: 'literature', brownDwarf: true,
  };
}

export const NEIGHBOURS = [
  // Luhman 2013 (ApJL 767, L1); parallax 501.557 mas, Bedin et al. 2024 (AN 345, e20230158).
  record({ id: 'bd-luhman-16a', name: 'Luhman 16A', raDeg: 162.32801, decDeg: -53.31941, parallaxMas: 501.557, spect: 'L7.5', gl: 'WISE J104915.57−531906.1' }),
  record({ id: 'bd-luhman-16b', name: 'Luhman 16B', raDeg: 162.32801, decDeg: -53.31941, parallaxMas: 501.557, spect: 'T0.5', compPrimary: 'bd-luhman-16a' }),
  // Luhman 2014 (ApJL 786, L18); parallax 439.0 mas, Luhman & Esplin 2016 (AJ 152, 78).
  record({ id: 'bd-wise-0855', name: 'WISE 0855−0714', raDeg: 133.79513, decDeg: -7.24514, parallaxMas: 439.0, spect: 'Y4', gl: 'WISE J085510.83−071442.5' }),
];

// Physical properties for single brown dwarfs (binaries carry theirs in binaries.js MEASURED).
export const BROWN_DWARF_PROPS = {
  'bd-wise-0855': {
    ref: 'Luhman et al. 2024 (JWST NIRSpec); Luhman & Esplin 2016',
    props: { teff: 285, radiusSun: 0.1, massJup: '3–10', brownDwarf: true,
      note: 'The coldest known brown dwarf, about the temperature of a freezing day on Earth. JWST found water, methane, carbon monoxide, carbon dioxide and ammonia in its atmosphere.' },
  },
};

export const mJup = (m) => m / MJUP_PER_MSUN;
export { LY_PER_PC };
