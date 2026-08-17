/**
 * LeapShop · Product Overview 页脚本
 * 自上而下四个系列区块，每类一个小标题，瀑布流（CSS columns）呈现；
 * 点击商品图跳转 product.html?id=N 单页。商品数据来自后端 /api/products。
 */
import { CATS, CAT_META } from './data.js';
import { fetchProducts, fetchSettings, escapeHtml, money, withRatios } from './store.js';

const $ = (s) => document.querySelector(s);

const itemHtml = (p, heroIdSet) => {
  const isHero = heroIdSet.has(String(p.id));
  return `
  <a class="m-item${isHero ? ' is-hero' : ''}" href="product.html?id=${p.id}" aria-label="${escapeHtml(p.name)}">
    <span class="p-media" style="aspect-ratio:${p.ratio};">
      <img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">
    </span>
    <span class="m-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
    <span class="m-meta"><span>${escapeHtml(p.description.slice(0, 18))}…</span><span class="price">${money(p.price)}</span></span>
  </a>`;
};

Promise.all([fetchProducts(), fetchSettings().catch(() => ({}))]).then(([products, settings]) => {
  const heroIds = settings.hero_products || [];
  const heroIdSet = new Set(heroIds.map(String));
  // 系列区块按固定顺序；系列内顺序沿用后端排序（sort_weight 升序 → 上传时间倒序）
  $('#ovSecs').innerHTML = CATS.map((c) => {
    let list = products.filter((p) => p.category === c.id);
    list = withRatios(list);
    const meta = CAT_META[c.id];
    return `
    <section class="ov-sec reveal" id="${c.id}">
      <div class="ov-head">
        <span class="micro-label left solo">${escapeHtml(meta.kicker)}</span>
        <h3>${escapeHtml(meta.title)}</h3>
        <span class="ov-count">${list.length} Items</span>
      </div>
      <div class="masonry">${list.map((p) => itemHtml(p, heroIdSet)).join('')}</div>
    </section>`;
  }).join('');
}).catch(() => {
  $('#ovSecs').innerHTML = '<p class="cart-empty">Products are temporarily unavailable ♟</p>';
}).finally(() => window.PF.observeReveals());
