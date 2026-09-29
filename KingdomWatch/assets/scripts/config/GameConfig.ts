/**
 * 全局数值与坐标（设计分辨率 750×1334，画布坐标原点在屏幕中心、y 向上）
 * 产品文档 §3.1 战场空间 / §11 数值框架
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;

/** 顶部生成带（屏外） */
export const SPAWN_Y = 717;
/** 防线判定线（线稿 y1180 顶基 → 画布坐标） */
export const LINE_Y = -513;
/** 英雄站位 y（防线后一点） */
export const HERO_Y = -545;
/** 远程怪停位线：距防线 ≤300 停位投掷 */
export const RANGED_RANGE = 300;

/** 调色板（与 UX 线稿 token 一致） */
export const PAL = {
  wood: '#3A2E23', wood2: '#57432C', parch: '#E9DCB5', ink: '#241C12',
  gold: '#F2B23E', gold2: '#C98A1A', green: '#7FB841', orange: '#EF9D3C',
  red: '#E5484D', blue: '#4FA8FF', purple: '#B96BFF',
  white: '#C9D6DF', dark: '#1E2530', dark2: '#141821',
};

/** 星级（§3.9）：通关时耐久比例 P */
export function starOf(ratio: number): 1 | 2 | 3 {
  if (ratio >= 0.9) return 3;
  if (ratio > 0.4) return 2;
  return 1;
}

/** 经验需求（§11.3）：EXP(L→L+1) = 50 × 1.35^(L-1)，等级无上限 */
export function expNeed(level: number): number {
  return Math.floor(50 * Math.pow(1.35, level - 1));
}

/** 复活恢复 30%（可无限次） */
export const REVIVE_RATIO = 0.3;
/** 复活后防线短暂无敌缓冲（待定项默认值，§3.9） */
export const REVIVE_INVULN = 2;

/** 大招充能上限（§3.7，逐英雄配置；M0 弓箭手 60） */
export const ARCHER_CHARGE_MAX = 60;

/** 帧内上限（§12.4 性能预算） */
export const MAX_MOBS = 60;
export const MAX_PROJS = 80;
