// Product card — "the money component" (design.md §5.2)
// Second image on hover · size-chip quick add · rating pill · wishlist · swatches · badges
import { esc, image, icon, stars, price, productUrl, json, d } from './helpers.js';
import { byHandle } from '../../server/catalog.js';

export function badge(p) {
  if (p.variants.every((v) => !v.available)) return '<span class="badge badge--sold">Sold out</span>';
  if (p.variants.some((v) => v.compare_at_price && v.compare_at_price > v.price)) return '<span class="badge badge--sale">Sale</span>';
  if (p.tags.includes('Back in Stock')) return '<span class="badge">Back in stock</span>';
  if (p.tags.includes('best seller')) return '<span class="badge">Best seller</span>';
  if (p.tags.includes('new')) return '<span class="badge">New</span>';
  return '';
}

export function productCard(p, i = 0, opts = {}) {
  let chips = opts.chips ?? true;
  const [img1, img2] = p.images;
  const single = p.variants.length === 1;
  if (p.product_type === 'Gift Box') chips = false;
  const swatches = [p.handle, ...(p.siblings || [])].slice(0, 4).map((h) => byHandle.get(h)).filter(Boolean);
  return `<article class="product-item animation--item" ${d(i)} data-component="product-card" data-product-id="${p.id}">
    <div class="product-item__inner">
      <a class="product-item__media" href="${productUrl(p)}" aria-label="${esc(p.title)}">
        ${image(img1.src, { alt: img1.alt, ratio: 3 / 4, sizes: '(min-width: 960px) 25vw, 50vw' })}
        ${img2 ? `<div class="product-item__image--two">${image(img2.src, { alt: '', ratio: 3 / 4, animate: false })}</div>` : ''}
        <div class="product-item__badges">${badge(p)}</div>
      </a>
      <button type="button" class="product-item__wishlist" aria-label="Add to wishlist" aria-pressed="false" data-wishlist="${p.id}">${icon('heart', 20)}</button>
      ${stars(p.metafields.reviews.rating, p.metafields.reviews.rating_count).replace('stars-pill', 'stars-pill product-item__stars')}
      ${chips && !single ? `<div class="product-item__chips-overlay" role="group" aria-label="Quick add a size">
        ${p.variants.map((v) => `<button type="button" class="size-chip" data-variant-id="${v.id}" ${v.available ? '' : 'disabled aria-disabled="true"'} aria-label="Add size ${esc(v.option1)} to cart">${esc(v.option1.split(' / ')[0])}</button>`).join('')}
      </div>` : ''}
    </div>
    <div class="product-item__meta">
      <a class="product-item__title" href="${productUrl(p)}">${esc(p.title)}</a>
      ${price(p)}
      <div class="product-item__row">
        <div class="swatches">${swatches.length > 1 ? swatches.map((s) => `<a class="swatch ${s === p ? 'is-active' : ''}" href="${productUrl(s)}" title="${esc(s.metafields.custom.print || s.title)}" style="--swatch:${s.metafields.custom.colors[1]};--swatch-2:${s.metafields.custom.colors[0]}"></a>`).join('') : ''}</div>
        <button type="button" class="product-item__quick-add" aria-label="Quick add ${esc(p.title)}" data-quick-add="${single ? p.variants[0].id : ''}" data-handle="${p.handle}">${icon('cart', 18)}</button>
      </div>
    </div>
  </article>`;
}
