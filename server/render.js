// ---------------------------------------------------------------------------
// The "Storefront Renderer": turns a template JSON + section renderers into
// HTML, and implements Shopify's Section Rendering API:
//   GET /any-page?sections=quick-cart,cart-icon  → { "quick-cart": "<section…>" }
//   GET /any-page?section_id=quick-cart          → "<section…>"
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { layout } from '../theme/layout/theme.js';
import * as H from '../theme/sections/header-group.js';
import * as Home from '../theme/sections/home.js';
import * as O from '../theme/sections/overlay-group.js';
import * as M from '../theme/sections/main.js';
import { productCard } from '../theme/snippets/product-card.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cache = new Map();
const readJSON = (p) => {
  if (process.env.VERCEL && cache.has(p)) return cache.get(p);
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  cache.set(p, v); return v;
};
export const loadSettings = () => readJSON('theme/config/settings.json'); // re-read per request = live edits in dev

export const SECTIONS = {
  'announcement-bar': H.announcementBar, header: H.header,
  slideshow: Home.slideshow, 'featured-collection-slider': Home.featuredCollectionSlider, 'collection-list-slider': Home.collectionListSlider,
  'image-hero-split': Home.imageHeroSplit, 'rich-text': Home.richText, shoppable: Home.shoppable, grid: Home.grid,
  'image-with-text-split': Home.imageWithTextSplit, 'multi-column': Home.multiColumn,
  'quick-cart': O.quickCart, popup: O.popup, search: O.search, footer: O.footer,
  'main-collection': M.mainCollection, 'main-product': M.mainProduct, 'product-recommendations': M.productRecommendations,
  'main-cart': M.mainCart, 'main-search': M.mainSearch, 'main-page': M.mainPage, 'not-found': M.notFound, 'gift-box': M.giftBox,
  'product-recommendations-grid': (ctx) => (ctx.recommendations || []).map((p, i) => productCard(p, i)).join(''),
  'cart-icon': (ctx) => `<span class="cart-count" data-cart-count ${ctx.cart.item_count ? '' : 'hidden'}>${ctx.cart.item_count}</span>`,
};

const wrap = (id, type, html) => `<section id="shopify-section-${id}" class="shopify-section section-${type}">${html}</section>`;
const renderOne = (ctx, { id, type, settings = {}, blocks = [] }) => {
  const fn = SECTIONS[type];
  if (!fn) return `<!-- unknown section type: ${type} -->`;
  return wrap(id, type, fn(ctx, settings, blocks));
};

/** All sections addressable by id on the current template (template + groups) */
function sectionMap(template) {
  const t = template ? readJSON(`theme/templates/${template}.json`).sections : [];
  const footer = readJSON('theme/config/footer-group.json').sections;
  const groups = ['announcement-bar', 'header', 'quick-cart', 'popup', 'search', 'gift-box', 'cart-icon', 'product-recommendations-grid'].map((type) => ({ id: type, type }));
  return new Map([...groups, ...footer, ...t].map((s) => [s.id, s]));
}

export function renderSections(ctx, ids) {
  const map = sectionMap(ctx.template);
  const out = {};
  for (const id of ids) { const s = map.get(id) || (SECTIONS[id] ? { id, type: id } : null); out[id] = s ? renderOne(ctx, s) : null; }
  return out;
}

/** Wrap a server-built main column (account, wishlist pages) in the full storefront chrome */
export function renderMain(ctx, main, meta) {
  return renderTemplate(ctx, meta, main).html;
}

export function renderTemplate(ctx, { title, description, url, image }, mainOverride) {
  const t0 = performance.now();
  const main = mainOverride ?? readJSON(`theme/templates/${ctx.template}.json`).sections.map((s) => renderOne(ctx, s)).join('\n');
  const header = `<!-- BEGIN sections: header-group -->${renderOne(ctx, { id: 'announcement-bar', type: 'announcement-bar' })}${renderOne(ctx, { id: 'header', type: 'header' })}<!-- END sections: header-group -->`;
  const footer = `<!-- BEGIN sections: footer-group -->${readJSON('theme/config/footer-group.json').sections.map((s) => renderOne(ctx, s)).join('')}<!-- END sections: footer-group -->`;
  const overlays = ['quick-cart', 'popup', 'search'].map((type) => renderOne(ctx, { id: type, type })).join('');
  const html = layout({ ctx, title, description, url, image, main, header, footer, overlays });
  return { html, ms: performance.now() - t0 };
}
