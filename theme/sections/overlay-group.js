// Overlay group (rendered on every page): quick cart drawer, newsletter popup, search overlay
// + footer group: footer. The quick cart is re-rendered through the Section Rendering API
// (`/?sections=quick-cart`) after every cart change, exactly like a Shopify theme.
import { esc, icon, money, image, d, logo } from '../snippets/helpers.js';
import { productsIn, collectionByHandle } from '../../server/catalog.js';

export function freeShippingBar(cart, threshold) {
  const pct = Math.min(100, Math.round((cart.total_price / threshold) * 100));
  return `<div class="free-shipping ${cart.free_shipping.achieved ? 'is-achieved' : ''}" style="--progress-width:${pct}%">
    <p class="free-shipping__msg">${cart.free_shipping.achieved ? 'You’ve unlocked <strong>free UK delivery</strong>' : `Spend <strong>${money(cart.free_shipping.remaining)}</strong> more for free UK delivery`}</p>
    <div class="free-shipping__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span class="free-shipping__fill"></span></div>
  </div>`;
}

function lineItem(l, i, { boxed = false } = {}) {
  const props = Object.entries(l.properties || {}).filter(([k]) => !k.startsWith('_'));
  return `<li class="cart-item ${boxed ? 'cart-item--boxed' : ''}" ${d(i)} data-key="${esc(l.key)}">
    <a class="cart-item__image" href="${l.url}">${image(l.image, { alt: l.product_title, ratio: 3 / 4, animate: false })}</a>
    <div class="cart-item__info">
      <a class="cart-item__title" href="${l.url}">${esc(l.product_title)}</a>
      ${l.variant_title && l.variant_title !== 'Default Title' ? `<p class="cart-item__variant">${esc(l.variant_title)}</p>` : ''}
      ${props.map(([k, v]) => `<p class="cart-item__prop">${esc(k)}: ${esc(v)}</p>`).join('')}
      <div class="cart-item__row">
        <div class="qty" data-qty>
          <button type="button" data-qty-change="-1" aria-label="Decrease quantity">${icon('minus', 14)}</button>
          <input type="number" min="0" value="${l.quantity}" aria-label="Quantity" data-qty-input>
          <button type="button" data-qty-change="1" aria-label="Increase quantity">${icon('plus', 14)}</button>
        </div>
        <button type="button" class="cart-item__remove link" data-remove>Remove</button>
      </div>
    </div>
    <p class="cart-item__price">${money(l.final_line_price)}${l.compare_at_price ? `<s>${money(l.compare_at_price * l.quantity)}</s>` : ''}</p>
  </li>`;
}

export function cartItems(cart) {
  // group boxed items under their gift box line (like the custom GiftBox.js)
  const boxes = cart.items.filter((l) => l.properties?._box_items);
  const boxedKeys = new Set(boxes.flatMap((b) => { try { return JSON.parse(b.properties._box_items); } catch { return []; } }));
  let i = 0;
  const loose = cart.items.filter((l) => !l.properties?._box_items && !boxedKeys.has(l.key)).map((l) => lineItem(l, i++)).join('');
  const boxed = boxes.map((b) => {
    const keys = JSON.parse(b.properties._box_items || '[]');
    return `<li class="cart-box" ${d(i++)}><ul>${lineItem(b, 0)}${keys.map((k) => cart.items.find((l) => l.key === k)).filter(Boolean).map((l, n) => lineItem(l, n + 1, { boxed: true })).join('')}</ul>
      <button type="button" class="link cart-box__edit" data-open-gift-box>Edit gift box</button></li>`;
  }).join('');
  return `<ul class="cart-items">${boxed}${loose}</ul>`;
}

export function cartTotals(ctx, cart) {
  const disc = cart.cart_level_discount_applications[0];
  const code = cart.discount_codes[0];
  return `<div class="cart-totals">
    ${ctx.settings.cart.show_discount_field ? `<form class="discount-code" data-component="discount-code">
      <label class="visually-hidden" for="discount-input">Discount code</label>
      <input id="discount-input" name="code" placeholder="Discount code" value="${esc(code?.code || '')}" autocomplete="off">
      <button type="submit" class="btn btn--secondary btn--small"><span>${code ? 'Update' : 'Apply'}</span></button>
      ${code ? `<p class="discount-code__msg ${code.applicable ? 'is-ok' : 'is-error'}">${code.applicable ? `${esc(code.code)} applied` : esc(code.reason || 'Code not applicable')} <button type="button" class="link" data-remove-discount>Remove</button></p>` : '<p class="discount-code__msg" aria-live="polite"></p>'}
    </form>` : ''}
    <dl class="cart-totals__rows">
      <div><dt>Subtotal</dt><dd>${money(cart.items_subtotal_price)}</dd></div>
      ${disc ? `<div class="cart-totals__discount"><dt>Discount (${esc(disc.title)})</dt><dd>−${money(disc.total_allocated_amount)}</dd></div>` : ''}
      <div class="cart-totals__total"><dt>Total</dt><dd>${money(cart.total_price)}</dd></div>
    </dl>
    <p class="cart-totals__note">Taxes included. Shipping calculated at checkout.</p>
    <form action="/cart" method="post"><button type="submit" name="checkout" class="btn btn--primary btn--full"><span>Checkout</span></button></form>
    <p class="cart-totals__secure">${icon('lock', 14)} Secure checkout with Stripe · test mode</p>
  </div>`;
}

export function quickCart(ctx) {
  const cart = ctx.cart, empty = cart.item_count === 0;
  const sugg = ['womens-pyjamas', 'nightdresses', 'robes', 'accessories'].map((h) => collectionByHandle.get(h));
  return `<div class="quick-cart" id="quick-cart" data-component="quick-cart" aria-hidden="true">
    <div class="quick-cart__overlay" data-close></div>
    <div class="quick-cart__panel" role="dialog" aria-modal="true" aria-labelledby="quick-cart-title">
      <div class="quick-cart__head"><h2 id="quick-cart-title" class="h4">Your bag ${empty ? '' : `<span class="quick-cart__count">(${cart.item_count})</span>`}</h2>
        <button type="button" class="quick-cart__close" data-close aria-label="Close cart">${icon('close', 18)}</button></div>
      ${empty ? `<div class="quick-cart__empty"><p>Your bag is empty. <a class="link" href="/collections/all">continue shopping</a></p>
        <div class="slider" data-component="slider"><div class="slider__track slider__track--cart">${sugg.map((c) => `<a class="collection-tile collection-tile--small" href="/collections/${c.handle}">${image(productsIn(c.handle)[0]?.images[0].src || '', { alt: c.title, ratio: 3 / 4, animate: false })}<span class="collection-tile__title">${esc(c.title)}</span></a>`).join('')}</div></div>
        <a class="btn btn--secondary btn--full" href="/collections/all"><span>Continue shopping</span></a></div>`
      : `<div class="quick-cart__body animation--quick-cart">
          ${freeShippingBar(cart, ctx.settings.cart.free_shipping_threshold)}
          ${cartItems(cart)}
          ${ctx.settings.cart.show_gift_box ? `<button type="button" class="gift-box-cta" data-open-gift-box>${icon('gift', 22)}<span><strong>Make it a gift</strong><br>Pack your pieces in a printed gift box</span>${icon('right', 16)}</button>` : ''}
        </div>
        <div class="quick-cart__foot">${cartTotals(ctx, cart)}</div>`}
    </div>
  </div>`;
}

export function popup(ctx) {
  return `<div class="popup" data-component="popup" data-delay="6000" aria-hidden="true">
    <div class="popup__overlay" data-close></div>
    <div class="popup__panel" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <button type="button" class="popup__close" data-close aria-label="Close">${icon('close', 18)}</button>
      <p class="eyebrow">Join the night owls</p>
      <h2 id="popup-title" class="h3">10% off your first order</h2>
      <p>New prints, restocks and studio news. No spam, just the occasional moth.</p>
      <form class="popup__form" data-newsletter>
        <label class="visually-hidden" for="popup-email">Email</label>
        <input id="popup-email" type="email" name="email" placeholder="Enter email" required autocomplete="email">
        <button type="submit" class="btn btn--primary btn--full"><span>Get 10% off ${icon('arrow', 14)}</span></button>
        <p class="popup__msg" aria-live="polite"></p>
      </form>
    </div>
  </div>`;
}

export function search(ctx) {
  return `<div class="search-overlay" data-component="search" aria-hidden="true">
    <div class="search-overlay__backdrop" data-close></div>
    <div class="search-overlay__panel" role="dialog" aria-modal="true" aria-label="Search">
      <form action="/search" method="get" class="search-overlay__form" role="search">
        ${icon('search', 22)}<input type="search" name="q" placeholder="Search prints, fabrics, styles…" autocomplete="off" aria-label="Search" data-search-input>
        <button type="button" class="search-overlay__close" data-close aria-label="Close search">${icon('close', 20)}</button>
      </form>
      <div class="search-overlay__results" data-search-results aria-live="polite">
        <p class="search-overlay__hint">Popular: <a href="/search?q=moth">Moth &amp; Moon</a> · <a href="/search?q=satin">Satin</a> · <a href="/search?q=gingham">Gingham</a> · <a href="/search?q=robe">Robes</a> · <a href="/search?q=kids">Kids</a></p>
      </div>
    </div>
  </div>`;
}

export function footer(ctx) {
  const col = (t, links) => `<div class="footer__col"><p class="footer__heading">${t}</p><ul>${links.map(([a, b]) => `<li><a class="link-hover" href="${b}">${a}</a></li>`).join('')}</ul></div>`;
  return `<footer class="footer">
    <div class="footer__inner">
      <div class="footer__col footer__brand"><a class="header__logo" href="/">${logo(ctx.settings.brand.name)}</a><p>Print-led pyjamas, drawn by hand in a London studio and made for slow nights.</p></div>
      ${col('Shop', [['New in', '/collections/new-in'], ['Womens', '/collections/womens'], ['Mens', '/collections/mens'], ['Kids', '/collections/kids'], ['Gift boxes', '/products/build-your-own-gift-box']])}
      ${col('Help', [['Delivery', '/pages/shipping'], ['Returns', '/pages/returns'], ['Size guide', '/pages/size-guide'], ['FAQs', '/pages/faq'], ['Contact', '/pages/contact']])}
      ${col('Studio', [['Our story', '/pages/about'], ['Your account', '/account'], ['Wishlist', '/pages/wishlist'], ['Privacy', '/pages/privacy'], ['Terms', '/pages/terms']])}
      <div class="footer__col footer__news"><p class="footer__heading">Join the night owls</p><p>New prints, restocks and 10% off your first order.</p>
        <form class="footer__form" data-newsletter data-source="footer"><label class="visually-hidden" for="footer-email">Email</label><input id="footer-email" type="email" name="email" placeholder="Email address" required autocomplete="email"><button class="btn btn--primary" type="submit"><span>Sign up</span></button><p class="popup__msg" aria-live="polite"></p></form></div>
    </div>
    <div class="footer__bottom"><span>© ${new Date().getFullYear()} ${esc(ctx.settings.brand.name)} · A portfolio project by Hussain Singapuri · Payments in Stripe test mode</span>
      <span>Photography: Unsplash · Prints: drawn in code</span></div>
  </footer>`;
}
