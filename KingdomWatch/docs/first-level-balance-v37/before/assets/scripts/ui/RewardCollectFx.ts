/** Decorative wallet flights after acknowledging a persisted receipt; never changes balances. */
import { _decorator, Component, game, Game, Graphics, isValid, Node, UITransform, Vec3 } from 'cc';
import { comicArt } from './ComicUI';
import { CA, N } from './UIKit';
import { reducedMotion } from './UIMotion';
const { ccclass } = _decorator;
interface Flight { node: Node; from: Vec3; to: Vec3; delay: number; }
interface Landing { text: Node; scale: Vec3; at: Vec3; }
const clamp = (v: number): number => Math.max(0, Math.min(1, v));

@ccclass('RewardCollectFx')
class RewardCollectFx extends Component {
  private flights: Flight[] = [];
  private landings: Landing[] = [];
  private age = 0;
  private hidden = false;
  private ink!: Graphics;
  onLoad(): void { this.enabled = false; game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this); }
  configure(root: Node, icons: readonly string[]): void {
    const wallet = root.getChildByName('resBar')?.getChildByName('resourceWallet');
    // GameRoot is a plain Node; use this identity child as the local conversion space.
    const coordinates = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    if (!wallet) { this.node.destroy(); return; }
    this.ink = this.node.addComponent(Graphics);
    icons.forEach((icon, group) => {
      if (typeof icon !== 'string') return;
      const currency = icon.includes('diamond') ? 'diamond' : 'gold';
      const target = wallet.getChildByName('resource:' + currency), text = target?.getChildByName('resourceAmount');
      if (!target || !text) return;
      const to = coordinates.convertToNodeSpaceAR(target.worldPosition); to.x -= 81;
      this.landings.push({ text, scale: text.scale.clone(), at: to });
      for (let i = 0; i < 5; i++) {
        const from = new Vec3((group - (icons.length - 1) / 2) * 166 + (i - 2) * 11, -i * 8, 0);
        const node = comicArt(this.node, from.x, from.y, 28, 28, icon);
        this.flights.push({ node, from, to, delay: i * .045 + group * .035 });
      }
    });
    if (!this.flights.length) { this.node.destroy(); return; }
    this.enabled = true;
  }
  update(dt: number): void {
    if (this.hidden) return;
    this.age += Math.min(.06, Math.max(0, dt)); this.ink.clear();
    for (const f of this.flights) {
      const p = clamp((this.age - f.delay) / .56), ease = p * p * (3 - 2 * p);
      f.node.active = p < 1;
      f.node.setPosition(f.from.x + (f.to.x - f.from.x) * ease + Math.sin(p * Math.PI) * 52,
        f.from.y + (f.to.y - f.from.y) * ease + Math.sin(p * Math.PI) * 80, 0);
      f.node.setScale(1 - p * .45, 1 - p * .45, 1);
    }
    const hit = clamp((this.age - .55) / .43);
    this.landings.forEach(landing => {
      if (!isValid(landing.text, true)) return;
      const scale = 1 + Math.sin(hit * Math.PI) * .16;
      landing.text.setScale(landing.scale.x * scale, landing.scale.y * scale, landing.scale.z);
      if (hit > 0 && hit < 1) {
        this.ink.strokeColor = CA('#FFE39A', (1 - hit) * .8); this.ink.lineWidth = 2;
        this.ink.circle(landing.at.x, landing.at.y, 20 + hit * 24); this.ink.stroke();
      }
    });
    if (this.age >= 1.02) { this.restore(); this.node.destroy(); }
  }
  private restore(): void { this.landings.forEach(l => { if (isValid(l.text, true)) l.text.setScale(l.scale); }); }
  private hide = (): void => { this.hidden = true; };
  private show = (): void => { this.hidden = false; };
  onDestroy(): void { this.restore(); game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this); }
}

export function collectRewardFx(root: Node | null, items: readonly { icon: string; amount: number }[]): void {
  if (!root || !isValid(root, true) || reducedMotion()) return;
  // Creator's loose spread transform compiles [...Set] to [].concat(Set), not its values.
  const icons = Array.from(new Set(items.filter(i => Number.isFinite(i.amount) && i.amount > 0 &&
    typeof i.icon === 'string' && /comic_(coin|diamond)_v1$/.test(i.icon)).map(i => i.icon)));
  if (!icons.length) return;
  const previous = root.getChildByName('rewardCollectFx');
  if (previous) { previous.active = false; previous.removeFromParent(); previous.destroy(); }
  const host = N('rewardCollectFx', root);
  // Receipt acknowledgement must never depend on an optional decorative effect.
  try { host.addComponent(RewardCollectFx).configure(root, icons); }
  catch (error) {
    host.active = false; host.destroy();
    console.warn('[RewardCollectFx] decoration skipped', error);
  }
}
