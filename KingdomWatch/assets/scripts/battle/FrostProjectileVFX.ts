/** Normal ice shots reuse the ultimate's painted crystal. Rendering only.
 * Fixed Sprite pool, straight-alpha facets and distance-based cold trails.
 */
import { Color, Graphics, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { MAX_PROJS } from '../config/GameConfig';

interface Flight { node: Node; sprite: Sprite; ui: UITransform; }
const RESOURCE = 'fx/frost_ultimate_rain_v1';
// Exactly the ultimate's single-point crop; the opposite bottom apex is excluded.
const WIDTH = 65, HEIGHT = 156, AXIS_X = 46;

export class FrostProjectileVFX {
  private root: Node;
  private trails: Graphics;
  private flights: Flight[] = [];
  private used = 0;
  private source: SpriteFrame | null = null;
  private frame: SpriteFrame | null = null;
  private tint = new Color();

  constructor(parent: Node) {
    this.root = new Node('frostProjectiles');
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(parent);
    const trailNode = new Node('coldTrails');
    trailNode.layer = Layers.Enum.UI_2D; trailNode.setParent(this.root);
    this.trails = trailNode.addComponent(Graphics);
    for (let i = 0; i < MAX_PROJS; i++) {
      const node = new Node('iceShot' + i); node.layer = Layers.Enum.UI_2D; node.setParent(this.root);
      const ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      ui.setAnchorPoint(AXIS_X / WIDTH, 0.5);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
      node.active = false; this.flights.push({ node, sprite, ui });
    }
    resources.load(RESOURCE + '/spriteFrame', SpriteFrame, (err, source) => {
      if (err || !source || !this.root.isValid) return;
      source.addRef(); this.source = source;
      const frame = new SpriteFrame();
      frame.reset({ texture: source.texture, rect: new Rect(0, 0, WIDTH, HEIGHT),
        originalSize: new Size(WIDTH, HEIGHT), offset: new Vec2() });
      frame.packable = false; this.frame = frame;
      for (const f of this.flights) f.sprite.spriteFrame = frame;
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      for (const f of this.flights) f.sprite.spriteFrame = null;
      this.frame?.destroy(); this.frame = null;
      this.source?.decRef(); this.source = null;
    });
  }

  beginProjectileFrame(): void {
    for (let i = 0; i < this.used; i++) this.flights[i].node.active = false;
    this.used = 0; this.trails.clear();
  }

  projectile(x: number, y: number, vx: number, vy: number, size: number, age: number): boolean {
    if (!this.frame || !this.root.isValid || this.used >= this.flights.length) return false;
    const speed = Math.hypot(vx, vy);
    if (speed <= 0) return false;
    const dx = vx / speed, dy = vy / speed, f = this.flights[this.used++];
    const height = Math.max(12, size * 5.6);
    // Measure the crop, not SpriteFrame.width/height (whole texture in Creator).
    f.ui.setContentSize(height * WIDTH / HEIGHT, height);
    f.node.setPosition(x, y, 0);
    f.node.angle = Math.atan2(vy, vx) * 180 / Math.PI - 90;
    f.node.active = true;
    // A short tapered wake begins at the crystal's tail, never at its nose.
    // Same age/velocity produces identical geometry during pause or speed-up.
    const length = Math.min(64, Math.max(0, speed * age * 0.35));
    if (length > 1) this.ribbon(x - dx * height * 0.45, y - dy * height * 0.45,
      dx, dy, length, size / 6);
    return true;
  }

  private ribbon(x: number, y: number, dx: number, dy: number, length: number, scale: number): void {
    const g = this.trails, px = -dy, py = dx;
    for (let band = 0; band < 3; band++) {
      const width = (band === 0 ? 3.4 : band === 1 ? 1.5 : 0.4) * scale;
      const alpha = band === 0 ? 14 : band === 1 ? 38 : 100;
      for (let k = 0; k < 8; k++) {
        const a = k / 8, b = (k + 1) / 8;
        const wa = width * Math.pow(1 - a, 1.25), wb = width * Math.pow(1 - b, 1.25);
        const ax = x - dx * length * a, ay = y - dy * length * a;
        const bx = x - dx * length * b, by = y - dy * length * b;
        this.tint.set(band === 2 ? 208 : 107, band === 2 ? 248 : 211, 255,
          Math.round(alpha * Math.pow(1 - a, 1.8)));
        g.fillColor = this.tint;
        g.moveTo(ax + px * wa, ay + py * wa); g.lineTo(bx + px * wb, by + py * wb);
        g.lineTo(bx - px * wb, by - py * wb); g.lineTo(ax - px * wa, ay - py * wa);
        g.close(); g.fill();
      }
    }
  }
}
