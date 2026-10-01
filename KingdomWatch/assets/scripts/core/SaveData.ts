/**
 * 主存档（§12.5：localStorage JSON；写档时机=结算/选卡后/养成变更）
 * M0 子集：货币、关卡进度、倍速解锁、Debug 开关
 * 五主界面扩展：背包/装备实例/英雄养成/主城等级/星箱领取/图鉴（老档缺键走 DEFAULTS 迁移）
 */
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
  gold: number;
  diamonds: number;
  /** 星数表：'1-1' -> 1~3 */
  stars: Record<string, number>;
  /** 解锁到的关卡 id */
  unlocked: string;
  /** 通关 1-2 解锁 2x 倍速（§3.0） */
  speedUnlocked: boolean;
  music: boolean;
  sfx: boolean;
  debug: boolean;
  /* ---------- 五主界面扩展 ---------- */
  /** 材料背包：物品id -> 数量 */
  bag: Record<string, number>;
  /** 装备/武器实例仓库（含已穿戴） */
  equips: EquipInst[];
  /** 英雄养成（键=英雄id） */
  heroes: Record<string, HeroState>;
  /** 当前查看英雄 */
  curHero: string;
  /** 主城等级（上限10） */
  keepLv: number;
  /** 星箱领取记录：关卡id -> 已领最高档（0=未领） */
  chestClaimed: Record<string, number>;
  /** 已解锁怪物图鉴 */
  codex: string[];
}

const DEFAULTS: SaveData = {
  gold: 500, diamonds: 20, stars: {}, unlocked: '1-1',
  speedUnlocked: false, music: true, sfx: true, debug: true,
  bag: {}, equips: [], heroes: {}, curHero: 'archer',
  keepLv: 1, chestClaimed: {}, codex: [],
};

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  const sv = cache;
  // 老档/缺英雄补默认（未拥有的英雄 hero 状态也建好，商店解锁只翻 owned）
  if (!sv.heroes || !sv.heroes.archer) sv.heroes = { ...DEFAULTS.heroes };
  for (const hid of ['archer', 'sniper']) {
    if (!sv.heroes[hid]) {
      sv.heroes[hid] = { owned: hid === 'archer', lv: 1, weaponLv: 1, atkLv: 1, skillLv: 1, ultLv: 1, worn: {} };
    }
  }
  return sv;
}

export function saveSave(): void {
  if (!cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 隐私模式忽略 */ }
}
