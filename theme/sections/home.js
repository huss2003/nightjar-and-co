// Homepage sections. Each one mirrors a Stiletto section type (design.md §3.2)
// and opts into the motion system with `animation` + `animation--*` classes (§4).
import { esc, icon, image, d } from '../snippets/helpers.js';
import { productCard } from '../snippets/product-card.js';
import { productsIn, collectionByHandle, byHandle, PRODUCTS } from '../../server/catalog.js';

export const FLATLAY_SPOTS = [{ x: 30, y: 36 }, { x: 72, y: 36 }, { x: 56, y: 82 }];
export const flatlayProducts = (print) => {
  const all = PRODUCTS.filter((p) => p.metafields.custom?.print === print);
  const pick = [all.find((p) => /Pyjama|Set/.test(p.title)), all.find((p) => p.metafields.custom.audience !== 'accessories' && !/Pyjama|Set/.test(p.title)) || all.find((p) => p.metafields.custom.audience === 'kids' || p.metafields.custom.audience === 'mens'), all.find((p) => p.metafields.custom.audience === 'accessories')];
  const out = [...new Set(pick.filter(Boolean))];
  for (const p of all) if (out.length < 3 && !out.includes(p)) out.push(p);
  return out.slice(0, 3);
};

const btn = (label, url, kind = 'primary') => `<a class="btn btn--${kind}" href="${esc(url)}"><span>${esc(label)}</span></a>`;
const sliderArrows = () => `<div class="slider-arrows"><button type="button" class="slider-arrow" data-slider-prev aria-label="Previous">${icon('left', 18)}</button><button type="button" class="slider-arrow" data-slider-next aria-label="Next">${icon('right', 18)}</button></div>`;

/* 1. Slideshow — fade, 6s autoplay, progress-ring dots */
export function slideshow(ctx, s) {
  return `<div class="slideshow animation animation--slideshow" data-component="slideshow" data-autoplay="${s.autoplay ?? 6000}" style="--animation-timing:${s.autoplay ?? 6000}" role="region" aria-roledescription="carousel" aria-label="Featured">
    <div class="slideshow__slides">
      ${s.slides.map((sl, i) => `<div class="slideshow__slide ${i === 0 ? 'is-active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${s.slides.length}" ${i ? 'aria-hidden="true"' : ''}>
        ${image(sl.image, { alt: sl.alt || '', ratio: 16 / 9, eager: i === 0, cls: 'slideshow__image', pos: sl.pos || '' })}
        <div class="slideshow__overlay"></div>
        <div class="slideshow__content animation--section-blocks">
          <p class="slideshow__eyebrow" style="--delay-offset-multiplier:3">${esc(sl.eyebrow || '')}</p>
          <h2 class="slideshow__heading display-1" style="--delay-offset-multiplier:4">${esc(sl.heading)}</h2>
          <div style="--delay-offset-multiplier:5">${btn(sl.button, sl.url)}</div>
        </div>
      </div>`).join('')}
    </div>
    <div class="slideshow__nav">
      <button type="button" class="slideshow__arrow" data-prev aria-label="Previous slide">${icon('left', 18)}</button>
      <div class="slideshow__dots">${s.slides.map((_, i) => `<button type="button" class="slideshow__dot ${i === 0 ? 'is-active' : ''}" aria-label="Go to slide ${i + 1}"><span class="slideshow__dot-loader"></span></button>`).join('')}</div>
      <button type="button" class="slideshow__arrow" data-next aria-label="Next slide">${icon('right', 18)}</button>
    </div>
  </div>`;
}

/* 2. Featured collection slider with tabs */
export function featuredCollectionSlider(ctx, s) {
  return `<div class="section featured-slider animation" data-component="tabs">
    <div class="section__intro animation--section-blocks">
      <h2 class="h2" ${d(0)}>${esc(s.heading)}</h2>
      <div class="tabs" role="tablist" ${d(1)}>
        ${s.tabs.map((t, i) => `<button type="button" role="tab" class="tab link-hover ${i === 0 ? 'is-active' : ''}" aria-selected="${i === 0}" aria-controls="tab-${t.collection}" data-tab="${i}">${esc(t.label)}</button>`).join('')}
      </div>
    </div>
    ${s.tabs.map((t, i) => `<div class="tab-panel ${i === 0 ? 'is-active' : ''}" id="tab-${t.collection}" role="tabpanel" ${i ? 'hidden' : ''}>
      <div class="slider" data-component="slider">
        <div class="slider__track animation--product-grid">${productsIn(t.collection).slice(0, 10).map((p, n) => productCard(p, n)).join('')}</div>
        <div class="slider__controls"><div class="slider__progress"><span></span></div>${sliderArrows()}</div>
      </div>
      <div class="section__footer">${btn('View all', `/collections/${t.collection}`, 'secondary')}</div>
    </div>`).join('')}
  </div>`;
}

/* 3. Collection list slider */
export function collectionListSlider(ctx, s) {
  return `<div class="section animation">
    <div class="section__intro animation--section-blocks"><h2 class="h2" ${d(0)}>${esc(s.heading)}</h2></div>
    <div class="slider" data-component="slider">
      <div class="slider__track slider__track--collections animation--section-blocks">
        ${s.collections.map((h, i) => { const c = collectionByHandle.get(h); if (!c) return ''; const p = productsIn(h)[0]; return `<a class="collection-tile" href="/collections/${h}" ${d(i + 1)}>
          ${image(p ? p.images[0].src : '/img/lifestyle/tile.svg', { alt: c.title, ratio: 3 / 4 })}
          <span class="collection-tile__title">${esc(c.title)} <span class="collection-tile__arrow">${icon('arrow', 18)}</span></span>
        </a>`; }).join('')}
      </div>${sliderArrows()}
    </div>
  </div>`;
}

/* 4. Image hero split — two half-width tiles */
export function imageHeroSplit(ctx, s) {
  return `<div class="hero-split animation">
    ${s.tiles.map((t, i) => `<a class="hero-split__tile" href="${t.url}">
      <div class="hero-split__image" ${d(i)}>${image(t.image, { alt: t.heading, ratio: 4 / 5 })}</div>
      <div class="hero-split__content animation--section-blocks"><h2 class="h1" ${d(i + 1)}>${esc(t.heading)}</h2><div ${d(i + 2)}>${btn(t.button, t.url)}</div></div>
    </a>`).join('')}
  </div>`;
}

/* 5. Rich text */
export function richText(ctx, s) {
  return `<div class="section rich-text animation" data-instant>
    <div class="rich-text__inner animation--section-blocks">
      ${s.eyebrow ? `<p class="eyebrow" ${d(0)}>${esc(s.eyebrow)}</p>` : ''}
      <h2 class="h2" ${d(1)}>${esc(s.heading)}</h2>
      ${s.text ? `<p class="rich-text__text" ${d(2)}>${esc(s.text)}</p>` : ''}
      ${s.button ? `<div ${d(3)}>${btn(s.button, s.url, 'callout')}</div>` : ''}
    </div>
  </div>`;
}

/* 6. Shoppable image — hotspots + product carousel */
export function shoppable(ctx, s) {
  const items = s.print
    ? flatlayProducts(s.print).map((p, i) => ({ ...FLATLAY_SPOTS[i], p }))
    : s.hotspots.map((h) => ({ ...h, p: byHandle.get(h.handle) || productsIn(s.fallback_collection)[h.i ?? 0] })).filter((h) => h.p);
  const img = s.print ? `/img/flatlay/${s.print.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-')}.svg` : s.image;
  return `<div class="section shoppable animation" data-component="shoppable">
    <div class="section__intro animation--section-blocks"><div><p class="eyebrow" ${d(0)}>${esc(s.eyebrow || 'Shop the print')}</p><h2 class="h2" ${d(1)}>${esc(s.heading)}</h2></div>${s.text ? `<p class="section__lede" ${d(2)}>${esc(s.text)}</p>` : ''}</div>
    <div class="shoppable__grid">
      <div class="shoppable__image">
        ${image(img, { alt: `${s.heading}: a flat lay of the pieces in this print`, ratio: 1 })}
        ${items.map((h, i) => `<button type="button" class="hotspot" style="left:${h.x}%;top:${h.y}%;--delay-offset-multiplier:${i}" data-index="${i}" aria-label="Show ${esc(h.p.title)}"><span class="hotspot__dot"></span></button>`).join('')}
      </div>
      <div class="shoppable__products slider" data-component="slider" data-single>
        <div class="slider__track">${items.map((h, i) => productCard(h.p, i, { chips: true })).join('')}</div>
        ${sliderArrows()}
      </div>
    </div>
  </div>`;
}

/* 7. Grid — two tiles */
export function grid(ctx, s) {
  return `<div class="section grid-tiles animation"><div class="grid-tiles__inner animation--grid">
    ${s.tiles.map((t, i) => `<a class="grid-tile" href="${t.url}" ${d(i)}>
      ${image(t.image, { alt: t.heading, ratio: 1 })}
      <div class="grid-tile__content"><h3 class="h3">${esc(t.heading)}</h3>${t.text ? `<p>${esc(t.text)}</p>` : ''}<span class="btn btn--primary"><span>${esc(t.button)}</span></span></div>
    </a>`).join('')}
  </div></div>`;
}

/* 8. Image with text split — text starts 6 steps after the image */
export function imageWithTextSplit(ctx, s) {
  return `<div class="image-text animation">
    <div class="image-text__image" ${d(0)}>${image(s.image, { alt: s.heading, ratio: 1 })}</div>
    <div class="image-text__content animation--section-blocks">
      ${s.eyebrow ? `<p class="eyebrow" ${d(5)}>${esc(s.eyebrow)}</p>` : ''}<h2 class="h2" ${d(6)}>${esc(s.heading)}</h2>
      <p ${d(7)}>${esc(s.text)}</p>
      <div ${d(8)}>${btn(s.button, s.url)}</div>
    </div>
  </div>`;
}

/* 9. Multi-column trust bar */
export function multiColumn(ctx, s) {
  return `<div class="trust-bar animation" style="background:var(--color-trust-bar)"><div class="trust-bar__inner animation--section-blocks">
    ${s.columns.map((c, i) => `<div class="trust-bar__col" ${d(i)}>${icon(c.icon, 28)}<p class="trust-bar__title">${esc(c.title)}</p><p class="trust-bar__text">${esc(c.text)}</p></div>`).join('')}
  </div></div>`;
}
