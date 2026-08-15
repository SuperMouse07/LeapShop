# LeapChess · 全栈官网（前端 + 后端 + 数据库）

参考 LeapChess（theleapchess.com）官网设计风格重构的国际象棋主题全栈 Web 应用。
前端、后端、数据库三层架构；前台为无登录的编辑画廊式官网，后台为隐藏入口的内容管理面板（轮播图 / 商品主图与详情图 / 卖点文案），商品 CRUD 完整闭环。

## 架构总览

```
┌─────────────┐   HTTP/JSON    ┌──────────────────┐   SQL    ┌───────────────┐
│  frontend/  │ ─────────────► │    backend/      │ ───────► │  PostgreSQL   │
│  静态页面    │   /api/*       │  Express + JWT   │          │ (Zeabur 生产)  │
│  (HTML/CSS/ │ ◄───────────── │  权限中间件       │ ◄─────── │  SQLite       │
│   JS)       │                │  单服务托管前端    │          │ (本地开发)     │
└─────────────┘                └──────────────────┘          └───────────────┘
```

- **前端** `frontend/`：原生 HTML/CSS/JS，方案F八页结构（白底金黑编辑画廊），前台无登录/注册入口
- **后端** `backend/`：Node.js + Express，JWT 认证（仅后台使用），角色权限中间件
- **数据库**：检测到 `DATABASE_URL`/`PGHOST` 时使用 PostgreSQL；否则自动回退本地 SQLite（sql.js，零安装）

## 管理员账户

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 超级管理员 | `P001` | `123456` | 后台轮播图/商品/全站设置/存储监控全部管理 |

前台无任何登录入口；后台入口 `/admin.html` 不在站点任何页面展示链接，需直接访问并内置登录。
快捷手势：在任意前台页面 2 秒内连敲 5 次空格跳转 `/admin.html`，后台页同样手势跳回前台首页（无可见链接与提示）。
首次启动自动建表并写入种子数据（幂等；生产 PG 已有数据时种子跳过，由后台人工管理）。

## 本地运行

```powershell
cd backend
npm install
npm start          # 启动后访问 http://localhost:3000
```

单服务模式下后端同时托管前端页面：

| 页面 | 路径 |
|------|------|
| 官网首页（Hero 轮播 / Featured） | `/` |
| 全部商品 | `/products.html` |
| 分类页 | `/chess-clock.html` `/chess-board.html` `/stopwatch.html` `/lifestyle.html` |
| 商品详情（主图横滑 + 详情图） | `/product.html?id=<id>` |
| 品牌历程 | `/journey.html` |
| 管理后台（隐藏入口，内置登录） | `/admin.html` |

### API 冒烟测试

```powershell
# 后端运行中时：
powershell -ExecutionPolicy Bypass -File backend\test-api.ps1   # 15 项流程测试
node backend\test-crud.js                                       # 中文数据 CRUD 测试
```

## API 一览

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 公开 | 登录，返回 JWT（仅后台使用） |
| GET | `/api/auth/me` | 登录 | 校验 Token / 获取身份 |
| GET | `/api/products` | 公开 | 商品列表（`?category=` 过滤，按 id 升序） |
| GET | `/api/products/:id` | 公开 | 商品详情（含 `images` 主图集 / `details` 详情图集 / `info` 卖点） |
| POST | `/api/products` | 管理员 | 新增商品 |
| PUT | `/api/products/:id` | 管理员 | 更新商品 |
| DELETE | `/api/products/:id` | 管理员 | 删除商品 |
| GET | `/api/slides` | 公开 | 首页轮播图（按 sort 升序，仅启用项）；管理员 `?all=1` 返回全部 |
| POST | `/api/slides` | 管理员 | 新增轮播图（image 支持 dataURL 自动落盘） |
| PUT | `/api/slides/:id` | 管理员 | 更新轮播图（alt/sort/enabled/image） |
| DELETE | `/api/slides/:id` | 管理员 | 删除轮播图（无引用图片自动清理） |
| GET | `/api/stats/storage` | 管理员 | 存储统计（数据库总占用 / 商品数据占用 / 商品数 / 图片文件数与磁盘占用 / 数据库开销占比 / 磁盘容量与剩余） |
| GET | `/api/settings` | 公开 | 全站设置（网站标题 / LOGO / 首页公告 / 联系方式，key-value） |
| PUT | `/api/settings` | 管理员 | 更新单项设置（`{ key, value }`，key 白名单校验） |
| POST | `/api/settings/logo` | 管理员 | LOGO 上传（dataURL 自动落盘并写入 `logo_url`，旧图无引用时清理） |
| GET | `/api/products/:id/storage` | 管理员 | 单商品存储明细（图片文件数 / 磁盘字节 / JSON 字节 / 合计） |
| GET | `/api/health` | 公开 | 健康检查（含数据库类型） |

写操作需要请求头 `Authorization: Bearer <token>`；非管理员调用写接口返回 `403`。
全站设置存于 `settings` 表（key/value），前台加载时应用网站标题 / LOGO / 首页公告 / 页脚联系方式，公告仅放行 `<strong>/<b>/<em>/<br>` 白名单标签；后台保存后经 BroadcastChannel 通知前台即时同步（无需刷新）。
所有内容图（轮播图 / 商品主图 / 详情图）落盘存储于图片目录（生产为 Zeabur Volume 挂载点，由 `UPLOAD_DIR` 指定；本地默认 `backend/data/uploads`），数据库仅保存 `/uploads/...` URL 引用；文件以内容哈希命名，自动去重（每组图集最多 10 张，商品至少 1 张主图；后台单张大小上限 8MB，单商品图片总量上限 50MB，后端 JSON 解析限 80mb 容纳 base64 膨胀）。删除商品/轮播/换图时自动清理无引用的图片文件。
商品另支持 `variants` 颜色/款式变体字段（API 兼容保留，新后台界面不再展示与编辑）。

## Zeabur 部署（针对 Zeabur 平台特性适配）

已适配的 Zeabur 约束：

- **端口注入**：应用监听 Zeabur 注入的 `PORT`（Git 服务默认 8080），Dockerfile `EXPOSE 8080` 与之一致
- **内网数据库免 SSL**：`pg` 连接默认不启用 SSL（Zeabur 内网 PG 不支持 SSL，强开会报
  "The server does not support SSL connections"）；连外部托管库时用 `PGSSL=true` 或在 URL 加 `sslmode=require`
- **无状态文件系统**：生产用 PostgreSQL；若未注入数据库变量会回退 SQLite 并在启动日志警告
- **图片持久化**：图片文件存于 Zeabur Volume（挂载 `/data`，设 `UPLOAD_DIR=/data/uploads`）；启动时自检该目录是否在挂载点上，不是则打印警告（防止图片落在临时盘随部署丢失）
- **健康检查**：`/api/health` + Dockerfile HEALTHCHECK
- **纯 JS 依赖**：无 native 模块（sql.js 为 WASM，且生产走 pg），构建无需 C++ 工具链

### 推荐方案 A：单服务 + PostgreSQL（最简）

1. Zeabur 控制台新建项目 → **Add Service → Database → PostgreSQL**
2. **Add Service → Git**：选择本仓库（分支 `main`），Zeabur 自动识别根目录 `Dockerfile` 构建
3. 点开应用服务 → **Variables** 页签：Zeabur 会自动注入 `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` 与 `PORT`（悬停可见，无需手填）。
   若希望显式用连接串，可添加 `DATABASE_URL`，值引用 `${POSTGRES_URI}`（Zeabur 变量引用语法）
4. **图片持久化（必做）**：项目画布 `+` → **Volume** 创建硬盘并挂载到应用服务，挂载目录 `/data`；然后在 Variables 添加 `UPLOAD_DIR=/data/uploads`。只设环境变量不挂盘会导致图片存于临时文件系统，重新部署即丢失
5. 建议添加环境变量 `JWT_SECRET`（随机字符串，避免使用代码内置默认值）
6. **Networking → Generate Domain** 生成 `.zeabur.app` 域名，或绑定自定义域名（自动 HTTPS）

应用启动时自动：建表 → 写入 P001 与方案F种子数据（16 商品 + 3 轮播图，仅表为空时）→ 监听 `PORT`。每次 git push 自动重新部署，PostgreSQL 数据不受影响。

### 方案 B：前后端分离双服务

- 后端服务：Git 来源，**Root Directory** 设为 `backend`，同样自动注入 PG 变量
- 前端服务：Zeabur **Prebuilt → Static Hosting**（Root Directory 设为 `frontend`），
  前端会自动探测同源 `/api`，失败时回退本地开发后端；分离部署时需保证后端域名可被浏览器访问（CORS 已全开）

### 技术验证清单

- [x] 前端调用后端 REST API 渲染动态商品与轮播图（前后端数据交互）
- [x] 登录认证（bcrypt 哈希 + JWT，错误密码返回 401；仅隐藏后台使用，前台无登录入口）
- [x] 角色权限（客户写操作 403，未登录 401，管理员正常 CRUD）
- [x] 数据持久化（本地 SQLite / Zeabur PostgreSQL，重启不丢数据）
- [x] 图片落盘存储（Volume + 内容哈希去重，跨部署持久化）
- [x] 存储统计面板（数据占用与磁盘容量双口径、单商品明细 Tooltip）
- [x] 全站设置中心（网站标题/LOGO/公告/联系方式，settings 表 + BroadcastChannel 免刷新同步）
- [x] 健康检查 `/api/health` 返回当前数据库类型

## 项目结构

```
├── Dockerfile              # Zeabur 单服务镜像（后端 + 前端静态托管）
├── backend/
│   ├── server.js           # Express 入口：路由 + 权限中间件 + 静态托管
│   ├── db.js               # 数据库抽象层（PostgreSQL / sql.js 双驱动，含 slides 表）
│   ├── seed.js             # 幂等种子数据（P001 + 方案F 16 商品 + 3 轮播图导入）
│   ├── test-api.ps1        # API 冒烟测试脚本
│   └── test-crud.js        # 中文 CRUD 测试脚本
├── frontend/
│   ├── index.html          # 首页（API 轮播 / Featured / 品牌故事）
│   ├── products.html       # 全部商品（瀑布流）
│   ├── chess-clock.html 等 # 4 个分类页
│   ├── product.html        # 商品详情（主图横滑 + 详情图 + 卖点）
│   ├── journey.html        # 品牌历程
│   ├── admin.html          # 管理后台（隐藏入口：内置登录 + 服务器监控/全站设置/轮播/商品）
│   ├── css/style.css       # 方案F 白底金黑样式 + 后台区块
│   └── js/
│       ├── store.js        # 前台 API 层（同源探测 + 商品/轮播取数）
│       ├── data.js         # 编辑性常量（分类元数据 / 品牌文案）
│       ├── api.js          # 后台 API 客户端（Token 管理、请求封装）
│       ├── site.js         # 全站导航/购物车/页脚
│       ├── home.js 等      # 各页面逻辑
│       └── admin.js        # 后台逻辑（登录守卫 + 轮播管理 + 商品 CRUD）
└── frontend/sandbox/       # 设计方案存档（prototype-a/e/f，不参与运行）
```
