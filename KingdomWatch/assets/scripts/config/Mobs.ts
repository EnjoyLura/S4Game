/**
 * 怪物与关卡配置（§5 第 1 章 / §11.2 怪物基准，全配置化）
 */
import { PAL } from './GameConfig';

export interface MobDef {
  id: string;
  name: string;
  kind: 'melee' | 'ranged' | 'heal';
  hp: number;
  /** 攻线伤害 */
  dmg: number;
  /** 攻击间隔（秒），heal 为治疗间隔 */
  atkInterval: number;
  /** 移速 px/s */
  speed: number;
  /** 体型半径（分离用） */
  radius: number;
  exp: number;
  charge: number;
  gold: number;
  color: string;
  /** 远程怪攻击距离（距防线） */
  atkRange?: number;
  /** 治疗量（heal 用） */
  healAmount?: number;
  elite?: boolean;
}

export const MOBS: Record<string, MobDef> = {
  goblin_worker: {
    id: 'goblin_worker', name: '哥布林苦工', kind: 'melee',
    hp: 80, dmg: 30, atkInterval: 2, speed: 60, radius: 22,
    exp: 8, charge: 1, gold: 2, color: '#7FB841',
  },
  goblin_slinger: {
    id: 'goblin_slinger', name: '哥布林投石手', kind: 'ranged',
    hp: 60, dmg: 20, atkInterval: 2.5, speed: 45, radius: 20,
    exp: 10, charge: 1, gold: 3, color: '#B2C24B', atkRange: 300,
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: '哥布林萨满', kind: 'heal',
    hp: 120, dmg: 20, atkInterval: 3, speed: 50, radius: 24,
    exp: 20, charge: 2, gold: 4, color: '#9B6BFF', healAmount: 40,
  },
  wolf_rider: {
    id: 'wolf_rider', name: '狼骑兵', kind: 'melee',
    hp: 110, dmg: 35, atkInterval: 1.6, speed: 95, radius: 24,
    exp: 12, charge: 1, gold: 3, color: '#8A8F98',
  },
  goblin_brute: {
    id: 'goblin_brute', name: '大哥布林（精英）', kind: 'melee',
    hp: 1200, dmg: 80, atkInterval: 2, speed: 35, radius: 34,
    exp: 60, charge: 10, gold: 25, color: '#5E8F3C', elite: true,
  },
};

export interface SpawnGroup { mob: string; count: number; interval: number; delay?: number; }
export interface WaveDef { groups: SpawnGroup[]; surge?: boolean; }

/** 关卡 1-1 腐朽森林·前哨：10 波，第 4/8 波为狂潮（§3.3） */
export interface LevelDef {
  id: string;
  name: string;
  /** 防线耐久（已含城墙加成前的关卡基础值；M0 直配） */
  lineHp: number;
  baseGold: number;
  waves: WaveDef[];
}

export const LEVEL_1_1: LevelDef = {
  id: '1-1',
  name: '腐朽森林·前哨',
  lineHp: 1000,
  baseGold: 60,
  waves: [
    { groups: [{ mob: 'goblin_worker', count: 6, interval: 1.0 }] },
    { groups: [{ mob: 'goblin_worker', count: 8, interval: 0.9 }] },
    { groups: [{ mob: 'goblin_worker', count: 6, interval: 0.8 }, { mob: 'goblin_slinger', count: 2, interval: 1.4, delay: 2 }] },
    { groups: [{ mob: 'goblin_worker', count: 12, interval: 0.5 }], surge: true },
    { groups: [{ mob: 'goblin_worker', count: 6, interval: 0.8 }, { mob: 'goblin_slinger', count: 4, interval: 1.2 }] },
    { groups: [{ mob: 'goblin_slinger', count: 6, interval: 1.0 }, { mob: 'goblin_worker', count: 4, interval: 1.0, delay: 3 }] },
    { groups: [{ mob: 'goblin_shaman', count: 2, interval: 2 }, { mob: 'goblin_worker', count: 8, interval: 0.7 }] },
    { groups: [{ mob: 'wolf_rider', count: 8, interval: 0.6 }], surge: true },
    { groups: [{ mob: 'goblin_worker', count: 10, interval: 0.6 }, { mob: 'goblin_slinger', count: 4, interval: 1.2 }, { mob: 'goblin_shaman', count: 2, interval: 2.5 }] },
    { groups: [{ mob: 'goblin_brute', count: 1, interval: 1 }, { mob: 'goblin_worker', count: 8, interval: 0.7, delay: 2 }, { mob: 'goblin_slinger', count: 4, interval: 1.4, delay: 4 }] },
  ],
};

/** 英雄站位（§3.1，用户确认）：防线横向对称分布，单人必须居中；3 人 ±210 */
const HERO_SLOT_TABLE: Record<number, number[]> = {
  1: [0],
  2: [-160, 160],
  3: [-210, 0, 210],
  4: [-255, -85, 85, 255],
};

export function heroSlots(n: number): number[] {
  return (HERO_SLOT_TABLE[n] || HERO_SLOT_TABLE[4]).slice(0, Math.max(1, Math.min(4, n)));
}
