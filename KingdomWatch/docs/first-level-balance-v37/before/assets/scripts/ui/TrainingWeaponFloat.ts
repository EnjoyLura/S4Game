/** Slow vertical showcase motion, isolated from illustration loading and layout. */
import { _decorator, Component, game, Vec3 } from 'cc';
import { reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
const AMPLITUDE = 7;
const PERIOD_MS = 4000;

@ccclass('TrainingWeaponFloat')
export class TrainingWeaponFloat extends Component {
  private rest = new Vec3();

  onLoad(): void { this.rest.set(this.node.position); }

  update(): void {
    // A shared phase keeps the weapon continuous when an upgrade rebuilds the page.
    const offset = reducedMotion() ? 0 : Math.sin((game.totalTime % PERIOD_MS) / PERIOD_MS * Math.PI * 2) * AMPLITUDE;
    this.node.setPosition(this.rest.x, this.rest.y + offset, this.rest.z);
  }

  onDisable(): void { this.node.setPosition(this.rest); }
}
