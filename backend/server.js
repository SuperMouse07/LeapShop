/**
 * LeapChess 后端服务
 * - /api/auth   登录认证（JWT）
 * - /api/products 商品 CRUD（读公开，写仅管理员）
 * - 可选托管 ../frontend 静态文件（单服务模式，便于 Zeabur 一键部署）
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db, connect, initSchema, usePg, storageStats } = require('./db');
const { seed } = require('./seed');

const PORT = Number(process.env.PORT || 3000); // Zeabur 会注入 PORT（默认 8080）
const JWT_SECRET = process.env.JWT_SECRET || 'leapchess-dev-secret-change-me';
const TOKEN_TTL = '12h';
const MAX_IMAGES = 10; // 每件商品（含变体图集）最多图片数
// 图片文件目录：生产指向 Zeabur 挂载的 Volume（如 /data/uploads），本地回退 backend/data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '80mb' })); // 多图 base64 内嵌提交：单商品图片总量上限 50MB（二进制口径），base64 膨胀约 1/3 后约 67MB，预留 JSON 开销余量

/* ---------------- 数据规整工具 ---------------- */
/** 排序权重归一：undefined = 不改动；null/空串 = 清除权重；其余截断为整数 */
function toSortWeight(v, fallback = null) {
  if (v === undefined) return fallback;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** 商品列表统一排序：已设权重者优先（权重升序，同权重按上传时间倒序），未设权重者按上传时间倒序 */
const PRODUCTS_ORDER = 'ORDER BY (sort_weight IS NULL) ASC, sort_weight ASC, created_at DESC, id DESC';

/** 归一化图片集合：兼容旧单图字段 / JSON 字符串 / 数组，最多 MAX_IMAGES 张 */
function toImages(value, legacySingle = '') {
  let arr = [];
  if (Array.isArray(value)) arr = value;
  else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { arr = JSON.parse(value); } catch { arr = []; }
  } else if (typeof value === 'string' && value.trim()) arr = [value];
  if (!arr.length && legacySingle) arr = [legacySingle];
  return arr.filter((s) => typeof s === 'string' && s.length > 0).slice(0, MAX_IMAGES);
}

/** 归一化变体：[{ color, style, images[] }] */
function toVariants(value) {
  let arr = [];
  if (Array.isArray(value)) arr = value;
  else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { arr = JSON.parse(value); } catch { arr = []; }
  }
  return arr
    .filter((v) => v && typeof v === 'object')
    .map((v) => ({
      color: String(v.color || '').trim(),
      style: String(v.style || '').trim(),
      images: toImages(v.images),
    }))
    .filter((v) => v.color || v.style || v.images.length);
}

/** 归一化卖点文案：JSON 字符串 / 数组 → 字符串数组 */
function toInfo(value) {
  let arr = [];
  if (Array.isArray(value)) arr = value;
  else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { arr = JSON.parse(value); } catch { arr = []; }
  }
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

/** 出库前把 JSON 文本列解析为数组，便于前端直接使用 */
function parseProduct(p) {
  if (!p) return p;
  return {
    ...p,
    images: toImages(p.images, p.image),
    variants: toVariants(p.variants),
    details: toImages(p.details),
    info: toInfo(p.info),
  };
}

/* ---------------- 图片落盘（数据库只存 URL 引用） ---------------- */
const DATA_URL_RE = /^data:image\/([\w.+-]+);base64,([\s\S]+)$/;

/** base64 图片写入磁盘，以内容哈希命名（天然去重、迁移幂等），返回 /uploads/... URL */
function saveDataUrl(dataUrl) {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return null;
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const rawExt = m[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt;
    const sub = hash.slice(0, 2);
    const abs = path.join(UPLOAD_DIR, sub, `${hash}.${ext}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
    return `/uploads/${sub}/${hash}.${ext}`;
  } catch {
    return null;
  }
}

/** 图片列表物化：data URL 落盘转 URL，已有 URL 原样保留；落盘失败的 data URL 丢弃（避免把长串 base64 写进数据库） */
function materializeImages(list) {
  return list
    .map((src) => {
      if (typeof src === 'string' && src.startsWith('data:')) return saveDataUrl(src);
      return typeof src === 'string' ? src : null;
    })
    .filter(Boolean);
}

function materializeVariants(variants) {
  return variants.map((v) => ({ ...v, images: materializeImages(v.images) }));
}

/** 收集商品引用的全部 /uploads URL（主图 + 变体图集 + 详情图） */
function productUploadUrls(p) {
  const urls = [];
  for (const src of p.images || []) {
    if (typeof src === 'string' && src.startsWith('/uploads/')) urls.push(src);
  }
  for (const v of p.variants || []) {
    for (const src of v.images || []) {
      if (typeof src === 'string' && src.startsWith('/uploads/')) urls.push(src);
    }
  }
  for (const src of p.details || []) {
    if (typeof src === 'string' && src.startsWith('/uploads/')) urls.push(src);
  }
  return urls;
}

/** best-effort 清理不再被任何商品/轮播图引用的磁盘文件（内容哈希去重下安全） */
async function removeUnreferenced(urls) {
  try {
    const rows = await db.query('SELECT images, variants, details FROM products');
    const slides = await db.query('SELECT image FROM slides');
    for (const url of new Set(urls)) {
      const referenced =
        rows.some(
          (r) =>
            String(r.images || '').includes(url) ||
            String(r.variants || '').includes(url) ||
            String(r.details || '').includes(url)
        ) || slides.some((s) => String(s.image || '') === url);
      if (referenced) continue;
      const abs = path.join(UPLOAD_DIR, url.slice('/uploads/'.length));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  } catch (err) {
    console.warn('[leapchess] 图片文件清理失败（忽略）:', err.message);
  }
}

/** 递归统计目录占用（字节数 + 文件数） */
function dirStats(dir) {
  try {
    let bytes = 0;
    let files = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = dirStats(full);
        bytes += sub.bytes;
        files += sub.files;
      } else {
        bytes += fs.statSync(full).size;
        files += 1;
      }
    }
    return { bytes, files };
  } catch {
    return { bytes: 0, files: 0 };
  }
}

/** 所在文件系统容量统计（Node ≥18.15 的 statfs；挂载点上即 Volume 硬盘容量与剩余） */
function volumeStats(dir) {
  if (typeof fs.statfsSync !== 'function') return { totalBytes: 0, freeBytes: 0 };
  try {
    const s = fs.statfsSync(dir);
    return { totalBytes: Number(s.blocks) * Number(s.bsize), freeBytes: Number(s.bavail) * Number(s.bsize) };
  } catch { return { totalBytes: 0, freeBytes: 0 }; }
}

/** 解析 /uploads/... URL 对应的磁盘文件并返回字节数（不存在/非法路径计 0） */
function uploadFileBytes(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return 0;
  const rel = url.slice('/uploads/'.length);
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return 0;
  try {
    const st = fs.statSync(path.join(UPLOAD_DIR, rel));
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

/** 单商品存储明细：图片文件数/磁盘字节（按 URL 去重） + JSON 记录字节 */
function productStorageDetail(p) {
  const urls = new Set(productUploadUrls(p));
  let imageFileBytes = 0;
  for (const url of urls) imageFileBytes += uploadFileBytes(url);
  const jsonBytes = Buffer.byteLength(JSON.stringify(p), 'utf8');
  return {
    imageFileCount: urls.size,
    imageFileBytes,
    jsonBytes,
    totalBytes: imageFileBytes + jsonBytes,
  };
}

/* ---------------- 认证中间件 ---------------- */
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Super admin access required' });
}

/** 编辑权限：admin + tester 均可执行商品/轮播/设置 CRUD（运营操作统一入口） */
function editorOnly(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'tester')) return next();
  res.status(403).json({ error: 'Editor access required (admin or tester)' });
}

/** 可选鉴权：不阻断请求，仅判断携带的 token 是否为有效编辑者（admin/tester），用于公开接口的编辑增强 */
function bearerEditor(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return false;
  try {
    const user = jwt.verify(token, JWT_SECRET);
    return Boolean(user && (user.role === 'admin' || user.role === 'tester'));
  } catch {
    return false;
  }
}

/* ---------------- 认证接口 ---------------- */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }
  const rows = await db.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, display_name: user.display_name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
  // 记录登录事件
  await logActivity(user.id, 'login', `User ${user.username} signed in`);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name || user.username },
  });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

/* ---------------- 测试账户注册（内部测试阶段，管理员可创建账户） ---------------- */
app.post('/api/auth/register', authRequired, adminOnly, async (req, res) => {
  const { username, password, role, display_name } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const allowedRoles = ['tester', 'demo'];
  const targetRole = allowedRoles.includes(role) ? role : 'tester';
  // 用户名唯一性校验
  const existing = await db.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const { id } = await db.run(
    'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
    [username.trim(), hash, targetRole, (display_name || username).trim()]
  );
  res.status(201).json({ user: { id, username: username.trim(), role: targetRole, display_name: (display_name || username).trim() } });
});

/** 当前用户修改自己的密码 */
app.put('/api/auth/password', authRequired, async (req, res) => {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) {
    return res.status(400).json({ error: 'Old and new password are required' });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(old_password, user.password_hash)) {
    return res.status(401).json({ error: 'Old password is incorrect' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
});

/* ---------------- 用户管理（管理员） ---------------- */
app.get('/api/users', authRequired, adminOnly, async (req, res) => {
  const rows = await db.query('SELECT id, username, role, display_name, created_at FROM users ORDER BY id ASC');
  res.json({ users: rows });
});

app.delete('/api/users/:id', authRequired, adminOnly, async (req, res) => {
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  if (rows[0].role === 'admin') {
    return res.status(403).json({ error: 'Cannot delete admin accounts' });
  }
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/** 管理员重置测试账户密码 */
app.put('/api/users/:id/password', authRequired, adminOnly, async (req, res) => {
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const rows = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  const hash = bcrypt.hashSync(new_password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
  res.json({ ok: true });
});

/* ---------------- 活动日志（操作审计追溯） ---------------- */
/**
 * 写入活动日志（含审计详情：操作对象类型/ID + 变更描述）
 * - userId: 操作人 ID
 * - action: 事件类型（login / page_view / product_create / product_update / product_delete / slide_create ...）
 * - detail: 人可读的操作描述
 * - targetType: 操作对象类型（product / slide / setting / user）
 * - targetId: 操作对象 ID
 */
async function logActivity(userId, action, detail, targetType = '', targetId = '') {
  try {
    await db.run(
      'INSERT INTO activity_logs (user_id, action, detail, target_type, target_id) VALUES (?, ?, ?, ?, ?)',
      [userId, action, detail || '', targetType, String(targetId)]
    );
  } catch (err) {
    console.warn('[leapchess] 活动日志写入失败（忽略）:', err.message);
  }
}

/** 生成字段级变更摘要（仅记录实际变化的字段，避免日志膨胀） */
function diffChanges(oldObj, newObj, fields) {
  const changes = [];
  for (const f of fields) {
    const oldVal = oldObj[f];
    const newVal = newObj[f];
    // 统一比较：JSON.stringify 处理数组/对象；基础类型直接比较
    const oldStr = (oldVal !== undefined && oldVal !== null) ? String(oldVal) : '';
    const newStr = (newVal !== undefined && newVal !== null) ? String(newVal) : '';
    if (oldStr !== newStr) {
      changes.push(`${f}: "${oldStr.slice(0, 80)}" → "${newStr.slice(0, 80)}"`);
    }
  }
  return changes.length ? changes.join('; ') : '';
}

/** 记录前台交互事件（测试员操作追溯） */
app.post('/api/activity', authRequired, async (req, res) => {
  const { action, detail } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Action is required' });
  await logActivity(req.user.id, action, detail || '');
  res.json({ ok: true });
});

/** 管理员查看活动日志（支持分页 + 按用户筛选） */
app.get('/api/activity', authRequired, adminOnly, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const userId = req.query.user_id;
  let rows;
  if (userId) {
    rows = await db.query(
      'SELECT al.*, u.username, u.display_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.user_id = ? ORDER BY al.created_at DESC LIMIT ?',
      [userId, limit]
    );
  } else {
    rows = await db.query(
      'SELECT al.*, u.username, u.display_name FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT ?',
      [limit]
    );
  }
  res.json({ logs: rows });
});

/* ---------------- 商品接口 ---------------- */
// 列表（公开，可按分类过滤；排序：人工权重升序 → 上传时间倒序）
app.get('/api/products', async (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    rows = await db.query(`SELECT * FROM products WHERE category = ? ${PRODUCTS_ORDER}`, [category]);
  } else {
    rows = await db.query(`SELECT * FROM products ${PRODUCTS_ORDER}`);
  }
  res.json({ products: rows.map(parseProduct) });
});

// 详情（公开）
app.get('/api/products/:id', async (req, res) => {
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: parseProduct(rows[0]) });
});

// 单商品存储明细（管理员）：图片文件数/磁盘字节 + JSON 记录字节
app.get('/api/products/:id/storage', authRequired, adminOnly, async (req, res) => {
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  const p = parseProduct(rows[0]);
  res.json({ id: p.id, name: p.name, ...productStorageDetail(p) });
});

// 新增（编辑者：admin/tester）
app.post('/api/products', authRequired, editorOnly, async (req, res) => {
  const { name, category, price, description, image, images, variants, details, info, stock, sort_weight, sku } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const imgList = materializeImages(toImages(images, image));
  if (!imgList.length) {
    return res.status(400).json({ error: 'Please upload at least 1 main image' });
  }
  const detailList = materializeImages(toImages(details));
  const { id } = await db.run(
    'INSERT INTO products (sku, name, category, price, description, image, images, variants, details, info, stock, sort_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      sku !== undefined ? String(sku).trim() : '',
      String(name).trim(),
      category || 'chess-timer',
      Number(price) || 0,
      description || '',
      imgList[0],
      JSON.stringify(imgList),
      JSON.stringify(materializeVariants(toVariants(variants))),
      JSON.stringify(detailList),
      JSON.stringify(toInfo(info)),
      Number(stock) || 0,
      toSortWeight(sort_weight),
    ]
  );
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  const created = parseProduct(rows[0]);
  // 审计日志：仅在实际落盘成功后记录
  await logActivity(
    req.user.id, 'product_create',
    `Created product "${created.name}" (id:${id}, category:${created.category}, $${created.price})`,
    'product', id
  );
  res.status(201).json({ product: created });
});

// 更新（编辑者：admin/tester）
app.put('/api/products/:id', authRequired, editorOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Product not found' });
  const p = parseProduct(exist[0]);
  const b = req.body || {};
  const oldUrls = productUploadUrls(p);
  const hasNewImages = b.images !== undefined || b.image !== undefined;
  const imgList = materializeImages(hasNewImages ? toImages(b.images, b.image) : p.images);
  if (!imgList.length) {
    return res.status(400).json({ error: 'Please upload at least 1 main image' });
  }
  const variantList = b.variants !== undefined ? materializeVariiants(toVariants(b.variants)) : p.variants;
  const hasNewDetails = b.details !== undefined;
  const detailList = materializeImages(hasNewDetails ? toImages(b.details) : p.details);
  const infoList = b.info !== undefined ? toInfo(b.info) : p.info;
  // 计算变更字段（审计用，落盘前快照）
  const changes = diffChanges(
    { name: p.name, category: p.category, price: String(p.price), stock: String(p.stock), description: p.description, sku: p.sku, sort_weight: String(p.sort_weight ?? '') },
    { name: b.name !== undefined ? String(b.name).trim() : p.name, category: b.category !== undefined ? b.category : p.category, price: String(b.price !== undefined ? Number(b.price) || 0 : p.price), stock: String(b.stock !== undefined ? Number(b.stock) || 0 : p.stock), description: b.description !== undefined ? b.description : p.description, sku: b.sku !== undefined ? String(b.sku).trim() : p.sku, sort_weight: String(toSortWeight(b.sort_weight, p.sort_weight ?? null) ?? '') },
    ['name', 'category', 'price', 'stock', 'description', 'sku', 'sort_weight']
  );
  await db.run(
    `UPDATE products SET sku = ?, name = ?, category = ?, price = ?, description = ?, image = ?, images = ?, variants = ?, details = ?, info = ?, stock = ?, sort_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      b.sku !== undefined ? String(b.sku).trim() : p.sku,
      b.name !== undefined ? String(b.name).trim() : p.name,
      b.category !== undefined ? b.category : p.category,
      b.price !== undefined ? Number(b.price) || 0 : p.price,
      b.description !== undefined ? b.description : p.description,
      imgList[0],
      JSON.stringify(imgList),
      JSON.stringify(variantList),
      JSON.stringify(detailList),
      JSON.stringify(infoList),
      b.stock !== undefined ? Number(b.stock) || 0 : p.stock,
      toSortWeight(b.sort_weight, p.sort_weight ?? null),
      req.params.id,
    ]
  );
  await removeUnreferenced(oldUrls); // 旧图被替换后，仅当无其他商品引用才删除文件
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  const updated = parseProduct(rows[0]);
  // 审计日志：仅记录实际变化的字段
  if (changes) {
    await logActivity(
      req.user.id, 'product_update',
      `Updated "${updated.name}" (id:${req.params.id}): ${changes}`,
      'product', req.params.id
    );
  }
  res.json({ product: updated });
});

// 删除（编辑者：admin/tester）；若删的是主推款，自动清空主推设置
app.delete('/api/products/:id', authRequired, editorOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Product not found' });
  const deleted = parseProduct(exist[0]);
  const urls = productUploadUrls(deleted);
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  const heroRows = await db.query("SELECT value FROM settings WHERE key = 'hero_product_id'");
  if (heroRows[0] && String(heroRows[0].value) === String(req.params.id)) {
    await upsertSetting('hero_product_id', ''); // 重置为无主推（settings 单键 upsert 天然幂等）
  }
  await removeUnreferenced(urls);
  // 审计日志：记录被删商品的名称与关键属性
  await logActivity(
    req.user.id, 'product_delete',
    `Deleted product "${deleted.name}" (id:${req.params.id}, category:${deleted.category}, $${deleted.price})`,
    'product', req.params.id
  );
  res.json({ ok: true });
});

/* ---------------- 首页轮播图（slides）接口 ---------------- */
// 列表（公开，按 sort 升序仅返回启用项；管理员携 token 加 ?all=1 返回全部）
app.get('/api/slides', async (req, res) => {
  const all = req.query.all === '1' && bearerEditor(req);
  const rows = all
    ? await db.query('SELECT * FROM slides ORDER BY sort ASC, id ASC')
    : await db.query('SELECT * FROM slides WHERE enabled = 1 ORDER BY sort ASC, id ASC');
  res.json({ slides: rows });
});

// 新增（编辑者）：image 支持 data URL 自动落盘；sort 缺省追加到末尾
app.post('/api/slides', authRequired, editorOnly, async (req, res) => {
  const { image, alt, sort, enabled } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Slide image is required' });
  }
  const src = image.startsWith('data:') ? saveDataUrl(image) : image;
  if (!src) return res.status(400).json({ error: 'Invalid image data' });
  let sortVal;
  if (sort !== undefined) {
    sortVal = Number(sort) || 0;
  } else {
    const rows = await db.query('SELECT COALESCE(MAX(sort), 0) AS m FROM slides');
    sortVal = Number(rows[0].m) + 1;
  }
  const { id } = await db.run('INSERT INTO slides (image, alt, sort, enabled) VALUES (?, ?, ?, ?)', [
    src,
    String(alt || '').trim(),
    sortVal,
    enabled === 0 || enabled === false ? 0 : 1,
  ]);
  const rows = await db.query('SELECT * FROM slides WHERE id = ?', [id]);
  await logActivity(
    req.user.id, 'slide_create',
    `Created slide (id:${id}, alt:"${String(alt || '').trim()}", sort:${sortVal})`,
    'slide', id
  );
  res.status(201).json({ slide: rows[0] });
});

// 更新（编辑者）：alt / sort / enabled / image
app.put('/api/slides/:id', authRequired, editorOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM slides WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Slide not found' });
  const s = exist[0];
  const b = req.body || {};
  const oldUrl = s.image;
  let img = s.image;
  if (b.image !== undefined) {
    img = typeof b.image === 'string' && b.image.startsWith('data:') ? saveDataUrl(b.image) : b.image;
    if (!img) return res.status(400).json({ error: 'Invalid image data' });
  }
  const changes = diffChanges(
    { alt: s.alt, sort: String(s.sort), enabled: String(s.enabled) },
    { alt: b.alt !== undefined ? String(b.alt).trim() : s.alt, sort: String(b.sort !== undefined ? Number(b.sort) || 0 : s.sort), enabled: String(b.enabled !== undefined ? (b.enabled ? 1 : 0) : s.enabled) },
    ['alt', 'sort', 'enabled']
  );
  await db.run('UPDATE slides SET image = ?, alt = ?, sort = ?, enabled = ? WHERE id = ?', [
    img,
    b.alt !== undefined ? String(b.alt).trim() : s.alt,
    b.sort !== undefined ? Number(b.sort) || 0 : s.sort,
    b.enabled !== undefined ? (b.enabled ? 1 : 0) : s.enabled,
    req.params.id,
  ]);
  if (img !== oldUrl) await removeUnreferenced([oldUrl]);
  const rows = await db.query('SELECT * FROM slides WHERE id = ?', [req.params.id]);
  if (changes || img !== oldUrl) {
    const detail = [changes, img !== oldUrl ? 'image: replaced' : ''].filter(Boolean).join('; ');
    await logActivity(req.user.id, 'slide_update', `Updated slide (id:${req.params.id}): ${detail}`, 'slide', req.params.id);
  }
  res.json({ slide: rows[0] });
});

// 删除（编辑者）+ 无引用磁盘清理
app.delete('/api/slides/:id', authRequired, editorOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM slides WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Slide not found' });
  await db.run('DELETE FROM slides WHERE id = ?', [req.params.id]);
  await removeUnreferenced([exist[0].image]);
  await logActivity(req.user.id, 'slide_delete', `Deleted slide (id:${req.params.id}, alt:"${exist[0].alt}")`, 'slide', req.params.id);
  res.json({ ok: true });
});

/* ---------------- 全站设置（settings 表） ---------------- */
const SETTINGS_KEYS = ['site_title', 'logo_url', 'announcement_html', 'contact_email', 'contact_social', 'hero_product_id'];

/** settings 表 upsert（双方言兼容：PG 不能用 db.run，其会自动追加 RETURNING id） */
async function upsertSetting(key, value) {
  if (db.type === 'postgresql') {
    await db.query(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  } else {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

// 公开：返回全部设置（前台渲染 title/LOGO/公告/联系方式）
app.get('/api/settings', async (req, res) => {
  const rows = await db.query('SELECT key, value FROM settings');
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

// 编辑者：更新单项设置
app.put('/api/settings', authRequired, editorOnly, async (req, res) => {
  const { key, value } = req.body || {};
  if (!SETTINGS_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Unknown setting key' });
  }
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'Value must be a string' });
  }
  if (Buffer.byteLength(value, 'utf8') > 64 * 1024) {
    return res.status(400).json({ error: 'Setting value too large' });
  }
  if (key === 'hero_product_id' && value !== '') {
    // 主推款唯一性：单键 upsert 天然保证同一时间只有一个；仅允许指向真实存在的商品
    if (!/^\d+$/.test(value)) {
      return res.status(400).json({ error: 'hero_product_id must be a product id or empty' });
    }
    const rows = await db.query('SELECT id FROM products WHERE id = ?', [Number(value)]);
    if (!rows[0]) {
      return res.status(400).json({ error: 'Product not found for hero setting' });
    }
  }
  // 审计：对比旧值
  const oldRows = await db.query('SELECT value FROM settings WHERE key = ?', [key]);
  const oldValue = oldRows[0] ? oldRows[0].value : '';
  await upsertSetting(key, value);
  if (oldValue !== value) {
    const displayOld = key === 'logo_url' ? (oldValue || '(empty)') : oldValue.slice(0, 60);
    const displayNew = key === 'logo_url' ? (value || '(empty)') : value.slice(0, 60);
    await logActivity(req.user.id, 'setting_update', `Setting "${key}" changed: "${displayOld}" → "${displayNew}"`, 'setting', key);
  }
  res.json({ ok: true, key });
});

// 编辑者：LOGO 上传（dataURL → 落盘 /uploads/ → 写入 settings.logo_url）
app.post('/api/settings/logo', authRequired, editorOnly, async (req, res) => {
  const oldRows = await db.query("SELECT value FROM settings WHERE key = 'logo_url'");
  const url = saveDataUrl(req.body && req.body.image);
  if (!url) return res.status(400).json({ error: 'Unsupported or invalid image data' });
  await upsertSetting('logo_url', url);
  // 旧 LOGO 若为落盘图片且无其它引用则清理
  if (oldRows[0]) await removeUnreferenced([oldRows[0].value]);
  await logActivity(req.user.id, 'setting_update', `LOGO updated: ${(oldRows[0]?.value || '(none)')} → ${url}`, 'setting', 'logo_url');
  res.json({ url });
});

/* ---------------- 存储统计（管理员） ---------------- */
app.get('/api/stats/storage', authRequired, adminOnly, async (req, res) => {
  const { totalBytes: dbBytes, productBytes: dbProductBytes } = await storageStats();
  const uploads = dirStats(UPLOAD_DIR); // 图片文件落盘占用（生产为 Volume 挂载点，含轮播图/LOGO）
  const [{ c }] = await db.query('SELECT COUNT(*) AS c FROM products');
  // 商品图片占用：仅累计商品引用的图片文件，排除轮播图/LOGO，保证“商品数据占比”口径准确
  const rows = await db.query('SELECT * FROM products');
  const productUrls = new Set();
  for (const row of rows) {
    for (const u of productUploadUrls(parseProduct(row))) productUrls.add(u);
  }
  let productImageBytes = 0;
  for (const u of productUrls) productImageBytes += uploadFileBytes(u);
  const totalBytes = dbBytes + uploads.bytes; // 数据实际占用 = 数据库 + 图片文件
  const volume = volumeStats(UPLOAD_DIR); // 磁盘容量/剩余（与 totalBytes 口径不同：一个是占用，一个是容量）
  // 数据库系统开销 = 库内非商品表部分（目录表/用户表/WAL 等），占比按总体积计算
  const overheadBytes = Math.max(0, dbBytes - dbProductBytes);
  res.json({
    dbType: db.type,
    totalBytes,
    productBytes: dbProductBytes + productImageBytes,
    productCount: Number(c),
    imageFileCount: uploads.files,
    imageFileBytes: uploads.bytes,
    productImageBytes,
    overheadBytes,
    overheadRatio: totalBytes > 0 ? Number(((overheadBytes / totalBytes) * 100).toFixed(1)) : 0,
    volumeTotalBytes: volume.totalBytes,
    volumeFreeBytes: volume.freeBytes,
  });
});

/* ---------------- 健康检查 ---------------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: db.type, time: new Date().toISOString() });
});

/* ---------------- 上传图片静态服务（内容哈希命名，可长缓存） ---------------- */
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

/* ---------------- 静态前端（单服务模式） ---------------- */
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    // 存在的静态页面（如 product.html）直接返回，其余路由回退首页
    const candidate = path.join(frontendDir, req.path);
    if (!req.path.includes('..') && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return res.sendFile(candidate);
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

/* ---------------- 启动 ---------------- */
(async () => {
  await connect();
  if (!usePg) {
    if (process.env.DATA_DIR) {
      console.log(`[leapchess] SQLite 数据目录: ${process.env.DATA_DIR}（已启用 Volume 持久化）`);
    } else {
      console.warn(
        '[leapchess] 警告: 未检测到 DATABASE_URL/PGHOST，当前使用 SQLite 回退。' +
        'Zeabur 文件系统无状态，重新部署会丢失 SQLite 数据，生产环境请添加 PostgreSQL 服务并注入 DATABASE_URL，或挂载 Volume 并设置 DATA_DIR。'
      );
    }
  }
  await initSchema();
  await seed(); // 幂等：仅当缺失时写入预设账户与占位商品
  console.log(`[leapchess] 图片目录: ${UPLOAD_DIR}${process.env.UPLOAD_DIR ? '（Volume）' : ''}`);
  // 检测 UPLOAD_DIR 是否位于独立挂载点（Volume）：与根文件系统同设备意味着图片落在临时盘，重新部署即丢失
  // 仅在显式设置 UPLOAD_DIR（生产意图）时检测，本地开发不告警
  if (process.env.UPLOAD_DIR) {
    try {
      const stDir = fs.statSync(UPLOAD_DIR);
      const stRoot = fs.statSync(path.parse(UPLOAD_DIR).root || '/');
      if (stDir.dev === stRoot.dev) {
        console.warn(
          '[leapchess] 警告: UPLOAD_DIR 不在 Volume 挂载点上，图片文件存于临时文件系统，重新部署将全部丢失！' +
          '请在 Zeabur 给主程序服务挂载硬盘（如挂载目录 /data）并确保 UPLOAD_DIR 位于其下。'
        );
      }
    } catch { /* 忽略检测异常，不影响启动 */ }
  }
  app.listen(PORT, () => {
    console.log(`[leapchess] API 已启动: http://localhost:${PORT} (数据库: ${usePg ? 'PostgreSQL' : 'SQLite'})`);
  });
})().catch((err) => {
  console.error('[leapchess] 启动失败:', err);
  process.exit(1);
});
