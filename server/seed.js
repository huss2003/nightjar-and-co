// ---------------------------------------------------------------------------
// First-run seed: generates the launch catalog (each print × a few cuts),
// the gift box product and the starter discount codes, and writes them to
// Postgres. Deterministic (seeded RNG), so every fresh database is identical.
// Runs automatically when the schema is created; `npm run seed` re-runs it.
// ---------------------------------------------------------------------------
import { tx, setMeta, bumpCatalog, SCHEMA_VERSION } from './db.js';
import { PRINTS, TYPES } from './catalog.js';

const rng = (seed) => { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
export const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const DESCRIPTIONS = {
  Cotton: 'Crisp, breathable 100% cotton poplin that gets softer with every wash.',
  'Linen Blend': 'An airy linen and cotton blend with a relaxed, oversized fit for warm nights.',
  Satin: 'Liquid-soft satin with a gentle sheen and contrast piping.',
  'Brushed Cotton': 'Brushed cotton with a peach-skin feel, made for cold bedrooms and long winters.',
};

export function generateCatalog() {
  const r = rng(1926);
  let pid = 8_000_000_000, vid = 40_000_000_000;
  const products = [];
  PRINTS.forEach((print, pi) => {
    const picks = TYPES.filter((t, ti) => ((pi * 7 + ti * 3) % 5) < 2 || (t.audience === 'accessories' && pi % 2 === 0));
    picks.forEach((t) => {
      const id = pid++;
      const title = t.audience === 'womens' ? `${print.name} ${t.noun}` : `${print.name} ${t.noun}`;
      const onSale = r() < 0.26;
      const price = t.price + (r() < 0.3 ? 400 : 0);
      const compare = onSale ? price : null;
      const salePrice = onSale ? Math.round((price * 0.8) / 10) * 10 : price;
      const created = new Date(Date.UTC(2025 + Math.floor(r() * 2), Math.floor(r() * 12), 1 + Math.floor(r() * 27)));
      const tags = new Set([t.fabric.toLowerCase(), print.pattern]);
      if (r() < 0.35) tags.add('new');
      if (r() < 0.28) tags.add('best seller');
      if (r() < 0.5) tags.add('AW26');
      if (r() < 0.15) tags.add('Back in Stock');
      const variants = t.sizes.map((size, si) => {
        const qty = r() < 0.1 ? 0 : 2 + Math.floor(r() * 28);
        return {
          id: vid++, product_id: id, title: `${size} / ${print.color}`, option1: size, option2: print.color,
          sku: `NJ-${slug(print.name).slice(0, 4).toUpperCase()}-${slug(t.cut).slice(0, 3).toUpperCase()}-${String(si).padStart(2, '0')}`,
          price: salePrice, compare_at_price: compare, grams: t.audience === 'accessories' ? 120 : 400,
          inventory_quantity: qty, inventory_management: 'shopify', inventory_policy: 'deny', position: si + 1, metafields: {},
        };
      });
      products.push({
        id, title, handle: slug(title), product_type: t.type,
        body_html: `<p>${DESCRIPTIONS[t.fabric] || ''} ${print.name} began as a gouache painting in our studio, then was printed on ${t.fabric.toLowerCase()} so bedtime feels like an occasion.</p>`,
        tags: [...tags], created_at: created,
        options: [{ name: 'Size', position: 1, values: t.sizes }, { name: 'Color', position: 2, values: [print.color] }],
        images: [0, 1, 2, 3].map((n) => ({ position: n + 1, src: `/img/product/${id}/${n}.svg`, alt: `${title}, image ${n + 1}` })),
        metafields: { custom: { fabric: t.fabric, cut: t.cut, print: print.name, pattern: print.pattern, colors: print.colors, audience: t.audience, points: t.points, upsell_products: [] }, reviews: { rating: 0, rating_count: 0 } },
        variants,
      });
    });
  });
  // "Complete the set": same print, different audience/cut, accessories first
  for (const p of products) {
    if (p.metafields.custom.audience === 'accessories') continue;
    p.metafields.custom.upsell_products = products.filter((o) => o !== p && o.metafields.custom.print === p.metafields.custom.print && o.metafields.custom.audience !== p.metafields.custom.audience).slice(0, 3).map((o) => o.handle);
  }
  const boxId = pid++;
  products.push({
    id: boxId, title: 'Build Your Own Gift Box', handle: 'build-your-own-gift-box', product_type: 'Gift Box',
    body_html: '<p>Choose the pieces, and we wrap them in tissue inside a printed keepsake box with your message written on a card.</p>',
    tags: ['gift box', 'gifting'], created_at: new Date('2025-01-01T00:00:00Z'),
    options: [{ name: 'Size', position: 1, values: ['Small', 'Medium', 'Large'] }],
    images: [0, 1].map((n) => ({ position: n + 1, src: `/img/giftbox/${n}.svg`, alt: 'Nightjar & Co. gift box' })),
    metafields: { custom: { fabric: null, cut: 'Gift Box', print: null, pattern: 'stripe', colors: ['#e9e0f0', '#b9a0cf', '#4b3358'], audience: 'gifting', points: 0, upsell_products: [] }, reviews: { rating: 0, rating_count: 0 } },
    variants: [['Small', 500, 3], ['Medium', 800, 5], ['Large', 1200, 8]].map(([size, price, limit], i) => ({
      id: vid++, product_id: boxId, title: size, option1: size, option2: null, sku: `NJ-BOX-${size[0]}`, price, compare_at_price: null, grams: 300,
      inventory_quantity: 0, inventory_management: null, inventory_policy: 'continue', position: i + 1, metafields: { custom: { points_limit: limit } },
    })),
  });
  return products;
}

export const STARTER_DISCOUNTS = [
  { code: 'WELCOME10', type: 'percentage', value: 10, description: '10% off your first order', minimum: 0 },
  { code: 'NIGHTOWL15', type: 'percentage', value: 15, description: '15% student discount', minimum: 0 },
  { code: 'FIVEOFF', type: 'fixed_amount', value: 500, description: '£5 off orders over £40', minimum: 4000 },
];

export async function seed() {
  const products = generateCatalog();
  await tx(async (t) => {
    for (const p of products) {
      await t.q(`insert into products (id, handle, title, body_html, product_type, tags, options, images, metafields, created_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$10) on conflict (id) do nothing`,
      [p.id, p.handle, p.title, p.body_html, p.product_type, p.tags, JSON.stringify(p.options), JSON.stringify(p.images), JSON.stringify(p.metafields), p.created_at]);
      for (const v of p.variants) {
        await t.q(`insert into variants (id, product_id, title, option1, option2, sku, price, compare_at_price, grams, inventory_quantity, inventory_management, inventory_policy, position, metafields)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) on conflict (id) do nothing`,
        [v.id, v.product_id, v.title, v.option1, v.option2, v.sku, v.price, v.compare_at_price, v.grams, v.inventory_quantity, v.inventory_management, v.inventory_policy, v.position, JSON.stringify(v.metafields)]);
      }
    }
    for (const d of STARTER_DISCOUNTS) {
      await t.q('insert into discounts (code, type, value, description, minimum) values ($1,$2,$3,$4,$5) on conflict (code) do nothing', [d.code, d.type, d.value, d.description, d.minimum]);
    }
    await setMeta('schema_version', SCHEMA_VERSION, t);
    await bumpCatalog(t);
  });
  return products.length;
}
