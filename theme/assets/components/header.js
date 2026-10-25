// Sticky header (IntersectionObserver), transparent over the hero, mega menu
// with column-ordered stagger (items staggered by their visual column).
import { qsa } from '../core/utils.js';

export default class Header {
  constructor(el) {
    this.el = el;
    // sticky state: a sentinel above the header leaves the viewport → .is-sticky
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => el.classList.toggle('is-sticky', !e.isIntersecting), { rootMargin: '40px 0px 0px 0px' }).observe(sentinel);

    this.megas = qsa('[data-mega]', el);
    this.megas.forEach((li) => {
      const btn = li.querySelector('button');
      let timer;
      const open = () => { clearTimeout(timer); this.open(li); };
      const close = () => { timer = setTimeout(() => this.close(li), 120); };
      li.addEventListener('mouseenter', open);
      li.addEventListener('mouseleave', close);
      btn.addEventListener('click', () => (li.classList.contains('is-open') ? this.close(li) : this.open(li)));
      li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) this.close(li); });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.megas.forEach((li) => this.close(li)); });
  }

  open(li) {
    this.megas.forEach((o) => o !== li && this.close(o));
    // stagger by visual column: items sharing a left edge share a delay index
    const items = qsa('[data-mega-item]', li);
    const lefts = [...new Set(items.map((i) => Math.round(i.getBoundingClientRect().left)))].sort((a, b) => a - b);
    items.forEach((i) => i.style.setProperty('--delay-offset-multiplier', lefts.indexOf(Math.round(i.getBoundingClientRect().left))));
    li.classList.add('is-open');
    li.querySelector('button').setAttribute('aria-expanded', 'true');
    this.el.classList.add('is-open');
  }

  close(li) {
    if (!li.classList.contains('is-open')) return;
    li.classList.remove('is-open');
    li.querySelector('button').setAttribute('aria-expanded', 'false');
    if (!this.megas.some((o) => o.classList.contains('is-open'))) this.el.classList.remove('is-open');
  }
}
