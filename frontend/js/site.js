/**
 * LeapShop 全站共享层（多页面一致性保证）
 * ------------------------------------------------------------
 * 职责：注入导航 / 购物车抽屉 / 页脚（每页布局完全一致），
 * 维护跨页购物车（localStorage 独立键 pf_cart；存储不可用时自动降级为内存态）。
 * 商品信息经 store.js 从后端拉取（模块级缓存，仅拉一次）。
 */
import { fetchProducts, fetchSettings, escapeHtml } from './store.js';

const KEY = 'pf_cart';
const PAGE = document.body.dataset.page || 'home';
const $ = (s) => document.querySelector(s);

/* ---------- 导航（LOGO 左 / 跳转中 / 购物车右，每页一致） ---------- */
const NAV = [
  ['index.html', 'home', 'Home'],
  ['products.html', 'products', 'Product Overview'],
  ['chess-clock.html', 'chess-clock', 'Chess Clock'],
  ['chess-board.html', 'chess-board', 'Chess Board'],
  ['stopwatch.html', 'stopwatch', 'Stopwatch'],
  ['lifestyle.html', 'lifestyle', 'Chess Lifestyle'],
  ['journey.html', 'journey', 'Our Journey'],
];
const activeKey = PAGE === 'product' ? 'products' : PAGE;

document.body.insertAdjacentHTML('afterbegin', `
  <header class="nav" id="nav">
    <div class="nav-inner">
      <a class="nav-logo" href="index.html" aria-label="LEAP Home">
        <img src="assets/logo.svg" alt="LEAP LOGO" />
      </a>
      <nav class="nav-links" id="navLinks" aria-label="Main navigation">
        ${NAV.map(([file, key, label]) =>
          `<a href="${file}" class="${key === activeKey ? 'is-active' : ''}">${label}</a>`).join('')}
      </nav>
      <button class="nav-cart" id="cartBtn" aria-label="Open cart">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" aria-hidden="true">
          <path d="M6 7h12l1 14H5L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
        <span class="cart-badge" id="cartCount">0</span>
      </button>
      <button class="nav-burger" id="burger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`);

document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="overlay"></div>
  <aside class="drawer" id="drawer" aria-label="Shopping cart">
    <div class="cart-head">
      <h3>Shopping Cart</h3>
      <button class="cart-close" id="cartClose" aria-label="Close cart">×</button>
    </div>
    <div class="cart-list" id="cartList"></div>
    <div class="cart-foot">
      <div class="cart-total"><span class="t">Total</span><span class="v" id="cartTotal">$0.00</span></div>
      <button class="btn" id="exportBtn" disabled><span>Export Shopping List</span></button>
      <p class="cart-note">No checkout in this prototype · Export your shopping list instead</p>
    </div>
  </aside>
  <footer class="footer">
    <div class="wrap footer-inner">
      <img src="assets/logo.svg" alt="LEAP LOGO" />
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="index.html">Home</a>
        <a href="products.html">Products</a>
        <a href="journey.html">Journey</a>
      </nav>
      <div class="footer-copy">
        <span>© 2026 LeapChess · Affordable Luxury Editorial Gallery</span>
        <span>Precision Timing · Since 2001</span>
      </div>
    </div>
  </footer>`);

/* ---------- 跨页购物车（pf_cart） ---------- */
let cart = new Map();
try {
  // 存储数据强制数值化 + 区间收敛，杜绝经存储通道的标记注入
  Object.entries(JSON.parse(localStorage.getItem(KEY) || '{}')).forEach(([id, q]) => {
    const n = Math.floor(Number(q));
    if (Number.isFinite(n) && n > 0) cart.set(+id, Math.min(n, 999));
  });
} catch { /* 存储不可用 → 内存态 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(cart))); } catch { /* noop */ } };
const money = (n) => `$${Number(n).toFixed(2)}`;
/* 商品表后端异步拉取（模块级缓存），到位前购物车以空列表渲染 */
let products = [];
const find = (id) => products.find((p) => p.id === id);
fetchProducts().then((list) => { products = list; renderCart(); }).catch(() => { /* 后端不可达：购物车功能降级 */ });

const drawer = $('#drawer'), overlay = $('#overlay');
const openDrawer = () => { drawer.classList.add('open'); overlay.classList.add('show'); };
const closeDrawer = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };

function renderCart() {
  const items = [...cart.entries()].map(([id, qty]) => ({ p: find(id), qty })).filter((x) => x.p);
  const count = items.reduce((s, it) => s + it.qty, 0);
  const total = items.reduce((s, it) => s + it.qty * it.p.price, 0);
  const badge = $('#cartCount');
  badge.textContent = count;
  badge.classList.toggle('show', count > 0);
  $('#cartTotal').textContent = money(total);
  $('#exportBtn').disabled = count === 0;
  $('#cartList').innerHTML = items.length ? items.map(({ p, qty }) => `
    <div class="cart-item">
      <img src="${p.img || 'assets/placeholder.svg'}" alt="${escapeHtml(p.name)}" />
      <div class="ci-body">
        <p class="ci-name">${escapeHtml(p.name)}</p>
        <p class="ci-price">${money(p.price)} / each</p>
        <span class="stepper">
          <button data-step="-1" data-id="${p.id}" aria-label="Decrease">−</button>
          <output>${qty}</output>
          <button data-step="1" data-id="${p.id}" aria-label="Increase">+</button>
        </span>
      </div>
      <div class="ci-side">
        <span class="ci-sub">${money(p.price * qty)}</span>
        <button class="ci-remove" data-remove="${p.id}">Remove</button>
      </div>
    </div>`).join('')
    : '<p class="cart-empty">Your cart is empty ♟<br>Add your favourites from the product grid.</p>';
}

function addToCart(id, qty = 1) {
  cart.set(id, (cart.get(id) || 0) + qty);
  save(); renderCart(); openDrawer();
}

/* 一键导出购物清单（本地 Blob 下载，无网络请求） */
$('#exportBtn').addEventListener('click', () => {
  const lines = [...cart.entries()].map(([id, q]) => {
    const p = find(id);
    return `${p.name}  x${q}  @${money(p.price)}  = ${money(p.price * q)}`;
  });
  const total = [...cart.entries()].reduce((s, [id, q]) => s + q * find(id).price, 0);
  const text = `LeapChess Shopping List\n${'—'.repeat(36)}\n${lines.join('\n')}\n${'—'.repeat(36)}\nTotal: ${money(total)}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'leap-shopping-list.txt' });
  a.click();
  URL.revokeObjectURL(url);
  // 导出完成后购物车归零（数量清零、抽屉关闭）
  cart.clear(); save(); renderCart(); closeDrawer();
});

/* ---------- 全站事件委托 ---------- */
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) { addToCart(+add.dataset.add, 1); return; }
  const st = e.target.closest('[data-step]');
  const rm = e.target.closest('[data-remove]');
  if (st) {
    const id = +st.dataset.id;
    const q = (cart.get(id) || 0) + +st.dataset.step;
    q <= 0 ? cart.delete(id) : cart.set(id, q);
    save(); renderCart(); return;
  }
  if (rm) { cart.delete(+rm.dataset.remove); save(); renderCart(); return; }
  if (e.target.closest('#cartBtn')) { openDrawer(); return; }
  if (e.target.closest('#cartClose') || e.target === overlay) { closeDrawer(); return; }
  if (e.target.closest('#burger')) { $('#nav').classList.toggle('open'); return; }
  if (e.target.closest('#navLinks a')) { $('#nav').classList.remove('open'); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/* ---------- 隐蔽后台入口：2 秒内连敲 5 次空格 → /admin.html ---------- */
const spaceStamps = [];
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || e.repeat) return;
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const now = Date.now();
  spaceStamps.push(now);
  while (spaceStamps.length > 5) spaceStamps.shift();
  if (spaceStamps.length === 5 && now - spaceStamps[0] <= 2000) {
    spaceStamps.length = 0;
    location.href = 'admin.html';
  }
});

/* ---------- 全站设置（title / LOGO / 公告 / 联系方式） ---------- */
const DEFAULT_LOGO = 'assets/logo.svg';

/** 公告安全渲染：先全量转义，仅放行白名单标签（<strong>/<b>/<em>/<br>），杜绝 XSS */
function sanitizeAnnouncement(html) {
  return escapeHtml(html).replace(/&lt;(\/?(?:strong|b|em)|br\s*\/?)&gt;/gi, '<$1>');
}

function applySettings(s) {
  // 网站标题：保留各页 “·” 后的页面后缀
  const siteTitle = String(s.site_title || '').trim();
  if (siteTitle) {
    const suffix = document.title.split('·').slice(1).join('·').trim();
    document.title = suffix ? `${siteTitle} · ${suffix}` : siteTitle;
  }
  // LOGO（导航栏 + 页脚）：未配置时回退静态品牌资产
  const logo = String(s.logo_url || '').trim();
  document.querySelectorAll('.nav-logo img, .footer-inner > img').forEach((img) => {
    img.src = logo || DEFAULT_LOGO;
  });
  // 首页公告栏（仅首页，空内容时移除）
  const ann = String(s.announcement_html || '').trim();
  let bar = $('#announceBar');
  if (ann && PAGE === 'home') {
    if (!bar) {
      $('#nav').insertAdjacentHTML('afterend', '<div class="announce-bar" id="announceBar" role="status"></div>');
      bar = $('#announceBar');
    }
    bar.innerHTML = sanitizeAnnouncement(ann);
  } else if (bar) {
    bar.remove();
  }
  // 页脚联系方式
  const email = String(s.contact_email || '').trim();
  const social = String(s.contact_social || '').trim();
  let contact = $('#footerContact');
  if (email || social) {
    const text = [email ? `✉ ${escapeHtml(email)}` : '', social ? escapeHtml(social) : ''].filter(Boolean).join(' · ');
    if (!contact) {
      $('.footer-copy').insertAdjacentHTML('beforeend', '<span id="footerContact"></span>');
      contact = $('#footerContact');
    }
    contact.innerHTML = text;
  } else if (contact) {
    contact.remove();
  }
}
fetchSettings().then(applySettings).catch(() => { /* 后端不可达：保持静态默认值 */ });

/* 后台保存设置后经 BroadcastChannel 通知，前台即时同步（无需刷新页面） */
try {
  const bc = new BroadcastChannel('leap_settings');
  bc.onmessage = (e) => {
    if (e.data && e.data.type === 'settings') fetchSettings(true).then(applySettings).catch(() => {});
  };
} catch { /* 不支持 BroadcastChannel 的环境静默降级 */ }

/* ---------- 滚动显现（JS 仅加类，动画为 CSS） ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
}), { threshold: .15 });
function observeReveals() {
  document.querySelectorAll('.reveal:not(.in-view), .stats:not(.in-view)')
    .forEach((el) => io.observe(el));
}

/* ---------- 对页面脚本暴露的最小 API ---------- */
window.PF = { addToCart, observeReveals, money, escapeHtml, findProduct: find };

renderCart();
observeReveals();
