import { bodyVisualFor } from '../../data/bespoke.js';
import { visualImageUrl } from '../../data/catalog.js';
import { badge } from '../../data/provenance.js';
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
};
const link = (href, textContent) => el('a', { href, textContent, target: '_blank', rel: 'noopener noreferrer' });
export function stellarResearchCards(body) {
  const visual = bodyVisualFor(body);
  if (visual?.kind !== 'star') return [];
  const images = [...(visual.contextImages ?? []).map(asset => [asset.label ?? 'NATIVE STELLAR OBSERVATION', asset]),
    [visual.surfaceLabel, visual.surfaceMap], [visual.skyLabel, visual.skyImage]];
  const cards = images.map(([title, asset]) => el('section', { className: 'sv-card stellar-image-card' },
    el('h3', { textContent: title }), badge(asset.tier),
    el('img', { src: visualImageUrl(asset), alt: `${visual.name}: ${asset.description ?? title}`, loading: 'lazy', style: 'display:block;max-width:100%;max-height:420px;object-fit:contain;margin:12px auto' }),
    el('p', { textContent: asset.description ?? asset.processing }),
    el('p', {}, asset.sourcePage ? link(asset.sourcePage, asset.credit) : asset.credit,
      asset.termsUrl ? [' · ', link(asset.termsUrl, asset.terms)] : [])));
  cards.push(el('section', { className: 'sv-card' }, el('h3', { textContent: 'STELLAR RESEARCH CONTEXT' }),
    [...visual.measured, ...(visual.modelled ?? []), ...visual.assumed, ...(visual.unknown ?? [])].map(textContent => el('p', { textContent })),
    el('p', { textContent: `Conceptual observer geometry: ${visual.skyModel.angularDiameterDeg.toFixed(3)}° stellar diameter. Field, colour, limb and exposure remain approximate.` }),
    visual.references.map(ref => el('p', {}, link(ref.url, ref.title), ref.publicationDate ? ` · ${ref.publicationDate}` : ''))));
  return cards;
}
