/** Sky lightning and ground discharge. Cosmetic only; driven by battle dt, never wall time. */
import { Color, EffectAsset, gfx, Graphics, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';

interface Quad { node: Node; sprite: Sprite; ui: UITransform; material: Material | null; state: Vec4; shape: Vec4; }
interface Crack { points: Float32Array; count: number; delay: number; }
interface Strike {
  x: number; y: number; top: number; radius: number; age: number; seed: number; shader: boolean; power: number;
  sky: Quad; floor: Quad; cracks: Crack[]; spine: Float32Array; spineCount: number;
}
const CAP = 12, LIFE = .60, TAU = Math.PI * 2;
const FALLBACK_WIDTHS = [24, 13, 6, 2.8, 1], FALLBACK_ALPHA = [9, 20, 65, 210, 250];
function random(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class VoltUltimateVFX {
  private root: Node;
  private floorRoot: Node;
  private floorLight: Node;
  private cracks: Graphics;
  private sparks: Graphics;
  private active: Strike[] = [];
  private free: Strike[] = [];
  private all: Strike[] = [];
  private tint = new Color();
  private carrier: SpriteFrame;
  private texture: Texture2D;
  private ready = false;
  private destroyed = false;
  private serial = 0;
  private painted = false;

  constructor(parent: Node, groundParent: Node) {
    this.floorRoot = this.node('voltUltimateGround', groundParent);
    this.floorLight = this.node('voltUltimateGroundLight', this.floorRoot);
    this.cracks = this.node('voltUltimateFractures', this.floorRoot).addComponent(Graphics);
    this.root = this.node('voltUltimateSky', parent);
    this.sparks = this.node('voltUltimateSparks', this.root).addComponent(Graphics);
    // Two white texels carry the geometry; the shader never samples artwork.
    this.texture = new Texture2D();
    this.texture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    this.texture.uploadData(new Uint8Array(16).fill(255));
    this.carrier = new SpriteFrame();
    this.carrier.reset({ texture: this.texture, rect: new Rect(0, 0, 2, 2),
      originalSize: new Size(2, 2), offset: new Vec2() });
    this.carrier.packable = false;
    for (let i = 0; i < CAP; i++) {
      const sky = this.quad('sky' + i, this.root), floor = this.quad('light' + i, this.floorLight);
      sky.ui.setAnchorPoint(.5, 0);
      const cracks: Crack[] = [];
      for (let k = 0; k < 24; k++) cracks.push({ points: new Float32Array(16), count: 0, delay: 0 });
      const strike: Strike = { x: 0, y: 0, top: 0, radius: 90, age: 0, seed: 0, shader: false, power: 1,
        sky, floor, cracks, spine: new Float32Array(130), spineCount: 0 };
      this.all.push(strike); this.free.push(strike);
    }
    resources.load('fx/volt-ultimate-procedural', EffectAsset, (err, effect) => {
      if (err || !effect || this.destroyed || !this.root.isValid) return;
      for (const s of this.all) for (const q of [s.sky, s.floor]) {
        const material = new Material(); material.initialize({ effectAsset: effect });
        q.material = material; q.sprite.customMaterial = material;
      }
      this.ready = true;
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.destroyed = true;
      for (const s of this.all) for (const q of [s.sky, s.floor]) {
        if (q.sprite.isValid) q.sprite.spriteFrame = null;
        q.material?.destroy();
      }
      this.active.length = this.free.length = this.all.length = 0;
      // GroundFxLayer owns floorRoot and destroys it before this sky layer.
      this.carrier.destroy(); this.texture.destroy();
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
    return { node, sprite, ui, material: null, state: new Vec4(), shape: new Vec4() };
  }

  strike(x: number, _hitY: number, top: number, footY: number, radius: number, power = 1): void {
    if (this.destroyed || !Number.isFinite(x + top + footY + radius)) return;
    // Under extreme repeated GM casts, recycle the oldest cosmetic event only.
    const s = this.free.pop() || this.active.shift();
    if (!s) return;
    s.x = x; s.y = footY; s.top = Math.max(top, footY + 180);
    s.power = Math.max(.6, Math.min(1.2, power));
    s.radius = Math.max(60, Math.min(145, radius)); s.age = 0; s.seed = ++this.serial;
    // Keep a whole event in one rendering mode, avoiding a loading-time visual pop.
    s.shader = this.ready; s.sky.node.active = s.floor.node.active = false;
    s.sky.node.setPosition(x, footY - 16, 0);
    s.sky.ui.setContentSize(196, s.top - footY + 32);
    s.floor.node.setPosition(x, footY, 0);
    s.floor.ui.setContentSize(s.radius * 3.05, s.radius * 1.34);
    this.makeCracks(s); this.makeSpine(s);
    this.active.push(s); this.render();
  }

  tick(dt: number): void {
    if (this.destroyed || !Number.isFinite(dt) || dt < 0) return;
    if (!this.active.length) {
      if (this.painted) { this.cracks.clear(); this.sparks.clear(); this.painted = false; }
      return;
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i]; s.age += dt;
      if (s.age >= LIFE) {
        s.sky.node.active = s.floor.node.active = false;
        this.active.splice(i, 1); this.free.push(s);
      }
    }
    this.render();
  }

  private makeCracks(s: Strike): void {
    // Eight unequal primary fractures, side forks and cross-links form a web rather than a star icon.
    for (let k = 0; k < 8; k++) {
      const c = s.cracks[k], angle = k * TAU / 8 + (random(s.seed * 41 + k) - .5) * .55;
      const reach = s.radius * (.57 + random(s.seed * 13 + k) * .37);
      c.count = 7; c.delay = 0; c.points[0] = c.points[1] = 0;
      for (let j = 1; j <= 6; j++) {
        const t = j / 6, bend = (random(s.seed * 97 + k * 11 + j) - .5) * 19 * Math.sin(t * 2.6);
        c.points[j * 2] = Math.cos(angle) * reach * t - Math.sin(angle) * bend;
        c.points[j * 2 + 1] = (Math.sin(angle) * reach * t + Math.cos(angle) * bend) * .43;
      }
      const fork = s.cracks[k + 8], at = k % 2 ? 3 : 4, side = k % 2 ? -1 : 1;
      fork.count = 4; fork.delay = .018;
      const fx = c.points[at * 2], fy = c.points[at * 2 + 1];
      for (let j = 0; j < 4; j++) {
        const t = j / 3, a = angle + side * .82;
        fork.points[j * 2] = fx + Math.cos(a) * reach * .33 * t + Math.sin(j * 3 + s.seed) * t * 3;
        fork.points[j * 2 + 1] = fy + Math.sin(a) * reach * .33 * t * .43;
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = s.cracks[k], b = s.cracks[(k + 1) % 8], c = s.cracks[k + 16];
      const ia = k % 2 ? 4 : 3, ib = k % 3 ? 3 : 4;
      c.count = 4; c.delay = .028;
      for (let j = 0; j < 4; j++) {
        const t = j / 3, kink = j === 1 ? 5 : j === 2 ? -3 : 0;
        c.points[j * 2] = a.points[ia * 2] * (1 - t) + b.points[ib * 2] * t + kink;
        c.points[j * 2 + 1] = a.points[ia * 2 + 1] * (1 - t) + b.points[ib * 2 + 1] * t + kink * .4;
      }
    }
  }

  private makeSpine(s: Strike): void {
    const height = s.top - s.y, n = Math.max(8, Math.min(64, Math.ceil(height / 18)));
    s.spineCount = n + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n, envelope = Math.min(1, t * 8);
      s.spine[k * 2] = s.x + (random(s.seed * 29 + k) - .5) * 36 * envelope;
      s.spine[k * 2 + 1] = s.y + height * t;
    }
  }

  private color(g: Graphics, r: number, green: number, b: number, a: number): void {
    this.tint.set(r, green, b, Math.round(Math.max(0, Math.min(255, a))));
    g.strokeColor = this.tint; g.fillColor = this.tint;
  }
  private render(): void {
    this.cracks.clear(); this.sparks.clear(); this.painted = this.active.length > 0;
    for (const s of this.active) {
      let nearbyFloor = 0, nearbySky = 0;
      for (const other of this.active) {
        if (other === s) continue;
        const dx = other.x - s.x, dy = other.y - s.y;
        const weight = Math.exp(-other.age * 8);
        if (dx * dx + dy * dy < s.radius * s.radius * .36) nearbyFloor += weight;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 75 && other.age < .31) nearbySky += weight;
      }
      const floorStrength = s.power / (1 + nearbyFloor * .75);
      this.shade(s, s.sky, 0, s.power / Math.sqrt(1 + nearbySky * .8));
      this.shade(s, s.floor, 1, floorStrength);
      this.drawCracks(s, Math.sqrt(floorStrength)); this.drawSparks(s);
      if (!s.shader && s.age < .31) this.fallback(s);
    }
  }
  private shade(s: Strike, q: Quad, mode: number, strength: number): void {
    if (!s.shader || !q.material || (!mode && s.age >= .31)) { q.node.active = false; return; }
    q.state.set(s.age, s.seed * 3.731, mode, s.top - s.y);
    q.shape.set(q.ui.width, q.ui.height, s.radius, strength);
    q.material.setProperty('strikeState', q.state); q.material.setProperty('strikeShape', q.shape);
    q.node.active = true;
  }
  private drawCracks(s: Strike, strength: number): void {
    const fade = Math.pow(Math.max(0, 1 - s.age / .55), 1.25) * strength;
    const pulse = .64 + .36 * Math.exp(-Math.pow((s.age - .09) / .025, 2));
    for (let band = 0; band < 3; band++) {
      const g = this.cracks;
      if (!band) this.color(g, 133, 54, 255, fade * 28);
      else if (band === 1) this.color(g, 182, 105, 255, fade * 205 * pulse);
      else this.color(g, 251, 225, 255, fade * 230 * pulse);
      g.lineWidth = !band ? 5.5 : band === 1 ? 2.05 : .72;
      for (const c of s.cracks) {
        const reveal = Math.min(1, Math.max(0, (s.age - c.delay) / .065));
        if (!reveal) continue;
        const end = reveal * (c.count - 1), full = Math.floor(end);
        g.moveTo(s.x + c.points[0], s.y + c.points[1]);
        for (let j = 1; j <= full; j++) g.lineTo(s.x + c.points[j * 2], s.y + c.points[j * 2 + 1]);
        if (full < c.count - 1) {
          const f = end - full, a = full * 2, b = a + 2;
          g.lineTo(s.x + c.points[a] * (1 - f) + c.points[b] * f,
            s.y + c.points[a + 1] * (1 - f) + c.points[b + 1] * f);
        }
        g.stroke();
      }
    }
  }
  private drawSparks(s: Strike): void {
    const g = this.sparks, age = s.age, fade = Math.pow(Math.max(0, 1 - age / .43), 1.5);
    if (!fade) return;
    for (let k = 0; k < 10; k++) {
      const a = k * TAU / 10 + s.seed * 1.7, speed = 80 + random(s.seed + k * 7) * 130;
      const lift = 45 + random(s.seed + k * 11) * 150;
      const x = s.x + Math.cos(a) * (8 + age * speed);
      const y = s.y + Math.sin(a) * age * speed * .43 + lift * age - 360 * age * age;
      const dx = Math.cos(a) * (3 + 4 * fade), dy = Math.sin(a) * 2 + 4 * fade;
      this.color(g, 194, 132, 255, 220 * fade);
      g.moveTo(x + dx, y + dy); g.lineTo(x - dy * .18, y + dx * .18);
      g.lineTo(x - dx * .8, y - dy * .8); g.close(); g.fill();
      this.color(g, 255, 234, 255, 245 * fade); g.lineWidth = .8;
      g.moveTo(x, y); g.lineTo(x + dx, y + dy); g.stroke();
    }
  }
  private fallback(s: Strike): void {
    // If the effect is unavailable, use a stable thin channel; never expose a white carrier quad.
    const g = this.sparks, energy = Math.max(0, 1 - s.age / .31);
    for (let band = 0; band < 5; band++) {
      this.color(g, band === 4 ? 255 : 174, band === 4 ? 240 : 96, 255, FALLBACK_ALPHA[band] * energy);
      g.lineWidth = FALLBACK_WIDTHS[band]; g.moveTo(s.spine[0], s.spine[1]);
      for (let j = 1; j < s.spineCount; j++) g.lineTo(s.spine[j * 2], s.spine[j * 2 + 1]);
      g.stroke();
    }
  }
}
