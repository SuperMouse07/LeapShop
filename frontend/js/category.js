/**
 * LeapShop · 分类页脚本（chess-clock / chess-board / stopwatch / lifestyle 共用）
 * 读取 body[data-cat] 渲染：分类 Hero（微标签 + 衬线大标题 + 标语）+ 该系列瀑布流。
 * 商品数据来自后端 /api/products?category=。
 */
import { CAT_META } from './data.js';
import { fetchProducts, escapeHtml, money, withRatios, PLACEHOLDER } from './store.js';

const $ = (s) => document.querySelector(s);
const cat = document.body.dataset.cat;
const meta = CAT_META[cat];

async function init() {
  if (!meta) {
    $('#catRoot').innerHTML = '<p class="cart-empty">Series not found ♟</p>';
    return;
  }
  const all = await fetchProducts().catch(() => null);
  if (all === null) {
    $('#catRoot').innerHTML = '<p class="cart-empty">Products are temporarily unavailable ♟</p>';
    return;
  }
  // 系列内顺序沿用后端排序（sort_weight 升序 → 上传时间倒序）
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
        ${list.map((p) => `
          <a class="m-item reveal" href="product.html?id=${p.id}" aria-label="${escapeHtml(p.name)}">
            <span class="p-media" style="aspect-ratio:${p.ratio};">
              <img src="${p.img || PLACEHOLDER}" alt="${escapeHtml(p.name)}" loading="lazy">
            </span>
            <span class="m-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
            <span class="m-meta"><span>${escapeHtml(p.description.slice(0, 18))}…</span><span class="price">${money(p.price)}</span></span>
          </a>`).join('')}
      </div>
    </div>
  </section>`;
}

init().finally(() => window.PF.observeReveals());
