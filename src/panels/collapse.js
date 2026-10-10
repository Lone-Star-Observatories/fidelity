// Collapsible panel sections: every <h3> in the right panel folds away what follows it (up to the
// next heading). Folded sections are remembered by title (the part before any " · " detail).

const keyOf = (h3) => h3.textContent.split(' · ')[0].trim();

export function collapsibleSections(panelEl, settings) {
  const folded = () => new Set(settings.get('collapsedSections') ?? []);
  function apply() {
    const set = folded();
    for (const h3 of panelEl.querySelectorAll('h3')) {
      const shut = set.has(keyOf(h3));
      if (!h3.classList.contains('sec-head')) { h3.classList.add('sec-head'); h3.tabIndex = 0; h3.setAttribute('role', 'button'); }
      h3.classList.toggle('shut', shut);
      h3.setAttribute('aria-expanded', String(!shut));
      for (let el = h3.nextElementSibling; el && !/^H[23]$/.test(el.tagName); el = el.nextElementSibling) el.classList.toggle('sec-folded', shut);
    }
  }
  const toggle = (h3) => {
    const set = folded(), k = keyOf(h3);
    if (set.has(k)) set.delete(k); else set.add(k);
    settings.set('collapsedSections', [...set]);
    apply();
  };
  panelEl.addEventListener('click', (e) => { const h3 = e.target.closest('h3.sec-head'); if (h3 && panelEl.contains(h3)) toggle(h3); });
  panelEl.addEventListener('keydown', (e) => {
    const h3 = e.target.closest?.('h3.sec-head');
    if (h3 && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(h3); }
  });
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; apply(); }); } })
    .observe(panelEl, { childList: true, subtree: true });
  apply();
}
