/**
 * ④ 升级（属性预览版式）：大立绘悬浮（缩小档）+ 金色光台座；等级/武器页签直接展示
 *   属性升级预览、等级效果里程碑、消耗/持有与升级按钮；技能/装备页签=卡片网格，
 *   点击弹升级弹窗（弹窗内同为参考结构：属性预览 → 每级提升 → 消耗/持有 + 按钮）。
 * 坐标：上半部顶部锚点，下半部（名牌/内容/页签）底部锚点——任何屏高都贴住导航栏。
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
  upHero, upWeapon, upSkill, upWornEquip, wornInst, equipAtk, equipHp, matCount,
} from '../../core/GameData';
import { loadSave, saveSave } from '../../core/SaveData';

const KIND_ICON: Record<string, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const WORN_4: ('helm' | 'acc' | 'glove' | 'armor')[] = ['helm', 'acc', 'glove', 'armor'];
const QNAMES = ['普通', '优秀', '稀有', '史诗'];

/* 技能三槽（页签卡片与升级弹窗共用） */
const SKILL_INFO = [
  { slot: 'atk' as const, key: 'atkLv' as const, name: '普攻 · 连射', icon: '普攻', desc: '普攻伤害 +10%/级', cls: PAL.blue },
  { slot: 'skill' as const, key: 'skillLv' as const, name: '技能 · 穿透箭', icon: '技能', desc: '技能伤害 +10%/级 · CD -0.5s', cls: PAL.blue },
  { slot: 'ult' as const, key: 'ultLv' as const, name: '大招 · 风暴之眼', icon: '大招', desc: '大招持续伤害 +10%/级', cls: PAL.purple },
];

/* 羊皮纸卡面配色（同 Panels 战斗卡）；品质字色用加深版（原 QCOLOR 在浅底上看不清） */
const INK = '#4A3214';
const SUB = '#6B5A3A';
const OK = '#3E7C28';
const NO = '#B03A2E';
const QCARD = ['#6B5A3A', '#3E7C28', '#1F6BC4', '#8A3FD0'];

/* 等级效果里程碑（展示性文案，战斗内逐步落地） */
const MILESTONES: Record<string, { lv: number; txt: string }[]> = {
  archer: [
    { lv: 5, txt: '攻击力 +5%' },
    { lv: 10, txt: '攻速 +10%' },
    { lv: 15, txt: '普攻10%射出贯穿箭' },
  ],
  sniper: [
    { lv: 5, txt: '攻击力 +8%' },
    { lv: 10, txt: '暴击率 +10%' },
    { lv: 15, txt: '大招必定暴击' },
  ],
};

/* 页签跨刷新保持（升级后 refresh 重建页面不跳回「等级」） */
const st: { tab: 0 | 1 | 2 | 3 } = { tab: 0 };

/** 指定等级/武器/技能等级下的三维属性（复刻 heroStats 公式，供升级预览差值） */
function statsAt(hid: string, lv: number, wpnLv: number, skillLv?: number): { atk: number; skillDmg: number; hp: number } {
  const sv = loadSave();
  const def = HERO_DEFS[hid];
  const h = sv.heroes[hid];
  const skl = skillLv ?? h.skillLv;
  const wornAtk = Object.values(h.worn).reduce((a, uid) => {
    const inst = sv.equips.find(q => q.uid === uid);
    return a + (inst ? equipAtk(inst) : 0);
  }, 0);
  const wornHp = Object.values(h.worn).reduce((a, uid) => {
    const inst = sv.equips.find(q => q.uid === uid);
    return a + (inst ? equipHp(inst) : 0);
  }, 0);
  const atk = Math.round(def.baseAtk * (1 + (lv - 1) * 0.08) * (1 + (wpnLv - 1) * 0.06) + wornAtk);
  const skillDmg = Math.round(atk * (1 + (skl - 1) * 0.10) * (1 + (lv - 1) * 0.05));
  const hp = 600 + wornHp + lv * 20;
  return { atk, skillDmg, hp };
}

/** 持有材料总数（强化消耗聚合扣强化石→精铁） */
function matOwned(): number { return matCount('mat_stone') + matCount('mat_iron'); }

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

    /* 悬浮大立绘（缩小档：上限 350，底部锚定贴名牌）+ 脚下金色光台座 */
    const dispTopY = LO.half - 300;
    const dispBotY = WYB(681, 0);
    const dispH = dispTopY - dispBotY;
    const dispCy = (dispTopY + dispBotY) / 2;
    const artH = Math.min(dispH - 30, 350);
    const artBot = dispBotY + 24;
    const artCy = Math.min(dispCy, artBot + artH / 2);
    artSprite(content, 0, artCy, 440, artH, 'hero_' + hid + '_portrait', { sliced: false });
    artSprite(content, 0, artCy, 440, artH, def.avatar, { sliced: false });
    const ped = N('upPedestal', content, 0, artBot - 16, 480, 100);
    const g = ped.addComponent(Graphics);
    const ring = (rx: number, ry: number, a: number): void => {
      g.fillColor = CA('#F2D48A', a);
      g.ellipse(0, 0, rx, ry);
      g.fill();
    };
    ring(270, 50, 0.10);
    ring(195, 36, 0.14);
    ring(130, 23, 0.20);

    /* 脚底名牌：轻量玻璃条 */
    const foot = gpanel(content, 0, WYB(595, 76), 400, 76, CA('#0B0F16', 0.58), '#E8C87866', 1.5, 38);
    label(foot, -105, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, w: 180, h: 40, shrink: true });
    label(foot, 40, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, w: 130, h: 40 });
    btn(foot, 155, 0, 74, 54, '详情', PAL.blue, () => attrsModal(ctx, hid), 20);

    /* 页签内容（属性预览版式） */
    if (st.tab === 0) tabLevel(content, ctx, hid);
    else if (st.tab === 1) tabWeapon(content, ctx, hid);
    else if (st.tab === 2) tabSkills(content, ctx, hid);
    else tabEquips(content, ctx, hid);

    /* 四页签：贴导航栏正上方 */
    const tabs = ['等级', '武器', '技能', '装备'];
    tabs.forEach((t, i) => {
      btn(content, WX(15 + i * 182, 170), WYB(130, 64), 170, 64, t,
        i === st.tab ? PAL.gold : '#5A6472', () => { st.tab = i as 0 | 1 | 2 | 3; render(); }, 22);
    });
  }
}

/** 羊皮纸卡（与战斗三选一卡同框美术）；alpha<1 表示置灰（空槽位） */
function parchmentCard(parent: Node, x: number, y: number, w: number, h: number, alpha = 1): Node {
  const card = gpanel(parent, x, y, w, h, CA('#14181E', 0.92), '#FFFFFF33', 1.5, 14);
  artSprite(card, 0, 0, w, h, 'ui_card_frame_white', { belowIdx: 0 });
  if (alpha < 1) (card.addComponent(UIOpacity) as UIOpacity).opacity = Math.round(255 * alpha);
  return card;
}

/** 金色圆图标座：金环美术 + 头像图或 emoji */
function goldIconPlate(parent: Node, x: number, y: number, d: number, avatarId?: string, emoji?: string, emojiSize = 40): Node {
  const c = gcircle(parent, x, y, d / 2, CA('#2A3240', 1), C(PAL.gold), 3);
  artSprite(c, 0, 0, d, d, 'ui_circ_icon_gold', { belowIdx: 0 });
  if (avatarId) artSprite(c, 0, 0, d * 0.86, d * 0.86, avatarId, { sliced: false });
  else if (emoji) label(c, 0, 0, emoji, { size: emojiSize, color: '#FFE08A', bold: true });
  return c;
}

/** 属性预览行：名称左 / 当前值右对齐 / 「+提升」绿字（无变化省略） */
function statRow(card: Node, y: number, name: string, cur: string, delta: string | null): void {
  label(card, -105, y, name, { size: 19, color: SUB, align: 'left', w: 130, h: 30, shrink: true });
  label(card, 40, y, cur, { size: 20, color: INK, bold: true, align: 'right', w: 120, h: 30, shrink: true });
  if (delta) label(card, 170, y, delta, { size: 20, color: OK, bold: true, align: 'left', w: 120, h: 30, shrink: true });
}

/** 消耗/持有 chip：图标座 + 「需要/持有」，够=绿 不够=红 */
function costChip(card: Node, x: number, y: number, icon: string, need: number, own: number, valW: number): void {
  gcircle(card, x, y, 22, CA(PAL.gold, 0.22), C('#8A6A2A'), 2);
  label(card, x, y, icon, { size: 22 });
  const ok = own >= need;
  label(card, x + 30 + valW / 2, y, `${fmt(need)}/${fmt(own)}`,
    { size: 20, color: ok ? OK : NO, bold: true, align: 'left', w: valW, h: 44, shrink: true });
}

/* ---------- 弹窗内组件（深底亮色版式） ---------- */

/** 弹窗属性预览行：名称 / 当前值 / +提升（绿） */
function modalStatRow(panel: Node, y: number, name: string, cur: string, delta: string | null): void {
  label(panel, -105, y, name, { size: 20, color: '#C8CDD4', align: 'left', w: 130, h: 30, shrink: true });
  label(panel, 40, y, cur, { size: 22, color: '#FFF3D6', bold: true, align: 'right', w: 120, h: 30, shrink: true });
  if (delta) label(panel, 170, y, delta, { size: 22, color: '#8FDB7F', bold: true, align: 'left', w: 120, h: 30, shrink: true });
}

/** 弹窗消耗/持有 chip：图标 + 「需要/持有」，够=绿 不够=红 */
function costChipLight(panel: Node, x: number, y: number, icon: string, need: number, own: number, valW: number): void {
  gcircle(panel, x, y, 22, CA(PAL.gold, 0.2), C(PAL.gold), 2);
  label(panel, x, y, icon, { size: 22 });
  const ok = own >= need;
  label(panel, x + 32 + valW / 2, y, `${fmt(need)}/${fmt(own)}`,
    { size: 21, color: ok ? '#8FDB7F' : '#FF8A80', bold: true, align: 'left', w: valW, h: 44, shrink: true });
}

function saveCur(hid: string): void { loadSave().curHero = hid; saveSave(); }

function save(hid: string, r: { ok: boolean; msg: string }, ctx: PageCtx): void {
  toast(r.msg);
  if (r.ok) ctx.refresh();
}

/* ---------- 等级页签：属性预览 + 等级效果里程碑 + 消耗/升级 ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.lv;
  const maxed = lv >= MAX.hero;
  const cur = statsAt(hid, lv, h.weaponLv);
  const next = maxed ? cur : statsAt(hid, lv + 1, h.weaponLv);
  const card = parchmentCard(parent, 0, WYB(215, 360), 718, 360);
  goldIconPlate(card, -250, 100, 120, HERO_DEFS[hid].avatar);
  label(card, -250, 18, `Lv.${lv}`, { size: 24, color: INK, bold: true, w: 120, h: 32 });
  /* 文本块左缘 -170（align 需 shrink 生效，盒 = x±w/2 → x = 左缘 + w/2）；标题下移避开卡框顶饰 */
  label(card, 30, 112, maxed ? `英雄等级　Lv.${lv}（MAX）` : `英雄等级　Lv.${lv} → Lv.${lv + 1}`,
    { size: 24, color: INK, bold: true, align: 'left', w: 400, h: 34, shrink: true });
  statRow(card, 78, '攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`);
  statRow(card, 46, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  statRow(card, 14, '生命', String(cur.hp), maxed ? null : `+${next.hp - cur.hp}`);
  label(card, -70, -14, '等级效果', { size: 20, color: '#8A4B12', bold: true, align: 'left', w: 200, h: 30, shrink: true });
  (MILESTONES[hid] || []).forEach((m, i) => {
    const y = -46 - i * 29;
    const reached = lv >= m.lv;
    label(card, -140, y, `${m.lv}级`, { size: 18, color: reached ? INK : '#857050', bold: true, w: 60, h: 26 });
    label(card, 75, y, (reached ? '✓ ' : '') + m.txt, { size: 18, color: reached ? INK : '#857050', bold: reached, align: 'left', w: 350, h: 26, shrink: true });
  });
  costChip(card, -150, -140, '🪙', maxed ? 0 : heroUpCost(lv), sv.gold, 210);
  btn(card, 265, -140, 170, 68, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 24);
}

/* ---------- 武器页签：属性预览 + 消耗（金币+材料）/强化 ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const cur = statsAt(hid, h.lv, lv);
  const next = maxed ? cur : statsAt(hid, h.lv, lv + 1);
  const c = weaponUpCost(lv);
  const card = parchmentCard(parent, 0, WYB(215, 360), 718, 360);
  goldIconPlate(card, -250, 100, 120, undefined, KIND_ICON.weapon, 46);
  label(card, -250, 18, `Lv.${lv}`, { size: 24, color: INK, bold: true, w: 120, h: 32 });
  label(card, 40, 112, maxed ? `${HERO_DEFS[hid].weaponName}　强化 Lv.${lv}（MAX）` : `${HERO_DEFS[hid].weaponName}　强化 Lv.${lv} → Lv.${lv + 1}`,
    { size: 24, color: INK, bold: true, align: 'left', w: 420, h: 34, shrink: true });
  statRow(card, 78, '攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`);
  statRow(card, 46, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  statRow(card, 14, '生命', String(cur.hp), null);
  label(card, 40, -14, '每级提升：攻击 +6% · 每5级材料需求 +1', { size: 17, color: SUB, align: 'left', w: 420, h: 28, shrink: true });
  costChip(card, -150, -140, '🪙', maxed ? 0 : c.gold, sv.gold, 130);
  costChip(card, 30, -140, '🧱', maxed ? 0 : c.mat, matOwned(), 80);
  btn(card, 265, -140, 170, 68, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 24);
}

/* ---------- 技能页签：羊皮纸卡 ×3（齿轮环图标 + 名称/描述 + N级 + 红点），点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  SKILL_INFO.forEach((info, i) => {
    const lv = h[info.key];
    const card = parchmentCard(parent, -234 + i * 234, WYB(215, 310), 218, 310);
    const circ = gcircle(card, 0, 82, 58, CA('#2A3240', 1), C(info.cls), 2.5);
    artSprite(circ, 0, 0, 116, 116, 'ui_gear_ring', { sliced: false, belowIdx: 0 });
    label(card, 0, 82, info.icon, { size: 26, color: '#FFE08A', bold: true });
    label(card, 0, -12, info.name, { size: 20, color: INK, bold: true, w: 190, h: 30, shrink: true });
    label(card, 0, -58, info.desc, { size: 14, color: SUB, w: 190, h: 56, shrink: true, lineHeight: 19 });
    label(card, 55, -118, `${lv}级`, { size: 26, color: INK, bold: true, w: 90, h: 36 });
    if (lv < MAX.skill) gpanel(card, 84, 130, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    card.on(Node.EventType.TOUCH_END, () => skillModal(ctx, hid, info.slot, () => ctx.refresh()));
  });
}

/** 技能升级弹窗（参考结构：头部 → 属性预览 → 每级提升 → 消耗/持有 + 升级按钮） */
function skillModal(ctx: PageCtx, hid: string, slot: 'atk' | 'skill' | 'ult', rebuild: () => void): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const info = SKILL_INFO.find(s => s.slot === slot)!;
  const lv = h[info.key];
  const maxed = lv >= MAX.skill;
  const cost = skillUpCost(lv);
  const panel = modal(ctx, 590, 500, '技能升级');
  /* 头部：图标左（右缘 -120），文本左缘 -100（align 需 shrink，盒 = x±w/2 → x = 左缘 + w/2） */
  goldIconPlate(panel, -170, 150, 100, undefined, info.icon, 26);
  label(panel, 50, 172, info.name, { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 34, shrink: true });
  label(panel, 50, 134, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 22, color: '#FFE08A', bold: true, align: 'left', w: 300, h: 32, shrink: true });
  /* 属性升级预览 */
  if (slot === 'skill') {
    const cur = statsAt(hid, h.lv, h.weaponLv, lv);
    const next = statsAt(hid, h.lv, h.weaponLv, lv + 1);
    modalStatRow(panel, 55, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  } else {
    const nm = slot === 'atk' ? '普攻伤害' : '大招伤害';
    modalStatRow(panel, 55, nm, `+${(lv - 1) * 10}%`, maxed ? null : `→ +${lv * 10}%`);
  }
  label(panel, 0, 12, info.desc, { size: 18, color: '#AAB2BD', align: 'left', w: 340, h: 28, shrink: true });
  if (!maxed) {
    costChipLight(panel, -130, -140, '🪙', cost, sv.gold, 180);
    btn(panel, 185, -140, 170, 76, '升 级', PAL.gold, () => {
      const r = upSkill(hid, slot);
      toast(r.msg);
      if (r.ok) { const d2 = panel.parent; if (d2) d2.destroy(); rebuild(); }
    }, 24);
  } else {
    label(panel, 0, -140, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
}

/* ---------- 装备页签：羊皮纸卡 ×4（金环图标座 + 名称 + Lv + 红点），点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string): void {
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const card = parchmentCard(parent, -261 + i * 174, WYB(215, 310), 168, 310, inst ? 1 : 0.72);
    if (inst) {
      const d = EQUIPS[inst.defId];
      goldIconPlate(card, 0, 88, 96, undefined, KIND_ICON[kind], 42);
      label(card, 0, -2, d.name, { size: 18, color: QCARD[q], bold: true, w: 140, h: 28, shrink: true });
      label(card, 45, -95, `Lv.${inst.lv}`, { size: 22, color: QCARD[q], bold: true, w: 90, h: 32 });
      if (inst.lv < MAX.equip) gpanel(card, 62, 132, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    } else {
      label(card, 0, 88, '+', { size: 54, color: INK, bold: true });
      label(card, 0, -95, KIND_NAME[kind], { size: 18, color: INK, bold: true, w: 140, h: 28 });
    }
    card.on(Node.EventType.TOUCH_END, () => {
      if (!inst) { toast('该槽位未穿戴 · 去英雄页装备'); return; }
      equipModal(ctx, hid, kind, () => ctx.refresh());
    });
  });
}

/** 装备强化弹窗（参考结构：头部 → 属性预览 → 每级提升 → 消耗/持有 + 强化按钮；升级页装备卡 + 英雄页「锻造」共用） */
export function equipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const sv = loadSave();
  const inst = wornInst(hid, kind)!;
  const d = EQUIPS[inst.defId];
  const maxed = inst.lv >= MAX.equip;
  const c = equipUpCost(inst.lv);
  const panel = modal(ctx, 590, 500, '装备强化');
  /* 头部：图标左（右缘 -120），文本左缘 -100（align 需 shrink，盒 = x±w/2 → x = 左缘 + w/2） */
  gpanel(panel, -170, 150, 100, 100, CA('#2A3240', 1), C(QCOLOR[d.quality]), 2.5, 14);
  label(panel, -170, 150, KIND_ICON[kind], { size: 44 });
  label(panel, 50, 172, d.name, { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 34, shrink: true });
  label(panel, 65, 134, maxed ? `${QNAMES[d.quality]} · T${d.tier}　强化 Lv.${inst.lv}（MAX）` : `${QNAMES[d.quality]} · T${d.tier}　强化 Lv.${inst.lv} → Lv.${inst.lv + 1}`,
    { size: 19, color: '#FFE08A', bold: true, align: 'left', w: 330, h: 30, shrink: true });
  /* 属性升级预览（双主属性都展示） */
  let ry = 55;
  if (d.atk > 0) {
    const curV = equipAtk(inst);
    const nextV = maxed ? curV : equipAtk({ ...inst, lv: inst.lv + 1 });
    modalStatRow(panel, ry, '攻击', String(curV), maxed ? null : `+${nextV - curV}`);
    ry -= 38;
  }
  if (d.hp > 0) {
    const curV = equipHp(inst);
    const nextV = maxed ? curV : equipHp({ ...inst, lv: inst.lv + 1 });
    modalStatRow(panel, ry, '生命', String(curV), maxed ? null : `+${nextV - curV}`);
    ry -= 38;
  }
  label(panel, 0, ry + 6, '每级提升：主属性 +4%', { size: 18, color: '#AAB2BD', align: 'left', w: 340, h: 28, shrink: true });
  if (!maxed) {
    costChipLight(panel, -160, -140, '🪙', c.gold, sv.gold, 120);
    costChipLight(panel, 10, -140, '🧱', c.mat, matOwned(), 70);
    btn(panel, 205, -140, 150, 76, '强 化', PAL.gold, () => {
      const r = upWornEquip(hid, kind);
      toast(r.msg);
      if (r.ok) { const p2 = panel.parent; if (p2) p2.destroy(); rebuild(); }
    }, 24);
  } else {
    label(panel, 0, -140, '已达强化上限', { size: 22, color: '#AAB2BD' });
  }
}
