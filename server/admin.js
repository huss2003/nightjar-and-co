// ---------------------------------------------------------------------------
// Store admin (/admin). A compact slice of what a merchant does in Shopify
// admin: dashboard, orders (fulfil, refund, cancel), products & stock,
// discount codes, customers, subscribers, reviews, email log, event log and
// Stripe settings. Every route requires a logged-in customer with is_admin.
// ---------------------------------------------------------------------------
import { q, one, tx, bumpCatalog } from './db.js';
import * as A from './auth.js';
import * as C from './commerce.js';
import * as S from './stripe.js';
import * as E from './email.js';
import { recalcRating } from './reviews.js';
import { PRINTS, TYPES, refreshCatalog } from './catalog.js';
import { slug } from './seed.js';
import { esc, money, icon } from '../theme/snippets/helpers.js';

const pounds = (v) => { const n = Math.round(parseFloat(String(v ?? '').replace(/[£,\s]/g, '')) * 100); return Number.isFinite(n) && n >= 0 ? n : null; };
const fmtDate = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS = { pending: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled', refunded: 'Refunded' };
const pill = (s, label) => `<span class="pill pill--${esc(s)}">${esc(label || s)}</span>`;

export async function handleAdmin({ p, q: query, body, method, ctx, customer, send, sendJSON, redirect, origin, setCookies, secure, ip }) {
  const page = (title, main, active, status = 200) => send(status, layout(title, main, active, customer), undefined, { 'x-robots-tag': 'noindex, nofollow' });
  let m;

  /* ---------- login ---------- */
  if (p === '/admin/login') {
    if (customer?.is_admin) return redirect('/admin');
    let error = '';
    if (method === 'POST') {
      try {
        const c = await A.login(body.email, body.password, ip);
        if (!c.is_admin) throw new A.AuthError('That account doesn’t have admin access.');
        setCookies.push(A.sessionCookie(await A.createSession(c.id), secure));
        return redirect('/admin');
      } catch (e) { if (!(e instanceof A.AuthError)) throw e; error = e.message; }
    }
    return send(method === 'POST' ? 401 : 200, loginView(error, body.email), undefined, { 'x-robots-tag': 'noindex, nofollow' });
  }
  if (!customer?.is_admin) return redirect(`/admin/login`);

  /* ---------- dashboard ---------- */
  if (p === '/admin') {
    const swept = await C.sweepExpired();
    const [stats] = await q(`select
      coalesce(sum(total_price) filter (where status = 'paid'), 0)::int as revenue,
      count(*) filter (where status = 'paid')::int as paid,
      count(*) filter (where status = 'paid' and fulfillment_status is null)::int as to_ship,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'refunded')::int as refunded,
      count(*) filter (where status = 'paid' and created_at > now() - interval '1 day')::int as today
      from orders`);
    const [counts] = await q('select (select count(*) from customers where not is_admin)::int as customers, (select count(*) from subscribers)::int as subscribers, (select count(*) from products where status = \'active\')::int as products, (select count(*) from reviews)::int as reviews');
    const days = await q(`select to_char(d, 'DD Mon') as day, coalesce(sum(o.total_price), 0)::int as total, count(o.id)::int as n
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
      left join orders o on o.status = 'paid' and date_trunc('day', o.paid_at) = d group by d order by d`);
    const recent = await q('select number, email, status, fulfillment_status, total_price, created_at from orders order by created_at desc limit 8');
    const low = await q("select p.id, p.title, v.option1, v.inventory_quantity from variants v join products p on p.id = v.product_id where p.status = 'active' and v.inventory_management is not null and v.inventory_quantity <= 3 order by v.inventory_quantity, p.title limit 12");
    const top = await q("select id, title, sales_count from products where sales_count > 0 order by sales_count desc limit 5");
    const max = Math.max(1, ...days.map((x) => x.total));
    return page('Dashboard', `
      <div class="a-head"><h1>Good ${new Date().getHours() < 12 ? 'morning' : 'evening'}, ${esc(customer.first_name || 'there')}</h1><a class="a-btn a-btn--ghost" href="/" target="_blank">View shop ↗</a></div>
      ${!S.stripeEnabled() ? '<p class="a-alert">Stripe isn’t configured: orders are placed without payment. Add STRIPE_SECRET_KEY to enable checkout.</p>' : ''}
      ${swept ? `<p class="a-note">Released ${swept} unpaid order${swept > 1 ? 's' : ''} whose payment window had closed.</p>` : ''}
      <div class="a-stats">
        ${stat('Revenue', money(stats.revenue), 'paid orders')}${stat('Orders', stats.paid, `${stats.today} in the last 24h`)}
        ${stat('Average order', money(stats.paid ? Math.round(stats.revenue / stats.paid) : 0), 'per paid order')}${stat('To ship', stats.to_ship, `${stats.pending} awaiting payment`)}
        ${stat('Customers', counts.customers, `${counts.subscribers} subscribers`)}${stat('Products', counts.products, `${counts.reviews} reviews`)}
      </div>
      <div class="a-grid">
        <section class="a-card a-span2"><h2>Sales, last 14 days</h2><div class="a-chart">${days.map((x) => `<div class="a-bar" title="${esc(x.day)}: ${money(x.total)} (${x.n} orders)"><span style="height:${Math.max(2, Math.round((x.total / max) * 100))}%"></span><small>${esc(x.day.split(' ')[0])}</small></div>`).join('')}</div></section>
        <section class="a-card"><h2>Best sellers</h2>${top.length ? `<ol class="a-list">${top.map((t) => `<li><a href="/admin/products/${t.id}">${esc(t.title)}</a><span>${t.sales_count} sold</span></li>`).join('')}</ol>` : '<p class="a-muted">No sales yet.</p>'}</section>
        <section class="a-card a-span2"><h2>Latest orders <a href="/admin/orders">All orders →</a></h2>${ordersTable(recent)}</section>
        <section class="a-card"><h2>Low stock <a href="/admin/products?stock=low">See all →</a></h2>${low.length ? `<ul class="a-list">${low.map((l) => `<li><a href="/admin/products/${l.id}">${esc(l.title)} · ${esc(l.option1)}</a><span class="${l.inventory_quantity <= 0 ? 'a-red' : ''}">${l.inventory_quantity}</span></li>`).join('')}</ul>` : '<p class="a-muted">Everything is well stocked.</p>'}</section>
      </div>`, 'dashboard');
  }

  /* ---------- orders ---------- */
  if (p === '/admin/orders') {
    const st = ['pending', 'paid', 'cancelled', 'refunded', 'to-ship'].includes(query.status) ? query.status : '';
    const search = String(query.q || '').trim().slice(0, 80);
    const where = [], params = [];
    if (st === 'to-ship') where.push("status = 'paid' and fulfillment_status is null");
    else if (st) { params.push(st); where.push(`status = $${params.length}`); }
    if (search) { params.push(`%${search.toLowerCase()}%`); where.push(`(lower(email) like $${params.length} or number::text like $${params.length})`); }
    const rows = await q(`select number, email, status, fulfillment_status, total_price, created_at, customer from orders ${where.length ? `where ${where.join(' and ')}` : ''} order by created_at desc limit 200`, params);
    const tabs = [['', 'All'], ['to-ship', 'To ship'], ['paid', 'Paid'], ['pending', 'Awaiting payment'], ['cancelled', 'Cancelled'], ['refunded', 'Refunded']];
    return page('Orders', `<div class="a-head"><h1>Orders</h1><form class="a-search"><input name="q" value="${esc(search)}" placeholder="Search email or order number"><input type="hidden" name="status" value="${esc(st)}"></form></div>
      <nav class="a-tabs">${tabs.map(([k, l]) => `<a href="/admin/orders${k ? `?status=${k}` : ''}" class="${k === st ? 'is-active' : ''}">${l}</a>`).join('')}</nav>
      <section class="a-card">${ordersTable(rows, true)}</section>`, 'orders');
  }
  if ((m = p.match(/^\/admin\/orders\/(\d+)(?:\/(fulfil|refund|cancel|note))?$/))) {
    const order = await one('select * from orders where number = $1', [Number(m[1])]);
    if (!order) return page('Not found', '<h1>Order not found</h1>', 'orders', 404);
    const action = m[2];
    if (method === 'POST' && action) {
      let msg = '';
      try {
        if (action === 'fulfil' && order.status === 'paid' && !order.fulfillment_status) {
          const f = { carrier: String(body.carrier || 'Royal Mail').slice(0, 40), tracking_number: String(body.tracking_number || '').slice(0, 60), created_at: new Date().toISOString() };
          await q("update orders set fulfillment_status = 'fulfilled', fulfillments = fulfillments || $2::jsonb where id = $1", [order.id, JSON.stringify([f])]);
          await C.logEvent('orders/fulfilled', order.number, f);
          if (body.notify === 'on') await E.shippingConfirmation(order, f, origin);
          msg = 'Marked as shipped';
        }
        if (action === 'refund' && order.status === 'paid') {
          const amount = Math.min(order.total_price, pounds(body.amount) ?? order.total_price);
          if (order.stripe_payment_intent && S.stripeEnabled()) await S.refund(order.stripe_payment_intent, amount);
          const full = amount >= order.total_price;
          await tx(async (t) => {
            await t.q(`update orders set status = case when $3 then 'refunded' else status end, refunds = refunds || $2::jsonb where id = $1`, [order.id, JSON.stringify([{ amount, restock: body.restock === 'on', created_at: new Date().toISOString() }]), full]);
            if (body.restock === 'on') await C.restock(t, order.line_items);
            await C.logEvent('refunds/create', order.number, { amount, full }, t);
          });
          await E.refundNotice(order, amount, origin);
          msg = `Refunded ${money(amount)}`;
        }
        if (action === 'cancel' && order.status === 'pending') { await C.releaseOrder(order.token, 'cancelled by staff'); msg = 'Order cancelled and stock released'; }
        if (action === 'note') { await q('update orders set note = $2 where id = $1', [order.id, String(body.note || '').slice(0, 1000)]); msg = 'Note saved'; }
      } catch (e) { msg = `Error: ${e.message}`; }
      return redirect(`/admin/orders/${order.number}?msg=${encodeURIComponent(msg)}`);
    }
    const events = await q('select topic, payload, created_at from events where ref = $1 order by created_at', [String(order.number)]);
    return page(`Order #${order.number}`, orderView(order, events, query.msg), 'orders');
  }

  /* ---------- products ---------- */
  if (p === '/admin/products') {
    const search = String(query.q || '').trim().slice(0, 80);
    const params = [], where = [];
    if (search) { params.push(`%${search.toLowerCase()}%`); where.push(`lower(p.title) like $${params.length}`); }
    if (query.status && ['active', 'draft', 'archived'].includes(query.status)) { params.push(query.status); where.push(`p.status = $${params.length}`); }
    const rows = await q(`select p.id, p.title, p.status, p.product_type, p.images, p.sales_count, p.metafields,
      min(v.price)::int as price, sum(case when v.inventory_management is null then null else v.inventory_quantity end)::int as stock, count(v.id)::int as variants,
      min(case when v.inventory_management is null then 999 else v.inventory_quantity end)::int as min_stock
      from products p left join variants v on v.product_id = p.id ${where.length ? `where ${where.join(' and ')}` : ''} group by p.id ${query.stock === 'low' ? 'having min(case when v.inventory_management is null then 999 else v.inventory_quantity end) <= 3' : ''} order by p.status, p.created_at desc limit 300`, params);
    return page('Products', `<div class="a-head"><h1>Products</h1><div class="a-actions"><form class="a-search"><input name="q" value="${esc(search)}" placeholder="Search products"></form><a class="a-btn" href="/admin/products/new">${icon('plus', 14)} Add product</a></div></div>
      <nav class="a-tabs">${[['', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']].map(([k, l]) => `<a href="/admin/products${k ? `?status=${k}` : ''}" class="${(query.status || '') === k && !query.stock ? 'is-active' : ''}">${l}</a>`).join('')}<a href="/admin/products?stock=low" class="${query.stock ? 'is-active' : ''}">Low stock</a></nav>
      <section class="a-card"><table class="a-table"><thead><tr><th></th><th>Product</th><th>Status</th><th>Type</th><th>Price</th><th>Stock</th><th>Sold</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><img class="a-thumb" src="${esc(r.images[0]?.src || '')}" alt="" loading="lazy"></td><td><a href="/admin/products/${r.id}">${esc(r.title)}</a><small>${r.variants} variant${r.variants === 1 ? '' : 's'}${r.metafields?.reviews?.rating_count ? ` · ★ ${r.metafields.reviews.rating} (${r.metafields.reviews.rating_count})` : ''}</small></td><td>${pill(r.status)}</td><td>${esc(r.product_type)}</td><td>${money(r.price || 0)}</td><td class="${r.min_stock <= 0 ? 'a-red' : r.min_stock <= 3 ? 'a-amber' : ''}">${r.stock ?? '∞'}</td><td>${r.sales_count}</td></tr>`).join('') || '<tr><td colspan="7">No products found.</td></tr>'}
      </tbody></table></section>`, 'products');
  }
  if (p === '/admin/products/new') {
    if (method === 'POST') {
      const print = PRINTS.find((x) => x.name === body.print) || PRINTS[0];
      const type = TYPES.find((x) => x.type === body.type) || TYPES[0];
      const title = String(body.title || `${print.name} ${type.noun}`).trim().slice(0, 120);
      const price = pounds(body.price) ?? type.price;
      const id = await tx(async (t) => {
        const [{ id: pid }] = await t.q("select nextval('product_id_seq')::bigint as id");
        let handle = slug(title);
        if ((await t.q('select 1 from products where handle = $1', [handle])).length) handle = `${handle}-${String(pid).slice(-4)}`;
        await t.q(`insert into products (id, handle, title, body_html, product_type, tags, status, options, images, metafields) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)`, [
          pid, handle, title, `<p>${esc(String(body.description || `${print.name}, printed on ${type.fabric.toLowerCase()}.`)).slice(0, 2000)}</p>`, type.type,
          ['new', type.fabric.toLowerCase(), print.pattern], body.status === 'active' ? 'active' : 'draft',
          JSON.stringify([{ name: 'Size', position: 1, values: type.sizes }, { name: 'Color', position: 2, values: [print.color] }]),
          JSON.stringify([0, 1, 2, 3].map((n) => ({ position: n + 1, src: `/img/product/${pid}/${n}.svg`, alt: `${title}, image ${n + 1}` }))),
          JSON.stringify({ custom: { fabric: type.fabric, cut: type.cut, print: print.name, pattern: print.pattern, colors: print.colors, audience: type.audience, points: type.points, upsell_products: [] }, reviews: { rating: 0, rating_count: 0 } })]);
        for (const [i, size] of type.sizes.entries()) {
          await t.q(`insert into variants (id, product_id, title, option1, option2, sku, price, inventory_quantity, grams, position) values (nextval('variant_id_seq'),$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [pid, `${size} / ${print.color}`, size, print.color, `NJ-${slug(print.name).slice(0, 4).toUpperCase()}-${slug(type.cut).slice(0, 3).toUpperCase()}-${String(pid).slice(-3)}${i}`, price, Math.max(0, Number(body.stock) | 0), type.audience === 'accessories' ? 120 : 400, i + 1]);
        }
        await bumpCatalog(t);
        await C.logEvent('products/create', pid, { title }, t);
        return pid;
      });
      return redirect(`/admin/products/${id}?msg=${encodeURIComponent('Product created')}`);
    }
    return page('Add product', newProductView(), 'products');
  }
  if ((m = p.match(/^\/admin\/products\/(\d+)$/))) {
    const prod = await one('select * from products where id = $1', [Number(m[1])]);
    if (!prod) return page('Not found', '<h1>Product not found</h1>', 'products', 404);
    const variants = await q('select * from variants where product_id = $1 order by position', [prod.id]);
    if (method === 'POST') {
      const status = ['active', 'draft', 'archived'].includes(body.status) ? body.status : prod.status;
      const images = String(body.images || '').split('\n').map((s) => s.trim()).filter((s) => /^(https:\/\/|\/img\/)/.test(s)).slice(0, 10).map((src, i) => ({ position: i + 1, src, alt: `${body.title || prod.title}, image ${i + 1}` }));
      await tx(async (t) => {
        await t.q(`update products set title = $2, body_html = $3, status = $4, tags = $5, images = $6::jsonb, updated_at = now() where id = $1`, [
          prod.id, String(body.title || prod.title).slice(0, 160), String(body.body_html ?? prod.body_html).slice(0, 8000), status,
          String(body.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30), JSON.stringify(images.length ? images : prod.images)]);
        for (const v of variants) {
          const pr = pounds(body[`price_${v.id}`]), cmp = String(body[`compare_${v.id}`] || '').trim() === '' ? null : pounds(body[`compare_${v.id}`]);
          const stock = body[`stock_${v.id}`] === undefined ? v.inventory_quantity : Number.parseInt(body[`stock_${v.id}`], 10);
          await t.q('update variants set price = $2, compare_at_price = $3, inventory_quantity = $4, sku = $5 where id = $1', [v.id, pr ?? v.price, cmp, Number.isFinite(stock) ? stock : v.inventory_quantity, String(body[`sku_${v.id}`] || v.sku).slice(0, 60)]);
        }
        await bumpCatalog(t);
        await C.logEvent('products/update', prod.id, { title: prod.title, status }, t);
      });
      return redirect(`/admin/products/${prod.id}?msg=${encodeURIComponent('Saved')}`);
    }
    return page(prod.title, productView(prod, variants, query.msg), 'products');
  }

  /* ---------- discounts ---------- */
  if (p === '/admin/discounts') {
    let err = '';
    if (method === 'POST') {
      const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
      const type = body.type === 'fixed_amount' ? 'fixed_amount' : 'percentage';
      const value = type === 'percentage' ? Math.min(100, Math.max(1, Number(body.value) | 0)) : pounds(body.value);
      if (!code || !value) err = 'Enter a code and a value.';
      else {
        const rows = await q(`insert into discounts (code, type, value, description, minimum, usage_limit, ends_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (code) do nothing returning code`, [
          code, type, value, String(body.description || '').slice(0, 120) || (type === 'percentage' ? `${value}% off` : `${money(value)} off`), pounds(body.minimum) || 0,
          body.usage_limit ? Math.max(1, Number(body.usage_limit) | 0) : null, body.ends_at ? new Date(body.ends_at) : null]);
        if (!rows.length) err = 'That code already exists.'; else { await bumpCatalog(); return redirect('/admin/discounts'); }
      }
    }
    const rows = await q('select * from discounts order by created_at desc');
    return page('Discounts', discountsView(rows, err, body), 'discounts');
  }
  if ((m = p.match(/^\/admin\/discounts\/([A-Z0-9_-]+)\/(toggle|delete)$/)) && method === 'POST') {
    if (m[2] === 'toggle') await q('update discounts set active = not active where code = $1', [m[1]]);
    else await q('delete from discounts where code = $1', [m[1]]);
    await bumpCatalog();
    return redirect('/admin/discounts');
  }

  /* ---------- customers & subscribers ---------- */
  if (p === '/admin/customers') {
    const rows = await q(`select c.id, c.email, c.first_name, c.last_name, c.accepts_marketing, c.is_admin, c.password_hash is not null as has_account, c.created_at,
      count(o.id) filter (where o.status = 'paid')::int as orders, coalesce(sum(o.total_price) filter (where o.status = 'paid'), 0)::int as spent
      from customers c left join orders o on o.customer_id = c.id group by c.id order by c.created_at desc limit 300`);
    return page('Customers', `<div class="a-head"><h1>Customers</h1></div><section class="a-card"><table class="a-table"><thead><tr><th>Name</th><th>Email</th><th>Account</th><th>Marketing</th><th>Orders</th><th>Spent</th><th>Since</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(`${r.first_name} ${r.last_name}`.trim() || '—')}${r.is_admin ? ' ' + pill('admin') : ''}</td><td><a href="/admin/orders?q=${encodeURIComponent(r.email)}">${esc(r.email)}</a></td><td>${r.has_account ? 'Registered' : 'Guest'}</td><td>${r.accepts_marketing ? 'Subscribed' : '—'}</td><td>${r.orders}</td><td>${money(r.spent)}</td><td>${new Date(r.created_at).toLocaleDateString('en-GB')}</td></tr>`).join('') || '<tr><td colspan="7">No customers yet.</td></tr>'}
      </tbody></table></section>`, 'customers');
  }
  if (p === '/admin/subscribers.csv') {
    const rows = await q('select email, source, created_at from subscribers order by created_at');
    const csv = ['email,source,created_at', ...rows.map((r) => [r.email, r.source, new Date(r.created_at).toISOString()].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    return send(200, csv, 'text/csv; charset=utf-8', { 'content-disposition': 'attachment; filename="subscribers.csv"' });
  }
  if (p === '/admin/subscribers') {
    const rows = await q('select * from subscribers order by created_at desc limit 500');
    return page('Subscribers', `<div class="a-head"><h1>Subscribers <small>${rows.length}</small></h1><a class="a-btn a-btn--ghost" href="/admin/subscribers.csv">Export CSV</a></div><section class="a-card"><table class="a-table"><thead><tr><th>Email</th><th>Source</th><th>Joined</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.source)}</td><td>${fmtDate(r.created_at)}</td></tr>`).join('') || '<tr><td colspan="3">No subscribers yet.</td></tr>'}</tbody></table></section>`, 'subscribers');
  }

  /* ---------- reviews ---------- */
  if (p === '/admin/reviews') {
    const rows = await q('select r.*, p.title from reviews r join products p on p.id = r.product_id order by r.created_at desc limit 300');
    return page('Reviews', `<div class="a-head"><h1>Reviews</h1></div><section class="a-card"><table class="a-table"><thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Author</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><a href="/admin/products/${r.product_id}">${esc(r.title)}</a></td><td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td><td><strong>${esc(r.title)}</strong><small>${esc(r.body.slice(0, 160))}</small></td><td>${esc(r.author)}${r.verified ? ' ' + pill('verified') : ''}<small>${esc(r.email)}</small></td><td>${pill(r.status)}</td>
      <td class="a-row-actions"><form method="post" action="/admin/reviews/${r.id}/toggle"><button class="a-link">${r.status === 'published' ? 'Hide' : 'Publish'}</button></form><form method="post" action="/admin/reviews/${r.id}/delete" data-confirm="Delete this review?"><button class="a-link a-red">Delete</button></form></td></tr>`).join('') || '<tr><td colspan="6">No reviews yet. Reviews appear here when customers leave them on product pages.</td></tr>'}
      </tbody></table></section>`, 'reviews');
  }
  if ((m = p.match(/^\/admin\/reviews\/(\d+)\/(toggle|delete)$/)) && method === 'POST') {
    const r = await one('select product_id from reviews where id = $1', [Number(m[1])]);
    if (r) {
      if (m[2] === 'toggle') await q("update reviews set status = case when status = 'published' then 'hidden' else 'published' end where id = $1", [Number(m[1])]);
      else await q('delete from reviews where id = $1', [Number(m[1])]);
      await recalcRating(r.product_id);
    }
    return redirect('/admin/reviews');
  }

  /* ---------- email & event logs ---------- */
  if (p === '/admin/emails') {
    const rows = await q('select id, to_email, subject, kind, status, created_at from emails order by created_at desc limit 200');
    return page('Email log', `<div class="a-head"><h1>Email log</h1></div><p class="a-note">Every customer email is recorded here. ${process.env.RESEND_API_KEY ? 'They are also sent through Resend.' : 'Add a RESEND_API_KEY to deliver them for real; until then they are logged only.'}</p>
      <section class="a-card"><table class="a-table"><thead><tr><th>To</th><th>Subject</th><th>Type</th><th>Status</th><th>Sent</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.to_email)}</td><td><a href="/admin/emails/${r.id}" target="_blank">${esc(r.subject)} ↗</a></td><td>${esc(r.kind)}</td><td>${pill(r.status === 'sent' ? 'paid' : 'pending', r.status)}</td><td>${fmtDate(r.created_at)}</td></tr>`).join('') || '<tr><td colspan="5">No emails yet.</td></tr>'}</tbody></table></section>`, 'emails');
  }
  if ((m = p.match(/^\/admin\/emails\/(\d+)$/))) {
    const e = await one('select html from emails where id = $1', [Number(m[1])]);
    return e ? send(200, e.html, 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'none'" }) : send(404, 'Not found', 'text/plain');
  }
  if (p === '/admin/events') {
    const rows = await q('select topic, ref, payload, created_at from events order by created_at desc limit 300');
    return page('Events', `<div class="a-head"><h1>Event log</h1></div><p class="a-note">The store’s internal webhooks: what happened, and which services were notified.</p>
      <section class="a-card"><table class="a-table"><thead><tr><th>When</th><th>Topic</th><th>Ref</th><th>Delivered to</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${fmtDate(r.created_at)}</td><td><code>${esc(r.topic)}</code></td><td>${r.ref && /^orders|refunds/.test(r.topic) ? `<a href="/admin/orders/${esc(r.ref)}">#${esc(r.ref)}</a>` : esc(r.ref || '')}</td><td><small>${esc((r.payload.delivered_to || []).join(', ') || '—')}</small></td></tr>`).join('') || '<tr><td colspan="4">No events yet.</td></tr>'}</tbody></table></section>`, 'events');
  }

  /* ---------- settings ---------- */
  if (p === '/admin/settings/webhook' && method === 'POST') {
    let msg;
    try { const ep = await S.connectWebhook(origin); msg = `Connected: Stripe will send payment events to ${ep.url}`; } catch (e) { msg = `Couldn’t connect: ${e.message}`; }
    return redirect(`/admin/settings?msg=${encodeURIComponent(msg)}`);
  }
  if (p === '/admin/settings') {
    const wh = await (await import('./db.js')).getMeta('stripe_webhook_secret', null);
    return page('Settings', `<div class="a-head"><h1>Settings</h1></div>${query.msg ? `<p class="a-note">${esc(query.msg)}</p>` : ''}
      <section class="a-card a-narrow"><h2>Payments</h2>
        <dl class="a-dl"><div><dt>Stripe</dt><dd>${S.stripeEnabled() ? `${pill('paid', 'Connected')} ${S.stripeTestMode() ? pill('pending', 'Test mode') : pill('paid', 'Live mode')}` : pill('cancelled', 'Not configured')}</dd></div>
        <div><dt>Webhooks</dt><dd>${process.env.STRIPE_WEBHOOK_SECRET ? 'Signing secret set in environment' : wh ? `Endpoint ${esc(wh.url)}<br><small>connected ${fmtDate(wh.created)}</small>` : 'Not connected yet. Orders are still confirmed when the shopper returns from Stripe.'}</dd></div></dl>
        ${S.stripeEnabled() ? `<form method="post" action="/admin/settings/webhook"><button class="a-btn">${wh ? 'Reconnect' : 'Connect'} Stripe webhooks</button></form><p class="a-muted">Registers <code>${esc(origin)}/webhooks/stripe</code> with Stripe for checkout and refund events, and stores the signing secret.</p>` : ''}
      </section>
      <section class="a-card a-narrow"><h2>Store</h2><dl class="a-dl"><div><dt>Currency</dt><dd>GBP (prices include VAT)</dd></div><div><dt>Free delivery</dt><dd>UK orders over £60</dd></div><div><dt>Database</dt><dd>${process.env.DATABASE_URL ? 'Neon Postgres' : 'PGlite (local)'}</dd></div><div><dt>Email</dt><dd>${process.env.RESEND_API_KEY ? 'Resend' : 'Logged only'}</dd></div></dl></section>`, 'settings');
  }
  if (p === '/admin/orders.json') return sendJSON(200, { orders: await q('select * from orders order by created_at desc limit 250') });

  return page('Not found', '<h1>Page not found</h1>', '', 404);
}

/* ---------------- views ---------------- */
const NAV = [['dashboard', '/admin', 'Dashboard'], ['orders', '/admin/orders', 'Orders'], ['products', '/admin/products', 'Products'], ['discounts', '/admin/discounts', 'Discounts'], ['customers', '/admin/customers', 'Customers'], ['subscribers', '/admin/subscribers', 'Subscribers'], ['reviews', '/admin/reviews', 'Reviews'], ['emails', '/admin/emails', 'Email log'], ['events', '/admin/events', 'Events'], ['settings', '/admin/settings', 'Settings']];

function layout(title, main, active, customer) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
  <title>${esc(title)} · Nightjar admin</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap"><link rel="stylesheet" href="/assets/admin.css"><script type="module" src="/assets/admin.js"></script></head>
  <body class="a-body"><aside class="a-side"><a class="a-logo" href="/admin">${icon('moon', 18)} Nightjar <span>admin</span></a><nav>${NAV.map(([k, h, l]) => `<a href="${h}" class="${k === active ? 'is-active' : ''}">${l}</a>`).join('')}</nav>
  <div class="a-who"><span>${esc(customer.email)}</span><form method="post" action="/account/logout"><button class="a-link">Log out</button></form></div></aside>
  <main class="a-main">${main}</main></body></html>`;
}

function loginView(error, email = '') {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Admin login · Nightjar & Co.</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap"><link rel="stylesheet" href="/assets/admin.css"></head>
  <body class="a-login"><form method="post" action="/admin/login" class="a-login__card"><p class="a-logo">${icon('moon', 18)} Nightjar <span>admin</span></p><h1>Log in to the store admin</h1>
  ${error ? `<p class="a-alert">${esc(error)}</p>` : ''}<label>Email<input type="email" name="email" value="${esc(email || '')}" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label>
  <button class="a-btn a-btn--full">Log in</button><a class="a-muted" href="/">← Back to the shop</a></form></body></html>`;
}

const stat = (label, value, sub) => `<div class="a-stat"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;

function ordersTable(rows, full = false) {
  if (!rows.length) return '<p class="a-muted">No orders yet. Place one through the shop to see it here.</p>';
  return `<table class="a-table"><thead><tr><th>Order</th><th>Date</th>${full ? '<th>Customer</th>' : ''}<th>Email</th><th>Payment</th><th>Fulfilment</th><th>Total</th></tr></thead><tbody>
  ${rows.map((o) => `<tr><td><a href="/admin/orders/${o.number}">#${o.number}</a></td><td>${fmtDate(o.created_at)}</td>${full ? `<td>${esc(`${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`)}</td>` : ''}<td>${esc(o.email)}</td><td>${pill(o.status, STATUS[o.status])}</td><td>${o.status === 'paid' ? pill(o.fulfillment_status ? 'paid' : 'pending', o.fulfillment_status ? 'Shipped' : 'Unfulfilled') : '—'}</td><td>${money(o.total_price)}</td></tr>`).join('')}</tbody></table>`;
}

function orderView(o, events, msg) {
  const a = o.shipping_address;
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  return `<div class="a-head"><h1><a class="a-back" href="/admin/orders">←</a> Order #${o.number} ${pill(o.status, STATUS[o.status])} ${o.status === 'paid' ? pill(o.fulfillment_status ? 'paid' : 'pending', o.fulfillment_status ? 'Shipped' : 'Unfulfilled') : ''}</h1><span class="a-muted">${fmtDate(o.created_at)} · <a href="/orders/${o.token}" target="_blank">Customer view ↗</a></span></div>
  ${msg ? `<p class="a-note">${esc(msg)}</p>` : ''}
  <div class="a-grid">
    <section class="a-card a-span2"><h2>Items</h2><table class="a-table"><tbody>${o.line_items.map((l) => `<tr><td><img class="a-thumb" src="${esc(l.image || '')}" alt=""></td><td><a href="/admin/products/${l.product_id}">${esc(l.title)}</a><small>${esc(l.variant_title || '')} · ${esc(l.sku || '')}</small>${Object.entries(l.properties || {}).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `<small>${esc(k)}: ${esc(v)}</small>`).join('')}${l.properties?._box_items ? '<small>Gift box</small>' : ''}</td><td>${money(l.price)} × ${l.quantity}</td><td>${money(l.price * l.quantity)}</td></tr>`).join('')}</tbody></table>
      <dl class="a-dl a-dl--totals"><div><dt>Subtotal</dt><dd>${money(o.subtotal_price)}</dd></div>${o.total_discounts ? `<div><dt>Discount ${esc(o.discount_codes.map((d) => d.code).join(', '))}</dt><dd>−${money(o.total_discounts)}</dd></div>` : ''}<div><dt>${esc(o.shipping_lines[0]?.title || 'Shipping')}</dt><dd>${money(o.shipping_lines[0]?.price || 0)}</dd></div><div><dt>VAT included</dt><dd>${money(o.total_tax)}</dd></div><div class="a-total"><dt>Total</dt><dd>${money(o.total_price)}</dd></div>${refunded ? `<div class="a-red"><dt>Refunded</dt><dd>−${money(refunded)}</dd></div>` : ''}</dl></section>
    <section class="a-card"><h2>Customer</h2><p>${esc(o.customer.first_name)} ${esc(o.customer.last_name)}<br><a href="mailto:${esc(o.email)}">${esc(o.email)}</a>${o.customer.accepts_marketing ? '<br><small>Accepts marketing</small>' : ''}</p>
      <h3>Shipping address</h3><p>${esc(a.address1)}${a.address2 ? `<br>${esc(a.address2)}` : ''}<br>${esc(a.city)} ${esc(a.zip)}<br>${esc(a.country_code)}${a.phone ? `<br>${esc(a.phone)}` : ''}</p>
      <h3>Payment</h3><p>${esc(o.gateway)}${o.stripe_payment_intent ? `<br><small><code>${esc(o.stripe_payment_intent)}</code></small>` : ''}${o.paid_at ? `<br><small>Paid ${fmtDate(o.paid_at)}</small>` : ''}</p></section>
    ${o.status === 'paid' && !o.fulfillment_status ? `<section class="a-card"><h2>Ship this order</h2><form method="post" action="/admin/orders/${o.number}/fulfil" class="a-form"><label>Carrier<select name="carrier"><option>Royal Mail</option><option>Royal Mail Special Delivery</option><option>DPD</option><option>FedEx</option></select></label><label>Tracking number<input name="tracking_number" placeholder="e.g. RM123456789GB"></label><label class="a-check"><input type="checkbox" name="notify" checked> Email the customer</label><button class="a-btn">Mark as shipped</button></form></section>` : ''}
    ${o.fulfillments.length ? `<section class="a-card"><h2>Fulfilment</h2>${o.fulfillments.map((f) => `<p>${esc(f.carrier)} · <strong>${esc(f.tracking_number || 'no tracking')}</strong><br><small>${fmtDate(f.created_at)}</small></p>`).join('')}</section>` : ''}
    ${o.status === 'paid' ? `<section class="a-card"><h2>Refund</h2><form method="post" action="/admin/orders/${o.number}/refund" class="a-form" data-confirm="Refund this order through Stripe?"><label>Amount (£)<input name="amount" value="${(o.total_price / 100).toFixed(2)}" inputmode="decimal"></label><label class="a-check"><input type="checkbox" name="restock" checked> Put items back in stock</label><button class="a-btn a-btn--danger">Refund ${o.stripe_payment_intent ? 'via Stripe' : ''}</button></form></section>` : ''}
    ${o.status === 'pending' ? `<section class="a-card"><h2>Awaiting payment</h2><p class="a-muted">The shopper is on the Stripe payment page, or left it. Unpaid orders release their stock automatically after 35 minutes.</p><form method="post" action="/admin/orders/${o.number}/cancel" data-confirm="Cancel this unpaid order?"><button class="a-btn a-btn--ghost">Cancel and release stock</button></form></section>` : ''}
    <section class="a-card"><h2>Notes</h2><form method="post" action="/admin/orders/${o.number}/note" class="a-form"><textarea name="note" rows="3" placeholder="Internal note">${esc(o.note)}</textarea><button class="a-btn a-btn--ghost">Save note</button></form></section>
    <section class="a-card a-span2"><h2>Timeline</h2><ol class="a-timeline">${events.map((e) => `<li><code>${esc(e.topic)}</code> <span class="a-muted">${fmtDate(e.created_at)}</span>${e.payload.reason ? ` · ${esc(e.payload.reason)}` : ''}${e.payload.carrier ? ` · ${esc(e.payload.carrier)} ${esc(e.payload.tracking_number || '')}` : ''}${e.payload.amount ? ` · ${money(e.payload.amount)}` : ''}</li>`).join('') || '<li>No events.</li>'}</ol></section>
  </div>`;
}

function productView(p, variants, msg) {
  return `<div class="a-head"><h1><a class="a-back" href="/admin/products">←</a> ${esc(p.title)}</h1><a class="a-btn a-btn--ghost" href="/products/${esc(p.handle)}" target="_blank">View in shop ↗</a></div>
  ${msg ? `<p class="a-note">${esc(msg)}</p>` : ''}
  <form method="post" class="a-grid">
    <section class="a-card a-span2 a-form"><label>Title<input name="title" value="${esc(p.title)}" required></label>
      <label>Description (HTML)<textarea name="body_html" rows="5">${esc(p.body_html)}</textarea></label>
      <label>Images (one URL per line; https:// or /img/…)<textarea name="images" rows="4">${esc(p.images.map((i) => i.src).join('\n'))}</textarea></label>
      <div class="a-images">${p.images.map((i) => `<img src="${esc(i.src)}" alt="">`).join('')}</div></section>
    <section class="a-card a-form"><h2>Status</h2><select name="status">${['active', 'draft', 'archived'].map((s) => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <p class="a-muted">Draft and archived products are hidden from the shop.</p>
      <h2>Organisation</h2><dl class="a-dl"><div><dt>Type</dt><dd>${esc(p.product_type)}</dd></div><div><dt>Handle</dt><dd><code>${esc(p.handle)}</code></dd></div><div><dt>Print</dt><dd>${esc(p.metafields.custom?.print || '—')}</dd></div><div><dt>Fabric</dt><dd>${esc(p.metafields.custom?.fabric || '—')}</dd></div><div><dt>Gift box points</dt><dd>${p.metafields.custom?.points ?? '—'}</dd></div></dl>
      <label>Tags (comma separated)<input name="tags" value="${esc(p.tags.join(', '))}"></label>
      <p class="a-muted">Tags drive collections: <code>new</code>, <code>best seller</code>, <code>Back in Stock</code>.</p></section>
    <section class="a-card a-span3"><h2>Variants, prices & stock</h2><table class="a-table a-variants"><thead><tr><th>Variant</th><th>SKU</th><th>Price £</th><th>Compare at £</th><th>Stock</th></tr></thead><tbody>
      ${variants.map((v) => `<tr><td>${esc(v.title)}</td><td><input name="sku_${v.id}" value="${esc(v.sku || '')}"></td><td><input name="price_${v.id}" value="${(v.price / 100).toFixed(2)}" inputmode="decimal"></td><td><input name="compare_${v.id}" value="${v.compare_at_price ? (v.compare_at_price / 100).toFixed(2) : ''}" inputmode="decimal" placeholder="—"></td><td>${v.inventory_management ? `<input name="stock_${v.id}" value="${v.inventory_quantity}" inputmode="numeric" class="${v.inventory_quantity <= 0 ? 'a-red' : ''}">` : '<span class="a-muted">Not tracked</span>'}</td></tr>`).join('')}
      </tbody></table><p class="a-muted">Set “Compare at” higher than the price to show a sale badge. Leave it empty to end a sale.</p></section>
    <div class="a-savebar"><button class="a-btn">Save product</button></div>
  </form>`;
}

function newProductView() {
  return `<div class="a-head"><h1><a class="a-back" href="/admin/products">←</a> Add product</h1></div>
  <form method="post" class="a-card a-narrow a-form">
    <label>Print<select name="print">${PRINTS.map((x) => `<option>${esc(x.name)}</option>`).join('')}</select></label>
    <label>Style<select name="type">${TYPES.map((t) => `<option value="${esc(t.type)}">${esc(t.noun)} · ${esc(t.fabric)} · ${money(t.price)}</option>`).join('')}</select></label>
    <label>Title (optional)<input name="title" placeholder="Leave empty to use “Print + style”"></label>
    <label>Price £ (optional)<input name="price" inputmode="decimal" placeholder="Uses the style’s price"></label>
    <label>Starting stock per size<input name="stock" value="10" inputmode="numeric"></label>
    <label>Description<textarea name="description" rows="3"></textarea></label>
    <label>Status<select name="status"><option value="draft">Draft (hidden)</option><option value="active">Active (in the shop)</option></select></label>
    <p class="a-muted">Sizes come from the style. Product images are drawn in code from the print, so a new product is ready to sell straight away.</p>
    <button class="a-btn">Create product</button></form>`;
}

function discountsView(rows, err, body) {
  return `<div class="a-head"><h1>Discounts</h1></div>
  <div class="a-grid"><section class="a-card a-span2"><table class="a-table"><thead><tr><th>Code</th><th>Value</th><th>Minimum</th><th>Used</th><th>Ends</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((d) => { const st = C.discountState(d); return `<tr><td><strong>${esc(d.code)}</strong><small>${esc(d.description)}</small></td><td>${d.type === 'percentage' ? `${d.value}%` : money(d.value)}</td><td>${d.minimum ? money(d.minimum) : '—'}</td><td>${d.used}${d.usage_limit ? ` / ${d.usage_limit}` : ''}</td><td>${d.ends_at ? new Date(d.ends_at).toLocaleDateString('en-GB') : '—'}</td><td>${pill(st === 'ok' ? 'paid' : 'cancelled', st === 'ok' ? 'Active' : st === 'invalid' ? 'Off' : st.replace('_', ' '))}</td>
    <td class="a-row-actions"><form method="post" action="/admin/discounts/${esc(d.code)}/toggle"><button class="a-link">${d.active ? 'Turn off' : 'Turn on'}</button></form><form method="post" action="/admin/discounts/${esc(d.code)}/delete" data-confirm="Delete ${esc(d.code)}?"><button class="a-link a-red">Delete</button></form></td></tr>`; }).join('')}
  </tbody></table></section>
  <section class="a-card"><h2>Create a code</h2>${err ? `<p class="a-alert">${esc(err)}</p>` : ''}<form method="post" class="a-form">
    <label>Code<input name="code" value="${esc(body.code || '')}" placeholder="AUTUMN20" required></label>
    <label>Type<select name="type"><option value="percentage">Percentage off</option><option value="fixed_amount">Amount off (£)</option></select></label>
    <label>Value<input name="value" value="${esc(body.value || '')}" placeholder="20" required></label>
    <label>Minimum spend £ (optional)<input name="minimum" value="${esc(body.minimum || '')}"></label>
    <label>Usage limit (optional)<input name="usage_limit" inputmode="numeric" value="${esc(body.usage_limit || '')}"></label>
    <label>Ends on (optional)<input type="date" name="ends_at"></label>
    <label>Description<input name="description" value="${esc(body.description || '')}"></label>
    <button class="a-btn">Create code</button></form></section></div>`;
}
