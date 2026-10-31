/**
 * theme.ts —— 全片唯一的视觉来源
 *
 * 画布：1920×1080（16:9 横屏）· 30fps · 5400 帧 = 180.0 秒
 *
 * 三条规矩：
 *   1. 任何场景里不许出现硬编码的颜色/字号，只能用这里的常量
 *   2. 所有横向定位必须落在栅格上（见 G 栅格），不许随手写 px
 *   3. 安全区：左右 160，上下 90 —— 超出这个范围的内容在部分设备上会被裁
 */

export const C = {
  bg: "#07080C",      // 底色
  panel: "#0E1118",   // 面板底
  line: "#1A1D26",    // 分隔线
  text: "#EDEFF5",    // 主文字
  dim: "#8A90A2",     // 次文字
  faint: "#4A4F5E",   // 更弱（行号、注释、禁用态）
  ok: "#4BE3A2",      // 成功 / 在线
  bad: "#FF5D5D",     // 失败 / 被吞
  whale: "#5BA8FF",   // 鲸蓝（形象、数据流、强调）
  warm: "#FFB454",    // 少量暖色（警示、待确认）
  paper: "#F5F7FA",   // S1 那个浏览器窗口的浅色底
} as const;

export const F = {
  sans: '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", "Menlo", monospace',
} as const;

/**
 * 字号（横屏基准）
 * 竖屏改横屏之后所有字号都上调了一档 —— 横屏的高度只有 1080，
 * 字号太小在手机竖屏观看时会糊成一片。
 */
export const S = {
  hero: 128,    // 主标题 / 点题大字
  quote: 96,    // 长句点题（12 字一行放不下 128，降一档）
  mega: 200,    // 超大（00:00、7×24 这种）
  h1: 72,       // 段标题
  body: 48,     // 正文 / 字幕
  small: 32,    // 小字 / 说明
  code: 32,     // 代码 / 等宽数字
  label: 26,    // 标签 / 行号
} as const;

/** 主缓动 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const M = {
  enterFrames: 20,
  exitFrames: 12,
  overlap: 15,
  cursorHz: 2,
  shift: 80,   // 场景切换位移量（px）
} as const;

export const TOTAL_FRAMES = 5400;
export const FPS = 30;
export const W = 1920;
export const H = 1080;

/**
 * 横屏栅格 —— 所有定位都从这里取，不许手写 px。
 *
 *   安全区左右各 160，可用宽度 1600
 *   12 列，列宽 100，列间距 32：  12×100 + 11×32 = 1552，左边距 160 + 24 微调
 *
 * 常用分栏：
 *   layout.split  左右两栏（左 720 / 间 160 / 右 720）
 *   layout.wide   通栏（1600）
 */
export const G = {
  padX: 160,
  padY: 90,
  colW: 100,
  gutter: 32,
  contentW: 1600,
  /** 左栏宽、右栏宽、中间间距 —— 左右分栏场景统一用这个 */
  split: { left: 720, right: 720, gap: 160 },
  /** 四格快剪：四列，列宽 372，间距 30 —— 372×4 + 30×3 = 1578 */
  quad: { w: 372, gap: 30 },
  /** 栅格的左上角起点 */
  originX: 160,
  originY: 90,
  /** 垂直中心线（放超大数字时用） */
  centerY: 540,
} as const;

/** 场景边界（帧）—— 与 brief 第 2 节严格一致 */
export const SCENES = {
  gone: { from: 0, to: 330 },
  alive: { from: 330, to: 780 },
  wake: { from: 780, to: 1140 },
  day: { from: 1140, to: 2280 },
  mismatch: { from: 2280, to: 3000 },
  avalon: { from: 3000, to: 4050 },
  rounds: { from: 4050, to: 4900 },
  end: { from: 4900, to: 5400 },
} as const;

/**
 * 场景切换：进了入/出窗口就按交叠做「上移淡出 + 下移压入」。
 * 禁止纯 opacity 交叉溶解 —— 那是最偷懒的转场。
 */
export function sceneTransition(localFrame: number, length: number) {
  const inP = Math.min(1, localFrame / M.enterFrames);
  const outP = Math.min(1, Math.max(0, (length - localFrame) / M.exitFrames));
  const fromBelow = (1 - inP) * M.shift;
  const toAbove = -(1 - outP) * M.shift;
  return {
    opacity: Math.min(inP, outP),
    translateY: localFrame < length / 2 ? fromBelow : toAbove,
  };
}

/** 常用组合：左栏起点、右栏起点 */
export const X = {
  left: G.originX,
  right: G.originX + G.split.left + G.split.gap,   // 160 + 720 + 160 = 1040
  center: (W - G.split.left) / 2,                   // 居中放一个 720 宽的块
} as const;
