// Template "main" sections: collection, product, recommendations, cart, search, page, 404, gift box
import { esc, icon, image, money, price, stars, starRow, attrs, d, productUrl } from '../snippets/helpers.js';
import { productCard, badge } from '../snippets/product-card.js';
import { byHandle, variantById } from '../../server/catalog.js';
import { filterCollection, SORTS, search } from '../../server/query.js';
import { cartItems, cartTotals, freeShippingBar } from './overlay-group.js';

/* ---------------- collection ---------------- */
export function mainCollection(ctx) {
  const c = ctx.collection, q = ctx.query;
  const r = filterCollection(c.handle, q);
  const qs = (patch) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...q, ...patch })) [].concat(v ?? []).filter((x) => x !== '' && x != null).forEach((x) => u.append(k, x));
    const s = u.toString(); return s ? `?${s}` : '';
  };
  const active = r.facets.flatMap((f) => f.values.filter((v) => v.active).map((v) => ({ ...v, param: f.param, label: f.label })));
  return `<div class="collection" data-component="collection-filters">
    <div class="collection__hero animation"><div class="animation--section-blocks">
      <nav class="breadcrumb" aria-label="Breadcrumb" ${d(0)}><a href="/">Home</a> / <span>${esc(c.title)}</span></nav>
      <h1 class="h1" ${d(1)}>${esc(c.title)}</h1>
      ${c.description ? `<p class="collection__desc" ${d(2)}>${esc(c.description)}</p>` : ''}
    </div></div>
    <form class="collection__toolbar" data-filter-form action="/collections/${c.handle}">
      <button type="button" class="collection__toggle" data-toggle-filters aria-expanded="true">${icon('filter', 20)} <span>Hide filters</span></button>
      <span class="collection__count" data-results-count>${r.total} results</span>
      <label class="collection__sort">Sort: <select name="sort_by" data-sort>${SORTS.map(([v, l]) => `<option value="${v}" ${r.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="filters" data-filters>
        ${r.facets.map((f) => `<details class="filter" data-filter>
          <summary class="filter__summary">${esc(f.label)}${f.values.some((v) => v.active) ? ` <span class="filter__n">${f.values.filter((v) => v.active).length}</span>` : ''} ${icon('chevron', 14)}</summary>
          <div class="filter__panel"><ul>${f.values.map((v) => `<li><label class="check ${v.count === 0 && !v.active ? 'is-disabled' : ''}"><input type="checkbox" name="${f.param}" value="${esc(v.value)}" ${v.active ? 'checked' : ''} ${v.count === 0 && !v.active ? 'disabled' : ''}><span>${esc(v.value)}</span><span class="check__count">(${v.count})</span></label></li>`).join('')}</ul></div>
        </details>`).join('')}
        <details class="filter" data-filter>
          <summary class="filter__summary">Price ${icon('chevron', 14)}</summary>
          <div class="filter__panel price-range" data-price-range data-min="${r.price.min}" data-max="${r.price.max}">
            <div class="price-range__track"><span class="price-range__fill"></span>
              <input type="range" min="${r.price.min}" max="${r.price.max}" value="${r.price.gte || r.price.min}" aria-label="Minimum price" data-range-min>
              <input type="range" min="${r.price.min}" max="${r.price.max}" value="${r.price.lte || r.price.max}" aria-label="Maximum price" data-range-max></div>
            <div class="price-range__inputs"><label>£ <input type="number" name="filter.v.price.gte" value="${r.price.gte}" placeholder="${r.price.min}" data-input-min></label><span>to</span><label>£ <input type="number" name="filter.v.price.lte" value="${r.price.lte}" placeholder="${r.price.max}" data-input-max></label></div>
          </div>
        </details>
        <label class="check filter__availability"><input type="checkbox" name="filter.v.availability" value="1" ${r.availability ? 'checked' : ''}><span>In stock only</span></label>
      </div>
      ${active.length ? `<div class="active-filters">${active.map((v) => `<a class="active-filter" href="/collections/${c.handle}${qs({ [v.param]: [].concat(q[v.param] || []).filter((x) => x !== v.value), page: '' })}" data-filter-link>${esc(v.value)} ${icon('close', 12)}</a>`).join('')}<a class="link" href="/collections/${c.handle}" data-filter-link>Clear all</a></div>` : ''}
    </form>
    <div class="collection__grid animation animation--product-grid" data-results>
      ${r.products.length ? r.products.map((p, i) => productCard(p, i)).join('') : '<p class="collection__empty">No products match these filters. <a class="link" href="?">Clear filters</a></p>'}
    </div>
    ${r.pages > 1 ? `<nav class="pagination" aria-label="Pagination">${Array.from({ length: r.pages }, (_, i) => i + 1).map((n) => `<a href="/collections/${c.handle}${qs({ page: n })}" class="${n === r.page ? 'is-active' : ''}" ${n === r.page ? 'aria-current="page"' : ''} data-filter-link>${n}</a>`).join('')}</nav>` : ''}
  </div>`;
}

/* ---------------- product ---------------- */
function stockMessage(v) {
  if (!v.available) return { cls: 'bad', text: 'Sold out', pct: 0 };
  if (v.inventory_management && v.inventory_quantity <= 5) return { cls: 'medium', text: `Low stock, only ${v.inventory_quantity} left`, pct: 30 };
  return { cls: 'good', text: 'In stock, and ready to ship', pct: 100 };
}

export function mainProduct(ctx) {
  const p = ctx.product;
  const sel = (ctx.query.variant && p.variants.find((v) => String(v.id) === ctx.query.variant)) || null;
  const first = sel || p.variants.find((v) => v.available) || p.variants[0];
  const single = p.variants.length === 1;
  const stock = stockMessage(first);
  const upsell = (p.metafields.custom.upsell_products || []).map((h) => byHandle.get(h)).filter(Boolean);
  const variantsJson = p.variants.map((v) => ({ id: v.id, title: v.title, option1: v.option1, price: v.price, compare_at_price: v.compare_at_price, available: v.available, qty: v.inventory_management ? v.inventory_quantity : null }));
  const isBox = p.product_type === 'Gift Box';
  return `<div class="product" data-component="product-form" data-product='${esc(JSON.stringify({ id: p.id, handle: p.handle, title: p.title, variants: variantsJson }))}'>
    <div class="product__gallery animation" data-component="gallery">
      <div class="product__media-main">
        ${p.images.map((img, i) => `<button type="button" class="product__media ${i === 0 ? 'is-active' : ''}" data-zoom="${i}" aria-label="Zoom image ${i + 1}">${image(img.src, { alt: img.alt, ratio: 3 / 4, eager: i === 0 })}</button>`).join('')}
      </div>
      <div class="product__thumbs" role="tablist" aria-label="Product images">${p.images.map((img, i) => `<button type="button" class="product__thumb ${i === 0 ? 'is-active' : ''}" data-thumb="${i}" aria-label="Show image ${i + 1}">${image(img.src, { alt: '', ratio: 3 / 4, animate: false })}</button>`).join('')}</div>
    </div>
    <div class="product__info animation"><div class="animation--section-blocks">
      <nav class="breadcrumb" ${d(0)}><a href="/">Home</a> / <a href="/collections/${p.metafields.custom.audience === 'mens' ? 'mens' : p.metafields.custom.audience === 'kids' ? 'kids' : 'womens'}">Shop</a> / <span>${esc(p.title)}</span></nav>
      <div class="product__badge" ${d(1)}>${badge(p)}</div>
      <h1 class="product__title h2" ${d(1)}>${esc(p.title)}</h1>
      <div ${d(2)} data-price>${price({ variants: [first] })}</div>
      <a class="product__rating" href="#reviews" ${d(2)}>${p.metafields.reviews.rating_count ? `${starRow(p.metafields.reviews.rating)} <span>${Number(p.metafields.reviews.rating).toFixed(1)} · ${p.metafields.reviews.rating_count} review${p.metafields.reviews.rating_count === 1 ? '' : 's'}</span>` : '<span>No reviews yet · be the first</span>'}</a>
      <form class="product__form" action="/cart/add" method="post" data-product-form ${d(3)}>
        <input type="hidden" name="id" value="${single ? first.id : sel ? first.id : ''}" data-variant-input>
        ${single ? '' : `<fieldset class="product__sizes"><legend><span>Size: <strong data-size-label>${sel ? esc(sel.option1) : ''}</strong></span> <button type="button" class="link" data-open-size-guide>Size guide</button></legend>
          <div class="size-grid">${p.variants.map((v) => `<label class="size-option"><input type="radio" name="option-size" value="${v.id}" ${sel && sel.id === v.id ? 'checked' : ''} ${v.available ? '' : 'data-sold-out'}><span>${esc(v.option1)}</span></label>`).join('')}</div></fieldset>`}
        <div class="stock stock--${stock.cls}" data-stock><p data-stock-text>${stock.text}</p><span class="stock__bar"><span style="width:${stock.pct}%"></span></span></div>
        <div class="product__qty"><span>Quantity</span><div class="qty" data-qty><button type="button" data-qty-change="-1" aria-label="Decrease">${icon('minus', 14)}</button><input type="number" name="quantity" min="1" value="1" aria-label="Quantity" data-qty-input><button type="button" data-qty-change="1" aria-label="Increase">${icon('plus', 14)}</button></div></div>
        <button type="submit" class="btn btn--primary btn--full product__atc" data-atc ${!single && !sel ? 'disabled' : ''}><span data-atc-label>${!single && !sel ? 'Select size' : first.available ? 'Add to cart' : 'Sold out'}</span></button>
        <ul class="product__perks"><li>${icon('truck', 18)} Free UK delivery over £60</li><li>${icon('return', 18)} 30-day returns</li><li>${icon('lock', 18)} Secure checkout with Stripe</li></ul>
        <p class="product__error" role="alert" data-error></p>
      </form>
      ${isBox ? '<p class="product__note" ' + d(4) + '>Add the pieces you want to your cart first, then open the cart and choose <strong>Make it a gift</strong>.</p>' : ''}
      ${upsell.length ? `<div class="upsell" data-component="upsell" ${d(4)}>
        <p class="upsell__title h5">Complete the set</p>
        ${upsell.map((u) => `<div class="upsell__item" data-upsell-item>
          <label class="upsell__check"><input type="checkbox" data-upsell-check><span class="visually-hidden">Add ${esc(u.title)}</span></label>
          <a class="upsell__image" href="${productUrl(u)}">${image(u.images[0].src, { alt: '', ratio: 3 / 4, animate: false })}</a>
          <div class="upsell__info"><a href="${productUrl(u)}">${esc(u.title)}</a>
            ${u.variants.length > 1 ? `<select data-upsell-variant aria-label="Size for ${esc(u.title)}">${u.variants.map((v) => `<option value="${v.id}" data-price="${v.price}" ${v.available ? '' : 'disabled'}>${esc(v.option1)}${v.available ? '' : ' (sold out)'}</option>`).join('')}</select>` : `<input type="hidden" data-upsell-variant value="${u.variants[0].id}" data-price="${u.variants[0].price}">`}
            <span class="upsell__price">${money(u.variants[0].price)}</span></div>
        </div>`).join('')}
        <button type="button" class="btn btn--secondary btn--full" data-upsell-add disabled><span>Add selected · <span data-upsell-total>£0.00</span></span></button>
      </div>` : ''}
      <div class="accordion" ${d(5)}>
        <details open><summary>Description ${icon('chevron', 14)}</summary><div class="accordion__body rte">${p.body_html}</div></details>
        <details><summary>Fabric & care ${icon('chevron', 14)}</summary><div class="accordion__body"><p>${esc(p.metafields.custom.fabric || '—')}. Machine wash at 30°, wash with similar colours, cool iron.</p></div></details>
        <details><summary>Delivery & returns ${icon('chevron', 14)}</summary><div class="accordion__body"><p>UK standard £3.95, free over £60. Next working day £6.95 (order by 9am). International tracked £12.95. 30-day returns, 14 days for sale items. <a class="link" href="/pages/shipping">Delivery details</a></p></div></details>
      </div>
    </div></div>
    <div class="sticky-atc" data-sticky-atc aria-hidden="true">
      ${image(p.images[0].src, { alt: '', ratio: 3 / 4, animate: false, cls: 'sticky-atc__img' })}
      <div class="sticky-atc__info"><p>${esc(p.title)}</p><span data-sticky-price>${money(first.price)}</span></div>
      <button type="button" class="btn btn--primary" data-sticky-btn><span>${single ? 'Add to cart' : 'Choose size'}</span></button>
    </div>
    <div class="lightbox" data-lightbox aria-hidden="true" role="dialog" aria-label="Image zoom">
      <button type="button" class="lightbox__close" data-close aria-label="Close">${icon('close')}</button>
      <button type="button" class="lightbox__arrow lightbox__arrow--prev" data-prev aria-label="Previous">${icon('left')}</button>
      <img class="lightbox__img" alt="">
      <button type="button" class="lightbox__arrow lightbox__arrow--next" data-next aria-label="Next">${icon('right')}</button>
    </div>
    <div class="modal" data-size-guide aria-hidden="true"><div class="modal__overlay" data-close></div><div class="modal__panel" role="dialog" aria-label="Size guide">
      <button type="button" class="modal__close" data-close aria-label="Close">${icon('close')}</button><h2 class="h3">Size guide</h2>
      <table class="size-table"><thead><tr><th>Size</th><th>UK</th><th>Bust (cm)</th><th>Hip (cm)</th></tr></thead><tbody>
      ${[['XS', '8', '82', '88'], ['S', '10', '87', '93'], ['M', '12', '92', '98'], ['L', '14-16', '99–104', '105–110'], ['XL', '18-20', '111–118', '117–124'], ['XXL', '20-22', '118–124', '124–130'], ['3XL', '22-24', '124–130', '130–136']].map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="size-table__note">Our sets have a relaxed fit. Between sizes? Size down for a neater fit. <a class="link" href="/pages/size-guide">Full size guide</a></p></div></div>
  </div>
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.title, sku: first.sku, brand: { '@type': 'Brand', name: p.vendor }, image: p.images.map((i) => ctx.origin + i.src), ...(p.metafields.reviews.rating_count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.metafields.reviews.rating, reviewCount: p.metafields.reviews.rating_count } } : {}), offers: p.variants.map((v) => ({ '@type': 'Offer', price: (v.price / 100).toFixed(2), priceCurrency: 'GBP', availability: v.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', sku: v.sku })) }).replace(/</g, '\\u003c')}</script>`;
}

export function productRecommendations(ctx) {
  const p = ctx.product, r = p.metafields.reviews, list = ctx.reviews || [];
  const q = ctx.query;
  const dist = [5, 4, 3, 2, 1].map((n) => [n, list.filter((x) => x.rating === n).length]);
  return `<div class="section reviews-section animation" id="reviews">
    <div class="reviews animation--section-blocks">
      <div class="reviews__summary" ${d(0)}>
        <h2 class="h3">Reviews</h2>
        ${r.rating_count ? `<p class="reviews__score"><strong>${Number(r.rating).toFixed(1)}</strong> ${starRow(r.rating, 18)}<span>${r.rating_count} review${r.rating_count === 1 ? '' : 's'}</span></p>
        <ul class="reviews__dist">${dist.map(([n, c]) => `<li><span>${n}★</span><span class="reviews__bar"><span style="width:${list.length ? Math.round((c / list.length) * 100) : 0}%"></span></span><span>${c}</span></li>`).join('')}</ul>` : '<p class="muted">No reviews yet. Bought this piece? Tell other night owls what you think.</p>'}
        <details class="review-form" ${q.review_error ? 'open' : ''}><summary class="btn btn--secondary"><span>Write a review</span></summary>
          ${q.review_error ? `<p class="form-error" role="alert">${esc(q.review_error)}</p>` : ''}
          <form method="post" action="/products/${p.handle}/reviews" class="form-stack form-stack--tight">
            <fieldset class="star-input"><legend>Your rating</legend>${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" value="${n}" id="rate-${n}" required><label for="rate-${n}" title="${n} star${n > 1 ? 's' : ''}">${icon('star', 22)}</label>`).join('')}</fieldset>
            <label class="field"><span>Headline</span><input name="title" maxlength="120" placeholder="Softest set I own"></label>
            <label class="field"><span>Review</span><textarea name="body" rows="4" required minlength="10" maxlength="2000"></textarea></label>
            <div class="field-row"><label class="field"><span>Name to show</span><input name="author" maxlength="60" required value="${esc(ctx.customer ? `${ctx.customer.first_name} ${ctx.customer.last_name?.[0] || ''}.` : '')}"></label>
            <label class="field"><span>Email (not shown)</span><input name="email" type="email" required value="${esc(ctx.customer?.email || '')}" ${ctx.customer ? 'readonly' : ''}></label></div>
            <input class="visually-hidden" tabindex="-1" autocomplete="off" name="website" aria-hidden="true">
            <button class="btn btn--primary" type="submit"><span>Post review</span></button>
            <p class="small muted">Reviews from customers who bought this piece are marked “Verified buyer”.</p>
          </form></details>
        ${q.review === 'thanks' ? '<p class="notice" role="status">Thank you! Your review is live.</p>' : ''}
      </div>
      <ul class="reviews__list" ${d(1)}>${list.map((x) => `<li class="review"><div class="review__head">${starRow(x.rating)}<span class="review__author">${esc(x.author)}${x.verified ? ` <span class="review__verified">${icon('check', 12)} Verified buyer</span>` : ''}</span><time>${new Date(x.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div>${x.title ? `<p class="review__title">${esc(x.title)}</p>` : ''}<p>${esc(x.body)}</p></li>`).join('')}</ul>
    </div>
  </div>
  <div class="section animation" data-component="recommendations" data-url="/recommendations/products.json?product_id=${p.id}&limit=4&section_id=product-recommendations-grid">
    <div class="section__intro animation--section-blocks"><h2 class="h2" ${d(0)}>You may also like</h2></div>
    <div class="product-grid animation--product-grid" data-recommendations><div class="skeleton-grid">${'<span></span>'.repeat(4)}</div></div>
  </div>`;
}

/* ---------------- cart page ---------------- */
export function mainCart(ctx) {
  const cart = ctx.cart;
  return `<div class="cart-page animation" data-component="cart-page"><div class="animation--section-blocks">
    <h1 class="h1" ${d(0)}>Your bag</h1>
    ${cart.item_count ? `<div class="cart-page__grid" ${d(1)}>
      <div>${freeShippingBar(cart, ctx.settings.cart.free_shipping_threshold)}${cartItems(cart)}
        <label class="cart-page__note">Order note<textarea data-cart-note rows="3" placeholder="Gift message, delivery notes…">${esc(cart.note)}</textarea></label></div>
      <aside class="cart-page__summary">${cartTotals(ctx, cart)}</aside>
    </div>` : `<p ${d(1)}>Your bag is empty. <a class="link" href="/collections/all">Continue shopping</a></p>`}
  </div></div>`;
}

/* ---------------- search results ---------------- */
export function mainSearch(ctx) {
  const q = ctx.query.q || '';
  const results = q ? search(q) : [];
  return `<div class="section animation"><div class="animation--section-blocks">
    <h1 class="h1" ${d(0)}>Search</h1>
    <form action="/search" class="search-page__form" ${d(1)}><input type="search" name="q" value="${esc(q)}" placeholder="Search" aria-label="Search"><button class="btn btn--primary"><span>Search</span></button></form>
    ${q ? `<p ${d(2)}>${results.length} results for “${esc(q)}”</p>` : ''}
  </div>
  <div class="collection__grid animation--product-grid">${results.map((p, i) => productCard(p, i)).join('')}</div></div>`;
}

export function mainPage(ctx) {
  return `<div class="section page animation"><div class="rte animation--section-blocks"><h1 class="h1" ${d(0)}>${esc(ctx.page.title)}</h1><div ${d(1)}>${ctx.page.body}</div></div></div>`;
}

export function notFound() {
  return `<div class="section page animation"><div class="animation--section-blocks"><h1 class="display-2" ${d(0)}>Page not found</h1><p ${d(1)}>The page you were looking for does not exist.</p><div ${d(2)}><a class="btn btn--primary" href="/collections/all"><span>Continue shopping</span></a></div></div></div>`;
}

/* ---------------- gift box modal (rendered on demand: /?sections=gift-box) ---------------- */
export function giftBox(ctx) {
  const cart = ctx.cart;
  const box = byHandle.get('build-your-own-gift-box');
  const existing = cart.items.find((l) => l.properties?._box_items);
  const inBox = new Set(existing ? JSON.parse(existing.properties._box_items) : []);
  const eligible = cart.items.filter((l) => !l.properties?._box_items && l.points > 0);
  const variants = box.variants.map((v) => ({ id: v.id, title: v.option1, price: v.price, limit: v.metafields.custom.points_limit }));
  return `<div class="gift-box" data-component="gift-box" data-box='${esc(JSON.stringify({ variants, existingKey: existing?.key || null }))}'>
    <div class="gift-box__overlay" data-close></div>
    <div class="gift-box__panel" role="dialog" aria-modal="true" aria-labelledby="gift-box-title">
      <button type="button" class="gift-box__close" data-close aria-label="Close">${icon('close', 18)}</button>
      <h2 id="gift-box-title" class="h3">Build your gift box</h2>
      <p class="gift-box__intro">Tick the pieces to pack. We pick the smallest box that fits.</p>
      <div class="gift-box__meter"><div class="gift-box__meter-info"><span data-box-name>—</span><span data-points-label>0 points</span></div>
        <div class="gift-box__bar" role="progressbar" aria-valuemin="0" data-points-bar><span></span></div>
        <div class="gift-box__sizes">${variants.map((v) => `<span data-size-chip="${v.id}">${esc(v.title)} · ${v.limit} pts · ${money(v.price)}</span>`).join('')}</div></div>
      <ul class="gift-box__items">${eligible.length ? eligible.map((l) => `<li><label class="gift-box__item">
        <input type="checkbox" value="${esc(l.key)}" data-points="${l.points * l.quantity}" ${inBox.has(l.key) ? 'checked' : ''}>
        ${image(l.image, { alt: '', ratio: 3 / 4, animate: false, cls: 'gift-box__thumb' })}
        <span><strong>${esc(l.product_title)}</strong><br>${esc(l.variant_title)} × ${l.quantity}</span><span class="gift-box__pts">${l.points * l.quantity} pts</span></label></li>`).join('') : '<li class="gift-box__empty">Add pyjamas, robes or accessories to your cart first.</li>'}</ul>
      <label class="gift-box__message">Gift message <textarea maxlength="250" rows="3" data-gift-message placeholder="Happy birthday! x">${esc(existing?.properties['Gift Message'] || '')}</textarea></label>
      <p class="gift-box__error" role="alert" data-box-error></p>
      <div class="gift-box__actions">${existing ? '<button type="button" class="link" data-remove-box>Remove box</button>' : ''}<button type="button" class="btn btn--primary" data-save-box disabled><span>${existing ? 'Update box' : 'Add gift box'}</span></button></div>
    </div>
  </div>`;
}
