// Search overlay with predictive search (/search/suggest.json).
// Opening sets .is-active, then .is-visible 50ms later so the CSS transition runs.
import { on } from '../core/events.js';
import { predictive } from '../core/api.js';
import { debounce, lockScroll, trapFocus, wait } from '../core/utils.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default class Search {
  constructor(el) {
    this.el = el;
    this.input = el.querySelector('[data-search-input]');
    this.results = el.querySelector('[data-search-results]');
    this.hint = this.results.innerHTML;
    on('search:open', () => this.open());
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    this.input.addEventListener('input', debounce(() => this.query(), 220));
  }
  async open() {
    this.el.classList.add('is-active'); this.el.setAttribute('aria-hidden', 'false'); lockScroll(true);
    await wait(50); this.el.classList.add('is-visible');
    this.release = trapFocus(this.el.querySelector('.search-overlay__panel'), this.input);
  }
  async close() {
    this.el.classList.remove('is-visible'); this.release?.(); lockScroll(false);
    await wait(500); this.el.classList.remove('is-active'); this.el.setAttribute('aria-hidden', 'true');
  }
  async query() {
    const q = this.input.value.trim();
    if (q.length < 2) { this.results.innerHTML = this.hint; return; }
    const { resources: { results: r } } = await predictive(q);
    const list = (title, items) => items.length ? `<div><p class="predictive__heading">${title}</p><ul class="predictive__list">${items.map((i) => `<li><a class="link-hover" href="${i.url}">${esc(i.text || i.title)}</a></li>`).join('')}</ul></div>` : '';
    this.results.innerHTML = r.products.length || r.collections.length ? `<div class="predictive">
      <div>${list('Suggestions', r.queries)}${list('Collections', r.collections)}${list('Pages', r.pages)}</div>
      <div><p class="predictive__heading">Products</p><div class="predictive__products">${r.products.map((p, i) => `<a class="predictive__product" style="--i:${i}" href="${p.url}"><div class="image loaded" style="--aspect:1.3333"><img class="image__img" src="${p.image}" alt=""></div><span>${esc(p.title)}</span><strong>£${p.price}</strong></a>`).join('')}</div>
      <p style="margin-top:16px"><a class="link" href="/search?q=${encodeURIComponent(q)}">See all results for “${esc(q)}”</a></p></div>
    </div>` : `<p>No results for “${esc(q)}”.</p>`;
  }
}
