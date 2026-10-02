/**
 * ④ 升级（参考核心页布局重构）：常驻英雄栏 + 自适应大立绘 + 脚底名牌 + 升级总提升汇总行
 *   + 页签内容（等级/武器=单面板升级行；技能/装备=卡片网格）+ 四页签贴导航栏正上方（底部锚点，随屏高贴合）
 * 坐标：上半部（英雄栏/立绘）顶部锚点，下半部（名牌/汇总/内容/页签）全部底部锚点——任何屏高都贴住导航栏。
 */
import { Node } from 'cc';
import { LO, PAL } from '../../config/GameConfig';
import { CA, btn, C, gpanel, label, N, WY, WYB, WX } from '../UIKit';
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
    const h = sv.heroes[hid];

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

    /* 自适应大立绘：顶部锚定，底缘随屏高落到名牌上方（手机屏比桌面多出的高度全给立绘） */
    const footY = WYB(520, 80);
    const pTop = LO.half - 300;
    const pBot = footY + 40 + 14;
    const pH = Math.max(380, pTop - pBot);
    const portrait = gpanel(content, 0, pTop - pH / 2, 400, pH, CA('#20262F', 1), '#FFFFFF33', 1.5, 18);
    artSprite(portrait, 0, 0, 400, pH, 'hero_' + hid + '_portrait', { belowIdx: 0 });
    artSprite(portrait, 0, 0, 230, 230, def.avatar, { sliced: false });

    /* 脚底名牌：名字 / 战力 / 详情 */
    const foot = gpanel(content, 0, footY, 400, 80, CA('#3A2E23', 0.94), C(PAL.gold), 2, 16);
    artSprite(foot, 0, 0, 400, 80, 'ui_panel_dark_gold', { belowIdx: 0 });
    label(foot, -105, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, w: 180, h: 40 });
    label(foot, 40, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, w: 130, h: 40 });
    btn(foot, 155, 0, 74, 54, '详情', PAL.blue, () => attrsModal(ctx, hid), 20);

    /* 升级总提升（阶段性养成累计：等级/武器→攻击，等级/技能→技能伤害） */
    const atkPct = Math.round(((1 + (h.lv - 1) * 0.08) * (1 + (h.weaponLv - 1) * 0.06) - 1) * 100);
    const skillPct = Math.round(((1 + (h.skillLv - 1) * 0.10) * (1 + (h.lv - 1) * 0.05) - 1) * 100);
    const summary = gpanel(content, 0, WYB(410, 100), 718, 100, CA('#14181E', 0.94), C(PAL.gold), 2, 16);
    artSprite(summary, 0, 0, 718, 100, 'ui_panel_dark_gold', { belowIdx: 0 });
    label(summary, -220, 0, '升级总提升', { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 220, h: 36, shrink: true });
    label(summary, 200, 20, `攻击 +${atkPct}%`, { size: 32, color: '#FFD86B', bold: true, align: 'right', w: 260, h: 42, shrink: true });
    label(summary, 200, -24, `技能伤害 +${skillPct}%`, { size: 20, color: '#C8CDD4', align: 'right', w: 260, h: 28, shrink: true });

    /* 页签内容（差异布局，底部锚点贴页签） */
    if (st.tab === 0) tabLevel(content, ctx, hid, hs.lv);
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

function saveCur(hid: string): void { loadSave().curHero = hid; saveSave(); }

function save(hid: string, r: { ok: boolean; msg: string }, ctx: PageCtx): void {
  toast(r.msg);
  if (r.ok) ctx.refresh();
}

/* ---------- 等级页签：单面板升级行（下一级提升 + 消耗与按钮） ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string, lv: number): void {
  const cost = heroUpCost(lv);
  const maxed = lv >= MAX.hero;
  const p = gpanel(parent, 0, WYB(215, 170), 718, 170, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(p, 0, 0, 718, 170, 'ui_panel_dark_white', { belowIdx: 0 });
  label(p, -100, 55, `英雄等级　Lv.${lv} → Lv.${maxed ? lv : lv + 1}`, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 460, h: 34, shrink: true });
  label(p, -100, 15, maxed ? '已达到等级上限' : '每级提升：攻击 +8% · 技能伤害 +5%', { size: 19, color: '#C8CDD4', align: 'left', w: 460, h: 28 });
  gpanel(p, -300, -45, 54, 54, CA(PAL.gold, 0.2), C(PAL.gold), 2, 27);
  label(p, -300, -45, '🪙', { size: 28 });
  label(p, -183, -45, maxed ? '—' : fmt(cost), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 160, h: 54 });
  btn(p, 190, -45, 260, 80, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 26);
}

/* ---------- 武器页签：单面板强化行（金币+材料 消耗） ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const c = weaponUpCost(lv);
  const p = gpanel(parent, 0, WYB(215, 170), 718, 170, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(p, 0, 0, 718, 170, 'ui_panel_dark_white', { belowIdx: 0 });
  label(p, -60, 55, `${HERO_DEFS[hid].weaponName}　强化 Lv.${lv} → Lv.${maxed ? lv : lv + 1}`, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 540, h: 34, shrink: true });
  label(p, -60, 15, maxed ? '武器已达强化上限' : '每级提升：攻击 +6% · 每5级材料需求 +1', { size: 19, color: '#C8CDD4', align: 'left', w: 540, h: 28 });
  gpanel(p, -300, -45, 54, 54, CA(PAL.gold, 0.2), C(PAL.gold), 2, 27);
  label(p, -300, -45, '🪙', { size: 28 });
  label(p, -188, -45, maxed ? '—' : fmt(c.gold), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 150, h: 54 });
  gpanel(p, -70, -45, 54, 54, CA(PAL.green, 0.2), C(PAL.green), 2, 27);
  label(p, -70, -45, '🧱', { size: 26 });
  label(p, 0, -45, maxed ? '—' : `×${c.mat}`, { size: 26, color: '#D8F0C0', bold: true, align: 'left', w: 80, h: 54 });
  btn(p, 190, -45, 260, 80, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 26);
}

/* ---------- 技能页签：参考图式卡片 ×3（彩色圆环图标 + N级 + 红点），点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  SKILL_INFO.forEach((s, i) => {
    const lv = s.slot === 'atk' ? h.atkLv : s.slot === 'skill' ? h.skillLv : h.ultLv;
    const card = gpanel(parent, -224 + i * 224, WYB(215, 190), 200, 190, CA('#14181E', 0.92), C(s.cls), 2.5, 14);
    const circ = gpanel(card, 0, 30, 112, 112, CA('#2A3240', 1), C(s.cls), 3, 56);
    label(circ, 0, 0, s.icon, { size: 28, color: '#FFE08A', bold: true });
    label(card, -36, -56, s.name, { size: 17, color: '#C8CDD4', w: 120, h: 26, shrink: true });
    label(card, 64, -56, `${lv}级`, { size: 20, color: '#FFE08A', bold: true, w: 56, h: 26 });
    if (lv < MAX.skill) gpanel(card, 78, 78, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
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

/* ---------- 装备页签：卡片 ×4（已穿戴），点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string): void {
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const card = gpanel(parent, -261 + i * 174, WYB(215, 165), 165, 165,
      CA('#14181E', 0.92), inst ? C(QCOLOR[q]) : C('#3A4250'), 2.5, 14);
    if (inst) {
      const d = EQUIPS[inst.defId];
      label(card, 0, 24, KIND_ICON[kind], { size: 46 });
      label(card, -22, -46, d.name, { size: 17, color: '#E8E0C8', w: 108, h: 26, shrink: true });
      label(card, 52, -46, `Lv.${inst.lv}`, { size: 18, color: QCOLOR[q], bold: true, w: 56, h: 26, shrink: true });
      if (inst.lv < MAX.equip) gpanel(card, 68, 68, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
    } else {
      label(card, 0, 20, '+', { size: 44, color: '#5F6873' });
      label(card, 0, -46, KIND_NAME[kind], { size: 18, color: '#6B7480', w: 150, h: 26 });
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
  // 文本块左缘统一 -85（图标右缘 -105 + 20 间距）；shrink 才能让 align 生效（overflow=NONE 时按节点中心排）
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
