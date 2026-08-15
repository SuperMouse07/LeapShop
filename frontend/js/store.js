/**
 * LeapShop 前台数据层：后端自动探测 + 统一 fetch 封装（只读公开接口）
 * - 同源 /api/health 探测成功 → 同源 API；失败回退 location.hostname:3000（本地前后端分离开发）
 * - 写操作一律走后台（admin.html），前台不携带 token
 */
let API = '';

async function discover() {
  if (API) return API;
  try {
    const r = await fetch('/api/health');
    if (r.ok) { API = '/api'; return API; }
  } catch { /* 回退独立后端端口 */ }
  API = `${location.protocol}//${location.hostname}:3000/api`;
  return API;
}

async function get(path) {
  const base = await discover();
  const r = await fetch(base + path);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** 前端静态兜底图（品牌资产；内容图一律来自 /uploads/） */
export const PLACEHOLDER = 'assets/placeholder.svg';

/* 瀑布流节奏：分类内按序循环分配（方案F设计节奏） */
export const RATIOS = ['4/3', '1/1', '4/5', '3/4'];
export const withRatios = (list) => list.map((p, i) => ({ ...p, ratio: RATIOS[i % RATIOS.length] }));

/** 商品主图（images[0]），缺省回退静态 placeholder */
const withCover = (p) => ({ ...p, img: (p.images && p.images[0]) || PLACEHOLDER });

let cache = null;
/** 全部商品（按 id 升序，模块级缓存） */
export async function fetchProducts(force = false) {
  if (cache && !force) return cache;
  const { products } = await get('/products');
  cache = products.map(withCover);
  return cache;
}

export async function fetchProduct(id) {
  const { product } = await get(`/products/${id}`);
  return withCover(product);
}

/** 首页轮播图（服务器 slides 表，仅启用项） */
export async function fetchSlides() {
  const { slides } = await get('/slides');
  return slides;
}
