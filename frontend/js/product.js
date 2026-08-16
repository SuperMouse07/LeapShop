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

/* ================= 悬停放大镜（圆形透镜跟随鼠标） ================= */
const LENS_SIZE = 200;   // 透镜直径 px
const LENS_ZOOM = 2.5;   // 放大倍率
let lensEl = null, lensRaf = 0, lensEvt = null;

/** 触屏 / ≤768px 禁用悬停放大镜 */
function hoverEnabled() {
  return window.matchMedia('(hover: hover)').matches && !window.matchMedia('(max-width: 768px)').matches;
}

function hideLens() {
  if (lensEl) lensEl.classList.remove('on');
}

/* 仅在 rAF 帧内更新位置与 background-position，避免 mousemove 高频重绘 */
function lensPaint() {
  lensRaf = 0;
  const e = lensEvt;
  if (!lensEl || !e || !lensEl.classList.contains('on')) return;
  const r = e.target.getBoundingClientRect();
  const px = Math.min(Math.max(e.clientX - r.left, 0), r.width);
  const py = Math.min(Math.max(e.clientY - r.top, 0), r.height);
  lensEl.style.left = `${e.clientX - LENS_SIZE / 2}px`;
  lensEl.style.top = `${e.clientY - LENS_SIZE / 2}px`;
  lensEl.style.backgroundImage = `url("${e.target.currentSrc || e.target.src}")`;
  lensEl.style.backgroundSize = `${r.width * LENS_ZOOM}px ${r.height * LENS_ZOOM}px`;
  lensEl.style.backgroundPosition = `${LENS_SIZE / 2 - px * LENS_ZOOM}px ${LENS_SIZE / 2 - py * LENS_ZOOM}px`;
}

function setupZoomLens(imgs) {
  imgs.forEach((img) => {
    img.addEventListener('mouseenter', (e) => {
      if (!hoverEnabled()) return;
      if (!lensEl) {
        lensEl = document.createElement('div');
        lensEl.className = 'pd-lens';
        lensEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(lensEl);
      }
      lensEvt = e;
      lensEl.classList.add('on');
      if (!lensRaf) lensRaf = requestAnimationFrame(lensPaint);
    });
    img.addEventListener('mousemove', (e) => {
      if (!lensEl || !lensEl.classList.contains('on')) return;
      lensEvt = e;
      if (!lensRaf) lensRaf = requestAnimationFrame(lensPaint);
    });
    img.addEventListener('mouseleave', hideLens);
  });
  // 页面滚动 / 窗口缩放时立即隐藏，避免透镜滞留错位
  document.addEventListener('scroll', hideLens, true);
  window.addEventListener('resize', hideLens);
}

/* ================= Lightbox 全屏查看器 ================= */
let lbEl = null, lbSeq = [], lbIdx = 0, lbLastFocus = null;

function buildLightbox() {
  lbEl = document.createElement('div');
  lbEl.className = 'pd-lightbox';
  lbEl.setAttribute('role', 'dialog');
  lbEl.setAttribute('aria-modal', 'true');
  lbEl.setAttribute('aria-label', 'Fullscreen image viewer');
  lbEl.innerHTML = `
    <button class="lb-close" type="button" aria-label="Close viewer (Esc)">×</button>
    <button class="lb-arrow lb-prev" type="button" aria-label="Previous image">‹</button>
    <figure class="lb-stage"><img class="lb-img" alt="Product image enlarged view" /></figure>
    <button class="lb-arrow lb-next" type="button" aria-label="Next image">›</button>
    <p class="lb-count" aria-live="polite"></p>`;
  lbEl.addEventListener('click', (e) => { if (e.target === lbEl) closeLightbox(); }); // 点击遮罩关闭
  lbEl.querySelector('.lb-close').addEventListener('click', closeLightbox);
  lbEl.querySelector('.lb-prev').addEventListener('click', () => lbShow(lbIdx - 1));
  lbEl.querySelector('.lb-next').addEventListener('click', () => lbShow(lbIdx + 1));
  document.body.appendChild(lbEl);
  document.addEventListener('keydown', (e) => {
    if (!lbEl || !lbEl.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
    else if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
    else if (e.key === 'Tab') { // 焦点圈定在查看器内
      const items = [...lbEl.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  });
}

/* 切换图片：先淡出再加载，懒预载相邻两张保证切换即时 */
function lbShow(i) {
  lbIdx = ((i % lbSeq.length) + lbSeq.length) % lbSeq.length;
  const img = lbEl.querySelector('.lb-img');
  img.style.opacity = '0';
  const loader = new Image();
  const apply = () => { img.src = lbSeq[lbIdx]; img.style.opacity = '1'; };
  loader.addEventListener('load', apply);
  loader.addEventListener('error', apply);
  loader.src = lbSeq[lbIdx];
  lbEl.querySelector('.lb-count').textContent = `${lbIdx + 1} / ${lbSeq.length}`;
  [lbIdx + 1, lbIdx - 1].forEach((j) => { const pre = new Image(); pre.src = lbSeq[(j + lbSeq.length) % lbSeq.length]; });
}

function openLightbox(i) {
  if (!lbSeq.length) return;
  if (!lbEl) buildLightbox();
  hideLens();
  lbLastFocus = document.activeElement;
  lbEl.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbShow(i);
  lbEl.querySelector('.lb-close').focus();
}

function closeLightbox() {
  if (!lbEl) return;
  lbEl.classList.remove('open');
  document.body.style.overflow = '';
  if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
}

/* 图片点击 → 全屏；主图 + 详情图组成统一浏览序列 */
function setupImageClicks(mainImgs, detailImgs) {
  let downX = 0, downY = 0;
  document.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; }, true);
  const bind = (img, i) => {
    img.setAttribute('role', 'button');
    img.tabIndex = 0;
    img.addEventListener('click', (e) => {
      if (e.detail === 0) return; // 键盘触发由 keydown 处理
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return; // 滑动拖拽不触发
      openLightbox(i);
    });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(i); }
    });
  };
  mainImgs.forEach((img, i) => bind(img, i));
  detailImgs.forEach((img, i) => bind(img, mainImgs.length + i));
  lbSeq = [...mainImgs, ...detailImgs].map((img) => img.currentSrc || img.src);
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

  /* 悬停放大镜 + Lightbox：主图与详情图共用同一浏览序列 */
  const mainImgs = mainEl ? [...mainEl.querySelectorAll('img')] : [];
  const detailImgs = [...root.querySelectorAll('.pd-detail img')];
  setupZoomLens([...mainImgs, ...detailImgs]);
  setupImageClicks(mainImgs, detailImgs);
}

init().finally(() => window.PF.observeReveals());
