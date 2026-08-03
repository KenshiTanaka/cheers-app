# ビルドステージ
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 本番ステージ（Nginx）
FROM nginx:alpine

# ビルド成果物をNginxに配置
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx設定（APIプロキシ含む）
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
