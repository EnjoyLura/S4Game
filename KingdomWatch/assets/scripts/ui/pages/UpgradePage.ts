/**
 * ④ 升级（去盒子化重构）：元素浮在地图场景上——大立绘悬浮 + 脚下金色光台座（程序椭圆辉光），
 *   名牌=轻量玻璃条；页签内容=羊皮纸大卡片（与战斗三选一卡同美术语言 ui_card_frame_white，
 *   深墨字）；四页签贴导航栏正上方（底部锚点，随屏高贴合）。
 * 坐标：上半部（英雄栏/立绘）顶部锚点，下半部（名牌/内容/页签）全部底部锚点——任何屏高都贴住导航栏。
 */
import { Graphics, Node, UIOpacity } from 'cc';
import { LO, PAL } from '../../config/GameConfig';
import { CA, btn, C, gcircle, gpanel, label, N, WY, WYB, WX } from '../UIKit';
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

/* 羊皮纸卡面配色（同 Panels 战斗卡：深墨主字 + 深金次字）；品质字色用加深版（原 QCOLOR 在浅底上看不清） */
const INK = '#4A3214';
const SUB = '#6B5A3A';
const QCARD = ['#6B5A3A', '#3E7C28', '#1F6BC4', '#8A3FD0'];

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
    label(content, WX(330, 300), WY(229, 40), `${def.name}${sv.heroes[hid].owned ? '' : '（未解锁）'}`, { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 40, shrink: true });

    /* 悬浮大立绘：无面板，角色抠图直接浮在地图场景上（手机屏多出的高度全给立绘），脚下金色光台座 */
    const dispTopY = LO.half - 300;
    const dispBotY = WYB(633, 0);
    const dispH = dispTopY - dispBotY;
    const dispCy = (dispTopY + dispBotY) / 2;
    const artH = Math.min(dispH - 30, 560);
    artSprite(content, 0, dispCy, 620, artH, 'hero_' + hid + '_portrait', { sliced: false });
    artSprite(content, 0, dispCy, 620, artH, def.avatar, { sliced: false });
    const artBot = dispCy - artH / 2;
    const ped = N('upPedestal', content, 0, artBot - 16, 560, 110);
    const g = ped.addComponent(Graphics);
    const ring = (rx: number, ry: number, a: number): void => {
      g.fillColor = CA('#F2D48A', a);
      g.ellipse(0, 0, rx, ry);
      g.fill();
    };
    ring(270, 50, 0.10);
    ring(195, 36, 0.14);
    ring(130, 23, 0.20);

    /* 脚底名牌：轻量玻璃条（半透明深底 + 细金边），名字 / 战力 / 详情 */
    const foot = gpanel(content, 0, WYB(545, 76), 400, 76, CA('#0B0F16', 0.58), '#E8C87866', 1.5, 38);
    label(foot, -105, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, w: 180, h: 40, shrink: true });
    label(foot, 40, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, w: 130, h: 40 });
    btn(foot, 155, 0, 74, 54, '详情', PAL.blue, () => attrsModal(ctx, hid), 20);

    /* 页签内容（羊皮纸大卡片，占满名牌与页签之间的空间） */
    if (st.tab === 0) tabLevel(content, ctx, hid);
    else if (st.tab === 1) tabWeapon(content, ctx, hid);
    else if (st.tab === 2) tabSkills(content, ctx, hid);
    else tabEquips(content, ctx, hid);

    /* 四页签：贴导航栏正上方（底部锚点，任何屏高都贴合） */
    const tabs = ['等级', '武器', '技能', '装备'];
    tabs.forEach((t, i) => {
      btn(content, WX(15 + i * 182, 170), WYB(130, 64), 170, 64, t,
        i === st.tab ? PAL.gold : '#5A6472', () => { st.tab = i as 0 | 1 | 2 | 3; render(); }, 22);
    });
  }
}

/** 羊皮纸卡（与战斗三选一卡同框美术）：深色底兜底 + 浅色卡框盖顶；alpha<1 表示置灰（空槽位） */
function parchmentCard(parent: Node, x: number, y: number, w: number, h: number, alpha = 1): Node {
  const card = gpanel(parent, x, y, w, h, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(card, 0, 0, w, h, 'ui_card_frame_white', { belowIdx: 0 });
  if (alpha < 1) (card.addComponent(UIOpacity) as UIOpacity).opacity = Math.round(255 * alpha);
  return card;
}

/** 金色圆图标座（卡内左侧）：金环美术 + 头像图或 emoji 兜底 */
function goldIconPlate(parent: Node, x: number, y: number, d: number, avatarId?: string, emoji?: string, emojiSize = 44): Node {
  const c = gcircle(parent, x, y, d / 2, CA('#2A3240', 1), C(PAL.gold), 3);
  artSprite(c, 0, 0, d, d, 'ui_circ_icon_gold', { belowIdx: 0 });
  if (avatarId) artSprite(c, 0, 0, d * 0.86, d * 0.86, avatarId, { sliced: false });
  else if (emoji) label(c, 0, 0, emoji, { size: emojiSize });
  return c;
}

function saveCur(hid: string): void { loadSave().curHero = hid; saveSave(); }

function save(hid: string, r: { ok: boolean; msg: string }, ctx: PageCtx): void {
  toast(r.msg);
  if (r.ok) ctx.refresh();
}

/* ---------- 等级页签：一张羊皮纸大卡（头像座+等级信息+消耗+升级按钮） ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const lv = sv.heroes[hid].lv;
  const maxed = lv >= MAX.hero;
  const cost = heroUpCost(lv);
  const card = parchmentCard(parent, 0, WYB(215, 310), 718, 310);
  goldIconPlate(card, -250, 50, 130, HERO_DEFS[hid].avatar);
  label(card, -250, -52, `Lv.${lv}`, { size: 26, color: INK, bold: true, w: 130, h: 34 });
  /* 文本块左缘 -150（align 需 shrink 生效，盒 = x±w/2 → x = 左缘 + w/2）；避开卡框顶部纹饰整体下移 */
  label(card, 0, 70, '英雄等级', { size: 26, color: INK, bold: true, align: 'left', w: 300, h: 36, shrink: true });
  label(card, 0, 22, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 23, color: '#8A4B12', bold: true, align: 'left', w: 300, h: 34, shrink: true });
  label(card, 10, -26, '每级提升：攻击 +8% · 技能伤害 +5%', { size: 18, color: SUB, align: 'left', w: 320, h: 28, shrink: true });
  gcircle(card, -140, -88, 27, CA(PAL.gold, 0.22), C('#8A6A2A'), 2);
  label(card, -140, -88, '🪙', { size: 26 });
  label(card, 5, -88, maxed ? '—' : fmt(cost), { size: 26, color: INK, bold: true, align: 'left', w: 220, h: 54, shrink: true });
  btn(card, 252, -88, 200, 84, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 26);
  if (!maxed) gpanel(card, 326, 128, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
}

/* ---------- 武器页签：一张羊皮纸大卡（武器座+强化信息+金币/材料+强化按钮） ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const c = weaponUpCost(lv);
  const card = parchmentCard(parent, 0, WYB(215, 310), 718, 310);
  goldIconPlate(card, -250, 50, 130, undefined, KIND_ICON.weapon, 48);
  label(card, -250, -52, `Lv.${lv}`, { size: 26, color: INK, bold: true, w: 130, h: 34 });
  label(card, 20, 70, HERO_DEFS[hid].weaponName, { size: 26, color: INK, bold: true, align: 'left', w: 340, h: 36, shrink: true });
  label(card, 20, 22, maxed ? `强化 Lv.${lv}（MAX）` : `强化 Lv.${lv} → Lv.${lv + 1}`, { size: 23, color: '#8A4B12', bold: true, align: 'left', w: 340, h: 34, shrink: true });
  label(card, 0, -26, '每级提升：攻击 +6% · 每5级材料需求 +1', { size: 18, color: SUB, align: 'left', w: 300, h: 28, shrink: true });
  gcircle(card, -150, -88, 27, CA(PAL.gold, 0.22), C('#8A6A2A'), 2);
  label(card, -150, -88, '🪙', { size: 26 });
  label(card, -47, -88, maxed ? '—' : fmt(c.gold), { size: 26, color: INK, bold: true, align: 'left', w: 130, h: 54, shrink: true });
  gcircle(card, 50, -88, 27, CA(PAL.green, 0.22), C('#3E7C28'), 2);
  label(card, 50, -88, '🧱', { size: 24 });
  label(card, 116, -88, maxed ? '—' : `×${c.mat}`, { size: 26, color: '#3E7C28', bold: true, align: 'left', w: 60, h: 54, shrink: true });
  btn(card, 252, -88, 200, 84, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 26);
  if (!maxed) gpanel(card, 326, 128, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
}

/* ---------- 技能页签：羊皮纸卡 ×3（齿轮环图标 + 名称/描述 + N级 + 红点），点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  SKILL_INFO.forEach((s, i) => {
    const lv = s.slot === 'atk' ? h.atkLv : s.slot === 'skill' ? h.skillLv : h.ultLv;
    const card = parchmentCard(parent, -234 + i * 234, WYB(215, 310), 218, 310);
    const circ = gcircle(card, 0, 82, 58, CA('#2A3240', 1), C(s.cls), 2.5);
    artSprite(circ, 0, 0, 116, 116, 'ui_gear_ring', { sliced: false, belowIdx: 0 });
    label(card, 0, 82, s.icon, { size: 26, color: '#FFE08A', bold: true });
    label(card, 0, -12, s.name, { size: 20, color: INK, bold: true, w: 190, h: 30, shrink: true });
    label(card, 0, -58, s.desc, { size: 14, color: SUB, w: 190, h: 56, shrink: true, lineHeight: 19 });
    label(card, 55, -118, `${lv}级`, { size: 26, color: INK, bold: true, w: 90, h: 36 });
    if (lv < MAX.skill) gpanel(card, 84, 130, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    card.on(Node.EventType.TOUCH_END, () => skillModal(ctx, hid, s.slot, () => ctx.refresh()));
  });
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

/* ---------- 装备页签：羊皮纸卡 ×4（图标座+名称+Lv），空槽置灰，点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string): void {
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const card = parchmentCard(parent, -261 + i * 174, WYB(215, 310), 168, 310, inst ? 1 : 0.72);
    if (inst) {
      const d = EQUIPS[inst.defId];
      goldIconPlate(card, 0, 88, 96, undefined, KIND_ICON[kind], 42);
      label(card, 0, -2, d.name, { size: 18, color: INK, bold: true, w: 140, h: 28, shrink: true });
      label(card, 45, -95, `Lv.${inst.lv}`, { size: 22, color: QCARD[q], bold: true, w: 90, h: 32 });
      if (inst.lv < MAX.equip) gpanel(card, 62, 132, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    } else {
      label(card, 0, 92, '+', { size: 54, color: INK, bold: true });
      label(card, 0, -95, KIND_NAME[kind], { size: 18, color: INK, bold: true, w: 140, h: 28 });
    }
    card.on(Node.EventType.TOUCH_END, () => {
      if (!inst) { toast('该槽位未穿戴 · 去英雄页装备'); return; }
      equipModal(ctx, hid, kind, () => ctx.refresh());
    });
  });
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
  label(panel, 100, 90, `${d.name} · ${QCOLOR[d.quality] === '#C9D6DF' ? '白' : ''}T${d.tier}`, { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 370, h: 38, shrink: true });
  label(panel, 100, 40, maxed ? `强化Lv.${inst.lv}（MAX）` : `强化Lv.${inst.lv} → Lv.${inst.lv + 1}`, { size: 22, color: '#FFE08A', bold: true, align: 'left', w: 370, h: 34, shrink: true });
  label(panel, 0, -35, maxed ? '已达上限' : `主属性 +4% · ${d.atk ? '攻击' : '生命'}提升`, { size: 21, color: '#C8CDD4', w: 470, h: 34, shrink: true });
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
