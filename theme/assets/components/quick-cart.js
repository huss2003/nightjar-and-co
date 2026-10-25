// Quick cart drawer. Opens from the right (.5s), uses the visibility-delay
// trick so it's hidden from assistive tech when closed, and is re-rendered by
// the Section Rendering API after every change (see core/api.js).
import { cart } from '../core/api.js';
import { on, emit } from '../core/events.js';
import { lockScroll, trapFocus, toast, debounce } from '../core/utils.js';

let isOpen = false;
let wired = false;

export default class QuickCart {
  constructor(el) {
    this.el = el;
    if (isOpen) { el.classList.add('is-open', 'is-static'); el.setAttribute('aria-hidden', 'false'); this.release = trapFocus(el.querySelector('.quick-cart__panel'), el.querySelector('.quick-cart__close')); }
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    // quantity steppers and remove links (event delegation)
    el.addEventListener('click', (e) => {
      const item = e.target.closest('[data-key]'); if (!item) return;
      const input = item.querySelector('[data-qty-input]');
      if (e.target.closest('[data-qty-change]')) this.setQty(item, Math.max(0, Number(input.value) + Number(e.target.closest('[data-qty-change]').dataset.qtyChange)));
      if (e.target.closest('[data-remove]')) this.setQty(item, 0);
    });
    el.addEventListener('change', debounce((e) => { const item = e.target.closest('[data-key]'); if (item && e.target.matches('[data-qty-input]')) this.setQty(item, Math.max(0, Number(e.target.value))); }, 300));
    if (!wired) { // global listeners only once (instances are replaced on re-render)
      wired = true;
      on('cart:open', () => document.querySelector('[data-component="quick-cart"]')?.qc?.open());
      on('section:before-replace', ({ id, current }) => { if (id === 'quick-cart' && isOpen) current.querySelector('[data-component]')?.qc?.release?.(); });
    }
    el.qc = this;
  }
  async setQty(item, q) {
    this.el.querySelector('.quick-cart__body, .cart-items')?.classList.add('is-updating');
    try { await cart.change(item.dataset.key, q); } catch (err) { toast(err.message); this.el.querySelector('.is-updating')?.classList.remove('is-updating'); }
  }
  open() {
    if (isOpen) return;
    if (window.theme.template === 'cart') { location.href = '/cart'; return; }
    isOpen = true;
    this.el.classList.remove('is-static');
    this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    this.release = trapFocus(this.el.querySelector('.quick-cart__panel'), this.el.querySelector('.quick-cart__close'));
    emit('cart:opened');
  }
  close() {
    if (!isOpen) return;
    isOpen = false;
    this.el.classList.remove('is-open', 'is-static'); this.el.setAttribute('aria-hidden', 'true');
    lockScroll(false); this.release?.();
  }
}
