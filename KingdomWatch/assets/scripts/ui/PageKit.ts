/**
 * 主界面页面共享工具：toast / 模态弹窗框架 / 品质徽标 / 货币小标
 * 设计坐标与线稿一致：顶基 y 统一 WY(线稿设计值)（线稿数字=含刘海偏移的绝对 y），弹窗面板居中。
 */
import { Graphics, Mask, Node, ScrollView, UITransform, UIOpacity } from 'cc';
import { LO, PAL } from '../config/GameConfig';
import { CA, btn, C, dlgConfirm, dimLayer, gpanel, label, LabelOpts, N, WY, WX } from './UIKit';
import { artSprite } from './Ux';
import { COMIC, comicPlate } from './ComicUI';
import { HERO_DEFS, Quality, QCOLOR, QNAME } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { BattleSprite } from '../battle/BattleSprite';
import { bindButton } from './ButtonFeedback';
import { dismissUI, motionIn } from './UIMotion';
import { uiSound } from './UIAudio';
import { NoticeOptions, showNotice } from './UINotice';

/** Shared geometry for the five lobby pages, in visible top-origin units. */
export const MAIN_NAV_H = 128;
export const MAIN_W = 686;
export const MAIN_RESOURCE_H = 56;
/** Leave a fixed notch band even when a mobile browser reports no safe-area inset. */
export function mainResourceTop(): number { return Math.max(92, LO.notchTop + 20); }
/** Keep alignment anchored to the intended text box after bundled fonts load. */
export function mainLabel(parent: Node, x: number, y: number, text: string, opts: LabelOpts = {}): Node {
  return label(parent, x, y, text, { shrink: true, ...opts });
}
export function mainLayout(): { headerTop: number; top: number; bottom: number; height: number } {
  const headerTop = mainResourceTop();
  const top = headerTop + MAIN_RESOURCE_H + 100;
  const bottom = LO.half * 2 - LO.safeTop - LO.safeBottom - MAIN_NAV_H - 20;
  return { headerTop, top, bottom, height: bottom - top };
}

/** Quiet inset tabs; labels and touch targets share the same rectangle. */
export function mainSegments(parent: Node, top: number, names: readonly string[], selected: number,
  onSelect: (index: number) => void, locked: readonly boolean[] = [], local = false): void {
  const h = 58, w = MAIN_W / names.length;
  const bar = gpanel(parent, 0, local ? -top - h / 2 : WY(top, h), MAIN_W, h, CA('#15221F', 0.92), undefined, 0, 16);
  names.forEach((name, i) => {
    const active = selected === i;
    const slot = gpanel(bar, -MAIN_W / 2 + w * (i + 0.5), 0, w - 8, h - 8,
      active ? '#E8BA60' : CA('#FFFFFF', 0), undefined, 0, 12);
    mainLabel(slot, 0, 0, (locked[i] ? '锁定 · ' : '') + name,
      { size: locked[i] ? 18 : 22, color: active ? '#322815' : locked[i] ? '#8D9A91' : '#D8DFD4', bold: active, w: w - 16, h: 40, shrink: true });
    bindButton(slot, () => onSelect(i), { scale: .96, shift: 1, sound: 'select' });
  });
}

/** A top-anchored scroll body, always clipped above the persistent navigation. */
export function pageScroll(parent: Node, name: string, top: number, bottom: number, contentHeight: number, width = MAIN_W): Node {
  const height = Math.max(1, bottom - top);
  const view = N(name + 'View', parent, 0, WY(top, height), width, height);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const content = N(name + 'Content', view, 0, height / 2, width, Math.max(height, contentHeight));
  content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
  scroll.content = content;
  scroll.horizontal = false;
  scroll.vertical = contentHeight > height;
  return content;
}

export function sectionTitle(parent: Node, y: number, title: string, note = ''): void {
  mainLabel(parent, -208, y, title, { size: 23, color: '#FFF0CD', bold: true, align: 'left', w: 270, h: 32, outline: '#203026', outlineW: 1 });
  if (note) mainLabel(parent, 207, y, note, { size: 17, color: '#E0E5D7', align: 'right', w: 270, h: 28, outline: '#203026', outlineW: 1 });
}

/** One consistent hero selector on the hero and upgrade pages. */
export function heroRoster(parent: Node, top: number, selected: string, onSelect: (id: string) => void): void {
  const sv = loadSave();
  Object.values(HERO_DEFS).forEach((def, i) => {
    const owned = !!sv.heroes[def.id]?.owned;
    const active = def.id === selected;
    const slot = gpanel(parent, (i - 2) * 138, WY(top, 104), 124, 104,
      active ? CA('#3D5034', 0.96) : CA('#15221F', 0.84), undefined, 0, 16);
    const avatar = artSprite(slot, 0, 12, 64, 64, def.avatar, { sliced: false });
    if (!owned) {
      avatar.addComponent(UIOpacity).opacity = 95;
      artSprite(slot, 0, 12, 24, 24, 'ui_icon_lock', { sliced: false });
    }
    mainLabel(slot, 0, -32, def.name.split('·')[0], { size: 18, color: active ? '#FFE1A0' : owned ? '#D9DFD4' : '#8D9A91', bold: active, w: 112, h: 24 });
    if (active) gpanel(slot, 0, -49, 28, 3, '#E8BA60', undefined, 0, 1);
    bindButton(slot, () => {
      if (!owned) { toast('前往商店解锁该英雄'); return; }
      onSelect(def.id);
    }, { sound: 'select' });
  });
}

/** Reuse the delivered full-body hero art instead of layering an avatar over it. */
export function heroFigure(parent: Node, id: string, x: number, footY: number, height: number,
  opts: { lobby?: boolean; maxWidth?: number } = {}): void {
  const shadow = N('heroGround', parent, x, footY, 200, 24).addComponent(Graphics);
  shadow.fillColor = CA('#0B1712', 0.28);
  shadow.ellipse(0, 0, Math.min(110, height * 0.28), 10);
  shadow.fill();
  const fallbackSize = Math.min(height * 0.75, opts.maxWidth ?? Infinity);
  const fallback = artSprite(parent, x, footY + height / 2, fallbackSize, fallbackSize, HERO_DEFS[id].avatar, { sliced: false });
  const art = new BattleSprite(parent, opts.lobby ? 'lobby_heroes_v1' : 'battle_heroes_v2', () => {
    if (fallback.isValid) fallback.active = false;
    const frame = art.sprite.spriteFrame;
    if (frame && opts.maxWidth) art.show(id + '_idle', Math.min(height, opts.maxWidth * frame.rect.height / frame.rect.width));
  });
  art.node.setPosition(x, footY, 0);
  art.show(id + '_idle', height);
}

export interface PageCtx {
  screens: Node;
  /** 全屏刷新（页签内容整屏重建 + 顶栏货币刷新） */
  refresh: () => void;
  /** Update shared currencies without replacing the page or its open dialog. */
  refreshResources?: () => void;
}

/** Shared non-blocking notices survive page content rebuilds. */
export function toast(msg: string, options: NoticeOptions = {}): void {
  if (GLOBAL_ROOT?.isValid) showNotice(GLOBAL_ROOT, msg, options);
}

/** MainUI 注入的全局根（toast 挂载点，独立于页签容器不被整屏重建） */
export let GLOBAL_ROOT: Node | null = null;
export function setGlobalRoot(n: Node): void { GLOBAL_ROOT = n; }

/** 弹窗框架：全屏遮罩（点空白区域直接关闭）+ 面板 + 右上关闭。返回面板节点（调用者往里填内容；面板本地 y 向上为正）
 *  flat=true 无边框规范（用户确认：属性/故事弹窗去边框——无金描边、无带框面板美术、关闭钮纯色板） */
export function modal(ctx: PageCtx, w: number, h: number, title: string, flat = false): Node {
  const dim = dimLayer(ctx.screens, 0.68);
  dim.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: boolean };
    if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;  // 不连关下层弹窗
    dismissUI(dim);
  });
  const panel = gpanel(dim, 0, -80, w, h, CA('#1B201A', 0.97), flat ? undefined : CA(PAL.gold, 0.95), 2.5, 18);
  if (!flat) artSprite(panel, 0, 0, w, h, 'ui_panel_dark_gold', { belowIdx: 0 });
  if (title) label(panel, 0, h / 2 - 44, title, { size: 28, color: '#FFE08A', bold: true });
  const close = dlgConfirm(panel, w / 2 - 40, h / 2 - 40, 56, 56, '✕', () => dismissUI(dim), 26, '#8A93A0', '#5F6873', 'ui_btn_close');
  close.name = 'btn_close';
  /* 面板吞掉触摸：点面板内容（含无 handler 的行）不会落到遮罩上误关弹窗 */
  panel.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: boolean };
    if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;
  });
  motionIn(panel, 'modal'); uiSound('open');
  return panel;
}

/** 品质徽标（左上角标，缩小版——用户确认不与商品图重叠）：白/绿/蓝/紫 + N阶 */
export function qualityBadge(parent: Node, x: number, y: number, q: Quality, tier: number): Node {
  const b = gpanel(parent, x, y, 92, 28, CA('#0B0F16', 0.85), C(QCOLOR[q]), 2, 8);
  label(b, 0, 0, `${QNAME[q]}${tier}阶`, { size: 16, color: QCOLOR[q], bold: true, w: 86, h: 24 });
  return b;
}

/** 货币小行：icon + 数量（gold/diamond） */
export function currencyChip(parent: Node, x: number, y: number, cur: 'gold' | 'diamond', amount: number, size = 34): Node {
  const row = N('cur', parent, x, y, 160, size);
  const seat = gpanel(row, -62, 0, size, size, CA(cur === 'gold' ? PAL.gold : PAL.blue, 0.2), cur === 'gold' ? PAL.gold : PAL.blue, 2, size / 2);
  artSprite(seat, 0, 0, size, size, cur === 'gold' ? 'ui_circ_icon_gold' : 'ui_circ_icon_blue', { belowIdx: 0 });
  artSprite(seat, 0, 0, size - 8, size - 8, cur === 'gold' ? 'ui_icon_coin' : 'ui_icon_diamond', { sliced: false });
  label(row, 12, 0, cur === 'gold' ? fmt(amount) : String(amount), { size: 22, color: cur === 'gold' ? '#FFF3D6' : '#CFE3FF', bold: true, align: 'left', w: 100, h: 30 });
  return row;
}

/** 千分位格式化 */
export function fmt(v: number): string { return v.toLocaleString('en-US'); }

/* ---------- 一级内容背板（主城层次规范 L1：场景底图 → 组件分组背板 → 卡片/格子） ----------
 * 程序暗板+金描边打底，保证无美术时也成体系；美术按文件名替换——
 * 把同名 PNG 放进 assets/resources/ux/ 即自动九宫格覆盖，零代码改动。已规划 ID：
 *   ui_panel_tabs（页签条背板）/ ui_panel_bag（背包网格背板）/ ui_panel_zone（通用内容区背板） */
export function artPanel(parent: Node, x: number, y: number, w: number, h: number, id: string): Node {
  const p = gpanel(parent, x, y, w, h, CA('#10151D', 0.8), CA(PAL.gold, 0.55), 1.5, 16);
  artSprite(p, 0, 0, w, h, id, { belowIdx: 0 });
  return p;
}

/** 确认弹窗（价格/说明 + 确认/取消），onOk 返回错误消息则不关闭并 toast
 *  用户确认：无边框（flat）；icon 非空时在弹窗上部居中显示商品图（emoji 兜底，落美术后同座替换） */
export function confirmModal(ctx: PageCtx, title: string, lines: string[], okText: string, onOk: () => string | null, icon = '', artId = ''): void {
  const hasSeat = !!(icon || artId);
  const panel = modal(ctx, 560, hasSeat ? 580 : 420, title, true);
  if (hasSeat) {
    const seat = gpanel(panel, 0, 120, 150, 150, CA('#2A3240', 1), undefined, 0, 16);
    const fb = label(seat, 0, 0, icon, { size: 76 });
    if (artId) artSprite(seat, 0, 0, 142, 142, artId, { sliced: false, hideOnLoad: [fb] });   // 美术落图盖 emoji 兜底
  }
  const top = hasSeat ? -20 : 60;
  lines.forEach((t, i) => label(panel, 0, top - i * 44, t, { size: 22, color: '#E8E0C8', w: 520, h: 40, shrink: true }));
  const by = hasSeat ? -210 : -130;
  btn(panel, 130, by, 200, 76, okText, PAL.green, () => {
    const err = onOk();
    if (err) { toast(err, { kind: 'warning' }); return; }
    const dim = panel.parent;
    uiSound('confirm'); dismissUI(dim, ctx.refresh, false);
  }, 24, true);
  btn(panel, -130, by, 200, 76, '取 消', '#5A6472', () => dismissUI(panel.parent), 24, true);
}

/** 内容顶基坐标：统一用 WY() 直读线稿设计值（线稿数字即含刘海偏移的绝对 y）；CX 为横向便捷别名 */
export function CX(l: number, w: number): number { return WX(l, w); }

/** 图内左右切换圆钮（关卡页/英雄页共用——用户确认复用）：无边框深色半透圆板 + 奶白箭头；dir -1=左 1=右 */
export function circleArrow(parent: Node, x: number, y: number, dir: -1 | 1, cb: () => void): Node {
  const ar = gpanel(parent, x, y, 64, 64, CA('#14181E', 0.55), undefined, 0, 32);
  label(ar, 0, 0, dir < 0 ? '◀' : '▶', { size: 26, color: '#F5E6C8', bold: true, w: 64, h: 40 });
  bindButton(ar, cb, { circle: true });
  return ar;
}
