/** Read-only item facts shared by receipts, settlements and drop previews. */
import { Node, ScrollView, isValid } from 'cc';
import { EQUIPS, HERO_DEFS, KIND_NAME, MATS, SHOP, StatKey, STAT_NAME, WEAPONS,
  equipStat, statFmt, weaponUsers } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { COMIC, comicArt, comicButton, comicDialogContent, comicPlate } from './ComicUI';
import { DetailRow, DETAIL_ACTION_FOOTER, DETAIL_WIDTH, detailActionY, detailBody,
  detailFooter, detailGroup, detailGroupHeight, detailHeight, detailOverview, detailParagraph,
  detailSection, detailSkin } from './DetailDialog';
import { gearArt, heroPortrait } from './HeroComic';
import { gearQuality } from './GearQuality';
import { lobbyAttributeWell, shopQualitySocket } from './LobbyChrome';
import { mainLabel } from './PageKit';
import { dimLayer } from './UIKit';
import { dismissUI } from './UIMotion';
import { bindBrowserBack } from './BrowserBack';

export interface ItemDetailSource { title: string; note: string; art?: string; }
export interface ItemDetailGroup { title: string; rows: readonly DetailRow[]; }
export interface ItemDetailOptions {
  /** An actual receipt amount; previews use their own explicitly labelled group. */
  amount?: number;
  source?: string;
  groups?: readonly ItemDetailGroup[];
  sources?: readonly ItemDetailSource[];
  note?: string;
  /** Keep a catalog and its scroll position on the same backdrop. */
  back?: Node;
}
interface ItemFacts {
  id: string; name: string; meta: string; owned: string; description: string;
  quality?: number; hero?: string; groups: ItemDetailGroup[]; sources: ItemDetailSource[];
}
const activeDetails = new WeakMap<Node, Node>();
const count = (value: number): string => Math.max(0, Math.floor(value || 0)).toLocaleString('en-US');
const source = (title: string, note: string, art = 'comic_nav_map_v1'): ItemDetailSource => ({ title, note, art });

/** Always resolve semantic IDs, never infer identity from translated names or illustration paths. */
function itemFacts(rawId: string): ItemFacts | null {
  const id = rawId === 'gold' ? 'coin' : rawId === 'diamonds' ? 'diamond' : rawId;
  const save = loadSave(), hero = id.startsWith('hero_') ? id.slice(5) : id;
  if (id === 'coin') return { id, name: '金币', meta: '通用货币', owned: '拥有：' + count(save.gold),
    description: '王国中广泛使用的基础货币。可用于英雄培养、装备强化与商城购买。', groups: [],
    sources: [source('主线关卡', '通关、击杀与星级宝箱奖励', 'comic_nav_castle_v1'),
      source('无尽挑战', '击败怪物获得，通层或结束时保存')] };
  if (id === 'diamond') return { id, name: '钻石', meta: '珍贵货币', owned: '拥有：' + count(save.diamonds),
    description: '可用于商城招募英雄和购买武器。每次成功通关均可获得钻石，数量随难度变化。', groups: [],
    sources: [source('主线关卡', '成功通关与星级宝箱奖励', 'comic_nav_castle_v1'),
      source('怪物图鉴', '首次查看已发现的怪物可领取奖励', 'comic_nav_castle_v1')] };
  if (id === 'xp') return { id, name: '本局经验', meta: '战斗成长', owned: '仅在本局生效',
    description: '击败怪物获得的本局经验。经验条充满时升级并选择强化卡，用于本局构筑。', groups: [],
    sources: [source('击败怪物', '经验仅用于本局升级选卡，不存入背包', 'levels_comic_v1/comic_swords_v1')] };
  const mat = MATS[id], equip = EQUIPS[id], def = HERO_DEFS[hero];
  if (mat) return { id, name: mat.name, meta: '强化材料', quality: 1,
    owned: '拥有：' + count(save.bag[id] || 0), description: mat.desc + '。在英雄页的培养界面按实际消耗使用。',
    groups: [], sources: [source('商城', '在材料分类中使用金币购买', 'comic_nav_shop_v1')] };
  if (equip) {
    const preview = { uid: 'item-detail-preview', defId: id, lv: 1 };
    const rows: DetailRow[] = (Object.keys(equip.stats) as StatKey[]).filter(key => (equip.stats[key] || 0) > 0)
      .map(key => [STAT_NAME[key], '+' + statFmt(key, equipStat(preview, key, undefined, 1))]);
    const sources: ItemDetailSource[] = [];
    if (SHOP.some(row => row.give.kind === 'equip' && row.give.id === id))
      sources.push(source('商城', '解锁对应关卡后，在' + (WEAPONS[id] ? '武器' : '装备') + '分类购买', 'comic_nav_shop_v1'));
    if (['wpn_bow','wpn_green_crossbow','wpn_green_book','wpn_green_staff','acc_moon','helm_falcon','glove_wind','armor_forest','wpn_crossbow'].includes(id))
      sources.push(source('关卡掉落', '精英、地狱或无尽挑战，具体范围以掉落列表为准'));
    const gift = ({ wpn_bow: '1-1', wpn_green_book: '1-3', wpn_green_crossbow: '1-5', acc_moon: '1-5' } as Record<string,string>)[id];
    if (gift) sources.push(source('主线首胜', '首次通关普通' + gift + '获得，仅一次', 'comic_nav_castle_v1'));
    if (!sources.length) sources.push(source('初始装备', '对应英雄解锁时获得', 'comic_nav_castle_v1'));
    return { id, name: equip.name, quality: equip.quality,
      meta: gearQuality(equip.quality).name + ' · ' + KIND_NAME[equip.kind] + ' · ' + equip.tier + '阶',
      owned: '拥有：' + count(save.equips.filter(item => item.defId === id).length) + '件（含已穿戴）',
      description: (equip.description || (equip.focus ? '侧重' + equip.focus + '的' + KIND_NAME[equip.kind] + '。' : '可在英雄页穿戴与培养的' + KIND_NAME[equip.kind] + '。'))
        + (WEAPONS[id] ? weaponUsers(id) + '。穿戴后继承该英雄的武器培养等级。' : '所有英雄均可穿戴，每件装备独立强化。'),
      groups: [{ title: '初始属性 · Lv.1', rows }], sources };
  }
  if (def) return { id: 'hero_' + hero, hero, name: def.name, meta: '英雄 · ' + def.job,
    owned: save.heroes[hero]?.owned ? '已拥有 · Lv.' + save.heroes[hero].lv : '尚未解锁',
    description: def.story + '解锁后可在编队中手动加入出战。',
    groups: [{ title: '英雄能力', rows: [['技能', def.skillName], ['大招', def.ultName]] }],
    sources: [hero === 'pyro' ? source('主线首胜', '首次通关普通1-2免费获得，仅一次', 'comic_nav_castle_v1')
      : hero === 'archer' ? source('初始英雄', '初次进入游戏即可使用', 'comic_nav_castle_v1')
      : source('商城', '解锁对应关卡后，使用钻石招募', 'comic_nav_shop_v1')] };
  return null;
}

/** A child modal never acknowledges a receipt, redraws its parent, grants loot or changes battle state. */
export function showItemDetails(parent: Node, id: string, options: ItemDetailOptions = {}): Node | null {
  const facts = itemFacts(id);
  if (!facts || !isValid(parent, true)) return null;
  const back = options.back?.isValid && options.back.parent ? options.back : undefined;
  const host = back?.parent || parent, existing = activeDetails.get(host);
  if (existing && isValid(existing, true)) return existing;
  const groups = options.groups || facts.groups, sources = options.sources || facts.sources;
  const descriptionH = Math.max(76, Math.ceil(facts.description.length / 25) * 27 + 20);
  const noteH = options.note ? Math.max(64, Math.ceil(options.note.length / 26) * 25 + 16) : 0;
  const sourcesH = sources.length ? 38 + sources.length * 100 + 8 : 0;
  const contentH = 38 + descriptionH + 8 + groups.reduce((sum, group) => sum + detailGroupHeight(group.rows.length), 0)
    + (noteH ? 38 + noteH + 8 : 0) + sourcesH;
  const height = detailHeight(contentH, DETAIL_ACTION_FOOTER, 700), width = DETAIL_WIDTH;
  const overlay = dimLayer(host, back ? 0 : .54, false);
  overlay.name = 'itemDetailsOverlay:' + facts.id; activeDetails.set(host, overlay);
  let closing = false;
  const close = (): void => {
    if (closing || !isValid(overlay, true)) return;
    closing = true;
    dismissUI(overlay, () => {
      if (back?.isValid) back.active = true;
      if (activeDetails.get(host) === overlay) activeDetails.delete(host);
    });
  };
  overlay.on(Node.EventType.TOUCH_END, (event: { propagationStopped?: boolean }) => {
    event.propagationStopped = true; close();
  });
  bindBrowserBack(overlay, close);
  const panel = comicDialogContent(overlay, width, height, '物品详情', close);
  panel.name = 'itemDetails:' + facts.id; detailSkin(panel, width, height, '物品详情');
  if (back) back.active = false;
  detailOverview(panel, facts.name, facts.meta, undefined, '', (owner, x, y, side) => {
    if (facts.quality !== undefined) shopQualitySocket(owner, x, y, side, facts.quality);
    else comicPlate(owner, x, y, side, side, 'card', { name: 'itemDetailIconSocket', cut: 10 });
    if (facts.hero) heroPortrait(owner, x, y, side - 20, facts.hero);
    else if (facts.id === 'coin' || facts.id === 'diamond')
      comicArt(owner, x, y, side - 18, side - 18, facts.id === 'coin' ? 'comic_coin_v1' : 'comic_diamond_v1');
    else if (facts.id === 'xp') comicArt(owner, x, y, side - 28, side - 28, 'hero_comic_v2/comic_attributes_v2');
    else gearArt(owner, x, y, side - 20, side - 20, facts.id);
  });
  const top = height / 2;
  const owned = lobbyAttributeWell(panel, 80, top - 214, 328, 50, 'itemOwnedCount');
  mainLabel(owned, 0, 0, facts.owned, { size: 22, bold: true, color: '#8B570C', align: 'left', w: 300, h: 34 });
  if (options.amount !== undefined) mainLabel(panel, 80, top - 257,
    (facts.id === 'xp' ? '本局获得：' : '本次获得：') + count(options.amount) + (facts.hero ? '位' : ''),
    { size: 19, color: COMIC.sub, align: 'left', w: 328, h: 28 });
  else if (options.source) mainLabel(panel, 80, top - 257, options.source,
    { size: 18, color: COMIC.sub, align: 'left', w: 328, h: 28 });
  const content = detailBody(panel, contentH, DETAIL_ACTION_FOOTER, 'itemDetails');
  const scroll = content.parent!.getComponent(ScrollView)!;
  scroll.inertia = true; scroll.elastic = false; scroll.cancelInnerEvents = true;
  let cursor = detailParagraph(content, 0, facts.hero ? '英雄介绍' : '道具说明', facts.description, descriptionH, width, true);
  groups.forEach(group => { cursor = detailGroup(content, cursor, group.title, group.rows); });
  if (options.note) cursor = detailParagraph(content, cursor, '获取说明', options.note, noteH, width, true);
  if (sources.length) {
    cursor = detailSection(content, cursor, '获取途径');
    sources.forEach(row => {
      const card = lobbyAttributeWell(content, 0, -cursor - 45, width - 68, 90, 'itemSource:' + row.title);
      comicArt(card, -225, 0, 64, 64, row.art || 'comic_nav_map_v1');
      mainLabel(card, 35, 19, row.title, { size: 24, bold: true, color: '#20303B', align: 'left', w: 410, h: 32 });
      mainLabel(card, 35, -20, row.note, { size: 18, color: COMIC.sub, align: 'left', w: 410, h: 32 });
      cursor += 100;
    });
  }
  detailFooter(panel);
  comicButton(panel, 0, detailActionY(panel), 372, 58, back ? '返回掉落列表' : '关闭', close,
    { name: 'itemDetailsClose', tone: 'dark', size: 24, sound: 'close' });
  return overlay;
}
