/**
 * LeapShop · 商品单页脚本（product.html?id=N）
 * 规范落实：左侧主图 1:1 左右滑动（scroll-snap）+ 下方详情图；
 * 右侧区块 1（标题/价格/数量/add to cart）+ 区块 2（product information 文字）。
 * 数据来自后端 /api/products/:id（images=主图集，details=详情图，info=卖点）。
 */
import { CAT_META } from './data.js';
import { fetchProduct, escapeHtml, money, PLACEHOLDER } from './store.js';

const $ = (s) => document.querySelector(s);
const id = +new URLSearchParams(location.search).get('id');
const root = $('#pdRoot');

function notFound() {
  root.innerHTML = `
    <div class="wrap pd-wrap">
      <p class="cart-empty">Product not found ♟<br>
        <a class="link-more" href="products.html"><span>Back to Product Overview</span><span class="arr">→</span></a>
      </p>
    </div>`;
}

async function init() {
  let p = null;
  try { if (id) p = await fetchProduct(id); } catch { /* 404 / 网络异常 */ }
  if (!p) { notFound(); return; }

  const meta = CAT_META[p.category] || { file: 'products.html', title: 'Products', kicker: 'Collection' };
  const main = p.images?.length ? [...p.images] : [PLACEHOLDER];
  const detail = p.details?.length ? [...p.details] : [PLACEHOLDER];
  let qty = 1;
  root.innerHTML = `
    <div class="wrap pd-wrap">
      <p class="pd-crumb">
        <a class="link-more" href="${meta.file}"><span>← ${escapeHtml(meta.title)}</span></a>
      </p>
      <div class="pd-grid">
        <div>
          <div class="pd-gallery">
            <div class="pd-main" id="pdMain" aria-label="Main images (swipe)">
              ${main.map((src) => `<img src="${src}" alt="${escapeHtml(p.name)} main image">`).join('')}
            </div>
            ${main.length > 1 ? `
            <button class="pd-arrow pd-prev" id="pdPrev" aria-label="Previous image">‹</button>
            <button class="pd-arrow pd-next" id="pdNext" aria-label="Next image">›</button>` : ''}
          </div>
          ${main.length > 1 ? '<p class="pd-swipe-hint">← Swipe · Main images 1:1 →</p>' : ''}
          <div class="pd-detail">
            ${detail.map((src) => `<img src="${src}" alt="${escapeHtml(p.name)} detail image" loading="lazy">`).join('')}
          </div>
        </div>
        <div class="pd-info">
          <span class="micro-label left solo">${escapeHtml(meta.kicker)}</span>
          <h1 class="pd-name">${escapeHtml(p.name)}</h1>
          <p class="pd-price">${money(p.price)}</p>
          <p class="pd-desc">${escapeHtml(p.description)}</p>
          <div class="pd-buy">
            <span class="stepper">
              <button id="qMinus" aria-label="Decrease quantity">−</button>
              <output id="qOut">1</output>
              <button id="qPlus" aria-label="Increase quantity">+</button>
            </span>
            <button class="btn" id="pdAdd"><span>Add to Cart</span></button>
          </div>
          <div class="pd-block2">
            <h3 class="micro-label left solo">Product Information</h3>
            ${(p.info || []).map((t) => `<p>${escapeHtml(t)}</p>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  $('#qMinus').addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#qOut').textContent = qty; });
  $('#qPlus').addEventListener('click', () => { qty = Math.min(99, qty + 1); $('#qOut').textContent = qty; });
  $('#pdAdd').addEventListener('click', () => window.PF.addToCart(p.id, qty));

  /* 主图左右箭头：平滑滚动切换一张 + 边界禁用（scroll 防抖 100ms 同步状态） */
  const mainEl = $('#pdMain');
  const prevBtn = $('#pdPrev'), nextBtn = $('#pdNext');
  if (mainEl && prevBtn && nextBtn) {
    // 以一张主图宽度 + gap 为步长，保证每次点击恰好切换一张（scroll-snap 对齐）
    const stepW = () => {
      const img = mainEl.querySelector('img');
      return img ? Math.round(img.getBoundingClientRect().width) + 12 : 300;
    };
    prevBtn.addEventListener('click', () => mainEl.scrollBy({ left: -stepW(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => mainEl.scrollBy({ left: stepW(), behavior: 'smooth' }));
    const syncArrows = () => {
      const max = mainEl.scrollWidth - mainEl.clientWidth;
      prevBtn.disabled = mainEl.scrollLeft <= 2;
      nextBtn.disabled = mainEl.scrollLeft >= max - 2;
    };
    let deb = null;
    mainEl.addEventListener('scroll', () => { clearTimeout(deb); deb = setTimeout(syncArrows, 100); });
    syncArrows();
  }
}

init().finally(() => window.PF.observeReveals());
