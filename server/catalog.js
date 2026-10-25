// ---------------------------------------------------------------------------
// Catalog: static store config (collections, menus, pages, shipping) plus an
// in-memory cache of the products/variants/discounts held in Postgres.
//
// Render code is synchronous (like Liquid), so each server instance keeps the
// active catalog in memory and reloads it when `meta.catalog_version` changes.
// Every write that affects the storefront (admin edits, stock changes on
// orders, new reviews) bumps that version. Stock is always re-checked against
// the database inside a transaction at checkout, so the cache can never oversell.
// ---------------------------------------------------------------------------
import { q, getMeta } from './db.js';

export const SHOP = {
  id: 1000001,
  name: 'Nightjar & Co.',
  description: 'Print-led pyjamas and sleepwear for slow nights, drawn by hand in our London studio.',
  currency: 'GBP',
  money_format: '£{{amount}}',
  free_shipping_threshold: 6000, // pence
  email: 'hello@nightjar.example',
};

/* ---------------- live catalog cache ---------------- */
export let PRODUCTS = [];
export let byHandle = new Map();
export let byId = new Map();
export let variantById = new Map();
export let DISCOUNTS = {};
let loadedVersion = null;
let loading = null;

const iso = (d) => (d instanceof Date ? d.toISOString() : d);
export const isAvailable = (v) => !v.inventory_management || v.inventory_policy === 'continue' || v.inventory_quantity > 0;

export function shapeProduct(p, vs) {
  const variants = vs.map((v) => ({ ...v, available: isAvailable(v), requires_shipping: true, taxable: true, barcode: null }));
  return { ...p, created_at: iso(p.created_at), updated_at: iso(p.updated_at), published_at: iso(p.created_at), variants };
}

export async function refreshCatalog(force = false) {
  const v = await getMeta('catalog_version', 0);
  if (!force && loadedVersion !== null && String(v) === String(loadedVersion)) return false;
  loading ??= (async () => {
    const [ps, vs, ds] = await Promise.all([
      q("select * from products where status = 'active' order by created_at desc, id"),
      q("select v.* from variants v join products p on p.id = v.product_id where p.status = 'active' order by v.product_id, v.position"),
      q('select * from discounts'),
    ]);
    const byProduct = new Map();
    for (const row of vs) { if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []); byProduct.get(row.product_id).push(row); }
    const products = ps.map((p) => shapeProduct(p, byProduct.get(p.id) || [])).filter((p) => p.variants.length);
    for (const p of products) p.siblings = products.filter((o) => o.product_type === p.product_type && o !== p).slice(0, 3).map((o) => o.handle);
    PRODUCTS = products;
    byHandle = new Map(products.map((p) => [p.handle, p]));
    byId = new Map(products.map((p) => [p.id, p]));
    variantById = new Map(products.flatMap((p) => p.variants.map((x) => [x.id, { variant: x, product: p }])));
    DISCOUNTS = Object.fromEntries(ds.map((d) => [d.code, { ...d, title: d.code }]));
    loadedVersion = v;
  })().finally(() => { loading = null; });
  await loading;
  return true;
}

/* ---------------- prints & product types (used by the seed and the admin "new product" form) ---------------- */
export const PRINTS = [
  { name: 'Moth & Moon', pattern: 'moth', colors: ['#2a2238', '#e8dcc4', '#b9a0cf'], color: 'Midnight' },
  { name: 'Midnight Gingham', pattern: 'gingham', colors: ['#f5f1ea', '#3f4a6b', '#3f4a6b'], color: 'Navy' },
  { name: 'Nightjar Feather', pattern: 'feather', colors: ['#3a3046', '#c9a96e', '#e9dfcf'], color: 'Plum' },
  { name: 'Night Garden', pattern: 'floral', colors: ['#f2edf4', '#7d5e98', '#5a7a63'], color: 'Lilac' },
  { name: 'Lantern Stripe', pattern: 'stripe', colors: ['#f7f0e6', '#b5653f', '#e6b77f'], color: 'Ochre' },
  { name: 'Pear & Owl', pattern: 'fruit', colors: ['#f1ede0', '#8fa25a', '#6b4f3a'], color: 'Ecru' },
  { name: 'Fox at Dusk', pattern: 'spots', colors: ['#334a4a', '#d98a4e', '#1d1b24'], color: 'Teal' },
  { name: 'Comet Toile', pattern: 'toile', colors: ['#f6f3ec', '#3b3f78', '#9aa3d6'], color: 'Ivory' },
  { name: 'Cherry Nightcap', pattern: 'cherry', colors: ['#fbf4ee', '#9e2b3b', '#4d6b42'], color: 'Cream' },
  { name: 'Celestial Map', pattern: 'stars', colors: ['#1c2340', '#e3c77a', '#efe6d2'], color: 'Navy' },
  { name: 'Mushroom Hollow', pattern: 'dots', colors: ['#3b3530', '#d9ccb6', '#9d8a70'], color: 'Charcoal' },
  { name: 'Patchwork Sky', pattern: 'patch', colors: ['#efe8dc', '#8aa7c4', '#c98e74'], color: 'Natural' },
];

export const WOMEN = ['XS / 8', 'S / 10', 'M / 12', 'L / 14-16', 'XL / 18-20', 'XXL / 20-22', '3XL / 22-24'];
export const MEN = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const KIDS = ['1-2Y', '3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y', '13Y'];
export const ONE = ['One Size'];

// product_type = audience + fabric + cut (design.md §7.2)
export const TYPES = [
  { type: 'Womens Cotton Traditional Pyjamas', audience: 'womens', fabric: 'Cotton', cut: 'Traditional Long', price: 5200, sizes: WOMEN, points: 3, noun: 'Cotton Pyjama Set' },
  { type: 'Womens Oversize Long Leg Pyjamas', audience: 'womens', fabric: 'Linen Blend', cut: 'Oversized', price: 6800, sizes: WOMEN, points: 3, noun: 'Linen Blend Oversized Set' },
  { type: 'Womens Satin Traditional Pyjamas', audience: 'womens', fabric: 'Satin', cut: 'Traditional Long', price: 6400, sizes: WOMEN, points: 3, noun: 'Satin Pyjama Set' },
  { type: 'Womens Capri Pyjamas', audience: 'womens', fabric: 'Cotton', cut: 'Capri', price: 4600, sizes: WOMEN, points: 2, noun: 'Cotton Capri Set' },
  { type: 'Womens Boxy Pyjamas', audience: 'womens', fabric: 'Brushed Cotton', cut: 'Boxy', price: 5800, sizes: WOMEN, points: 3, noun: 'Brushed Cotton Boxy Set' },
  { type: 'Womens Cotton Night Dress', audience: 'womens', fabric: 'Cotton', cut: 'Nightdress', price: 5000, sizes: WOMEN, points: 2, noun: 'Cotton Nightdress' },
  { type: 'Womens Satin Robes', audience: 'womens', fabric: 'Satin', cut: 'Robe', price: 6200, sizes: ['XS-S', 'M-L', 'XL-3XL'], points: 3, noun: 'Satin Robe' },
  { type: 'Womens Cotton Shortie Pyjamas', audience: 'womens', fabric: 'Cotton', cut: 'Short', price: 4200, sizes: WOMEN, points: 2, noun: 'Cotton Shortie Set' },
  { type: 'Mens Long Pyjamas', audience: 'mens', fabric: 'Cotton', cut: 'Traditional Long', price: 6200, sizes: MEN, points: 3, noun: 'Mens Cotton Pyjama Set' },
  { type: 'Kids Traditional Pyjamas', audience: 'kids', fabric: 'Cotton', cut: 'Traditional Long', price: 2900, sizes: KIDS, points: 2, noun: 'Kids Cotton Pyjamas' },
  { type: 'Eye Masks', audience: 'accessories', fabric: 'Satin', cut: 'Eye Mask', price: 1600, sizes: ONE, points: 1, noun: 'Satin Eye Mask' },
  { type: 'Cosmetic Bag', audience: 'accessories', fabric: 'Cotton', cut: 'Wash Bag', price: 2200, sizes: ONE, points: 1, noun: 'Wash Bag' },
];

/* ---------------- smart collections (rules, like Shopify's automated collections) ---------------- */
const isSale = (p) => p.variants.some((v) => v.compare_at_price && v.compare_at_price > v.price);
const minPrice = (p) => Math.min(...p.variants.map((v) => v.price));
const c = (handle, title, rule, description = '') => ({ handle, title, rule, description });
const audience = (p) => p.metafields.custom?.audience;

export const COLLECTIONS = [
  c('all', 'All sleepwear', (p) => p.product_type !== 'Gift Box'),
  c('new-in', 'New In', (p) => p.tags.includes('new'), 'The latest prints, fresh from the drawing table.'),
  c('best-sellers', 'Best Sellers', (p) => p.tags.includes('best seller'), 'The pieces our night owls come back for.'),
  c('sale', 'The Dusk Sale', isSale, 'Up to 20% off selected prints, while sizes last.'),
  c('womens', 'Womens', (p) => audience(p) === 'womens'),
  c('womens-pyjamas', 'Womens Pyjamas', (p) => audience(p) === 'womens' && /Pyjama/.test(p.product_type)),
  c('mens', 'Mens', (p) => audience(p) === 'mens'),
  c('kids', 'Kids', (p) => audience(p) === 'kids', 'Bedtime prints for small night owls. 10% of kids profits go to children’s reading charities.'),
  c('accessories', 'Accessories', (p) => audience(p) === 'accessories'),
  c('nightdresses', 'Nightdresses', (p) => p.metafields.custom?.cut === 'Nightdress'),
  c('robes', 'Robes', (p) => p.metafields.custom?.cut === 'Robe'),
  c('cotton', 'Cotton', (p) => p.metafields.custom?.fabric === 'Cotton'),
  c('satin', 'Satin', (p) => p.metafields.custom?.fabric === 'Satin'),
  c('linen-blend', 'Linen Blend', (p) => p.metafields.custom?.fabric === 'Linen Blend'),
  c('brushed-cotton', 'Brushed Cotton', (p) => p.metafields.custom?.fabric === 'Brushed Cotton'),
  c('gingham', 'Gingham', (p) => p.metafields.custom?.pattern === 'gingham'),
  c('night-sky', 'Night Sky Prints', (p) => ['stars', 'moth', 'toile'].includes(p.metafields.custom?.pattern), 'Moons, moths and comets.'),
  c('gifts-under-25', 'Gifts under £25', (p) => minPrice(p) <= 2500 && p.product_type !== 'Gift Box'),
  c('gifts-under-50', 'Gifts under £50', (p) => minPrice(p) <= 5000 && p.product_type !== 'Gift Box'),
  c('gifting', 'Gifting', (p) => p.tags.includes('gifting') || audience(p) === 'accessories'),
].map((col, i) => ({ ...col, id: 900000 + i }));
export const collectionByHandle = new Map(COLLECTIONS.map((col) => [col.handle, col]));
export const productsIn = (handle) => {
  const col = collectionByHandle.get(handle);
  return col ? PRODUCTS.filter(col.rule) : [];
};

/* ---------------- navigation ---------------- */
export const MENU = [
  { title: 'The Dusk Sale', url: '/collections/sale', accent: true },
  { title: 'New In', url: '/collections/new-in' },
  {
    title: 'Womens', url: '/collections/womens', mega: true, promo: { title: 'Linen blend sets', url: '/collections/linen-blend', image: 'photo:linen' },
    columns: [
      { title: 'Shop by style', links: [['Pyjama sets', '/collections/womens-pyjamas'], ['Nightdresses', '/collections/nightdresses'], ['Robes', '/collections/robes'], ['All womens', '/collections/womens']] },
      { title: 'Shop by fabric', links: [['Cotton', '/collections/cotton'], ['Brushed cotton', '/collections/brushed-cotton'], ['Satin', '/collections/satin'], ['Linen blend', '/collections/linen-blend']] },
      { title: 'Shop by print', links: [['Night sky prints', '/collections/night-sky'], ['Gingham', '/collections/gingham'], ['Best sellers', '/collections/best-sellers']] },
    ],
  },
  { title: 'Mens', url: '/collections/mens' },
  { title: 'Kids', url: '/collections/kids' },
  { title: 'Accessories', url: '/collections/accessories' },
  {
    title: 'Gifting', url: '/collections/gifting', mega: true, promo: { title: 'Build a gift box', url: '/products/build-your-own-gift-box', image: '/img/giftbox/0.svg' },
    columns: [
      { title: 'By price', links: [['Under £25', '/collections/gifts-under-25'], ['Under £50', '/collections/gifts-under-50']] },
      { title: 'By recipient', links: [['For her', '/collections/womens'], ['For him', '/collections/mens'], ['For little ones', '/collections/kids']] },
      { title: 'Gift boxes', links: [['Build your own', '/products/build-your-own-gift-box']] },
    ],
  },
];

export const PAGES = {
  about: { title: 'Our story', body: `<p>Nightjar &amp; Co. began at a kitchen table in Hackney, with two friends, a box of gouache and a shared habit of staying up far too late. The nightjar is a bird that only comes out at dusk, and that is when we do our best drawing.</p><p>Every print starts as a painting: moths circling a lamp, a comet over a sleeping town, the pears in a neighbour’s garden. We scan them, repeat them by hand and print them on fabrics we would want to sleep in ourselves: crisp cotton, brushed cotton for winter, satin and an airy linen blend.</p><p>We make small runs, restock the prints people love and retire the rest. Nothing is made to sit in a warehouse.</p><p><em>Nightjar &amp; Co. is a fictional brand created as a design and engineering portfolio project.</em></p>` },
  shipping: { title: 'Delivery', body: '<p>Orders are packed in our studio within 1–3 working days.</p><ul><li><strong>UK standard</strong> (2–4 working days): £3.95, or free on orders over £60</li><li><strong>UK next working day</strong>: £6.95 when ordered before 9am</li><li><strong>International tracked</strong> (5–10 working days): £12.95</li></ul><p>You’ll get an email with tracking as soon as your order leaves us.</p>' },
  returns: { title: 'Returns', body: '<p>Changed your mind? Return full-price items within <strong>30 days</strong> and sale items within <strong>14 days</strong>, unworn and with tags. Gift boxes and e-gift cards can’t be returned.</p><p>Email us with your order number and we’ll send a returns label. Refunds go back to your original payment method within 5 working days of the parcel reaching us.</p>' },
  'size-guide': { title: 'Size guide', body: '<table class="size-table"><thead><tr><th>Size</th><th>UK</th><th>Bust (cm)</th><th>Waist (cm)</th><th>Hip (cm)</th></tr></thead><tbody><tr><td>XS</td><td>8</td><td>82</td><td>64</td><td>88</td></tr><tr><td>S</td><td>10</td><td>87</td><td>69</td><td>93</td></tr><tr><td>M</td><td>12</td><td>92</td><td>74</td><td>98</td></tr><tr><td>L</td><td>14–16</td><td>99–104</td><td>81–86</td><td>105–110</td></tr><tr><td>XL</td><td>18–20</td><td>111–118</td><td>93–100</td><td>117–124</td></tr><tr><td>XXL</td><td>20–22</td><td>118–124</td><td>100–106</td><td>124–130</td></tr><tr><td>3XL</td><td>22–24</td><td>124–130</td><td>106–112</td><td>130–136</td></tr></tbody></table><p>Our sets have a relaxed fit. Between sizes? Size down for a neater fit or up for an oversized one.</p>' },
  contact: { title: 'Contact us', body: '<p>We’re a small team and we read every message. Email <a href="mailto:hello@nightjar.example">hello@nightjar.example</a> and we’ll reply within one working day.</p><p>Studio hours: Monday to Friday, 10am–5pm.</p>' },
  faq: { title: 'FAQs', body: '<h3>Is this a real shop?</h3><p>Nightjar &amp; Co. is a portfolio project. The checkout runs on Stripe in <strong>test mode</strong>, so no real money is taken and nothing ships. Use the card number 4242 4242 4242 4242 with any future date and any CVC.</p><h3>How do the gift boxes work?</h3><p>Add pieces to your bag, open it and choose “Make it a gift”. Each piece has points, and we pick the smallest box that fits them.</p><h3>Do you restock sold-out sizes?</h3><p>Yes. Popular prints come back each season; join the newsletter to hear first.</p>' },
  privacy: { title: 'Privacy policy', body: '<p>We store only what we need to run your order and account: your name, email, delivery address and order history. Payments are handled by Stripe, so we never see or store card numbers. Passwords are stored as salted scrypt hashes. We use essential cookies for your bag and login session, and nothing else.</p>' },
  terms: { title: 'Terms', body: '<p>This storefront is a demonstration. Orders placed here are test orders processed in Stripe test mode and are never fulfilled.</p>' },
};

export const SHIPPING_RATES = [
  { code: 'uk-standard', title: 'UK Standard (2–4 working days)', price: 395, free_over: 6000, countries: ['GB'] },
  { code: 'uk-next-day', title: 'UK Next Working Day (order by 9am)', price: 695, countries: ['GB'] },
  { code: 'international', title: 'International Tracked (5–10 working days)', price: 1295, countries: ['*'] },
];
export const COUNTRIES = [['GB', 'United Kingdom'], ['IE', 'Ireland'], ['US', 'United States'], ['FR', 'France'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['ES', 'Spain'], ['IT', 'Italy'], ['AU', 'Australia'], ['CA', 'Canada'], ['IN', 'India']];
