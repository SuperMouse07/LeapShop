/**
 * 种子数据：预设账户 + 方案F 商品/轮播图（图片导入服务器 uploads，数据库只存 URL 引用）
 * - 超级管理员 P001 / 123456
 * - 商品 16 件（分类 chess-clock / chess-board / stopwatch / lifestyle，仅当商品表为空时写入）
 * - 轮播图 3 帧（仅当 slides 表为空时写入）
 * 图片源：frontend/sandbox/prototype-f/assets/（设计存档目录），按 sha1 内容哈希导入 UPLOAD_DIR，幂等。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, connect, initSchema, usePg } = require('./db');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'data', 'uploads');
const SEED_ASSETS_DIR = path.join(__dirname, '..', 'frontend', 'sandbox', 'prototype-f', 'assets');

/**
 * 多角色测试账户（内部测试阶段）
 * - admin  ：全权限管理员（P001）
 * - tester ：测试员，可浏览全部页面并留下操作日志（T001~T005）
 * - demo   ：观察员，只读浏览（D001）
 */
const USERS = [
  { username: 'P001', password: '123456', role: 'admin',  display_name: 'Super Admin' },
  { username: 'T001', password: 'test123', role: 'tester', display_name: 'Tester Alice' },
  { username: 'T002', password: 'test123', role: 'tester', display_name: 'Tester Bob' },
  { username: 'T003', password: 'test123', role: 'tester', display_name: 'Tester Charlie' },
  { username: 'T004', password: 'test123', role: 'tester', display_name: 'Tester Diana' },
  { username: 'T005', password: 'test123', role: 'tester', display_name: 'Tester Evan' },
  { username: 'D001', password: 'demo123', role: 'demo',   display_name: 'Demo Observer' },
];

/** 将方案F资产文件导入 UPLOAD_DIR（sha1 内容哈希命名，天然去重、幂等），返回 /uploads/... URL */
function importAsset(fileName) {
  try {
    const src = path.join(SEED_ASSETS_DIR, fileName);
    if (!fs.existsSync(src)) return null;
    const buf = fs.readFileSync(src);
    if (!buf.length) return null;
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    const ext = path.extname(fileName).slice(1).toLowerCase() || 'png';
    const sub = hash.slice(0, 2);
    const abs = path.join(UPLOAD_DIR, sub, `${hash}.${ext}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs)) fs.writeFileSync(abs, buf);
    return `/uploads/${sub}/${hash}.${ext}`;
  } catch (err) {
    console.warn(`[seed] 资产导入失败（忽略）: ${fileName} ${err.message}`);
    return null;
  }
}

/** 方案F 商品（与沙箱 mock.js 同源；ratio 为前台瀑布流节奏，前端按序分配不入库） */
const PRODUCTS = [
  { name: 'Tournament Pro Chess Clock', category: 'chess-clock', price: 89,
    desc: 'FIDE-grade time control with a gold-rimmed panel and silent keys — precise to the very last second.',
    info: ['Meets FIDE-certified timing standards, with 36 built-in tournament presets including Fischer and Bronstein increments.', 'Gold-rimmed LCD panel and silent dual paddle keys, weighted non-slip base — built for league and club play.'] },
  { name: 'Blitz Trainer Clock', category: 'chess-clock', price: 59,
    desc: 'Born for blitz training — long-travel paddle keys and clearly audible increment alerts.',
    info: ['Key travel and rebound tuned for 3+2 / 5+0 blitz, with three-level adjustable increment alerts.', 'One-hand blind-operation layout; training mode logs per-move time to review your clock management.'] },
  { name: 'League Master Clock', category: 'chess-clock', price: 74,
    desc: 'The club league standard — metal paddle keys with full delay and increment support.',
    info: ['Crisp metal paddle keys; full support for delay and increment modes.', 'Around 1,200 hours of battery life, with a low-battery alert that never interrupts the game.'] },
  { name: 'Cadet Teaching Clock', category: 'chess-clock', price: 35,
    desc: 'The classroom first choice — large digits and simplified three-button operation.',
    info: ['Large-digit LCD and simplified three-button setup — students learn it in 30 seconds.', 'Key-lock against accidental presses, ideal for high-frequency classroom and club use.'] },

  { name: 'Walnut Folding Chess Board', category: 'chess-board', price: 129,
    desc: 'Walnut and maple inlay with gold-leaf detailing; magnetic storage case with a crest metal clasp.',
    info: ['Hand-inlaid walnut and maple squares with gold-leaf detailing; folds into magnetic storage.', 'Family crest metal clasp, velvet-lined interior to protect the pieces, numbered collector card included.'] },
  { name: 'Club Series Tournament Mat', category: 'chess-board', price: 45,
    desc: 'The club-standard vinyl roll-up mat — matte anti-glare squares, roll and go.',
    info: ['Matte vinyl squares eliminate glare; league-standard 57mm square size.', 'Rolls up instantly, strap and carry tube included — easy transport for away matches.'] },
  { name: 'Maple Classic Solid Board', category: 'chess-board', price: 98,
    desc: 'Solid maple, hand-polished with a matte lacquer — an heirloom surface that improves with age.',
    info: ['CNC-engraved grid lines on a single solid maple board; matte lacquer preserves the wood feel.', 'Soft cork feet protect your table — perfect for long-displayed parlour games.'] },
  { name: 'Travel Magnetic Board', category: 'chess-board', price: 52,
    desc: 'Folding magnetic set — pieces lock in place, so nothing spills mid-journey.',
    info: ['Folds down to A5 size; magnetic bases hold every piece in place.', 'Storage pouch and spare queen included — open a game anywhere, commute or travel.'] },

  { name: 'Portable 3D-Printed Stopwatch', category: 'stopwatch', price: 39, timer: true,
    desc: 'The 3D-printed portable series — lightweight, rugged, made for a mobile playing lifestyle.',
    info: ['3D-printed honeycomb shell: lightweight, rugged, with a texture no two are alike.', 'Single-button start / split; magnetic back clip attaches to the edge of any board.'] },
  { name: 'Pocket Stopwatch', category: 'stopwatch', price: 29,
    desc: 'Single-button blind operation and a magnetic back clip — countdowns at a glance.',
    info: ['Single-button blind operation — precise presses even while wearing gloves.', 'Large countdown display with backlight, perfectly readable in low light.'] },
  { name: 'Referee Dual-Channel Stopwatch', category: 'stopwatch', price: 66,
    desc: 'Two independent channels — one referee, two boards under control.',
    info: ['Independent start / stop on both channels — one timer supervises two boards on patrol.', 'Vibration alert mode keeps quiet zones of the venue undisturbed.'] },
  { name: 'Gym Training Split Stopwatch', category: 'stopwatch', price: 41,
    desc: '99-lap split memory — the rhythm manager for fitness and problem-solving drills.',
    info: ['99-lap split memory with exportable training rhythm curves.', 'Wrist or tabletop use — one timer for both puzzle drills and physical training.'] },

  { name: 'Checkmate Ceramic Mug', category: 'lifestyle', price: 24,
    desc: 'Black-and-white checker glaze with a gold-rimmed lip; king emblem on the black handle. Sip. Think. Win.',
    info: ['Black-and-white checkerboard glaze, gold-rimmed lip, black handle with a king emblem.', '380ml capacity; microwave and dishwasher safe (hand wash recommended for the gold rim).'] },
  { name: 'Grandmaster Signature Mug', category: 'lifestyle', price: 32,
    desc: 'Limited gold-traced glaze with a champion signature card — for collecting and everyday use.',
    info: ['Limited-edition gold-traced glaze body, each individually numbered.', 'Champion signature collector card included; gift-box packed — for giving or keeping.'] },
  { name: '64 Squares Velvet Table Runner', category: 'lifestyle', price: 46,
    desc: 'Velvet-woven checkerboard runner with gold-stitched edges — your desk becomes a chessboard.',
    info: ['High-density velvet weave with gold-stitched edges and an elegant drape.', 'Standard 180cm runner — turns any desk or sideboard into a scene.'] },
  { name: 'King & Queen Bookend Pair', category: 'lifestyle', price: 58,
    desc: 'Resin-cast king and queen bookends — black and gold that anchor an entire shelf.',
    info: ['Resin-cast weighted base keeps even the heaviest chess volumes upright.', 'Black-and-gold finish echoing the entire LEAP collection.'] },
];

/* 首页轮播三帧（品牌场景图，文案已烘焙于图内） */
const SLIDES = [
  { file: 'hero-board.png', alt: 'TIMELESS STRATEGY · Walnut premium chess board scene' },
  { file: 'hero-clock.png', alt: 'FOCUS ON EVERY MOVE · Professional tournament chess clock scene' },
  { file: 'hero-mug.png', alt: 'CHESS, EVERY MOVE MATTERS · Checkerboard-themed mug scene' },
];

async function seed() {
  await connect();
  await initSchema();

  for (const u of USERS) {
    const exists = await db.query('SELECT id FROM users WHERE username = ?', [u.username]);
    if (exists.length === 0) {
      const hash = bcrypt.hashSync(u.password, 10);
      await db.run(
        'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
        [u.username, hash, u.role, u.display_name || u.username]
      );
      console.log(`[seed] 用户已创建: ${u.username} (${u.role}) — ${u.display_name || u.username}`);
    }
  }

  const count = await db.query('SELECT COUNT(*) AS c FROM products');
  if (Number(count[0].c) === 0) {
    // 图片一次性导入（内容哈希去重，重复运行无副作用）
    const placeholder = importAsset('placeholder.svg');
    const timerMain = ['timer-main-01.png', 'timer-main-02.png', 'timer-main-03.png', 'timer-main-04.png', 'timer-main-05.png']
      .map(importAsset).filter(Boolean);
    const timerDetail = ['timer-detail-01.png', 'timer-detail-02.png', 'timer-detail-03.png']
      .map(importAsset).filter(Boolean);

    for (const p of PRODUCTS) {
      const images = p.timer && timerMain.length ? timerMain : placeholder ? [placeholder] : [];
      const details = p.timer && timerDetail.length ? timerDetail : [];
      await db.run(
        'INSERT INTO products (name, category, price, description, image, images, details, info, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.name, p.category, p.price, p.desc, images[0] || '', JSON.stringify(images), JSON.stringify(details), JSON.stringify(p.info), 100]
      );
    }
    console.log(`[seed] 商品已写入: ${PRODUCTS.length} 条（图片存于 ${UPLOAD_DIR}）`);
  }

  const slideCount = await db.query('SELECT COUNT(*) AS c FROM slides');
  if (Number(slideCount[0].c) === 0) {
    let sort = 0;
    for (const s of SLIDES) {
      const url = importAsset(s.file);
      if (!url) continue;
      sort += 1;
      await db.run('INSERT INTO slides (image, alt, sort, enabled) VALUES (?, ?, ?, 1)', [url, s.alt, sort]);
    }
    if (sort > 0) console.log(`[seed] 轮播图已写入: ${sort} 帧`);
  }

  const settingCount = await db.query('SELECT COUNT(*) AS c FROM settings');
  if (Number(settingCount[0].c) === 0) {
    const defaults = [
      ['site_title', 'LEAP'],
      ['logo_url', ''],
      ['announcement_html', ''],
      ['contact_email', 'hello@leapchess.example'],
      ['contact_social', ''],
    ];
    for (const [key, value] of defaults) await upsertSetting(key, value);
    console.log('[seed] 全站设置默认值已写入');
  }
}

/** settings 表 upsert（双方言兼容：PG 不能用 db.run，其会自动追加 RETURNING id） */
async function upsertSetting(key, value) {
  if (usePg) {
    await db.query(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  } else {
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed] 完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] 失败:', err);
      process.exit(1);
    });
}

module.exports = { seed };
