// ---------------------------------------------------------------------------
// Theme entry. A tiny component loader (same idea as the "radiant" bundle in
// design.md §6): every element with data-component="name" gets the class in
// components/name.js mounted on it — lazily, only when the page uses it.
// When a section is re-rendered, its new components are mounted again.
// ---------------------------------------------------------------------------
import { initAnimations, markLoadedImages } from './core/motion.js';
import { on, emit } from './core/events.js';
import { subscribe, wishlist } from './core/api.js';
import { qsa, wait } from './core/utils.js';

const mounted = new WeakMap();
export async function mount(root = document) {
  markLoadedImages(root);
  initAnimations(root);
  const els = qsa('[data-component]', root).filter((el) => !mounted.has(el));
  if (root !== document && root.matches?.('[data-component]') && !mounted.has(root)) els.unshift(root);
  await Promise.all(els.map(async (el) => {
    mounted.set(el, true);
    const name = el.dataset.component;
    try { const mod = await import(`./components/${name}.js`); mounted.set(el, new mod.default(el)); }
    catch (err) { console.warn(`[theme] component "${name}" failed`, err); }
  }));
}
window.theme = Object.assign(window.theme || {}, { mount, emit });

/* Section Rendering API results: swap sections in place, keep open drawers open */
on('sections:render', (sections) => {
  for (const [id, html] of Object.entries(sections || {})) {
    if (html == null) continue;
    const current = document.getElementById(`shopify-section-${id}`);
    if (id === 'cart-icon') { // only the count bubble lives in the header
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const fresh = tmp.querySelector('[data-cart-count]');
      document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = fresh.textContent; el.hidden = fresh.hidden; });
      continue;
    }
    if (!current) continue;
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const next = tmp.firstElementChild;
    emit('section:before-replace', { id, current, next });
    current.replaceWith(next);
    mount(next);
    emit('section:replaced', { id, el: next });
  }
});

/* Global triggers */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open-cart], [data-open-search], [data-open-gift-box]');
  if (!t) return;
  e.preventDefault();
  if (t.matches('[data-open-cart]')) emit('cart:open');
  if (t.matches('[data-open-search]')) emit('search:open');
  if (t.matches('[data-open-gift-box]')) import('./components/gift-box.js').then((m) => m.openGiftBox());
});

/* Newsletter forms (popup + footer) */
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-newsletter]');
  if (!form) return;
  e.preventDefault();
  const msg = form.querySelector('.popup__msg');
  const btn = form.querySelector('button[type=submit]');
  btn.classList.add('is-loading');
  try {
    const r = await subscribe(form.email.value, form.dataset.source || 'popup');
    msg.className = 'popup__msg is-ok'; msg.textContent = `Thanks! Use code ${r.code} for 10% off.`;
    try { localStorage.setItem('popup-dismissed', '1'); } catch {}
    form.reset();
  } catch (err) { msg.className = 'popup__msg is-error'; msg.textContent = err.message; }
  btn.classList.remove('is-loading');
});

/* Page transition: white fade between internal pages (design.md §4.4) */
if (window.theme.page_transitions && document.documentElement.classList.contains('do-anim')) {
  const overlay = document.getElementById('page-transition-overlay');
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.hash && url.pathname === location.pathname || /^\/(cart|checkout)\b/.test(url.pathname) && a.closest('[data-open-cart]')) return;
    e.preventDefault();
    overlay.classList.add('is-active');
    await wait(200);
    location.href = url.href;
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) overlay.classList.remove('is-active'); });
}

/* Header wishlist count */
const setWishCount = (n) => document.querySelectorAll('[data-wishlist-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
on('wishlist:updated', ({ count }) => setWishCount(count));
if (document.querySelector('[data-wishlist-count]')) wishlist.ids().then((s) => setWishCount(s.size));

mount();
