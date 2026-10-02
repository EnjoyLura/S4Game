/**
 * ② 英雄（线稿 heroes）：大图环绕式 —— 单英雄大立绘（左右箭头叠图内）+ 战力徽章 + 属性/故事圆钮
 * 右列装备槽（武器横扁×1 + 2×2 防具）：点已穿槽=装备属性弹窗（锻造），空槽无反应；
 * 下方背包：点仓库装备=同槽已穿则双面板对比（分解/替换），未穿则单弹窗（穿戴/出售）。
 */
import { Node } from 'cc';
import { PAL, LO } from '../../config/GameConfig';
import { CA, btn, C, gpanel, label, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, CX, confirmModal } from '../PageKit';
import {
  EquipKind, EquipDef, KIND_NAME, QCOLOR, EQUIPS, MATS, HERO_DEFS,
  heroStats, sellEquip, sellPrice, wearEquip, wornInst, equipAtk, equipHp, tierMul,
} from '../../core/GameData';
import { EquipInst, loadSave, saveSave } from '../../core/SaveData';
import { equipModal } from './UpgradePage';

const KIND_ICON: Record<EquipKind, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const SLOTS_2x2: EquipKind[] = ['helm', 'acc', 'glove', 'armor'];
/* 背包页签跨刷新保持（穿戴/出售后 refresh 重建不跳回「武器」） */
const bagSt: { tab: 'weapon' | 'equip' | 'mat' } = { tab: 'weapon' };

export function buildHeroes(ctx: PageCtx): void {
  const root = ctx.screens;
  const sv = loadSave();
  const owned = (['archer', 'sniper'] as const).filter(id => sv.heroes[id].owned);
  if (!owned.includes(sv.curHero as 'archer' | 'sniper')) sv.curHero = owned[0];
  const state = { hi: Math.max(0, owned.indexOf(sv.curHero as 'archer' | 'sniper')) };

  const content = N('heroContent', root, 0, 0, 750, 800);
  render();

  function render(): void {
    content.destroyAllChildren();
    if (state.hi >= owned.length) state.hi = 0;
    const hid = owned[state.hi];
    const def = HERO_DEFS[hid];
    const stats = heroStats(hid);
    sv.curHero = hid;
    saveSave();

    /* 英雄名行 */
    label(content, 0, WY(205, 40), `${def.name}　${def.job}`, { size: 28, color: '#FFF3D6', bold: true, w: 640, h: 40, shrink: true });

    /* 大立绘 + 立绘内左右箭头（切换已拥有英雄） */
    const portrait = gpanel(content, CX(160, 280), WY(305, 440), 280, 440, CA('#20262F', 1), '#FFFFFF33', 1.5, 18);
    artSprite(portrait, 0, 0, 280, 440, 'hero_' + hid + '_portrait', { belowIdx: 0 });
    artSprite(portrait, 0, 40, 190, 190, def.avatar, { sliced: false });
    btn(portrait, -105, -20, 70, 70, '◀', PAL.gold, () => { state.hi = (state.hi + owned.length - 1) % owned.length; render(); }, 26);
    btn(portrait, 105, -20, 70, 70, '▶', PAL.gold, () => { state.hi = (state.hi + 1) % owned.length; render(); }, 26);
    portrait.on(Node.EventType.TOUCH_END, () => attrsModal(ctx, hid));

    /* 战力徽章（立绘正下方） */
    const badge = gpanel(content, CX(220, 180), WY(755, 70), 180, 70, CA('#3A2E23', 0.9), C(PAL.gold), 2.5, 35);
    artSprite(badge, 0, 0, 180, 70, 'ui_banner_title', { belowIdx: 0 });
    label(badge, 0, 0, `🔥 ${stats.power}`, { size: 26, color: '#FFE08A', bold: true });

    /* 左列：属性 / 故事 圆钮 */
    btn(content, CX(30, 76), WY(340, 76), 76, 76, '属性', PAL.blue, () => attrsModal(ctx, hid), 20);
    btn(content, CX(30, 76), WY(440, 76), 76, 76, '故事', PAL.blue, () => storyModal(ctx, hid), 20);

    /* 右列槽区：武器横扁 + 2×2 防具 */
    drawSlot(ctx, content, hid, 'weapon', () => render(), CX(470, 270), WY(305, 125), 270, 125);
    SLOTS_2x2.forEach((k, i) => {
      drawSlot(ctx, content, hid, k, () => render(), CX(470 + (i % 2) * 140, 130), WY(440 + Math.floor(i / 2) * 160, 150), 130, 150);
    });

    /* 我的背包：页签 + 5 列网格 */
    const tabs = [['weapon', '武器'], ['equip', '装备'], ['mat', '材料']] as const;
    tabs.forEach((t, i) => {
      const active = tabs[i][0] === bagSt.tab;
      btn(content, CX(45 + i * 225, 200), WY(872, 58), 200, 58, t[1], active ? PAL.gold : '#5A6472', () => {
        bagSt.tab = t[0];
        render();
      }, 22);
    });
    const grid = N('bagGrid', content, 0, 0, 750, 300);

    function renderBag(): void {
      grid.destroyAllChildren();
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
      // 行数按屏幕可视高动态铺满（Fit-Width 高屏可视 > 1334，固定 2 行会与底部导航间留大片空白）
      const GRID_TOP = 885;   // 首行上缘（行中心 945 − 60）
      const ROW_H = 132;
      const availBottom = 2 * LO.half - 150;   // 预留底部导航(122)+边距
      const rows = Math.max(2, Math.min(5, Math.floor((availBottom - GRID_TOP + 12) / ROW_H)));
      const cap = rows * 5;
      cells.slice(0, cap).forEach((cell, g) => {
        drawBagCell(ctx, grid, cell, hid, () => render(), CX(22 + (g % 5) * 144, 120), WY(945 + Math.floor(g / 5) * 132, 120));
      });
      for (let g = cells.length; g < cap; g++) {
        const empty = gpanel(grid, CX(22 + (g % 5) * 144, 120), WY(945 + Math.floor(g / 5) * 132, 120), 120, 120, CA('#14181E', 0.6), '#FFFFFF22', 1.5, 12);
        label(empty, 0, 0, '+', { size: 44, color: '#5F6873' });
      }
    }
    renderBag();
  }
}

/** 装备槽（含空态）：点槽 → 选择弹窗（该槽位类型的仓库装备 + 卸下） */
function drawSlot(ctx: PageCtx, parent: Node, hid: string, kind: EquipKind, rebuild: () => void,
  x: number, y: number, w: number, h: number): void {
  const inst = wornInst(hid, kind);
  const q = inst ? EQUIPS[inst.defId].quality : 0;
  const slot = gpanel(parent, x, y, w, h, inst ? CA('#14181E', 0.9) : CA('#10151D', 0.8), inst ? C(QCOLOR[q]) : C('#3A4250'), 2.5, 12);
  if (inst) {
    const d = EQUIPS[inst.defId];
    label(slot, 0, h * 0.14, KIND_ICON[kind], { size: Math.min(50, h * 0.38) });
    label(slot, 0, -h * 0.26, `${d.name} Lv.${inst.lv}`, { size: Math.min(20, w * 0.078), color: '#E8E0C8', bold: true, w: w - 12, h: 28, shrink: true });
    label(slot, -w / 2 + 10, h / 2 - 18, `T${d.tier}`, { size: 16, color: QCOLOR[d.quality], align: 'left', w: 60, h: 24 });
    // 已穿戴：点击弹装备属性（无替换选择）；空槽：点击无反应
    slot.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: () => void };
      if (ev && ev.propagationStopped) ev.propagationStopped();
      wornEquipModal(ctx, hid, kind, rebuild);
    });
  } else {
    label(slot, 0, h * 0.1, '+', { size: 46, color: '#5F6873' });
    label(slot, 0, -h * 0.26, KIND_NAME[kind], { size: 19, color: '#6B7480', w: w - 10, h: 26 });
  }
}

/** 品质名（与 QCOLOR 下标一一对应） */
const QNAMES = ['普通', '优秀', '稀有', '史诗'];

/** 装备图标框（含 T阶角标） */
function equipIcon(parent: Node, x: number, y: number, size: number, inst: EquipInst): void {
  const d = EQUIPS[inst.defId];
  const box = gpanel(parent, x, y, size, size, CA('#2A3240', 1), C(QCOLOR[d.quality]), 2.5, 10);
  label(box, 0, 0, KIND_ICON[d.kind], { size: Math.round(size * 0.46) });
  label(box, -size / 2 + 8, -size / 2 + 18, `T${d.tier}`, { size: 15, color: QCOLOR[d.quality], bold: true, align: 'left', w: 52, h: 24 });
}

/** 属性区块（基础属性/附加属性，参考线稿装备详情弹窗）；返回内容底部 y（局部坐标） */
function drawEquipAttrs(parent: Node, topY: number, width: number, inst: EquipInst, d: EquipDef): number {
  const big = width > 420;
  const mul = tierMul(d.tier);
  const atk0 = Math.round(d.atk * mul), hp0 = Math.round(d.hp * mul);
  const atkV = equipAtk(inst), hpV = equipHp(inst);
  const primAtk = atkV >= hpV;
  const p0 = primAtk ? atk0 : hp0;
  const pV = primAtk ? atkV : hpV;
  const sV = primAtk ? hpV : atkV;
  const rows: [string, string, boolean?][] = [['#bar#', '基础属性'], [primAtk ? '攻击' : '生命', String(p0)]];
  if (pV - p0 > 0) rows.push(['强化', `+${pV - p0}`, true]);
  if (sV > 0) { rows.push(['#bar#', '附加属性'], [primAtk ? '生命' : '攻击', String(sV)]); }
  let y = topY;
  for (const r of rows) {
    if (r[0] === '#bar#') {
      gpanel(parent, 0, y, width, big ? 44 : 34, CA('#565E6A', 0.4), undefined, 0, 6);
      label(parent, 0, y, r[1], { size: big ? 21 : 16, color: '#C8CDD4', bold: true, align: 'left', w: width - 32, h: big ? 44 : 34, shrink: true });
      y -= big ? 62 : 50;
    } else {
      // shrink 才能让 align 生效（overflow=NONE 时文本按节点中心排）
      label(parent, -width / 4 + 16, y, r[0], { size: big ? 22 : 17, color: r[2] ? PAL.green : '#E8E0C8', bold: !!r[2], align: 'left', w: width / 2, h: 30, shrink: true });
      label(parent, width / 4 - 16, y, r[1], { size: (big ? 22 : 17) + 2, color: r[2] ? PAL.green : '#FFE08A', bold: true, align: 'right', w: width / 2, h: 30, shrink: true });
      y -= big ? 48 : 42;
    }
  }
  return y;
}

/** 装备详情小面板（对比弹窗两侧 / 装备槽详情弹窗共用）：蓝头（部位名+当前角标+图标+名称/品质/阶Lv）+ 属性区，335×480 */
function equipDetailPanel(parent: Node, x: number, y: number, inst: EquipInst, isCur: boolean): Node {
  const d = EQUIPS[inst.defId];
  const p = gpanel(parent, x, y, 335, 480, CA('#14181E', 0.94), C(QCOLOR[d.quality]), 2, 12);
  gpanel(p, 0, 168, 335, 130, CA('#20466E', 0.95), undefined, 0, 10);
  label(p, -66, 208, KIND_NAME[d.kind], { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 160, h: 34, shrink: true });
  if (isCur) {
    gpanel(p, 106, 208, 96, 40, CA(PAL.green, 0.95), undefined, 0, 8);
    label(p, 106, 208, '当前', { size: 20, color: '#FFFFFF', bold: true });
  }
  equipIcon(p, -120, 140, 76, inst);
  label(p, 52, 168, d.name, { size: 18, color: '#E8E0C8', bold: true, align: 'left', w: 200, h: 26, shrink: true });
  label(p, 52, 138, `品质：${QNAMES[d.quality]}`, { size: 15, color: QCOLOR[d.quality], align: 'left', w: 200, h: 24, shrink: true });
  label(p, 52, 110, `T${d.tier} 阶 · Lv.${inst.lv}`, { size: 15, color: '#AAB2BD', align: 'left', w: 200, h: 24, shrink: true });
  drawEquipAttrs(p, 62, 305, inst, d);
  return p;
}

/** 已穿戴装备属性弹窗（复用对比弹窗的单侧详情面板；底部装备锻造，无替换选择） */
function wornEquipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const inst = wornInst(hid, kind)!;
  const panel = modal(ctx, 460, 610, EQUIPS[inst.defId].name);
  const p = equipDetailPanel(panel, 0, -30, inst, true);
  btn(p, 0, -195, 170, 64, '锻 造', PAL.gold, () => equipModal(ctx, hid, kind, rebuild), 22);
}

/** 仓库装备详情弹窗（同槽未穿戴时）：属性 + 穿戴（右）/出售（左） */
function warehouseEquipModal(ctx: PageCtx, hid: string, inst: EquipInst, rebuild: () => void): void {
  const d = EQUIPS[inst.defId];
  const panel = modal(ctx, 620, 640, d.name);
  equipIcon(panel, -185, 185, 130, inst);
  label(panel, 10, 220, `品质：${QNAMES[d.quality]}`, { size: 23, color: QCOLOR[d.quality], bold: true, align: 'left', w: 280, h: 34 });
  label(panel, 10, 170, `品阶：T${d.tier} 阶 · 等级 ${inst.lv}`, { size: 22, color: '#E8E0C8', align: 'left', w: 280, h: 32 });
  label(panel, 10, 120, `出售价：${sellPrice(inst)} 金币`, { size: 20, color: '#AAB2BD', align: 'left', w: 280, h: 30 });
  drawEquipAttrs(panel, 40, 560, inst, d);
  btn(panel, 130, -255, 220, 76, `穿戴·${KIND_NAME[d.kind]}`, PAL.green, () => {
    wearEquip(hid, d.kind, inst.uid);
    ctx.refresh();
  }, 21);
  btn(panel, -130, -255, 220, 76, '出 售', '#5A6472', () => confirmDismantle(ctx, inst, '出 售'), 22);
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

/** 装备对比弹窗（参考线稿：左=当前已穿戴（锻造），右=新装备（分解/替换）；两侧复用详情小面板） */
function compareEquipModal(ctx: PageCtx, hid: string, worn: EquipInst, next: EquipInst, rebuild: () => void): void {
  const panel = modal(ctx, 720, 640, `${KIND_NAME[EQUIPS[next.defId].kind]} · 对比`);
  const side = (x: number, inst: EquipInst, isCur: boolean): void => {
    const d = EQUIPS[inst.defId];
    const p = equipDetailPanel(panel, x, -10, inst, isCur);
    if (isCur) {
      btn(p, 0, -195, 170, 64, '锻 造', PAL.gold, () => equipModal(ctx, hid, d.kind, rebuild), 22);
    } else {
      btn(p, -86, -195, 150, 64, '分 解', PAL.green, () => confirmDismantle(ctx, inst, '分 解'), 22);
      btn(p, 86, -195, 150, 64, '替 换', PAL.orange, () => {
        wearEquip(hid, d.kind, inst.uid);
        ctx.refresh();
      }, 22);
    }
  };
  side(-177, worn, true);
  side(177, next, false);
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
  const g = gpanel(grid, x, y, 120, 120, CA('#14181E', 0.9), C(QCOLOR[q]), 2.5, 12);
  label(g, 0, -12, kind ? KIND_ICON[kind] : '🧱', { size: 44 });
  label(g, 0, 36, name, { size: 16, color: '#E8E0C8', w: 112, h: 24, shrink: true });
  if (isMat) label(g, 42, -46, `×${cell.n}`, { size: 18, color: '#FFE08A', bold: true, align: 'right', w: 70, h: 24 });
  else label(g, -42, -46, `Lv.${inst?.lv ?? 1}`, { size: 16, color: QCOLOR[q], align: 'left', w: 70, h: 24 });

  g.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: () => void };
    if (ev && ev.propagationStopped) ev.propagationStopped();
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

/** 属性+背景故事弹窗（点英雄头像/名字/属性/故事钮） */
export function attrsModal(ctx: PageCtx, hid: string): void {
  const def = HERO_DEFS[hid];
  const st = heroStats(hid);
  const panel = modal(ctx, 620, 720, `${def.name} · 属性`);
  const rows: [string, string][] = [
    ['定位', def.job], ['战力', String(st.power)], ['攻击', String(st.atk)],
    ['攻速', `${st.atkSpd}次/秒`], ['技能伤害', String(st.skillDmg)], ['生命', String(st.hp)],
  ];
  rows.forEach((r, i) => {
    label(panel, -160, 240 - i * 62, r[0], { size: 22, color: '#AAB2BD', align: 'left', w: 200, h: 34 });
    label(panel, 150, 240 - i * 62, r[1], { size: 23, color: '#FFF3D6', bold: true, align: 'right', w: 340, h: 34 });
  });
  label(panel, 0, -240, def.story, { size: 19, color: '#9AA3AE', w: 560, h: 90, shrink: true });
}
export function storyModal(ctx: PageCtx, hid: string): void { attrsModal(ctx, hid); }
