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

/* ---------- Access guard（内置登录） ---------- */
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
    if (user.role !== 'admin') {
      $('deniedMsg').innerHTML = `Account <b>${escapeHtml(user.username)}</b> does not have admin access.`;
      showOnly('deniedPanel');
      return false;
    }
    showOnly('adminPanel');
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
    if (user.role !== 'admin') {
      clearSession();
      msg.textContent = 'This account does not have admin access.';
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
    $('statBar').style.width = `${Math.min(100, ratio)}%`;
    $('statBarLabel').textContent =
      `Product data takes ${ratio.toFixed(1)}% of total storage (${formatBytes(s.productBytes)})`;
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

/* ---------- Product list ---------- */
async function loadList() {
  const tbody = $('productRows');
  try {
    const { products } = await api('/products');
    $('productCount').textContent = `${products.length} item(s)`;
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading">No products yet — add your first one on the left.</td></tr>';
      return;
    }
    tbody.innerHTML = products
      .map((p) => {
        const img = productImage(p);
        return `
        <tr>
          <td>${p.id}</td>
          <td>${img ? `<img class="thumb" src="${escapeHtml(img)}" alt="" />` : '<span class="thumb-ph">♟</span>'}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${CAT_LABEL[p.category] || escapeHtml(p.category)}</td>
          <td class="td-num">$ ${Number(p.price).toFixed(2)}</td>
          <td class="td-num">${Number(p.stock) || 0}</td>
          <td class="td-num">${(p.images || []).length}</td>
          <td class="td-num">${(p.details || []).length}</td>
          <td class="td-num tip-cell" id="rowSize-${p.id}" data-tip="">…</td>
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
    tbody.innerHTML = `<tr><td colspan="10" class="loading">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
  }
}

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
  $('pDesc').value = p.description || '';
  $('pInfo').value = (p.info || []).join('\n');
  pendingImages = [...(p.images || [])];
  pendingDetails = [...(p.details || [])];
  renderGalleries();
  $('formTitle').textContent = `♟ Edit Product #${p.id}`;
  $('submitBtn').textContent = 'Save Changes';
  setMsg('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // variants 不在新界面展示，编辑时不提交以保留旧值
  };
  try {
    const payload = JSON.stringify(body);
    if (payload.length > MAX_BODY_CHARS) {
      setMsg('Images are too large in total (limit ≈ 50MB per product). Please remove some images.', false);
      return;
    }
    if (editId) {
      await api(`/products/${editId}`, { method: 'PUT', body: payload });
      setMsg(`Product #${editId} updated ✓`);
    } else {
      const { product } = await api('/products', { method: 'POST', body: payload });
      setMsg(`Product "${product.name}" uploaded ✓`);
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

/* Row actions (edit / delete) */
$('productRows').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const products = JSON.parse($('productRows').dataset.products || '[]');
  const product = products.find((p) => p.id === Number(btn.dataset.id));
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

/* ---------- Boot ---------- */
function boot() {
  renderGalleries();
  loadStats();
  loadSlides();
  loadSettings();
  loadList();
}

(async function init() {
  const allowed = await guard();
  if (allowed) boot();
})();
