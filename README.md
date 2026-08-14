# LeapChess · 全栈官网（前端 + 后端 + 数据库）

参考 LeapChess（theleapchess.com）官网设计风格重构的国际象棋主题全栈 Web 应用。
前端、后端、数据库三层架构，包含用户认证、角色权限与商品 CRUD 完整闭环。

## 架构总览

```
┌─────────────┐   HTTP/JSON    ┌──────────────────┐   SQL    ┌───────────────┐
│  frontend/  │ ─────────────► │    backend/      │ ───────► │  PostgreSQL   │
│  静态页面    │   /api/*       │  Express + JWT   │          │ (Zeabur 生产)  │
│  (HTML/CSS/ │ ◄───────────── │  权限中间件       │ ◄─────── │  SQLite       │
│   JS)       │                │  单服务托管前端    │          │ (本地开发)     │
└─────────────┘                └──────────────────┘          └───────────────┘
```

- **前端** `frontend/`：原生 HTML/CSS/JS（ES Module），国际象棋深色棋盘主题
- **后端** `backend/`：Node.js + Express，JWT 认证，角色权限中间件
- **数据库**：检测到 `DATABASE_URL`/`PGHOST` 时使用 PostgreSQL；否则自动回退本地 SQLite（sql.js，零安装）

## 演示账户

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 超级管理员 | `P001` | `123456` | 浏览全部 + 商品上传/编辑/删除 |
| 客户 | `C001` | `123456` | 仅浏览基础内容 |

首次启动自动建表并写入种子数据（幂等）。

## 本地运行

```powershell
cd backend
npm install
npm start          # 启动后访问 http://localhost:3000
```

单服务模式下后端同时托管前端页面：

| 页面 | 路径 |
|------|------|
| 官网首页 | `/` |
| 登录 | `/login.html` |
| 商品详情 | `/product.html?id=<id>` |
| 管理后台 | `/admin.html` |

### API 冒烟测试

```powershell
# 后端运行中时：
powershell -ExecutionPolicy Bypass -File backend\test-api.ps1   # 15 项流程测试
node backend\test-crud.js                                       # 中文数据 CRUD 测试
```

## API 一览

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 公开 | 登录，返回 JWT |
| GET | `/api/auth/me` | 登录 | 校验 Token / 获取身份 |
| GET | `/api/products` | 公开 | 商品列表（`?category=` 过滤） |
| GET | `/api/products/:id` | 公开 | 商品详情 |
| POST | `/api/products` | 管理员 | 新增商品 |
| PUT | `/api/products/:id` | 管理员 | 更新商品 |
| DELETE | `/api/products/:id` | 管理员 | 删除商品 |
| GET | `/api/stats/storage` | 管理员 | 存储统计（数据库总占用 / 商品数据占用 / 商品数） |
| GET | `/api/health` | 公开 | 健康检查（含数据库类型） |

写操作需要请求头 `Authorization: Bearer <token>`；客户角色调用写接口返回 `403`。
商品图片落盘存储于图片目录（生产为 Zeabur Volume 挂载点，由 `UPLOAD_DIR` 指定；本地默认 `backend/data/uploads`），数据库仅保存 `/uploads/...` URL 引用；文件以内容哈希命名，自动去重（每件商品最多 10 张，至少 1 张主图）。
商品支持颜色/款式变体（`variants`），每个变体可携带独立图集；详情页（`/product.html?id=<id>`）左侧轮播展示图片、右侧展示名称/价格/描述与变体选择。

## Zeabur 部署（针对 Zeabur 平台特性适配）

已适配的 Zeabur 约束：

- **端口注入**：应用监听 Zeabur 注入的 `PORT`（Git 服务默认 8080），Dockerfile `EXPOSE 8080` 与之一致
- **内网数据库免 SSL**：`pg` 连接默认不启用 SSL（Zeabur 内网 PG 不支持 SSL，强开会报
  "The server does not support SSL connections"）；连外部托管库时用 `PGSSL=true` 或在 URL 加 `sslmode=require`
- **无状态文件系统**：生产用 PostgreSQL；若未注入数据库变量会回退 SQLite 并在启动日志警告
- **健康检查**：`/api/health` + Dockerfile HEALTHCHECK
- **纯 JS 依赖**：无 native 模块（sql.js 为 WASM，且生产走 pg），构建无需 C++ 工具链

### 推荐方案 A：单服务 + PostgreSQL（最简）

1. Zeabur 控制台新建项目 → **Add Service → Database → PostgreSQL**
2. **Add Service → Git**：选择本仓库（分支 `main`），Zeabur 自动识别根目录 `Dockerfile` 构建
3. 点开应用服务 → **Variables** 页签：Zeabur 会自动注入 `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` 与 `PORT`（悬停可见，无需手填）。
   若希望显式用连接串，可添加 `DATABASE_URL`，值引用 `${POSTGRES_URI}`（Zeabur 变量引用语法）
4. 建议添加环境变量 `JWT_SECRET`（随机字符串，避免使用代码内置默认值）
5. **Networking → Generate Domain** 生成 `.zeabur.app` 域名，或绑定自定义域名（自动 HTTPS）

应用启动时自动：建表 → 写入 P001/C001 与占位商品 → 监听 `PORT`。每次 git push 自动重新部署，PostgreSQL 数据不受影响。

### 方案 B：前后端分离双服务

- 后端服务：Git 来源，**Root Directory** 设为 `backend`，同样自动注入 PG 变量
- 前端服务：Zeabur **Prebuilt → Static Hosting**（Root Directory 设为 `frontend`），
  前端会自动探测同源 `/api`，失败时回退本地开发后端；分离部署时需保证后端域名可被浏览器访问（CORS 已全开）

### 技术验证清单

- [x] 前端调用后端 REST API 渲染动态商品（前后端数据交互）
- [x] 登录认证（bcrypt 哈希 + JWT，错误密码返回 401）
- [x] 角色权限（客户写操作 403，未登录 401，管理员正常 CRUD）
- [x] 数据持久化（本地 SQLite / Zeabur PostgreSQL，重启不丢数据）
- [x] 健康检查 `/api/health` 返回当前数据库类型

## 项目结构

```
├── Dockerfile              # Zeabur 单服务镜像（后端 + 前端静态托管）
├── backend/
│   ├── server.js           # Express 入口：路由 + 权限中间件 + 静态托管
│   ├── db.js               # 数据库抽象层（PostgreSQL / sql.js 双驱动）
│   ├── seed.js             # 幂等种子数据（账户 + 占位商品）
│   ├── test-api.ps1        # API 冒烟测试脚本
│   └── test-crud.js        # 中文 CRUD 测试脚本
└── frontend/
    ├── index.html          # 官网首页（Hero / 品牌 / 动态商品 / 历程）
    ├── login.html          # 登录页
    ├── product.html        # 商品详情页（左轮播图 + 右信息/变体选择）
    ├── admin.html          # 管理后台（多图上传 / 变体管理 / 编辑 / 删除）
    ├── css/style.css       # 国际象棋主题样式
    └── js/
        ├── api.js          # 共享 API 客户端（Token 管理、请求封装）
        ├── main.js         # 首页逻辑（动态商品加载、过滤）
        ├── auth.js         # 登录逻辑
        ├── product.js      # 详情页逻辑（轮播、颜色/款式切换）
        └── admin.js        # 后台逻辑（权限门 + CRUD + 多图/变体上传）
```
