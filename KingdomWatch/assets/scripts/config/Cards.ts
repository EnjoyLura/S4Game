/**
 * 强化卡（§6 卡池，按英雄单独强化 + 全局卡；M0 弓箭手子集）
 * 卡效果直接改写 HeroStats / 全局 Stats；desc 支持显示当前叠层
 */
import { PAL } from './GameConfig';

export type Rarity = 'white' | 'blue' | 'purple';
export const RARITY_COLOR: Record<Rarity, string> = { white: PAL.white, blue: PAL.blue, purple: PAL.purple };
const RARITY_WEIGHT: Record<Rarity, number> = { white: 0.6, blue: 0.3, purple: 0.1 };

/** 英雄战斗属性（卡牌改写目标；M0 弓箭手） */
export interface HeroStats {
  atk: number;          // 基础攻击（含局外成长，M0 固定 45）
  atkMul: number;       // 攻击力加成累乘
  aspd: number;         // 攻速 次/s（累乘）
  range: number;        // 普攻索敌范围
  skillRange: number;   // 技能索敌范围
  critRate: number;     // 暴击率
  critMul: number;      // 暴击伤害倍率
  serial: number;       // 连射：同线串行追加子弹数
  fan: number;          // 齐射：扇形子弹道数
  split: number;        // 分裂：命中分裂小弹道数
  explodeR: number;     // 爆炸半径（0=无爆炸）
  explodeMul: number;   // 爆炸伤害倍率
  pierce: number;       // 穿透目标数
  slowOnHit: number;    // 命中减速(0=无, 0.2=20%)
  burnOnHit: number;    // 命中点燃每秒伤害系数（0=无，0.2=3s共60%）
}

export function baseArcherStats(): HeroStats {
  return {
    // 射程 660 / 技能 560（用户确认加大索敌范围；文档 §3.1 的 520/416 随之作废）
    atk: 45, atkMul: 1, aspd: 1.2, range: 660, skillRange: 560,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
  };
}

/** 全局属性（经验/金币/防线） */
export interface GlobalStats {
  xpMul: number;
  goldMul: number;
  lineRegenPct: number;   // 每秒回复最大耐久比例
}

export interface CardCtx {
  hero: HeroStats;
  global: GlobalStats;
  line: { healPct: (p: number) => void; addMaxMul: (m: number) => void };
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  maxStacks: number;
  /** 归属：'global' 或英雄 id（M0 'archer'） */
  owner: string;
  /** 前置卡：必须已拥有该卡（叠层≥1）才会进入抽卡池 */
  req?: string;
  desc: string;
  apply: (ctx: CardCtx) => void;
}

function c(def: CardDef): CardDef { return def; }

/* ---------- 弓箭手 · 普攻强化卡（§6.2 子集） ---------- */
export const ARCHER_CARDS: CardDef[] = [
  c({ id: 'sharp', name: '磨利刀刃', rarity: 'white', maxStacks: 5, owner: 'archer', desc: '攻击力 +20%',
    apply: x => { x.hero.atkMul *= 1.2; } }),
  c({ id: 'fury', name: '狂怒', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '攻击力 +35%',
    apply: x => { x.hero.atkMul *= 1.35; } }),
  c({ id: 'swift', name: '迅捷之风', rarity: 'white', maxStacks: 4, owner: 'archer', desc: '攻速 +25%',
    apply: x => { x.hero.aspd *= 1.25; } }),
  c({ id: 'serial', name: '连射', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '普攻同线串行追加 1 颗子弹（微延迟成串，独立命中）',
    apply: x => { x.hero.serial += 1; } }),
  c({ id: 'fan', name: '齐射', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '普攻额外射出 2 支扇形子弹道：主弹道索敌，子弹道直线随缘命中',
    apply: x => { x.hero.fan += 2; } }),
  c({ id: 'split', name: '分裂', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '普攻命中分裂出 2 支小弹道（50% 伤害）',
    apply: x => { x.hero.split += 2; } }),
  c({ id: 'explode', name: '小范围爆炸', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '普攻命中小范围爆炸（攻击力 40% 溅射）',
    apply: x => { x.hero.explodeR = Math.max(x.hero.explodeR, 70); } }),
  c({ id: 'explode_r', name: '爆炸范围', rarity: 'blue', maxStacks: 3, owner: 'archer', req: 'explode', desc: '爆炸半径 +40%（需已学习爆炸）',
    apply: x => { if (x.hero.explodeR > 0) x.hero.explodeR *= 1.4; } }),
  c({ id: 'explode_w', name: '爆炸威力', rarity: 'blue', maxStacks: 3, owner: 'archer', req: 'explode', desc: '爆炸伤害 +50%（需已学习爆炸）',
    apply: x => { if (x.hero.explodeR > 0) x.hero.explodeMul *= 1.5; } }),
  c({ id: 'crit_rate', name: '鹰眼', rarity: 'white', maxStacks: 4, owner: 'archer', desc: '暴击率 +15%',
    apply: x => { x.hero.critRate += 0.15; } }),
  c({ id: 'crit_dmg', name: '致命一击', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '暴击伤害 +50%',
    apply: x => { x.hero.critMul += 0.5; } }),
  c({ id: 'frost', name: '寒霜附魔', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '命中减速 20% 2s',
    apply: x => { x.hero.slowOnHit = 0.2; } }),
  c({ id: 'burn', name: '烈焰附魔', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '命中点燃（3s 共 60% 攻击力伤害）',
    apply: x => { x.hero.burnOnHit = 0.2; } }),
];

/* ---------- 全局卡（§6.1） ---------- */
export const GLOBAL_CARDS: CardDef[] = [
  c({ id: 'wall', name: '城墙加固', rarity: 'white', maxStacks: 4, owner: 'global', desc: '防线耐久上限 +25% 并回复 25%',
    apply: x => { x.line.addMaxMul(1.25); x.line.healPct(0.25); } }),
  c({ id: 'repair', name: '工事修理', rarity: 'blue', maxStacks: 3, owner: 'global', desc: '防线每秒回复 0.5% 最大耐久',
    apply: x => { x.global.lineRegenPct += 0.005; } }),
  c({ id: 'xp_badge', name: '经验勋章', rarity: 'white', maxStacks: 3, owner: 'global', desc: '经验获取 +25%',
    apply: x => { x.global.xpMul *= 1.25; } }),
  c({ id: 'gold_hunter', name: '黄金猎手', rarity: 'white', maxStacks: 3, owner: 'global', desc: '金币获取 +20%',
    apply: x => { x.global.goldMul *= 1.2; } }),
];

/** M0 卡池 = 弓箭手池 + 全局卡 */
export const M0_POOL: CardDef[] = [...ARCHER_CARDS, ...GLOBAL_CARDS];

export interface CardStacks { [cardId: string]: number; }

/** 加权抽 3 张不重复（稀有度权重 + 未达叠层上限 + 前置卡未学习的不出现） */
export function draw3(pool: CardDef[], stacks: CardStacks): CardDef[] {
  const avail = pool.filter(k =>
    (stacks[k.id] || 0) < k.maxStacks && (!k.req || (stacks[k.req] || 0) > 0));
  const picked: CardDef[] = [];
  const rest = avail.slice();
  while (picked.length < 3 && rest.length > 0) {
    const total = rest.reduce((s, k) => s + RARITY_WEIGHT[k.rarity], 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < rest.length; i++) {
      r -= RARITY_WEIGHT[rest[i].rarity];
      if (r <= 0) { idx = i; break; }
    }
    picked.push(rest[idx]);
    rest.splice(idx, 1);
  }
  return picked;
}
