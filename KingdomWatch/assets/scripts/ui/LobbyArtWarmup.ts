/** Small, predictable lobby dependencies. Never preload every chapter or every hero animation. */
import { HERO_DEFS, SHOP } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { getChallengeDef } from '../config/LevelDifficulty';
import { ArtPriority, warmUXArt } from './Ux';
import { EMPTY_GEAR, gearArtKey, heroPortraitKey } from './HeroComic';
import { ROUTE_ART } from './CampaignRoute';
import { stageGuaranteedEntries } from './LevelLootPreview';

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
  const figure = 'hero_comic_v1/comic_figure_' + hero + (hero === 'archer' ? '_v2' : '_v1');
  const roster = Object.keys(HERO_DEFS).map(heroPortraitKey);
  const gear = Object.values(EMPTY_GEAR).map(gearArtKey);
  if (tab === 2) return shared.concat(ROUTE_ART[Math.max(0, Math.min(ROUTE_ART.length - 1, chapter - 1))], preparation);
  if (tab === 4) return shared.concat(['scenes/bg_base_endless_v59', 'hero_comic_v2/comic_story_v2']);
  if (tab === 0) return shared.concat(['scenes/bg_shop_comic_v1'],
    ['comic_wpn_bow_v1', 'comic_armor_forest_v1', 'comic_mat_stone_v1'].map(key => SHOP_PREFIX + key),
    SHOP.filter(item => item.tab === 'weapon').slice(0, 9).map(item => gearArtKey(item.give.id)));
  const equipment = save.equips.slice(0, 18).map(item => gearArtKey(item.defId));
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
  const drops = stageGuaranteedEntries(level).map(item => item.id).concat(level.gearPool.map(item => item.id));
  const art = drops.map(id => id === 'coin' ? SHOP_PREFIX + 'comic_coin_v1'
    : id === 'diamond' ? SHOP_PREFIX + 'comic_diamond_v1'
    : id === 'hero_pyro' ? heroPortraitKey('pyro') : gearArtKey(id));
  return warmUXArt(shared.concat(preparation, art), priority);
}

/** Only nearby navigation surfaces; all other chapter maps and video sheets stay on demand. */
export function warmLobbyNavigation(currentTab: number, chapter: number): void {
  // Backgrounds and portraits precede the larger, data-dependent inventory catalogs.
  const order = [2, 1, 3, 0, 4].filter(tab => tab !== currentTab);
  const foundations = order.map(tab => lobbyPageArt(tab, chapter));
  void warmUXArt(shared.concat(...foundations.map(ids => ids.filter(id => id.startsWith('scenes/')
    || id.includes('comic_figure_') || id.includes('comic_hero_')))), 'next')
    .then(() => warmUXArt([].concat(...foundations), 'idle'));
}
