/** Temporarily show the upgrade just earned in the existing comparison, then restore the next preview. */
import { _decorator, Component, game, Game, isValid, Label, Node, UIOpacity, Vec3 } from 'cc';
import { reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
@ccclass('TrainingResultPulse')
export class TrainingResultPulse extends Component {
  private labels: { node: Node; scale: Vec3 }[] = [];
  private lights: UIOpacity[] = [];
  private stamp!: Label;
  private resultAge = 0;
  private hidden = false;
  private restore: (() => void) | null = null;
  onLoad(): void {
    this.enabled = false;
    game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
  }
  configure(labels: Node[], lights: Node[], stamp: Label): void {
    this.labels = labels.map(node => ({ node, scale: node.scale.clone() }));
    this.lights = lights.map(node => node.addComponent(UIOpacity));
    this.stamp = stamp;
    this.resetArt();
  }
  present(apply: () => void, restore: () => void): void {
    this.restore = restore; this.resultAge = 0;
    apply(); this.stamp.string = '本次提升';
    this.enabled = true; this.paint();
  }
  update(dt: number): void {
    if (this.hidden) return;
    this.resultAge += Math.min(.06, Math.max(0, dt));
    if (this.resultAge >= 2.6) { this.enabled = false; return; }
    this.paint();
  }
  private paint(): void {
    const quiet = reducedMotion();
    this.lights.forEach((fade, i) => {
      const age = this.resultAge - i * .08;
      const light = clamp(age / .08) * (1 - clamp((age - .4) / .55));
      fade.opacity = quiet ? 0 : Math.round(255 * light * .52);
    });
    const bump = quiet ? 0 : Math.sin(Math.PI * clamp((this.resultAge - .08) / .3)) * .08;
    this.labels.forEach(({node,scale}) => { if (isValid(node)) node.setScale(scale.x * (1 + bump), scale.y * (1 + bump), scale.z); });
  }
  private resetArt(): void {
    this.labels.forEach(({node,scale}) => { if (isValid(node)) node.setScale(scale); });
    this.lights.forEach(fade => { if (isValid(fade)) fade.opacity = 0; });
    if (this.stamp && isValid(this.stamp)) this.stamp.string = '';
  }
  onDisable(): void {
    this.resetArt();
    const restore = this.restore; this.restore = null;
    if (isValid(this.node, true)) restore?.();
  }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void { game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this); }
}
