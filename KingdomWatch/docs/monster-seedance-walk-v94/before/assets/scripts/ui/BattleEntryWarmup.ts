/** Entry art first; only the selected battlefield and equipped heroes need a first-paint barrier. */
import { director } from 'cc';
import { battleSceneKey } from '../config/Campaign';
import { getChallengeDef } from '../config/LevelDifficulty';
import { enemyArtRef } from '../config/ChapterContent';
import { warmBattleAtlas } from '../battle/BattleSprite';
import { preloadArcherClip } from '../battle/ArcherIdleAnimation';
import { preloadHeroClip } from '../battle/HeroSequenceAnimation';
import { getMobAnims } from '../battle/MobAnim';
import { ArtPriority, uxFrame, warmUXArt } from './Ux';
import { warmPickArt } from './PickArt';

export const ENTRY_GATE_ART = 'battle_entry_v3/outpost_gate';
export const THREAT_ART = ['pick_comic_v1/title_plate', 'hero_comic_v2/comic_story_v2'] as const;
const HERO_CLIPS: Record<string, [string, string]> = {
  sniper: ['sniper_idle_natural_v2', 'sniper_attack_clean_v1'],
  pyro: ['pyro_idle_loop_v2', 'pyro_attack_user_v2'],
  volt: ['volt_idle_natural_v1', 'volt_attack_user_v2'],
  mora: ['mora_idle_user_v1', 'mora_attack_user_v1'],
};
let sceneJob: Promise<boolean> | null = null;

function imageReady(id: string, priority: ArtPriority): Promise<void> {
  return warmUXArt([id], priority);
}

/** Called immediately on reaching the lobby, before the long idle-art queue. */
export function warmEntryArt(priority: ArtPriority = 'next'): void { uxFrame(ENTRY_GATE_ART, () => {}, priority); }

export function warmBattleScene(): Promise<boolean> {
  if (!sceneJob) {
    sceneJob = new Promise(resolve => director.preloadScene('Main', error => resolve(!error)));
    sceneJob.then(ok => { if (!ok) sceneJob = null; });
  }
  return sceneJob;
}

/** Failures settle to the existing fallback. Pending work is shared; failed assets may retry later. */
export function warmBattlefield(levelId: string, heroIds: readonly string[], mobIds: readonly string[] = [],
  priority: ArtPriority = 'visible'): Promise<void> {
  const ids = heroIds.length ? [...heroIds] : ['archer', 'sniper'];
  warmEntryArt(priority); void warmBattleScene();
  // Small reused HUD art starts before entry; neither image blocks the battlefield reveal.
  void warmUXArt(['hero_comic_v2/comic_story_v2', 'pick_comic_v1/title_plate'], priority === 'visible' ? 'next' : priority);
  // Start card predictions now, rather than after every multi-megabyte character sheet.
  void warmPickArt(ids);
  if (levelId === '1-5' || levelId === '1-10' || mobIds.includes('goblin_king')) getMobAnims(() => {}, 'goblin_king', priority);
  const firstPaint = [imageReady(battleSceneKey(levelId), priority), imageReady('defense_wall', priority)];
  const enemies: string[] = [...mobIds];
  if (!enemies.length) for (const wave of getChallengeDef(levelId, 0).waves) for (const group of wave.groups) enemies.push(group.mob);
  for (const atlas of new Set(enemies.map(id => enemyArtRef(id).atlas))) firstPaint.push(warmBattleAtlas(atlas, priority));
  for (const atlas of ['chapter1_mob_walk_v81', 'chapter1_mob_walk_v84', 'forest_mob_walk_v85', 'forest_mob_walk_v87']) {
    const videoWalk = enemies.find(id => enemyArtRef(id).atlas === atlas);
    if (videoWalk) firstPaint.push(new Promise<void>(resolve => getMobAnims(() => resolve(), videoWalk, priority)));
  }
  for (const id of ids) {
    if (id === 'archer') {
      firstPaint.push(preloadArcherClip('idle', priority));
      // Attack sheets follow idle sheets, so a large combat atlas cannot delay the first hero pose.
      void preloadArcherClip('idle', priority).then(() => preloadArcherClip('attack', 'idle'));
    } else if (HERO_CLIPS[id]) {
      const [idle, attack] = HERO_CLIPS[id];
      firstPaint.push(preloadHeroClip(idle, 'idle', priority));
      void preloadHeroClip(idle, 'idle', priority).then(() => preloadHeroClip(attack, 'attack', 'idle'));
    }
    // HUD decorations are warm, but never hold an opaque screen hostage.
    for (const part of ['avatar', 'icon_atk', 'icon_skill', 'icon_ult']) {
      uxFrame('ui_' + part + '_' + id, () => {}, priority === 'visible' ? 'next' : priority);
    }
  }
  // The actual resource caches deduplicate requests, and a click can promote an idle prediction.
  return Promise.all(firstPaint).then(() => { void warmUXArt(THREAT_ART, 'idle'); });
}
