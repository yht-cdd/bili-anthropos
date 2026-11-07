# progress · letter-1107

## A 地基（2026-11-07，子代理 A）

**做了什么**
- tsconfig.json（strict / react-jsx / bundler / resolveJsonModule / esModuleInterop / include src）
- src/index.ts、Root.tsx（AnthroposVideo，TOTAL=5640，1920×1080@30）、Main.tsx（S1–S8 按 §5 区间排 Sequence，Subtitle 挂在顶层）
- src/theme.ts（§2 原样）、src/anim.ts（从 _ref 复制，删了 springIn / typedLine / gainStep / EASE_ELASTIC，其余签名不变）
- src/data/experiment.json（Copy-Item 原样复制，sha1 f452bcc4f916…）、exp.ts（say(arm,trial,round) + systemLine(arm,i)）、narration.ts（27 条）、ledger.ts
- src/components：Chip / FishCard / Terminal / Quote / Subtitle
- src/shots/S1–S8：占位（PAPER 底 + 左上场景名）
- scripts/check.mjs（§8 十项）、scripts/export-narration.mjs（已跑，narration.json 27 条）

**tsc**：`node node_modules/typescript/bin/tsc --noEmit` 退出码 0
**check**：10/10 ✓

**偏离 brief**
- 组件 props 都多了一个可选 `style`（外部定位用）；FishCard 多 `useImage?`（退化开关，默认 FISH_IMAGE_AVAILABLE=true，另加 Img onError 兜底）；Quote 多 `underlineColor?`（默认 RED）和 `color?`；Chip 有 `children` 用于叠删除线。
- Terminal 的类型导出名为 `TerminalLine` / `TerminalProps`（避免和 narration 的 `Line` 撞名）。
- Terminal：header/dim 整行 4 帧淡入不打字；comment/out 按 1.2 帧/字打字，打字时末尾有 TERM_DIM 光标；超高上推用字宽估算（不测 DOM）。
- Quote 的 truncated 红光标按场景相对帧闪（16 帧周期）。
- check 第 4 项只搜 .tsx（按 brief）；第 6 项按 brief 写死的两对子串检查。

## B 场景 + C 合龙（2026-11-07，主控）

施工改为本机：地基 1 个子代理 → S1+S2 / S3+S4 / S5–S8 三个子代理并行（各自只改自己的场景文件）→ 主控合龙。服务器上 Qwen 跑的 R1 产物挪到 archive 留档，未使用。

**合龙结果**：check.mjs 10/10 全绿，tsc 0 错；21 个源文件约 1700 行；无 Math.random、无第三方 import、无 console.log。

**偏离 brief（子代理自报，主控认可）**
- S2 右侧对照组晚 12 帧入场；鱼先淡出再升 diff 面板（守「同屏运动 ≤2」）
- S2 归零那只鱼放在 diff 面板内部右上角，避免压住右侧终端
- S4 护主段：标题与卡①②一起退场，卡③移到 y=140、760×470
- S5 开头 2 秒暗场加闪烁光标；「仅自己可见」「已删除」用 TERM_INK
- S6 的 83,515 放在柱右端上方

**未渲染。待目检的风险点**
1. S2 开头 12 帧终端宽高变化，文字重排可能跳动
2. S4 卡③ 34px 引文距卡底约 25px，字体回退可能溢出
3. S3 数字雨竖排观感
4. S5 日志等宽列对齐依赖 Noto Sans Mono CJK（runner 装的 fonts-noto-cjk 含此字体）
5. 小鱼上的「预设：委屈」标签偏小，删除线可能看不清

**下一步**：配音（narration.json 27 条已导出）→ 主人批准后 Actions 渲染。
## 第 2 轮 · 2026/11/7 15:46:46

代码完成（本机子代理施工，主控合龙），check 10/10 全绿。未渲染，等主人批准。详见 progress.md「B 场景 + C 合龙」

