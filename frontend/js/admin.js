/**
 * Admin dashboard: access guard + product CRUD + multi-image upload (max 10) + color/style variants
 */
import { detectApiBase, api, getToken, renderNavUser, escapeHtml, productImage } from './api.js';

const CAT_LABEL = { 'chess-timer': 'Chess Timer', 'chess-set': 'Chess Set', apparel: 'Apparel & Gear' };
const MAX_IMAGES = 10;
const $ = (id) => document.getElementById(id);

let pendingImages = [];   // product gallery (base64 data URLs), first = main image
let pendingVariants = []; // [{ color, style, images[] }]

/* ---------- Access guard ---------- */
async function guard() {
  await detectApiBase();
  renderNavUser();
  if (!getToken()) {
    $('deniedMsg').innerHTML = 'Please <b>sign in</b> first. Product upload &amp; management is restricted to super admins.';
    $('deniedPanel').classList.remove('hidden');
    return false;
  }
  try {
    const { user } = await api('/auth/me');
    if (user.role !== 'admin') {
      $('deniedMsg').innerHTML = `Account <b>${escapeHtml(user.username)}</b> has a customer role and can only browse basic content. Product upload &amp; management is restricted to <b>super admins (P001)</b>.`;
      $('deniedPanel').classList.remove('hidden');
      return false;
    }
    $('adminPanel').classList.remove('hidden');
    return true;
  } catch {
    $('deniedMsg').innerHTML = 'Your session has expired. Please sign in again.';
    $('deniedPanel').classList.remove('hidden');
    return false;
  }
}

/* ---------- Product list ---------- */
async function loadList() {
  const tbody = $('productRows');
  try {
    const { products } = await api('/products');
    $('productCount').textContent = `${products.length} item(s)`;
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No products yet — upload your first one on the left.</td></tr>';
      return;
    }
    tbody.innerHTML = products.map((p) => {
      const img = productImage(p);
      const vCount = (p.variants || []).length;
      return `
      <tr>
        <td>${p.id}</td>
        <td>${img
          ? `<img class="thumb" src="${escapeHtml(img)}" alt="" />`
          : '<span class="thumb-ph">♟</span>'}
          <span class="thumb-count">${(p.images || []).length} img</span></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${CAT_LABEL[p.category] || escapeHtml(p.category)}</td>
        <td>$ ${Number(p.price).toFixed(2)}</td>
        <td>${vCount ? `${vCount} variant(s)` : '—'}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" data-act="edit" data-id="${p.id}">Edit</button>
          <button class="btn btn-danger" data-act="del" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `;
    }).join('');
    tbody.dataset.products = JSON.stringify(products);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/* ---------- Form ---------- */
function setMsg(text, ok = true) {
  const msg = $('formMsg');
  msg.textContent = text;
  msg.className = `form-msg ${ok ? 'ok' : 'err'}`;
}

function resetForm() {
  $('productForm').reset();
  $('editId').value = '';
  pendingImages = [];
  pendingVariants = [];
  renderGallery();
  renderVariants();
  $('formTitle').textContent = '♟ Upload New Product';
  $('submitBtn').textContent = 'Save Product';
  setMsg('');
}

function fillForm(p) {
  $('editId').value = p.id;
  $('pName').value = p.name;
  $('pCategory').value = p.category;
  $('pPrice').value = p.price;
  $('pDesc').value = p.description || '';
  pendingImages = [...(p.images || [])];
  pendingVariants = (p.variants || []).map((v) => ({
    color: v.color || '',
    style: v.style || '',
    images: [...(v.images || [])],
  }));
  renderGallery();
  renderVariants();
  $('formTitle').textContent = `♟ Edit Product #${p.id}`;
  $('submitBtn').textContent = 'Save Changes';
  setMsg('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Multi-image gallery ---------- */
function renderGallery() {
  const box = $('imgGallery');
  const items = pendingImages
    .map(
      (src, i) => `
      <div class="gallery-item">
        ${i === 0 ? '<span class="main-flag">Main</span>' : ''}
        <img src="${escapeHtml(src)}" alt="Image ${i + 1}" />
        <button class="rm-img" type="button" data-i="${i}" title="Remove">×</button>
      </div>`
    )
    .join('');
  const addTile =
    pendingImages.length < MAX_IMAGES
      ? `<div class="gallery-add" id="galleryAdd" title="Add image">＋</div>`
      : '';
  box.innerHTML =
    items +
    addTile +
    `<span class="gallery-hint">${pendingImages.length}/${MAX_IMAGES} images${pendingImages.length ? '' : ' — at least 1 main image required'}</span>`;
}

$('imgGallery').addEventListener('click', (e) => {
  if (e.target.closest('#galleryAdd')) {
    $('pImages').click();
    return;
  }
  const rm = e.target.closest('.rm-img');
  if (rm) {
    pendingImages.splice(Number(rm.dataset.i), 1);
    renderGallery();
  }
});

/* Image files → base64 (1.5MB each, 10 in total) */
$('pImages').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  for (const file of files) {
    if (pendingImages.length >= MAX_IMAGES) {
      setMsg(`Max ${MAX_IMAGES} images per product — extra files were skipped.`, false);
      break;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setMsg(`"${file.name}" is too large (max 1.5MB) and was skipped.`, false);
      continue;
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    pendingImages.push(dataUrl);
  }
  renderGallery();
  if (pendingImages.length) setMsg('Images ready — they will be saved to the database with the product.');
});

/* ---------- Color / style variants ---------- */
function renderVariants() {
  const list = $('variantList');
  if (!pendingVariants.length) {
    list.innerHTML = '<p class="variant-empty">No variants yet — the product will show its main gallery only.</p>';
    return;
  }
  list.innerHTML = pendingVariants
    .map(
      (v, i) => `
      <div class="variant-item" data-i="${i}">
        <div class="variant-head">
          <input type="text" class="v-color" placeholder="Color, e.g. Matte Black" value="${escapeHtml(v.color)}" />
          <input type="text" class="v-style" placeholder="Style, e.g. Tournament Edition" value="${escapeHtml(v.style)}" />
          <button class="btn btn-danger v-remove" type="button" title="Remove variant">×</button>
        </div>
        <div class="variant-imgs">
          ${v.images
            .map(
              (src, k) =>
                `<span class="v-thumb"><img src="${escapeHtml(src)}" alt="" /><button type="button" class="rm-vimg" data-k="${k}">×</button></span>`
            )
            .join('')}
          ${v.images.length < MAX_IMAGES ? `<button class="v-add" type="button" title="Upload variant images">＋</button>` : ''}
          <input type="file" class="v-file" accept="image/*" multiple hidden />
        </div>
      </div>`
    )
    .join('');
}

$('addVariantBtn').addEventListener('click', () => {
  pendingVariants.push({ color: '', style: '', images: [] });
  renderVariants();
});

$('variantList').addEventListener('click', async (e) => {
  const item = e.target.closest('.variant-item');
  if (!item) return;
  const i = Number(item.dataset.i);

  if (e.target.closest('.v-remove')) {
    pendingVariants.splice(i, 1);
    renderVariants();
    return;
  }

  const rmImg = e.target.closest('.rm-vimg');
  if (rmImg) {
    pendingVariants[i].images.splice(Number(rmImg.dataset.k), 1);
    renderVariants();
    return;
  }

  if (e.target.closest('.v-add')) {
    item.querySelector('.v-file').click();
  }
});

$('variantList').addEventListener('change', (e) => {
  const item = e.target.closest('.variant-item');
  if (!item) return;
  const i = Number(item.dataset.i);

  if (e.target.classList.contains('v-color')) pendingVariants[i].color = e.target.value;
  if (e.target.classList.contains('v-style')) pendingVariants[i].style = e.target.value;

  if (e.target.classList.contains('v-file')) {
    Array.from(e.target.files || []).forEach((file) => {
      if (pendingVariants[i].images.length >= MAX_IMAGES) return;
      if (file.size > 1.5 * 1024 * 1024) {
        setMsg(`"${file.name}" is too large (max 1.5MB) and was skipped.`, false);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pendingVariants[i].images.push(reader.result);
        renderVariants();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }
});

/* ---------- Submit ---------- */
$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingImages.length) {
    setMsg('Please upload at least 1 main image.', false);
    return;
  }
  const editId = $('editId').value;
  const body = {
    name: $('pName').value,
    category: $('pCategory').value,
    price: $('pPrice').value || 0,
    description: $('pDesc').value,
    images: pendingImages,
    variants: pendingVariants.filter((v) => v.color.trim() || v.style.trim() || v.images.length),
  };
  try {
    if (editId) {
      await api(`/products/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      setMsg(`Product #${editId} updated ✓`);
    } else {
      const { product } = await api('/products', { method: 'POST', body: JSON.stringify(body) });
      setMsg(`Product "${product.name}" uploaded ✓`);
    }
    resetForm();
    loadList();
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
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }
});

(async function init() {
  const allowed = await guard();
  if (allowed) {
    renderGallery();
    renderVariants();
    loadList();
  }
})();
