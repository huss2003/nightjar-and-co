// Announcement bar: rotates every 4s, pauses on hover/focus, arrows.
import { reducedMotion } from '../core/utils.js';

export default class Announcement {
  constructor(el) {
    this.items = [...el.querySelectorAll('.announcement-bar__item')];
    this.i = 0;
    if (this.items.length < 2) return;
    el.querySelector('[data-prev]').addEventListener('click', () => this.go(this.i - 1));
    el.querySelector('[data-next]').addEventListener('click', () => this.go(this.i + 1));
    const pause = () => clearInterval(this.timer), play = () => { pause(); if (!reducedMotion()) this.timer = setInterval(() => this.go(this.i + 1), 4000); };
    el.addEventListener('mouseenter', pause); el.addEventListener('mouseleave', play);
    el.addEventListener('focusin', pause); el.addEventListener('focusout', play);
    play();
  }
  go(n) {
    const len = this.items.length; this.i = (n + len) % len;
    this.items.forEach((it, k) => { const on = k === this.i; it.classList.toggle('is-active', on); it.toggleAttribute('aria-hidden', !on); it.tabIndex = on ? 0 : -1; });
  }
}
