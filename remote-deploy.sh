#!/bin/bash
set -e

echo "=========================================="
echo "🚀 192.168.4.37 への自動デプロイを開始します"
echo "=========================================="

# 1. パッケージ更新 ＆ Docker / Git のインストール
echo "[1/5] パッケージ更新と Docker/Git のインストール中..."
echo "kenshi" | sudo -S apt-get update -y
echo "kenshi" | sudo -S apt-get install -y docker.io docker-compose git curl || echo "kenshi" | sudo -S apt-get install -y docker.io git curl

# 2. Docker サービスの起動設定
echo "[2/5] Docker サービスの起動設定..."
echo "kenshi" | sudo -S systemctl enable --now docker
echo "kenshi" | sudo -S usermod -aG docker kenshi || true

# 3. リポジトリのクローン / 最新化
echo "[3/5] GitHub から最新ソースコードの取得..."
if [ -d "$HOME/cheers-app" ]; then
  cd "$HOME/cheers-app"
  git pull origin main
else
  git clone https://github.com/KenshiTanaka/cheers-app.git "$HOME/cheers-app"
  cd "$HOME/cheers-app"
fi

# 4. Docker Compose でビルド ＆ 起動
echo "[4/5] Docker コンテナのビルド ＆ バックグラウンド起動..."
if command -v docker-compose &> /dev/null; then
  echo "kenshi" | sudo -S docker-compose down || true
  echo "kenshi" | sudo -S docker-compose up --build -d
else
  echo "kenshi" | sudo -S docker compose down || true
  echo "kenshi" | sudo -S docker compose up --build -d
fi

# コンテナ起動待ち
sleep 5

# 5. シードデータ（神田・大手町・有楽町 119件）のインポート
echo "[5/5] 初期店舗データ119件 ＆ レビューの自動インポート..."
CONTAINER_ID=$(echo "kenshi" | sudo -S docker ps -qf "name=cheers_backend")

if [ -n "$CONTAINER_ID" ]; then
  echo "kenshi" | sudo -S docker exec -e DATABASE_PATH=/app/database.sqlite "$CONTAINER_ID" npx ts-node src/seedShops.ts || true
  echo "✅ 初期データのインポート完了！"
else
  echo "⚠️ バックエンドコンテナが見つかりませんでした。"
fi

echo "=========================================="
echo "🎉 デプロイが正常に完了しました！"
echo "=========================================="
echo "ブラウザで以下のURLを開いてください："
echo "👉 http://192.168.4.37:3000"
echo "=========================================="
