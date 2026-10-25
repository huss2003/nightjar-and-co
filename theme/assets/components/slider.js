// Horizontal product/collection slider: native scroll-snap + arrow buttons +
// progress bar. No library (the original uses Swiper; this is ~30 lines).
export default class Slider {
  constructor(el) {
    this.track = el.querySelector('.slider__track');
    this.prev = el.querySelector('[data-slider-prev]');
    this.next = el.querySelector('[data-slider-next]');
    this.bar = el.querySelector('.slider__progress');
    const step = () => (this.track.firstElementChild?.getBoundingClientRect().width || 300) + 16;
    this.prev?.addEventListener('click', () => this.track.scrollBy({ left: -step() * (el.hasAttribute('data-single') ? 1 : 2), behavior: 'smooth' }));
    this.next?.addEventListener('click', () => this.track.scrollBy({ left: step() * (el.hasAttribute('data-single') ? 1 : 2), behavior: 'smooth' }));
    this.track.addEventListener('scroll', () => this.update(), { passive: true });
    new ResizeObserver(() => this.update()).observe(this.track);
    el.slider = this;
  }
  update() {
    const { scrollLeft, scrollWidth, clientWidth } = this.track;
    const max = scrollWidth - clientWidth;
    if (this.prev) this.prev.disabled = scrollLeft <= 2;
    if (this.next) this.next.disabled = scrollLeft >= max - 2;
    if (this.bar) {
      const visible = clientWidth / scrollWidth;
      this.bar.style.setProperty('--p', `${Math.min(100, visible * 100)}%`);
      this.bar.style.setProperty('--o', `${max > 0 ? (scrollLeft / max) * (100 - visible * 100) : 0}%`);
    }
  }
  scrollToIndex(i) { const el = this.track.children[i]; if (el) this.track.scrollTo({ left: el.offsetLeft - this.track.offsetLeft, behavior: 'smooth' }); }
}
