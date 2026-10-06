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
  serial: number;       // 连射：追加的弹幕排数（每排与首排同列数，列×排网格）
  fan: number;          // 齐射：弹幕并列列数追加（总列 = 1+fan）
  split: number;        // 分裂：命中分裂小弹道数
  explodeR: number;     // 爆炸半径（0=无爆炸）
  explodeMul: number;   // 爆炸伤害倍率
  pierce: number;       // 穿透目标数
  slowOnHit: number;    // 命中减速(0=无, 0.2=20%)
  burnOnHit: number;    // 命中点燃每秒伤害系数（0=无，0.2=3s共60%）
  executeBonus: number; // 对精英/BOSS 伤害加成（处决标记，累加）
  lowHpBonus: number;   // 对血量<30% 目标伤害加成（猎手本能，累加）
  slowDur: number;      // 命中减速时长 s（寒霜附魔）
  ultRounds: number;    // 大招箭雨轮数（弓，多轮箭雨）
  chargeMul: number;    // 大招充能需求倍率（快速充能，累乘）
  skillShots: number;   // 技能弹体数量（狙连狙发数 / 火法爆裂火球数）
  skillCdFlat: number;  // 技能冷却缩减 s（累加）
  ultBolts: number;     // 大招枪线条数（狙，额外枪线）
  skillMul: number;     // 技能伤害倍率（法术精研，累乘）
  skillRangeMul: number;// 技能范围倍率（法术范围，累乘）
  ultDmgMul: number;    // 大招伤害倍率（战吼，累乘）
  ultStun: number;      // 大招命中眩晕 s（震慑，覆盖）
  ultHaste: number;     // 大招后攻速加成标记（士气高涨，0/1）
  burnMul: number;      // 灼烧伤害倍率（余烬，累乘）
  shockOnHit: number;   // 雷系命中感电：目标受伤 +25% 持续 3s（感电卡，0=无）
  skillDmgFlat: number; // 装备技能伤害词条（平加进技能/大招伤害基数，累加）
  chargeEff: number;    // 装备充能效率词条：击杀充能 ×(1+eff)（累加）
  pierceChance: number; // 英雄突破：普攻贯穿概率（0~1，累加）
  defIgnore: number;    // 英雄突破：无视防御比例（0~1，累加）
  ultAutoCd: number;    // 英雄突破：大招自动释放间隔 s（0=无；狙90级=25，无需/不消耗充能）
  normalMul: number;    // 技能升级·普攻伤害倍率（普攻专属乘区，技能/大招不吃）
  fullHpBonus: number;  // 技能升级·对满血目标伤害加成（狙15级 0.25）
  atkLv: number;        // 技能升级等级（战斗内读里程碑：普攻/技能/大招槽）
  skillLv: number;
  ultLv: number;
}

/* ---------- 弓箭手技能升级效果（用户定稿；战斗侧与提示面板共用同一配置） ---------- */
/** 普攻槽：每级普攻伤害+8%，5级攻速+6%，10级暴击率+5%，15级普攻范围+8%，20级普攻伤害再+20% */
export function archerAtkCfg(a: number): { normalMul: number; aspdOn: boolean; critOn: boolean; rangeOn: boolean } {
  return {
    normalMul: (1 + (a - 1) * 0.08) * (a >= 20 ? 1.2 : 1),
    aspdOn: a >= 5, critOn: a >= 10, rangeOn: a >= 15,
  };
}
/** 技能槽（强化箭矢）：每级技能伤害+8%，5级冷却-1s，10级强化箭+2发，15级窗口+2s，20级倍率+0.3 */
export function archerEmpCfg(k: number): { arrows: number; mult: number; dur: number } {
  return { arrows: 6 + (k >= 10 ? 2 : 0), mult: (1.5 + (k >= 20 ? 0.3 : 0)) * (1 + (k - 1) * 0.08), dur: 12 + (k >= 15 ? 2 : 0) };
}
/** 大招槽（扇形箭雨）：每级大招伤害+8%，5级每排+2箭，10级追加第三排，15级充能-10%，20级每箭系数+0.1 */
export function archerUltCfg(u: number): { arrows: number; rows: number; coeff: number; chargeOn: boolean } {
  return { arrows: 8 + (u >= 5 ? 2 : 0), rows: 2 + (u >= 10 ? 1 : 0), coeff: (0.65 + (u >= 20 ? 0.1 : 0)) * (1 + (u - 1) * 0.08), chargeOn: u >= 15 };
}

/* ---------- 重弩手（凯尔·鹰眼）技能升级效果（用户定稿；战斗侧与提示面板共用） ---------- */
/** 普攻槽：每级普攻伤害+8%，5级攻速+6%，10级暴击率+5%，15级对满血目标+25%，20级普攻伤害再+20% */
export function sniperAtkCfg(a: number): { normalMul: number; aspdOn: boolean; critOn: boolean; fullHpOn: boolean } {
  return { normalMul: (1 + (a - 1) * 0.08) * (a >= 20 ? 1.2 : 1), aspdOn: a >= 5, critOn: a >= 10, fullHpOn: a >= 15 };
}
/** 技能槽（穿颅射击）：每级+8%，5级冷却-1s，10级连狙+2发，15级索敌窗口+1s，20级每发倍率+0.4 */
export function sniperSkCfg(k: number): { shots: number; mul: number; window: number } {
  return { shots: 6 + (k >= 10 ? 2 : 0), mul: (2.0 + (k >= 20 ? 0.4 : 0)) * (1 + (k - 1) * 0.08), window: 4 + (k >= 15 ? 1 : 0) };
}
/** 大招槽（猎杀时刻）：每级+8%，5级弹体判定+20%，10级猎杀标记(受伤+20%·5s)，15级充能-10%，20级倍率+1.0 */
export function sniperUltCfg(u: number): { boltMul: number; rMul: number; markAmp: number; markDur: number; chargeOn: boolean } {
  return {
    boltMul: (5.5 + (u >= 20 ? 1.0 : 0)) * (1 + (u - 1) * 0.08), rMul: u >= 5 ? 1.2 : 1,
    markAmp: u >= 10 ? 0.20 : 0, markDur: 5, chargeOn: u >= 15,
  };
}

export function baseArcherStats(): HeroStats {
  return {
    // 射程 900 / 技能 800（用户调整；文档 §3.1 的 520/416 作废）
    atk: 45, atkMul: 1, aspd: 1.2, range: 900, skillRange: 800,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 6, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, skillDmgFlat: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 狙击游侠凯尔·鹰眼（§11.1 + 用户调整）：极限单体 140/0.35s；普攻 1200（几乎覆盖全场）、技能索敌 900 */
export function baseSniperStats(): HeroStats {
  return {
    atk: 140, atkMul: 1, aspd: 0.35, range: 1200, skillRange: 900,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 6, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, skillDmgFlat: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 火焰法师 · 焰·辉（§4 #2：技能流·AOE/橙红）：普攻火球小溅射；普攻 520 / 技能索敌 460 */
export function basePyroStats(): HeroStats {
  return {
    atk: 60, atkMul: 1, aspd: 0.8, range: 950, skillRange: 850,   // 索敌范围（用户调整：普攻 950 / 技能 850）
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 60, explodeMul: 0.4,   // 火球自带小溅射
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 3, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, skillDmgFlat: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 雷电法师 · 沃尔·雷霆（§4 #3：技能流·连锁/紫）：闪电弹单体；普攻 900 / 技能索敌 800（用户调整）；天雷自带 1s 眩晕 */
export function baseVoltStats(): HeroStats {
  return {
    atk: 55, atkMul: 1, aspd: 0.75, range: 900, skillRange: 800,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 5, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 1, ultHaste: 0, burnMul: 1, shockOnHit: 0, skillDmgFlat: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, atkLv: 1, skillLv: 1, ultLv: 1,
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
  /** 归属：'global' 或英雄 id（'archer' | 'sniper'），决定改写谁的属性 */
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
  c({ id: 'swift', name: '迅捷之风', rarity: 'white', maxStacks: 4, owner: 'archer', desc: '攻速 +15%',
    apply: x => { x.hero.aspd *= 1.15; } }),
  c({ id: 'serial', name: '连射', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '普攻追加 1 排弹幕（微延迟整排再射，弹道数与首排一致，独立命中）',
    apply: x => { x.hero.serial += 1; } }),
  c({ id: 'fan', name: '齐射', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '普攻弹道并列 +1 列（扇形展开，直线随缘命中）',
    apply: x => { x.hero.fan += 1; } }),
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
  c({ id: 'crit_dmg', name: '致命一击', rarity: 'blue', maxStacks: 3, owner: 'archer', desc: '暴击伤害 +30%',
    apply: x => { x.hero.critMul += 0.3; } }),
  c({ id: 'frost', name: '寒霜附魔', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '命中减速 20% 1s',
    apply: x => { x.hero.slowOnHit = 0.2; x.hero.slowDur = 1; } }),
  c({ id: 'burn', name: '烈焰附魔', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '命中点燃（3s 共 60% 攻击力伤害）',
    apply: x => { x.hero.burnOnHit = 0.2; } }),
  c({ id: 'instinct_a', name: '猎手本能', rarity: 'blue', maxStacks: 2, owner: 'archer', desc: '对血量 <30% 目标伤害 +100%',
    apply: x => { x.hero.lowHpBonus += 1; } }),
  c({ id: 'rain_rounds', name: '多轮箭雨', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '大招箭雨 +1 轮（可叠至 3 轮）',
    apply: x => { x.hero.ultRounds += 1; } }),
  c({ id: 'fast_charge_a', name: '快速充能', rarity: 'blue', maxStacks: 2, owner: 'archer', desc: '大招充能需求 -20%（可叠加）',
    apply: x => { x.hero.chargeMul *= 0.8; } }),
];

/* ---------- 狙击游侠 · 凯尔·鹰眼（§6.2/§6.4 普攻流·极限单体） ---------- */
export const SNIPER_CARDS: CardDef[] = [
  c({ id: 'heavy_head', name: '重弹头', rarity: 'white', maxStacks: 5, owner: 'sniper', desc: '攻击力 +20%',
    apply: x => { x.hero.atkMul *= 1.2; } }),
  c({ id: 'fast_load', name: '快速装填', rarity: 'white', maxStacks: 4, owner: 'sniper', desc: '攻速 +15%',
    apply: x => { x.hero.aspd *= 1.15; } }),
  c({ id: 'steady_rest', name: '稳定枪架', rarity: 'white', maxStacks: 4, owner: 'sniper', desc: '暴击率 +15%',
    apply: x => { x.hero.critRate += 0.15; } }),
  c({ id: 'lethal_aim', name: '致命瞄准', rarity: 'blue', maxStacks: 3, owner: 'sniper', desc: '暴击伤害 +30%',
    apply: x => { x.hero.critMul += 0.3; } }),
  c({ id: 'execute', name: '处决标记', rarity: 'blue', maxStacks: 3, owner: 'sniper', desc: '普攻对精英/BOSS 伤害 +35%',
    apply: x => { x.hero.executeBonus += 0.35; } }),
  c({ id: 'instinct_s', name: '猎手本能', rarity: 'blue', maxStacks: 2, owner: 'sniper', desc: '对血量 <30% 目标伤害 +100%',
    apply: x => { x.hero.lowHpBonus += 1; } }),
  c({ id: 'multi_lock', name: '多目标锁定', rarity: 'blue', maxStacks: 2, owner: 'sniper', desc: '穿颅射击连狙 +2 发（可叠加）',
    apply: x => { x.hero.skillShots += 2; } }),
  c({ id: 'cd_cut', name: '冷却缩减', rarity: 'blue', maxStacks: 2, owner: 'sniper', desc: '技能冷却 -2 秒（可叠加）',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'extra_line', name: '额外枪线', rarity: 'purple', maxStacks: 2, owner: 'sniper', desc: '大招额外 +1 条枪线（可叠加）',
    apply: x => { x.hero.ultBolts += 1; } }),
  c({ id: 'fast_charge_s', name: '快速充能', rarity: 'blue', maxStacks: 2, owner: 'sniper', desc: '大招充能需求 -20%（可叠加）',
    apply: x => { x.hero.chargeMul *= 0.8; } }),
];

/* ---------- 火焰法师 · 焰·辉（§6.3 技能流 + §6.4 余烬） ---------- */
export const PYRO_CARDS: CardDef[] = [
  c({ id: 'pyro_spell', name: '法术精研', rarity: 'white', maxStacks: 4, owner: 'pyro', desc: '技能伤害 +40%',
    apply: x => { x.hero.skillMul *= 1.4; } }),
  c({ id: 'pyro_shards', name: '技能弹体', rarity: 'blue', maxStacks: 3, owner: 'pyro', desc: '烈焰爆裂火球 +1 颗（可叠加）',
    apply: x => { x.hero.skillShots += 1; } }),
  c({ id: 'pyro_cd', name: '冷却缩减', rarity: 'blue', maxStacks: 3, owner: 'pyro', desc: '技能冷却 -2 秒（可叠加）',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'pyro_range', name: '法术范围', rarity: 'white', maxStacks: 3, owner: 'pyro', desc: '爆裂范围 +30%',
    apply: x => { x.hero.skillRangeMul *= 1.3; } }),
  c({ id: 'pyro_war', name: '战吼', rarity: 'blue', maxStacks: 3, owner: 'pyro', desc: '大招伤害 +50%',
    apply: x => { x.hero.ultDmgMul *= 1.5; } }),
  c({ id: 'pyro_eager', name: '激昂', rarity: 'purple', maxStacks: 2, owner: 'pyro', desc: '大招充能需求 -25%（可叠加）',
    apply: x => { x.hero.chargeMul *= 0.75; } }),
  c({ id: 'pyro_stun', name: '震慑', rarity: 'purple', maxStacks: 2, owner: 'pyro', desc: '陨石命中眩晕 1 秒',
    apply: x => { x.hero.ultStun = 1; } }),
  c({ id: 'pyro_morale', name: '士气高涨', rarity: 'blue', maxStacks: 2, owner: 'pyro', desc: '大招释放后攻速 +40% 持续 5 秒',
    apply: x => { x.hero.ultHaste = 1; } }),
  c({ id: 'pyro_ember', name: '余烬', rarity: 'purple', maxStacks: 2, owner: 'pyro', desc: '灼烧伤害翻倍',
    apply: x => { x.hero.burnMul *= 2; } }),
];

/* ---------- 雷电法师 · 沃尔·雷霆（§6.3 技能流 + §6.4 感电） ---------- */
export const VOLT_CARDS: CardDef[] = [
  c({ id: 'volt_spell', name: '法术精研', rarity: 'white', maxStacks: 4, owner: 'volt', desc: '技能伤害 +40%',
    apply: x => { x.hero.skillMul *= 1.4; } }),
  c({ id: 'volt_shards', name: '技能弹体', rarity: 'blue', maxStacks: 3, owner: 'volt', desc: '连锁闪电弹跳 +2 目标（可叠加）',
    apply: x => { x.hero.skillShots += 2; } }),
  c({ id: 'volt_cd', name: '冷却缩减', rarity: 'blue', maxStacks: 3, owner: 'volt', desc: '技能冷却 -2 秒（可叠加）',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'volt_range', name: '法术范围', rarity: 'white', maxStacks: 3, owner: 'volt', desc: '连锁跳跃距离 +30%',
    apply: x => { x.hero.skillRangeMul *= 1.3; } }),
  c({ id: 'volt_war', name: '战吼', rarity: 'blue', maxStacks: 3, owner: 'volt', desc: '大招伤害 +50%',
    apply: x => { x.hero.ultDmgMul *= 1.5; } }),
  c({ id: 'volt_eager', name: '激昂', rarity: 'purple', maxStacks: 2, owner: 'volt', desc: '大招充能需求 -25%（可叠加）',
    apply: x => { x.hero.chargeMul *= 0.75; } }),
  c({ id: 'volt_morale', name: '士气高涨', rarity: 'blue', maxStacks: 2, owner: 'volt', desc: '大招释放后攻速 +40% 持续 5 秒',
    apply: x => { x.hero.ultHaste = 1; } }),
  c({ id: 'volt_shock', name: '感电', rarity: 'purple', maxStacks: 2, owner: 'volt', desc: '雷系命中感电：目标受伤 +25% 持续 3s（可叠至 +50%）',
    apply: x => { x.hero.shockOnHit = Math.min(0.5, x.hero.shockOnHit + 0.25); } }),
];

/* ---------- 全局卡（§6.1） ---------- */
export const GLOBAL_CARDS: CardDef[] = [
  c({ id: 'wall', name: '城墙加固', rarity: 'white', maxStacks: 4, owner: 'global', desc: '防线耐久上限 +25% 并回复 25%',
    apply: x => { x.line.addMaxMul(1.25); x.line.healPct(0.25); } }),
  c({ id: 'repair', name: '工事修理', rarity: 'blue', maxStacks: 3, owner: 'global', desc: '防线每秒回复 0.5% 最大耐久',
    apply: x => { x.global.lineRegenPct += 0.005; } }),
  c({ id: 'xp_badge', name: '经验勋章', rarity: 'white', maxStacks: 3, owner: 'global', desc: '经验获取 +10%',
    apply: x => { x.global.xpMul *= 1.1; } }),
];

/** 当前卡池 = 弓箭手 + 狙击 + 火法 + 全局（卡按 owner 归属英雄生效） */
export const M0_POOL: CardDef[] = [...ARCHER_CARDS, ...SNIPER_CARDS, ...PYRO_CARDS, ...VOLT_CARDS, ...GLOBAL_CARDS];

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
