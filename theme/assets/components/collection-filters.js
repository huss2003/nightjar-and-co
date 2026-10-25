// Collection filters & sorting without page reloads: the form is serialised
// into Shopify-style filter params, the main section is re-rendered through
// the Section Rendering API, and the URL is updated (back/forward supported).
import { debounce } from '../core/utils.js';

export default class CollectionFilters {
  constructor(el) {
    this.el = el;
    this.section = el.closest('.shopify-section');
    this.form = el.querySelector('[data-filter-form]');
    this.form.addEventListener('change', (e) => { if (!e.target.matches('[data-range-min],[data-range-max]')) this.apply(); });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.apply(); });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-filter-link]');
      if (a) { e.preventDefault(); this.load(a.getAttribute('href')); }
    });
    // close other open dropdowns; click outside closes
    el.querySelectorAll('[data-filter]').forEach((d) => d.addEventListener('toggle', () => { if (d.open) el.querySelectorAll('[data-filter]').forEach((o) => o !== d && (o.open = false)); }));
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-filter]')) el.querySelectorAll('[data-filter][open]').forEach((d) => (d.open = false)); });
    const toggle = el.querySelector('[data-toggle-filters]');
    const collapsed = sessionStorage.getItem('filters-collapsed') === '1';
    const setCollapsed = (c) => { this.form.classList.toggle('is-collapsed', c); toggle.setAttribute('aria-expanded', !c); toggle.querySelector('span').textContent = c ? 'Show filters' : 'Hide filters'; sessionStorage.setItem('filters-collapsed', c ? '1' : '0'); };
    setCollapsed(collapsed);
    toggle.addEventListener('click', () => setCollapsed(!this.form.classList.contains('is-collapsed')));
    this.initRange();
    if (!window.__filtersPop) { window.__filtersPop = true; window.addEventListener('popstate', () => document.querySelector('[data-component="collection-filters"]')?.cf?.load(location.pathname + location.search, false)); }
    el.cf = this;
  }

  initRange() {
    const box = this.el.querySelector('[data-price-range]'); if (!box) return;
    const min = Number(box.dataset.min), max = Number(box.dataset.max);
    const rMin = box.querySelector('[data-range-min]'), rMax = box.querySelector('[data-range-max]');
    const iMin = box.querySelector('[data-input-min]'), iMax = box.querySelector('[data-input-max]');
    const paint = () => { box.style.setProperty('--from', `${((rMin.value - min) / (max - min || 1)) * 100}%`); box.style.setProperty('--to', `${((rMax.value - min) / (max - min || 1)) * 100}%`); };
    const commit = debounce(() => this.apply(), 400);
    const onRange = (e) => {
      if (Number(rMin.value) > Number(rMax.value)) (e.target === rMin ? rMin : rMax).value = e.target === rMin ? rMax.value : rMin.value;
      iMin.value = Number(rMin.value) > min ? rMin.value : ''; iMax.value = Number(rMax.value) < max ? rMax.value : '';
      paint(); commit();
    };
    rMin.addEventListener('input', onRange); rMax.addEventListener('input', onRange);
    paint();
  }

  apply() {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(this.form)) if (v !== '' && !k.startsWith('option')) params.append(k, v);
    if (params.get('sort_by') === 'manual') params.delete('sort_by');
    const qs = params.toString();
    this.load(`${location.pathname}${qs ? `?${qs}` : ''}`);
  }

  async load(url, push = true) {
    const grid = this.el.querySelector('[data-results]');
    grid.classList.add('is-loading');
    const u = new URL(url, location.origin);
    u.searchParams.set('section_id', 'main');
    const html = await fetch(u).then((r) => r.text());
    if (push) history.pushState(null, '', url);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const next = tmp.firstElementChild;
    // keep the open/closed state of the filter bar
    if (this.form.classList.contains('is-collapsed')) next.querySelector('[data-filter-form]')?.classList.add('is-collapsed');
    this.section.replaceWith(next);
    await window.theme.mount(next);
    next.querySelector('.animation')?.classList.add('is-visible');
    next.querySelector('[data-results]').classList.add('is-visible');
  }
}
