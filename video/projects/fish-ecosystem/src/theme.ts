// 配色 / 字体 / 字号 — 全部按 brief.md 风格一节写死，不许在场景里另造颜色
export const BG = '#0A0E1A';
export const CYAN = '#5ADEFF';
export const MAGENTA = '#FF4FA3';
export const TEXT = '#F5F8FF';
export const DIM = '#8A93A8';
export const CARD = '#121829';
export const LINE = '#223052';

export const FONT =
  "'Noto Sans CJK SC', 'Noto Sans CJK JP', 'Noto Sans SC', 'Noto Sans CJK', sans-serif";

export const TITLE_PX = 88; // 标题 Bold
export const BODY_PX = 52; // 正文 Regular
export const NOTE_PX = 36; // 注释

// 千分位，98643 -> 98,643
export const fmt = (n: number): string => n.toLocaleString('en-US');
