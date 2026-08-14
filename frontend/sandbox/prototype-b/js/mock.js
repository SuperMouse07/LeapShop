/**
 * 沙箱演示数据与渲染逻辑（纯静态 · 零 API 调用）
 * ------------------------------------------------------------
 * - 商品 / 品牌 / 历程数据均为内嵌 mock，仅用于 UI 设计验证，非真实数据
 * - 本文件自包含实现 escapeHtml 等工具，禁止引用 ../../js/api.js
 * - 禁止 fetch / XHR，禁止读写 lc_token / lc_user
 * - 服务于方案 B v2 多页原型：index / products / about / journey
 * - 合并回主站时必须替换为 api.js 的 api() 封装与真实 /api/products 数据
 */

const CAT_ICON = { 'chess-timer': '⏱', 'chess-set': '♟', apparel: '♞' };
const CAT_LABEL = { 'chess-timer': 'CHESS TIMER', 'chess-set': 'CHESS SET', apparel: 'APPAREL & GEAR' };

/* ---------------- 演示数据（mock） ---------------- */
export const PRODUCTS = [
  {
    id: 1,
    name: 'Leap Pro Tournament Clock',
    category: 'chess-timer',
    price: 89.99,
    badge: 'FIDE',
    description: 'FIDE-certified tournament clock with 39 timing modes and millisecond precision.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 2,
    name: 'Leap Club Trainer Clock',
    category: 'chess-timer',
    price: 45.5,
    badge: '',
    description: 'Entry-level training clock with drop-resistant body and long-life battery.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 3,
    name: 'Grandmaster Wooden Chess Set',
    category: 'chess-set',
    price: 129.0,
    badge: 'BEST SELLER',
    description: 'Hand-finished wooden pieces with anti-slip felt base, tournament size.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 4,
    name: 'Travel Magnetic Chess Set',
    category: 'chess-set',
    price: 32.9,
    badge: '',
    description: 'Folding magnetic board — play anywhere, from cafés to train rides.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 5,
    name: 'LeapChess Hoodie',
    category: 'apparel',
    price: 55.0,
    badge: 'NEW',
    description: 'Heavyweight hoodie with embroidered knight crest. Built for long sessions.',
    image: 'assets/placeholder.svg',
  },
  {
    id: 6,
    name: 'Knight Canvas Tote',
    category: 'apparel',
    price: 19.9,
    badge: '',
    description: 'Roomy canvas tote that fits a full board, pieces and a clock.',
    image: 'assets/placeholder.svg',
  },
];

export const VALUES = [
  { icon: '♛', title: 'Pro-Grade Precision', desc: 'Millisecond timing chips with FIDE-standard presets — reliable from club training to international tournaments.' },
  { icon: '♜', title: 'Built to Last', desc: 'Drop-resistant bodies, long-life batteries and anti-slip bases, tough enough for thousands of games.' },
  { icon: '♝', title: 'Accessible to All', desc: "From entry-level training clocks to flagship tournament models — there's one for every budget." },
  { icon: '♞', title: 'Smart & Connected', desc: 'Flagship models sync with apps like Lichess / Chess.com, so your post-game analysis starts faster.' },
];

export const JOURNEY = [
  { year: '2018', icon: '♟', title: 'The Origin', desc: 'Our founder, a lifelong chess lover, found clocks on the market either too expensive or unreliable — and decided to build a better one.' },
  { year: '2019', icon: '⏱', title: 'First Clock Ships', desc: 'The first Leap training clock reached 10,000 players in its launch year, funded entirely by the chess community.' },
  { year: '2021', icon: '♜', title: 'Certified Professional', desc: 'Our flagship series earned FIDE certification and took its place beside the boards of international tournaments.' },
  { year: '2023', icon: '♝', title: 'The Club Movement', desc: 'Bulk programs for schools and clubs launched — equipping, supporting and winning together with local organizers.' },
  { year: '2025', icon: '♛', title: 'Serving the World', desc: 'Supporting 500,000+ clubs and schools worldwide — the trusted gear of coaches and arbiters.' },
];

export const BRAND = {
  story: [
    'Born from a lifelong passion for the game, <b>LEAP</b> combines professional-grade accuracy with bold, no-nonsense design. We believe chess gear should be as honest as the game itself — precise, durable and within reach of every player.',
    'From FIDE-certified tournament clocks to creative chess essentials, we empower players at every level to focus on what matters most: <b>the next move</b>.',
  ],
  quote: 'Find the Move. Beat the Clock.',
};

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
      <div class="product-img">
        ${p.image
          ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : (CAT_ICON[p.category] || '♟')}
      </div>
      <div class="product-body">
        <div class="product-top">
          <span class="product-cat">${CAT_LABEL[p.category] || p.category}</span>
          ${p.badge ? `<span class="product-badge">${escapeHtml(p.badge)}</span>` : ''}
        </div>
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

/**
 * 渲染 mock 商品到 #productGrid（纯本地过滤，无网络请求）
 * @param {string} category 分类过滤，空串为全部
 * @param {number} [limit] 可选：仅渲染前 N 件（主页概览用）
 */
export function renderProducts(category = '', limit = 0) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  let list = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;
  if (limit > 0) list = list.slice(0, limit);
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

/** 渲染 Why Leap / 价值卡片到 #whyGrid */
export function renderValues(limit = 0) {
  const grid = document.getElementById('whyGrid');
  if (!grid) return;
  const list = limit > 0 ? VALUES.slice(0, limit) : VALUES;
  grid.innerHTML = list.map((v) => `
    <div class="why-card reveal">
      <div class="why-icon" aria-hidden="true">${escapeHtml(v.icon)}</div>
      <h3>${escapeHtml(v.title)}</h3>
      <p>${escapeHtml(v.desc)}</p>
    </div>
  `).join('');
}

/** 渲染品牌历程时间轴到 #timeline */
export function renderJourney(limit = 0) {
  const box = document.getElementById('timeline');
  if (!box) return;
  const list = limit > 0 ? JOURNEY.slice(0, limit) : JOURNEY;
  box.innerHTML = list.map((j) => `
    <div class="tl-item reveal">
      <span class="tl-dot" aria-hidden="true">${escapeHtml(j.icon)}</span>
      <span class="tl-year">${escapeHtml(j.year)}</span>
      <div class="tl-body">
        <h4>${escapeHtml(j.title)}</h4>
        <p>${escapeHtml(j.desc)}</p>
      </div>
    </div>
  `).join('');
}

/** 汉堡菜单开关（移动端） */
export function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => links.classList.toggle('open'));
  links?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

/** 滚动显现（IntersectionObserver 添加 .show） */
export function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('show'));
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

/** 页脚年份 */
export function initYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/** 多页通用初始化：导航 / 显现 / 年份（各页面统一调用） */
export function initPage() {
  initNav();
  initReveal();
  initYear();
}
