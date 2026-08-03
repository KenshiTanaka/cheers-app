#!/bin/bash
set -e

echo "=== Docker Engine インストール開始 ==="

# 必要なパッケージをインストール
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# Docker公式GPGキーを追加
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Dockerリポジトリを追加
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker Engineをインストール
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 現在のユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# Dockerサービスを起動
sudo service docker start

echo "=== Docker Engine インストール完了 ==="
docker --version
docker compose version
