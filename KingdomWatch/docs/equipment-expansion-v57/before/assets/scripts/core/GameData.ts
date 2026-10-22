/**
 * 五主界面数据层（§主界面需求清单）：物品/商店/英雄配置 + 经济公式 + 背包穿戴养成操作
 * 掉落与购买共用同一物品定义；数值默认值见 docs/主界面需求清单.md（实施时校准只动这张表）
 */
import { loadSave, saveSave, EquipInst, HeroState } from './SaveData';
import { DIFFICULTIES, starChestRewards } from '../config/LevelDifficulty';
import { WEAPONS, weaponFits, weaponUsers } from '../config/Weapons';
import { CAMPAIGN_LEVEL_IDS } from '../config/Campaign';
export { WEAPONS, weaponFits, weaponUsers } from '../config/Weapons';

/* ================= 物品定义 ================= */

export type EquipKind = 'weapon' | 'helm' | 'acc' | 'glove' | 'armor';
export type Quality = 0 | 1 | 2 | 3; // 白/绿/蓝/紫

export const QNAME = ['白', '绿', '蓝', '紫'];
export const QCOLOR = ['#C9D6DF', '#7FB841', '#4FA8FF', '#B96BFF'];
export const KIND_NAME: Record<EquipKind, string> = {
  weapon: '武器', helm: '头盔', acc: '饰品', glove: '手套', armor: '衣服',
};
/** 材料物品 */
export interface MatDef { id: string; name: string; price: number; desc: string; }
export const MATS: Record<string, MatDef> = {
  mat_stone: { id: 'mat_stone', name: '强化石', price: 50, desc: '武器/装备强化必需材料' },
  mat_iron: { id: 'mat_iron', name: '精铁锭', price: 80, desc: '高品质强化所需材料' },
  mat_dust: { id: 'mat_dust', name: '魔法尘', price: 120, desc: '附魔材料的基底' },
  mat_rune: { id: 'mat_rune', name: '符文碎片', price: 200, desc: '高阶强化的稀有材料' },
};

/** 装备词条（用户确认按部位固定归属）：头盔=攻击/攻击加成，饰品=暴击率/暴击伤害，
 *  手套=攻速/攻击范围，衣服=技能伤害/充能效率，武器=攻击/技能伤害+一条专属（atkPct/critRate/critDmg/chargeEff/atkSpd 之一） */
export type StatKey = 'atk' | 'atkPct' | 'skillDmg' | 'critRate' | 'critDmg' | 'atkSpd' | 'range' | 'chargeEff';
export const STAT_NAME: Record<StatKey, string> = {
  atk: '攻击', atkPct: '攻击加成', skillDmg: '技能伤害', critRate: '暴击率',
  critDmg: '暴击伤害', atkSpd: '攻速', range: '攻击范围', chargeEff: '充能效率',
};
/** 百分比词条（展示 ×100 加 %；其余为整数值） */
export const PCT_STATS: StatKey[] = ['atkPct', 'critRate', 'critDmg', 'atkSpd', 'chargeEff'];

/** 装备/武器模板（商店购买/掉落按此实例化） */
export interface EquipDef {
  id: string; name: string; kind: EquipKind; quality: Quality; tier: number;
  /** 词条表（lv1 基础值；阶级每+1 数值×1.8，百分比词条同乘） */
  stats: Partial<Record<StatKey, number>>;
  price: number; unlock: string; // 商店价/解锁关卡
}
export const EQUIPS: Record<string, EquipDef> = {
  ...Object.keys(WEAPONS).reduce((out, id) => { out[id] = { ...WEAPONS[id], kind: 'weapon' }; return out; }, {} as Record<string, EquipDef>),
  helm_falcon: { id: 'helm_falcon', name: '猎鹰头盔', kind: 'helm', quality: 2, tier: 1, stats: { atk: 10, atkPct: 0.06 }, price: 600, unlock: '1-1' },
  acc_moon: { id: 'acc_moon', name: '月纹坠饰', kind: 'acc', quality: 1, tier: 1, stats: { critRate: 0.03, critDmg: 0.12 }, price: 300, unlock: '1-1' },
  glove_wind: { id: 'glove_wind', name: '疾风手套', kind: 'glove', quality: 0, tier: 3, stats: { atkSpd: 0.05, range: 30 }, price: 900, unlock: '1-2' },
  armor_forest: { id: 'armor_forest', name: '林语皮甲', kind: 'armor', quality: 3, tier: 1, stats: { skillDmg: 30, chargeEff: 0.10 }, price: 2400, unlock: '1-2' },
};

export function isEquip(id: string): boolean { return !!EQUIPS[id]; }
export function isMat(id: string): boolean { return !!MATS[id]; }
export function itemName(id: string): string { return EQUIPS[id]?.name || MATS[id]?.name || id; }
/** 阶级系数：tier 每 +1 属性×1.8、售价×3 */
export function tierMul(tier: number): number { return Math.pow(1.8, tier - 1); }

/** 装备单条词条现值（阶乘×强化成长；百分比取 3 位小数） */
export function equipLevel(e: EquipInst, hid?: string): number {
  if (EQUIPS[e.defId]?.kind !== 'weapon') return e.lv;
  const sv = loadSave();
  const owner = hid || Object.keys(sv.heroes).find(id => sv.heroes[id].worn.weapon === e.uid);
  return owner ? sv.heroes[owner]?.weaponLv || 1 : 1;
}
/** Weapon level belongs to the hero. A preview may explicitly supply the next cultivation level. */
export function equipStat(e: EquipInst, key: StatKey, hid?: string, weaponLevel?: number): number {
  const d = EQUIPS[e.defId];
  const v = d?.stats[key];
  if (!v) return 0;
  const lv = d.kind === 'weapon' ? weaponLevel ?? equipLevel(e, hid) : e.lv;
  const raw = v * tierMul(d.tier) * (1 + (lv - 1) * 0.04);
  return PCT_STATS.includes(key) ? Math.round(raw * 1000) / 1000 : Math.round(raw);
}
export const statFmt = (k: StatKey, v: number): string =>
  PCT_STATS.includes(k) ? `${Math.round(v * 1000) / 10}%` : String(Math.round(v));

/** 穿戴词条聚合（战斗侧与属性面板共用）：atkFlat/atkPct→攻击，skillDmgFlat→技能伤害，其余同理 */
export interface EquipAgg {
  atkFlat: number; atkPct: number; skillDmgFlat: number; critRate: number;
  critDmg: number; atkSpd: number; rangeFlat: number; chargeEff: number;
}
export function equipAgg(hid: string, weaponLevel = heroState(hid)?.weaponLv || 1): EquipAgg {
  const sv = loadSave();
  const agg: EquipAgg = { atkFlat: 0, atkPct: 0, skillDmgFlat: 0, critRate: 0, critDmg: 0, atkSpd: 0, rangeFlat: 0, chargeEff: 0 };
  const hs = sv.heroes[hid];
  if (!hs) return agg;
  for (const uid of Object.values(hs.worn)) {
    const inst = sv.equips.find(q => q.uid === uid);
    if (!inst) continue;
    for (const k of Object.keys(EQUIPS[inst.defId]?.stats || {}) as StatKey[]) {
      const v = equipStat(inst, k, hid, weaponLevel);
      if (k === 'atk') agg.atkFlat += v;
      else if (k === 'atkPct') agg.atkPct += v;
      else if (k === 'skillDmg') agg.skillDmgFlat += v;
      else if (k === 'critRate') agg.critRate += v;
      else if (k === 'critDmg') agg.critDmg += v;
      else if (k === 'atkSpd') agg.atkSpd += v;
      else if (k === 'range') agg.rangeFlat += v;
      else if (k === 'chargeEff') agg.chargeEff += v;
    }
  }
  const wb = weaponBtAgg(hid, weaponLevel);
  agg.atkSpd += wb.atkSpd; agg.critRate += wb.critRate;
  agg.critDmg += wb.critDmg; agg.chargeEff += wb.chargeEff;
  return agg;
}

export function equippedWeapon(hid: string) { return WEAPONS[wornInst(hid, 'weapon')?.defId || '']; }
export function weaponBtList(hid: string): { lv: number; txt: string }[] {
  const p = equippedWeapon(hid)?.breakthrough;
  if (!p) return [];
  return Array.from({ length: 9 }, (_, i) => {
    const lv = (i + 1) * 10;
    return { lv, txt: `攻击+${Math.round(p.atk * 100)}%·技伤+${Math.round(p.skill * 100)}%`
      + (lv % 30 === 0 ? `\n${STAT_NAME[p.secondary]} +${statFmt(p.secondary, p.bonus)}` : '') };
  });
}
export function weaponBtAgg(hid: string, lv = heroState(hid).weaponLv) {
  const p = equippedWeapon(hid)?.breakthrough;
  const result = { atk: 0, skill: 0, atkSpd: 0, critRate: 0, critDmg: 0, chargeEff: 0 };
  if (p) {
    result.atk = Math.floor(lv / 10) * p.atk; result.skill = Math.floor(lv / 10) * p.skill;
    result[p.secondary] = Math.floor(lv / 30) * p.bonus;
  }
  return result;
}

/* ---------- 关卡难度（关卡页三档：普通/精英/地狱，逐一通关解锁） ---------- */
/** 难度战力倍率：出怪 hp/dmg 缩放（BattleDirector 按 flow.diff 注入 MonsterManager） */
export const DIFF_MUL = DIFFICULTIES.map(row => row.statMul);
/** 星级/宝箱存档键：普通用原键，精英/地狱加后缀（1-1 / 1-1e / 1-1h），各难度星级独立 */
export function starKey(levelId: string, diff: number): string {
  return levelId + (diff === 1 ? 'e' : diff === 2 ? 'h' : '');
}

/** 出售价：白100/绿400/蓝1500/紫5000 ×3^(tier-1)，强化等级小幅加成 */
export function sellPrice(e: EquipInst): number {
  if (WEAPONS[e.defId]?.starter) return 0;
  const base = [100, 400, 1500, 5000][EQUIPS[e.defId]?.quality ?? 0];
  return Math.round(base * Math.pow(3, (EQUIPS[e.defId]?.tier || 1) - 1) * (1 + (EQUIPS[e.defId]?.kind === 'weapon' ? 0 : e.lv - 1) * 0.1));
}

/* ================= 英雄配置 ================= */

export type HeroGrowthType = 'normal' | 'skill' | 'ultimate' | 'hybrid';
export const HERO_GROWTH: Record<HeroGrowthType, { name: string; atk: number; skill: number }> = {
  normal: { name: '普攻型', atk: 0.08, skill: 0.03 },
  skill: { name: '技能型', atk: 0.03, skill: 0.08 },
  ultimate: { name: '大招型', atk: 0.03, skill: 0.08 },
  hybrid: { name: '全能型', atk: 0.055, skill: 0.055 },
};
export interface HeroDef {
  id: string; name: string; job: string; avatar: string;
  baseAtk: number; baseSkillDmg: number; growthType: HeroGrowthType; atkSpd: number; story: string;
  weaponName: string; skillName: string; ultName: string;
  shopPrice: number; // 0=非卖品占位
}
export const HERO_DEFS: Record<string, HeroDef> = {
  archer: {
    id: 'archer', name: '艾拉·风羽', job: '弓手 · 远程输出', avatar: 'ui_avatar_archer',
    baseAtk: 45, baseSkillDmg: 100, growthType: 'normal', atkSpd: 1.2, weaponName: '风羽长弓', skillName: '穿透箭', ultName: '风暴之眼',
    story: '翠风游侠，自林间哨塔长大后守卫王国边陲。箭无虚发，风起时箭雨如歌。',
    shopPrice: 0,
  },
  sniper: {
    id: 'sniper', name: '凯尔·鹰眼', job: '狙击 · 重击输出', avatar: 'ui_avatar_sniper',
    baseAtk: 140, baseSkillDmg: 140, growthType: 'normal', atkSpd: 0.5, weaponName: '鹰眼重弩', skillName: '穿颅射击', ultName: '猎杀时刻',
    story: '前王国猎鹰团首席，一弩定音的沉默猎手。现为防线寻找每一发弩箭的价值。',
    shopPrice: 6800,
  },
  pyro: {
    id: 'pyro', name: '焰·辉', job: '火焰 · AOE 爆发', avatar: 'ui_avatar_pyro',
    baseAtk: 60, baseSkillDmg: 90, growthType: 'ultimate', atkSpd: 1, weaponName: '辉焰法杖', skillName: '烈焰爆裂', ultName: '陨石天降',
    story: '自灰烬火山走出的流浪法师，掌心蕴火。怪群愈密，他的火焰便烧得愈旺。',
    shopPrice: 0,
  },
  volt: {
    id: 'volt', name: '沃尔·雷霆', job: '雷电 · 连锁控制', avatar: 'ui_avatar_volt',
    baseAtk: 55, baseSkillDmg: 85, growthType: 'skill', atkSpd: 1, weaponName: '雷霆法杖', skillName: '连锁闪电', ultName: '天雷灭世',
    story: '在雷暴之夜被天雷选中的人，血液里奔流着风暴。他的闪电从不安分——总在敌群间跳跃。',
    shopPrice: 4200,
  },
  mora: {
    id: 'mora', name: '莫拉·寒霜', job: '冰霜 · 减速控制', avatar: 'ui_avatar_mora',
    baseAtk: 58, baseSkillDmg: 80, growthType: 'hybrid', atkSpd: 0.75, weaponName: '霜华法杖', skillName: '冰霜领域', ultName: '极寒领域',
    story: '北境冰原走出的年轻冰霜法师，能把空气里的水汽凝成利刃。她走过的地方，敌人都慢了下来。',
    shopPrice: 4800,
  },
};

/* ================= 编队（二级编队界面：4 上阵位；战斗按上阵顺序从左到右站位） ================= */

export const SQUAD_MAX = 4;

/** 当前编队（上阵顺序=站位从左到右）；过滤失效 id */
export function squadList(): string[] {
  return (loadSave().squad || []).filter(id => !!HERO_DEFS[id]);
}
export function inSquad(hid: string): boolean { return squadList().includes(hid); }

/** 上阵：已拥有英雄从左到右占第一个空位。 */
export function deployHero(hid: string): OpResult {
  if (!HERO_DEFS[hid]) return { ok: false, msg: '英雄不存在' };
  if (!loadSave().heroes[hid]?.owned) return { ok: false, msg: hid === 'pyro' ? '通关普通1-2免费获得火法师' : '请先解锁该英雄' };
  const sq = squadList();
  if (sq.includes(hid)) return { ok: false, msg: '该英雄已上阵' };
  if (sq.length >= SQUAD_MAX) return { ok: false, msg: '编队已满，请先下阵英雄' };
  const sv = loadSave();
  sv.squad = [...sq, hid];
  if (sv.heroes[hid]) sv.heroes[hid].owned = true;
  saveSave();
  return { ok: true, msg: `${HERO_DEFS[hid].name} 已上阵` };
}

/** 下阵（二次确认由 UI 层负责） */
export function undeployHero(hid: string): OpResult {
  const sq = squadList();
  if (!sq.includes(hid)) return { ok: false, msg: '该英雄未上阵' };
  loadSave().squad = sq.filter(x => x !== hid);
  saveSave();
  return { ok: true, msg: `${HERO_DEFS[hid].name} 已下阵` };
}

/* ================= 经济公式（数值默认值，校准只改这里） ================= */

const r10 = (v: number): number => Math.max(10, Math.round(v / 10) * 10);
export const MAX = { hero: 90, weapon: 90, skill: 20, equip: 20, keep: 10 };
/** 阶段性突破（用户确认节奏）：英雄/武器每 10 级、技能每 5 级一次属性跳升，跳升并入属性乘区 */
export const BT_STEP = { hero: 10, weapon: 10, skill: 5 };
export const BT_ATK = 0.10;   // 英雄每次突破：攻击与技能伤害基数 +10%
export const BT_SKL = 0.15;   // 技能每次突破：技能伤害 +15%
/** 已达成突破次数（等级每达 step 整倍数突破一次：lv10 → 1 次、lv90 → 9 次） */
export const btN = (lv: number, step: number): number => Math.max(0, Math.floor(lv / step));

/* ---------- 英雄阶段性突破（每英雄可配专属档位；未配置的英雄回退通用档） ---------- */
export interface HeroBtEff { atkPct?: number; skillPct?: number; aspdPct?: number; rangePct?: number; pierce?: number; defIgnore?: number; critDmg?: number; ultBolts?: number; ultAutoCd?: number; shockAmpMul?: number; shotsBonus?: number; skillProc?: number; ultStunBonus?: number; shockOnAtk?: number; burnMul?: number; explodeR?: number; vulnBonus?: number; burnOnAtk?: number; slowMul?: number; novaR?: number; freezeProc?: number; stunBonus?: number; slowOnAtk?: number; }
export interface HeroBt { lv: number; txt: string; eff: HeroBtEff; }
/** 弓箭手突破表（用户定稿：每 10 级一档 10~90） */
export const HERO_BT: Record<string, HeroBt[]> = {
  archer: [
    { lv: 10, txt: '突破 · 攻击力 +10%', eff: { atkPct: 0.10 } },
    { lv: 20, txt: '突破 · 攻速 +10%', eff: { aspdPct: 0.10 } },
    { lv: 30, txt: '突破 · 普攻5%概率射出强化箭', eff: { pierce: 0.05 } },
    { lv: 40, txt: '突破 · 技能伤害 +10%', eff: { skillPct: 0.10 } },
    { lv: 50, txt: '突破 · 普攻/技能索敌范围 +10%', eff: { rangePct: 0.10 } },
    { lv: 60, txt: '突破 · 强化箭概率 +10%（累计15%）', eff: { pierce: 0.10 } },
    { lv: 70, txt: '突破 · 攻击力 +15%', eff: { atkPct: 0.15 } },
    { lv: 80, txt: '突破 · 攻速 +10%', eff: { aspdPct: 0.10 } },
    { lv: 90, txt: '突破 · 无视25%防御力', eff: { defIgnore: 0.25 } },
  ],
  /** 重弩手（凯尔·鹰眼）突破表（用户定稿：每 10 级一档 10~90） */
  sniper: [
    { lv: 10, txt: '突破 · 攻击力 +15%', eff: { atkPct: 0.15 } },
    { lv: 20, txt: '突破 · 技能伤害 +15%', eff: { skillPct: 0.15 } },
    { lv: 30, txt: '突破 · 无视25%防御力', eff: { defIgnore: 0.25 } },
    { lv: 40, txt: '突破 · 普攻/技能索敌范围 +15%', eff: { rangePct: 0.15 } },
    { lv: 50, txt: '突破 · 暴击伤害 +40%', eff: { critDmg: 0.40 } },
    { lv: 60, txt: '突破 · 大招锁定目标 +1', eff: { ultBolts: 1 } },
    { lv: 70, txt: '突破 · 攻击力 +20%', eff: { atkPct: 0.20 } },
    { lv: 80, txt: '突破 · 技能伤害 +20%', eff: { skillPct: 0.20 } },
    { lv: 90, txt: '突破 · 每25秒自动释放一次大招（无需充能）', eff: { ultAutoCd: 25 } },
  ],
  /** 雷法师（沃尔·雷霆）突破表（用户定稿：每 10 级一档 10~90） */
  volt: [
    { lv: 10, txt: '突破 · 攻击力 +15%', eff: { atkPct: 0.15 } },
    { lv: 20, txt: '突破 · 技能伤害 +15%', eff: { skillPct: 0.15 } },
    { lv: 30, txt: '突破 · 感电加深：感电增伤 +25% → +35%', eff: { shockAmpMul: 1.4 } },
    { lv: 40, txt: '突破 · 普攻/技能索敌范围 +10%', eff: { rangePct: 0.10 } },
    { lv: 50, txt: '突破 · 攻速 +12%', eff: { aspdPct: 0.12 } },
    { lv: 60, txt: '突破 · 连锁闪电 +2 目标（累计 7）', eff: { shotsBonus: 2 } },
    { lv: 70, txt: '突破 · 普攻15%概率释放技能（不占用也不刷新冷却）', eff: { skillProc: 0.15 } },
    { lv: 80, txt: '突破 · 大招眩晕 +0.5s（累计 1.5s）', eff: { ultStunBonus: 0.5 } },
    { lv: 90, txt: '突破 · 雷霆之躯：普攻命中也感电（+25%·3s）', eff: { shockOnAtk: 0.25 } },
  ],
  /** 火法师（布洛克·火须）突破表（用户定稿：每 10 级一档 10~90） */
  pyro: [
    { lv: 10, txt: '突破 · 攻击力 +15%', eff: { atkPct: 0.15 } },
    { lv: 20, txt: '突破 · 技能伤害 +15%', eff: { skillPct: 0.15 } },
    { lv: 30, txt: '突破 · 火势加深：灼烧伤害 +50%', eff: { burnMul: 1.5 } },
    { lv: 40, txt: '突破 · 普攻/技能索敌范围 +10%', eff: { rangePct: 0.10 } },
    { lv: 50, txt: '突破 · 攻速 +12%', eff: { aspdPct: 0.12 } },
    { lv: 60, txt: '突破 · 烈焰溅射：普攻爆炸范围 +50%（60→90）', eff: { explodeR: 90 } },
    { lv: 70, txt: '突破 · 烈焰爆裂火球 +1 发（累计 4）', eff: { shotsBonus: 1 } },
    { lv: 80, txt: '突破 · 陨石坑易伤加深：25% → 35%', eff: { vulnBonus: 0.10 } },
    { lv: 90, txt: '突破 · 烈焰之躯：普攻命中也点燃（灼烧 30%·3s）', eff: { burnOnAtk: 0.3 } },
  ],
  /** 冰霜法师（莫拉·寒霜）突破表（定稿节奏：每 10 级一档 10~90） */
  mora: [
    { lv: 10, txt: '突破 · 攻击力 +15%', eff: { atkPct: 0.15 } },
    { lv: 20, txt: '突破 · 技能伤害 +15%', eff: { skillPct: 0.15 } },
    { lv: 30, txt: '突破 · 冰寒刺骨：减速 25% → 40%', eff: { slowMul: 1.6 } },
    { lv: 40, txt: '突破 · 普攻/技能索敌范围 +10%', eff: { rangePct: 0.10 } },
    { lv: 50, txt: '突破 · 攻速 +12%', eff: { aspdPct: 0.12 } },
    { lv: 60, txt: '突破 · 冰霜领域范围 +25%（150→190）', eff: { novaR: 190 } },
    { lv: 70, txt: '突破 · 普攻15%概率冰冻 0.6s', eff: { freezeProc: 0.6 } },
    { lv: 80, txt: '突破 · 冰霜领域冻结 +0.4s（累计 1.9s）', eff: { stunBonus: 0.4 } },
    { lv: 90, txt: '突破 · 冰寒之躯：普攻必定减速 40%', eff: { slowOnAtk: 0.4 } },
  ],
};
/** 未配专属表的英雄：通用档（攻击与技能伤害 +10%/次，等价旧版节奏） */
export function heroBtList(hid: string): HeroBt[] {
  if (HERO_BT[hid]) return HERO_BT[hid];
  return Array.from({ length: Math.floor(MAX.hero / BT_STEP.hero) }, (_, i) => ({
    lv: (i + 1) * BT_STEP.hero,
    txt: `突破 · 攻击与技能伤害 +${Math.round(BT_ATK * 100)}%`,
    eff: { atkPct: BT_ATK, skillPct: BT_ATK },
  }));
}
export interface HeroBtAgg { atkPct: number; skillPct: number; aspdPct: number; rangePct: number; pierce: number; defIgnore: number; critDmg: number; ultBolts: number; ultAutoCd: number; shockAmpMul: number; shotsBonus: number; skillProc: number; ultStunBonus: number; shockOnAtk: number; burnMul: number; explodeR: number; vulnBonus: number; burnOnAtk: number; slowMul: number; novaR: number; freezeProc: number; stunBonus: number; slowOnAtk: number; }
/** 已达成突破汇总（等级达档即生效；攻/技/攻速/范围进属性面板，贯穿/防穿进战斗） */
export function heroBtAgg(hid: string, lv: number): HeroBtAgg {
  const a: HeroBtAgg = { atkPct: 0, skillPct: 0, aspdPct: 0, rangePct: 0, pierce: 0, defIgnore: 0, critDmg: 0, ultBolts: 0, ultAutoCd: 0, shockAmpMul: 1, shotsBonus: 0, skillProc: 0, ultStunBonus: 0, shockOnAtk: 0, burnMul: 1, explodeR: 0, vulnBonus: 0, burnOnAtk: 0, slowMul: 1, novaR: 0, freezeProc: 0, stunBonus: 0, slowOnAtk: 0 };
  for (const m of heroBtList(hid)) {
    if (lv < m.lv) continue;
    a.atkPct += m.eff.atkPct || 0;
    a.skillPct += m.eff.skillPct || 0;
    a.aspdPct += m.eff.aspdPct || 0;
    a.rangePct += m.eff.rangePct || 0;
    a.pierce += m.eff.pierce || 0;
    a.defIgnore += m.eff.defIgnore || 0;
    a.critDmg += m.eff.critDmg || 0;
    a.ultBolts += m.eff.ultBolts || 0;
    a.ultAutoCd += m.eff.ultAutoCd || 0;
    a.shockAmpMul *= m.eff.shockAmpMul || 1;
    a.shotsBonus += m.eff.shotsBonus || 0;
    a.burnMul *= m.eff.burnMul || 1;
    a.explodeR = Math.max(a.explodeR, m.eff.explodeR || 0);
    a.vulnBonus += m.eff.vulnBonus || 0;
    a.burnOnAtk += m.eff.burnOnAtk || 0;
    a.slowMul *= m.eff.slowMul || 1;
    a.novaR = Math.max(a.novaR, m.eff.novaR || 0);
    a.freezeProc += m.eff.freezeProc || 0;
    a.stunBonus += m.eff.stunBonus || 0;
    a.slowOnAtk += m.eff.slowOnAtk || 0;
    a.skillProc += m.eff.skillProc || 0;
    a.ultStunBonus += m.eff.ultStunBonus || 0;
    a.shockOnAtk += m.eff.shockOnAtk || 0;
  }
  return a;
}
export const heroUpCost = (lv: number): number => r10(100 * Math.pow(lv, 1.35));   // 英雄升级只耗金币（用户确认）
export const weaponUpCost = (lv: number): { gold: number; mat: number } => ({ gold: r10(150 * Math.pow(lv, 1.4)), mat: 1 + Math.floor(lv / 5) });
export const skillUpCost = (lv: number): { gold: number; mat: number } => ({ gold: r10(200 * Math.pow(lv, 1.5)), mat: 1 + Math.floor(lv / 6) });   // 技能金币+材料（用户确认）
export const equipUpCost = (lv: number): { gold: number; mat: number } => ({ gold: r10(120 * Math.pow(lv, 1.4)), mat: 1 + Math.floor(lv / 7) });
export const keepUpCost = (lv: number): number => r10(500 * Math.pow(lv, 1.6));
/** 主城效果：基础1000耐久，每级+100；每3级+200盾 */
export const keepHp = (lv: number): number => 1000 + lv * 100;
export const keepShield = (lv: number): number => Math.floor(lv / 3) * 200;
/** 星箱一次性奖励 */
export const CHEST_REWARD = starChestRewards('1-1', 0);
export const CHEST_COND = ['成功通关', '50%血量通关', '完美通关'];

/* ================= 属性聚合 ================= */

export interface HeroStats {
  power: number; atk: number; atkSpd: number; skillDmg: number;
  lv: number; weaponLv: number; atkLv: number; skillLv: number; ultLv: number;
}

export function heroState(hid: string): HeroState { return loadSave().heroes[hid]; }

/** 实时聚合英雄属性（养成+穿戴词条全部汇入；英雄无生命——用户确认；战力=攻击+技能*0.5） */
export function heroStats(hid: string): HeroStats {
  const hs = heroState(hid);
  return heroStatsAt(hid, hs.lv, hs.weaponLv);
}

/** 养成预览与实战共用；技能槽等级只影响技能倍率，不再次乘进基础技能伤害。 */
export function heroStatsAt(hid: string, level: number, weaponLevel: number): HeroStats {
  const def = HERO_DEFS[hid];
  const hs = heroState(hid);
  const agg = equipAgg(hid, weaponLevel), wb = weaponBtAgg(hid, weaponLevel);
  const bt = heroBtAgg(hid, level), growth = HERO_GROWTH[def.growthType];
  const wpnMul = 1 + (weaponLevel - 1) * 0.06;
  const atk = Math.round((def.baseAtk * (1 + (level - 1) * growth.atk) * (1 + bt.atkPct) * wpnMul * (1 + wb.atk) + agg.atkFlat) * (1 + agg.atkPct));
  const skillDmg = Math.round(def.baseSkillDmg * (1 + (level - 1) * growth.skill) * (1 + bt.skillPct) * wpnMul * (1 + wb.skill)) + agg.skillDmgFlat;
  const skillAspd = hs.atkLv >= 5 ? 1.06 : 1;   // 普攻槽5级里程碑：攻速+6%（四英雄同构）
  return {
    power: Math.round(atk + skillDmg * 0.5),
    atk, atkSpd: Math.round(def.atkSpd * (1 + bt.aspdPct) * skillAspd * (1 + agg.atkSpd) * 100) / 100, skillDmg,
    lv: level, weaponLv: weaponLevel, atkLv: hs.atkLv, skillLv: hs.skillLv, ultLv: hs.ultLv,
  };
}

/* ================= 商店 ================= */

export type ShopTab = 'weapon' | 'hero' | 'equip' | 'mat';
export const SHOP_TABS: { key: ShopTab; name: string; cur: 'diamond' | 'gold' }[] = [
  { key: 'weapon', name: '武器', cur: 'diamond' },
  { key: 'hero', name: '英雄', cur: 'diamond' },
  { key: 'equip', name: '装备', cur: 'gold' },
  { key: 'mat', name: '材料', cur: 'gold' },
];
export interface ShopDef {
  id: string; tab: ShopTab; name: string; sub: string;
  price: number; currency: 'gold' | 'diamond'; unlock: string;
  /** 购买产物：装备 defId / 英雄 hid / 材料 matId×n */
  give: { kind: 'equip' | 'hero' | 'mat'; id: string; n?: number };
}
export const SHOP: ShopDef[] = [
  { id: 's_wpn_bow', tab: 'weapon', name: '猎风长弓', sub: '绿1阶 · 速射弓', price: 800, currency: 'diamond', unlock: '1-1', give: { kind: 'equip', id: 'wpn_bow' } },
  ...['wpn_green_crossbow', 'wpn_green_book', 'wpn_green_staff'].map(id => ({ id: 's_' + id, tab: 'weapon' as ShopTab, name: WEAPONS[id].name,
    sub: '绿1阶 · ' + weaponUsers(id), price: WEAPONS[id].price, currency: 'diamond' as const, unlock: WEAPONS[id].unlock, give: { kind: 'equip' as const, id } })),
  { id: 's_wpn_crossbow', tab: 'weapon', name: '鹰眼重弩', sub: '紫2阶 · 重击弩', price: 1200, currency: 'diamond', unlock: '1-2', give: { kind: 'equip', id: 'wpn_crossbow' } },
  ...Object.values(WEAPONS).filter(w => w.quality >= 2 && w.id !== 'wpn_crossbow').map(w => ({
    id: 's_' + w.id, tab: 'weapon' as ShopTab, name: w.name,
    sub: QNAME[w.quality] + w.tier + '阶 · ' + (w.focus || weaponUsers(w.id)),
    price: w.price, currency: 'diamond' as const, unlock: w.unlock, give: { kind: 'equip' as const, id: w.id },
  })),
  { id: 's_hero_sniper', tab: 'hero', name: '凯尔·鹰眼', sub: '狙击 · 重击输出', price: 6800, currency: 'diamond', unlock: '1-2', give: { kind: 'hero', id: 'sniper' } },
  { id: 's_hero_pyro', tab: 'hero', name: '焰·辉', sub: '通关普通1-2免费获得', price: 0, currency: 'diamond', unlock: '1-2', give: { kind: 'hero', id: 'pyro' } },
  { id: 's_hero_volt', tab: 'hero', name: '沃尔·雷霆', sub: '雷电 · 连锁控制', price: 4200, currency: 'diamond', unlock: '1-3', give: { kind: 'hero', id: 'volt' } },
  { id: 's_hero_mora', tab: 'hero', name: '莫拉·寒霜', sub: '冰霜 · 减速控制', price: 4800, currency: 'diamond', unlock: '1-3', give: { kind: 'hero', id: 'mora' } },
  { id: 's_hero_more', tab: 'hero', name: '新英雄', sub: '敬请期待', price: 0, currency: 'diamond', unlock: '', give: { kind: 'hero', id: '' } },
  { id: 's_helm_falcon', tab: 'equip', name: '猎鹰头盔', sub: '蓝1阶 · 头盔', price: 600, currency: 'gold', unlock: '1-1', give: { kind: 'equip', id: 'helm_falcon' } },
  { id: 's_acc_moon', tab: 'equip', name: '月纹坠饰', sub: '绿1阶 · 饰品', price: 300, currency: 'gold', unlock: '1-1', give: { kind: 'equip', id: 'acc_moon' } },
  { id: 's_glove_wind', tab: 'equip', name: '疾风手套', sub: '白3阶 · 手套', price: 900, currency: 'gold', unlock: '1-1', give: { kind: 'equip', id: 'glove_wind' } },
  { id: 's_armor_forest', tab: 'equip', name: '林语皮甲', sub: '紫1阶 · 衣服', price: 2400, currency: 'gold', unlock: '1-2', give: { kind: 'equip', id: 'armor_forest' } },
  { id: 's_mat_stone', tab: 'mat', name: '强化石', sub: '强化必需', price: 50, currency: 'gold', unlock: '1-1', give: { kind: 'mat', id: 'mat_stone', n: 1 } },
  { id: 's_mat_iron', tab: 'mat', name: '精铁锭', sub: '高阶强化', price: 80, currency: 'gold', unlock: '1-1', give: { kind: 'mat', id: 'mat_iron', n: 1 } },
  { id: 's_mat_dust', tab: 'mat', name: '魔法尘', sub: '附魔基底', price: 120, currency: 'gold', unlock: '1-2', give: { kind: 'mat', id: 'mat_dust', n: 1 } },
  { id: 's_mat_rune', tab: 'mat', name: '符文碎片', sub: '稀有材料', price: 200, currency: 'gold', unlock: '1-2', give: { kind: 'mat', id: 'mat_rune', n: 1 } },
];

/** 关卡顺序表（解锁比较用） */
const LV_ORDER = CAMPAIGN_LEVEL_IDS;
export function lvReached(unlock: string): boolean {
  if (!unlock) return true;
  const sv = loadSave();
  if (LV_ORDER.indexOf(unlock) < 0) return false;   // 未实装关卡恒锁（商店解锁只允许引用 LV_ORDER 内关卡）
  return LV_ORDER.indexOf(sv.unlocked) >= LV_ORDER.indexOf(unlock);
}

/** 通关推进主线解锁（sv.unlocked = 已通关的最远关卡；商店/关卡页解锁共用） */
export function advanceUnlock(id: string): void {
  const sv = loadSave();
  if (LV_ORDER.indexOf(id) > LV_ORDER.indexOf(sv.unlocked)) {
    sv.unlocked = id;
    saveSave();
  }
}

/* ================= 操作（全部即时写档） ================= */

export type OpResult = { ok: true; msg: string } | { ok: false; msg: string };

let uidSeq = 1;
export function newEquipInst(defId: string): EquipInst {
  return { uid: 'e' + Date.now().toString(36) + '_' + (uidSeq++), defId, lv: 1 };
}

/** 商店购买（英雄=解锁；装备入仓库；材料入背包） */
export function shopBuy(g: ShopDef): OpResult {
  const sv = loadSave();
  // Includes stale callers carrying the former diamond price. The hero comes from victory only.
  if (g.give.kind === 'hero' && g.give.id === 'pyro') return { ok: false, msg: sv.heroes.pyro.owned ? '已拥有该英雄' : '通关普通1-2免费获得火法师' };
  if (g.give.kind === 'hero' && g.give.id && sv.heroes[g.give.id]?.owned) return { ok: false, msg: '已拥有该英雄' };
  if (!lvReached(g.unlock)) return { ok: false, msg: '通关 ' + g.unlock + ' 后解锁购买' };
  const wallet = g.currency === 'gold' ? sv.gold : sv.diamonds;
  if (wallet < g.price) return { ok: false, msg: g.currency === 'gold' ? '金币不足' : '钻石不足' };
  if (g.currency === 'gold') sv.gold -= g.price; else sv.diamonds -= g.price;
  if (g.give.kind === 'equip') {
    const inst = newEquipInst(g.give.id);
    // 买到的装备若当前英雄对应槽位为空则直接穿上，否则入仓库（英雄页背包可再穿戴）
    const d = EQUIPS[g.give.id];
    const cur = sv.heroes[sv.curHero];
    if (d && cur?.owned && !cur.worn[d.kind] && (d.kind !== 'weapon' || weaponFits(sv.curHero, d.id))) cur.worn[d.kind] = inst.uid;
    sv.equips.push(inst);
  } else if (g.give.kind === 'hero' && g.give.id) {
    if (!sv.heroes[g.give.id]) sv.heroes[g.give.id] = { owned: true, lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
    sv.heroes[g.give.id].owned = true;
    sv.curHero = g.give.id;
  } else if (g.give.kind === 'mat') {
    sv.bag[g.give.id] = (sv.bag[g.give.id] || 0) + (g.give.n || 1);
  }
  saveSave();
  return { ok: true, msg: '购买成功：' + g.name };
}

/** 背包材料数量 */
export function matCount(id: string): number { return loadSave().bag[id] || 0; }
/** 扣材料（不足返回 false） */
export function spendMat(n: number): boolean {
  const sv = loadSave();
  // 强化消耗聚合扣强化石（稀有度递进：石不足时尝试精铁）
  if ((sv.bag.mat_stone || 0) >= n) { sv.bag.mat_stone -= n; return true; }
  const need = n - (sv.bag.mat_stone || 0);
  if ((sv.bag.mat_iron || 0) >= need) { sv.bag.mat_stone = 0; sv.bag.mat_iron -= need; return true; }
  return false;
}

/** 穿戴：指定槽位装上仓库里的装备实例（原装备回仓库） */
export function wearEquip(hid: string, kind: EquipKind, uid: string): OpResult {
  const sv = loadSave();
  const h = sv.heroes[hid], inst = sv.equips.find(e => e.uid === uid), d = inst && EQUIPS[inst.defId];
  if (!h?.owned || !inst || !d || d.kind !== kind) return { ok: false, msg: '无法穿戴该装备' };
  if (kind === 'weapon' && !weaponFits(hid, d.id)) return { ok: false, msg: weaponUsers(d.id) };
  if (Object.keys(sv.heroes).some(id => id !== hid && Object.values(sv.heroes[id].worn).includes(uid))) return { ok: false, msg: '其他英雄正在穿戴该装备' };
  sv.heroes[hid].worn[kind] = uid;
  saveSave();
  return { ok: true, msg: d.name + ' 已装备' };
}
export function takeOff(hid: string, kind: EquipKind): OpResult {
  if (kind === 'weapon') return { ok: false, msg: '英雄必须装备武器，请在背包中直接替换' };
  const sv = loadSave();
  sv.heroes[hid].worn[kind] = undefined;
  saveSave();
  return { ok: true, msg: '装备已卸下' };
}
export function wornInst(hid: string, kind: EquipKind): EquipInst | null {
  const uid = loadSave().heroes[hid]?.worn[kind];
  return uid ? (loadSave().equips.find(q => q.uid === uid) || null) : null;
}

/** 出售仓库装备实例 */
export function sellEquip(uid: string): OpResult {
  const sv = loadSave();
  const i = sv.equips.findIndex(q => q.uid === uid);
  if (i < 0) return { ok: false, msg: '物品不存在' };
  const e = sv.equips[i];
  if (WEAPONS[e.defId]?.starter) return { ok: false, msg: '初始武器保留在背包中，不可出售' };
  if (Object.values(sv.heroes).some(h => Object.values(h.worn).includes(uid))) return { ok: false, msg: EQUIPS[e.defId]?.kind === 'weapon' ? '正在装备，请先替换为其他武器' : '已穿戴中，请先卸下' };
  const gold = sellPrice(e);
  sv.equips.splice(i, 1);
  sv.gold += gold;
  saveSave();
  return { ok: true, msg: `出售成功 +${gold} 金币` };
}

/** 英雄升级（金币） */
export function upHero(hid: string): OpResult {
  const sv = loadSave();
  const h = sv.heroes[hid];
  if (h.lv >= MAX.hero) return { ok: false, msg: '已达等级上限' };
  const cost = heroUpCost(h.lv);
  if (sv.gold < cost) return { ok: false, msg: '金币不足' };
  sv.gold -= cost;
  h.lv++;
  saveSave();
  return { ok: true, msg: `等级提升至 Lv.${h.lv}` };
}

/** 武器强化（金币+材料，强化该英雄武器乘区） */
export function upWeapon(hid: string): OpResult {
  const sv = loadSave();
  const h = sv.heroes[hid];
  if (h.weaponLv >= MAX.weapon) return { ok: false, msg: '武器已达上限' };
  const c = weaponUpCost(h.weaponLv);
  if (sv.gold < c.gold) return { ok: false, msg: '金币不足' };
  if (!spendMat(c.mat)) return { ok: false, msg: '强化材料不足' };
  sv.gold -= c.gold;
  h.weaponLv++;
  saveSave();
  return { ok: true, msg: `武器强化至 Lv.${h.weaponLv}` };
}

/** 技能升级（slot: atk/skill/ult，金币+材料——用户确认） */
export function upSkill(hid: string, slot: 'atk' | 'skill' | 'ult'): OpResult {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const key = slot === 'atk' ? 'atkLv' : slot === 'skill' ? 'skillLv' : 'ultLv';
  if (h[key] >= MAX.skill) return { ok: false, msg: '已达等级上限' };
  const c = skillUpCost(h[key]);
  if (sv.gold < c.gold) return { ok: false, msg: '金币不足' };
  if (!spendMat(c.mat)) return { ok: false, msg: '强化材料不足' };
  sv.gold -= c.gold;
  h[key]++;
  saveSave();
  return { ok: true, msg: '技能升级成功' };
}

/** 已穿戴装备强化（金币+材料） */
export function upWornEquip(hid: string, kind: EquipKind): OpResult {
  if (kind === 'weapon') return upWeapon(hid);
  const e = wornInst(hid, kind);
  if (!e) return { ok: false, msg: '该槽位未穿戴' };
  if (e.lv >= MAX.equip) return { ok: false, msg: '已达强化上限' };
  const sv = loadSave();
  const c = equipUpCost(e.lv);
  if (sv.gold < c.gold) return { ok: false, msg: '金币不足' };
  if (!spendMat(c.mat)) return { ok: false, msg: '强化材料不足' };
  sv.gold -= c.gold;
  e.lv++;
  saveSave();
  return { ok: true, msg: `${KIND_NAME[kind]}强化至 Lv.${e.lv}` };
}

/** 主城升级 */
export function upKeep(): OpResult {
  const sv = loadSave();
  if (sv.keepLv >= MAX.keep) return { ok: false, msg: '主城已达上限' };
  const cost = keepUpCost(sv.keepLv);
  if (sv.gold < cost) return { ok: false, msg: '金币不足' };
  sv.gold -= cost;
  sv.keepLv++;
  saveSave();
  return { ok: true, msg: `主城升至 Lv.${sv.keepLv}` };
}

/** Actual credited values are returned for presentation; popup animations never grant currency. */
export type ChestClaimResult = { ok: true; msg: string; gold: number; diamonds: number;
  chestCount: number; fromTier: number; toTier: number } | { ok: false; msg: string };

/** Claim every currently earned chest for one level/difficulty, using persisted stars. */
export function claimAllChests(levelId: string): ChestClaimResult {
  const earned = loadSave().stars[levelId] || 0;
  const tier = Math.max(0, Math.min(3, Math.floor(Number.isFinite(earned) ? earned : 0)));
  if (!tier) return { ok: false, msg: '当前关卡尚无可领取的宝箱' };
  return claimChest(levelId, tier, tier);
}

/** 领星箱奖励（一次性，按已达星数逐档领取到 claimed） */
export function claimChest(levelId: string, stars: number, tier: number): ChestClaimResult {
  const sv = loadSave();
  if (!Number.isInteger(tier) || tier < 1 || tier > 3) return { ok: false, msg: '无效的奖励档位' };
  const got = sv.chestClaimed[levelId] || 0;
  if (tier <= got) return { ok: false, msg: '该档奖励已领取' };
  if (Math.min(stars, sv.stars[levelId] || 0) < tier) return { ok: false, msg: '尚未达成：' + CHEST_COND[tier - 1] };
  const suffix = levelId.slice(-1), difficulty = suffix === 'e' ? 1 : suffix === 'h' ? 2 : 0;
  const baseId = difficulty ? levelId.slice(0, -1) : levelId;
  if (!CAMPAIGN_LEVEL_IDS.includes(baseId)) return { ok: false, msg: '无效的关卡奖励' };
  const rewards = starChestRewards(baseId, difficulty);
  let gold = 0, diamonds = 0;
  // The save stores the highest claimed tier. Include every unclaimed lower tier when skipping ahead.
  for (let i = got; i < tier; i++) { gold += rewards[i].gold || 0; diamonds += rewards[i].diamonds || 0; }
  sv.chestClaimed[levelId] = tier;
  sv.gold += gold; sv.diamonds += diamonds;
  saveSave();
  const msg = [gold ? `+${gold} 金币` : '', diamonds ? `+${diamonds} 钻石` : ''].filter(Boolean).join('、');
  return { ok: true, msg: '领取成功 ' + msg, gold, diamonds, chestCount: tier - got, fromTier: got + 1, toTier: tier };
}

/* ================= 怪物图鉴 ================= */

export interface CodexDef { id: string; name: string; icon: string; tags: [string, string]; desc: string; traits: string[]; weak: string; }
export const CODEX: CodexDef[] = [
  { id: 'goblin_worker', name: '哥布林苦工', icon: '👺', tags: ['小型', '近战'], desc: '成群结队冲向防线的近战单位，威胁在于数量。', traits: ['成群结队冲锋', '近战围攻防线', '单体威胁不高'], weak: '范围伤害（炮手/火法）' },
  { id: 'goblin_slinger', name: '哥布林投石手', icon: '🎯', tags: ['小型', '远程'], desc: '远程投掷石块，会躲在近战身后输出。', traits: ['远程投石攻击', '躲在近战身后', '血量偏低'], weak: '快速击杀（弓手/狙击）' },
  { id: 'goblin_shaman', name: '哥布林萨满', icon: '🔮', tags: ['小型', '辅助'], desc: '治疗友军，优先击杀目标。', traits: ['持续治疗友军', '辅助型怪种', '务必优先击杀'], weak: '集火秒杀（狙击大招）' },
  { id: 'wolf_rider', name: '狼骑兵', icon: '🐺', tags: ['中型', '骑兵'], desc: '高速冲锋，很快接近防线。', traits: ['移动速度极快', '迅速接近防线', '血量中等'], weak: '减速控制（冰法）' },
  { id: 'goblin_brute', name: '大哥布林（精英）', icon: '👹', tags: ['大型', '精英'], desc: '血厚攻高的精英，击杀有装备掉落。', traits: ['血厚攻高', '精英级怪种', '击杀掉落装备'], weak: '持续输出 + 控场' },
  { id: 'goblin_king', name: '哥布林王（BOSS）', icon: '👑', tags: ['大型', 'BOSS'], desc: '第一章第五关与第十关的首领，率领部队缓慢推进并近战攻击防线。', traits: ['第五关与第十关首领', '大型近战，血量厚重', '免疫冰封'], weak: '持续集火与大招爆发' },
];
/** 图鉴首览奖励：每只怪物首次点开词条可领一次（钻石） */
export const CODEX_REWARD = 20;
export function codexUnlocked(id: string): boolean { return loadSave().codex.includes(id); }
export function codexClaimed(id: string): boolean { return loadSave().codexRewards.includes(id); }
/** 首次查看图鉴领取奖励（每只怪物一次性） */
export function claimCodexReward(id: string): { ok: boolean; msg: string } {
  const sv = loadSave();
  if (!sv.codex.includes(id)) return { ok: false, msg: '尚未解锁该图鉴' };
  if (sv.codexRewards.includes(id)) return { ok: false, msg: '该奖励已领取' };
  sv.codexRewards.push(id);
  sv.diamonds += CODEX_REWARD;
  saveSave();
  return { ok: true, msg: `首览奖励 +${CODEX_REWARD} 钻石` };
}
/** 战斗首次遇到新怪 → 解锁图鉴（返回 true 表示新解锁，供 toast） */
export function unlockCodex(id: string): boolean {
  const sv = loadSave();
  if (sv.codex.includes(id)) return false;
  sv.codex.push(id);
  saveSave();
  return true;
}
