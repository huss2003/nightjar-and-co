// Liquid-style filters and small render helpers used by every section.
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (pence) => `£${(pence / 100).toFixed(2)}`;              // {{ price | money }}
export const moneyShort = (pence) => (pence % 100 === 0 ? `£${pence / 100}` : money(pence));
export const attrs = (o) => Object.entries(o).filter(([, v]) => v !== false && v != null).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');
export const json = (v) => esc(JSON.stringify(v));                            // {{ x | json }} safe in attributes
export const productUrl = (p, v) => `/products/${p.handle}${v ? `?variant=${v.id}` : ''}`;

/**
 * Responsive, lazy, animated image (like Stiletto's image snippet).
 * The wrapper gets .loaded when the image decodes → CSS reveal (§4.2 in design.md).
 */
// Lifestyle photography (free Unsplash licence). Templates refer to them as "photo:<key>".
export const PHOTOS = {
  'night-bed': '1552858725-2758b5fb1286', bedside: '1552858725-a19e7fcd3ac4', 'morning-bed': '1536349788264-1b816db3cc13',
  stripes: '1766056278967-c0646b1bfd67', 'pink-set': '1768696082668-411638a55476', 'blue-set': '1768696082915-bdc6774f94c7',
  tartan: '1604936509922-a0ae4fd19e3e', kid: '1573258517406-4a3824f3a476', palette: '1577941796491-999f99ba658f',
  painting: '1510832842230-87253f48d74f', lamp: '1585128719715-46776b56a0d1', linen: '1564019472231-4586c552dc27',
};
export const photoUrl = (key, w = 1600) => `https://images.unsplash.com/photo-${PHOTOS[key] || PHOTOS.linen}?auto=format&fit=crop&w=${w}&q=72`;
export function resolveSrc(src) {
  if (!String(src).startsWith('photo:')) return { src };
  const key = src.slice(6);
  return { src: photoUrl(key, 1400), srcset: [480, 800, 1200, 1800, 2400].map((w) => `${photoUrl(key, w)} ${w}w`).join(', ') };
}

export function image(src, { alt = '', ratio = 4 / 3, animate = true, eager = false, cls = '', sizes = '100vw', fit = 'cover', pos = '' } = {}) {
  const r = resolveSrc(src);
  return `<div class="image ${animate ? 'image--animate' : ''} ${cls}" style="--aspect:${(1 / ratio).toFixed(5)}">
    <img class="image__img" src="${esc(r.src)}" ${r.srcset ? `srcset="${esc(r.srcset)}" sizes="${sizes}"` : ''} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="object-fit:${fit}${pos ? `;object-position:${pos}` : ''}"
      onload="this.closest('.image').classList.add('loaded')">
  </div>`;
}

export const icon = (name, size = 20) => {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    cart: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    gift: '<rect x="4" y="9" width="16" height="11"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 0 6-1.5S14 5 12 9"/>',
    filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="none"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    return: '<path d="M9 7 5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-3"/>',
    quality: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7l-4-3.9L9.5 8z"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    moon: '<path d="M16 3.5a9 9 0 1 0 4.5 15.4A10 10 0 0 1 16 3.5z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  };
  return `<svg class="icon icon--${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};

export const stars = (rating, count) => (count ? `<span class="stars-pill" aria-label="Rated ${Number(rating).toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}">${icon('star', 10)}<span>${Number(rating).toFixed(1)}</span></span>` : '');
export const starRow = (rating, size = 14) => `<span class="star-row" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= Math.round(rating) ? 'is-on' : ''}">${icon('star', size)}</span>`).join('')}</span>`;
export const logo = (name) => `<span class="logo">${icon('moon', 20)}<span>${esc(name)}</span></span>`;

/** Price snippet: sale price + compare-at + % badge */
export function price(p) {
  const prices = p.variants.map((v) => v.price), min = Math.min(...prices), max = Math.max(...prices);
  const cmp = p.variants.find((v) => v.compare_at_price && v.compare_at_price > v.price);
  const pct = cmp ? Math.round((1 - cmp.price / cmp.compare_at_price) * 100) : 0;
  return `<div class="price ${cmp ? 'price--sale' : ''}">
    <span class="price__current">${min !== max ? 'From ' : ''}${money(min)}</span>
    ${cmp ? `<s class="price__compare">${money(cmp.compare_at_price)}</s><span class="price__badge">${pct}% off</span>` : ''}
  </div>`;
}

/** Animated stagger index for children (Stiletto sets --delay-offset-multiplier in JS; we can also set it server-side) */
export const d = (i) => `style="--delay-offset-multiplier:${i}"`;
