/** Chapter-specific encounters; all waves retain a bounded, authored composition. */
import { CHAPTER_CONTENT, EXPANSION_MOBS, chapterPower } from './ChapterContent';
import type { LevelDef, WaveDef, SpawnGroup } from './Mobs';
import type { CampaignStage } from './Campaign';

export function expandedStageWaves(chapter: number, stage: number, difficulty = 0): WaveDef[] {
  const roster = CHAPTER_CONTENT.find(c => c.number === chapter)?.roster || [];
  if (roster.length !== 5) throw new Error('Missing chapter enemy roster: ' + chapter);
  const [front, ranged, support, elite, boss] = roster;
  const special = EXPANSION_MOBS[support];
  const length = [7,7,8,8,9,8,9,9,10,10][stage - 1] + difficulty * 2;
  const waves: WaveDef[] = [];
  for (let i = 0; i < length; i++) {
    const rest = i === 3 || i === 6 && i < length - 1;
    const count = rest ? 10 + difficulty * 2 : 15 + Math.floor(stage * .7) + Math.min(7, i) + difficulty * 2;
    // Forest wolves occupy existing front-line slots; wave counts, cadence and stats stay the same.
    const frontId = chapter === 2 && i % 4 === 2 ? 'forest_wolf' : front;
    const groups: SpawnGroup[] = [{ mob: frontId, count, interval: rest ? 2.1 : Math.max(.72, 1.16 - stage * .022 - i * .012) }];
    if (i >= 1) groups.push({ mob: ranged, count: rest ? 3 : 4 + Math.floor(i * .55) + difficulty,
      interval: rest ? 2.6 : 1.7, delay: 4 });
    if (i >= 2 && (!rest || i === 6)) groups.push({ mob: support,
      count: special.kind === 'heal' ? 1 + Math.floor((stage + difficulty) / 7) : 3 + Math.floor(stage / 3) + difficulty,
      interval: 2.4, delay: 9 });
    if (stage >= 3 && (i === length - 2 || stage >= 5 && i === 4) || difficulty > 0 && i === 2)
      groups.push({ mob: elite, count: 1 + (stage >= 8 && i === length - 2 ? 1 : 0) + (difficulty === 2 ? 1 : 0), interval: 3, delay: 6 });
    if (stage === 10 && i === length - 1) groups.unshift({ mob: boss, count: 1, interval: 1, delay: 0 });
    waves.push({ groups, surge: !rest && (i === length - 1 || i === 4) });
  }
  return waves;
}
export function expandedLevel(stage: CampaignStage): LevelDef {
  const chapter = CHAPTER_CONTENT[stage.chapter - 1];
  return { id: stage.id, name: chapter.name + ' · ' + stage.name,
    lineHp: stage.chapter >= 3 ? 1100 : 1000,
    baseGold: 60 + (stage.chapter - 1) * 80 + (stage.stage - 1) * 8,
    statMul: Number((chapterPower(stage.chapter) + (stage.stage - 1) * .055).toFixed(3)),
    fixedWaves: true, waves: expandedStageWaves(stage.chapter, stage.stage) };
}
