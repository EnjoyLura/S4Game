/** Shared comic training views. Growth remains in GameData; battle unlocks remain run-local. */
import { Graphics, Label, Mask, Node, ScrollView, Sprite, UITransform, UIOpacity, Vec2 } from 'cc';
import { LO } from '../config/GameConfig';
import { skillBaseMultiplier } from '../config/Cards';
import { newHeroNormalCfg, cannonUltCfg, siphonUltCfg } from '../config/NewHeroConfig';
import { windUltCfg, ninjaUltCfg } from '../config/WindNinjaConfig';
import { C, CA, LabelOpts, N, setText, WY } from './UIKit';
import { artSprite } from './Ux';
import { COMIC, comicArt, comicButton, comicButtonControl, comicMark, comicPlate, comicSurface } from './ComicUI';
import { EMPTY_GEAR, gearArt, heroComicFigure, heroGlyph } from './HeroComic';
import { mainLabel as pageLabel, PageCtx, mainLayout, mainResourceTop, MAIN_RESOURCE_H, pageScroll, fmt, toast } from './PageKit';
import { loadSave, saveSave } from '../core/SaveData';
import { finishUpgradeLesson, pendingUpgradeLesson } from '../core/SecondJourney';
import { flow } from '../core/Flow';
import { tutorialFocus } from './TutorialFocus';
import { whenUIArtReady } from './UIArtReady';
import { bindButton } from './ButtonFeedback';
import { refreshUI } from './UIMotion';
import { MilestoneSwipe } from './MilestoneSwipe';
import { TrainingWeaponFloat } from './TrainingWeaponFloat';
import { HoldUpgrade } from './HoldUpgrade';
import { TrainingGrowthFx } from './TrainingGrowthFx';
import { TrainingResultPulse } from './TrainingResultPulse';
import { feedbackSurface } from './FeedbackSurface';
import { uiSound } from './UIAudio';
import { heroRosterRail } from './HeroRosterRail';
import { GrowthTarget, growthAction } from './GrowthFeedback';
import { heroLobbyPortrait } from './HeroChrome';
import { lobbyAttributeWell, shopQualitySocket } from './LobbyChrome';
import { DETAIL_ACTION_FOOTER, detailBody, detailDialog, detailFooter, detailGroup,
  detailGroupHeight, detailHeight, detailOverview } from './DetailDialog';
import { TRAINING_INK, TRAINING_SUB, trainingCard, trainingPaper, trainingRule } from './TrainingChrome';
import {
  HERO_DEFS, HERO_GROWTH, EQUIPS, EquipKind, KIND_NAME, MAX, OpResult, StatKey, STAT_NAME,
  heroStats, heroUpCost, weaponUpCost, skillUpCost, equipUpCost, equipStat, statFmt,
  matCount, wornInst, upHero, upWeapon, upSkill, upWornEquip, equippedWeapon,
} from '../core/GameData';

type SkillSlot = 'atk' | 'skill' | 'ult';
type WornKind = Exclude<EquipKind, 'weapon'>;
type Milestone = { lv: number; txt: string };
type Stats = { atk: number; skillDmg: number };
export interface TrainingData {
  statsAt: (hid: string, lv: number, weaponLv: number, skillLv?: number) => Stats;
  heroMilestones: (hid: string) => Milestone[];
  weaponMilestones: (hid: string) => Milestone[];
  skillMilestones: (hid: string, slot: SkillSlot) => Milestone[];
  skillName: (hid: string, slot: SkillSlot) => string;
  skillIconId: (hid: string, slot: SkillSlot) => string;
  onAttrs: (hid: string) => void;
}
const st = {
  tab: 0, skills: {} as Record<string, SkillSlot>, equips: {} as Record<string, WornKind>,
  milestones: {} as Record<string, number>, offsets: {} as Record<string, number>,
};
const HAMMER = 'upgrade_comic_v1/comic_training_hammer_v1';
const TAB_ART = [HAMMER, 'comic_wpn_bow_v1', 'hero_comic_v2/comic_story_v2', 'comic_armor_forest_v1'];
const SKILLS: SkillSlot[] = ['atk', 'skill', 'ult'];
const WORN: WornKind[] = ['helm', 'acc', 'glove', 'armor'];
const SLOT_KEY = { atk: 'atkLv', skill: 'skillLv', ult: 'ultLv' } as const;
const QUALITY = ['普通', '优秀', '稀有', '史诗'];

function mainLabel(parent: Node, x: number, y: number, text: string, opts: LabelOpts = {}): Node {
  return pageLabel(parent, x, y, text, { font: 'body', ...opts });
}

function tap(node: Node, cb: () => void): void {
  bindButton(node, cb, { scale: .98 });
}

/** Crop against the actual illustrated platform, rather than guessing a character position. */
function environment(parent: Node, height: number, display: boolean): Node {
  const upper = N('trainingUpperScene', parent, 0, WY(0, height), 750, height);
  const footX = -176, footY = -height / 2 + 72;
  if (display) N('trainingPlatformAnchor', upper, footX, footY);
  artSprite(upper, 0, 0, 750, height, 'scenes/bg_upgrade_comic_v1', {
    sliced: false, cover: true, onLoaded: art => {
      const rect = art.getComponent(Sprite)!.spriteFrame!.rect;
      let w: number, h: number;
      if (display) {
        const u = .335, v = .714, px = footX + 375, py = height - 72;
        const k = Math.max(px / (rect.width * u), (750 - px) / (rect.width * (1 - u)),
          py / (rect.height * v), 72 / (rect.height * (1 - v)));
        w = rect.width * k; h = rect.height * k;
        art.getComponent(UITransform)!.setContentSize(w, h);
        art.setPosition(footX + w * (.5 - u), footY + h * (v - .5), 0);
      } else {
        const k = Math.max(750 / rect.width, height / rect.height);
        w = rect.width * k; h = rect.height * k;
        art.getComponent(UITransform)!.setContentSize(w, h);
        art.setPosition(0, height / 2 - h / 2, 0);
      }
    },
  });
  return upper;
}

function roster(parent: Node, top: number, hid: string, rebuild: () => void): void {
  const sv = loadSave(), heroes = Object.values(HERO_DEFS);
  const rail = heroRosterRail(parent, top, 'trainingRoster', heroes.map(def => def.id), hid,
    {cardWidth:120,step:134,center:true});
  heroes.forEach((def, i) => {
    const owned = sv.heroes[def.id].owned;
    const active = hid === def.id;
    const slot = heroLobbyPortrait(rail.content, rail.x(i), def.id, active, owned, rail.cardWidth);
    slot.name = 'trainingHero:' + def.id;
    tap(slot, () => {
      if (!owned) { toast(def.id === 'pyro' ? '通关普通1-2免费获得火法师' : '前往商店解锁该英雄'); return; }
      if (hid === def.id) return;
      sv.curHero = def.id; saveSave(); rebuild();
    });
  });
}

function categories(parent: Node, top: number, rebuild: () => void): void {
  const bar = comicSurface(parent, 0, WY(top, 68), 702, 68, 'dark', { name: 'trainingCategories', radius: 12 });
  ['等级', '武器', '技能', '装备'].forEach((title, i) => {
    const active = st.tab === i;
    const slot = comicButton(bar, (i - 1.5) * 174, 0, 168, 60, '', () => {
      if (st.tab !== i) { st.tab = i; rebuild(); }
    }, { name: 'trainingTab:' + i, tone: active ? 'gold' : 'dark', sound: 'select', quiet: true });
    const face = slot.getChildByName('buttonFace')!;
    comicArt(face, -47, 0, 38, 40, TAB_ART[i]);
    mainLabel(face, 22, 0, title, { size: 27, bold: true, color: active ? COMIC.text : COMIC.cream, w: 78, h: 40 });
  });
  const dividers=N('trainingTabDividers',bar).addComponent(Graphics);
  dividers.strokeColor=CA('#D3DFE5',.18);dividers.lineWidth=1;
  for (const x of [-174,0,174]) {dividers.moveTo(x,-20);dividers.lineTo(x,20);dividers.stroke();}
}

function context(parent: Node, top: number, hid: string, data: TrainingData): () => void {
  const h = loadSave().heroes[hid], def = HERO_DEFS[hid];
  const name = mainLabel(parent, -156, WY(top + 2, 40), def.name, {
    size: 30, bold: true, color: COMIC.cream, w: 364, h: 40, align: 'left', outline: COMIC.ink, outlineW: 2,
  });
  name.name = 'trainingHeroName';
  const level = mainLabel(parent, -156, WY(top + 42, 27), `Lv.${h.lv} · ${def.job.split(' · ')[0]}`, {
    size: 20, color: COMIC.cream, w: 364, h: 27, align: 'left', outline: COMIC.ink, outlineW: 1.5,
  });
  const attrs = comicButton(parent, 260, WY(top + 5, 62), 160, 62, '', () => data.onAttrs(hid), { tone: 'dark', name: 'trainingAttrs', quiet: true });
  const face = attrs.getChildByName('buttonFace')!;
  heroGlyph(face, -44, 0, 'attrs', 38);
  mainLabel(face, 25, 0, '属性', { size: 25, bold: true, color: COMIC.cream, w: 83, h: 40 });
  return () => setText(level, `Lv.${h.lv} · ${def.job.split(' · ')[0]}`);
}

type PreviewRow = { name: string; cur: string; next: string; gain: string };
interface PreviewControl { node: Node; refresh: (lv: number, maxed: boolean, rows: PreviewRow[], achieved?: { level: number; rows: PreviewRow[] }) => void; }
function preview(parent: Node, x: number, y: number, w: number, h: number, title: string,
  lv: number, maxed: boolean, rows: PreviewRow[], portrait = false, note = ''): PreviewControl {
  const p=trainingPaper(parent,x,y,w,h,'trainingPreview',title);
  const levelY = h / 2 - 94;
  const current = mainLabel(p, -w * .18, levelY, `Lv.${lv}`, { size: 26, bold: true, color: TRAINING_INK, w: w * .32, h: 40 });
  const arrow = mainLabel(p, 0, levelY, maxed ? '·' : '→', { size: 23, color: COMIC.sub, w: 32, h: 38 });
  const next = mainLabel(p, w * .18, levelY, maxed ? 'MAX' : `Lv.${lv + 1}`, { size: 26, bold: true, color: COMIC.greenShade, w: w * .32, h: 40 });
  const stamp = mainLabel(p,0,h/2-66,'',{size:16,bold:true,color:'#95712C',w:w-64,h:22}).getComponent(Label)!;
  const changedLabels: Node[] = [next], lights: Node[] = [];
  const updates: ((row: PreviewRow, maxed: boolean) => void)[] = [];
  if (portrait) {
    const groupH=h-206, step=groupH/Math.max(1,rows.length);
    const group=lobbyAttributeWell(p,0,-22,w-32,groupH,'trainingPortraitAttributeWhite');
    rows.forEach((r, i) => {
      const yy = groupH/2-step*(i+.5)+15;
      lights.push(feedbackSurface(group,'trainingResultHighlight','feather',0,yy-13,w-44,Math.min(74,step-8),'#F4CA59',.7));
      mainLabel(group, -w * .19, yy, r.name, { size: 21, bold: true, color: TRAINING_INK, w: w * .42, h: 30 });
      const gain = mainLabel(group, w * .23, yy, maxed ? '已达上限' : r.gain, { size: 19, color: COMIC.greenShade, w: w * .35, h: 27 });
      const a = mainLabel(group, -w * .18, yy - 31, r.cur, { size: 25, bold: true, color: TRAINING_INK, w: w * .31, h: 32 });
      mainLabel(group, 0, yy - 31, '→', { size: 20, color: TRAINING_SUB, w: 30, h: 30 });
      const b = mainLabel(group, w * .18, yy - 31, r.next, { size: 25, bold: true, color: COMIC.greenShade, w: w * .31, h: 32 });
      changedLabels.push(b,gain);
      updates.push((row, capped) => { setText(a, row.cur); setText(b, row.next); setText(gain, capped ? '已达上限' : row.gain); });
    });
    if (rows.length>1) trainingRule(group,0,w-66);
  } else {
    const step=44, groupH=rows.length*step+16;
    const group=lobbyAttributeWell(p,0,h/2-126-groupH/2,w-36,groupH,'trainingWideAttributeWhite');
    rows.forEach((r, i) => {
      const yy = groupH/2-8-step*(i+.5);
      lights.push(feedbackSurface(group,'trainingResultHighlight','feather',0,yy,w-50,40,'#F4CA59',.7));
      mainLabel(group, -w * .285, yy, r.name, { size: 23, bold: true, color: TRAINING_INK, w: w * .29, h: 32, align: 'left' });
      const a=mainLabel(group, w * .02, yy, `${r.cur} → ${r.next}`, { size: 25, bold: true, color: TRAINING_INK, w: w * .38, h: 34 });
      const gain=mainLabel(group, w * .335, yy, maxed ? 'MAX' : r.gain, { size: 23, bold: true, color: COMIC.greenShade, w: w * .18, h: 32 });
      changedLabels.push(gain);
      updates.push((row,capped)=>{setText(a,`${row.cur} → ${row.next}`);setText(gain,capped?'MAX':row.gain);});
    });
    if (note) mainLabel(p, 0, -h / 2 + 35, note, { size: 18, color: TRAINING_SUB, w: w - 50, h: 44,lineHeight:23 });
  }
  const pulse = p.addComponent(TrainingResultPulse); pulse.configure(changedLabels,lights,stamp);
  return { node: p, refresh: (level, capped, values, achieved) => {
    const restore = (): void => {
      setText(current, `Lv.${level}`); setText(arrow, capped ? '·' : '→'); setText(next, capped ? 'MAX' : `Lv.${level + 1}`);
      updates.forEach((update, i) => update(values[i], capped));
    };
    if (achieved) pulse.present(() => {
      setText(current,`Lv.${achieved.level}`);setText(arrow,'→');setText(next,`Lv.${level}`);
      updates.forEach((update,i)=>update(achieved.rows[i],false));
    },restore);
    else restore();
  } };
}

function comparison(cur: Stats, next: Stats): PreviewRow[] {
  return (['atk', 'skillDmg'] as const).map((key, i) => ({
    name: i === 0 ? '攻击力' : '技能伤害', cur: fmt(cur[key]), next: fmt(next[key]), gain: `+${fmt(next[key] - cur[key])}`,
  }));
}

function skillArt(parent: Node, x: number, y: number, side: number, icon: string): Node {
  const circle=N('trainingSkillArt',parent,x,y,side,side);
  const mask=circle.addComponent(Mask);mask.type=Mask.Type.GRAPHICS_ELLIPSE;mask.segments=96;
  artSprite(circle,0,0,side,side,icon,{sliced:false});
  return circle;
}

function milestoneShelf(parent: Node, ctx: PageCtx, y: number, title: string, ms: Milestone[], lv: number,
  stateKey: string, icon: string, rebuild: () => void, swipe = false, subject = title): void {
  const shelf = N('trainingMilestones', parent, 0, y, 702, 244);
  trainingRule(shelf,120,690);
  comicArt(shelf, -308, 90, 34, 34, HAMMER);
  mainLabel(shelf, -164, 90, title, { size: 25, bold: true, color: TRAINING_INK, w: 230, h: 38, align: 'left' });
  const upcoming = ms.findIndex(m => m.lv > lv), nextIndex = upcoming < 0 ? ms.length : upcoming;
  const start = Math.min(Math.max(0, st.milestones[stateKey] ?? Math.min(nextIndex, Math.max(0, ms.length - 3))), Math.max(0, ms.length - 3));
  st.milestones[stateKey] = start;
  const maxIndex = Math.max(0, ms.length - 3);
  const hint = mainLabel(shelf, 190, 90, swipe && maxIndex ? `左右滑动 · ${start + 1}/${maxIndex + 1}` : '阶段成长',
    { size: 18, color: COMIC.sub, w: 264, h: 30, align: 'right' });
  let cards = shelf;
  if (swipe) {
    const viewport = N('skillMilestoneViewport', shelf, 0, -27, 622, 174);
    viewport.addComponent(Mask);
    cards = N('skillMilestoneCards', viewport, 0, 0, Math.max(1, ms.length) * 194, 166);
    shelf.addComponent(MilestoneSwipe).configure(cards, start, maxIndex, index => {
      st.milestones[stateKey] = index;
      setText(hint, `左右滑动 · ${index + 1}/${maxIndex + 1}`);
    });
  }
  (swipe ? ms : ms.slice(start, start + 3)).forEach((m, i) => {
    const reached = lv >= m.lv, target = (swipe ? i : start + i) === nextIndex;
    const node = trainingCard(cards, swipe ? i * 194 : (i - 1) * 194, swipe ? 0 : -27, 180, 166,
      'milestone'+m.lv,target,target);
    mainLabel(node, 0, 55, `${m.lv}级`, { size: 23, bold: true, color: TRAINING_INK, w: 150, h: 32 });
    const art = icon.startsWith('ui_icon') ? skillArt(node, 0, 15, 46, icon) : comicArt(node, 0, 15, 46, 46, icon);
    if (!reached && !target) art.addComponent(UIOpacity).opacity = 120;
    if (reached) comicMark(node, 55, 18, 'check', 19, COMIC.greenShade);
    else if (!target) comicMark(node, 55, 18, 'lock', 16, COMIC.sub);
    mainLabel(node, 0, -30, m.txt.replace(/^突破 · /, ''), { size: 18, color: TRAINING_INK, w: 160, h: 46, lineHeight: 23 });
    if (target) comicSurface(node, 0, -66, 136, 24, 'gold', { name: 'milestoneNext', radius: 12 });
    mainLabel(node, 0, -66, reached ? '已解锁' : target ? '下一阶段' : '未解锁', {
      size: 17, color: reached ? COMIC.greenShade : target ? COMIC.text : COMIC.sub, w: 150, h: 24,
    });
    tap(node, () => {
      const contentH=detailGroupHeight(1),height=detailHeight(contentH,DETAIL_ACTION_FOOTER,560);
      const p=detailDialog(ctx.screens,620,height,`${title} · ${m.lv}级`,'trainingMilestoneDialog');
      const hid=stateKey.split(':')[0],def=HERO_DEFS[hid];
      detailOverview(p,subject,def.name+' · '+title,undefined,'当前 Lv.'+lv,(root,x,y,side)=>{
        if (icon.startsWith('ui_icon')) skillArt(root,x,y,side,icon);
        else comicArt(root,x,y,side,side,icon);
      });
      const content=detailBody(p,contentH,DETAIL_ACTION_FOOTER,'trainingMilestone');
      detailGroup(content,0,'突破效果',[['效果',m.txt.replace(/^突破 · /,'')]]);
      detailFooter(p);
      mainLabel(p,0,-height/2+76,reached?'已解锁':'未解锁',
        {size:24,bold:true,color:reached?COMIC.greenShade:TRAINING_INK,w:520,h:34});
      mainLabel(p,0,-height/2+39,reached?'效果已生效':`达到${m.lv}级自动解锁`,
        {size:19,color:TRAINING_SUB,w:520,h:28});
    });
  });
  if (swipe) return;
  for (const dir of [-1, 1]) {
    if (dir < 0 ? start === 0 : start + 3 >= ms.length) continue;
    const arrow = N('milestonePage:' + dir, shelf, dir * 322, -27, 48, 132);
    heroGlyph(arrow, 0, 0, dir < 0 ? 'left' : 'right', 44);
    tap(arrow, () => { st.milestones[stateKey] = start + dir; rebuild(); });
  }
}

function footer(parent: Node, ctx: PageCtx, top: number, text: string,
  cost: { gold: number; mat: number } | null, maxed: boolean, action: () => OpResult, growth: GrowthTarget, empty = false,
  repeatStep?: (repeating: boolean) => boolean): { refresh: (cost: { gold: number; mat: number }, maxed: boolean) => void; hammer: Node } {
  const sv = loadSave(), ownMat = matCount('mat_stone') + matCount('mat_iron');
  const enough = !!cost && sv.gold >= cost.gold && ownMat >= cost.mat;
  comicPlate(parent, 0, WY(top - 8, 186), 750, 186, 'paper', {
    name: 'trainingActionDock', edge: false, highlight: false, cut: 0, fill:'#FFF9EC',
  });
  const divider=N('trainingFooterDivider',parent,0,WY(top-8,1));
  trainingRule(divider,0,690);
  const costRow = N('trainingCosts', parent, 0, WY(top, 68), 702, 68);
  const costs: { need: Node; own: Node }[] = [];
  if (cost && !maxed && !empty) {
    const entries = cost.mat ? [{ icon: 'comic_coin_v1', need: cost.gold, own: sv.gold },
      { icon: 'comic_mat_stone_v1', need: cost.mat, own: ownMat }] : [{ icon: 'comic_coin_v1', need: cost.gold, own: sv.gold }];
    entries.forEach((r, i) => {
      const x = entries.length === 1 ? 0 : (i - .5) * 312;
      comicArt(costRow, x - 98, 0, 42, 42, r.icon);
      const need = mainLabel(costRow, x + 20, 13, `消耗 ${fmt(r.need)}`, { size: 24, bold: true, color: r.own >= r.need ? COMIC.greenShade : '#AB422E', w: 186, h: 32, align: 'left' });
      const own = mainLabel(costRow, x + 20, -16, `持有 ${fmt(r.own)}`, { size: 18, color: COMIC.sub, w: 186, h: 25, align: 'left' });
      costs.push({ need, own });
    });
  } else mainLabel(costRow, 0, 0, empty ? '前往英雄页穿戴装备后强化' : '已达到当前等级上限', { size: 23, color: COMIC.sub, w: 650, h: 38 });
  const control = comicButtonControl(parent, 0, WY(top + 80, 88), 680, 88, '', () => {
    if (empty || maxed) return;
    const r = growthAction(growth, action); if (r.ok) ctx.refresh();
  }, { name: 'trainingUpgrade', tone: maxed || empty || !enough ? 'muted' : 'green', enabled: !maxed && !empty, sound: false });
  const button = control.node;
  const face = button.getChildByName('buttonFace')!;
  const hammer = comicArt(face, -146, 0, 48, 48, HAMMER);
  const caption = mainLabel(face, 33, repeatStep ? 12 : 0, empty ? '未穿戴装备' : maxed ? '已满级' : text,
    { size: repeatStep ? 30 : 33, bold: true, color: COMIC.cream, w: 350, h: repeatStep ? 42 : 54 });
  if (repeatStep) {
    const hint = mainLabel(face, 33, -24, maxed ? '已达到当前上限' : '点击升一级 · 长按连续升级', { size: 17, color: COMIC.cream, w: 410, h: 24 });
    const hold = button.addComponent(HoldUpgrade); hold.configure(repeatStep);
    bindButton(button, () => hold.click(), { visual: face, sound: false, enabled: () => !maxed && !empty,
      onPress: pressed => hold.press(pressed) });
    return { hammer, refresh: (nextCost, capped) => {
      const oldMaxed = maxed; maxed = capped;
      const wallet = loadSave(), mat = matCount('mat_stone') + matCount('mat_iron');
      const needs = [nextCost.gold, nextCost.mat], owned = [wallet.gold, mat];
      costs.forEach((row, i) => {
        setText(row.need, capped ? '已达上限' : `消耗 ${fmt(needs[i])}`);
        row.need.getComponent(Label)!.color = C(owned[i] >= needs[i] ? COMIC.greenShade : '#AB422E');
        setText(row.own, `持有 ${fmt(owned[i])}`);
      });
      control.setTone(capped || wallet.gold < nextCost.gold || mat < nextCost.mat ? 'muted' : 'green');
      if (oldMaxed !== capped) control.setEnabled(!capped);
      setText(caption, capped ? '已满级' : text);
      setText(hint, capped ? '已达到当前上限' : '点击升一级 · 长按连续升级');
    } };
  }
  return { hammer, refresh: () => {} };
}

export function buildTrainingLobby(ctx: PageCtx, data: TrainingData): void {
  if (pendingUpgradeLesson()) { loadSave().curHero = 'archer'; st.tab = 0; }
  const root = N('trainingLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  function render(): void {
    refreshUI(root, () => {
      const sv = loadSave(), hid = sv.curHero, h = sv.heroes[hid], def = HERO_DEFS[hid];
      const rosterTop = mainResourceTop() + MAIN_RESOURCE_H + 20;
      const tabTop = rosterTop + 126, contextTop = tabTop + 82;
      const bodyTop = contextTop + 82, footerTop = mainLayout().bottom - 180;
      const available = Math.max(1, footerTop - 12 - bodyTop), height = Math.max(st.tab === 2 ? 736 : 674, available), stageH = height - 260;
      comicPlate(root,0,0,750,LO.half*2,'paper',{name:'trainingPaperBackground',edge:false,highlight:false,cut:0,fill:'#FFF9EC'});
      const env = environment(root, st.tab < 2 ? bodyTop + stageH : bodyTop, st.tab < 2), envY = env.position.y;
      const title = mainLabel(root, -271, WY(mainResourceTop() + 7, 40), '英雄培养', { size: 30, color: COMIC.cream, bold: true, w: 190, h: 40, outline: COMIC.ink, outlineW: 2 });
      title.name = 'trainingTitle';
      roster(root, rosterTop, hid, render); categories(root, tabTop, render);
      const refreshContext = context(root, contextTop, hid, data);
      const body = pageScroll(root, 'trainingBody', bodyTop, footerTop - 12, height, 718);
      const scroll = body.parent!.getComponent(ScrollView)!;
      scroll.elastic = false;
      const selectedSkill = st.skills[hid] ?? 'skill', selectedEquip = st.equips[hid] ?? WORN.find(kind => !!wornInst(hid, kind)) ?? 'helm';
      const key = hid + ':' + st.tab + ':' + (st.tab === 2 ? selectedSkill : st.tab === 3 ? selectedEquip : '');
      const maxOffset = height - available;
      let thumb: Node | null = null, thumbH = 0;
      if (maxOffset > 0) {
        const track = N('trainingScrollTrack', root, 359, WY(bodyTop, available), 4, available).addComponent(Graphics);
        track.fillColor = CA(COMIC.sub, .18); track.roundRect(-2, -available / 2, 4, available, 2); track.fill();
        thumbH = Math.max(30, available * available / height);
        thumb = N('trainingScrollThumb', root, 359, WY(bodyTop, thumbH), 4, thumbH);
        const g = thumb.addComponent(Graphics); g.fillColor = CA(COMIC.sub, .65); g.roundRect(-2, -thumbH / 2, 4, thumbH, 2); g.fill();
      }
      const updateScroll = (): void => {
        const offset = Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y));
        st.offsets[key] = offset;
        if (st.tab < 2) env.setPosition(0, envY + offset, 0);
        if (thumb) thumb.setPosition(359, WY(bodyTop, thumbH) - (available - thumbH) * offset / maxOffset, 0);
      };
      scroll.node.on(ScrollView.EventType.SCROLLING, updateScroll);

      if (st.tab < 2) {
        const weapon = st.tab === 1, lv = weapon ? h.weaponLv : h.lv, maxed = lv >= (weapon ? MAX.weapon : MAX.hero);
        const cur = data.statsAt(hid, h.lv, h.weaponLv), next = maxed ? cur : data.statsAt(hid, h.lv + (weapon ? 0 : 1), h.weaponLv + (weapon ? 1 : 0));
        const stage = N('trainingDisplay', body, 0, -stageH / 2, 710, stageH), foot = -stageH / 2 + 72;
        let figure: Node, weaponCaption: Node | null = null;
        if (weapon) {
          const equipped = equippedWeapon(hid);
          mainLabel(stage, -176, stageH / 2 - 25, equipped.name, { size: 26, color: COMIC.cream, bold: true, w: 312, h: 38, outline: COMIC.ink, outlineW: 2 });
          const item = N('trainingWeapon:' + hid, stage, -176, -10, 310, stageH - 85);
          figure = item;
          const floating = N('trainingWeaponFloat', item, 0, 0, 280, stageH - 120);
          comicArt(floating, 0, 12, 280, stageH - 120, equipped.art);
          floating.addComponent(TrainingWeaponFloat);
          weaponCaption = mainLabel(stage, -176, -stageH / 2 + 22, '换装继承培养等级 · Lv.' + h.weaponLv, { size: 17, color: COMIC.cream, outline: COMIC.ink, outlineW: 1.5, w: 314, h: 28 });
        } else {
          figure = heroComicFigure(stage, hid, -176, foot, stageH - 102, 318, true);
        }
        const paperH = Math.min(stageH - 20, 432);
        const statsPanel = preview(stage, 185, 16, 310, paperH, weapon ? '强化提升' : HERO_GROWTH[HERO_DEFS[hid].growthType].name + '成长', lv, maxed, comparison(cur, next), true);
        const power = N('trainingPower', statsPanel.node, 0, -paperH / 2 + 34, 274, 56);
        comicArt(power, 0, 0, 274, 56, 'hero_comic_v3/comic_power_plate_v3');
        const powerText = mainLabel(power, 23, 0, `战力 ${fmt(heroStats(hid).power)}`, { size: 23, bold: true, color: COMIC.cream, w: 202, h: 34 });
        const fx = N('trainingGrowthFx', stage, -176, foot).addComponent(TrainingGrowthFx);
        fx.configure(figure, power, powerText, heroStats(hid).power);
        const shelfHost = N('trainingMilestoneHost', body);
        const refreshShelf = (): void => {
          for (const child of Array.from(shelfHost.children)) { child.active = false; child.removeFromParent(); child.destroy(); }
          milestoneShelf(shelfHost, ctx, -(stageH + 138), weapon ? '武器突破' : '等级突破', weapon ? data.weaponMilestones(hid) : data.heroMilestones(hid), weapon ? h.weaponLv : h.lv, hid + ':' + st.tab, weapon ? equippedWeapon(hid).art : HAMMER, render, true,
            weapon?equippedWeapon(hid).name:HERO_GROWTH[def.growthType].name+'成长');
        };
        refreshShelf();
        const target: GrowthTarget = { kind: weapon ? 'weapon' : 'hero', hid };
        const action = (): OpResult => weapon ? upWeapon(hid) : upHero(hid);
        const footerControl = footer(root, ctx, footerTop, weapon ? '强化武器' : '升级英雄', weapon ? weaponUpCost(lv) : { gold: heroUpCost(lv), mat: 0 }, maxed, action, target, false, repeating => {
          // Keep the same hit target and art alive throughout a continuous gesture.
          const before = heroStats(hid).power, oldLevel = weapon ? h.weaponLv : h.lv;
          const beforeStats = data.statsAt(hid,h.lv,h.weaponLv);
          const milestone = (oldLevel + 1) % 10 === 0;
          const result = growthAction(target, action, repeating);
          if (!result.ok) return false;
          const level = weapon ? h.weaponLv : h.lv, capped = level >= (weapon ? MAX.weapon : MAX.hero);
          const current = data.statsAt(hid, h.lv, h.weaponLv);
          const nextStats = capped ? current : data.statsAt(hid, h.lv + (weapon ? 0 : 1), h.weaponLv + (weapon ? 1 : 0));
          statsPanel.refresh(level, capped, comparison(current, nextStats), { level: oldLevel, rows: comparison(beforeStats,current) }); refreshContext();
          if (weaponCaption) setText(weaponCaption, '换装继承培养等级 · Lv.' + h.weaponLv);
          const nextCost = weapon ? weaponUpCost(level) : { gold: heroUpCost(level), mat: 0 };
          footerControl.refresh(nextCost, capped); ctx.refreshResources?.();
          fx.pulse(before, heroStats(hid).power, milestone);
          if (milestone) refreshShelf();
          if (capped) { if (!milestone) toast('已达到当前等级上限', { kind: 'success', title: '培养完成' }); return false; }
          const missing = sv.gold < nextCost.gold ? '金币不足' : matCount('mat_stone') + matCount('mat_iron') < nextCost.mat ? '强化材料不足' : '';
          if (repeating && missing) toast(missing + '，已停止连续升级', { kind: 'warning', title: '连续升级已停止' });
          return !missing;
        });
        fx.setHammer(footerControl.hammer);
        if (!weapon && hid === 'archer' && pendingUpgradeLesson()) whenUIArtReady(root, () => {
          if (!root.isValid || !root.activeInHierarchy || !pendingUpgradeLesson()) return;
          const button = root.getChildByName('trainingUpgrade');
          if (!button) return;
          const back = (): void => {
            flow.levelReturn = { id: '1-2', diff: 0 };
            if (ctx.navigate) ctx.navigate(2); else ctx.refresh();
          };
          tutorialFocus(root, button, '绿弓已装备！再花100金币将弓箭手升到2级，随后前往第二关。也可以跳过。', () => {
            const result = growthAction(target, action);
            if (result.ok) { finishUpgradeLesson(); ctx.refreshResources?.(); back(); }
            else { finishUpgradeLesson(true); back(); }
          }, () => { finishUpgradeLesson(true); back(); });
        });
      } else if (st.tab === 2) {
        const selected = selectedSkill, shelfH = 216;
        const shelf = N('trainingSkills', body, 0, -shelfH / 2, 702, shelfH);
        SKILLS.forEach((slot, i) => {
          const active = selected === slot;
          const choice = trainingCard(shelf,(i-1)*236,0,222,shelfH,'skillChoice:'+slot,active,active);
          skillArt(choice,0,22,132,data.skillIconId(hid,slot));
          mainLabel(choice, 0, -57, ['普攻', '技能', '大招'][i], { size: 25, color: TRAINING_INK, bold: true, w: 194, h: 34 });
          mainLabel(choice, 0, -87, `Lv.${h[SLOT_KEY[slot]]}`, { size: 20, color: TRAINING_SUB, w: 180, h: 27 });
          tap(choice, () => { if (selected !== slot) { st.skills[hid] = slot; render(); } });
        });
        const lv = h[SLOT_KEY[selected]], maxed = lv >= MAX.skill;
        let rows: PreviewRow[];
        if (selected === 'skill') {
          const cur = skillBaseMultiplier(hid, lv), next = skillBaseMultiplier(hid, maxed ? lv : lv + 1);
          const pct = (v: number): string => `${Math.round(v * 10000) / 100}%`;
          rows = [{ name: hid === 'wind' ? '每次切割技能倍率' : hid === 'ninja' ? '每刃回收技能倍率' : '技能伤害倍率',
            cur: pct(cur), next: pct(next), gain: `+${pct(next - cur)}` }];
        } else if (hid === 'cannon' || hid === 'siphon' || hid === 'wind' || hid === 'ninja') {
          const value = (level: number): number => selected === 'atk' ? newHeroNormalCfg(level).normalMul
            : hid === 'wind' ? windUltCfg(level).mul : hid === 'ninja' ? ninjaUltCfg(level).mul
            : hid === 'cannon' ? cannonUltCfg(level).mul : siphonUltCfg(level).mul;
          const cur = value(lv), next = value(maxed ? lv : lv + 1);
          const pct = (v: number): string => `${Math.round(v * 10000) / 100}%`;
          rows = [{ name: selected === 'atk' ? '普攻伤害倍率' : hid === 'wind' || hid === 'ninja' ? '大招每段技能倍率'
            : hid === 'siphon' ? '激光每秒技能倍率' : '每弹中心技能倍率',
            cur: pct(cur), next: pct(next), gain: `+${pct(next - cur)}` }];
        } else {
          const pct = (l: number): number => 100 + (l - 1) * 8;
          rows = [{ name: selected === 'atk' ? '普攻伤害倍率' : '大招伤害倍率', cur: `${pct(lv)}%`, next: `${pct(maxed ? lv : lv + 1)}%`, gain: maxed ? '+0%' : '+8%' }];
        }
        const paperH = height - shelfH - 280;
        preview(body, 0, -(shelfH + 12 + paperH / 2), 702, paperH, data.skillName(hid, selected), lv, maxed, rows, false,
          selected === 'atk' ? '每5级获得阶段突破' : '上阵即可使用；每5级获得阶段突破');
        milestoneShelf(body, ctx, -(height - 122), '技能突破', data.skillMilestones(hid, selected), lv, hid + ':skill:' + selected, data.skillIconId(hid, selected), render, true,data.skillName(hid,selected));
        footer(root, ctx, footerTop, '升级' + (selected === 'atk' ? '普攻' : selected === 'skill' ? '技能' : '大招'), skillUpCost(lv), maxed, () => upSkill(hid, selected), { kind: selected, hid });
      } else {
        const selected = selectedEquip, rackH = 360;
        const cabinet = trainingPaper(body,0,-rackH/2,702,rackH,'equippedCabinet');
        comicArt(cabinet, -302, 147, 38, 38, 'comic_armor_forest_v1');
        mainLabel(cabinet, -112, 147, '已穿戴装备', { size: 25, bold: true, color: TRAINING_INK, w: 304, h: 38, align: 'left' });
        mainLabel(cabinet, 269, 147, `${WORN.filter(kind => !!wornInst(hid, kind)).length}/4`, { size: 20, color: COMIC.sub, w: 110, h: 30, align: 'right' });
        WORN.forEach((kind, i) => {
          const inst = wornInst(hid, kind), d = inst ? EQUIPS[inst.defId] : null;
          const choice = trainingCard(cabinet,i%2===0?-164:164,i<2?44:-101,312,132,'wornChoice:'+kind,selected===kind);
          if (inst && d) shopQualitySocket(choice,-89,0,108,d.quality);
          const item = gearArt(choice, -89, 0, inst?94:78, inst?94:78, inst ? inst.defId : EMPTY_GEAR[kind]);
          if (!inst) item.addComponent(UIOpacity).opacity = 85;
          if (selected===kind) comicMark(choice,135,43,'check',17,COMIC.greenShade);
          mainLabel(choice, 53, 26, d ? d.name : KIND_NAME[kind], { size: 23, color: TRAINING_INK, bold: true, w: 174, h: 32, align: 'left' });
          mainLabel(choice, 53, -7, d ? QUALITY[d.quality] : '未穿戴', { size: 18, color: COMIC.sub, w: 174, h: 27, align: 'left' });
          if (inst) mainLabel(choice, 53, -40, `Lv.${inst.lv}`, { size: 21, bold: true, color: TRAINING_INK, w: 174, h: 29, align: 'left' });
          tap(choice, () => { if (selected !== kind) { st.equips[hid] = kind; render(); } });
        });
        const inst = wornInst(hid, selected), d = inst ? EQUIPS[inst.defId] : null, maxed = !!inst && inst.lv >= MAX.equip;
        const paperH = height - rackH - 16;
        if (inst && d) {
          const rows = (Object.keys(d.stats) as StatKey[]).filter(k => (d.stats[k] ?? 0) > 0).map(k => {
            const cur = equipStat(inst, k), next = maxed ? cur : equipStat({ ...inst, lv: inst.lv + 1 }, k);
            return { name: STAT_NAME[k], cur: statFmt(k, cur), next: statFmt(k, next), gain: '+' + statFmt(k, next - cur) };
          });
          preview(body, 0, -(rackH + 16 + paperH / 2), 702, paperH, d.name + ' · 强化提升', inst.lv, maxed, rows, false, '主属性 +4% / 级');
        } else {
          const p = trainingPaper(body,0,-(rackH+16+paperH/2),702,paperH,'trainingEmpty');
          mainLabel(p, 0, 26, KIND_NAME[selected] + ' · 未穿戴', { size: 27, bold: true, color: TRAINING_INK, w: 640, h: 42 });
          mainLabel(p, 0, -25, '前往英雄页，从背包选择装备穿戴', { size: 22, color: COMIC.sub, w: 630, h: 58 });
        }
        footer(root, ctx, footerTop, '强化装备', inst ? equipUpCost(inst.lv) : null, maxed, () => upWornEquip(hid, selected), { kind: 'equip', hid, slot: selected }, !inst);
      }
      scroll.scrollToOffset(new Vec2(0, Math.min(maxOffset, st.offsets[key] ?? 0)), 0);
      updateScroll();
    });
  }
  render();
}
