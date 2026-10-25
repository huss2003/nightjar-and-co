// Discount code field in the cart (like DiscountCode.js in the original):
// applies through /discount/{code}, then the cart sections re-render with totals.
import { cart } from '../core/api.js';
import { toast } from '../core/utils.js';

export default class DiscountCode {
  constructor(form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]'), msg = form.querySelector('.discount-code__msg');
      btn.classList.add('is-loading');
      try {
        const r = await cart.discount(form.code.value);
        if (!r.applied) { const m = document.querySelector('.discount-code__msg'); if (m) { m.className = 'discount-code__msg is-error'; m.textContent = r.reason || 'Enter a valid discount code'; } }
      } catch (err) { msg.textContent = err.message; toast(err.message); }
      btn.classList.remove('is-loading');
    });
    form.querySelector('[data-remove-discount]')?.addEventListener('click', () => cart.discount(''));
  }
}
