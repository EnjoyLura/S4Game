/** Optional hold-to-repeat for the two cultivation buttons; one saved action per tick. */
import { _decorator, Component, game, Game } from 'cc';
import { interactionReady } from './UIMotion';

const { ccclass } = _decorator;

@ccclass('HoldUpgrade')
export class HoldUpgrade extends Component {
  private held = false;
  private repeated = false;
  private age = 0;
  private next = .45;
  private count = 0;
  private step: (repeating: boolean) => boolean = () => false;

  onLoad(): void { game.on(Game.EVENT_HIDE, this.stop, this); }
  configure(step: (repeating: boolean) => boolean): void { this.step = step; }

  press(held: boolean): void {
    if (!held) { this.stop(); return; }
    this.held = true; this.repeated = false; this.age = 0; this.next = .45; this.count = 0;
  }

  click(): void {
    // ButtonFeedback sends press(false) before click; retain this until the next press.
    if (!this.repeated) this.step(false);
  }

  update(dt: number): void {
    if (!this.held) return;
    if (!interactionReady(this.node)) { this.stop(); return; }
    this.age += Math.min(dt, .1);
    if (this.age < this.next) return;
    this.repeated = true;
    if (!this.step(true)) { this.stop(); return; }
    this.count++;
    // No catch-up loop after a slow frame. Never spend several levels in one frame.
    this.next = this.age + Math.max(.16, .26 - this.count * .02);
  }

  private stop = (): void => { this.held = false; };
  onDisable(): void { this.stop(); }
  onDestroy(): void { game.off(Game.EVENT_HIDE, this.stop, this); }
}
