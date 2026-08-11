/**
 * Admin dashboard: access guard + product CRUD (create/edit/delete) + inline image upload
 */
import { detectApiBase, api, getToken, renderNavUser, escapeHtml } from './api.js';

const CAT_LABEL = { 'chess-timer': 'Chess Timer', 'chess-set': 'Chess Set', apparel: 'Apparel & Gear' };
const $ = (id) => document.getElementById(id);

let pendingImage = ''; // current form image (base64 data URL or existing value)

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
    tbody.innerHTML = products.map((p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.image
          ? `<img class="thumb" src="${escapeHtml(p.image)}" alt="" />`
          : '<span class="thumb-ph">♟</span>'}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${CAT_LABEL[p.category] || escapeHtml(p.category)}</td>
        <td>$ ${Number(p.price).toFixed(2)}</td>
        <td>${p.stock}</td>
        <td class="row-actions">
          <button class="btn btn-ghost" data-act="edit" data-id="${p.id}">Edit</button>
          <button class="btn btn-danger" data-act="del" data-id="${p.id}">Delete</button>
        </td>
      </tr>
    `).join('');
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
  pendingImage = '';
  $('imgPreview').classList.add('hidden');
  $('formTitle').textContent = '♟ Upload New Product';
  $('submitBtn').textContent = 'Save Product';
  setMsg('');
}

function fillForm(p) {
  $('editId').value = p.id;
  $('pName').value = p.name;
  $('pCategory').value = p.category;
  $('pPrice').value = p.price;
  $('pStock').value = p.stock;
  $('pDesc').value = p.description || '';
  pendingImage = p.image || '';
  renderPreview();
  $('formTitle').textContent = `♟ Edit Product #${p.id}`;
  $('submitBtn').textContent = 'Save Changes';
  setMsg('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPreview() {
  const box = $('imgPreview');
  if (pendingImage) {
    box.innerHTML = `<img src="${escapeHtml(pendingImage)}" alt="Preview" />`;
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

/* Image file → base64 (1.5MB limit) */
$('pImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    setMsg('Image too large (max 1.5MB). Please compress and retry.', false);
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = reader.result;
    renderPreview();
    setMsg('Image ready — it will be saved to the database with the product.');
  };
  reader.readAsDataURL(file);
});

$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = $('editId').value;
  const body = {
    name: $('pName').value,
    category: $('pCategory').value,
    price: $('pPrice').value || 0,
    stock: $('pStock').value || 0,
    description: $('pDesc').value,
    image: pendingImage,
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
  if (allowed) loadList();
})();
