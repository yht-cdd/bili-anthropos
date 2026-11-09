// 通用工具（brief-p0 红线①：隐私打码统一走这里）

// 用户名/UP 主名打码：保留第 1 个字，其余一律 ***
// 用 Array.from 而不是 slice，保证 emoji / 代理对也算「一个字」
export const maskName = (name: string): string => {
  const chars = Array.from(name);
  return chars.length ? `${chars[0]}***` : '***';
};

// 播放量 → 「x.x万」样式（B 站习惯），<1 万原样
export const fmtPlay = (n: number): string =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`;

// 种子 PRNG：mulberry32（brief-p0 §1-D：禁 Math.random，随机但确定性）
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 中位数（偶数取中间两数平均）。E 段「鱼的点赞中位数」从这里算，不硬编码。
export const median = (xs: number[]): number => {
  const a = [...xs].sort((p, q) => p - q);
  const n = a.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
