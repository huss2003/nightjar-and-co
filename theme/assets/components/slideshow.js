// Hero slideshow: fade, autoplay with a progress-ring dot that fills over the
// autoplay time, pauses off-screen / on focus / on hover, replays the reveal
// animation on every slide (inactive slides reset to their hidden state).
import { intersectionWatcher } from '../core/motion.js';
import { reducedMotion, nextFrame } from '../core/utils.js';

export default class Slideshow {
  constructor(el) {
    this.el = el;
    this.slides = [...el.querySelectorAll('.slideshow__slide')];
    this.dots = [...el.querySelectorAll('.slideshow__dot')];
    this.delay = Number(el.dataset.autoplay) || 6000;
    this.i = 0; this.onScreen = false; this.hover = false; this.focus = false;
    this.dots.forEach((d, k) => d.addEventListener('click', () => this.go(k, true)));
    el.querySelector('[data-prev]').addEventListener('click', () => this.go(this.i - 1, true));
    el.querySelector('[data-next]').addEventListener('click', () => this.go(this.i + 1, true));
    el.addEventListener('mouseenter', () => { this.hover = true; this.sync(); });
    el.addEventListener('mouseleave', () => { this.hover = false; this.sync(); });
    el.addEventListener('focusin', () => { this.focus = true; this.sync(); });
    el.addEventListener('focusout', () => { this.focus = false; this.sync(); });
    // swipe
    let x0 = null;
    el.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    el.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) this.go(this.i + (e.clientX < x0 ? 1 : -1), true); x0 = null; });
    new IntersectionObserver(([e]) => { this.onScreen = e.isIntersecting; this.sync(); }, { threshold: 0.3 }).observe(el);
    intersectionWatcher(el, { onVisible: () => this.slides[0].classList.add('is-visible') });
  }
  get playing() { return this.onScreen && !this.hover && !this.focus && !reducedMotion() && this.slides.length > 1; }
  sync() {
    const playing = this.playing;
    this.el.classList.toggle('is-paused', !playing);
    if (!playing) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; this.remaining = Math.max(0, (this.remaining ?? this.delay) - (performance.now() - this.started)); }
      return;
    }
    if (this.timer) return; // already running
    this.started = performance.now();
    this.timer = setTimeout(() => { this.timer = null; this.remaining = null; this.go(this.i + 1); }, this.remaining ?? this.delay);
  }
  async go(n, user = false) {
    const len = this.slides.length, next = (n + len) % len;
    if (next === this.i) return;
    const prev = this.slides[this.i];
    this.i = next;
    this.slides.forEach((s, k) => { s.classList.toggle('is-active', k === next); s.toggleAttribute('aria-hidden', k !== next); });
    this.dots.forEach((d, k) => { d.classList.remove('is-active'); d.toggleAttribute('aria-current', k === next); });
    await nextFrame(); // restart the CSS ring animation
    this.dots[next].classList.add('is-active');
    setTimeout(() => prev.classList.remove('is-visible'), 300);
    this.slides[next].classList.add('is-visible');
    clearTimeout(this.timer); this.timer = null; this.remaining = null;
    this.sync();
  }
}
