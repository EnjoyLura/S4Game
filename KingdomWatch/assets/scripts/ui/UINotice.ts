/** A non-blocking game notice: feathered sides, twin rules, slide up and fade upward. */
import { _decorator, Component, game, Game, isValid, Node, UIOpacity } from 'cc';
import { LO } from '../config/GameConfig';
import { label, N } from './UIKit';
import { noticeSurface } from './FeedbackSurface';
import { whenUIArtReady } from './UIArtReady';
import { reducedMotion } from './UIMotion';
import { uiSound } from './UIAudio';

const { ccclass } = _decorator;
export type NoticeKind = 'info' | 'success' | 'warning' | 'reward' | 'upgrade';
export type NoticeNumberFormat = 'integer' | 'percent' | 'speed';
export interface NoticeStat { name: string; before: number; after: number; format?: NoticeNumberFormat; }
export interface NoticeOptions {
  kind?: NoticeKind; title?: string; key?: string; icon?: string; heroId?: string;
  level?: { before: number; after: number }; stats?: NoticeStat[]; milestone?: string;
}

function numberText(value: number, format: NoticeNumberFormat = 'integer'): string {
  if (format === 'percent') return (Math.round(value * 1000) / 10) + '%';
  if (format === 'speed') return (Math.round(value * 100) / 100) + '次/秒';
  return Math.round(value).toLocaleString('en-US');
}

/** Keep real upgrade feedback in text while repeated long-press results coalesce. */
function noticeText(message: string, options: NoticeOptions): string {
  if (options.kind === 'upgrade') {
    const level = options.level ? '  Lv.' + options.level.before + ' → Lv.' + options.level.after : '';
    const rows = [message + ' · ' + (options.title || '升级成功') + level];
    const stats = options.stats?.slice(0,2).map(s => s.name + ' +' + numberText(s.after - s.before,s.format));
    if (stats?.length) rows.push(stats.join(' · '));
    if (options.milestone) rows.push(options.milestone);
    return rows.join('\n');
  }
  return options.title && options.title !== message && !message.startsWith(options.title)
    ? options.title + '\n' + message : message;
}

const units = (value: string): number =>
  Array.from(value).reduce((sum,c) => sum + (/[\x00-\x7F]/.test(c) ? .55 : 1),0);
function wrapNotice(value: string): string[] {
  const lines: string[] = [];
  value.split('\n').forEach(line => {
    let current = '', width = 0;
    for (const ch of Array.from(line)) {
      const next = units(ch);
      if (width + next > 26 && current) { lines.push(current.trim()); current = ''; width = 0; }
      current += ch; width += next;
    }
    if (current.trim()) lines.push(current.trim());
  });
  return lines.length ? lines : [''];
}
const out = (t: number): number => 1 - Math.pow(1 - Math.min(1,Math.max(0,t)),3);

/** One bilinearly filtered alpha surface, without overdraw seams between strips. */
function fadedNotice(parent: Node, width: number, height: number): void {
  noticeSurface(parent, width, height);
}

@ccclass('UINotice')
export class UINotice extends Component {
  private card: Node | null = null;
  private fade!: UIOpacity;
  private options: NoticeOptions | null = null;
  private message = '';
  private age = 0;
  private duration = 2;
  private ready = false;
  private revision = 0;
  private height = 64;
  private entryDistance = 0;

  onLoad(): void {
    game.on(Game.EVENT_HIDE,this.clear,this);
    this.enabled = false;
  }

  show(message: string, requested: NoticeOptions): void {
    const kind = requested.kind || 'info';
    const continuing = !!this.card && this.ready && this.options?.kind === kind &&
      (requested.key ? this.options.key === requested.key : this.message === message);
    const previous = continuing ? this.options : null;
    const options: NoticeOptions = { ...requested, kind };
    if (continuing && kind === 'upgrade' && requested.level && previous?.level) {
      options.level = { before: previous.level.before, after: requested.level.after };
      options.stats = requested.stats?.map(s => ({ ...s,
        before: previous.stats?.find(p => p.name === s.name)?.before ?? s.before }));
      options.milestone = requested.milestone || previous.milestone;
    }
    this.removeDisplay();
    const version = ++this.revision;
    this.options = options; this.message = message;
    const lines = wrapNotice(noticeText(message,options));
    const width = Math.min(710,Math.max(580,Math.max(...lines.map(units))*22+138));
    this.height = Math.max(68,lines.length*28+30);
    // Appear at screen center, then settle higher while staying below the resource strip.
    const restingY=Math.min(LO.half*.36,LO.half-LO.notchTop-this.height/2-160);
    this.node.setPosition(0,restingY,0);
    this.entryDistance=restingY;
    this.node.setSiblingIndex(this.node.parent!.children.length-1);
    const card = this.card = N('gameToast',this.node,0,0,width,this.height);
    fadedNotice(card,width,this.height);
    const caption = label(card,0,0,lines.join('\n'),{ size:22,font:'body',color:'#FFF8E8',
      w:width-112,h:this.height-24,lineHeight:28,shrink:true,outline:'#101820',outlineW:.7 });
    caption.name = 'gameToastText';
    this.fade = card.addComponent(UIOpacity); this.fade.opacity = 0;
    const hold = kind === 'warning' ? 2.3 : kind === 'upgrade' || kind === 'reward' ? 2 : 1.8;
    this.duration = .38+hold+Math.max(0,lines.length-2)*.3;
    this.enabled = true;
    if (kind === 'upgrade' || kind === 'reward' || kind === 'warning' || kind === 'success') uiSound(kind);
    whenUIArtReady(card,() => {
      if (version !== this.revision || this.card !== card) return;
      this.age = continuing ? .38 : 0; this.ready = true; this.render();
    });
  }

  update(dt: number): void {
    if (!this.ready || !this.card) return;
    this.age += Math.min(dt,.1);
    if (this.age >= this.duration+.32) { this.clear(); return; }
    this.render();
  }

  private render(): void {
    if (!this.card) return;
    const reduced = reducedMotion(), ending = Math.min(1,Math.max(0,(this.age-this.duration)/.32));
    this.fade.opacity = Math.round(255*Math.min(1,this.age/(reduced ? .08 : .12))*(1-ending));
    this.card.setScale(1,1,1);
    this.card.setPosition(0,reduced ? 0 : -this.entryDistance*(1-out(this.age/.38))+36*ending,0);
  }

  private removeDisplay(): void {
    ++this.revision;
    if (this.card?.isValid) { this.card.active = false; this.card.destroy(); }
    this.card = null; this.ready = false; this.options = null;
  }
  private clear = (): void => { this.removeDisplay(); this.enabled = false; };
  onDisable(): void { this.removeDisplay(); }
  onDestroy(): void { game.off(Game.EVENT_HIDE,this.clear,this); this.removeDisplay(); }
}

export function showNotice(root: Node, message: string, options: NoticeOptions = {}): void {
  if (!isValid(root,true)) return;
  let host = root.getChildByName('noticeLayer');
  if (host && !isValid(host,true)) host = null;
  if (!host) host = N('noticeLayer',root);
  (host.getComponent(UINotice) || host.addComponent(UINotice)).show(message,options);
}
