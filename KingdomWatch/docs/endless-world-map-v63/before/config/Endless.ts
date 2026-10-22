/** Endless floors use campaign-authored species, without granting campaign clears. */
import { CAMPAIGN_CHAPTERS } from './Campaign';
import { ChallengeDef, getChallengeDef } from './LevelDifficulty';
import { MOBS, MOB_DMG_MUL, MOB_HP_MUL, SpawnGroup, WaveDef } from './Mobs';

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
  const chapterMul = Math.pow(1.7, chapter - 1);
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
  ordinary.forEach((id, i) => add(id,
    Math.min(i === 0 ? 48 : 24, (i === 0 ? 16 : 6) + Math.floor(n * .8) + (chapter - 1) * 2),
    i * 2.4, Math.max(.32, .9 - n * .015)));
  const elites = pool.filter(id => MOBS[id].elite && !MOBS[id].boss);
  if (floor % 3 === 0 || floor % 5 === 0) elites.forEach(id => add(id, Math.min(4, 1 + Math.floor(floor / 12)), 8, 2));
  const bosses = pool.filter(id => MOBS[id].boss);
  if (floor % 5 === 0 && bosses.length) add(bosses[(Math.floor(floor / 5) - 1) % bosses.length], 1, 12, 1);
  return { groups, surge: floor % 5 === 0 };
}

export function endlessChallenge(chapter: number): ChallengeDef {
  const c = CAMPAIGN_CHAPTERS.find(row => row.number === chapter)!;
  return { id: 'endless-' + chapter, name: c.name + ' · 无尽挑战', difficulty: 0,
    lineHp: 0, baseGold: 0, baseDiamonds: 0, materials: [], gearPool: [],
    fixedWaves: true, waves: [endlessWave(chapter, 1)] };
}
