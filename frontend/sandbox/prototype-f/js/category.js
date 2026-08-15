/**
 * Prototype F · 分类页脚本（chess-clock / chess-board / stopwatch / lifestyle 共用）
 * 读取 body[data-cat] 渲染：分类 Hero（微标签 + 衬线大标题 + 标语）+ 该系列瀑布流。
 */
import { CAT_META, PRODUCTS, escapeHtml } from './mock.js';

const $ = (s) => document.querySelector(s);
const cat = document.body.dataset.cat;
const meta = CAT_META[cat];
if (!meta) {
  $('#catRoot').innerHTML = '<p class="cart-empty">Series not found ♟</p>';
} else {
const list = PRODUCTS.filter((p) => p.cat === cat);

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
              <img src="${p.img || 'assets/placeholder.svg'}" alt="${escapeHtml(p.name)}" loading="lazy">
            </span>
            <span class="m-name">${escapeHtml(p.name)}</span>
            <span class="m-meta"><span>${escapeHtml(p.desc.slice(0, 18))}…</span><span class="price">$${p.price}.00</span></span>
          </a>`).join('')}
      </div>
    </div>
  </section>`;
}

window.PF.observeReveals();
