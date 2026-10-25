// ---------------------------------------------------------------------------
// Storefront filtering, sorting, search and recommendations.
// URL parameters follow Shopify's Search & Discovery format, e.g.
//   /collections/womens?filter.v.option.size=M%20%2F%2012&filter.p.m.custom.fabric=Satin
//   &filter.v.availability=1&filter.v.price.gte=20&filter.v.price.lte=60&sort_by=price-ascending
// Shopify computes these with roaring-bitmap indexes ("product-filtering-backend:
// bitset_roaring" header); here a simple in-memory pass does the same job.
// ---------------------------------------------------------------------------
import { PRODUCTS, COLLECTIONS, productsIn, byId, PAGES } from './catalog.js';

export const FACETS = [
  { param: 'filter.p.m.custom.cut', label: 'Style', get: (p) => [p.metafields.custom.cut] },
  { param: 'filter.v.option.size', label: 'Size', get: (p) => p.variants.filter((v) => v.available).map((v) => v.option1) },
  { param: 'filter.p.m.custom.fabric', label: 'Fabric', get: (p) => [p.metafields.custom.fabric].filter(Boolean) },
  { param: 'filter.v.option.color', label: 'Colour', get: (p) => [...new Set(p.variants.map((v) => v.option2).filter(Boolean))] },
  { param: 'filter.p.m.custom.print', label: 'Print', get: (p) => [p.metafields.custom.print].filter(Boolean) },
];

export const SORTS = [
  ['manual', 'Featured'], ['best-selling', 'Best selling'], ['title-ascending', 'Alphabetically, A–Z'],
  ['price-ascending', 'Price, low to high'], ['price-descending', 'Price, high to low'], ['created-descending', 'Date, new to old'],
];

const min = (p) => Math.min(...p.variants.map((v) => v.price));
const getAll = (q, k) => [].concat(q[k] ?? []).filter(Boolean);

function passes(p, q, skipParam) {
  for (const f of FACETS) {
    if (f.param === skipParam) continue;
    const wanted = getAll(q, f.param);
    if (wanted.length && !f.get(p).some((v) => wanted.includes(v))) return false;
  }
  if (q['filter.v.availability'] === '1' && !p.variants.some((v) => v.available)) return false;
  const gte = parseFloat(q['filter.v.price.gte']), lte = parseFloat(q['filter.v.price.lte']);
  if (!Number.isNaN(gte) && min(p) < gte * 100) return false;
  if (!Number.isNaN(lte) && min(p) > lte * 100) return false;
  return true;
}

export function filterCollection(handle, q, perPage = 24) {
  const base = productsIn(handle);
  const results = base.filter((p) => passes(p, q));
  // facet counts: each facet is counted with every *other* filter applied (standard faceting)
  const facets = FACETS.map((f) => {
    const pool = base.filter((p) => passes(p, q, f.param));
    const counts = new Map();
    for (const p of pool) for (const v of new Set(f.get(p))) counts.set(v, (counts.get(v) || 0) + 1);
    const active = getAll(q, f.param);
    const order = f.param === 'filter.v.option.size' ? (a, b) => sizeRank(a) - sizeRank(b) : (a, b) => a.localeCompare(b);
    return { ...f, values: [...new Set([...counts.keys(), ...active])].sort(order).map((v) => ({ value: v, count: counts.get(v) || 0, active: active.includes(v) })) };
  }).filter((f) => f.values.length > 1 || f.values.some((v) => v.active));
  const prices = base.map(min);
  const sort = q.sort_by || 'manual';
  const sorted = [...results].sort({
    'best-selling': (a, b) => (b.sales_count - a.sales_count) || (Number(b.tags.includes('best seller')) - Number(a.tags.includes('best seller'))),
    'title-ascending': (a, b) => a.title.localeCompare(b.title),
    'price-ascending': (a, b) => min(a) - min(b),
    'price-descending': (a, b) => min(b) - min(a),
    'created-descending': (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  }[sort] || (() => 0));
  const page = Math.max(1, parseInt(q.page || '1', 10));
  return {
    total: sorted.length, page, pages: Math.max(1, Math.ceil(sorted.length / perPage)),
    products: sorted.slice((page - 1) * perPage, page * perPage), facets, sort,
    price: { min: Math.floor(Math.min(...prices, 0) / 100), max: Math.ceil(Math.max(...prices, 0) / 100), gte: q['filter.v.price.gte'] || '', lte: q['filter.v.price.lte'] || '' },
    availability: q['filter.v.availability'] === '1',
  };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
function sizeRank(s) {
  const k = SIZE_ORDER.indexOf(s.split(' / ')[0].split('-')[0]);
  if (k >= 0) return k;
  const n = parseInt(s, 10); return Number.isNaN(n) ? 100 : 20 + n;
}

/* ---------------- search ---------------- */
const norm = (s) => String(s || '').toLowerCase();
function score(p, terms) {
  const hay = [p.title, p.product_type, p.tags.join(' '), p.metafields.custom?.print, p.metafields.custom?.fabric, p.metafields.custom?.cut].map(norm).join(' ');
  let s = 0;
  for (const t of terms) { if (!hay.includes(t)) return 0; s += norm(p.title).includes(t) ? 3 : 1; }
  return s;
}
export function search(q, limit = 48) {
  q = String(q || '').slice(0, 80);
  const terms = norm(q).split(/\s+/).filter(Boolean).map((t) => t.replace(/s$/, ''));
  if (!terms.length) return [];
  return PRODUCTS.map((p) => [p, score(p, terms)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([p]) => p);
}

/** GET /search/suggest.json?q=…  — predictive search (same response shape as Shopify) */
export function suggest(q) {
  const products = search(q, 6);
  const t = norm(q);
  return {
    resources: {
      results: {
        queries: products.length ? [...new Set(products.map((p) => p.metafields.custom?.print).filter(Boolean))].slice(0, 3).map((pr) => ({ text: pr, url: `/search?q=${encodeURIComponent(pr)}` })) : [],
        products: products.map((p) => ({ id: p.id, title: p.title, handle: p.handle, url: `/products/${p.handle}`, image: p.images[0].src, price: (Math.min(...p.variants.map((v) => v.price)) / 100).toFixed(2), available: p.variants.some((v) => v.available), type: p.product_type })),
        collections: COLLECTIONS.filter((c) => t && norm(c.title).includes(t)).slice(0, 3).map((c) => ({ title: c.title, handle: c.handle, url: `/collections/${c.handle}` })),
        pages: Object.entries(PAGES).filter(([, pg]) => t && norm(pg.title).includes(t)).map(([h, pg]) => ({ title: pg.title, url: `/pages/${h}` })),
      },
    },
  };
}

/** GET /recommendations/products.json?product_id=…&limit=4 — "You may also like" */
export function recommend(productId, limit = 4) {
  const p = byId.get(Number(productId));
  if (!p) return [];
  const sameType = PRODUCTS.filter((q) => q !== p && q.product_type === p.product_type);
  const samePrint = PRODUCTS.filter((q) => q !== p && q.metafields.custom.print === p.metafields.custom.print);
  const fallback = PRODUCTS.filter((q) => q !== p && q.metafields.custom.audience === p.metafields.custom.audience);
  return [...new Set([...samePrint, ...sameType, ...fallback])].filter((q) => q.product_type !== 'Gift Box').slice(0, limit);
}
