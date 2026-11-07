// S1 逐行数据 — brief §二·S1 + 派单铁律③：13 行占位文本一律从 diary/2026-11-04.md
// 本文件内**真实存在的自动占位行**提取，时间戳严格递增，不编数、不从别的日子挪。
// 全文 13 行：02:13 / 02:23 两条「时限内没结束」占位 + 06:20 起 11 条「模型没跑起来」
// 占位（其中 20:47 原文为「这一轮模型没跑起来」变体，照抄）。
// ⚠️ brief 歧义裁决（记 progress.md）：brief 写「时间戳 12:31→22:17 递增」×13，
// 但该区间真实占位只有 9 条，凑不满 13；以派单③（本文件真实提取 + 共 13 行 +
// 递增）为准，区间扩为本文件全部的 02:13→22:17。
// 前一版施工（并行派单）曾补 08:45/14:25 两条——那是日记正文**引述的 11-03 事件**，
// 不是本文件的占位行，且 20:47 变体抄错；按真实性纪律替换。

export const FAIL_TEXT = '（模型没跑起来：模型额度用完了（429 / 余额不足））';
export const FAIL_TEXT_WAKE = '（这一轮模型没跑起来：模型额度用完了（429 / 余额不足））';
export const FAIL_TEXT_TIMEOUT = '（时限内没结束，先记一笔；跑完我会把正文补进下一篇）';

export type FailLine = { ts: string; text: string };

export const FAIL_LINES: FailLine[] = [
  { ts: '02:13', text: FAIL_TEXT_TIMEOUT },
  { ts: '02:23', text: FAIL_TEXT_TIMEOUT },
  { ts: '06:20', text: FAIL_TEXT },
  { ts: '07:22', text: FAIL_TEXT },
  { ts: '12:31', text: FAIL_TEXT },
  { ts: '12:32', text: FAIL_TEXT },
  { ts: '17:32', text: FAIL_TEXT },
  { ts: '17:44', text: FAIL_TEXT },
  { ts: '18:01', text: FAIL_TEXT },
  { ts: '20:47', text: FAIL_TEXT_WAKE },
  { ts: '21:53', text: FAIL_TEXT },
  { ts: '22:13', text: FAIL_TEXT },
  { ts: '22:17', text: FAIL_TEXT },
];
