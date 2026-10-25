// Featured collection tabs: old grid fades out (.3s) → new grid starts hidden
// → its cards reveal 50ms later with the product-grid stagger.
import { wait } from '../core/utils.js';

export default class Tabs {
  constructor(el) {
    this.tabs = [...el.querySelectorAll('[data-tab]')];
    this.panels = [...el.querySelectorAll('.tab-panel')];
    this.tabs.forEach((t, i) => t.addEventListener('click', () => this.select(i)));
    el.querySelector('[role=tablist]')?.addEventListener('keydown', (e) => {
      const i = this.tabs.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === 'ArrowRight') { this.tabs[(i + 1) % this.tabs.length].focus(); }
      if (e.key === 'ArrowLeft') { this.tabs[(i - 1 + this.tabs.length) % this.tabs.length].focus(); }
    });
  }
  async select(i) {
    const current = this.panels.find((p) => p.classList.contains('is-active'));
    const next = this.panels[i];
    if (current === next || this.busy) return;
    this.busy = true;
    this.tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', k === i); });
    current.classList.add('is-leaving');
    await wait(300);
    current.classList.remove('is-active', 'is-leaving'); current.hidden = true;
    const grid = next.querySelector('.animation--product-grid');
    grid.classList.remove('is-visible');
    next.hidden = false; next.classList.add('is-active');
    next.querySelector('.slider')?.slider?.update();
    await wait(50);
    grid.classList.add('is-visible');
    this.busy = false;
  }
}
