/**
 * 强化卡（§6 卡池，按英雄单独强化 + 全局卡；M0 弓箭手子集）
 * 卡效果直接改写 HeroStats / 全局 Stats；desc 只说明本次效果、触发条件与代价
 */
import { PAL } from './GameConfig';
import { CANNON, SIPHON, cannonSkillCfg, siphonSkillCfg } from './NewHeroConfig';

export type Rarity = 'white' | 'blue' | 'purple' | 'gold';
export const RARITY_COLOR: Record<Rarity, string> = { white: PAL.white, blue: PAL.blue, purple: PAL.purple, gold: PAL.gold };
// Relative weights; adding gold keeps existing rarity/type weights intact.
const RARITY_WEIGHT: Record<Rarity, number> = { white: 0.6, blue: 0.3, purple: 0.1, gold: 0.05 };
type OfferGroup = 'stats' | 'combat' | 'support';
/** 普攻机制/技能/大招卡优先；同品质单卡权重是通用数值卡的30倍，并非固定出现概率。 */
const OFFER_GROUP_WEIGHT: Record<OfferGroup, number> = { stats: 0.1, combat: 3, support: 1 };

/** 英雄战斗属性（卡牌改写目标；M0 弓箭手） */
export interface HeroStats {
  cannonEcho?: number;
  cannonLoader?: boolean;
  cannonKnockback?: number;
  cannonUltShots?: number;
  siphonTwin?: number;
  siphonInheritance?: number;
  siphonShred?: number;
  siphonBranches?: number;
  skillUnlocked: boolean; // 基础技能随上阵可用，局内卡改变构筑
  ultUnlocked: boolean;
  atk: number;          // 独立基础攻击力（含局外成长及装备）
  skillDmg: number;     // 独立基础技能伤害（含局外成长及装备；不是百分比）
  atkMul: number;       // 攻击力加成累乘
  aspd: number;         // 攻速 次/s（累乘）
  range: number;        // 普攻索敌范围
  skillRange: number;   // 技能索敌范围
  skillPierce?: number; // 重弩手技能额外穿透数；贯颅弩矢只强化技能，大招保持无限贯穿
  ultMarkAmp?: number;  // 死亡准星：大招命中后受到伤害增幅，持续5秒
  archerKnockback?: number; // 震退箭：每四轮首支主箭的击退距离
  sniperReturn?: number; // 回旋弩矢：大招返程伤害倍率
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
  skillMul: number;     // 基础技能伤害加成（法术精研，累乘；同时用于技能和大招）
  skillRangeMul: number;// 技能范围倍率（法术范围，累乘）
  ultDmgMul: number;    // 大招额外伤害加成（战吼，累乘）
  ultStun: number;      // 大招命中眩晕 s（震慑，覆盖）
  ultHaste: number;     // 大招后攻速加成标记（士气高涨，0/1）
  burnMul: number;      // 局外突破等灼烧伤害倍率；火法余烬卡另用pyroBurnBonus
  pyroBurnBonus?: number; // 火法余烬卡：+50%/层，独立于局外灼烧倍率，最多+150%
  pyroBlastMul?: number;  // 火法爆裂范围：放大普攻/技能/陨石爆炸与技能火区，不改索敌和陨石坑
  pyroLinger?: number;    // 火法余火绵延：灼烧、火区与陨石坑持续时间各+s
  pyroMeteorBonus?: number; // 火法陨石增援：额外陨石数
  pyroUltHitMul?: number; // 陨星威能：仅大招直接/溅射伤害，不放大灼烧
  pyroSplashBurn?: boolean; // 烈焰附着：普攻溅射也附加灼烧
  pyroBurnBurst?: number; // 余烬爆破：燃烧敌人死亡爆炸，爆炸本身不递归引爆
  pyroFirefield?: number; // 灼热火区：技能末颗火球落点留下火区的基础秒数
  pyroHealCut?: number; // 焦灼禁疗：自身灼烧附带的治疗削减比例
  pyroGiantEvery?: number; // 熔火巨弹：每多少次普攻发射巨型火球
  moraTeamVuln?: number; // 冰裂印记：冰系命中给全队提供短暂易伤
  shockOnHit: number;   // 雷系命中感电：目标受伤 +25% 持续 3s（感电卡，0=无）
  voltShockBonus?: number; // 高压电流：仅雷法自身对感电目标伤害+30%/层
  voltShockLinger?: number; // 余电不散：所有雷法来源感电持续+s
  voltStrikeBonus?: number; // 雷暴增援：额外真实落雷数
  voltOverload?: number; // 过载麻痹：连锁命中已有感电目标的眩晕概率
  voltArc?: number; // 电弧普攻：一次额外跳跃的伤害倍率
  chargeEff: number;    // 装备充能效率词条：击杀充能 ×(1+eff)（累加）
  pierceChance: number; // 英雄突破：普攻贯穿概率（0~1，累加）
  defIgnore: number;    // 英雄突破：无视防御比例（0~1，累加）
  ultAutoCd: number;    // 英雄突破：大招自动释放间隔 s（0=无；狙90级=25，无需/不消耗充能）
  normalMul: number;    // 技能升级·普攻伤害倍率（普攻专属乘区，技能/大招不吃）
  fullHpBonus: number;  // 技能升级·对满血目标伤害加成（狙15级 0.25）
  skillProc: number;    // 突破·普攻概率释放技能（雷70级 0.15，不占用不刷新冷却）
  shockAmpMul: number;  // 突破·感电加深倍率（雷30级 1.4：感电增伤 25%→35%）
  shockedBonus: number; // 技能升级·对感电目标伤害加成（雷普攻15级 0.25）
  pitVuln: number;      // 大招陨石坑易伤值（火法 0.25，突破80级加深）
  burnedBonus: number;  // 技能升级·对灼烧目标伤害加成（火普攻15级 0.25）
  novaR: number;        // 技能·冰霜领域半径（冰 150，突破60级 190）
  novaStun: number;     // 技能·领域冻结时长 s（冰 1.5，突破80级 1.9）
  freezeProc: number;   // 突破·普攻概率冰冻时长 s（冰70级 0.6，概率固定 15%）
  slowedBonus: number;  // 技能升级·对减速目标伤害加成（冰普攻15级 0.25）
  slowAmpBonus: number; // 凛冬之息：冰系减速比率累加，结算上限 0.9
  ultSlowDur: number;   // 兼容既有大招减速额外时长；新寒冬延续走 moraSlowLinger
  freezeChance: number; // 70级突破的普攻冰冻基础概率；无突破时不自动生效
  moraFreezeChanceBonus?: number; // 速冻之心：每层命中冰冻概率+15%，可独立启用
  moraColdBonus?: number; // 碎冰：冰法自身对减速/冰封目标伤害+30%/层
  moraSlowLinger?: number; // 寒冬延续：所有冰法减速与霜地持续+s，不增加冰封时间
  moraFreezeLinger?: number; // 冰封延长：仅冰霜领域冰封持续+s
  moraUltFreeze?: number; // 绝对零度：大招命中冰封s，解冻后才开始减速
  moraPierce?: number; // 穿霜冰锥：普攻额外穿透数，后续目标伤害70%
  moraGround?: number; // 凝霜地带：技能留下减速地带的基础秒数
  atkLv: number;        // 技能升级等级（战斗内读里程碑：普攻/技能/大招槽）
  skillLv: number;
  ultLv: number;
}

/** 技能和大招：攻击力的小额贡献 + 独立技能伤害 × 技能倍率。 */
export const ABILITY_ATTACK_RATIO = 0.2;
export function abilityDamage(s: Pick<HeroStats, 'atk' | 'atkMul' | 'skillDmg' | 'skillMul' | 'ultDmgMul'>,
  skillMultiplier: number, ultimate = false, attackMultiplier = ABILITY_ATTACK_RATIO): number {
  const base = s.atk * s.atkMul * attackMultiplier + s.skillDmg * (s.skillMul || 1) * skillMultiplier;
  return base * (ultimate ? s.ultDmgMul || 1 : 1);
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

/* ---------- 雷法师（沃尔·雷霆）技能升级效果（用户定稿；战斗侧与提示面板共用） ---------- */
/** 普攻槽：每级普攻伤害+8%，5级攻速+6%，10级暴击率+5%，15级对感电目标+25%，20级普攻伤害再+20% */
export function voltAtkCfg(a: number): { normalMul: number; aspdOn: boolean; critOn: boolean; shockedOn: boolean } {
  return { normalMul: (1 + (a - 1) * 0.08) * (a >= 20 ? 1.2 : 1), aspdOn: a >= 5, critOn: a >= 10, shockedOn: a >= 15 };
}
/** 技能槽（连锁闪电）：每级每跳+8%，5级冷却-1s，10级连锁+1目标，15级连锁递增每跳+10%，20级每跳倍率+0.3 */
export function voltSkCfg(k: number): { mul: number; cdOn: boolean; targetsOn: boolean; chainInc: number } {
  return { mul: (1.4 + (k >= 20 ? 0.3 : 0)) * (1 + (k - 1) * 0.08), cdOn: k >= 5, targetsOn: k >= 10, chainInc: k >= 15 ? 0.10 : 0 };
}
/** 大招槽（天雷灭世）：每级+8%，5级落雷范围+20%，10级落雷感电+25%·3s，15级充能-10%，20级每道倍率+0.4 */
export function voltUltCfg(u: number): { boltMul: number; rMul: number; shockOn: boolean; chargeOn: boolean } {
  return { boltMul: (2.2 + (u >= 20 ? 0.4 : 0)) * (1 + (u - 1) * 0.08), rMul: u >= 5 ? 1.2 : 1, shockOn: u >= 10, chargeOn: u >= 15 };
}

/** 雷法强化的战斗/提示共用配置；额外落雷延续原五道一组的节奏。 */
export function voltShockDuration(s: HeroStats): number { return 3 + (s.voltShockLinger || 0); }
export function voltShockedMultiplier(s: HeroStats, normal = false): number {
  return (1 + (s.voltShockBonus || 0)) * (1 + (normal ? s.shockedBonus || 0 : 0));
}
export function voltShockAmp(s: HeroStats, ultimate = false): number {
  return Math.max(s.shockOnHit || 0, ultimate && voltUltCfg(s.ultLv).shockOn ? .25 : 0) * (s.shockAmpMul || 1);
}
export function voltStrikeCount(s: HeroStats): number { return 15 + (s.voltStrikeBonus || 0); }
export function voltStrikeTime(index: number): number {
  const group = Math.floor(index / 5), within = index % 5;
  return (group < 3 ? [.65, 1.95, 3.15][group] : 3.15 + (group - 2) * 1.2)
    + within * (group < 3 ? [.2, .17, .16][group] : .16);
}

/* ---------- 火法师（焰·辉）技能升级效果（用户定稿；战斗侧与提示面板共用） ---------- */
/** 普攻槽：每级普攻伤害+8%，5级攻速+6%，10级暴击率+5%，15级对灼烧目标+25%，20级普攻伤害再+20% */
export function pyroAtkCfg(a: number): { normalMul: number; aspdOn: boolean; critOn: boolean; burnedOn: boolean } {
  return { normalMul: (1 + (a - 1) * 0.08) * (a >= 20 ? 1.2 : 1), aspdOn: a >= 5, critOn: a >= 10, burnedOn: a >= 15 };
}
/** 技能槽（烈焰爆裂）：每级+8%，5级冷却-1s，10级火球+1发，15级爆炸伤害40%→60%，20级每发倍率+0.3 */
export function pyroSkCfg(k: number): { mul: number; cdOn: boolean; shotsOn: boolean; boomMul: number } {
  return { mul: (1.6 + (k >= 20 ? 0.3 : 0)) * (1 + (k - 1) * 0.08), cdOn: k >= 5, shotsOn: k >= 10, boomMul: k >= 15 ? 0.6 : 0.4 };
}
/** 大招槽（陨石天降）：每级+8%，5级陨石+2颗，10级陨石坑范围+25%，15级充能-10%，20级每颗倍率+0.4 */
export function pyroUltCfg(u: number): { boltMul: number; meteors: number; craterMul: number; chargeOn: boolean } {
  return { boltMul: (3.5 + (u >= 20 ? 0.4 : 0)) * (1 + (u - 1) * 0.08), meteors: 5 + (u >= 5 ? 2 : 0), craterMul: u >= 10 ? 1.25 : 1, chargeOn: u >= 15 };
}

/** 火法强化卡的战斗侧与提示共用计算；局外培养倍率保留在独立乘区。 */
export function pyroBlastRadius(s: HeroStats, base: number): number { return base * (s.pyroBlastMul || 1); }
export function pyroBurnMultiplier(s: HeroStats): number { return (s.burnMul || 1) * (1 + (s.pyroBurnBonus || 0)); }
export function pyroBurnDuration(s: HeroStats, base = 3): number { return base + (s.pyroLinger || 0); }
export function pyroCraterDuration(s: HeroStats): number { return 4 + (s.pyroLinger || 0); }
export function pyroMeteorCount(s: HeroStats): number { return pyroUltCfg(s.ultLv).meteors + (s.pyroMeteorBonus || 0); }
export function pyroMeteorDamage(s: HeroStats): number {
  return abilityDamage(s, pyroUltCfg(s.ultLv).boltMul, true) * (s.pyroUltHitMul || 1);
}

/* ---------- 冰霜法师（莫拉·寒霜）技能升级效果（定稿；战斗侧与提示面板共用） ---------- */
/** 普攻槽：每级普攻伤害+8%，5级攻速+6%，10级暴击率+5%，15级对减速目标+25%，20级普攻伤害再+20% */
export function moraAtkCfg(a: number): { normalMul: number; aspdOn: boolean; critOn: boolean; slowedOn: boolean } {
  return { normalMul: (1 + (a - 1) * 0.08) * (a >= 20 ? 1.2 : 1), aspdOn: a >= 5, critOn: a >= 10, slowedOn: a >= 15 };
}
/** 技能槽（冰霜领域）：每级+8%，5级冷却-1s，10级领域范围+20%，15级冻结+0.3s，20级倍率+0.3 */
export function moraSkCfg(k: number): { mul: number; cdOn: boolean; rMul: number; stunBonus: number } {
  return { mul: (2 + (k >= 20 ? 0.3 : 0)) * (1 + (k - 1) * 0.08), cdOn: k >= 5, rMul: k >= 10 ? 1.2 : 1, stunBonus: k >= 15 ? 0.3 : 0 };
}
/** 大招槽（极寒领域）：每级+8%，5级减速50%→60%，10级持续4→6s，15级充能-10%，20级倍率+0.4 */
export function moraUltCfg(u: number): { boltMul: number; slowMul: number; slowDur: number; chargeOn: boolean } {
  return { boltMul: (1.8 + (u >= 20 ? 0.4 : 0)) * (1 + (u - 1) * 0.08), slowMul: u >= 5 ? 0.6 : 0.5, slowDur: u >= 10 ? 6 : 4, chargeOn: u >= 15 };
}

/** 冰法战斗与属性提示共用；三段均分原大招总伤害，命中时再结算目标状态。 */
export const MORA_ULT_HITS = 3;
export function moraSlowRatio(s: HeroStats, base: number): number { return Math.min(.9, base + (s.slowAmpBonus || 0)); }
export function moraSlowDuration(s: HeroStats, base: number): number { return base + (s.moraSlowLinger || 0); }
export function moraFreezeChance(s: HeroStats): number {
  return Math.min(1, (s.freezeProc > 0 ? s.freezeChance || .15 : 0) + (s.moraFreezeChanceBonus || 0));
}
export function moraNormalFreezeDuration(s: HeroStats): number { return Math.max(s.freezeProc || 0, s.moraFreezeChanceBonus ? .6 : 0); }
export function moraFieldRadius(s: HeroStats): number { return (s.novaR || 150) * moraSkCfg(s.skillLv).rMul * (s.skillRangeMul || 1); }
export function moraFieldFreeze(s: HeroStats): number { return (s.novaStun || 1.5) + moraSkCfg(s.skillLv).stunBonus + (s.moraFreezeLinger || 0); }
export function moraColdMultiplier(s: HeroStats): number { return 1 + (s.moraColdBonus || 0); }
export function moraUltimateHitDamage(s: HeroStats): number { return abilityDamage(s, moraUltCfg(s.ultLv).boltMul, true) / MORA_ULT_HITS; }

/** 技能伤害项每箭／每发／每跳的倍率，供技能培养预览共用。 */
export function skillBaseMultiplier(hid: string, level: number): number {
  switch (hid) {
    case 'cannon': return cannonSkillCfg(level).mul;
    case 'siphon': return siphonSkillCfg(level).mul;
    case 'sniper': return sniperSkCfg(level).mul;
    case 'pyro': return pyroSkCfg(level).mul;
    case 'volt': return voltSkCfg(level).mul;
    case 'mora': return moraSkCfg(level).mul;
    default: return archerEmpCfg(level).mult;
  }
}

export function baseArcherStats(): HeroStats {
  return {
    // 射程 900 / 技能 800（用户调整；文档 §3.1 的 520/416 作废）
    skillUnlocked: true, ultUnlocked: true, atk: 45, skillDmg: 100, atkMul: 1, aspd: 1.2, range: 900, skillRange: 800,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 6, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, skillProc: 0, shockAmpMul: 1, shockedBonus: 0, pitVuln: 0.25, burnedBonus: 0, novaR: 150, novaStun: 0.8, freezeProc: 0, slowedBonus: 0, slowAmpBonus: 0, ultSlowDur: 0, freezeChance: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 重弩手凯尔·鹰眼：基础攻速 0.5 次/秒；普攻 1200（几乎覆盖全场）、技能索敌 900 */
export function baseSniperStats(): HeroStats {
  return {
    skillUnlocked: true, ultUnlocked: true, atk: 140, skillDmg: 140, atkMul: 1, aspd: 0.5, range: 1200, skillRange: 900,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 6, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, skillProc: 0, shockAmpMul: 1, shockedBonus: 0, pitVuln: 0.25, burnedBonus: 0, novaR: 150, novaStun: 0.8, freezeProc: 0, slowedBonus: 0, slowAmpBonus: 0, ultSlowDur: 0, freezeChance: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 火焰法师 · 焰·辉（§4 #2：技能流·AOE/橙红）：普攻火球小溅射；普攻 520 / 技能索敌 460 */
export function basePyroStats(): HeroStats {
  return {
    skillUnlocked: true, ultUnlocked: true, atk: 60, skillDmg: 90, atkMul: 1, aspd: 1, range: 950, skillRange: 850,   // 基础普攻 1 次/秒；索敌范围 950 / 技能 850
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 60, explodeMul: 0.4,   // 火球自带小溅射
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 3, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, skillProc: 0, shockAmpMul: 1, shockedBonus: 0, pitVuln: 0.25, burnedBonus: 0, novaR: 150, novaStun: 0.8, freezeProc: 0, slowedBonus: 0, slowAmpBonus: 0, ultSlowDur: 0, freezeChance: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 雷电法师 · 沃尔·雷霆（§4 #3：技能流·连锁/紫）：闪电弹单体；普攻 900 / 技能索敌 800（用户调整）；天雷自带 1s 眩晕 */
export function baseVoltStats(): HeroStats {
  return {
    skillUnlocked: true, ultUnlocked: true, atk: 55, skillDmg: 85, atkMul: 1, aspd: 1, range: 900, skillRange: 800,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 5, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 1, ultHaste: 0, burnMul: 1, shockOnHit: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, skillProc: 0, shockAmpMul: 1, shockedBonus: 0, pitVuln: 0.25, burnedBonus: 0, novaR: 150, novaStun: 0.8, freezeProc: 0, slowedBonus: 0, slowAmpBonus: 0, ultSlowDur: 0, freezeChance: 0, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 冰霜法师 · 莫拉·寒霜（控制流·冰霜）：冰棱减速；普攻 900 / 技能索敌 800；自带减速 25%·2s */
export function baseMoraStats(): HeroStats {
  return {
    skillUnlocked: true, ultUnlocked: true, atk: 58, skillDmg: 80, atkMul: 1, aspd: 0.75, range: 900, skillRange: 800,
    critRate: 0.05, critMul: 1.5,
    serial: 0, fan: 0, split: 0, explodeR: 0, explodeMul: 0.4,
    pierce: 0, slowOnHit: 0.25, burnOnHit: 0,
    executeBonus: 0, lowHpBonus: 0,
    slowDur: 2, ultRounds: 1, chargeMul: 1, skillShots: 1, skillCdFlat: 0, ultBolts: 1,
    skillMul: 1, skillRangeMul: 1, ultDmgMul: 1, ultStun: 0, ultHaste: 0, burnMul: 1, shockOnHit: 0, chargeEff: 0, pierceChance: 0, defIgnore: 0, ultAutoCd: 0,
    normalMul: 1, fullHpBonus: 0, skillProc: 0, shockAmpMul: 1, shockedBonus: 0, pitVuln: 0.25, burnedBonus: 0, novaR: 150, novaStun: 1.5, freezeProc: 0, slowedBonus: 0, slowAmpBonus: 0, ultSlowDur: 0, freezeChance: 0.15, atkLv: 1, skillLv: 1, ultLv: 1,
  };
}

/** 全局属性（经验/金币/防线） */
export function baseCannonStats(): HeroStats {
  return { ...baseArcherStats(), atk: CANNON.attack, skillDmg: CANNON.skill, aspd: CANNON.aspd,
    range: CANNON.range, skillRange: CANNON.skillRange, skillShots: 1, explodeR: CANNON.blast };
}
export function baseSiphonStats(): HeroStats {
  return { ...baseArcherStats(), atk: SIPHON.attack, skillDmg: SIPHON.skill, aspd: SIPHON.aspd,
    range: SIPHON.range, skillRange: SIPHON.skillRange, skillShots: 2 };
}

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
  /** Explicit overrides; otherwise classify mechanic cards, numeric cards and global support. */
  offerGroup?: OfferGroup;
  maxStacks: number;
  /** 归属：'global' 或英雄 id（'archer' | 'sniper'），决定改写谁的属性 */
  owner: string;
  /** Shared illustration only; ownership, application and stack counts remain per hero. */
  art?: string;
  /** 前置卡：必须已拥有该卡（叠层≥1）才会进入抽卡池 */
  req?: string;
  /** 满足任一前置即可（例如灼烧强化同时服务技能与大招）。 */
  reqAny?: string[];
  /** 解锁卡复用该英雄的技能/大招图标。 */
  unlocks?: 'skill' | 'ult';
  desc: string;
  apply: (ctx: CardCtx) => void;
}

function c(def: CardDef): CardDef { return def; }

/** Four common numeric cards, instantiated separately for each hero. Keep legacy IDs stable. */
function commonHeroCards(owner: string): CardDef[] {
  const legacy: Record<string, string[]> = {
    archer: ['sharp', 'swift', 'crit_rate', 'crit_dmg'],
    sniper: ['heavy_head', 'fast_load', 'steady_rest', 'lethal_aim'],
  };
  const ids = legacy[owner] || ['attack', 'aspd', 'crit_rate', 'crit_dmg'].map(key => owner + '_' + key);
  return [
    c({ id: ids[0], name: '攻击强化', rarity: 'white', offerGroup: 'stats', maxStacks: 5, owner,
      art: 'ui_card_sharp', desc: '攻击力 +20%', apply: x => { x.hero.atkMul *= 1.2; } }),
    c({ id: ids[1], name: '攻速强化', rarity: 'white', offerGroup: 'stats', maxStacks: 4, owner,
      art: 'ui_card_swift', desc: '攻速 +15%', apply: x => { x.hero.aspd *= 1.15; } }),
    c({ id: ids[2], name: '暴击强化', rarity: 'blue', offerGroup: 'stats', maxStacks: 4, owner,
      art: 'ui_card_crit_rate', desc: '暴击率 +15%', apply: x => { x.hero.critRate += .15; } }),
    c({ id: ids[3], name: '爆伤强化', rarity: 'blue', offerGroup: 'stats', maxStacks: 3, owner,
      art: 'ui_card_crit_dmg', desc: '暴击伤害 +30%', apply: x => { x.hero.critMul += .3; } }),
  ];
}

/** Each acquisition trades 10% of this hero's current attack for the listed arrow mechanic. */
function archerAttackTradeoff(effect: CardDef['apply']): CardDef['apply'] {
  return x => { effect(x); x.hero.atkMul *= .9; };
}

function abilityCard(owner: string, unlocks: 'skill' | 'ult', abilityName: string): CardDef {
  return c({
    id: owner + '_unlock_' + unlocks, name: unlocks === 'skill' ? '解锁技能' : '解锁大招',
    owner, rarity: 'gold', maxStacks: 1, unlocks,
    desc: '本局学习「' + abilityName + '」' + (unlocks === 'skill' ? '\n冷却结束后自动释放' : '\n解锁后开始充能\n充满后点击释放'),
    apply: x => { if (unlocks === 'skill') x.hero.skillUnlocked = true; else x.hero.ultUnlocked = true; },
  });
}

/** Legacy definitions only; battle entry grants these prerequisites, so they are not in M0_POOL. */
export const ABILITY_CARDS: CardDef[] = [
  abilityCard('archer', 'skill', '强化箭矢'), abilityCard('archer', 'ult', '扇形箭雨'),
  abilityCard('sniper', 'skill', '穿颅射击'), abilityCard('sniper', 'ult', '猎杀时刻'),
  abilityCard('pyro', 'skill', '烈焰爆裂'), abilityCard('pyro', 'ult', '陨石天降'),
  abilityCard('volt', 'skill', '连锁闪电'), abilityCard('volt', 'ult', '天雷灭世'),
  abilityCard('mora', 'skill', '冰霜领域'), abilityCard('mora', 'ult', '极寒领域'),
];

/* ---------- 弓箭手 · 普攻强化卡（§6.2 子集） ---------- */
export const ARCHER_CARDS: CardDef[] = [
  ...commonHeroCards('archer'),
  c({ id: 'archer_knockback', name: '震退箭', rarity: 'blue', maxStacks: 1, owner: 'archer',
    art: 'ui_card_sniper_pierce_v1', desc: '每4轮普攻\n首支主箭击退敌人\n首领免疫',
    apply: x => { x.hero.archerKnockback = 56; } }),
  c({ id: 'archer_pierce', name: '穿林箭', rarity: 'blue', maxStacks: 2, owner: 'archer',
    art: 'ui_card_sniper_pierce_v1', desc: '普攻额外穿透1个目标',
    apply: x => { x.hero.pierce += 1; } }),
  c({ id: 'serial', name: '连射', rarity: 'blue', maxStacks: 5, owner: 'archer', desc: '普攻额外连射1次\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.serial += 1; }) }),
  c({ id: 'fan', name: '齐射', rarity: 'blue', maxStacks: 5, owner: 'archer', desc: '普攻箭矢数量 +1\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.fan += 1; }) }),
  c({ id: 'split', name: '分裂', rarity: 'purple', maxStacks: 2, owner: 'archer', desc: '命中后分裂2支箭\n分裂箭伤害50%\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.split += 2; }) }),
  c({ id: 'explode', name: '小范围爆炸', rarity: 'purple', maxStacks: 1, owner: 'archer', desc: '命中触发范围爆炸\n溅射伤害40%\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.explodeR = Math.max(x.hero.explodeR, 70); }) }),
  c({ id: 'explode_r', name: '爆炸范围', rarity: 'purple', maxStacks: 3, owner: 'archer', req: 'explode', desc: '爆炸半径 +40%',
    apply: x => { if (x.hero.explodeR > 0) x.hero.explodeR *= 1.4; } }),
  c({ id: 'explode_w', name: '爆炸威力', rarity: 'purple', maxStacks: 3, owner: 'archer', req: 'explode', desc: '爆炸伤害 +50%',
    apply: x => { if (x.hero.explodeR > 0) x.hero.explodeMul *= 1.5; } }),
  c({ id: 'frost', name: '寒霜附魔', rarity: 'purple', maxStacks: 1, owner: 'archer', desc: '命中减速20%\n持续1秒\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.slowOnHit = 0.2; x.hero.slowDur = 1; }) }),
  c({ id: 'burn', name: '烈焰附魔', rarity: 'purple', maxStacks: 1, owner: 'archer', desc: '命中点燃3秒\n累计60%攻击力伤害\n攻击力 -10%',
    apply: archerAttackTradeoff(x => { x.hero.burnOnHit = 0.2; }) }),
  c({ id: 'instinct_a', name: '猎手本能', rarity: 'blue', maxStacks: 2, owner: 'archer', desc: '对生命低于30%的目标\n伤害 +100%',
    apply: x => { x.hero.lowHpBonus += 1; } }),
  c({ id: 'rain_rounds', name: '多轮箭雨', rarity: 'gold', maxStacks: 2, owner: 'archer', req: 'archer_unlock_ult', desc: '大招箭雨轮数 +1',
    apply: x => { x.hero.ultRounds += 1; } }),
  c({ id: 'fast_charge_a', name: '快速充能', rarity: 'purple', maxStacks: 2, owner: 'archer', req: 'archer_unlock_ult', desc: '大招充能需求 -20%',
    apply: x => { x.hero.chargeMul *= 0.8; } }),
];

/* ---------- 狙击游侠 · 凯尔·鹰眼（§6.2/§6.4 普攻流·极限单体） ---------- */
export const SNIPER_CARDS: CardDef[] = [
  ...commonHeroCards('sniper'),
  c({ id: 'sniper_return', name: '回旋弩矢', rarity: 'purple', maxStacks: 1, owner: 'sniper', req: 'sniper_unlock_ult',
    art: 'ui_icon_ult_sniper', desc: '大招弩箭折返\n返程造成40%伤害',
    apply: x => { x.hero.sniperReturn = .4; } }),
  c({ id: 'execute', name: '处决标记', rarity: 'blue', maxStacks: 3, owner: 'sniper', desc: '对精英、首领\n伤害 +35%',
    apply: x => { x.hero.executeBonus += 0.35; } }),
  c({ id: 'instinct_s', name: '猎手本能', rarity: 'blue', maxStacks: 2, owner: 'sniper', desc: '对生命低于30%的目标\n伤害 +100%',
    apply: x => { x.hero.lowHpBonus += 1; } }),
  c({ id: 'multi_lock', name: '多目标锁定', rarity: 'purple', maxStacks: 2, owner: 'sniper', req: 'sniper_unlock_skill', desc: '穿颅射击额外连射2发',
    apply: x => { x.hero.skillShots += 2; } }),
  c({ id: 'cd_cut', name: '冷却缩减', rarity: 'blue', maxStacks: 2, owner: 'sniper', req: 'sniper_unlock_skill', desc: '穿颅射击冷却 -2秒',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'sniper_range', name: '远距校准', rarity: 'blue', maxStacks: 3, owner: 'sniper', req: 'sniper_unlock_skill',
    art: 'ui_card_sniper_range_v1', desc: '技能索敌范围 +30%',
    apply: x => { x.hero.skillRange *= 1.3; } }),
  c({ id: 'sniper_pierce', name: '贯颅弩矢', rarity: 'purple', maxStacks: 3, owner: 'sniper', req: 'sniper_unlock_skill',
    art: 'ui_card_sniper_pierce_v1', desc: '技能额外穿透1个目标',
    apply: x => { x.hero.skillPierce = (x.hero.skillPierce || 0) + 1; } }),
  c({ id: 'extra_line', name: '额外弩矢', rarity: 'gold', maxStacks: 2, owner: 'sniper', req: 'sniper_unlock_ult', desc: '大招弩箭数量 +1',
    apply: x => { x.hero.ultBolts += 1; } }),
  c({ id: 'fast_charge_s', name: '快速充能', rarity: 'purple', maxStacks: 2, owner: 'sniper', req: 'sniper_unlock_ult', desc: '大招充能需求 -20%',
    apply: x => { x.hero.chargeMul *= 0.8; } }),
  c({ id: 'sniper_mark', name: '死亡准星', rarity: 'gold', maxStacks: 1, owner: 'sniper', req: 'sniper_unlock_ult',
    art: 'ui_card_sniper_mark_v1', desc: '大招命中施加易伤\n目标受到伤害 +30%\n持续5秒',
    apply: x => { x.hero.ultMarkAmp = .3; } }),
];

/* ---------- 火焰法师 · 范围爆炸与灼烧（白2/蓝6/紫5/黄3） ---------- */
export const PYRO_CARDS: CardDef[] = [
  ...commonHeroCards('pyro'),
  c({ id: 'pyro_firefield', name: '灼热火区', rarity: 'purple', maxStacks: 1, owner: 'pyro', req: 'pyro_unlock_skill',
    art: 'ui_card_pyro_linger_v1', desc: '技能最后一颗火球\n落点留下3秒火区',
    apply: x => { x.hero.pyroFirefield = 3; } }),
  c({ id: 'pyro_antiheal', name: '焦灼禁疗', rarity: 'blue', maxStacks: 1, owner: 'pyro',
    art: 'ui_card_pyro_burn_v1', desc: '自身灼烧的敌人\n受到治疗量 -50%',
    apply: x => { x.hero.pyroHealCut = .5; } }),
  c({ id: 'pyro_giant', name: '熔火巨弹', rarity: 'purple', maxStacks: 1, owner: 'pyro',
    art: 'ui_card_pyro_shards_v2', desc: '每4次普攻发射巨弹\n爆炸半径翻倍',
    apply: x => { x.hero.pyroGiantEvery = 4; } }),
  c({ id: 'pyro_burst', name: '余烬爆破', rarity: 'purple', maxStacks: 1, owner: 'pyro',
    art: 'ui_card_pyro_burn_v1', desc: '自身点燃目标死亡时爆炸\n造成60%攻击力范围伤害\n爆炸不触发连锁',
    apply: x => { x.hero.pyroBurnBurst = .6; } }),
  c({ id: 'pyro_spell', name: '法术精研', rarity: 'blue', maxStacks: 3, owner: 'pyro', reqAny: ['pyro_unlock_skill', 'pyro_unlock_ult'], art: 'ui_card_pyro_spell_v2', desc: '技能伤害属性 +30%\n影响技能与大招',
    apply: x => { x.hero.skillMul *= 1.3; } }),
  c({ id: 'pyro_shards', name: '爆裂火球', rarity: 'purple', maxStacks: 3, owner: 'pyro', req: 'pyro_unlock_skill', art: 'ui_card_pyro_shards_v2', desc: '烈焰爆裂多发1颗火球',
    apply: x => { x.hero.skillShots += 1; } }),
  c({ id: 'pyro_cd', name: '冷却缩减', rarity: 'blue', maxStacks: 3, owner: 'pyro', req: 'pyro_unlock_skill', desc: '烈焰爆裂冷却 -2秒',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'pyro_range', name: '爆裂范围', rarity: 'blue', maxStacks: 3, owner: 'pyro', art: 'ui_card_pyro_range_v2', desc: '普攻、技能与陨石\n爆炸半径 +20%\n技能火区半径 +20%',
    apply: x => { x.hero.pyroBlastMul = (x.hero.pyroBlastMul || 1) * 1.2; } }),
  c({ id: 'pyro_war', name: '陨星威能', rarity: 'blue', maxStacks: 3, owner: 'pyro', req: 'pyro_unlock_ult', art: 'ui_card_pyro_war_v2', desc: '大招直接伤害 +40%',
    apply: x => { x.hero.pyroUltHitMul = (x.hero.pyroUltHitMul || 1) * 1.4; } }),
  c({ id: 'pyro_eager', name: '快速充能', rarity: 'purple', maxStacks: 2, owner: 'pyro', req: 'pyro_unlock_ult', desc: '大招充能需求 -25%',
    apply: x => { x.hero.chargeMul *= 0.75; } }),
  c({ id: 'pyro_burn', name: '烈焰附着', rarity: 'purple', maxStacks: 1, owner: 'pyro', art: 'ui_card_pyro_burn_v1', desc: '普攻和溅射点燃3秒\n每秒20%攻击力伤害',
    apply: x => { x.hero.burnOnHit = Math.max(x.hero.burnOnHit, .2); x.hero.pyroSplashBurn = true; } }),
  c({ id: 'pyro_ember', name: '余烬', rarity: 'purple', maxStacks: 3, owner: 'pyro', reqAny: ['pyro_burn', 'pyro_unlock_skill', 'pyro_unlock_ult'], art: 'ui_card_pyro_ember_v2', desc: '灼烧伤害 +50%\n包含陨石坑灼烧',
    apply: x => { x.hero.pyroBurnBonus = (x.hero.pyroBurnBonus || 0) + .5; } }),
  c({ id: 'pyro_linger', name: '余火绵延', rarity: 'purple', maxStacks: 2, owner: 'pyro', reqAny: ['pyro_burn', 'pyro_unlock_skill', 'pyro_unlock_ult'], art: 'ui_card_pyro_linger_v1', desc: '灼烧、火区与陨石坑\n持续时间 +1秒',
    apply: x => { x.hero.pyroLinger = (x.hero.pyroLinger || 0) + 1; } }),
  c({ id: 'pyro_meteors', name: '陨石增援', rarity: 'gold', maxStacks: 2, owner: 'pyro', req: 'pyro_unlock_ult', art: 'ui_card_pyro_meteors_v1', desc: '大招陨石数量 +2',
    apply: x => { x.hero.pyroMeteorBonus = (x.hero.pyroMeteorBonus || 0) + 2; } }),
];

/* ---------- 雷电法师：连锁清群 / 感电协作 / 连续落雷 ---------- */
export const VOLT_CARDS: CardDef[] = [
  ...commonHeroCards('volt'),
  c({ id: 'volt_arc', name: '电弧普攻', rarity: 'blue', maxStacks: 1, owner: 'volt',
    art: 'ui_card_volt_shards_v2', desc: '普攻额外跳跃1次\n跳跃伤害50%',
    apply: x => { x.hero.voltArc = .5; } }),
  c({ id: 'volt_overload', name: '过载麻痹', rarity: 'purple', maxStacks: 1, owner: 'volt', req: 'volt_shock',
    art: 'ui_card_volt_stun_v1', desc: '连锁命中感电敌人\n50%几率眩晕0.4秒\n同一目标间隔3秒',
    apply: x => { x.hero.voltOverload = .5; } }),
  c({ id: 'volt_spell', name: '法术精研', rarity: 'blue', maxStacks: 3, owner: 'volt', reqAny: ['volt_unlock_skill', 'volt_unlock_ult'], art: 'ui_card_volt_spell_v2', desc: '技能伤害属性 +30%\n影响技能与大招',
    apply: x => { x.hero.skillMul *= 1.3; } }),
  c({ id: 'volt_shards', name: '连锁增幅', rarity: 'purple', maxStacks: 3, owner: 'volt', req: 'volt_unlock_skill', art: 'ui_card_volt_shards_v2', desc: '连锁闪电目标 +2',
    apply: x => { x.hero.skillShots += 2; } }),
  c({ id: 'volt_cd', name: '冷却缩减', rarity: 'blue', maxStacks: 3, owner: 'volt', req: 'volt_unlock_skill', desc: '连锁闪电冷却 -2秒',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'volt_range', name: '电弧延伸', rarity: 'blue', maxStacks: 3, owner: 'volt', req: 'volt_unlock_skill', desc: '闪电跳跃距离 +30%',
    apply: x => { x.hero.skillRangeMul *= 1.3; } }),
  c({ id: 'volt_war', name: '雷霆威能', rarity: 'blue', maxStacks: 3, owner: 'volt', req: 'volt_unlock_ult', art: 'ui_card_volt_war_v2', desc: '大招落雷伤害 +40%',
    apply: x => { x.hero.ultDmgMul *= 1.4; } }),
  c({ id: 'volt_eager', name: '快速充能', rarity: 'purple', maxStacks: 2, owner: 'volt', req: 'volt_unlock_ult', desc: '大招充能需求 -25%',
    apply: x => { x.hero.chargeMul *= 0.75; } }),
  c({ id: 'volt_shock', name: '感电', rarity: 'purple', maxStacks: 1, owner: 'volt', art: 'ui_card_volt_shock_v2', desc: '命中附加3秒感电\n目标受到伤害 +25%',
    apply: x => { x.hero.shockOnHit = Math.max(x.hero.shockOnHit, .25); } }),
  c({ id: 'volt_pressure', name: '高压电流', rarity: 'purple', maxStacks: 2, owner: 'volt', req: 'volt_shock', art: 'ui_card_volt_pressure_v1', desc: '对感电目标\n自身伤害 +30%',
    apply: x => { x.hero.voltShockBonus = (x.hero.voltShockBonus || 0) + .3; } }),
  c({ id: 'volt_linger', name: '余电不散', rarity: 'purple', maxStacks: 2, owner: 'volt', req: 'volt_shock', art: 'ui_card_volt_linger_v1', desc: '感电持续时间 +1秒',
    apply: x => { x.hero.voltShockLinger = (x.hero.voltShockLinger || 0) + 1; } }),
  c({ id: 'volt_strikes', name: '雷暴增援', rarity: 'gold', maxStacks: 2, owner: 'volt', req: 'volt_unlock_ult', art: 'ui_card_volt_strikes_v1', desc: '大招落雷次数 +5',
    apply: x => { x.hero.voltStrikeBonus = (x.hero.voltStrikeBonus || 0) + 5; } }),
  c({ id: 'volt_stun', name: '雷霆震慑', rarity: 'gold', maxStacks: 1, owner: 'volt', req: 'volt_unlock_ult', art: 'ui_card_volt_stun_v1', desc: '大招眩晕时间 +1.5秒',
    apply: x => { x.hero.ultStun += 1.5; } }),
];

/* ---------- 冰霜法师：减速 / 冰封控场 / 碎冰增伤 ---------- */
export const MORA_CARDS: CardDef[] = [
  ...commonHeroCards('mora'),
  c({ id: 'mora_pierce', name: '穿霜冰锥', rarity: 'blue', maxStacks: 1, owner: 'mora',
    art: 'ui_card_mora_spell_v2', desc: '普攻额外穿透1个目标\n穿透后造成70%伤害',
    apply: x => { x.hero.moraPierce = 1; } }),
  c({ id: 'mora_ground', name: '凝霜地带', rarity: 'purple', maxStacks: 1, owner: 'mora', req: 'mora_unlock_skill',
    art: 'ui_card_mora_range_v2', desc: '技能留下3秒寒霜地带\n进入的敌人受到减速',
    apply: x => { x.hero.moraGround = 3; } }),
  c({ id: 'mora_team', name: '冰裂印记', rarity: 'purple', maxStacks: 1, owner: 'mora',
    art: 'ui_card_mora_brittle_v2', desc: '命中附加3秒易伤\n目标受到伤害 +15%',
    apply: x => { x.hero.moraTeamVuln = .15; } }),
  c({ id: 'mora_spell', name: '法术精研', rarity: 'blue', maxStacks: 3, owner: 'mora', reqAny: ['mora_unlock_skill', 'mora_unlock_ult'], art: 'ui_card_mora_spell_v2', desc: '技能伤害属性 +30%\n影响技能与大招',
    apply: x => { x.hero.skillMul *= 1.3; } }),
  c({ id: 'mora_range', name: '极寒扩散', rarity: 'blue', maxStacks: 3, owner: 'mora', req: 'mora_unlock_skill', art: 'ui_card_mora_range_v2', desc: '冰霜领域半径 +20%',
    apply: x => { x.hero.skillRangeMul *= 1.2; } }),
  c({ id: 'mora_cd', name: '冷却缩减', rarity: 'blue', maxStacks: 3, owner: 'mora', req: 'mora_unlock_skill', desc: '冰霜领域冷却 -2秒',
    apply: x => { x.hero.skillCdFlat += 2; } }),
  c({ id: 'mora_chill', name: '凛冬之息', rarity: 'blue', maxStacks: 3, owner: 'mora', art: 'ui_card_mora_chill_v2', desc: '减速幅度 +10个百分点\n最高减速90%',
    apply: x => { x.hero.slowAmpBonus += .1; } }),
  c({ id: 'mora_freeze', name: '速冻之心', rarity: 'purple', maxStacks: 2, owner: 'mora', art: 'ui_card_mora_freeze_v2', desc: '普攻冰冻几率 +15%\n冰冻持续0.6秒',
    apply: x => { x.hero.moraFreezeChanceBonus = (x.hero.moraFreezeChanceBonus || 0) + .15; } }),
  c({ id: 'mora_war', name: '冰川之力', rarity: 'blue', maxStacks: 3, owner: 'mora', req: 'mora_unlock_ult', art: 'ui_card_mora_war_v2', desc: '大招伤害 +40%',
    apply: x => { x.hero.ultDmgMul *= 1.4; } }),
  c({ id: 'mora_linger', name: '寒冬延续', rarity: 'purple', maxStacks: 2, owner: 'mora', desc: '减速、霜地\n持续时间 +1秒',
    apply: x => { x.hero.moraSlowLinger = (x.hero.moraSlowLinger || 0) + 1; } }),
  c({ id: 'mora_freeze_linger', name: '冰封延长', rarity: 'purple', maxStacks: 2, owner: 'mora', req: 'mora_unlock_skill', art: 'ui_card_mora_freeze_linger_v1', desc: '技能冰封时间 +1秒',
    apply: x => { x.hero.moraFreezeLinger = (x.hero.moraFreezeLinger || 0) + 1; } }),
  c({ id: 'mora_eager', name: '快速充能', rarity: 'purple', maxStacks: 2, owner: 'mora', req: 'mora_unlock_ult', desc: '大招充能需求 -25%',
    apply: x => { x.hero.chargeMul *= 0.75; } }),
  c({ id: 'mora_brittle', name: '碎冰', rarity: 'purple', maxStacks: 2, owner: 'mora', art: 'ui_card_mora_brittle_v2', desc: '对减速、冰封目标\n自身伤害 +30%',
    apply: x => { x.hero.moraColdBonus = (x.hero.moraColdBonus || 0) + .3; } }),
  c({ id: 'mora_glacier', name: '绝对零度', rarity: 'gold', maxStacks: 1, owner: 'mora', req: 'mora_unlock_ult', art: 'ui_card_mora_glacier_v2', desc: '大招命中冰封1.5秒\n首领免疫冰封',
    apply: x => { x.hero.moraUltFreeze = 1.5; } }),
];

/* ---------- 全局卡（§6.1） ---------- */
export const GLOBAL_CARDS: CardDef[] = [
  c({ id: 'wall', name: '城墙加固', rarity: 'white', maxStacks: 4, owner: 'global', desc: '防线耐久上限 +25%\n回复25%最大耐久',
    apply: x => { x.line.addMaxMul(1.25); x.line.healPct(0.25); } }),
  c({ id: 'repair', name: '工事修理', rarity: 'blue', maxStacks: 3, owner: 'global', desc: '每秒回复0.5%最大耐久',
    apply: x => { x.global.lineRegenPct += 0.005; } }),
  c({ id: 'xp_badge', name: '经验勋章', rarity: 'white', offerGroup: 'stats', maxStacks: 3, owner: 'global', desc: '经验获取 +10%',
    apply: x => { x.global.xpMul *= 1.1; } }),
];

/** 当前卡池 = 弓箭手 + 狙击 + 火法 + 雷法 + 冰法 + 全局（卡按 owner 归属英雄生效） */
export const CANNON_CARDS: CardDef[] = [
  ...commonHeroCards('cannon'),
  c({ id: 'cannon_echo', owner: 'cannon', name: '二段爆破', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_cannon_echo', desc: '普攻爆炸后再次爆破\n二次伤害40%', apply: x => { x.hero.cannonEcho = .4; } }),
  c({ id: 'cannon_loader', owner: 'cannon', name: '爆破装填', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_cannon_loader', desc: '每4轮普攻追加1发炮弹\n追加炮弹伤害60%', apply: x => { x.hero.cannonLoader = true; } }),
  c({ id: 'cannon_knockback', owner: 'cannon', name: '震荡冲击', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_cannon_knockback', desc: '技能爆炸击退敌人\n首领免疫击退', apply: x => { x.hero.cannonKnockback = 56; } }),
  c({ id: 'cannon_barrage', owner: 'cannon', name: '饱和轰炸', rarity: 'gold', maxStacks: 2, offerGroup: 'combat',
    art: 'ui_card_cannon_barrage', desc: '大招轰炸炮弹 +2', apply: x => { x.hero.cannonUltShots = (x.hero.cannonUltShots || 0) + 2; } }),
];
export const SIPHON_CARDS: CardDef[] = [
  ...commonHeroCards('siphon'),
  c({ id: 'siphon_twin', owner: 'siphon', name: '双重虹吸', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_siphon_twin', desc: '普攻增加1条副光束\n副光束伤害50%', apply: x => { x.hero.siphonTwin = .5; } }),
  c({ id: 'siphon_inherit', owner: 'siphon', name: '余能继承', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_siphon_inherit', desc: '换目标时保留\n50%虹吸增伤', apply: x => { x.hero.siphonInheritance = .5; } }),
  c({ id: 'siphon_shred', owner: 'siphon', name: '深度汲取', rarity: 'purple', maxStacks: 1, offerGroup: 'combat',
    art: 'ui_card_siphon_shred', desc: '持续锁定目标3秒后\n目标法抗降低15个百分点', apply: x => { x.hero.siphonShred = .15; } }),
  c({ id: 'siphon_extend', owner: 'siphon', name: '灵魂延展', rarity: 'gold', maxStacks: 2, offerGroup: 'combat',
    art: 'ui_card_siphon_extend', desc: '技能、大招\n各多连接1个目标', apply: x => { x.hero.siphonBranches = (x.hero.siphonBranches || 0) + 1; } }),
];
export const M0_POOL: CardDef[] = [...ARCHER_CARDS, ...SNIPER_CARDS, ...PYRO_CARDS, ...VOLT_CARDS, ...MORA_CARDS,
  ...CANNON_CARDS, ...SIPHON_CARDS, ...GLOBAL_CARDS];

export interface CardStacks { [cardId: string]: number; }

/** Read-only presentation helpers: never apply a card to preview it (some cards heal the wall). */
export type BuildTeam = ReadonlyArray<{ id: string; stats: Readonly<HeroStats> }>;

export function ownedBuildCards(owner: string, stacks: Readonly<CardStacks>): CardDef[] {
  // Only acquired cards in the live pool count; the seeded legacy unlock IDs are not selections.
  return M0_POOL.filter(card => card.owner === owner && (stacks[card.id] || 0) > 0)
    .sort((a, b) => Number(isMechanicCard(b)) - Number(isMechanicCard(a)));
}

export function cardComboHint(card: CardDef, stacks: Readonly<CardStacks>, team: BuildTeam): string {
  const has = (id: string): boolean => (stacks[id] || 0) > 0;
  const owner = team.find(hero => hero.id === card.owner)?.stats;
  switch (card.id) {
    case 'serial': return has('fan') ? '联动：齐射同步多排' : '';
    case 'fan': return has('serial') ? '联动：连射同步多列' : '';
    case 'archer_pierce': return has('serial') || has('fan') ? '联动：弹幕逐箭贯穿' : '';
    case 'explode_r': case 'explode_w': return has('explode') ? '联动：强化现有爆炸' : '';
    case 'frost': return '减速压低冲锋移速';
    case 'multi_lock': return has('sniper_pierce') ? '联动：每发连狙贯穿' : '';
    case 'sniper_pierce': return has('multi_lock') ? '联动：多发贯穿清群' : '';
    case 'sniper_mark': case 'mora_team':
      return team.some(hero => hero.id !== card.owner &&
        ((hero.stats.ultMarkAmp || 0) > 0 || (hero.stats.moraTeamVuln || 0) > 0))
        ? '同类易伤取最高值'
        : team.some(hero => hero.id === 'volt' && (hero.stats.shockOnHit > 0 || voltUltCfg(hero.stats.ultLv).shockOn))
          ? '联动：易伤叠加感电' : '全队集火共享增伤';
    case 'pyro_burst': return has('pyro_burn') ? '联动：普攻铺火爆破' : '技能点燃可接爆破';
    case 'pyro_burn': return has('pyro_burst') ? '联动：普攻铺火爆破' : '';
    case 'pyro_ember': case 'pyro_linger': return has('pyro_burn') ? '联动：强化普攻灼烧' : '技能、大招灼烧生效';
    case 'pyro_range': return has('pyro_burn') ? '联动：扩大溅射铺火' : '';
    case 'volt_shock':
      return team.some(hero => hero.id !== card.owner &&
        ((hero.stats.moraTeamVuln || 0) > 0 || (hero.stats.ultMarkAmp || 0) > 0))
        ? '联动：感电叠加易伤' : '全队集火共享增伤';
    case 'volt_pressure': return has('volt_shock') ? '联动：感电触发增伤' : '';
    case 'volt_linger': return has('volt_shock') ? '联动：延长全队受益' : '';
    case 'volt_range': return has('volt_shards') ? '联动：远跳覆盖多敌' : '';
    case 'volt_shards': return has('volt_range') ? '联动：远跳覆盖多敌' : '';
    case 'volt_stun': case 'mora_freeze': case 'mora_glacier': return '控制可打断狼骑冲锋';
    case 'mora_brittle': return '联动：减速触发增伤';
    case 'mora_chill': case 'mora_linger': return has('mora_brittle') ? '联动：维持碎冰增伤' : '';
    case 'mora_freeze_linger': return owner && owner.skillUnlocked ? '联动：延长领域冰封' : '';
    case 'wall': return has('repair') ? '联动：按新上限回血' : '';
    case 'repair': return has('wall') ? '联动：城墙上限回血' : '';
    default: return '';
  }
}

/** 抽卡、刷新与领取共用前置/上限检查，防止绕过解锁或重复学习。 */
export function canTakeCard(card: CardDef, stacks: CardStacks): boolean {
  return (stacks[card.id] || 0) < card.maxStacks
    && (!card.req || (stacks[card.req] || 0) > 0)
    && (!card.reqAny || card.reqAny.some(id => (stacks[id] || 0) > 0));
}

/** These cards change projectiles, statuses, contacts or cooperation, rather than only numbers. */
const MECHANIC_IDS = new Set(['archer_pierce', 'serial', 'fan', 'split', 'explode', 'frost', 'burn', 'rain_rounds',
  'multi_lock', 'sniper_pierce', 'extra_line', 'sniper_mark', 'pyro_shards', 'pyro_burn', 'pyro_burst', 'pyro_meteors',
  'volt_shards', 'volt_shock', 'volt_strikes', 'volt_stun', 'mora_freeze', 'mora_glacier', 'mora_team',
  'archer_knockback', 'sniper_return', 'pyro_firefield', 'pyro_antiheal', 'pyro_giant',
  'volt_arc', 'volt_overload', 'mora_pierce', 'mora_ground',
  'cannon_echo', 'cannon_loader', 'cannon_knockback', 'cannon_barrage',
  'siphon_twin', 'siphon_inherit', 'siphon_shred', 'siphon_extend']);
export function isMechanicCard(card: CardDef): boolean { return MECHANIC_IDS.has(card.id); }
function offerGroup(card: CardDef): OfferGroup {
  return card.offerGroup ?? (card.owner === 'global' ? 'support' : isMechanicCard(card) ? 'combat' : 'stats');
}
function offerWeight(card: CardDef): number {
  const group = offerGroup(card);
  return RARITY_WEIGHT[card.rarity] * OFFER_GROUP_WEIGHT[group];
}

/** Two mechanic opportunities when available, one following an invested hero and one opening another path.
 * Refreshes share these guarantees. Exhausted mechanic pools fall back to remaining legal cards. */
export function draw3(pool: CardDef[], stacks: CardStacks): CardDef[] {
  const picked: CardDef[] = [];
  const rest = pool.filter(k => canTakeCard(k, stacks));
  const progress: Record<string, number> = {};
  for (const card of pool) if (card.owner !== 'global')
    progress[card.owner] = (progress[card.owner] || 0) + (stacks[card.id] || 0);
  const take = (candidates: CardDef[], follow = false): void => {
    if (!candidates.length) return;
    const weights = candidates.map(c => offerWeight(c) * (follow ? 1 + Math.min(4, progress[c.owner] || 0) * .25 : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) { idx = i; break; }
    }
    const card = candidates[idx];
    picked.push(card); rest.splice(rest.indexOf(card), 1);
  };
  const mechanics = rest.filter(isMechanicCard);
  const continuing = mechanics.filter(c => progress[c.owner] > 0);
  take(continuing.length ? continuing : mechanics, true);
  const alternative = rest.filter(c => isMechanicCard(c) && c.owner !== picked[0]?.owner);
  take(alternative.length ? alternative : rest.filter(isMechanicCard));
  while (picked.length < 3) {
    const candidates = rest.filter(c => offerGroup(c) !== 'stats' || !picked.some(p => offerGroup(p) === 'stats'));
    if (!rest.length) break;
    take(candidates.length ? candidates : rest);
  }
  return picked;
}
