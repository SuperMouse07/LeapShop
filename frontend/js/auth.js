/**
 * 前台会话状态管理（测试登录系统）
 * - 检查当前用户登录状态（localStorage lc_token / lc_user）
 * - 提供 logout / logActivity 工具
 * - 未登录时不强制跳转（前台仍可公开浏览），但记录"访客"行为
 */
import { getToken, getUser, clearSession } from './api.js';

/** 当前是否已登录 */
export function isLoggedIn() {
  return Boolean(getToken());
}

/** 获取当前用户对象（未登录返回 null） */
export function currentUser() {
  return getUser();
}

/** 登出并跳转登录页 */
export function logout(redirectUrl = 'login.html') {
  clearSession();
  window.location.replace(redirectUrl);
}

/**
 * 记录前台交互事件（测试操作追溯）
 * - 仅登录用户才会上报；未登录静默忽略
 * - action: 事件类型（page_view / add_to_cart / remove_from_cart / click_product 等）
 * - detail: 附加描述（商品名/页面路径等）
 */
export async function logActivity(action, detail = '') {
  const token = getToken();
  if (!token) return; // 未登录不上报
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, detail }),
    });
  } catch {
    // 日志上报失败静默忽略，不影响用户体验
  }
}

/** 当前用户角色标签（用于 UI 展示） */
export function roleLabel() {
  const user = getUser();
  if (!user) return '';
  const labels = { admin: 'Admin', tester: 'Tester', demo: 'Observer' };
  return labels[user.role] || user.role;
}
