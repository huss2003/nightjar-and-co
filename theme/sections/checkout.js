// Checkout (step 1: contact, delivery, shipping method) and the order status page.
// Payment itself happens on Stripe Checkout, like Shopify hands off to its hosted checkout.
import { esc, money, image, icon, logo } from '../snippets/helpers.js';
import { shippingRates } from '../../server/commerce.js';
import { COUNTRIES } from '../../server/catalog.js';

const STEPS = (active) => `<nav class="checkout__steps" aria-label="Checkout steps">${['Bag', 'Details', 'Payment', 'Done'].map((s, i) => `<span class="${i === active ? 'is-active' : i < active ? 'is-done' : ''}">${s}</span>`).join('<span aria-hidden="true">›</span>')}</nav>`;

export function checkout(ctx, error = '', form = {}, opts = {}) {
  const cart = ctx.cart;
  const country = form.country || 'GB';
  const rates = shippingRates(country, cart);
  const sel = rates.find((r) => r.code === form.shipping) || rates[0];
  const f = (k, label, type = 'text', req = true, auto = '') => `<label class="field"><span>${label}${req ? '' : ' (optional)'}</span><input name="${k}" type="${type}" value="${esc(form[k] || '')}" ${req ? 'required' : ''} ${auto ? `autocomplete="${auto}"` : ''}></label>`;
  return `<div class="checkout">
    <form class="checkout__form" method="post" action="/checkout" data-component="checkout">
      <a class="checkout__logo" href="/">${logo(ctx.settings.brand.name)}</a>
      ${STEPS(1)}
      ${opts.test ? `<div class="test-banner">${icon('card', 18)}<div><strong>Test mode.</strong> No real money is taken. On the next page pay with card <code>4242 4242 4242 4242</code>, any future expiry date and any CVC.</div></div>` : ''}
      ${error ? `<p class="checkout__error" role="alert">${esc(error)}</p>` : ''}
      <div class="checkout__head"><h2 class="h5">Contact</h2>${ctx.customer ? `<span>Logged in as ${esc(ctx.customer.email)}</span>` : '<a class="link" href="/account/login?next=/checkout">Log in</a>'}</div>
      ${f('email', 'Email', 'email', true, 'email')}
      <label class="check"><input type="checkbox" name="marketing" ${form.marketing ? 'checked' : ''}><span>Email me about new prints and offers</span></label>
      <h2 class="h5">Delivery</h2>
      <label class="field"><span>Country</span><select name="country" data-country>${COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === country ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="field-row">${f('first_name', 'First name', 'text', true, 'given-name')}${f('last_name', 'Last name', 'text', true, 'family-name')}</div>
      ${f('address1', 'Address', 'text', true, 'address-line1')}${f('address2', 'Flat, suite, etc.', 'text', false, 'address-line2')}
      <div class="field-row">${f('city', 'Town or city', 'text', true, 'address-level2')}${f('zip', 'Postcode', 'text', true, 'postal-code')}</div>
      ${f('phone', 'Phone', 'tel', false, 'tel')}
      ${ctx.customer ? '<label class="check"><input type="checkbox" name="save_address" checked><span>Save this address to my account</span></label>' : ''}
      <h2 class="h5">Shipping method</h2>
      <div class="radio-list" data-rates>${rates.map((r) => `<label class="radio-card"><input type="radio" name="shipping" value="${r.code}" data-price="${r.price}" ${r === sel ? 'checked' : ''}><span>${esc(r.title)}</span><strong>${r.price ? money(r.price) : 'Free'}</strong></label>`).join('')}</div>
      <button class="btn btn--primary btn--full checkout__pay" type="submit"><span>${icon('lock', 16)} ${opts.stripe ? 'Continue to secure payment' : 'Place order'}</span></button>
      <p class="checkout__legal">${opts.stripe ? 'You’ll pay on Stripe’s secure page. We never see or store your card details. Your items are held for 30 minutes while you pay.' : 'Stripe isn’t configured, so orders are placed without payment (development mode).'}</p>
      <p class="checkout__legal"><a class="link" href="/cart">‹ Back to bag</a></p>
    </form>
    <aside class="checkout__summary">
      <ul>${cart.items.map((l) => `<li class="checkout__line">${image(l.image, { alt: '', ratio: 3 / 4, animate: false })}<span class="checkout__qty">${l.quantity}</span><span>${esc(l.product_title)}<br><small>${esc(l.variant_title)}</small>${l.properties?._box_items ? '<br><small>Gift box</small>' : ''}</span><strong>${money(l.final_line_price)}</strong></li>`).join('')}</ul>
      <dl data-summary data-total="${cart.total_price}"><div><dt>Subtotal</dt><dd>${money(cart.items_subtotal_price)}</dd></div>
      ${cart.total_discount ? `<div class="cart-totals__discount"><dt>Discount (${esc(cart.discount_codes[0]?.code || '')})</dt><dd>−${money(cart.total_discount)}</dd></div>` : ''}
      <div><dt>Shipping</dt><dd data-ship>${sel ? (sel.price ? money(sel.price) : 'Free') : '—'}</dd></div>
      <div class="checkout__total"><dt>Total</dt><dd>GBP <span data-grand>${money(cart.total_price + (sel?.price || 0))}</span></dd></div></dl>
      <p class="checkout__vat">Includes VAT. Have a code? Add it in your <a class="link" href="/cart">bag</a>.</p>
    </aside>
  </div>`;
}

const STATUS = {
  pending: ['Confirming your payment…', 'This page refreshes on its own. It usually takes a few seconds.'],
  paid: ['Order confirmed', 'We’ve emailed your confirmation and we’re getting your order ready.'],
  cancelled: ['Order cancelled', 'This order wasn’t paid, so nothing was charged and the items went back on the shelf.'],
  refunded: ['Order refunded', 'We’ve refunded this order to your original payment method.'],
};

export function orderStatus(ctx, order) {
  const [title, text] = STATUS[order.status] || STATUS.pending;
  const f = order.fulfillments?.[0];
  const step = order.status === 'paid' ? (order.fulfillment_status === 'fulfilled' ? 2 : 1) : 0;
  const a = order.shipping_address;
  return `<div class="checkout checkout--done"><div class="checkout__form">
    <a class="checkout__logo" href="/">${logo(ctx.settings.brand.name)}</a>
    ${order.status === 'paid' ? STEPS(3) : ''}
    <p class="eyebrow">Order #${order.number}</p>
    <h1 class="h2">${order.status === 'paid' ? `Thank you, ${esc(order.customer.first_name)}!` : title}</h1>
    <p>${order.status === 'paid' ? `${text} It’s on its way to <strong>${esc(order.email)}</strong>.` : text}</p>
    ${order.status === 'paid' ? `<ol class="timeline">${['Order placed', 'Packed in the studio', 'Shipped'].map((s, i) => `<li class="${i <= step ? 'is-done' : ''}">${i <= step ? icon('check', 14) : ''}<span>${s}</span></li>`).join('')}</ol>` : ''}
    ${f ? `<div class="order-box"><h2 class="h5">Tracking</h2><p>${esc(f.carrier)} · <strong>${esc(f.tracking_number || '—')}</strong></p></div>` : ''}
    <div class="order-box"><h2 class="h5">Order details</h2>
      <ul>${order.line_items.map((l) => `<li><span>${l.quantity} × ${esc(l.title)} <small>${esc(l.variant_title || '')}</small></span><strong>${money(l.price * l.quantity)}</strong></li>`).join('')}</ul>
      <dl><div><dt>Subtotal</dt><dd>${money(order.subtotal_price)}</dd></div>${order.total_discounts ? `<div><dt>Discount (${esc(order.discount_codes.map((d) => d.code).join(', '))})</dt><dd>−${money(order.total_discounts)}</dd></div>` : ''}
      <div><dt>${esc(order.shipping_lines[0]?.title || 'Shipping')}</dt><dd>${order.shipping_lines[0]?.price ? money(order.shipping_lines[0].price) : 'Free'}</dd></div>
      <div class="checkout__total"><dt>Total <small>(incl. ${money(order.total_tax)} VAT)</small></dt><dd>${money(order.total_price)}</dd></div></dl></div>
    <div class="order-box"><h2 class="h5">Delivery address</h2><p>${esc(a.first_name)} ${esc(a.last_name)}<br>${esc(a.address1)}${a.address2 ? `, ${esc(a.address2)}` : ''}<br>${esc(a.city)} ${esc(a.zip)} · ${esc(a.country_code)}</p></div>
    <div class="order-actions"><a class="btn btn--primary" href="/collections/all"><span>Continue shopping</span></a>${ctx.customer ? '<a class="link" href="/account">View all your orders</a>' : '<a class="link" href="/account/register">Create an account to track orders</a>'}</div>
  </div></div>`;
}
