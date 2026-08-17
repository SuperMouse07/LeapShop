/**
 * LeapShop · 分类页脚本（chess-clock / chess-board / stopwatch / lifestyle 共用）
 * 读取 body[data-cat] 渲染：分类 Hero（微标签 + 衬线大标题 + 标语）+ 该系列瀑布流。
 * 商品数据来自后端 /api/products?category=。
 */
import { CAT_META } from './data.js';
import { fetchProducts, fetchSettings, escapeHtml, money, withRatios, PLACEHOLDER } from './store.js';

const $ = (s) => document.querySelector(s);
const cat = document.body.dataset.cat;
const meta = CAT_META[cat];

async function init() {
  if (!meta) {
    $('#catRoot').innerHTML = '<p class="cart-empty">Series not found ♟</p>';
    return;
  }
  const [all, settings] = await Promise.all([
    fetchProducts().catch(() => null),
    fetchSettings().catch(() => ({})),
  ]);
  if (all === null) {
    $('#catRoot').innerHTML = '<p class="cart-empty">Products are temporarily unavailable ♟</p>';
    return;
  }
  // 本分类的主推款置顶（后端已排好序，hero 在分类内第一位）
  const heroIds = settings.hero_products || [];
  const heroIdSet = new Set(heroIds.map(String));
  let list = all.filter((p) => p.category === cat);
  list = withRatios(list);

  $('#catRoot').innerHTML = `
  <header class="cat-hero">
    <span class="micro-label">${escapeHtml(meta.kicker)}</span>
    <h1 class="sec-title">${escapeHtml(meta.title)}</h1>
    <p class="sec-sub" style="margin:0 auto;">${escapeHtml(meta.tagline)}</p>
  </header>
  <div class="checker-band" aria-hidden="true"></div>
  <section class="section">
    <div class="wrap">
      <div class="ov-head">
        <span class="micro-label left solo">The Series</span>
        <h3>${escapeHtml(meta.title)} Collection</h3>
        <span class="ov-count">${list.length} Items</span>
      </div>
      <div class="masonry">
        ${list.map((p) => {
          const isHero = heroIdSet.has(String(p.id));
          return `
          <a class="m-item reveal${isHero ? ' is-hero' : ''}" href="product.html?id=${p.id}" aria-label="${escapeHtml(p.name)}">
            ${isHero ? '<span class="hero-badge">♕ Hero</span>' : ''}
            <span class="p-media" style="aspect-ratio:${p.ratio};">
              <img src="${p.img || PLACEHOLDER}" alt="${escapeHtml(p.name)}" loading="lazy">
            </span>
            <span class="m-name">${escapeHtml(p.name)}</span>
            <span class="m-meta"><span>${escapeHtml(p.description.slice(0, 18))}…</span><span class="price">${money(p.price)}</span></span>
          </a>`;
        }).join('')}
      </div>
    </div>
  </section>`;
}

init().finally(() => window.PF.observeReveals());
