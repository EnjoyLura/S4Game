/** Existing inventory illustrations and paper panels, backed by the actual drop configuration. */
import { Graphics, Node } from 'cc';
import { LO } from '../config/GameConfig';
import { ChallengeDef, DIFFICULTIES, equipmentDropChance } from '../config/LevelDifficulty';
import { EQUIPS, itemName, QCOLOR, QNAME } from '../core/GameData';
import { StageLootSummary } from '../core/StageLoot';
import { C, label, N } from './UIKit';
import { COMIC, comicArt, comicButton, comicDialog, comicPlate } from './ComicUI';
import { gearArt } from './HeroComic';

const pct = (value: number): string => (value * 100).toFixed(2) + '%';
export function stageLootPreview(parent: Node, h: number, level: ChallengeDef, modalParent: Node): void {
  const y = (top: number): number => h / 2 - top;
  const entries = [{ id: 'coin', n: level.baseGold }, ...level.materials];
  label(parent, -229, y(15), '通关必得', { size: 18, color: COMIC.sub, bold: true, w: 160, h: 26, align: 'left' });
  entries.forEach((row, i) => {
    const x = (i - (entries.length - 1) / 2) * 150;
    if (row.id === 'coin') comicArt(parent, x, y(56), 43, 43, 'comic_coin_v1');
    else gearArt(parent, x, y(56), 43, 43, row.id);
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
      const plate = comicPlate(parent, x, y(185), 62, 62, 'card', { cut: 7 });
      const quality = EQUIPS[row.id].quality;
      const mark = N('lootQuality', plate, 0, -25).addComponent(Graphics);
      mark.fillColor = C(QCOLOR[quality]); mark.rect(-20, 0, 40, 3); mark.fill();
      gearArt(plate, 0, 3, 49, 49, row.id);
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
    level.gearPool.forEach((row, i) => {
      const x = (i % 2 - .5) * 290, y = top - 281 - Math.floor(i / 2) * 112;
      const card = comicPlate(root, x, y, 278, 98, 'card', { cut: 8 });
      gearArt(card, -93, 3, 58, 58, row.id);
      label(card, 32, 20, itemName(row.id), { size: 20, color: COMIC.text, bold: true, w: 172, h: 28, shrink: true });
      label(card, 32, -17, QNAME[EQUIPS[row.id].quality] + '色 · ' + Math.round(row.weight / total * 100) + '%',
        { size: 17, color: COMIC.sub, w: 172, h: 26 });
    });
  } else label(root, 0, 0, '普通难度获得金币及强化材料\n精英和地狱难度解锁装备击杀掉落', { size: 22, color: COMIC.sub, w: 570, h: 80 });
  label(root, 0, -top + 68, '点击落地装备拾取 · 30个战斗秒后自动拾取', { size: 18, color: COMIC.text, w: 590, h: 28 });
  label(root, 0, -top + 36, '暂停 / 选卡冻结计时 · 结算 / 离场收回剩余装备', { size: 16, color: COMIC.sub, w: 590, h: 26 });
}

/** Bounded by the existing six equipment definitions; no enormous settlement list. */
export function showCollectedLoot(parent: Node, loot: StageLootSummary): void {
  const counts: Record<string, number> = {};
  for (const e of loot.equipment) counts[e.defId] = (counts[e.defId] || 0) + 1;
  const entries = [...loot.materials, ...Object.keys(counts).map(id => ({ id, n: counts[id] }))];
  const h = Math.min(740, 180 + Math.ceil(entries.length / 2) * 100);
  const root = comicDialog(parent, 640, h, '本局战利品 · 已收入背包');
  entries.forEach((row, i) => {
    const card = comicPlate(root, (i % 2 - .5) * 286, h / 2 - 132 - Math.floor(i / 2) * 100, 274, 88, 'card');
    gearArt(card, -88, 0, 53, 53, row.id);
    label(card, 34, 13, itemName(row.id), { size: 19, color: COMIC.text, w: 162, h: 28, shrink: true });
    label(card, 34, -19, '×' + row.n, { size: 20, color: COMIC.greenShade, bold: true, w: 162, h: 28 });
  });
}
