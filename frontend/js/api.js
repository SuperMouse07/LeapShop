/**
 * 共享 API 客户端：自动探测后端地址、管理 Token、封装请求
 */
const TOKEN_KEY = 'lc_token';
const USER_KEY = 'lc_user';

let API_BASE = '/api'; // 单服务部署时同源直连

/** 同源 /api 不通时，回退到本地开发后端 3000 端口 */
export async function detectApiBase() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) return;
  } catch { /* ignore */ }
  API_BASE = `${location.protocol}//${location.hostname}:3000/api`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** 统一请求封装：自动带 Token，统一错误抛出 */
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** 取商品主图：优先多图列表第一张，兼容旧单图字段 */
export function productImage(p) {
  return (p.images && p.images[0]) || p.image || '';
}

/** 在导航栏渲染用户状态（登录信息 / 退出 / 管理入口） */
export function renderNavUser() {
  const slot = document.getElementById('navUserSlot');
  if (!slot) return;
  const user = getUser();
  if (!user) return;
  // --- SANDBOX_REDIRECT (start) --- C001 测试账号显示沙箱引导入口；移除沙箱时删除本段与下方 ${sandboxBtn} 即可还原
  const sandboxBtn = user.username === 'C001'
    ? '<a class="btn btn-small btn-primary" href="sandbox/portal.html" title="前端设计验证沙箱">UI Sandbox ♟</a>'
    : '';
  // --- SANDBOX_REDIRECT (end) ---
  slot.innerHTML = `
    <span class="nav-user">♟ <b>${escapeHtml(user.username)}</b> (${user.role === 'admin' ? 'Super Admin' : 'Customer'})</span>
    ${user.role === 'admin' ? '<a class="btn btn-small btn-primary" href="admin.html">Admin Panel</a>' : ''}
    ${sandboxBtn}
    <a href="#" class="btn btn-small btn-ghost" id="logoutBtn">Sign Out</a>
  `;
  const loginBtn = document.getElementById('navLoginBtn');
  if (loginBtn) loginBtn.remove();
  slot.querySelector('#logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    location.href = 'index.html';
  });
}
