import { CHAPTER_CONTENT, EXPANSION_MOBS, enemyArtRef, chapterNumeral } from '../../config/ChapterContent';
/** A single painted settlement, shared comic controls and save-backed construction / codex. */
import { Graphics, isValid, Mask, Node, ScrollView, Sprite, UITransform, Vec2 } from 'cc';
import { C, CA, dimLayer, LabelOpts, N, WY } from '../UIKit';
import { artAtlasSprite, artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicDialogContent, comicMark, comicPlate, comicSurface } from '../ComicUI';
import { mainLabel as pageLabel, PageCtx, toast, fmt, mainLayout, mainResourceTop, MAIN_RESOURCE_H, pageScroll } from '../PageKit';
import { LO } from '../../config/GameConfig';
import { CODEX, CODEX_REWARD, claimCodexReward, codexClaimed, codexUnlocked, keepHp, keepShield, keepUpCost, upKeep, MAX } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { bindButton } from '../ButtonFeedback';
import { dismissUI, dismissUIAfterRefresh, refreshUI } from '../UIMotion';
import { whenUIArtReady } from '../UIArtReady';
import { uiSound } from '../UIAudio';
import { growthAction } from '../GrowthFeedback';
import { detailActionY, detailBody, detailFooter, detailHeight, detailOverview, detailRule, detailSection, detailSkin } from '../DetailDialog';
import { lobbyAttributeWell, shopDetailRule } from '../LobbyChrome';
import { BASE_INK, BASE_SUB, baseCodexCard, baseDiscoveryProgress, basePlaque, baseTextGroup } from '../BaseChrome';
import { showRewardPopup } from '../RewardPopup';
import { constructionPulse } from '../ConstructionPulse';
import { CAMPAIGN_CHAPTERS } from '../../config/Campaign';
import { endlessOpen } from '../../config/Endless';

const HEART = 'base_comic_v1/comic_keep_heart_v1';
const SHIELD = 'levels_comic_v1/comic_difficulty_shield_v1';
const HAMMER = 'upgrade_comic_v1/comic_training_hammer_v1';
const BOOK = 'hero_comic_v2/comic_story_v2';
const CASTLE = 'comic_nav_castle_v1';
let settlementOffset = 0, codexOffset = 0;
let codexChapter = 1;

function text(parent: Node, x: number, y: number, value: string, opts: LabelOpts = {}): Node {
  return pageLabel(parent, x, y, value, { font: 'body', color: BASE_INK, ...opts });
}
function tap(node: Node, cb: () => void): void {
  bindButton(node, cb, { scale: .98 });
}
function dot(parent: Node, x: number, y: number, value: number, name: string): void {
  const n = N(name, parent, x, y, 28, 28), g = n.addComponent(Graphics);
  g.fillColor = C('#D54D38'); g.circle(0, 0, 14); g.fill();
  g.strokeColor = C(COMIC.card); g.lineWidth = 2; g.circle(0, 0, 14); g.stroke();
  if (value) text(n, 0, 0, String(value), { size: 17, bold: true, color: COMIC.cream, w: 24, h: 24 });
}

/** A single dim layer survives list/detail navigation and consecutive construction upgrades. */
class BaseModalSession {
  private dim: Node;
  private surface: Node;
  private shown = false;
  private pending = false;
  private closing = false;
  private dirty = false;
  private back?: () => void;

  constructor(private ctx: PageCtx) {
    // A final page refresh must happen behind the dialog, rather than rebuilding its parent.
    this.dim = dimLayer(ctx.screens.parent || ctx.screens, .66);
    this.dim.name = 'baseModalSession';
    this.surface = N('baseModalContents', this.dim);
    this.dim.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
      if (e) e.propagationStopped = true;
      this.close();
    });
  }

  show(w: number, h: number, title: string, name: string, build: (panel: Node) => void,
    back?: () => void, direction = 0): void {
    if (this.closing || !isValid(this.dim, true)) return;
    const first = !this.shown;
    this.pending = true; this.shown = true; this.back = back;
    refreshUI(this.surface, () => {
      const panel = comicDialogContent(this.surface, w, h, title, () => this.close(), first);
      detailSkin(panel, w, h, title);
      panel.name = name; build(panel);
    }, direction);
    // Includes the full-opacity draw handoff; repeated taps cannot navigate a retiring view.
    whenUIArtReady(this.surface, () => { if (!this.closing) this.pending = false; });
    if (!first && direction) uiSound('select');
  }

  markDirty(): void { this.dirty = true; this.ctx.refreshResources?.(); }

  private close(): void {
    if (this.pending || this.closing || !isValid(this.dim, true)) return;
    if (this.back) { this.back(); return; }
    this.closing = true;
    if (this.dirty) dismissUIAfterRefresh(this.dim, this.ctx.screens, this.ctx.refresh);
    else dismissUI(this.dim);
  }
}

export function buildBase(ctx: PageCtx): void {
  const root = N('baseLobby', ctx.screens, 0, 0, 750, LO.half * 2);
  const sv = loadSave(), maxed = sv.keepLv >= MAX.keep, cost = keepUpCost(sv.keepLv);
  const discovered = CODEX.filter(c => codexUnlocked(c.id)).length;
  const rewards = CODEX.filter(c => codexUnlocked(c.id) && !codexClaimed(c.id)).length;
  const titleTop = mainResourceTop() + MAIN_RESOURCE_H + 20;
  const sceneTop = titleTop + 76, boardH = 306, boardTop = mainLayout().bottom - boardH, sceneBottom = boardTop - 12;
  const available = Math.max(1, sceneBottom - sceneTop), sceneH = Math.max(720, available), totalH = sceneTop + sceneH;
  // The illustration and hit targets share one transform. Architecture is painted on its ground.
  const upper = N('baseUpperScene', root, 0, WY(0, boardTop), 750, boardTop);
  upper.addComponent(Mask);
  const scene = pageScroll(root, 'baseSettlement', sceneTop, sceneBottom, sceneH, 750);
  const scroll = scene.parent!.getComponent(ScrollView)!; scroll.elastic = false;
  const maxOffset = sceneH - available;
  const anchors: { node: Node; u: number; v: number; height: number; width: number }[] = [];

  function building(key: string, u: number, v: number, width: number, height: number, title: string,
    subtitle: string, cb: () => void, locked = false): Node {
    const n = N('baseBuilding:' + key, scene, 0, 0, width, height + 136);
    anchors.push({ node: n, u, v, height, width });
    const foot = -height / 2 + 42;
    const plate = basePlaque(n, 0, foot - 22, key === 'keep' ? 254 : 246, 52,
      'baseName:' + key, key === 'keep' && !maxed, locked);
    if (locked) comicMark(plate, -80, 0, 'lock', 19, COMIC.cream);
    text(plate, locked ? 14 : 0, 0, title, { size: 28, bold: true, color: key === 'keep' && !maxed ? COMIC.text : COMIC.cream, w: locked ? 155 : 234, h: 40 });
    text(n, 0, foot - 62, subtitle, { size: 19, color: COMIC.cream, w: 316, h: 31, outline: COMIC.ink, outlineW: 2 });
    tap(n, cb); return n;
  }
  // Foundation centers are calibrated against the final illustration, not the prompt's requested coordinates.
  const keep = building('keep', .5, .469, 420, 334, `主城 · Lv.${sv.keepLv}`, maxed ? '主城建设已完成' : '点击查看建设', () => keepModal(ctx));
  if (!maxed && sv.gold >= cost) {
    const marker = comicSurface(keep, 142, -334 / 2 + 46, 44, 44, 'gold', { name: 'baseKeepReady', radius: 22 });
    comicArt(marker, 0, 0, 32, 32, HAMMER);
  }
  const academy = building('academy', .27, .715, 326, 252, '研究院',
    rewards ? `图鉴 ${discovered}/${CODEX.length} · ${rewards}份奖励可领` : `怪物图鉴 ${discovered}/${CODEX.length}`, () => codexModal(ctx));
  if (rewards) dot(academy, 121, -252 / 2 + 33, rewards, 'baseCodexBadge');
  const endlessCount = CAMPAIGN_CHAPTERS.filter(c => endlessOpen(c.number, sv.stars)).length;
  building('endless', .73, .747, 326, 252, '无尽挑战',
    endlessCount ? `已开放 ${endlessCount} 个挑战 · 点击攀层` : '通关1-10解锁', () => {
      if (!endlessCount) { toast('通关1-10后解锁无尽挑战'); return; }
      ctx.openEndless?.();
    }, !endlessCount);
  let artY = 0, mapWidth = 750, mapHeight = totalH;
  const updateAnchors = (): void => {
    anchors.forEach(a => a.node.setPosition(mapWidth * (a.u - .5), sceneTop - mapHeight * a.v + a.height / 2 - 42, 0));
  };
  const artwork = artSprite(upper, 0, (boardTop - totalH) / 2, 750, totalH, 'scenes/bg_base_endless_v59', {
    sliced: false, onLoaded: art => {
      const r = art.getComponent(Sprite)!.spriteFrame!.rect, k = Math.max(750 / r.width, totalH / r.height);
      mapWidth = r.width * k; mapHeight = r.height * k;
      art.getComponent(UITransform)!.setContentSize(mapWidth, mapHeight);
      artY = (boardTop - mapHeight) / 2;
      art.setPosition(0, artY + Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y)), 0);
      updateAnchors();
    },
  });
  updateAnchors();
  let thumb: Node | null = null, thumbH = 0;
  if (maxOffset > 0) {
    thumbH = Math.max(36, available * available / sceneH);
    thumb = N('baseScrollThumb', root, 369, WY(sceneTop, thumbH), 4, thumbH);
    const g = thumb.addComponent(Graphics); g.fillColor = CA(COMIC.cream, .75); g.roundRect(-2, -thumbH / 2, 4, thumbH, 2); g.fill();
  }
  const updateScroll = (): void => {
    const offset = Math.max(0, Math.min(maxOffset, scroll.getScrollOffset().y)); settlementOffset = offset;
    artwork.setPosition(0, artY + offset, 0);
    if (thumb) thumb.setPosition(369, WY(sceneTop, thumbH) - (available - thumbH) * offset / maxOffset, 0);
  };
  scroll.node.on(ScrollView.EventType.SCROLLING, updateScroll);
  scroll.scrollToOffset(new Vec2(0, Math.min(maxOffset, settlementOffset)), 0);
  updateScroll();
  basePlaque(root, 0, WY(titleTop, 46), 354, 46, 'baseCampTitlePlate');
  const title = text(root, 0, WY(titleTop, 46), '远征营地', { size: 34, bold: true, color: COMIC.cream, w: 312, h: 42 });
  title.name = 'baseTitle';
  text(root, 0, WY(titleTop + 46, 28), '建设主城 · 无尽挑战 · 记录发现', { size: 20, color: COMIC.dark, w: 530, h: 28, outline: COMIC.card, outlineW: 1.5 });
  const board = comicPlate(root, 0, WY(boardTop, boardH), 750, boardH, 'paper', {
    name: 'baseConstruction', cut: 0, edge: false, highlight: false, fill: '#FFF7E7',
  });
  shopDetailRule(board, boardH / 2 - 7, 718);
  comicArt(board, -319, 118, 38, 38, CASTLE);
  text(board, -195, 118, '防线建设', { size: 28, bold: true, align: 'left', w: 185, h: 38 });
  text(board, 253, 118, maxed ? `Lv.${sv.keepLv} · MAX` : `Lv.${sv.keepLv} → Lv.${sv.keepLv + 1}`, { size: 22, color: COMIC.sub, w: 188, h: 34, align: 'right' });
  for (const [i, name, value, icon] of [[0, '防线耐久', keepHp(sv.keepLv), HEART], [1, '阶段护盾', keepShield(sv.keepLv), SHIELD]] as const) {
    const x = i === 0 ? -172 : 171;
    lobbyAttributeWell(board, x, 36, 318, 98, 'baseStat:' + i);
    comicArt(board, x - 103, 31, 46, 48, icon);
    text(board, x + 13, 53, name, { size: 22, color: COMIC.sub, w: 174, h: 30, align: 'left' });
    text(board, x + 13, 17, fmt(value), { size: 31, bold: true, w: 174, h: 40, align: 'left' });
  }
  const action = comicButton(board, 0, -86, 680, 82, '', () => keepModal(ctx), { name: 'baseConstructionAction', tone: maxed ? 'dark' : sv.gold >= cost ? 'green' : 'muted' });
  const face = action.getChildByName('buttonFace')!;
  comicArt(face, -275, 0, 46, 46, HAMMER);
  text(face, -119, 0, maxed ? '查看主城' : '升级主城', { size: 31, bold: true, color: COMIC.cream, w: 228, h: 44 });
  if (!maxed) {
    comicArt(face, 117, 0, 34, 34, 'comic_coin_v1');
    text(face, 221, 0, fmt(cost), { size: 26, bold: true, color: COMIC.cream, w: 158, h: 40 });
  } else text(face, 206, 0, '已满级', { size: 23, color: COMIC.cream, w: 180, h: 38 });
}

function keepModal(ctx: PageCtx, session = new BaseModalSession(ctx), upgraded = false): void {
  const sv = loadSave(), maxed = sv.keepLv >= MAX.keep, cost = keepUpCost(sv.keepLv);
  const W = 660, footerH = 156, infoH = maxed ? 252 : 386;
  const H = detailHeight(infoH, footerH, 730, W);
  session.show(W, H, '主城建设', 'baseKeepDialog', p => {
    detailOverview(p, '主城', '守护王国防线', undefined, '', (node,x,y,side) => {
      const castle = comicArt(node,x,y,side,side+6,CASTLE);
      if (upgraded) constructionPulse(castle,side*.72);
    });
    if (maxed) text(p,84,H/2-218,'Lv.'+sv.keepLv+' · 已满级',
      {size:27,bold:true,w:336,h:38,align:'left',color:BASE_SUB});
    else {
      text(p,-16,H/2-218,'Lv.'+sv.keepLv,{size:28,bold:true,w:132,h:38});
      text(p,80,H/2-218,'→',{size:26,w:44,h:38,color:BASE_SUB});
      text(p,176,H/2-218,'Lv.'+(sv.keepLv+1),{size:28,bold:true,w:132,h:38,color:COMIC.greenShade});
    }
    const body = detailBody(p,infoH,footerH,'baseKeep'), bodyW = W-68;
    let cursor = detailSection(body,0,'升级效果',W);
    const nextLv = maxed ? sv.keepLv : sv.keepLv + 1;
    const rows = [{ name: '防线耐久', icon: HEART, cur: keepHp(sv.keepLv), next: keepHp(nextLv) },
      { name: '阶段护盾', icon: SHIELD, cur: keepShield(sv.keepLv), next: keepShield(nextLv) }];
    const well = lobbyAttributeWell(body,0,-cursor-68,bodyW,136,'baseKeepComparisonWhite');
    rows.forEach((r,i) => {
      const y = 30-i*60, gain = r.next-r.cur;
      comicArt(well,-264,y,38,40,r.icon);
      text(well,-164,y,r.name,{size:21,w:146,h:32,align:'left',color:BASE_SUB});
      text(well,-25,y,fmt(r.cur),{size:23,bold:true,w:118,h:34,font:'number'});
      text(well,50,y,'→',{size:21,w:24,h:32,color:BASE_SUB});
      text(well,125,y,fmt(r.next),{size:23,bold:true,w:118,h:34,font:'number',color:gain>0?COMIC.greenShade:BASE_INK});
      text(well,235,y,maxed?'已达上限':gain>0?'+'+fmt(gain):'本级保持',
        {size:gain>0?22:17,bold:gain>0,w:100,h:32,align:'right',color:gain>0?COMIC.greenShade:BASE_SUB});
    });
    cursor += 150;
    text(body,0,-cursor-24,'耐久每级 +100 · 阶段护盾每3级 +200',
      {size:18,color:BASE_SUB,w:bodyW-16,h:42,lineHeight:24});
    cursor += 58;
    if (!maxed) {
      cursor = detailSection(body,cursor,'建设消耗',W);
      const materials = lobbyAttributeWell(body,0,-cursor-40,bodyW,80,'baseKeepCostWhite');
      comicArt(materials,-250,0,40,40,'comic_coin_v1');
      text(materials,-153,4,'金币',{size:22,w:132,h:34,align:'left',color:BASE_SUB});
      text(materials,93,10,fmt(cost),{size:25,bold:true,font:'number',w:154,h:36,align:'right',
        color:sv.gold>=cost?BASE_INK:'#B64434'});
      text(materials,185,10,'/',{size:23,w:18,h:36,color:BASE_SUB});
      text(materials,243,10,fmt(sv.gold),{size:23,bold:true,font:'number',w:90,h:36,align:'right'});
      text(materials,177,-23,'需求 / 持有',{size:16,w:220,h:26,align:'right',color:BASE_SUB});
    }
    detailFooter(p,footerH);
    text(p,0,-H/2+115,maxed?'主城等级已达到上限':sv.gold<cost?'金币不足':'建设完成后立即提升防线',
      {size:19,w:560,h:28,color:!maxed&&sv.gold<cost?'#B64434':BASE_SUB});
    comicButton(p,0,detailActionY(p),560,58,maxed?'建设已完成':'确认升级',() => {
      if (maxed) return;
      const r = growthAction({ kind: 'keep' }, () => upKeep());
      if (r.ok) { session.markDirty(); keepModal(ctx, session, true); }
    },{name:'baseKeepUpgrade',tone:maxed||sv.gold<cost?'muted':'green',size:27,enabled:!maxed,sound:false});
  });
}

function monsterArt(parent: Node, id: string, x: number, y: number, w: number, h: number, hidden = false): void {
  // Match the active battle appearances, not the superseded static portraits.
  const image = enemyArtRef(id, true);
  const art = artAtlasSprite(parent, x, y, w, h,
    image.atlas, image.frame);
  if (hidden) {
    art.name = 'codexSilhouette:' + id;
    // Zero RGB removes every painted detail; alpha alone preserves the exact monster outline.
    // Over the paper this translucent black becomes a single warm gray, not a tinted portrait.
    art.getComponent(Sprite)!.color = CA('#000000', .34);
  }
}

function codexModal(ctx: PageCtx, session = new BaseModalSession(ctx), direction = 0): void {
  const W = 660, H = Math.min(960,LO.half*2-LO.notchTop*2-48);
  session.show(W,H,'研究院 · 怪物图鉴','baseCodexDialog',p => {
    const discovered = CODEX.filter(c => codexUnlocked(c.id)).length;
    const rewards = CODEX.filter(c => codexUnlocked(c.id) && !codexClaimed(c.id)).length;
    comicArt(p,-267,H/2-105,38,38,BOOK);
    text(p,-89,H/2-105,'已发现 '+discovered+'/'+CODEX.length,
      {size:23,bold:true,w:256,h:34,align:'left'});
    text(p,187,H/2-105,rewards+'份奖励待领',
      {size:20,color:rewards?COMIC.greenShade:BASE_SUB,w:226,h:32,align:'right'});
    baseDiscoveryProgress(p,-68,H/2-132,360,discovered/CODEX.length);
    text(p,0,H/2-163,'战斗中遇见怪物后解锁 · 首览奖励每种仅领一次',
      {size:17,color:BASE_SUB,w:592,h:28});
    detailRule(p,H/2-190,W);
    const entries = CODEX.filter(c => (EXPANSION_MOBS[c.id]?.homeChapter || 1) === codexChapter);
    const current = CHAPTER_CONTENT[codexChapter - 1];
    text(p,0,H/2-222,'第'+chapterNumeral(codexChapter)+'章 · '+current.name,{size:23,bold:true,w:420,h:36});
    const switchChapter = (step: number): void => {
      codexChapter = Math.max(1,Math.min(CHAPTER_CONTENT.length,codexChapter+step));
      codexOffset = 0; codexModal(ctx,session,step);
    };
    comicButton(p,-260,H/2-222,52,42,'‹',()=>switchChapter(-1),{tone:'dark',size:30,enabled:codexChapter>1});
    comicButton(p,260,H/2-222,52,42,'›',()=>switchChapter(1),{tone:'dark',size:30,enabled:codexChapter<CHAPTER_CONTENT.length});
    const viewTop=H/2-258, viewBottom=-H/2+30, viewH=viewTop-viewBottom, viewY=(viewTop+viewBottom)/2;
    const cardH=226,gap=14,pad=6,rows=Math.ceil(entries.length/2);
    const contentH=Math.max(viewH,rows*(cardH+gap)-gap+pad*2);
    const view=N('baseCodexView',p,0,viewY,592,viewH);view.addComponent(Mask);
    const scroll=view.addComponent(ScrollView);scroll.horizontal=false;scroll.vertical=contentH>viewH;scroll.elastic=false;
    const content=N('baseCodexContent',view,0,viewH/2,592,contentH);
    content.getComponent(UITransform)!.setAnchorPoint(.5,1);scroll.content=content;
    entries.forEach((c,i) => {
      const got=codexUnlocked(c.id),claimed=codexClaimed(c.id);
      const card=baseCodexCard(content,i%2===0?-148:148,
        -(pad+Math.floor(i/2)*(cardH+gap)+cardH/2),280,cardH,'baseCodexCard:'+c.id,got);
      const backdrop=N('baseMonsterCircle',card,0,34).addComponent(Graphics);
      backdrop.fillColor=C(got?'#E3EAD8':'#EAE5D7');backdrop.circle(0,0,64);backdrop.fill();
      monsterArt(card,c.id,0,34,172,132,!got);
      if (got) {
        text(card,0,-49,c.name,{size:22,bold:true,w:256,h:32});
        comicArt(card,-105,-85,24,24,'comic_diamond_v1');
        text(card,19,-85,claimed?'首览奖励已领取':'首览奖励 +'+CODEX_REWARD+'钻石',
          {size:17,color:claimed?BASE_SUB:COMIC.greenShade,w:216,h:27});
        if (claimed) comicMark(card,114,88,'check',22,COMIC.greenShade);
        else dot(card,114,88,0,'baseCodexReward:'+c.id);
      } else {
        comicMark(card,0,34,'lock',28,COMIC.card);
        text(card,0,-58,'？？？',{size:25,bold:true,color:'#918A78',w:256,h:32});
        text(card,0,-89,'战斗中遇见后解锁',{size:16,color:BASE_SUB,w:256,h:26});
      }
      tap(card,() => {
        if (!got) { toast('战斗中遇见该怪物后解锁'); return; }
        codexDetail(ctx,c.id,session);
      });
    });
    let thumb:Node|null=null,thumbH=0;
    if (contentH>viewH) {
      thumbH=Math.max(36,viewH*viewH/contentH);
      thumb=N('baseCodexThumb',p,313,0,4,thumbH);
      const g=thumb.addComponent(Graphics);g.fillColor=CA(BASE_SUB,.28);
      g.roundRect(-2,-thumbH/2,4,thumbH,2);g.fill();
    }
    const updateScroll=():void => {
      codexOffset=Math.max(0,Math.min(contentH-viewH,scroll.getScrollOffset().y));
      if (thumb) thumb.setPosition(313,viewY+viewH/2-thumbH/2-(viewH-thumbH)*codexOffset/(contentH-viewH),0);
    };
    scroll.node.on(ScrollView.EventType.SCROLLING,updateScroll);
    scroll.scrollToOffset(new Vec2(0,Math.min(contentH-viewH,codexOffset)),0);
    updateScroll();
    detailRule(p,-H/2+18,W);
  },undefined,direction);
}

function codexDetail(ctx: PageCtx, id: string, session: BaseModalSession): void {
  const c = CODEX.find(x => x.id === id); if (!c || !codexUnlocked(id)) return;
  const W=660,infoH=404,footerH=186,H=detailHeight(infoH,footerH,820,W);
  session.show(W,H,'怪物详情','baseCodexDetail',p => {
    detailOverview(p,c.name.replace(/（.*）$/,''),'',undefined,'',(node,x,y,side) => {
      const circle=N('baseMonsterShowcase',node,x,y,side,side).addComponent(Graphics);
      circle.fillColor=C('#E3EAD8');circle.circle(0,0,side/2);circle.fill();
      monsterArt(node,id,x,y,side,side);
    });
    c.tags.forEach((tag,i) => {
      const boss=tag==='BOSS';
      const plate=comicSurface(p,-24+i*136,H/2-169,112,34,boss?'dark':'card',{radius:5,name:'baseMonsterTag'});
      text(plate,0,0,tag,{size:19,bold:true,color:boss?COMIC.cream:BASE_SUB,w:100,h:28});
    });
    text(p,84,H/2-216,'已发现',{size:20,color:COMIC.greenShade,w:336,h:30,align:'left'});
    const body=detailBody(p,infoH,footerH,'baseMonster');
    let cursor=baseTextGroup(body,0,'行动特征',c.traits.join('\n'),108,W);
    cursor=baseTextGroup(body,cursor,'怪物描述',c.desc,80,W);
    baseTextGroup(body,cursor,'应对弱点',c.weak,60,W,true);
    detailFooter(p,footerH);
    comicArt(p,-250,-H/2+143,46,46,'comic_diamond_v1');
    text(p,-28,-H/2+150,'首览奖励 +'+CODEX_REWARD+'钻石',
      {size:24,bold:true,w:380,h:34,align:'left'});
    text(p,-28,-H/2+120,'每种怪物只能领取一次',
      {size:18,color:BASE_SUB,w:380,h:28,align:'left'});
    const claimed=codexClaimed(id);
    if (claimed) comicMark(p,250,-H/2+141,'check',28,COMIC.greenShade);
    comicButton(p,0,detailActionY(p),560,58,claimed?'奖励已领取':'领取首览奖励',() => {
      if (claimed) return;
      const r = claimCodexReward(id);
      if (r.ok) {
        session.markDirty(); codexModal(ctx, session, -1); ctx.refreshResources?.();
        showRewardPopup(ctx.screens.parent || ctx.screens, '怪物图鉴 · 首次发现', 0,
          [{ name: '钻石', icon: 'comic_diamond_v1', amount: CODEX_REWARD }], undefined,
          { subtitle: '首览奖励已到账' });
      } else toast(r.msg, { kind: 'warning', title: '暂时无法领取' });
    },{name:'baseCodexClaim',tone:claimed?'muted':'green',size:27,enabled:!claimed});
  },() => codexModal(ctx,session,-1),1);
}
