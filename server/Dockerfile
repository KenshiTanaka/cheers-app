FROM node:20-alpine

WORKDIR /app

# パッケージのインストール（キャッシュ活用）
COPY package*.json ./
RUN npm install --omit=dev && npm install typescript ts-node-dev @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/sqlite3

# ソースコードをコピー
COPY . .

# TypeScript ビルド
RUN npx tsc

# SQLiteデータ用ディレクトリ
RUN mkdir -p /app/data

EXPOSE 3001

# ビルド済みJSで起動
CMD ["node", "dist/index.js"]
