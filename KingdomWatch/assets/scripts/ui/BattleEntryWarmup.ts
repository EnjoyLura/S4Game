/** Entry art first; only the selected battlefield and equipped heroes need a first-paint barrier. */
import { director, EffectAsset, JsonAsset, resources } from 'cc';
import { battleSceneKey } from '../config/Campaign';
import { getChallengeDef } from '../config/LevelDifficulty';
import { enemyArtRef } from '../config/ChapterContent';
import { warmBattleAtlas } from '../battle/BattleSprite';
import { preloadArcherClip } from '../battle/ArcherIdleAnimation';
import { preloadHeroClip } from '../battle/HeroSequenceAnimation';
import { getMobAnims } from '../battle/MobAnim';
import { ArtPriority, uxFrame, warmUXArt } from './Ux';
import { warmPickArt } from './PickArt';
import { warmGameFonts } from './Fonts';
import { warmWindVideo } from '../battle/WindVideoVFX';

export const ENTRY_GATE_ART = 'battle_entry_v3/outpost_gate';
export const THREAT_ART = ['boss_warning_v1/banner', 'boss_warning_v1/crest'] as const;
const HERO_CLIPS: Record<string, [string, string]> = {
  sniper: ['sniper_idle_natural_v2', 'sniper_attack_clean_v1'],
  pyro: ['pyro_idle_loop_v2', 'pyro_attack_user_v2'],
  volt: ['volt_idle_natural_v1', 'volt_attack_user_v2'],
  mora: ['mora_idle_user_v1', 'mora_attack_user_v1'],
};
let sceneJob: Promise<boolean> | null = null;
export const BATTLE_COMMON_ART = ['pause_comic_v1/title_ribbon',
  'settlement_comic_v1/badge_win', 'settlement_comic_v1/badge_lose', 'levels_comic_v1/comic_star_v1',
  'shop_comic_v1/comic_coin_v1', 'shop_comic_v1/comic_diamond_v1', 'hero_comic_v2/comic_attributes_v2',
  'pick_comic_v1/title_plate', 'hero_comic_v2/comic_story_v2', 'ult_energy_quad', ...THREAT_ART] as const;
const FX_IMAGES: Record<string, string[]> = {
  archer: ['fx/archer_v1'],
  pyro: ['fx/pyro_hit', 'fx/fire_v2', 'fx/crater_mark', 'fx/crater_embers'],
  mora: ['fx/frost_domain_video_v10', 'fx/frost_ultimate_impact_v1', 'fx/frost_ultimate_rain_v1'],
};
const FX_MANIFESTS = new Set(['fx/archer_v1', 'fx/pyro_hit', 'fx/fire_v2', 'fx/frost_domain_video_v10', 'fx/frost_ultimate_impact_v1']);
const FX_EFFECTS: Record<string, string[]> = {
  pyro: ['fx/fire-paint-v2'], volt: ['fx/volt-ultimate-procedural'], sniper: ['fx/sniper-ultimate-procedural'],
  cannon: ['fx/hero-impact-flow'], siphon: ['fx/hero-impact-flow'],
  wind: ['fx/wind-ninja-flow'], ninja: ['fx/wind-ninja-flow'],
  scythe:['fx/scythe-flow'],
  arcane:['fx/magic-bow-flow'],
  lance:['fx/thunder-lance-flow'],
  space:['fx/space-sword-burst'],sword:['fx/sword-jade-flow'],
};
const fxRequests = new Map<string, Promise<void>>();
function warmFxResource(path: string, effect: boolean): Promise<void> {
  const hit = fxRequests.get(path); if (hit) return hit;
  const job = new Promise<void>(resolve => {
    const finish = (error: Error | null): void => { if (error) fxRequests.delete(path); resolve(); };
    if (effect) resources.load(path, EffectAsset, finish); else resources.load(path, JsonAsset, finish);
  });
  fxRequests.set(path, job); return job;
}
function warmBattleEffects(heroIds: readonly string[], priority: ArtPriority): Promise<void> {
  const images = Array.from(new Set(heroIds.flatMap(id => FX_IMAGES[id] || [])));
  const jobs = [warmUXArt(images, priority)];
  if (heroIds.includes('wind')) jobs.push(warmWindVideo(priority));
  for (const path of images) if (FX_MANIFESTS.has(path)) jobs.push(warmFxResource(path + '.frames', false));
  const effects = ['fx/basic-launch-procedural', 'fx/mob-cold', 'fx/mob-death', 'fx/ult-energy',
    ...heroIds.flatMap(id => FX_EFFECTS[id] || [])];
  jobs.push(...effects.map(path => warmFxResource(path, true)));
  return Promise.all(jobs).then(() => {});
}

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
  warmGameFonts();
  warmEntryArt(priority); void warmBattleScene();
  // Small reused HUD art starts before entry; neither image blocks the battlefield reveal.
  void warmUXArt(['hero_comic_v2/comic_story_v2', 'pick_comic_v1/title_plate'], priority === 'visible' ? 'next' : priority);
  // Start card predictions now, rather than after every multi-megabyte character sheet.
  if (levelId === '1-5' || levelId === '1-10' || mobIds.includes('goblin_king')) getMobAnims(() => {}, 'goblin_king', priority);
  const firstPaint = [imageReady(battleSceneKey(levelId), priority), imageReady('defense_wall', priority)];
  firstPaint.push(warmPickArt(ids, priority), warmUXArt(BATTLE_COMMON_ART, priority), warmBattleEffects(ids, priority));
  const enemies: string[] = [...mobIds];
  if (!enemies.length) for (const wave of getChallengeDef(levelId, 0).waves) for (const group of wave.groups) enemies.push(group.mob);
  for (const atlas of new Set(enemies.map(id => enemyArtRef(id).atlas))) firstPaint.push(warmBattleAtlas(atlas, priority));
  for (const atlas of ['chapter1_mob_walk_v81', 'chapter1_mob_walk_v84', 'chapter1_mob_walk_v94', 'chapter1_mob_walk_v95', 'chapter1_cart_walk_v95', 'forest_mob_walk_v85', 'forest_mob_walk_v87']) {
    const videoWalk = enemies.find(id => enemyArtRef(id).atlas === atlas);
    if (videoWalk) firstPaint.push(new Promise<void>(resolve => getMobAnims(() => resolve(), videoWalk, priority)));
  }
  for (const id of ids) {
    if (id === 'scythe') firstPaint.push(imageReady('new_heroes_v139/scythe_battle', priority));
    if (id === 'arcane') firstPaint.push(imageReady('new_heroes_v138/arcane_battle', priority));
    if (id === 'lance') firstPaint.push(imageReady('new_heroes_v137/lance_battle', priority));
    if (id === 'space' || id === 'sword') firstPaint.push(imageReady('new_heroes_v127/' + id + '_battle', priority));
    if (id === 'wind' || id === 'ninja') firstPaint.push(imageReady('new_heroes_v120/' + id + '_battle', priority));
    if (id === 'cannon' || id === 'siphon') firstPaint.push(imageReady('new_heroes_v105/' + id + '_battle', priority));
    if (id === 'archer') {
      firstPaint.push(preloadArcherClip('idle', priority));
      // Attack sheets follow idle sheets, so a large combat atlas cannot delay the first hero pose.
      firstPaint.push(preloadArcherClip('attack', priority));
    } else if (HERO_CLIPS[id]) {
      const [idle, attack] = HERO_CLIPS[id];
      firstPaint.push(preloadHeroClip(idle, 'idle', priority));
      firstPaint.push(preloadHeroClip(attack, 'attack', priority));
    }
    // HUD decorations are warm, but never hold an opaque screen hostage.
    firstPaint.push(warmUXArt(['icon_atk', 'icon_skill', 'icon_ult'].map(part => 'ui_' + part + '_' + id), priority));
  }
  // The actual resource caches deduplicate requests, and a click can promote an idle prediction.
  return Promise.all(firstPaint).then(() => {});
}
