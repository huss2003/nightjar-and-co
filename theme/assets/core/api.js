// ---------------------------------------------------------------------------
// Storefront API client — identical calls work on a real Shopify store.
// Cart writes go through a serial queue so rapid clicks can't race each other.
// ---------------------------------------------------------------------------
import { emit } from './events.js';

let chain = Promise.resolve();
const queue = (job) => (chain = chain.then(job, job));

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.description || data.message || `Request failed (${res.status})`); err.status = res.status; err.data = data; throw err; }
  return data;
}

/** Sections re-rendered with every cart change (Section Rendering API, bundled) */
export const CART_SECTIONS = ['quick-cart', 'cart-icon'];

export const cart = {
  get: () => request('/cart.js'),
  /** items: [{ id, quantity, properties }] */
  add: (items, sections = CART_SECTIONS) => queue(async () => {
    const data = await request('/cart/add.js', { method: 'POST', body: JSON.stringify({ items, sections: sections.join(',') }) });
    emit('cart:item-added', data);
    await refresh(data.sections);
    return data;
  }),
  change: (key, quantity) => queue(async () => {
    const data = await request('/cart/change.js', { method: 'POST', body: JSON.stringify({ id: key, quantity, sections: CART_SECTIONS.join(',') }) });
    await refresh(data.sections, data);
    return data;
  }),
  update: (body) => queue(async () => {
    const data = await request('/cart/update.js', { method: 'POST', body: JSON.stringify({ ...body, sections: CART_SECTIONS.join(',') }) });
    await refresh(data.sections, data);
    return data;
  }),
  discount: (code) => queue(async () => {
    const data = await request(`/discount/${encodeURIComponent(code || ' ')}?json=1`);
    await refresh(null, data.cart);
    return data;
  }),
};

/** Re-render cart sections (from a bundled response, or by fetching them) and notify listeners */
async function refresh(sections, cartJson) {
  if (!sections) sections = await sectionsFor(CART_SECTIONS);
  emit('sections:render', sections);
  emit('cart:updated', cartJson || (await cart.get()));
}

// cart/overlay sections render the same on any page, so ask the cart template for them
export const sectionsFor = (ids) => request(`/cart?sections=${ids.join(',')}`);
export const sectionHTML = (id, url = location.pathname) => fetch(`${url}${url.includes('?') ? '&' : '?'}section_id=${id}`).then((r) => r.text());
export const predictive = (q) => request(`/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product,collection,query,page&resources[limit]=6`);
export const subscribe = (email, source = 'popup') => request('/contact', { method: 'POST', body: JSON.stringify({ email, source, form_type: 'customer' }) });

/* Wishlist: stored server-side (per account, or per visitor until they log in) */
let wishlistIds = null;
export const wishlist = {
  ids: () => (wishlistIds ??= request('/wishlist.json').then((r) => new Set(r.ids.map(String))).catch(() => new Set())),
  toggle: async (productId) => {
    const r = await request('/wishlist', { method: 'POST', body: JSON.stringify({ product_id: Number(productId) }) });
    const set = await wishlist.ids();
    r.wished ? set.add(String(productId)) : set.delete(String(productId));
    emit('wishlist:updated', { count: r.count, set });
    return r;
  },
};
