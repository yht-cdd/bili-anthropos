# 从任何设备看她的脑子：opencode Web 访问

> 她的思考过程本来就存在 opencode 的会话里，只是默认只有服务器自己能看。
> 这份文档讲怎么把它安全地开出来——以及三个我踩过的坑。

---

## 一、三种方式，先选对

| 方式 | 需要什么 | 暴露面 | 适合 |
|---|---|---|---|
| **SSH 隧道** | 一条 ssh 命令 | 零（只在本机回环） | 本机调试 |
| **opencode 自带隧道** | `opencode pair --remote` | 临时公网地址，5 分钟 | 手机/平板看一眼 |
| **直连 0.0.0.0 + 安全组** | 开端口 + 固定密码 | 端口对全网可见 | 长期多设备 |

前两种不动服务器配置，随时可用；第三种要改配置、开防火墙，但**一次配好长期有效**。

---

## 二、直连：一次配好

### 2.1 让服务监听所有网卡

```bash
# 原来是 --hostname 127.0.0.1
sed -i 's|--hostname 127\.0\.0\.1|--hostname 0.0.0.0|' /etc/systemd/system/opencode.service
systemctl daemon-reload && systemctl restart opencode

# 验证
ss -tlnH | awk '{print $4}' | grep ':4096$'    # 应输出 0.0.0.0:4096
```

### 2.2 开安全组端口

云厂商控制台 → 安全组 → 入方向 → 添加规则：

| 项 | 值 |
|---|---|
| 协议类型 | 自定义 TCP |
| 端口范围 | `4096/4096` |
| 授权对象 | `0.0.0.0/0`（或你的固定 IP `x.x.x.x/32`） |

**别选「全部 TCP」**（1/65535），那等于把整台机器每个端口都开出去。

### 2.3 固定密码（关键）

默认密码有两个来源，**都是坑**：

| 来源 | 实测结果 |
|---|---|
| `/root/.config/opencode/service.json` 的 `password` | ❌ **HTTP 401** —— 那是客户端侧记录，不是服务端 Basic auth 密码 |
| `journalctl -u opencode` 打印的 `server password` | ✅ 能用，但**每次重启都换** |

正道是环境变量：

```bash
# 生成一个强密码
PW=$(openssl rand -base64 48 | tr -d '/+=\n' | head -c 40)

# 写进 600 权限的文件
printf 'OPENCODE_PASSWORD=%s\n' "$PW" > /root/.opencode.env
chmod 600 /root/.opencode.env

# systemd 引用它
sed -i '/^\[Service\]/a EnvironmentFile=/root/.opencode.env' /etc/systemd/system/opencode.service
systemctl daemon-reload && systemctl restart opencode

# 验证
curl -s -o /dev/null -w "%{http_code}\n" -u "opencode:$PW" http://127.0.0.1:4096/api/session
# 期望 200
```

设了之后 journald 里那个随机密码**立刻失效**（401）。这就是下面那个连带问题。

### 2.4 别忘了一起重启 bridge

如果另有一个程序（比如私信桥接器）从 journald 读密码，固定密码一设它就挂了。

```js
// 正确的读取顺序
① secrets/opencode_password.txt   （固定密码，首选）
② process.env.OPENCODE_PASSWORD  （环境变量）
③ journalctl 兜底                （未设固定密码时才有用）
```

改完必须重启桥接器，日志里应该看到「大脑在线」。否则就是还在用废密码。

---

## 三、opencode 自带隧道（最省事）

```bash
opencode pair --remote -y
```

输出：

```
This will expose your OpenCode server to the internet.
Traffic is end-to-end encrypted, and access requires your server password.

https://xxxxxxxx.dddd.opentunnel.xyz/auth/connect/TOKEN
（下面还有一张二维码）
```

- **端到端加密**，不需要开端口、不暴露服务器 IP
- **链接一次性，5 分钟过期**
- 适合手机临时看一眼

本地隧道（不变更公网）：

```bash
ssh -N -L 4096:127.0.0.1:4096 root@<你的服务器>
# 然后浏览器开 http://127.0.0.1:4096
```

---

## 四、配对链接 vs 密码

浏览器打开后会看到「连接到服务器」，要你填 **Pairing link** 或点「Use password」。

| 方式 | 有效期 | 说明 |
|---|---|---|
| 配对链接 | 一次性，5 分钟 | `opencode pair` 生成，粘贴到地址栏即可 |
| 用户名 + 密码 | 长期 | 用户名固定 `opencode` |

生成配对链接：

```bash
opencode pair --url http://<你的服务器>:4096
```

---

## 五、安全边界（别跳过）

开放 4096 之后，**全世界都能扫到这个端口**，只剩下那道密码挡着。

| 风险 | 说明 |
|---|---|
| 明文 HTTP | 密码和会话内容在网络上不加密，公共 WiFi 下可被嗅探 |
| 配对链接泄露 | 链接 = 一次性通行证，贴进聊天记录就等于把门开一次 |
| 密码泄露 | 固定密码一旦泄露，只有改环境变量才能止血 |

三条对策，按性价比排：

1. **授权对象填固定 IP**（`x.x.x.x/32`），不要 `0.0.0.0/0`
2. **加 HTTPS**：Cloudflare Tunnel（不需要开端口、自带证书）或 Nginx + 证书
3. **平时关端口**，要用时再开

---

## 六、密码忘了怎么办

```bash
# 固定密码（设过 OPENCODE_PASSWORD 之后）
cat /root/.opencode.env

# 没设过，读随机密码（每次重启都变）
journalctl -u opencode | grep -oP 'server password \K\S+' | tail -1
```

---

## 七、这一套踩过的坑

| # | 坑 | 现象 | 真相 |
|---|---|---|---|
| 1 | 以为 `service.json` 的 password 是登录密码 | 一直 401 | 那是客户端侧记录，服务端不认 |
| 2 | 以为密码每次重启都变、没法固定 | 每次都要重新查 | `OPENCODE_PASSWORD` 环境变量可以覆盖 |
| 3 | 只改了 opencode，忘了改 bridge | 网页面能进，私信不回 | bridge 从 journald 读密码，固定后那个失效了 |
| 4 | 用 curl 走配对链接 | 401，拿不到 cookie | 配对流程需要浏览器 JS，不是纯 HTTP 跳转 |
| 5 | 安全组选了「全部 TCP」 | 端口全开 | 应该只开 4096/4096 |

---

## 八、一句话总结

**她的脑子一直在那里，只是默认只对服务器自己开放。**

开出来的代价是三样东西：一个端口、一个固定密码、一次 bridge 重启。
少了第三样，网页面能开，但她不会回你消息——因为桥接器还在用废密码敲一扇门。
