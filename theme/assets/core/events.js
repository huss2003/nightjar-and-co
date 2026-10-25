// Tiny event bus: components talk without importing each other.
// Events used: cart:updated (cart json), cart:open, cart:item-added, gift-box:open
const target = new EventTarget();
export const on = (type, fn) => { const h = (e) => fn(e.detail); target.addEventListener(type, h); return () => target.removeEventListener(type, h); };
export const emit = (type, detail) => target.dispatchEvent(new CustomEvent(type, { detail }));
