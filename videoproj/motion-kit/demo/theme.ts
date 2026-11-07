// demo/theme.ts — 演示片视觉底盘（和 ai-agent-promo 同一套色，方便目检时不串味）
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 300; // 10 秒

export const BG_TOP = '#080B12';
export const BG_BOTTOM = '#121822';
export const TEXT = '#ECE9E1';
export const CORAL = '#D97757';
export const LIME = '#D4F43E';
export const ERROR = '#E5484D';
export const GRAY = '#8B949E';

export const FONT_SANS =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";

// 段落编号条：演示片专用的静态标记（不参与动效，SPEC 纪律 4 里它不算运动元素）
export const TAG_STYLE = {
  position: 'absolute' as const,
  left: 64,
  top: 64,
  fontFamily: FONT_MONO,
  fontSize: 30,
  letterSpacing: 2,
  color: GRAY,
};
