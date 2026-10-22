/** Local construction success pulse: one registered Component per Cocos script. */
import { _decorator, Component, director, Director, game, Game, Graphics, isValid, Node, Vec3 } from 'cc';
import { CA, N } from './UIKit';
import { reducedMotion } from './UIMotion';
import { whenUIArtReady } from './UIArtReady';
import { celebrationLight, lightEnvelope } from './FeedbackSurface';

const { ccclass } = _decorator;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const out = (v: number): number => 1 - (1 - clamp(v)) ** 3;
@ccclass('ConstructionPulse')
class ConstructionPulse extends Component {
  private icon!: Node;
  private scale = new Vec3();
  private ink!: Graphics;
  private light!: Node;
  private age = 0;
  private radius = 90;
  private hidden = false;
  private afterDraw: (() => void) | null = null;
  onLoad(): void { this.enabled = false; game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this); }
  configure(icon: Node, radius: number): void {
    this.icon = icon; this.radius = radius; this.scale.set(icon.scale); this.ink = this.node.addComponent(Graphics);
    this.light = celebrationLight(this.node, 'constructionSoftLight', 0, 0, radius * 2.5, radius * 2.5);
    whenUIArtReady(this.node.parent!, () => {
      if (!isValid(this.node, true)) return;
      this.afterDraw = () => { this.afterDraw = null; if (isValid(this.node, true)) this.enabled = true; };
      director.once(Director.EVENT_AFTER_DRAW, this.afterDraw);
    });
  }
  update(dt: number): void {
    if (this.hidden) return;
    if (!isValid(this.icon, true)) { this.node.destroy(); return; }
    this.age += Math.min(.06, Math.max(0, dt)); const p = clamp(this.age / 1.15);
    const scale = 1 + Math.sin(Math.PI * clamp(this.age / .38)) * .045;
    this.icon.setScale(this.scale.x * scale, this.scale.y * scale, this.scale.z);
    this.ink.clear(); lightEnvelope(this.light, this.age, 1.15, .62);
    this.ink.strokeColor = CA('#EFC869', (1 - p) * .65); this.ink.lineWidth = 1.6;
    this.ink.circle(0, 0, this.radius * (.48 + out(p) * .45)); this.ink.stroke();
    for (let i = 0; i < 8; i++) {
      const t = clamp((this.age - .1 - i % 3 * .04) / .7);
      if (t <= 0 || t >= 1) continue;
      const angle = i * Math.PI / 4, reach = this.radius * (.45 + t * .5);
      this.ink.fillColor = CA('#FFF1C0', Math.sin(Math.PI * t) * .8);
      this.ink.circle(Math.cos(angle) * reach, Math.sin(angle) * reach + t * 14, 1.8);
      this.ink.fill();
    }
    if (p >= 1) { this.icon.setScale(this.scale); this.node.destroy(); }
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void {
    if (this.afterDraw) director.off(Director.EVENT_AFTER_DRAW, this.afterDraw);
    if (isValid(this.icon, true)) this.icon.setScale(this.scale);
    game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
  }
}

export function constructionPulse(icon: Node, radius: number): void {
  if (reducedMotion() || !icon.parent) return;
  const glow = N('constructionSuccessGlow', icon.parent, icon.position.x, icon.position.y);
  glow.setSiblingIndex(icon.getSiblingIndex()); glow.addComponent(ConstructionPulse).configure(icon, radius);
}
