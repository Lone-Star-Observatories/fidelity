// MAGNETIC FIELD (#38) section for body panels: surface strength, dipole tilt and offset, polarity,
// magnetopause stand-off (Earth's live from the solar wind) and bow shock, each with its tier and
// source; crustal-field notes for Mars and the Moon; and the colour scale of the MAG FIELDS layer.

import { MAGNETIC, CRUSTAL, shue, dynamicPressure } from '../astro/magnetic.js';
import { STRENGTH_SCALE } from '../views/system/magfields.js';
import { fetchFeed } from '../data/catalog.js';

const nT = (b) => (b >= 1e5 ? `${(b / 1e5).toFixed(2)} G (${Math.round(b).toLocaleString('en')} nT)` : `${Math.round(b).toLocaleString('en')} nT`);

export function createMagneticPanel({ h, row, settings, system }) {
  let live = null, lastFetch = 0;

  /** Refresh Earth's solar-wind drivers (density, speed, IMF Bz) from the live feeds, every 5 min. */
  async function refreshWind() {
    if (Date.now() - lastFetch < 5 * 60e3) return live;
    lastFetch = Date.now();
    try {
      const [sw, mag] = await Promise.all([fetchFeed('solar-wind', 'json'), fetchFeed('solar-mag', 'json')]);
      const w = sw?.data?.findLast?.((x) => x.proton_density != null && x.proton_speed != null), m = mag?.data?.findLast?.((x) => x.bz_gsm != null);
      if (w) {
        live = { Dp: dynamicPressure(w.proton_density, w.proton_speed), Bz: m?.bz_gsm ?? 0, n: w.proton_density, v: w.proton_speed, time: w.time_tag };
        system.setSolarWind(live);
      }
    } catch { /* offline: nominal conditions */ }
    return live;
  }

  /** The section for body `id`, or []. */
  function section(id) {
    const spec = MAGNETIC[id], crust = CRUSTAL[id];
    if (!spec && !crust) return [];
    const dl = h('dl');
    if (crust) {
      row(dl, 'GLOBAL FIELD', 'NONE', 'measured', 'No internal dynamo today.');
      row(dl, 'CRUSTAL FIELD', id === 'mars' ? 'MAGNETISED SOUTHERN CRUST' : 'LOCAL ANOMALIES', 'measured', crust.source);
      row(dl, 'LOOPS DRAWN', 'SCHEMATIC · HEIGHT ×3', 'imagined', 'Loops sit over the mapped anomalies but their shapes are illustrative and exaggerated for visibility.');
      return [h('h3', { textContent: 'MAGNETIC FIELD' }), dl, toggleNote()];
    }
    row(dl, 'SURFACE FIELD', `${nT(spec.B0)} AT THE EQUATOR`, id === 'earth' || id === 'jupiter' ? 'computed' : 'measured', `${spec.source}${id === 'earth' || id === 'jupiter' ? ' (from the degree-1 Gauss coefficients)' : ''}`);
    row(dl, 'DIPOLE TILT', `${spec.tiltDeg.toFixed(spec.tiltDeg < 1 ? 2 : 1)}° FROM THE SPIN AXIS`, 'measured', spec.source);
    if (spec.offset) row(dl, 'OFFSET', `${spec.offset[2].toFixed(2)} R FROM THE CENTRE`, id === 'earth' ? 'modelled' : 'measured', id === 'earth' ? 'Eccentric-dipole approximation (≈570 km).' : spec.source);
    row(dl, 'POLARITY', spec.momentNorth ? 'FIELD LEAVES THE NORTH, RETURNS IN THE SOUTH' : 'FIELD LEAVES THE SOUTH, RETURNS IN THE NORTH', 'measured',
      spec.momentNorth ? 'Like Jupiter and Saturn today: a compass needle\'s north end would point south.' : 'Like Earth today: a compass needle\'s north end points north (towards a magnetic south pole).');
    if (spec.phaseUnknown) row(dl, 'ROTATION PHASE', 'UNCERTAIN', 'modelled', 'The planet\'s interior rotation period is not known well enough to place the dipole\'s longitude today.');
    const sd = row(dl, 'MAGNETOPAUSE', `${spec.standoff} R UPSTREAM`, spec.live ? 'modelled' : 'measured', spec.live ? 'Shue et al. 1998 from the solar wind; nominal 2 nPa, Bz 0 until the live wind arrives.' : `Typical stand-off: ${spec.source}`);
    if (spec.bowShock) row(dl, 'BOW SHOCK', `${spec.live ? '~1.3 × MAGNETOPAUSE' : `${spec.bowShock} R UPSTREAM`}`, spec.live ? 'modelled' : 'measured', 'Conic bow shock; typical distance.');
    if (spec.upstream === 'flow') row(dl, 'FACES', 'JUPITER\'S COROTATING PLASMA', 'modelled', 'Ganymede orbits inside Jupiter\'s magnetosphere: the plasma overtakes it from behind, so its mini-magnetosphere faces its trailing side, with no bow shock.');
    if (spec.live) {
      const w = row(dl, 'SOLAR WIND', 'LOADING…', 'measured', 'DSCOVR / ACE at L1 via NOAA SWPC: proton density and speed give the dynamic pressure; IMF Bz.');
      refreshWind().then((l) => {
        const s = l ? shue(l.Dp, l.Bz) : shue(2, 0);
        sd.textContent = `${s.r0.toFixed(1)} R UPSTREAM${l ? '' : ' (NOMINAL)'}`;
        w.textContent = l ? `${l.v.toFixed(0)} KM/S · ${l.n.toFixed(1)} /CM³ · ${l.Dp.toFixed(2)} nPa · Bz ${l.Bz.toFixed(1)} nT` : 'UNAVAILABLE (NEEDS THE LOCAL BACKEND) · NOMINAL USED';
      });
    }
    return [h('h3', { textContent: 'MAGNETIC FIELD' }), dl, toggleNote()];
  }
  const toggleNote = () => h('p', { className: 'note', textContent: `${settings.get('fields') ? 'Shown' : 'Turn on MAG FIELDS to see'} the field lines (${STRENGTH_SCALE.label.toLowerCase()}; chevrons point along the field), the magnetopause (lilac) and the bow shock (apricot). At ENHANCED scale distances around the planet are compressed like its moons' orbits; TRUE scale shows them at full size.` });

  return { section, refreshWind };
}
