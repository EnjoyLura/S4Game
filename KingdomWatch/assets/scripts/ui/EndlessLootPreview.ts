/** Endless loot uses the campaign's compact currency cards and real quality-colored item tiles. */
import { Node } from 'cc';
import { ChallengeDef, challengeEquipmentDropChance } from '../config/LevelDifficulty';
import { EQUIPS, itemName } from '../core/GameData';
import { COMIC, comicArt, comicButton, comicSurface } from './ComicUI';
import { campaignEquipmentHeading, paintCampaignRewardCard } from './CampaignChrome';
import { mainLabel } from './PageKit';
import { bindButton } from './ButtonFeedback';
import { stageDropIcon, showDropItemDetails } from './LevelLootPreview';
import { detailActionY, detailBody, detailDialog, detailFooter, detailHeight, detailOverview } from './DetailDialog';
import { gearQuality } from './GearQuality';
import { dismissUI } from './UIMotion';
import { bindBrowserBack } from './BrowserBack';
import { showItemDetails } from './ItemDetails';

const pct = (n: number): string => Number((n * 100).toFixed(2)) + '%';
export function endlessDropRates(level: ChallengeDef): string {
  return '普通怪 ' + pct(challengeEquipmentDropChance(level)) + ' · 精英怪 '
    + pct(challengeEquipmentDropChance(level, { elite: true })) + ' · 首领 '
    + pct(challengeEquipmentDropChance(level, { boss: true }));
}
export function endlessGoldCard(parent: Node, y: number, width: number, modalParent: Node): void {
  const card = comicSurface(parent, 0, y, width, 78, 'card', { name: 'endlessGoldReward' });
  paintCampaignRewardCard(card, width, 78);
  comicArt(card, -width / 2 + 46, 0, 55, 55, 'comic_coin_v1');
  mainLabel(card, 26, 17, '金币', { size: 20, w: width - 120, h: 28, color: COMIC.text });
  mainLabel(card, 26, -17, '击败怪物获得 · 每层自动保存', { size: 20, w: width - 120, h: 28, color: COMIC.text, bold: true });
  bindButton(card, () => showItemDetails(modalParent, 'coin', { source: '无尽挑战' }), { dragThreshold: 7, sound: false });
}
export function endlessEquipmentHeading(parent: Node, y: number): void {
  campaignEquipmentHeading(parent, y);
  mainLabel(parent, 0, y, '概率掉落装备', { size: 21, bold: true, color: COMIC.text, w: 240, h: 32 });
}
export function showEndlessLootDetails(parent: Node, level: ChallengeDef): void {
  const rows = Math.ceil(level.gearPool.length / 2), bodyH = 190 + rows * 112;
  const panel = detailDialog(parent, 650, detailHeight(bodyH, 100, 700, 650), '挑战掉落', 'endlessLootCatalog');
  const close = (): void => dismissUI(panel.parent);
  bindBrowserBack(panel, close);
  detailOverview(panel, level.name, '金币与装备 · 持续攀层', undefined,
    '每次从第1层开始，每5层有首领。金币、装备在通层或结束挑战时保存，装备存入背包。',
    (host,x,y,side) => comicArt(host,x,y,side-20,side-20,'comic_coin_v1'));
  const list = detailBody(panel, bodyH, 100, 'endlessLoot');
  mainLabel(list, 0, -24, endlessDropRates(level), { size: 19, color: COMIC.greenShade, w: 580, h: 32, bold: true });
  mainLabel(list, 0, -64, '金币与装备随战斗获得 · 每5层有首领', { size: 19, color: COMIC.sub, w: 580, h: 30 });
  mainLabel(list, 0, -104, '下方为装备掉落后各件的抽取占比', { size: 18, color: COMIC.sub, w: 580, h: 30 });
  const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
  level.gearPool.forEach((row, i) => {
    const card = comicSurface(list, (i % 2 - .5) * 294, -186 - Math.floor(i / 2) * 112, 282, 102, 'card',
      { name: 'endlessCatalogItem:' + row.id, radius: 12 });
    stageDropIcon(card, -94, 0, 74, row.id);
    mainLabel(card, 42, 18, itemName(row.id), { size: 20, bold: true, color: COMIC.text, w: 178, h: 30 });
    mainLabel(card, 42, -20, gearQuality(EQUIPS[row.id].quality).name + ' · ' + pct(row.weight / total),
      { size: 17, color: COMIC.sub, w: 178, h: 26 });
    bindButton(card, () => showDropItemDetails(parent, level, row.id, panel), { dragThreshold: 7 });
  });
  detailFooter(panel, 100);
  comicButton(panel, 0, detailActionY(panel), 440, 58, '返回', close, { tone: 'dark', sound: 'close' });
}
