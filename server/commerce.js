// ---------------------------------------------------------------------------
// Commerce engine: carts, discounts, shipping, orders, inventory, events.
// Cart shapes and rules mirror Shopify's AJAX Cart API, so the theme JS works
// unchanged (design.md §8.5). Money is always integer pence.
//
// Carts live in Postgres (one row per `cart` cookie) and are mutated in memory
// then saved. Orders reserve stock inside a transaction with a conditional
// UPDATE (never below zero), are created as `pending`, and become `paid` only
// when Stripe confirms the payment. Unpaid orders release their stock when
// the Stripe session expires or the shopper cancels.
// ---------------------------------------------------------------------------
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { q, one, tx, bumpCatalog } from './db.js';
import { SHOP, variantById, byId, DISCOUNTS, SHIPPING_RATES } from './catalog.js';

export class CartError extends Error {
  constructor(status, message, description) { super(description); this.status = status; this.body = { status, message, description }; }
}

/* ---------------- events (the store's webhook log) ---------------- */
const SUBSCRIBERS = {
  'orders/create': ['Email (order received)', 'Analytics'],
  'orders/paid': ['Email (order confirmation)', 'Warehouse (pick & pack)', 'Analytics'],
  'orders/cancelled': ['Inventory (restock)'],
  'orders/fulfilled': ['Email (shipping confirmation)'],
  'refunds/create': ['Email (refund notice)', 'Inventory (restock)', 'Analytics'],
  'customers/create': ['Email (welcome)'],
  'products/update': ['Storefront cache'],
};
export async function logEvent(topic, ref, payload = {}, t) {
  const subs = SUBSCRIBERS[topic] || [];
  await (t || { q }).q('insert into events (topic, ref, payload) values ($1, $2, $3::jsonb)', [topic, ref ? String(ref) : null, JSON.stringify({ ...payload, delivered_to: subs })]);
}

/* ---------------- carts ---------------- */
export const newToken = () => randomBytes(16).toString('hex');

export async function getCart(token) {
  if (token && /^[a-f0-9]{32}$/.test(token)) {
    const row = await one('select * from carts where token = $1', [token]);
    if (row) return { token, items: row.items || [], note: row.note || '', attributes: row.attributes || {}, discount_code: row.discount_code, exists: true };
  }
  return { token: token && /^[a-f0-9]{32}$/.test(token) ? token : newToken(), items: [], note: '', attributes: {}, discount_code: null, exists: false };
}

export async function saveCart(cart) {
  // drop lines whose product was archived since the cart was created
  cart.items = cart.items.filter((l) => variantById.has(l.variant_id));
  await q(`insert into carts (token, items, note, attributes, discount_code, updated_at) values ($1, $2::jsonb, $3, $4::jsonb, $5, now())
    on conflict (token) do update set items = excluded.items, note = excluded.note, attributes = excluded.attributes, discount_code = excluded.discount_code, updated_at = now()`,
  [cart.token, JSON.stringify(cart.items), cart.note, JSON.stringify(cart.attributes), cart.discount_code]);
  cart.exists = true;
}

const propsHash = (props) => {
  const visible = Object.keys(props || {}).sort().map((k) => [k, props[k]]);
  return visible.length ? createHash('md5').update(JSON.stringify(visible)).digest('hex').slice(0, 12) : '';
};
const lineKey = (variantId, props) => `${variantId}:${propsHash(props)}`;

function stockCheck(variant, product, wanted) {
  if (variant.inventory_management && variant.inventory_policy === 'deny' && wanted > variant.inventory_quantity) {
    const left = variant.inventory_quantity;
    throw new CartError(422, 'Cart Error', left > 0 ? `You can only add ${left} of ${product.title} (${variant.option1}) to your bag.` : `${product.title} (${variant.option1}) is sold out.`);
  }
}
const qtyOfVariant = (cart, id) => cart.items.filter((l) => l.variant_id === id).reduce((s, l) => s + l.quantity, 0);

function cleanProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (typeof k !== 'string' || k.length > 60) continue;
    out[k] = String(v).slice(0, k === '_box_items' ? 4000 : 250);
  }
  return out;
}

/** POST /cart/add.js  body: { items:[{id, quantity, properties}] } or { id, quantity, properties } */
export function addItems(cart, body) {
  const items = Array.isArray(body.items) ? body.items : [body];
  const added = [];
  for (const it of items) {
    const id = Number(it.id), qty = Math.min(99, Math.max(1, Number(it.quantity || 1) | 0));
    const hit = variantById.get(id);
    if (!hit) throw new CartError(404, 'Cart Error', 'That product is no longer available.');
    const { variant, product } = hit;
    if (!variant.available) throw new CartError(422, 'Cart Error', `${product.title} (${variant.option1}) is sold out.`);
    const props = cleanProps(it.properties);
    const key = lineKey(id, props);
    const existing = cart.items.find((l) => l.key === key);
    stockCheck(variant, product, qtyOfVariant(cart, id) + qty);
    if (existing) existing.quantity += qty;
    else cart.items.push({ key, variant_id: id, quantity: qty, properties: props });
    added.push(key);
  }
  if (cart.items.length > 50) throw new CartError(422, 'Cart Error', 'Your bag is full.');
  validateGiftBoxes(cart);
  return added.map((k) => serializeLine(cart.items.find((l) => l.key === k)));
}

/** POST /cart/change.js  body: { id: key|variantId } or { line: 1-based }, quantity, properties */
export function changeItem(cart, body) {
  let idx = -1;
  if (body.line) idx = Number(body.line) - 1;
  else if (body.id !== undefined) { const id = String(body.id); idx = cart.items.findIndex((l) => l.key === id || String(l.variant_id) === id); }
  const line = cart.items[idx];
  if (!line) throw new CartError(400, 'Cart Error', 'no valid id or line parameter');
  if (body.properties) { line.properties = cleanProps(body.properties); line.key = lineKey(line.variant_id, line.properties); }
  const qty = body.quantity === undefined ? line.quantity : Math.min(99, Math.max(0, Number(body.quantity) | 0));
  if (qty === 0) removeLine(cart, idx);
  else {
    const hit = variantById.get(line.variant_id);
    if (!hit) { removeLine(cart, idx); return; }
    stockCheck(hit.variant, hit.product, qtyOfVariant(cart, line.variant_id) - line.quantity + qty);
    line.quantity = qty;
  }
  validateGiftBoxes(cart);
}

/** POST /cart/update.js  body: { updates: {key|variantId: qty} | [qty,...], note, attributes, discount } */
export function updateCart(cart, body) {
  if (body.updates) {
    const entries = Array.isArray(body.updates) ? body.updates.map((qq, i) => [cart.items[i]?.key, qq]) : Object.entries(body.updates);
    for (const [k, qq] of entries) {
      const line = cart.items.find((l) => l.key === k || String(l.variant_id) === String(k));
      if (line) changeItem(cart, { id: line.key, quantity: qq });
      else if (Number(qq) > 0) addItems(cart, { id: k, quantity: qq });
    }
  }
  if (typeof body.note === 'string') cart.note = body.note.slice(0, 1000);
  if (body.attributes && typeof body.attributes === 'object') for (const [k, v] of Object.entries(body.attributes).slice(0, 10)) cart.attributes[String(k).slice(0, 60)] = String(v).slice(0, 250);
  if (body.discount !== undefined) applyDiscount(cart, body.discount);
}

function removeLine(cart, idx) {
  const [line] = cart.items.splice(idx, 1);
  if (line?.properties?._box_items) return;            // removing a box releases its items
  for (const l of cart.items) {                       // removing an item updates its box
    if (!l.properties?._box_items) continue;
    const keys = safeJSON(l.properties._box_items, []).filter((k) => k !== line.key);
    l.properties = { ...l.properties, _box_items: JSON.stringify(keys) };
    l.key = lineKey(l.variant_id, l.properties);
  }
}
export function clearCart(cart) { cart.items = []; cart.note = ''; cart.attributes = {}; cart.discount_code = null; }
const safeJSON = (s, f) => { try { return JSON.parse(s); } catch { return f; } };

/** Gift boxes: the box line lists boxed line keys in `_box_items`; the server re-checks the points limit */
function validateGiftBoxes(cart) {
  const boxes = cart.items.filter((l) => l.properties?._box_items);
  if (boxes.length > 1) throw new CartError(422, 'Gift Box Error', 'One gift box per order, please.');
  for (const box of boxes) {
    const limit = variantById.get(box.variant_id)?.variant.metafields?.custom?.points_limit ?? Infinity;
    const keys = safeJSON(box.properties._box_items, []);
    const used = keys.reduce((sum, k) => {
      const l = cart.items.find((x) => x.key === k); if (!l) return sum;
      const hit = variantById.get(l.variant_id); if (!hit) return sum;
      return sum + (hit.product.metafields.custom?.points || 0); // one unit of each line goes in the box
    }, 0);
    if (used > limit) throw new CartError(422, 'Gift Box Error', `This box holds ${limit} points; your selection uses ${used}.`);
  }
}

/* ---------------- discounts ---------------- */
export function discountState(d, now = Date.now()) {
  if (!d || !d.active) return 'invalid';
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return 'scheduled';
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return 'expired';
  if (d.usage_limit != null && d.used >= d.usage_limit) return 'used_up';
  return 'ok';
}
export function applyDiscount(cart, code) {
  const c = String(code || '').trim().toUpperCase().slice(0, 40);
  if (!c) { cart.discount_code = null; return { applied: false }; }
  const state = discountState(DISCOUNTS[c]);
  if (state !== 'ok') { cart.discount_code = null; return { applied: false, reason: { expired: 'This code has expired', used_up: 'This code has been fully redeemed', scheduled: 'This code isn’t active yet' }[state] || 'Enter a valid discount code' }; }
  cart.discount_code = c;
  return { applied: true };
}
function discountFor(cart, subtotal) {
  const d = cart.discount_code && DISCOUNTS[cart.discount_code];
  if (!d || discountState(d) !== 'ok') return null;
  if (d.minimum && subtotal < d.minimum) return { code: d.code, amount: 0, applicable: false, reason: `Spend £${(d.minimum / 100).toFixed(2)} to use ${d.code}` };
  const amount = d.type === 'percentage' ? Math.round((subtotal * d.value) / 100) : Math.min(d.value, subtotal);
  return { code: d.code, amount, applicable: true, value: d.value, value_type: d.type, description: d.description };
}

/* ---------------- serialisation (Shopify /cart.js shape) ---------------- */
function serializeLine(line) {
  const { variant, product } = variantById.get(line.variant_id);
  const img = product.images[0]?.src || null;
  return {
    id: variant.id, key: line.key, quantity: line.quantity, variant_id: variant.id, product_id: product.id,
    title: product.title + (variant.title !== 'Default Title' ? ` - ${variant.title}` : ''),
    product_title: product.title, variant_title: variant.title, variant_options: [variant.option1, variant.option2].filter(Boolean),
    options_with_values: product.options.map((o, i) => ({ name: o.name, value: variant[`option${i + 1}`] })).filter((o) => o.value),
    price: variant.price, original_price: variant.price, discounted_price: variant.price,
    compare_at_price: variant.compare_at_price, line_price: variant.price * line.quantity,
    original_line_price: variant.price * line.quantity, final_price: variant.price, final_line_price: variant.price * line.quantity,
    sku: variant.sku, grams: variant.grams, vendor: product.vendor, product_type: product.product_type,
    properties: line.properties || {}, handle: product.handle, url: `/products/${product.handle}?variant=${variant.id}`,
    image: img, featured_image: { url: img, alt: product.title }, requires_shipping: true, taxable: true, gift_card: false,
    points: product.metafields.custom?.points || 0,
  };
}

export function serializeCart(cart) {
  const items = cart.items.filter((l) => variantById.has(l.variant_id)).map(serializeLine);
  const subtotal = items.reduce((s, l) => s + l.line_price, 0);
  const disc = discountFor(cart, subtotal);
  const total = subtotal - (disc?.applicable ? disc.amount : 0);
  return {
    token: cart.token, note: cart.note, attributes: cart.attributes,
    original_total_price: subtotal, items_subtotal_price: subtotal,
    total_discount: disc?.applicable ? disc.amount : 0, total_price: total,
    total_weight: items.reduce((s, l) => s + l.grams * l.quantity, 0),
    item_count: items.reduce((s, l) => s + l.quantity, 0), items,
    requires_shipping: items.length > 0, currency: SHOP.currency,
    cart_level_discount_applications: disc?.applicable ? [{ type: 'discount_code', key: disc.code, title: disc.code, description: disc.description, value: String(disc.value), value_type: disc.value_type, allocation_method: 'across', target_selection: 'all', target_type: 'line_item', total_allocated_amount: disc.amount }] : [],
    discount_codes: cart.discount_code ? [{ code: cart.discount_code, applicable: !!disc?.applicable, reason: disc?.reason }] : [],
    free_shipping: { threshold: SHOP.free_shipping_threshold, remaining: Math.max(0, SHOP.free_shipping_threshold - total), achieved: total >= SHOP.free_shipping_threshold },
  };
}

/* ---------------- shipping ---------------- */
export function shippingRates(country, cartJson) {
  return SHIPPING_RATES.filter((r) => r.countries.includes(country) || (r.countries.includes('*') && country !== 'GB'))
    .map((r) => ({ ...r, price: r.free_over && cartJson.total_price >= r.free_over ? 0 : r.price }));
}

/* ---------------- checkout → pending order (stock reserved) ---------------- */
const REQUIRED = ['email', 'first_name', 'last_name', 'address1', 'city', 'zip', 'country'];
const clip = (s, n = 120) => String(s ?? '').trim().slice(0, n);

export function validateCheckout(form) {
  const missing = REQUIRED.filter((k) => !clip(form[k]));
  if (missing.length) throw new CartError(422, 'Checkout Error', `Please fill in: ${missing.map((m) => m.replace('_', ' ')).join(', ')}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clip(form.email, 200))) throw new CartError(422, 'Checkout Error', 'Enter a valid email address');
}

export async function createPendingOrder(cart, form, customer) {
  validateCheckout(form);
  const cj = serializeCart(cart);
  if (!cj.items.length) throw new CartError(422, 'Checkout Error', 'Your bag is empty');
  const rates = shippingRates(clip(form.country, 2), cj);
  const rate = rates.find((r) => r.code === form.shipping) || rates[0];
  if (!rate) throw new CartError(422, 'Checkout Error', 'We don’t ship to that country yet');
  const total = cj.total_price + rate.price;
  const email = clip(form.email, 200).toLowerCase();
  const perVariant = new Map();
  for (const l of cj.items) perVariant.set(l.variant_id, (perVariant.get(l.variant_id) || 0) + l.quantity);

  return tx(async (t) => {
    for (const [id, qty] of perVariant) {
      const ok = await t.q(`update variants set inventory_quantity = case when inventory_management is null then inventory_quantity else inventory_quantity - $2 end
        where id = $1 and (inventory_management is null or inventory_policy = 'continue' or inventory_quantity >= $2) returning id, inventory_quantity`, [id, qty]);
      if (!ok.length) {
        const { product, variant } = variantById.get(id);
        throw new CartError(422, 'Checkout Error', `Sorry, ${product.title} (${variant.option1}) just sold out. Please update your bag.`);
      }
    }
    if (cj.discount_codes[0]?.applicable) {
      const d = await t.q('select * from discounts where code = $1 for update', [cj.discount_codes[0].code]);
      if (!d.length || discountState(d[0]) !== 'ok') throw new CartError(422, 'Checkout Error', 'Your discount code is no longer valid. Remove it to continue.');
    }
    const token = randomUUID().replace(/-/g, '');
    const address = { first_name: clip(form.first_name, 60), last_name: clip(form.last_name, 60), address1: clip(form.address1), address2: clip(form.address2), city: clip(form.city, 60), zip: clip(form.zip, 20), country_code: clip(form.country, 2), phone: clip(form.phone, 30) };
    const [order] = await t.q(`insert into orders (token, cart_token, customer_id, email, status, customer, shipping_address, line_items, discount_codes, subtotal_price, total_discounts, shipping_lines, total_tax, total_price, note, expires_at)
      values ($1,$2,$3,$4,'pending',$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12,$13,$14, now() + interval '35 minutes') returning *`, [
      token, cart.token, customer?.id || null, email,
      JSON.stringify({ first_name: address.first_name, last_name: address.last_name, email, accepts_marketing: form.marketing === 'on' || form.marketing === true }),
      JSON.stringify(address),
      JSON.stringify(cj.items.map((l) => ({ variant_id: l.variant_id, product_id: l.product_id, title: l.product_title, variant_title: l.variant_title, sku: l.sku, quantity: l.quantity, price: l.price, image: l.image, handle: l.handle, properties: l.properties }))),
      JSON.stringify(cj.cart_level_discount_applications.map((d) => ({ code: d.title, amount: d.total_allocated_amount }))),
      cj.items_subtotal_price, cj.total_discount,
      JSON.stringify([{ code: rate.code, title: rate.title, price: rate.price }]),
      Math.round((total * 20) / 120), total, clip(cj.note, 1000),
    ]);
    await bumpCatalog(t);
    await logEvent('orders/create', order.number, { total: order.total_price, email }, t);
    return order;
  });
}

/** Return reserved stock and close an unpaid order (shopper cancelled, or the Stripe session expired) */
export async function releaseOrder(token, reason = 'expired') {
  return tx(async (t) => {
    const [order] = await t.q("update orders set status = 'cancelled', cancelled_at = now() where token = $1 and status = 'pending' returning *", [token]);
    if (!order) return null;
    await restock(t, order.line_items);
    await logEvent('orders/cancelled', order.number, { reason }, t);
    return order;
  });
}
export async function restock(t, lines) {
  for (const l of lines) await t.q('update variants set inventory_quantity = inventory_quantity + $2 where id = $1 and inventory_management is not null', [l.variant_id, l.quantity]);
  await bumpCatalog(t);
}

/** Release every pending order whose payment window has closed (called lazily from checkout and admin) */
export async function sweepExpired() {
  const rows = await q("select token from orders where status = 'pending' and expires_at < now() limit 20");
  for (const r of rows) await releaseOrder(r.token, 'payment window expired');
  return rows.length;
}

/**
 * Payment confirmed (Stripe webhook or the success redirect, whichever arrives first).
 * Idempotent: only the first caller flips pending → paid and runs the side effects.
 */
export async function markPaid(token, { payment_intent, session_id, gateway = 'stripe' } = {}) {
  const result = await tx(async (t) => {
    let [order] = await t.q(`update orders set status = 'paid', paid_at = now(), stripe_payment_intent = coalesce($2, stripe_payment_intent), stripe_session_id = coalesce($3, stripe_session_id), gateway = $4
      where token = $1 and status = 'pending' returning *`, [token, payment_intent || null, session_id || null, gateway]);
    if (!order) {
      // Paid after we released it (rare: Stripe expiry race) → take the stock again, allowing it to go negative so staff can see it
      [order] = await t.q(`update orders set status = 'paid', paid_at = now(), cancelled_at = null, stripe_payment_intent = coalesce($2, stripe_payment_intent), gateway = $3
        where token = $1 and status = 'cancelled' and paid_at is null and $2::text is not null returning *`, [token, payment_intent || null, gateway]);
      if (!order) return null;
      for (const l of order.line_items) await t.q('update variants set inventory_quantity = inventory_quantity - $2 where id = $1 and inventory_management is not null', [l.variant_id, l.quantity]);
    }
    for (const d of order.discount_codes) await t.q('update discounts set used = used + 1 where code = $1', [d.code]);
    const sold = new Map();
    for (const l of order.line_items) sold.set(l.product_id, (sold.get(l.product_id) || 0) + l.quantity);
    for (const [pid, n] of sold) await t.q('update products set sales_count = sales_count + $2 where id = $1', [pid, n]);
    // attach to an existing customer account, or create a guest customer record
    const c = order.customer;
    const [cust] = await t.q(`insert into customers (email, first_name, last_name, accepts_marketing) values ($1,$2,$3,$4)
      on conflict (email) do update set first_name = case when customers.first_name = '' then excluded.first_name else customers.first_name end,
        last_name = case when customers.last_name = '' then excluded.last_name else customers.last_name end,
        accepts_marketing = customers.accepts_marketing or excluded.accepts_marketing,
        default_address = coalesce(customers.default_address, $5::jsonb)
      returning id`, [order.email, c.first_name || '', c.last_name || '', !!c.accepts_marketing, JSON.stringify(order.shipping_address)]);
    await t.q('update orders set customer_id = $2 where id = $1', [order.id, cust.id]);
    if (c.accepts_marketing) await t.q("insert into subscribers (email, source) values ($1, 'checkout') on conflict do nothing", [order.email]);
    if (order.cart_token) await t.q("update carts set items = '[]'::jsonb, discount_code = null, note = '' where token = $1", [order.cart_token]);
    await bumpCatalog(t);
    await logEvent('orders/paid', order.number, { total: order.total_price, payment_intent, gateway }, t);
    return { ...order, customer_id: cust.id };
  });
  return result;
}

/* ---------------- newsletter ---------------- */
export async function subscribe(email, source = 'popup') {
  const e = clip(email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw new CartError(422, 'Form Error', 'Enter a valid email');
  const rows = await q('insert into subscribers (email, source) values ($1, $2) on conflict do nothing returning email', [e, clip(source, 20)]);
  return { ok: true, code: 'WELCOME10', isNew: rows.length > 0, email: e };
}

export const orderByToken = (token) => one('select * from orders where token = $1', [String(token).slice(0, 64)]);
export const productById = (id) => byId.get(Number(id));
