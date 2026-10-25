// Shoppable image: hotspots breathe until first touched; a pulse ring walks
// from hotspot to hotspot every 3s; clicking a hotspot slides the carousel to
// its product (desktop) — the same carousel stacks below on mobile.
export default class Shoppable {
  constructor(el) {
    this.el = el;
    this.spots = [...el.querySelectorAll('.hotspot')];
    this.slider = el.querySelector('.slider');
    let k = 0;
    this.pulse = setInterval(() => {
      if (document.hidden) return;
      this.spots.forEach((s) => s.classList.remove('is-pulse'));
      void el.offsetWidth;
      this.spots[k++ % this.spots.length]?.classList.add('is-pulse');
    }, 3000);
    this.spots.forEach((s, i) => {
      s.addEventListener('mouseenter', () => el.classList.add('is-touched'));
      s.addEventListener('click', () => {
        el.classList.add('is-touched');
        this.spots.forEach((o) => o.classList.toggle('is-active', o === s));
        this.slider?.slider?.scrollToIndex(i);
        if (matchMedia('(max-width: 959px)').matches) this.slider.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    this.slider?.querySelector('.slider__track').addEventListener('scroll', () => {
      const t = this.slider.querySelector('.slider__track');
      const i = Math.round(t.scrollLeft / t.clientWidth);
      this.spots.forEach((o, k2) => o.classList.toggle('is-active', k2 === i));
    }, { passive: true });
  }
}
