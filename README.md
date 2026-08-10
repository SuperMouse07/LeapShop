# 🐭 鼠图图 Shututu · 官网

> 像老鼠一样思考，把灵感囤成奶酪。

鼠图图（Shututu）是一家虚构的鼠系科技公司官网 —— 一个纯静态网页项目（HTML / CSS / 原生 JS，无任何构建步骤），已配置好 **Zeabur** 部署。

## ✨ 页面亮点

| 区块 | 内容 |
| --- | --- |
| 首屏 Hero | 手绘 SVG 老鼠吉祥物、漂浮奶酪、波浪过渡 |
| 数据栏 | 滚动进入视口时的数字滚动动画 |
| 产品 | 奶酪云 / 风火轮 / 地道网络 / 夜哨 四大产品卡片 |
| 鼠文化 | 打洞精神、囤积美学、夜行基因、胡须感知 |
| 发展历程 | 奶酪色虚线时间线 |
| 团队 | 吱吱 / 仓仓 / 奶酪 / 轮轮 四位核心成员 |
| 彩蛋 | 鼠标移动掉落奶酪碎屑；可点击转动的「性能跑轮」 |

## 📁 项目结构

```
ShututuWeb/
├── index.html                  # 页面主体
├── css/style.css               # 样式
├── js/main.js                  # 交互脚本
├── favicon.svg                 # 鼠头图标
├── Dockerfile                  # Zeabur 部署镜像（nginx）
├── deploy/
│   └── nginx.conf.template     # nginx 配置模板（自动替换 ${PORT}）
├── .dockerignore
└── .gitignore
```

## 🚀 部署到 Zeabur

### 方式一：通过 GitHub（推荐）

1. 将本项目推送到 GitHub 仓库：

   ```bash
   git init
   git add .
   git commit -m "feat: Shututu 官网初版"
   git remote add origin https://github.com/<你的用户名>/shututu-web.git
   git push -u origin main
   ```

2. 打开 [Zeabur](https://zeabur.com)，登录后进入控制台。
3. **Create Project** → 选择区域 → **Add Service** → **Git** → 选择刚推送的仓库。
4. Zeabur 自动识别 `Dockerfile` 并构建 nginx 镜像，部署完成后自动分配域名。
5. （可选）在服务页 **Networking** 中点击 *Generate Domain* 生成域名，或绑定自定义域名。

> 每次向仓库推送代码，Zeabur 会自动重新构建部署。

### 方式二：Zeabur CLI

```bash
npm install -g @zeabur/cli
zeabur login
zeabur deploy
```

## 🖥️ 本地预览

项目是纯静态页面，任选其一：

```bash
# 方式 A：Python
python -m http.server 8080

# 方式 B：Node
npx serve .

# 方式 C：直接用浏览器打开 index.html
```

访问 `http://localhost:8080` 即可。

## 🐳 本地验证 Docker 镜像

```bash
docker build -t shututu-web .
docker run --rm -p 8080:8080 shututu-web
```

## ⚙️ 部署要点

- **端口**：Zeabur 注入 `PORT` 环境变量（默认 8080），nginx 通过官方镜像的 `envsubst` 机制自动监听该端口，无需手动配置。
- **无构建步骤**：项目不含 npm 依赖与打包流程，Zeabur 只需构建 Docker 镜像。
- **健康检查**：Dockerfile 内置 `wget` HEALTHCHECK。

---

© 鼠图图科技 Shututu Tech · 本网站由仓鼠跑轮 100% 清洁发电 🎡
