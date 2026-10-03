/**
 * 主界面页面共享工具：toast / 模态弹窗框架 / 品质徽标 / 货币小标
 * 设计坐标与线稿一致：顶基 y 统一 WY(线稿设计值)（线稿数字=含刘海偏移的绝对 y），弹窗面板居中。
 */
import { Node, UIOpacity, tween } from 'cc';
import { PAL } from '../config/GameConfig';
import { CA, btn, C, dimLayer, gpanel, label, N, WY, WX } from './UIKit';
import { artSprite } from './Ux';
import { Quality, QCOLOR, QNAME } from '../core/GameData';

export interface PageCtx {
  screens: Node;
  /** 全屏刷新（页签内容整屏重建 + 顶栏货币刷新） */
  refresh: () => void;
}

/** 轻提示：屏幕上中部浮字，1.6s 后淡出销毁 */
export function toast(msg: string): void {
  const scene = GLOBAL_ROOT;
  if (!scene) return;
  const n = N('toast', scene, 0, WY(560, 60), 750, 60);
  const p = gpanel(n, 0, 0, 460, 60, CA('#14181E', 0.94), CA(PAL.gold, 0.9), 2, 30);
  label(p, 0, 0, msg, { size: 24, color: '#FFE08A', bold: true, w: 440, h: 40, shrink: true });
  const op = n.addComponent(UIOpacity);
  tween(op).delay(1.1).to(0.5, { opacity: 0 }).call(() => n.destroy()).start();
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
    dim.destroy();
  });
  const panel = gpanel(dim, 0, -80, w, h, CA('#1B201A', 0.97), flat ? undefined : CA(PAL.gold, 0.95), 2.5, 18);
  if (!flat) artSprite(panel, 0, 0, w, h, 'ui_panel_dark_gold', { belowIdx: 0 });
  if (title) label(panel, 0, h / 2 - 44, title, { size: 28, color: '#FFE08A', bold: true });
  const close = btn(panel, w / 2 - 40, h / 2 - 40, 56, 56, '✕', PAL.gold, () => dim.destroy(), 26, flat);
  close.name = 'btn_close';
  /* 面板吞掉触摸：点面板内容（含无 handler 的行）不会落到遮罩上误关弹窗 */
  panel.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: boolean };
    if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;
  });
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
export function confirmModal(ctx: PageCtx, title: string, lines: string[], okText: string, onOk: () => string | null, icon = ''): void {
  const panel = modal(ctx, 560, icon ? 580 : 420, title, true);
  if (icon) {
    const seat = gpanel(panel, 0, 120, 150, 150, CA('#2A3240', 1), undefined, 0, 16);
    label(seat, 0, 0, icon, { size: 76 });
  }
  const top = icon ? -20 : 60;
  lines.forEach((t, i) => label(panel, 0, top - i * 44, t, { size: 22, color: '#E8E0C8', w: 520, h: 40, shrink: true }));
  const by = icon ? -210 : -130;
  btn(panel, 130, by, 200, 76, okText, PAL.green, () => {
    const err = onOk();
    if (err) { toast(err); return; }
    const dim = panel.parent;
    if (dim) dim.destroy();
    ctx.refresh();
  }, 24, true);
  btn(panel, -130, by, 200, 76, '取 消', '#5A6472', () => { const d = panel.parent; if (d) d.destroy(); }, 24, true);
}

/** 内容顶基坐标：统一用 WY() 直读线稿设计值（线稿数字即含刘海偏移的绝对 y）；CX 为横向便捷别名 */
export function CX(l: number, w: number): number { return WX(l, w); }
