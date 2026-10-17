/** Local upgrade impact and a real power counter; the result banner owns all floating numbers. */
import { _decorator, Component, game, Game, Graphics, isValid, Label, Node, Vec3 } from 'cc';
import { CA, N } from './UIKit';
import { COMIC } from './ComicUI';
import { reducedMotion } from './UIMotion';
import { celebrationLight, lightEnvelope } from './FeedbackSurface';

const { ccclass } = _decorator;
const ease = (t: number): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

@ccclass('TrainingGrowthFx')
export class TrainingGrowthFx extends Component {
  private figure!: Node;
  private badge!: Node;
  private counter!: Label;
  private ink!: Graphics;
  private backlightNode!: Node;
  private hidden = false;
  private figureScale = new Vec3();
  private badgeScale = new Vec3();
  private age = 10;
  private from = 0;
  private displayed = 0;
  private target = 0;
  private breakthrough = false;
  private lastText = '';
  private hammer: Node | null = null;

  onLoad(): void { game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this); }

  setHammer(hammer: Node): void { this.hammer = hammer; }

  configure(figure: Node, badge: Node, counter: Node, power: number): void {
    this.figure = figure; this.badge = badge; this.counter = counter.getComponent(Label)!;
    this.figureScale.set(figure.scale); this.badgeScale.set(badge.scale);
    this.from = this.target = this.displayed = power;
    this.backlightNode = celebrationLight(this.node.parent!, 'trainingGrowthBacklight',
      this.node.position.x, this.node.position.y + 148, 310, 440);
    this.backlightNode.setSiblingIndex(0);
    this.ink = N('trainingUpgradeBurst', this.node).addComponent(Graphics);
    this.enabled = false;
  }

  pulse(before: number, after: number, breakthrough: boolean): void {
    this.from = this.age >= 1.1 ? before : this.displayed;
    this.target = after; this.age = 0; this.breakthrough = breakthrough;
    this.enabled = true;
  }

  update(dt: number): void {
    if (this.hidden) return;
    this.age += Math.min(dt, .1);
    const quiet = reducedMotion(), progress = quiet ? 1 : ease(this.age / .28);
    this.displayed = this.from + (this.target - this.from) * progress;
    const text = '战力 ' + Math.round(this.displayed).toLocaleString('en-US');
    if (text !== this.lastText) { this.counter.string = text; this.lastText = text; }
    const bounce = quiet ? 0 : Math.sin(Math.PI * Math.min(1, this.age / .32));
    // Keep the illustrated hero's body and foot anchor still; impact belongs to light and numbers.
    this.badge.setScale(this.badgeScale.x * (1 + bounce * .085), this.badgeScale.y * (1 + bounce * .085), this.badgeScale.z);
    if (this.hammer && isValid(this.hammer)) this.hammer.angle = -10 * bounce;
    this.ink.clear();
    lightEnvelope(this.backlightNode, quiet ? 1 : this.age, .85, this.breakthrough ? .62 : .4);
    if (!quiet && this.age < .85) {
      const p = this.age / .85, fade = 1 - p, spread = this.breakthrough ? 1.35 : 1;
      this.ink.strokeColor = CA(COMIC.gold, fade * .72); this.ink.lineWidth = 2;
      this.ink.ellipse(0, 4, (60 + p * 65) * spread, 12 + p * 17); this.ink.stroke();
      this.ink.strokeColor = CA(COMIC.goldLight, fade * .35); this.ink.lineWidth = 1;
      this.ink.ellipse(0, 4, (45 + p * 52) * spread, 8 + p * 13); this.ink.stroke();
      this.ink.strokeColor = CA(COMIC.goldLight, fade * .8); this.ink.lineWidth = 2.4;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI * 2 / 6, x = Math.cos(a) * (36 + p * 45) * spread;
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
    if (this.backlightNode) this.backlightNode.active = false;
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    if (this.backlightNode?.isValid) this.backlightNode.destroy();
  }
}
