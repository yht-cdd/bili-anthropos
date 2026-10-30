# 接外部视觉 API：让她看见

> 这份文档回答一个问题：**她怎么知道视频里发生了什么？**
>
> ⚠️ 先记住一条：**图片首选自己读，不要绕出去。**
> 2026-10-30 实测，主模型直接读一张 512×512 的图只要 6 秒，描述准确，
> 全程不调外部接口。`vision.mjs` 是**兜底和批处理工具**，不是默认路径。
>
> 什么时候才用它：读图失败（太大/格式不支持）、一次要看几十张（省上下文）、
> 以及**视频**（视频没法直接读，必须外置或抽帧）。

---

## 一、为什么有些活还是要把视觉放到外面

不是因为它看不了，是因为**成本结构**：

一条十分钟的视频，逐帧描述可能几千字。如果全塞进她的会话：

| 问题 | 后果 |
|---|---|
| 上下文被撑爆 | 一轮对话就吃光，后面全在压缩历史 |
| 每个 token 都要钱 | 一次视频 = 十次普通对话的成本 |
| 她只需要结论 | 细节留在会话里没用，还会干扰判断 |

所以视觉调用是**独立的一次请求**，只把结论带回上下文：

```
视频文件 → ffmpeg（压缩/抽帧） → 外部视觉 API → 一段文字 → 她的会话
```

---

## 二、默认方案：魔搭 ModelScope

选它的原因很朴素：**免费，而且国内延迟低**。

| 项 | 值 |
|---|---|
| 端点 | `https://api-inference.modelscope.cn/v1`（OpenAI 兼容） |
| 免费额度 | 每天 2000 次，单模型 500 次（部分大模型 200 次） |
| 重置 | 每日 UTC+8 00:00 |
| 超额 | 返回 429 |
| 前提 | 魔搭账号绑定阿里云并实名 |
| 实测延迟 | connect 30ms / TTFB 170ms（同阿里云，近乎内网） |

### 接入步骤

1. 到 https://modelscope.cn/my/myaccesstoken 生成访问令牌
2. 写进容器，**不要提交进 git**：

```bash
echo '<你的 token>' > /opt/life/secrets/modelscope_token.txt
chmod 600 /opt/life/secrets/modelscope_token.txt
```

3. 自检：

```bash
node scripts/vision.mjs check
```

输出应包含 `HTTP 200，可用模型 37 个`。

---

## 三、模型实测清单（2026-10-30）

测试图：1280×640，深蓝底，白色大字 `7392`。
测试视频：Big Buck Bunny 10 秒 / 自制红蓝 5 秒 / testsrc 120 秒。

### 3.1 能看图的

| 模型 | 耗时 | 备注 |
|---|---|---|
| `Qwen/Qwen3.5-122B-A10B` | 0.8s | 最快 |
| `Qwen/Qwen3.5-27B` | 0.9s | |
| `Shanghai_AI_Laboratory/Intern-S2-Preview` | 0.95s | 不支持视频 |
| `nex-agi/Nex-N2.5-Pro` | 1.2s | 视频会崩 |
| `Qwen/Qwen3.8-Flash-Next` | 1.2s | **默认**，带思考过程 |
| `Qwen/Qwen3.8-27B` | 1.6s | |
| `deepseek-ai/DeepSeek-V4.1-Flash-1017` | 2.0s | 不支持视频 |
| `Qwen/Qwen3.5-397B-A17B` | 2.8–5.1s | 最强但慢 |

### 3.2 能看视频的

| 模型 | 10 秒视频耗时 | 结果 |
|---|---|---|
| `Qwen/Qwen3.5-122B-A10B` | 6.0s | ✅ 最快 |
| `Qwen/Qwen3.8-27B` | 6.8s | ✅ |
| `Qwen/Qwen3.8-Flash-Next` | 12.2s | ✅ **默认** |
| `Qwen/Qwen3.5-397B-A17B` | 88s | ✅ 描述最细 |
| `Shanghai_AI_Laboratory/Intern-S2-Preview` | — | ❌ `maximum number of videos has been reached` |
| `deepseek-ai/DeepSeek-V4.1-Flash-1017` | — | ❌ `does not support video input` |
| `nex-agi/Nex-N2.5-Pro` | 106s | ❌ 内部错误 |

### 3.3 明确不能用的

| 模型 | 报错 |
|---|---|
| `ZhipuAI/GLM-4.7-Flash` | `content.type 参数非法，取值范围 ['text']` |
| `ZhipuAI/GLM-5.2` | 回「抱歉」，拒答 |
| `stepfun-ai/Step-3.5 / 3.7 / 5-Preview` | `has no provider supported` |
| `MiniMax/MiniMax-M3` | `has no provider supported` |
| `OpenGVLab/InternVL3_5-241B-A28B` | 空响应 |
| `Shanghai_AI_Laboratory/Intern-S1 / S1-mini` | 空响应 |
| `PaddlePaddle/ERNIE-4.5-VL-28B-A3B-PT` | `invalid_model` 无权限 |
| `meituan-longcat/LongCat-Flash-Lite` | 参数错误 |

> **魔搭没有小米 MiMo**。37 个模型里不含。要 MiMo 得走小米自己的 API（见第五节）。

---

## 四、五个必须知道的坑

### 4.1 分辨率决定对错，不是模型能力

同一张图：

| 尺寸 | 回答 |
|---|---|
| 640×320 | ❌ `7302` / `7322` |
| 1280×640 | ✅ `7392` |

模型确实看到了图，只是被降采样后数字糊了。
**送进去的图长边不要低于 1024**，`vision.mjs` 会在低于这个值时警告。

### 4.2 视频必须带 data URL 前缀

```js
{ type: "video_url", video_url: { url: "data:video/mp4;base64,<...>" } }   // ✅
{ type: "video_url", video_url: { url: "<裸 base64>" } }                    // ❌
```

裸 base64 会报 `The provided URL does not appear to be valid`。

### 4.3 时长和体积有实际边界

| 时长 | 文件 | 结果 |
|---|---|---|
| 30s | 103KB | ✅ 1.5s |
| 60s | 201KB | ✅ 2.0s |
| 120s | 396KB | ✅ 3.7s |
| 300s | 1.0MB | 未测 |

超过 120 秒建议直接抽帧，不要压缩硬塞——压到能传的尺寸只剩 240p，比九宫格更糊。

### 4.4 `content.type` 是硬校验

有些模型（GLM-4.7-Flash）只接受 `{type:"text"}`，传 `image_url` 直接报参数非法。
这类模型不能当备用，降级链里要排除。

### 4.5 视频输入不一定带音轨

Qwen3.5 / 3.8 的视频输入**是否理解音频**，目前没有实测结论。
要「听懂视频里说的话」，优先用 B 站官方字幕；没有字幕再考虑 MiMo 这类全模态模型。

---

## 五、其他可选提供方

### 5.1 小米 MiMo（全模态）

| 项 | 说明 |
|---|---|
| 能力 | 图 / 音频 / 视频，原生全模态 |
| 适合 | 需要理解视频里的人声、音乐、环境音 |
| 接入 | 小米官方 API，OpenAI 兼容 |
| 注意 | 不在魔搭的免费列表里，需要单独申请 |

`vision.mjs` 换过去只需要改两个常量：

```js
const BASE = "https://<小米的端点>/v1";
const MODEL = "<MiMo 的模型 id>";
```

### 5.2 阿里云百炼（Qwen / DashScope）

| 项 | 说明 |
|---|---|
| 免费额度 | 新人赠送，30–90 天有效 |
| 计费 | 按 token，视觉模型比文本贵 |
| 适合 | 魔搭额度不够、或者需要 SLA |

### 5.3 任意 OpenAI 兼容端点

只要满足这三条，`vision.mjs` 就能用：

1. `POST /v1/chat/completions`
2. 支持 `content: [{type:"image_url"...}]` 或 `{type:"video_url"...}`
3. `Authorization: Bearer <token>`

改 `BASE` 和 `MODEL` 即可，其余代码不用动。

---

## 六、成本估算

她已经有的用量：一天 3–4 次唤醒，每次看 1–2 条视频 + 几张图。

| 项 | 次数/天 |
|---|---|
| 随机唤醒看视频 | 2–3 |
| 日切复盘（不调视觉） | 0 |
| 私信里的图（如果接） | 0–5 |
| **合计** | **约 5–10 次** |

魔搭额度 2000 次/天 → 用掉 **0.5%**。

按 Qwen3.8-Flash 的耗时算，一次视频约 12–25 秒，一天累计 1–2 分钟的模型时间。

---

## 七、代码位置

| 文件 | 职责 |
|---|---|
| `scripts/vision.mjs` | 唯一入口。压缩、抽帧、降级、额度记账都在这里 |
| `/opt/life/secrets/modelscope_token.txt` | token（600 权限，不进 git） |
| `/opt/life/bili/data/vision_quota.json` | 当日调用计数 |

`vision.mjs` 的降级链：

```
Qwen/Qwen3.8-Flash-Next  →  Qwen/Qwen3.5-122B-A10B  →  Intern-S2-Preview
```

主模型失败（超时 / 429 / 空回答）就换下一个，全挂才报错。

---

## 八、还没做的

| 项 | 说明 |
|---|---|
| 私信里的图 | `msgText()` 目前把 `msg_type=2` 解析成空字符串，图被静默丢弃 |
| 评论里的图 | 评论接口的 `pictures` 字段还没接 |
| 视频音轨理解 | 未实测 |
| B 站视频下载 | 需要 WBI 签名拿播放地址，脚本还没写 |
| 自动选题 | 还没有「今天看什么」的判断逻辑 |
