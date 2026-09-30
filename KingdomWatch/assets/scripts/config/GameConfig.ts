/**
 * 全局数值与坐标（设计分辨率 750×1334，画布坐标原点在屏幕中心、y 向上）
 * 产品文档 §3.1 战场空间 / §11 数值框架
 */
import { sys, view } from 'cc';

export const DESIGN_W = 750;
export const DESIGN_H = 1334;

/** 可视布局（§12.3 适配）：Fit-Width 下可视半高随屏幕比例变化；安全区=刘海/手势条 */
export const LO = {
  half: DESIGN_H / 2,   // 可视半高（设计单位）
  safeTop: 0,           // 顶部安全区（设计单位）
  safeBottom: 0,        // 底部安全区（设计单位）
};

/** 顶部生成带（屏外）／防线判定线／英雄站位 y —— initLayout() 启动时按可视区重算 */
export let SPAWN_Y = 717;
export let LINE_Y = -513;
export let HERO_Y = -545;

/** Boot 场景启动后调用：按可视区与安全区重算战场锚点（防线贴屏底、顶栏贴刘海下） */
export function initLayout(): void {
  const vis = view.getVisibleSize();
  LO.half = vis.height / 2;
  try {
    const safe = sys.getSafeAreaRect();
    if (safe && safe.width > 0 && safe.height > 0) {
      const scrH = typeof window !== 'undefined' ? window.innerHeight : vis.height;
      const k = scrH > 0 ? vis.height / scrH : 1; // 屏幕 px → 设计单位
      const topIns = Math.max(0, scrH - (safe.y + safe.height)) * k;
      LO.safeTop = Math.min(Math.max(0, topIns), LO.half * 0.12);
    }
  } catch (e) { void e; }
  // 用户确认：防线永远贴物理屏底——不采用浏览器报告的底部安全区（手势条）内缩
  LO.safeBottom = 0;
  SPAWN_Y = LO.half + 60;
  LINE_Y = -LO.half + 154; // 防线贴屏幕底部（沙包墙高 154）
  HERO_Y = LINE_Y - 32;
}

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

/** 大招充能上限（§3.7，逐英雄配置；弓箭手 60 / 狙击 55） */
export const ARCHER_CHARGE_MAX = 60;
export const SNIPER_CHARGE_MAX = 55;

/** 帧内上限（§12.4 性能预算） */
export const MAX_MOBS = 60;
export const MAX_PROJS = 80;
