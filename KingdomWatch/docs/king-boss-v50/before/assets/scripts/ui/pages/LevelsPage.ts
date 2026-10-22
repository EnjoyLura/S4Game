/** Scrollable chapter terrain with live checkpoints and a local preparation drawer. */
import { BlockInputEvents, Graphics, Label, Mask, Node, ScrollView, Sprite, UITransform, UIOpacity, Vec2, director } from 'cc';
import { LO } from '../../config/GameConfig';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_STAGES, campaignDifficultyOpen, campaignLevelOpen } from '../../config/Campaign';
import { C, CA, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicButtonControl, comicMark, comicSurface } from '../ComicUI';
import { mainLabel, PageCtx, toast, mainLayout, MAIN_RESOURCE_H, MAIN_NAV_H, pageScroll } from '../PageKit';
import { CHEST_COND, claimAllChests, starKey, squadList } from '../../core/GameData';
import { DIFFICULTIES, equipmentDropChance, getChallengeDef, starChestRewards } from '../../config/LevelDifficulty';
import { showDropItemDetails, showStageLootDetails, stageDropIcon, stageGuaranteedRewards } from '../LevelLootPreview';
import { loadSave, saveSave } from '../../core/SaveData';
import { GameAudio } from '../../core/GameAudio';
import { flow } from '../../core/Flow';
import { firstBowAvailable } from '../../core/FirstJourney';
import { firstBookAvailable } from '../../core/ThirdJourney';
import { fifthRewardsAvailable } from '../../core/FifthLevelRewards';
import { finishSecondEntryLesson, pendingSecondEntryLesson, pendingUpgradeLesson, pyroRewardAvailable } from '../../core/SecondJourney';
import { tutorialFocus } from '../TutorialFocus';
import { whenUIArtReady } from '../UIArtReady';
import { openSquadPanel } from '../SquadPanel';
import { bindButton } from '../ButtonFeedback';
import { refreshUI, reducedMotion } from '../UIMotion';
import { enterBattle, enteringBattle } from '../BattleEntry';
import { warmBattlefield } from '../BattleEntryWarmup';
import { deferUIWarmup } from '../IdleWarmup';
import { showRewardPopup } from '../RewardPopup';
import { CampaignRouteMotion, ROUTE_ART, ROUTE_H, ROUTE_W, routePoint, routeStop } from '../CampaignRoute';
import { CAMPAIGN_TEXT, campaignChapterArrow, campaignChapterBanner, campaignChestBackdrop, campaignDifficultyFace, campaignEquipmentHeading,
  campaignPreparationArt, campaignPreparationPanel, campaignTerrainCrown, paintCampaignMapAction } from '../CampaignChrome';

const LEVELS = CAMPAIGN_STAGES;
const DIFFS = ['普通', '精英', '地狱'];
const CHAPTER_NUMERALS = ['一', '二', '三'];
const st = { i: 0, d: 0, initialized: false, drawer: false,
  selected: [0, 0, 0], offsets: [null, null, null] as (number | null)[] };
let dismissPreparation: (() => void) | null = null;
/** Tab navigation always returns to the plain chapter map, while local squad refresh keeps its parent. */
export function closeLevelPreparation(): void { st.drawer = false; dismissPreparation?.(); }
function clear(node: Node): void {
  for (const child of [...node.children]) { child.active = false; child.removeFromParent(); child.destroy(); }
}
function levelArt(parent: Node, x: number, y: number, w: number, h: number, key: string): Node {
  return comicArt(parent, x, y, w, h, 'levels_comic_v1/' + key);
}
function star(parent: Node, x: number, y: number, size: number, earned: boolean): void {
  const art = artSprite(parent, x, y, size, size, 'levels_comic_v1/comic_star_v1', {
    sliced: false, onLoaded: n => { if (!earned) n.getComponent(Sprite)!.color = C(COMIC.muted); },
  });
  if (!earned) art.addComponent(UIOpacity).opacity = 95;
}

/** Resolve the same selection before lobby music starts, including a returning battle's focus. */
export function selectedCampaignChapter(): number {
  if (!st.initialized) {
    st.initialized = true;
    const stars = loadSave().stars;
    CAMPAIGN_CHAPTERS.forEach((_, chapter) => {
      const stages = LEVELS.slice(chapter * 10, chapter * 10 + 10);
      const next = stages.find(stage => campaignLevelOpen(stage.id, stars) && !(stars[stage.id] > 0));
      st.selected[chapter] = next ? next.stage - 1 : stages.some(stage => stars[stage.id] > 0) ? 9 : 0;
    });
    const next = LEVELS.find(stage => campaignLevelOpen(stage.id, stars) && !(stars[stage.id] > 0));
    st.i = next ? next.order : LEVELS.length - 1;
    const remembered = Number(loadSave().viewedChapter);
    if (Number.isInteger(remembered) && remembered >= 1 && remembered <= CAMPAIGN_CHAPTERS.length) {
      st.i = (remembered - 1) * 10 + st.selected[remembered - 1];
    }
  }
  const focus = flow.levelReturn;
  if (focus) {
    flow.levelReturn = null;
    const index = LEVELS.findIndex(level => level.id === focus.id);
    if (index >= 0) {
      st.i = index; st.d = Math.max(0, Math.min(2, Math.floor(focus.diff)));
      st.selected[Math.floor(index / 10)] = index % 10;
      st.offsets[Math.floor(index / 10)] = null;
      st.drawer = false;
    }
  }
  return Math.floor(st.i / 10) + 1;
}

export function buildLevels(ctx: PageCtx): void {
  const entryLesson = pendingSecondEntryLesson();
  if (entryLesson) flow.levelReturn = { id: '1-2', diff: 0 };
  GameAudio.setChapter(selectedCampaignChapter());
  if (entryLesson) st.drawer = true;
  while (st.d > 0 && !campaignDifficultyOpen(LEVELS[st.i].id, st.d, loadSave().stars)) st.d--;
  const content = N('campaignRouteLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  let mapScroll: ScrollView | null = null;
  let pins: Node | null = null, dock: Node | null = null, drawer: Node | null = null, shade: Node | null = null;
  let header: Node | null = null, closing = false, claiming = false;
  let sheetTop = 0, sheetH = 0;
  const { headerTop } = mainLayout();
  const bottom = LO.half * 2 - LO.safeTop - LO.safeBottom - MAIN_NAV_H;
  const chapterTop = headerTop + MAIN_RESOURCE_H + 14;
  const dockH = 102, dockTop = bottom - dockH;
  // One scrolling terrain fills the screen behind the floating header controls.
  const mapTop = 0, mapViewH = Math.max(1, bottom - mapTop);
  const mapHeight = Math.max(ROUTE_H, mapViewH);
  // The compact route clears the header itself; only unusually large safe areas need a small inset.
  const mapClearTop = chapterTop + 110;
  const mapInsetTop = Math.max(0, mapClearTop + 84 - routePoint(10, mapHeight).top);
  const mapContentH = mapInsetTop + mapHeight;
  const modalParent = ctx.screens.parent!;
  const currentChapter = (): number => Math.floor(st.i / 10);
  dismissPreparation = (): void => {
    if (!content.isValid) return;
    for (const overlay of [drawer,shade]) {
      if (overlay?.isValid) { overlay.active = false; overlay.removeFromParent(); overlay.destroy(); }
    }
    drawer = null; shade = null; closing = false;
    renderDock();
  };
  function levelOpen(i: number): boolean {
    return !!LEVELS[i] && campaignLevelOpen(LEVELS[i].id, loadSave().stars);
  }
  function notifyLockedLevel(i: number): void {
    const level = LEVELS[i], previous = LEVELS[i - 1];
    if (!level || !previous) return;
    toast('请先通关 ' + previous.id + ' ' + previous.name + '（普通难度）',
      { kind: 'warning', title: level.id + ' ' + level.name + ' 尚未解锁', key: 'campaignLockedLevel:' + level.id });
  }
  function difficultyOpen(i: number, d: number): boolean {
    return !!LEVELS[i] && campaignDifficultyOpen(LEVELS[i].id, d, loadSave().stars);
  }
  function saveOffset(): void {
    if (mapScroll && !st.drawer) st.offsets[currentChapter()] = Math.max(0, mapScroll.getScrollOffset().y);
  }
  function scrollMap(offset: number, animated: boolean): void {
    mapScroll?.stopAutoScroll();
    mapScroll?.scrollToOffset(new Vec2(0, Math.max(0, Math.min(mapContentH - mapViewH, offset))),
      animated && !reducedMotion() ? .26 : 0);
  }
  function focusMap(animated: boolean): void {
    const p = routePoint(LEVELS[st.i].stage, mapHeight);
    const target = chapterTop + (dockTop - chapterTop) * .62;
    scrollMap(mapTop + mapInsetTop + p.top - target, animated);
  }
  function warmSelected(): void {
    if (levelOpen(st.i)) {
      const levelId = LEVELS[st.i].id, heroes = squadList();
      deferUIWarmup(content, () => { void warmBattlefield(levelId, heroes); });
    }
  }
  function renderHeader(): void {
    if (!header) return;
    clear(header);
    const chapter = CAMPAIGN_CHAPTERS[currentChapter()], sv = loadSave();
    const stages = LEVELS.slice(currentChapter() * 10, currentChapter() * 10 + 10);
    const cleared = stages.filter(stage => (sv.stars[stage.id] || 0) > 0).length;
    const stars = stages.reduce((sum, stage) => sum + (sv.stars[stage.id] || 0), 0);
    const bar = campaignChapterBanner(header, 0, WY(chapterTop, 100), 694, 100);
    bar.addComponent(BlockInputEvents);
    mainLabel(bar, 0, 14, '第' + CHAPTER_NUMERALS[currentChapter()] + '章 · ' + chapter.name,
      { size: 31, font: 'body', bold: true, color: '#FFF0C7', w: 470, h: 40, outline: '#10232F', outlineW: 1 });
    mainLabel(bar, -73, -22, '已通关 ' + cleared + '/10', { size: 19, bold: true, color: '#F6F2E2', w: 210, h: 28 });
    star(bar, 63, -21, 24, true);
    mainLabel(bar, 125, -22, stars + '/30', { size: 19, bold: true, color: '#F6F2E2', w: 86, h: 28, align: 'left' });
    ([-1, 1] as const).forEach(dir => {
      const available = currentChapter() + dir >= 0 && currentChapter() + dir < CAMPAIGN_CHAPTERS.length;
      const arrow = N('campaignChapterArrow:' + dir, bar, dir * 303, 0, 66, 66);
      campaignChapterArrow(arrow, dir, available);
      bindButton(arrow, () => {
        if (!available || closing || enteringBattle()) return;
        saveOffset(); st.drawer = false;
        const c = currentChapter() + dir;
        st.i = c * 10 + st.selected[c];
        while (st.d > 0 && !difficultyOpen(st.i, st.d)) st.d--;
        renderWorld();
      }, { sound: 'select' });
    });
  }
  function renderPins(): void {
    if (!pins) return;
    clear(pins);
    const sv = loadSave();
    LEVELS.slice(currentChapter() * 10, currentChapter() * 10 + 10).forEach(level => {
      // Map progression is always normal-mode progression; each drawer keeps its own difficulty stars.
      const open = campaignLevelOpen(level.id, sv.stars), earned = sv.stars[level.id] || 0;
      const ready = DIFFS.some((_, d) => (sv.stars[starKey(level.id, d)] || 0) > (sv.chestClaimed[starKey(level.id, d)] || 0));
      const item = routeStop(pins!, level.stage, level.order === st.i, open, earned, level.name, ready, mapHeight, currentChapter());
      bindButton(item, () => {
        if (closing || enteringBattle()) return;
        if (!levelOpen(level.order)) { notifyLockedLevel(level.order); return; }
        if (!st.drawer) saveOffset();
        st.i = level.order; st.selected[currentChapter()] = level.stage - 1;
        while (st.d > 0 && !difficultyOpen(st.i, st.d)) st.d--;
        renderPins(); renderDock(); openDrawer();
        warmSelected();
      }, { dragThreshold: 7, scale: .97, sound: open ? 'select' : false });
    });
  }
  function renderDock(): void {
    if (!dock) return;
    clear(dock); dock.active = !st.drawer;
    const open = levelOpen(st.i);
    // Only the controls float above the terrain; there is no current-stage bar or full-width paper.
    const actionY = WY(dockTop + 10, 82);
    const button = comicButton(dock, 0, actionY, 354, 82, '', () => {
      if (closing || enteringBattle()) return;
      if (!levelOpen(st.i)) { notifyLockedLevel(st.i); return; }
      saveOffset(); openDrawer();
    }, { tone: open ? 'gold' : 'muted', name: 'campaignPrepare', sound: open ? 'tap' : 'warning' });
    const prepareFace = button.getChildByName('buttonFace')!;
    paintCampaignMapAction(prepareFace,354,82,'gold',open);
    if (open) levelArt(prepareFace,-113,1,53,53,'comic_swords_v1');
    else comicMark(prepareFace,-113,0,'lock',30,COMIC.sub);
    mainLabel(prepareFace,28,1,open ? '出战准备' : '尚未解锁',
      { size:32,font:'body',bold:true,color:open ? '#1E271E' : COMIC.sub,w:220,h:46 });
    const squad = comicButton(dock, 272, actionY, 136, 82, '', () => {
      if (closing || enteringBattle()) return;
      openSquadPanel({ ...ctx, refresh: () => { renderDock(); warmSelected(); ctx.refreshResources?.(); } });
    }, { tone: 'dark', name: 'campaignMapSquad' });
    const squadFace = squad.getChildByName('buttonFace')!;
    paintCampaignMapAction(squadFace,136,82,'navy');
    comicArt(squadFace,-38,1,37,44,'comic_helm_falcon_v1');
    mainLabel(squadFace,19,12,'编队',{size:24,font:'body',bold:true,color:'#FFF6DF',w:76,h:34});
    mainLabel(squadFace,19,-20,squadList().length+'/4',{size:17,color:'#C6D9DE',w:76,h:24});
  }
  function openDrawer(animate = true): void {
    const existed = !!drawer;
    // Freeze the exact terrain offset before covering it; opening the paper never recenters a checkpoint.
    mapScroll?.stopAutoScroll();
    if (mapScroll) st.offsets[currentChapter()] = Math.max(0, mapScroll.getScrollOffset().y);
    st.drawer = true; dock!.active = false;
    // The paper and controls stay fixed; only the equipment well scrolls locally.
    sheetH = Math.min(928, bottom - Math.max(20, LO.notchTop + 12));
    sheetTop = bottom - sheetH;
    if (!shade) {
      shade = N('campaignDrawerShade', content, 0, WY(chapterTop + 94, dockTop - chapterTop - 94), 750, dockTop - chapterTop - 94);
      const ink = shade.addComponent(Graphics);
      ink.fillColor = CA(COMIC.darkShade, .20);
      ink.rect(-375, -(dockTop - chapterTop - 94) / 2, 750, dockTop - chapterTop - 94); ink.fill();
      shade.addComponent(BlockInputEvents);
      bindButton(shade, closeDrawer, { motion: false, sound: false });
    }
    if (!drawer) {
      drawer = campaignPreparationPanel(content,0,WY(sheetTop,sheetH),750,sheetH);
      drawer.addComponent(BlockInputEvents);
      drawer.addComponent(CampaignRouteMotion);
    }
    renderSheet();
    if (!existed && animate) drawer.getComponent(CampaignRouteMotion)!.enter();
  }
  function closeDrawer(): void {
    if (!drawer || closing || enteringBattle()) return;
    closing = true;
    drawer.getComponent(CampaignRouteMotion)!.leave(() => {
      if (!content.isValid) return;
      if (drawer?.isValid) { drawer.active = false; drawer.removeFromParent(); drawer.destroy(); }
      if (shade?.isValid) { shade.active = false; shade.removeFromParent(); shade.destroy(); }
      drawer = null; shade = null; closing = false; st.drawer = false;
      renderDock();
    });
  }
  function renderSheet(): void {
    if (!drawer) return;
    const host = drawer;
    refreshUI(host, () => {
      // Retain an opaque paper together with its contents. Without this child surface,
      // the incoming labels and sprites show through the outgoing transparent group.
      const panel = campaignPreparationPanel(host,0,0,750,sheetH);
      panel.name = 'campaignPreparationSurface';
      const sv = loadSave(), lv = LEVELS[st.i], challenge = getChallengeDef(lv.id, st.d), open = difficultyOpen(st.i, st.d);
      const key = starKey(lv.id, st.d), stars = sv.stars[key] || 0, claimed = sv.chestClaimed[key] || 0;
      const y = (top: number): number => sheetH / 2 - top;
      comicSurface(panel, 0, y(17), 56, 5, 'paper', { fill: '#A38C63', radius: 2 });
      mainLabel(panel, -29, y(53), lv.id + ' ' + lv.name, { size: 34, font: 'body', bold: true, color: CAMPAIGN_TEXT.ink, w: 612, h: 48, align: 'left' });
      mainLabel(panel, -12, y(94), challenge.waves.length + ' 波 · ' + DIFFICULTIES[st.d].formation,
        { size: 19, font: 'body', color: CAMPAIGN_TEXT.body, w: 644, h: 30, align: 'left' });
      const close = N('campaignDrawerClose', panel, 324, y(48), 58, 58);
      comicMark(close, 0, 0, 'close', 28, CAMPAIGN_TEXT.secondary); bindButton(close, closeDrawer, { sound: false });
      // Intrinsic component sizes. Only the one-and-a-half-row equipment viewport scrolls.
      const compact = sheetH < 900;
      const layout = compact
        ? { bodyTop: 104, tabs: 24, tabH: 48, stars: 70, chest: 162, chestLabel: 60, chestArt: 10,
          chestW: 112, chestH: 80, amount: -48, claim: -85, claimH: 38, drops: 300, materials: 346,
          equipment: 408, row: 430, rowStep: 72, icon: 60, chance: 568 }
        : { bodyTop: 112, tabs: 29, tabH: 54, stars: 90, chest: 210, chestLabel: 74, chestArt: 4,
          chestW: 134, chestH: 106, amount: -64, claim: -104, claimH: 44, drops: 377, materials: 432,
          equipment: 498, row: 519, rowStep: 94, icon: 82, chance: 690 };
      const body = N('campaignPreparationContent', panel, 0, y(layout.bodyTop));
      const by = (top: number): number => -top;
      DIFFS.forEach((name, d) => {
        const active = st.d === d, unlocked = difficultyOpen(st.i, d);
        const slot = N('campaignDifficulty:' + d, body, (d-1)*226, by(layout.tabs), 218, layout.tabH);
        campaignDifficultyFace(slot, 218, layout.tabH, active, unlocked, d);
        mainLabel(slot, 18, 0, name, { size: 25, font: 'body', bold: true,
          color: active ? CAMPAIGN_TEXT.ink : CAMPAIGN_TEXT.secondary, w: 140, h: 38 });
        bindButton(slot, () => {
          if (!unlocked) { toast(d ? '通关上一难度解锁' : '通关前置关卡后解锁'); return; }
          if (st.d !== d) { st.d = d; renderSheet(); }
        }, { sound: 'select', dragThreshold: 7, motion: false });
      });

      mainLabel(body, -194, by(layout.stars), '星级宝箱', { size: 27, font: 'body', bold: true, color: CAMPAIGN_TEXT.ink, w: 286, h: compact ? 32 : 38, align: 'left' });
      mainLabel(body, 199, by(layout.stars), stars + '/3', { size: 23, bold: true, color: CAMPAIGN_TEXT.ink, w: 210, h: 34, align: 'right' });
      star(body, 321, by(layout.stars), 28, true);
      campaignChestBackdrop(body,by(layout.chest+27),compact);
      const rewards = starChestRewards(lv.id, st.d);
      for (let t = 0; t < 3; t++) {
        const tier = t + 1, done = claimed >= tier, canClaim = stars >= tier && !done;
        const spot = N('campaignStarChest:' + tier, body, (t - 1) * 226, by(layout.chest), 218, 216);
        mainLabel(spot, 0, layout.chestLabel, CHEST_COND[t], { size: 19, font: 'body', color: CAMPAIGN_TEXT.body, w: 214, h: compact ? 26 : 30 });
        const chest = campaignPreparationArt(spot, 0, layout.chestArt, layout.chestW, layout.chestH,
          ['chest_bronze_v2','chest_sapphire_v2','chest_crimson_v2'][t]);
        if (!done && !canClaim) chest.addComponent(UIOpacity).opacity = 205;
        if (done) { chest.addComponent(UIOpacity).opacity = 215; comicMark(spot, 52, layout.chestArt-28, 'check', 23, COMIC.greenShade); }
        const reward = rewards[t];
        comicArt(spot, -38, layout.amount, 28, 28, reward.gold ? 'comic_coin_v1' : 'comic_diamond_v1');
        mainLabel(spot, 16, layout.amount, String(reward.gold || reward.diamonds), { size: compact ? 22 : 25, bold: true, color: CAMPAIGN_TEXT.ink, w: 88, h: compact ? 28 : 32 });
        const claim = comicSurface(spot,0,layout.claim,188,layout.claimH,canClaim ? 'gold' : 'paper',
          {name:'campaignClaimAll:'+tier,radius:6,fill:done ? '#EAE8D3' : canClaim ? COMIC.gold : '#FFF8E7'});
        if (canClaim) campaignPreparationArt(claim,0,0,188,layout.claimH,'claim_button_v2',true,true);
        if (done) comicMark(claim,-60,0,'check',18,COMIC.greenShade);
        mainLabel(claim, done ? 10 : 0, 0, done ? '已领取' : canClaim ? '一键领取' : '未达成',
          { size:compact ? 20 : 22,font:'body',bold:canClaim || done,color:done ? COMIC.greenShade : canClaim ? CAMPAIGN_TEXT.ink : CAMPAIGN_TEXT.secondary,w:166,h:32 });
        if (canClaim) bindButton(claim, () => {
          if (claiming) return;
          claiming = true;
          const result = claimAllChests(key);
          if (result.ok === false) { claiming = false; toast(result.msg, { kind: 'warning' }); return; }
          ctx.refreshResources?.(); renderSheet(); renderPins();
          showRewardPopup(modalParent, lv.id + ' · ' + DIFFS[challenge.difficulty], result.chestCount, [
            { name: '金币', icon: 'comic_coin_v1', amount: result.gold },
            { name: '钻石', icon: 'comic_diamond_v1', amount: result.diamonds },
          ], () => { claiming = false; });
        }, { dragThreshold: 7 });
      }
      mainLabel(body, -194, by(layout.drops), '关卡掉落', { size: 27, font: 'body', bold: true, color: CAMPAIGN_TEXT.ink, w: 286, h: 38, align: 'left' });
      const details = N('campaignDropDetails', body, 283, by(layout.drops), 106, 44);
      mainLabel(details, 0, 0, '详情 ›', { size: 20, font: 'body', color: CAMPAIGN_TEXT.body, w: 100, h: 34 });
      bindButton(details, () => showStageLootDetails(modalParent, challenge), { dragThreshold: 7 });
      stageGuaranteedRewards(body, 0, by(layout.materials), 664, challenge,
        id => showDropItemDetails(modalParent, challenge, id), compact ? 64 : 80, true);
      campaignEquipmentHeading(body,by(layout.equipment));
      const equipmentTitle = mainLabel(body, 0, by(layout.equipment), '概率掉落装备',
        { size:20,font:'body',bold:true,color:CAMPAIGN_TEXT.heading,w:170,h:30 });
      equipmentTitle.getComponent(Label)!.spacingX = 1.4;
      const equipmentH = layout.icon*1.5+(layout.rowStep-layout.icon)+12;
      const equipmentView = N('campaignEquipmentScrollView',body,0,by(layout.row+equipmentH/2),664,equipmentH);
      equipmentView.addComponent(Mask);
      const equipmentScroll = equipmentView.addComponent(ScrollView);
      const rows = Math.ceil(challenge.gearPool.length/6);
      const equipmentContentH = Math.max(equipmentH,12+layout.icon+Math.max(0,rows-1)*layout.rowStep);
      const equipment = N('campaignEquipmentScrollContent',equipmentView,0,equipmentH/2,664,equipmentContentH);
      equipment.getComponent(UITransform)!.setAnchorPoint(.5,1);
      equipmentScroll.content = equipment; equipmentScroll.horizontal = false;
      equipmentScroll.vertical = equipmentContentH>equipmentH;
      equipmentScroll.elastic = false; equipmentScroll.inertia = true; equipmentScroll.brake = .72;
      equipmentScroll.cancelInnerEvents = true;
      challenge.gearPool.forEach((row, i) => {
        const rowIndex = Math.floor(i/6), columns = Math.min(6, challenge.gearPool.length-rowIndex*6);
        const icon = stageDropIcon(equipment,(i%6-(columns-1)/2)*106,-6-layout.icon/2-rowIndex*layout.rowStep,layout.icon,row.id);
        bindButton(icon, () => showDropItemDetails(modalParent, challenge, row.id), { dragThreshold: 7, sound: false });
      });
      if (challenge.gearPool.length) {
        const pct = (n: number): string => (n * 100).toFixed(2) + '%';
        mainLabel(body, 0, by(layout.chance), '普通怪 ' + pct(equipmentDropChance(st.d)) + ' · 精英怪 ' + pct(equipmentDropChance(st.d, { elite: true })),
          { size: 17, font: 'body', color: CAMPAIGN_TEXT.body, w: 660, h: 28 });
        } else mainLabel(equipment,0,-equipmentH/2,challenge.id === '1-7' && challenge.difficulty === 0
          ? '推荐英雄Lv.6、武器Lv.3\n投石手与萨满配合 · 金币与强化石' : challenge.id === '1-6' && challenge.difficulty === 0
          ? '推荐英雄Lv.5、武器Lv.3\n狼骑分批突袭 · 金币与强化石' : challenge.id === '1-5' && challenge.difficulty === 0
          ? '推荐英雄Lv.5、武器Lv.3\n' + (fifthRewardsAvailable(challenge.id, challenge.difficulty)
            ? '首胜：巡林轻弩＋月纹坠饰' : '通关获得金币和强化石') : challenge.id === '1-4' && challenge.difficulty === 0
          ? '推荐英雄Lv.3、武器Lv.2\n通关获得金币和强化石' : firstBowAvailable(challenge.id, challenge.difficulty)
          ? '首次通关必得绿色猎风长弓\n回营后在英雄页穿戴' : pyroRewardAvailable(challenge.id, challenge.difficulty)
          ? '首次通关免费获得火法师\n回营后手动加入第三个出战位置' : firstBookAvailable(challenge.id, challenge.difficulty)
          ? '首次通关必得绿色翠纹秘典\n火法师适用，直接存入背包' : '普通难度不掉落装备\n挑战精英 / 地狱解锁装备掉落',
        { size: 19, font: 'body', color: CAMPAIGN_TEXT.secondary, w: 660, h: 68, lineHeight: 32 });
      const startBattle = (): void => {
        if (!open || closing || enteringBattle()) return;
        if (!campaignDifficultyOpen(lv.id, challenge.difficulty, loadSave().stars)) { toast('请先通关前置关卡或难度'); return; }
        if (lv.id === '1-2' && challenge.difficulty === 0 && pendingUpgradeLesson() && ctx.navigate) {
          loadSave().curHero = 'archer'; saveSave();
          flow.levelReturn = { id: '1-2', diff: 0 };
          ctx.navigate(3); return;
        }
        if (!squadList().length) { toast('请先上阵英雄'); return; }
        enterBattle(done => {
          flow.mode = 'battle'; flow.levelId = lv.id; flow.diff = challenge.difficulty;
          return director.loadScene('Main', error => {
            if (!error && lv.id === '1-2' && challenge.difficulty === 0) finishSecondEntryLesson();
            done(error);
          });
        }, () => {
          flow.mode = 'main';
          if (content.isValid) toast('进入战斗失败，请重试', { kind: 'warning', title: '进入战斗失败' });
        }, warmBattlefield(lv.id, squadList()));
      };
      const battle = comicButtonControl(panel, 0, y(sheetH - 51), 664, 78, '', startBattle,
        { tone: open ? 'gold' : 'muted', name: 'campaignStartBattle', enabled: open });
      const battleFace = battle.node.getChildByName('buttonFace')!;
      paintCampaignMapAction(battleFace,664,78,'gold',open);
      if (open) levelArt(battleFace,-124,0,55,55,'comic_swords_v1');
      else comicMark(battleFace,-139,0,'lock',28,COMIC.sub);
      mainLabel(battleFace,30,0,open ? '开始战斗' : '通关前置关卡解锁',
        { size: open ? 36 : 26, font: 'body', bold: true, color: CAMPAIGN_TEXT.ink, w: 414, h: 50 });
      if (lv.id === '1-2' && challenge.difficulty === 0 && open && pendingSecondEntryLesson()) whenUIArtReady(ctx.screens, () => {
        if (!panel.isValid || !panel.activeInHierarchy || !battle.node.isValid || !pendingSecondEntryLesson()) return;
        tutorialFocus(content, battle.node, '准备完成！这是第二关「废弃岗亭」，点击开始战斗。',
          startBattle, () => finishSecondEntryLesson(true));
      });
    });
  }
  function renderWorld(): void {
    const chapterNumber = currentChapter() + 1, save = loadSave();
    if (save.viewedChapter !== chapterNumber) { save.viewedChapter = chapterNumber; saveSave(); }
    GameAudio.setChapter(chapterNumber);
    refreshUI(content, () => {
      mapScroll = null; drawer = null; shade = null; closing = false;
      const chapter = currentChapter();
      const map = pageScroll(content, 'campaignTerrain', mapTop, bottom, mapContentH, 750);
      campaignTerrainCrown(map, mapInsetTop, chapter);
      artSprite(map, 0, -mapInsetTop - mapHeight / 2, ROUTE_W * mapHeight / ROUTE_H, mapHeight, ROUTE_ART[chapter], { sliced: false });
      mapScroll = map.parent!.getComponent(ScrollView)!;
      mapScroll.inertia = true; mapScroll.brake = .65; mapScroll.elastic = false; mapScroll.cancelInnerEvents = true;
      map.parent!.on('scrolling', saveOffset); map.parent!.on('scroll-ended', saveOffset);
      pins = N('campaignLiveCheckpoints', map, 0, -mapInsetTop);
      renderPins();
      const firstStage = LEVELS[chapter * 10];
      if (!levelOpen(firstStage.order)) {
        const locked = N('campaignLockedTerrainShade', content, 0, WY(mapTop, mapViewH), 750, mapViewH);
        const ink = locked.addComponent(Graphics);
        ink.fillColor = CA(COMIC.darkShade, .48);
        ink.rect(-375, -mapViewH / 2, 750, mapViewH); ink.fill();
        const badgeTop = chapterTop + 96 + Math.max(0, dockTop - chapterTop - 96) * .43;
        const badge = N('campaignChapterLocked', content, 0, WY(badgeTop), 650, 186);
        comicMark(badge, 0, 50, 'lock', 54, COMIC.cream);
        mainLabel(badge, 0, -8, CAMPAIGN_CHAPTERS[chapter].name + ' · 尚未解锁',
          { size: 32, color: COMIC.cream, bold: true, w: 610, h: 46, outline: COMIC.darkShade, outlineW: 2 });
        const previous = LEVELS[firstStage.order - 1];
        mainLabel(badge, 0, -54, '通关 ' + previous.id + ' ' + previous.name + ' 后解锁',
          { size: 23, color: '#E7D2A5', w: 630, h: 38, outline: COMIC.darkShade, outlineW: 2 });
      }
      const top = N('campaignTopInputGuard', content, 0, WY(0, chapterTop + 108), 750, chapterTop + 108);
      top.addComponent(BlockInputEvents);
      header = N('campaignHeader', content); renderHeader();
      dock = N('campaignDock', content); renderDock();
      if (st.drawer) {
        if (st.offsets[chapter] === null) {
          const p = routePoint(LEVELS[st.i].stage, mapHeight);
          st.offsets[chapter] = Math.max(0, Math.min(mapContentH - mapViewH,
            mapTop + mapInsetTop + p.top - chapterTop - (dockTop - chapterTop) * .62));
        }
        scrollMap(st.offsets[chapter]!, false);
        openDrawer(false);
      }
      else if (st.offsets[chapter] !== null) scrollMap(st.offsets[chapter]!, false);
      else { focusMap(false); saveOffset(); }
      warmSelected();
    });
  }
  renderWorld();
}
