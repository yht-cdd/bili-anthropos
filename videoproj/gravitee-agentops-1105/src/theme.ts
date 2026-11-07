// 全局视觉系统 — brief §一（色值沿用 v3 theme，错误红/终端灰按 brief 给定值）
// 16:9 铁律（2026-11-03 主人令）：1920×1080@30fps，总 1650 帧 = 55.0s
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 1650; // 55.0s · brief §一

// 背景
export const BG = '#080B12'; // 底（渐变上端 / 常规纯色底）
export const BG_GRAD_TOP = '#080B12';
export const BG_GRAD_BOTTOM = '#121822';
export const SURFACE = '#0F131C'; // 终端窗表面（同 v3）

// 文字 / 品牌色（brief §一给定值）
export const TEXT = '#ECE9E1'; // 米白
export const CORAL = '#D97757'; // 珊瑚
export const LIME = '#D4F43E'; // 青柠
export const RED = '#F0524D'; // 错误红
export const TERM_GRAY = '#8B949E'; // 终端灰
export const ZHIPU = '#5B5CF2'; // 智谱紫
export const GRAY = '#6B7280'; // 顶栏 / 眉题（同 v3）
export const WHITE = '#FFFFFF';

// 字体：兜底链同 v3（本机 Noto Sans CJK 已装；JetBrains Mono 未装按链走）
export const FONT_SANS =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";
