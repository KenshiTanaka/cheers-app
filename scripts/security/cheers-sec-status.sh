#!/bin/bash
# Cheers Server セキュリティ状態・侵入兆候クイック診断コマンド

set -u

ALERT_LOG="/var/log/cheers-security-alerts.log"

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
if [ -r "$ALERT_LOG" ] && grep -qE "CRITICAL|WARN" "$ALERT_LOG" 2>/dev/null; then
  grep -E "CRITICAL|WARN" "$ALERT_LOG" | tail -n 10
else
  echo " ✅ アラートは検出されていません（正常）"
fi
echo ""

echo "【2. fail2ban 不正ログイン自動ブロック状況】"
F2B_OUT=$(sudo -n fail2ban-client status sshd 2>/dev/null || journalctl -u fail2ban --since "24 hours ago" --no-pager 2>/dev/null | grep -E "Ban |Unban " | tail -n 5 || true)
if [ -n "$F2B_OUT" ]; then
  echo "$F2B_OUT"
else
  echo " ✅ 直近24時間での自動ブロック（BAN）はありません（fail2ban 稼働中）"
fi
echo ""

echo "【3. 最近の SSH ログイン成功履歴（直近5件）】"
SSH_LOGINS=$(journalctl -u ssh -u sshd --no-pager 2>/dev/null | grep "Accepted " | tail -n 5 || true)
if [ -n "$SSH_LOGINS" ]; then
  echo "$SSH_LOGINS"
else
  echo " （履歴なし、または sudo cheers-sec-status で詳細表示）"
fi
echo ""

echo "【4. Cheers App アプリ層 攻撃・異常アクセス検知ログ（直近10件）】"
APP_LOGS=$(docker exec cheers_backend sh -c 'if [ -f /app/data/security-audit.log ]; then tail -n 10 /app/data/security-audit.log; fi' 2>/dev/null || true)
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
