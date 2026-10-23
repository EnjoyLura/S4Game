/** A single source for battle formations, difficulty rewards and lobby previews. */
import { getLevelDef, LevelDef, LEVEL_IDS, MobDef, SpawnGroup, WaveDef } from './Mobs';
import { campaignStage } from './Campaign';
import { expandedStageWaves } from './ChapterWaves';
import { FIRST_LEVEL_WAVES } from './FirstLevel';
import { SECOND_LEVEL_WAVES } from './SecondLevel';
import { THIRD_LEVEL_WAVES } from './ThirdLevel';
import { FOURTH_LEVEL_WAVES } from './FourthLevel';
import { FIFTH_LEVEL_WAVES } from './FifthLevel';
import { SIXTH_LEVEL_WAVES } from './SixthLevel';
import { SEVENTH_LEVEL_WAVES } from './SeventhLevel';

export interface MaterialReward { id: string; n: number; }
export interface GearWeight { id: string; weight: number; }
export interface ChestReward { gold?: number; diamonds?: number; }
export const DIFFICULTIES = [
  { name: '普通', waves: 10, statMul: 1, goldMul: 1, diamonds: 10, gearChance: 0, formation: '步兵推进 · 逐步增援' },
  { name: '精英', waves: 12, statMul: 1.6, goldMul: 1.5, diamonds: 15, gearChance: .001, formation: '骑兵夹击 · 精英压阵' },
  { name: '地狱', waves: 15, statMul: 2.4, goldMul: 2.2, diamonds: 20, gearChance: .0018, formation: '萨满支援 · 多轮精英军团' },
];
export function difficultyIndex(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value))) : 0;
}
export interface ChallengeDef extends LevelDef {
  difficulty: number;
  baseDiamonds: number;
  materials: MaterialReward[];
  gearPool: GearWeight[];
  /** An independent mode may override the ordinary per-kill chance. */
  equipmentChance?: number;
}
const POOLS: number[][][] = [
  [[45, 40, 15, 0, 0, 0], [25, 25, 45, 0, 5, 0]],
  [[25, 25, 35, 5, 5, 5], [10, 10, 30, 15, 20, 15]],
  [[15, 20, 30, 15, 10, 10], [0, 10, 25, 10, 30, 25]],
];
const GEAR_IDS = ['wpn_bow', 'acc_moon', 'helm_falcon', 'glove_wind', 'armor_forest', 'wpn_crossbow'];
const cache: Record<string, ChallengeDef> = {};
function group(mob: string, count: number, interval = .85, delay = 0): SpawnGroup {
  return { mob, count, interval, delay };
}
function reinforcement(groups: SpawnGroup[]): WaveDef { return { groups, surge: true }; }

export function getChallengeDef(id: string, value = 0): ChallengeDef {
  const base = getLevelDef(id), d = difficultyIndex(value), key = base.id + ':' + d;
  if (cache[key]) return cache[key];
  // Equipment pools and reinforcements follow chapter tiers, never the flat 0..29 stage index.
  const stage = campaignStage(base.id), s = (stage?.chapter || 1) - 1;
  if (stage && stage.chapter >= 2) {
    const weights = POOLS[Math.min(s, POOLS.length - 1)];
    const gearPool: GearWeight[] = d ? weights[d - 1].reduce((rows, weight, i) => {
      if (i === 0) for (const id of ['wpn_bow','wpn_green_crossbow','wpn_green_book','wpn_green_staff']) rows.push({ id, weight: weight / 4 });
      else rows.push({ id: GEAR_IDS[i], weight });
      return rows;
    }, [] as GearWeight[]).filter(g => g.weight > 0) : [];
    return cache[key] = { ...base, difficulty: d, baseGold: Math.round(base.baseGold * DIFFICULTIES[d].goldMul),
      baseDiamonds: DIFFICULTIES[d].diamonds, materials: [], gearPool, fixedWaves: true,
      waves: expandedStageWaves(stage.chapter, stage.stage, d) };
  }
  const waves: WaveDef[] = [];
  base.waves.forEach((wave, i) => {
    const groups = wave.groups.map(g => ({ ...g,
      count: g.mob === 'goblin_king' ? g.count : d ? Math.ceil(g.count * (d === 1 ? 1.05 : 1.1)) : g.count,
      interval: g.interval * (d === 1 ? .95 : d === 2 ? .88 : 1),
    }));
    const add = (g: SpawnGroup): void => { if (!groups.some(row => row.mob === g.mob)) groups.push(g); };
    if (d && i === 1) add(group('goblin_slinger', 6 + s * 2, 1.2, 2));
    if (d && i === 3) add(group('goblin_brute', d + s, 1.8, 3));
    if (d && (i === 6 || i === 8)) add(group('goblin_shaman', 2 + d + s, 2.1, 2));
    waves.push({ groups, surge: wave.surge });
    if (d === 1 && i === 3) waves.push(reinforcement([
      group('wolf_rider', 8 + 3 * s, .7), group('goblin_shaman', 2 + s, 2, 2), group('goblin_worker', 12 + 4 * s, .7, 3),
    ]));
    if (d === 1 && i === 7) waves.push(reinforcement([
      group('goblin_brute', 2 + s, 1.5), group('goblin_slinger', 10 + 4 * s, .85, 2), group('goblin_shaman', 2 + s, 2.2, 4),
    ]));
    if (d === 2) {
      if (i === 1) waves.push(reinforcement([group('wolf_rider', 10 + 4 * s, .65), group('goblin_slinger', 8 + 4 * s, .85, 2)]));
      if (i === 3) waves.push(reinforcement([group('goblin_brute', 2 + s, 1.6), group('goblin_shaman', 3 + s, 2, 2), group('goblin_slinger', 10 + 2 * s, .8, 3)]));
      if (i === 5) waves.push(reinforcement([group('wolf_rider', 14 + 4 * s, .6), group('goblin_worker', 20 + 4 * s, .65, 2), group('goblin_shaman', 3 + s, 2, 3)]));
      if (i === 7) waves.push(reinforcement([group('goblin_brute', 3 + s, 1.4), group('wolf_rider', 12 + 4 * s, .6, 2), group('goblin_slinger', 12 + 2 * s, .8, 4)]));
      if (i === 8) waves.push(reinforcement([group('goblin_brute', 4 + s, 1.4), group('goblin_shaman', 4 + s, 1.8, 2), group('goblin_slinger', 14 + 4 * s, .75, 3)]));
    }
  });
  // 通关常规奖励改为金币和钻石；材料背包及其他材料来源保留。
  const materials: MaterialReward[] = [];
  // Split the old green-bow share across four weapon types; total equipment/weapon odds stay unchanged.
  const gearPool = d ? POOLS[Math.min(s, POOLS.length - 1)][d - 1].reduce((rows, weight, i) => {
    if (i === 0) for (const id of ['wpn_bow', 'wpn_green_crossbow', 'wpn_green_book', 'wpn_green_staff']) rows.push({ id, weight: weight / 4 });
    else rows.push({ id: GEAR_IDS[i], weight });
    return rows;
  }, [] as GearWeight[]).filter(g => g.weight > 0) : [];
  const first = base.id === '1-1' && d === 0;
  const second = base.id === '1-2' && d === 0;
  const third = base.id === '1-3' && d === 0;
  const fourth = base.id === '1-4' && d === 0;
  const fifth = base.id === '1-5' && d === 0;
  const sixth = base.id === '1-6' && d === 0;
  const seventh = base.id === '1-7' && d === 0;
  return cache[key] = { ...base, difficulty: d, baseGold: seventh ? 160 : sixth ? 140 : fifth ? 120 : fourth ? 100 : Math.round(base.baseGold * DIFFICULTIES[d].goldMul),
    baseDiamonds: DIFFICULTIES[d].diamonds,
    waves: first ? FIRST_LEVEL_WAVES : second ? SECOND_LEVEL_WAVES : third ? THIRD_LEVEL_WAVES : fourth ? FOURTH_LEVEL_WAVES : fifth ? FIFTH_LEVEL_WAVES : sixth ? SIXTH_LEVEL_WAVES : seventh ? SEVENTH_LEVEL_WAVES : waves,
    fixedWaves: first || second || third || fourth || fifth || sixth || seventh, materials, gearPool };
}
/** One equipment roll per real kill; elite bonus is explicit in the preview. */
export function equipmentDropChance(difficulty: number, mob?: Pick<MobDef, 'elite' | 'boss'>): number {
  return Math.min(1, DIFFICULTIES[difficultyIndex(difficulty)].gearChance * (mob?.boss ? 20 : mob?.elite ? 8 : 1));
}
/** Shared by actual rolls and item previews; campaign probabilities retain their existing values. */
export function challengeEquipmentDropChance(level: ChallengeDef, mob?: Pick<MobDef, 'elite' | 'boss'>): number {
  return level.equipmentChance === undefined ? equipmentDropChance(level.difficulty, mob)
    : Math.min(1, Math.max(0, level.equipmentChance) * (mob?.boss ? 20 : mob?.elite ? 8 : 1));
}
export function starChestRewards(id: string, difficulty: number): ChestReward[] {
  const stage = campaignStage(id);
  const s = stage && stage.chapter >= 4 ? 29 + (stage.chapter - 3) * 2 + (stage.stage - 1) * .2
    : Math.max(0, LEVEL_IDS.indexOf(id)), d = difficultyIndex(difficulty);
  const rewards = d === 0 ? [{ gold: 200 + 100 * s }, { diamonds: 60 + 10 * s }, { diamonds: 150 + 25 * s }]
    : d === 1 ? [{ gold: 350 + 150 * s }, { diamonds: 90 + 15 * s }, { diamonds: 220 + 40 * s }]
      : [{ gold: 600 + 200 * s }, { diamonds: 120 + 20 * s }, { diamonds: 300 + 50 * s }];
  return rewards.map(r => r.gold === undefined ? { diamonds: Math.round(r.diamonds!) } : { gold: Math.round(r.gold) });
}
