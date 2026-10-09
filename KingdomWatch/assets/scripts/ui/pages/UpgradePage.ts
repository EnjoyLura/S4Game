/**
 * ④ 升级：英雄栏 + 紧凑英雄摘要 + 顶部分类；强化预览与行动条分区，突破列表独立滚动。
 */
import { Graphics, Mask, Node, ScrollView, UITransform, UIOpacity } from 'cc';
import { LO, PAL } from '../../config/GameConfig';
import { CA, btn, C, gcircle, gpanel, label, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { mainLabel, PageCtx, modal, toast, fmt, heroFigure, heroRoster, mainLayout, mainSegments, pageScroll, sectionTitle } from '../PageKit';
import { attrsModal } from './HeroPage';
import {
  EquipKind, HERO_DEFS, EQUIPS, KIND_NAME, QCOLOR, MAX,
  heroStats, heroUpCost, weaponUpCost, skillUpCost, equipUpCost,
  upHero, upWeapon, upSkill, upWornEquip, wornInst, equipStat, statFmt, equipAgg, STAT_NAME, StatKey, matCount,
  BT_STEP, BT_WPN, BT_SKL, btN, heroBtAgg, heroBtList,
} from '../../core/GameData';
import { loadSave, saveSave } from '../../core/SaveData';

const KIND_ICON: Record<string, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const WORN_4: ('helm' | 'acc' | 'glove' | 'armor')[] = ['helm', 'acc', 'glove', 'armor'];
const QNAMES = ['普通', '优秀', '稀有', '史诗'];

/* 技能三槽（页签卡片与升级弹窗共用）；名称按英雄取 HERO_DEFS（弓箭手硬编码名已去掉——用户反馈），图标=各英雄专属切图 */
const SKILL_INFO = [
  { slot: 'atk' as const, key: 'atkLv' as const, icon: 'atk', desc: '普攻伤害 +10%/级', cls: PAL.blue },
  { slot: 'skill' as const, key: 'skillLv' as const, icon: 'skill', desc: '技能伤害 +10%/级\nCD -0.5s', cls: PAL.blue },
  { slot: 'ult' as const, key: 'ultLv' as const, icon: 'ult', desc: '大招持续伤害 +10%/级', cls: PAL.purple },
];
/** 技能槽显示名：普攻无专属名；技能/大招用各英雄定名（切换英雄即跟随——用户反馈） */
const skillName = (hid: string, slot: 'atk' | 'skill' | 'ult'): string =>
  slot === 'atk' ? '普攻' : slot === 'skill' ? HERO_DEFS[hid].skillName : HERO_DEFS[hid].ultName;
/** 技能槽切图：ui_icon_<atk|skill|ult>_<hid>（切图批次），缺图回退文字 */
const skillIconId = (hid: string, slot: 'atk' | 'skill' | 'ult'): string => `ui_icon_${slot}_${hid}`;

/* 阶段性突破档位（真实数值——用户确认节奏：英雄/武器每10级、技能每5级一次跳升，文案与 GameData 公式一致；已达成的档位打 ✓） */
const btMs = (cap: number, step: number, txt: string): { lv: number; txt: string }[] =>
  Array.from({ length: Math.floor(cap / step) }, (_, i) => ({ lv: (i + 1) * step, txt: `突破 · ${txt}` }));

/* 羊皮纸卡面配色（同 Panels 战斗卡）；品质字色用加深版（原 QCOLOR 在浅底上看不清） */
const INK = '#4A3214';
const SUB = '#6B5A3A';
const OK = '#3E7C28';
const NO = '#B03A2E';
const QCARD = ['#6B5A3A', '#3E7C28', '#1F6BC4', '#8A3FD0'];

/** 英雄突破步骤条数据（专属表 txt 直用——弓箭手已定稿；未配置英雄回退通用档） */
const heroMilestones = (hid: string): { lv: number; txt: string }[] => heroBtList(hid).map(m => ({ lv: m.lv, txt: m.txt }));
const weaponMilestones = (): { lv: number; txt: string }[] => btMs(MAX.weapon, BT_STEP.weapon, `攻击与技能伤害 +${Math.round(BT_WPN * 100)}%`);
/* 弓箭手技能升级里程碑（用户定稿：机制型档位取代通用 +15%/5级）；其余英雄维持通用数值档 */
const SKILL_MS_ARCHER: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '普攻范围 +8%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '强化箭 +2 发' },
    { lv: 15, txt: '强化窗口 +2s' },
    { lv: 20, txt: '强化箭倍率 +0.3' },
  ],
  ult: [
    { lv: 5, txt: '每排箭数 +2' },
    { lv: 10, txt: '追加第三排' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每箭系数 +0.1' },
  ],
};
/* 重弩手（凯尔·鹰眼）技能升级里程碑（用户定稿） */
const SKILL_MS_SNIPER: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对满血目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '连狙 +2 发' },
    { lv: 15, txt: '索敌窗口 +1s' },
    { lv: 20, txt: '每发倍率 +0.4' },
  ],
  ult: [
    { lv: 5, txt: '大招弹体范围 +20%' },
    { lv: 10, txt: '猎杀标记：受伤 +20% · 5s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '倍率 +1.0' },
  ],
};
/* 雷法师（沃尔·雷霆）技能升级里程碑（用户定稿） */
const SKILL_MS_VOLT: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对感电目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '连锁目标 +1（累计 6）' },
    { lv: 15, txt: '连锁递增：每跳伤害 +10%' },
    { lv: 20, txt: '每跳倍率 1.4→1.7' },
  ],
  ult: [
    { lv: 5, txt: '落雷范围 +20%' },
    { lv: 10, txt: '落雷命中感电 +25% · 3s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每道倍率 2.2→2.6' },
  ],
};
/* 火法师（焰·辉）技能升级里程碑（用户定稿） */
const SKILL_MS_PYRO: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对灼烧目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '火球 +1 发（累计 4）' },
    { lv: 15, txt: '爆炸伤害 40%→60%' },
    { lv: 20, txt: '每发倍率 1.6→1.9' },
  ],
  ult: [
    { lv: 5, txt: '陨石 +2 颗（累计 7）' },
    { lv: 10, txt: '陨石坑范围 +25%' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每颗倍率 3.5→3.9' },
  ],
};
/* 冰霜法师（莫拉·寒霜）技能升级里程碑（定稿） */
const SKILL_MS_MORA: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对减速目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '新星范围 +20%' },
    { lv: 15, txt: '冻结时间 +0.3s' },
    { lv: 20, txt: '倍率 1.5→1.8' },
  ],
  ult: [
    { lv: 5, txt: '减速 50%→60%' },
    { lv: 10, txt: '减速持续 4→6s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '倍率 1.8→2.2' },
  ],
};
const SKILL_GENERIC: Record<'atk' | 'skill' | 'ult', string> = {
  atk: '普攻伤害 +15%',
  skill: `技能伤害 +${Math.round(BT_SKL * 100)}%`,
  ult: '大招伤害 +15%',
};
const skillMilestones = (hid: string, slot: 'atk' | 'skill' | 'ult'): { lv: number; txt: string }[] =>
  hid === 'archer' ? SKILL_MS_ARCHER[slot]
    : hid === 'sniper' ? SKILL_MS_SNIPER[slot]
      : hid === 'volt' ? SKILL_MS_VOLT[slot]
        : hid === 'pyro' ? SKILL_MS_PYRO[slot]
          : hid === 'mora' ? SKILL_MS_MORA[slot]
            : btMs(MAX.skill, BT_STEP.skill, SKILL_GENERIC[slot]);

/* 页签跨刷新保持（升级后 refresh 重建页面不跳回「等级」） */
const st: { tab: 0 | 1 | 2 | 3 } = { tab: 0 };

/** 指定等级/武器/技能等级下的三维属性（复刻 heroStats 公式含阶段性突破，供升级预览差值） */
function statsAt(hid: string, lv: number, wpnLv: number, skillLv?: number): { atk: number; skillDmg: number } {
  const sv = loadSave();
  const def = HERO_DEFS[hid];
  const h = sv.heroes[hid];
  const skl = skillLv ?? h.skillLv;
  const agg = equipAgg(hid);   // 穿戴词条：攻击平加/加成、技能伤害平加
  const bt = heroBtAgg(hid, lv);   // 英雄阶段性突破（弓箭手专属表；攻击/技能/面板轴）
  const base = def.baseAtk * (1 + (lv - 1) * 0.08) * (1 + bt.atkPct)
    * (1 + (wpnLv - 1) * 0.06) * (1 + btN(wpnLv, BT_STEP.weapon) * BT_WPN);
  const atk = Math.round(base * (1 + agg.atkPct) + agg.atkFlat);
  const sklMul = (hid === 'archer' || hid === 'sniper')
    ? (1 + (skl - 1) * 0.08)
    : (1 + (skl - 1) * 0.10) * (1 + btN(skl, BT_STEP.skill) * BT_SKL);
  const skillDmg = Math.round(base * sklMul * (1 + bt.skillPct) * (1 + (lv - 1) * 0.05)) + agg.skillDmgFlat;
  return { atk, skillDmg };
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

    const layout = mainLayout();
    heroRoster(content, layout.top, hid, id => { saveCur(id); render(); });
    const summary = gpanel(content, 0, WY(layout.top + 124, 152), 686, 152, CA('#192C25', 0.94), undefined, 0, 20);
    heroFigure(summary, hid, -251, -62, 130);
    mainLabel(summary, -14, 35, def.name, { size: 28, color: '#FFF0CD', bold: true, align: 'left', w: 300, h: 38 });
    mainLabel(summary, -14, 0, def.job, { size: 18, color: '#B9C9B4', align: 'left', w: 300, h: 28 });
    mainLabel(summary, -14, -38, `Lv.${sv.heroes[hid].lv}   ·   战力 ${fmt(hs.power)}`, { size: 22, color: '#FFE1A0', align: 'left', w: 300, h: 32 });
    btn(summary, 261, 0, 112, 52, '属性', '#BFD0B1', () => attrsModal(ctx, hid), 20, true);
    mainSegments(content, layout.top + 296, ['等级', '武器', '技能', '装备'], st.tab,
      i => { st.tab = i as 0 | 1 | 2 | 3; render(); });
    const tabTop = WY(layout.top + 374);
    if (st.tab === 0) tabLevel(content, ctx, hid, tabTop);
    else if (st.tab === 1) tabWeapon(content, ctx, hid, tabTop);
    else if (st.tab === 2) tabSkills(content, ctx, hid, tabTop);
    else tabEquips(content, ctx, hid, tabTop);

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

/** 分区标签：骑在分区面板上缘的小金签（标注该区用途；基地页弹窗共用） */
export function zoneTab(parent: Node, x: number, y: number, text: string): void {
  gpanel(parent, x, y, 110, 26, CA('#E8C878', 0.92), '#8A6A2A', 1.5, 10);
  label(parent, x, y, text, { size: 18, color: INK, bold: true, w: 110, h: 26 });
}

/** 消耗/持有 chip：图标座 + 「需要/持有」，够=绿 不够=红（图标座无描边——去边框规范） */
function costChip(card: Node, x: number, y: number, icon: string, need: number, own: number, valW: number): void {
  gcircle(card, x, y, 24, CA(PAL.gold, 0.22));
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

/** 弹窗消耗/持有 chip：图标 + 「需要/持有」，够=绿 不够=红（图标座无描边——去边框规范） */
function costChipLight(panel: Node, x: number, y: number, icon: string, need: number, own: number, valW: number): void {
  gcircle(panel, x, y, 22, CA(PAL.gold, 0.2));
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
  trainingPanel(parent, ctx, hid, topY, 'level', lv, maxed, cur, next, { gold: heroUpCost(lv), mat: 0 });
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
  trainingPanel(parent, ctx, hid, topY, 'weapon', lv, maxed, cur, next, c);
}

/** Main-page previews share a three-column table and a pinned action footer. */
function trainingPanel(parent: Node, ctx: PageCtx, hid: string, topY: number, mode: 'level' | 'weapon', lv: number,
  maxed: boolean, cur: { atk: number; skillDmg: number }, next: { atk: number; skillDmg: number }, cost: { gold: number; mat: number }): void {
  const layout = mainLayout();
  const top = LO.half - LO.safeTop - topY;
  const ms = mode === 'level' ? heroMilestones(hid) : weaponMilestones();
  const body = pageScroll(parent, 'trainingBody', top, layout.bottom - 104, 242 + ms.length * 76 + 12);
  const preview = gpanel(body, 0, -88, 686, 176, CA('#EADFBE', 0.98), undefined, 0, 18);
  mainLabel(preview, -206, 58, mode === 'level' ? '升级预览' : HERO_DEFS[hid].weaponName, { size: 22, color: INK, bold: true, align: 'left', w: 220, h: 30 });
  mainLabel(preview, 38, 58, '当前', { size: 17, color: SUB, align: 'right', w: 138, h: 26 });
  mainLabel(preview, 234, 58, maxed ? '已满级' : '提升', { size: 17, color: SUB, align: 'right', w: 164, h: 26 });
  const rows = [
    [mode === 'level' ? '等级' : '强化等级', `Lv.${lv}`, maxed ? 'MAX' : `→ Lv.${lv + 1}`],
    ['攻击力', fmt(cur.atk), maxed ? '—' : `+${next.atk - cur.atk}`],
    ['技能伤害', fmt(cur.skillDmg), maxed ? '—' : `+${next.skillDmg - cur.skillDmg}`],
  ];
  rows.forEach((r, i) => {
    const y = 14 - i * 34;
    mainLabel(preview, -206, y, r[0], { size: 21, color: INK, align: 'left', w: 220, h: 30 });
    mainLabel(preview, 38, y, r[1], { size: 23, color: INK, bold: true, align: 'right', w: 138, h: 30, shrink: true });
    mainLabel(preview, 234, y, r[2], { size: 23, color: OK, bold: true, align: 'right', w: 164, h: 30, shrink: true });
  });
  sectionTitle(body, -212, '突破效果', '达到指定等级解锁');
  ms.forEach((m, i) => {
    const reached = lv >= m.lv;
    const row = gpanel(body, 0, -(242 + i * 76 + 32), 686, 64,
      reached ? CA('#405337', 0.96) : CA('#192C25', 0.94), undefined, 0, 14);
    const badge = gpanel(row, -277, 0, 86, 40, reached ? '#E8BA60' : '#35493D', undefined, 0, 10);
    mainLabel(badge, 0, 0, `${m.lv}级`, { size: 20, color: reached ? '#322815' : '#B9C9B4', bold: true, w: 80, h: 30 });
    mainLabel(row, 45, 0, m.txt, { size: 21, color: reached ? '#FFF0CD' : '#B9C9B4', align: 'left', w: 500, h: 38, shrink: true });
    if (reached) mainLabel(row, 310, 0, '✓', { size: 22, color: '#E8BA60', w: 26, h: 30 });
  });
  const act = gpanel(parent, 0, WY(layout.bottom - 84, 84), 686, 84, CA('#15221F', 0.98), undefined, 0, 18);
  const sv = loadSave();
  if (maxed) {
    mainLabel(act, -112, 0, '已达等级上限', { size: 21, color: '#B9C9B4', align: 'left', w: 360, h: 34 });
  } else {
    artSprite(act, -296, 6, 32, 32, 'ui_icon_coin', { sliced: false });
    mainLabel(act, -209, 10, fmt(cost.gold), { size: 23, color: sv.gold >= cost.gold ? '#FFE1A0' : '#FF9B88', bold: true, align: 'left', w: 128, h: 32, shrink: true });
    mainLabel(act, -232, -23, '持有 ' + fmt(sv.gold), { size: 15, color: '#AEBDA9', align: 'left', w: 174, h: 22, shrink: true });
    if (mode === 'weapon') {
      artSprite(act, -83, 6, 32, 32, 'ui_item_mat_stone', { sliced: false });
      mainLabel(act, -15, 10, fmt(cost.mat), { size: 23, color: matOwned() >= cost.mat ? '#FFE1A0' : '#FF9B88', bold: true, align: 'left', w: 90, h: 32 });
      mainLabel(act, -22, -23, '持有 ' + fmt(matOwned()), { size: 15, color: '#AEBDA9', align: 'left', w: 154, h: 22, shrink: true });
    }
  }
  btn(act, 225, 0, 194, 60, maxed ? '已满级' : mode === 'level' ? '升级英雄' : '强化武器', maxed ? '#A9A68F' : '#E8BA60',
    () => { if (!maxed) save(hid, mode === 'level' ? upHero(hid) : upWeapon(hid), ctx); }, 23, true);
}

/* ---------- 技能页签：三条横向技能卡，图标/说明/升级入口保持同列 ---------- */
function tabSkills(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const sv = loadSave();
  const h = sv.heroes[hid];
  const layout = mainLayout();
  const body = pageScroll(parent, 'skillTraining', LO.half - LO.safeTop - topY, layout.bottom, 534);
  sectionTitle(body, -16, '技能培养', '点击查看提升与突破');
  SKILL_INFO.forEach((info, i) => {
    const lv = h[info.key];
    const slot = gpanel(body, 0, -(48 + i * 162 + 73), 686, 146, CA('#EADFBE', 0.98), undefined, 0, 18);
    const circ = gcircle(slot, -258, 0, 48, CA('#2A3240', 1));
    const skFb = mainLabel(circ, 0, 0, info.slot === 'atk' ? '普攻' : info.slot === 'skill' ? '技能' : '大招', { size: 26, color: '#FFE08A', bold: true });
    artSprite(circ, 0, 0, 96, 96, skillIconId(hid, info.slot), { sliced: false, hideOnLoad: [skFb] });
    mainLabel(slot, -34, 34, skillName(hid, info.slot), { size: 24, color: INK, bold: true, align: 'left', w: 296, h: 34, shrink: true });
    mainLabel(slot, -34, -5, `${info.slot === 'atk' ? '普攻' : info.slot === 'skill' ? '技能' : '大招'} · Lv.${lv}`, { size: 21, color: SUB, align: 'left', w: 296, h: 30 });
    mainLabel(slot, -34, -42, '每 5 级解锁阶段突破', { size: 17, color: SUB, align: 'left', w: 296, h: 26 });
    const action = gpanel(slot, 261, 0, 112, 48, lv >= MAX.skill ? '#B6B49C' : '#E8BA60', undefined, 0, 12);
    mainLabel(action, 0, 0, lv >= MAX.skill ? '满级' : '升级', { size: 22, color: INK, bold: true, w: 100, h: 32 });
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
  const W = 620, H = 830, PW = 560;   // PW：弹窗内奶白板/行动条宽；H 加高让标题/关闭上移、与头部拉开（用户确认）
  const panel = modal(ctx, W, H, '技能升级', true);
  /* 头部：无框圆图标 + 名称 + 等级变化（相对 H/2 下移，离开标题区） */
  const circ = gcircle(panel, -W / 2 + 66, H / 2 - 104, 44, CA('#2A3240', 1));
  const skFb = label(circ, 0, 0, slot === 'atk' ? '普攻' : slot === 'skill' ? '技能' : '大招', { size: 20, color: '#FFE08A', bold: true });
  artSprite(circ, 0, 0, 88, 88, skillIconId(hid, slot), { sliced: false, hideOnLoad: [skFb] });   // 铺满圆座
  label(panel, -W / 2 + 272, H / 2 - 96, skillName(hid, slot), { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 32, shrink: true });
  label(panel, -W / 2 + 272, H / 2 - 130, maxed ? `Lv.${lv}（MAX）` : `Lv.${lv} → Lv.${lv + 1}`, { size: 19, color: '#FFE08A', bold: true, align: 'left', w: 300, h: 30, shrink: true });
  /* 属性提升（奶白板 + 标题出板；行结构与页签一致） */
  const p1Top = H / 2 - 184;
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
    // 弓箭手每级+8%（5级档换成机制里程碑）；其余英雄每级+10%且每5级+15%
    const pct = (l: number): number => (hid === 'archer' || hid === 'sniper' || hid === 'volt' || hid === 'pyro' || hid === 'mora') ? (l - 1) * 8 : (l - 1) * 10 + btN(l, BT_STEP.skill) * 15;
    curS = `+${pct(lv)}%`;
    if (!maxed) delta = `→ +${pct(lv + 1)}%`;
  }
  label(p1, -PW / 2 + 90, 0, nm, { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
  label(p1, PW / 2 - 310, 0, curS, { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
  if (delta) label(p1, PW / 2 - 110, 0, delta, { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });
  /* 行动条（深色药丸 + 消耗 + 升级钮，与页签一致） */
  const actH = 64;
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, actH, CA('#14181E', 0.72), undefined, 0, 32);
  if (!maxed) {
    costChip(act, -175, 0, '🪙', cost.gold, sv.gold, 100);
    costChip(act, -30, 0, '🧱', cost.mat, matOwned(), 70);
    btn(act, 165, 0, 170, 54, '升 级', PAL.gold, () => {
      const r = upSkill(hid, slot);
      toast(r.msg);
      if (r.ok) { const d2 = panel.parent; if (d2) d2.destroy(); rebuild(); }
    }, 24, true);
    if (sv.gold >= cost.gold && matOwned() >= cost.mat) gpanel(act, 238, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);   // 红点=当前就能升
  } else {
    label(act, 0, 0, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
  /* 等级效果：阶段性突破步骤条（每5级一突破；弹窗内板宽 560） */
  fxStepper(panel, p1Top - p1H, actCy + actH / 2 + 14, '等级效果', skillMilestones(hid, slot), lv, PW);
}

/* ---------- 装备页签：双列强化卡，名称/等级/强化入口按行对齐 ---------- */
function tabEquips(parent: Node, ctx: PageCtx, hid: string, topY: number): void {
  const layout = mainLayout();
  const body = pageScroll(parent, 'equipTraining', LO.half - LO.safeTop - topY, layout.bottom, 468);
  sectionTitle(body, -16, '装备强化', '点击装备查看属性');
  WORN_4.forEach((kind, i) => {
    const inst = wornInst(hid, kind);
    const q = inst ? EQUIPS[inst.defId].quality : 0;
    const slot = gpanel(body, i % 2 === 0 ? -176 : 176, -(48 + Math.floor(i / 2) * 210 + 95), 334, 190,
      inst ? CA('#EADFBE', 0.98) : CA('#192C25', 0.94), undefined, 0, 18);
    if (inst) {
      const d = EQUIPS[inst.defId];
      gpanel(slot, -106, 24, 82, 82, CA(QCOLOR[d.quality], 0.55), undefined, 0, 12);
      const eqFb = mainLabel(slot, -106, 24, KIND_ICON[kind], { size: 36 });
      artSprite(slot, -106, 24, 72, 72, 'ui_item_' + inst.defId, { hideOnLoad: [eqFb] });
      mainLabel(slot, 44, 40, d.name, { size: 22, color: INK, bold: true, align: 'left', w: 180, h: 32, shrink: true });
      mainLabel(slot, 44, 1, `${d.tier}阶 · Lv.${inst.lv}`, { size: 22, color: QCARD[q], align: 'left', w: 180, h: 32 });
      const action = gpanel(slot, 0, -64, 294, 40, inst.lv >= MAX.equip ? '#B6B49C' : '#E8BA60', undefined, 0, 11);
      mainLabel(action, 0, 0, inst.lv >= MAX.equip ? '已满级' : '查看强化', { size: 19, color: INK, bold: true, w: 280, h: 30 });
    } else {
      mainLabel(slot, -106, 24, '+', { size: 42, color: '#637A66', bold: true });
      mainLabel(slot, 44, 40, KIND_NAME[kind], { size: 22, color: '#D9DFD4', bold: true, align: 'left', w: 180, h: 32 });
      mainLabel(slot, 44, 1, '未穿戴', { size: 20, color: '#9BAD98', align: 'left', w: 180, h: 30 });
      mainLabel(slot, 0, -64, '前往英雄页穿戴', { size: 18, color: '#9BAD98', w: 290, h: 30 });
    }
    slot.on(Node.EventType.TOUCH_END, () => {
      if (!inst) { toast('该槽位未穿戴 · 去英雄页装备'); return; }
      equipModal(ctx, hid, kind, () => ctx.refresh());
    });
  });
}

/** 装备强化弹窗（参照技能升级弹窗版式：扁平无框 + 奶白分区板 + 深色行动条；升级页装备卡 + 英雄页「锻造」共用） */
export function equipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  const sv = loadSave();
  const inst = wornInst(hid, kind)!;
  const d = EQUIPS[inst.defId];
  const maxed = inst.lv >= MAX.equip;
  const c = equipUpCost(inst.lv);
  /* 属性行：按部位词条几条算几行（用户确认的词条归属），行高随行数自适应 */
  const rows: { nm: string; cur: string; delta: string | null }[] = [];
  const keys = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] ?? 0) > 0);
  for (const k of keys) {
    const curV = equipStat(inst, k);
    const nextV = maxed ? curV : equipStat({ ...inst, lv: inst.lv + 1 }, k);
    rows.push({ nm: STAT_NAME[k], cur: statFmt(k, curV), delta: maxed ? null : `+${statFmt(k, nextV - curV)}` });
  }
  const W = 620, PW = 560;
  const p1H = 56 + rows.length * 32;   // 1 行 88 / 2 行 120
  const H = p1H + 424;                 // 头部 184 + 属性板 + 金签 44 + 每级板 88 + 行动条，随行数收紧
  const panel = modal(ctx, W, H, '装备强化', true);
  /* 头部：方形品质背板图标（无边框，同装备页签槽）+ 名称 + 品质/等级行（与技能弹窗同一几何） */
  gpanel(panel, -W / 2 + 66, H / 2 - 104, 88, 88, CA(QCOLOR[d.quality], 0.55), undefined, 0, 12);
  const hdFb = label(panel, -W / 2 + 66, H / 2 - 104, KIND_ICON[kind], { size: 40 });
  artSprite(panel, -W / 2 + 66, H / 2 - 104, 78, 78, 'ui_item_' + inst.defId, { hideOnLoad: [hdFb] });   // 装备切图，缺图回退 emoji
  label(panel, -W / 2 + 272, H / 2 - 96, d.name, { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 32, shrink: true });
  label(panel, -W / 2 + 272, H / 2 - 130, maxed ? `${QNAMES[d.quality]} · ${d.tier}阶 · Lv.${inst.lv}（MAX）` : `${QNAMES[d.quality]} · ${d.tier}阶 · 强化 Lv.${inst.lv} → Lv.${inst.lv + 1}`,
    { size: 18, color: '#FFE08A', bold: true, align: 'left', w: 310, h: 28, shrink: true });
  /* 属性提升（奶白板 + 标题出板；行结构与页签一致） */
  const p1Top = H / 2 - 184;
  const p1 = gpanel(panel, 0, p1Top - p1H / 2, PW, p1H, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p1Top + 17, '属性提升');
  rows.forEach((r, i) => {
    const y = (rows.length - 1) * 16 - i * 32;
    label(p1, -PW / 2 + 90, y, r.nm, { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
    label(p1, PW / 2 - 310, y, r.cur, { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
    if (r.delta) label(p1, PW / 2 - 110, y, r.delta, { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });
  });
  /* 每级提升（奶白板；先下移 44 给金签出板空间——与 fxStepper 同规） */
  const p2Top = p1Top - p1H - 44;
  const p2 = gpanel(panel, 0, p2Top - 44, PW, 88, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p2Top + 17, '每级提升');
  label(p2, -100, 16, '主属性 +4% / 级', { size: 20, color: INK, bold: true, align: 'left', w: 340, h: 30, shrink: true });
  label(p2, -100, -16, '材料 每7级需求 +1', { size: 20, color: INK, bold: true, align: 'left', w: 340, h: 30, shrink: true });
  /* 行动条（深色药丸 + 双消耗 + 强化钮；双 chip 拉开间距防重叠——用户反馈） */
  const actH = 64;
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, actH, CA('#14181E', 0.72), undefined, 0, 32);
  if (!maxed) {
    costChip(act, -212, 0, '🪙', c.gold, sv.gold, 100);
    costChip(act, -30, 0, '🧱', c.mat, matOwned(), 70);
    btn(act, 195, 0, 160, 54, '强 化', PAL.gold, () => {
      const r = upWornEquip(hid, kind);
      toast(r.msg);
      if (r.ok) { const p2 = panel.parent; if (p2) p2.destroy(); rebuild(); }
    }, 24, true);
    if (sv.gold >= c.gold && matOwned() >= c.mat) gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);   // 红点=当前就能升
  } else {
    label(act, 0, 0, '已达强化上限', { size: 22, color: '#AAB2BD' });
  }
}
