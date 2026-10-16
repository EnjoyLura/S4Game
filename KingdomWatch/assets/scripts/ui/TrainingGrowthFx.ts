/** A single reusable local burst and power counter; consecutive upgrades coalesce. */
import { _decorator, Component, Graphics, isValid, Label, Node, UIOpacity, Vec3 } from 'cc';
import { CA, label, N } from './UIKit';
import { COMIC } from './ComicUI';
import { reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
const ease = (t: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

@ccclass('TrainingGrowthFx')
export class TrainingGrowthFx extends Component {
  private figure!: Node;
  private badge!: Node;
  private counter!: Label;
  private ink!: Graphics;
  private gain!: Node;
  private gainFade!: UIOpacity;
  private gainText!: Label;
  private figureScale = new Vec3();
  private badgeScale = new Vec3();
  private age = 10;
  private from = 0;
  private displayed = 0;
  private target = 0;
  private base = 0;
  private breakthrough = false;
  private lastText = '';
  private hammer: Node | null = null;

  setHammer(hammer: Node): void { this.hammer = hammer; }

  configure(figure: Node, badge: Node, counter: Node, power: number): void {
    this.figure = figure; this.badge = badge; this.counter = counter.getComponent(Label)!;
    this.figureScale.set(figure.scale); this.badgeScale.set(badge.scale);
    this.from = this.target = this.displayed = this.base = power;
    this.ink = N('trainingUpgradeBurst', this.node).addComponent(Graphics);
    this.gain = label(this.node, 0, 70, '', { size: 27, color: COMIC.greenLight, bold: true,
      font: 'number', outline: COMIC.ink, outlineW: 2, w: 320, h: 44, shrink: true });
    this.gainText = this.gain.getComponent(Label)!;
    this.gainFade = this.gain.addComponent(UIOpacity); this.gainFade.opacity = 0;
    this.enabled = false;
  }

  pulse(before: number, after: number, breakthrough: boolean): void {
    if (this.age > .9) this.base = before;
    this.from = this.displayed; this.target = after; this.age = 0; this.breakthrough = breakthrough;
    this.gainText.string = (breakthrough ? '突破！战力 +' : '战力 +') + (after - this.base).toLocaleString('en-US');
    this.enabled = true;
  }

  update(dt: number): void {
    this.age += Math.min(dt, .1);
    const quiet = reducedMotion(), progress = quiet ? 1 : ease(this.age / .28);
    this.displayed = this.from + (this.target - this.from) * progress;
    const text = '战力 ' + Math.round(this.displayed).toLocaleString('en-US');
    if (text !== this.lastText) { this.counter.string = text; this.lastText = text; }
    const bounce = quiet ? 0 : Math.sin(Math.PI * Math.min(1, this.age / .32));
    this.figure.setScale(this.figureScale.x * (1 + bounce * (this.breakthrough ? .045 : .025)),
      this.figureScale.y * (1 + bounce * (this.breakthrough ? .045 : .025)), this.figureScale.z);
    this.badge.setScale(this.badgeScale.x * (1 + bounce * .055), this.badgeScale.y * (1 + bounce * .055), this.badgeScale.z);
    if (this.hammer && isValid(this.hammer)) this.hammer.angle = -10 * bounce;
    this.gain.setPosition(0, 70 + (quiet ? 0 : 18 * ease(this.age / .6)), 0);
    this.gainFade.opacity = Math.round(255 * Math.min(1, this.age / .06) * Math.max(0, Math.min(1, (1.1 - this.age) / .24)));
    this.ink.clear();
    if (!quiet && this.age < .55) {
      const p = this.age / .55, fade = 1 - p, spread = this.breakthrough ? 1.2 : 1;
      this.ink.strokeColor = CA(COMIC.gold, fade * .7); this.ink.lineWidth = 2;
      this.ink.ellipse(0, 4, (50 + p * 60) * spread, 9 + p * 13); this.ink.stroke();
      this.ink.strokeColor = CA(COMIC.goldLight, fade * .8); this.ink.lineWidth = 2.4;
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI * 2 / 10, x = Math.cos(a) * (36 + p * 45) * spread;
        const y = 16 + Math.sin(a) * 15 + p * (34 + (i % 3) * 13);
        this.ink.moveTo(x, y); this.ink.lineTo(x + Math.cos(a) * 3, y + 7 * fade);
      }
      this.ink.stroke();
    }
    if (this.age >= 1.1) this.enabled = false;
  }

  onDisable(): void {
    if (this.figure && isValid(this.figure)) this.figure.setScale(this.figureScale);
    if (this.badge && isValid(this.badge)) this.badge.setScale(this.badgeScale);
    if (this.hammer && isValid(this.hammer)) this.hammer.angle = 0;
    this.ink?.clear();
    if (this.gainFade) this.gainFade.opacity = 0;
  }
}
