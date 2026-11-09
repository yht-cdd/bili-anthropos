// preview-stance-1109 · 色板 / 字号（brief §0–§1 写死；整片深色系，同封面 #141d30）
export const W = 1920;
export const H = 1080;
export const FPS = 30;
// 4174 = 4144（138.14s 口播 ×30）+ 30 帧（1s 收尾黑）
export const TOTAL = 4174;

// 底
export const BG = '#141d30'; // 主背景（同封面）
export const BG_2 = '#0E1524'; // 更深的纯色底（S-D）
export const VOID = '#000000'; // 片尾全黑

// 字
export const INK = '#F2F4F8';
export const INK_2 = '#9BA6BC';
export const INK_3 = '#6D7A93';
export const LINE = 'rgba(255,255,255,0.12)';

// 强调
export const RED = '#E53935'; // 数据里的「1」、印章、标题
export const GOLD = '#F5C518'; // token 是成本，不是人质
export const CYAN = '#38D9D9'; // 人那一侧的对比条

// 私信气泡
export const BUBBLE_BG = '#2A3550';
export const BUBBLE_INK = '#EDF1F8';
export const AVATAR_BG = '#3B4A6B';

// 卡片 / 终端
export const CARD_BG = 'rgba(24,32,50,0.92)';
export const CARD_LINE = 'rgba(255,255,255,0.10)';
export const GREY_CARD = '#8A93A5'; // 「稿件已转为仅自己可见」的灰色卡片底
export const GREY_INK = '#1B2230';

export const FONT_SANS = "'Noto Sans CJK SC','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";
export const FONT_MONO = "'Noto Sans Mono CJK SC','JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
export const FONT_SERIF = "'Noto Serif CJK SC','Noto Serif SC','Songti SC',serif";

export const FS = {
  hero: 108,
  title: 64,
  body: 44,
  data: 36,
  sub: 34,
  small: 26,
  tiny: 20,
};

export const MARGIN = 80;
export const RADIUS = 14;
export const SHADOW = '0 12px 40px rgba(0,0,0,0.35)';

// ── 时间轴（帧，30fps）──
// 场景边界 = 口播分段真实起点（由 audio/voice-full.mp3 的静音点 DP 对齐得出，
// 脚本 scripts/align-voice.py，逐行结果在 tmp/preview-timeline.json）
export const SEG = {
  a: 0, // S-A 引入：私信气泡
  b: 245, // S-B 派的是什么活（8.17s）
  c: 767, // S-C 联想到自己（25.57s）
  d: 1555, // S-D 立场（51.83s）
  e: 2190, // S-E 标题揭晓（73.00s）
  f: 2308, // S-F 片尾信（76.93s）
  end: TOTAL,
} as const;

// 口播结束：138.144s → 4144 帧；之后 30 帧黑场
export const AUDIO_END = 4144;

// 片尾信从这一帧起不再走底字幕（信自己排版，见 SF.tsx）
export const LETTER_START = 2467;
