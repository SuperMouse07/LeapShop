/**
 * LeapChess 后端服务
 * - /api/auth   登录认证（JWT）
 * - /api/products 商品 CRUD（读公开，写仅管理员）
 * - 可选托管 ../frontend 静态文件（单服务模式，便于 Zeabur 一键部署）
 */
const path = require('path');
const fs = require('fs');
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

const app = express();
app.use(cors());
app.use(express.json({ limit: '24mb' })); // 多图 base64 内嵌存储

/* ---------------- 数据规整工具 ---------------- */
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

/** 出库前把 JSON 文本列解析为数组，便于前端直接使用 */
function parseProduct(p) {
  if (!p) return p;
  return {
    ...p,
    images: toImages(p.images, p.image),
    variants: toVariants(p.variants),
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
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

/* ---------------- 商品接口 ---------------- */
// 列表（公开，可按分类过滤）
app.get('/api/products', async (req, res) => {
  const { category } = req.query;
  let rows;
  if (category) {
    rows = await db.query('SELECT * FROM products WHERE category = ? ORDER BY id DESC', [category]);
  } else {
    rows = await db.query('SELECT * FROM products ORDER BY id DESC');
  }
  res.json({ products: rows.map(parseProduct) });
});

// 详情（公开）
app.get('/api/products/:id', async (req, res) => {
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: parseProduct(rows[0]) });
});

// 新增（管理员）
app.post('/api/products', authRequired, adminOnly, async (req, res) => {
  const { name, category, price, description, image, images, variants, stock } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const imgList = toImages(images, image);
  if (!imgList.length) {
    return res.status(400).json({ error: 'Please upload at least 1 main image' });
  }
  const { id } = await db.run(
    'INSERT INTO products (name, category, price, description, image, images, variants, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      String(name).trim(),
      category || 'chess-timer',
      Number(price) || 0,
      description || '',
      imgList[0],
      JSON.stringify(imgList),
      JSON.stringify(toVariants(variants)),
      Number(stock) || 0,
    ]
  );
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  res.status(201).json({ product: parseProduct(rows[0]) });
});

// 更新（管理员）
app.put('/api/products/:id', authRequired, adminOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Product not found' });
  const p = parseProduct(exist[0]);
  const b = req.body || {};
  const hasNewImages = b.images !== undefined || b.image !== undefined;
  const imgList = hasNewImages ? toImages(b.images, b.image) : p.images;
  if (!imgList.length) {
    return res.status(400).json({ error: 'Please upload at least 1 main image' });
  }
  await db.run(
    `UPDATE products SET name = ?, category = ?, price = ?, description = ?, image = ?, images = ?, variants = ?, stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      b.name !== undefined ? String(b.name).trim() : p.name,
      b.category !== undefined ? b.category : p.category,
      b.price !== undefined ? Number(b.price) || 0 : p.price,
      b.description !== undefined ? b.description : p.description,
      imgList[0],
      JSON.stringify(imgList),
      JSON.stringify(b.variants !== undefined ? toVariants(b.variants) : p.variants),
      b.stock !== undefined ? Number(b.stock) || 0 : p.stock,
      req.params.id,
    ]
  );
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ product: parseProduct(rows[0]) });
});

// 删除（管理员）
app.delete('/api/products/:id', authRequired, adminOnly, async (req, res) => {
  const exist = await db.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Product not found' });
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------- 存储统计（管理员） ---------------- */
app.get('/api/stats/storage', authRequired, adminOnly, async (req, res) => {
  const { totalBytes, productBytes } = await storageStats();
  const [{ c }] = await db.query('SELECT COUNT(*) AS c FROM products');
  res.json({
    dbType: db.type,
    totalBytes,
    productBytes,
    productCount: Number(c),
  });
});

/* ---------------- 健康检查 ---------------- */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: db.type, time: new Date().toISOString() });
});

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
    console.warn(
      '[leapchess] 警告: 未检测到 DATABASE_URL/PGHOST，当前使用 SQLite 回退。' +
      'Zeabur 文件系统无状态，重新部署会丢失 SQLite 数据，生产环境请添加 PostgreSQL 服务并注入 DATABASE_URL。'
    );
  }
  await initSchema();
  await seed(); // 幂等：仅当缺失时写入预设账户与占位商品
  app.listen(PORT, () => {
    console.log(`[leapchess] API 已启动: http://localhost:${PORT} (数据库: ${usePg ? 'PostgreSQL' : 'SQLite'})`);
  });
})().catch((err) => {
  console.error('[leapchess] 启动失败:', err);
  process.exit(1);
});
