/**
 * ④ 升级：四页共用铁匠铺培养界面；保留英雄/基地调用的装备强化弹窗。
 */
import { Node } from 'cc';
import { PAL } from '../../config/GameConfig';
import { CA, btn, gcircle, gpanel, label } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, fmt } from '../PageKit';
import { buildTrainingLobby } from '../TrainingLobby';
import { attrsModal } from './HeroPage';
import {
  EquipKind, HERO_DEFS, EQUIPS, QCOLOR, MAX,
  equipUpCost,
  upWornEquip, wornInst, equipStat, statFmt, STAT_NAME, StatKey, matCount,
  BT_STEP, BT_WPN, BT_SKL, heroBtList, heroStatsAt,
} from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { growthAction } from '../GrowthFeedback';

const KIND_ICON: Record<string, string> = { weapon: '🏹', helm: '⛑️', acc: '📿', glove: '🧤', armor: '🥼' };
const QNAMES = ['普通', '优秀', '稀有', '史诗'];

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
const OK = '#3E7C28';
const NO = '#B03A2E';

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
    { lv: 10, txt: '领域范围 +20%' },
    { lv: 15, txt: '冻结时间 +0.3s' },
    { lv: 20, txt: '倍率 2.0→2.3' },
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

/** 升级预览直接复用两项基础属性，避免与战斗成长产生偏差。 */
function statsAt(hid: string, lv: number, wpnLv: number): { atk: number; skillDmg: number } {
  return heroStatsAt(hid, lv, wpnLv);
}

/** 持有材料总数（强化消耗聚合扣强化石→精铁） */
function matOwned(): number { return matCount('mat_stone') + matCount('mat_iron'); }

export function buildUpgrade(ctx: PageCtx): void {
  buildTrainingLobby(ctx, {
    statsAt, heroMilestones, weaponMilestones, skillMilestones, skillName, skillIconId,
    onAttrs: hid => attrsModal(ctx, hid),
  });
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
      const r = growthAction({ kind: 'equip', hid, slot: kind }, () => upWornEquip(hid, kind));
      if (r.ok) { const p2 = panel.parent; if (p2) p2.destroy(); rebuild(); }
    }, 24, true);
    if (sv.gold >= c.gold && matOwned() >= c.mat) gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);   // 红点=当前就能升
  } else {
    label(act, 0, 0, '已达强化上限', { size: 22, color: '#AAB2BD' });
  }
}
