// Product page form: size chips → variant, live price/stock, quantity stepper,
// AJAX add to cart, sticky add-to-cart bar, size guide modal, URL ?variant=.
import { cart } from '../core/api.js';
import { emit } from '../core/events.js';
import { money, lockScroll, trapFocus, wait } from '../core/utils.js';

export default class ProductForm {
  constructor(el) {
    this.el = el;
    this.product = JSON.parse(el.dataset.product);
    this.form = el.querySelector('[data-product-form]');
    this.input = el.querySelector('[data-variant-input]');
    this.atc = el.querySelector('[data-atc]');
    this.error = el.querySelector('[data-error]');
    this.qty = el.querySelector('[data-qty-input]');
    el.querySelectorAll('input[name=option-size]').forEach((r) => r.addEventListener('change', () => this.select(Number(r.value))));
    el.querySelector('[data-qty]')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-qty-change]'); if (!b) return;
      this.qty.value = Math.max(1, Number(this.qty.value) + Number(b.dataset.qtyChange));
    });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.add(); });
    // sticky bar appears once the real button scrolls out of view
    const sticky = el.querySelector('[data-sticky-atc]');
    new IntersectionObserver(([e]) => { const show = !e.isIntersecting && e.boundingClientRect.top < 0; sticky.classList.toggle('is-visible', show); sticky.setAttribute('aria-hidden', !show); }).observe(this.atc);
    el.querySelector('[data-sticky-btn]').addEventListener('click', () => {
      if (this.current) return this.add();
      this.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.el.querySelector('.size-grid')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300, delay: 400 });
    });
    // size guide modal
    const guide = el.querySelector('[data-size-guide]');
    el.querySelector('[data-open-size-guide]')?.addEventListener('click', () => { guide.classList.add('is-open'); guide.setAttribute('aria-hidden', 'false'); lockScroll(true); this.releaseGuide = trapFocus(guide.querySelector('.modal__panel')); });
    const closeGuide = () => { if (!guide.classList.contains('is-open')) return; guide.classList.remove('is-open'); guide.setAttribute('aria-hidden', 'true'); lockScroll(false); this.releaseGuide?.(); };
    guide?.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeGuide));
    guide?.addEventListener('keydown', (e) => e.key === 'Escape' && closeGuide());
    const pre = Number(this.input.value);
    this.current = pre ? this.product.variants.find((v) => v.id === pre) : null;
  }

  select(id) {
    const v = this.product.variants.find((x) => x.id === id);
    this.current = v; this.input.value = id;
    this.el.querySelector('[data-size-label]').textContent = v.option1;
    const pct = v.compare_at_price ? Math.round((1 - v.price / v.compare_at_price) * 100) : 0;
    this.el.querySelector('[data-price]').innerHTML = `<div class="price ${pct ? 'price--sale' : ''}"><span class="price__current">${money(v.price)}</span>${pct ? `<s class="price__compare">${money(v.compare_at_price)}</s><span class="price__badge">${pct}% off</span>` : ''}</div>`;
    this.el.querySelector('[data-sticky-price]').textContent = money(v.price);
    this.el.querySelector('[data-sticky-btn] span').textContent = v.available ? 'Add to cart' : 'Sold out';
    const stock = !v.available ? ['bad', 'Sold out', 0] : v.qty !== null && v.qty <= 5 ? ['medium', `Low stock, only ${v.qty} left`, 30] : ['good', 'In stock, and ready to ship', 100];
    const box = this.el.querySelector('[data-stock]');
    box.className = `stock stock--${stock[0]}`; box.querySelector('[data-stock-text]').textContent = stock[1]; box.querySelector('.stock__bar span').style.width = `${stock[2]}%`;
    this.atc.disabled = !v.available;
    this.el.querySelector('[data-atc-label]').textContent = v.available ? 'Add to cart' : 'Sold out';
    this.error.textContent = '';
    history.replaceState(null, '', `?variant=${id}`);
  }

  async add() {
    if (!this.input.value) { this.error.textContent = 'Please choose a size'; return; }
    this.atc.classList.add('is-loading'); this.error.textContent = '';
    try { await cart.add([{ id: Number(this.input.value), quantity: Number(this.qty.value) || 1 }]); await wait(200); emit('cart:open'); }
    catch (err) { this.error.textContent = err.message; }
    finally { this.atc.classList.remove('is-loading'); }
  }
}
