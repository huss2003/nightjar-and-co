// ---------------------------------------------------------------------------
// Reveal engine (design.md §4.2). One IntersectionObserver per section adds
// .is-visible once; CSS does the rest using --delay-offset-multiplier.
// ---------------------------------------------------------------------------
import { reducedMotion } from './utils.js';

export function intersectionWatcher(node, { instant = node.hasAttribute('data-instant'), onVisible } = {}) {
  if (reducedMotion()) { node.classList.add('is-visible'); onVisible?.(); return; }
  const margin = matchMedia('(min-width: 720px)').matches ? 200 : 100;
  const threshold = instant ? 0 : Math.min(margin / Math.max(node.offsetHeight, 1), 0.5);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { node.classList.add('is-visible'); onVisible?.(); io.disconnect(); }
  }, { threshold });
  io.observe(node);
}

/** Give children an index → CSS turns it into a transition delay */
export function delayOffset(node, selectors, start = 0) {
  let i = start;
  selectors.forEach((sel) => node.querySelectorAll(sel).forEach((el) => el.style.setProperty('--delay-offset-multiplier', i++)));
}

export function initAnimations(root = document) {
  root.querySelectorAll('.animation:not([data-anim-bound])').forEach((node) => {
    node.setAttribute('data-anim-bound', '');
    if (node.classList.contains('animation--slideshow')) return; // slideshow controls its own reveal per slide
    intersectionWatcher(node);
  });
  // product grids outside an .animation wrapper (e.g. injected recommendations)
  root.querySelectorAll('.animation--product-grid:not(.animation .animation--product-grid):not([data-anim-bound])').forEach((g) => { g.setAttribute('data-anim-bound', ''); intersectionWatcher(g); });
}

/** Mark images loaded even if they finished before JS ran */
export function markLoadedImages(root = document) {
  root.querySelectorAll('.image img').forEach((img) => { if (img.complete && img.naturalWidth) img.closest('.image').classList.add('loaded'); });
}
