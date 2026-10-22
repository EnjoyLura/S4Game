/** Shared touch lifecycle. Scroll cancellation and disabled actions never count as clicks. */
import { _decorator, Component, EventTouch, game, Game, isValid, Node, Tween, tween, UITransform, Vec2, Vec3 } from 'cc';
import { uiSound, UISound } from './UIAudio';
import { interactionReady, reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
let lastActivation = -Infinity;
const activeFeedback = new Set<ButtonFeedback>();

export interface FeedbackOptions {
  visual?: Node;
  enabled?: () => boolean;
  motion?: boolean;
  /** Some cards own their selection spring; only compress them on pointer-down. */
  releaseMotion?: boolean;
  scale?: number;
  shift?: number;
  circle?: boolean;
  radius?: number;
  dragThreshold?: number;
  sound?: boolean | UISound;
  soundAfterAction?: boolean;
  overlayParent?: Node;
  overlayPosition?: Vec3;
  onPress?: (pressed: boolean) => void;
}

@ccclass('ButtonFeedback')
export class ButtonFeedback extends Component {
  private action: () => void = () => {};
  private options: FeedbackOptions = {};
  private visual!: Node;
  private motionTween: Tween<Node> | null = null;
  private basePosition = new Vec3();
  private baseScale = new Vec3(1, 1, 1);
  private hasBase = false;
  private down = false;
  private pointer: number | null = null;
  private start = new Vec2();
  private cancelled = false;
  private hovered = false;
  private listening = false;

  configure(action: () => void, options: FeedbackOptions): this {
    this.reset();
    this.action = action;
    this.options = { ...this.options, ...options };
    this.visual = this.options.visual || this.node;
    if (!this.listening) {
      this.listening = true;
      this.node.on(Node.EventType.TOUCH_START, this.press, this);
      this.node.on(Node.EventType.TOUCH_MOVE, this.move, this);
      this.node.on(Node.EventType.TOUCH_CANCEL, this.cancel, this);
      this.node.on(Node.EventType.TOUCH_END, this.release, this);
      this.node.on(Node.EventType.MOUSE_ENTER, this.enter, this);
      this.node.on(Node.EventType.MOUSE_LEAVE, this.leave, this);
    }
    return this;
  }

  private available(): boolean {
    return this.enabledInHierarchy && isValid(this.node, true) && this.node.activeInHierarchy && interactionReady(this.node) && (this.options.enabled?.() ?? true);
  }

  private restore(): void {
    this.motionTween?.stop(); this.motionTween = null;
    if (this.hasBase && isValid(this.visual) && this.options.motion !== false) {
      this.visual.setPosition(this.basePosition);
      this.visual.setScale(this.baseScale);
    }
    this.hasBase = false;
  }

  /** Also used when a button becomes busy/disabled or its page disappears. */
  reset(): void {
    this.down = false; this.pointer = null; this.hovered = false;
    activeFeedback.delete(this);
    this.restore();
    this.options.onPress?.(false);
  }

  private press(event: EventTouch): void {
    if (this.down || !this.available()) return;
    // A child action owns its gesture; leave bubbling intact for ScrollView's drag capture.
    let target = event.target as Node | null;
    while (target && target !== this.node) {
      if (target.getComponent(ButtonFeedback)) return;
      target = target.parent;
    }
    this.restore();
    this.down = true; this.cancelled = false;
    activeFeedback.add(this);
    this.pointer = event.getID(); this.start.set(event.getUILocation());
    this.basePosition.set(this.visual.position); this.baseScale.set(this.visual.scale); this.hasBase = true;
    if (this.options.motion !== false) {
      const scale = reducedMotion() ? .98 : this.options.scale ?? .94, shift = reducedMotion() ? 0 : this.options.shift ?? 2;
      this.motionTween = tween(this.visual).to(.07, {
        scale: new Vec3(this.baseScale.x * scale, this.baseScale.y * scale, this.baseScale.z),
        position: new Vec3(this.basePosition.x, this.basePosition.y - shift, this.basePosition.z),
      }, { easing: 'cubicOut' }).start();
    }
    this.options.onPress?.(true);
  }

  private inside(event: EventTouch): boolean {
    const transform = this.node.getComponent(UITransform)!;
    if (!this.hasBase || this.options.motion === false) {
      return transform.hitTest(event.getLocation(), event.windowId);
    }
    // Sample resting bounds even when the moving visual is a shared ancestor of the hit target.
    const position = this.visual.position.clone(), scale = this.visual.scale.clone();
    this.visual.setPosition(this.basePosition); this.visual.setScale(this.baseScale);
    const hit = transform.hitTest(event.getLocation(), event.windowId);
    this.visual.setPosition(position); this.visual.setScale(scale);
    return hit;
  }

  private move(event: EventTouch): void {
    if (!this.down || event.getID() !== this.pointer) return;
    if (Vec2.distance(this.start, event.getUILocation()) > (this.options.dragThreshold ?? 12) || !this.inside(event)) {
      this.cancelled = true;
      this.restore(); this.options.onPress?.(false);
    }
  }

  private cancel(event: EventTouch): void {
    if (this.down && event.getID() === this.pointer) this.reset();
  }

  private release(event: EventTouch): void {
    event.propagationStopped = true;
    if (!this.down || event.getID() !== this.pointer) return;
    const moved = Vec2.distance(this.start, event.getUILocation()) > (this.options.dragThreshold ?? 12);
    const pressedPosition = this.visual.position.clone(), pressedScale = this.visual.scale.clone();
    const rebound = this.hasBase && this.options.motion !== false && this.options.releaseMotion !== false;
    // Restore before hit testing: shrinking a face must not shrink its touch target.
    this.restore();
    const accepted = !this.cancelled && !moved && this.available() && this.inside(event) && Date.now() - lastActivation >= 140;
    this.down = false; this.pointer = null; this.options.onPress?.(false);
    if (!this.hovered) activeFeedback.delete(this);
    if (!accepted) return;
    lastActivation = Date.now();
    if (rebound) {
      activeFeedback.add(this);
      this.visual.setPosition(pressedPosition); this.visual.setScale(pressedScale); this.hasBase = true;
      const settled = (): void => { this.hasBase = false; if (!this.hovered && !this.down) activeFeedback.delete(this); };
      if (reducedMotion()) {
        this.motionTween = tween(this.visual).to(.1, { position: this.basePosition.clone(), scale: this.baseScale.clone() },
          { easing: 'quadOut' }).call(settled).start();
      } else {
        // A very quick tap still has a visible compression before its one soft rebound.
        this.visual.setScale(Math.min(pressedScale.x, this.baseScale.x * .96), Math.min(pressedScale.y, this.baseScale.y * .96), this.baseScale.z);
        this.motionTween = tween(this.visual)
          .to(.1, { position: this.basePosition.clone(), scale: new Vec3(this.baseScale.x * 1.022, this.baseScale.y * 1.022, this.baseScale.z) }, { easing: 'quadOut' })
          .to(.13, { scale: this.baseScale.clone() }, { easing: 'sineInOut' })
          .call(settled).start();
      }
    }
    const sound = typeof this.options.sound === 'string' ? this.options.sound : 'tap';
    if (this.options.sound !== false && !this.options.soundAfterAction) uiSound(sound);
    this.action();
    if (this.options.sound !== false && this.options.soundAfterAction) uiSound(sound);
  }

  private enter(): void {
    this.hovered = true;
    if (this.down || !this.available() || this.options.motion === false || reducedMotion()) return;
    this.restore(); activeFeedback.add(this);
    this.basePosition.set(this.visual.position); this.baseScale.set(this.visual.scale); this.hasBase = true;
    this.motionTween = tween(this.visual).to(.1, { scale: new Vec3(this.baseScale.x * 1.012, this.baseScale.y * 1.012, this.baseScale.z) }, { easing: 'quadOut' }).start();
  }
  private leave(): void { this.hovered = false; if (!this.down) { this.restore(); activeFeedback.delete(this); } }
  onDisable(): void { this.reset(); }
  onDestroy(): void {
    activeFeedback.delete(this); this.motionTween?.stop();
  }
}

game.on(Game.EVENT_HIDE, () => { for (const feedback of activeFeedback) feedback.reset(); });

/** Rebinding changes the action without stacking handlers or losing the original button face. */
export function bindButton(node: Node, action: () => void, options: FeedbackOptions = {}): ButtonFeedback {
  return (node.getComponent(ButtonFeedback) || node.addComponent(ButtonFeedback)).configure(action, options);
}
