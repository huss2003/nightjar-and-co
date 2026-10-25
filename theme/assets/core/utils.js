// Small utilities shared by components.
export const money = (pence) => `£${(pence / 100).toFixed(2)}`;
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = () => !document.documentElement.classList.contains('do-anim');
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lock page scroll while a drawer/modal is open (like body-scroll-lock) */
let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.documentElement.style.overflow = locks ? 'hidden' : '';
  document.documentElement.style.paddingRight = locks ? `${window.innerWidth - document.documentElement.clientWidth}px` : '';
}

/** Keep keyboard focus inside a dialog; returns a release function */
export function trapFocus(container, initial) {
  const prev = document.activeElement;
  const focusables = () => qsa('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])', container).filter((el) => el.offsetParent !== null);
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  requestAnimationFrame(() => (initial || focusables()[0])?.focus({ preventScroll: true }));
  return () => { container.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
}

export function toast(msg) {
  const el = qs('[data-toast]'); if (!el) return;
  el.textContent = msg; el.classList.remove('is-show'); void el.offsetWidth; el.classList.add('is-show');
}
