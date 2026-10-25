// "Complete the set" (ProductUpsell.js idea): products come from the
// custom.upsell_products metafield; tick items, see a running total, add all at once.
import { cart } from '../core/api.js';
import { emit } from '../core/events.js';
import { money, toast } from '../core/utils.js';

export default class Upsell {
  constructor(el) {
    this.items = [...el.querySelectorAll('[data-upsell-item]')];
    this.btn = el.querySelector('[data-upsell-add]');
    this.total = el.querySelector('[data-upsell-total]');
    el.addEventListener('change', () => this.update());
    this.btn.addEventListener('click', () => this.add());
    this.update();
  }
  selected() {
    return this.items.filter((i) => i.querySelector('[data-upsell-check]').checked).map((i) => {
      const v = i.querySelector('[data-upsell-variant]');
      const price = v.tagName === 'SELECT' ? Number(v.selectedOptions[0].dataset.price) : Number(v.dataset.price);
      return { id: Number(v.value), price };
    });
  }
  update() { const s = this.selected(); this.total.textContent = money(s.reduce((a, b) => a + b.price, 0)); this.btn.disabled = !s.length; }
  async add() {
    this.btn.classList.add('is-loading');
    try { await cart.add(this.selected().map(({ id }) => ({ id, quantity: 1 }))); emit('cart:open'); } catch (err) { toast(err.message); }
    this.btn.classList.remove('is-loading');
  }
}
