#!/bin/bash
set -e

echo "=========================================="
echo "🦆 DuckDNS (cheers-app.duckdns.org) の設定"
echo "=========================================="

mkdir -p $HOME/duckdns
cat << 'EOF' > $HOME/duckdns/duck.sh
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=cheers-app&token=f1990df9-ee1d-40af-982c-b9f3d1143f17&ip=" | curl -k -s -K -
EOF

chmod 700 $HOME/duckdns/duck.sh
RESPONSE=$($HOME/duckdns/duck.sh)
echo "DuckDNS Update Result: $RESPONSE"

# 5分ごとの自動更新 cron タスクの登録
(crontab -l 2>/dev/null | grep -v "duckdns"; echo "*/5 * * * * $HOME/duckdns/duck.sh >/dev/null 2>&1") | crontab -

echo "=========================================="
echo "✅ DuckDNS の自動更新が設定されました！"
echo "=========================================="
