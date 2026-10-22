/** Chapter order, stage identity and battlefield art are shared by the lobby and battles. */
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

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = [
  { number: 1, name: '前哨', art: 'outpost', battlefield: 'scenes/scene_1_1',
    stages: ['城外小径', '废弃岗亭', '林缘营地', '石桥隘口', '哨塔争夺', '补给小道', '旧墙防线', '烽火营地', '前哨围攻', '守望堡垒'] },
  { number: 2, name: '深林', art: 'forest', battlefield: 'scenes/scene_1_2',
    stages: ['林间入口', '迷雾小径', '古树廊道', '密林伏击', '狼影岔路', '苔石遗迹', '萨满祭地', '幽林深处', '荆棘围阵', '深林腹地'] },
  { number: 3, name: '兽穴', art: 'lair', battlefield: 'scenes/scene_1_3',
    stages: ['洞口险道', '碎骨坑道', '兽群营地', '獠牙石窟', '战鼓大厅', '地底暗河', '驯兽巢室', '蛮兵要塞', '兽穴围城', '巢穴核心'] },
];
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
