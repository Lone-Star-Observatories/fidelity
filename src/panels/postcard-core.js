// Postcards (#40): the parts that need no DOM (sizes, frame layout, provenance and caption text,
// share links, stylize prompts and cost) so they can be tested in Node.

import { APP_STORE } from '../appstore.js';

export const SIZES = [
  { id: 'square', label: 'SQUARE', w: 1080, h: 1080 },
  { id: 'story', label: 'STORY', w: 1080, h: 1920 },
  { id: 'landscape', label: 'LANDSCAPE', w: 1920, h: 1080 },
  { id: '4k', label: '4K', w: 3840, h: 2160 },
];

/**
 * Where things go on a w × h postcard. With the LCARS frame the render fills the inner rectangle
 * and the bars carry the stamps; without it the render fills the card and only a slim strip at the
 * foot carries the provenance and credits (those are never optional).
 */
export function frameLayout(w, h, framed) {
  const s = Math.min(w, h) / 1080;
  const r = (v) => Math.round(v * s);
  if (!framed) {
    const strip = r(64);
    return { s, inner: { x: 0, y: 0, w, h }, strip: { x: 0, y: h - strip, w, h: strip } };
  }
  const side = r(30), top = r(96), foot = r(150), gap = r(8);
  return {
    s, side, top, foot, gap,
    inner: { x: side + gap, y: top + gap, w: w - 2 * (side + gap), h: h - top - foot - 2 * gap },
  };
}

const ORDER = ['measured', 'reported', 'computed', 'modelled', 'imagined'];
const WORD = { measured: 'MEASURED', reported: 'REPORTED', computed: 'COMPUTED', modelled: 'MODELLED', imagined: 'IMAGINED' };
/** { measured: ['STARS'], imagined: ['SURFACE'] } → "STARS MEASURED · SURFACE IMAGINED" (tier order, duplicates dropped). */
export function provenanceLine(tiers) {
  const parts = [];
  for (const t of ORDER) for (const what of [...new Set(tiers?.[t] ?? [])]) parts.push(`${what} ${WORD[t]}`);
  return parts.join(' · ');
}
export const hasImagined = (tiers) => (tiers?.imagined ?? []).length > 0;

/** An offset from now in years → "+26,613 YEARS", "−1.2 MILLION YEARS", or null within a day of now. */
export function epochLabel(years) {
  if (!Number.isFinite(years) || Math.abs(years) < 1 / 365.25) return null;
  const sign = years > 0 ? '+' : '−', a = Math.abs(years);
  if (a >= 1e9) return `${sign}${+(a / 1e9).toFixed(2)} BILLION YEARS`;
  if (a >= 1e6) return `${sign}${+(a / 1e6).toFixed(2)} MILLION YEARS`;
  if (a >= 1) return `${sign}${Math.round(a).toLocaleString('en-US')} YEAR${Math.round(a) === 1 ? '' : 'S'}`;
  const d = Math.round(a * 365.25);
  return `${sign}${d} DAY${d === 1 ? '' : 'S'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A date for a caption: "10 Oct 2026", or the epoch beyond the calendar. */
export function captionDate(date, years) {
  if (date && Number.isFinite(date.getTime())) {
    const y = date.getUTCFullYear();
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${y < 1 ? `${1 - y} BCE` : y}`;
  }
  return epochLabel(years)?.toLowerCase() ?? '';
}

/** The caption: "<subject> · <date> · USS Fidelity", plus "(AI-stylized: <style>)" when it was. */
export function captionFor({ subject, date, years, stylized }) {
  const parts = [subject, captionDate(date, years), 'USS Fidelity'].filter(Boolean);
  return parts.join(' · ') + (stylized ? ` (AI-stylized by an image model: ${stylized.toLowerCase()}; not a photograph)` : '');
}

/** Share links that take text (none can attach an image from a URL: save the image, then attach it). */
export function shareLinks(text, url, { mastodon } = {}) {
  const t = encodeURIComponent(url ? `${text} ${url}` : text);
  const pub = url && /^https?:\/\//.test(url) && !/^https?:\/\/(localhost|127\.|\[::1\])/.test(url);
  const links = [
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${t}` },
    { id: 'bluesky', label: 'BLUESKY', href: `https://bsky.app/intent/compose?text=${t}` },
    { id: 'threads', label: 'THREADS', href: `https://www.threads.net/intent/post?text=${t}` },
    { id: 'reddit', label: 'REDDIT', href: `https://www.reddit.com/submit?type=TEXT&title=${encodeURIComponent(text.slice(0, 300))}${url ? `&text=${encodeURIComponent(url)}` : ''}` },
    // Facebook shares links only: with no public link, open it and paste the copied caption
    { id: 'facebook', label: 'FACEBOOK', href: pub ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` : 'https://www.facebook.com/', copy: !pub },
  ];
  const host = (mastodon ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  links.push({ id: 'mastodon', label: 'MASTODON', href: host && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host}/share?text=${t}` : null, needsServer: !host });
  return links;
}

// ---- AI stylize (opt-in, through the local backend) ---------------------------------------------
const KEEP = 'Keep the composition, the positions and the relative sizes of every body exactly. Day/night lines, phases and the direction of the light must not move. Do not add, remove or rename any object; add no text, logos or watermarks.';
const ALL_STYLES = [
  { id: 'photoreal', label: 'PHOTOREALISTIC', direction: 'Make this photorealistic, as if taken by a real camera: natural exposure, lens and sensor character, realistic noise.' },
  { id: 'trek', label: 'STAR TREK THEME', direction: 'Present it as if seen from a starship bridge viewscreen or console in a 24th-century look. Original design only: no franchise logos, ship designs, insignia or characters.' },
  { id: 'oil', label: 'OIL PAINTING', direction: 'Repaint it as a classical oil painting on canvas: visible brushwork and painterly light, keeping the scene\'s colours.' },
  { id: 'illustration', label: 'ILLUSTRATION', direction: 'Redraw it as a clean editorial space-art illustration in the manner of mid-century mission art: bold shapes, a limited palette.' },
  { id: 'technical', label: 'TECHNICAL', direction: 'Redraw it as a technical plate: blueprint or fine line-drawing style on a dark ground. Draw no text, numbers or labels at all: the app overlays its own.', ownLabels: true },
];
// The App Store build leaves out the franchise-named style (#51).
export const STYLES = APP_STORE ? ALL_STYLES.filter((s) => s.id !== 'trek') : ALL_STYLES;

/** The prompt for `style` from the scene's facts { view, subject, bodies[], date, lighting }. */
export function stylePrompt(styleId, f) {
  const st = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
  const facts = [
    f.view && `View: ${f.view}.`,
    f.subject && `Scene: ${f.subject}.`,
    f.bodies?.length && `Bodies in frame: ${f.bodies.join(', ')}.`,
    f.date && `Date: ${f.date}.`,
    f.lighting && `Lighting: ${f.lighting}.`,
  ].filter(Boolean).join(' ');
  return `${st.direction} ${KEEP} ${facts}`.trim();
}

/** The model size nearest the postcard's shape. */
export const editSize = (w, h) => (w / h > 1.2 ? '1536x1024' : h / w > 1.2 ? '1024x1536' : '1024x1024');

// Indicative US$ per image for gpt-image-1 output (OpenAI's published per-image prices, 2025); input
// image tokens add a little. Shown as an estimate: check current pricing.
const PRICE = { low: [0.011, 0.016], medium: [0.042, 0.063], high: [0.167, 0.25] };
export function costEstimate(quality, size) {
  const p = PRICE[quality] ?? PRICE.medium;
  return size === '1024x1024' ? p[0] : p[1];
}

/** A safe file name for a postcard: "fidelity-system-view-sol-2026-10-10.png". */
export function fileName(title, date, ext) {
  const slug = String(title || 'postcard').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const d = date && Number.isFinite(date.getTime()) ? `-${date.toISOString().slice(0, 10)}` : '';
  return `fidelity-${slug}${d}.${ext}`;
}
