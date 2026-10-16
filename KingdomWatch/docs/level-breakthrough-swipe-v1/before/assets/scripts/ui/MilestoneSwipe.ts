/** Horizontal milestone drag with card snapping and vertical-scroll handoff. */
import { _decorator, Component, EventTouch, game, Game, isValid, Node, ScrollView, Tween, tween, Vec2, Vec3 } from 'cc';
import { ButtonFeedback } from './ButtonFeedback';
import { uiSound } from './UIAudio';
import { interactionReady, reducedMotion } from './UIMotion';

const { ccclass } = _decorator;

@ccclass('MilestoneSwipe')
export class MilestoneSwipe extends Component {
  private content!: Node;
  private step = 194;
  private anchorX = -194;
  private maxIndex = 0;
  private index = 0;
  private onIndex: (index: number) => void = () => {};
  private motion: Tween<Node> | null = null;
  private pointer: number | null = null;
  private startPoint = new Vec2();
  private startX = 0;
  private startIndex = 0;
  private axis: 'pending' | 'horizontal' | 'vertical' = 'pending';
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0;
  private outer: ScrollView | null = null;
  private outerVertical = false;
  private outerCancel = true;
  private outerOffset = 0;
  private listening = false;

  configure(content: Node, index: number, maxIndex: number, onIndex: (index: number) => void): void {
    this.content = content; this.index = index; this.maxIndex = maxIndex; this.onIndex = onIndex;
    content.setPosition(this.anchorX - index * this.step, 0, 0);
    if (this.listening) return;
    this.listening = true;
    this.node.on(Node.EventType.TOUCH_START, this.press, this, true);
    this.node.on(Node.EventType.TOUCH_MOVE, this.move, this, true);
    this.node.on(Node.EventType.TOUCH_END, this.release, this, true);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.cancel, this, true);
    game.on(Game.EVENT_HIDE, this.abort, this);
  }

  private press(event: EventTouch): void {
    if (this.pointer !== null || !this.enabledInHierarchy || !interactionReady(this.node)) return;
    this.motion?.stop(); this.motion = null;
    this.pointer = event.getID(); this.startPoint.set(event.getUILocation());
    this.startX = this.content.position.x; this.startIndex = this.index;
    this.axis = 'pending'; this.velocity = 0;
    this.lastX = this.startPoint.x; this.lastTime = Date.now();
    for (let parent = this.node.parent; parent; parent = parent.parent) {
      const scroll = parent.getComponent(ScrollView);
      if (!scroll) continue;
      this.outer = scroll; this.outerVertical = scroll.vertical;
      this.outerCancel = scroll.cancelInnerEvents; this.outerOffset = scroll.getScrollOffset().y;
      // The parent still receives the gesture; hold its axis until direction is known.
      // Leave child delivery intact so its normal drag cancellation and our release both run.
      scroll.vertical = false; scroll.cancelInnerEvents = false;
      break;
    }
  }

  private move(event: EventTouch): void {
    if (event.getID() !== this.pointer) return;
    const point = event.getUILocation(), dx = point.x - this.startPoint.x, dy = point.y - this.startPoint.y;
    if (this.axis === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      this.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical';
      this.content.getComponentsInChildren(ButtonFeedback).forEach(button => button.reset());
      if (this.axis === 'vertical' && this.outer && isValid(this.outer, true)) {
        this.outer.vertical = this.outerVertical;
        // Include the initial direction-detection distance in the vertical gesture.
        if (this.outerVertical) {
          const max = this.outer.getMaxScrollOffset().y;
          this.outer.scrollToOffset(new Vec2(0, Math.max(0, Math.min(max, this.outerOffset - dy))), 0);
        }
      }
    }
    if (this.axis !== 'horizontal') return;
    const now = Date.now(), elapsed = now - this.lastTime;
    if (elapsed > 0) this.velocity = .4 * this.velocity + .6 * (point.x - this.lastX) / elapsed;
    this.lastX = point.x; this.lastTime = now;
    const min = this.anchorX - this.maxIndex * this.step;
    let x = this.startX + dx;
    if (x > this.anchorX) x = this.anchorX + Math.min(44, (x - this.anchorX) * .23);
    if (x < min) x = min - Math.min(44, (min - x) * .23);
    this.content.setPosition(x, 0, 0);
    event.propagationStopped = true;
  }

  private release(event: EventTouch): void {
    if (event.getID() !== this.pointer) return;
    if (this.axis === 'horizontal') {
      const dx = event.getUILocation().x - this.startPoint.x;
      let target = this.startIndex;
      const flick = Date.now() - this.lastTime < 90 && Math.abs(this.velocity) > .45 && Math.abs(dx) > 12;
      if (Math.abs(dx) > 32 || flick) {
        target = Math.round((this.anchorX - this.content.position.x) / this.step);
        if (target === this.startIndex) target += dx < 0 ? 1 : -1;
      }
      this.snap(target);
      event.propagationStopped = true;
    } else this.snap(this.index, false);
    this.restoreOuter(); this.pointer = null;
  }

  private cancel(event: EventTouch): void {
    if (event.simulate || event.getID() !== this.pointer) return;
    this.snap(this.index, false);
    this.restoreOuter(); this.pointer = null;
  }

  private snap(index: number, sound = true): void {
    const target = Math.max(0, Math.min(this.maxIndex, index)), changed = target !== this.index;
    this.index = target;
    if (changed) { this.onIndex(target); if (sound) uiSound('select'); }
    this.motion?.stop();
    const position = new Vec3(this.anchorX - target * this.step, 0, 0);
    if (reducedMotion()) { this.content.setPosition(position); this.motion = null; return; }
    this.motion = tween(this.content).to(.2, { position }, { easing: 'cubicOut' })
      .call(() => { this.motion = null; }).start();
  }

  private restoreOuter(): void {
    if (this.outer && isValid(this.outer, true)) {
      this.outer.vertical = this.outerVertical; this.outer.cancelInnerEvents = this.outerCancel;
    }
    this.outer = null;
  }

  private abort(): void {
    this.restoreOuter(); this.pointer = null;
    this.motion?.stop(); this.motion = null;
    if (this.content && isValid(this.content, true)) this.content.setPosition(this.anchorX - this.index * this.step, 0, 0);
  }

  onDisable(): void { this.abort(); }

  onDestroy(): void {
    this.restoreOuter(); this.motion?.stop();
    game.off(Game.EVENT_HIDE, this.abort, this);
    this.node.off(Node.EventType.TOUCH_START, this.press, this, true);
    this.node.off(Node.EventType.TOUCH_MOVE, this.move, this, true);
    this.node.off(Node.EventType.TOUCH_END, this.release, this, true);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.cancel, this, true);
  }
}
