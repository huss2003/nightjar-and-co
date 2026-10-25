// ---------------------------------------------------------------------------
// Nightjar & Co. storefront — one request handler for every route.
// Runs as a Vercel Function in production (api/index.js) and as a plain Node
// HTTP server locally (server/dev.js). Routes and JSON shapes follow Shopify's
// storefront conventions, so the theme JS in theme/assets is platform-agnostic.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { ensureSchema, q as dbq } from './db.js';
import { seed } from './seed.js';
import { SHOP, PRODUCTS, COLLECTIONS, byHandle, byId, collectionByHandle, productsIn, PAGES, refreshCatalog } from './catalog.js';
import * as C from './commerce.js';
import * as A from './auth.js';
import * as S from './stripe.js';
import * as E from './email.js';
import { suggest, recommend } from './query.js';
import { productReviews, submitReview } from './reviews.js';
import { productSVG, giftboxSVG, lifestyleSVG, flatlaySVG } from './images.js';
import { renderTemplate, renderSections, renderMain, loadSettings } from './render.js';
import { minimalLayout } from '../theme/layout/theme.js';
import { checkout, orderStatus } from '../theme/sections/checkout.js';
import * as Acc from '../theme/sections/account.js';
import { handleAdmin } from './admin.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };
const IS_PROD = !!process.env.VERCEL;

/* ---------------- boot (once per server instance) ---------------- */
let booted = null;
async function boot() {
  if (await ensureSchema()) { const n = await seed(); console.log(`seeded ${n} products`); }
  await A.ensureAdmin();
}

/* ---------------- helpers ---------------- */
function parseQuery(sp) { const out = {}; for (const [k, v] of sp) out[k] = k in out ? [].concat(out[k], v) : v; return out; }
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
async function readRaw(req, limit = 1e6) {
  const chunks = []; let n = 0;
  for await (const ch of req) { n += ch.length; if (n > limit) throw Object.assign(new Error('Body too large'), { status: 413 }); chunks.push(ch); }
  return Buffer.concat(chunks).toString('utf8');
}
function parseBody(req, raw) {
  if (!raw) return {};
  if ((req.headers['content-type'] || '').includes('application/json')) { try { return JSON.parse(raw); } catch { return {}; } }
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) {
    const parts = k.split(/[[\]]+/).filter(Boolean);
    if (parts.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) continue;
    let o = out;
    parts.forEach((p, i) => { if (i === parts.length - 1) o[p] = v; else o = o[p] ??= /^\d+$/.test(parts[i + 1]) ? [] : {}; });
  }
  return out;
}
const SECURITY = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin', 'content-security-policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'", 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };

export async function handler(req, res) {
  const t0 = performance.now();
  const headers = { ...SECURITY };
  const setCookies = [];
  const send = (status, body, type = 'text/html; charset=utf-8', extra = {}) => {
    if (setCookies.length) headers['set-cookie'] = setCookies;
    res.writeHead(status, { 'content-type': type, 'cache-control': 'private, no-store', ...headers, 'server-timing': `app;dur=${(performance.now() - t0).toFixed(1)}`, ...extra });
    res.end(body);
  };
  const sendJSON = (status, obj, extra) => send(status, JSON.stringify(obj), 'application/json; charset=utf-8', extra);
  const redirect = (to, status = 303) => { if (setCookies.length) headers['set-cookie'] = setCookies; res.writeHead(status, { location: to, ...headers }); res.end(); };

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] || (IS_PROD ? 'https' : 'http')).split(',')[0];
  const origin = `${proto}://${host}`;
  const secure = proto === 'https';
  const url = new URL(req.url, origin);
  let p = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  const q = parseQuery(url.searchParams);
  const method = req.method || 'GET';

  /* static assets (local dev; on Vercel they are served from public/ by the CDN) */
  if (p.startsWith('/assets/')) {
    const f = path.join(ROOT, 'theme', path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(path.join(ROOT, 'theme', 'assets')) || !fs.existsSync(f)) return send(404, 'Not found', 'text/plain');
    return send(200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream', { 'cache-control': 'no-cache' });
  }

  try {
    booted ??= boot().catch((e) => { booted = null; throw e; });
    await booted;
    await refreshCatalog();

    let m;
    const IMG_CACHE = { 'cache-control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400' };
    if ((m = p.match(/^\/img\/product\/(\d+)\/(\d)\.svg$/))) { const s = productSVG(m[1], Number(m[2])); return s ? send(200, s, MIME['.svg'], IMG_CACHE) : send(404, '', 'text/plain'); }
    if ((m = p.match(/^\/img\/giftbox\/(\d)\.svg$/))) return send(200, giftboxSVG(Number(m[1])), MIME['.svg'], IMG_CACHE);
    if ((m = p.match(/^\/img\/lifestyle\/([\w-]+)\.svg$/))) return send(200, lifestyleSVG(m[1]), MIME['.svg'], IMG_CACHE);
    if ((m = p.match(/^\/img\/flatlay\/([\w-]+)\.svg$/))) return send(200, flatlaySVG(m[1]), MIME['.svg'], { 'cache-control': 'public, max-age=3600, s-maxage=86400' });

    /* CSRF: state-changing requests must come from this site (Stripe webhooks are signed instead) */
    if (method !== 'GET' && method !== 'HEAD' && p !== '/webhooks/stripe') {
      const src = req.headers.origin || req.headers.referer;
      if (src) { try { if (new URL(src).host !== host) return sendJSON(403, { status: 403, message: 'Forbidden', description: 'Cross-site request blocked' }); } catch { return sendJSON(403, { status: 403, message: 'Forbidden' }); } }
    }

    /* Stripe webhook (raw body + signature) */
    if (p === '/webhooks/stripe' && method === 'POST') return stripeWebhook(req, send, sendJSON, origin);

    const jar = cookies(req);
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const [cart, customer] = await Promise.all([C.getCart(jar.cart), A.sessionCustomer(jar.sid)]);
    if (jar.cart !== cart.token) setCookies.push(`cart=${cart.token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
    if (jar.sid && !customer) setCookies.push(A.clearSessionCookie(secure));
    const owner = A.ownerKey(customer, cart.token);
    const settings = loadSettings();
    const ctx = { settings, cart: C.serializeCart(cart), query: q, path: p, template: 'index', customer, origin, wishlist: new Set() };
    const raw = method === 'POST' ? await readRaw(req) : '';
    const body = method === 'POST' ? parseBody(req, raw) : {};
    const isJSON = p.endsWith('.js') || p.endsWith('.json') || (req.headers.accept || '').includes('application/json') || (req.headers['content-type'] || '').includes('application/json');

    const page = async (template, extra, meta) => {
      Object.assign(ctx, { template }, extra);
      ctx.wishlist = await A.wishlistIds(owner);
      if (q.sections) return sendJSON(200, renderSections(ctx, String(q.sections).split(',').slice(0, 10)));
      if (q.section_id) return send(200, renderSections(ctx, [q.section_id])[q.section_id] ?? '');
      const { html, ms } = renderTemplate(ctx, { ...meta, url: origin + p });
      return send(template === '404' ? 404 : 200, html, undefined, { 'x-template': template, 'server-timing': `render;dur=${ms.toFixed(1)}` });
    };
    const pageMain = async (template, main, meta) => {
      ctx.template = template; ctx.wishlist = await A.wishlistIds(owner);
      return send(200, renderMain(ctx, main, { ...meta, url: origin + p }), undefined, { 'x-robots-tag': 'noindex' });
    };

    /* ---------- admin ---------- */
    if (p === '/admin' || p.startsWith('/admin/')) return handleAdmin({ req, p, q, body, method, ctx, customer, send, sendJSON, redirect, origin, setCookies, secure, ip });

    /* ---------- AJAX Cart API ---------- */
    if (p === '/cart.js' || p === '/cart.json') return sendJSON(200, ctx.cart);
    if (method === 'POST' && /^\/cart\/(add|change|update|clear)(\.js|\.json)?$/.test(p)) {
      const action = p.match(/^\/cart\/(\w+)/)[1];
      let result;
      if (action === 'add') result = C.addItems(cart, body);
      if (action === 'change') C.changeItem(cart, body);
      if (action === 'update') C.updateCart(cart, body);
      if (action === 'clear') C.clearCart(cart);
      await C.saveCart(cart);
      const cj = C.serializeCart(cart);
      if (!isJSON) return redirect(action === 'add' ? '/cart' : (req.headers.referer || '/cart'));
      let payload = action === 'add' ? (Array.isArray(body.items) ? { items: result } : result[0]) : cj;
      if (body.sections) { ctx.cart = cj; ctx.wishlist = await A.wishlistIds(owner); payload = { ...payload, sections: renderSections(ctx, [].concat(body.sections).join(',').split(',').slice(0, 10)) }; }
      return sendJSON(200, payload);
    }
    if (method === 'POST' && p === '/cart') { if (body.updates || body.note !== undefined) { C.updateCart(cart, body); await C.saveCart(cart); } return redirect('/checkout'); }
    if ((m = p.match(/^\/discount\/(.+)$/))) {
      const r = C.applyDiscount(cart, m[1]);
      await C.saveCart(cart);
      if (q.json || isJSON) return sendJSON(200, { ...r, cart: C.serializeCart(cart) });
      return redirect(String(q.redirect || '/').startsWith('/') && !String(q.redirect).startsWith('//') ? q.redirect || '/' : '/');
    }

    /* ---------- catalog JSON ---------- */
    if (p === '/meta.json') return sendJSON(200, { name: SHOP.name, description: SHOP.description, currency: SHOP.currency, published_products_count: PRODUCTS.length, published_collections_count: COLLECTIONS.length });
    if (p === '/products.json') { const limit = Math.min(250, Number(q.limit || 30)), pg = Math.max(1, Number(q.page || 1)); return sendJSON(200, { products: PRODUCTS.slice((pg - 1) * limit, pg * limit).map(productJSON) }); }
    if (p === '/collections.json') return sendJSON(200, { collections: COLLECTIONS.map(({ rule, ...c }) => ({ ...c, products_count: productsIn(c.handle).length })) });
    if ((m = p.match(/^\/collections\/([\w-]+)\/products\.json$/))) return sendJSON(200, { products: productsIn(m[1]).map(productJSON) });
    if ((m = p.match(/^\/products\/([\w-]+)\.(js|json)$/))) { const pr = byHandle.get(m[1]); if (!pr) return sendJSON(404, { status: 404, message: 'Not Found' }); return sendJSON(200, m[2] === 'js' ? productJS(pr) : { product: productJSON(pr) }); }
    if (p === '/search/suggest.json' || p === '/search/suggest') return sendJSON(200, suggest(String(q.q || '').slice(0, 80)));
    if (p === '/recommendations/products.json' || p === '/recommendations/products') {
      const recs = recommend(q.product_id, Math.min(12, Number(q.limit || 4)));
      if (q.section_id) { ctx.recommendations = recs; ctx.product = byId.get(Number(q.product_id)); ctx.wishlist = await A.wishlistIds(owner); return send(200, renderSections(ctx, [q.section_id])[q.section_id] || ''); }
      return sendJSON(200, { products: recs.map(productJS) });
    }

    /* ---------- newsletter, wishlist, reviews ---------- */
    if (method === 'POST' && p === '/contact') {
      try {
        const r = await C.subscribe(body.email || body['contact[email]'], body.source || 'popup');
        if (r.isNew) await E.welcomeEmail(r.email, origin);
        return sendJSON(200, { ok: true, code: r.code });
      } catch (e) { return sendJSON(e.status || 400, e.body || { message: e.message }); }
    }
    if (p === '/wishlist.json') return sendJSON(200, { ids: [...(await A.wishlistIds(owner))] });
    if (method === 'POST' && p === '/wishlist') {
      const pr = byId.get(Number(body.product_id));
      if (!pr) return sendJSON(404, { message: 'Not found' });
      const wished = await A.toggleWishlist(owner, pr.id);
      const n = (await A.wishlistIds(owner)).size;
      return sendJSON(200, { wished, count: n });
    }
    if ((m = p.match(/^\/products\/([\w-]+)\/reviews$/)) && method === 'POST') {
      const pr = byHandle.get(m[1]);
      if (!pr) return send(404, 'Not found', 'text/plain');
      try { await submitReview(pr, body, customer); return redirect(`/products/${pr.handle}?review=thanks#reviews`); }
      catch (e) { return redirect(`/products/${pr.handle}?review_error=${encodeURIComponent(e.message)}#reviews`); }
    }

    /* ---------- checkout → Stripe ---------- */
    if (p === '/checkout') {
      ctx.template = 'checkout';
      if (q.cancelled) { const o = await C.orderByToken(q.cancelled); if (o && o.cart_token === cart.token) await C.releaseOrder(o.token, 'shopper returned from Stripe'); ctx.cart = C.serializeCart(cart); }
      if (!ctx.cart.item_count) return redirect('/cart');
      const prefill = customer ? { email: customer.email, first_name: customer.first_name, last_name: customer.last_name, ...(customer.default_address || {}), country: customer.default_address?.country_code } : {};
      if (method === 'POST') {
        try {
          C.sweepExpired().catch(() => {});
          const order = await C.createPendingOrder(cart, body, customer);
          if (customer && body.save_address === 'on') await saveAddress(customer.id, order.shipping_address);
          if (!S.stripeEnabled()) { // local development without Stripe keys
            const paid = await C.markPaid(order.token, { gateway: 'manual (no Stripe key)' });
            if (paid) await E.orderConfirmation(paid, origin);
            return redirect(`/orders/${order.token}`);
          }
          let session;
          try { session = await S.createCheckoutSession(order, origin); }
          catch (e) { await C.releaseOrder(order.token, `stripe error: ${e.message}`); throw new C.CartError(502, 'Payment Error', `We couldn’t start the payment: ${e.message}`); }
          await dbq('update orders set stripe_session_id = $2 where id = $1', [order.id, session.id]);
          return redirect(session.url);
        } catch (e) {
          if (!(e instanceof C.CartError)) throw e;
          ctx.cart = C.serializeCart(cart);
          return send(422, minimalLayout({ ctx, title: 'Checkout', main: checkout(ctx, e.message, body) }));
        }
      }
      return send(200, minimalLayout({ ctx, title: 'Checkout', main: checkout(ctx, q.cancelled ? 'Payment cancelled. Your bag is just as you left it.' : '', { ...prefill, country: q.country || prefill.country }, { stripe: S.stripeEnabled(), test: S.stripeTestMode() }) }));
    }
    if ((m = p.match(/^\/orders\/([a-f0-9]{32})$/))) {
      let order = await C.orderByToken(m[1]);
      if (!order) return page('404', {}, { title: 'Not found' });
      if (order.status === 'pending' && q.session_id && S.stripeEnabled()) {
        try {
          const s = await S.retrieveSession(String(q.session_id));
          if (s.client_reference_id === order.token && s.payment_status === 'paid') {
            const paid = await C.markPaid(order.token, { payment_intent: s.payment_intent, session_id: s.id });
            if (paid) await E.orderConfirmation(paid, origin);
            order = await C.orderByToken(order.token);
          }
        } catch (e) { console.error('session check failed', e.message); }
      }
      ctx.template = 'order';
      return send(200, minimalLayout({ ctx, title: `Order #${order.number}`, main: orderStatus(ctx, order), refresh: order.status === 'pending' ? 4 : 0 }), undefined, { 'x-robots-tag': 'noindex' });
    }

    /* ---------- customer accounts ---------- */
    if (p.startsWith('/account')) {
      const back = (to) => redirect(to);
      if (p === '/account/login') {
        if (customer) return back('/account');
        if (method === 'POST') {
          try {
            const c = await A.login(body.email, body.password, ip);
            setCookies.push(A.sessionCookie(await A.createSession(c.id), secure));
            await A.mergeWishlist(cart.token, c.id);
            const next = String(body.next || '');
            return back(next.startsWith('/') && !next.startsWith('//') ? next : c.is_admin && next === '' ? '/account' : '/account');
          } catch (e) { if (!(e instanceof A.AuthError)) throw e; return pageMain('account', Acc.loginPage(ctx, e.message, body), { title: 'Log in' }); }
        }
        return pageMain('account', Acc.loginPage(ctx, '', { next: q.next }), { title: 'Log in' });
      }
      if (p === '/account/register') {
        if (customer) return back('/account');
        if (method === 'POST') {
          try {
            const c = await A.register({ ...body, accepts_marketing: body.accepts_marketing === 'on' });
            setCookies.push(A.sessionCookie(await A.createSession(c.id), secure));
            await A.mergeWishlist(cart.token, c.id);
            await E.accountWelcome(c, origin);
            await C.logEvent('customers/create', c.id, { email: c.email });
            return back('/account?welcome=1');
          } catch (e) { if (!(e instanceof A.AuthError)) throw e; return pageMain('account', Acc.registerPage(ctx, e.message, body), { title: 'Create account' }); }
        }
        return pageMain('account', Acc.registerPage(ctx, '', {}), { title: 'Create account' });
      }
      if (p === '/account/logout' && method === 'POST') { await A.destroySession(jar.sid); setCookies.push(A.clearSessionCookie(secure)); return back('/'); }
      if (p === '/account/forgot') {
        if (method === 'POST') {
          const r = await A.createReset(body.email);
          if (r) await E.passwordResetEmail(r.email, `${origin}/account/reset?token=${r.token}`, origin);
          return pageMain('account', Acc.forgotPage(ctx, true), { title: 'Reset password' });
        }
        return pageMain('account', Acc.forgotPage(ctx, false), { title: 'Reset password' });
      }
      if (p === '/account/reset') {
        if (method === 'POST') {
          try { const id = await A.useReset(body.token, body.password); setCookies.push(A.sessionCookie(await A.createSession(id), secure)); return back('/account?reset=1'); }
          catch (e) { if (!(e instanceof A.AuthError)) throw e; return pageMain('account', Acc.resetPage(ctx, body.token, e.message), { title: 'Reset password' }); }
        }
        return pageMain('account', Acc.resetPage(ctx, q.token, ''), { title: 'Reset password' });
      }
      if (!customer) return back(`/account/login?next=${encodeURIComponent(p)}`);
      if (p === '/account/address' && method === 'POST') { await saveAddress(customer.id, body); return back('/account?saved=1'); }
      if (p === '/account') {
        const orders = await dbq("select number, token, status, fulfillment_status, total_price, created_at, line_items from orders where (customer_id = $1 or email = $2) and status <> 'pending' order by created_at desc limit 50", [customer.id, customer.email]);
        ctx.wishlist = await A.wishlistIds(owner);
        return pageMain('account', Acc.accountPage(ctx, orders, q), { title: 'Your account' });
      }
    }
    if (p === '/pages/wishlist' || p === '/wishlist') {
      ctx.wishlist = await A.wishlistIds(owner);
      return pageMain('wishlist', Acc.wishlistPage(ctx, [...ctx.wishlist].map((id) => byId.get(id)).filter(Boolean)), { title: 'Wishlist' });
    }

    /* ---------- SEO ---------- */
    if (p === '/robots.txt') return send(200, `User-agent: *\nDisallow: /cart\nDisallow: /checkout\nDisallow: /orders\nDisallow: /account\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`, 'text/plain');
    if (p === '/sitemap.xml') {
      const urls = ['/', ...COLLECTIONS.map((c) => `/collections/${c.handle}`), ...PRODUCTS.map((x) => `/products/${x.handle}`), ...Object.keys(PAGES).map((h) => `/pages/${h}`)];
      return send(200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${origin}${u}</loc></url>`).join('')}</urlset>`, 'application/xml');
    }

    /* ---------- HTML templates ---------- */
    if (p === '/') return page('index', {}, { title: 'Pyjamas & sleepwear for slow nights', description: SHOP.description });
    if ((m = p.match(/^\/collections\/([\w-]+)$/))) { const col = collectionByHandle.get(m[1]); return col ? page('collection', { collection: col }, { title: col.title, description: col.description }) : page('404', {}, { title: 'Not found' }); }
    if ((m = p.match(/^\/(?:collections\/[\w-]+\/)?products\/([\w-]+)$/))) {
      const pr = byHandle.get(m[1]);
      if (!pr) return page('404', {}, { title: 'Not found' });
      ctx.reviews = await productReviews(pr.id);
      return page('product', { product: pr }, { title: pr.title, description: pr.body_html.replace(/<[^>]+>/g, '').slice(0, 155), image: pr.images[0]?.src });
    }
    if (p === '/cart') return page('cart', {}, { title: 'Your bag' });
    if (p === '/search') return page('search', {}, { title: q.q ? `Search: ${q.q}` : 'Search' });
    if ((m = p.match(/^\/pages\/([\w-]+)$/)) && PAGES[m[1]]) return page('page', { page: PAGES[m[1]] }, { title: PAGES[m[1]].title });
    return page('404', {}, { title: 'Page not found' });
  } catch (err) {
    if (err instanceof C.CartError) return sendJSON(err.status, err.body);
    if (err.status === 413) return send(413, 'Payload too large', 'text/plain');
    console.error(err);
    return send(500, `<!doctype html><title>Something went wrong</title><body style="font-family:system-ui;padding:40px"><h1>Something went wrong</h1><p>Please try again in a moment.</p>${IS_PROD ? '' : `<pre>${String(err.stack).replace(/</g, '&lt;')}</pre>`}</body>`);
  }
}

async function saveAddress(customerId, b) {
  const clip = (s, n = 120) => String(s ?? '').trim().slice(0, n);
  const a = { first_name: clip(b.first_name, 60), last_name: clip(b.last_name, 60), address1: clip(b.address1), address2: clip(b.address2), city: clip(b.city, 60), zip: clip(b.zip, 20), country_code: clip(b.country_code || b.country, 2), phone: clip(b.phone, 30) };
  await dbq('update customers set default_address = $2::jsonb, first_name = coalesce(nullif($3, \'\'), first_name), last_name = coalesce(nullif($4, \'\'), last_name) where id = $1', [customerId, JSON.stringify(a), a.first_name, a.last_name]);
}

/* ---------------- Stripe webhook ---------------- */
async function stripeWebhook(req, send, sendJSON, origin) {
  const raw = await readRaw(req, 5e5);
  const secret = await S.webhookSecret();
  if (!S.verifySignature(raw, req.headers['stripe-signature'], secret)) return sendJSON(400, { error: 'invalid signature' });
  const evt = JSON.parse(raw);
  const obj = evt.data?.object || {};
  try {
    await refreshCatalog();
    if (evt.type === 'checkout.session.completed' || evt.type === 'checkout.session.async_payment_succeeded') {
      const token = obj.client_reference_id || obj.metadata?.order_token;
      if (token && obj.payment_status === 'paid') { const paid = await C.markPaid(token, { payment_intent: obj.payment_intent, session_id: obj.id }); if (paid) await E.orderConfirmation(paid, origin); }
    } else if (evt.type === 'checkout.session.expired') {
      const token = obj.client_reference_id || obj.metadata?.order_token;
      if (token) await C.releaseOrder(token, 'stripe session expired');
    } else if (evt.type === 'charge.refunded') {
      await C.logEvent('stripe/charge.refunded', obj.payment_intent, { amount_refunded: obj.amount_refunded });
    }
    return sendJSON(200, { received: true });
  } catch (e) { console.error('webhook error', e); return sendJSON(500, { error: 'handler failed' }); }
}

/* ---------------- product JSON shapes ---------------- */
function productJSON(p) {
  const { siblings, sales_count, status, ...rest } = p;
  return { ...rest, variants: p.variants.map(({ metafields: _m, inventory_quantity, inventory_management, inventory_policy, ...v }) => ({ ...v, price: (v.price / 100).toFixed(2), compare_at_price: v.compare_at_price ? (v.compare_at_price / 100).toFixed(2) : null })) };
}
function productJS(p) {
  const prices = p.variants.map((v) => v.price);
  return {
    id: p.id, title: p.title, handle: p.handle, description: p.body_html, published_at: p.published_at, created_at: p.created_at, vendor: p.vendor, type: p.product_type, tags: p.tags,
    price: Math.min(...prices), price_min: Math.min(...prices), price_max: Math.max(...prices), available: p.variants.some((v) => v.available), price_varies: new Set(prices).size > 1,
    compare_at_price: p.variants[0].compare_at_price, options: p.options.map((o) => o.name), images: p.images.map((i) => i.src), featured_image: p.images[0]?.src, url: `/products/${p.handle}`,
    variants: p.variants.map((v) => ({ id: v.id, title: v.title, option1: v.option1, option2: v.option2, option3: v.option3, sku: v.sku, requires_shipping: true, taxable: true, available: v.available, name: `${p.title} - ${v.title}`, public_title: v.title, options: [v.option1, v.option2].filter(Boolean), price: v.price, weight: v.grams, compare_at_price: v.compare_at_price, inventory_management: v.inventory_management, barcode: null })),
  };
}
