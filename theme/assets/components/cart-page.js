// Full cart page: same line-item controls as the drawer; the page section is
// re-rendered from the response, plus an order note saved with /cart/update.js.
import { cart, sectionsFor } from '../core/api.js';
import { on, emit } from '../core/events.js';
import { debounce, toast } from '../core/utils.js';

export default class CartPage {
  constructor(el) {
    el.addEventListener('click', (e) => {
      const item = e.target.closest('[data-key]'); if (!item) return;
      const input = item.querySelector('[data-qty-input]');
      if (e.target.closest('[data-qty-change]')) this.set(item.dataset.key, Math.max(0, Number(input.value) + Number(e.target.closest('[data-qty-change]').dataset.qtyChange)));
      if (e.target.closest('[data-remove]')) this.set(item.dataset.key, 0);
    });
    el.querySelector('[data-cart-note]')?.addEventListener('input', debounce((e) => fetch('/cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: e.target.value }) }), 500));
    if (!window.__cartPageWired) { window.__cartPageWired = true; on('cart:updated', async () => emit('sections:render', await sectionsFor(['main']))); }
  }
  async set(key, q) { try { await cart.change(key, q); } catch (err) { toast(err.message); } }
}
