/**
 * 数据库抽象层：
 * - 检测到 DATABASE_URL / PGHOST / POSTGRES_URI / POSTGRES_HOST 环境变量时使用 PostgreSQL（Zeabur 生产环境）
 *   （Zeabur 注入变量有两代命名：旧版 PGHOST 等、新版 POSTGRES_HOST 等，均兼容）
 * - 否则回退到本地 SQLite 文件（sql.js 纯 WASM 实现，无需编译，开发零配置）
 * SQL 统一使用 ? 占位符，PostgreSQL 路径会自动转换为 $1/$2...
 *
 * 使用方式：await connect() 后再调用 db.query / db.run
 */
const path = require('path');
const fs = require('fs');

const usePg = Boolean(
  process.env.DATABASE_URL || process.env.PGHOST || process.env.POSTGRES_URI || process.env.POSTGRES_HOST
);

let impl = null;
let dbFilePath = null; // SQLite 数据文件路径（connect 后赋值，供存储统计使用）

/** 将 ? 占位符转换为 PostgreSQL 的 $n 占位符 */
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * SSL 策略（适配 Zeabur）：
 * - Zeabur 内网 PostgreSQL（*.zeabur.internal）不走 SSL，强制开启反而会报
 *   "The server does not support SSL connections"
 * - 默认不启用 SSL；连接外部托管库时可通过 PGSSL=true 或在
 *   DATABASE_URL 中携带 sslmode=require 来开启
 */
function pgPoolOptions() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (url) {
    const needsSsl =
      /sslmode=(require|verify-ca|verify-full)/i.test(url) ||
      /^(true|1|on)$/i.test(process.env.PGSSL || '');
    return {
      connectionString: url,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }
  // Zeabur 新版分散变量（POSTGRES_* 命名）
  if (process.env.POSTGRES_HOST) {
    return {
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
    };
  }
  // 无连接串时依赖 Zeabur 自动注入的 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
  return {};
}

/** 初始化并返回数据库实例（必须在使用前 await） */
async function connect() {
  if (impl) return impl;

  if (usePg) {
    const { Pool } = require('pg');
    const pool = new Pool(pgPoolOptions());
    impl = {
      type: 'postgresql',
      async query(sql, params = []) {
        const { rows } = await pool.query(toPgSql(sql), params);
        return rows;
      },
      async run(sql, params = []) {
        // INSERT 自动附加 RETURNING id，便于拿到新记录主键
        const withReturning =
          /^\s*insert/i.test(sql) && !/returning/i.test(sql)
            ? sql.replace(/;?\s*$/, ' RETURNING id')
            : sql;
        const rows = await this.query(withReturning, params);
        return rows[0] && rows[0].id !== undefined ? { id: rows[0].id } : {};
      },
    };
    return impl;
  }

  // ---------- SQLite（sql.js，纯 WASM） ----------
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  // 数据目录优先读 DATA_DIR 环境变量（Zeabur 上指向挂载的 Volume，如 /data），未设置时回退到本目录 backend/data
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbFile = path.join(dataDir, 'leapchess.db');
  dbFilePath = dbFile;

  let sqliteDb;
  if (fs.existsSync(dbFile)) {
    sqliteDb = new SQL.Database(fs.readFileSync(dbFile));
  } else {
    sqliteDb = new SQL.Database();
  }

  /** 每次写操作后把内存库快照落盘（演示规模足够；Zeabur 生产请用 PostgreSQL） */
  function persist() {
    fs.writeFileSync(dbFile, Buffer.from(sqliteDb.export()));
  }

  impl = {
    type: 'sqlite',
    async query(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      try {
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
    async run(sql, params = []) {
      sqliteDb.run(sql, params);
      const [{ last_id }] = await this.query('SELECT last_insert_rowid() AS last_id');
      persist();
      return { id: last_id };
    },
  };
  return impl;
}

/** 建表（两种数据库通用语义，语法差异在此处处理） */
async function initSchema() {
  const db = impl;
  if (usePg) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'chess-timer',
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        description TEXT DEFAULT '',
        image TEXT DEFAULT '',
        images TEXT DEFAULT '[]',
        variants TEXT DEFAULT '[]',
        details TEXT DEFAULT '[]',
        info TEXT DEFAULT '[]',
        stock INTEGER NOT NULL DEFAULT 0,
        sort_weight INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS slides (
        id SERIAL PRIMARY KEY,
        image TEXT NOT NULL,
        alt TEXT DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`);
  } else {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'chess-timer',
        price REAL NOT NULL DEFAULT 0,
        description TEXT DEFAULT '',
        image TEXT DEFAULT '',
        images TEXT DEFAULT '[]',
        variants TEXT DEFAULT '[]',
        details TEXT DEFAULT '[]',
        info TEXT DEFAULT '[]',
        stock INTEGER NOT NULL DEFAULT 0,
        sort_weight INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS slides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image TEXT NOT NULL,
        alt TEXT DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
  }

  // 全站设置表（key/value，双方言语法一致，幂等创建）
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )`);

  // 平滑迁移：旧库补列（幂等）
  await ensureColumn('products', 'images', "TEXT DEFAULT '[]'");
  await ensureColumn('products', 'variants', "TEXT DEFAULT '[]'");
  await ensureColumn('products', 'details', "TEXT DEFAULT '[]'");
  await ensureColumn('products', 'info', "TEXT DEFAULT '[]'");
  await ensureColumn('products', 'sort_weight', 'INTEGER'); // 系列内排序权重（NULL = 未设置，按上传时间倒序）
}

/** 若表中缺少某列则补上（SQLite 用 pragma，PostgreSQL 用 information_schema） */
async function ensureColumn(table, column, definition) {
  const db = impl;
  let has = false;
  if (usePg) {
    const rows = await db.query(
      'SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?',
      [table, column]
    );
    has = rows.length > 0;
  } else {
    const rows = await db.query(`PRAGMA table_info(${table})`);
    has = rows.some((r) => r.name === column);
  }
  if (!has) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] 迁移: ${table}.${column} 列已添加`);
  }
}

/** 存储统计：数据库总占用 + 商品数据占用（字节） */
async function storageStats() {
  if (!impl) throw new Error('数据库尚未连接，请先 await connect()');

  if (usePg) {
    // PostgreSQL 内建函数：整库体积 / products 表（含索引）体积
    const total = await impl.query('SELECT pg_database_size(current_database()) AS bytes');
    const rows = await impl.query("SELECT COALESCE(pg_total_relation_size('products'), 0) AS bytes");
    return { totalBytes: Number(total[0].bytes), productBytes: Number(rows[0].bytes) };
  }

  // SQLite：总占用 = 数据文件体积；商品占用 = 图片/变体/详情/卖点等文本列长度累加
  const totalBytes = dbFilePath && fs.existsSync(dbFilePath) ? fs.statSync(dbFilePath).size : 0;
  const rows = await impl.query(`
    SELECT COALESCE(SUM(
      LENGTH(COALESCE(images, '')) + LENGTH(COALESCE(variants, '')) + LENGTH(COALESCE(image, ''))
      + LENGTH(COALESCE(details, '')) + LENGTH(COALESCE(info, ''))
    ), 0) AS bytes FROM products`);
  return { totalBytes, productBytes: Number(rows[0].bytes) };
}

/** 代理对象：connect() 之后才可调用 query/run */
const db = {
  get type() {
    return impl ? impl.type : 'not-connected';
  },
  query(...args) {
    if (!impl) throw new Error('数据库尚未连接，请先 await connect()');
    return impl.query(...args);
  },
  run(...args) {
    if (!impl) throw new Error('数据库尚未连接，请先 await connect()');
    return impl.run(...args);
  },
};

module.exports = { db, connect, initSchema, usePg, storageStats };
