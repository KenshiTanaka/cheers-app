#!/bin/bash
# Cheers App / Ubuntu Server 侵入検知・改ざん検知 (IDS/FIM) モニター
# cron により 5 分おきに root 権限で実行されます

set -u

STATE_DIR="/var/lib/cheers-security"
BASELINE_FILE="${STATE_DIR}/fim-baseline.sha256"
PORT_BASELINE="${STATE_DIR}/ports-baseline.txt"
CRON_BASELINE="${STATE_DIR}/cron-baseline.sha256"
ALERT_LOG="/var/log/cheers-security-alerts.log"
ENV_FILE="/home/kenshi/cheers-app/.env"
MOTD_ALERT="/etc/update-motd.d/99-cheers-security-alert"

mkdir -p "$STATE_DIR"
touch "$ALERT_LOG"
chmod 644 "$ALERT_LOG"

# 監視対象クリティカルファイル
FIM_FILES=(
  "/etc/passwd"
  "/etc/shadow"
  "/etc/group"
  "/etc/sudoers"
  "/etc/ssh/sshd_config"
  "/home/kenshi/.ssh/authorized_keys"
  "/home/kenshi/cheers-app/.env"
  "/home/kenshi/cheers-app/docker-compose.prod.yml"
)

generate_fim_hashes() {
  for f in "${FIM_FILES[@]}"; do
    if [ -f "$f" ]; then
      sha256sum "$f"
    fi
  done
}

generate_ports_snapshot() {
  ss -tlnH | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\1/' | sort -nu
}

generate_cron_hash() {
  {
    crontab -l 2>/dev/null || true
    crontab -u kenshi -l 2>/dev/null || true
    ls -la /etc/cron.d/ /etc/cron.daily/ 2>/dev/null || true
  } | sha256sum | awk '{print $1}'
}

# ベースライン初期化モード (--init)
if [ "${1:-}" = "--init" ]; then
  generate_fim_hashes > "$BASELINE_FILE"
  generate_ports_snapshot > "$PORT_BASELINE"
  generate_cron_hash > "$CRON_BASELINE"
  chmod 600 "$BASELINE_FILE" "$PORT_BASELINE" "$CRON_BASELINE"
  echo "[$(date -Iseconds)] Baseline initialized." >> "$ALERT_LOG"
  echo "✅ セキュリティ監視ベースラインを初期化しました。"
  exit 0
fi

# 初回未作成なら自動作成
if [ ! -f "$BASELINE_FILE" ]; then
  generate_fim_hashes > "$BASELINE_FILE"
  generate_ports_snapshot > "$PORT_BASELINE"
  generate_cron_hash > "$CRON_BASELINE"
  chmod 600 "$BASELINE_FILE" "$PORT_BASELINE" "$CRON_BASELINE"
  exit 0
fi

ALERTS=()
NOW="$(date '+%Y-%m-%d %H:%M:%S')"

# 1. ファイル改ざん検知 (FIM)
CURRENT_FIM=$(generate_fim_hashes)
DIFF_FIM=$(diff -u "$BASELINE_FILE" <(echo "$CURRENT_FIM") || true)
if [ -n "$DIFF_FIM" ]; then
  CHANGED_FILES=$(echo "$DIFF_FIM" | grep -E '^[+-][0-9a-f]{64}' | awk '{print $2}' | sort -u | tr '\n' ' ')
  ALERTS+=("[CRITICAL] 重要ファイルの改ざんを検知しました: ${CHANGED_FILES}")
fi

# 2. 想定外ポート開放（バックドア）検知
CURRENT_PORTS=$(generate_ports_snapshot)
NEW_PORTS=$(comm -13 "$PORT_BASELINE" <(echo "$CURRENT_PORTS") || true)
if [ -n "$NEW_PORTS" ]; then
  PORTS_STR=$(echo "$NEW_PORTS" | tr '\n' ',' | sed 's/,$//')
  ALERTS+=("[CRITICAL] 新規の不明な待機ポートを検知しました: ${PORTS_STR}")
fi

# 3. Crontab（永続化バックドア）改ざん検知
CURRENT_CRON=$(generate_cron_hash)
OLD_CRON=$(cat "$CRON_BASELINE")
if [ "$CURRENT_CRON" != "$OLD_CRON" ]; then
  ALERTS+=("[CRITICAL] crontab の不正な変更を検知しました")
fi

# 4. SSH ブルートフォース / fail2ban BAN 検知（直近5分）
SSH_FAILS=$(journalctl -u ssh -u sshd --since "5 minutes ago" --no-pager 2>/dev/null | grep -cE "Failed password|Invalid user|authentication failure" || true)
if [ "${SSH_FAILS:-0}" -ge 10 ]; then
  ALERTS+=("[WARN] 直近5分間で SSH ログイン失敗が急増しています (${SSH_FAILS}回)")
fi

F2B_BANS=$(journalctl -u fail2ban --since "5 minutes ago" --no-pager 2>/dev/null | grep -c "Ban " || true)
if [ "${F2B_BANS:-0}" -ge 1 ]; then
  BANNED_IPS=$(journalctl -u fail2ban --since "5 minutes ago" --no-pager 2>/dev/null | grep "Ban " | awk '{print $NF}' | sort -u | tr '\n' ' ')
  ALERTS+=("[WARN] fail2ban が攻撃元 IP を自動ブロックしました: ${BANNED_IPS}")
fi

# 5. Cheers App アプリ層攻撃検知（直近5分の CRITICAL ログ）
APP_CRIT=$(docker exec cheers_backend sh -c 'if [ -f /app/data/security-audit.log ]; then tail -n 100 /app/data/security-audit.log; fi' 2>/dev/null | grep '"level":"CRITICAL"' | tail -n 5 || true)
if [ -n "$APP_CRIT" ]; then
  LAST_APP_HASH_FILE="${STATE_DIR}/last-app-crit.hash"
  CURR_APP_HASH=$(echo "$APP_CRIT" | sha256sum | awk '{print $1}')
  PREV_APP_HASH=$(cat "$LAST_APP_HASH_FILE" 2>/dev/null || true)
  if [ "$CURR_APP_HASH" != "$PREV_APP_HASH" ]; then
    echo "$CURR_APP_HASH" > "$LAST_APP_HASH_FILE"
    EVENTS=$(echo "$APP_CRIT" | grep -o '"event":"[^"]*"' | sort -u | tr '\n' ' ')
    ALERTS+=("[CRITICAL] Cheers App で攻撃パターンを検知しました: ${EVENTS}")
  fi
fi

# アラート記録 & 通知
if [ ${#ALERTS[@]} -gt 0 ]; then
  MSG="🚨 [Cheers Server Security Alert] (${NOW})\n"
  for a in "${ALERTS[@]}"; do
    echo "[${NOW}] ${a}" >> "$ALERT_LOG"
    MSG="${MSG}• ${a}\n"
  done

  # 外部 Webhook 通知 (Discord / Slack 互換)
  WEBHOOK_URL=""
  if [ -f "$ENV_FILE" ]; then
    WEBHOOK_URL=$(grep -E '^SECURITY_WEBHOOK_URL=' "$ENV_FILE" | head -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  fi

  if [ -n "$WEBHOOK_URL" ]; then
    JSON_CONTENT=$(printf '%b' "$MSG" | python3 -c 'import json,sys; s=sys.stdin.read(); print(json.dumps({"content": s, "text": s}))' 2>/dev/null || true)
    if [ -n "$JSON_CONTENT" ]; then
      curl -s -m 5 -H "Content-Type: application/json" -X POST -d "$JSON_CONTENT" "$WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
  fi
fi
