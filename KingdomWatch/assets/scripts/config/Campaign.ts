/** Chapter order, stage identity and battlefield art are shared by the lobby and battles. */
import { CHAPTER_CONTENT } from './ChapterContent';
export interface CampaignChapter {
  number: number;
  name: string;
  art: string;
  battlefield: string;
  stages: readonly string[];
}
export interface CampaignStage {
  id: string;
  name: string;
  chapter: number;
  stage: number;
  order: number;
}

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = CHAPTER_CONTENT.map(c => ({
  number: c.number, name: c.name, art: c.art, stages: c.stages,
  battlefield: c.number <= 3 ? 'scenes/scene_1_' + c.number : 'scenes/scene_' + c.art + '_v66',
}));
export const CAMPAIGN_STAGES: readonly CampaignStage[] = CAMPAIGN_CHAPTERS.flatMap((chapter, c) =>
  chapter.stages.map((name, i) => ({ id: chapter.number + '-' + (i + 1), name,
    chapter: chapter.number, stage: i + 1, order: c * 10 + i })));
export const CAMPAIGN_LEVEL_IDS: string[] = CAMPAIGN_STAGES.map(stage => stage.id);

export function campaignStage(id: string): CampaignStage | undefined {
  return CAMPAIGN_STAGES.find(stage => stage.id === id);
}
export function campaignChapter(id: string): CampaignChapter {
  return CAMPAIGN_CHAPTERS[(campaignStage(id)?.chapter || 1) - 1];
}
export function battleSceneKey(id: string): string { return campaignChapter(id).battlefield; }

/** Keep existing earned stages accessible without renaming stars or regranting claimed chests. */
export function campaignLevelOpen(id: string, stars: Readonly<Record<string, number>>): boolean {
  const stage = campaignStage(id);
  if (!stage) return false;
  if (stage.order === 0 || stars[id] > 0 || stars[id + 'e'] > 0 || stars[id + 'h'] > 0) return true;
  return (stars[CAMPAIGN_LEVEL_IDS[stage.order - 1]] || 0) >= 1;
}
export function campaignDifficultyOpen(id: string, difficulty: number, stars: Readonly<Record<string, number>>): boolean {
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2) return false;
  if (!campaignLevelOpen(id, stars)) return false;
  return difficulty === 0 || (stars[id + (difficulty === 1 ? '' : 'e')] || 0) >= 1;
}
