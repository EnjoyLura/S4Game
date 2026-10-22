/** A bounded two-dimensional camera; map art scales while chapter targets retain a readable size. */
import { _decorator, Component, EventTouch, game, Game, Node, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass } = _decorator;
export interface EndlessCamera { u: number; v: number; zoom: number; }
export const ENDLESS_MAP_W = 1200, ENDLESS_MAP_H = 1800;
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

@ccclass('EndlessMapController')
export class EndlessMapController extends Component {
  private world!: Node;
  private memory!: EndlessCamera;
  private pins: Node[] = [];
  private height = 0;
  private minimum = 1;
  private scale = 1;
  private touches = new Map<number, Vec2>();
  private lastCenter: Vec2 | null = null;
  private lastDistance = 0;
  private multi = false;
  private quietUntil = 0;

  onLoad(): void { game.on(Game.EVENT_HIDE, this.clearGesture, this); }

  configure(world: Node, height: number, memory: EndlessCamera, pins: Node[]): void {
    this.world = world; this.height = height; this.memory = memory; this.pins = pins;
    this.minimum = Math.max(750 / ENDLESS_MAP_W, height / ENDLESS_MAP_H);
    this.scale = this.minimum * clamp(memory.zoom, 1, 2.6);
    world.setPosition((.5 - memory.u) * ENDLESS_MAP_W * this.scale,
      (memory.v - .5) * ENDLESS_MAP_H * this.scale, 0);
    this.paint();
    this.node.on(Node.EventType.TOUCH_START, this.press, this, true);
    this.node.on(Node.EventType.TOUCH_MOVE, this.move, this, true);
    this.node.on(Node.EventType.TOUCH_END, this.release, this, true);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.release, this, true);
  }
  canTap(): boolean { return !this.multi && Date.now() >= this.quietUntil; }
  configurePins(pins: Node[]): void { this.pins = pins; this.paint(); }
  focus(u: number, v: number, y = 0): void {
    this.world.setPosition((.5 - u) * ENDLESS_MAP_W * this.scale,
      y + (v - .5) * ENDLESS_MAP_H * this.scale, 0);
    this.paint();
  }
  zoomBy(factor: number): void { this.zoomAt(this.scale * factor, new Vec2()); }
  private point(e: EventTouch): Vec2 {
    const p = e.getUILocation();
    const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
    return new Vec2(local.x, local.y);
  }
  private gesture(): { center: Vec2; distance: number } {
    const points = Array.from(this.touches.values());
    return points.length > 1 ? { center: new Vec2((points[0].x + points[1].x) / 2,
      (points[0].y + points[1].y) / 2), distance: Vec2.distance(points[0], points[1]) }
      : { center: points[0], distance: 0 };
  }
  private press(e: EventTouch): void {
    this.touches.set(e.getID(), this.point(e));
    if (this.touches.size > 1) this.multi = true;
    const g = this.gesture(); this.lastCenter = g.center.clone(); this.lastDistance = g.distance;
  }
  private move(e: EventTouch): void {
    if (!this.touches.has(e.getID())) return;
    this.touches.set(e.getID(), this.point(e));
    const g = this.gesture();
    if (this.lastCenter) {
      const p = this.world.position;
      this.world.setPosition(p.x + g.center.x - this.lastCenter.x, p.y + g.center.y - this.lastCenter.y, 0);
      if (g.distance > 0 && this.lastDistance > 0) this.zoomAt(this.scale * g.distance / this.lastDistance, g.center);
      else this.paint();
    }
    this.lastCenter = g.center.clone(); this.lastDistance = g.distance;
  }
  private release(e: EventTouch): void {
    this.touches.delete(e.getID());
    if (this.multi) this.quietUntil = Date.now() + 160;
    if (this.touches.size) {
      const g = this.gesture(); this.lastCenter = g.center.clone(); this.lastDistance = g.distance;
    } else { this.lastCenter = null; this.lastDistance = 0; this.multi = false; }
  }
  private zoomAt(next: number, at: Vec2): void {
    next = clamp(next, this.minimum, this.minimum * 2.6);
    const k = next / this.scale, p = this.world.position;
    this.world.setPosition(at.x + (p.x - at.x) * k, at.y + (p.y - at.y) * k, 0);
    this.scale = next; this.paint();
  }
  private paint(): void {
    const maxX = Math.max(0, (ENDLESS_MAP_W * this.scale - 750) / 2);
    const maxY = Math.max(0, (ENDLESS_MAP_H * this.scale - this.height) / 2);
    const p = this.world.position;
    this.world.setPosition(clamp(p.x, -maxX, maxX), clamp(p.y, -maxY, maxY), 0);
    this.world.setScale(this.scale, this.scale, 1);
    this.pins.forEach(pin => pin.setScale(1 / this.scale, 1 / this.scale, 1));
    this.memory.u = .5 - this.world.position.x / (ENDLESS_MAP_W * this.scale);
    this.memory.v = .5 + this.world.position.y / (ENDLESS_MAP_H * this.scale);
    this.memory.zoom = this.scale / this.minimum;
  }
  private clearGesture = (): void => { this.touches.clear(); this.lastCenter = null; this.lastDistance = 0; this.multi = false; };
  onDisable(): void { this.clearGesture(); }
  onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.clearGesture, this);
    this.node.off(Node.EventType.TOUCH_START, this.press, this, true);
    this.node.off(Node.EventType.TOUCH_MOVE, this.move, this, true);
    this.node.off(Node.EventType.TOUCH_END, this.release, this, true);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.release, this, true);
  }
}
