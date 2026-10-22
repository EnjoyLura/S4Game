/** A receipt-only reward surface: the caller has already persisted the grant. */
import { _decorator, Component, director, Director, game, Game, Graphics, isValid, Label, Node, UIOpacity, Vec3 } from 'cc';
import { LO } from '../config/GameConfig';
import { comicArt } from './ComicUI';
import { CA, dimLayer, N } from './UIKit';
import { GLOBAL_ROOT, mainLabel } from './PageKit';
import { dismissUI, motionIn, reducedMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';
import { uiSound } from './UIAudio';
import { shopQualitySocket } from './LobbyChrome';
import { heroComicFigure } from './HeroComic';
import { HERO_DEFS, Quality } from '../core/GameData';
import { UISound } from './UIAudio';
import { celebrationConfetti } from './CelebrationInk';
import { celebrationLight, feedbackSurface, lightEnvelope } from './FeedbackSurface';
import { collectRewardFx } from './RewardCollectFx';
import { bindBrowserBack } from './BrowserBack';
import { bindButton } from './ButtonFeedback';
import { showItemDetails } from './ItemDetails';

const { ccclass } = _decorator;
export interface RewardPopupItem { id: string; name: string; icon: string; amount: number; quality?: Quality; }
export interface RewardPresentation { title?: string; subtitle?: string; heroId?: string; sound?: UISound; }
interface RewardRow { node: Node; text: Label; fade: UIOpacity; amount: number; at: Vec3; delay: number; revealOnly?: boolean; }
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (value: number): number => 1 - (1 - clamp(value)) ** 3;

@ccclass('RewardPopupMotion')
class RewardPopupMotion extends Component {
  private rows: RewardRow[] = [];
  private ink!: Graphics;
  private backdrop!: Node;
  private hint!: UIOpacity;
  private title: Node | null = null;
  private sound: UISound = 'reward';
  private endAt = 1.35;
  private age = 0;
  private hidden = false;
  private quiet = false;
  private closing = false;
  private drawReady: (() => void) | null = null;

  onLoad(): void {
    this.enabled = false;
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }

  configure(rows: { node: Node; text: Node; amount: number; revealOnly?: boolean }[], title: Node, hint: Node, sound: UISound): void {
    this.quiet = reducedMotion();
    this.title = title; this.sound = sound;
    this.hint = hint.addComponent(UIOpacity);
    this.backdrop = celebrationLight(this.node, 'rewardBacklight', 0, 8,
      sound === 'recruit' ? 650 : 510, sound === 'recruit' ? 570 : 380);
    this.backdrop.setSiblingIndex(1);
    this.ink = N('rewardPopupAccents', this.node).addComponent(Graphics);
    this.rows = rows.map((row, index) => ({ node: row.node, text: row.text.getComponent(Label)!,
      fade: row.node.addComponent(UIOpacity), amount: row.amount, at: row.node.position.clone(),
      delay: .1 + index * .09, revealOnly: row.revealOnly }));
    this.endAt = Math.max(1.35, .9 + rows.length * .09);
    if (!this.quiet) this.render();
  }

  play(): void {
    whenUIArtReady(this.node, () => {
      if (this.closing || !isValid(this.node, true)) return;
      this.drawReady = () => {
        this.drawReady = null;
        if (this.closing || !isValid(this.node, true)) return;
        uiSound(this.sound);
        if (this.quiet) { this.finish(); return; }
        this.age = 0; this.enabled = true;
      };
      director.once(Director.EVENT_AFTER_DRAW, this.drawReady);
    });
  }

  update(dt: number): void {
    if (this.hidden) return;
    this.age += Math.min(.06, Math.max(0, dt));
    this.render();
    if (this.age >= this.endAt) this.finish();
  }

  private render(): void {
    const g = this.ink; g.clear();
    lightEnvelope(this.backdrop, this.age - .04, 1.3, this.sound === 'recruit' ? .5 : .35);
    celebrationConfetti(g, this.age, this.title!.position.y - 28, 570, this.sound === 'recruit' ? 10 : 6);
    this.hint.opacity = Math.round(255 * ease((this.age - .55 - this.rows.length * .09) / .22));
    const titleScale = .98 + .02 * ease(this.age / .28);
    this.title!.setScale(titleScale, titleScale, 1);
    for (const row of this.rows) {
      const t = this.age - row.delay, pop = ease(t / .28);
      const settle = Math.sin(Math.PI * clamp((t - .18) / .22)) * .025;
      const scale = .88 + .12 * pop + settle;
      row.fade.opacity = Math.round(255 * ease(t / .16));
      row.node.setScale(scale, scale, 1);
      row.node.setPosition(row.at.x, row.at.y - 10 * (1 - pop), row.at.z);
      // Actual granted quantity is visible from reveal; never count through fictitious rewards.
      const hit = clamp((t - .18) / .55);
      if (hit <= 0 || hit >= 1) continue;
      const x = row.at.x, y = row.at.y + 2, spread = ease(hit), fade = 1 - hit;
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + .55, distance = 65 + spread * 13;
        const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
        const size = Math.sin(hit * Math.PI) * (i % 2 ? 3 : 4.5);
        g.fillColor = CA('#FFF0BD', fade * .7);
        g.moveTo(px, py + size); g.lineTo(px + size * .5, py);
        g.lineTo(px, py - size); g.lineTo(px - size * .5, py); g.close(); g.fill();
      }
    }
  }

  finish(): void {
    for (const row of this.rows) {
      if (!isValid(row.node, true)) continue;
      row.node.setPosition(row.at); row.node.setScale(1, 1, 1);
      row.fade.opacity = 255;
      if (!row.revealOnly) row.text.string = '+' + row.amount.toLocaleString('en-US');
      row.text.node.setScale(1, 1, 1);
    }
    if (this.title?.isValid) this.title.setScale(1, 1, 1);
    this.ink?.clear(); if (this.backdrop) this.backdrop.active = false;
    if (this.hint) this.hint.opacity = 255;
    this.enabled = false;
  }

  stop(): void {
    this.closing = true;
    if (this.drawReady) director.off(Director.EVENT_AFTER_DRAW, this.drawReady);
    this.drawReady = null; this.finish();
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    this.closing = true;
    if (this.drawReady) director.off(Director.EVENT_AFTER_DRAW, this.drawReady);
    this.drawReady = null;
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    this.rows.length = 0;
  }
}

/** A full-width celebration band, deliberately independent of paper detail dialogs. */
function rewardBanner(panel: Node, height: number, heading: string): Node {
  feedbackSurface(panel, 'rewardCelebrationBand', 'band', 0, 0, 750, height + 90, '#152633', .9);
  feedbackSurface(panel, 'rewardLowerRule', 'line', 0, -height/2, 750, 2, '#DDBA72', .62);
  const title=N('rewardCelebrationTitle',panel,0,height/2,650,88);
  feedbackSurface(title, 'titleWarmLight', 'halo', 0, 0, 520, 110, '#FFD178', .22);
  for (const side of [-1, 1]) {
    feedbackSurface(title, 'titleRule', 'line', side * 258, 0, 150, 2, '#EFD18B', .85);
    feedbackSurface(title, 'titleInnerRule', 'line', side * 258, -5, 126, 1, '#EFD18B', .36);
  }
  mainLabel(title,0,0,heading,{size:40,bold:true,font:'body',color:'#FFE6A4',w:360,h:56,
    outline:'#352C23',outlineW:1});
  return title;
}

/** Display only the positive amounts present in this receipt. */
export function showRewardPopup(parent: Node, source: string, chestCount: number,
  items: readonly RewardPopupItem[], onClose?: () => void, presentation: RewardPresentation = {}): Node {
  const rewards = items.filter(item => Number.isFinite(item.amount) && item.amount > 0);
  const dim = dimLayer(parent, .72, false, false);
  dim.name = 'rewardPopup';
  let closing = false, acknowledged = false, motion: RewardPopupMotion | null = null;
  let detail: Node | null = null;
  const close = (): void => {
    if (closing || (detail && isValid(detail, true))) return;
    closing = true; motion?.stop();
    dismissUI(dim, () => {
      if (acknowledged) return;
      acknowledged = true;
      // Release the caller's claim lock before starting optional wallet decoration.
      try { onClose?.(); }
      catch (error) { console.warn('[RewardPopup] acknowledgement callback failed', error); }
      collectRewardFx(GLOBAL_ROOT, rewards);
    }, false);
  };
  bindBrowserBack(dim, close);
  dim.on(Node.EventType.TOUCH_END, (event: { propagationStopped?: boolean }) => {
    event.propagationStopped = true; close();
  });
  const columns=Math.min(4,Math.max(1,rewards.length)), rowCount=Math.max(1,Math.ceil(rewards.length/columns));
  const hero = presentation.heroId && HERO_DEFS[presentation.heroId] ? presentation.heroId : undefined;
  const height=hero ? 636 : 242+rowCount*170;
  const panel = N('rewardPopupPanel',dim,0,0,750,height);
  const title = rewardBanner(panel,height,presentation.title || '恭喜获得');
  const fit=Math.min(1,(LO.half*2-LO.notchTop*2-120)/(height+110));
  panel.setScale(fit,fit,1);
  mainLabel(panel, 0, height/2-55, source, { size: 20, color: '#E0D6BC', w: 620, h: 28 });
  mainLabel(panel, 0, height/2-86, presentation.subtitle || (chestCount > 0 ? '已领取 ' + chestCount + ' 个宝箱' : '奖励已到账'), {
    size: 18, color: '#C4C9C9', w: 620, h: 26,
  });
  const rows: { node: Node; text: Node; amount: number; revealOnly?: boolean }[] = [];
  const inspect = (id: string, amount: number): void => {
    if (closing || (detail && isValid(detail, true))) return;
    motion?.stop(); // Finish the reveal before covering it; no acknowledgement or wallet flight.
    detail = showItemDetails(dim, id, { amount, source });
  };
  const canInspect = (): boolean => !closing && !(detail && isValid(detail, true));
  if (hero) {
    const reveal = N('recruitedHero:' + hero,panel,0,-16,350,410);
    heroComicFigure(reveal,hero,0,-158,350,276);
    mainLabel(reveal,0,-188,HERO_DEFS[hero].name,{size:32,bold:true,color:'#FFE7A2',w:560,h:44});
    const text = mainLabel(reveal,0,-227,'已解锁 · 可加入出战编队',{size:21,color:'#C9EAA7',w:560,h:32});
    rows.push({node:reveal,text,amount:1,revealOnly:true});
    bindButton(reveal, () => inspect('hero_' + hero, 1), { enabled: canInspect, scale: .99, sound: false });
  } else rewards.forEach((reward, index) => {
    const row=Math.floor(index/columns),count=Math.min(columns,rewards.length-row*columns);
    const card=N('rewardPopupItem:'+index,panel,((index%columns)-(count-1)/2)*166,
      (rowCount-1)*85-row*170-4,140,158);
    shopQualitySocket(card,0,0,126,reward.quality ?? 2);
    comicArt(card, 0, 2, 104, 104, reward.icon);
    mainLabel(card, 0, -83, reward.name, { size: 20, color: '#FFF3D6', w: 150, h: 30 });
    const text = mainLabel(card, 0, -43, '+' + reward.amount.toLocaleString('en-US'), {
      size: 26, bold: true, font: 'number', color: '#FFFFFF', align:'right',w:110,h:34,
      outline:'#142431',outlineW:2,
    });
    rows.push({ node: card, text, amount: reward.amount });
    bindButton(card, () => inspect(reward.id, reward.amount), { enabled: canInspect, scale: .97, dragThreshold: 7, sound: false });
  });
  const hint = mainLabel(panel, 0, -height/2+30, '点击物品查看详情 · 点击空白处收下', { size: 19, color: '#C4C9C9', w: 620, h: 28 });
  motion = panel.addComponent(RewardPopupMotion);
  motion.configure(rows,title,hint,presentation.sound || 'reward'); motionIn(panel, 'modal'); motion.play();
  return dim;
}
