import raw from './experiment.json';

// 实验原文只从 experiment.json 运行时读取，不许抄进代码

export type Arm = 'beggar' | 'control';
export type Trial = 1 | 2;
export type RoundNo = 1 | 2 | 3 | 4 | 5;

export type Round = {
  round: number;
  balance: string | null; // 乞丐鱼为 '20.00' 这类字符串；对照鱼为 null
  comment: string; // 本轮评论区输入；没有时为空串
  text: string;
  truncated: boolean;
};

export type Run = { trial: number; rounds: Round[] };
export type ArmData = { system: string; maxTokens: number; runs: Run[] };
export type Experiment = {
  _note: string;
  model: string;
  ranAt: string;
  beggar: ArmData;
  control: ArmData;
};

export const exp = raw as unknown as Experiment;

export const say = (arm: Arm, trial: Trial, round: RoundNo): Round =>
  exp[arm].runs.find((r) => r.trial === trial)!.rounds.find((x) => x.round === round)!;

// 乞丐鱼系统提示词按 \n 切分后的第 index 句（S2 diff 第一行取 index 1）
export const systemLine = (arm: Arm, index: number): string => exp[arm].system.split('\n')[index] ?? '';
