/** Sample families share a mix budget; variants keep repeated volleys from sounding identical. */
export const AUDIO_CUES = {
  shoot: { files: ['bow_1', 'bow_2', 'bow_3'], gain: .78, gap: .08, group: 'shot', priority: 1 },
  bow: { files: ['bow_1', 'bow_2', 'bow_3'], gain: .78, gap: .08, group: 'shot', priority: 1 },
  crossbow: { files: ['crossbow_1', 'crossbow_2', 'crossbow_3'], gain: .9, gap: .13, group: 'shot', priority: 1 },
  fire: { files: ['fire_1', 'fire_2', 'fire_3'], gain: .86, gap: .12, group: 'shot', priority: 1 },
  thunder: { files: ['thunder_1', 'thunder_2'], gain: .82, gap: .12, group: 'shot', priority: 1 },
  frost: { files: ['frost_1', 'frost_2'], gain: .84, gap: .12, group: 'shot', priority: 1 },
  hit: { files: ['hit_1', 'hit_2'], gain: .64, gap: .10, group: 'impact', priority: 0 },
  pierce: { files: ['pierce'], gain: .73, gap: .12, group: 'impact', priority: 1 },
  crush: { files: ['crush_1', 'crush_2'], gain: .74, gap: .14, group: 'impact', priority: 1 },
  zapHit: { files: ['zap_hit_1', 'zap_hit_2'], gain: .68, gap: .12, group: 'impact', priority: 0 },
  icebreak: { files: ['icebreak_1', 'icebreak_2'], gain: .68, gap: .12, group: 'impact', priority: 0 },
  crit: { files: ['crit'], gain: .8, gap: .16, group: 'impact', priority: 2 },
  kill: { files: ['kill'], gain: .45, gap: .2, group: 'impact', priority: 0 },
  wall: { files: ['wall'], gain: .88, gap: .28, group: 'impact', priority: 2 },
  snipe: { files: ['snipe'], gain: .95, gap: .18, group: 'cast', priority: 3 },
  skill: { files: ['skill'], gain: .86, gap: .18, group: 'cast', priority: 2 },
  ult: { files: ['ult'], gain: 1, gap: .28, group: 'cast', priority: 3 },
  bowUlt: { files: ['bow_ult'], gain: .95, gap: .28, group: 'cast', priority: 3 },
  fireSkill: { files: ['fire_skill'], gain: .88, gap: .18, group: 'cast', priority: 2 },
  frostSkill: { files: ['frost_skill'], gain: .88, gap: .18, group: 'cast', priority: 2 },
  fireUlt: { files: ['fire_ult'], gain: 1, gap: .28, group: 'cast', priority: 3 },
  thunderUlt: { files: ['thunder_ult'], gain: .95, gap: .28, group: 'cast', priority: 3 },
  frostUlt: { files: ['frost_ult'], gain: .95, gap: .28, group: 'cast', priority: 3 },
  levelup: { files: ['levelup'], gain: .83, gap: .6, group: 'cue', priority: 4 },
  ready: { files: ['ready'], gain: .7, gap: .7, group: 'cue', priority: 3 },
  surge: { files: ['surge'], gain: .8, gap: 1.8, group: 'cue', priority: 4 },
  victory: { files: ['victory'], gain: .95, gap: 2, group: 'cue', priority: 5 },
  defeat: { files: ['defeat'], gain: .85, gap: 2, group: 'cue', priority: 5 },
  ui: { files: ['ui_click_1', 'ui_click_2'], gain: .65, gap: .07, group: 'ui', priority: 2 },
  confirm: { files: ['ui_confirm'], gain: .75, gap: .15, group: 'ui', priority: 3 },
} as const;

export type SfxName = keyof typeof AUDIO_CUES;
export type MusicScene = 'camp' | 'battle';
export const MUSIC_TRACKS = { camp: 'bgm_camp', battle: 'bgm_battle' } as const;
