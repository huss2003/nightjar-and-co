// Newsletter popup: opens after a delay (or on exit intent), once per visitor.
import { lockScroll, trapFocus } from '../core/utils.js';

export default class Popup {
  constructor(el) {
    this.el = el;
    let seen = false; try { seen = localStorage.getItem('popup-dismissed') === '1' || new URLSearchParams(location.search).has('nopopup'); } catch {}
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    if (seen || /^(cart|checkout)$/.test(window.theme.template)) return;
    this.t = setTimeout(() => this.open(), Number(el.dataset.delay) || 6000);
    document.addEventListener('mouseleave', (e) => { if (e.clientY < 0) this.open(); }, { once: true });
  }
  open() {
    if (this.shown || document.querySelector('.quick-cart.is-open, .search-overlay.is-active')) return;
    this.shown = true; clearTimeout(this.t);
    this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden', 'false'); lockScroll(true);
    this.release = trapFocus(this.el.querySelector('.popup__panel'), this.el.querySelector('input'));
  }
  close() {
    if (!this.el.classList.contains('is-open')) return;
    this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden', 'true'); lockScroll(false); this.release?.();
    try { localStorage.setItem('popup-dismissed', '1'); } catch {}
  }
}
