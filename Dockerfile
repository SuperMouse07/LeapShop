# LeapChess 全栈应用（单服务镜像：后端 API + 静态前端）
FROM node:20-alpine

WORKDIR /app/backend

# 依赖层缓存
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# 后端代码
COPY backend/ ./

# 前端静态资源（后端以单服务模式托管）
COPY frontend/ ../frontend/

ENV NODE_ENV=production
# Zeabur 会注入 PORT（Git 服务默认 8080），此处声明与之一致以供路由发现
ENV PORT=8080
EXPOSE 8080

# 健康检查（供 Zeabur/容器编排探测 /api/health）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/api/health" || exit 1

CMD ["node", "server.js"]
