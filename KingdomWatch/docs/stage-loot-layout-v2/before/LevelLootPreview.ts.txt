/** Existing inventory illustrations and paper panels, backed by the actual drop configuration. */
import { Graphics, Mask, Node, ScrollView, UITransform } from 'cc';
import { LO } from '../config/GameConfig';
import { ChallengeDef, DIFFICULTIES, equipmentDropChance } from '../config/LevelDifficulty';
import { EQUIPS, equipStat, itemName, KIND_NAME, MATS, StatKey, STAT_NAME, statFmt, WEAPONS, weaponUsers } from '../core/GameData';
import { StageLootSummary } from '../core/StageLoot';
import { C, label, N } from './UIKit';
import { COMIC, comicArt, comicButton, comicDialog, comicDialogContent, comicPlate } from './ComicUI';
import { gearArt } from './HeroComic';
import { bindButton } from './ButtonFeedback';
import { gearPlate, gearQuality, gearQualityHalo, gearQualityTag } from './GearQuality';
import { dismissUI } from './UIMotion';

const pct = (value: number): string => (value * 100).toFixed(2) + '%';
/** Keep expanded loot catalogs inside the existing dialog, including smaller viewports. */
function lootScroll(parent: Node, top: number, bottom: number, contentHeight: number): Node {
  const height = top - bottom;
  const view = N('lootListView', parent, 0, (top + bottom) / 2, 596, height);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const content = N('lootListContent', view, 0, height / 2, 596, Math.max(height, contentHeight));
  content.getComponent(UITransform)!.setAnchorPoint(.5, 1);
  scroll.content = content; scroll.horizontal = false; scroll.vertical = contentHeight > height;
  return content;
}
export function stageLootPreview(parent: Node, h: number, level: ChallengeDef, modalParent: Node): void {
  const y = (top: number): number => h / 2 - top;
  const entries = [{ id: 'coin', n: level.baseGold }, ...level.materials];
  label(parent, -229, y(15), '通关必得', { size: 18, color: COMIC.sub, bold: true, w: 160, h: 26, align: 'left' });
  entries.forEach((row, i) => {
    const x = (i - (entries.length - 1) / 2) * 150;
    const icon = N('guaranteedLoot:' + row.id, parent, x, y(56), 76, 68);
    if (row.id === 'coin') comicArt(icon, 0, 0, 43, 43, 'comic_coin_v1');
    else gearArt(icon, 0, 0, 43, 43, row.id);
    bindButton(icon, () => showDropItemDetails(modalParent, level, row.id), { sound: false });
    label(parent, x, y(92), row.id === 'coin' ? '基础金币 ' + row.n + '+' : itemName(row.id) + ' ×' + row.n,
      { size: 17, color: COMIC.text, bold: true, w: 148, h: 24, shrink: true });
  });
  const line = N('lootPreviewDivider', parent).addComponent(Graphics);
  line.strokeColor = C(COMIC.paperShade); line.lineWidth = 1;
  line.moveTo(-320, y(113)); line.lineTo(320, y(113)); line.stroke();
  label(parent, -217, y(136), '击杀概率掉落', { size: 18, color: COMIC.sub, bold: true, w: 188, h: 26, align: 'left' });
  const pool = level.gearPool;
  if (pool.length) {
    pool.slice(0, 6).forEach((row, i) => {
      const x = (i - (Math.min(6, pool.length) - 1) / 2) * 76;
      const quality = EQUIPS[row.id].quality;
      const plate = gearPlate(parent, x, y(185), 64, 64, quality, { name: 'stageLootIcon:' + row.id, cut: 7 });
      gearQualityHalo(plate, 0, 0, 50, 50, quality);
      gearArt(plate, 0, 0, 51, 51, row.id);
      gearQualityTag(plate, -8, 21, quality, EQUIPS[row.id].tier, 40, 14);
      bindButton(plate, () => showDropItemDetails(modalParent, level, row.id), { sound: false });
    });
    label(parent, -75, y(h - 23), '每怪 ' + pct(equipmentDropChance(level.difficulty)) + ' · 精英怪 ' + pct(equipmentDropChance(level.difficulty, { elite: true })),
      { size: 15, color: COMIC.sub, w: 448, h: 24, shrink: true });
  } else label(parent, -65, y(181), '普通难度不掉装备，挑战精英 / 地狱获取', { size: 19, color: COMIC.sub, w: 480, h: 38, shrink: true });
  comicButton(parent, 241, y(h - 25), 138, 38, '掉落详情', () => showStageLootDetails(modalParent, level), { size: 18, tone: 'gold' });
}

export function showStageLootDetails(parent: Node, level: ChallengeDef): void {
  const h = Math.min(748, LO.half * 2 - 90), top = h / 2;
  const root = comicDialog(parent, 650, h, DIFFICULTIES[level.difficulty].name + ' · ' + level.id + ' 掉落');
  label(root, 0, top - 92, level.waves.length + ' 波 · 金币收益 ×' + DIFFICULTIES[level.difficulty].goldMul,
    { size: 20, color: COMIC.sub, w: 570, h: 28 });
  label(root, 0, top - 130, '通关材料：' + level.materials.map(row => itemName(row.id) + ' ×' + row.n).join('、'),
    { size: 19, color: COMIC.text, w: 580, h: 30, shrink: true });
  if (level.gearPool.length) {
    label(root, 0, top - 176, '普通怪 ' + pct(equipmentDropChance(level.difficulty)) + ' / 精英怪 ' + pct(equipmentDropChance(level.difficulty, { elite: true })),
      { size: 20, color: COMIC.greenShade, bold: true, w: 570, h: 30 });
    label(root, 0, top - 211, '下方比例为装备成功掉落后，各装备的抽取占比', { size: 16, color: COMIC.sub, w: 570, h: 26 });
    const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
    const list = lootScroll(root, top - 236, -top + 98, Math.ceil(level.gearPool.length / 2) * 112);
    level.gearPool.forEach((row, i) => {
      const x = (i % 2 - .5) * 290, y = -49 - Math.floor(i / 2) * 112;
      const quality = gearQuality(EQUIPS[row.id].quality);
      const card = gearPlate(list, x, y, 278, 98, EQUIPS[row.id].quality, { name: 'lootPoolItem:' + row.id });
      gearQualityHalo(card, -93, 3, 68, 68, EQUIPS[row.id].quality);
      gearArt(card, -93, 3, 58, 58, row.id);
      gearQualityTag(card, -101, 35, EQUIPS[row.id].quality, EQUIPS[row.id].tier, 64, 18);
      label(card, 32, 20, itemName(row.id), { size: 20, color: COMIC.text, bold: true, w: 172, h: 28, shrink: true });
      label(card, 32, -17, quality.name + ' · ' + Math.round(row.weight / total * 10000) / 100 + '%',
        { size: 17, color: COMIC.sub, w: 172, h: 26 });
      bindButton(card, () => showDropItemDetails(parent, level, row.id, root), { sound: false });
    });
  } else label(root, 0, 0, '普通难度获得金币及强化材料\n精英和地狱难度解锁装备击杀掉落', { size: 22, color: COMIC.sub, w: 570, h: 80 });
  label(root, 0, -top + 68, '点击落地装备拾取 · 30个战斗秒后自动拾取', { size: 18, color: COMIC.text, w: 590, h: 28 });
  label(root, 0, -top + 36, '暂停 / 选卡冻结计时 · 结算 / 离场收回剩余装备', { size: 16, color: COMIC.sub, w: 590, h: 26 });
}

/** Item previews read level-one definitions, never inventory mutation or a purchase action. */
export function showDropItemDetails(parent: Node, level: ChallengeDef, id: string, back?: Node): void {
  const d = EQUIPS[id], mat = MATS[id];
  if (!d && !mat && id !== 'coin') return;
  const h = Math.min(d ? 748 : 490, LO.half * 2 - 90), top = h / 2;
  let root: Node;
  const close = (): void => {
    if (!root?.isValid) return;
    if (back?.isValid) {
      root.active = false; root.removeFromParent(); root.destroy(); back.active = true;
    } else dismissUI(root.parent);
  };
  // Catalog -> item -> catalog keeps the same dim layer and the original list/scroll position.
  if (back?.isValid && back.parent) {
    root = comicDialogContent(back.parent, 650, h, '掉落物详情', close);
    back.active = false;
  } else root = comicDialog(parent, 650, h, '掉落物详情');
  root.name = 'dropItemDetails:' + id;
  if (d) {
    const icon = gearPlate(root, -218, top - 146, 120, 120, d.quality);
    gearQualityHalo(icon, 0, 0, 96, 96, d.quality);
    gearArt(icon, 0, 0, 106, 106, id);
    gearQualityTag(icon, -18, 45, d.quality, d.tier, 72, 20);
    label(root, 64, top - 126, d.name, { size: 27, color: COMIC.text, bold: true, font: 'body',
      w: 350, h: 38, align: 'left', shrink: true });
    label(root, 64, top - 170, gearQuality(d.quality).name + ' · ' + d.tier + '阶 · ' + KIND_NAME[d.kind] + ' · 初始 Lv.1',
      { size: 19, color: COMIC.sub, w: 350, h: 30, align: 'left', shrink: true });
    const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] || 0) > 0);
    const list = lootScroll(root, top - 228, -top + 91, 294 + keys.length * 44);
    label(list, 0, -15, '初始装备属性', { size: 21, color: COMIC.text, bold: true, w: 550, h: 30, align: 'left' });
    let cursor = 50;
    const preview = { uid: 'drop-preview', defId: id, lv: 1 };
    keys.forEach((key, i) => {
      const row = comicPlate(list, 0, -cursor, 554, 38, i % 2 ? 'paper' : 'card', { cut: 5, edge: false });
      label(row, -133, 0, STAT_NAME[key], { size: 20, color: COMIC.sub, w: 240, h: 30, align: 'left' });
      label(row, 133, 0, '+' + statFmt(key, equipStat(preview, key)), { size: 22, color: COMIC.text,
        bold: true, w: 240, h: 30, align: 'right' });
      cursor += 44;
    });
    const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
    const weight = level.gearPool.find(row => row.id === id)?.weight || 0;
    const share = total > 0 ? weight / total : 0;
    const exactPct = (value: number): string => Number((value * 100).toFixed(4)) + '%';
    label(list, 0, -cursor - 9, DIFFICULTIES[level.difficulty].name + ' · ' + level.id + ' 掉落概率',
      { size: 21, color: COMIC.text, bold: true, w: 550, h: 30, align: 'left' });
    label(list, 0, -cursor - 72, share ? '每次击杀普通怪 ' + exactPct(equipmentDropChance(level.difficulty) * share)
      + '\n每次击杀精英怪 ' + exactPct(equipmentDropChance(level.difficulty, { elite: true }) * share) : '当前关卡难度不掉落此装备',
      { size: 20, color: COMIC.text, bold: true, w: 550, h: 66, lineHeight: 31, align: 'left', shrink: true });
    label(list, 0, -cursor - 131, '装备成功掉落后，此装备的抽取占比：' + exactPct(share),
      { size: 17, color: COMIC.sub, w: 550, h: 30, align: 'left', shrink: true });
    label(list, 0, -cursor - 190, WEAPONS[id] ? weaponUsers(id) + '\n装上后继承该英雄的武器培养等级'
      : '拾取后收入背包，可在英雄页穿戴和强化',
      { size: 19, color: COMIC.text, w: 550, h: 66, lineHeight: 29, align: 'left', shrink: true });
  } else {
    const amount = id === 'coin' ? level.baseGold : level.materials.find(row => row.id === id)?.n || 0;
    if (id === 'coin') comicArt(root, 0, top - 139, 94, 94, 'comic_coin_v1');
    else gearArt(root, 0, top - 139, 94, 94, id);
    label(root, 0, top - 218, id === 'coin' ? '基础金币 ' + amount + '+' : mat.name + ' ×' + amount,
      { size: 25, color: COMIC.text, bold: true, w: 550, h: 36 });
    label(root, 0, top - 284, id === 'coin' ? '通关结算获得基础金币，战斗击杀收益另计。' : mat.desc,
      { size: 21, color: COMIC.text, w: 550, h: 64, lineHeight: 30, shrink: true });
    label(root, 0, -top + 114, DIFFICULTIES[level.difficulty].name + ' · ' + level.id + ' 通关必得',
      { size: 19, color: COMIC.greenShade, w: 550, h: 30 });
  }
  comicButton(root, 0, -top + 43, 372, 56, back ? '返回掉落列表' : '关闭', close,
    { name: 'dropItemDetailsClose', tone: 'dark', size: 22, sound: 'close' });
}

/** Aggregate duplicates and scroll larger collections rather than overflowing the paper. */
export function showCollectedLoot(parent: Node, loot: StageLootSummary): void {
  const counts: Record<string, number> = {};
  for (const e of loot.equipment) counts[e.defId] = (counts[e.defId] || 0) + 1;
  const entries = [...loot.materials, ...Object.keys(counts).map(id => ({ id, n: counts[id] }))];
  const h = Math.min(740, LO.half * 2 - 90, 180 + Math.ceil(entries.length / 2) * 100);
  const root = comicDialog(parent, 640, h, '本局战利品 · 已收入背包');
  const list = lootScroll(root, h / 2 - 86, -h / 2 + 26, Math.ceil(entries.length / 2) * 100);
  entries.forEach((row, i) => {
    const d = EQUIPS[row.id], x = (i % 2 - .5) * 286, y = -46 - Math.floor(i / 2) * 100;
    const card = d ? gearPlate(list, x, y, 274, 88, d.quality) : comicPlate(list, x, y, 274, 88, 'card');
    if (d) gearQualityHalo(card, -88, 0, 60, 60, d.quality);
    gearArt(card, -88, 0, 53, 53, row.id);
    if (d) gearQualityTag(card, -97, 31, d.quality, d.tier, 68, 18);
    label(card, 34, 13, itemName(row.id), { size: 19, color: COMIC.text, w: 162, h: 28, shrink: true });
    label(card, 34, -19, '×' + row.n, { size: 20, color: COMIC.greenShade, bold: true, w: 162, h: 28 });
  });
}
