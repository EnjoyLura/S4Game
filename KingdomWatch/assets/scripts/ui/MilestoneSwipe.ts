/** Horizontal milestone drag with card snapping and vertical-scroll handoff. */
import { _decorator, EventTouch, game, Game, isValid, Node, ScrollView, Touch, Tween, tween, UITransform, Vec2, Vec3, ViewGroup } from 'cc';
import { ButtonFeedback } from './ButtonFeedback';
import { uiSound } from './UIAudio';
import { interactionReady, reducedMotion } from './UIMotion';

const { ccclass } = _decorator;

@ccclass('MilestoneSwipe')
export class MilestoneSwipe extends ViewGroup {
  private content!: Node;
  private step = 194;
  private anchorX = -194;
  private maxIndex = 0;
  private index = 0;
  private onIndex: (index: number) => void = () => {};
  private motion: Tween<Node> | null = null;
  private pointer: number | null = null;
  private startPoint = new Vec2();
  private point = new Vec2();
  private localPoint = new Vec3();
  private transform!: UITransform;
  private startX = 0;
  private startIndex = 0;
  private axis: 'pending' | 'horizontal' | 'vertical' = 'pending';
  private lastX = 0;
  private lastTime = 0;
  private velocity = 0;
  private outer: ScrollView | null = null;
  private outerOffset = 0;
  private outerStartY = 0;
  private outerGesture = false;
  private touch: Touch | null = null;
  private windowId = 0;
  private listening = false;

  configure(content: Node, index: number, maxIndex: number, onIndex: (index: number) => void): void {
    this.content = content; this.index = index; this.maxIndex = maxIndex; this.onIndex = onIndex;
    this.transform = this.node.getComponent(UITransform)!;
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
    this.pointer = event.getID(); this.touch = event.touch; this.windowId = event.windowId;
    const point = this.positionOf(event);
    this.startPoint.set(point.x, point.y);
    this.startX = this.content.position.x;
    this.startIndex = this.boundedIndex(Math.round((this.anchorX - this.startX) / this.step));
    this.axis = 'pending'; this.velocity = 0;
    this.lastX = point.x; this.lastTime = performance.now();
    for (let parent = this.node.parent; parent; parent = parent.parent) {
      const scroll = parent.getComponent(ScrollView);
      if (!scroll?.enabledInHierarchy) continue;
      this.outer = scroll; scroll.stopAutoScroll();
      this.outerOffset = scroll.getScrollOffset().y;
      const ui = scroll.node.getComponent(UITransform)!;
      event.getUILocation(this.point); this.localPoint.set(this.point.x, this.point.y, 0);
      this.outerStartY = ui.convertToNodeSpaceAR(this.localPoint, this.localPoint).y;
      // ViewGroup keeps the parent's capture/cancellation out of this shelf.
      // A vertical gesture is forwarded explicitly, without changing shared ScrollView flags.
      break;
    }
  }

  private positionOf(event: EventTouch): Vec3 {
    event.getUILocation(this.point); this.localPoint.set(this.point.x, this.point.y, 0);
    return this.transform.convertToNodeSpaceAR(this.localPoint, this.localPoint);
  }

  private forwardOuter(event: EventTouch, type = event.type): void {
    if (!this.outer || !isValid(this.outer, true)) return;
    const forwarded = new EventTouch(event.getTouches(), true, type as ConstructorParameters<typeof EventTouch>[2], event.getAllTouches());
    forwarded.touch = event.touch; forwarded.windowId = event.windowId;
    this.outer.node.dispatchEvent(forwarded);
  }

  private beginVertical(event: EventTouch): void {
    if (!this.outer?.vertical || !isValid(this.outer, true)) return;
    // Account for pending motion once, in the parent's local coordinates and scroll direction.
    const previous = event.touch!.getUIPreviousLocation(this.point);
    this.localPoint.set(previous.x, previous.y, 0);
    const y = this.outer.node.getComponent(UITransform)!.convertToNodeSpaceAR(this.localPoint, this.localPoint).y;
    const max = this.outer.getMaxScrollOffset().y;
    this.outer.scrollToOffset(new Vec2(0, Math.max(0, Math.min(max, this.outerOffset + y - this.outerStartY))), 0);
    this.forwardOuter(event, Node.EventType.TOUCH_START); this.outerGesture = true;
  }

  private move(event: EventTouch): void {
    if (event.getID() !== this.pointer) return;
    const point = this.positionOf(event), x = point.x, dx = x - this.startPoint.x, dy = point.y - this.startPoint.y;
    if (this.axis === 'pending') {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax >= 6 && ax >= ay * .85) this.axis = 'horizontal';
      else if (ay >= 12 && ay > ax * 1.25) this.axis = 'vertical';
      else return;
      this.content.getComponentsInChildren(ButtonFeedback).forEach(button => button.reset());
      if (this.axis === 'vertical') this.beginVertical(event);
    }
    if (this.axis === 'vertical') {
      if (this.outerGesture) this.forwardOuter(event);
      event.propagationStopped = true; return;
    }
    const now = performance.now(), elapsed = Math.max(1, now - this.lastTime);
    const weight = 1 - Math.exp(-elapsed / 35);
    this.velocity += ((x - this.lastX) / elapsed - this.velocity) * weight;
    this.lastX = x; this.lastTime = now;
    this.dragTo(dx);
    event.propagationStopped = true;
  }

  private dragTo(dx: number): void {
    const min = this.anchorX - this.maxIndex * this.step;
    let x = this.startX + dx;
    const rubber = (distance: number): number => 52 * distance / (distance + 116);
    if (x > this.anchorX) x = this.anchorX + rubber(x - this.anchorX);
    if (x < min) x = min - rubber(min - x);
    this.content.setPosition(x, 0, 0);
  }

  private release(event: EventTouch): void {
    if (event.getID() !== this.pointer) return;
    if (this.axis === 'horizontal') {
      const dx = this.positionOf(event).x - this.startPoint.x;
      this.dragTo(dx);
      const velocity = performance.now() - this.lastTime < 90 ? this.velocity : 0;
      const flick = Math.abs(velocity) > .35 && Math.abs(dx) > 10;
      const coast = flick ? Math.max(-this.step * 1.25, Math.min(this.step * 1.25, velocity * 130)) : 0;
      let target = Math.round((this.anchorX - this.content.position.x - coast) / this.step);
      if (target === this.startIndex && (Math.abs(dx) > 30 || flick)) {
        target += (flick ? velocity : dx) < 0 ? 1 : -1;
      }
      this.snap(target);
      event.propagationStopped = true;
    } else {
      if (this.outerGesture) this.forwardOuter(event);
      this.snap(this.startIndex, false);
    }
    this.endGesture();
  }

  private cancel(event: EventTouch): void {
    if (event.simulate || event.getID() !== this.pointer) return;
    if (this.outerGesture) this.forwardOuter(event);
    this.snap(Math.round((this.anchorX - this.content.position.x) / this.step), false);
    this.endGesture();
  }

  private boundedIndex(index: number): number { return Math.max(0, Math.min(this.maxIndex, index)); }

  private snap(index: number, sound = true): void {
    const target = this.boundedIndex(index), changed = target !== this.index;
    this.index = target;
    if (changed) { this.onIndex(target); if (sound) uiSound('select'); }
    this.motion?.stop();
    const position = new Vec3(this.anchorX - target * this.step, 0, 0);
    if (reducedMotion()) { this.content.setPosition(position); this.motion = null; return; }
    const seconds = .14 + .09 * Math.min(1, Math.abs(position.x - this.content.position.x) / this.step);
    this.motion = tween(this.content).to(seconds, { position }, { easing: 'cubicOut' })
      .call(() => { this.motion = null; }).start();
  }

  private endGesture(): void {
    this.outer = null; this.outerGesture = false; this.touch = null; this.pointer = null; this.axis = 'pending';
  }

  private abort(): void {
    if (this.outerGesture && this.touch && this.outer && isValid(this.outer, true)) {
      const cancel = new EventTouch([this.touch], true, Node.EventType.TOUCH_CANCEL);
      cancel.touch = this.touch; cancel.windowId = this.windowId;
      this.forwardOuter(cancel); this.outer.stopAutoScroll();
    }
    this.endGesture();
    this.motion?.stop(); this.motion = null;
    if (this.content && isValid(this.content, true)) this.content.setPosition(this.anchorX - this.index * this.step, 0, 0);
  }

  onDisable(): void { this.abort(); }

  onDestroy(): void {
    this.abort();
    game.off(Game.EVENT_HIDE, this.abort, this);
    this.node.off(Node.EventType.TOUCH_START, this.press, this, true);
    this.node.off(Node.EventType.TOUCH_MOVE, this.move, this, true);
    this.node.off(Node.EventType.TOUCH_END, this.release, this, true);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.cancel, this, true);
  }
}
