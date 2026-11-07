// 全局视觉系统 — brief v2.1 §三「三色值表」，场景里不许另造颜色
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 1800; // 60.0s

// 背景：纵向渐变 + 中央蓝色柔光椭圆（模糊 180px）
export const BG_TOP = '#080B12';
export const BG_BOTTOM = '#121822';
export const GLOW = 'rgba(56,139,253,0.07)';
export const GLOW_BLUR_PX = 180;

// 三色体系
export const TEXT = '#ECE9E1'; // 主文字
export const CORAL = '#D97757'; // 强调1：「我/说话」侧
export const LIME = '#D4F43E'; // 强调2：「结果/通过」侧
export const ERROR = '#E5484D'; // 错误红
export const ERROR_GLOW = 'rgba(229,72,77,0.18)'; // S1 底光

// 终端
export const TERM_FG = '#3FB950'; // 终端前景（绿）
export const TERM_TEXT = '#C9D1D9'; // 终端文本
export const TERM_BORDER = '#30363D'; // 边框 2px
export const TERM_W = 1280; // 横版窗口宽
export const TERM_RADIUS = 24;

// 时间戳角标
export const TS_GRAY = '#8B949E';
export const TS_PX = 42;
export const TS_X = 64;
export const TS_Y = 96;

// 字幕安全区：距底 ≥120px（横版）
export const SUB_SAFE_BOTTOM = 120;

// 字体：本机装了 NotoSansCJK-Bold.ttc；JetBrains Mono 未装则按兜底链走
export const FONT_SANS =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";

// 节奏令（主人 22:30）：转场 crossfade 8 帧 / 硬切 4 帧 / 入场统一 10 帧 ease-out-cubic / 打字 32 字/s
export const CROSSFADE = 8;
export const HARDCUT = 4;
export const ENTER_FRAMES = 10;
export const TYPE_CPS = 32; // 字/秒
