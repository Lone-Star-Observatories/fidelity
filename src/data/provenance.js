// "Honest and fun": every value or visual on screen carries one of four badges so a
// viewer always knows what is observed, what is calculated, what is theory and what
// is artistic licence. See docs/concept.md §Honesty.

export const TIERS = {
  measured: { label: 'MEASURED', hint: 'Directly observed or measured by instruments.' },
  computed: { label: 'COMPUTED', hint: 'Calculated from measurements (orbits, positions, derived values).' },
  modelled: { label: 'MODELLED', hint: 'Theoretical model; not directly observed.' },
  imagined: { label: 'IMAGINED', hint: 'Artistic rendering or exaggeration for visibility.' },
};

export function badge(tier, detail = '') {
  const t = TIERS[tier];
  const el = document.createElement('span');
  el.className = `badge badge-${tier}`;
  el.textContent = t.label;
  el.title = detail ? `${t.hint}\n${detail}` : t.hint;
  return el;
}
