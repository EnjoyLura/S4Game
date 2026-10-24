const generated = (...files: string[]): readonly string[] => files.map(file => 'v28/' + file);
/** All mage casts share one recording; ultimate contacts use distinct physical materials. */
const mage = (...files: string[]): readonly string[] => files.map(file => 'v27/' + file);
const elemental = (...files: string[]): readonly string[] => files.map(file => 'v26/' + file);
const gentle = (...files: string[]): readonly string[] => files.map(file => 'v25/' + file);
const kingdom = (...files: string[]): readonly string[] => files.map(file => 'v24/' + file);
const combat = (...files: string[]): readonly string[] => files.map(file => 'v21/' + file);
const deaths = (kind: string): readonly string[] => [1, 2, 3].map(i => `v21/${kind}_${i}`);
export const AUDIO_CUES = {
  mageCast: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  gateSlide: { files: gentle('gate_slide'), gain: .7, gap: .3, group: 'transition', priority: 3 },
  gateClose: { files: gentle('gate_close'), gain: .8, gap: .3, group: 'transition', priority: 3 },
  shoot: { files: combat('bow_1', 'bow_2', 'bow_3'), gain: .9, gap: .07, group: 'shot', priority: 1 },
  bow: { files: kingdom('bow_1', 'bow_2', 'bow_3'), gain: .9, gap: .07, group: 'shot', priority: 1 },
  crossbow: { files: kingdom('crossbow_1', 'crossbow_2', 'crossbow_3'), gain: .94, gap: .09, group: 'shot', priority: 1 },
  fire: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  thunder: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  frost: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  hit: { files: elemental('hit_common'), gain: .62, gap: .008, group: 'contact', priority: 1 },
  pierce: { files: combat('pierce_1', 'pierce_2', 'pierce_3'), gain: .74, gap: .09, group: 'impact', priority: 1 },
  crush: { files: combat('crush_1', 'crush_2', 'crush_3'), gain: .71, gap: .10, group: 'impact', priority: 1 },
  zapHit: { files: combat('zap_hit_1', 'zap_hit_2', 'zap_hit_3'), gain: .68, gap: .09, group: 'impact', priority: 0 },
  icebreak: { files: combat('icebreak_1', 'icebreak_2', 'icebreak_3'), gain: .7, gap: .09, group: 'impact', priority: 0 },
  pierceHeavy: { files: kingdom('pierce_heavy'), gain: .84, gap: .008, group: 'impact', priority: 2 },
  fireHeavy: { files: kingdom('crit'), gain: .83, gap: .008, group: 'impact', priority: 2 },
  thunderHeavy: { files: kingdom('crit'), gain: .83, gap: .008, group: 'impact', priority: 2 },
  frostHeavy: { files: kingdom('crit'), gain: .83, gap: .008, group: 'impact', priority: 2 },
  crit: { files: kingdom('crit'), gain: .83, gap: .008, group: 'impact', priority: 2 },
  kill: { files: deaths('physical'), gain: .88, gap: .075, group: 'death', priority: 2 },
  deathFire: { files: deaths('fire_death'), gain: .86, gap: .075, group: 'death', priority: 2 },
  deathVolt: { files: deaths('volt_death'), gain: .84, gap: .075, group: 'death', priority: 2 },
  deathFrost: { files: deaths('frost_death'), gain: .86, gap: .075, group: 'death', priority: 2 },
  deathHeavy: { files: kingdom('heavy_1', 'heavy_2', 'heavy_3'), gain: .92, gap: .10, group: 'death', priority: 2 },
  wall: { files: kingdom('wall'), gain: .9, gap: .25, group: 'impact', priority: 2 },
  snipe: { files: kingdom('snipe'), gain: .96, gap: .18, group: 'cast', priority: 3 },
  skill: { files: kingdom('skill'), gain: .9, gap: .18, group: 'cast', priority: 2 },
  ult: { files: combat('ult'), gain: 1, gap: .28, group: 'cast', priority: 3 },
  bowUlt: { files: kingdom('bow_ult'), gain: .96, gap: .28, group: 'cast', priority: 3 },
  fireSkill: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  thunderSkill: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  frostSkill: { files: mage('mage_cast'), gain: .82, gap: .18, group: 'shot', priority: 1 },
  // Contact starts at the recording's impact body; successive meteors replace the old tail.
  fireUlt: { files: generated('meteor_ult'), gain: 0.126 * Math.pow(10, 8 / 20), offset: 70101 / 44100, restart: true, gap: .18, group: 'cast', priority: 3 },
  thunderUlt: { files: generated('thunder_ult'), gain: 0.135 * Math.pow(10, 3 / 20), gap: 2.05, group: 'cast', priority: 3 },
  frostUlt: { files: generated('ice_ult'), gain: 0.485, gap: 1.75, group: 'cast', priority: 3 },
  charge: { files: combat('charge'), gain: .7, gap: .12, group: 'cast', priority: 2 },
  pickOpen: { files: kingdom('pick_open'), gain: .78, gap: .25, group: 'card', priority: 3 },
  pickRefresh: { files: combat('pick_refresh'), gain: .8, gap: .25, group: 'card', priority: 3 },
  pickChoose: { files: kingdom('pick_choose'), gain: .86, gap: .25, group: 'card', priority: 4 },
  levelup: { files: combat('levelup'), gain: .7, gap: .7, group: 'cue', priority: 3 },
  reward: { files: kingdom('reward'), gain: .85, gap: .7, group: 'cue', priority: 5 },
  rewardLand: { files: combat('reward_land'), gain: .6, gap: .2, group: 'ui', priority: 2 },
  growth: { files: kingdom('growth'), gain: .85, gap: .55, group: 'cue', priority: 4 },
  growthTick: { files: combat('growth_tick'), gain: .67, gap: .18, group: 'ui', priority: 2 },
  growthLand: { files: combat('growth_land'), gain: .65, gap: .25, group: 'ui', priority: 2 },
  breakthrough: { files: kingdom('breakthrough'), gain: .86, gap: 1.1, group: 'cue', priority: 5 },
  purchase: { files: combat('purchase'), gain: .86, gap: .6, group: 'cue', priority: 5 },
  recruit: { files: combat('recruit'), gain: .86, gap: 1.5, group: 'cue', priority: 5 },
  construction: { files: combat('construction'), gain: .86, gap: 1.1, group: 'cue', priority: 5 },
  star: { files: combat('star'), gain: .58, gap: .16, group: 'ui', priority: 2 },
  starFinish: { files: combat('star_finish'), gain: .65, gap: .16, group: 'ui', priority: 2 },
  lootDrop: { files: combat('loot_drop'), gain: .66, gap: .22, group: 'ui', priority: 2 },
  lootPickup: { files: kingdom('loot_pickup'), gain: .7, gap: .14, group: 'ui', priority: 2 },
  ready: { files: combat('ready'), gain: .65, gap: .7, group: 'cue', priority: 3 },
  surge: { files: kingdom('surge'), gain: .8, gap: 1.8, group: 'cue', priority: 4 },
  victory: { files: kingdom('victory'), gain: .9, gap: 2, group: 'cue', priority: 5 },
  defeat: { files: kingdom('defeat'), gain: .85, gap: 2, group: 'cue', priority: 5 },
  ui: { files: kingdom('ui_click_1'), gain: .65, gap: .07, group: 'ui', priority: 2 },
  uiSelect: { files: ['ui_click_2'], gain: .58, rate: 1.08, gap: .09, group: 'ui', priority: 2 },
  uiOpen: { files: ['ui_confirm'], gain: .38, rate: 1.08, gap: .14, group: 'ui', priority: 2 },
  uiClose: { files: ['ui_click_2'], gain: .45, rate: .86, gap: .12, group: 'ui', priority: 2 },
  uiToggle: { files: ['ui_click_1'], gain: .65, rate: 1.15, gap: .09, group: 'ui', priority: 2 },
  uiConfirm: { files: ['ui_confirm'], gain: .68, rate: 1, gap: .15, group: 'ui', priority: 2 },
  confirm: { files: ['ui_confirm'], gain: .75, gap: .15, group: 'ui', priority: 3 },
} as const;

export type SfxName = keyof typeof AUDIO_CUES;

/** Fewer independent messages: retain original sources so the policy is reversible. */
const SILENT_CUES = new Set<SfxName>([
  'levelup', 'growthTick', 'growthLand', 'rewardLand', 'star', 'starFinish',
  'pierce', 'crush', 'zapHit', 'icebreak',
  'kill', 'deathFire', 'deathVolt', 'deathFrost',
  'charge', 'ready', 'lootDrop',
]);
const SHARED_CUES: Partial<Record<SfxName, SfxName>> = {
  fire: 'mageCast', thunder: 'mageCast', frost: 'mageCast',
  fireSkill: 'mageCast', thunderSkill: 'mageCast', frostSkill: 'mageCast',
  fireHeavy: 'crit', thunderHeavy: 'crit', frostHeavy: 'crit',
  shoot: 'bow', ult: 'bowUlt',
  uiSelect: 'ui', uiOpen: 'ui', uiClose: 'ui',
  uiToggle: 'ui', uiConfirm: 'ui', confirm: 'ui', pickRefresh: 'ui',
  purchase: 'reward', recruit: 'reward', construction: 'growth',
};

export function resolveAudioCue(name: SfxName): SfxName | null {
  return SILENT_CUES.has(name) ? null : SHARED_CUES[name] || name;
}

export type MusicScene = 'camp' | 'battle';
export const MUSIC_TRACKS = { camp: 'bgm_camp', battle: 'bgm_battle' } as const;
/** A chapter keeps its identity throughout the lobby and its own battles. */
export const CHAPTER_MUSIC: Readonly<Record<number, Readonly<Record<MusicScene, string>>>> = {
  1: MUSIC_TRACKS,
  2: { camp: 'v29/bgm_forest', battle: 'v29/bgm_forest' },
  3: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  // Initial expansion reuses the existing licensed tracks by biome; no new compositions yet.
  4: { camp: 'v29/bgm_forest', battle: 'v29/bgm_forest' },
  5: MUSIC_TRACKS,
  6: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  7: MUSIC_TRACKS,
  8: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  9: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  10: { camp: 'v29/bgm_forest', battle: 'v29/bgm_forest' },
  11: MUSIC_TRACKS,
  12: { camp: 'v29/bgm_forest', battle: 'v29/bgm_forest' },
  13: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  14: MUSIC_TRACKS,
  15: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
  16: { camp: 'v29/bgm_lair', battle: 'v29/bgm_lair' },
};
/** Per-track playback gain relative to v29, shared by lobby and battle. */
export const MUSIC_TRACK_GAIN: Readonly<Record<string, number>> = {
  'v29/bgm_forest': Math.pow(10, 3 / 20),
  'v29/bgm_lair': Math.pow(10, 1.5 / 20),
};
