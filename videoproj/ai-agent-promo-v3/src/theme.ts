// 全局视觉系统 — brief-v3 §C 品牌色重建（工程结构参考 v2，色值一律以 v3 设计稿为准）
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOTAL_FRAMES = 1860; // 62.0s · §0 帧号总表

// 帧号换算铁律（§C 施工换算令）：设计稿 24fps 帧号仅存档，
// 一律 全局帧 = 设计稿秒 × 30；镜头内部子节拍 = 设计稿帧 × 1.25（见 anim.beat）。

// 黑 / 背景
export const BG = '#000000'; // 镜1 纯黑底
export const BG_DARK = '#080B12'; // 镜6/9/13/14
export const BG_GRAD_TOP = '#080B12'; // 镜14 深蓝黑渐变
export const BG_GRAD_BOTTOM = '#121822';
export const BG_8A_FROM = '#0A0D12'; // 镜8A 深紫黑渐变
export const BG_8A_TO = '#161D2B';

// 面板表面
export const SURFACE = '#0F131C'; // 终端表面
export const SURFACE_CARD = '#1E2636'; // 气泡 / 卡片
export const SURFACE_CARD2 = '#161D2B'; // 文件卡片 / CI 卡片
export const DIFF_DEL_BG = '#3F1E1E'; // diff 删除栏
export const DIFF_ADD_BG = '#1E3F2E'; // diff 新增栏 / 8D 径向中心
export const HL_BG = '#78350F'; // 镜7 高亮行背景

// 品牌色
export const CORAL = '#D97757'; // 品牌珊瑚
export const BLUE = '#2E6BF0'; // 腾讯蓝
export const ORANGE = '#FF6900'; // MiMo 橙
export const LIME = '#D4F43E'; // Nebius 青柠
export const GREEN = '#4ADE80'; // CI 绿
export const RED = '#EF4444'; // 错误红（镜1）
export const RED_SOFT = '#F87171'; // diff 删除文字
export const AMBER = '#FDE047'; // 镜7 高亮行文字
export const CYAN = '#22D3EE'; // 镜7 扫描线
export const WHITE = '#FFFFFF';

// 文字 / 灰阶
export const TEXT = '#ECE9E1'; // 米白主文字
export const TEXT_DIM = '#9CA3AF'; // 正文次级
export const GRAY = '#6B7280'; // 顶栏 / 标签

// 字体：本机装了 Noto Sans CJK；JetBrains Mono 未装则按兜底链走（同 v2）
export const FONT_SANS =
  "'Noto Sans CJK SC', 'Noto Sans SC', 'Noto Sans CJK JP', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace";
