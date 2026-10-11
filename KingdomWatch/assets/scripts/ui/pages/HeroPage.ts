/** Hero lobby: comic portraits, full-body art, five gear seats and a separately scrolling bag. */
import { BlockInputEvents, Graphics, Node, ScrollView, UIOpacity, Vec2 } from 'cc';
import { LO } from '../../config/GameConfig';
import { CA, dimLayer, gpanel, N, WY } from '../UIKit';
import { COMIC, comicArt, comicButton, comicDialog, comicMark, comicPlate } from '../ComicUI';
import { EMPTY_GEAR, GEAR_PASTEL, gearArt, heroComicFigure, heroEnvironment, heroGlyph, heroPortrait } from '../HeroComic';
import { fmt, mainLabel, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, PageCtx, pageScroll, toast } from '../PageKit';
import {
  EquipDef, EquipKind, EQUIPS, HERO_DEFS, KIND_NAME, MATS, MAX, StatKey, STAT_NAME,
  equipStat, equipUpCost, heroStats, matCount, sellEquip, sellPrice, statFmt, upWornEquip, wearEquip, wornInst,
} from '../../core/GameData';
import { EquipInst, loadSave, saveSave } from '../../core/SaveData';

const SLOTS: EquipKind[] = ['helm', 'acc', 'glove', 'armor'];
const BAG_SIZE = 120, BAG_STEP = 130, BAG_COL_STEP = 138;
const QNAMES = ['普通', '优秀', '稀有', '史诗'];
const matOwned = (): number => matCount('mat_stone') + matCount('mat_iron');
const BAG_TABS = [['weapon', '武器', 'wpn_bow'], ['equip', '装备', 'armor_forest'], ['mat', '材料', 'mat_stone']] as const;
const bagSt: { tab: 'weapon' | 'equip' | 'mat'; offsets: Record<string, number> } = { tab: 'equip', offsets: {} };

function rule(parent: Node, y: number, width: number): void {
  const g = N('heroDivider', parent, 0, y).addComponent(Graphics);
  g.strokeColor = CA(COMIC.sub, .25); g.lineWidth = 1;
  g.moveTo(-width / 2, 0); g.lineTo(width / 2, 0); g.stroke();
}

export function buildHeroes(ctx: PageCtx): void {
  const root = ctx.screens, sv = loadSave();
  const owned = Object.keys(HERO_DEFS).filter(id => sv.heroes[id]?.owned);
  if (!owned.includes(sv.curHero)) sv.curHero = owned[0] || 'archer';
  const content = N('heroContent', root);
  const body = N('heroBody', content);
  render();

  function render(): void {
    body.destroyAllChildren();
    const hid = sv.curHero;
    const select = (id: string): void => { sv.curHero = id; saveSave(); render(); };
    const rosterTop = mainResourceTop() + MAIN_RESOURCE_H + 20, stageTop = rosterTop + 126;
    const bottom = LO.half * 2 - LO.safeTop - LO.safeBottom - MAIN_NAV_H;
    const stageH = Math.min(610, Math.max(500, bottom - stageTop - 510));
    const bagTop = stageTop + stageH;
    heroEnvironment(body, bagTop, -154, 97);
    buildLobbyRoster(body, rosterTop, hid, select);
    buildHeroStage(body, ctx, hid, stageTop, stageH, owned, select);
    const cells: { uid: string; n: number }[] = [];
    if (bagSt.tab === 'mat') {
      for (const id of Object.keys(MATS)) if ((sv.bag[id] || 0) > 0) cells.push({ uid: id, n: sv.bag[id] });
    } else {
      const kinds = bagSt.tab === 'weapon' ? ['weapon'] : SLOTS;
      sv.equips.forEach(e => {
        const d = EQUIPS[e.defId];
        if (d && (kinds as string[]).includes(d.kind)
          && !Object.values(sv.heroes).some(h => Object.values(h.worn).includes(e.uid))) cells.push({ uid: e.uid, n: 0 });
      });
    }
    const bagH = bottom - bagTop;
    comicPlate(body, 0, WY(bagTop, bagH), 750, bagH, 'paper', { name: 'heroInventory', cut: 0, edge: false });
    const header = N('heroBagHeader', body, 0, WY(bagTop + 6, 50), 706, 50);
    heroGlyph(header, -316, 0, 'bag', 42);
    mainLabel(header, -123, 0, '我的背包', { size: 26, color: COMIC.text, bold: true, font: 'body', align: 'left', w: 298, h: 36 });
    mainLabel(header, 285, 0, cells.length + '件', { size: 18, color: COMIC.sub, align: 'right', w: 100, h: 30 });
    const tabBar = N('heroBagTabs', body, 0, WY(bagTop + 60, 48), 706, 48);
    BAG_TABS.forEach(([key, title, art], i) => {
      const active = bagSt.tab === key;
      const tab = comicButton(tabBar, (i - 1) * 234, 0, 228, 46, '',
        () => { bagSt.tab = key; render(); }, { tone: active ? 'gold' : 'dark', name: 'heroBagTab:' + key });
      const face = tab.getChildByName('buttonFace')!;
      gearArt(face, -43, 0, 30, 30, art);
      mainLabel(face, 19, 0, title, { size: 22, font: 'body', color: active ? COMIC.text : COMIC.cream, bold: true, align: 'left', w: 72, h: 30 });
    });
    const gridTop = bagTop + 116, gridH = bottom - 10 - gridTop;
    const contentH = Math.ceil(cells.length / 5) * BAG_STEP + 4;
    const grid = pageScroll(body, 'heroBag', gridTop, bottom - 10, contentH, 706);
    const scroll = grid.parent!.getComponent(ScrollView)!;
    const scrollKey = hid + ':' + bagSt.tab, maxOffset = Math.max(0, contentH - gridH);
    let handle: Node | null = null, travel = 0;
    if (maxOffset > 0) {
      const track = gpanel(body, 353, WY(gridTop, gridH), 4, gridH, '#D7C8AD', undefined, 0, 2);
      const thumbH = Math.max(28, gridH * gridH / contentH);
      travel = gridH - thumbH;
      handle = gpanel(track, 0, travel / 2, 4, thumbH, '#8E826B', undefined, 0, 2);
    }
    const updateScroll = (): void => {
      const offset = Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y));
      bagSt.offsets[scrollKey] = offset;
      if (handle) handle.setPosition(0, travel / 2 - travel * offset / maxOffset, 0);
    };
    grid.parent!.on('scrolling', updateScroll);
    cells.forEach((cell, i) => drawBagCell(ctx, grid, cell, hid,
      (i % 5 - 2) * BAG_COL_STEP, -(Math.floor(i / 5) * BAG_STEP + BAG_SIZE / 2)));
    if (!cells.length) {
      const empty = N('heroBagEmpty', grid, 0, -gridH / 2, 480, 84);
      mainLabel(empty, 0, 16, '暂无' + BAG_TABS.find(t => t[0] === bagSt.tab)![1], { size: 22, color: COMIC.text, bold: true, w: 460, h: 32 });
      mainLabel(empty, 0, -20, '通过关卡掉落或商店补给获得', { size: 17, color: COMIC.sub, w: 460, h: 26 });
    }
    const offset = Math.min(maxOffset, bagSt.offsets[scrollKey] || 0);
    if (offset > 0) scroll.scrollToOffset(new Vec2(0, offset), 0);
    updateScroll();
  }
}

function buildLobbyRoster(parent: Node, top: number, selected: string, select: (id: string) => void): void {
  const sv = loadSave(), roster = N('heroLobbyRoster', parent);
  Object.values(HERO_DEFS).forEach((def, i) => {
    const active = def.id === selected, owned = !!sv.heroes[def.id]?.owned;
    const slot = comicPlate(roster, (i - 2) * 138, WY(top, 114), 126, 114, active ? 'gold' : 'paper',
      { name: 'heroSelect:' + def.id, cut: 9 });
    pressAction(slot, () => {
      if (!owned) { toast('前往商店解锁该英雄'); return; }
      select(def.id);
    });
    const face = slot, avatar = heroPortrait(face, 0, 14, 72, def.id);
    if (!owned) { avatar.addComponent(UIOpacity).opacity = 125; comicMark(face, 43, -8, 'lock', 17, '#777C75'); }
    const shortName = def.id === 'pyro' ? def.name.replace('·', '') : def.name.split('·')[0];
    mainLabel(face, 0, -39, shortName, { size: 20, font: 'body', color: owned ? COMIC.text : COMIC.sub,
      bold: true, w: 112, h: 28 });
  });
}

function buildHeroStage(parent: Node, ctx: PageCtx, hid: string, top: number, height: number,
  owned: string[], select: (id: string) => void): void {
  const sv = loadSave(), def = HERO_DEFS[hid];
  const stage = N('heroStage', parent, 0, WY(top, height), 750, height);
  const footY = -height / 2 + 97;
  heroComicFigure(stage, hid, -154, footY, height - 185, 376);
  mainLabel(stage, -162, height / 2 - 30, def.name, { size: 32, color: COMIC.cream, outline: '#51483B', outlineW: 2.5,
    font: 'body', bold: true, align: 'left', w: 326, h: 44 });
  mainLabel(stage, -162, height / 2 - 67, 'Lv.' + sv.heroes[hid].lv + ' · ' + def.job.split(' · ')[0],
    { size: 21, color: COMIC.cream, outline: '#51483B', outlineW: 2, align: 'left', w: 326, h: 30 });
  const index = owned.indexOf(hid);
  if (owned.length > 1) {
    for (const direction of [-1, 1]) {
      const arrow = N('heroCycle:' + (direction < 0 ? 'left' : 'right'), stage, direction < 0 ? -321 : 31, -16, 86, 86);
      pressAction(arrow, () => select(owned[(index + owned.length + direction) % owned.length]));
      heroGlyph(arrow, 0, 0, direction < 0 ? 'left' : 'right', 78);
    }
  }
  const power = N('heroPower', stage, -154, -height / 2 + 43, 330, 84);
  comicArt(power, 0, 0, 340, 84, 'hero_comic_v3/comic_power_plate_v3');
  mainLabel(power, 31, 0, '战力 ' + fmt(heroStats(hid).power), { size: 28, color: COMIC.cream,
    font: 'number', bold: true, w: 208, h: 38 });
  comicPlate(stage, 213, 0, 284, height - 20, 'paper', { name: 'heroEquipment', cut: 14 });
  mainLabel(stage, 163, height / 2 - 28, '已穿戴', { size: 22, font: 'body', color: COMIC.text, bold: true, w: 132, h: 32 });
  mainLabel(stage, 295, height / 2 - 28, Object.keys(EMPTY_GEAR).filter(k => wornInst(hid, k as EquipKind)).length + '/5',
    { size: 19, color: COMIC.sub, align: 'right', w: 70, h: 30 });
  drawSlot(ctx, stage, hid, 'weapon', 213, height / 2 - 102, 252, 104);
  const sq = Math.min(124, Math.max(100, (height - 300) / 2));
  SLOTS.forEach((kind, i) => drawSlot(ctx, stage, hid, kind, 146 + (i % 2) * 134,
    height / 2 - (168 + sq / 2 + Math.floor(i / 2) * (sq + 14)), sq, sq));
  detailButton(stage, 146, -height / 2 + 50, '属性', 'attrs', () => attrsModal(ctx, hid));
  detailButton(stage, 280, -height / 2 + 50, '故事', 'book', () => storyModal(ctx, hid));
}

function detailButton(parent: Node, x: number, y: number, title: string, glyph: 'attrs' | 'book', onClick: () => void): void {
  const button = comicButton(parent, x, y, 126, 86, '', onClick, { tone: 'dark', name: 'heroDetail:' + title });
  const face = button.getChildByName('buttonFace')!;
  heroGlyph(face, -32, 0, glyph, 46);
  mainLabel(face, 25, 0, title, { size: 26, color: COMIC.cream, font: 'body', bold: true, w: 64, h: 40 });
}

function pressAction(node: Node, onClick: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(.96, .96, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1, 1));
  node.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    node.setScale(1, 1, 1);
    if (e) e.propagationStopped = true;
    onClick();
  });
}

/** Quality is the square's fill, not a luminous colored outline. */
function itemSeat(parent: Node, x: number, y: number, w: number, h: number, quality: number, filled: boolean): Node {
  return comicPlate(parent, x, y, w, h, 'card', { name: 'heroItemSeat', cut: 8,
    fill: filled ? GEAR_PASTEL[quality] : '#ECE5D8' });
}
function badge(parent: Node, x: number, y: number, w: number, text: string): void {
  const plate = comicPlate(parent, x, y, w, 22, 'dark', { cut: 4, edge: false });
  mainLabel(plate, 0, 0, text, { size: 15, color: COMIC.cream, font: 'number', w: w - 6, h: 21 });
}

function drawSlot(ctx: PageCtx, parent: Node, hid: string, kind: EquipKind, x: number, y: number, w: number, h: number): void {
  const inst = wornInst(hid, kind), d = inst ? EQUIPS[inst.defId] : null;
  const wide = w > 200;
  const slot = N('heroEquipped:' + kind, parent, x, y, w, h);
  comicPlate(slot, 0, 0, w, h, 'card', { name: 'heroGearSocket', cut: 8,
    fill: inst ? GEAR_PASTEL[d!.quality] : '#ECE5D8' });
  if (inst && d) {
    gearArt(slot, wide ? -75 : 0, wide ? 0 : 3, wide ? 90 : w - 22, wide ? 90 : h - 22, inst.defId);
    if (wide) {
      mainLabel(slot, 42, 14, d.name, { size: 20, color: COMIC.text, font: 'body', bold: true, align: 'left', w: 144, h: 30 });
      mainLabel(slot, 42, -19, d.tier + '阶 · Lv.' + inst.lv, { size: 17, color: COMIC.sub, align: 'left', w: 144, h: 26 });
    } else {
      badge(slot, -w / 2 + 25, h / 2 - 16, 40, d.tier + '阶');
      badge(slot, w / 2 - 33, -h / 2 + 16, 58, 'Lv.' + inst.lv);
    }
    slot.on(Node.EventType.TOUCH_END, () => wornEquipModal(ctx, hid, kind));
  } else {
    const picture = gearArt(slot, wide ? -75 : 0, wide ? 0 : 12, wide ? 62 : 48, wide ? 62 : 48, EMPTY_GEAR[kind]);
    picture.addComponent(UIOpacity).opacity = 80;
    mainLabel(slot, wide ? 39 : 0, wide ? 10 : -h / 2 + 20, KIND_NAME[kind],
      { size: 17, color: COMIC.sub, w: wide ? 148 : w - 10, h: 25 });
    if (wide) mainLabel(slot, 39, -20, '未穿戴', { size: 15, color: COMIC.sub, w: 148, h: 24 });
  }
}

function equipIcon(parent: Node, x: number, y: number, size: number, inst: EquipInst): void {
  const d = EQUIPS[inst.defId], box = itemSeat(parent, x, y, size, size, d.quality, true);
  gearArt(box, 0, 0, size * .84, size * .84, inst.defId);
  badge(box, -size / 2 + 25, size / 2 - 15, 40, d.tier + '阶');
}
function drawEquipAttrs(parent: Node, y: number, width: number, inst: EquipInst, d: EquipDef, large: boolean): void {
  const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] || 0) > 0);
  const rows = keys.map(k => ({ name: STAT_NAME[k], value: statFmt(k, equipStat(inst, k)), green: false }));
  const pk = keys[0], delta = pk ? equipStat({ ...inst, lv: inst.lv + 1 }, pk) - equipStat(inst, pk) : 0;
  if (pk && delta > 0 && inst.lv < MAX.equip) rows.push({ name: '下一级' + STAT_NAME[pk], value: '+' + statFmt(pk, delta), green: true });
  rows.forEach((row, i) => {
    const ry = y - i * 34, inset = 22;
    mainLabel(parent, -width / 2 + inset + width * .22, ry, row.name,
      { size: large ? 21 : 17, color: COMIC.sub, align: 'left', w: width * .44, h: 30 });
    mainLabel(parent, width / 2 - inset - width * .22, ry, row.value,
      { size: large ? 23 : 19, color: row.green ? COMIC.greenShade : COMIC.text, bold: true, align: 'right', w: width * .44, h: 30 });
  });
}

/** Direct equipment cards without another surrounding frame; blank taps close comparisons. */
function equipDetailPanel(parent: Node, x: number, y: number, inst: EquipInst, current: boolean, big = false): Node {
  const d = EQUIPS[inst.defId], w = big ? 568 : 335, h = big ? 620 : 520;
  const panel = comicPlate(parent, x, y, w, h, 'paper', { name: 'heroEquipmentCard:' + (current ? 'current' : 'next'), cut: 12 });
  panel.addComponent(BlockInputEvents);
  mainLabel(panel, 0, h / 2 - 30, current ? '当前装备' : '背包装备', { size: big ? 25 : 20, font: 'body', color: COMIC.text, bold: true, w: w - 40, h: 32 });
  equipIcon(panel, big ? -176 : 0, big ? h / 2 - 113 : h / 2 - 104, big ? 110 : 96, inst);
  mainLabel(panel, big ? 49 : 0, h / 2 - (big ? 98 : 176), d.name,
    { size: big ? 24 : 21, color: COMIC.text, font: 'body', bold: true, align: big ? 'left' : 'center', w: big ? 294 : w - 28, h: 34 });
  mainLabel(panel, big ? 49 : 0, h / 2 - (big ? 137 : 212), QNAMES[d.quality] + ' · ' + d.tier + '阶 · Lv.' + inst.lv,
    { size: big ? 19 : 16, color: COMIC.sub, align: big ? 'left' : 'center', w: big ? 294 : w - 28, h: 28 });
  rule(panel, h / 2 - (big ? 190 : 244), w - 40);
  drawEquipAttrs(panel, h / 2 - (big ? 230 : 277), w, inst, d, big);
  return panel;
}
function equipmentDim(ctx: PageCtx, name: string): Node {
  const dim = dimLayer(ctx.screens, .66); dim.name = name;
  dim.on(Node.EventType.TOUCH_END, (e: { target?: Node }) => { if (e?.target === dim) dim.destroy(); });
  return dim;
}
function wornEquipModal(ctx: PageCtx, hid: string, kind: EquipKind): void {
  const inst = wornInst(hid, kind); if (!inst) return;
  const dim = equipmentDim(ctx, 'heroWornDialog'), panel = equipDetailPanel(dim, 0, 0, inst, true, true);
  const button = comicButton(panel, 0, -255, 286, 58, '', () => forgeModal(ctx, hid, kind), { name: 'heroForgeOpen', tone: 'gold' });
  heroGlyph(button.getChildByName('buttonFace')!, -78, 0, 'forge', 26);
  mainLabel(button.getChildByName('buttonFace')!, 22, 0, '装备锻造', { size: 23, color: COMIC.text, font: 'body', bold: true, w: 160, h: 34 });
}
function warehouseEquipModal(ctx: PageCtx, hid: string, inst: EquipInst): void {
  const d = EQUIPS[inst.defId], dim = equipmentDim(ctx, 'heroWarehouseDialog');
  const panel = equipDetailPanel(dim, 0, 0, inst, false, true);
  mainLabel(panel, 0, -180, '出售价 ' + fmt(sellPrice(inst)) + ' 金币', { size: 20, color: COMIC.sub, w: 500, h: 30 });
  comicButton(panel, -132, -255, 228, 58, '出售', () => confirmDismantle(ctx, inst, '出售'), { tone: 'dark', name: 'heroSellOpen' });
  comicButton(panel, 132, -255, 228, 58, '穿戴', () => { wearEquip(hid, d.kind, inst.uid); ctx.refresh(); }, { name: 'heroWear', tone: 'green' });
}
function confirmDismantle(ctx: PageCtx, inst: EquipInst, action: '出售' | '分解'): void {
  const d = EQUIPS[inst.defId], panel = comicDialog(ctx.screens, 568, 528, action + '确认'); panel.name = 'heroSellConfirm';
  equipIcon(panel, 0, 113, 110, inst);
  mainLabel(panel, 0, 28, d.name + ' · ' + d.tier + '阶 · Lv.' + inst.lv, { size: 23, color: COMIC.text, font: 'body', bold: true, w: 510, h: 34 });
  mainLabel(panel, 0, -24, '返还 ' + fmt(sellPrice(inst)) + ' 金币', { size: 24, color: COMIC.greenShade, bold: true, w: 510, h: 34 });
  mainLabel(panel, 0, -73, action + '后装备无法恢复', { size: 19, color: COMIC.sub, w: 510, h: 30 });
  comicButton(panel, -126, -188, 210, 58, '取消', () => panel.parent?.destroy(), { tone: 'dark', name: 'heroSellCancel' });
  comicButton(panel, 126, -188, 210, 58, action, () => {
    const result = sellEquip(inst.uid); toast(result.msg);
    if (result.ok) ctx.refresh();
  }, { name: 'heroSellConfirmAction', tone: 'green' });
}
function compareEquipModal(ctx: PageCtx, hid: string, worn: EquipInst, next: EquipInst): void {
  const dim = equipmentDim(ctx, 'heroCompareDialog');
  const left = equipDetailPanel(dim, -177, 0, worn, true), right = equipDetailPanel(dim, 177, 0, next, false);
  comicButton(left, 0, -215, 256, 56, '装备锻造', () => forgeModal(ctx, hid, EQUIPS[worn.defId].kind), { tone: 'gold', name: 'heroForgeOpen' });
  mainLabel(right, 0, -163, '分解返还 ' + fmt(sellPrice(next)) + ' 金币', { size: 17, color: COMIC.sub, w: 308, h: 28 });
  comicButton(right, -81, -215, 144, 56, '分解', () => confirmDismantle(ctx, next, '分解'), { tone: 'dark', name: 'heroDismantleOpen' });
  comicButton(right, 81, -215, 144, 56, '替换', () => { wearEquip(hid, EQUIPS[next.defId].kind, next.uid); ctx.refresh(); }, { tone: 'green', name: 'heroReplace' });
}

/** The same forge data operation as the upgrade page, rendered with the new lobby components. */
function forgeModal(ctx: PageCtx, hid: string, kind: EquipKind): void {
  const sv = loadSave(), inst = wornInst(hid, kind); if (!inst) return;
  const d = EQUIPS[inst.defId], maxed = inst.lv >= MAX.equip, cost = equipUpCost(inst.lv);
  const panel = comicDialog(ctx.screens, 620, 650, '装备强化'); panel.name = 'heroForgeDialog';
  equipIcon(panel, -218, 205, 112, inst);
  mainLabel(panel, 45, 222, d.name, { size: 25, color: COMIC.text, font: 'body', bold: true, align: 'left', w: 330, h: 36 });
  mainLabel(panel, 45, 180, maxed ? QNAMES[d.quality] + ' · ' + d.tier + '阶 · 已满级' : 'Lv.' + inst.lv + '  →  Lv.' + (inst.lv + 1),
    { size: 22, color: COMIC.sub, align: 'left', w: 330, h: 32 });
  rule(panel, 129, 552);
  const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] || 0) > 0);
  keys.forEach((key, i) => {
    const y = 91 - i * 42;
    mainLabel(panel, -188, y, STAT_NAME[key], { size: 21, color: COMIC.sub, align: 'left', w: 160, h: 34 });
    mainLabel(panel, -23, y, statFmt(key, equipStat(inst, key)), { size: 23, color: COMIC.text, align: 'right', w: 134, h: 34 });
    mainLabel(panel, 174, y, maxed ? 'MAX' : '→ ' + statFmt(key, equipStat({ ...inst, lv: inst.lv + 1 }, key)),
      { size: 23, color: COMIC.greenShade, bold: true, align: 'right', w: 176, h: 34 });
  });
  mainLabel(panel, 0, -66, '主属性 +4% / 级 · 材料需求每7级递增', { size: 18, color: COMIC.sub, w: 550, h: 30 });
  rule(panel, -102, 552);
  if (!maxed) {
    const enoughGold = sv.gold >= cost.gold, enoughMat = matOwned() >= cost.mat;
    costEntry(panel, -210, -148, 'gold', fmt(cost.gold) + ' / ' + fmt(sv.gold), enoughGold);
    costEntry(panel, -210, -194, 'mat_stone', cost.mat + ' / ' + fmt(matOwned()), enoughMat);
    comicButton(panel, 0, -269, 386, 60, '强化', () => {
      const result = upWornEquip(hid, kind); toast(result.msg);
      if (result.ok) ctx.refresh();
    }, { tone: enoughGold && enoughMat ? 'gold' : 'muted', name: 'heroForgeAction' });
  } else mainLabel(panel, 0, -185, '已达强化上限', { size: 24, color: COMIC.sub, bold: true, w: 500, h: 40 });
}
function costEntry(parent: Node, x: number, y: number, id: string, text: string, enough: boolean): void {
  if (id === 'gold') comicArt(parent, x, y, 32, 32, 'comic_coin_v1');
  else gearArt(parent, x, y, 32, 32, id);
  mainLabel(parent, x + 85, y, id === 'gold' ? '金币' : '材料', { size: 20, color: COMIC.sub, align: 'left', w: 92, h: 30 });
  mainLabel(parent, 110, y, text, { size: 22, color: enough ? COMIC.greenShade : '#B34338', font: 'number', align: 'right', w: 300, h: 32 });
}

function drawBagCell(ctx: PageCtx, grid: Node, cell: { uid: string; n: number }, hid: string, x: number, y: number): void {
  const isMat = cell.n > 0, inst = isMat ? null : loadSave().equips.find(e => e.uid === cell.uid);
  const d = inst ? EQUIPS[inst.defId] : null;
  const seat = itemSeat(grid, x, y, BAG_SIZE, BAG_SIZE, d?.quality || 0, true); seat.name = 'heroBagItem:' + cell.uid;
  gearArt(seat, 0, 4, 100, 100, isMat ? cell.uid : inst!.defId);
  if (d) badge(seat, -34, 44, 42, d.tier + '阶');
  badge(seat, 22, -44, 68, isMat ? '×' + fmt(cell.n) : 'Lv.' + inst!.lv);
  seat.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    if (e) e.propagationStopped = true;
    if (isMat) {
      const mat = MATS[cell.uid], panel = comicDialog(ctx.screens, 568, 548, mat.name); panel.name = 'heroMaterialDialog';
      gearArt(panel, 0, 118, 136, 136, cell.uid);
      mainLabel(panel, 0, 24, '持有 ×' + fmt(loadSave().bag[cell.uid] || 0), { size: 24, color: COMIC.text, bold: true, w: 510, h: 34 });
      mainLabel(panel, 0, -33, mat.desc, { size: 22, color: COMIC.text, w: 510, h: 54 });
      mainLabel(panel, 0, -105, '来源：商店购买 / 关卡掉落', { size: 18, color: COMIC.sub, w: 510, h: 28 });
      mainLabel(panel, 0, -151, '用途：武器 / 装备强化材料', { size: 18, color: COMIC.sub, w: 510, h: 28 });
      return;
    }
    const current = loadSave().equips.find(e => e.uid === cell.uid); if (!current) return;
    const kind = EQUIPS[current.defId].kind, worn = wornInst(hid, kind);
    if (worn && worn.uid !== current.uid) compareEquipModal(ctx, hid, worn, current);
    else if (worn) wornEquipModal(ctx, hid, kind);
    else warehouseEquipModal(ctx, hid, current);
  });
}

export function attrsModal(ctx: PageCtx, hid: string): void {
  const def = HERO_DEFS[hid], stats = heroStats(hid), panel = comicDialog(ctx.screens, 620, 620, '属性总览'); panel.name = 'heroAttrsDialog';
  heroPortrait(panel, -216, 188, 86, hid);
  mainLabel(panel, 48, 205, def.name, { size: 28, font: 'body', color: COMIC.text, bold: true, align: 'left', w: 360, h: 38 });
  mainLabel(panel, 48, 164, 'Lv.' + loadSave().heroes[hid].lv, { size: 22, color: COMIC.sub, align: 'left', w: 360, h: 32 });
  const rows: [string, string][] = [
    ['定位', def.job], ['战力', fmt(stats.power)], ['攻击', fmt(stats.atk)],
    ['攻速', stats.atkSpd + ' 次/秒'], ['技能伤害', fmt(stats.skillDmg)],
  ];
  rows.forEach((row, i) => {
    const bar = comicPlate(panel, 0, 84 - i * 64, 552, 54, i % 2 ? 'paper' : 'card', { cut: 5, edge: false });
    mainLabel(bar, -200, 0, row[0], { size: 22, color: COMIC.sub, align: 'left', w: 104, h: 34 });
    mainLabel(bar, 60, 0, row[1], { size: 24, color: COMIC.text, bold: true, align: 'right', w: 384, h: 34 });
  });
}
export function storyModal(ctx: PageCtx, hid: string): void {
  const def = HERO_DEFS[hid], owned = !!loadSave().heroes[hid]?.owned;
  const panel = comicDialog(ctx.screens, 640, 560, '故事 · ' + def.name); panel.name = 'heroStoryDialog';
  const card = comicPlate(panel, -174, 24, 220, 318, 'card', { name: 'heroStoryFigure', cut: 10 });
  heroComicFigure(card, hid, 0, -102, 254, 200);
  mainLabel(card, 0, -135, def.name, { size: 22, color: COMIC.text, font: 'body', bold: true, w: 202, h: 32 });
  const status = comicPlate(panel, -174, -170, 220, 40, owned ? 'green' : 'muted', { cut: 7 });
  mainLabel(status, 0, 0, owned ? '已解锁' : '商店解锁', { size: 21, color: COMIC.cream, font: 'body', bold: true, w: 204, h: 30 });
  mainLabel(panel, 129, 40, def.story, { size: 22, color: COMIC.text, font: 'body', w: 288, h: 244, align: 'left', lineHeight: 35 });
}
