/**
 * 沙箱演示数据与渲染逻辑（纯静态 · 零 API 调用）
 * ------------------------------------------------------------
 * - 商品数据为内嵌 mock 数据，仅用于 UI 设计验证，非真实数据
 * - 本文件自包含实现 escapeHtml 等工具，禁止引用 ../../js/api.js
 * - 禁止 fetch / XHR，禁止读写 lc_token / lc_user
 * - 合并回主站时必须替换为 api.js 的 api() 封装与真实 /api/products 数据
 */

const CAT_ICON = { 'chess-timer': '⏱', 'chess-set': '♟', apparel: '♞' };
const CAT_LABEL = { 'chess-timer': 'CHESS TIMER', 'chess-set': 'CHESS SET', apparel: 'APPAREL & GEAR' };

/* ---------------- 演示数据（mock） ---------------- */
const PRODUCTS = [
  {
    id: 1,
    name: 'Leap Pro Tournament Clock',
    category: 'chess-timer',
    price: 89.99,
    description: 'FIDE-certified tournament clock with 39 timing modes and millisecond precision.',
    image: 'assets/placeholder.svg',
    tag: 'FIDE Certified',
  },
  {
    id: 2,
    name: 'Leap Club Trainer Clock',
    category: 'chess-timer',
    price: 45.5,
    description: 'Entry-level training clock with drop-resistant body and long-life battery.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 3,
    name: 'Grandmaster Wooden Chess Set',
    category: 'chess-set',
    price: 129.0,
    description: 'Hand-finished wooden pieces with anti-slip felt base, tournament size.',
    image: 'assets/placeholder.svg',
    tag: 'Best Seller',
  },
  {
    id: 4,
    name: 'Travel Magnetic Chess Set',
    category: 'chess-set',
    price: 32.9,
    description: 'Folding magnetic board — play anywhere, from cafés to train rides.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 5,
    name: 'LeapChess Hoodie',
    category: 'apparel',
    price: 55.0,
    description: 'Heavyweight hoodie with embroidered knight crest. Built for long sessions.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 6,
    name: 'Knight Canvas Tote',
    category: 'apparel',
    price: 19.9,
    description: 'Roomy canvas tote that fits a full board, pieces and a clock.',
    image: 'assets/placeholder.svg',
  },
];

/* ---------------- 工具（自包含，勿引用主站 api.js） ---------------- */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------------- 渲染与交互 ---------------- */
function cardHtml(p) {
  return `
    <article class="product-card">
      <a class="product-img" href="#" aria-label="View details (sandbox mock)">
        ${p.tag ? `<span class="product-flag">${escapeHtml(p.tag)}</span>` : ''}
        ${p.image
          ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : (CAT_ICON[p.category] || '♟')}
      </a>
      <div class="product-body">
        <span class="product-cat">${CAT_LABEL[p.category] || p.category}</span>
        <h3 class="product-name"><a href="#">${escapeHtml(p.name)}</a></h3>
        <p class="product-desc">${escapeHtml(p.description || '')}</p>
        <div class="product-foot">
          <span class="product-price">$ ${Number(p.price).toFixed(2)}</span>
          <a class="product-more" href="#">View Details →</a>
        </div>
      </div>
    </article>
  `;
}

/** 按分类渲染 mock 商品（纯本地过滤，无网络请求） */
export function renderProducts(category = '') {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  const list = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
  grid.innerHTML = list.length
    ? list.map(cardHtml).join('')
    : '<div class="loading">No mock products in this category.</div>';
}

export function initFilter() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    bar.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    renderProducts(chip.dataset.cat);
  });
}

export function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => links.classList.toggle('open'));
  links?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

export function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('show'));
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
