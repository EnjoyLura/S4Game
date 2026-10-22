import { CHAPTER_CONTENT } from '../../config/ChapterContent';
/** A dedicated secondary world map. Terrain is replaceable; chapter progress and loot are live UI. */
import { BlockInputEvents, director, Graphics, Mask, Node, ScrollView, UITransform } from 'cc';
import { LO } from '../../config/GameConfig';
import { CAMPAIGN_CHAPTERS } from '../../config/Campaign';
import { endlessChallenge, endlessMobPool, endlessOpen } from '../../config/Endless';
import { endlessBest } from '../../core/EndlessProgress';
import { SQUAD_MAX, squadList } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';
import { C, CA, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicMark, comicSurface } from '../ComicUI';
import { mainLabel, mainResourceTop, MAIN_RESOURCE_H, PageCtx, toast } from '../PageKit';
import { bindButton } from '../ButtonFeedback';
import { bindBrowserBack } from '../BrowserBack';
import { openSquadPanel } from '../SquadPanel';
import { enterBattle, enteringBattle } from '../BattleEntry';
import { warmBattlefield } from '../BattleEntryWarmup';
import { campaignChapterArrow, campaignChapterBanner, campaignChapterPlate, campaignPreparationPanel,
  paintCampaignMapAction } from '../CampaignChrome';
import { paintCampaignCheckpoint, campaignCheckpointLock } from '../CampaignCheckpointArt';
import { CampaignRouteMotion } from '../CampaignRoute';
import { ENDLESS_MAP_H, ENDLESS_MAP_W, EndlessCamera, EndlessMapController } from '../EndlessMapController';
import { endlessDropRates, endlessEquipmentHeading, endlessGoldCard, showEndlessLootDetails } from '../EndlessLootPreview';
import { stageDropIcon, showDropItemDetails } from '../LevelLootPreview';

const state = { chapter: 1, initialized: false, camera: { u: .46, v: .68, zoom: 1.12 } as EndlessCamera };
// Temporary geography is deliberately independent of the campaign chapter count.
const REGIONS = CHAPTER_CONTENT.map(c => c.mapPoint);
function region(index: number): { u: number; v: number } {
  const p = REGIONS[index] || [.2 + index % 4 * .2, .15 + Math.floor(index / 4) % 4 * .16];
  return { u: p[0], v: p[1] };
}

export function buildEndless(ctx: PageCtx): void {
  const height = LO.half * 2 - LO.safeTop - LO.safeBottom;
  const root = N('endlessWorldMapPage', ctx.screens, 0, 0, 750, LO.half * 2);
  const top = mainResourceTop() + MAIN_RESOURCE_H + 14, headerBottom = top + 90;
  const bottom = height - 16;
  const sv = loadSave();
  if (!state.initialized) {
    const unlocked = CAMPAIGN_CHAPTERS.filter(c => endlessOpen(c.number, sv.stars));
    state.chapter = unlocked.length ? unlocked[unlocked.length - 1].number : CAMPAIGN_CHAPTERS[0].number;
    const p = region(CAMPAIGN_CHAPTERS.findIndex(c => c.number === state.chapter));
    state.camera.u = p.u; state.camera.v = p.v; state.initialized = true;
  }
  if (!CAMPAIGN_CHAPTERS.some(c => c.number === state.chapter)) state.chapter = CAMPAIGN_CHAPTERS[0].number;
  const map = N('endlessMapViewport', root, 0, WY(0, height), 750, height);
  map.addComponent(Mask);
  const world = N('endlessWorldTerrain', map, 0, 0, ENDLESS_MAP_W, ENDLESS_MAP_H);
  artSprite(world, 0, 0, ENDLESS_MAP_W, ENDLESS_MAP_H, 'scenes/bg_endless_world_v66', { sliced: false, fit: false });
  const pins = N('endlessChapterPins', world);
  const camera = map.addComponent(EndlessMapController);
  const header = N('endlessFloatingChapter', root);
  const dock = N('endlessDeploymentDock', root);
  const controls = N('endlessMapTools', root);
  let shade: Node | null = null, drawer: Node | null = null, directory: Node | null = null;
  let closing = false, releaseDrawer: (() => void) | null = null;
  const selected = () => CAMPAIGN_CHAPTERS.find(c => c.number === state.chapter)!;
  const isOpen = () => endlessOpen(state.chapter, loadSave().stars);

  const back = (): void => { if (!enteringBattle()) ctx.navigate?.(4); };
  bindBrowserBack(root, back);
  // The back arrow stays at the original upper-left position, without a full-width header strip.
  const backButton = comicButton(root, -322, WY(Math.max(20, LO.notchTop + 12), 58), 62, 58, '', back,
    { name: 'endlessBackToBase', tone: 'gold', sound: 'close' });
  const arrow = N('endlessBackArrow', backButton.getChildByName('buttonFace')!).addComponent(Graphics);
  arrow.fillColor = C(COMIC.text); arrow.moveTo(-18,0); arrow.lineTo(-2,16); arrow.lineTo(-2,7);
  arrow.lineTo(18,7); arrow.lineTo(18,-7); arrow.lineTo(-2,-7); arrow.lineTo(-2,-16); arrow.close(); arrow.fill();
  comicButton(root, 268, WY(Math.max(20, LO.notchTop + 12), 54), 166, 54, '章节目录', () => openDirectory(),
    { name: 'endlessChapterDirectory', tone: 'dark', size: 22 });

  function renderHeader(): void {
    header.destroyAllChildren();
    const plaque = campaignChapterBanner(header, 0, WY(top, 90), 686, 90);
    mainLabel(plaque, 0, 17, '无尽挑战', { size: 32, bold: true, color: COMIC.cream, w: 500, h: 40 });
    mainLabel(plaque, 0, -21, '第' + state.chapter + '章 · ' + selected().name + (isOpen()
      ? ' · 最高 ' + endlessBest(state.chapter) + ' 层' : ' · 通关' + state.chapter + '-10解锁'),
      { size: 20, color: COMIC.cream, w: 504, h: 30 });
    const index = CAMPAIGN_CHAPTERS.indexOf(selected());
    [-1,1].forEach(dir => {
      const enabled = !!CAMPAIGN_CHAPTERS[index + dir], n = N('endlessChapterArrow:' + dir, plaque, dir * 303, 0, 68, 82);
      campaignChapterArrow(n, dir, enabled);
      bindButton(n, () => { if (enabled) selectChapter(CAMPAIGN_CHAPTERS[index + dir].number); }, { enabled: () => enabled });
    });
  }
  function renderPins(): Node[] {
    pins.destroyAllChildren();
    const nodes: Node[] = [];
    CAMPAIGN_CHAPTERS.forEach((c, index) => {
      const p = region(index), open = endlessOpen(c.number, loadSave().stars), active = c.number === state.chapter;
      const pin = N('endlessChapter:' + c.number, pins, (p.u - .5) * ENDLESS_MAP_W, (.5 - p.v) * ENDLESS_MAP_H, 120, 150);
      nodes.push(pin);
      if (active) N('endlessSelectionGlow', pin).addComponent(CampaignRouteMotion).glow();
      paintCampaignCheckpoint(pin, index % 3, active && open, open);
      mainLabel(pin, 0, 22, String(c.number), { size: 28, bold: true, color: COMIC.cream, outline: COMIC.ink, outlineW: 2, w: 58, h: 38 });
      if (!open) campaignCheckpointLock(pin);
      const tag = campaignChapterPlate(pin, 0, -65, 164, 32);
      mainLabel(tag, 0, 0, c.name, { size: 19, color: COMIC.cream, bold: true, w: 132, h: 28 });
      bindButton(pin, () => { if (camera.canTap()) selectChapter(c.number, false); }, { motion: false, dragThreshold: 7 });
    });
    // Unauthored biomes are marked as future regions, never fake playable chapters.
    for (let i = CAMPAIGN_CHAPTERS.length; i < REGIONS.length; i++) {
      const p = region(i), n = N('endlessFutureRegion:' + i, pins, (p.u - .5) * ENDLESS_MAP_W, (.5 - p.v) * ENDLESS_MAP_H, 100, 100);
      nodes.push(n); paintCampaignCheckpoint(n, 0, false, false); campaignCheckpointLock(n);
      mainLabel(n, 0, -67, '待开放', { size: 17, color: COMIC.cream, outline: COMIC.ink, outlineW: 2, w: 120, h: 28 });
    }
    return nodes;
  }
  function selectChapter(chapter: number, focus = true): void {
    if (drawer || directory || enteringBattle()) return;
    state.chapter = chapter; renderHeader(); renderDock();
    camera.configurePins(renderPins());
    if (focus) {
      const p = region(CAMPAIGN_CHAPTERS.findIndex(c => c.number === chapter));
      camera.focus(p.u, p.v, WY(headerBottom + 30, Math.max(1, bottom - 140 - headerBottom)));
    }
  }
  function renderDock(): void {
    dock.destroyAllChildren();
    const open = isOpen(), y = WY(bottom - 88, 82);
    const ready = comicButton(dock, -76, y, 510, 82, '', () => {
      if (!open) { toast('请先通关' + state.chapter + '-10'); return; }
      openPreparation();
    }, { name: 'endlessPrepare', tone: open ? 'gold' : 'muted' });
    const face = ready.getChildByName('buttonFace')!; paintCampaignMapAction(face, 510, 82, 'gold', open);
    if (open) comicArt(face, -148, 0, 58, 58, 'levels_comic_v1/comic_swords_v1');
    else comicMark(face, -148, 0, 'lock', 30, COMIC.sub);
    mainLabel(face, 34, 0, open ? '出战准备' : '通关' + state.chapter + '-10解锁',
      { size: open ? 34 : 27, bold: true, color: COMIC.text, w: 356, h: 48 });
    const squad = comicButton(dock, 262, y, 142, 82, '', () => {
      openSquadPanel({ ...ctx, refresh: () => { renderDock(); ctx.refreshResources?.(); } });
    }, { name: 'endlessFormation', tone: 'dark' });
    const sf = squad.getChildByName('buttonFace')!; paintCampaignMapAction(sf, 142, 82, 'navy');
    comicArt(sf, -39, 0, 46, 46, 'comic_helm_falcon_v1');
    mainLabel(sf, 20, 14, '编队', { size: 24, bold: true, color: COMIC.cream, w: 82, h: 34 });
    mainLabel(sf, 20, -20, squadList().length + '/' + SQUAD_MAX, { size: 18, color: COMIC.cream, w: 80, h: 28 });
  }
  function closeDrawer(): void {
    if (!drawer || closing || enteringBattle()) return;
    closing = true; releaseDrawer?.(); releaseDrawer = null;
    drawer.getComponent(CampaignRouteMotion)!.leave(() => {
      if (shade?.isValid) { shade.active = false; shade.removeFromParent(); shade.destroy(); }
      if (drawer?.isValid) { drawer.active = false; drawer.removeFromParent(); drawer.destroy(); }
      shade = null; drawer = null; closing = false; dock.active = controls.active = true;
    });
  }
  function openPreparation(): void {
    if (drawer || enteringBattle()) return;
    const challenge = endlessChallenge(state.chapter);
    // Keep Back and the resource bar above the sheet; smaller screens shorten only the equipment well.
    const sheetH = Math.min(810, height - Math.max(headerBottom + 14, 260));
    const sheetTop = height - sheetH;
    shade = N('endlessPreparationShade', root, 0, WY(0, height), 750, height);
    const g = shade.addComponent(Graphics); g.fillColor = CA(COMIC.ink, .22); g.rect(-375, -height/2, 750, height); g.fill();
    shade.addComponent(BlockInputEvents);
    bindButton(shade, closeDrawer, { sound: false, motion: false });
    drawer = campaignPreparationPanel(root, 0, WY(sheetTop, sheetH), 750, sheetH);
    drawer.addComponent(BlockInputEvents); drawer.addComponent(CampaignRouteMotion).enter();
    releaseDrawer = bindBrowserBack(drawer, closeDrawer);
    dock.active = controls.active = false;
    const panel = drawer, y = (t: number) => sheetH / 2 - t;
    comicSurface(panel, 0, y(16), 56, 5, 'paper', { fill: '#A38C63', radius: 2 });
    mainLabel(panel, -24, y(58), '第' + state.chapter + '章 · ' + selected().name + '挑战',
      { size: 34, bold: true, align: 'left', color: COMIC.text, w: 610, h: 48 });
    const close = N('endlessPreparationClose', panel, 324, y(51), 58, 58);
    comicMark(close, 0, 0, 'close', 28, COMIC.sub); bindButton(close, closeDrawer, { sound: 'close' });
    mainLabel(panel, -163, y(113), '最高已通 ' + endlessBest(state.chapter) + ' 层', { size: 23, bold: true, color: COMIC.text, w: 300, h: 36 });
    mainLabel(panel, 163, y(113), '从第1层开始', { size: 23, bold: true, color: COMIC.text, w: 300, h: 36 });
    mainLabel(panel, -2, y(157), '怪物范围：第1～' + state.chapter + '章 · 每5层首领层',
      { size: 21, align: 'left', color: COMIC.sub, w: 662, h: 34 });
    mainLabel(panel, -2, y(207), '挑战掉落', { size: 28, bold: true, align: 'left', color: COMIC.text, w: 662, h: 38 });
    endlessGoldCard(panel, y(270), 662);
    endlessEquipmentHeading(panel, y(337));
    const details = N('endlessDropDetails', panel, 291, y(337), 98, 44);
    mainLabel(details, 0, 0, '详情 ›', { size: 22, color: COMIC.sub, w: 98, h: 36 });
    bindButton(details, () => showEndlessLootDetails(ctx.screens.parent || ctx.screens, challenge));
    const gearTop = 365, gearBottom = sheetH - 182, gearH = Math.max(48, gearBottom - gearTop);
    const view = N('endlessEquipmentWell', panel, 0, y(gearTop + gearH/2), 662, gearH); view.addComponent(Mask);
    const scroll = view.addComponent(ScrollView), rowH = 92, rows = Math.ceil(challenge.gearPool.length / 6);
    const content = N('endlessEquipmentItems', view, 0, gearH/2, 662, Math.max(gearH, rows * rowH));
    content.getComponent(UITransform)!.setAnchorPoint(.5,1);
    scroll.content = content; scroll.horizontal = false; scroll.vertical = rows * rowH > gearH;
    scroll.elastic = false; scroll.cancelInnerEvents = true;
    challenge.gearPool.forEach((row, i) => {
      const tile = stageDropIcon(content, (i % 6 - 2.5) * 108, -44 - Math.floor(i / 6) * rowH, 80, row.id);
      bindButton(tile, () => showDropItemDetails(ctx.screens.parent || ctx.screens, challenge, row.id), { dragThreshold: 7 });
    });
    mainLabel(panel, 0, y(sheetH - 157), endlessDropRates(challenge), { size: 18, color: COMIC.sub, w: 662, h: 30 });
    mainLabel(panel, 0, y(sheetH - 123), '装备拾取入包 · 通层与结束挑战自动收取', { size: 18, color: COMIC.sub, w: 662, h: 28 });
    const start = comicButton(panel, 0, y(sheetH - 61), 664, 78, '', () => {
      if (enteringBattle() || closing) return;
      if (!isOpen()) { toast('请先通关' + state.chapter + '-10'); return; }
      const squad = squadList(); if (!squad.length) { toast('请先设置出战编队'); return; }
      const previous = { ...flow }, levelId = state.chapter + '-10';
      enterBattle(done => {
        flow.mode = 'battle'; flow.levelId = levelId; flow.diff = 0; flow.endlessChapter = state.chapter; flow.endlessPage = true;
        return director.loadScene('Main', done);
      }, () => { Object.assign(flow, previous); toast('进入挑战失败，请重试'); },
      warmBattlefield(levelId, squad, endlessMobPool(state.chapter)));
    }, { name: 'endlessStartBattle', tone: 'gold' });
    const face = start.getChildByName('buttonFace')!; paintCampaignMapAction(face, 664, 78, 'gold');
    comicArt(face, -124, 0, 55, 55, 'levels_comic_v1/comic_swords_v1');
    mainLabel(face, 30, 0, '开始战斗', { size: 36, bold: true, color: COMIC.text, w: 414, h: 50 });
  }
  function openDirectory(): void {
    if (directory || drawer || enteringBattle()) return;
    const h = Math.min(590, height - Math.max(110, LO.notchTop * 2));
    directory = N('endlessDirectoryOverlay', root, 0, 0, 750, LO.half * 2);
    const overlay = directory, shade = N('endlessDirectoryShade', overlay, 0, 0, 750, LO.half * 2);
    const ink = shade.addComponent(Graphics); ink.fillColor = CA(COMIC.ink, .5); ink.rect(-375,-LO.half,750,LO.half*2); ink.fill();
    shade.addComponent(BlockInputEvents);
    const close = (): void => { if (overlay.isValid) { overlay.active = false; overlay.removeFromParent(); overlay.destroy(); } directory = null; };
    bindButton(shade, close, { sound: 'close', motion: false }); bindBrowserBack(overlay, close);
    const panel = campaignPreparationPanel(overlay,0,0,650,h); panel.addComponent(BlockInputEvents);
    mainLabel(panel,0,h/2-45,'章节目录',{size:30,bold:true,color:COMIC.text,w:500,h:42});
    const x = N('endlessDirectoryClose',panel,280,h/2-42,54,54); comicMark(x,0,0,'close',26,COMIC.sub); bindButton(x,close);
    const viewH = Math.max(80,h-142), listView = N('endlessDirectoryView',panel,0,-9,596,viewH); listView.addComponent(Mask);
    const scroll = listView.addComponent(ScrollView), contentH = CAMPAIGN_CHAPTERS.length*100;
    const content = N('endlessDirectoryList',listView,0,viewH/2,596,Math.max(viewH,contentH)); content.getComponent(UITransform)!.setAnchorPoint(.5,1);
    scroll.content=content;scroll.horizontal=false;scroll.vertical=contentH>viewH;scroll.elastic=false;scroll.cancelInnerEvents=true;
    CAMPAIGN_CHAPTERS.forEach((c,i)=> {
      const open=endlessOpen(c.number,loadSave().stars);
      const b=comicButton(content,0,-48-i*100,574,84,'',()=>{close();selectChapter(c.number);},{tone:c.number===state.chapter?'gold':'dark'});
      mainLabel(b,-24,15,'第'+c.number+'章 · '+c.name,{size:25,bold:true,color:c.number===state.chapter?COMIC.text:COMIC.cream,w:494,h:34});
      mainLabel(b,0,-21,open?'最高已通 '+endlessBest(c.number)+' 层':'通关'+c.number+'-10解锁',{size:19,color:c.number===state.chapter?COMIC.text:COMIC.cream,w:500,h:28});
    });
    mainLabel(panel,0,-h/2+26,'新章节通关后开放对应的无尽挑战',{size:18,color:COMIC.sub,w:570,h:28});
  }
  const pinNodes = renderPins(); camera.configure(world,height,state.camera,pinNodes);
  renderHeader(); renderDock();
  const toolTop = Math.max(headerBottom + 32, bottom - 350);
  [['＋',()=>camera.zoomBy(1.22)],['－',()=>camera.zoomBy(1/1.22)],['定位',()=>{
    const p=region(CAMPAIGN_CHAPTERS.findIndex(c=>c.number===state.chapter));camera.focus(p.u,p.v);
  }]].forEach(([caption,action],i)=>comicButton(controls,316,WY(toolTop+i*66,56),60,56,caption as string,action as ()=>void,
    {name:'endlessMapTool:'+i,tone:'dark',size:i===2?18:32}));
}
