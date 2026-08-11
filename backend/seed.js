/**
 * 种子数据：预设账户 + LeapChess 风格占位商品
 * - 超级管理员 P001 / 123456
 * - 客户 C001 / 123456
 */
const bcrypt = require('bcryptjs');
const { db, connect, initSchema } = require('./db');

const USERS = [
  { username: 'P001', password: '123456', role: 'admin' },
  { username: 'C001', password: '123456', role: 'customer' },
];

const PRODUCTS = [
  {
    name: 'LEAP PQ9921 Pro Choice Digital Chess Timer - High-Visibility Lever & Multi-Mode',
    category: 'chess-timer',
    price: 36.99,
    stock: 120,
    description: 'High-contrast display with a bold lever indicator, 36 timing modes — a dependable pick for clubs and schools.',
  },
  {
    name: 'LEAP PQ9923 Digital Chess Timer - Blue (Tournament Clock for Clubs & Schools)',
    category: 'chess-timer',
    price: 21.99,
    stock: 200,
    description: 'Classic tournament blue, clear LCD display and intuitive controls — ideal for bulk teaching and event use.',
  },
  {
    name: 'LEAP PQ9907S Digital Chess Clock - Matte Black Edition',
    category: 'chess-timer',
    price: 21.99,
    stock: 150,
    description: 'Understated matte black body with professional feel. Supports increment and delay time controls.',
  },
  {
    name: 'LEAP PQ9917 Professional Digital Chess Timer - White',
    category: 'chess-timer',
    price: 24.99,
    stock: 90,
    description: 'Clean white design with pro-grade accuracy. Includes anti-slip feet and a carry pouch.',
  },
  {
    name: 'LEAP PQ9918 Digital Timer - Extra Large Screen Tournament Clock',
    category: 'chess-timer',
    price: 56.99,
    stock: 60,
    description: 'Extra-large display readable even from the spectator area — the big-event experience.',
  },
  {
    name: 'LEAP KK9909 FIDE Certified Digital Timer - 39 Modes, Dual-Color Lever Indicator',
    category: 'chess-timer',
    price: 48.99,
    stock: 75,
    description: 'FIDE certified with 39 timing modes and a dual-color lever showing the side to move. The flagship choice.',
  },
  {
    name: 'LEAP KK9908 FIDE Certified Digital Timer - Ultra Portable Tournament Clock',
    category: 'chess-timer',
    price: 38.99,
    stock: 85,
    description: 'FIDE certified, slim and portable, syncs game data with apps (Lichess / Chess.com compatible).',
  },
  {
    name: '13" Magnetic Foldable Wooden Chess Set - 2.5 inch King',
    category: 'chess-set',
    price: 42.0,
    stock: 40,
    description: 'Powerful yet gentle magnetic grip with a smart foldable wooden board. Professional play, perfectly portable.',
  },
  {
    name: 'LEAP Chess Theme Short Sleeve T-Shirt - Classic',
    category: 'apparel',
    price: 24.0,
    stock: 300,
    description: '100% cotton with chess-motif print. Great for daily wear and club events.',
  },
  {
    name: 'LEAP Chess Crew Tee - Women\'s Classic V-Neck',
    category: 'apparel',
    price: 30.0,
    stock: 180,
    description: 'Tailored V-neck cut in soft, breathable fabric. Wear your love for the game.',
  },
];

async function seed() {
  await connect();
  await initSchema();

  for (const u of USERS) {
    const exists = await db.query('SELECT id FROM users WHERE username = ?', [u.username]);
    if (exists.length === 0) {
      const hash = bcrypt.hashSync(u.password, 10);
      await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [
        u.username,
        hash,
        u.role,
      ]);
      console.log(`[seed] 用户已创建: ${u.username} (${u.role})`);
    }
  }

  const count = await db.query('SELECT COUNT(*) AS c FROM products');
  if (Number(count[0].c) === 0) {
    for (const p of PRODUCTS) {
      await db.run(
        'INSERT INTO products (name, category, price, description, image, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.category, p.price, p.description, p.image || '', p.stock]
      );
    }
    console.log(`[seed] 商品已写入: ${PRODUCTS.length} 条`);
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
