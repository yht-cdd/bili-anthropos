#!/bin/bash
# cookie-maintain.sh —— Cookie 每天的例行维护
# ============================================================
# 由 anthropos-cookie.timer 每天调一次。做三件事，按顺序：
#
#   ① 有 refresh_token 就续一次（扫过码之后才有）。
#      refresh_token 有效期 180 天，每刷一次就重新滚到 180 天 ——
#      这就是「扫一次，之后不用管」的全部秘密。
#   ② bili_ticket / buvid 保活（那些 3 天到期的旁支凭据）。
#   ③ 最后用 nav 接口验一次：到底还能不能用。
#
# 退出码：0 健康 / 1 需要主人重新扫码

set -u
LIFE="${LIFE_HOME:-/opt/life}"
LOG="$LIFE/bili/logs/cookie.log"
NODE="${NODE_BIN:-/usr/local/bin/node}"
[ -x "$NODE" ] || NODE="$(command -v node)"

mkdir -p "$(dirname "$LOG")"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
say() { echo "[$(ts)] $*" >>"$LOG"; }

cd "$LIFE" || exit 1
say "──── 每日维护开始 ────"

# ① 续期
"$NODE" scripts/bili-login.mjs refresh >>"$LOG" 2>&1
RC=$?
case "$RC" in
  0) say "✅ refresh_token 续期成功" ;;
  2) say "ℹ️ 没有 refresh_token（这份是手动复制的 Cookie，续不了），只能靠保活拖延" ;;
  *) say "⚠️ 续期失败（退出码 $RC）" ;;
esac

# ② 旁支保活
"$NODE" scripts/bili-cookie.mjs all >>"$LOG" 2>&1
RC2=$?
[ "$RC2" -eq 0 ] && say "✅ ticket / buvid 保活完成" || say "⚠️ 保活失败（退出码 $RC2）"

# ③ 最终判断
"$NODE" scripts/bili-login.mjs status >>"$LOG" 2>&1
RC3=$?

if [ "$RC3" -eq 0 ]; then
  say "✅ 登录态正常"
  exit 0
fi

say "❌ 登录态仍然不通 —— 需要主人重新扫码"
/usr/bin/env node "$LIFE/scripts/alert.mjs" \
  "B 站登录态失效，需要扫一次码" \
  "自动续期没能救回来：refresh_token 也过期了，或者这份 Cookie 本来就是手动复制的、没有续期能力。

解决只要一步：在服务器上跑

    node /opt/life/scripts/bili-login.mjs qr

把打出来的二维码用 B 站手机 App 扫一下，之后 180 天内都会自动续期，不用再管。
（我这边也会在私信/邮箱里把码递给你。）

在她恢复登录之前：私信收不到、评论回不了、视频也发不出去。只有日记照写。" \
  >>"$LOG" 2>&1

exit 1
