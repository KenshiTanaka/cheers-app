#!/bin/bash
# Cheers Server セキュリティ状態・侵入兆候クイック診断コマンド

set -u

ALERT_LOG="/var/log/cheers-security-alerts.log"
STATE_DIR="/var/lib/cheers-security"

if [ "${1:-}" = "--reset-baseline" ]; then
  sudo /usr/local/bin/cheers-security-monitor.sh --init
  exit 0
fi

echo "============================================================"
echo " 🛡️  Cheers Server 侵入検知・セキュリティ診断レポート"
echo " 日時: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

echo "【1. 最近のセキュリティアラート（直近10件）】"
if [ -f "$ALERT_LOG" ] && [ -s "$ALERT_LOG" ]; then
  sudo tail -n 10 "$ALERT_LOG"
else
  echo " ✅ アラートは検出されていません（正常）"
fi
echo ""

echo "【2. fail2ban 不正ログイン自動ブロック状況】"
sudo fail2ban-client status sshd 2>/dev/null | grep -E "Currently failed|Total failed|Currently banned|Total banned|Banned IP" || echo " fail2ban 情報取得不可"
echo ""

echo "【3. 最近の SSH ログイン成功履歴（直近5件）】"
last -n 5 -i | head -n 5
echo ""

echo "【4. Cheers App アプリ層 攻撃・異常アクセス検知ログ（直近10件）】"
APP_LOGS=$(sudo docker exec cheers_backend sh -c 'if [ -f /app/data/security-audit.log ]; then tail -n 10 /app/data/security-audit.log; fi' 2>/dev/null || true)
if [ -n "$APP_LOGS" ]; then
  echo "$APP_LOGS"
else
  echo " ✅ 異常アクセスログはありません"
fi
echo ""

echo "【5. 現在の待機ポート（TCP）】"
ss -tlnH | awk '{print "  " $4}'
echo ""

echo "【6. 外部リアルタイム通知（Webhook）設定】"
if grep -qE '^SECURITY_WEBHOOK_URL=https?://' /home/kenshi/cheers-app/.env 2>/dev/null; then
  echo " ✅ Webhook 通知: 有効"
else
  echo " ℹ️  Webhook 通知: 未設定（/home/kenshi/cheers-app/.env の SECURITY_WEBHOOK_URL に Discord/Slack のURLを設定すると即時通知されます）"
fi
echo "============================================================"
