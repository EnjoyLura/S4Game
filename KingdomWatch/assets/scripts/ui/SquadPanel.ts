/** Comic formation overlay; squad order and the existing deploy/remove rules stay in GameData. */
import { director, Director, isValid, Node, ScrollView, UIOpacity, Vec2 } from 'cc';
import { LO } from '../config/GameConfig';
import { dimLayer, N, WY } from './UIKit';
import { COMIC, comicArt, comicButton, comicMark, comicPlate } from './ComicUI';
import { heroPortrait } from './HeroComic';
import { mainLabel, pageScroll, PageCtx, toast } from './PageKit';
import { HERO_DEFS, SQUAD_MAX, deployHero, inSquad, squadList, undeployHero } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { finishPyroSquadLesson, pendingPyroSquadLesson } from '../core/SecondJourney';
import { tutorialFocus } from './TutorialFocus';
import { trackUISurface, whenUIArtReady } from './UIArtReady';
import { bindButton } from './ButtonFeedback';
import { dismissUI, dismissUIAfterRefresh, motionIn } from './UIMotion';
import { uiSound } from './UIAudio';
import { bindBrowserBack } from './BrowserBack';
import { campaignChapterArrow, campaignChapterPlate, paintCampaignMapAction } from './CampaignChrome';
import { paintSquadCard, paintSquadFrame, squadDivider, squadHallBackground, squadPortraitRim, squadWatermark } from './SquadChrome';
import { detailActionY, detailDialog, detailFooter } from './DetailDialog';

export function openSquadPanel(ctx: PageCtx): void {
  const root = ctx.screens.parent;
  if (!root || root.getChildByName('levelSquadOverlay')) return;
  const dim = dimLayer(root, 1);
  dim.name = 'levelSquadOverlay';
  dim.setSiblingIndex(root.children.length - 1);
  squadHallBackground(dim,LO.half*2,WY(0,440),WY(420,Math.max(1,LO.half*2-420)));
  const top = Math.max(48, LO.notchTop + 20);
  let closing = false;
  let taughtPyro = false;
  let bodyOffset = 0;
  let releaseBack = (): void => {};
  const close = (): void => {
    if (closing || !dim.isValid) return;
    if (pendingPyroSquadLesson()) finishPyroSquadLesson(true);
    closing = true; releaseBack();
    dismissUIAfterRefresh(dim, ctx.screens, ctx.refresh);
  };
  releaseBack = bindBrowserBack(dim, close);
  const title = campaignChapterPlate(dim,0,WY(top+9,66),374,66);
  title.name = 'squadTitlePlaque';
  mainLabel(title,0,0,'出战编队',{size:36,font:'body',bold:true,color:'#FFF2D0',w:280,h:52});
  const back = comicButton(dim,-307,WY(top+9,58),70,58,'',close,{tone:'dark',name:'squadBack',sound:'close'});
  const backFace = back.getChildByName('buttonFace')!;
  paintCampaignMapAction(backFace,70,58,'navy');
  campaignChapterArrow(backFace,-1,true);
  const body = N('squadBody', dim);
  const actions = N('squadActions', dim);
  let removeModal: Node | null = null;
  rebuild();
  motionIn(body, 'page'); uiSound('open');

  function rebuild(): void {
    body.destroyAllChildren();
    actions.destroyAllChildren();
    const sq = squadList(), sv = loadSave();
    const formTop = top + 108;
    const defs = Object.values(HERO_DEFS), columns = Math.min(5, Math.max(1, defs.length));
    const rows = Math.max(1, Math.ceil(defs.length / columns)), cardW = 126, cardH = 206, rowStep = 218;
    const barTop = formTop + 332, rosterH = 66 + rows * cardH + (rows - 1) * 12 + 18;
    const noteTop = barTop + rosterH + 30;
    const availableH = LO.half * 2 - LO.safeTop - LO.safeBottom, doneTop = availableH - 126;
    const bodyTop = top + 96, bodyBottom = doneTop - 18;
    const contentH = noteTop + 88 - bodyTop, viewH = Math.max(1, bodyBottom - bodyTop);
    const content = pageScroll(body, 'squadBody', bodyTop, bodyBottom, contentH, 750);
    const scroll = content.parent!.getComponent(ScrollView)!;
    scroll.elastic = false; scroll.cancelInnerEvents = true;
    const maxOffset = Math.max(0, contentH - viewH);
    const offset = Math.min(bodyOffset, maxOffset), positionReady = trackUISurface(scroll.node);
    let positioned = false;
    const restore = (): void => {
      if (isValid(scroll, true)) { scroll.scrollToOffset(new Vec2(0, offset), 0); bodyOffset = offset; positioned = true; }
      positionReady();
    };
    director.once(Director.EVENT_BEFORE_DRAW, restore);
    scroll.node.once(Node.EventType.NODE_DESTROYED, () => { director.off(Director.EVENT_BEFORE_DRAW, restore); positionReady(); });
    scroll.node.on(ScrollView.EventType.SCROLLING, () => {
      if (positioned) bodyOffset = Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y));
    });
    const by = (at: number, height = 0): number => -(at - bodyTop) - height / 2;
    const formation = comicPlate(content, 0, by(formTop, 260), 704, 260, 'dark', { name: 'squadFormation' });
    paintSquadFrame(formation,704,260);
    comicArt(formation, -303, 98, 34, 34, 'comic_helm_falcon_v1');
    mainLabel(formation, -158, 97, '战斗站位', { size: 26, bold: true, color: COMIC.cream, w: 228, h: 38, align: 'left' });
    mainLabel(formation, 208, 97, '已上阵 ' + sq.length + '/' + SQUAD_MAX, { size: 23, color: '#DDE1E2', bold: true, w: 240, h: 34, align: 'right' });
    for (let i = 0; i < SQUAD_MAX; i++) {
      const hid = sq[i], x = (i - 1.5) * 170;
      const slot = comicPlate(formation, x, -21, 156, 192, hid ? 'card' : 'dark', { name: 'squadSlot:' + i });
      paintSquadCard(slot,156,192,!!hid,!!hid,'position');
      mainLabel(slot, -58, 75, String(i + 1), { size: 18, color: hid ? COMIC.sub : COMIC.muted, w: 28, h: 25 });
      if (hid) {
        const def = HERO_DEFS[hid];
        squadPortraitRim(slot,24,50,true);
        heroPortrait(slot, 0, 24, 96, hid);
        mainLabel(slot, 0, -43, def.name.replace('·', ''), { size: 23, color: COMIC.text, bold: true, w: 142, h: 32 });
        mainLabel(slot, 0, -73, 'Lv.' + (sv.heroes[hid]?.lv || 1), { size: 19, color: COMIC.sub, w: 128, h: 26 });
        comicMark(slot, 57, 69, 'check', 20, COMIC.greenShade);
        bindButton(slot, () => confirmRemove(hid));
      } else {
        comicMark(slot, 0, 12, 'plus', 42, '#687582');
        mainLabel(slot, 0, -56, '待上阵', { size: 22, color: '#ADB7BE', w: 134, h: 32 });
      }
    }
    mainLabel(content, 0, by(formTop + 286, 32), '从左到右依次站位 · 点击已上阵英雄可下阵',
      { size:20,color:COMIC.sub,w:566,h:32 });
    squadDivider(content,-279,by(formTop+286,32),108);
    squadDivider(content,279,by(formTop+286,32),108);
    const bar = comicPlate(content, 0, by(barTop, rosterH), 704, rosterH, 'paper', { name: 'squadHeroRoster' });
    paintSquadFrame(bar,704,rosterH,true);
    const headerY = rosterH / 2 - 33;
    comicArt(bar, -301, headerY + 1, 34, 34, 'comic_helm_falcon_v1');
    mainLabel(bar,-134,headerY,'选择出战英雄',{size:27,font:'body',bold:true,color:'#FFF4DA',w:276,h:38,align:'left'});
    defs.forEach((def, i) => {
      const dep = inSquad(def.id), owned = !!sv.heroes[def.id]?.owned;
      const x = (i % columns - (columns - 1) / 2) * 134;
      const y = rosterH / 2 - 66 - cardH / 2 - Math.floor(i / columns) * rowStep;
      const card = comicPlate(bar, x, y, cardW, cardH,
        dep ? 'gold' : 'card', { name: 'squadHero:' + def.id });
      paintSquadCard(card,126,206,dep);
      squadPortraitRim(card,37,49,dep);
      const portrait = heroPortrait(card,0,37,94,def.id);
      if (!owned) { portrait.addComponent(UIOpacity).opacity = 135; comicMark(card,0,37,'lock',29,COMIC.cream); }
      mainLabel(card, 0, -29, def.name.replace('·', ''), { size: 22, color: COMIC.text, bold: true, w: 114, h: 32 });
      mainLabel(card, 0, -59, 'Lv.' + (sv.heroes[def.id]?.lv || 1), { size: 18, color: COMIC.sub, w: 108, h: 26 });
      mainLabel(card,0,-85,dep ? '已上阵' : owned ? '点击上阵' : '尚未解锁',{size:17,color:dep ? COMIC.greenShade : COMIC.sub,w:116,h:26});
      if (dep) comicMark(card, 46, 78, 'check', 19, COMIC.greenShade);
      const select = (): void => {
        if (dep) { confirmRemove(def.id); return; }
        const teaching = def.id === 'pyro' && pendingPyroSquadLesson();
        const result = deployHero(def.id);
        toast(result.msg, { kind: result.ok ? 'success' : 'warning', title: result.ok ? '编队已更新' : '暂时无法上阵' });
        if (result.ok && teaching) {
          finishPyroSquadLesson(); taughtPyro = true;
        }
        if (result.ok) rebuild();
      };
      bindButton(card, select);
      if (def.id === 'pyro' && owned && !dep && pendingPyroSquadLesson()) whenUIArtReady(body, () => {
        if (!card.isValid || !card.activeInHierarchy || !pendingPyroSquadLesson()) return;
        tutorialFocus(dim, card, '火法师已免费加入！点击将他放入空余出战位置，准备挑战1-3。', select,
          () => finishPyroSquadLesson(true));
      });
    });
    mainLabel(content, 0, by(noteTop, 36), '最多上阵 4 位英雄', { size: 26, bold: true, color: COMIC.text, w: 600, h: 36 });
    squadDivider(content,-203,by(noteTop,36),112);
    squadDivider(content,203,by(noteTop,36),112);
    mainLabel(content, 0, by(noteTop + 46, 32), '点击英雄加入编队，阵容自动保存', { size: 22, color: COMIC.sub, w: 650, h: 32 });
    const markTop = noteTop+112+(availableH-126-noteTop-112)*.48;
    if (contentH <= viewH && markTop>noteTop+150) squadWatermark(content,by(markTop));
    const done = comicButton(actions,0,WY(doneTop,88),390,88,'',close,{tone:'gold',name:'squadDone'});
    const doneFace = done.getChildByName('buttonFace')!;
    paintCampaignMapAction(doneFace,390,88,'gold');
    mainLabel(doneFace,0,0,'完成编队',{size:34,font:'body',bold:true,color:'#1C2D33',w:284,h:50});
    squadDivider(doneFace,-138,0,40,true); squadDivider(doneFace,138,0,40,true);
    if (taughtPyro) whenUIArtReady(body, () => {
      if (!done.isValid || !done.activeInHierarchy) return;
      taughtPyro = false;
      tutorialFocus(dim, done, '火法师已上阵，点击完成编队，前往1-3。', close, close);
    });
  }

  function confirmRemove(hid: string): void {
    if (removeModal?.isValid) return;
    const panel = detailDialog(dim, 548, 360, '下阵确认', 'squadRemoveDialog');
    const modal = panel.parent!;
    removeModal = modal;
    bindBrowserBack(modal, () => dismissUI(modal));
    heroPortrait(panel, -165, 13, 100, hid);
    mainLabel(panel, 51, 29, '将 ' + HERO_DEFS[hid].name + ' 下阵？',
      { size: 25, color: '#1D303E', bold: true, w: 310, h: 40 });
    mainLabel(panel, 51, -21, '之后可以随时重新上阵', { size: 21, color: COMIC.sub, w: 312, h: 36 });
    detailFooter(panel);
    const actionY = detailActionY(panel);
    comicButton(panel, -126, actionY, 222, 58, '取消', () => dismissUI(modal),
      { tone: 'dark', size: 25, name: 'squadRemoveCancel', sound: 'close' });
    comicButton(panel, 126, actionY, 222, 58, '确认下阵', () => {
      const result = undeployHero(hid);
      toast(result.msg, { kind: result.ok ? 'success' : 'warning', title: result.ok ? '编队已更新' : '操作未完成' });
      dismissUI(modal, () => { if (result.ok) rebuild(); }, false);
    }, { tone: 'green', size: 25, name: 'squadRemoveConfirm', sound: 'confirm' });
  }
}
