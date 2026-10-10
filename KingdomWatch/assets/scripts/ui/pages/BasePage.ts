/**
 * ⑤ 基地：可点击的主城/研究院/工坊建筑场景，下方固定防线建设台。
 */
import { Graphics, Mask, Node, ScrollView, Sprite, UITransform, UIOpacity, Vec3, tween } from 'cc';
import { C, CA, btn, gcircle, gpanel, label, N, WY } from '../UIKit';
import { artAtlasSprite, artSprite } from '../Ux';
import { mainLabel, PageCtx, modal, toast, fmt, mainLayout, mainResourceTop, MAIN_RESOURCE_H, pageScroll } from '../PageKit';
import { zoneTab } from './UpgradePage';
import { LO, PAL } from '../../config/GameConfig';
import { CODEX, CODEX_REWARD, claimCodexReward, codexClaimed, codexUnlocked, keepHp, keepShield, keepUpCost, upKeep, MAX } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

const INK = '#4A3214', OK = '#3E7C28';

export function buildBase(ctx: PageCtx): void {
  const root = N('baseLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  const sv = loadSave(), maxed = sv.keepLv >= MAX.keep, cost = keepUpCost(sv.keepLv);
  const unlockedN = CODEX.filter(c => codexUnlocked(c.id)).length;
  const rewardsN = CODEX.filter(c => codexUnlocked(c.id) && !codexClaimed(c.id)).length;
  const titleTop = mainResourceTop() + MAIN_RESOURCE_H + 20;
  const boardH = LO.half * 2 < 1450 ? 228 : 248;
  const boardTop = mainLayout().bottom - boardH;
  const sceneTop = titleTop + 96, sceneBottom = boardTop - 14;
  const sceneH = Math.max(580, sceneBottom - sceneTop);
  const title = basePlaque(root, 0, WY(titleTop, 78), 468, 78);
  mainLabel(title, 0, 13, '远征营地', { size: 39, font: 'title', bold: true, color: '#FFE5A1', w: 380, h: 49, outline: '#23180E', outlineW: 2 });
  mainLabel(title, 0, -24, '建设主城 · 记录远征发现', { size: 20, color: '#D4BA8F', w: 400, h: 27 });

  // Only the settlement scrolls on short screens; wallet, construction board and navigation stay anchored.
  const scene = pageScroll(root, 'baseSettlement', sceneTop, sceneBottom, sceneH, 724);
  const keepH = Math.min(420, sceneH * 0.42);
  const keep = baseBuilding(scene, 'keep', 0, -sceneH * 0.43, 438, keepH, `主城 · Lv.${sv.keepLv}`,
    maxed ? '主城已满级' : '点击查看建设', () => keepModal(ctx), false, 294);
  if (!maxed && sv.gold >= cost) {
    const marker = gcircle(keep.root, keep.width * 0.38, keep.foot + keepH * 0.48, 23, C('#F8C554'), '#FFF0A5', 2);
    mainLabel(marker, 0, 1, '⇧', { size: 32, color: '#6E4214', bold: true, w: 42, h: 42 });
    const opacity = marker.addComponent(UIOpacity);
    tween(opacity).to(0.9, { opacity: 145 }).to(0.9, { opacity: 255 }).union().repeatForever().start();
  }
  const academyH = Math.min(304, sceneH * 0.335);
  const academy = baseBuilding(scene, 'academy', -181, -sceneH * 0.81, 326, academyH, '研究院',
    `怪物图鉴 ${unlockedN}/${CODEX.length}`, () => codexModal(ctx), false, 274);
  if (rewardsN) {
    const dot = gcircle(academy.root, 115, academy.foot - 6, 13, C('#E34E35'), '#FFD678', 2);
    mainLabel(dot, 0, 0, String(rewardsN), { size: 16, bold: true, color: '#FFF4D5', w: 23, h: 22 });
    const tag = basePlaque(academy.root, 0, academy.foot - 86, 230, 30, true);
    mainLabel(tag, 0, 0, `${rewardsN}份首览奖励可领取`, { size: 17, bold: true, color: INK, w: 218, h: 26 });
  }
  baseBuilding(scene, 'workshop', 181, -sceneH * 0.865, 326, Math.min(266, sceneH * 0.295), '工坊',
    '尚未开放', () => toast('工坊尚未开放'), true, 252);

  const board = N('baseConstruction', root, 0, WY(boardTop, boardH), 714, boardH);
  const boardFallback = basePlaque(board, 0, 0, 710, boardH);
  artAtlasSprite(board, 0, 0, 714, boardH, 'lobby_rewards_v1', 'shelf', { fit: false, hideOnLoad: [boardFallback] });
  mainLabel(board, -203, boardH / 2 - 27, '防线建设', { size: 29, font: 'title', color: '#FFE7AE', bold: true, align: 'left', w: 245, h: 39, outline: '#241A0F', outlineW: 2 });
  mainLabel(board, 239, boardH / 2 - 27, maxed ? 'Lv.10 · MAX' : `Lv.${sv.keepLv} → Lv.${sv.keepLv + 1}`, { size: 22, color: '#E6C285', w: 180, h: 34, align: 'right', outline: '#241A0F', outlineW: 1 });
  for (const [i, name, value, icon] of [
    [0, '防线耐久', keepHp(sv.keepLv), 'ui_icon_heart'],
    [1, '阶段护盾', keepShield(sv.keepLv), ''],
  ] as const) {
    const x = i === 0 ? -171 : 159;
    if (icon) artSprite(board, x - 98, boardH / 2 - 88, 38, 42, icon, { sliced: false });
    else {
      const shield = N('shieldEmblem', board, x - 98, boardH / 2 - 88).addComponent(Graphics);
      shield.fillColor = C('#83AFBB'); shield.strokeColor = C('#DBD9AA'); shield.lineWidth = 2;
      shield.moveTo(-16, 16); shield.lineTo(0, 22); shield.lineTo(16, 16); shield.lineTo(13, -5);
      shield.lineTo(0, -21); shield.lineTo(-13, -5); shield.close(); shield.fill(); shield.stroke();
      shield.strokeColor = C('#416373'); shield.lineWidth = 3;
      shield.moveTo(0, 12); shield.lineTo(0, -10); shield.stroke();
    }
    mainLabel(board, x - 7, boardH / 2 - 70, name, { size: 20, color: '#D6C0A0', w: 128, h: 28, align: 'left', outline: '#251A10', outlineW: 1.5 });
    mainLabel(board, x + 4, boardH / 2 - 102, fmt(value), { size: 29, color: '#FFF0C8', bold: true, w: 150, h: 38, align: 'left', outline: '#211A10', outlineW: 2 });
  }
  const action = basePlaque(board, 0, -boardH / 2 + 55, 656, 82, true);
  artSprite(action, -271, 0, 48, 51, 'ui_nav_upgrade', { sliced: false });
  mainLabel(action, -102, 0, maxed ? '查看主城' : '升级主城', { size: 34, font: 'title', bold: true, color: '#41290F', w: 240, h: 54 });
  if (!maxed) {
    artSprite(action, 107, 0, 38, 38, 'ui_icon_coin', { sliced: false });
    mainLabel(action, 211, 0, fmt(cost), { size: 29, bold: true, color: sv.gold >= cost ? '#523114' : '#984025', w: 148, h: 45 });
  } else {
    mainLabel(action, 190, 0, '已满级', { size: 23, color: '#76552D', w: 158, h: 40 });
  }
  baseTap(action, () => keepModal(ctx));
}

/** Building nameplates and construction controls share a single wood/brass treatment. */
function basePlaque(parent: Node, x: number, y: number, w: number, h: number, gold = false): Node {
  const node = N('basePlaque', parent, x, y, w, h);
  const g = node.addComponent(Graphics);
  const shape = (inset: number, dy = 0): void => {
    const l = -w / 2 + inset, r = w / 2 - inset, b = -h / 2 + inset + dy, t = h / 2 - inset + dy;
    const bevel = Math.min(13, h * 0.2);
    g.moveTo(l + bevel, t); g.lineTo(r - bevel, t); g.lineTo(r, t - bevel); g.lineTo(r, b + bevel);
    g.lineTo(r - bevel, b); g.lineTo(l + bevel, b); g.lineTo(l, b + bevel); g.lineTo(l, t - bevel); g.close();
  };
  g.fillColor = CA('#171008', 0.6); shape(0, -4); g.fill();
  g.fillColor = C(gold ? '#8E5A17' : '#392719'); shape(0); g.fill();
  g.fillColor = C(gold ? '#E2AD4B' : '#987245'); shape(2); g.fill();
  g.fillColor = C(gold ? '#FFD05E' : '#4C3421'); shape(5); g.fill();
  g.strokeColor = C(gold ? '#FFF0A6' : '#BD995E'); g.lineWidth = 1.5; shape(6); g.stroke();
  return node;
}

function baseTap(node: Node, cb: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.98, 0.98, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE));
  node.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    node.setScale(Vec3.ONE);
    if (e) e.propagationStopped = true;
    cb();
  });
}

function baseBuilding(parent: Node, key: string, x: number, footY: number, w: number, h: number, name: string,
  subtitle: string, cb: () => void, locked = false, labelW = 270): { root: Node; foot: number; width: number } {
  // The broad touch rectangle contains the whole building and its label, without a visible card behind it.
  const root = N('baseBuilding:' + key, parent, x, footY + h / 2 - 35, w, h + 90);
  const foot = -h / 2 + 35;
  const shadow = N('foundationShadow', root, 0, foot + 8).addComponent(Graphics);
  shadow.fillColor = CA('#2A2E17', 0.18); shadow.ellipse(0, 0, w * 0.35, 13); shadow.fill();
  const loading = artSprite(root, 0, foot + h / 2, 90, 100, key === 'keep' ? 'ui_nav_base' : key === 'academy' ? 'ui_icon_skull' : 'ui_icon_lock', { sliced: false });
  artAtlasSprite(root, 0, foot, w, h, 'lobby_base_buildings_v1', key, { anchorBottom: true, hideOnLoad: [loading],
    onLoaded: art => { if (locked) art.getComponent(Sprite)!.color = C('#9B9B92'); },
  });
  const plate = basePlaque(root, 0, foot - 23, labelW, 48);
  if (locked) artSprite(plate, -66, 0, 24, 28, 'ui_icon_lock');
  mainLabel(plate, locked ? 8 : 0, 0, name, { size: 28, font: 'title', bold: true, color: locked ? '#C7BBA4' : '#FFEDBC', w: labelW - 38, h: 39, outline: '#24180E', outlineW: 1.5 });
  mainLabel(root, 0, foot - 60, subtitle, { size: 20, color: locked ? '#B5AC98' : '#FFEAC0', w: labelW + 14, h: 29, outline: '#29301A', outlineW: 2 });
  baseTap(root, cb);
  return { root, foot, width: w };
}

function NodeClick(): string { return 'touch-end'; }

/* ---------- 主城建设：羊皮纸预览 + 木金行动条，使用原有金币升级操作 ---------- */
function keepModal(ctx: PageCtx): void {
  const sv = loadSave(), maxed = sv.keepLv >= MAX.keep, cost = keepUpCost(sv.keepLv);
  const W = 620, H = 590;
  const panel = modal(ctx, W, H, '', true);
  const backing = panel.getComponent(Graphics)!;
  backing.clear(); backing.fillColor = C('#EFDCAD');
  backing.roundRect(-W / 2, -H / 2, W, H, 18); backing.fill();
  const paper = artAtlasSprite(panel, 0, 0, W, H, 'lobby_training_v1', 'parchment', { sliceBorder: 0.16, sliceScale: 0.85 });
  paper.setSiblingIndex(0);
  mainLabel(panel, 0, H / 2 - 49, '主城建设', { size: 34, font: 'title', color: INK, bold: true, w: 420, h: 46 });
  mainLabel(panel, 0, H / 2 - 91, maxed ? `Lv.${sv.keepLv} · 已满级` : `Lv.${sv.keepLv} → Lv.${sv.keepLv + 1}`, {
    size: 26, bold: true, color: '#856030', w: 440, h: 36,
  });
  artAtlasSprite(panel, -178, 32, 202, 204, 'lobby_base_buildings_v1', 'keep');
  mainLabel(panel, -178, -90, '守护王国防线', { size: 20, color: '#82603B', w: 202, h: 30 });
  const rows = [
    { name: '防线耐久', cur: keepHp(sv.keepLv), next: maxed ? keepHp(sv.keepLv) : keepHp(sv.keepLv + 1) },
    { name: '阶段护盾', cur: keepShield(sv.keepLv), next: maxed ? keepShield(sv.keepLv) : keepShield(sv.keepLv + 1) },
  ];
  rows.forEach((r, i) => {
    const y = 108 - i * 98;
    mainLabel(panel, 118, y, r.name, { size: 24, bold: true, color: INK, w: 256, h: 34 });
    mainLabel(panel, 118, y - 35, `${fmt(r.cur)} → ${fmt(r.next)}`, { size: 28, bold: true, color: INK, w: 268, h: 40 });
    mainLabel(panel, 118, y - 69, maxed ? '已达上限' : r.next > r.cur ? `+${fmt(r.next - r.cur)}` : '本级保持', {
      size: 21, color: OK, w: 256, h: 30,
    });
  });
  mainLabel(panel, 0, -144, '耐久每级 +100 · 阶段护盾每3级 +200', { size: 21, color: '#86643D', w: 530, h: 36 });
  const action = basePlaque(panel, 0, -217, 536, 78);
  if (maxed) {
    mainLabel(action, 0, 0, '主城建设已完成', { size: 27, bold: true, color: '#EED5A5', w: 470, h: 42 });
  } else {
    artSprite(action, -223, 0, 41, 41, 'ui_icon_coin', { sliced: false });
    mainLabel(action, -106, 14, fmt(cost), { size: 26, bold: true, color: sv.gold >= cost ? '#FFE39D' : '#FFAA81', w: 154, h: 36, align: 'left' });
    mainLabel(action, -106, -19, `持有 ${fmt(sv.gold)}`, { size: 17, color: '#CAB08D', w: 154, h: 26, align: 'left' });
    const upgrade = basePlaque(action, 161, 0, 190, 63, true);
    mainLabel(upgrade, 0, 0, '升 级', { size: 29, font: 'title', bold: true, color: INK, w: 164, h: 42 });
    baseTap(upgrade, () => {
      const r = upKeep(); toast(r.msg);
      if (r.ok) { panel.parent?.destroy(); ctx.refresh(); }
    });
  }
}

/* ---------- 研究院：怪物图鉴弹窗（扁平无框；两列卡片可滑动查看全部，未领奖励带红点） ---------- */
function codexModal(ctx: PageCtx): void {
  const panel = modal(ctx, 620, 760, '研究院 · 怪物图鉴', true);
  label(panel, 0, 290, '关卡内遭遇怪物解锁图鉴 · 首次查看可领钻石奖励', { size: 18, color: '#8D96A3', w: 560, h: 28 });
  /* 可滑动卡片区（滚动视图，怪物增多后超出即滚） */
  const VIEW_H = 570, CARD_H = 182, GAP = 16, PAD = 16;
  const rows = Math.ceil(CODEX.length / 2);
  const stackH = rows * CARD_H + (rows - 1) * GAP;
  const contentH = Math.max(stackH + PAD * 2, VIEW_H);
  const off = contentH > VIEW_H ? PAD : (VIEW_H - stackH) / 2;
  const view = N('cxView', panel, 0, (270 + -340) / 2, 560, VIEW_H);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const ct = N('cxContent', view, 0, VIEW_H / 2, 560, contentH);
  ct.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
  scroll.content = ct;
  scroll.horizontal = false;
  scroll.vertical = true;
  CODEX.forEach((c, i) => {
    const got = codexUnlocked(c.id);
    const cell = gpanel(ct, i % 2 === 0 ? -142 : 142, -(off + Math.floor(i / 2) * (CARD_H + GAP) + CARD_H / 2), 265, CARD_H,
      got ? CA('#E9DFC2', 0.94) : CA('#D8CBA8', 0.9), undefined, 0, 12);
    const fallback = label(cell, 0, 28, got ? c.icon : '❓', { size: 44 });
    if (got) artAtlasSprite(cell, 0, 34, 112, 108, 'battle_mobs_v2', c.id, { hideOnLoad: [fallback] });
    label(cell, 0, -38, got ? c.name : '???', { size: 20, color: got ? INK : '#6B5A3A', bold: true, w: 240, h: 28, shrink: true });
    label(cell, 0, -71, got ? '点开词条 ▶' : '未解锁', { size: 16, color: got ? OK : '#8A7A5C', w: 240, h: 24 });
    if (got && !codexClaimed(c.id)) gpanel(cell, 112, 62, 18, 18, CA('#E5484D', 1), undefined, 0, 9);
    if (got) cell.on(NodeClick(), () => codexDetail(ctx, c.id));
  });
}

/* ---------- 怪物词条详情（参考图版式：大图标 + 名称 + 标签 + 描述/弱点分区 + 首览奖励领取） ---------- */
function codexDetail(ctx: PageCtx, id: string): void {
  const c = CODEX.find(x => x.id === id)!;
  const W = 620, H = 660, PW = 560;
  const panel = modal(ctx, W, H, '', true);
  /* 大图标 + 名称 + 两枚标签（体型/定位，绿/蓝小圆角板） */
  gcircle(panel, 0, H / 2 - 120, 62, CA('#2A3240', 1));
  const fallback = label(panel, 0, H / 2 - 120, c.icon, { size: 60 });
  artAtlasSprite(panel, 0, H / 2 - 120, 138, 132, 'battle_mobs_v2', c.id, { hideOnLoad: [fallback] });
  label(panel, 0, H / 2 - 210, c.name, { size: 30, color: '#FFF3D6', bold: true, w: 500, h: 40 });
  const tags: [string, string][] = [[c.tags[0], '#3E7C28'], [c.tags[1], '#1F6BC4']];
  tags.forEach((t, i) => {
    const px = i === 0 ? -80 : 80;
    gpanel(panel, px, H / 2 - 268, 130, 44, CA(t[1], 0.95), undefined, 0, 22);
    label(panel, px, H / 2 - 268, t[0], { size: 19, color: '#FFF3D6', bold: true, w: 130, h: 44 });
  });
  /* 怪物描述 / 弱点（奶白分区板 + 金签出板） */
  const p1Top = H / 2 - 306;
  const p1 = gpanel(panel, 0, p1Top - 55, PW, 110, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p1Top + 17, '怪物描述');
  label(p1, 0, 0, c.desc, { size: 19, color: INK, w: 500, h: 70, shrink: true });
  const p2Top = p1Top - 110 - 44;
  const p2 = gpanel(panel, 0, p2Top - 44, PW, 88, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p2Top + 17, '弱点');
  label(p2, 0, 0, c.weak, { size: 20, color: INK, bold: true, w: 500, h: 40, shrink: true });
  /* 行动条：首览奖励（💎 +20钻）+ 领取/已领取 */
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, 64, CA('#14181E', 0.72), undefined, 0, 32);
  gcircle(act, -212, 0, 24, CA(PAL.blue, 0.25));
  label(act, -212, 0, '💎', { size: 24 });
  label(act, -128, 0, `+${CODEX_REWARD} 钻`, { size: 22, color: '#CFE3FF', bold: true, align: 'left', w: 120, h: 48, shrink: true });
  const claimed = codexClaimed(c.id);
  if (!claimed) {
    btn(act, 195, 0, 160, 54, '领 取', PAL.gold, () => {
      const r = claimCodexReward(id);
      toast(r.msg);
      if (r.ok) { const d = panel.parent; if (d) d.destroy(); ctx.refresh(); }
    }, 24, true);
    gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  } else {
    label(act, 195, 0, '已领取', { size: 22, color: '#AAB2BD', w: 160, h: 40 });
  }
}
