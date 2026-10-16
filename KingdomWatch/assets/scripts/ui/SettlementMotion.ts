/** Finite, outcome-specific settlement choreography; reward values are presentation only. */
import { _decorator, Component, director, Director, game, Game, Graphics, isValid, Label, Node, Vec3 } from 'cc';
import { CA, N } from './UIKit';
import { reducedMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';
import { uiSound } from './UIAudio';

const { ccclass } = _decorator;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const out = (v: number): number => 1 - (1 - clamp(v)) ** 3;
const back = (v: number): number => { const p = clamp(v) - 1; return 1 + 2.2 * p ** 3 + 1.2 * p * p; };
interface StarView { node: Node; position: Vec3; earned: boolean; sounded: boolean; }
interface RewardView { node: Node; label: Label; from: number; target: number; delay: number; duration: number; last: number; }

@ccclass('SettlementMotion')
export class SettlementMotion extends Component {
  private badge!: Node;
  private badgeAt = new Vec3();
  private stars: StarView[] = [];
  private rewards: RewardView[] = [];
  private ink!: Graphics;
  private win = false;
  private intro = false;
  private quiet = false;
  private age = 0;
  private hidden = false;
  private started = false;
  private rewardCue = false;
  private drawReady: (() => void) | null = null;
  private endAt = 0;
  private earnedStars = 0;

  onLoad(): void {
    this.enabled = false;
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }

  configure(outcome: 'win' | 'lose', badge: Node, stars: { node: Node; earned: boolean }[], intro: boolean): void {
    this.win = outcome === 'win'; this.badge = badge; this.badgeAt.set(badge.position);
    this.quiet = reducedMotion(); this.intro = intro && !this.quiet;
    this.stars = stars.map(star => ({ ...star, position: star.node.position.clone(), sounded: false }));
    this.earnedStars = stars.filter(star => star.earned).length;
    this.endAt = this.intro ? 1.65 : 0;
    this.ink = N('settlementAccents', this.node).addComponent(Graphics);
    if (this.intro) {
      badge.setScale(this.win ? .82 : .94, this.win ? .82 : .94, 1);
      badge.setPosition(this.badgeAt.x, this.badgeAt.y + (this.win ? -18 : 18), this.badgeAt.z);
      badge.angle = this.win ? -2 : 2;
    }
    this.stars.forEach(star => { star.node.active = star.earned && !this.intro; });
  }

  addReward(node: Node, target: number, animate: boolean, from = 0): void {
    const text = node.getComponent(Label)!;
    const to = Math.max(0, Math.round(target)), start = Math.max(0, Math.round(from));
    if (this.quiet || !animate || start === to) { text.string = String(to); return; }
    text.string = String(start);
    this.rewards.push({ node, label: text, from: start, target: to, last: start,
      delay: this.intro ? (this.win ? .73 : .36) + this.rewards.length * .12 : .06,
      duration: this.win ? .62 : .55 });
    const row = this.rewards[this.rewards.length - 1];
    this.endAt = Math.max(this.endAt, row.delay + row.duration + .18);
  }

  /** Artwork and the complete paper panel get one draw before the first animated frame. */
  play(): void {
    if (this.started) return;
    this.started = true;
    if (!this.intro && !this.rewards.length) return;
    whenUIArtReady(this.node, () => {
      if (!isValid(this.node, true)) return;
      this.drawReady = () => {
        this.drawReady = null;
        if (!isValid(this.node, true)) return;
        this.age = 0; this.enabled = true; this.render();
      };
      director.once(Director.EVENT_AFTER_DRAW, this.drawReady);
    });
  }

  update(dt: number): void {
    if (this.hidden) return;
    this.age += Math.min(.06, Math.max(0, dt)); this.render();
    if (this.age >= this.endAt) {
      this.badge.setPosition(this.badgeAt); this.badge.setScale(1, 1, 1); this.badge.angle = 0;
      this.stars.forEach(star => { star.node.active = star.earned; star.node.setPosition(star.position); star.node.setScale(1, 1, 1); });
      this.rewards.forEach(row => { row.label.string = String(row.target); row.node.setScale(1, 1, 1); });
      this.ink.clear(); this.enabled = false;
    }
  }

  private render(): void {
    const g = this.ink; g.clear();
    if (this.intro) {
      const p = clamp((this.age - .03) / (this.win ? .48 : .5)), spring = back(p);
      const scale = this.win ? .82 + .18 * spring : .94 + .06 * spring;
      this.badge.setScale(scale, scale, 1);
      this.badge.setPosition(this.badgeAt.x, this.badgeAt.y + (this.win ? -18 : 18) * (1 - spring), this.badgeAt.z);
      this.badge.angle = (this.win ? -2 : 2) * (1 - p) * Math.cos(p * Math.PI * 2);
      // Small heraldic sparks stay beside the crown, away from the title and battle screen edges.
      const flare = clamp((this.age - .18) / .75);
      if (flare > 0 && flare < 1) {
        for (let i = 0; i < (this.win ? 6 : 3); i++) {
          const side = i % 2 ? 1 : -1, band = Math.floor(i / 2);
          const x = side * (116 + band * 37 + flare * 16), y = 390 + band * 12 + Math.sin(flare * Math.PI) * 13;
          this.diamond(x, y, (this.win ? 6 : 4) * Math.sin(flare * Math.PI), this.win ? '#FFDA62' : '#A5BED7', (1 - flare) * .85);
        }
      }
      this.stars.forEach((star, i) => {
        if (!star.earned) return;
        const t = this.age - (.34 + i * .19);
        if (t < 0) return;
        star.node.active = true;
        const p = clamp(t / .29), scale = .42 + .58 * back(p);
        star.node.setScale(scale, scale, 1);
        star.node.setPosition(star.position.x, star.position.y + 22 * (1 - out(t / .16)), star.position.z);
        if (t >= .15 && !star.sounded) { star.sounded = true; uiSound(i === this.earnedStars - 1 ? 'confirm' : 'select'); }
        const hit = clamp((t - .14) / .43);
        if (hit > 0 && hit < 1) {
          const x = star.position.x, y = star.position.y;
          g.strokeColor = CA('#F6C54E', (1 - hit) * .55); g.lineWidth = 2 * (1 - hit) + .5;
          g.circle(x, y, 23 + out(hit) * 8); g.stroke();
          for (let k = 0; k < 6; k++) {
            const angle = k * Math.PI / 3 + .25, distance = 28 + out(hit) * 23;
            this.diamond(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .48 + 4,
              3.7 * (1 - hit), '#FFE28A', 1 - hit);
          }
        }
      });
    }
    for (const row of this.rewards) {
      const t = this.age - row.delay;
      if (t < 0) continue;
      const p = clamp(t / row.duration), value = p >= 1 ? row.target : Math.round(row.from + (row.target - row.from) * out(p));
      if (value !== row.last) { row.label.string = String(value); row.last = value; }
      const land = clamp((t - row.duration) / .18);
      const scale = 1 + (p < 1 ? Math.sin(p * Math.PI) * .045 : Math.sin(land * Math.PI) * .13);
      row.node.setScale(scale, scale, 1);
      if (p >= 1 && !this.rewardCue) { this.rewardCue = true; uiSound('reward'); }
    }
  }

  private diamond(x: number, y: number, size: number, color: string, alpha: number): void {
    const g = this.ink; g.fillColor = CA(color, alpha);
    g.moveTo(x, y + size); g.lineTo(x + size * .45, y); g.lineTo(x, y - size); g.lineTo(x - size * .45, y);
    g.close(); g.fill();
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    if (this.drawReady) director.off(Director.EVENT_AFTER_DRAW, this.drawReady);
    this.drawReady = null; this.rewards.length = 0; this.stars.length = 0;
  }
}
