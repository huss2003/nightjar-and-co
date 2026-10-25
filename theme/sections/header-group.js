// Header group: announcement bar + header (logo, mega menu, icons) + mobile drawer
import { esc, icon, image, logo } from '../snippets/helpers.js';
import { MENU } from '../../server/catalog.js';

export function announcementBar(ctx) {
  const items = ctx.settings.announcements;
  return `<div class="announcement-bar" data-component="announcement" role="region" aria-label="Announcements" aria-roledescription="carousel">
    <button type="button" class="announcement-bar__arrow" data-prev aria-label="Previous announcement">${icon('left', 14)}</button>
    <div class="announcement-bar__track">
      ${items.map((a, i) => `<a class="announcement-bar__item ${i === 0 ? 'is-active' : ''}" href="${esc(a.link)}" ${i ? 'aria-hidden="true" tabindex="-1"' : ''}>${esc(a.text)}</a>`).join('')}
    </div>
    <button type="button" class="announcement-bar__arrow" data-next aria-label="Next announcement">${icon('right', 14)}</button>
  </div>`;
}

export function header(ctx) {
  const transparent = ctx.template === 'index';
  const count = ctx.cart.item_count;
  const nav = MENU.map((item, i) => {
    if (!item.mega) return `<li class="header__nav-item"><a class="header__link link-hover ${item.accent ? 'header__link--accent' : ''}" href="${item.url}">${esc(item.title)}</a></li>`;
    return `<li class="header__nav-item has-mega" data-mega>
      <button type="button" class="header__link link-hover" aria-expanded="false" aria-controls="mega-${i}">${esc(item.title)} ${icon('chevron', 14)}</button>
      <div class="mega" id="mega-${i}">
        <div class="mega__inner">
          ${item.columns.map((col) => `<div class="mega__col" data-mega-item>
            <p class="mega__heading">${esc(col.title)}</p>
            <ul>${col.links.map(([t, u]) => `<li><a class="link-hover" href="${u}">${esc(t)}</a></li>`).join('')}</ul>
          </div>`).join('')}
          <a class="mega__promo" data-mega-item href="${item.promo.url}">
            ${image(item.promo.image, { alt: item.promo.title, ratio: 4 / 5, animate: false })}
            <span class="mega__promo-title">${esc(item.promo.title)} ${icon('arrow', 16)}</span>
          </a>
        </div>
      </div>
    </li>`;
  }).join('');

  const mobile = MENU.map((item, i) => item.mega
    ? `<li class="drawer-nav__item" style="--i:${i}"><button type="button" class="drawer-nav__link" data-submenu="sub-${i}">${esc(item.title)} ${icon('right', 16)}</button></li>`
    : `<li class="drawer-nav__item" style="--i:${i}"><a class="drawer-nav__link" href="${item.url}">${esc(item.title)}</a></li>`).join('');
  const subs = MENU.map((item, i) => item.mega ? `<div class="drawer-nav__sub" id="sub-${i}">
      <button type="button" class="drawer-nav__back" data-back>${icon('left', 16)} ${esc(item.title)}</button>
      <ul>${item.columns.flatMap((c) => c.links).map(([t, u]) => `<li><a class="drawer-nav__link" href="${u}">${esc(t)}</a></li>`).join('')}</ul>
    </div>` : '').join('');

  return `<header class="header ${transparent ? 'header--transparent' : ''}" data-component="header">
    <div class="header__inner">
      <button type="button" class="header__icon header__burger" data-open-drawer aria-label="Open menu" aria-controls="mobile-drawer">${icon('menu', 22)}</button>
      <a class="header__logo" href="/" aria-label="${esc(ctx.settings.brand.name)} home">${logo(ctx.settings.brand.name)}</a>
      <nav class="header__nav" aria-label="Main"><ul>${nav}</ul></nav>
      <div class="header__icons">
        <button type="button" class="header__icon" data-open-search aria-label="Search">${icon('search', 22)}</button>
        <a class="header__icon hide-mobile" href="/pages/wishlist" aria-label="Wishlist">${icon('heart', 22)}<span class="cart-count" data-wishlist-count hidden></span></a>
        <a class="header__icon hide-mobile" href="${ctx.customer ? '/account' : '/account/login'}" aria-label="${ctx.customer ? 'Your account' : 'Log in'}">${icon('account', 22)}${ctx.customer ? '<span class="header__dot" aria-hidden="true"></span>' : ''}</a>
        <a class="header__icon" href="/cart" data-open-cart aria-label="Cart, ${count} items">${icon('cart', 22)}<span class="cart-count" data-cart-count ${count ? '' : 'hidden'}>${count}</span></a>
      </div>
    </div>
    <div class="header__dim" aria-hidden="true"></div>
  </header>
  <div class="drawer drawer--left" id="mobile-drawer" data-component="mobile-drawer" aria-hidden="true">
    <div class="drawer__overlay" data-close></div>
    <div class="drawer__panel" role="dialog" aria-label="Menu">
      <div class="drawer__head"><span class="header__logo">${logo(ctx.settings.brand.name)}</span><button type="button" class="drawer__close" data-close aria-label="Close menu">${icon('close')}</button></div>
      <div class="drawer-nav"><ul class="drawer-nav__main">${mobile}
        <li class="drawer-nav__item drawer-nav__extra" style="--i:${MENU.length}"><a href="${ctx.customer ? '/account' : '/account/login'}">${icon('account', 18)} ${ctx.customer ? 'Your account' : 'Log in / Register'}</a><a href="/pages/wishlist">${icon('heart', 18)} Wishlist</a></li></ul>${subs}</div>
    </div>
  </div>`;
}
