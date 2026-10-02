/**
 * ④ 升级（线稿 upgrade v2）：常驻英雄栏+大立绘（脚底名牌=名字/战力/详情）+ 四页签贴导航栏
 * 等级/武器=下一级数值提升+消耗与按钮底部居中；技能/装备=方形槽一行，点击弹升级弹窗。
 * 坐标为线稿 v2 已含顶栏下移的绝对值（与线稿一一对应）。
 */
import { Node } from 'cc';
import { PAL } from '../../config/GameConfig';
import { CA, btn, C, gpanel, label, N, WY, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, fmt } from '../PageKit';
import { attrsModal } from './HeroPage';
import {
  EquipKind, HERO_DEFS, EQUIPS, KIND_NAME, QCOLOR, MAX,
  heroStats, heroUpCost, weaponUpCost, skillUpCost, equipUpCost,
  upHero, upWeapon, upSkill, upWornEquip, wornInst,
} from '../../core/GameData';
import { loadSave, saveSave } from '../../core/SaveData';

const SKILL_INFO = [
  { slot: 'atk' as const, name: '普攻 · 连射', icon: '普攻', cls: PAL.blue, desc: '普攻伤害 +10%/级' },
  { slot: 'skill' as const, name: '技能 · 穿透箭', icon: '技能', cls: PAL.blue, desc: '技能伤害 +10%/级 · CD -0.5s' },
  { slot: 'ult' as const, name: '大招 · 风暴之眼', icon: '大招', cls: PAL.purple, desc: '大招持续伤害 +10%/级' },
];
const KIND_ICON: Record<string, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const WORN_4: ('helm' | 'acc' | 'glove' | 'armor')[] = ['helm', 'acc', 'glove', 'armor'];

/* 页签跨刷新保持（升级后 refresh 重建页面不跳回「等级」） */
const st: { tab: 0 | 1 | 2 | 3 } = { tab: 0 };

export function buildUpgrade(ctx: PageCtx): void {
  const root = ctx.screens;
  const content = N('upContent', root, 0, 0, 750, 900);

  render();

  function render(): void {
    content.destroyAllChildren();
    const sv = loadSave();
    const hid = sv.curHero;
    const def = HERO_DEFS[hid];
    const hs = heroStats(hid);

    /* 常驻英雄栏：头像切换（未拥有灰锁） */
    (['archer', 'sniper'] as const).forEach((id, i) => {
      const o = sv.heroes[id].owned;
      const av = gpanel(content, WX(30 + i * 100, 88), WY(205, 88), 88, 88,
        CA('#2A3240', 1), id === hid ? C(PAL.gold) : C('#FFFFFF44'), id === hid ? 3 : 1.5, 44);
      artSprite(av, 0, 0, 88, 88, 'ui_circ_icon_gold', { belowIdx: 0 });
      artSprite(av, 0, 0, 76, 76, HERO_DEFS[id].avatar, { sliced: false });
      if (!o) { gpanel(av, 0, 0, 88, 88, CA('#0B0F16', 0.6), undefined, 0, 44); label(av, 0, 0, '🔒', { size: 30 }); }
      av.on(Node.EventType.TOUCH_END, () => {
        if (!o) { toast('前往商店解锁该英雄'); return; }
        sv.curHero = id; saveCur(id); render();
      });
    });
    label(content, WX(330, 300), WY(229, 40), `${def.name}${sv.heroes[hid].owned ? '' : '（未解锁）'}`, { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 40 });

    /* 常驻英雄大立绘 + 脚底名牌 */
    const portrait = gpanel(content, WX(175, 400), WY(300, 430), 400, 430, CA('#20262F', 1), '#FFFFFF33', 1.5, 18);
    artSprite(portrait, 0, 0, 400, 430, 'hero_' + hid + '_portrait', { belowIdx: 0 });
    artSprite(portrait, 0, 40, 230, 230, def.avatar, { sliced: false });
    const foot = gpanel(content, WX(175, 400), WY(700, 80), 400, 80, CA('#3A2E23', 0.94), C(PAL.gold), 2, 16);
    artSprite(foot, 0, 0, 400, 80, 'ui_panel_dark_gold', { belowIdx: 0 });
    label(foot, -105, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, w: 180, h: 40 });
    label(foot, 40, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, w: 130, h: 40 });
    btn(foot, 155, 0, 74, 54, '详情', PAL.blue, () => attrsModal(ctx, hid), 20);

    /* 页签内容（差异布局） */
    if (st.tab === 0) tabLevel(content, ctx, hid, hs.lv);
    else if (st.tab === 1) tabWeapon(content, ctx, hid);
    else if (st.tab === 2) tabSkills(content, ctx, hid);
    else tabEquips(content, ctx, hid);

    /* 四页签（底部导航正上方） */
    const tabs = ['等级', '武器', '技能', '装备'];
    tabs.forEach((t, i) => {
      btn(content, WX(15 + i * 182, 170), WY(1146, 64), 170, 64, t,
        i === st.tab ? PAL.gold : '#5A6472', () => { st.tab = i as 0 | 1 | 2 | 3; render(); }, 22);
    });
  }
}

function saveCur(hid: string): void { loadSave().curHero = hid; saveSave(); }

function save(hid: string, r: { ok: boolean; msg: string }, ctx: PageCtx): void {
  toast(r.msg);
  if (r.ok) ctx.refresh();
}

/* ---------- 等级页签：下一级提升 + 消耗/按钮底部居中 ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string, lv: number): void {
  const cost = heroUpCost(lv);
  const maxed = lv >= MAX.hero;
  const p = gpanel(parent, WX(115, 520), WY(825, 110), 520, 110, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(p, 0, 0, 520, 110, 'ui_panel_dark_white', { belowIdx: 0 });
  label(p, 0, 20, `英雄等级　Lv.${lv} → Lv.${lv + 1}`, { size: 24, color: '#FFF3D6', bold: true, w: 500, h: 36 });
  label(p, 0, -22, maxed ? '已达到等级上限' : '升级效果：攻击 +8% · 技能伤害 +5%', { size: 20, color: maxed ? '#8D96A3' : '#C8CDD4', w: 500, h: 30 });
  gpanel(parent, WX(175, 60), WY(1000, 60), 60, 60, CA(PAL.gold, 0.2), C(PAL.gold), 2, 30);
  label(parent, WX(175, 60), WY(1000, 60), '🪙', { size: 30 });
  label(parent, WX(240, 110), WY(1000, 60), maxed ? '—' : fmt(cost), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 110, h: 60 });
  btn(parent, WX(380, 200), WY(985, 90), 200, 90, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 26);
}

/* ---------- 武器页签：无大图，数值提升 + 金币+材料 居中 ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const c = weaponUpCost(lv);
  const p = gpanel(parent, WX(115, 520), WY(825, 110), 520, 110, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(p, 0, 0, 520, 110, 'ui_panel_dark_white', { belowIdx: 0 });
  label(p, 0, 20, `${HERO_DEFS[hid].weaponName}　强化 Lv.${lv} → Lv.${lv + 1}`, { size: 24, color: '#FFF3D6', bold: true, w: 500, h: 36, shrink: true });
  label(p, 0, -22, maxed ? '武器已达强化上限' : '强化效果：攻击 +6% · 战力提升', { size: 20, color: maxed ? '#8D96A3' : '#C8CDD4', w: 500, h: 30 });
  // 消耗行：金币 + 材料
  gpanel(parent, WX(110, 60), WY(1000, 60), 60, 60, CA(PAL.gold, 0.2), C(PAL.gold), 2, 30);
  label(parent, WX(110, 60), WY(1000, 60), '🪙', { size: 30 });
  label(parent, WX(175, 110), WY(1000, 60), maxed ? '—' : fmt(c.gold), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 110, h: 60 });
  gpanel(parent, WX(300, 60), WY(1000, 60), 60, 60, CA(PAL.green, 0.2), C(PAL.green), 2, 30);
  label(parent, WX(300, 60), WY(1000, 60), '🧱', { size: 28 });
  label(parent, WX(365, 70), WY(1000, 60), maxed ? '—' : `×${c.mat}`, { size: 26, color: '#D8F0C0', bold: true, align: 'left', w: 70, h: 60 });
  btn(parent, WX(460, 180), WY(985, 90), 180, 90, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 26);
}

/* ---------- 技能页签：方形技能槽 ×3，点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  SKILL_INFO.forEach((s, i) => {
    const lv = s.slot === 'atk' ? h.atkLv : s.slot === 'skill' ? h.skillLv : h.ultLv;
    const slot = gpanel(parent, WX(90 + i * 200, 170), WY(850, 170), 170, 170, CA('#14181E', 0.92), '#FFFFFF44', 2, 12);
    const circ = gpanel(slot, 0, -12, 100, 100, CA('#2A3240', 1), C(s.cls), 2.5, 50);
    label(circ, 0, 0, s.icon, { size: 26, color: '#FFE08A', bold: true });
    label(slot, 0, -56, `${lv}级`, { size: 22, color: '#FFE08A', bold: true, align: 'right', w: 130, h: 28 });
    if (lv < MAX.skill) {
      gpanel(slot, 58, 58, 22, 22, CA('#E5484D', 0.95), undefined, 0, 11);
    }
    slot.on(Node.EventType.TOUCH_END, () => skillModal(ctx, hid, s.slot, () => ctx.refresh()));
  });
  label(parent, 0, WY(1040, 26), '点击技能槽弹出升级弹窗（纯金币升级）', { size: 18, color: '#6B7480', w: 750, h: 26 });
}

function skillModal(ctx: PageCtx, hid: string, slot: 'atk' | 'skill' | 'ult', rebuild: () => void): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const info = SKILL_INFO.find(s => s.slot === slot)!;
  const key = slot === 'atk' ? 'atkLv' : slot === 'skill' ? 'skillLv' : 'ultLv';
  const lv = h[key];
  const maxed = lv >= MAX.skill;
  const cost = skillUpCost(lv);
  const panel = modal(ctx, 590, 500, '技能升级');
  const circ = gpanel(panel, -130, 70, 120, 120, CA('#2A3240', 1), C(info.cls), 2.5, 60);
  label(circ, 0, 0, info.icon, { size: 30, color: '#FFE08A', bold: true });
  label(panel, 30, 90, info.name, { size: 27, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 40 });
  label(panel, 30, 40, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 23, color: '#FFE08A', bold: true, align: 'left', w: 300, h: 36 });
  label(panel, -40, -30, maxed ? '已达上限' : info.desc, { size: 21, color: '#C8CDD4', align: 'left', w: 460, h: 34 });
  if (!maxed) {
    gpanel(panel, -140, -120, 60, 60, CA(PAL.gold, 0.2), C(PAL.gold), 2, 30);
    label(panel, -140, -120, '🪙', { size: 30 });
    label(panel, -70, -120, fmt(cost), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 140, h: 60 });
    btn(panel, 120, -115, 180, 90, '升 级', PAL.gold, () => {
      const r = upSkill(hid, slot);
      toast(r.msg);
      if (r.ok) { const d = panel.parent; if (d) d.destroy(); rebuild(); }
    }, 26);
  }
}

/* ---------- 装备页签：方形槽 ×4（已穿戴），点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string): void {
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const slot = gpanel(parent, WX(25 + i * 180, 160), WY(850, 160), 160, 160,
      CA('#14181E', 0.92), inst ? C(QCOLOR[q]) : C('#3A4250'), 2.5, 12);
    if (inst) {
      const d = EQUIPS[inst.defId];
      label(slot, 0, 18, KIND_ICON[kind], { size: 44 });
      label(slot, 0, -32, d.name, { size: 17, color: '#E8E0C8', w: 150, h: 26, shrink: true });
      label(slot, 0, -60, `强化Lv.${inst.lv}`, { size: 16, color: QCOLOR[q], w: 150, h: 24 });
      if (inst.lv < MAX.equip) gpanel(slot, 68, 68, 22, 22, CA('#E5484D', 0.95), undefined, 0, 11);
    } else {
      label(slot, 0, 14, '+', { size: 42, color: '#5F6873' });
      label(slot, 0, -40, KIND_NAME[kind], { size: 18, color: '#6B7480', w: 150, h: 26 });
    }
    slot.on(Node.EventType.TOUCH_END, () => {
      if (!inst) { toast('该槽位未穿戴 · 去英雄页装备'); return; }
      equipModal(ctx, hid, kind, () => ctx.refresh());
    });
  });
  label(parent, 0, WY(1040, 26), '点击装备槽弹出强化弹窗（金币+材料）', { size: 18, color: '#6B7480', w: 750, h: 26 });
}

/** 装备强化弹窗（升级页装备槽 + 英雄页属性弹窗「锻造」共用；含武器实例） */
export function equipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const inst = wornInst(hid, kind)!;
  const d = EQUIPS[inst.defId];
  const maxed = inst.lv >= MAX.equip;
  const c = equipUpCost(inst.lv);
  const panel = modal(ctx, 590, 500, '装备强化');
  gpanel(panel, -170, 60, 130, 130, CA('#2A3240', 1), C(QCOLOR[d.quality]), 2.5, 16);
  label(panel, -170, 60, KIND_ICON[kind], { size: 52 });
  label(panel, 30, 90, `${d.name} · ${QCOLOR[d.quality] === '#C9D6DF' ? '白' : ''}T${d.tier}`, { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 340, h: 38, shrink: true });
  label(panel, 30, 40, maxed ? `强化Lv.${inst.lv}（MAX）` : `强化Lv.${inst.lv} → Lv.${inst.lv + 1}`, { size: 22, color: '#FFE08A', bold: true, align: 'left', w: 340, h: 34 });
  label(panel, -40, -30, maxed ? '已达上限' : `主属性 +4% · ${d.atk ? '攻击' : '生命'}提升`, { size: 21, color: '#C8CDD4', align: 'left', w: 460, h: 34 });
  if (!maxed) {
    gpanel(panel, -205, -120, 60, 60, CA(PAL.gold, 0.2), C(PAL.gold), 2, 30);
    label(panel, -205, -120, '🪙', { size: 30 });
    label(panel, -135, -120, fmt(c.gold), { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 130, h: 60 });
    gpanel(panel, 5, -120, 60, 60, CA(PAL.green, 0.2), C(PAL.green), 2, 30);
    label(panel, 5, -120, '🧱', { size: 28 });
    label(panel, 70, -120, `×${c.mat}`, { size: 25, color: '#D8F0C0', bold: true, align: 'left', w: 80, h: 60 });
    btn(panel, 170, -115, 130, 90, '强 化', PAL.gold, () => {
      const r = upWornEquip(hid, kind);
      toast(r.msg);
      if (r.ok) { const p2 = panel.parent; if (p2) p2.destroy(); rebuild(); }
    }, 24);
  }
}
