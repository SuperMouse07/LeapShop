/**
 * Prototype F · Product Overview 页脚本
 * 自上而下四个系列区块，每类一个小标题，瀑布流（CSS columns）呈现；
 * 点击商品图跳转 product.html?id=N 单页。
 */
import { CATS, CAT_META, PRODUCTS, escapeHtml } from './mock.js';

const $ = (s) => document.querySelector(s);

const itemHtml = (p) => `
  <a class="m-item" href="product.html?id=${p.id}" aria-label="${escapeHtml(p.name)}">
    <span class="p-media" style="aspect-ratio:${p.ratio};">
      <img src="${p.img || 'assets/placeholder.svg'}" alt="${escapeHtml(p.name)}" loading="lazy">
    </span>
    <span class="m-name">${escapeHtml(p.name)}</span>
    <span class="m-meta"><span>${escapeHtml(p.desc.slice(0, 18))}…</span><span class="price">$${p.price}.00</span></span>
  </a>`;

$('#ovSecs').innerHTML = CATS.map((c) => {
  const list = PRODUCTS.filter((p) => p.cat === c.id);
  const meta = CAT_META[c.id];
  return `
    <section class="ov-sec reveal" id="${c.id}">
      <div class="ov-head">
        <span class="micro-label left solo">${escapeHtml(meta.kicker)}</span>
        <h3>${escapeHtml(meta.title)}</h3>
        <span class="ov-count">${list.length} Items</span>
      </div>
      <div class="masonry">${list.map(itemHtml).join('')}</div>
    </section>`;
}).join('');

window.PF.observeReveals();
