// Layout (like layout/theme.liquid): <head>, settings → CSS variables,
// reduced-motion gate before paint, header group, main, footer group, overlays.
import { esc } from '../snippets/helpers.js';

export const SECTION_GROUPS = {
  header: ['announcement-bar', 'header'],
  overlay: ['quick-cart', 'popup', 'search'],
};

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#2a2238"/><path d="M20.5 7.5a9 9 0 1 0 4 15.6A10.5 10.5 0 0 1 20.5 7.5z" fill="#efe6d6"/></svg>')}`;

function cssVars(s) {
  const c = s.colors, m = s.motion, t = s.type;
  return `:root{
  --color-background:${c.background};--color-text:${c.text};--color-text-meta:${c.text_meta};
  --color-accent:${c.accent};--color-accent-hover:${c.accent_hover};--color-accent-text:${c.accent_text};
  --color-border:${c.border};--color-panel:${c.panel};--color-footer:${c.footer};--color-footer-text:${c.footer_text || c.text};--color-trust-bar:${c.trust_bar};--color-overlay:${c.overlay};
  --color-sale:${c.sale};--color-sold:${c.sold};--color-stock-good:${c.stock_good};--color-stock-medium:${c.stock_medium};--color-stock-bad:${c.stock_bad};
  --color-error:${c.error};--color-success:${c.success};
  --font-heading:${t.heading_font};--font-body:${t.body_font};
  --easing:${m.easing};--duration-ultra-fast:.1s;--duration-fast:${m.duration_fast};--duration-normal:${m.duration_normal};--duration-slow:${m.duration_slow};
  --delay-small:${m.delay_small};--delay-normal:${m.delay_normal};--delay-long:${m.delay_long};
}`;
}

const head = (s, title, description) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | ${esc(s.brand.name)}</title>
<meta name="description" content="${esc(description || s.brand.tagline)}">
<meta name="theme-color" content="#2a2238">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="${esc(s.type.google_fonts)}">`;

export function layout({ ctx, title, description, url, image, main, header, footer, overlays, bodyClass = '' }) {
  const s = ctx.settings;
  const ogImage = image ? (image.startsWith('http') ? image : `${ctx.origin}${image}`) : `${ctx.origin}/assets/og.jpg`;
  return `<!doctype html>
<html lang="en-GB">
<head>
${head(s, title, description)}
<meta property="og:title" content="${esc(title)} | ${esc(s.brand.name)}"><meta property="og:description" content="${esc(description || s.brand.tagline)}">
<meta property="og:type" content="${ctx.template === 'product' ? 'product' : 'website'}"><meta property="og:url" content="${esc(url || '')}"><meta property="og:image" content="${esc(ogImage)}"><meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(url || ctx.path)}">
<script>
  // Motion gate BEFORE first paint: hidden-until-revealed styles only apply under html.do-anim
  document.documentElement.classList.add(${s.motion.enabled ? "matchMedia('(prefers-reduced-motion: reduce)').matches ? 'prefers-reduced-motion' : 'do-anim'" : "'prefers-reduced-motion'"});
  window.theme = { routes: { cart: '/cart', cart_add: '/cart/add', cart_change: '/cart/change', cart_update: '/cart/update', search: '/search', predictive: '/search/suggest' }, money_format: '£{{amount}}', free_shipping: ${s.cart.free_shipping_threshold}, template: '${ctx.template}', page_transitions: ${!!s.motion.page_transitions}, customer: ${ctx.customer ? 'true' : 'false'} };
</script>
<style>${cssVars(s)}</style>
<link rel="stylesheet" href="/assets/theme.css">
<script type="module" src="/assets/theme.js"></script>
</head>
<body class="template-${ctx.template} ${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
<div id="page-transition-overlay" aria-hidden="true"></div>
${header}
<main id="main" tabindex="-1">${main}</main>
${footer}
${overlays}
<div class="toast" role="status" aria-live="polite" data-toast></div>
</body>
</html>`;
}

/** Checkout and order pages: no store navigation, like Shopify's hosted checkout */
export function minimalLayout({ ctx, title, main, refresh = 0 }) {
  return `<!doctype html><html lang="en-GB"><head>${head(ctx.settings, title, '')}<meta name="robots" content="noindex">${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<style>${cssVars(ctx.settings)}</style><link rel="stylesheet" href="/assets/theme.css">
<script>document.documentElement.classList.add('prefers-reduced-motion');window.theme={template:'${ctx.template}',page_transitions:false};</script><script type="module" src="/assets/theme.js"></script></head><body class="template-${ctx.template}"><main id="main">${main}</main></body></html>`;
}
