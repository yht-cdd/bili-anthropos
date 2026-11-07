# ai-agent-promo 封面设计说明

- 日期：2026-11-02 · 制作：子代理（PIL 拼合，SVG 素材 cairosvg 栅格化）
- 成品：`cover-main-nebius.png`（主版）、`cover-alt-nvidia.png`（NVIDIA 备选版），1920×1080

## 核心主题（写进设计）

这些厂商的 AI 不是被困在网页/App 里的 C 端——agent 让你把它们接进自己的设备干活。
右下角一句话：**「把它们接进你的设备」**（9 字）。

## 字母拼法（按主人规格）

### 第一行「AI」（大字号，米白 #ECE9E1）

| 元素 | 来源 | 说明 |
|---|---|---|
| A（含斜杠） | Anthropic 官方 logomark（simpleicons `anthropic` 矢量） | 该标本身就是「A+右斜杠」构成，**斜杠天然充当 I**，故未再另加独立 I 字。初版曾加直 I，vision 质检读成「A\|I」，删掉后两版均读作 AI |
| 星芒点缀 | Claude 放射状星芒标（simpleicons `claude`，官方珊瑚色 #D97757） | 主人说的「放射状星芒标」即 Claude 产品标，不读字母，保留为斜杠顶端的小装饰 |

### 第二行「AGENT」（中字号，五个字母各用一家 logo）

| 字母 | 厂商 | 素材来源 | 处理 |
|---|---|---|---|
| A | **Agnes AI**（新加坡模型厂商，Agnes 3.0 Flash，agnes-ai.com / api.agnes-ai.cn，OpenAI+Anthropic 双兼容 API） | 官方色标（asvg.app `agnes-ai-logomark-rounded-color.svg`，蓝 #3248AF + 白 swirl） | 官方标是圆角块里的 swirl 图形、不读字母 → 用品牌蓝画 Archivo Black 大 A，把官方白色 swirl 抠出来嵌在横杠位置（提亮为 #4A63D8 保证深底可读） |
| G | Google | 官方彩色 G（asvg.app `google-logomark-color.svg`） | 原色直接用，圆形略加过冲 |
| E | 小米 MiMo | 官方词标（asvg.app `xiaomi-mimo-symbol-monochrome.svg`） | 取词标中标准小写 m（两拱三竖）**逆时针转 90°** → 左脊三横的圆角 E，染小米品牌橙 #FF6900。注：MiMo 自家 M 是断笔设计，转出来底横分离，故取同词标里的完整 m |
| N | 见下节 | — | 两版唯一差异 |
| T | 腾讯文档 | App Store 官方 512px 图标（docs.qq.com，iTunes lookup API） | 官方图标白字本身就是一支「带横翅的 T/箭头」，蓝色圆角块原样使用 |

## N 的调研结论（2-3 候选 + 推荐）

| 候选 | logo 形态 | 评价 |
|---|---|---|
| **Nebius**（AI 基础设施厂商） | **logo 标就是字母 N 本身**：两条竖杠+斜杠的几何 N（官网 media kit，品牌青柠色 #D4F43E） | ✅ **推荐、做主版**。形态零改造、天然拼进 AGENT；AI infra 身份贴合「接进设备干活」叙事 |
| NVIDIA | 官方标是「眼睛」旋涡图，**不含 N 字形**；wordmark 里的 N 是定制字体、无公开单字 SVG | ⚠️ 备选版。用 Archivo Black 大写 N 染官方绿 #76B900 近似 wordmark N——识别度高但属于字体近似，非原标 |
| 网易 NetEase | 标是「网易」汉字/红色印章风，无 N 字形 | ❌ 排除，拼不进字母 |

## 排版与背景

- 深色底：#080B12→#121822 纵向渐变 + 中央蓝色柔光（高斯模糊椭圆）
- 第一行字高 430px，第二行 250-262px，字间距 88px（呼吸感），整体居中
- 右下角主题句：思源黑体 Bold 58px，前缀珊瑚色竖条
- 字体：Archivo Black（拉丁）、Noto Sans CJK SC Bold（中文）

## 质检

两版均过 `vision.mjs` 独立识别：第一行读作 AI ✓、第二行读作 AGENT ✓、无认不出的字母/画面缺陷 ✓。
图上无服务器/路径/凭据信息；logo 仅用于本视频封面语境。

## 素材链接

- https://cdn.simpleicons.org/anthropic / https://cdn.simpleicons.org/claude
- https://asvg.app/icons/google / https://asvg.app/icons/xiaomi-mimo / https://asvg.app/icons/agnes-ai / https://asvg.app/icons/nebius
- 腾讯文档图标：iTunes Search API（is1-ssl.mzstatic.com AppIcon 512px）
- Agnes AI 背景：https://wiki.agnes-ai.cn/zh-Hans/docs/agnes-30-flash 、https://fintechnews.sg/132223/ai/agnes-ai-says-its-singapore-built-models-enter-global-ai-rankings/
- Nebius 品牌色：https://nebius.com/media-kit
