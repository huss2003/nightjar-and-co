// Mobile menu drawer: slides in from the left, links rise with a stagger,
// sub-menus push the main list sideways (iOS-style navigation).
import { lockScroll, trapFocus } from '../core/utils.js';

export default class MobileDrawer {
  constructor(el) {
    this.el = el;
    this.nav = el.querySelector('.drawer-nav');
    document.querySelectorAll('[data-open-drawer]').forEach((b) => b.addEventListener('click', () => this.open()));
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.querySelectorAll('[data-submenu]').forEach((b) => b.addEventListener('click', () => {
      this.nav.classList.add('is-sub');
      el.querySelector(`#${b.dataset.submenu}`).classList.add('is-active');
    }));
    el.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
      this.nav.classList.remove('is-sub');
      el.querySelectorAll('.drawer-nav__sub').forEach((s) => s.classList.remove('is-active'));
    }));
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }
  open() { this.el.classList.add('is-open'); this.el.setAttribute('aria-hidden', 'false'); lockScroll(true); this.release = trapFocus(this.el.querySelector('.drawer__panel')); }
  close() { if (!this.el.classList.contains('is-open')) return; this.el.classList.remove('is-open'); this.el.setAttribute('aria-hidden', 'true'); lockScroll(false); this.release?.(); }
}
