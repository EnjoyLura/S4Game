/**
 * 主存档（§12.5：localStorage JSON；写档时机=结算/选卡后/养成变更）
 * M0 子集：货币、关卡进度、倍速解锁、Debug 开关
 */
const KEY = 'kw_save_v1';

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
}

const DEFAULTS: SaveData = {
  gold: 500, diamonds: 20, stars: {}, unlocked: '1-1',
  speedUnlocked: false, music: true, sfx: true, debug: true,
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
  return cache;
}

export function saveSave(): void {
  if (!cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 隐私模式忽略 */ }
}
