/**
 * LeapShop · Home 页脚本
 * Hero full-bleed 轮播（8s 自动 + 手动深浅点，图源服务器 slides 表）/ Featured 交错四卡 /
 * Why Choose Leap / 品牌历程计数动画。JS 仅切换状态类，动效为 CSS。
 */
import { CATS, CAT_META, WHY, STATS, HERITAGE } from './data.js';
import { fetchSlides, fetchProducts, escapeHtml, money } from './store.js';

const $ = (s) => document.querySelector(s);

/* ---------- Hero 轮播（服务器 slides；无数据时隐藏轮播区） ---------- */
async function initCarousel() {
  let slides = [];
  try { slides = await fetchSlides(); } catch { /* 后端不可达 → 隐藏轮播 */ }
  if (!slides.length) {
    document.querySelector('.hero').style.display = 'none';
    return;
  }
  $('#carousel').innerHTML = slides.map((s, i) =>
    `<div class="slide${i === 0 ? ' is-active' : ''}"><img src="${s.image}" alt="${escapeHtml(s.alt)}"${i ? ' loading="lazy"' : ''}></div>`).join('');
  $('#dots').innerHTML = slides.map((_, i) =>
    `<button class="dot${i === 0 ? ' is-active' : ''}" data-i="${i}" aria-label="Switch to slide ${i + 1}"></button>`).join('');
  let ci = 0, timer = null;
  const els = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('.dot')];
  function go(i) {
    ci = (i + slides.length) % slides.length;
    els.forEach((el, k) => el.classList.toggle('is-active', k === ci));
    dots.forEach((el, k) => el.classList.toggle('is-active', k === ci));
  }
  function startAuto() { stopAuto(); timer = setInterval(() => go(ci + 1), 8000); }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  $('#dots').addEventListener('click', (e) => {
    const d = e.target.closest('.dot'); if (!d) return;
    go(+d.dataset.i); startAuto();
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? stopAuto() : startAuto()));
  startAuto();
}

/* ---------- Featured：四系列首个代表品交错卡（Learn More → 系列页） ---------- */
function renderFeatured(products) {
  const featured = CATS.map((c) => products.find((p) => p.category === c.id)).filter(Boolean);
  $('#featGrid').innerHTML = featured.map((p) => {
    const meta = CAT_META[p.category];
    return `
    <article class="p-card reveal">
      <a class="p-media" href="${meta.file}" aria-label="${escapeHtml(p.name)}">
        <img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">
      </a>
      <p class="p-cat">${escapeHtml(meta.title)}</p>
      <h3 class="p-name">${escapeHtml(p.name)}</h3>
      <p class="p-desc">${escapeHtml(p.description)}</p>
      <div class="p-foot">
        <span class="p-price"><small>USD</small>${money(p.price)}</span>
        <a class="link-more" href="${meta.file}"><span>Learn More</span><span class="arr">→</span></a>
        <button class="btn-add" data-add="${p.id}">Add to Cart</button>
      </div>
    </article>`;
  }).join('');
}

/* ---------- Why / 统计 / 历程摘要（编辑性常量） ---------- */
$('#whyGrid').innerHTML = WHY.map((w) => `
  <div class="why-item reveal">
    <span class="n">${escapeHtml(w.n)}</span>
    <h3>${escapeHtml(w.t)}</h3>
    <p>${escapeHtml(w.d)}</p>
  </div>`).join('');
$('#stats').innerHTML = STATS.map((s) => `
  <div class="stat">
    <span class="stat-num" style="--to:${s.to}"></span><span class="stat-suf">${escapeHtml(s.suffix)}</span>
    <span class="stat-label">${escapeHtml(s.label)}</span>
  </div>`).join('');
$('#heritage').innerHTML = HERITAGE.map((t) => `<p>${escapeHtml(t)}</p>`).join('');

initCarousel();
fetchProducts().then(renderFeatured).catch(() => {
  $('#featGrid').innerHTML = '<p class="cart-empty">Products are temporarily unavailable ♟</p>';
}).finally(() => window.PF.observeReveals());
