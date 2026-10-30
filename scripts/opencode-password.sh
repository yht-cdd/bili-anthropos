#!/bin/bash
# 从 service.json 或 journald 获取当前 opencode serve 的密码
if [ -f /root/.config/opencode/service.json ]; then
  PW=$(node -e 'try{console.log(require("/root/.config/opencode/service.json").password)}catch(e){}' 2>/dev/null)
  if [ -n "$PW" ]; then echo "$PW"; exit 0; fi
fi
journalctl -u opencode --no-pager -n 200 2>/dev/null | grep -oP 'server password \K\S+' | tail -1
