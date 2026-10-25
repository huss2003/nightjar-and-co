// ---------------------------------------------------------------------------
// Placeholder imagery, generated as SVG so the skeleton needs no photos.
//   /img/product/:id/:n.svg   n=0 front, 1 alt (hover image), 2 fabric, 3 detail
//   /img/lifestyle/:name.svg  hero / editorial scenes
//   /img/giftbox/:n.svg       gift box
// Swap these for real photography: product images come from product.images[].src
// ---------------------------------------------------------------------------
import { byId, PRINTS, PRODUCTS } from './catalog.js';

const rng = (seed) => { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

/** <pattern> definition for a print. Tile size ~ 60–120 units. */
export function patternDef(id, kind, [bg, fg, ac], scale = 1) {
  const t = (n) => n * scale;
  const tiles = {
    gingham: `<rect width="${t(60)}" height="${t(60)}" fill="${bg}"/><rect width="${t(30)}" height="${t(60)}" fill="${fg}" opacity=".45"/><rect width="${t(60)}" height="${t(30)}" fill="${fg}" opacity=".45"/>`,
    stripe: `<rect width="${t(60)}" height="${t(60)}" fill="${bg}"/><rect width="${t(14)}" height="${t(60)}" fill="${fg}"/><rect x="${t(30)}" width="${t(5)}" height="${t(60)}" fill="${ac}"/>`,
    dots: `<rect width="${t(60)}" height="${t(60)}" fill="${bg}"/><circle cx="${t(15)}" cy="${t(15)}" r="${t(6)}" fill="${fg}"/><circle cx="${t(45)}" cy="${t(45)}" r="${t(6)}" fill="${ac}"/>`,
    spots: `<rect width="${t(90)}" height="${t(90)}" fill="${bg}"/><path d="M${t(20)} ${t(18)}c${t(10)}-${t(8)} ${t(22)} 0 ${t(16)} ${t(10)}s-${t(20)} ${t(8)}-${t(16)}-${t(10)}z" fill="${fg}"/><path d="M${t(60)} ${t(55)}c${t(12)}-${t(6)} ${t(20)} ${t(6)} ${t(12)} ${t(14)}s-${t(22)} ${t(2)}-${t(12)}-${t(14)}z" fill="${fg}"/><circle cx="${t(70)}" cy="${t(20)}" r="${t(4)}" fill="${ac}"/><circle cx="${t(25)}" cy="${t(70)}" r="${t(4)}" fill="${ac}"/>`,
    stars: `<rect width="${t(100)}" height="${t(100)}" fill="${bg}"/><path d="M${t(25)} ${t(10)}l${t(4)} ${t(10)} ${t(10)} ${t(1)}-${t(8)} ${t(7)} ${t(3)} ${t(10)}-${t(9)}-${t(6)}-${t(9)} ${t(6)} ${t(3)}-${t(10)}-${t(8)}-${t(7)} ${t(10)}-${t(1)}z" fill="${fg}"/><path d="M${t(78)} ${t(55)}a${t(16)} ${t(16)} 0 1 0 ${t(4)} ${t(28)} ${t(12)} ${t(12)} 0 1 1-${t(4)}-${t(28)}z" fill="${fg}"/><circle cx="${t(60)}" cy="${t(20)}" r="${t(2)}" fill="${ac}"/><circle cx="${t(15)}" cy="${t(75)}" r="${t(2)}" fill="${ac}"/>`,
    feather: `<rect width="${t(80)}" height="${t(120)}" fill="${bg}"/><ellipse cx="${t(40)}" cy="${t(50)}" rx="${t(22)}" ry="${t(40)}" fill="${fg}"/><ellipse cx="${t(40)}" cy="${t(45)}" rx="${t(11)}" ry="${t(16)}" fill="${ac}"/><circle cx="${t(40)}" cy="${t(45)}" r="${t(6)}" fill="${bg}"/><path d="M${t(40)} ${t(90)}v${t(30)}" stroke="${fg}" stroke-width="${t(2)}"/>`,
    floral: `<rect width="${t(100)}" height="${t(100)}" fill="${bg}"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${t(30)}" cy="${t(18)}" rx="${t(7)}" ry="${t(13)}" fill="${fg}" transform="rotate(${a} ${t(30)} ${t(30)})"/>`).join('')}<circle cx="${t(30)}" cy="${t(30)}" r="${t(6)}" fill="${ac}"/><path d="M${t(65)} ${t(70)}q${t(15)}-${t(20)} ${t(30)} 0q-${t(15)} ${t(20)}-${t(30)} 0z" fill="${ac}"/><circle cx="${t(80)}" cy="${t(25)}" r="${t(5)}" fill="${fg}" opacity=".7"/>`,
    fruit: `<rect width="${t(90)}" height="${t(90)}" fill="${bg}"/><path d="M${t(25)} ${t(20)}c${t(-12)} ${t(10)}-${t(12)} ${t(34)} ${t(3)} ${t(34)}s${t(15)}-${t(24)} ${t(3)}-${t(34)}c-${t(2)}-${t(3)}-${t(4)}-${t(3)}-${t(6)} 0z" fill="${fg}"/><path d="M${t(27)} ${t(18)}l${t(6)}-${t(8)}" stroke="${ac}" stroke-width="${t(3)}"/><path d="M${t(70)} ${t(55)}c${t(-12)} ${t(10)}-${t(12)} ${t(34)} ${t(3)} ${t(34)}s${t(15)}-${t(24)} ${t(3)}-${t(34)}c-${t(2)}-${t(3)}-${t(4)}-${t(3)}-${t(6)} 0z" fill="${fg}"/><ellipse cx="${t(75)}" cy="${t(52)}" rx="${t(7)}" ry="${t(3)}" fill="${ac}"/>`,
    cherry: `<rect width="${t(80)}" height="${t(80)}" fill="${bg}"/><circle cx="${t(22)}" cy="${t(40)}" r="${t(9)}" fill="${fg}"/><circle cx="${t(40)}" cy="${t(44)}" r="${t(9)}" fill="${fg}"/><path d="M${t(22)} ${t(31)}q${t(10)}-${t(22)} ${t(20)}-${t(24)}M${t(40)} ${t(35)}q${t(0)}-${t(18)} ${t(2)}-${t(26)}" stroke="${ac}" stroke-width="${t(2)}" fill="none"/><ellipse cx="${t(50)}" cy="${t(12)}" rx="${t(9)}" ry="${t(4)}" fill="${ac}"/>`,
    toile: `<rect width="${t(120)}" height="${t(120)}" fill="${bg}"/><path d="M${t(20)} ${t(90)}c${t(10)}-${t(40)} ${t(30)}-${t(50)} ${t(40)}-${t(70)}M${t(40)} ${t(50)}q${t(15)}-${t(5)} ${t(20)}-${t(18)}M${t(32)} ${t(70)}q-${t(14)}-${t(4)}-${t(18)}-${t(16)}" stroke="${fg}" stroke-width="${t(2.5)}" fill="none"/><circle cx="${t(62)}" cy="${t(28)}" r="${t(7)}" fill="none" stroke="${fg}" stroke-width="${t(2)}"/><path d="M${t(80)} ${t(100)}h${t(30)}l-${t(6)}-${t(16)}h-${t(18)}z" fill="${ac}"/>`,
    moth: `<rect width="${t(110)}" height="${t(110)}" fill="${bg}"/><g transform="translate(${t(30)} ${t(30)}) rotate(-12)"><path d="M0 0c${t(-14)}-${t(16)}-${t(30)}-${t(8)}-${t(22)} ${t(6)}c${t(6)} ${t(8)} ${t(16)} ${t(4)} ${t(22)}-${t(6)}z" fill="${fg}"/><path d="M0 0c${t(14)}-${t(16)} ${t(30)}-${t(8)} ${t(22)} ${t(6)}c-${t(6)} ${t(8)}-${t(16)} ${t(4)}-${t(22)}-${t(6)}z" fill="${fg}"/><path d="M0 0c-${t(10)} ${t(4)}-${t(16)} ${t(16)}-${t(8)} ${t(18)}c${t(4)} 0 ${t(7)}-${t(8)} ${t(8)}-${t(18)}zM0 0c${t(10)} ${t(4)} ${t(16)} ${t(16)} ${t(8)} ${t(18)}c-${t(4)} 0-${t(7)}-${t(8)}-${t(8)}-${t(18)}z" fill="${ac}"/><ellipse cx="0" cy="${t(4)}" rx="${t(2)}" ry="${t(9)}" fill="${bg}" opacity=".7"/></g><path d="M${t(84)} ${t(70)}a${t(11)} ${t(11)} 0 1 0 ${t(4)} ${t(19)} ${t(8)} ${t(8)} 0 1 1-${t(4)}-${t(19)}z" fill="${ac}"/><circle cx="${t(78)}" cy="${t(22)}" r="${t(1.8)}" fill="${fg}"/><circle cx="${t(16)}" cy="${t(86)}" r="${t(1.6)}" fill="${fg}"/><circle cx="${t(56)}" cy="${t(100)}" r="${t(1.2)}" fill="${ac}"/>`,
    patch: `<rect width="${t(80)}" height="${t(80)}" fill="${bg}"/><rect width="${t(40)}" height="${t(40)}" fill="${fg}" opacity=".6"/><rect x="${t(40)}" y="${t(40)}" width="${t(40)}" height="${t(40)}" fill="${ac}" opacity=".55"/><circle cx="${t(60)}" cy="${t(20)}" r="${t(8)}" fill="${fg}"/><path d="M${t(10)} ${t(60)}h${t(20)}" stroke="${ac}" stroke-width="${t(3)}"/>`,
  };
  const size = { moth: 110, gingham: 60, stripe: 60, dots: 60, spots: 90, stars: 100, feather: 80, floral: 100, fruit: 90, cherry: 80, toile: 120, patch: 80 }[kind] || 60;
  const h = kind === 'feather' ? 120 : size;
  return `<pattern id="${id}" width="${t(size)}" height="${t(h)}" patternUnits="userSpaceOnUse">${tiles[kind] || tiles.dots}</pattern>`;
}

// ---------------------------------------------------------------------------
// Product art: flat-lay garment illustrations drawn from each product's print,
// so every product (including ones created in the admin) gets consistent images.
//   n=0 flat lay · n=1 folded with swing tag (hover image) · n=2 fabric close-up · n=3 collar detail
// ---------------------------------------------------------------------------
const G = {
  // shirt, local box 520×440, long sleeves
  shirt: 'M200 10 L130 30 L20 236 L92 270 L142 165 L136 440 L384 440 L378 165 L428 270 L500 236 L390 30 L320 10 Q260 62 200 10 Z',
  shirtShort: 'M200 10 L130 30 L62 128 L124 168 L144 140 L136 420 L384 420 L376 140 L396 168 L458 128 L390 30 L320 10 Q260 62 200 10 Z',
  lapelL: 'M200 10 L258 120 L214 98 L176 42 Z', lapelR: 'M320 10 L262 120 L306 98 L344 42 Z',
  trousers: (h) => `M40 0 L320 0 L344 ${h} L208 ${h} L180 ${Math.min(180, h * 0.4)} L152 ${h} L16 ${h} Z`,
  dress: 'M196 10 L134 32 L52 178 L110 210 L156 150 L118 900 L402 900 L364 150 L410 210 L468 178 L386 32 L324 10 Q260 58 196 10 Z',
  robe: 'M170 20 L350 20 L560 130 L512 330 L440 270 L452 900 L68 900 L80 270 L8 330 L-40 130 Z',
  mask: 'M20 120 Q260 -40 500 120 Q520 250 410 280 Q330 300 260 240 Q190 300 110 280 Q0 250 20 120 Z',
  bag: 'M30 40 L490 40 Q520 40 520 70 L520 330 Q520 360 490 360 L30 360 Q0 360 0 330 L0 70 Q0 40 30 40 Z',
};
const PAPERS = ['#efe8e1', '#e9e4ec', '#ece6dc', '#e5e9e6', '#efe6e6'];
const shadow = (d, dx = 10, dy = 16) => `<path d="${d}" fill="#2a2238" opacity=".14" transform="translate(${dx} ${dy})" filter="url(#soft)"/>`;
const piece = (d, pid, pipe, extra = '') => `${shadow(d)}<path d="${d}" fill="url(#${pid})"/><path d="${d}" fill="url(#shade)"/><path d="${d}" fill="none" stroke="${pipe}" stroke-width="7" stroke-linejoin="round"/>${extra}`;

function shirtSVG(pid, [bg, fg, ac], { short = false } = {}) {
  const body = short ? G.shirtShort : G.shirt, hem = short ? 420 : 440;
  const buttons = [168, 238, 308, 378].filter((y) => y < hem - 20).map((y) => `<circle cx="260" cy="${y}" r="9" fill="${bg}" stroke="${fg}" stroke-width="3"/><circle cx="257" cy="${y - 2}" r="1.6" fill="${fg}"/><circle cx="263" cy="${y + 2}" r="1.6" fill="${fg}"/>`).join('');
  return piece(body, pid, ac, `
    <path d="M260 120 L260 ${hem}" stroke="${ac}" stroke-width="5"/>
    <rect x="296" y="168" width="58" height="66" fill="url(#${pid})" stroke="${ac}" stroke-width="4"/><path d="M296 176 h58" stroke="${ac}" stroke-width="7"/>
    ${short ? '' : `<path d="M22 238 L90 272" stroke="${ac}" stroke-width="12"/><path d="M498 238 L430 272" stroke="${ac}" stroke-width="12"/>`}
    <path d="${G.lapelL}" fill="url(#${pid})" stroke="${ac}" stroke-width="6" stroke-linejoin="round"/><path d="${G.lapelR}" fill="url(#${pid})" stroke="${ac}" stroke-width="6" stroke-linejoin="round"/>
    ${buttons}`);
}
function trousersSVG(pid, [bg, fg, ac], h) {
  const d = G.trousers(h);
  return piece(d, pid, ac, `<rect x="40" y="0" width="280" height="34" fill="url(#${pid})" stroke="${ac}" stroke-width="5"/>
    ${[70, 110, 150, 210, 250, 290].map((x) => `<path d="M${x} 4 v26" stroke="${fg}" stroke-width="2" opacity=".35"/>`).join('')}
    <path d="M180 34 q-30 30 -46 54 M180 34 q30 30 46 54" stroke="${ac}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M16 ${h - 4} L152 ${h - 4} M208 ${h - 4} L344 ${h - 4}" stroke="${ac}" stroke-width="12"/>`);
}

function garment(cut, pid, colors) {
  const set = (short, h, sx = 1, sy = 1) => `<g transform="translate(270 ${short ? 540 : 520}) rotate(-3 180 280)">${trousersSVG(pid, colors, h)}</g>
    <g transform="translate(${190 - (sx - 1) * 260} 110) rotate(2 260 220) scale(${sx} ${sy})">${shirtSVG(pid, colors, { short })}</g>`;
  switch (cut) {
    case 'Short': return set(true, 270);
    case 'Capri': return set(false, 430);
    case 'Boxy': return set(false, 560, 1.1, 0.92);
    case 'Oversized': return set(false, 580, 1.14, 1.04);
    case 'Nightdress': return `<g transform="translate(190 120) scale(1 1.06)">${piece(G.dress, pid, colors[2], `<path d="M260 118 L260 330" stroke="${colors[2]}" stroke-width="5"/>${[170, 230, 290].map((y) => `<circle cx="260" cy="${y}" r="9" fill="${colors[0]}" stroke="${colors[1]}" stroke-width="3"/>`).join('')}<path d="${G.lapelL}" fill="url(#${pid})" stroke="${colors[2]}" stroke-width="6"/><path d="${G.lapelR}" fill="url(#${pid})" stroke="${colors[2]}" stroke-width="6"/><path d="M120 892 L400 892" stroke="${colors[2]}" stroke-width="14"/>`)}</g>`;
    case 'Robe': return `<g transform="translate(190 150) scale(.95)">${piece(G.robe, pid, colors[2], `<path d="M170 20 L250 470 L330 20" fill="none" stroke="${colors[2]}" stroke-width="26" stroke-linejoin="round"/><path d="M250 470 L250 900" stroke="${colors[2]}" stroke-width="10"/><rect x="70" y="440" width="380" height="38" fill="${colors[2]}"/><path d="M250 470 q-40 120 -90 210 M250 470 q30 130 70 200" stroke="${colors[2]}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M-36 132 L10 330 M556 132 L510 330" stroke="${colors[2]}" stroke-width="16"/>`)}</g>`;
    case 'Eye Mask': return `<g transform="translate(190 440)"><path d="M10 140 C -120 130 -150 330 40 380 M510 140 C 640 130 670 330 480 380" stroke="${colors[2]}" stroke-width="16" fill="none" opacity=".9"/>${piece(G.mask, pid, colors[2], `<path d="M60 150 Q260 40 460 150" stroke="${colors[2]}" stroke-width="4" fill="none" stroke-dasharray="2 14" stroke-linecap="round"/>`)}</g>`;
    case 'Wash Bag': return `<g transform="translate(190 420)">${piece(G.bag, pid, colors[2], `<path d="M20 80 L500 80" stroke="${colors[1]}" stroke-width="10" stroke-dasharray="4 6"/><rect x="420" y="66" width="22" height="70" rx="6" fill="${colors[2]}"/><circle cx="431" cy="128" r="5" fill="${colors[0]}"/><path d="M500 240 q60 0 70 50 q-10 40 -60 30" stroke="${colors[2]}" stroke-width="12" fill="none"/>`)}</g>`;
    default: return set(false, 560);
  }
}

function folded(cut, pid, [bg, fg, ac]) {
  const fold = (x, y, w, h, rot, collar) => `<g transform="translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2})">${shadow(`M0 0 H${w} V${h} H0 Z`, 12, 18)}
    <rect width="${w}" height="${h}" rx="8" fill="url(#${pid})"/><rect width="${w}" height="${h}" rx="8" fill="url(#shade)"/><rect width="${w}" height="${h}" rx="8" fill="none" stroke="${ac}" stroke-width="6"/>
    <path d="M14 ${h * 0.5} H${w - 14}" stroke="#000" stroke-opacity=".08" stroke-width="10"/>
    ${collar ? `<path d="M${w / 2 - 90} 0 L${w / 2} 110 L${w / 2 + 90} 0" fill="url(#${pid})" stroke="${ac}" stroke-width="6" stroke-linejoin="round"/><circle cx="${w / 2}" cy="150" r="10" fill="${bg}" stroke="${fg}" stroke-width="3"/><circle cx="${w / 2}" cy="230" r="10" fill="${bg}" stroke="${fg}" stroke-width="3"/>` : ''}</g>`;
  const tag = `<g transform="translate(600 300) rotate(12)"><path d="M0 0 C -40 -60 -80 -40 -120 -10" stroke="#9d8fa8" stroke-width="3" fill="none"/><rect x="-10" y="0" width="120" height="170" rx="10" fill="#fbf9f6" stroke="#d6cbe0" stroke-width="3"/><circle cx="50" cy="22" r="8" fill="none" stroke="#9d8fa8" stroke-width="3"/>
    <path d="M58 64a22 22 0 1 0 10 38 26 26 0 0 1 -10 -38z" fill="#2a2238"/><path d="M14 132 h72 M24 148 h52" stroke="#b9a0cf" stroke-width="5" stroke-linecap="round"/></g>`;
  const single = ['Nightdress', 'Robe'].includes(cut);
  const small = ['Eye Mask', 'Wash Bag'].includes(cut);
  if (small) return `${fold(220, 420, 460, 320, -4, false)}${tag}`;
  return `${single ? '' : fold(170, 640, 520, 330, 4, false)}${fold(190, 270, 520, 420, -3, true)}${tag}`;
}

export function productSVG(id, n) {
  const p = byId.get(Number(id));
  if (!p) return null;
  const { colors, pattern, cut } = p.metafields.custom;
  const paper = PAPERS[Number(String(id).slice(-3)) % PAPERS.length];
  const pid = `p${id}${n}`;
  const defs = (scale) => `<defs>${patternDef(pid, pattern, colors, scale)}<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a2238" stop-opacity=".12"/></radialGradient></defs>`;
  const back = `<rect width="900" height="1200" fill="${paper}"/><rect width="900" height="1200" fill="url(#vig)"/>`;
  if (n === 2) return svg(`${defs(3.2)}<rect width="900" height="1200" fill="url(#${pid})"/><path d="M-50 380 C 250 300 500 520 960 420 L960 520 C 520 620 260 400 -50 480Z" fill="#000" opacity=".07"/><path d="M-50 820 C 300 760 520 920 960 840 L960 900 C 520 980 300 820 -50 880Z" fill="#fff" opacity=".1"/><rect width="900" height="1200" fill="url(#shade)"/>`);
  if (n === 3) return svg(`${defs(1.6)}${back}<g transform="translate(-520 -180) scale(2.6)">${garment(cut, pid, colors)}</g>`);
  const zoom = (inner, k) => `<g transform="translate(450 600) scale(${k}) translate(-450 -600)">${inner}</g>`;
  if (n === 1) return svg(`${defs(1)}${back}${zoom(folded(cut, pid, colors), 1.1)}`);
  return svg(`${defs(1)}${back}${zoom(garment(cut, pid, colors), ['Eye Mask', 'Wash Bag'].includes(cut) ? 1.3 : ['Oversized', 'Boxy'].includes(cut) ? 0.98 : 1.08)}`);
}

const SHAPES = { set: G.shirt, short: G.shirtShort, dress: G.dress, robe: G.robe, mask: G.mask, bag: G.bag, box: 'M200 420 L700 420 L700 940 L200 940 Z' };
const shapeFor = (cut) => ({ Nightdress: 'dress', Robe: 'robe', 'Eye Mask': 'mask', 'Wash Bag': 'bag', 'Gift Box': 'box', Short: 'short' }[cut] || 'set');

export function lifestyleSVG(name) {
  // FNV-1a hash → good spread so each image name gets its own print
  const r = rng([...name].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261));
  const print = PRINTS[Math.floor(r() * PRINTS.length)];
  const pid = `l${name.replace(/\W/g, '')}`;
  const wide = /hero|slide|banner/.test(name);
  const [w, h] = wide ? [1920, 1080] : [1000, 1250];
  return svg(`<defs>${patternDef(pid, print.pattern, print.colors, wide ? 2.4 : 1.8)}
    <linearGradient id="g${pid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#${pid})"/>
    <rect width="${w}" height="${h}" fill="${print.colors[0]}" opacity=".25"/>
    <circle cx="${w * (0.25 + r() * 0.5)}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.28}" fill="#fff" opacity=".18"/>
    <rect width="${w}" height="${h}" fill="url(#g${pid})"/>`, w, h);
}

export function giftboxSVG(n) {
  const print = PRINTS[0];
  return svg(`<defs>${patternDef('gb', 'moth', print.colors, 1.1)}</defs>
    <rect width="900" height="1200" fill="${n ? '#e9e1ee' : '#efe8f3'}"/><ellipse cx="450" cy="960" rx="320" ry="30" fill="#000" opacity=".08"/>
    <g transform="rotate(${n ? -8 : 0} 450 650)"><rect x="200" y="460" width="500" height="480" rx="6" fill="url(#gb)" stroke="#4b3358" stroke-width="5"/>
    <rect x="180" y="400" width="540" height="90" rx="6" fill="#cdb8dd" stroke="#4b3358" stroke-width="5"/>
    <rect x="425" y="400" width="50" height="540" fill="#4b3358"/>
    <path d="M450 400 q-90 -110 -150 -40 q40 40 150 40 q110 0 150 -40 q-60 -70 -150 40z" fill="#4b3358"/>
    <rect x="520" y="560" width="150" height="96" rx="4" fill="#fbf9f6" transform="rotate(6 595 608)"/><path d="M540 590h104M540 612h84M540 634h64" stroke="#b9a0cf" stroke-width="5" stroke-linecap="round" transform="rotate(6 595 608)"/></g>`);
}

function svg(body, w = 900, h = 1200) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>${body}</svg>`;
}

/** Flat lay for the homepage "shop the print" section: three pieces of one print laid on a linen sheet.
 *  Positions match FLATLAY_SPOTS in theme/sections/home.js so the hotspots sit on the garments. */
export function flatlaySVG(printSlug) {
  const print = PRINTS.find((p) => p.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-') === printSlug) || PRINTS[0];
  const items = PRODUCTS.filter((p) => p.metafields.custom?.print === print.name);
  const pick = [items.find((p) => /Pyjama|Set/.test(p.title)), items.find((p) => p.metafields.custom.audience !== 'accessories' && !/Pyjama|Set/.test(p.title)) || items.find((p) => ['kids', 'mens'].includes(p.metafields.custom.audience)), items.find((p) => p.metafields.custom.audience === 'accessories')];
  const chosen = [...new Set(pick.filter(Boolean))];
  for (const p of items) if (chosen.length < 3 && !chosen.includes(p)) chosen.push(p);
  const spots = [[30, 42, -8, .78], [72, 40, 7, .66], [56, 82, -6, .5]];
  const pid = 'fl';
  const pieces = chosen.slice(0, 3).map((p, i) => {
    const [x, y, rot, sc] = spots[i];
    return `<g transform="translate(${x * 12 - 450 * sc} ${y * 12 - 650 * sc}) rotate(${rot} ${450 * sc} ${650 * sc}) scale(${sc})">${garment(p.metafields.custom.cut, pid, print.colors)}</g>`;
  }).join('');
  return svg(`<defs>${patternDef(pid, print.pattern, print.colors, 0.9)}<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#ece5dc"/><path d="M0 4h8M4 0v8" stroke="#e2d9ce" stroke-width="1"/></pattern></defs>
    <rect width="1200" height="1200" fill="url(#weave)"/>
    <path d="M0 860 C 300 820 600 900 1200 840 L1200 1200 L0 1200Z" fill="#e4dbd0" opacity=".6"/>
    <circle cx="1050" cy="150" r="70" fill="#f4efe6"/><circle cx="1050" cy="150" r="70" fill="none" stroke="#d9cfc2" stroke-width="3"/>
    <path d="M120 1080 q40 -60 90 -10" stroke="#9d8fa8" stroke-width="4" fill="none"/>
    ${pieces}`, 1200, 1200);
}
