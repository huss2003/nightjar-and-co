// Customer account pages: log in, register, password reset, account overview, wishlist.
import { esc, money, image, icon, d } from '../snippets/helpers.js';
import { productCard } from '../snippets/product-card.js';
import { COUNTRIES } from '../../server/catalog.js';

const field = (name, label, { type = 'text', value = '', auto = '', req = true, hint = '' } = {}) =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${req ? 'required' : ''} ${auto ? `autocomplete="${auto}"` : ''}>${hint ? `<small>${hint}</small>` : ''}</label>`;

const shell = (title, inner, aside = '') => `<div class="auth animation"><div class="auth__grid">
  <div class="auth__media">${image('photo:bedside', { alt: '', ratio: 4 / 5, eager: true })}</div>
  <div class="auth__panel animation--section-blocks"><h1 class="h2" ${d(0)}>${title}</h1><div ${d(1)}>${inner}</div>${aside ? `<div class="auth__aside" ${d(2)}>${aside}</div>` : ''}</div>
</div></div>`;

const errorBox = (e) => (e ? `<p class="form-error" role="alert">${esc(e)}</p>` : '');

export function loginPage(ctx, error, form) {
  return shell('Welcome back', `${errorBox(error)}
    <form method="post" action="/account/login" class="form-stack">
      <input type="hidden" name="next" value="${esc(form.next || '')}">
      ${field('email', 'Email', { type: 'email', value: form.email, auto: 'email' })}
      ${field('password', 'Password', { type: 'password', auto: 'current-password' })}
      <button class="btn btn--primary btn--full" type="submit"><span>Log in</span></button>
      <a class="link small" href="/account/forgot">Forgotten your password?</a>
    </form>`, `<p>New here? <a class="link" href="/account/register">Create an account</a> to track orders, save your address and keep a wishlist.</p>`);
}

export function registerPage(ctx, error, form) {
  return shell('Create an account', `${errorBox(error)}
    <form method="post" action="/account/register" class="form-stack">
      <div class="field-row">${field('first_name', 'First name', { value: form.first_name, auto: 'given-name' })}${field('last_name', 'Last name', { value: form.last_name, auto: 'family-name' })}</div>
      ${field('email', 'Email', { type: 'email', value: form.email, auto: 'email' })}
      ${field('password', 'Password', { type: 'password', auto: 'new-password', hint: 'At least 8 characters.' })}
      <label class="check"><input type="checkbox" name="accepts_marketing"><span>Send me new prints and 10% off my first order</span></label>
      <button class="btn btn--primary btn--full" type="submit"><span>Create account</span></button>
    </form>`, '<p>Already have one? <a class="link" href="/account/login">Log in</a></p><p class="small">Checked out as a guest before? Register with the same email and your past orders will appear in your account.</p>');
}

export function forgotPage(ctx, sent) {
  return shell('Reset your password', sent
    ? '<p>If there’s an account for that email, we’ve sent a link to reset the password. It works for one hour.</p><p class="small">This is a demo shop, so emails are recorded in the admin email log rather than delivered.</p>'
    : `<form method="post" action="/account/forgot" class="form-stack"><p>Enter your email and we’ll send you a link to choose a new password.</p>${field('email', 'Email', { type: 'email', auto: 'email' })}<button class="btn btn--primary btn--full" type="submit"><span>Send reset link</span></button></form>`,
  '<p><a class="link" href="/account/login">Back to log in</a></p>');
}

export function resetPage(ctx, token, error) {
  return shell('Choose a new password', `${errorBox(error)}<form method="post" action="/account/reset" class="form-stack"><input type="hidden" name="token" value="${esc(token || '')}">
    ${field('password', 'New password', { type: 'password', auto: 'new-password', hint: 'At least 8 characters.' })}<button class="btn btn--primary btn--full" type="submit"><span>Save password</span></button></form>`);
}

const STATUS_LABEL = { paid: 'Paid', cancelled: 'Cancelled', refunded: 'Refunded', pending: 'Awaiting payment' };

export function accountPage(ctx, orders, q) {
  const c = ctx.customer, a = c.default_address || {};
  const notice = q.welcome ? 'Your account is ready. Welcome to the night owls!' : q.saved ? 'Address saved.' : q.reset ? 'Password updated.' : '';
  return `<div class="account section animation"><div class="animation--section-blocks">
    <div class="account__head" ${d(0)}><div><p class="eyebrow">Your account</p><h1 class="h1">Hello, ${esc(c.first_name || 'night owl')}</h1></div>
      <div class="account__actions">${c.is_admin ? '<a class="btn btn--secondary btn--small" href="/admin"><span>Store admin</span></a>' : ''}<form method="post" action="/account/logout"><button class="btn btn--secondary btn--small" type="submit"><span>${icon('logout', 16)} Log out</span></button></form></div></div>
    ${notice ? `<p class="notice" role="status" ${d(1)}>${esc(notice)}</p>` : ''}
    <div class="account__grid" ${d(2)}>
      <section><h2 class="h4">Orders</h2>
        ${orders.length ? `<div class="table-wrap"><table class="orders-table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td><a class="link" href="/orders/${o.token}">#${o.number}</a></td><td>${new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${o.line_items.reduce((s, l) => s + l.quantity, 0)}</td><td><span class="status status--${o.status}">${STATUS_LABEL[o.status] || o.status}${o.fulfillment_status === 'fulfilled' ? ' · Shipped' : ''}</span></td><td>${money(o.total_price)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">No orders yet. <a class="link" href="/collections/new-in">See what’s new</a>.</p>'}
      </section>
      <aside class="account__side">
        <section class="account__card"><h2 class="h5">Details</h2><p>${esc(c.first_name)} ${esc(c.last_name)}<br>${esc(c.email)}</p><p class="small muted">Member since ${new Date(c.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p></section>
        <section class="account__card"><h2 class="h5">Delivery address</h2>
          <details ${a.address1 ? '' : 'open'}><summary class="link">${a.address1 ? `${esc(a.address1)}, ${esc(a.city)} ${esc(a.zip)} — edit` : 'Add an address'}</summary>
          <form method="post" action="/account/address" class="form-stack form-stack--tight">
            <div class="field-row">${field('first_name', 'First name', { value: a.first_name || c.first_name })}${field('last_name', 'Last name', { value: a.last_name || c.last_name })}</div>
            ${field('address1', 'Address', { value: a.address1 })}${field('address2', 'Flat, suite, etc.', { value: a.address2, req: false })}
            <div class="field-row">${field('city', 'Town or city', { value: a.city })}${field('zip', 'Postcode', { value: a.zip })}</div>
            <label class="field"><span>Country</span><select name="country_code">${COUNTRIES.map(([k, n]) => `<option value="${k}" ${k === (a.country_code || 'GB') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <button class="btn btn--primary btn--small" type="submit"><span>Save address</span></button>
          </form></details></section>
        <section class="account__card"><h2 class="h5">Wishlist</h2><p>${ctx.wishlist.size} saved piece${ctx.wishlist.size === 1 ? '' : 's'}. <a class="link" href="/pages/wishlist">View wishlist</a></p></section>
      </aside>
    </div>
  </div></div>`;
}

export function wishlistPage(ctx, products) {
  return `<div class="section animation"><div class="animation--section-blocks">
    <p class="eyebrow" ${d(0)}>Saved for later</p><h1 class="h1" ${d(1)}>Wishlist</h1>
    ${products.length ? '' : `<p class="muted" ${d(2)}>Tap the heart on any piece to save it here.${ctx.customer ? '' : ' <a class="link" href="/account/login?next=/pages/wishlist">Log in</a> to keep your wishlist on every device.'}</p><div ${d(3)}><a class="btn btn--primary" href="/collections/all"><span>Browse the collection</span></a></div>`}
  </div>
  ${products.length ? `<div class="collection__grid animation--product-grid wishlist-grid">${products.map((p, i) => productCard(p, i)).join('')}</div>` : ''}</div>`;
}
