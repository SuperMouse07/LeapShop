/**
 * 产品详情页：左侧图片轮播 + 右侧信息（名称 / 价格 / 描述 + 颜色款式选择）
 * 路由：product.html?id=<productId>
 */
import { detectApiBase, api, renderNavUser, escapeHtml } from './api.js';

const CAT_LABEL = { 'chess-timer': 'CHESS TIMER', 'chess-set': 'CHESS SET', apparel: 'APPAREL & GEAR' };

let product = null;
let selColor = '';   // 当前选中的颜色（空 = 默认图集）
let selStyle = '';   // 当前选中的款式
let currentImages = [];
let idx = 0;

const $ = (id) => document.getElementById(id);

/** 解析查询参数中的商品 ID */
function getProductId() {
  const id = Number(new URLSearchParams(location.search).get('id'));
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** 当前颜色+款式组合命中的变体（精确 > 部分匹配） */
function activeVariant() {
  const vs = product.variants || [];
  if (!selColor && !selStyle) return null;
  return (
    vs.find((v) => selColor && v.color === selColor && selStyle && v.style === selStyle) ||
    vs.find((v) => selColor && v.color === selColor) ||
    vs.find((v) => selStyle && v.style === selStyle) ||
    null
  );
}

/** 当前轮播图集：优先变体图集，其次商品主图集 */
function activeImages() {
  const v = activeVariant();
  if (v && v.images.length) return v.images;
  return product.images || [];
}

/** 变体标签文字，如「曜石黑 · 标准版」 */
function variantLabel() {
  const v = activeVariant();
  if (!v) return '';
  return [v.color, v.style].filter(Boolean).join(' · ');
}

/* ---------- 轮播渲染（循环切换） ---------- */
function renderCarousel() {
  currentImages = activeImages();
  idx = 0;
  const stage = $('carouselStage');
  if (!currentImages.length) {
    stage.innerHTML = '<div class="pd-noimg">♟</div>';
  } else {
    stage.innerHTML = currentImages
      .map((src, i) => `<img class="${i === 0 ? 'active' : ''}" src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} ${i + 1}" />`)
      .join('');
  }
  const label = variantLabel();
  $('carouselBadge').textContent = label ? `♟ ${label}` : '';
  $('carouselBadge').classList.toggle('hidden', !label);
  renderThumbs();
  updateCounter();
}

function showAt(i) {
  if (!currentImages.length) return;
  idx = (i + currentImages.length) % currentImages.length; // 首尾循环
  $('carouselStage').querySelectorAll('img').forEach((img, k) =>
    img.classList.toggle('active', k === idx)
  );
  renderThumbs();
  updateCounter();
}

function renderThumbs() {
  const wrap = $('carouselThumbs');
  wrap.innerHTML = currentImages
    .map(
      (src, i) =>
        `<button class="pd-thumb ${i === idx ? 'active' : ''}" data-i="${i}" aria-label="Image ${i + 1}"><img src="${escapeHtml(src)}" alt="" /></button>`
    )
    .join('');
}

function updateCounter() {
  $('carouselCounter').textContent = currentImages.length
    ? `${idx + 1} / ${currentImages.length}`
    : '';
}

/* ---------- 颜色 / 款式选项 ---------- */
function renderOptions() {
  const vs = product.variants || [];
  const colors = [...new Set(vs.map((v) => v.color).filter(Boolean))];
  const styles = [...new Set(vs.map((v) => v.style).filter(Boolean))];

  $('optColorGroup').classList.toggle('hidden', !colors.length);
  $('optStyleGroup').classList.toggle('hidden', !styles.length);

  // 颜色组：始终全部可选
  $('optColors').innerHTML = colors
    .map(
      (c) =>
        `<button class="opt-chip ${c === selColor ? 'active' : ''}" data-v="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join('');

  // 款式组：与当前颜色不搭配的置灰
  $('optStyles').innerHTML = styles
    .map((s) => {
      const available = !selColor || vs.some((v) => v.color === selColor && v.style === s);
      return `<button class="opt-chip ${s === selStyle ? 'active' : ''} ${available ? '' : 'disabled'}" data-v="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
    })
    .join('');

  const picked = [selColor, selStyle].filter(Boolean).join(' · ');
  $('optSelected').innerHTML = picked
    ? `Selected: <b>${escapeHtml(picked)}</b>`
    : (colors.length || styles.length ? 'Pick your color &amp; style ♟' : '');
}

/** 选中后保证组合可用：若款式与颜色不匹配则回退到该颜色的首个款式 */
function normalizeSelection() {
  const vs = product.variants || [];
  if (selColor && selStyle && !vs.some((v) => v.color === selColor && v.style === selStyle)) {
    const first = vs.find((v) => v.color === selColor);
    selStyle = first ? first.style : '';
  }
}

/* ---------- 页面骨架 ---------- */
function renderProduct() {
  document.title = `${product.name} · LeapChess`;
  const hasOptions = (product.variants || []).length > 0;
  $('pdWrap').innerHTML = `
    <a class="pd-back" href="index.html#shop">← Back to Shop</a>
    <div class="pd-layout">
      <!-- 左侧：图片轮播 -->
      <div class="pd-gallery">
        <div class="pd-carousel">
          <div class="pd-stage" id="carouselStage"></div>
          ${'<button class="pd-arrow pd-prev" id="carouselPrev" aria-label="Previous">‹</button><button class="pd-arrow pd-next" id="carouselNext" aria-label="Next">›</button>'}
          <span class="pd-counter" id="carouselCounter"></span>
          <span class="pd-variant-badge hidden" id="carouselBadge"></span>
        </div>
        <div class="pd-thumbs" id="carouselThumbs"></div>
      </div>
      <!-- 右侧：产品信息 -->
      <div class="pd-info">
        <span class="product-cat">${CAT_LABEL[product.category] || escapeHtml(product.category)}</span>
        <h1 class="pd-name">${escapeHtml(product.name)}</h1>
        <div class="pd-price">$ ${Number(product.price).toFixed(2)}</div>
        <div class="pd-divider"></div>
        ${hasOptions ? `
        <div class="pd-options">
          <div class="opt-group hidden" id="optColorGroup">
            <span class="opt-title">♟ Color</span>
            <div class="opt-list" id="optColors"></div>
          </div>
          <div class="opt-group hidden" id="optStyleGroup">
            <span class="opt-title">♜ Style</span>
            <div class="opt-list" id="optStyles"></div>
          </div>
          <p class="opt-selected" id="optSelected"></p>
        </div>
        <div class="pd-divider"></div>` : ''}
        <div class="pd-desc">
          <span class="opt-title">Description</span>
          <p>${escapeHtml(product.description || 'No description yet.')}</p>
        </div>
        <div class="pd-actions">
          <a class="btn btn-primary" href="index.html#shop">Browse More Gear ♞</a>
        </div>
      </div>
    </div>
  `;
  bindEvents();
  renderOptions();
  renderCarousel();
}

function bindEvents() {
  $('carouselPrev').addEventListener('click', () => showAt(idx - 1));
  $('carouselNext').addEventListener('click', () => showAt(idx + 1));
  $('carouselThumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('.pd-thumb');
    if (btn) showAt(Number(btn.dataset.i));
  });
  $('optColors')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.opt-chip');
    if (!chip) return;
    selColor = selColor === chip.dataset.v ? '' : chip.dataset.v;
    normalizeSelection();
    renderOptions();
    renderCarousel();
  });
  $('optStyles')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.opt-chip');
    if (!chip || chip.classList.contains('disabled')) return;
    selStyle = selStyle === chip.dataset.v ? '' : chip.dataset.v;
    normalizeSelection();
    renderOptions();
    renderCarousel();
  });
}

function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => links.classList.toggle('open'));
}

(async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  initNav();
  await detectApiBase();
  renderNavUser();

  const id = getProductId();
  if (!id) {
    $('pdWrap').innerHTML = '<div class="loading">Invalid product link — no product id provided.</div>';
    return;
  }
  try {
    const { product: p } = await api(`/products/${id}`);
    product = p;
    renderProduct();
  } catch (err) {
    $('pdWrap').innerHTML = `<div class="loading">Failed to load product: ${escapeHtml(err.message)}<br><a href="index.html#shop">← Back to Shop</a></div>`;
  }
})();
