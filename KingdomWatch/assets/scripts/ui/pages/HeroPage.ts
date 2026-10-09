/**
 * ② 英雄：头像切换栏 + 大立绘/五件装备 + 独立滚动的五列背包。
 * 右列装备槽（武器横扁×1 + 2×2 防具）：点已穿槽=装备属性弹窗（锻造），空槽无反应；
 * 背包格突出图标，等级/数量置于角落；点物品保留对比、替换、分解、穿戴和出售操作。
 */
import { Node, BlockInputEvents, Graphics, ScrollView, UIOpacity, Vec2 } from 'cc';
import { LO, PAL } from '../../config/GameConfig';
import { CA, btn, C, dimLayer, gpanel, label, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { mainLabel, PageCtx, modal, toast, confirmModal, circleArrow, fmt, heroFigure, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, pageScroll } from '../PageKit';
import {
  EquipKind, EquipDef, KIND_NAME, QCOLOR, EQUIPS, MATS, HERO_DEFS,
  heroStats, sellEquip, sellPrice, wearEquip, wornInst, equipStat, statFmt, STAT_NAME,
  StatKey,
} from '../../core/GameData';
import { EquipInst, loadSave, saveSave } from '../../core/SaveData';
import { equipModal, zoneTab } from './UpgradePage';

const KIND_ICON: Record<EquipKind, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const INK = '#4A3214', OK = '#3E7C28';   // 奶白板文字墨色 / 强化增益绿（升级页签同色）
const SLOTS_2x2: EquipKind[] = ['helm', 'acc', 'glove', 'armor'];
const BAG_SIZE = 120, BAG_STEP = 130, BAG_COL_STEP = 138;
const SLOT_COLOR = ['#50555A', '#385A2D', '#28547B', '#51356F'];
const KIND_ART: Record<EquipKind, string> = { weapon: 'ui_item_wpn_bow', helm: 'ui_item_helm_falcon',
  acc: 'ui_item_acc_moon', glove: 'ui_item_glove_wind', armor: 'ui_item_armor_forest' };
/* 背包页签跨刷新保持（穿戴/出售后 refresh 重建不跳回「武器」） */
const bagSt: { tab: 'weapon' | 'equip' | 'mat'; offsets: Record<string, number> } = { tab: 'equip', offsets: {} };

export function buildHeroes(ctx: PageCtx): void {
  const root = ctx.screens;
  const sv = loadSave();
  const owned = (['archer', 'sniper', 'pyro', 'volt', 'mora'] as const).filter(id => sv.heroes[id].owned);
  if (!owned.includes(sv.curHero as 'archer' | 'sniper' | 'pyro' | 'volt' | 'mora')) sv.curHero = owned[0];
  const content = N('heroContent', root);
  render();

  function render(): void {
    content.destroyAllChildren();
    const hid = sv.curHero;
    const select = (id: string): void => { sv.curHero = id; saveSave(); render(); };
    const rosterTop = mainResourceTop() + MAIN_RESOURCE_H + 20;
    const stageTop = rosterTop + 126;
    const bottom = LO.half * 2 - LO.safeTop - LO.safeBottom - MAIN_NAV_H;
    // Tall phones expose three bag rows; shorter phones keep the hero readable and scroll only the bag.
    const stageH = Math.min(610, Math.max(500, bottom - stageTop - 510));
    const bagTop = stageTop + stageH;
    buildLobbyRoster(content, rosterTop, hid, select);
    buildHeroStage(content, ctx, hid, stageTop, stageH, owned, select, render);
    const cells: { uid: string; n: number }[] = [];
    if (bagSt.tab === 'mat') {
      for (const id of Object.keys(MATS)) if ((sv.bag[id] || 0) > 0) cells.push({ uid: id, n: sv.bag[id] });
    } else {
      const kinds = bagSt.tab === 'weapon' ? ['weapon'] : ['helm', 'acc', 'glove', 'armor'];
      sv.equips.forEach(e => {
        const d = EQUIPS[e.defId];
        if (d && kinds.includes(d.kind) && !Object.values(sv.heroes).some(h => Object.values(h.worn).includes(e.uid))) cells.push({ uid: e.uid, n: 0 });
      });
    }
    const bagH = bottom - bagTop;
    const bag = gpanel(content, 0, WY(bagTop, bagH), 730, bagH, '#2D2017', undefined, 0, 10);
    bag.name = 'heroInventory';
    gpanel(bag, 0, bagH / 2 - 2, 704, 3, '#A87942', undefined, 0, 1);
    const header = gpanel(content, 0, WY(bagTop + 6, 50), 706, 50, '#3C291B', undefined, 0, 8);
    artSprite(header, -315, 0, 42, 42, 'ui_nav_shop', { sliced: false });
    mainLabel(header, -128, 0, '我的背包', { size: 27, color: '#FFE3A1', bold: true, align: 'left', w: 294, h: 36 });
    mainLabel(header, 285, 0, `${cells.length}件`, { size: 19, color: '#C9AD86', align: 'right', w: 100, h: 30 });
    const tabs = [['weapon', '武器'], ['equip', '装备'], ['mat', '材料']] as const;
    const tabBar = gpanel(content, 0, WY(bagTop + 60, 48), 706, 48, '#21180F', undefined, 0, 8);
    tabs.forEach(([key, title], i) => {
      const active = bagSt.tab === key;
      const slot = gpanel(tabBar, (i - 1) * 234, 0, 230, 44, active ? '#FFC44E' : '#4B3423', undefined, 0, 7);
      if (active) gpanel(slot, 0, 18, 208, 2, '#FFE9A4', undefined, 0, 1);
      artSprite(slot, -43, 0, 29, 29, key === 'weapon' ? KIND_ART.weapon : key === 'equip' ? 'ui_icon_equip' : 'ui_item_mat_stone', { sliced: false });
      mainLabel(slot, 19, 0, title, { size: 23, color: active ? '#462B10' : '#F0D4A2', bold: true, align: 'left', w: 72, h: 30 });
      slot.on(Node.EventType.TOUCH_END, () => { bagSt.tab = key; render(); });
    });
    const gridTop = bagTop + 116;
    const gridH = bottom - 10 - gridTop;
    const contentH = Math.ceil(cells.length / 5) * BAG_STEP + 4;
    const grid = pageScroll(content, 'heroBag', gridTop, bottom - 10, contentH, 706);
    const scroll = grid.parent!.getComponent(ScrollView)!;
    const scrollKey = hid + ':' + bagSt.tab;
    const maxOffset = Math.max(0, contentH - gridH);
    let handle: Node | null = null;
    let travel = 0;
    if (maxOffset > 0) {
      const track = gpanel(content, 353, WY(gridTop, gridH), 4, gridH, '#21170F', undefined, 0, 2);
      const thumbH = Math.max(28, gridH * gridH / contentH);
      travel = gridH - thumbH;
      handle = gpanel(track, 0, travel / 2, 4, thumbH, '#AA7C42', undefined, 0, 2);
    }
    const updateScroll = (): void => {
      const offset = Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y));
      bagSt.offsets[scrollKey] = offset;
      if (handle) handle.setPosition(0, travel / 2 - travel * offset / maxOffset, 0);
    };
    grid.parent!.on('scrolling', updateScroll);
    const visibleSlots = Math.max(5, Math.min(15, Math.floor(gridH / BAG_STEP) * 5));
    for (let i = cells.length; i < visibleSlots; i++) {
      itemSeat(grid, (i % 5 - 2) * BAG_COL_STEP, -(Math.floor(i / 5) * BAG_STEP + BAG_SIZE / 2), BAG_SIZE, BAG_SIZE, 0, false);
    }
    cells.forEach((cell, i) => {
      drawBagCell(ctx, grid, cell, hid, render, (i % 5 - 2) * BAG_COL_STEP, -(Math.floor(i / 5) * BAG_STEP + BAG_SIZE / 2));
    });
    if (!cells.length) {
      const empty = gpanel(grid, 0, -Math.min(gridH / 2, 174), 480, 84, CA('#251B13', 0.93), undefined, 0, 8);
      mainLabel(empty, 0, 16, '暂无' + tabs.find(t => t[0] === bagSt.tab)![1], { size: 22, color: '#E5C79B', w: 460, h: 32 });
      mainLabel(empty, 0, -20, '通过关卡掉落或商店补给获得', { size: 17, color: '#B99D76', w: 460, h: 26 });
    }
    const scrollOffset = Math.min(maxOffset, bagSt.offsets[scrollKey] || 0);
    if (scrollOffset > 0) scroll.scrollToOffset(new Vec2(0, scrollOffset), 0);
    updateScroll();
  }
}

function buildLobbyRoster(parent: Node, top: number, selected: string, select: (id: string) => void): void {
  const sv = loadSave();
  Object.values(HERO_DEFS).forEach((def, i) => {
    const active = def.id === selected;
    const owned = !!sv.heroes[def.id]?.owned;
    const x = (i - 2) * 138;
    gpanel(parent, x, WY(top + 4, 114), 126, 114, CA('#120D09', 0.74), undefined, 0, 10);
    const slot = gpanel(parent, x, WY(top, 114), 126, 114, active ? '#FFC64E' : '#4F3927', undefined, 0, 10);
    const portrait = gpanel(slot, 0, 13, 114, 80, active ? '#3B5828' : '#241E18', undefined, 0, 7);
    const avatar = artSprite(portrait, 0, 0, 80, 80, def.avatar, { sliced: false });
    if (!owned) {
      avatar.addComponent(UIOpacity).opacity = 116;
      artSprite(slot, 42, -13, 22, 22, 'ui_icon_lock', { sliced: false });
    }
    const shortName = def.id === 'pyro' ? def.name.replace('·', '') : def.name.split('·')[0];
    mainLabel(slot, 0, -40, shortName, { size: 21, color: active ? '#442B12' : owned ? '#F2DFB9' : '#A5947B',
      bold: true, w: 114, h: 28 });
    if (active) gpanel(slot, 0, 53, 96, 2, '#FFF0AA', undefined, 0, 1);
    slot.on(Node.EventType.TOUCH_END, () => {
      if (!owned) { toast('前往商店解锁该英雄'); return; }
      select(def.id);
    });
  });
}

function buildHeroStage(parent: Node, ctx: PageCtx, hid: string, top: number, height: number,
  owned: string[], select: (id: string) => void, rebuild: () => void): void {
  const sv = loadSave();
  const def = HERO_DEFS[hid];
  const stage = N('heroStage', parent, 0, WY(top, height), 730, height);
  const footY = -height / 2 + 71;
  const floor = N('heroStoneStage', stage, -154, footY - 5).addComponent(Graphics);
  floor.fillColor = CA('#160E09', 0.35); floor.ellipse(0, -19, 204, 28); floor.fill();
  floor.fillColor = C('#6E5842'); floor.ellipse(0, -12, 194, 29); floor.fill();
  floor.fillColor = C('#B49D76'); floor.ellipse(0, 0, 194, 29); floor.fill();
  floor.strokeColor = C('#88704F'); floor.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    floor.moveTo(Math.cos(a) * 116, Math.sin(a) * 17);
    floor.lineTo(Math.cos(a) * 190, Math.sin(a) * 28); floor.stroke();
  }
  heroFigure(stage, hid, -154, footY, height - 156, { lobby: true, maxWidth: 376 });
  mainLabel(stage, -166, height / 2 - 30, def.name, { size: 34, color: '#FFF0BD', bold: true,
    align: 'left', w: 352, h: 44, outline: '#23170F', outlineW: 2 });
  mainLabel(stage, -166, height / 2 - 67, `Lv.${sv.heroes[hid].lv} · ${def.job.split(' · ')[0]}`,
    { size: 22, color: '#EAD5AF', align: 'left', w: 352, h: 30, outline: '#23170F', outlineW: 1.5 });
  const index = owned.indexOf(hid);
  if (owned.length > 1) {
    circleArrow(stage, -321, -16, -1, () => select(owned[(index + owned.length - 1) % owned.length]));
    circleArrow(stage, 31, -16, 1, () => select(owned[(index + 1) % owned.length]));
  }
  const power = gpanel(stage, -154, -height / 2 + 30, 306, 44, '#6B3E13', undefined, 0, 12);
  gpanel(power, 0, 19, 276, 2, '#E1AC52', undefined, 0, 1);
  artSprite(power, -125, 0, 36, 36, 'ui_icon_atk_' + hid, { sliced: false });
  mainLabel(power, 16, 0, `战力 ${fmt(heroStats(hid).power)}`, { size: 27, color: '#FFE49C', bold: true,
    w: 248, h: 36, outline: '#3B210B', outlineW: 1 });
  mainLabel(stage, 213, height / 2 - 28, '已穿戴', { size: 23, color: '#FFE0A2', bold: true, w: 252, h: 32, outline: '#271A0F', outlineW: 1.5 });
  drawSlot(ctx, stage, hid, 'weapon', rebuild, 213, height / 2 - 102, 252, 104);
  const sq = Math.min(124, Math.max(100, (height - 300) / 2));
  SLOTS_2x2.forEach((kind, i) => {
    drawSlot(ctx, stage, hid, kind, rebuild, 146 + (i % 2) * 134,
      height / 2 - (168 + sq / 2 + Math.floor(i / 2) * (sq + 14)), sq, sq);
  });
  detailButton(stage, 146, -height / 2 + 55, '属性', false, () => attrsModal(ctx, hid));
  detailButton(stage, 280, -height / 2 + 55, '故事', true, () => storyModal(ctx, hid));
}

/** Short circular entries under equipment; the icon carries the action and text stays secondary. */
function detailButton(parent: Node, x: number, y: number, title: string, book: boolean, onClick: () => void): void {
  const button = N('heroDetail:' + title, parent, x, y, 104, 86);
  gpanel(button, 0, 10, 58, 58, '#2C1E12', undefined, 0, 29);
  const icon = N('detailGlyph', button, 0, 10).addComponent(Graphics);
  icon.strokeColor = C('#E8CA8C'); icon.fillColor = C('#E8CA8C'); icon.lineWidth = 2.5;
  if (book) {
    for (const dir of [-1, 1]) {
      icon.moveTo(0, 11); icon.lineTo(dir * 17, 17); icon.lineTo(dir * 17, -12);
      icon.lineTo(0, -17); icon.close(); icon.stroke();
    }
    icon.moveTo(0, 11); icon.lineTo(0, -17); icon.stroke();
  } else {
    icon.roundRect(-13, -17, 26, 34, 3); icon.stroke();
    for (let i = 0; i < 3; i++) { icon.moveTo(-7, 9 - i * 9); icon.lineTo(7, 9 - i * 9); icon.stroke(); }
  }
  mainLabel(button, 0, -33, title, { size: 21, color: '#F2DDB5', bold: true, w: 96, h: 26, outline: '#21170F', outlineW: 1 });
  button.on(Node.EventType.TOUCH_START, () => button.setScale(0.94, 0.94, 1));
  button.on(Node.EventType.TOUCH_CANCEL, () => button.setScale(1, 1, 1));
  button.on(Node.EventType.TOUCH_END, (e: unknown) => {
    button.setScale(1, 1, 1);
    const ev = e as { propagationStopped?: boolean }; if (ev) ev.propagationStopped = true;
    onClick();
  });
}

function itemSeat(parent: Node, x: number, y: number, w: number, h: number, quality: number, filled: boolean): Node {
  gpanel(parent, x, y - 3, w, h, '#17110C', undefined, 0, 9);
  const seat = gpanel(parent, x, y, w, h, filled ? SLOT_COLOR[quality] : '#302C24', undefined, 0, 9);
  if (filled) {
    gpanel(seat, 0, h / 2 - 4, w - 18, 2, CA(QCOLOR[quality], 0.62), undefined, 0, 1);
  }
  return seat;
}

/** Equipped seats retain their existing detail/forge flow; empty seats remain inactive. */
function drawSlot(ctx: PageCtx, parent: Node, hid: string, kind: EquipKind, rebuild: () => void,
  x: number, y: number, w: number, h: number): void {
  const inst = wornInst(hid, kind);
  const q = inst ? EQUIPS[inst.defId].quality : 0;
  /* 用户确认：品质=方形品质色底板（不用品质色边框）；空槽维持暗板 */
  const slot = itemSeat(parent, x, y, w, h, q, !!inst);
  if (inst) {
    const d = EQUIPS[inst.defId];
    const wide = w > 200, ix = wide ? -68 : 0, iy = wide ? 4 : 2;
    const fb = mainLabel(slot, ix, iy, KIND_ICON[kind], { size: 32 });
    artSprite(slot, ix, iy, wide ? 98 : w - 20, wide ? 84 : h - 20, 'ui_item_' + inst.defId, { hideOnLoad: [fb] });
    if (wide) {
      mainLabel(slot, 53, 12, d.name, { size: 21, color: '#FFF2CE', bold: true, align: 'left', w: 130, h: 30 });
      mainLabel(slot, 53, -20, `${d.tier}阶 · Lv.${inst.lv}`, { size: 18, color: '#E0D7BD', align: 'left', w: 130, h: 26 });
    } else {
      const tier = gpanel(slot, -w / 2 + 24, h / 2 - 17, 38, 22, CA('#1D160F', 0.8), undefined, 0, 5);
      mainLabel(tier, 0, 0, `${d.tier}阶`, { size: 15, color: '#FFF1D1', bold: true, w: 36, h: 20 });
      const level = gpanel(slot, w / 2 - 35, -h / 2 + 16, 64, 24, CA('#15110D', 0.74), undefined, 0, 5);
      mainLabel(level, 0, 0, `Lv.${inst.lv}`, { size: 18, color: '#FFF2CD', bold: true, align: 'right', w: 58, h: 22 });
    }
    // 已穿戴：点击弹装备属性（无替换选择）；空槽：点击无反应
    slot.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: boolean };
      if (ev) ev.propagationStopped = true;
      wornEquipModal(ctx, hid, kind, rebuild);
    });
  } else {
    const wide = w > 200;
    const ghost = artSprite(slot, wide ? -68 : 0, wide ? 0 : 7, wide ? 78 : w - 35, wide ? 78 : h - 35, KIND_ART[kind], { sliced: false });
    ghost.addComponent(UIOpacity).opacity = 48;
    mainLabel(slot, wide ? 47 : 0, wide ? 0 : -h / 2 + 17, KIND_NAME[kind],
      { size: 18, color: '#B2A38B', w: wide ? 138 : w - 10, h: 26 });
  }
}

/** 品质名（与 QCOLOR 下标一一对应） */
const QNAMES = ['普通', '优秀', '稀有', '史诗'];

/** 装备图标框（含 T阶角标）：品质色方形底板 + 图标居中（用户确认）；切图缺图回退 emoji */
function equipIcon(parent: Node, x: number, y: number, size: number, inst: EquipInst): void {
  const d = EQUIPS[inst.defId];
  const box = gpanel(parent, x, y, size, size, CA(QCOLOR[d.quality], 0.55), undefined, 0, 10);
  const fb = label(box, 0, 0, KIND_ICON[d.kind], { size: Math.round(size * 0.46) });
  artSprite(box, 0, 0, size * 0.78, size * 0.78, 'ui_item_' + inst.defId, { hideOnLoad: [fb] });
  label(box, -size / 2 + 8, -size / 2 + 18, `T${d.tier}`, { size: 15, color: '#FFF3D6', bold: true, align: 'left', w: 52, h: 24 });
}

/** 属性区（属性提升版式）：奶白板铺满蓝头以下至卡底整块区域，按钮落在板上；上缘直角贴蓝头、下弧角保留（用户确认）；
 *  金签标题骑缝板顶（文字固定「基础属性」），行=名称左/数值右（升级页签同构），强化行数值绿色；topY/bottomY 为奶白板上/下缘 */
function drawEquipAttrs(parent: Node, topY: number, bottomY: number, width: number, inst: EquipInst, d: EquipDef): void {
  const big = width > 420;
  const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] ?? 0) > 0);
  const rows: [string, string, boolean?][] = keys.map(k => [STAT_NAME[k], statFmt(k, equipStat(inst, k))]);
  const pk = keys[0];   // 强化行 = 主词条的升级增量（绿字）
  const d0 = pk ? equipStat(inst, pk) : 0;
  const d1 = pk ? equipStat({ ...inst, lv: inst.lv + 1 }, pk) : 0;
  if (pk && d1 > d0) rows.push(['强化', `+${statFmt(pk, d1 - d0)}`, true]);
  const rowH = 32;
  const h = topY - bottomY;
  gpanel(parent, 0, topY - h / 2, width, h, CA('#E9DFC2', 0.94), undefined, 0, 12);
  gpanel(parent, 0, topY - 6, width, 12, CA('#E9DFC2', 0.94), undefined, 0, 0);   // 补上弧角→上缘直角贴蓝头（用户确认）
  zoneTab(parent, -width / 2 + 70, topY, '基础属性');   // 金签骑缝板顶
  const inset = big ? 30 : 22;
  rows.forEach((r, i) => {
    const y = topY - 48 - i * rowH;
    label(parent, -width / 2 + inset + width * 0.2, y, r[0], { size: big ? 22 : 18, color: INK, bold: true, align: 'left', w: width * 0.4, h: 30, shrink: true });
    label(parent, width / 2 - inset - width * 0.25, y, r[1], { size: (big ? 22 : 18) + 2, color: r[2] ? OK : INK, bold: true, align: 'right', w: width * 0.5, h: 30, shrink: true });
  });
}

/** 点遮罩空白关闭（✕ 已去掉——用户确认）：只有点在遮罩本体上才关，面板/按钮上的点击冒泡 target 不是遮罩不误关 */
function closeOnBlankTap(dim: Node): void {
  dim.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { target?: Node };
    if (ev && ev.target === dim) dim.destroy();
  });
}

/** 装备详情小面板（对比弹窗两侧 / 装备槽详情弹窗共用）：蓝头（图标+当前角标+名称/品质/阶Lv 垂直居中）+ 奶白板直贴蓝头铺到卡底，
 *  按钮直接落在奶白板上（深色背板与上弧角已去掉——用户确认）
 *  big=false 335×480（对比侧栏）；big=true 520×640（独立详情弹窗加大版） */
function equipDetailPanel(parent: Node, x: number, y: number, inst: EquipInst, isCur: boolean, big = false): Node {
  const d = EQUIPS[inst.defId];
  const w = big ? 520 : 335, h = big ? 640 : 480;
  const p = N('eqPanel', parent, x, y, w, h);
  p.addComponent(BlockInputEvents);   // 卡内点击不上达遮罩（点空白才关闭）
  const hy = h / 2 - (big ? 85 : 72);
  const hh = big ? 170 : 130;
  gpanel(p, 0, hy, w, hh, CA('#20466E', 0.95), undefined, 0, 10);
  gpanel(p, 0, hy - hh / 2 + 5, w, 10, CA('#20466E', 0.95), undefined, 0, 0);   // 补蓝头下弧角（上弧下直）
  equipIcon(p, big ? -170 : -120, hy, big ? 110 : 76, inst);
  if (isCur) {
    gpanel(p, big ? 165 : 106, hy, big ? 110 : 96, big ? 46 : 40, CA(PAL.green, 0.95), undefined, 0, 8);
    label(p, big ? 165 : 106, hy, '当前', { size: big ? 22 : 20, color: '#FFFFFF', bold: true });
  }
  const tx = big ? 37 : 52;   // 大版：文本盒左缘(37-140=-103)在图标座右缘(-115)之外，防压图标
  label(p, tx, hy + 28, d.name, { size: big ? 24 : 18, color: '#E8E0C8', bold: true, align: 'left', w: big ? 280 : 200, h: big ? 34 : 26, shrink: true });
  label(p, tx, hy - 2, `品质：${QNAMES[d.quality]}`, { size: big ? 19 : 15, color: QCOLOR[d.quality], align: 'left', w: big ? 280 : 200, h: big ? 26 : 24, shrink: true });
  label(p, tx, hy - 32, `T${d.tier} 阶 · Lv.${inst.lv}`, { size: big ? 18 : 15, color: '#AAB2BD', align: 'left', w: big ? 280 : 200, h: big ? 24 : 24, shrink: true });
  drawEquipAttrs(p, hy - hh / 2, -h / 2, w, inst, d);   // 奶白板：蓝头下缘直铺到卡底（下弧角保留）
  return p;
}

/** 已穿戴装备属性弹窗（复用详情大面板，直接铺在遮罩上不套外层弹窗框；✕ 已去掉——点遮罩空白关闭，底部装备锻造；按钮无边框） */
function wornEquipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const inst = wornInst(hid, kind)!;
  const dim = dimLayer(ctx.screens, 0.68);
  const p = equipDetailPanel(dim, 0, -80, inst, true, true);
  closeOnBlankTap(dim);
  btn(p, 0, -255, 240, 76, '锻 造', PAL.gold, () => equipModal(ctx, hid, kind, rebuild), 24, true);
}

/** 仓库装备详情弹窗（同槽未穿戴时）：与穿戴详情同款蓝头+奶白板卡直接铺遮罩（无边框背板——用户反馈），
 *  出售价落在奶白板上，底部 出售/穿戴；点遮罩空白关闭 */
function warehouseEquipModal(ctx: PageCtx, hid: string, inst: EquipInst, rebuild: () => void): void {
  const d = EQUIPS[inst.defId];
  const dim = dimLayer(ctx.screens, 0.68);
  const p = equipDetailPanel(dim, 0, -80, inst, false, true);
  closeOnBlankTap(dim);
  label(p, 0, -160, `出售价：${sellPrice(inst)} 金币`, { size: 20, color: INK, bold: true });
  btn(p, -130, -255, 220, 76, '出 售', '#5A6472', () => confirmDismantle(ctx, inst, '出 售'), 22, true);
  btn(p, 130, -255, 220, 76, `穿戴·${KIND_NAME[d.kind]}`, PAL.green, () => {
    wearEquip(hid, d.kind, inst.uid);
    ctx.refresh();
  }, 21, true);
  void rebuild;
}

/** 分解/出售二次确认（确认后走 sellEquip；onOk 返回错误串则留在弹窗提示） */
function confirmDismantle(ctx: PageCtx, inst: EquipInst, okText: string): void {
  const d = EQUIPS[inst.defId];
  confirmModal(ctx, '分解确认', [
    `${d.name} · T${d.tier} 阶 · 等级${inst.lv}`,
    `品质：${QNAMES[d.quality]} · 分解返还 ${sellPrice(inst)} 金币`,
    '分解后装备无法恢复',
  ], okText, () => {
    const r = sellEquip(inst.uid);
    if (!r.ok) return r.msg;
    toast(r.msg);
    return null;
  });
}

/** 装备对比弹窗（无外层背板：遮罩上直接铺左右详情小面板，点遮罩空白关闭；按钮无边框——用户反馈） */
function compareEquipModal(ctx: PageCtx, hid: string, worn: EquipInst, next: EquipInst, rebuild: () => void): void {
  const dim = dimLayer(ctx.screens, 0.68);
  const side = (x: number, inst: EquipInst, isCur: boolean): void => {
    const d = EQUIPS[inst.defId];
    const p = equipDetailPanel(dim, x, -10, inst, isCur);
    if (isCur) {
      btn(p, 0, -195, 170, 64, '锻 造', PAL.gold, () => equipModal(ctx, hid, d.kind, rebuild), 22, true);
    } else {
      btn(p, -86, -195, 150, 64, '分 解', PAL.green, () => confirmDismantle(ctx, inst, '分 解'), 22, true);
      btn(p, 86, -195, 150, 64, '替 换', PAL.orange, () => {
        wearEquip(hid, d.kind, inst.uid);
        ctx.refresh();
      }, 22, true);
    }
  };
  side(-177, worn, true);
  side(177, next, false);
  closeOnBlankTap(dim);   // ✕ 已去掉——点遮罩空白关闭（用户确认）
}

/** 背包格：装备=详情（穿戴/出售）；材料=详情 */
function drawBagCell(ctx: PageCtx, grid: Node, cell: { uid: string; n: number }, hid: string, rebuild: () => void, x: number, y: number): void {
  const isMat = cell.n > 0;
  // 背包装备格的 uid 是实例 id：先查实例再取定义（直接 EQUIPS[cell.uid] 会查不到并中断整页网格渲染）
  const inst = isMat ? null : loadSave().equips.find(e => e.uid === cell.uid);
  const d = inst ? EQUIPS[inst.defId] : null;
  const q = isMat ? 0 : d?.quality ?? 0;
  const name = isMat ? MATS[cell.uid].name : d?.name ?? '???';
  const kind = isMat ? null : d?.kind ?? null;
  const g = itemSeat(grid, x, y, BAG_SIZE, BAG_SIZE, q, true);
  g.name = 'heroBagItem:' + cell.uid;
  const iconFb = label(g, 0, 4, kind ? KIND_ICON[kind] : '🧱', { size: 50 });
  // 物品切图（批次3）：装备按 defId、材料按物品 id（ui_item_mat_*），缺图回退 emoji
  if (isMat) artSprite(g, 0, 4, 100, 100, 'ui_item_' + cell.uid, { hideOnLoad: [iconFb] });
  else if (inst) artSprite(g, 0, 4, 100, 100, 'ui_item_' + inst.defId, { hideOnLoad: [iconFb] });
  const quantity = gpanel(g, 22, -44, 68, 24, CA('#15110D', 0.82), undefined, 0, 5);
  mainLabel(quantity, 0, 0, isMat ? `×${cell.n}` : `Lv.${inst?.lv ?? 1}`, { size: 18, color: '#FFF1CB',
    bold: true, align: 'right', w: 62, h: 22, outline: '#15110D', outlineW: 1 });

  g.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: boolean };
    if (ev) ev.propagationStopped = true;
    if (isMat) {
      const panel = modal(ctx, 560, 560, name);
      const m = MATS[cell.uid];
      label(panel, 0, 150, `持有 ×${loadSave().bag[cell.uid] || 0}`, { size: 22, color: '#FFE08A', w: 500, h: 32 });
      label(panel, 0, 50, m.desc, { size: 20, color: '#C8CDD4', w: 500, h: 60, shrink: true });
      label(panel, 0, -70, '来源：商店购买 / 关卡掉落', { size: 18, color: '#8D96A3', w: 500, h: 28 });
      label(panel, 0, -120, '用途：武器 / 装备强化材料', { size: 18, color: '#8D96A3', w: 500, h: 28 });
      return;
    }
    const cur = loadSave().equips.find(e => e.uid === cell.uid);
    if (!cur) return;
    const dd = EQUIPS[cur.defId];
    // 同槽已穿≠自己 → 双面板对比（替换/分解）；点的是已穿戴件 → 属性详情；同槽未穿 → 单弹窗（穿戴/出售）
    const worn = wornInst(hid, dd.kind);
    if (worn && worn.uid !== cur.uid) compareEquipModal(ctx, hid, worn, cur, rebuild);
    else if (worn) wornEquipModal(ctx, hid, dd.kind, rebuild);
    else warehouseEquipModal(ctx, hid, cur, rebuild);
  });
  void rebuild;
}

/** 属性总览弹窗（参考图抄版：标题栏 + 每行一条全宽浅色条目，名称左/数值右，层次分明；不含背景故事——用户确认） */
export function attrsModal(ctx: PageCtx, hid: string): void {
  const def = HERO_DEFS[hid];
  const st = heroStats(hid);
  const panel = modal(ctx, 620, 560, '属性总览', true);
  const rows: [string, string][] = [
    ['定位', def.job], ['战力', String(st.power)], ['攻击', String(st.atk)],
    ['攻速', `${st.atkSpd} 次/秒`], ['技能伤害', String(st.skillDmg)],
  ];
  rows.forEach((r, i) => {
    const bar = gpanel(panel, 0, 150 - i * 66, 552, 56, CA('#E9DFC2', 0.94), undefined, 0, 8);
    // label 的 x 是盒子中心（左/右对齐文字贴盒缘）：名称盒心 -142 → 文字左缘 -252（距条左 24）；
    // 数值盒心 102 → 文字右缘 252（距条右 24）
    label(bar, -142, 0, r[0], { size: 22, color: '#4A4034', bold: true, align: 'left', w: 220, h: 34, shrink: true });
    label(bar, 102, 0, r[1], { size: 24, color: '#332B20', bold: true, align: 'right', w: 300, h: 34, shrink: true });
  });
}

/** 背景故事弹窗（参考图布局：左列英雄大图+名字叠图底+解锁条件药丸，右列故事描述；不展示数值——用户确认） */
export function storyModal(ctx: PageCtx, hid: string): void {
  const def = HERO_DEFS[hid];
  const owned = !!loadSave().heroes[hid]?.owned;
  const panel = modal(ctx, 620, 560, `故事 · ${def.name}`, true);
  // 左列：立绘卡（名字叠图底）+ 解锁条件药丸 —— 立绘大图资源尚未落盘，用页面同款方形头像铺卡
  const card = gpanel(panel, -155, 60, 200, 330, CA('#20262F', 1), '#FFFFFF33', 1.5, 14);
  artSprite(card, 0, 48, 190, 190, def.avatar, { sliced: false });
  label(card, 0, -122, def.name, { size: 23, color: '#FFF3D6', bold: true, w: 190, h: 34, outline: '#1A2230', outlineW: 3 });
  const pill = gpanel(panel, -155, -160, 208, 52, CA('#B85C24', 0.95), undefined, 0, 26);
  label(pill, 0, 0, owned ? '✓ 已解锁' : `🔒 ${def.shopPrice} 金币解锁`, { size: 21, color: '#FFF3D6', bold: true, w: 200, h: 34 });
  // 右列：故事描述（多行左对齐）
  label(panel, 125, 60, def.story, { size: 22, color: '#E8DFC8', w: 290, h: 240, shrink: true, align: 'left' });
}
