/** Prime real visible art, then download farther navigation assets without GPU allocation. */
import { CODEX, HERO_DEFS, SHOP, lvReached, squadList } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { getChallengeDef } from '../config/LevelDifficulty';
import { ArtPriority, prefetchUXArt, warmUXArt } from './Ux';
import { EMPTY_GEAR, GEAR_ART, gearArtKey, heroFigureKey, heroPortraitKey } from './HeroComic';
import { heroLobbyIdleKey, prefetchHeroLobbyIdle, supportsHeroLobbyIdle, warmHeroLobbyIdle } from './HeroLobbyIdle';
import { ROUTE_ART } from './CampaignRoute';
import { stageGuaranteedEntries } from './LevelLootPreview';
import { CAMPAIGN_CHAPTERS, campaignLevelOpen } from '../config/Campaign';
import { enemyArtRef } from '../config/ChapterContent';
import { BATTLE_COMMON_ART } from './BattleEntryWarmup';
import { warmPickArt } from './PickArt';
import { warmMobArmAlpha } from '../battle/MobArmAlpha';

const SHOP_PREFIX = 'shop_comic_v1/';
const shared = ['comic_coin_v1', 'comic_diamond_v1', 'comic_nav_shop_v1', 'comic_helm_falcon_v1',
  'comic_nav_map_v1', 'comic_nav_castle_v1'].map(key => SHOP_PREFIX + key)
  .concat('upgrade_comic_v1/comic_training_hammer_v1');
const preparation = ['difficulty_normal_v2', 'difficulty_elite_v2', 'difficulty_hell_v2',
  'chest_bronze_v2', 'chest_sapphire_v2', 'chest_crimson_v2', 'claim_button_v2']
  .map(key => 'preparation_art_v2/' + key)
  .concat(['levels_comic_v1/comic_star_v1', 'levels_comic_v1/comic_swords_v1']);
const heroChrome = ['hero_comic_v2/comic_bag_v2', 'hero_comic_v2/comic_attributes_v2',
  'hero_comic_v2/comic_story_v2', 'hero_comic_v2/comic_forge_v2',
  'hero_comic_v3/comic_cycle_button_v3', 'hero_comic_v3/comic_power_plate_v3'];

export function lobbyPageArt(tab: number, chapter: number): string[] {
  const save = loadSave(), hero = save.curHero || 'archer';
  const figure = heroLobbyIdleKey(hero) || heroFigureKey(hero);
  const roster = Object.keys(HERO_DEFS).map(heroPortraitKey);
  const gear = Object.values(EMPTY_GEAR).map(gearArtKey);
  if (tab === 2) return shared.concat(ROUTE_ART[Math.max(0, Math.min(ROUTE_ART.length - 1, chapter - 1))], preparation);
  if (tab === 4) return shared.concat(['scenes/bg_base_endless_v59', 'hero_comic_v2/comic_story_v2']);
  if (tab === 0) return shared.concat(['scenes/bg_shop_comic_v1'],
    ['comic_wpn_bow_v1', 'comic_armor_forest_v1', 'comic_mat_stone_v1'].map(key => SHOP_PREFIX + key),
    SHOP.map(item => item.give.kind === 'hero' ? item.give.id ? heroPortraitKey(item.give.id) : '' : gearArtKey(item.give.id)));
  const equipment = save.equips.map(item => gearArtKey(item.defId));
  const worn = Object.values(save.heroes[hero]?.worn || {}).filter(Boolean)
    .map(uid => save.equips.find(item => item.uid === uid)?.defId || '').filter(Boolean).map(gearArtKey);
  return shared.concat([tab === 3 ? 'scenes/bg_upgrade_comic_v1' : 'scenes/bg_heroes_comic_v3', figure],
    roster, heroChrome, gear, equipment, worn,
    ['mat_stone', 'mat_iron', 'mat_dust', 'mat_rune'].map(gearArtKey),
    tab === 3 ? ['ui_icon_atk_' + hero, 'ui_icon_skill_' + hero, 'ui_icon_ult_' + hero] : []);
}

/** Stage-specific materials and equipment use the very same IDs as the real drawer. */
export function warmCampaignPreparation(levelId: string, difficulty: number,
  priority: ArtPriority = 'next'): Promise<void> {
  const level = getChallengeDef(levelId, difficulty);
  const enemyAtlases = Array.from(new Set(level.waves.flatMap(wave => wave.groups.map(group => enemyArtRef(group.mob).atlas))));
  void prefetchUXArt(enemyAtlases.flatMap(atlas => [atlas + '.frames', atlas]));
  const drops = stageGuaranteedEntries(level).map(item => item.id).concat(level.gearPool.map(item => item.id));
  const art = drops.flatMap(id => id.startsWith('hero_') && HERO_DEFS[id.slice(5)]
    ? [heroPortraitKey(id.slice(5)), heroFigureKey(id.slice(5))]
    : [id === 'coin' ? SHOP_PREFIX + 'comic_coin_v1' : id === 'diamond' ? SHOP_PREFIX + 'comic_diamond_v1' : gearArtKey(id)]);
  return warmUXArt(shared.concat(preparation, art), priority);
}

/** Every reachable menu gets its actual catalog; larger distant scenes only download bytes. */
export function warmLobbyNavigation(currentTab: number, chapter: number): void {
  warmMobArmAlpha();
  const save = loadSave(), hero = save.curHero || 'archer';
  const order = [currentTab, ...[2, 1, 3, 0, 4].filter(tab => tab !== currentTab)];
  const foundations = order.map(tab => lobbyPageArt(tab, chapter));
  const backgrounds = foundations.flatMap(ids => ids.filter(id => id.startsWith('scenes/')));
  const portraits = Object.keys(HERO_DEFS).map(heroPortraitKey);
  const items = Object.keys(GEAR_ART).map(gearArtKey);
  const abilityIcons = Object.keys(HERO_DEFS).filter(id => save.heroes[id]?.owned)
    .flatMap(id => ['atk','skill','ult'].map(slot => 'ui_icon_' + slot + '_' + id));
  const reachable = CAMPAIGN_CHAPTERS.filter(c => campaignLevelOpen(c.number + '-1', save.stars));
  const chapterNeighbors = reachable.filter(c => Math.abs(c.number - chapter) <= 1).map(c => ROUTE_ART[c.number - 1]);
  void warmUXArt(shared.concat(backgrounds, portraits, preparation, heroChrome, chapterNeighbors), 'next').then(() => {
    // Current and next owned hero are ready to draw; other large sheets remain download-only.
    const owned = Object.keys(HERO_DEFS).filter(id => save.heroes[id]?.owned);
    const nextHero = owned[(Math.max(0, owned.indexOf(hero)) + 1) % Math.max(1, owned.length)];
    for (const id of new Set([hero, nextHero].filter(Boolean))) {
      if (supportsHeroLobbyIdle(id)) void warmHeroLobbyIdle(id, 'next');
      else void warmUXArt([heroFigureKey(id)], 'next');
    }
    const recruitReveals = SHOP.filter(item => item.give.kind === 'hero' && item.give.id
      && !save.heroes[item.give.id]?.owned && lvReached(item.unlock)).map(item => heroFigureKey(item.give.id));
    void warmUXArt(items.concat(abilityIcons, recruitReveals, BATTLE_COMMON_ART,
      ['base_comic_v1/comic_keep_heart_v1','levels_comic_v1/comic_difficulty_shield_v1']), 'idle');
    void warmPickArt(squadList(), 'next');
    owned.forEach(id => { if (supportsHeroLobbyIdle(id)) void prefetchHeroLobbyIdle(id); });
    const discoveries = CODEX.filter(c => save.codex?.includes(c.id)).map(c => enemyArtRef(c.id, true).atlas);
    void prefetchUXArt(reachable.flatMap(c => [ROUTE_ART[c.number - 1], c.battlefield])
      .concat(['scenes/bg_endless_world_v66'], discoveries.flatMap(atlas => [atlas + '.frames', atlas])));
  });
}
