/** Endless floors use campaign-authored species, without granting campaign clears. */
import { CAMPAIGN_CHAPTERS } from './Campaign';
import { ChallengeDef, getChallengeDef } from './LevelDifficulty';
import { MOBS, MOB_DMG_MUL, MOB_HP_MUL, SpawnGroup, WaveDef } from './Mobs';
import { EQUIPS } from '../core/GameData';

/** Conditional rarity shares after an equipment drop; templates of one quality share its weight. */
const ENDLESS_QUALITY_WEIGHTS = [[0,70,27,3], [0,55,38,7], [0,45,43,12]];
export function endlessGearPool(chapter: number): ChallengeDef['gearPool'] {
  const shares = ENDLESS_QUALITY_WEIGHTS[Math.min(2, Math.max(0, chapter - 1))];
  const items = Object.values(EQUIPS).filter(d => shares[d.quality] > 0 && Number(d.unlock.split('-')[0]) <= chapter);
  const counts = shares.map((_, q) => items.filter(d => d.quality === q).length);
  return items.sort((a,b) => a.quality - b.quality).map(d => ({ id: d.id, weight: shares[d.quality] / counts[d.quality] }));
}

export function endlessOpen(chapter: number, stars: Record<string, number>): boolean {
  return CAMPAIGN_CHAPTERS.some(c => c.number === chapter) && (stars[chapter + '-10'] || 0) >= 1;
}

export function endlessMobPool(chapter: number): string[] {
  const ids = new Set<string>();
  for (const c of CAMPAIGN_CHAPTERS) {
    if (c.number > chapter) continue;
    for (let i = 1; i <= c.stages.length; i++) {
      for (const wave of getChallengeDef(c.number + '-' + i, 0).waves) {
        for (const g of wave.groups) if (MOBS[g.mob]) ids.add(g.mob);
      }
    }
  }
  return Array.from(ids);
}

/** Only one bounded spawn queue exists at a time; there is no authored last floor. */
export function endlessWave(chapter: number, floor: number): WaveDef {
  const pool = endlessMobPool(chapter), n = Math.max(0, floor - 1);
  const chapterMul = chapter <= 3 ? Math.pow(1.7, chapter - 1) : 2.89 + (chapter - 3) * .7;
  const hpMul = chapterMul * (1 + .12 * n + .004 * n * n);
  const dmgMul = chapterMul * (1 + .06 * n + .0015 * n * n);
  const groups: SpawnGroup[] = [];
  const add = (id: string, count: number, delay: number, interval: number): void => {
    const mob = MOBS[id];
    groups.push({ mob: id, count, delay, interval, actual: {
      hp: Math.max(1, Math.round(mob.hp * MOB_HP_MUL * hpMul)),
      dmg: Math.max(1, Math.round(mob.dmg * MOB_DMG_MUL * dmgMul)),
    } });
  };
  const ordinary = pool.filter(id => !MOBS[id].elite && !MOBS[id].boss);
  const attackers = ordinary.filter(id => MOBS[id].kind !== 'heal');
  const latest = attackers.filter(id => (MOBS[id].homeChapter || 1) === chapter);
  const chosen: string[] = [];
  if (latest.length) chosen.push(latest[n % latest.length]);
  const kinds = Math.min(4, 2 + Math.floor(n / 8));
  for (let i = 0; i < attackers.length && chosen.length < kinds; i++) {
    const id = attackers[(n * 3 + i) % attackers.length];
    if (!chosen.includes(id)) chosen.push(id);
  }
  const total = Math.min(56, 28 + Math.floor(n * 1.1) + Math.min(8, chapter));
  chosen.forEach((id, i) => add(id, Math.floor(total / chosen.length) + (i < total % chosen.length ? 1 : 0),
    i * 2.4, Math.max(.4, 1.05 - n * .012)));
  const support = ordinary.filter(id => MOBS[id].kind === 'heal');
  if (floor >= 3 && support.length) add(support[n % support.length], floor >= 12 ? 2 : 1, 7, 4);
  const elites = pool.filter(id => MOBS[id].elite && !MOBS[id].boss);
  if ((floor % 3 === 0 || floor % 5 === 0) && elites.length) {
    add(elites[n % elites.length], floor >= 18 ? 2 : 1, 8, 3);
  }
  const bosses = pool.filter(id => MOBS[id].boss);
  if (floor % 5 === 0 && bosses.length) add(bosses[(Math.floor(floor / 5) - 1) % bosses.length], 1, 12, 1);
  return { groups, surge: floor % 5 === 0 };
}

export function endlessChallenge(chapter: number): ChallengeDef {
  const c = CAMPAIGN_CHAPTERS.find(row => row.number === chapter)!;
  return { id: 'endless-' + chapter, name: c.name + ' · 无尽挑战', difficulty: 0,
    lineHp: 0, baseGold: 0, baseDiamonds: 0, materials: [], gearPool: endlessGearPool(chapter), equipmentChance: .005,
    fixedWaves: true, waves: [endlessWave(chapter, 1)] };
}
