// Product gallery: thumbnails switch the main image; click opens a zoom
// lightbox (PhotoSwipe in the original) with arrows, Esc and swipe.
import { lockScroll, trapFocus } from '../core/utils.js';

export default class Gallery {
  constructor(el) {
    this.el = el;
    this.media = [...el.querySelectorAll('.product__media')];
    this.thumbs = [...el.querySelectorAll('[data-thumb]')];
    this.box = document.querySelector('[data-lightbox]');
    this.img = this.box.querySelector('.lightbox__img');
    this.i = 0;
    this.thumbs.forEach((t, k) => t.addEventListener('click', () => this.show(k)));
    this.media.forEach((m, k) => m.addEventListener('click', () => this.zoom(k)));
    this.box.querySelector('[data-close]').addEventListener('click', () => this.unzoom());
    this.img.addEventListener('click', () => this.unzoom());
    this.box.querySelector('[data-prev]').addEventListener('click', () => this.zoom(this.i - 1));
    this.box.querySelector('[data-next]').addEventListener('click', () => this.zoom(this.i + 1));
    this.box.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.unzoom(); if (e.key === 'ArrowLeft') this.zoom(this.i - 1); if (e.key === 'ArrowRight') this.zoom(this.i + 1); });
    let x0 = null;
    this.box.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    this.box.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) this.zoom(this.i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }
  show(k) {
    this.i = (k + this.media.length) % this.media.length;
    this.media.forEach((m, n) => m.classList.toggle('is-active', n === this.i));
    this.thumbs.forEach((t, n) => t.classList.toggle('is-active', n === this.i));
  }
  zoom(k) {
    this.show(k);
    this.img.src = this.media[this.i].querySelector('img').src;
    if (!this.box.classList.contains('is-open')) { this.box.classList.add('is-open'); this.box.setAttribute('aria-hidden', 'false'); lockScroll(true); this.release = trapFocus(this.box, this.box.querySelector('[data-close]')); }
  }
  unzoom() { this.box.classList.remove('is-open'); this.box.setAttribute('aria-hidden', 'true'); lockScroll(false); this.release?.(); }
}
