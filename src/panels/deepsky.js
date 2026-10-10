// SELECTED block of the Quadrant View panel for nebulae and star clusters (#24): the base facts,
// the real image (credit, licence, date, orientation: MEASURED), the 3D shape (MODELLED), the
// stars inside that can be investigated, and a cluster's Gaia DR3 member swarm.

import { NEBULA_KIND } from '../data/deepsky.js';
import { LY_PER_PC } from '../astro/frames.js';
import { physicalSize } from '../astro/skyplane.js';

const IMG_STATE = { idle: 'LOADS WHEN YOU FLY CLOSER', loading: 'LOADING…', failed: 'COULD NOT BE LOADED', unavailable: 'NEEDS THE LOCAL BACKEND (NOT IN THE STANDALONE PREVIEW)' };

export function deepSkyDetail({ h, factList, fmt, lyText, lightLeft, sel, detail }) {
  if (!sel) return [];
  const out = [h('h3', { textContent: 'SELECTED' }), h('h2', { className: 'sel-name', textContent: sel.name.toUpperCase() })];
  const isCluster = sel.kind.endsWith('cluster') || sel.kind === 'moving group';
  const neb = detail?.neb, swarm = detail?.swarm;
  if (isCluster) {
    const facts = [
      { label: 'TYPE', value: sel.kind.toUpperCase(), tier: 'measured', detail: sel.catalogue },
      { label: 'DISTANCE', value: lyText(sel.distLy), tier: 'measured', detail: 'Mean Gaia DR3 parallax of its member stars (Hunt & Reffert 2023).' },
      { label: 'MEMBERS', value: fmt(sel.members, 0), tier: 'measured', detail: 'Stars Gaia assigns to it.' },
      sel.r50pc ? { label: 'HALF-MEMBER RADIUS', value: `${fmt(sel.r50pc * LY_PER_PC, 1)} LY`, tier: 'computed', detail: 'r50: the radius holding half its members, from their positions and the cluster distance (Hunt & Reffert 2023).' } : null,
      { label: 'AGE', value: sel.logAge != null ? `${fmt(10 ** sel.logAge / 1e6, 10 ** sel.logAge > 1e9 ? 0 : 1)} MILLION YEARS` : '—', tier: 'modelled', detail: 'Isochrone fit to its stars\' colours and brightnesses.' },
      { label: 'LIGHT', value: lightLeft(sel.distLy), tier: 'computed' },
    ];
    if (swarm?.state === 'ready') {
      const d = swarm.data;
      facts.push(
        { label: 'STARS DRAWN', value: `${fmt(d.shown, 0)} OF ${fmt(d.total, 0)}`, tier: 'measured', detail: `The brightest Gaia DR3 members (VizieR J/A+A/673/A114/members) at their measured directions, Gaia G brightness and BP−RP colour (dereddened by the cluster's A_V = ${fmt(d.av ?? 0, 2)} mag; colour → temperature by Mucciarelli & Bellazzini 2020). Members outside the tidal radius (${fmt(d.shown - (d.inTidal ?? d.shown), 0)} of those drawn: corona and tails) are drawn fainter.` },
        { label: 'DEPTH FROM PARALLAX', value: `${fmt(swarm.measured, 0)} STARS`, tier: 'measured', detail: 'Stars whose own parallax pins their distance to better than the cluster\'s size: drawn where it puts them (shrunk slightly toward the cluster).' },
        { label: 'DEPTH MODELLED', value: `${fmt(d.shown - swarm.measured, 0)} STARS`, tier: 'modelled', detail: 'A single parallax can\'t place these along the line of sight: they get a reproducible scatter as deep as the cluster is wide. Their direction on the sky is still measured.' });
      if (swarm.glow) facts.push({ label: 'CORE GLOW', value: 'UNRESOLVED STARS', tier: 'modelled', detail: 'The dense core of a globular holds far more stars than are drawn: a glow sized by r50 stands for them.' });
    }
    out.push(factList(facts.filter(Boolean)));
    out.push(h('p', { className: 'note', textContent: !swarm ? 'MEMBER STARS LOAD AS YOU FLY CLOSER.' : swarm.state === 'loading' ? 'LOADING GAIA DR3 MEMBERS…' : swarm.state === 'ready' ? 'CLICK ANY MEMBER STAR TO INVESTIGATE IT.' : swarm.state === 'empty' ? 'NO MEMBER LIST FOR THIS CLUSTER.' : 'MEMBER STARS NEED THE LOCAL BACKEND (NOT IN THE STANDALONE PREVIEW).' }));
  } else {
    out.push(factList([
      { label: 'TYPE', value: NEBULA_KIND[sel.kind], tier: 'measured' },
      { label: 'DISTANCE', value: lyText(sel.distLy), tier: 'measured', detail: 'Literature distance (parallaxes of associated stars, expansion or extinction).' },
      { label: 'LIGHT', value: lightLeft(sel.distLy), tier: 'computed' },
    ]));
    if (sel.note) out.push(h('p', { className: 'note', textContent: sel.note }));
  }
  if (neb) {
    const { img, model } = neb.spec;
    const across = physicalSize(2 * model.R, neb.distLy);
    out.push(h('h3', { textContent: isCluster ? 'NEBULOSITY' : 'IMAGE & 3D SHAPE' }), factList([
      { label: 'IMAGE', value: `${img.what.toUpperCase()}${img.date ? ` · ${img.date}` : ''}${model.dust ? ' · SETS THE DUST DENSITY' : ''}`, tier: 'measured',
        detail: `${img.credit}\nLicence: ${img.licence}\nCentre RA ${fmt(img.ra, 3)}° Dec ${fmt(img.dec, 3)}°, ${fmt(img.fov[0], 2)}′ × ${fmt(img.fov[1], 2)}′; north ${img.north ? `${fmt(Math.abs(img.north), 1)}° ${img.north > 0 ? 'left' : 'right'} of vertical` : 'up'}. Drawn facing Sol, north aligned with celestial north.` },
      { label: 'SIZE', value: `${fmt(2 * model.R, 2 * model.R < 10 ? 1 : 0)}′ ≈ ${fmt(across, across < 10 ? 2 : 0)} LY ACROSS`, tier: 'computed', detail: 'Angular size × distance. The image itself spans ' + `${fmt(neb.widthLy, 1)} × ${fmt(neb.heightLy, 1)} ly.` },
      { label: '3D SHAPE', value: model.label, tier: 'modelled', detail: `${model.ref}\nFrom Sol the slices add back up to exactly the image; from anywhere else you see this model.` },
    ]));
    out.push(h('p', { className: 'note', textContent: neb.state === 'ready' ? `CREDIT: ${img.credit} · ${img.licence}` : `IMAGE ${IMG_STATE[neb.state] ?? ''}` }));
    out.push(h('div', { className: 'body-list' }, h('a', { className: 'pill', href: img.page, target: '_blank', rel: 'noopener', textContent: 'IMAGE SOURCE ↗' })));
  }
  if (detail?.stars?.length) {
    out.push(h('h3', { textContent: 'STARS INSIDE' }));
    out.push(h('div', { className: 'host-list' }, detail.stars.map((m) => {
      const b = h('button', { className: 'host-row', title: m.note }, h('span', { textContent: m.name.toUpperCase() }), h('span', { className: 'mono', textContent: 'INVESTIGATE ▸' }));
      b.addEventListener('click', () => m.pick());
      return b;
    })));
  }
  return out;
}
