// "You may also like": lazy-loads product cards when the section nears the
// viewport (Shopify's /recommendations/products?section_id=… pattern).
export default class Recommendations {
  constructor(el) {
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const html = await fetch(el.dataset.url).then((r) => r.text());
      const grid = el.querySelector('[data-recommendations]');
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      grid.innerHTML = tmp.firstElementChild ? tmp.firstElementChild.innerHTML : '';
      if (!grid.children.length) { el.hidden = true; return; }
      await window.theme.mount(grid);
      requestAnimationFrame(() => grid.classList.add('is-visible'));
    }, { rootMargin: '0px 0px 400px 0px' });
    io.observe(el);
  }
}
