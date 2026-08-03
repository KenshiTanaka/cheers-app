#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "=========================================="
echo "🛡️ 192.168.4.37 サーバーセキュリティ強化の適用"
echo "=========================================="

# 1. パッケージの更新とセキュリティツールのインストール
echo "[1/4] ファイアウォール (ufw) ＆ Fail2ban のインストール中..."
echo "kenshi" | sudo -S env DEBIAN_FRONTEND=noninteractive apt-get update -y
echo "kenshi" | sudo -S env DEBIAN_FRONTEND=noninteractive apt-get install -y ufw fail2ban curl git

# 2. ファイアウォール (ufw) の厳格化設定
echo "[2/4] ファイアウォール (ufw) の設定中..."
echo "kenshi" | sudo -S ufw default deny incoming
echo "kenshi" | sudo -S ufw default allow outgoing
echo "kenshi" | sudo -S ufw allow 22/tcp comment 'SSH'
echo "kenshi" | sudo -S ufw allow 80/tcp comment 'HTTP'
echo "kenshi" | sudo -S ufw allow 443/tcp comment 'HTTPS'
echo "kenshi" | sudo -S ufw allow 3000/tcp comment 'Web App Frontend'
echo "y" | echo "kenshi" | sudo -S ufw enable

# 3. Fail2ban による自動BAN設定
echo "[3/4] Fail2ban 自動BANサービスの設定中..."
echo "kenshi" | sudo -S systemctl enable --now fail2ban

# 4. SSH設定の強化（パスワードログイン禁止 ＆ Root禁止）
echo "[4/4] SSH設定の強化（パスワードログイン禁止 ＆ Root禁止）..."
echo "kenshi" | sudo -S sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
echo "kenshi" | sudo -S sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
echo "kenshi" | sudo -S systemctl restart ssh || echo "kenshi" | sudo -S systemctl restart sshd

echo "=========================================="
echo "✅ サーバーのセキュリティ強化が完了しました！"
echo "=========================================="
