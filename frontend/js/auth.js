/**
 * 登录页逻辑
 */
import { detectApiBase, api, saveSession } from './api.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('authError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  try {
    const { token, user } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    saveSession(token, user);
    // 管理员进入后台，客户回到首页浏览
    location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

(async function init() {
  await detectApiBase();
})();
