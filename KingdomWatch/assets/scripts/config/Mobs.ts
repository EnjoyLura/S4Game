/**
 * 怪物与关卡配置（§5 第 1 章 / §11.2 怪物基准，全配置化）
 */
import { PAL } from './GameConfig';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_LEVEL_IDS, CAMPAIGN_STAGES } from './Campaign';
import { EnemyFeatures, EXPANSION_MOBS } from './ChapterContent';
import { expandedLevel } from './ChapterWaves';

export type DamageKind = 'physical' | 'magic' | 'true';
export function damageKindFor(source: string): DamageKind {
  if (source === 'gm') return 'true';
  return source === 'scythe' || source === 'arcane' || source === 'lance' || source === 'space' || source === 'wind' || source === 'siphon' || source === 'pyro' || source === 'volt' || source === 'mora' || source === 'burn' || source === 'pyro_burst'
    ? 'magic' : 'physical';
}

export interface MobDef extends EnemyFeatures {
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
  /** 物理抗性 0~1（狙击大招等 ignoreRes 伤害无视） */
  physRes?: number;
  elite?: boolean;
  /** Boss 与精英分开标记：冰霜领域只免疫 Boss，精英仍可冰封。 */
  boss?: boolean;
}

export const MOBS: Record<string, MobDef> = {
  goblin_worker: {
    id: 'goblin_worker', name: '哥布林苦工', kind: 'melee',
    hp: 160, dmg: 30, atkInterval: 4, speed: 30, radius: 22,   // 攻速/移速减半（用户调整，下同）
    exp: 8, charge: 1, gold: 2, color: '#7FB841',
  },
  goblin_slinger: {
    id: 'goblin_slinger', name: '兽族投石兵', kind: 'ranged',
    hp: 120, dmg: 20, atkInterval: 5, speed: 22.5, radius: 20,
    exp: 10, charge: 1, gold: 3, color: '#B2C24B', atkRange: 300,
  },
  goblin_shaman: {
    id: 'goblin_shaman', name: '哥布林萨满', kind: 'heal',
    hp: 600, dmg: 20, atkInterval: 4, speed: 25, radius: 24,
    exp: 20, charge: 2, gold: 4, color: '#9B6BFF', healAmount: 40,
    magicRes: .35, wardBreakRatio: .3,
    description: '有35%法抗符盾；读条后治疗附近伤员，冰封或眩晕可打断施法。',
  },
  wolf_rider: {
    id: 'wolf_rider', name: '狼骑兵', kind: 'melee',
    hp: 220, dmg: 35, atkInterval: 3.2, speed: 47.5, radius: 24,
    exp: 12, charge: 1, gold: 3, color: '#8A8F98',
    rush: { period: 6.5, windup: .55, duration: 2, multiplier: 1.8, impactMul: 1.5 },
    description: '短暂蓄势后冲锋，冲锋撞线的首次攻击提高50%；冰封或眩晕可打断。',
  },
  goblin_brute: {
    id: 'goblin_brute', name: '大哥布林（精英）', kind: 'melee',
    hp: 2400, dmg: 80, atkInterval: 4, speed: 17.5, radius: 34,
    exp: 60, charge: 10, gold: 25, color: '#5E8F3C', elite: true,
    physRes: .4, armorBreakRatio: .28,
    description: '重甲减少40%物理伤害；累积物理命中破甲后失去物抗，并受到3秒易伤。法术可绕过物抗。',
  },
  goblin_king: {
    id: 'goblin_king', name: '兽族将军', kind: 'melee',
    hp: 4800, dmg: 80, atkInterval: 4, speed: 17.5, radius: 48,
    exp: 120, charge: 20, gold: 50, color: '#6D963F', boss: true,
    physRes: .3, armorBreakRatio: .28,
    description: '铠甲减少30%物理伤害，集火可破甲；法术绕过物抗，首领仍免疫冰封。',
  },
};

// New video appearances reuse existing combat templates; no extra stats, rewards or attack mechanics.
MOBS.orc_axeman = { ...MOBS.goblin_worker, id: 'orc_axeman', name: '兽族斧兵',
  description: '持斧逼近防线的近战单位，成群出现时用范围伤害清理。' };
MOBS.orc_siege_cart = { ...MOBS.goblin_brute, id: 'orc_siege_cart', name: '兽族攻城车',
  description: '重甲攻城车缓慢逼近防线；物抗40%，可持续物理集火破甲，或用法术绕过物抗。' };

Object.assign(MOBS, EXPANSION_MOBS);

export interface SpawnGroup { mob: string; count: number; interval: number; delay?: number; actual?: { hp: number; dmg: number }; }
/** Spawn metadata only: all enemies retain straight movement and the shared living cap. */
export interface EnemyFormation {
  id?: string; role?: 'front' | 'support'; lane: number; gap?: number;
}
export interface WaveDef { groups: SpawnGroup[]; surge?: boolean; formation?: 'escort' | 'crossfire'; }

/** 全怪血量倍率（用户调整：基础血量 ×2） */
export const MOB_HP_MUL = 2;
/** 全怪伤害倍率（用户调整：降为原来的 1/3） */
export const MOB_DMG_MUL = 1 / 3;
/** 关卡内阶梯增长（用户调整：向僵尸开炮式持续刷怪）——第 n 波相对第 1 波的数量/血量/伤害增幅系数 = 1 + 率×(n-1) */
export const WAVE_RAMP = { cnt: 0.12, hp: 0.15, dmg: 0.08 };

/** 关卡 1-1 腐朽森林·前哨：10 波，第 4/8 波为狂潮（§3.3）；怪量 = 初版 ×3（用户调整，同步屏上限 80） */
export interface LevelDef {
  id: string;
  name: string;
  /** 防线耐久（已含城墙加成前的关卡基础值；M0 直配） */
  lineHp: number;
  baseGold: number;
  /** Chapter/stage growth, multiplied by the selected difficulty in BattleDirector. */
  statMul?: number;
  /** Authored counts/stats instead of the shared per-wave ramp. */
  fixedWaves?: boolean;
  waves: WaveDef[];
}

const OUTPOST_TEMPLATE: LevelDef = {
  id: '1-1',
  name: '腐朽森林·前哨',
  lineHp: 1000,
  baseGold: 60,
  waves: [
    { groups: [{ mob: 'goblin_worker', count: 18, interval: 1.0 }] },
    { groups: [{ mob: 'goblin_worker', count: 24, interval: 0.9 }] },
    { groups: [{ mob: 'goblin_worker', count: 18, interval: 0.8 }, { mob: 'goblin_slinger', count: 6, interval: 1.4, delay: 2 }] },
    { groups: [{ mob: 'goblin_worker', count: 36, interval: 0.5 }], surge: true },
    { groups: [{ mob: 'goblin_worker', count: 18, interval: 0.8 }, { mob: 'goblin_slinger', count: 12, interval: 1.2 }] },
    { groups: [{ mob: 'goblin_slinger', count: 18, interval: 1.0 }, { mob: 'goblin_worker', count: 12, interval: 1.0, delay: 3 }] },
    { groups: [{ mob: 'goblin_shaman', count: 6, interval: 2 }, { mob: 'goblin_worker', count: 24, interval: 0.7 }] },
    { groups: [{ mob: 'wolf_rider', count: 24, interval: 0.6 }], surge: true },
    { groups: [{ mob: 'goblin_worker', count: 30, interval: 0.6 }, { mob: 'goblin_slinger', count: 12, interval: 1.2 }, { mob: 'goblin_shaman', count: 6, interval: 2.5 }] },
    { groups: [{ mob: 'goblin_brute', count: 3, interval: 1 }, { mob: 'goblin_worker', count: 24, interval: 0.7, delay: 2 }, { mob: 'goblin_slinger', count: 12, interval: 1.4, delay: 4 }] },
  ],
};

const FOREST_TEMPLATE: LevelDef = {
  id: '1-2',
  name: '腐朽森林·深林',
  lineHp: 1000,
  baseGold: 70,
  waves: [
    { groups: [{ mob: 'goblin_worker', count: 20, interval: 0.9 }, { mob: 'goblin_slinger', count: 8, interval: 1.3, delay: 2 }] },
    { groups: [{ mob: 'goblin_slinger', count: 16, interval: 0.9 }, { mob: 'goblin_worker', count: 16, interval: 0.8 }] },
    { groups: [{ mob: 'wolf_rider', count: 12, interval: 0.8 }], surge: true },
    { groups: [{ mob: 'goblin_worker', count: 30, interval: 0.55 }, { mob: 'goblin_shaman', count: 4, interval: 2.2 }] },
    { groups: [{ mob: 'goblin_slinger', count: 20, interval: 0.8 }, { mob: 'goblin_worker', count: 20, interval: 0.7 }] },
    { groups: [{ mob: 'wolf_rider', count: 20, interval: 0.6 }, { mob: 'goblin_shaman', count: 4, interval: 2.5 }] },
    { groups: [{ mob: 'goblin_worker', count: 36, interval: 0.5 }, { mob: 'goblin_slinger', count: 16, interval: 1.0 }, { mob: 'goblin_shaman', count: 6, interval: 2.2 }] },
    { groups: [{ mob: 'wolf_rider', count: 28, interval: 0.5 }], surge: true },
    { groups: [{ mob: 'goblin_slinger', count: 24, interval: 0.7 }, { mob: 'goblin_shaman', count: 8, interval: 1.8 }, { mob: 'goblin_worker', count: 24, interval: 0.6 }] },
    { groups: [{ mob: 'goblin_brute', count: 4, interval: 1.2 }, { mob: 'goblin_worker', count: 30, interval: 0.6, delay: 2 }, { mob: 'goblin_slinger', count: 16, interval: 1.2, delay: 4 }] },
  ],
};

const LAIR_TEMPLATE: LevelDef = {
  id: '1-3',
  name: '腐朽森林·兽穴',
  lineHp: 1100,
  baseGold: 80,
  waves: [
    { groups: [{ mob: 'goblin_worker', count: 24, interval: 0.7 }, { mob: 'goblin_slinger', count: 12, interval: 1.1 }] },
    { groups: [{ mob: 'wolf_rider', count: 20, interval: 0.55 }, { mob: 'goblin_shaman', count: 4, interval: 2.2 }] },
    { groups: [{ mob: 'goblin_slinger', count: 24, interval: 0.7 }, { mob: 'goblin_worker', count: 24, interval: 0.6 }], surge: true },
    { groups: [{ mob: 'goblin_brute', count: 2, interval: 1.5 }, { mob: 'goblin_worker', count: 24, interval: 0.6 }] },
    { groups: [{ mob: 'wolf_rider', count: 24, interval: 0.5 }, { mob: 'goblin_shaman', count: 6, interval: 2.0 }] },
    { groups: [{ mob: 'goblin_worker', count: 40, interval: 0.45 }, { mob: 'goblin_slinger', count: 20, interval: 0.9 }], surge: true },
    { groups: [{ mob: 'goblin_brute', count: 3, interval: 1.3 }, { mob: 'goblin_shaman', count: 6, interval: 1.8 }, { mob: 'goblin_worker', count: 24, interval: 0.6 }] },
    { groups: [{ mob: 'wolf_rider', count: 32, interval: 0.45 }], surge: true },
    { groups: [{ mob: 'goblin_slinger', count: 28, interval: 0.6 }, { mob: 'goblin_shaman', count: 8, interval: 1.6 }, { mob: 'goblin_worker', count: 30, interval: 0.5 }] },
    { groups: [{ mob: 'goblin_brute', count: 6, interval: 1.0 }, { mob: 'wolf_rider', count: 20, interval: 0.6, delay: 2 }, { mob: 'goblin_slinger', count: 20, interval: 1.0, delay: 3 }], surge: true },
  ],
};

/** Three chapter formations, with ten progressively stronger encounters in each chapter. */
const TEMPLATES = [OUTPOST_TEMPLATE, FOREST_TEMPLATE, LAIR_TEMPLATE];
const PATROLS = ['goblin_worker', 'goblin_slinger', 'wolf_rider', 'goblin_worker', 'goblin_shaman',
  'goblin_slinger', 'wolf_rider', 'goblin_shaman', 'wolf_rider', 'goblin_brute'];
const LEVEL_TABLE: Record<string, LevelDef> = {};
for (const stage of CAMPAIGN_STAGES.filter(row => row.chapter === 1)) {
  const chapter = CAMPAIGN_CHAPTERS[stage.chapter - 1], base = TEMPLATES[stage.chapter - 1];
  const step = stage.stage - 1;
  const waves = base.waves.map((wave, index) => {
    const groups = wave.groups.map(g => ({ ...g,
      count: Math.ceil(g.count * (1 + step * .035)),
      interval: Math.max(.35, g.interval * (1 - step * .012)),
    }));
    const add = (mob: string, count: number, interval: number, delay: number): void => {
      const existing = groups.find(g => g.mob === mob);
      if (existing) existing.count += count;
      else groups.push({ mob, count, interval, delay });
    };
    // Change encounter composition as well as stats; chapter entry retains its baseline formation.
    if (step > 0 && index === 5) {
      const mob = PATROLS[step];
      add(mob, mob === 'goblin_brute' ? 1 + stage.chapter : mob === 'goblin_shaman' ? 2 + stage.chapter : 4 + stage.chapter * 2, 1.3, 3);
    }
    if (stage.stage === 5 && index === 4) add('goblin_brute', stage.chapter, 1.8, 4);
    if (stage.stage === 10 && index === 9) add('goblin_brute', stage.chapter + 1, 1.6, 4);
    // Chapter-one milestones end with one king. Normal 1-5 uses its authored formation instead.
    if (stage.chapter === 1 && (stage.stage === 5 || stage.stage === 10) && index === base.waves.length - 1) {
      groups.unshift({ mob: 'goblin_king', count: 1, interval: 1, delay: 0 });
    }
    return { groups, surge: wave.surge || (stage.stage === 5 && index === 4) || (stage.stage === 10 && index === 9) };
  });
  LEVEL_TABLE[stage.id] = { id: stage.id, name: chapter.name + ' · ' + stage.name,
    lineHp: base.lineHp, baseGold: 60 + (stage.chapter - 1) * 80 + step * 8,
    statMul: Number((1 + (stage.chapter - 1) * .55 + step * .055).toFixed(3)), waves };
}

for (const stage of CAMPAIGN_STAGES.filter(row => row.chapter >= 2)) LEVEL_TABLE[stage.id] = expandedLevel(stage);

/** 关卡推进顺序（登记顺序即推进顺序） */
export const LEVEL_IDS: readonly string[] = CAMPAIGN_LEVEL_IDS;

/** 下一关 id；已是最后一关返回 null（胜利结算"下一关"直进用） */
export function nextLevelId(id: string): string | null {
  const i = LEVEL_IDS.indexOf(id);
  return i >= 0 && i + 1 < LEVEL_IDS.length ? LEVEL_IDS[i + 1] : null;
}

export function getLevelDef(id: string): LevelDef {
  const level = LEVEL_TABLE[id];
  if (!level) throw new Error('Unknown campaign stage: ' + id);
  return level;
}

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
