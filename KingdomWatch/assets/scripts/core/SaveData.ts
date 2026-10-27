/**
 * 主存档（§12.5：localStorage JSON；写档时机=结算/选卡后/养成变更）
 * M0 子集：货币、关卡进度、倍速解锁、Debug 开关
 * 五主界面扩展：背包/装备实例/英雄养成/主城等级/星箱领取/图鉴（老档缺键走 DEFAULTS 迁移）
 */
import { STARTER_WEAPON, weaponFits } from '../config/Weapons';
import { EARLY_FIRST_WIN_GOLD } from '../config/EarlyEconomy';
const KEY = 'kw_save_v1';

/** 装备/武器实例（掉落与商店共用物品表定义，实例持有强化等级） */
export interface EquipInst {
  uid: string;
  defId: string;
  lv: number;
}

/** 英雄养成状态 */
export interface HeroState {
  owned: boolean;
  lv: number;
  weaponLv: number;
  /** 普攻/技能/大招等级（上限10） */
  atkLv: number;
  skillLv: number;
  ultLv: number;
  /** 已穿戴装备 uid（武器/头盔/饰品/手套/衣服） */
  worn: Record<string, string | undefined>;
}

export interface SaveData {
  /** Independent highest cleared floor for each chapter's endless challenge. */
  endless?: { version: 1; best: Record<string, number> };
  /** Versioned first-session teaching; missing on an old save never opts it in. */
  firstJourney?: FirstJourney;
  secondJourney?: SecondJourney;
  thirdJourney?: ThirdJourney;
  fifthRewards?: { version: 1; claimed: boolean; uids?: string[] };
  earlyGold?: { version: 1; claimed: Record<string, boolean> };
  gold: number;
  diamonds: number;
  /** 星数表：'1-1' -> 1~3 */
  stars: Record<string, number>;
  /** 解锁到的关卡 id */
  unlocked: string;
  /** 通关 1-2 解锁 2x 倍速（§3.0） */
  speedUnlocked: boolean;
  music: boolean;
  /** Last chapter shown on the campaign page; also selects music throughout the lobby. */
  viewedChapter?: number;
  sfx: boolean;
  debug: boolean;
  /** GM 开关：技能无冷却（调试用，旧档缺省视为关） */
  gmNoSkillCd?: boolean;
  /** GM 开关：大招常满能量（调试用，旧档缺省视为关） */
  gmUltFull?: boolean;
  /* ---------- 五主界面扩展 ---------- */
  /** 材料背包：物品id -> 数量 */
  bag: Record<string, number>;
  /** 装备/武器实例仓库（含已穿戴） */
  equips: EquipInst[];
  /** 英雄养成（键=英雄id） */
  heroes: Record<string, HeroState>;
  /** 当前查看英雄 */
  curHero: string;
  /** 编队上阵顺序（从左到右=战斗站位序；允许空，战斗侧兜底） */
  squad: string[];
  /** 主城等级（上限10） */
  keepLv: number;
  /** 星箱领取记录：关卡id -> 已领最高档（0=未领） */
  chestClaimed: Record<string, number>;
  /** 已解锁怪物图鉴 */
  codex: string[];
  /** 已领取首览奖励的图鉴 id（每只怪物一次性） */
  codexRewards: string[];
  weaponSystemVersion?: number;
}

export interface ThirdJourney {
  version: 1;
  enabled: boolean;
  skipped: boolean;
  battleDone: boolean;
  freeChargeUsed: boolean;
  ultCast: boolean;
  rewardClaimed: boolean;
  rewardUid?: string;
}

export interface SecondJourney {
  version: 1;
  enabled: boolean;
  skipped: boolean;
  upgradeDone: boolean;
  upgradeSkipped: boolean;
  /** Optional for v40 saves: complete only after entering normal 1-2 successfully. */
  entryDone?: boolean;
  entrySkipped?: boolean;
  battleDone: boolean;
  freeChargeUsed: boolean;
  ultCast: boolean;
  rewardClaimed: boolean;
  squadDone: boolean;
  squadSkipped: boolean;
}

export interface FirstJourney {
  version: 1;
  enabled: boolean;
  entryStarted: boolean;
  skipped: boolean;
  battleDone: boolean;
  freeChargeUsed: boolean;
  ultCast: boolean;
  rewardClaimed: boolean;
  rewardUid?: string;
  equipDone: boolean;
  equipSkipped: boolean;
}

const DEFAULTS: SaveData = {
  gold: 500, diamonds: 20, stars: {}, unlocked: '1-1',
  speedUnlocked: false, music: true, sfx: true, debug: true,
  bag: {}, equips: [], heroes: {}, curHero: 'archer', squad: ['archer', 'sniper'],
  keepLv: 1, chestClaimed: {}, codex: [], codexRewards: [],
};

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) return cache;
  let fresh = false;
  try {
    const raw = localStorage.getItem(KEY);
    fresh = raw === null;
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  const sv = cache;
  const journeyMissing = !sv.firstJourney;
  if (journeyMissing) sv.firstJourney = {
    version: 1, enabled: fresh, entryStarted: false, skipped: false, battleDone: false,
    freeChargeUsed: false, ultCast: false, rewardClaimed: false, equipDone: false, equipSkipped: false,
  };
  const secondMissing = !sv.secondJourney;
  if (secondMissing) sv.secondJourney = {
    version: 1, enabled: sv.firstJourney!.enabled && !sv.firstJourney!.skipped && !sv.stars['1-2'],
    skipped: false, upgradeDone: false, upgradeSkipped: false, battleDone: !!sv.stars['1-2'],
    freeChargeUsed: false, ultCast: false, rewardClaimed: false, squadDone: false, squadSkipped: false,
  };
  const thirdMissing = !sv.thirdJourney;
  if (thirdMissing) sv.thirdJourney = {
    version: 1, enabled: sv.firstJourney!.enabled && !sv.firstJourney!.skipped && !sv.stars['1-3'],
    skipped: false, battleDone: !!sv.stars['1-3'], freeChargeUsed: false, ultCast: false,
    rewardClaimed: !!sv.stars['1-3'],
  };
  const fifthMissing = !sv.fifthRewards;
  if (fifthMissing) sv.fifthRewards = { version: 1, claimed: !!sv.stars['1-5'] };
  const earlyGoldMissing = !sv.earlyGold;
  if (earlyGoldMissing) {
    sv.earlyGold = { version: 1, claimed: {} };
    // Old cleared stages are ineligible: no retroactive money or reset of existing cultivation.
    for (const id of Object.keys(EARLY_FIRST_WIN_GOLD)) if (sv.stars[id]) sv.earlyGold.claimed[id] = true;
  }
  // 老档/缺英雄补默认（未拥有的英雄 hero 状态也建好，商店解锁只翻 owned）
  if (!sv.heroes) sv.heroes = {};
  for (const hid of ['archer', 'sniper', 'pyro', 'volt', 'mora', 'cannon', 'siphon', 'wind', 'ninja', 'space', 'sword', 'lance', 'arcane', 'scythe']) {
    if (!sv.heroes[hid]) {
      sv.heroes[hid] = { owned: hid === 'archer', lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
    }
  }
  // 老档无编队字段 → 默认双英雄上阵（与旧版战斗一致）
  if (!Array.isArray(sv.squad)) sv.squad = ['archer', 'sniper'];
  // 编队即拥有：上阵名单里的英雄一律视为已拥有（修复：上阵英雄在商店/英雄/升级页显示未解锁）
  for (const hid of sv.squad) {
    if (sv.heroes[hid]) sv.heroes[hid].owned = true;
  }
  // One owned instance per slot; never replace a valid, compatible existing weapon.
  if (!Array.isArray(sv.equips)) sv.equips = [];
  const used = new Set<string>();
  let changed = sv.weaponSystemVersion !== 1 || journeyMissing || secondMissing || thirdMissing || fifthMissing || earlyGoldMissing;
  // Replace only the recorded v43 first-win gift, keeping its UID, level and worn references.
  // A missing/sold gift is not recreated; unrelated staffs remain untouched.
  const thirdGift = sv.thirdJourney!.rewardClaimed && sv.thirdJourney!.rewardUid
    ? sv.equips.find(e => e.uid === sv.thirdJourney!.rewardUid && e.defId === 'wpn_green_staff') : undefined;
  if (thirdGift) { thirdGift.defId = 'wpn_green_book'; changed = true; }
  // Backfill the free 1-2 reward on old cleared saves. Ownership only: never overwrite growth or auto-deploy.
  if (sv.stars['1-2'] && !sv.secondJourney!.rewardClaimed) {
    sv.heroes.pyro.owned = true;
    sv.secondJourney!.rewardClaimed = true; changed = true;
  }
  for (const hid of Object.keys(STARTER_WEAPON)) {
    const h = sv.heroes[hid];
    h.worn = h.worn || {};
    const old = sv.equips.find(e => e.uid === h.worn.weapon);
    const level = Math.max(1, Math.min(90, Math.floor(Number(h.weaponLv) || 1)));
    // Old item-forge investment is promoted once; future weapons have no private cultivation level.
    const promoted = sv.weaponSystemVersion === 1 ? level : Math.max(level, Math.min(90, Math.floor(Number(old?.lv) || 1)));
    if (h.weaponLv !== promoted) { h.weaponLv = promoted; changed = true; }
    if (old && weaponFits(hid, old.defId) && !used.has(old.uid)) { used.add(old.uid); continue; }
    const uid = 'starter_weapon_' + hid;
    let starter = sv.equips.find(e => e.uid === uid);
    if (!starter || !weaponFits(hid, starter.defId) || used.has(uid)) {
      let safeUid = uid, suffix = 0;
      while (sv.equips.some(e => e.uid === safeUid)) safeUid = uid + '_recovered_' + (++suffix);
      starter = { uid: safeUid, defId: STARTER_WEAPON[hid], lv: 1 };
      sv.equips.push(starter);
    }
    h.worn.weapon = starter.uid; used.add(starter.uid); changed = true;
  }
  sv.weaponSystemVersion = 1;
  if (changed) saveSave();
  return sv;
}

export function saveSave(): void {
  if (!cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 隐私模式忽略 */ }
}
