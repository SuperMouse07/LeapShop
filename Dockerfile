# ============================================================
# 鼠图图 Shututu · Zeabur 部署镜像
# 说明：Zeabur 会自动识别 Dockerfile 并构建。
# nginx 官方镜像会把 /etc/nginx/templates/*.template 中的
# ${PORT} 替换为 Zeabur 注入的 PORT 环境变量（默认 8080）。
# ============================================================
FROM nginx:1.27-alpine

# nginx 配置模板（由 nginx 入口脚本自动做 envsubst）
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

# 静态站点文件
COPY --chown=nginx:nginx index.html favicon.svg /usr/share/nginx/html/
COPY --chown=nginx:nginx css /usr/share/nginx/html/css
COPY --chown=nginx:nginx js /usr/share/nginx/html/js

# Zeabur 默认注入 PORT=8080；此处提供兜底默认值
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://127.0.0.1:${PORT}/ || exit 1
