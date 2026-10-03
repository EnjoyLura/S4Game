/**
 * ④ 升级（自适应分区版式）：大立绘顶部锚定（上限 350，贴头像栏正下方）+ 金色光台座；
 *   等级/武器升级大卡底边贴页签、顶边顶着台座之下，高度 375~620 随屏取足，卡内分区
 *   （「属性提升」/「等级效果·每级提升」/ 底部行动条）拉通整卡宽随之拉伸；
 *   技能/装备页签=固定高度卡片网格，点击弹升级弹窗（弹窗内同为参考结构）。
 * 坐标：上半部顶部锚点，下半部（名牌/内容/页签）底部锚点——任何屏高都贴住导航栏。
 */
import { Graphics, Mask, Node, ScrollView, UITransform, UIOpacity } from 'cc';
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

/* 武器强化阶段档位（展示性文案，战斗内逐步落地；武器驱动普攻，档位偏普攻向，数值待战斗侧校准） */
const WEAPON_MILESTONES: Record<string, { lv: number; txt: string }[]> = {
  archer: [
    { lv: 5, txt: '攻速 +8%' },
    { lv: 10, txt: '攻击力 +12%' },
    { lv: 15, txt: '普攻20%追加一箭' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  sniper: [
    { lv: 5, txt: '攻击力 +10%' },
    { lv: 10, txt: '暴击伤害 +25%' },
    { lv: 15, txt: '普攻必定命中' },
    { lv: 20, txt: '普攻伤害 +25%' },
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

    /* 上半大背板（用户确认参考英雄页）：物理屏顶罩住头像栏+大立绘+名牌；高度随屏收缩，保底留给下方强化区 */
    const upT = Math.max(560, Math.min(800, 2 * LO.half - 620 - LO.safeTop));
    artPanel(content, 0, WY(-LO.safeTop, upT + LO.safeTop), 750, upT + LO.safeTop, 'ui_panel_hero');

    /* 常驻英雄栏：头像切换（未拥有灰锁）；用户确认：头像不加边框（无描边、无带环座美术） */
    (['archer', 'sniper'] as const).forEach((id, i) => {
      const o = sv.heroes[id].owned;
      const av = gpanel(content, WX(30 + i * 100, 88), WY(205, 88), 88, 88,
        CA('#2A3240', 1), undefined, 0, 44);
      artSprite(av, 0, 0, 76, 76, HERO_DEFS[id].avatar, { sliced: false });
      if (!o) { gpanel(av, 0, 0, 88, 88, CA('#0B0F16', 0.6), undefined, 0, 44); label(av, 0, 0, '🔒', { size: 30 }); }
      av.on(Node.EventType.TOUCH_END, () => {
        if (!o) { toast('前往商店解锁该英雄'); return; }
        sv.curHero = id; saveCur(id); render();
      });
    });
    /* 悬浮大立绘（上限 350，顶部锚定）+ 脚下金色光台座 —— 罩在上半大背板内 */
    const dispTopY = LO.half - 300;
    const artH = Math.max(0, Math.min(350, upT - 445));
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

    /* 自适应升级大卡（武器/技能/装备页签仍用）：底边贴页签，顶边顶着台座之下 */
    const pedBot = hasArt ? artBot - 66 : artBot - 8;
    const cardBot = WYB(232, 0);
    const cardH = Math.max(375, Math.min(pedBot - 93 - cardBot, 620));

    /* 脚底名牌：贴大背板下缘内侧（Lv + 名字 + 战力 + 圆形 i 详情钮，无边框规范） */
    const foot = gpanel(content, 0, LO.half - (upT - 55), 400, 76, CA('#0B0F16', 0.58), undefined, 0, 38);
    label(foot, -148, 0, `Lv.${sv.heroes[hid].lv}`, { size: 22, color: '#FFE08A', bold: true, align: 'left', w: 76, h: 34 });
    label(foot, -19, 0, def.name, { size: 25, color: '#FFF3D6', bold: true, align: 'left', w: 170, h: 40, shrink: true });
    label(foot, 65, 0, `🔥 ${hs.power}`, { size: 24, color: '#FFE08A', bold: true, align: 'right', w: 110, h: 40 });
    const info = gpanel(foot, 163, 0, 54, 54, CA('#3A4250', 1), undefined, 0, 27);
    label(info, 0, 0, 'i', { size: 30, color: '#FFFFFF', bold: true });
    info.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: () => void };
      if (ev && ev.propagationStopped) ev.propagationStopped();
      attrsModal(ctx, hid);
    });

    /* 页签内容：等级页签=无大背板新版式（用户确认先做等级页签）；其余页签暂用大卡版式 */
    const tabTop = LO.half - upT - LO.safeTop - 60;   // 属性提升标题须完全在大背板下缘之下（用户确认）
    if (st.tab === 0) tabLevel(content, ctx, hid, tabTop);
    else if (st.tab === 1) tabWeapon(content, ctx, hid, tabTop);
    else if (st.tab === 2) tabSkills(content, ctx, hid, tabTop);
    else tabEquips(content, ctx, hid, tabTop);

    /* 四页签连体（用户确认与页签栏同做法：无背板、段内直角、仅首/末段外侧圆弧），贴导航栏正上方（NAV 148+10） */
    const segW = 720 / 4, segH = 62, segR = 14;
    const tabs = ['等级', '武器', '技能', '装备'];
    tabs.forEach((t, i) => {
      const seg = N('tabseg' + i, content, WX(15 + i * segW, segW), WYB(158, segH), segW, segH);
      const g = seg.addComponent(Graphics);
      g.fillColor = C(i === st.tab ? PAL.gold : '#5A6472');
      g.roundRect(-segW / 2, -segH / 2, segW, segH, i === 0 || i === tabs.length - 1 ? segR : 0);
      if (i === 0) g.rect(segW / 2 - segR, -segH / 2, segR, segH);
      else if (i === tabs.length - 1) g.rect(-segW / 2, -segH / 2, segR, segH);
      g.fill();
      label(seg, 0, 0, t, { size: 22, color: '#241C12', bold: true, w: segW, h: segH });
      seg.on(Node.EventType.TOUCH_END, () => { st.tab = i as 0 | 1 | 2 | 3; render(); });
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

/** 等级效果步骤条（等级/武器页签与技能升级弹窗共用）：奶白板拉通到行动条、不留底部空档（用户确认）；
 * topY = 上方面板底缘，与其拉开 44 留出标题空间（标题完全出板）；botY = 行动条上缘 + 间距；w = 板宽（页签 700 / 弹窗 560）。
 * 卡片固定节奏（高 64 / 间距 18，各页签一致——用户确认）整组垂直居中；放不下时顶对齐、可滑动。
 * 竖线节点与文字左缘同列（左内距 30），达成档位亮卡、未达成置灰 */
function fxStepper(parent: Node, topY: number, botY: number, title: string, ms: { lv: number; txt: string }[], lv: number, w = 700): void {
  const CARD_H = 64, GAP = 18, PAD = 16;
  const fxTop = topY - 44;
  const fxH = Math.max(150, fxTop - botY);
  const fx = gpanel(parent, 0, botY + fxH / 2, w, fxH, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(parent, -w / 2 + 70, fxTop + 17, title);
  const viewH = fxH - 8;
  const stackH = ms.length * CARD_H + (ms.length - 1) * GAP;
  const contentH = Math.max(stackH + PAD * 2, viewH);
  const off = contentH > viewH ? PAD : (viewH - stackH) / 2;
  const view = N('fxView', fx, 0, 0, w - 40, viewH);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const ct = N('fxContent', view, 0, viewH / 2, w - 40, contentH);
  ct.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
  scroll.content = ct;
  scroll.horizontal = false;
  scroll.vertical = true;
  const LINE_X = -w / 2 + 30;
  const yAt = (i: number): number => -(off + i * (CARD_H + GAP) + CARD_H / 2);
  const lineG = N('fxLine', ct, 0, 0, 8, contentH).addComponent(Graphics);
  lineG.fillColor = C('#B8A87F');
  lineG.rect(LINE_X - 2, yAt(ms.length - 1), 4, yAt(0) - yAt(ms.length - 1));   // 线仅连首末节点
  lineG.fill();
  const lastReached = ms.reduce((acc, m, i) => (lv >= m.lv ? i : acc), -1);
  if (lastReached >= 0) {
    lineG.fillColor = C(PAL.gold);
    lineG.rect(LINE_X - 2, yAt(lastReached), 4, yAt(0) - yAt(lastReached));
    lineG.fill();
  }
  ms.forEach((m, i) => {
    const yC = yAt(i);
    const reached = lv >= m.lv;
    gcircle(ct, LINE_X, yC, 10, reached ? C(PAL.gold) : C('#A5987B'));
    const c = gpanel(ct, 10, yC, w - 80, CARD_H, reached ? CA('#E8C878', 0.95) : CA('#D8CBA8', 0.5), undefined, 0, 10);
    label(c, -w / 2 + 114, 0, `${m.lv}级`, { size: 20, color: reached ? INK : '#8A7A5C', bold: true, align: 'left', w: 80, h: 30 });
    label(c, 70, 0, (reached ? '✓ ' : '') + m.txt, { size: 20, color: reached ? INK : '#8A7A5C', bold: reached, align: 'left', w: w - 260, h: 30, shrink: true });
  });
}

/* ---------- 等级页签：无大背板版式（用户确认）——奶白属性板 + 等级效果竖线步骤条（可滑动）+ 消耗/升级条 ---------- */
function tabLevel(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.lv;
  const maxed = lv >= MAX.hero;
  const cur = statsAt(hid, lv, h.weaponLv);
  const next = maxed ? cur : statsAt(hid, lv + 1, h.weaponLv);
  const botY = WYB(232, 0);
  /* 属性提升（奶白板浮于背景；英雄不会受伤——强化不展示/不提升生命，用户确认） */
  const p1H = 150;
  const p1 = gpanel(parent, 0, topY - p1H / 2, 700, p1H, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(parent, -280, topY + 16, '属性提升');   // 标题完全拿出面板外（用户确认）
  const rows: [string, string, string | null][] = [
    ['等级', `Lv.${lv}`, maxed ? null : `→ Lv.${lv + 1}`],
    ['攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`],
    ['技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`],
  ];
  rows.forEach((r, i) => {
    const y = 32 - i * 32;
    label(p1, -240, y, r[0], { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
    label(p1, 40, y, r[1], { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
    if (r[2]) label(p1, 240, y, r[2], { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });  // 右缘 320=背板右内距（用户确认）
  });
  /* 行动条（消耗 + 升级按钮，深色药丸条） */
  const actH = 64;
  const actCy = botY + actH / 2;
  const act = gpanel(parent, 0, actCy, 700, actH, CA('#14181E', 0.72), undefined, 0, 32);
  costChip(act, -210, 0, '🪙', maxed ? 0 : heroUpCost(lv), sv.gold, 130);
  btn(act, 215, 0, 170, 54, maxed ? 'MAX' : '升 级', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upHero(hid), ctx); }, 24, true);
  if (!maxed) gpanel(act, 288, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  /* 等级效果：竖线步骤条（与武器页签共用 fxStepper；背板贴内容高度、标题完全出板） */
  fxStepper(parent, topY - p1H, actCy + actH / 2 + 14, '等级效果', MILESTONES[hid] || [], lv);
}

/* ---------- 武器页签：与等级页签完全同构版式（用户确认整体复制）——奶白属性板 + 等级效果步骤条 + 消耗/强化条 ---------- */
function tabWeapon(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const lv = h.weaponLv;
  const maxed = lv >= MAX.weapon;
  const cur = statsAt(hid, h.lv, lv);
  const next = maxed ? cur : statsAt(hid, h.lv, lv + 1);
  const c = weaponUpCost(lv);
  const botY = WYB(232, 0);
  /* 属性提升（标题=武器名，完全出板；行结构与等级页签一致；英雄不会受伤——不展示生命） */
  const p1H = 150;
  const p1 = gpanel(parent, 0, topY - p1H / 2, 700, p1H, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(parent, -280, topY + 16, HERO_DEFS[hid].weaponName);
  const rows: [string, string, string | null][] = [
    ['强化等级', `Lv.${lv}`, maxed ? null : `→ Lv.${lv + 1}`],
    ['攻击力', String(cur.atk), maxed ? null : `+${next.atk - cur.atk}`],
    ['技能伤害', String(cur.skillDmg), maxed ? null : `+${next.skillDmg - cur.skillDmg}`],
  ];
  rows.forEach((r, i) => {
    const y = 32 - i * 32;
    label(p1, -240, y, r[0], { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
    label(p1, 40, y, r[1], { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
    if (r[2]) label(p1, 240, y, r[2], { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });
  });
  /* 行动条（双消耗 + 强化按钮，深色药丸条） */
  const actH = 64;
  const actCy = botY + actH / 2;
  const act = gpanel(parent, 0, actCy, 700, actH, CA('#14181E', 0.72), undefined, 0, 32);
  costChip(act, -225, 0, '🪙', maxed ? 0 : c.gold, sv.gold, 130);
  costChip(act, -75, 0, '🧱', maxed ? 0 : c.mat, matOwned(), 70);
  btn(act, 215, 0, 170, 54, maxed ? 'MAX' : '强 化', maxed ? '#5A6472' : PAL.gold,
    () => { if (!maxed) save(hid, upWeapon(hid), ctx); }, 24, true);
  if (!maxed) gpanel(act, 288, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  /* 等级效果：竖线步骤条（与等级页签共用 fxStepper，展示武器阶段档位） */
  fxStepper(parent, topY - p1H, actCy + actH / 2 + 14, '等级效果', WEAPON_MILESTONES[hid] || [], lv);
}

/* ---------- 技能页签：无大背板（用户确认）——技能卡×3 浮于背景：无框圆图标 + 名称 + 居中等级，点击弹升级弹窗 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const SLOT_H = 250;
  const slotCy = topY - SLOT_H / 2;
  SKILL_INFO.forEach((info, i) => {
    const lv = h[info.key];
    const slot = gpanel(parent, -234 + i * 234, slotCy, 218, SLOT_H, CA('#E9DFC2', 0.94), undefined, 0, 12);
    const circ = gcircle(slot, 0, 62, 58, CA('#2A3240', 1));   // 图标无描边、无齿轮环美术（用户确认）
    label(circ, 0, 0, info.icon, { size: 26, color: '#FFE08A', bold: true });
    label(slot, 0, -28, info.name, { size: 22, color: INK, bold: true, w: 196, h: 32, shrink: true });
    label(slot, 0, -84, `${lv}级`, { size: 28, color: INK, bold: true, w: 120, h: 36 });   // 等级居中（用户确认）
    if (lv < MAX.skill) gpanel(slot, 84, SLOT_H / 2 - 13, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    slot.on(Node.EventType.TOUCH_END, () => skillModal(ctx, hid, info.slot, () => ctx.refresh()));
  });
}

/** 技能升级弹窗（与等级/武器页签同版式，用户确认：平弹窗无框美术、无框圆图标、奶白属性板标题出板 + 等级效果步骤条 + 深色行动条） */
function skillModal(ctx: PageCtx, hid: string, slot: 'atk' | 'skill' | 'ult', rebuild: () => void): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const info = SKILL_INFO.find(s => s.slot === slot)!;
  const lv = h[info.key];
  const maxed = lv >= MAX.skill;
  const cost = skillUpCost(lv);
  const W = 620, H = 780, PW = 560;   // PW：弹窗内奶白板/行动条宽
  const panel = modal(ctx, W, H, '技能升级', true);
  /* 头部：无框圆图标 + 名称 + 等级变化 */
  const circ = gcircle(panel, -W / 2 + 66, H / 2 - 90, 44, CA('#2A3240', 1));
  label(circ, 0, 0, info.icon, { size: 20, color: '#FFE08A', bold: true });
  label(panel, -W / 2 + 272, H / 2 - 76, info.name, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 32, shrink: true });
  label(panel, -W / 2 + 272, H / 2 - 112, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 19, color: '#FFE08A', bold: true, align: 'left', w: 300, h: 30, shrink: true });
  /* 属性提升（奶白板 + 标题出板；行结构与页签一致） */
  const p1Top = H / 2 - 180;
  const p1H = 88;
  const p1 = gpanel(panel, 0, p1Top - p1H / 2, PW, p1H, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p1Top + 17, '属性提升');
  let nm: string, curS: string, delta: string | null = null;
  if (slot === 'skill') {
    const cur = statsAt(hid, h.lv, h.weaponLv, lv);
    const next = maxed ? cur : statsAt(hid, h.lv, h.weaponLv, lv + 1);
    nm = '技能伤害';
    curS = String(cur.skillDmg);
    if (!maxed) delta = `+${next.skillDmg - cur.skillDmg}`;
  } else {
    nm = slot === 'atk' ? '普攻伤害' : '大招伤害';
    curS = `+${(lv - 1) * 10}%`;
    if (!maxed) delta = `→ +${lv * 10}%`;
  }
  label(p1, -PW / 2 + 90, 0, nm, { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
  label(p1, PW / 2 - 310, 0, curS, { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
  if (delta) label(p1, PW / 2 - 110, 0, delta, { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });
  /* 行动条（深色药丸 + 消耗 + 升级钮，与页签一致） */
  const actH = 64;
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, actH, CA('#14181E', 0.72), undefined, 0, 32);
  if (!maxed) {
    costChip(act, -175, 0, '🪙', cost, sv.gold, 130);
    btn(act, 165, 0, 170, 54, '升 级', PAL.gold, () => {
      const r = upSkill(hid, slot);
      toast(r.msg);
      if (r.ok) { const d2 = panel.parent; if (d2) d2.destroy(); rebuild(); }
    }, 24, true);
    gpanel(act, 238, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  } else {
    label(act, 0, 0, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
  /* 等级效果：竖线步骤条（与页签共用 fxStepper，弹窗内板宽 560） */
  fxStepper(panel, p1Top - p1H, actCy + actH / 2 + 14, '等级效果', SKILL_MILESTONES[slot], lv, PW);
}

/* ---------- 装备页签：无大背板（用户确认参考技能页签）——装备卡×4 浮于背景：方形品质背板套图标
 * （像英雄页装备槽）+ 名称 + 居中「几阶·几级」，点击弹强化弹窗 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const SLOT_H = 250;
  const slotCy = topY - SLOT_H / 2;
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const slot = gpanel(parent, -261 + i * 174, slotCy, 168, SLOT_H, CA('#E9DFC2', 0.94), undefined, 0, 12);
    if (!inst) (slot.addComponent(UIOpacity) as UIOpacity).opacity = Math.round(255 * 0.72);
    if (inst) {
      const d = EQUIPS[inst.defId];
      gpanel(slot, 0, 62, 96, 96, CA(QCOLOR[d.quality], 0.55), undefined, 0, 12);   // 方形品质背板（用户确认）
      label(slot, 0, 62, KIND_ICON[kind], { size: 42 });
      label(slot, 0, -28, d.name, { size: 20, color: QCARD[q], bold: true, w: 144, h: 30, shrink: true });
      label(slot, 0, -84, `${d.tier}阶·${inst.lv}级`, { size: 24, color: QCARD[q], bold: true, w: 150, h: 34 });   // 几阶·几级 居中（用户确认）
      if (inst.lv < MAX.equip) gpanel(slot, 62, 112, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
    } else {
      label(slot, 0, 62, '+', { size: 54, color: INK, bold: true });
      label(slot, 0, -84, KIND_NAME[kind], { size: 20, color: INK, bold: true, w: 144, h: 30 });
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
  /* 头部：图标左（品质色方形底板，用户确认），名称/品质等级右 */
  gpanel(panel, -190, 170, 100, 100, CA(QCOLOR[d.quality], 0.55), undefined, 0, 14);
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
    }, 24, true);
  } else {
    label(act, 0, 0, '已达强化上限', { size: 22, color: '#AAB2BD' });
  }
}
