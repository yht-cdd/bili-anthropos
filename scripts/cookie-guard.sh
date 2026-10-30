#!/bin/bash
# Cookie 守护：跑一次全量维护，失败则告警
LIFE=/opt/life
LOG=$LIFE/bili/logs/cookie.log
mkdir -p "$(dirname "$LOG")"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

{
  echo ""
  echo "──────── $(ts) ────────"
  cd "$LIFE" && /usr/local/bin/node scripts/bili-cookie.mjs all
  EC=$?
  echo "退出码: $EC"
} >> "$LOG" 2>&1

if [ $EC -ne 0 ]; then
  cat >> $LIFE/ALERT.md <<ALERT

## $(ts) · Cookie 失效（退出码 $EC）

**需要人工介入**：在本地 Chrome 打开 bilibili.com 扫码登录，然后重新导出 Cookie。

- 日志：\`$LOG\`
- Cookie 文件：\`$LIFE/secrets/bili_cookie.txt\`

ALERT
  echo "[$(ts)] ❌ Cookie 维护失败，已写 ALERT.md" >&2
  exit $EC
fi

echo "[$(ts)] ✅ Cookie 维护完成"
