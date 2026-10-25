// Checkout details step: live shipping totals, and new rates when the country changes.
const money = (p) => `£${(p / 100).toFixed(2)}`;

export default class Checkout {
  constructor(form) {
    this.form = form;
    const summary = document.querySelector('[data-summary]');
    const update = () => {
      const r = form.querySelector('input[name=shipping]:checked');
      if (!r || !summary) return;
      const ship = Number(r.dataset.price || 0);
      summary.querySelector('[data-ship]').textContent = ship ? money(ship) : 'Free';
      summary.querySelector('[data-grand]').textContent = money(Number(summary.dataset.total) + ship);
    };
    form.addEventListener('change', async (e) => {
      if (e.target.name === 'shipping') return update();
      if (e.target.matches('[data-country]')) {
        const html = await fetch(`/checkout?country=${encodeURIComponent(e.target.value)}`).then((res) => res.text());
        const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-rates]');
        if (fresh) { form.querySelector('[data-rates]').replaceWith(fresh); update(); }
      }
    });
    form.addEventListener('submit', () => form.querySelector('.checkout__pay')?.classList.add('is-loading'));
    update();
  }
}
