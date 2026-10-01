/**
 * ② 英雄（线稿 heroes）：大图环绕式 —— 单英雄大立绘（左右箭头叠图内）+ 战力徽章 + 属性/故事圆钮
 * 右列装备槽（武器横扁×1 + 2×2 防具）→ 点槽弹背包选择弹窗穿戴；下方背包页签+网格（详情/穿戴/出售）。
 */
import { Node } from 'cc';
import { PAL } from '../../config/GameConfig';
import { CA, btn, C, gpanel, label, N, setText, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, CX } from '../PageKit';
import {
  EquipKind, KIND_NAME, QCOLOR, EQUIPS, MATS, HERO_DEFS,
  heroStats, sellEquip, wearEquip, takeOff, wornInst,
} from '../../core/GameData';
import { loadSave, saveSave } from '../../core/SaveData';

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
    label(content, 0, WY(250, 30), '点头像/名字看属性与背景故事', { size: 18, color: '#8D96A3', w: 640, h: 30 });

    /* 大立绘 + 立绘内左右箭头（切换已拥有英雄） */
    const portrait = gpanel(content, CX(160, 280), WY(305, 440), 280, 440, CA('#20262F', 1), '#FFFFFF33', 1.5, 18);
    artSprite(portrait, 0, 0, 280, 440, 'hero_' + hid + '_portrait', { belowIdx: 0 });
    const ava = label(portrait, 0, 40, '', { size: 120 });
    artSprite(ava, 0, 0, 190, 190, def.avatar, { sliced: false, hideOnLoad: [ava] });
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
    drawSlot(ctx, content, hid, 'weapon', () => render(), CX(470, 250), WY(305, 125), 250, 125);
    SLOTS_2x2.forEach((k, i) => {
      drawSlot(ctx, content, hid, k, () => render(), CX(470 + (i % 2) * 140, 130), WY(440 + Math.floor(i / 2) * 160, 150), 130, 150);
    });

    /* 我的背包：页签 + 5 列网格 */
    const tabs = [['weapon', '武器'], ['equip', '装备'], ['mat', '材料']] as const;
    const tabBtns: Node[] = [];
    tabs.forEach((t, i) => {
      const active = tabs[i][0] === bagSt.tab;
      const b = btn(content, CX(45 + i * 225, 200), WY(872, 58), 200, 58, t[1] + (active ? '(选中)' : ''), active ? PAL.gold : '#5A6472', () => {
        bagSt.tab = t[0];
        tabBtns.forEach((tb, k) => {
          const l = tb.children.find(c => c.name === 'lbl');
          if (l) setText(l, tabs[k][1] + (tabs[k][0] === bagSt.tab ? '(选中)' : ''));
        });
        renderBag();
      }, 22);
      tabBtns.push(b);
    });
    const grid = N('bagGrid', content, 0, 0, 750, 300);
    label(content, 0, WY(1185, 26), '↓ 背包可纵向滚动 · 点格子看详情（穿戴/出售）', { size: 18, color: '#6B7480', w: 750, h: 26 });

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
      cells.slice(0, 10).forEach((cell, g) => {
        drawBagCell(ctx, grid, cell, hid, () => render(), CX(22 + (g % 5) * 144, 120), WY(945 + Math.floor(g / 5) * 132, 120));
      });
      for (let g = cells.length; g < 10; g++) {
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
  } else {
    label(slot, 0, h * 0.1, '+', { size: 46, color: '#5F6873' });
    label(slot, 0, -h * 0.26, KIND_NAME[kind], { size: 19, color: '#6B7480', w: w - 10, h: 26 });
  }
  slot.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: () => void };
    if (ev && ev.propagationStopped) ev.propagationStopped();
    slotModal(ctx, hid, kind, rebuild);
  });
}

/** 槽位弹窗：已穿戴信息 + 仓库候选 + 卸下 */
function slotModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const sv = loadSave();
  const panel = modal(ctx, 620, 640, `${KIND_NAME[kind]}槽 · 选择装备`);
  const worn = wornInst(hid, kind);
  if (worn) {
    const d = EQUIPS[worn.defId];
    label(panel, 0, 230, `已穿戴：${d.name} Lv.${worn.lv}`, { size: 22, color: '#FFE08A', w: 560, h: 32, shrink: true });
    btn(panel, 0, 168, 200, 54, '卸 下', '#5A6472', () => { takeOff(hid, kind); ctx.refresh(); }, 22);
  } else {
    label(panel, 0, 230, '该槽位为空', { size: 22, color: '#8D96A3', w: 560, h: 32 });
  }
  const list = sv.equips.filter(e => EQUIPS[e.defId]?.kind === kind);
  const listY = worn ? 100 : 150;
  if (!list.length) label(panel, 0, listY, '仓库暂无该类型装备 · 去商店看看', { size: 20, color: '#8D96A3', w: 560, h: 30 });
  list.slice(0, 4).forEach((e, i) => {
    const d = EQUIPS[e.defId];
    const row = gpanel(panel, 0, listY - i * 92, 560, 80, CA('#14181E', 0.9), C(QCOLOR[d.quality]), 2, 12);
    label(row, -180, 0, `${KIND_ICON[kind]} ${d.name}`, { size: 22, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 32, shrink: true });
    label(row, -180, 26, `T${d.tier} · Lv.${e.lv} · 攻${d.atk}/命${d.hp}`, { size: 17, color: '#AAB2BD', align: 'left', w: 320, h: 26 });
    btn(row, 200, 0, 130, 56, '穿 戴', PAL.green, () => {
      wearEquip(hid, kind, e.uid);
      ctx.refresh();
    }, 22);
  });
}

/** 背包格：装备=详情（穿戴/出售）；材料=详情 */
function drawBagCell(ctx: PageCtx, grid: Node, cell: { uid: string; n: number }, hid: string, rebuild: () => void, x: number, y: number): void {
  const isMat = cell.n > 0;
  const q = isMat ? 0 : EQUIPS[cell.uid].quality;
  const name = isMat ? MATS[cell.uid].name : EQUIPS[cell.uid].name;
  const kind = isMat ? null : EQUIPS[cell.uid].kind;
  const g = gpanel(grid, x, y, 120, 120, CA('#14181E', 0.9), C(QCOLOR[q]), 2.5, 12);
  label(g, 0, -12, kind ? KIND_ICON[kind] : '🧱', { size: 44 });
  label(g, 0, 36, name, { size: 16, color: '#E8E0C8', w: 112, h: 24, shrink: true });
  if (isMat) label(g, 42, -46, `×${cell.n}`, { size: 18, color: '#FFE08A', bold: true, align: 'right', w: 70, h: 24 });
  else label(g, -42, -46, `Lv.${loadSave().equips.find(e => e.uid === cell.uid)?.lv ?? 1}`, { size: 16, color: QCOLOR[q], align: 'left', w: 70, h: 24 });

  g.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: () => void };
    if (ev && ev.propagationStopped) ev.propagationStopped();
    const panel = modal(ctx, 560, 560, isMat ? name : `${name} · 详情`);
    if (isMat) {
      const m = MATS[cell.uid];
      label(panel, 0, 150, `持有 ×${loadSave().bag[cell.uid] || 0}`, { size: 22, color: '#FFE08A', w: 500, h: 32 });
      label(panel, 0, 50, m.desc, { size: 20, color: '#C8CDD4', w: 500, h: 60, shrink: true });
      label(panel, 0, -70, '来源：商店购买 / 关卡掉落', { size: 18, color: '#8D96A3', w: 500, h: 28 });
      label(panel, 0, -120, '用途：武器 / 装备强化材料', { size: 18, color: '#8D96A3', w: 500, h: 28 });
    } else {
      const inst = loadSave().equips.find(e => e.uid === cell.uid)!;
      const d = EQUIPS[inst.defId];
      label(panel, 0, 150, `${d.name} · T${d.tier} · Lv.${inst.lv}`, { size: 24, color: QCOLOR[d.quality], bold: true, w: 500, h: 34 });
      label(panel, 0, 80, `攻击 +${d.atk}　生命 +${d.hp}`, { size: 22, color: '#E8E0C8', w: 500, h: 32 });
      label(panel, 0, 30, `出售价：${Math.round([100, 400, 1500, 5000][d.quality] * Math.pow(3, d.tier - 1) * (1 + (inst.lv - 1) * 0.1))} 金币`, { size: 20, color: '#AAB2BD', w: 500, h: 30 });
      btn(panel, -130, -140, 220, 70, `穿戴·${KIND_NAME[d.kind]}`, PAL.green, () => {
        wearEquip(hid, d.kind, inst.uid);
        ctx.refresh();
      }, 21);
      btn(panel, 130, -140, 220, 70, '出 售', '#5A6472', () => {
        const r = sellEquip(inst.uid);
        toast(r.msg);
        if (r.ok) ctx.refresh();
      }, 22);
    }
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
