/** Shared comic paper and field guide. Decorative only; never blocks input or delays combat. */
import { Color, Graphics, isValid, Label, Mask, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import { GameAudio } from '../core/GameAudio';
import { WaveThreat } from '../core/EventBus';
import { C, label, N } from './UIKit';
import { reducedMotion } from './UIMotion';
import { uxFrame } from './Ux';
import { THREAT_ART } from './BattleEntryWarmup';

const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const out = (n: number): number => 1 - Math.pow(1 - clamp(n), 3);
const smooth = (n: number): number => { const p = clamp(n); return p * p * (3 - 2 * p); };

export class BossWarning {
  private root: Node;
  private fade: UIOpacity;
  private clip: UITransform;
  private crest: Node;
  private caption: Node;
  private captionFade: UIOpacity;
  private title: Label;
  private subtitle: Label;
  private sparks: Graphics;
  private bannerArt: Sprite;
  private crestArt: Sprite;
  private bannerFallback: Node;
  private crestFallback: Node;
  private frames: (SpriteFrame | null)[] = [null, null];
  private pending: WaveThreat | null = null;
  private playing = false;
  private quiet = false;
  private age = 0;
  private tint = new Color();

  constructor(parent: Node) {
    this.root = N('centralThreatWarning', parent, 0, 24, 750, 260);
    this.fade = this.root.addComponent(UIOpacity);
    const clipped = N('unfoldingPennant', this.root, 0, 0, 720, 260);
    clipped.addComponent(Mask); this.clip = clipped.getComponent(UITransform)!;
    this.bannerFallback = N('pennantFallback', clipped);
    const g = this.bannerFallback.addComponent(Graphics);
    g.fillColor = C('#F5E8CD'); g.strokeColor = C('#765927'); g.lineWidth = 3;
    g.moveTo(-353, 64); g.lineTo(353, 64); g.lineTo(329, 0); g.lineTo(353, -64);
    g.lineTo(-353, -64); g.lineTo(-329, 0); g.close(); g.fill(); g.stroke();
    this.bannerArt = this.art(clipped, 'paintedPennant');
    this.crest = N('warCrest', this.root, -232, 4, 180, 180);
    this.crestFallback = N('crestFallback', this.crest);
    const shield = this.crestFallback.addComponent(Graphics);
    shield.fillColor = C('#29313B'); shield.strokeColor = C('#E2B55E'); shield.lineWidth = 4;
    shield.moveTo(-54, 66); shield.lineTo(54, 66); shield.lineTo(48, -22);
    shield.lineTo(0, -68); shield.lineTo(-48, -22); shield.close(); shield.fill(); shield.stroke();
    shield.strokeColor = C('#FFF0CF'); shield.lineWidth = 7;
    for (let i = -1; i <= 1; i++) { shield.moveTo(i * 22 + 12, 33); shield.lineTo(i * 22 - 10, -26); shield.stroke(); }
    this.crestArt = this.art(this.crest, 'paintedWarCrest');
    this.sparks = N('crestEmbers', this.root, -232, 4).addComponent(Graphics);
    this.caption = N('threatCaption', this.root, 76, 0);
    this.captionFade = this.caption.addComponent(UIOpacity);
    this.title = label(this.caption, 0, 14, '', { size: 34, bold: true, font: 'title', color: '#4A3214',
      w: 420, h: 46, shrink: true }).getComponent(Label)!;
    this.subtitle = label(this.caption, 0, -23, '', { size: 17, font: 'body', color: '#77674F',
      w: 420, h: 26, shrink: true }).getComponent(Label)!;
    this.root.active = false;
    THREAT_ART.forEach((key, i) => uxFrame(key, frame => {
      if (isValid(this.root, true)) this.frames[i] = frame;
    }));
  }

  private art(parent: Node, name: string): Sprite {
    const sprite = N(name, parent).addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
    return sprite;
  }

  private fit(sprite: Sprite, frame: SpriteFrame | null, width: number, height: number, fallback: Node): void {
    sprite.node.active = !!frame; fallback.active = !frame;
    if (!frame) return;
    sprite.spriteFrame = frame;
    const r = frame.rect, scale = Math.min(width / r.width, height / r.height);
    sprite.node.getComponent(UITransform)!.setContentSize(r.width * scale, r.height * scale);
  }

  show(threat: WaveThreat): void {
    // Latest wave takes precedence during GM jumps; no stale warnings accumulate behind a modal.
    this.pending = threat;
  }

  tick(dt: number, visible: boolean): void {
    if (!isValid(this.root, true)) return;
    if (!visible || (typeof document !== 'undefined' && document.hidden)) { this.root.active = false; return; }
    if (this.pending) {
      const threat = this.pending; this.pending = null;
      this.age = 0; this.playing = true; this.quiet = reducedMotion();
      this.title.string = threat.boss ? '首领来袭' : '精英来袭';
      this.subtitle.string = (threat.floor ? `第 ${threat.floor} 层` : `第 ${threat.wave} 波`) + ' · ' + threat.names.join('、');
      // Commit complete art only at the start, never pop it into a warning already on screen.
      this.fit(this.bannerArt, this.frames[0], 720, 240, this.bannerFallback);
      this.fit(this.crestArt, this.frames[1], 106, 106, this.crestFallback);
      GameAudio.play('surge', { gain: .85, rate: .95, duration: 1.05, fadeIn: .02, lowpass: 3500 });
    }
    if (!this.playing) { this.root.active = false; return; }
    this.root.active = true;
    this.age += Math.min(Math.max(dt, 0), .05); // Real display seconds; pause/background never consumes the warning.
    const t = this.age, end = this.quiet ? 1.8 : 2.35, exit = smooth((t - (end - .25)) / .25);
    if (t >= end) { this.clear(); return; }
    this.fade.opacity = Math.round(255 * (1 - exit) * (this.quiet ? smooth(t / .12) : 1));
    this.root.setPosition(0, 24 + (this.quiet ? 0 : 12 * exit), 0);
    this.clip.setContentSize(this.quiet ? 720 : Math.max(1, 720 * out(t / .27)), 260);
    let scale = 1;
    if (!this.quiet) {
      const p = clamp((t - .04) / .36);
      scale = p < .64 ? .7 + .36 * out(p / .64) : 1.06 - .06 * smooth((p - .64) / .36);
      this.crest.active = t >= .04;
      this.crest.setPosition(-232, 4 + 14 * (1 - out(p)), 0);
    } else this.crest.active = true;
    this.crest.setScale(scale, scale, 1);
    this.captionFade.opacity = Math.round(255 * smooth((t - (this.quiet ? 0 : .13)) / .17));
    this.caption.setPosition(76 + (this.quiet ? 0 : 12 * (1 - out((t - .13) / .2))), 0, 0);
    this.paintSparks(t);
  }

  private paintSparks(t: number): void {
    const g = this.sparks; g.clear();
    if (this.quiet || t < .23 || t > .8) return;
    const p = (t - .23) / .57;
    this.tint.set(244, 196, 109, Math.round(195 * (1 - p)));
    g.fillColor = this.tint;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + .18, radius = 76 + 46 * out(p);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .72 - p * p * 20;
      const size = (i % 2 ? 2.5 : 3.5) * (1 - p * .65);
      g.moveTo(x, y + size); g.lineTo(x + size * .55, y); g.lineTo(x, y - size);
      g.lineTo(x - size * .55, y); g.close(); g.fill();
    }
  }

  clear(): void {
    this.pending = null; this.playing = false;
    if (isValid(this.root, true)) this.root.active = false;
  }
}
