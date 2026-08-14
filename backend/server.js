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

/* ---------------- 图片落盘（数据库只存 URL 引用） ---------------- */
const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([\s\S]+)$/;

/** base64 图片写入磁盘，以内容哈希命名（天然去重、迁移幂等），返回 /uploads/... URL */
function saveDataUrl(dataUrl) {
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return null;
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const sub = hash.slice(0, 2);
    const abs = path.join(UPLOAD_DIR, sub, `${hash}.${ext}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
    return `/uploads/${sub}/${hash}.${ext}`;
  } catch {
    return null;
  }
}

/** 图片列表物化：data URL 落盘转 URL，已有 URL 原样保留 */
function materializeImages(list) {
  return list.map((src) =>
    typeof src === 'string' && src.startsWith('data:') ? saveDataUrl(src) || src : src
  );
}

function materializeVariants(variants) {
  return variants.map((v) => ({ ...v, images: materializeImages(v.images) }));
}

/** 收集商品引用的全部 /uploads URL（主图 + 变体图集） */
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
  return urls;
}

/** best-effort 清理不再被任何商品引用的磁盘文件（内容哈希去重下安全） */
async function removeUnreferenced(urls) {
  try {
    const rows = await db.query('SELECT images, variants FROM products');
    for (const url of new Set(urls)) {
      const referenced = rows.some(
        (r) => String(r.images || '').includes(url) || String(r.variants || '').includes(url)
      );
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

// 单商品存储明细（管理员）：图片文件数/磁盘字节 + JSON 记录字节
app.get('/api/products/:id/storage', authRequired, adminOnly, async (req, res) => {
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  const p = parseProduct(rows[0]);
  res.json({ id: p.id, name: p.name, ...productStorageDetail(p) });
});

// 新增（管理员）
app.post('/api/products', authRequired, adminOnly, async (req, res) => {
  const { name, category, price, description, image, images, variants, stock } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }
  const imgList = materializeImages(toImages(images, image));
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
      JSON.stringify(materializeVariants(toVariants(variants))),
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
  const oldUrls = productUploadUrls(p);
  const hasNewImages = b.images !== undefined || b.image !== undefined;
  const imgList = materializeImages(hasNewImages ? toImages(b.images, b.image) : p.images);
  if (!imgList.length) {
    return res.status(400).json({ error: 'Please upload at least 1 main image' });
  }
  const variantList = b.variants !== undefined ? materializeVariants(toVariants(b.variants)) : p.variants;
  await db.run(
    `UPDATE products SET name = ?, category = ?, price = ?, description = ?, image = ?, images = ?, variants = ?, stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      b.name !== undefined ? String(b.name).trim() : p.name,
      b.category !== undefined ? b.category : p.category,
      b.price !== undefined ? Number(b.price) || 0 : p.price,
      b.description !== undefined ? b.description : p.description,
      imgList[0],
      JSON.stringify(imgList),
      JSON.stringify(variantList),
      b.stock !== undefined ? Number(b.stock) || 0 : p.stock,
      req.params.id,
    ]
  );
  await removeUnreferenced(oldUrls); // 旧图被替换后，仅当无其他商品引用才删除文件
  const rows = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ product: parseProduct(rows[0]) });
});

// 删除（管理员）
app.delete('/api/products/:id', authRequired, adminOnly, async (req, res) => {
  const exist = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!exist[0]) return res.status(404).json({ error: 'Product not found' });
  const urls = productUploadUrls(parseProduct(exist[0]));
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  await removeUnreferenced(urls);
  res.json({ ok: true });
});

/* ---------------- 存储统计（管理员） ---------------- */
app.get('/api/stats/storage', authRequired, adminOnly, async (req, res) => {
  const { totalBytes: dbBytes, productBytes: dbProductBytes } = await storageStats();
  const uploads = dirStats(UPLOAD_DIR); // 图片文件落盘占用（生产为 Volume 挂载点）
  const [{ c }] = await db.query('SELECT COUNT(*) AS c FROM products');
  const totalBytes = dbBytes + uploads.bytes;
  // 数据库系统开销 = 库内非商品表部分（目录表/用户表/WAL 等），占比按总体积计算
  const overheadBytes = Math.max(0, dbBytes - dbProductBytes);
  res.json({
    dbType: db.type,
    totalBytes,
    productBytes: dbProductBytes + uploads.bytes,
    productCount: Number(c),
    imageFileCount: uploads.files,
    imageFileBytes: uploads.bytes,
    overheadBytes,
    overheadRatio: totalBytes > 0 ? Number(((overheadBytes / totalBytes) * 100).toFixed(1)) : 0,
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
