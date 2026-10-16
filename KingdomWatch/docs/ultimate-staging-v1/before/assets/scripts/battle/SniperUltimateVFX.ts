/** Blue hunting sight, pressure release, long bolt wake and directional contacts. Cosmetic only. */
import { Color, EffectAsset, gfx, Graphics, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';

interface Quad { node: Node; sprite: Sprite; ui: UITransform; material: Material | null; state: Vec4; shape: Vec4; }
interface Accent { quad: Quad; age: number; life: number; mode: number; x: number; y: number; angle: number; seed: number; shader: boolean; }
const sightTint = new Color();
function sightColor(g: Graphics, r: number, green: number, b: number, a: number): void {
  sightTint.set(r, green, b, Math.round(a)); g.strokeColor = sightTint; g.fillColor = sightTint;
}

/** The existing half-second lock owns the clock and moving target. No extra gameplay delay. */
export function drawSniperUltimateLock(g: Graphics, x: number, y: number, tx: number, ty: number, progress: number, sourceCue = true): void {
  const p = Math.max(0, Math.min(1, progress)), ease = 1 - Math.pow(1 - p, 3);
  const dx = tx - x, dy = ty - y, distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance, uy = dy / distance, radius = 48 - ease * 33;
  // The caller clears once, then appends all simultaneous aim lines and sights.
  sightColor(g, 24, 93, 204, 45 + 35 * p); g.lineWidth = 7 + p * 2;
  g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
  sightColor(g, 64, 168, 255, 170 + 70 * p); g.lineWidth = 1.1 + p * 1.1;
  g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
  sightColor(g, 188, 230, 255, 130 + 100 * p); g.lineWidth = .65;
  g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
  // Two traveling streaks visibly gather along the actual aim axis.
  for (let k = 0; k < 2; k++) {
    const t = (p * 1.55 + k * .5) % 1, u = t * distance;
    sightColor(g, 134, 211, 255, Math.sin(t * Math.PI) * 195); g.lineWidth = 2.2;
    g.moveTo(x + ux * Math.max(0, u - 17), y + uy * Math.max(0, u - 17));
    g.lineTo(x + ux * u, y + uy * u); g.stroke();
  }
  // Turning corner arcs converge into a precise blue sight, with a navy contrast keyline.
  const rotation = (1 - ease) * .9;
  for (let band = 0; band < 3; band++) {
    if (!band) sightColor(g, 10, 33, 65, 175);
    else if (band === 1) sightColor(g, 38, 140, 255, 245);
    else sightColor(g, 169, 225, 255, 185 + 65 * p);
    g.lineWidth = !band ? 5 : band === 1 ? 2.7 : .8;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + rotation;
      g.arc(tx, ty, radius, a + .17, a + 1.02, false); g.stroke();
      const ux = Math.cos(a), uy = Math.sin(a);
      g.moveTo(tx + ux * (radius - 4), ty + uy * (radius - 4));
      g.lineTo(tx + ux * (radius + 8), ty + uy * (radius + 8)); g.stroke();
    }
  }
  sightColor(g, 152, 223, 255, 160 + p * 95); g.circle(tx, ty, 1.8); g.fill();
  // Small blue motes contract toward the release point instead of flashing the whole hero.
  if (!sourceCue) return;
  for (let k = 0; k < 6; k++) {
    const phase = (p * 1.3 + k / 6) % 1, r = 7 + (1 - phase) * 31, a = k * Math.PI / 3 + .4;
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r;
    sightColor(g, 76, 175, 255, Math.sin(phase * Math.PI) * 195);
    g.circle(cx, cy, 1.1 + phase); g.fill();
  }
}

export class SniperUltimateVFX {
  private root: Node;
  private flightRoot: Node;
  private fallback: Graphics;
  private flightInk: Graphics;
  private carrier: SpriteFrame;
  private texture: Texture2D;
  private flights: Quad[] = [];
  private used = 0;
  private active: Accent[] = [];
  private free: Accent[] = [];
  private all: Quad[] = [];
  private ready = false;
  private destroyed = false;
  private serial = 0;
  private tint = new Color();

  constructor(parent: Node, projectileParent: Node) {
    this.root = this.node('sniperUltimateContacts', parent);
    this.fallback = this.node('sniperUltimateFallback', this.root).addComponent(Graphics);
    this.flightRoot = this.node('sniperUltimateWakes', projectileParent);
    this.flightInk = this.node('sniperUltimateWakeFallback', this.flightRoot).addComponent(Graphics);
    this.texture = new Texture2D();
    this.texture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    this.texture.uploadData(new Uint8Array(16).fill(255)); this.carrier = new SpriteFrame();
    this.carrier.reset({ texture: this.texture, rect: new Rect(0, 0, 2, 2), originalSize: new Size(2, 2), offset: new Vec2() });
    this.carrier.packable = false;
    for (let i = 0; i < 12; i++) this.flights.push(this.quad('hunterWake' + i, this.flightRoot));
    for (let i = 0; i < 24; i++) this.free.push({ quad: this.quad('hunterAccent' + i, this.root),
      age: 0, life: 1, mode: 0, x: 0, y: 0, angle: 0, seed: 0, shader: false });
    resources.load('fx/sniper-ultimate-procedural', EffectAsset, (err, effect) => {
      if (err || !effect || this.destroyed || !this.root.isValid) return;
      for (const q of this.all) {
        const material = new Material(); material.initialize({ effectAsset: effect });
        q.material = material; q.sprite.customMaterial = material;
      }
      this.ready = true;
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.destroyed = true;
      for (const q of this.all) { if (q.sprite.isValid) q.sprite.spriteFrame = null; q.material?.destroy(); }
      if (this.flightRoot.isValid) this.flightRoot.destroy();
      this.carrier.destroy(); this.texture.destroy();
      this.active.length = this.free.length = this.all.length = this.flights.length = 0;
    });
  }
  private node(name: string, parent: Node): Node {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.setParent(parent); return node;
  }
  private quad(name: string, parent: Node): Quad {
    const node = this.node(name, parent), ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = this.carrier;
    const blend = sprite as unknown as { _srcBlendFactor: gfx.BlendFactor; _dstBlendFactor: gfx.BlendFactor };
    blend._srcBlendFactor = gfx.BlendFactor.SRC_ALPHA; blend._dstBlendFactor = gfx.BlendFactor.ONE;
    node.active = false;
    const q = { node, sprite, ui, material: null, state: new Vec4(), shape: new Vec4() };
    this.all.push(q); return q;
  }
  beginFrame(): void {
    if (this.destroyed) return;
    for (let i = 0; i < this.used; i++) this.flights[i].node.active = false;
    this.used = 0; this.flightInk.clear();
  }
  release(x: number, y: number, dx: number, dy: number): void { this.accent(0, x, y, Math.atan2(dy, dx)); }
  hit(x: number, y: number, angle: number): void { this.accent(2, x, y, angle); }
  private accent(mode: number, x: number, y: number, angle: number): void {
    if (this.destroyed) return;
    const a = this.free.pop() || this.active.shift(); if (!a) return;
    a.x = x; a.y = y; a.age = 0; a.mode = mode; a.angle = angle; a.life = mode ? .28 : .32;
    a.seed = ++this.serial * 2.399963; a.shader = this.ready; a.quad.node.active = false;
    a.quad.ui.setAnchorPoint(mode ? .5 : .25, .5); a.quad.ui.setContentSize(mode ? 128 : 160, 112);
    a.quad.node.setPosition(x, y, 0); a.quad.node.angle = angle * 180 / Math.PI;
    this.active.push(a); this.paintAccent(a);
  }
  projectile(x: number, y: number, vx: number, vy: number, age: number, phase: number): boolean {
    if (this.destroyed) return false;
    const speed = Math.hypot(vx, vy) || 1, length = Math.min(245, Math.max(0, speed * age - 21));
    if (!this.ready || this.used >= this.flights.length) {
      const g = this.flightInk, dx = vx / speed, dy = vy / speed;
      this.tint.set(64, 157, 255, 180); g.strokeColor = this.tint; g.lineWidth = 3.5;
      g.moveTo(x, y); g.lineTo(x - dx * length, y - dy * length); g.stroke();
      return true;
    }
    const q = this.flights[this.used++], width = Math.max(100, length + 85);
    q.ui.setContentSize(width, 72); q.ui.setAnchorPoint(1 - 45 / width, .5);
    q.node.setPosition(x, y, 0); q.node.angle = Math.atan2(vy, vx) * 180 / Math.PI;
    this.shade(q, age, 1, phase, length); return true;
  }
  tick(dt: number): void {
    if (this.destroyed || !Number.isFinite(dt) || dt < 0) return;
    if (!this.active.length) return;
    this.fallback.clear();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]; a.age += dt;
      if (a.age >= a.life) { a.quad.node.active = false; this.active.splice(i, 1); this.free.push(a); continue; }
      this.paintAccent(a);
    }
  }
  private shade(q: Quad, age: number, mode: number, seed: number, length = 1): void {
    if (!q.material) return;
    q.state.set(age, mode, seed, 1); q.shape.set(q.ui.width, q.ui.height, length, 1);
    q.material.setProperty('hunterState', q.state); q.material.setProperty('hunterShape', q.shape); q.node.active = true;
  }
  private paintAccent(a: Accent): void {
    if (a.shader) { this.shade(a.quad, a.age, a.mode, a.seed); return; }
    const g = this.fallback, t = a.age / a.life, fade = 1 - t;
    this.tint.set(68, 165, 255, Math.round(220 * fade)); g.strokeColor = this.tint;
    g.lineWidth = 2 * fade + .7;
    const dx = Math.cos(a.angle), dy = Math.sin(a.angle), radius = 9 + t * 30;
    for (let k = 0; k <= 24; k++) {
      const p = k * Math.PI / 12, u = Math.cos(p) * radius * .35, v = Math.sin(p) * radius;
      const x = a.x + dx * u - dy * v, y = a.y + dy * u + dx * v;
      if (!k) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
}
