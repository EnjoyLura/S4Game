/** Global decorative taps: DOM capture for UI and engine input for unhandled game space. */
import { _decorator, Color, Component, EventTouch, game, Game, Graphics, input, Input, Vec2, view } from 'cc';
import { reducedMotion } from './UIMotion';

const { ccclass } = _decorator;
type Driver = 'dom' | 'engine';
interface Tap {
  id: number; driver: Driver; x: number; y: number; startX: number; startY: number;
  age: number; began: number; released: boolean; active: boolean;
}

@ccclass('TouchFeedback')
export class TouchFeedback extends Component {
  private ink!: Graphics;
  private canvas: HTMLCanvasElement | null = null;
  private taps: Tap[] = Array.from({ length: 8 }, () => ({
    id: -1, driver: 'dom', x: 0, y: 0, startX: 0, startY: 0,
    age: 0, began: 0, released: false, active: false,
  }));
  private color = new Color();
  private unlisten: (() => void)[] = [];
  private serial = 0;
  private point = new Vec2();

  onLoad(): void {
    this.ink = this.node.addComponent(Graphics);
    // UI consumes component events first; this independent entry covers bare battlefield/scene taps.
    input.on(Input.EventType.TOUCH_START, this.engineDown, this);
    input.on(Input.EventType.TOUCH_MOVE, this.engineMove, this);
    input.on(Input.EventType.TOUCH_END, this.engineUp, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.engineCancel, this);
    game.on(Game.EVENT_HIDE, this.clear, this);
    if (typeof document !== 'undefined') this.listenDOM();
    this.enabled = false;
  }

  private listenDOM(): void {
    this.canvas = game.canvas || document.getElementById('GameCanvas') as HTMLCanvasElement | null;
    const listen = (type: string, cb: EventListener): void => {
      window.addEventListener(type, cb, { capture: true, passive: true });
      this.unlisten.push(() => window.removeEventListener(type, cb, true));
    };
    const beginsInGame = (event: Event): boolean => {
      this.canvas = game.canvas || this.canvas;
      return !!this.canvas && (event.target === this.canvas || event.composedPath?.().includes(this.canvas));
    };
    if ('PointerEvent' in window) {
      listen('pointerdown', ((e: PointerEvent) => {
        if (e.button === 0 && beginsInGame(e)) this.domDown(e.pointerId, e.clientX, e.clientY);
      }) as EventListener);
      listen('pointermove', ((e: PointerEvent) => this.domMove(e.pointerId, e.clientX, e.clientY)) as EventListener);
      listen('pointerup', ((e: PointerEvent) => this.domUp(e.pointerId, e.clientX, e.clientY)) as EventListener);
      listen('pointercancel', ((e: PointerEvent) => this.cancel('dom', e.pointerId)) as EventListener);
    } else {
      let lastTouch = -Infinity;
      listen('touchstart', ((e: TouchEvent) => {
        if (!beginsInGame(e)) return;
        lastTouch = performance.now();
        for (const t of Array.from(e.changedTouches)) this.domDown(t.identifier, t.clientX, t.clientY);
      }) as EventListener);
      listen('touchmove', ((e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) this.domMove(t.identifier, t.clientX, t.clientY); }) as EventListener);
      listen('touchend', ((e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) this.domUp(t.identifier, t.clientX, t.clientY); }) as EventListener);
      listen('touchcancel', ((e: TouchEvent) => { for (const t of Array.from(e.changedTouches)) this.cancel('dom', t.identifier); }) as EventListener);
      listen('mousedown', ((e: MouseEvent) => {
        if (e.button === 0 && beginsInGame(e) && performance.now() - lastTouch > 700) this.domDown(-2, e.clientX, e.clientY);
      }) as EventListener);
      listen('mousemove', ((e: MouseEvent) => this.domMove(-2, e.clientX, e.clientY)) as EventListener);
      listen('mouseup', ((e: MouseEvent) => this.domUp(-2, e.clientX, e.clientY)) as EventListener);
    }
    listen('blur', () => this.clear());
  }

  private locate(x: number, y: number): { x: number; y: number } | null {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0 || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    const size = view.getVisibleSize();
    return { x: (x - rect.left) / rect.width * size.width - size.width / 2, y: size.height / 2 - (y - rect.top) / rect.height * size.height };
  }

  private enginePoint(e: EventTouch): Vec2 {
    e.getUILocation(this.point);
    const size = view.getVisibleSize(), origin = view.getVisibleOrigin();
    this.point.x -= origin.x + size.width / 2;
    this.point.y -= origin.y + size.height / 2;
    return this.point;
  }

  private engineDown(e: EventTouch): void {
    const p = this.enginePoint(e), now = performance.now();
    // DOM pointerdown precedes Cocos' mouse/touch translation. Do not draw the same gesture twice.
    if (this.taps.some(t => t.driver === 'dom' && now - t.began < 160 && Math.hypot(t.x-p.x, t.y-p.y) < 18)) return;
    this.begin('engine', e.getID(), p.x, p.y, p.x, p.y);
  }
  private engineMove(e: EventTouch): void {
    const p = this.enginePoint(e);
    this.move('engine', e.getID(), p.x, p.y, 10);
  }
  private engineUp(e: EventTouch): void {
    const p = this.enginePoint(e);
    this.release('engine', e.getID(), p.x, p.y, 10);
  }
  private engineCancel(e: EventTouch): void { this.cancel('engine', e.getID()); }

  private domDown(id: number, x: number, y: number): void {
    const p = this.locate(x, y);
    if (p) this.begin('dom', id, p.x, p.y, x, y);
  }
  private domMove(id: number, x: number, y: number): void { this.move('dom', id, x, y, 8); }
  private domUp(id: number, x: number, y: number): void {
    if (!this.locate(x, y)) { this.cancel('dom', id); return; }
    this.release('dom', id, x, y, 8);
  }

  private begin(driver: Driver, id: number, x: number, y: number, startX: number, startY: number): void {
    this.cancel(driver, id);
    const tap = this.taps.find(t => !t.active) || this.taps[this.serial++ % this.taps.length];
    Object.assign(tap, { driver, id, x, y, startX, startY, age: 0, began: performance.now(), released: false, active: true });
    this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    this.enabled = true;
    this.draw();
  }
  private move(driver: Driver, id: number, x: number, y: number, tolerance: number): void {
    const tap = this.taps.find(t => t.active && !t.released && t.driver === driver && t.id === id);
    if (tap && Math.hypot(x - tap.startX, y - tap.startY) > tolerance) { tap.active = false; this.draw(); }
  }
  private release(driver: Driver, id: number, x: number, y: number, tolerance: number): void {
    const tap = this.taps.find(t => t.active && !t.released && t.driver === driver && t.id === id);
    if (!tap) return;
    if (Math.hypot(x-tap.startX, y-tap.startY) > tolerance) { tap.active = false; this.draw(); return; }
    tap.released = true; tap.age = 0;
    this.draw();
  }
  private cancel(driver: Driver, id: number): void {
    for (const tap of this.taps) if (tap.driver === driver && tap.id === id && !tap.released) tap.active = false;
  }
  private clear(): void { this.taps.forEach(t => { t.active = false; }); this.ink?.clear(); this.enabled = false; }
  private tint(r: number, g: number, b: number, a: number): Color { return this.color.set(r, g, b, Math.round(Math.max(0, a))); }

  update(dt: number): void {
    const life = reducedMotion() ? .16 : .4;
    for (const tap of this.taps) {
      if (!tap.active) continue;
      tap.age += Math.min(dt, .05);
      if (tap.age >= (tap.released ? life : 3)) tap.active = false;
    }
    this.draw();
  }

  private draw(): void {
    const g = this.ink, reduced = reducedMotion();
    g.clear(); let active = false;
    for (const tap of this.taps) {
      if (!tap.active) continue;
      active = true;
      const p = tap.released ? Math.min(1, tap.age / (reduced ? .16 : .4)) : Math.min(1, tap.age / .2);
      const fade = tap.released ? (1-p) ** 1.6 : Math.max(.18, Math.exp(-tap.age * 7));
      const radius = tap.released ? 10 + (reduced ? 7 : 25) * (1 - (1-p) ** 2) : 8 + 3*p;
      // A thin dark edge keeps the warm ring readable over both parchment and bright terrain.
      g.strokeColor = this.tint(57, 35, 12, fade * 145); g.lineWidth = 4;
      g.circle(tap.x, tap.y, radius); g.stroke();
      g.strokeColor = this.tint(255, 208, 91, fade * 230); g.lineWidth = 2;
      g.circle(tap.x, tap.y, radius); g.stroke();
      g.strokeColor = this.tint(255, 248, 216, fade * 145); g.lineWidth = .8;
      g.circle(tap.x, tap.y, Math.max(2, radius - 1.3)); g.stroke();
      if (!tap.released) continue;
      g.fillColor = this.tint(255, 226, 142, Math.max(0, 1-p*4) * 210);
      g.circle(tap.x, tap.y, 2.8 * (1-p)); g.fill();
      if (reduced) continue;
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI/6 + i*Math.PI/3, distance = 12 + 27*p;
        const s = (i%2 ? 2 : 2.8) * (1-p);
        const x = tap.x+Math.cos(angle)*distance, y = tap.y+Math.sin(angle)*distance;
        g.fillColor = this.tint(230, 169, 60, fade * 220);
        g.moveTo(x, y+s*1.6); g.lineTo(x+s, y); g.lineTo(x, y-s*1.6); g.lineTo(x-s, y); g.close(); g.fill();
      }
    }
    if (!active) this.enabled = false;
  }

  onDestroy(): void {
    this.unlisten.forEach(off => off());
    input.off(Input.EventType.TOUCH_START, this.engineDown, this);
    input.off(Input.EventType.TOUCH_MOVE, this.engineMove, this);
    input.off(Input.EventType.TOUCH_END, this.engineUp, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.engineCancel, this);
    game.off(Game.EVENT_HIDE, this.clear, this);
  }
}
