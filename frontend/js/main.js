/**
 * 首页逻辑：商品动态加载、分类过滤、导航与动画
 */
import { detectApiBase, api, renderNavUser, escapeHtml, productImage } from './api.js';

const CAT_ICON = { 'chess-timer': '⏱', 'chess-set': '♟', apparel: '♞' };
const CAT_LABEL = { 'chess-timer': 'CHESS TIMER', 'chess-set': 'CHESS SET', apparel: 'APPAREL & GEAR' };

async function loadProducts(category = '') {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<div class="loading">Loading products from the database… ♟</div>';
  try {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const { products } = await api(`/products${qs}`);
    if (!products.length) {
      grid.innerHTML = '<div class="loading">No products in this category yet — waiting for the admin to upload.</div>';
      return;
    }
    grid.innerHTML = products.map((p) => {
      const img = productImage(p);
      return `
      <article class="product-card">
        <a class="product-img" href="product.html?id=${p.id}" aria-label="View details">
          ${img
            ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
            : (CAT_ICON[p.category] || '♟')}
        </a>
        <div class="product-body">
          <span class="product-cat">${CAT_LABEL[p.category] || p.category}</span>
          <h3 class="product-name"><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
          <p class="product-desc">${escapeHtml(p.description || '')}</p>
          <div class="product-foot">
            <span class="product-price">$ ${Number(p.price).toFixed(2)}</span>
            <a class="product-more" href="product.html?id=${p.id}">View Details →</a>
          </div>
        </div>
      </article>
    `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="loading">Failed to load: ${escapeHtml(err.message)}<br>Please make sure the backend service is running (port 3000).</div>`;
  }
}

async function checkHealth() {
  const badge = document.getElementById('healthBadge');
  if (!badge) return;
  try {
    const data = await api('/health');
    badge.innerHTML = `<span class="health-ok">● API Online</span> · Database: ${data.db}`;
  } catch {
    badge.innerHTML = '<span class="health-bad">● API Offline</span>';
  }
}

function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => links.classList.toggle('open'));
  links?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.isIntersecting && e.target.classList.add('show'));
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

function initFilter() {
  const bar = document.getElementById('filterBar');
  bar.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    bar.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    loadProducts(chip.dataset.cat);
  });
}

(async function init() {
  document.getElementById('year').textContent = new Date().getFullYear();
  initNav();
  initReveal();
  await detectApiBase();
  renderNavUser();
  initFilter();
  loadProducts();
  checkHealth();
})();
