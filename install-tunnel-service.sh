#!/bin/bash
set -e

echo "=========================================="
echo "⚙️ Cloudflare Tunnel サービス常駐化"
echo "=========================================="

echo "kenshi" | sudo -S systemctl stop cloudflared 2>/dev/null || true

cat << 'EOF' > /tmp/cloudflared-service.sh
#!/bin/bash
cloudflared tunnel --url http://localhost:3000
EOF

chmod +x /tmp/cloudflared-service.sh

cat << 'EOF' | sudo tee /etc/systemd/system/cloudflared-cheers.service
[Unit]
Description=Cloudflare Tunnel for Cheers App
After=network.target docker.service

[Service]
Type=simple
User=kenshi
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:3000
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

echo "kenshi" | sudo -S systemctl daemon-reload
echo "kenshi" | sudo -S systemctl enable --now cloudflared-cheers

echo "=========================================="
echo "✅ 全自動常駐サービス化が完了しました！"
echo "=========================================="
