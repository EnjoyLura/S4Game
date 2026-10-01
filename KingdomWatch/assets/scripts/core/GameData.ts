/**
 * 五主界面数据层（§主界面需求清单）：物品/商店/英雄配置 + 经济公式 + 背包穿戴养成操作
 * 掉落与购买共用同一物品定义；数值默认值见 docs/主界面需求清单.md（实施时校准只动这张表）
 */
import { loadSave, saveSave, EquipInst, HeroState } from './SaveData';

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

/** 装备/武器模板（商店购买/掉落按此实例化） */
export interface EquipDef {
  id: string; name: string; kind: EquipKind; quality: Quality; tier: number;
  /** 主属性值（lv1 基础；阶级每+1 属性×1.8） */
  atk: number; hp: number;
  price: number; unlock: string; // 商店价/解锁关卡
}
export const EQUIPS: Record<string, EquipDef> = {
  wpn_bow: { id: 'wpn_bow', name: '猎风长弓', kind: 'weapon', quality: 1, tier: 1, atk: 24, hp: 0, price: 800, unlock: '1-1' },
  wpn_crossbow: { id: 'wpn_crossbow', name: '鹰眼重弩', kind: 'weapon', quality: 3, tier: 2, atk: 46, hp: 0, price: 1200, unlock: '1-2' },
  helm_falcon: { id: 'helm_falcon', name: '猎鹰头盔', kind: 'helm', quality: 2, tier: 1, atk: 0, hp: 60, price: 600, unlock: '1-1' },
  acc_moon: { id: 'acc_moon', name: '月纹坠饰', kind: 'acc', quality: 1, tier: 1, atk: 8, hp: 30, price: 300, unlock: '1-1' },
  glove_wind: { id: 'glove_wind', name: '疾风手套', kind: 'glove', quality: 0, tier: 3, atk: 12, hp: 20, price: 900, unlock: '1-2' },
  armor_forest: { id: 'armor_forest', name: '林语皮甲', kind: 'armor', quality: 3, tier: 1, atk: 0, hp: 140, price: 2400, unlock: '1-2' },
};

export function isEquip(id: string): boolean { return !!EQUIPS[id]; }
export function isMat(id: string): boolean { return !!MATS[id]; }
export function itemName(id: string): string { return EQUIPS[id]?.name || MATS[id]?.name || id; }
/** 阶级系数：tier 每 +1 属性×1.8、售价×3 */
export function tierMul(tier: number): number { return Math.pow(1.8, tier - 1); }
export function equipAtk(e: EquipInst): number { return Math.round((EQUIPS[e.defId]?.atk || 0) * tierMul(EQUIPS[e.defId]?.tier || 1) * (1 + (e.lv - 1) * 0.04)); }
export function equipHp(e: EquipInst): number { return Math.round((EQUIPS[e.defId]?.hp || 0) * tierMul(EQUIPS[e.defId]?.tier || 1) * (1 + (e.lv - 1) * 0.04)); }
/** 出售价：白100/绿400/蓝1500/紫5000 ×3^(tier-1)，强化等级小幅加成 */
export function sellPrice(e: EquipInst): number {
  const base = [100, 400, 1500, 5000][EQUIPS[e.defId]?.quality ?? 0];
  return Math.round(base * Math.pow(3, (EQUIPS[e.defId]?.tier || 1) - 1) * (1 + (e.lv - 1) * 0.1));
}

/* ================= 英雄配置 ================= */

export interface HeroDef {
  id: string; name: string; job: string; avatar: string;
  baseAtk: number; atkSpd: number; story: string;
  weaponName: string; skillName: string; ultName: string;
  shopPrice: number; // 0=非卖品占位
}
export const HERO_DEFS: Record<string, HeroDef> = {
  archer: {
    id: 'archer', name: '艾拉·风羽', job: '弓手 · 远程输出', avatar: 'ui_avatar_archer',
    baseAtk: 100, atkSpd: 1.2, weaponName: '风羽长弓', skillName: '穿透箭', ultName: '风暴之眼',
    story: '翠风游侠，自林间哨塔长大后守卫王国边陲。箭无虚发，风起时箭雨如歌。',
    shopPrice: 0,
  },
  sniper: {
    id: 'sniper', name: '凯尔·鹰眼', job: '狙击 · 重击输出', avatar: 'ui_avatar_sniper',
    baseAtk: 140, atkSpd: 0.6, weaponName: '鹰眼重弩', skillName: '穿颅射击', ultName: '猎杀时刻',
    story: '前王国猎鹰团首席，一弩定音的沉默猎手。现为防线寻找每一发弩箭的价值。',
    shopPrice: 6800,
  },
};

/* ================= 经济公式（数值默认值，校准只改这里） ================= */

const r10 = (v: number): number => Math.max(10, Math.round(v / 10) * 10);
export const MAX = { hero: 30, weapon: 20, skill: 10, equip: 20, keep: 10 };
export const heroUpCost = (lv: number): number => r10(100 * Math.pow(lv, 1.35));
export const weaponUpCost = (lv: number): { gold: number; mat: number } => ({ gold: r10(150 * Math.pow(lv, 1.4)), mat: 1 + Math.floor(lv / 5) });
export const skillUpCost = (lv: number): number => r10(200 * Math.pow(lv, 1.5));
export const equipUpCost = (lv: number): { gold: number; mat: number } => ({ gold: r10(120 * Math.pow(lv, 1.4)), mat: 1 + Math.floor(lv / 7) });
export const keepUpCost = (lv: number): number => r10(500 * Math.pow(lv, 1.6));
/** 主城效果：基础1000耐久，每级+100；每3级+200盾 */
export const keepHp = (lv: number): number => 1000 + lv * 100;
export const keepShield = (lv: number): number => Math.floor(lv / 3) * 200;
/** 星箱一次性奖励 */
export const CHEST_REWARD = [ { gold: 200 }, { diamonds: 60 }, { diamonds: 150 } ];
export const CHEST_COND = ['成功通关', '50%血量通关', '完美通关'];

/* ================= 属性聚合 ================= */

export interface HeroStats {
  power: number; atk: number; atkSpd: number; skillDmg: number; hp: number;
  lv: number; weaponLv: number; atkLv: number; skillLv: number; ultLv: number;
}

export function heroState(hid: string): HeroState { return loadSave().heroes[hid]; }

/** 实时聚合英雄属性（养成加成全部汇入，战力=攻击+技能*0.5+生命*0.05） */
export function heroStats(hid: string): HeroStats {
  const def = HERO_DEFS[hid];
  const hs = heroState(hid);
  const wornAtk = Object.values(hs.worn).reduce((a, uid) => {
    const inst = loadSave().equips.find(q => q.uid === uid);
    return a + (inst ? equipAtk(inst) : 0);
  }, 0);
  const wornHp = Object.values(hs.worn).reduce((a, uid) => {
    const inst = loadSave().equips.find(q => q.uid === uid);
    return a + (inst ? equipHp(inst) : 0);
  }, 0);
  const lvMul = 1 + (hs.lv - 1) * 0.08;
  const wpnMul = 1 + (hs.weaponLv - 1) * 0.06;
  const atk = Math.round(def.baseAtk * lvMul * wpnMul + wornAtk);
  const skillDmg = Math.round(atk * (1 + (hs.skillLv - 1) * 0.10) * (1 + (hs.lv - 1) * 0.05));
  const hp = 600 + wornHp + hs.lv * 20;
  return {
    power: Math.round(atk + skillDmg * 0.5 + hp * 0.05),
    atk, atkSpd: def.atkSpd, skillDmg, hp,
    lv: hs.lv, weaponLv: hs.weaponLv, atkLv: hs.atkLv, skillLv: hs.skillLv, ultLv: hs.ultLv,
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
  { id: 's_wpn_crossbow', tab: 'weapon', name: '鹰眼重弩', sub: '紫2阶 · 重击弩', price: 1200, currency: 'diamond', unlock: '1-2', give: { kind: 'equip', id: 'wpn_crossbow' } },
  { id: 's_hero_sniper', tab: 'hero', name: '凯尔·鹰眼', sub: '狙击 · 重击输出', price: 6800, currency: 'diamond', unlock: '1-5', give: { kind: 'hero', id: 'sniper' } },
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
const LV_ORDER = ['1-1', '1-2', '1-3', '1-4', '1-5'];
export function lvReached(unlock: string): boolean {
  if (!unlock) return true;
  const sv = loadSave();
  return LV_ORDER.indexOf(sv.unlocked) >= LV_ORDER.indexOf(unlock);
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
  if (g.give.kind === 'hero' && g.give.id && sv.heroes[g.give.id]?.owned) return { ok: false, msg: '已拥有该英雄' };
  const wallet = g.currency === 'gold' ? sv.gold : sv.diamonds;
  if (wallet < g.price) return { ok: false, msg: g.currency === 'gold' ? '金币不足' : '钻石不足' };
  if (g.currency === 'gold') sv.gold -= g.price; else sv.diamonds -= g.price;
  if (g.give.kind === 'equip') {
    sv.equips.push(newEquipInst(g.give.id));
  } else if (g.give.kind === 'hero' && g.give.id) {
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
export function wearEquip(hid: string, kind: EquipKind, uid: string): void {
  const sv = loadSave();
  sv.heroes[hid].worn[kind] = uid;
  saveSave();
}
export function takeOff(hid: string, kind: EquipKind): void {
  const sv = loadSave();
  sv.heroes[hid].worn[kind] = undefined;
  saveSave();
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
  if (Object.values(sv.heroes).some(h => Object.values(h.worn).includes(uid))) return { ok: false, msg: '已穿戴中，请先卸下' };
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

/** 技能升级（slot: atk/skill/ult，金币） */
export function upSkill(hid: string, slot: 'atk' | 'skill' | 'ult'): OpResult {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const key = slot === 'atk' ? 'atkLv' : slot === 'skill' ? 'skillLv' : 'ultLv';
  if (h[key] >= MAX.skill) return { ok: false, msg: '已达等级上限' };
  const cost = skillUpCost(h[key]);
  if (sv.gold < cost) return { ok: false, msg: '金币不足' };
  sv.gold -= cost;
  h[key]++;
  saveSave();
  return { ok: true, msg: '技能升级成功' };
}

/** 已穿戴装备强化（金币+材料） */
export function upWornEquip(hid: string, kind: EquipKind): OpResult {
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

/** 领星箱奖励（一次性，按已达星数逐档领取到 claimed） */
export function claimChest(levelId: string, stars: number, tier: number): OpResult {
  const sv = loadSave();
  const got = sv.chestClaimed[levelId] || 0;
  if (tier <= got) return { ok: false, msg: '该档奖励已领取' };
  if (stars < tier) return { ok: false, msg: '尚未达成：' + CHEST_COND[tier - 1] };
  sv.chestClaimed[levelId] = tier;
  const rw = CHEST_REWARD[tier - 1];
  if (rw.gold) sv.gold += rw.gold;
  if (rw.diamonds) sv.diamonds += rw.diamonds;
  saveSave();
  const msg = rw.gold ? `+${rw.gold} 金币` : `+${rw.diamonds} 钻石`;
  return { ok: true, msg: '领取成功 ' + msg };
}

/* ================= 怪物图鉴 ================= */

export interface CodexDef { id: string; name: string; desc: string; weak: string; }
export const CODEX: CodexDef[] = [
  { id: 'goblin_worker', name: '哥布林苦工', desc: '成群结队冲向防线的近战单位，威胁在于数量。', weak: '范围伤害（炮手/火法）' },
  { id: 'goblin_slinger', name: '哥布林投石手', desc: '远程投掷石块，会躲在近战身后输出。', weak: '快速击杀（弓手/狙击）' },
  { id: 'goblin_shaman', name: '哥布林萨满', desc: '治疗友军，优先击杀目标。', weak: '集火秒杀（狙击大招）' },
  { id: 'wolf_rider', name: '狼骑兵', desc: '高速冲锋，很快接近防线。', weak: '减速控制（冰法）' },
  { id: 'goblin_brute', name: '大哥布林（精英）', desc: '血厚攻高的精英，击杀有装备掉落。', weak: '持续输出 + 控场' },
  { id: 'goblin_king', name: '哥布林王（BOSS）', desc: '第一章 BOSS，召唤苦工并狂暴冲锋。', weak: '大招爆发窗口' },
];
export function codexUnlocked(id: string): boolean { return loadSave().codex.includes(id); }
/** 战斗首次遇到新怪 → 解锁图鉴（返回 true 表示新解锁，供 toast） */
export function unlockCodex(id: string): boolean {
  const sv = loadSave();
  if (sv.codex.includes(id)) return false;
  sv.codex.push(id);
  saveSave();
  return true;
}
