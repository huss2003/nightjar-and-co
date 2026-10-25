// Product card: size-chip quick add (one click, no product page), second image
// on touch, wishlist toggle, quick-add button (single-variant products add
// directly; others reveal the chips).
import { cart, wishlist } from '../core/api.js';
import { emit, on } from '../core/events.js';
import { toast, wait } from '../core/utils.js';

export default class ProductCard {
  constructor(el) {
    this.el = el;
    el.querySelectorAll('.size-chip').forEach((chip) => chip.addEventListener('click', (e) => { e.preventDefault(); this.add(chip); }));
    const quick = el.querySelector('[data-quick-add]');
    quick?.addEventListener('click', () => {
      if (quick.dataset.quickAdd) return this.add(quick, Number(quick.dataset.quickAdd));
      if (el.querySelector('.product-item__chips-overlay')) { el.classList.toggle('is-chips-open'); el.querySelector('.size-chip:not([disabled])')?.focus(); }
      else location.href = `/products/${quick.dataset.handle}`;
    });
    // touch: show the second image while pressed
    const two = el.querySelector('.product-item__image--two');
    el.addEventListener('touchstart', () => two?.classList.add('active'), { passive: true });
    el.addEventListener('touchend', () => two?.classList.remove('active'));
    // wishlist hearts (saved in Postgres; merged into the account on login)
    const wl = el.querySelector('[data-wishlist]');
    if (wl) {
      const id = wl.dataset.wishlist;
      wishlist.ids().then((set) => wl.setAttribute('aria-pressed', set.has(id)));
      on('wishlist:updated', ({ set }) => wl.setAttribute('aria-pressed', set.has(id)));
      wl.addEventListener('click', async () => {
        wl.classList.add('is-pulsing');
        try { const r = await wishlist.toggle(id); toast(r.wished ? 'Saved to your wishlist' : 'Removed from your wishlist'); }
        catch (err) { toast(err.message); }
        wl.classList.remove('is-pulsing');
      });
    }
  }

  async add(btn, variantId = Number(btn.dataset.variantId)) {
    if (this.el.classList.contains('is-adding')) return;
    this.el.classList.add('is-adding'); btn.classList.add('is-loading');
    try {
      await cart.add([{ id: variantId, quantity: 1 }]);
      await wait(300);
      emit('cart:open');
    } catch (err) { toast(err.message); }
    finally { this.el.classList.remove('is-adding', 'is-chips-open'); btn.classList.remove('is-loading'); }
  }
}
