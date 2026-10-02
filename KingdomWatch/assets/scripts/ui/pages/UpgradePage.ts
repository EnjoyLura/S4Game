/**
 * ④ 升级（自适应分区版式）：大立绘顶部锚定（上限 350，贴头像栏正下方）+ 金色光台座；
 *   等级/武器升级大卡底边贴页签、顶边顶着台座之下，高度 375~620 随屏取足，卡内分区
 *   （「属性提升」/「等级效果·每级提升」/ 底部行动条）拉通整卡宽随之拉伸；
 *   技能/装备页签=固定高度卡片网格，点击弹升级弹窗（弹窗内同为参考结构）。
 * 坐标：上半部顶部锚点，下半部（名牌/内容/页签）底部锚点——任何屏高都贴住导航栏。
 */
import { Graphics, Node, UIOpacity } from 'cc';
import { LO, PAL } from '../../config/GameConfig';
import { CA, btn, C, gcircle, gpanel, label, N, WY, WYB, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, artPanel, modal, toast, fmt } from '../PageKit';
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
  { slot: 'skill' as const, key: 'skillLv' as const, name: '技能 · 穿透箭', icon: '技能', desc: '技能伤害 +10%/级\nCD -0.5s', cls: PAL.blue },
  { slot: 'ult' as const, key: 'ultLv' as const, name: '大招 · 风暴之眼', icon: '大招', desc: '大招持续伤害 +10%/级', cls: PAL.purple },
];

/* 技能阶段性等级效果（升级弹窗「等级效果」分区展示；已达成的档位打 ✓）
 * 普攻档位文案为定稿；技能/大招按同节奏起草，数值待战斗侧实现后校准 */
const SKILL_MILESTONES: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '强化普攻 +2发' },
    { lv: 15, txt: '强化普攻暴击率 +20%' },
    { lv: 20, txt: '物理穿透 +35%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '贯穿目标 +1' },
    { lv: 15, txt: '命中范围 +20%' },
    { lv: 20, txt: '物理穿透 +35%' },
  ],
  ult: [
    { lv: 5, txt: '冷却 -2s' },
    { lv: 10, txt: '风暴持续时间 +2s' },
    { lv: 15, txt: '风暴伤害 +20%' },
    { lv: 20, txt: '引力范围 +30%' },
  ],
};

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
    /* 悬浮大立绘（上限 350，顶部锚定：贴头像栏正下方，消除头顶空白）+ 脚下金色光台座 */
    const dispTopY = LO.half - 300;
    const artH = Math.max(0, Math.min(dispTopY - WYB(681, 0) - 30, 350));
    const hasArt = artH >= 60;
    const artBot = dispTopY - artH - 8;
    if (hasArt) {
      artSprite(content, 0, artBot + artH / 2, 440, artH, 'hero_' + hid + '_portrait', { sliced: false });
      artSprite(content, 0, artBot + artH / 2, 440, artH, def.avatar, { sliced: false });
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
    }

    /* 自适应升级大卡：底边贴页签，顶边顶着台座之下（高 375~620 随屏取足，不留死空间） */
    const pedBot = hasArt ? artBot - 66 : artBot - 8;
    const cardBot = WYB(215, 0);
    const cardH = Math.max(375, Math.min(pedBot - 93 - cardBot, 620));
    const cardTop = cardBot + cardH;

    /* 脚底名牌：骑行在大卡顶缘（随卡升高） */
    const foot = gpanel(content, 0, cardTop + 43, 400, 76, CA('#0B0F16', 0.58), '#E8C87866', 1.5, 38);
    label(foot, -105, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, w: 180, h: 40, shrink: true });
    label(foot, 40, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, w: 130, h: 40 });
    btn(foot, 155, 0, 74, 54, '详情', PAL.blue, () => attrsModal(ctx, hid), 20);

    /* 页签内容（自适应分区版式） */
    if (st.tab === 0) tabLevel(content, ctx, hid, cardH);
    else if (st.tab === 1) tabWeapon(content, ctx, hid, cardH);
    else if (st.tab === 2) tabSkills(content, ctx, hid, cardH);
    else tabEquips(content, ctx, hid, cardH);

    /* 四页签：页签条背板（L1）垫底，贴导航栏正上方 */
    artPanel(content, -2, WYB(130, 64), 716, 84, 'ui_panel_tabs');
    const tabs = ['等级', '武器', '技能', '装备'];
    tabs.forEach((t, i) => {
      btn(content, WX(15 + i * 182, 170), WYB(130, 64), 170, 64, t,
        i === st.tab ? PAL.gold : '#5A6472', () => { st.tab = i as 0 | 1 | 2 | 3; render(); }, 22);
    });
  }
}

/** 详情背板：无框暗色圆角板（四个升级页签通用，不带边框美术）；alpha<1 表示置灰（空槽位） */
function parchmentCard(parent: Node, x: number, y: number, w: number, h: number, alpha = 1): Node {
  const card = gpanel(parent, x, y, w, h, CA('#14181E', 0.92), undefined, 0, 14);
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

/** 分区面板：羊皮纸大卡内的浅色内衬，让每个内容区有独立容器（层次分区） */
function zonePanel(parent: Node, x: number, y: number, w: number, h: number, dark = false): Node {
  return gpanel(parent, x, y, w, h, dark ? CA('#3A2A12', 0.18) : CA('#FFF7E0', 0.5), '#8A6A2A66', 1.5, 12);
}

/** 分区标签：骑在分区面板上缘的小金签（标注该区用途） */
function zoneTab(parent: Node, x: number, y: number, text: string): void {
  gpanel(parent, x, y, 110, 26, CA('#E8C878', 0.92), '#8A6A2A', 1.5, 10);
  label(parent, x, y, text, { size: 18, color: INK, bold: true, w: 110, h: 26 });
}

/** 属性预览行（分区面板内，面板宽 660）：名称左 / 当前值右对齐 / 「+提升」绿字（无变化省略） */
function statRow(card: Node, y: number, name: string, cur: string, delta: string | null): void {
  label(card, -230, y, name, { size: 22, color: INK, bold: true, align: 'left', w: 140, h: 30, shrink: true });
  label(card, 40, y, cur, { size: 24, color: INK, bold: true, align: 'right', w: 120, h: 30, shrink: true });
  if (delta) label(card, 195, y, delta, { size: 24, color: OK, bold: true, align: 'left', w: 130, h: 30, shrink: true });
}

/** 消耗/持有 chip：图标座 + 「需要/持有」，够=绿 不够=红 */
function costChip(card: Node, x: number, y: number, icon: string, need: number, own: number, valW: number): void {
  gcircle(card, x, y, 24, CA(PAL.gold, 0.22), C('#8A6A2A'), 2);
  label(card, x, y, icon, { size: 24 });
  const ok = own >= need;
  label(card, x + 34 + valW / 2, y, `${fmt(need)}/${fmt(own)}`,
    { size: 22, color: ok ? OK : NO, bold: true, align: 'left', w: valW, h: 48, shrink: true });
}

/* ---------- 弹窗内组件（分区版式：亮色分区板 + 墨色数据行，与升级页大卡同构） ---------- */

/** 弹窗内容分区：亮色板（宽 530）+ 金色顶签骑上缘 */
function modalZone(panel: Node, cy: number, h: number, tag: string): Node {
  const zone = zonePanel(panel, 0, cy, 530, h);
  zoneTab(panel, -195, cy + h / 2, tag);
  return zone;
}

/** 弹窗分区数据行（亮底墨色字）：名称 / 当前值 / +提升（绿） */
function modalRow(zone: Node, y: number, name: string, cur: string, delta: string | null): void {
  label(zone, -170, y, name, { size: 20, color: INK, bold: true, align: 'left', w: 150, h: 30, shrink: true });
  label(zone, 25, y, cur, { size: 22, color: INK, bold: true, align: 'right', w: 130, h: 30, shrink: true });
  if (delta) label(zone, 170, y, delta, { size: 20, color: OK, bold: true, align: 'left', w: 120, h: 30, shrink: true });
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

/* ---------- 等级页签：自适应分区版式（卡高随屏 375~620，面板拉通整卡宽，无头像） ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string, cardH: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.lv;
  const maxed = lv >= MAX.hero;
  const cur = statsAt(hid, lv, h.weaponLv);
  const next = maxed ? cur : statsAt(hid, lv + 1, h.weaponLv);
  const card = parchmentCard(parent, 0, WYB(215, cardH), 718, cardH);
  /* 内部分区锚点：面板一顶缘 / 行动条中心 / 面板二下缘，多余高度分给两块面板 */
  const p1Top = cardH / 2 - 40;
  const actCy = -cardH / 2 + 41;
  const p2Bot = actCy + 43;
  const span = p1Top - p2Bot - 18;
  const h2 = Math.max(90, Math.min(span - 158, 190));
  const h1 = Math.max(140, Math.min(p1Top - (p2Bot + h2) - 18, 230));
  /* 分区一：属性提升（首行=等级变化；顶签骑上缘） */
  const st1 = zonePanel(card, 0, p1Top - h1 / 2, 660, h1);
  zoneTab(card, -275, p1Top, '属性提升');
  const r1 = (h1 - 60) / 3;
  statRow(st1, h1 / 2 - 30, '等级', maxed ? `Lv.${lv}（MAX）` : `Lv.${lv}`, maxed ? null : `→ Lv.${lv + 1}`);
  statRow(st1, h1 / 2 - 30 - r1, '攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`);
  statRow(st1, h1 / 2 - 30 - r1 * 2, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  statRow(st1, h1 / 2 - 30 - r1 * 3, '生命', String(cur.hp), maxed ? null : `+${next.hp - cur.hp}`);
  /* 分区二：等级效果 */
  const st2 = zonePanel(card, 0, p2Bot + h2 / 2, 660, h2);
  zoneTab(card, -275, p2Bot + h2, '等级效果');
  const r2 = (h2 - 44) / 2;
  (MILESTONES[hid] || []).forEach((m, i) => {
    const reached = lv >= m.lv;
    label(st2, -265, h2 / 2 - 22 - r2 * i, `${m.lv}级`, { size: 19, color: reached ? INK : '#7A6A4C', bold: true, w: 70, h: 28 });
    label(st2, 10, h2 / 2 - 22 - r2 * i, (reached ? '✓ ' : '') + m.txt, { size: 19, color: reached ? INK : '#7A6A4C', bold: reached, align: 'left', w: 460, h: 28, shrink: true });
  });
  /* 行动条（消耗 + 升级按钮，深一档底色） */
  const act = zonePanel(card, 0, actCy, 660, 54, true);
  costChip(act, -200, 0, '🪙', maxed ? 0 : heroUpCost(lv), sv.gold, 130);
  btn(act, 205, 0, 170, 54, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 24);
  if (!maxed) gpanel(act, 278, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
}

/* ---------- 武器页签：与等级页签同自适应分区版式（面板拉通整卡宽，无头像） ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string, cardH: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const cur = statsAt(hid, h.lv, lv);
  const next = maxed ? cur : statsAt(hid, h.lv, lv + 1);
  const c = weaponUpCost(lv);
  const card = parchmentCard(parent, 0, WYB(215, cardH), 718, cardH);
  const p1Top = cardH / 2 - 40;
  const actCy = -cardH / 2 + 41;
  const p2Bot = actCy + 43;
  const span = p1Top - p2Bot - 18;
  const h2 = Math.max(90, Math.min(span - 158, 150));
  const h1 = Math.max(140, Math.min(p1Top - (p2Bot + h2) - 18, 260));
  /* 分区一：武器属性提升（顶签=武器名；首行=强化等级变化） */
  const st1 = zonePanel(card, 0, p1Top - h1 / 2, 660, h1);
  zoneTab(card, -275, p1Top, HERO_DEFS[hid].weaponName);
  const r1 = (h1 - 60) / 3;
  statRow(st1, h1 / 2 - 30, '强化等级', maxed ? `Lv.${lv}（MAX）` : `Lv.${lv}`, maxed ? null : `→ Lv.${lv + 1}`);
  statRow(st1, h1 / 2 - 30 - r1, '攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`);
  statRow(st1, h1 / 2 - 30 - r1 * 2, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  statRow(st1, h1 / 2 - 30 - r1 * 3, '生命', String(cur.hp), null);
  /* 分区二：每级提升（攻击/材料两行） */
  const st2 = zonePanel(card, 0, p2Bot + h2 / 2, 660, h2);
  zoneTab(card, -275, p2Bot + h2, '每级提升');
  label(st2, -265, h2 / 2 - 26, '攻击', { size: 19, color: INK, bold: true, w: 70, h: 28 });
  label(st2, 10, h2 / 2 - 26, '+6% / 级', { size: 19, color: INK, bold: true, align: 'left', w: 460, h: 28, shrink: true });
  label(st2, -265, -h2 / 2 + 26, '材料', { size: 19, color: INK, bold: true, w: 70, h: 28 });
  label(st2, 10, -h2 / 2 + 26, '每5级需求 +1', { size: 19, color: INK, bold: true, align: 'left', w: 460, h: 28, shrink: true });
  /* 行动条（双消耗 + 强化按钮） */
  const act = zonePanel(card, 0, actCy, 660, 54, true);
  costChip(act, -200, 0, '🪙', maxed ? 0 : c.gold, sv.gold, 110);
  costChip(act, -20, 0, '🧱', maxed ? 0 : c.mat, matOwned(), 70);
  btn(act, 205, 0, 170, 54, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 24);
  if (!maxed) gpanel(act, 278, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
}

/* ---------- 技能页签：大背板（与等级/武器同卡）+ 技能槽×3 固定高顶对齐，点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string, cardH: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const card = parchmentCard(parent, 0, WYB(215, cardH), 718, cardH);
  const slotCy = cardH / 2 - 24 - 155; // 槽高 310 顶对齐：上缘留 24 内距
  SKILL_INFO.forEach((info, i) => {
    const lv = h[info.key];
    const slot = zonePanel(card, -234 + i * 234, slotCy, 218, 310);
    const circ = gcircle(slot, 0, 82, 58, CA('#2A3240', 1), C(info.cls), 2.5);
    artSprite(circ, 0, 0, 116, 116, 'ui_gear_ring', { sliced: false, belowIdx: 0 });
    label(slot, 0, 82, info.icon, { size: 26, color: '#FFE08A', bold: true });
    label(slot, 0, -12, info.name, { size: 22, color: INK, bold: true, w: 196, h: 32, shrink: true });
    label(slot, 0, -60, info.desc, { size: 16, color: SUB, w: 196, h: 64, shrink: true, lineHeight: 21 });
    label(slot, 55, -118, `${lv}级`, { size: 28, color: INK, bold: true, w: 90, h: 36 });
    if (lv < MAX.skill) gpanel(slot, 84, 130, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    slot.on(Node.EventType.TOUCH_END, () => skillModal(ctx, hid, info.slot, () => ctx.refresh()));
  });
}

/** 技能升级弹窗（分区结构：头部 → 属性提升 → 每级提升 → 消耗/持有 + 升级按钮） */
function skillModal(ctx: PageCtx, hid: string, slot: 'atk' | 'skill' | 'ult', rebuild: () => void): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const info = SKILL_INFO.find(s => s.slot === slot)!;
  const lv = h[info.key];
  const maxed = lv >= MAX.skill;
  const cost = skillUpCost(lv);
  const panel = modal(ctx, 590, 570, '技能升级');
  /* 头部：图标左，名称/等级右（align 需 shrink，盒 = x±w/2 → x = 左缘 + w/2） */
  goldIconPlate(panel, -190, 170, 96, undefined, info.icon, 26);
  label(panel, 56, 194, info.name, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 320, h: 32, shrink: true });
  label(panel, 56, 156, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 19, color: '#FFE08A', bold: true, align: 'left', w: 320, h: 30, shrink: true });
  /* 分区一：属性提升（顶缘固定 112） */
  const hA = 90;
  const zA = modalZone(panel, 112 - hA / 2, hA, '属性提升');
  if (slot === 'skill') {
    const cur = statsAt(hid, h.lv, h.weaponLv, lv);
    const next = maxed ? cur : statsAt(hid, h.lv, h.weaponLv, lv + 1);
    modalRow(zA, 0, '技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`);
  } else {
    const nm = slot === 'atk' ? '普攻伤害' : '大招伤害';
    modalRow(zA, 0, nm, `+${(lv - 1) * 10}%`, maxed ? null : `→ +${lv * 10}%`);
  }
  /* 分区二：等级效果（阶段性档位，已达成的打 ✓） */
  const ms = SKILL_MILESTONES[slot];
  const hB = 44 + ms.length * 28;
  const zB = modalZone(panel, (112 - hA) - 16 - hB / 2, hB, '等级效果');
  ms.forEach((m, i) => {
    const reached = lv >= m.lv;
    const cy = hB / 2 - 24 - 28 * i;
    label(zB, -170, cy, `${m.lv}级`, { size: 19, color: reached ? INK : '#7A6A4C', bold: true, w: 70, h: 28 });
    label(zB, 65, cy, (reached ? '✓ ' : '') + m.txt, { size: 19, color: reached ? INK : '#7A6A4C', bold: reached, align: 'left', w: 380, h: 28, shrink: true });
  });
  /* 行动条（深条 + 消耗 + 升级按钮） */
  const act = gpanel(panel, 0, -196, 530, 64, CA('#0B0F16', 0.55), undefined, 0, 12);
  if (!maxed) {
    costChipLight(act, -140, 0, '🪙', cost, sv.gold, 170);
    btn(act, 170, 0, 170, 54, '升 级', PAL.gold, () => {
      const r = upSkill(hid, slot);
      toast(r.msg);
      if (r.ok) { const d2 = panel.parent; if (d2) d2.destroy(); rebuild(); }
    }, 24);
  } else {
    label(act, 0, 0, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
}

/* ---------- 装备页签：大背板（与等级/武器同卡）+ 装备槽×4 固定高顶对齐，点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string, cardH: number): void {
  const card = parchmentCard(parent, 0, WYB(215, cardH), 718, cardH);
  const slotCy = cardH / 2 - 24 - 155; // 槽高 310 顶对齐：上缘留 24 内距
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const slot = zonePanel(card, -261 + i * 174, slotCy, 168, 310);
    if (!inst) (slot.addComponent(UIOpacity) as UIOpacity).opacity = Math.round(255 * 0.72);
    if (inst) {
      const d = EQUIPS[inst.defId];
      goldIconPlate(slot, 0, 88, 96, undefined, KIND_ICON[kind], 42);
      label(slot, 0, -2, d.name, { size: 20, color: QCARD[q], bold: true, w: 144, h: 30, shrink: true });
      label(slot, 45, -95, `Lv.${inst.lv}`, { size: 24, color: QCARD[q], bold: true, w: 90, h: 34 });
      if (inst.lv < MAX.equip) gpanel(slot, 62, 132, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    } else {
      label(slot, 0, 88, '+', { size: 54, color: INK, bold: true });
      label(slot, 0, -95, KIND_NAME[kind], { size: 20, color: INK, bold: true, w: 144, h: 30 });
    }
    slot.on(Node.EventType.TOUCH_END, () => {
      if (!inst) { toast('该槽位未穿戴 · 去英雄页装备'); return; }
      equipModal(ctx, hid, kind, () => ctx.refresh());
    });
  });
}

/** 装备强化弹窗（分区结构：头部 → 属性提升 → 每级提升 → 消耗/持有 + 强化按钮；升级页装备卡 + 英雄页「锻造」共用） */
export function equipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const sv = loadSave();
  const inst = wornInst(hid, kind)!;
  const d = EQUIPS[inst.defId];
  const maxed = inst.lv >= MAX.equip;
  const c = equipUpCost(inst.lv);
  const panel = modal(ctx, 590, 540, '装备强化');
  /* 头部：图标左，名称/品质等级右 */
  gpanel(panel, -190, 170, 100, 100, CA('#2A3240', 1), C(QCOLOR[d.quality]), 2.5, 14);
  label(panel, -190, 170, KIND_ICON[kind], { size: 44 });
  label(panel, 56, 194, d.name, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 320, h: 32, shrink: true });
  label(panel, 56, 156, maxed ? `${QNAMES[d.quality]} · T${d.tier}　强化 Lv.${inst.lv}（MAX）` : `${QNAMES[d.quality]} · T${d.tier}　强化 Lv.${inst.lv} → Lv.${inst.lv + 1}`,
    { size: 18, color: '#FFE08A', bold: true, align: 'left', w: 330, h: 28, shrink: true });
  /* 分区一：属性提升（顶缘固定 112；主属性几条算几行，行高随行数自适应） */
  const rows: { nm: string; cur: string; delta: string | null }[] = [];
  if (d.atk > 0) {
    const curV = equipAtk(inst);
    const nextV = maxed ? curV : equipAtk({ ...inst, lv: inst.lv + 1 });
    rows.push({ nm: '攻击', cur: String(curV), delta: maxed ? null : `+${nextV - curV}` });
  }
  if (d.hp > 0) {
    const curV = equipHp(inst);
    const nextV = maxed ? curV : equipHp({ ...inst, lv: inst.lv + 1 });
    rows.push({ nm: '生命', cur: String(curV), delta: maxed ? null : `+${nextV - curV}` });
  }
  const hA = 46 + rows.length * 44;
  const zA = modalZone(panel, 112 - hA / 2, hA, '属性提升');
  rows.forEach((r, i) => modalRow(zA, hA / 2 - 36 - 44 * i, r.nm, r.cur, r.delta));
  /* 分区二：每级提升 */
  const hB = 96;
  const zB = modalZone(panel, (112 - hA) - 16 - hB / 2, hB, '每级提升');
  label(zB, -35, 14, '主属性 +4% / 级', { size: 19, color: INK, bold: true, align: 'left', w: 400, h: 28, shrink: true });
  label(zB, -35, -18, '材料 每7级需求 +1', { size: 19, color: INK, bold: true, align: 'left', w: 400, h: 28, shrink: true });
  /* 行动条（深条 + 双消耗 + 强化按钮） */
  const act = gpanel(panel, 0, -186, 530, 64, CA('#0B0F16', 0.55), undefined, 0, 12);
  if (!maxed) {
    costChipLight(act, -175, 0, '🪙', c.gold, sv.gold, 110);
    costChipLight(act, -30, 0, '🧱', c.mat, matOwned(), 70);
    btn(act, 180, 0, 150, 54, '强 化', PAL.gold, () => {
      const r = upWornEquip(hid, kind);
      toast(r.msg);
      if (r.ok) { const p2 = panel.parent; if (p2) p2.destroy(); rebuild(); }
    }, 24);
  } else {
    label(act, 0, 0, '已达强化上限', { size: 22, color: '#AAB2BD' });
  }
}
