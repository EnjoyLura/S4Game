/** Four training views share the smithy, hero portraits, category strip and pinned action. */
import { Graphics, Node, UIOpacity, Vec3 } from 'cc';
import { LO } from '../config/GameConfig';
import { C, CA, gcircle, gpanel, N, WY } from './UIKit';
import { artAtlasSprite, artSprite } from './Ux';
import { mainLabel, PageCtx, mainLayout, mainResourceTop, MAIN_RESOURCE_H, heroFigure, modal, pageScroll, fmt, toast } from './PageKit';
import { loadSave, saveSave } from '../core/SaveData';
import {
  HERO_DEFS, EQUIPS, EquipKind, KIND_NAME, QCOLOR, MAX, StatKey, STAT_NAME,
  heroStats, heroUpCost, weaponUpCost, skillUpCost, equipUpCost, equipStat, statFmt,
  matCount, wornInst, upHero, upWeapon, upSkill, upWornEquip,
} from '../core/GameData';

type SkillSlot = 'atk' | 'skill' | 'ult';
type WornKind = Exclude<EquipKind, 'weapon'>;
type Milestone = { lv: number; txt: string };
type Stats = { atk: number; skillDmg: number };
export interface TrainingData {
  statsAt: (hid: string, lv: number, weaponLv: number, skillLv?: number) => Stats;
  heroMilestones: (hid: string) => Milestone[];
  weaponMilestones: () => Milestone[];
  skillMilestones: (hid: string, slot: SkillSlot) => Milestone[];
  skillName: (hid: string, slot: SkillSlot) => string;
  skillIconId: (hid: string, slot: SkillSlot) => string;
  onAttrs: (hid: string) => void;
}
const st = {
  tab: 0,
  skills: {} as Record<string, SkillSlot>,
  equips: {} as Record<string, WornKind>,
  milestones: {} as Record<string, number>,
};
const INK = '#493017', GREEN = '#39772B', CREAM = '#FFE8B2';
const SKILLS: SkillSlot[] = ['atk', 'skill', 'ult'];
const WORN: WornKind[] = ['helm', 'acc', 'glove', 'armor'];
const SLOT_KEY = { atk: 'atkLv', skill: 'skillLv', ult: 'ultLv' } as const;
const QUALITY = ['普通', '优秀', '稀有', '史诗'];
const KIND_ART: Record<WornKind, string> = {
  helm: 'ui_item_helm_falcon', acc: 'ui_item_acc_moon', glove: 'ui_item_glove_wind', armor: 'ui_item_armor_forest',
};
const TAB_ICONS = ['ui_nav_upgrade', 'ui_item_wpn_bow', 'ui_icon_skill_archer', 'ui_icon_equip'];

/** Carved wood or beveled gold, rather than independent rounded dashboard cards. */
function plaque(parent: Node, x: number, y: number, w: number, h: number, gold = false, muted = false): Node {
  const node = N('trainingPlaque', parent, x, y, w, h);
  const g = node.addComponent(Graphics);
  const shape = (inset: number, dy = 0): void => {
    const l = -w / 2 + inset, r = w / 2 - inset, b = -h / 2 + inset + dy, t = h / 2 - inset + dy;
    const bevel = Math.min(14, h * 0.16);
    g.moveTo(l + bevel, t); g.lineTo(r - bevel, t); g.lineTo(r, t - bevel);
    g.lineTo(r, b + bevel); g.lineTo(r - bevel, b); g.lineTo(l + bevel, b);
    g.lineTo(l, b + bevel); g.lineTo(l, t - bevel); g.close();
  };
  g.fillColor = CA('#120D08', 0.7); shape(0, -4); g.fill();
  g.fillColor = C(gold ? '#8D5412' : '#27190F'); shape(0); g.fill();
  g.fillColor = C(gold ? '#DB9B29' : '#82603C'); shape(2); g.fill();
  g.fillColor = C(gold ? muted ? '#BCA16B' : '#FFD05B' : '#49311F'); shape(5); g.fill();
  g.strokeColor = CA(gold ? '#FFF0A5' : '#D0A565', gold ? 0.9 : 0.6); g.lineWidth = 1.5; shape(6); g.stroke();
  g.strokeColor = CA(gold ? '#FFF5BF' : '#AE8658', gold ? 0.2 : 0.12); g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = -h * 0.24 + i * h * 0.16;
    g.moveTo(-w / 2 + 18, yy); g.lineTo(-w * 0.1, yy + 2); g.lineTo(w / 2 - 18, yy); g.stroke();
  }
  return node;
}

function tap(node: Node, cb: () => void): void {
  node.on(Node.EventType.TOUCH_START, () => node.setScale(0.97, 0.97, 1));
  node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(Vec3.ONE));
  node.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    node.setScale(Vec3.ONE);
    if (e) e.propagationStopped = true;
    cb();
  });
}

function roster(parent: Node, top: number, hid: string, rebuild: () => void): void {
  const sv = loadSave();
  Object.values(HERO_DEFS).forEach((def, i) => {
    const active = hid === def.id, owned = sv.heroes[def.id].owned;
    const slot = plaque(parent, (i - 2) * 138, WY(top, 108), 126, 108, active);
    const portrait = gpanel(slot, 0, 10, 110, 78, active ? '#425A28' : '#251D16', undefined, 0, 5);
    const avatar = artSprite(portrait, 0, 0, 80, 80, def.avatar, { sliced: false });
    if (!owned) {
      avatar.addComponent(UIOpacity).opacity = 100;
      artSprite(slot, 41, -9, 23, 26, 'ui_icon_lock');
    }
    mainLabel(slot, 0, -38, def.id === 'pyro' ? def.name.replace('·', '') : def.name.split('·')[0], {
      size: 21, bold: true, color: active ? INK : owned ? CREAM : '#A6967D', w: 110, h: 28,
    });
    tap(slot, () => {
      if (!owned) { toast('前往商店解锁该英雄'); return; }
      if (hid === def.id) return;
      sv.curHero = def.id; saveSave(); rebuild();
    });
  });
}

function categoryStrip(parent: Node, top: number, rebuild: () => void): void {
  const bar = plaque(parent, 0, WY(top, 66), 702, 66);
  ['等级', '武器', '技能', '装备'].forEach((name, i) => {
    const active = st.tab === i;
    const slot = plaque(bar, (i - 1.5) * 172, 0, 174, 62, active);
    artSprite(slot, -49, 0, 38, 40, TAB_ICONS[i], { sliced: false });
    mainLabel(slot, 21, 0, name, { size: 28, bold: true, color: active ? INK : CREAM, w: 83, h: 40,
      outline: active ? undefined : '#251A0E', outlineW: 1.5 });
    tap(slot, () => { if (st.tab !== i) { st.tab = i; rebuild(); } });
  });
}

function context(parent: Node, top: number, hid: string, data: TrainingData): void {
  const h = loadSave().heroes[hid], def = HERO_DEFS[hid];
  const level = st.tab === 0;
  const p = plaque(parent, level ? -169 : -73, WY(top, 74), level ? 340 : 538, 74);
  mainLabel(p, level ? 0 : -89, 15, def.name, { size: 29, font: 'title', color: CREAM, bold: true, w: 310, h: 38, align: level ? 'center' : 'left', outline: '#21170E', outlineW: 1.5 });
  mainLabel(p, level ? 0 : -88, -18, `Lv.${h.lv} · ${def.job.split(' · ')[0]}`, { size: 20, color: '#DEC39B', w: 310, h: 28, align: level ? 'center' : 'left' });
  if (!level) mainLabel(p, 169, 0, `战力\n${fmt(heroStats(hid).power)}`, { size: 22, color: '#FFD16B', bold: true, w: 126, h: 60, lineHeight: 27 });
  const attrs = plaque(parent, 270, WY(top + 10, 52), 140, 52);
  mainLabel(attrs, 0, 0, 'ⓘ 属性', { size: 24, color: CREAM, bold: true, w: 120, h: 36 });
  tap(attrs, () => data.onAttrs(hid));
}

function parchment(parent: Node, x: number, y: number, w: number, h: number): Node {
  const paper = N('upgradeParchment', parent, x, y, w, h);
  const fallback = gpanel(paper, 0, 0, w - 22, h - 28, '#EFDCAD', undefined, 0, 10);
  artAtlasSprite(paper, 0, 0, w, h, 'lobby_training_v1', 'parchment', {
    sliceBorder: 0.16, sliceScale: 0.85, hideOnLoad: [fallback],
  });
  return paper;
}

function rule(parent: Node, y: number, width: number): void {
  const g = N('etchedRule', parent, 0, y).addComponent(Graphics);
  g.strokeColor = CA('#9D6B30', 0.55); g.lineWidth = 1.5;
  g.moveTo(-width / 2, 0); g.lineTo(-9, 0); g.moveTo(9, 0); g.lineTo(width / 2, 0); g.stroke();
  g.moveTo(0, 4); g.lineTo(5, 0); g.lineTo(0, -4); g.lineTo(-5, 0); g.close(); g.stroke();
}

type PreviewRow = { name: string; cur: string; next: string; gain: string };
function preview(parent: Node, x: number, y: number, w: number, h: number, title: string,
  lv: number, maxed: boolean, rows: PreviewRow[], portrait = false, note = ''): void {
  const p = parchment(parent, x, y, w, h);
  mainLabel(p, 0, h / 2 - 43, title, { size: portrait ? 29 : 27, font: 'title', bold: true, color: INK, w: w - 68, h: 38 });
  const levelY = h / 2 - (portrait ? 106 : 83);
  mainLabel(p, -w * 0.17, levelY, `Lv.${lv}`, { size: portrait ? 30 : 27, bold: true, color: INK, w: w * 0.32, h: 44 });
  mainLabel(p, 0, levelY, maxed ? '·' : '➜', { size: 27, color: '#997034', w: 36, h: 40 });
  mainLabel(p, w * 0.17, levelY, maxed ? 'MAX' : `Lv.${lv + 1}`, { size: portrait ? 30 : 27, bold: true, color: GREEN, w: w * 0.32, h: 44 });
  rule(p, levelY - 32, w - 76);
  if (portrait) {
    const rowStep = Math.min(112, (h - 172) / Math.max(1, rows.length));
    rows.forEach((r, i) => {
      const yy = levelY - 74 - i * rowStep;
      mainLabel(p, 0, yy, r.name, { size: 24, color: INK, bold: true, w: w - 60, h: 34 });
      mainLabel(p, -w * 0.17, yy - 38, r.cur, { size: 25, color: INK, bold: true, w: w * 0.31, h: 32 });
      mainLabel(p, 0, yy - 38, '→', { size: 22, color: '#A17B43', w: 30, h: 32 });
      mainLabel(p, w * 0.18, yy - 38, r.next, { size: 25, color: GREEN, bold: true, w: w * 0.31, h: 32 });
      mainLabel(p, 0, yy - 68, maxed ? '已达上限' : r.gain, { size: 21, color: GREEN, w: w - 60, h: 28 });
    });
  } else {
    rows.forEach((r, i) => {
      const yy = levelY - 69 - i * 38;
      mainLabel(p, -w * 0.29, yy, r.name, { size: 23, color: INK, bold: true, w: w * 0.27, h: 32, align: 'left' });
      mainLabel(p, -w * 0.025, yy, `${r.cur} → ${r.next}`, { size: 25, color: INK, bold: true, w: w * 0.4, h: 34 });
      mainLabel(p, w * 0.31, yy, maxed ? 'MAX' : r.gain, { size: 23, color: GREEN, bold: true, w: w * 0.18, h: 32 });
    });
    if (note) mainLabel(p, 0, -h / 2 + 34, note, { size: 19, color: '#886541', w: w - 76, h: 28 });
  }
}

function comparison(cur: Stats, next: Stats): PreviewRow[] {
  return [['攻击力', 'atk'], ['技能伤害', 'skillDmg']].map(([name, key]) => ({
    name, cur: fmt(cur[key]), next: fmt(next[key]), gain: `+${fmt(next[key] - cur[key])}`,
  }));
}

function milestoneShelf(parent: Node, ctx: PageCtx, y: number, title: string, ms: Milestone[], lv: number,
  stateKey: string, icon: string, rebuild: () => void): void {
  const height = 222;
  const shelf = N('trainingMilestones', parent, 0, y, 700, height);
  const fallback = plaque(shelf, 0, 0, 696, height);
  artAtlasSprite(shelf, 0, 0, 700, height, 'lobby_rewards_v1', 'shelf', { fit: false, hideOnLoad: [fallback] });
  mainLabel(shelf, 0, 84, title, { size: 30, font: 'title', color: CREAM, bold: true, w: 330, h: 40, outline: '#24190F', outlineW: 2 });
  const upcoming = ms.findIndex(m => m.lv > lv);
  const nextIndex = upcoming < 0 ? ms.length : upcoming;
  const defaultStart = Math.min(nextIndex, Math.max(0, ms.length - 3));
  const start = Math.min(Math.max(0, st.milestones[stateKey] ?? defaultStart), Math.max(0, ms.length - 3));
  const line = N('milestoneLine', shelf).addComponent(Graphics);
  line.strokeColor = C('#8A734F'); line.lineWidth = 5; line.moveTo(-205, 18); line.lineTo(205, 18); line.stroke();
  ms.slice(start, start + 3).forEach((m, i) => {
    const reached = lv >= m.lv, target = start + i === nextIndex;
    const node = N('milestone' + m.lv, shelf, (i - 1) * 205, 0, 184, 174);
    gcircle(node, 0, 18, 44, C('#241E15'), target ? '#FFD568' : '#A28C65', target ? 4 : 2);
    gcircle(node, 0, 18, 37, C(reached ? '#405632' : target ? '#7E541B' : '#453F33'));
    const art = artSprite(node, 0, 18, 57, 57, icon, { sliced: false });
    if (!reached && !target) art.addComponent(UIOpacity).opacity = 100;
    if (reached) mainLabel(node, 31, -4, '✓', { size: 24, color: '#ACDD78', bold: true, w: 36, h: 32, outline: '#1D2B11', outlineW: 2 });
    else if (!target) artSprite(node, 27, -6, 20, 24, 'ui_icon_lock');
    mainLabel(node, 0, -39, `${m.lv}级`, { size: 23, color: target ? '#FFDB80' : CREAM, bold: true, w: 170, h: 30, outline: '#231B12', outlineW: 2 });
    mainLabel(node, 0, -72, m.txt.replace(/^突破 · /, ''), { size: 19, color: target ? '#FFE19A' : reached ? '#D7DCA9' : '#BCAC90', w: 178, h: 48, lineHeight: 23, outline: '#241C12', outlineW: 1 });
    if (target) {
      const badge = plaque(node, 0, -102, 164, 25, true);
      mainLabel(badge, 0, 0, '下一级突破', { size: 17, color: INK, bold: true, w: 150, h: 23 });
    }
    tap(node, () => {
      const p = modal(ctx, 560, 310, `${title} · ${m.lv}级`, true);
      mainLabel(p, 0, 22, m.txt.replace(/^突破 · /, ''), { size: 27, color: CREAM, bold: true, w: 480, h: 94, lineHeight: 34 });
      mainLabel(p, 0, -81, reached ? '已解锁 · 效果已生效' : `达到${m.lv}级自动解锁`, { size: 23, color: reached ? '#A8D57B' : '#D8BA85', w: 480, h: 38 });
    });
  });
  for (const dir of [-1, 1]) {
    const enabled = dir < 0 ? start > 0 : start + 3 < ms.length;
    if (!enabled) continue;
    const arrow = N('milestonePage', shelf, dir * 323, 15, 52, 92);
    mainLabel(arrow, 0, 0, dir < 0 ? '❮' : '❯', { size: 33, color: '#FFCF68', w: 46, h: 62, outline: '#41290D', outlineW: 2 });
    tap(arrow, () => { st.milestones[stateKey] = start + dir; rebuild(); });
  }
}

function footer(parent: Node, ctx: PageCtx, top: number, text: string, icon: string,
  cost: { gold: number; mat: number } | null, maxed: boolean, action: () => { ok: boolean; msg: string }, empty = false): void {
  const sv = loadSave(), ownMat = matCount('mat_stone') + matCount('mat_iron');
  const enough = !!cost && sv.gold >= cost.gold && ownMat >= cost.mat;
  const costRow = plaque(parent, 0, WY(top, 62), 650, 62);
  if (cost && !maxed && !empty) {
    const entries = cost.mat ? [
      { icon: 'ui_icon_coin', need: cost.gold, own: sv.gold },
      { icon: 'ui_item_mat_stone', need: cost.mat, own: ownMat },
    ] : [{ icon: 'ui_icon_coin', need: cost.gold, own: sv.gold }];
    entries.forEach((r, i) => {
      const x = entries.length === 1 ? -8 : (i - 0.5) * 302;
      artSprite(costRow, x - 89, 0, 43, 43, r.icon, { sliced: false });
      mainLabel(costRow, x - 8, 10, fmt(r.need), { size: 27, bold: true, color: r.own >= r.need ? CREAM : '#FF9C7D', w: 104, h: 32, align: 'left' });
      mainLabel(costRow, x + 4, -17, `持有 ${fmt(r.own)}`, { size: 17, color: '#C9AB7C', w: 128, h: 24, align: 'left' });
    });
  } else {
    mainLabel(costRow, 0, 0, empty ? '前往英雄页穿戴装备后强化' : '已达到当前等级上限', { size: 23, color: '#DBC7A0', w: 600, h: 38 });
  }
  const button = plaque(parent, 0, WY(top + 74, 92), 650, 92, true, maxed || empty || !enough);
  artSprite(button, -160, 0, 52, 58, icon, { sliced: false });
  mainLabel(button, 30, 0, empty ? '未穿戴装备' : maxed ? '已满级' : text, { size: 37, font: 'title', bold: true, color: '#41290D', w: 330, h: 60 });
  tap(button, () => {
    if (empty || maxed) return;
    const r = action(); toast(r.msg);
    if (r.ok) ctx.refresh();
  });
}

export function buildTrainingLobby(ctx: PageCtx, data: TrainingData): void {
  const root = N('trainingLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  function render(): void {
    root.destroyAllChildren();
    const sv = loadSave(), hid = sv.curHero, h = sv.heroes[hid], def = HERO_DEFS[hid];
    const rosterTop = mainResourceTop() + MAIN_RESOURCE_H + 20;
    const tabTop = rosterTop + 126, contextTop = tabTop + 82;
    const bodyTop = contextTop + 88, footerTop = mainLayout().bottom - 166;
    const available = Math.max(1, footerTop - 16 - bodyTop);
    const minHeight = st.tab < 2 ? 676 : st.tab === 2 ? 694 : 670;
    const height = Math.max(minHeight, available);
    roster(root, rosterTop, hid, render);
    categoryStrip(root, tabTop, render);
    context(root, contextTop, hid, data);
    const body = pageScroll(root, 'trainingBody', bodyTop, footerTop - 16, height, 718);
    if (height > available) mainLabel(root, 340, WY(footerTop - 34), '⌄', { size: 21, color: '#D3B682', w: 30, h: 26 });

    if (st.tab < 2) {
      const weapon = st.tab === 1, lv = weapon ? h.weaponLv : h.lv;
      const maxed = lv >= (weapon ? MAX.weapon : MAX.hero);
      const cur = data.statsAt(hid, h.lv, h.weaponLv);
      const next = maxed ? cur : data.statsAt(hid, h.lv + (weapon ? 0 : 1), h.weaponLv + (weapon ? 1 : 0));
      const stageH = height - 238;
      const stage = N('trainingDisplay', body, 0, -stageH / 2, 710, stageH);
      if (weapon) {
        const title = plaque(stage, -174, stageH / 2 - 28, 322, 49);
        mainLabel(title, 0, 0, def.weaponName, { size: 27, color: CREAM, font: 'title', bold: true, w: 284, h: 34 });
        const rackH = stageH - 60;
        artAtlasSprite(stage, -173, -stageH / 2 + rackH / 2 + 5, 345, rackH, 'lobby_training_v1', 'weapon_rack', { fit: false });
        artAtlasSprite(stage, -173, -stageH / 2 + rackH / 2 + 21, 315, rackH - 48, 'lobby_weapons_v1', hid);
      } else {
        const foot = -stageH / 2 + 66;
        artAtlasSprite(stage, -169, foot - 19, 350, 118, 'lobby_training_v1', 'dais', { fit: false });
        heroFigure(stage, hid, -169, foot, stageH - 80, { lobby: true, maxWidth: 328 });
        const power = plaque(stage, -169, foot - 43, 252, 45);
        mainLabel(power, 0, 0, `战力 ${fmt(heroStats(hid).power)}`, { size: 25, bold: true, color: '#FFE38F', w: 230, h: 33 });
      }
      const paperH = Math.min(stageH - 14, 476);
      preview(stage, 185, -stageH / 2 + paperH / 2 + 6, 316, paperH, weapon ? '强化提升' : '升级提升', lv, maxed, comparison(cur, next), true);
      milestoneShelf(body, ctx, -(stageH + 127), weapon ? '武器突破' : '等级突破',
        weapon ? data.weaponMilestones() : data.heroMilestones(hid), lv, hid + ':' + st.tab,
        weapon ? 'ui_item_wpn_bow' : 'ui_nav_upgrade', render);
      footer(root, ctx, footerTop, weapon ? '强化武器' : '升级英雄', weapon ? 'ui_item_wpn_bow' : 'ui_nav_upgrade',
        weapon ? weaponUpCost(lv) : { gold: heroUpCost(lv), mat: 0 }, maxed, () => weapon ? upWeapon(hid) : upHero(hid));
    } else if (st.tab === 2) {
      const selected = st.skills[hid] ?? 'skill';
      const shelfH = Math.min(248, height - 470);
      const shelf = plaque(body, 0, -shelfH / 2, 690, shelfH);
      const diameter = Math.min(150, shelfH - 66);
      SKILLS.forEach((slot, i) => {
        const active = selected === slot;
        const choice = N('skillChoice:' + slot, shelf, (i - 1) * 221, 0, 208, shelfH - 4);
        const cy = shelfH / 2 - diameter / 2 - 10;
        gcircle(choice, 0, cy, diameter / 2, C('#20190F'), active ? '#FFDE80' : '#A18454', active ? 4 : 2);
        artSprite(choice, 0, cy, diameter - 8, diameter - 8, data.skillIconId(hid, slot), { sliced: false });
        mainLabel(choice, 0, -shelfH / 2 + 45, data.skillName(hid, slot), { size: 24, color: active ? '#FFE29B' : '#DEC5A0', bold: true, w: 194, h: 33 });
        mainLabel(choice, 0, -shelfH / 2 + 17, `Lv.${h[SLOT_KEY[slot]]}`, { size: 20, color: active ? '#FFD373' : '#B69C74', w: 180, h: 26 });
        tap(choice, () => { if (selected !== slot) { st.skills[hid] = slot; render(); } });
      });
      const lv = h[SLOT_KEY[selected]], maxed = lv >= MAX.skill;
      let rows: PreviewRow[];
      if (selected === 'skill') {
        const cur = data.statsAt(hid, h.lv, h.weaponLv, lv), next = maxed ? cur : data.statsAt(hid, h.lv, h.weaponLv, lv + 1);
        rows = [{ name: '技能伤害', cur: fmt(cur.skillDmg), next: fmt(next.skillDmg), gain: `+${fmt(next.skillDmg - cur.skillDmg)}` }];
      } else {
        const pct = (l: number): number => (l - 1) * 8;
        rows = [{ name: selected === 'atk' ? '普攻伤害加成' : '大招伤害加成', cur: `+${pct(lv)}%`, next: `+${pct(maxed ? lv : lv + 1)}%`, gain: maxed ? '+0%' : '+8%' }];
      }
      const paperH = height - shelfH - 250;
      preview(body, 0, -(shelfH + 12 + paperH / 2), 684, paperH, data.skillName(hid, selected), lv, maxed, rows, false, '每5级自动解锁阶段突破');
      milestoneShelf(body, ctx, -(height - 111), '技能突破', data.skillMilestones(hid, selected), lv,
        hid + ':skill:' + selected, data.skillIconId(hid, selected), render);
      footer(root, ctx, footerTop, '升级技能', data.skillIconId(hid, selected), skillUpCost(lv), maxed, () => upSkill(hid, selected));
    } else {
      const selected = st.equips[hid] ?? WORN.find(kind => !!wornInst(hid, kind)) ?? 'helm';
      const rackH = Math.min(564, height - 262);
      const cabinet = N('equippedCabinet', body, 0, -rackH / 2, 644, rackH);
      artAtlasSprite(cabinet, 0, 0, 644, rackH, 'lobby_training_v1', 'equipment_rack', { fit: false });
      const heading = plaque(cabinet, 0, rackH / 2 - 20, 300, 41);
      mainLabel(heading, 0, 0, '已穿戴装备', { size: 25, font: 'title', bold: true, color: CREAM, w: 270, h: 33 });
      WORN.forEach((kind, i) => {
        const inst = wornInst(hid, kind), d = inst ? EQUIPS[inst.defId] : null, active = selected === kind;
        const cellH = rackH * 0.33;
        const choice = N('wornChoice:' + kind, cabinet, i % 2 === 0 ? -111 : 99,
          i < 2 ? rackH * 0.177 : -rackH * 0.211, 195, cellH);
        const seat = gpanel(choice, 0, 0, 191, cellH - 4, CA(d ? QCOLOR[d.quality] : '#796A55', 0.12), active ? '#FFDA75' : CA(d ? QCOLOR[d.quality] : '#917E60', 0.6), active ? 3 : 1, 6);
        const iconH = Math.min(119, cellH - 52);
        const item = artSprite(seat, 0, 22, iconH + 15, iconH, inst ? 'ui_item_' + inst.defId : KIND_ART[kind], { sliced: false });
        if (!inst) item.addComponent(UIOpacity).opacity = 65;
        mainLabel(seat, 0, -cellH / 2 + 36, d ? d.name : KIND_NAME[kind], { size: 22, color: active ? '#FFE19B' : '#E9D0A5', bold: true, w: 180, h: 29, outline: '#20170F', outlineW: 1.5 });
        mainLabel(seat, 0, -cellH / 2 + 12, d ? `${QUALITY[d.quality]} · ${d.tier}阶 · Lv.${inst!.lv}` : '未穿戴', { size: 17, color: d ? '#CFBB99' : '#9D8D73', w: 180, h: 23, outline: '#21190F', outlineW: 1 });
        tap(choice, () => { if (selected !== kind) { st.equips[hid] = kind; render(); } });
      });
      const inst = wornInst(hid, selected), d = inst ? EQUIPS[inst.defId] : null;
      const maxed = !!inst && inst.lv >= MAX.equip;
      const paperH = height - rackH - 16;
      if (inst && d) {
        const rows = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] ?? 0) > 0).map(k => {
          const cur = equipStat(inst, k), next = maxed ? cur : equipStat({ ...inst, lv: inst.lv + 1 }, k);
          return { name: STAT_NAME[k], cur: statFmt(k, cur), next: statFmt(k, next), gain: '+' + statFmt(k, next - cur) };
        });
        preview(body, 0, -(rackH + 16 + paperH / 2), 684, paperH, d.name + ' · 强化提升', inst.lv, maxed, rows, false, '主属性 +4% / 级');
      } else {
        const paper = parchment(body, 0, -(rackH + 16 + paperH / 2), 684, paperH);
        mainLabel(paper, 0, 37, KIND_NAME[selected] + ' · 未穿戴', { size: 29, font: 'title', bold: true, color: INK, w: 580, h: 44 });
        mainLabel(paper, 0, -28, '前往英雄页，从背包选择装备穿戴', { size: 24, color: '#8A6740', w: 570, h: 64 });
      }
      footer(root, ctx, footerTop, '强化装备', inst ? 'ui_item_' + inst.defId : KIND_ART[selected],
        inst ? equipUpCost(inst.lv) : null, maxed, () => upWornEquip(hid, selected), !inst);
    }
  }
  render();
}
