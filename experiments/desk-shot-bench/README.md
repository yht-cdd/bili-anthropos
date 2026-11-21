# S2-3｜从终端到书桌 · 私有动效样片

> 22 秒、30 fps，`1920×1080` 的镜头工程。此目录用于内部视觉验证，**不代表可以公开投稿**。角色是原创折纸螃蟹占位，不是 Anthropic/Claude Code 的 Clawd；终端文字是明确标注“画面模拟”的原创示意，不冒充真实制作日志。

## 分镜

| 局部帧 [起,止) | 内容 |
|---|---|
| 0–66 | 模拟终端充满画面；贴近 3D 笔记本屏幕渐变交接。 |
| 66–210 | 摄影机缓慢后拉；银灰电脑、键盘、零食袋、红黑双笔、线圈本依次露出。 |
| 210–330 | 折纸螃蟹从屏幕下缘出现、组装，落到键盘中左位置。 |
| 330–465 | 键帽轻微触碰；角色小幅摆钳，镜头观察桌面道具。 |
| 465–635 | 桌景停稳、出现关于本片制作选择的原创字幕。 |
| 635–660 | 渐黑，预留给未定的下一幕。 |

## 工程结构

- `src/DeskShot.tsx`：镜头、光照、3D/字幕合成；`src/Root.tsx`：分辨率、帧率与时长。
- `src/components/Desk.tsx`：程序化书桌与笔记本、键帽、双笔、零食袋、线圈本；屏幕图是可替换的纹理参数。
- `src/components/Crab.tsx`：独立原创角色，所有运动由局部帧号确定；没有时钟、随机运行态或外部资产。
- `assets/terminal.svg`、`public/terminal.svg`：脱敏的模拟界面，**不可当真实制作日志传播**。
- `package-lock.json`：锁定目前的 Remotion/Three/React 依赖；源码保留，可在具备相应软件 WebGL/GPU 的机器上复现。

## 在具备正常图形运行环境的计算机上复现

```sh
npm ci
npm run typecheck
npx remotion browser ensure
npx remotion still src/index.ts DeskShot out/test.png --frame=330 --gl=swangle
npx remotion render src/index.ts DeskShot out/desk-shot.mp4 --codec=h264 --concurrency=1 --gl=swangle
```

这里的 ARM64/Android 宿主容器虽能安装并运行 Chromium 158 `--version`，但真正启动 headless 浏览器时以 `SIGTRAP` 退出；日志也出现受限的 `/proc/sys/fs/inotify/max_user_watches` 读取错误，Chromium 源码对此读取错误有容错回退，**不能认定它是 SIGTRAP 的原因**。当前真正崩溃点未确定；不修改 `/proc`、SELinux 或系统权限，也不在同一二进制上盲目重试。本机将另行验证不依赖 Chromium 的离线 Three.js 软件渲染预演；若后续有视频文件，其真实画质与所用管线要以实测为准，不能把软件预演称为照片级最终 3D 成片。

## 权利和安全

- 不直接使用原用户的桌面照片、真实邮箱、历史会话、网站截图或第三方用户评论；书桌只是参考物件布局，终端画面为新作。
- 该样片无权替代正式品牌与素材授权。若换回 Clawd 或 DeepSeek/鲸鱼娘形象、真实信件/日志，先厘清使用许可和传播范围。
- 本项目没有下载未核验的商标/角色美术资源，不上传原始包到公开仓库或云端；现阶段视频如能渲出，仅供用户审片。
- 首轮配音/音乐不在本镜头范围；当前预览为静音。制作音频文件的某次操作遇到原生保护阻断，未换路径绕过。
