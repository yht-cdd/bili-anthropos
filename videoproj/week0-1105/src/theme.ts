// 全局视觉系统 — design-week0-opus.md §一 设计总纲（唯一依据）
// 色彩系统：多层次光影（深色基底 40-50% / 中调工作区 30-40% / 亮色信息层 / 强调色）
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 1980; // 66.0s @30fps · 附录 D2

// —— 色彩（设计稿给定值，逐字照抄）——
export const BG = '#0A0E14'; // 深色基底层
export const MID = '#1A1F2C'; // 中调工作区（浅灰蓝）
export const PAPER = '#ECE9E1'; // 亮色信息层 · 米白纸质
export const LIME = '#D4F43E'; // 亮色信息层 · 青柠高光
export const LEDGER = '#3FB68B'; // 亮色信息层 · 账本绿数据
export const CORAL = '#D97757'; // 强调 · 珊瑚温暖
export const RED = '#F0524D'; // 强调 · 错误红（仅「断供」与 S9「不。」）
export const BLUE_TOP = '#2A3F5F'; // S4-S7 手术蓝调渐变上端
export const BLUE_BOT = '#1A2F4F'; // S4-S7 手术蓝调渐变下端
// S1 背景：上暗下亮渐变（摄影表 S1）
export const BG_GRAD = `linear-gradient(180deg, ${BG} 0%, ${MID} 100%)`;
export const NEAR_WHITE = '#F5F3EE'; // S8-S10 近白背景
export const GRAY = '#8B949E'; // 次要灰

// —— 网格（§一：直接回应坑1）——
export const MARGIN = 80; // 安全边距（上下左右）
export const GUTTER = 32; // 列间隔
export const COL = 104; // 12 列网格列宽
export const BASE = 8; // 8px 基线：所有元素高度/间距为 8 的倍数
export const CARD_W = 480; // 主卡片 16:9
export const CARD_H = 270;
export const CARD_SM_W = 320; // 小卡片
export const CARD_SM_H = 180;
export const CARD_GAP = 24; // 卡片间距
export const RADIUS = 8; // Q4：边缘光必须被 border-radius 8px 裁剪

// —— 字体阶梯（px @1920×1080：72/60/48/36/32/28 六档）——
export const FS_TITLE = 72; // 主标题 Bold
export const FS_SLOGAN = 60; // 镜头标语 Bold（≥5.6% 帧高）
export const FS_CAPTION = 48; // 解说字幕（≥4.4%）
export const FS_DATA = 36; // 数据标注 Mono（≥3.3%）
export const FS_AUX = 32; // 辅助信息（≥3.0%）
export const FS_CODE = 28; // 代码/URL 底线（仅终端装饰层）

// 字体：仅 Noto Sans CJK SC + JetBrains Mono（§七硬约束）；兜底链同旧工程
export const FONT_SANS =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";

// —— 光影（§一：聚光锥 / 边缘光 / 投影）——
export const SHADOW = '0 4px 12px rgba(0,0,0,0.4)';
export const SPOTLIGHT = `radial-gradient(circle 600px at 50% 50%, rgba(26,31,44,0.2), rgba(26,31,44,0) 70%)`;
