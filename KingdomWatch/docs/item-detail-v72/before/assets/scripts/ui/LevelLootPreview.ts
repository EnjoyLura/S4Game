/** Existing inventory illustrations and paper panels, backed by the actual drop configuration. */
import { Graphics, Mask, Node, ScrollView, UITransform } from 'cc';
import { LO } from '../config/GameConfig';
import { ChallengeDef, DIFFICULTIES, challengeEquipmentDropChance } from '../config/LevelDifficulty';
import { EQUIPS, equipStat, itemName, KIND_NAME, MATS, StatKey, STAT_NAME, statFmt, WEAPONS, weaponUsers } from '../core/GameData';
import { pyroRewardAvailable } from '../core/SecondJourney';
import { StageLootSummary } from '../core/StageLoot';
import { firstBowAvailable } from '../core/FirstJourney';
import { firstBookAvailable } from '../core/ThirdJourney';
import { FIFTH_LEVEL_GIFTS, fifthRewardsAvailable } from '../core/FifthLevelRewards';
import { earlyFirstWinGold } from '../core/EarlyEconomy';
import { C, label, N } from './UIKit';
import { COMIC, comicArt, comicButton, comicDialog, comicDialogContent, comicPlate, comicSurface } from './ComicUI';
import { gearArt, heroPortrait } from './HeroComic';
import { bindButton } from './ButtonFeedback';
import { gearPlate, gearQuality, gearQualityHalo } from './GearQuality';
import { dismissUI } from './UIMotion';
import { bindBrowserBack } from './BrowserBack';
import { CAMPAIGN_TEXT, paintCampaignRewardCard } from './CampaignChrome';
import { shopQualitySocket } from './LobbyChrome';
import { DETAIL_ACTION_FOOTER, DETAIL_WIDTH, DetailRow, detailActionY, detailBody, detailDialog, detailFooter,
  detailGroup, detailGroupHeight, detailHeight, detailOverview, detailParagraph, detailSkin } from './DetailDialog';

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
  scroll.inertia = true; scroll.elastic = false; scroll.brake = .7; scroll.cancelInnerEvents = true;
  return content;
}

/** Guaranteed clear rewards remain visible at every difficulty, separate from the equipment roll. */
export function stageGuaranteedRewards(parent: Node, x: number, y: number, width: number, level: ChallengeDef,
  onSelect: (id: string) => void, height = 76, campaign = false): void {
  const firstWinGold = earlyFirstWinGold(level.id, level.difficulty);
  const entries = [{ id: 'coin', n: level.baseGold + firstWinGold }, { id: 'diamond', n: level.baseDiamonds }, ...level.materials];
  if (firstBowAvailable(level.id, level.difficulty)) entries.push({ id: 'wpn_bow', n: 1 });
  if (firstBookAvailable(level.id, level.difficulty)) entries.push({ id: 'wpn_green_book', n: 1 });
  if (fifthRewardsAvailable(level.id, level.difficulty)) entries.push(...FIFTH_LEVEL_GIFTS.map(id => ({ id, n: 1 })));
  if (pyroRewardAvailable(level.id, level.difficulty)) entries.push({ id: 'hero_pyro', n: 1 });
  const gap = 12, w = (width - gap * (entries.length - 1)) / entries.length;
  entries.forEach((row, i) => {
    const card = comicSurface(parent, x + (i - (entries.length - 1) / 2) * (w + gap), y, w, height, 'card',
      { name: 'stageGuaranteedReward:' + row.id, radius: 12, fill: row.id === 'coin' ? '#F8DFA8' : COMIC.card });
    if (campaign) paintCampaignRewardCard(card,w,height);
    const iconSize = campaign ? Math.min(56,Math.max(40,w*.25)) : 46;
    const iconX = campaign ? -w/2+14+iconSize/2 : -w/2+29;
    const textX = campaign ? (iconSize+14)/2 : 26;
    const textW = campaign ? w-iconSize-36 : w-60;
    if (row.id === 'coin') comicArt(card,iconX,0,campaign ? iconSize : 44,campaign ? iconSize : 44,'comic_coin_v1');
    else if (row.id === 'diamond') comicArt(card,iconX,0,iconSize,iconSize,'comic_diamond_v1');
    else if (row.id === 'hero_pyro') heroPortrait(card, iconX, 0, iconSize, 'pyro');
    else {
      gearQualityHalo(card,iconX,0,iconSize,iconSize,1);
      gearArt(card,iconX,0,campaign ? iconSize*.85 : 39,campaign ? iconSize*.85 : 39,row.id);
    }
    label(card,textX,15,row.id === 'coin' ? firstWinGold ? '基础＋首胜' : '基础金币' : row.id === 'diamond' ? '钻石' : row.id === 'hero_pyro' ? '火法师' : itemName(row.id),
      {size:campaign ? 18 : 16,color:campaign ? CAMPAIGN_TEXT.body : COMIC.sub,w:textW,h:campaign ? 25 : 23,shrink:true});
    label(card,textX,-14,row.id === 'coin' ? row.n.toLocaleString()+'+' : row.id === 'hero_pyro' ? '首胜免费' : '×'+row.n.toLocaleString(),
      {size:campaign ? 24 : 22,color:campaign ? CAMPAIGN_TEXT.ink : COMIC.text,bold:true,w:textW,h:30,shrink:true});
    bindButton(card, () => onSelect(row.id), { dragThreshold: 7, sound: false });
  });
}

/** Local rarity wells for stage drops; the surrounding paper stays neutral and unframed. */
export function stageDropIcon(parent: Node, x: number, y: number, size: number, id: string): Node {
  const d = EQUIPS[id], tile = N('stageDropQualityTile:' + id, parent, x, y, size, size);
  gearQualityHalo(tile, 0, 0, size, size, d.quality);
  gearArt(tile, 0, 0, size * .84, size * .84, id);
  return tile;
}
export function stageLootPreview(parent: Node, h: number, level: ChallengeDef, modalParent: Node): void {
  const y = (top: number): number => h / 2 - top;
  const firstWinGold = earlyFirstWinGold(level.id, level.difficulty);
  const entries = [{ id: 'coin', n: level.baseGold + firstWinGold }, { id: 'diamond', n: level.baseDiamonds }, ...level.materials];
  if (firstBookAvailable(level.id, level.difficulty)) entries.push({ id: 'wpn_green_book', n: 1 });
  if (fifthRewardsAvailable(level.id, level.difficulty)) entries.push(...FIFTH_LEVEL_GIFTS.map(id => ({ id, n: 1 })));
  if (pyroRewardAvailable(level.id, level.difficulty)) entries.push({ id: 'hero_pyro', n: 1 });
  entries.forEach((row, i) => {
    const x = (i - (entries.length - 1) / 2) * 150;
    const icon = N('guaranteedLoot:' + row.id, parent, x, y(56), 76, 68);
    if (row.id === 'coin') comicArt(icon, 0, 0, 43, 43, 'comic_coin_v1');
    else if (row.id === 'diamond') comicArt(icon, 0, 0, 43, 43, 'comic_diamond_v1');
    else if (row.id === 'hero_pyro') heroPortrait(icon, 0, 0, 43, 'pyro');
    else {
      gearQualityHalo(icon, 0, 0, 48, 48, 1);
      gearArt(icon, 0, 0, 40, 40, row.id);
    }
    bindButton(icon, () => showDropItemDetails(modalParent, level, row.id), { sound: false });
    label(parent, x, y(92), row.id === 'coin' ? (firstWinGold ? '基础＋首胜 ' : '基础金币 ') + row.n + '+' : row.id === 'diamond' ? '钻石 ×' + row.n : row.id === 'hero_pyro' ? '火法师 · 首胜免费' : itemName(row.id) + ' ×' + row.n,
      { size: 17, color: COMIC.text, bold: true, w: 148, h: 24, shrink: true });
  });
  const line = N('lootPreviewDivider', parent).addComponent(Graphics);
  line.strokeColor = C(COMIC.paperShade); line.lineWidth = 1;
  line.moveTo(-320, y(113)); line.lineTo(320, y(113)); line.stroke();
  label(parent, 0, y(136), '概率掉落装备', { size: 18, color: COMIC.sub, bold: true, w: 600, h: 26 });
  const pool = level.gearPool;
  if (pool.length) {
    pool.slice(0, 6).forEach((row, i) => {
      const x = (i - (Math.min(6, pool.length) - 1) / 2) * 76;
      const tile = stageDropIcon(parent, x, y(185), 64, row.id);
      bindButton(tile, () => showDropItemDetails(modalParent, level, row.id), { dragThreshold: 7, sound: false });
    });
    label(parent, -75, y(h - 23), '每怪 ' + pct(challengeEquipmentDropChance(level)) + ' · 精英怪 ' + pct(challengeEquipmentDropChance(level, { elite: true })),
      { size: 15, color: COMIC.sub, w: 448, h: 24, shrink: true });
  } else label(parent, -65, y(181), firstBowAvailable(level.id, level.difficulty)
    ? '首次通关必得猎风长弓，回营后穿戴' : pyroRewardAvailable(level.id, level.difficulty)
    ? '首胜免费获得火法师，回营手动编队' : firstBookAvailable(level.id, level.difficulty)
    ? '首次通关必得翠纹秘典，直接存入背包' : fifthRewardsAvailable(level.id, level.difficulty)
    ? '首胜：巡林轻弩＋月纹坠饰' : '普通难度不掉装备，挑战精英 / 地狱获取', { size: 19, color: COMIC.sub, w: 480, h: 38, shrink: true });
  comicButton(parent, 241, y(h - 25), 138, 38, '掉落详情', () => showStageLootDetails(modalParent, level), { size: 18, tone: 'gold' });
}

export function showStageLootDetails(parent: Node, level: ChallengeDef): void {
  const h = Math.min(748, LO.half * 2 - 90), top = h / 2;
  const root = comicDialog(parent, 650, h, DIFFICULTIES[level.difficulty].name + ' · ' + level.id + ' 掉落');
  label(root, 0, top - 92, level.waves.length + ' 波 · 金币收益 ×' + DIFFICULTIES[level.difficulty].goldMul,
    { size: 20, color: COMIC.sub, w: 570, h: 28 });
  const rows = Math.ceil(level.gearPool.length / 2);
  const list = lootScroll(root, top - 116, -top + 100, rows ? 260 + rows * 116 : 258);
  stageGuaranteedRewards(list, 0, -48, 584, level, id => showDropItemDetails(parent, level, id, root));
  label(list, 0, -107, earlyFirstWinGold(level.id, level.difficulty)
    ? '金币含首胜加奖，击杀与星级加成另计 · 钻石通关到账' : '金币另有击杀收益 · 钻石每次通关结算到账',
    { size: 16, color: COMIC.sub, w: 584, h: 26, shrink: true });
  if (level.gearPool.length) {
    label(list, 0, -149, '概率掉落装备', { size: 21, color: COMIC.text, bold: true, w: 584, h: 30 });
    label(list, 0, -185, '普通怪 ' + pct(challengeEquipmentDropChance(level)) + ' / 精英怪 ' + pct(challengeEquipmentDropChance(level, { elite: true })),
      { size: 20, color: COMIC.greenShade, bold: true, w: 584, h: 30 });
    label(list, 0, -217, '下方百分比为装备掉落后，各件装备的抽取占比',
      { size: 16, color: COMIC.sub, w: 584, h: 26, shrink: true });
    const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
    level.gearPool.forEach((row, i) => {
      const x = (i % 2 - .5) * 298, y = -290 - Math.floor(i / 2) * 116;
      const quality = gearQuality(EQUIPS[row.id].quality);
      const card = comicSurface(list, x, y, 286, 104, 'card', { name: 'lootPoolItem:' + row.id, radius: 12 });
      stageDropIcon(card, -96, 0, 78, row.id);
      label(card, 42, 19, itemName(row.id), { size: 20, color: COMIC.text, bold: true, w: 184, h: 28, shrink: true });
      label(card, 42, -18, quality.name + ' · ' + Math.round(row.weight / total * 10000) / 100 + '%',
        { size: 17, color: COMIC.sub, w: 184, h: 26 });
      bindButton(card, () => showDropItemDetails(parent, level, row.id, root), { dragThreshold: 7, sound: false });
    });
  } else label(list, 0, -210, firstBowAvailable(level.id, level.difficulty)
    ? '首次通关必得绿色猎风长弓\n奖励存入背包，回营后自行穿戴' : pyroRewardAvailable(level.id, level.difficulty)
    ? '首胜免费获得火法师\n回营后手动加入第三个出战位置' : firstBookAvailable(level.id, level.difficulty)
    ? '首次通关必得绿色翠纹秘典\n火法师适用，奖励直接存入背包' : fifthRewardsAvailable(level.id, level.difficulty)
    ? '首胜必得巡林轻弩＋月纹坠饰\n各一件，直接存入背包，仅领取一次' : '普通难度不掉落装备\n挑战精英 / 地狱可获得概率装备',
    { size: 21, color: COMIC.sub, w: 570, h: 76, lineHeight: 32 });
  label(root, 0, -top + 68, rows ? '点击落地装备拾取 · 30个战斗秒后自动拾取' : '点击金币或钻石图标，查看奖励详情',
    { size: 18, color: COMIC.text, w: 590, h: 28 });
  label(root, 0, -top + 36, rows ? '暂停 / 选卡冻结计时 · 结算 / 离场收回剩余装备' : '通关收益随难度变化 · 星级宝箱单独领取',
    { size: 16, color: COMIC.sub, w: 590, h: 26 });
}

/** Item previews read level-one definitions, never inventory mutation or a purchase action. */
export function showDropItemDetails(parent: Node, level: ChallengeDef, id: string, back?: Node): void {
  if (id === 'hero_pyro') {
    const panel = detailDialog(parent, 620, 420, '首胜英雄 · 火法师', 'pyroFirstVictoryDetails');
    heroPortrait(panel, 0, 55, 108, 'pyro');
    label(panel, 0, -47, '首次通关普通1-2免费获得，仅一次。\n无需钻石，回营后自行加入出战编队。\n已拥有英雄保留全部培养，不重复发放。',
      { size: 22, color: COMIC.text, w: 540, h: 108, lineHeight: 32 });
    detailFooter(panel);
    comicButton(panel, 0, detailActionY(panel), 372, 58, '关闭', () => dismissUI(panel.parent), { tone: 'dark', sound: 'close' });
    return;
  }
  const d = EQUIPS[id], mat = MATS[id];
  if (!d && !mat && id !== 'coin' && id !== 'diamond') return;
  const source = level.id.startsWith('endless-') ? level.name : DIFFICULTIES[level.difficulty].name + ' · ' + level.id;
  const firstBow = id === 'wpn_bow' && firstBowAvailable(level.id, level.difficulty);
  const firstBook = id === 'wpn_green_book' && firstBookAvailable(level.id, level.difficulty);
  const fifthGift = level.id === '1-5' && level.difficulty === 0 && FIFTH_LEVEL_GIFTS.includes(id);
  const firstGift = firstBow || firstBook || fifthGift;
  const groups: { title: string; rows: DetailRow[] }[] = [];
  const firstWinGold = id === 'coin' ? earlyFirstWinGold(level.id, level.difficulty) : 0;
  const amount = id === 'coin' ? level.baseGold + firstWinGold : id === 'diamond' ? level.baseDiamonds : level.materials.find(row => row.id === id)?.n || 0;
  let delivery: string;
  if (d) {
    const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] || 0) > 0);
    const preview = { uid: 'drop-preview', defId: id, lv: 1 };
    groups.push({ title: '初始属性', rows: keys.map(key => [STAT_NAME[key], '+' + statFmt(key, equipStat(preview, key))]) });
    const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
    const weight = level.gearPool.find(row => row.id === id)?.weight || 0;
    const share = total > 0 ? weight / total : 0;
    const exactPct = (value: number): string => Number((value * 100).toFixed(4)) + '%';
    groups.push(firstGift ? { title: '首胜奖励', rows: [['获得条件', '首次通关普通' + level.id], ['获得数量', '必得1件 · 仅一次']] } : { title: '掉落概率', rows: [
      ['每次击杀普通怪', exactPct(challengeEquipmentDropChance(level) * share)],
      ['每次击杀精英怪', exactPct(challengeEquipmentDropChance(level, { elite: true }) * share)],
      ...(level.id.startsWith('endless-') ? [['每次击杀首领', exactPct(challengeEquipmentDropChance(level, { boss: true }) * share)]] as DetailRow[] : []),
      ['掉落后抽取占比', exactPct(share)],
    ] });
    delivery = (firstGift ? '首次通关后直接存入背包。' : share ? '' : '当前关卡难度不掉落此装备。') + (WEAPONS[id]
      ? weaponUsers(id) + '。装上后继承该英雄的武器培养等级。'
      : '拾取后收入背包，可在英雄页穿戴和强化。');
  } else {
    const rewardRows: DetailRow[] = [
      ['通关获得', id === 'coin' ? amount.toLocaleString() + '+' : '×' + amount.toLocaleString()],
      ['奖励来源', source],
    ];
    if (firstWinGold) rewardRows.push(['基础金币', level.baseGold + '+'], ['首胜加奖', '+' + firstWinGold + ' · 仅一次']);
    groups.push({ title: '关卡奖励', rows: rewardRows });
    delivery = id === 'coin' ? '通关结算获得基础金币、星级加成和击杀金币。'
      + (firstWinGold ? '首胜另加' + firstWinGold + '金币，仅一次；广告可加倍本局金币，重玩不再发首胜加奖。' : '')
      : id === 'diamond' ? '每次成功通关后直接存入钻石余额，重玩通关也可获得。广告仅加倍金币，不增加钻石；失败或中途退出不发放通关钻石。'
      : '通关结算后收入材料背包，可在英雄页查看与使用。';
  }
  const deliveryH = Math.max(50, Math.ceil(delivery.length / 28) * 25);
  const contentH = groups.reduce((sum, group) => sum + detailGroupHeight(group.rows.length), 0) + 38 + deliveryH + 8;
  const h = detailHeight(contentH), width = DETAIL_WIDTH;
  let root: Node;
  const close = (): void => {
    if (!root?.isValid) return;
    if (back?.isValid) {
      root.active = false; root.removeFromParent(); root.destroy(); back.active = true;
    } else dismissUI(root.parent);
  };
  // Catalog -> item -> catalog keeps the same dim layer and the original list/scroll position.
  if (back?.isValid && back.parent) {
    root = comicDialogContent(back.parent, width, h, '掉落物详情', close);
    detailSkin(root, width, h, '掉落物详情');
    back.active = false;
  } else root = detailDialog(parent, width, h, '掉落物详情', 'dropItemDetails:' + id);
  root.name = 'dropItemDetails:' + id;
  if (level.id.startsWith('endless-')) bindBrowserBack(root, close);
  detailOverview(root, d ? d.name : id === 'coin' ? firstWinGold ? '基础＋首胜金币' : '基础金币' : id === 'diamond' ? '钻石' : mat.name,
    d ? gearQuality(d.quality).name + ' · ' + KIND_NAME[d.kind] + ' · 初始 Lv.1' : id === 'coin' ? '金币 · 通关结算' : id === 'diamond' ? '钻石 · 通关结算' : '材料 · 通关结算',
    d && WEAPONS[id] ? weaponUsers(id) : undefined,
    d ? firstGift ? '普通' + level.id + '首胜奖励，必得一件，仅领取一次。' : source + ' 掉落。装备成功掉落后，按装备池权重抽取。' : id === 'coin' ? (firstWinGold ? '基础＋首胜 ' : '基础金币 ') + amount + '+' : id === 'diamond' ? '每次通关获得 ' + amount + ' 钻石' : mat.desc,
    (panel, x, y, side) => {
      if (id === 'coin') comicArt(panel, x, y, side - 20, side - 20, 'comic_coin_v1');
      else if (id === 'diamond') comicArt(panel, x, y, side - 20, side - 20, 'comic_diamond_v1');
      else {
        shopQualitySocket(panel, x, y, side, d?.quality ?? 1);
        gearArt(panel, x, y, side - 20, side - 20, id);
      }
    });
  const content = detailBody(root, contentH, DETAIL_ACTION_FOOTER, 'dropItem');
  let cursor = 0;
  groups.forEach(group => { cursor = detailGroup(content, cursor, group.title, group.rows); });
  detailParagraph(content, cursor, '获取说明', delivery, deliveryH);
  detailFooter(root);
  comicButton(root, 0, detailActionY(root), 372, 58, back ? '返回掉落列表' : '关闭', close,
    { name: 'dropItemDetailsClose', tone: 'dark', size: 22, sound: 'close' });
}

/** Aggregate duplicates and scroll larger collections rather than overflowing the paper. */
export function showCollectedLoot(parent: Node, loot: StageLootSummary): void {
  const counts: Record<string, number> = {};
  for (const e of loot.equipment) counts[e.defId] = (counts[e.defId] || 0) + 1;
  const entries = [...loot.materials, ...Object.keys(counts).map(id => ({ id, n: counts[id] })),
    ...(loot.heroes || []).filter(id => id === 'pyro').map(() => ({ id: 'hero_pyro', n: 1 }))];
  const h = Math.min(740, LO.half * 2 - 90, 180 + Math.ceil(entries.length / 2) * 100);
  const root = comicDialog(parent, 640, h, loot.heroes?.length ? '本局战利品 · 英雄已解锁' : '本局战利品 · 已收入背包');
  const list = lootScroll(root, h / 2 - 86, -h / 2 + 26, Math.ceil(entries.length / 2) * 100);
  entries.forEach((row, i) => {
    const d = EQUIPS[row.id], x = (i % 2 - .5) * 286, y = -46 - Math.floor(i / 2) * 100;
    const card = d ? gearPlate(list, x, y, 274, 88, d.quality) : comicPlate(list, x, y, 274, 88, 'card');
    gearQualityHalo(card, -88, 0, 60, 60, d ? d.quality : 1);
    if (row.id === 'hero_pyro') heroPortrait(card, -88, 0, 53, 'pyro');
    else gearArt(card, -88, 0, 53, 53, row.id);
    label(card, 34, 13, row.id === 'hero_pyro' ? '火法师 · 首胜免费' : itemName(row.id), { size: 19, color: COMIC.text, w: 162, h: 28, shrink: true });
    label(card, 34, -19, '×' + row.n, { size: 20, color: COMIC.greenShade, bold: true, w: 162, h: 28 });
  });
}
