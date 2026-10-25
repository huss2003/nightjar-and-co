// ---------------------------------------------------------------------------
// Gift box builder (the custom GiftBox.js idea from design.md §6):
// each product has *points*; the shopper ticks cart items and we auto-pick the
// smallest box variant whose points limit fits. The box is added as its own
// line item with hidden properties: _box_items (cart line keys) + Gift Message.
// The modal is server-rendered on demand: GET /?sections=gift-box
// ---------------------------------------------------------------------------
import { cart, sectionsFor } from '../core/api.js';
import { lockScroll, trapFocus, wait, money } from '../core/utils.js';

export async function openGiftBox() {
  const { 'gift-box': html } = await sectionsFor(['gift-box']);
  document.getElementById('shopify-section-gift-box')?.remove();
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const section = tmp.firstElementChild;
  document.body.append(section);
  await window.theme.mount(section);
}

export default class GiftBox {
  constructor(el) {
    this.el = el;
    this.data = JSON.parse(el.dataset.box);
    this.variants = [...this.data.variants].sort((a, b) => a.limit - b.limit);
    this.max = this.variants[this.variants.length - 1].limit;
    this.checks = [...el.querySelectorAll('input[type=checkbox]')];
    this.save = el.querySelector('[data-save-box]');
    this.error = el.querySelector('[data-box-error]');
    this.checks.forEach((c) => c.addEventListener('change', () => this.render()));
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    el.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    this.save.addEventListener('click', () => this.submit());
    el.querySelector('[data-remove-box]')?.addEventListener('click', () => this.remove());
    this.render();
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('is-open'); lockScroll(true); this.release = trapFocus(el.querySelector('.gift-box__panel')); }));
  }
  get used() { return this.checks.filter((c) => c.checked).reduce((s, c) => s + Number(c.dataset.points), 0); }
  /** smallest box whose points limit covers the selection */
  get box() { return this.variants.find((v) => v.limit >= this.used) || this.variants[this.variants.length - 1]; }
  render() {
    const used = this.used, box = this.box;
    const bar = this.el.querySelector('[data-points-bar]');
    bar.style.setProperty('--fill', `${Math.min(100, (used / box.limit) * 100)}%`);
    bar.setAttribute('aria-valuenow', used); bar.setAttribute('aria-valuemax', box.limit);
    bar.classList.toggle('is-over', used > this.max);
    this.el.querySelector('[data-points-label]').textContent = `${used} / ${box.limit} points`;
    this.el.querySelector('[data-box-name]').textContent = used ? `${box.title} box · ${money(box.price)}` : 'Choose items';
    this.el.querySelectorAll('[data-size-chip]').forEach((s) => s.classList.toggle('is-active', used > 0 && Number(s.dataset.sizeChip) === box.id));
    // items that would overflow the largest box are disabled
    this.checks.forEach((c) => { if (!c.checked) c.disabled = used + Number(c.dataset.points) > this.max; });
    this.save.disabled = used === 0;
  }
  async submit() {
    this.save.classList.add('is-loading'); this.error.textContent = '';
    try {
      if (this.data.existingKey) await cart.change(this.data.existingKey, 0);
      await cart.add([{ id: this.box.id, quantity: 1, properties: { _box_items: JSON.stringify(this.checks.filter((c) => c.checked).map((c) => c.value)), 'Gift Message': this.el.querySelector('[data-gift-message]').value.trim() } }]);
      this.close();
    } catch (err) { this.error.textContent = err.message; }
    this.save.classList.remove('is-loading');
  }
  async remove() { await cart.change(this.data.existingKey, 0); this.close(); }
  async close() {
    this.el.classList.remove('is-open'); lockScroll(false); this.release?.();
    await wait(500); this.el.closest('.shopify-section')?.remove();
  }
}
