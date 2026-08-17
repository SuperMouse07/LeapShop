/**
 * Admin dashboard（隐藏入口 /admin.html）
 * 内置登录守卫 + 轮播图管理 + 商品 CRUD（主图/详情图双图集 + 卖点 info）+ 存储统计
 */
import { detectApiBase, api, getToken, getUser, saveSession, clearSession, renderNavUser, escapeHtml, productImage } from './api.js';

const CAT_LABEL = {
  'chess-clock': 'Chess Clock',
  'chess-board': 'Chess Board',
  stopwatch: 'Stopwatch',
  lifestyle: 'Chess Lifestyle',
};
const KNOWN_CATS = Object.keys(CAT_LABEL);
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 单张图片大小上限 8MB（防异常大文件）
const MAX_TOTAL_IMAGE_SIZE = 50 * 1024 * 1024; // 单商品图片总量上限 50MB（二进制口径，后端 express.json 限 80mb 容纳 base64 膨胀）
const MAX_BODY_CHARS = 75 * 1024 * 1024; // 提交 JSON 字符数终检阈值（低于后端 80mb 限制留余量）
const $ = (id) => document.getElementById(id);

let pendingImages = [];  // 主图图集（URL 或 dataURL），第一张为封面
let pendingDetails = []; // 详情图图集

/** 估算 dataURL 对应的二进制字节数（服务器 URL 不计入，其不在提交体中重复传输原始字节） */
function dataUrlBytes(src) {
  if (typeof src !== 'string' || !src.startsWith('data:')) return 0;
  const i = src.indexOf(',');
  return i < 0 ? 0 : Math.ceil(((src.length - i - 1) * 3) / 4);
}
/** 当前两个图集待上传图片的总二进制字节数 */
function pendingImageBytes() {
  return [...pendingImages, ...pendingDetails].reduce((s, src) => s + dataUrlBytes(src), 0);
}

/* ---------- Access guard（内置登录 + 角色分流） ---------- */
const EDITOR_ROLES = ['admin', 'tester'];

function showOnly(panelId) {
  ['loginPanel', 'deniedPanel', 'adminPanel'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== panelId);
  });
}

async function guard() {
  await detectApiBase();
  renderNavUser();
  if (!getToken()) {
    showOnly('loginPanel');
    return false;
  }
  try {
    const { user } = await api('/auth/me');
    if (!EDITOR_ROLES.includes(user.role)) {
      $('deniedMsg').innerHTML = `Account <b>${escapeHtml(user.username)}</b> (${escapeHtml(user.role)}) does not have editor access.`;
      showOnly('deniedPanel');
      return false;
    }
    showOnly('adminPanel');
    // 面板级权限控制：tester 隐藏管理专属面板
    if (user.role === 'tester') {
      ['statsPanel', 'usersPanel', 'activityPanel'].forEach((id) => {
        const el = $(id);
        if (el) el.classList.add('hidden');
      });
      // 隐藏侧栏对应锚点链接
      document.querySelectorAll('.admin-side a').forEach((a) => {
        const href = a.getAttribute('href');
        if (href === '#statsPanel' || href === '#usersPanel' || href === '#activityPanel') {
          a.classList.add('hidden');
        }
      });
    }
    return true;
  } catch {
    clearSession();
    renderNavUser();
    $('loginMsg').textContent = 'Session expired — please sign in again.';
    showOnly('loginPanel');
    return false;
  }
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('loginMsg');
  msg.textContent = 'Signing in…';
  msg.className = 'form-msg';
  try {
    const { token, user } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('loginUser').value.trim(), password: $('loginPass').value }),
    });
    saveSession(token, user);
    if (!EDITOR_ROLES.includes(user.role)) {
      clearSession();
      msg.textContent = 'This account does not have editor access.';
      msg.className = 'form-msg err';
      return;
    }
    msg.textContent = '';
    renderNavUser();
    showOnly('adminPanel');
    boot();
  } catch (err) {
    msg.textContent = err.message || 'Sign in failed';
    msg.className = 'form-msg err';
  }
});

$('switchAccountBtn').addEventListener('click', () => {
  clearSession();
  renderNavUser();
  showOnly('loginPanel');
});

/* ---------- Storage stats ---------- */
function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n;
  let u = -1;
  do {
    v /= 1024;
    u++;
  } while (v >= 1024 && u < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
}

async function loadStats() {
  try {
    const s = await api('/stats/storage');
    $('statDbType').textContent = s.dbType === 'postgresql' ? 'PostgreSQL' : 'SQLite';
    $('statTotal').textContent = formatBytes(s.totalBytes);
    const ratio = s.totalBytes > 0 ? (s.productBytes / s.totalBytes) * 100 : 0;
    $('statRatio').textContent = `${ratio.toFixed(1)}%`;
    $('statDiskTotal').textContent = s.volumeTotalBytes > 0 ? formatBytes(s.volumeTotalBytes) : '—';
    $('statDiskFree').textContent = s.volumeFreeBytes > 0 ? formatBytes(s.volumeFreeBytes) : '—';
    $('statCount').textContent = `${s.productCount} item(s)`;
    // 口径 1：商品数据占应用总数据（数据库 + 图片文件）的比例，与磁盘容量无关
    $('statBar').style.width = `${Math.min(100, ratio)}%`;
    $('statBarLabel').textContent =
      `Product data ${formatBytes(s.productBytes)} of app data ${formatBytes(s.totalBytes)} (${ratio.toFixed(1)}%)`;
    // 口径 2：磁盘容量使用率（Volume 文件系统整体，含非应用文件）
    const used = Math.max(0, s.volumeTotalBytes - s.volumeFreeBytes);
    const diskPct = s.volumeTotalBytes > 0 ? (used / s.volumeTotalBytes) * 100 : 0;
    const diskBar = $('diskBar');
    if (diskBar) diskBar.style.width = `${Math.min(100, diskPct).toFixed(1)}%`;
    const diskLabel = $('diskBarLabel');
    if (diskLabel) {
      diskLabel.textContent = s.volumeTotalBytes > 0
        ? `Disk used (Volume) ${formatBytes(used)} of ${formatBytes(s.volumeTotalBytes)} (${diskPct.toFixed(1)}%)`
        : 'Disk capacity unavailable';
    }
  } catch {
    $('statBarLabel').textContent = 'Storage stats unavailable';
  }
}

/* ---------- 全站设置（settings 表） ---------- */
let settingsChannel = null;
try { settingsChannel = new BroadcastChannel('leap_settings'); } catch { /* 旧浏览器降级 */ }
const notifySettingsChanged = () => {
  if (settingsChannel) settingsChannel.postMessage({ type: 'settings' });
};
let pickedLogoData = ''; // 已选待上传的 LOGO dataURL

function setSettingsMsg(text, ok = true) {
  const el = $('settingsMsg');
  el.textContent = text || '';
  el.className = `form-msg${text && !ok ? ' err' : ''}`;
}

function setLogoPreview(url) {
  $('setLogoPreview').src = url || 'assets/logo.svg';
}

async function loadSettings() {
  try {
    const { settings: s } = await api('/settings');
    $('setSiteTitle').value = s.site_title || '';
    $('setAnnouncement').value = s.announcement_html || '';
    $('setContactEmail').value = s.contact_email || '';
    $('setContactSocial').value = s.contact_social || '';
    setLogoPreview(s.logo_url);
    // 后台导航 LOGO 同步显示当前配置
    const navLogo = document.querySelector('.nav-logo img');
    if (navLogo) navLogo.src = s.logo_url || 'assets/logo.svg';
  } catch (err) {
    setSettingsMsg(`Load settings failed: ${err.message}`, false);
  }
}

$('settingsRefreshBtn').addEventListener('click', loadSettings);

$('setLogoPickBtn').addEventListener('click', () => $('setLogoFile').click());
$('setLogoFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > MAX_IMAGE_SIZE) return setSettingsMsg('Image exceeds the 8MB limit.', false);
  const rd = new FileReader();
  rd.onload = () => {
    pickedLogoData = String(rd.result || '');
    $('setLogoPreview').src = pickedLogoData;
    $('setLogoUploadBtn').disabled = false;
    setSettingsMsg('');
  };
  rd.readAsDataURL(f);
});

$('setLogoUploadBtn').addEventListener('click', async () => {
  if (!pickedLogoData) return;
  const btn = $('setLogoUploadBtn');
  btn.disabled = true;
  try {
    const { url } = await api('/settings/logo', {
      method: 'POST',
      body: JSON.stringify({ image: pickedLogoData }),
    });
    pickedLogoData = '';
    setLogoPreview(url);
    setSettingsMsg('Logo uploaded — applied site-wide.');
    notifySettingsChanged();
  } catch (err) {
    setSettingsMsg(`Logo upload failed: ${err.message}`, false);
    btn.disabled = false;
  }
});

$('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('settingsSaveBtn');
  btn.disabled = true;
  const pairs = [
    ['site_title', $('setSiteTitle').value.trim()],
    ['announcement_html', $('setAnnouncement').value],
    ['contact_email', $('setContactEmail').value.trim()],
    ['contact_social', $('setContactSocial').value.trim()],
  ];
  try {
    for (const [key, value] of pairs) {
      await api('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) });
    }
    setSettingsMsg('Settings saved — changes take effect immediately on the frontend.');
    notifySettingsChanged();
  } catch (err) {
    setSettingsMsg(err.message || 'Save failed', false);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- 主推款（Hero Products：settings.hero_products，自由排序、不与系列绑定） ---------- */
let heroIds = [];         // 当前主推款 id 数组

/** 保存 hero_products 数组到后端（Set/Clear 与表单勾选共用） */
async function saveHeroIds(newIds) {
  await api('/settings', { method: 'PUT', body: JSON.stringify({ key: 'hero_products', value: JSON.stringify(newIds) }) });
  heroIds = newIds;
}

/* ---------- 隐蔽快捷入口：2 秒内连敲 5 次空格 → 前台首页 ---------- */
const spaceStamps = [];
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || e.repeat) return;
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const now = Date.now();
  spaceStamps.push(now);
  while (spaceStamps.length > 5) spaceStamps.shift();
  if (spaceStamps.length === 5 && now - spaceStamps[0] <= 2000) {
    spaceStamps.length = 0;
    location.href = 'index.html';
  }
});

/* ---------- 轮播图管理 ---------- */
let slides = [];

async function loadSlides() {
  const box = $('slideRows');
  try {
    ({ slides } = await api('/slides?all=1'));
  } catch (err) {
    box.innerHTML = `<p class="loading">Failed to load: ${escapeHtml(err.message)}</p>`;
    return;
  }
  if (!slides.length) {
    box.innerHTML = '<p class="loading">No slides yet — add the first hero image below.</p>';
    return;
  }
  box.innerHTML = slides
    .map(
      (s, i) => `
      <div class="slide-row ${s.enabled ? '' : 'disabled'}" data-id="${s.id}">
        <img class="slide-thumb" src="${escapeHtml(s.image)}" alt="" />
        <input type="text" class="slide-alt" value="${escapeHtml(s.alt || '')}" placeholder="Alt text…" />
        <span class="slide-idx">#${i + 1}</span>
        <div class="slide-ops">
          <button type="button" data-act="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-act="down" title="Move down" ${i === slides.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-act="toggle">${s.enabled ? 'Disable' : 'Enable'}</button>
          <button type="button" data-act="del" class="danger">Delete</button>
        </div>
      </div>`
    )
    .join('');
}

/** 交换两张轮播的 sort 值后逐条 PUT */
async function swapSlides(i, j) {
  const a = slides[i];
  const b = slides[j];
  const sortA = a.sort ?? i + 1;
  const sortB = b.sort ?? j + 1;
  await api(`/slides/${a.id}`, { method: 'PUT', body: JSON.stringify({ sort: sortB }) });
  await api(`/slides/${b.id}`, { method: 'PUT', body: JSON.stringify({ sort: sortA }) });
  await loadSlides();
}

$('slideRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.slide-row');
  const idx = slides.findIndex((s) => s.id === Number(row.dataset.id));
  const s = slides[idx];
  if (!s) return;
  try {
    if (btn.dataset.act === 'up') await swapSlides(idx, idx - 1);
    else if (btn.dataset.act === 'down') await swapSlides(idx, idx + 1);
    else if (btn.dataset.act === 'toggle') {
      await api(`/slides/${s.id}`, { method: 'PUT', body: JSON.stringify({ enabled: s.enabled ? 0 : 1 }) });
      await loadSlides();
    } else if (btn.dataset.act === 'del') {
      if (!confirm('Delete this slide?')) return;
      await api(`/slides/${s.id}`, { method: 'DELETE' });
      await loadSlides();
      loadStats();
    }
  } catch (err) {
    alert(`Slide update failed: ${err.message}`);
  }
});

/* alt 失焦即保存 */
$('slideRows').addEventListener('change', async (e) => {
  if (!e.target.classList.contains('slide-alt')) return;
  const row = e.target.closest('.slide-row');
  const s = slides.find((x) => x.id === Number(row.dataset.id));
  if (!s || e.target.value === (s.alt || '')) return;
  try {
    await api(`/slides/${s.id}`, { method: 'PUT', body: JSON.stringify({ alt: e.target.value }) });
    s.alt = e.target.value;
  } catch (err) {
    alert(`Slide update failed: ${err.message}`);
  }
});

/* 新增轮播：选图 → 预览 → 提交 */
let pendingSlideDataUrl = '';

$('slidePickBtn').addEventListener('click', () => $('slideFile').click());
$('slideFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > MAX_IMAGE_SIZE) {
    alert(`"${file.name}" is too large (max 8MB).`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingSlideDataUrl = reader.result;
    $('slidePreview').src = pendingSlideDataUrl;
    $('slidePreview').classList.remove('hidden');
    $('slideAddBtn').disabled = false;
  };
  reader.readAsDataURL(file);
});

$('slideAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingSlideDataUrl) return;
  const btn = $('slideAddBtn');
  btn.disabled = true;
  try {
    await api('/slides', {
      method: 'POST',
      body: JSON.stringify({ image: pendingSlideDataUrl, alt: $('slideAlt').value.trim() }),
    });
    pendingSlideDataUrl = '';
    $('slideAlt').value = '';
    $('slidePreview').classList.add('hidden');
    await loadSlides();
    loadStats();
  } catch (err) {
    alert(`Add slide failed: ${err.message}`);
    btn.disabled = false;
  }
});

$('slidesRefreshBtn').addEventListener('click', loadSlides);

/* ---------- Product list (with pagination + category filter + ↑↓ sort) ---------- */
let currentPage = 1;

async function loadList() {
  const tbody = $('productRows');
  const limit = $('listLimit').value;
  const catFilter = $('listCatFilter').value;
  try {
    const params = new URLSearchParams({ page: currentPage, limit });
    if (catFilter) params.set('category', catFilter);
    const [{ products, total, page, limit: pageSize }, { settings }] = await Promise.all([
      api(`/products?${params}`),
      api('/settings'),
    ]);
    heroIds = settings.hero_products || [];
    $('productCount').textContent = `${total} item(s)`;

    // 渲染分页控件
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    $('listPager').innerHTML = `
      <button data-pg="prev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
      <span class="pager-info">${currentPage} / ${totalPages}</span>
      <button data-pg="next" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
    `;

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="loading">No products found.</td></tr>';
      return;
    }
    tbody.innerHTML = products
      .map((p, idx) => {
        const img = productImage(p);
        const isHero = heroIds.includes(String(p.id));
        const heroCell = isHero
          ? `<span class="hero-flag" title="Series hero">♕</span><button class="btn btn-small btn-ghost" data-act="unhero" data-id="${p.id}">Clear</button>`
          : `<button class="btn btn-small btn-ghost" data-act="hero" data-id="${p.id}">Set</button>`;
        return `
        <tr>
          <td>${img ? `<img class="thumb" src="${escapeHtml(img)}" alt="" />` : '<span class="thumb-ph">♟</span>'}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${CAT_LABEL[p.category] || escapeHtml(p.category)}</td>
          <td class="td-num">$ ${Number(p.price).toFixed(2)}</td>
          <td class="td-num">${Number(p.stock) || 0}</td>
          <td class="td-num">${(p.images || []).length}</td>
          <td class="td-num">${(p.details || []).length}</td>
          <td class="td-num tip-cell" id="rowSize-${p.id}" data-tip="">…</td>
          <td class="td-hero">${heroCell}</td>
          <td>
            <span class="sort-btns">
              <button data-act="move-up" data-id="${p.id}" title="Move up" ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button data-act="move-down" data-id="${p.id}" title="Move down" ${idx === products.length - 1 ? 'disabled' : ''}>↓</button>
            </span>
          </td>
          <td class="row-actions">
            <button class="btn btn-small btn-ghost" data-act="edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-small btn-danger" data-act="del" data-id="${p.id}">Delete</button>
          </td>
        </tr>`;
      })
      .join('');
    tbody.dataset.products = JSON.stringify(products);
    loadRowStorage(products);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11" class="loading">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* 分页控件点击 */
$('listPager').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pg]');
  if (!btn || btn.disabled) return;
  if (btn.dataset.pg === 'prev') currentPage--;
  else if (btn.dataset.pg === 'next') currentPage++;
  loadList();
});

/* 每页数量变更 → 重置到第一页 */
$('listLimit').addEventListener('change', () => { currentPage = 1; loadList(); });

/* 分类筛选变更 → 重置到第一页 */
$('listCatFilter').addEventListener('change', () => { currentPage = 1; loadList(); });

/** 并行拉取每行商品的存储明细，回填单元格与 Tooltip */
async function loadRowStorage(products) {
  await Promise.all(
    products.map(async (p) => {
      let d = null;
      try {
        d = await api(`/products/${p.id}/storage`);
      } catch {
        return;
      }
      const el = $(`rowSize-${p.id}`);
      if (!d || !el) return;
      el.textContent = formatBytes(d.totalBytes);
      el.dataset.tip = `Images: ${d.imageFileCount} files | ${formatBytes(d.imageFileBytes)} on disk | JSON: ${formatBytes(d.jsonBytes)} | Total: ${formatBytes(d.totalBytes)}`;
    })
  );
}

/* ---------- Form ---------- */
function setMsg(text, ok = true) {
  const msg = $('formMsg');
  msg.textContent = text;
  msg.className = `form-msg ${ok ? 'ok' : 'err'}`;
}

function syncCustomCat() {
  $('customCatRow').classList.toggle('hidden', $('pCategory').value !== '__custom');
}
$('pCategory').addEventListener('change', syncCustomCat);

function resetForm() {
  $('productForm').reset();
  $('productForm').classList.remove('is-editing'); // 回到浅色新建模式
  $('editId').value = '';
  pendingImages = [];
  pendingDetails = [];
  renderGalleries();
  syncCustomCat();
  $('formTitle').textContent = '♟ New Product';
  $('submitBtn').textContent = 'Save Product';
  setMsg('');
}

function fillForm(p) {
  $('productForm').classList.add('is-editing'); // 深色编辑态：提示当前在修改已有数据
  $('editId').value = p.id;
  $('pName').value = p.name;
  if (KNOWN_CATS.includes(p.category)) {
    $('pCategory').value = p.category;
    $('pCustomCat').value = '';
  } else {
    $('pCategory').value = '__custom';
    $('pCustomCat').value = p.category;
  }
  syncCustomCat();
  $('pPrice').value = p.price;
  $('pStock').value = p.stock ?? '';
  $('pHero').checked = heroIds.includes(String(p.id));
  $('pDesc').value = p.description || '';
  $('pInfo').value = (p.info || []).join('\n');
  pendingImages = [...(p.images || [])];
  pendingDetails = [...(p.details || [])];
  renderGalleries();
  $('formTitle').textContent = `♟ Edit Product #${p.id}`;
  $('submitBtn').textContent = 'Save Changes';
  setMsg('');
  // 平滑滚动到表单可视位置（上下分栏后表单在表格上方，无需回页顶）
  $('productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Image galleries（主图 + 详情图） ---------- */
function galleryHtml(list, galleryId, addId, label) {
  const items = list
    .map(
      (src, i) => `
      <div class="gallery-item">
        ${i === 0 && galleryId === 'imgGallery' ? '<span class="main-flag">Cover</span>' : ''}
        <img src="${escapeHtml(src)}" alt="${label} ${i + 1}" />
        <button class="rm-img" type="button" data-i="${i}" title="Remove">×</button>
      </div>`
    )
    .join('');
  const addTile = list.length < MAX_IMAGES ? `<div class="gallery-add" id="${addId}" title="Add image">＋</div>` : '';
  return `${items}${addTile}<span class="gallery-hint">${list.length}/${MAX_IMAGES}</span>`;
}

function renderGalleries() {
  $('imgGallery').innerHTML = galleryHtml(pendingImages, 'imgGallery', 'galleryAdd', 'Main image');
  $('detailGallery').innerHTML = galleryHtml(pendingDetails, 'detailGallery', 'detailAdd', 'Detail image');
}

function bindGallery(boxId, fileInputId, addId, getList) {
  $(boxId).addEventListener('click', async (e) => {
    if (e.target.closest(`#${addId}`)) {
      $(fileInputId).click();
      return;
    }
    const rm = e.target.closest('.rm-img');
    if (rm) {
      getList().splice(Number(rm.dataset.i), 1);
      renderGalleries();
    }
  });
  $(fileInputId).addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const list = getList();
    for (const file of files) {
      if (list.length >= MAX_IMAGES) {
        setMsg(`Max ${MAX_IMAGES} images per group — extra files were skipped.`, false);
        break;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setMsg(`"${file.name}" is too large (max 8MB) and was skipped.`, false);
        continue;
      }
      if (pendingImageBytes() + file.size > MAX_TOTAL_IMAGE_SIZE) {
        setMsg(`Total images exceed the 50MB per-product limit — "${file.name}" was skipped.`, false);
        continue;
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      list.push(dataUrl);
    }
    renderGalleries();
    if (list.length) setMsg('Images ready — they will be stored on the server when you save.');
  });
}
bindGallery('imgGallery', 'pImages', 'galleryAdd', () => pendingImages);
bindGallery('detailGallery', 'pDetails', 'detailAdd', () => pendingDetails);

/* ---------- Submit ---------- */
$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = $('pCategory').value === '__custom' ? $('pCustomCat').value.trim() : $('pCategory').value;
  if (!category) {
    setMsg('Please enter a custom category id.', false);
    return;
  }
  if (!pendingImages.length) {
    setMsg('Please upload at least 1 main image.', false);
    return;
  }
  const editId = $('editId').value;
  const body = {
    name: $('pName').value,
    category,
    price: $('pPrice').value || 0,
    stock: $('pStock').value || 0,
    description: $('pDesc').value,
    info: $('pInfo').value.split('\n').map((s) => s.trim()).filter(Boolean),
    images: pendingImages,
    details: pendingDetails,
    // sort_weight 不在表单提交：排序统一由列表页 ↑↓ 按钮维护（未传字段后端保留旧值）
    // variants 不在新界面展示，编辑时不提交以保留旧值
  };
  try {
    const payload = JSON.stringify(body);
    if (payload.length > MAX_BODY_CHARS) {
      setMsg('Images are too large in total (limit ≈ 50MB per product). Please remove some images.', false);
      return;
    }
    let savedId = editId;
    if (editId) {
      await api(`/products/${editId}`, { method: 'PUT', body: payload });
      setMsg(`Product #${editId} updated ✓`);
    } else {
      const { product } = await api('/products', { method: 'POST', body: payload });
      savedId = String(product.id);
      setMsg(`Product "${product.name}" uploaded ✓`);
    }
    // 主推款联动：勾选→加入 hero_products；取消勾选且自己在数组中→移除
    const wantHero = $('pHero').checked;
    const savedIdStr = String(savedId);
    const isInHero = heroIds.includes(savedIdStr);
    if (wantHero && !isInHero) {
      await saveHeroIds([...heroIds, savedIdStr]);
    } else if (!wantHero && isInHero) {
      await saveHeroIds(heroIds.filter((hid) => hid !== savedIdStr));
    }
    resetForm();
    loadList();
    loadStats();
  } catch (err) {
    setMsg(err.message, false);
  }
});

$('cancelEdit').addEventListener('click', resetForm);
$('refreshBtn').addEventListener('click', loadList);

/* Row actions (hero / unhero / move-up / move-down / edit / delete) */
$('productRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = String(btn.dataset.id);
  const products = JSON.parse($('productRows').dataset.products || '[]');
  const product = products.find((p) => String(p.id) === id);

  // Hero Set/Clear：操作 hero_products 数组
  if (btn.dataset.act === 'hero' || btn.dataset.act === 'unhero') {
    try {
      if (btn.dataset.act === 'hero') {
        if (!heroIds.includes(id)) await saveHeroIds([...heroIds, id]);
      } else {
        await saveHeroIds(heroIds.filter((x) => x !== id));
      }
      await loadList();
    } catch (err) {
      alert(`Hero update failed: ${err.message}`);
    }
    return;
  }

  // ↑↓ 排序：调整 sort_weight
  if (btn.dataset.act === 'move-up' || btn.dataset.act === 'move-down') {
    if (!product) return;
    const idx = products.indexOf(product);
    const swapIdx = btn.dataset.act === 'move-up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= products.length) return;
    const target = products[swapIdx];
    const wA = product.sort_weight ?? (idx + 1);
    const wB = target.sort_weight ?? (swapIdx + 1);
    try {
      await api(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify({ sort_weight: wB }) });
      await api(`/products/${target.id}`, { method: 'PUT', body: JSON.stringify({ sort_weight: wA }) });
      await loadList();
    } catch (err) {
      alert(`Sort failed: ${err.message}`);
    }
    return;
  }

  if (btn.dataset.act === 'edit' && product) {
    fillForm(product);
    return;
  }
  if (btn.dataset.act === 'del' && product) {
    if (!confirm(`Delete product "${product.name}"? This cannot be undone.`)) return;
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      loadList();
      loadStats();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }
});

/* ---------- Test Accounts management ---------- */
let allUsers = [];

async function loadUsers() {
  try {
    const { users } = await api('/users');
    allUsers = users;
    const tbody = $('userRows');
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${u.id}</td>
        <td><b>${escapeHtml(u.username)}</b></td>
        <td>${escapeHtml(u.display_name || u.username)}</td>
        <td><span class="micro-label" style="font-size:10px;">${escapeHtml(u.role)}</span></td>
        <td style="font-size:12px;color:var(--muted);">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
        <td>
          ${u.role !== 'admin' ? `<button class="btn btn-small btn-danger" data-del-user="${u.id}">Delete</button>` : '<span style="color:var(--muted);font-size:11px;">Protected</span>'}
        </td>
      </tr>
    `).join('');
    // Populate activity filter dropdown
    const filter = $('activityUserFilter');
    if (filter) {
      filter.innerHTML = '<option value="">All Users</option>' +
        users.map((u) => `<option value="${u.id}">${escapeHtml(u.display_name || u.username)} (${escapeHtml(u.username)})</option>`).join('');
    }
  } catch (err) {
    $('userMsg').textContent = err.message;
    $('userMsg').className = 'form-msg err';
  }
}

// Add user
$('userAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('userMsg');
  const username = $('newUsername').value.trim();
  const display_name = $('newDisplayName').value.trim();
  const password = $('newUserPass').value;
  const role = $('newUserRole').value;
  if (!username || !password) { msg.textContent = 'Username and password required'; msg.className = 'form-msg err'; return; }
  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role, display_name }),
    });
    msg.textContent = `Account "${username}" created.`;
    msg.className = 'form-msg ok';
    $('newUsername').value = '';
    $('newDisplayName').value = '';
    $('newUserPass').value = '';
    loadUsers();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg err';
  }
});

// Delete user (event delegation)
$('userRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-user]');
  if (!btn) return;
  if (!confirm('Delete this test account?')) return;
  try {
    await api(`/users/${btn.dataset.delUser}`, { method: 'DELETE' });
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
});

$('usersRefreshBtn').addEventListener('click', loadUsers);

/* ---------- Activity Logs ---------- */
async function loadActivity() {
  const tbody = $('activityRows');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>';
  try {
    const userId = $('activityUserFilter').value;
    const limit = $('activityLimit').value;
    const qs = new URLSearchParams({ limit });
    if (userId) qs.set('user_id', userId);
    const { logs } = await api(`/activity?${qs}`);
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">No activity recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map((l) => {
      const target = l.target_type ? `${escapeHtml(l.target_type)}${l.target_id ? ':' + escapeHtml(l.target_id) : ''}` : '—';
      return `
      <tr>
        <td style="font-size:12px;white-space:nowrap;">${l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
        <td><b>${escapeHtml(l.display_name || l.username || 'Unknown')}</b></td>
        <td><span class="micro-label" style="font-size:10px;">${escapeHtml(l.action)}</span></td>
        <td style="font-size:11px;color:var(--muted);white-space:nowrap;">${target}</td>
        <td style="font-size:12px;color:var(--ink-2);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(l.detail || '')}">${escapeHtml(l.detail || '')}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

$('activityRefreshBtn').addEventListener('click', loadActivity);
$('activityUserFilter').addEventListener('change', loadActivity);
$('activityLimit').addEventListener('change', loadActivity);

/* ---------- Boot ---------- */
function boot() {
  renderGalleries();
  loadSlides();
  loadSettings();
  loadList();
  // 管理专属面板：仅 admin 加载
  const user = getUser();
  if (user && user.role === 'admin') {
    loadStats();
    loadUsers();
    loadActivity();
  }
}

(async function init() {
  const allowed = await guard();
  if (allowed) boot();
})();
