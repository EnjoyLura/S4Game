/** Short, interruptible UI motion. The resting layout is always the source of truth. */
import { _decorator, BlockInputEvents, Component, director, Director, isValid, Node, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { uiSound } from './UIAudio';
import { trackUISurface, whenUIArtReady } from './UIArtReady';

const { ccclass } = _decorator;
const busy = new WeakSet<Node>();
type Motion = 'page' | 'modal' | 'fade' | 'refresh';
const reduceMedia = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;

export function reducedMotion(): boolean {
  return !!reduceMedia?.matches;
}

export function interactionReady(node: Node): boolean {
  for (let n: Node | null = node; n; n = n.parent) if (busy.has(n)) return false;
  return true;
}

@ccclass('UIMotion')
export class UIMotion extends Component {
  private opacity!: UIOpacity;
  private move: Tween<Node> | null = null;
  private fade: Tween<UIOpacity> | null = null;
  private position = new Vec3();
  private scale = new Vec3(1, 1, 1);
  private restingOpacity = 255;
  private captured = false;
  private closing = false;
  private shield: Node | null = null;
  private outgoing: Node | null = null;
  private waitingForArt = false;
  private redrawVersion = 0;
  private drawReady: (() => void) | null = null;
  private surfaceReady: (() => void) | null = null;

  private capture(): void {
    if (this.captured) return;
    this.captured = true;
    this.position.set(this.node.position); this.scale.set(this.node.scale);
    this.opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    this.restingOpacity = this.opacity.opacity;
  }

  reset(): void {
    this.move?.stop(); this.fade?.stop(); this.move = null; this.fade = null;
    busy.delete(this.node);
    if (this.captured && isValid(this.node)) {
      this.node.setPosition(this.position); this.node.setScale(this.scale);
      this.opacity.opacity = this.restingOpacity;
    }
  }

  present(kind: Motion, direction = 1, done?: () => void): void {
    if (this.closing) return;
    this.capture(); this.reset();
    // A data refresh must never dim the whole page and expose its pale backdrop.
    if (kind === 'refresh') { done?.(); return; }
    const reduced = reducedMotion();
    // Graphics, labels and sprites do not share one opacity path. Full pages stay opaque.
    if (kind === 'page') {
      if (reduced) { done?.(); return; }
      this.node.setPosition(this.position.x + 8 * direction, this.position.y, this.position.z);
      busy.add(this.node);
      this.move = tween(this.node).to(.16, { position: this.position.clone() }, { easing: 'cubicOut' })
        .call(() => { busy.delete(this.node); this.move = null; done?.(); }).start();
      return;
    }
    const duration = reduced ? .08 : .18;
    this.opacity.opacity = 0;
    if (!reduced && kind === 'modal') {
      this.node.setPosition(this.position.x, this.position.y - 9, this.position.z);
      this.node.setScale(this.scale.x * .975, this.scale.y * .975, this.scale.z);
      this.move = tween(this.node).to(duration, { position: this.position.clone(), scale: this.scale.clone() }, { easing: 'cubicOut' }).start();
    }
    busy.add(this.node);
    this.fade = tween(this.opacity).to(duration, { opacity: this.restingOpacity }, { easing: 'quadOut' })
      .call(() => { busy.delete(this.node); this.fade = null; done?.(); }).start();
  }

  /** Keep the previous complete surface until its replacement's art is ready. */
  rebuild(build: () => void, direction = 0): void {
    if (this.closing) return;
    this.capture(); this.reset();
    const version = ++this.redrawVersion;
    this.cancelDraw();
    this.surfaceReady?.(); this.surfaceReady = trackUISurface(this.node);
    if (this.waitingForArt) {
      // A newer navigation request replaces the hidden candidate, not the visible page.
      for (const child of [...this.node.children]) {
        child.active = false; child.removeFromParent(); child.destroy();
      }
    } else {
      this.clearOutgoing();
      if (this.node.children.length && this.node.parent) {
        const old = new Node('retainedUI'); old.layer = this.node.layer;
        old.setParent(this.node.parent); old.setSiblingIndex(this.node.getSiblingIndex() + 1);
        old.setPosition(this.position); old.setScale(this.scale);
        old.addComponent(UIOpacity).opacity = this.restingOpacity;
        const size = view.getVisibleSize();
        old.addComponent(UITransform).setContentSize(size.width * 3, size.height * 3);
        old.addComponent(BlockInputEvents);
        for (const child of [...this.node.children]) child.setParent(old);
        busy.add(old); this.outgoing = old;
      }
    }
    this.waitingForArt = true;
    // Build at full opacity behind the retained page, so every renderer can warm together.
    this.opacity.opacity = this.restingOpacity;
    busy.add(this.node);
    build();
    whenUIArtReady(this.node, () => {
      if (!isValid(this.node, true) || version !== this.redrawVersion) return;
      this.afterDraw(() => {
        if (!isValid(this.node, true) || version !== this.redrawVersion) return;
        this.waitingForArt = false;
        const finish = (): void => {
          if (version !== this.redrawVersion) return;
          busy.delete(this.node); this.clearOutgoing();
          this.surfaceReady?.(); this.surfaceReady = null;
        };
        if (this.outgoing && isValid(this.outgoing, true)) {
          this.node.setSiblingIndex(this.outgoing.getSiblingIndex());
          if (direction) { this.present('page', direction, finish); return; }
        }
        finish();
      });
    }, this.node);
  }

  private cancelDraw(): void {
    if (this.drawReady) director.off(Director.EVENT_AFTER_DRAW, this.drawReady);
    this.drawReady = null;
  }

  private afterDraw(done: () => void): void {
    this.cancelDraw();
    this.drawReady = (): void => { this.drawReady = null; done(); };
    director.once(Director.EVENT_AFTER_DRAW, this.drawReady);
  }

  private clearOutgoing(): void {
    if (this.outgoing && isValid(this.outgoing, true)) {
      busy.delete(this.outgoing);
      this.outgoing.active = false; this.outgoing.destroy();
    }
    this.outgoing = null;
  }

  private beginClose(sound: boolean): void {
    this.capture(); this.reset(); this.closing = true;
    this.move?.stop(); this.fade?.stop();
    busy.add(this.node);
    // Keep the retiring surface opaque to input until it is gone, including blank catchers.
    this.shield = new Node('retiringInputShield'); this.shield.layer = this.node.layer;
    this.shield.setParent(this.node);
    const size = view.getVisibleSize();
    this.shield.addComponent(UITransform).setContentSize(size.width * 3, size.height * 3);
    this.shield.addComponent(BlockInputEvents);
    if (sound) uiSound('close');
  }

  /** Full-screen overlays stay complete until the refreshed destination has drawn. */
  dismissAfterRefresh(destination: Node, refresh: () => void): void {
    if (this.closing) return;
    this.beginClose(true);
    refresh();
    whenUIArtReady(destination, () => {
      if (!isValid(this.node, true)) return;
      this.afterDraw(() => {
        if (!isValid(this.node, true)) return;
        this.node.active = false; this.node.destroy();
      });
    });
  }

  dismiss(done?: () => void, sound = true): void {
    if (this.closing) return;
    this.beginClose(sound);
    this.fade = tween(this.opacity).to(reducedMotion() ? .06 : .12, { opacity: 0 }, { easing: 'quadIn' }).call(() => {
      this.node.active = false;
      this.node.destroy();
      done?.();
    }).start();
  }

  linger(seconds: number, done?: () => void): void {
    this.capture();
    this.scheduleOnce(() => {
      if (this.closing) return;
      this.closing = true; this.move?.stop(); this.fade?.stop();
      // A toast is decorative: its fade must never install a full-screen input shield.
      this.fade = tween(this.opacity).to(.22, { opacity: 0 }).call(() => { this.node.destroy(); done?.(); }).start();
    }, seconds);
  }

  onDisable(): void { if (!this.closing) this.reset(); }
  onDestroy(): void {
    ++this.redrawVersion;
    this.cancelDraw(); this.surfaceReady?.(); this.surfaceReady = null;
    this.move?.stop(); this.fade?.stop(); busy.delete(this.node); this.clearOutgoing();
  }
}

export function motionIn(node: Node, kind: Motion = 'modal', direction = 1): void {
  (node.getComponent(UIMotion) || node.addComponent(UIMotion)).present(kind, direction);
}

export function stopMotion(node: Node): void { node.getComponent(UIMotion)?.reset(); }

export function refreshUI(node: Node, build: () => void, direction = 0): void {
  (node.getComponent(UIMotion) || node.addComponent(UIMotion)).rebuild(build, direction);
}

export function expireUI(node: Node, seconds: number, done?: () => void): void {
  (node.getComponent(UIMotion) || node.addComponent(UIMotion)).linger(seconds, done);
}

export function dismissUI(node: Node | null, done?: () => void, sound = true): void {
  if (!node || !isValid(node, true)) { done?.(); return; }
  (node.getComponent(UIMotion) || node.addComponent(UIMotion)).dismiss(done, sound);
}

export function dismissUIAfterRefresh(node: Node, destination: Node, refresh: () => void): void {
  if (!isValid(node, true) || !isValid(destination, true)) return;
  (node.getComponent(UIMotion) || node.addComponent(UIMotion)).dismissAfterRefresh(destination, refresh);
}

/** Detach the retiring display so a new panel can be built without a stale tween clearing it. */
export function retireChildren(root: Node, sound = true): void {
  stopMotion(root);
  if (!root.children.length || !root.parent) return;
  const outgoing = new Node('retiringUI'); outgoing.layer = root.layer;
  outgoing.setParent(root.parent); outgoing.setSiblingIndex(root.getSiblingIndex() + 1);
  outgoing.setPosition(root.position); outgoing.setScale(root.scale);
  for (const child of [...root.children]) child.setParent(outgoing);
  dismissUI(outgoing, undefined, sound);
}
