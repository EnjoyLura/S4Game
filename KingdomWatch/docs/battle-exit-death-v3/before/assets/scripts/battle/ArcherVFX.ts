/** Painted arrow bodies and battle-clock accents. Rendering only; no damage or trajectory changes. */
import { Color, gfx, Graphics, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { MAX_PROJS } from '../config/GameConfig';

interface Part { node: Node; sprite: Sprite; ui: UITransform; }
interface Flight { root: Node; body: Part; tip: Part; }
interface Accent {
  root: Node; body: Part; core: Part;
  x: number; y: number; age: number; life: number; angle: number; heavy: boolean; launch: boolean;
}
const clamp = (v: number): number => Math.max(0, Math.min(1, v));

export class ArcherVFX {
  private root: Node;
  private trails: Graphics;
  private chips: Graphics;
  private frames = new Map<string, SpriteFrame>();
  private sources: SpriteFrame[] = [];
  private loaded = false;
  private flights: Flight[] = [];
  private flightCount = 0;
  private active: Accent[] = [];
  private launchFree: Accent[] = [];
  private hitFree: Accent[] = [];
  private tint = new Color();

  constructor(parent: Node, projectileParent: Node) {
    this.root = this.node('archerVfx', parent);
    // Trails precede all painted bodies; ordinary wood/metal uses normal alpha, only stars add light.
    this.trails = this.node('archerTrails', projectileParent).addComponent(Graphics);
    for (let i = 0; i < MAX_PROJS; i++) {
      const root = this.node('arrowFlight' + i, projectileParent);
      const body = this.part('paintedArrow', root), tip = this.part('tipGlint', root, true);
      root.active = false;
      this.flights.push({ root, body, tip });
    }
    for (let i = 0; i < 10; i++) this.launchFree.push(this.accent(true));
    for (let i = 0; i < 24; i++) this.hitFree.push(this.accent(false));
    this.chips = this.node('arrowChips', this.root).addComponent(Graphics);
    this.loadAtlas('fx/archer_v1', ['arrow', 'wind', 'impact', 'glint']);
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.frames.forEach(frame => frame.destroy());
      this.sources.forEach(source => source.decRef());
    });
  }

  private loadAtlas(path: string, ids: readonly string[]): void {
    resources.load(path + '.frames', JsonAsset, (err, data) => {
      if (err || !data || !this.root.isValid) return;
      resources.load(path + '/spriteFrame', SpriteFrame, (error, source) => {
        if (error || !source || !this.root.isValid) return;
        source.addRef(); this.sources.push(source);
        const rects = (data.json as { frames: Record<string, number[]> }).frames;
        for (const id of ids) {
          if (!rects[id]) continue;
          const [x, y, w, h] = rects[id];
          const frame = new SpriteFrame();
          frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
          frame.packable = false;
          this.frames.set(id, frame);
        }
        this.loaded = ['arrow', 'wind', 'impact', 'glint'].every(id => this.frames.has(id));
      });
    });
  }

  private node(name: string, parent: Node): Node {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.setParent(parent); return node;
  }

  private part(name: string, parent: Node, additive = false): Part {
    const node = this.node(name, parent), ui = node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
    if (additive) {
      // Creator 3.8 stores UI blending in serialized fields; dstBlendFactor has no setter.
      const blend = sprite as unknown as { _srcBlendFactor: gfx.BlendFactor; _dstBlendFactor: gfx.BlendFactor };
      blend._srcBlendFactor = gfx.BlendFactor.SRC_ALPHA; blend._dstBlendFactor = gfx.BlendFactor.ONE;
    }
    return { node, sprite, ui };
  }

  private accent(launch: boolean): Accent {
    const root = this.node(launch ? 'bowRelease' : 'arrowContact', this.root);
    const body = this.part('accentBody', root), core = this.part('accentCore', root, true);
    root.active = false;
    return { root, body, core, x: 0, y: 0, age: 0, life: 1, angle: 0, heavy: false, launch };
  }

  private paint(part: Part, id: string, height: number, alpha: number, x = 0, y = 0, angle = 0): void {
    const frame = this.frames.get(id);
    if (!frame) { part.node.active = false; return; }
    part.node.active = alpha > 0;
    if (part.sprite.spriteFrame !== frame) part.sprite.spriteFrame = frame;
    // SpriteFrame.width/height are the WHOLE texture dimensions in Creator 3.8.
    // Cropped atlas cells must use rect dimensions or every sprite is stretched into a square.
    part.ui.setContentSize(height * frame.rect.width / frame.rect.height, height);
    this.tint.set(255, 255, 255, Math.round(Math.max(0, Math.min(255, alpha))));
    part.sprite.color = this.tint;
    part.node.setPosition(x, y, 0); part.node.angle = angle;
  }

  beginProjectileFrame(): void {
    this.trails.clear();
    for (let i = 0; i < this.flightCount; i++) this.flights[i].root.active = false;
    this.flightCount = 0;
  }

  projectile(x: number, y: number, vx: number, vy: number, size: number, age: number, heavy: boolean): boolean {
    if (!this.loaded || this.flightCount >= this.flights.length) return false;
    const f = this.flights[this.flightCount++], speed = Math.hypot(vx, vy) || 1;
    const dx = vx / speed, dy = vy / speed, angle = Math.atan2(vy, vx) * 180 / Math.PI - 90;
    const length = 30 + size * 4.2;
    f.root.active = true; f.root.setPosition(x, y, 0); f.root.angle = angle;
    this.paint(f.body, 'arrow', length, 255);
    // The star sits on the leading bevel, leaving the emerald and feather silhouette readable.
    this.paint(f.tip, 'glint', heavy ? 17 : 9, heavy ? 175 + 25 * Math.sin(age * 15) : 85, 0, length * 0.43);
    const tailX = x - dx * length * 0.44, tailY = y - dy * length * 0.44;
    const trailLength = Math.min(heavy ? 118 : 86, Math.max(0, speed * age - length * 0.44));
    this.greenWind(x, y, dx, dy, length, trailLength, age, heavy);
    this.ribbon(tailX, tailY, dx, dy, trailLength, heavy);
    return true;
  }

  /** Quiet mint light under the physical arrow, with coherent air strokes following its velocity. */
  private greenWind(x: number, y: number, dx: number, dy: number, body: number, trail: number, age: number, heavy: boolean): void {
    const g = this.trails, px = -dy, py = dx;
    const strength = heavy ? 1.15 : 1;
    // Nested translucent lenses soften the green tip glow without covering the painted silhouette.
    for (let band = 2; band >= 0; band--) {
      const along = 8 + band * 4, across = 2.2 + band * 1.7;
      const cx = x + dx * body * 0.35, cy = y + dy * body * 0.35;
      this.tint.set(159, 255, 170, Math.round((band === 0 ? 24 : band === 1 ? 12 : 5) * strength));
      g.fillColor = this.tint;
      for (let k = 0; k <= 16; k++) {
        const a = k * Math.PI / 8;
        const ax = cx + dx * Math.cos(a) * along + px * Math.sin(a) * across;
        const ay = cy + dy * Math.cos(a) * along + py * Math.sin(a) * across;
        if (k === 0) g.moveTo(ax, ay); else g.lineTo(ax, ay);
      }
      g.close(); g.fill();
    }
    // Short wind strokes flow along either side; phase depends on age, never random frame noise.
    const reach = body * 0.65 + Math.min(trail, 48);
    for (const side of [-1, 1]) {
      for (let band = 0; band < 2; band++) {
        this.tint.set(band ? 203 : 118, 255, band ? 210 : 143, Math.round((band ? 49 : 16) * strength));
        g.strokeColor = this.tint; g.lineWidth = band ? 0.8 : 2.5;
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          const along = body * 0.38 - reach * t;
          const offset = side * (1.2 + Math.sin(t * Math.PI) * 4.2 + t * 0.8)
            + Math.sin(t * Math.PI * 1.4 + age * 12) * 0.65 * Math.sin(t * Math.PI);
          const ax = x + dx * along + px * offset, ay = y + dy * along + py * offset;
          if (k === 0) g.moveTo(ax, ay); else g.lineTo(ax, ay);
        }
        g.stroke();
      }
    }
  }

  /** Straight-arrow tail measured in world units, independent of frame count and simulation substeps. */
  private ribbon(x: number, y: number, dx: number, dy: number, length: number, heavy: boolean): void {
    if (length < 2) return;
    const g = this.trails, px = -dy, py = dx;
    for (let band = 0; band < 3; band++) {
      const width = (heavy ? 2.1 : 1.4) * (band === 0 ? 1.8 : band === 1 ? 0.85 : 0.22);
      const alpha = band === 0 ? 12 : band === 1 ? 32 : 110;
      for (let k = 0; k < 8; k++) {
        const near = k / 8, far = (k + 1) / 8;
        const wn = width * Math.pow(1 - near, 1.3), wf = width * Math.pow(1 - far, 1.3);
        const nx = x - dx * length * near, ny = y - dy * length * near;
        const fx = x - dx * length * far, fy = y - dy * length * far;
        this.tint.set(255, band === 2 ? 236 : 205, band === 2 ? 158 : 85, Math.round(alpha * Math.pow(1 - near, 1.8)));
        g.fillColor = this.tint;
        g.moveTo(nx + px * wn, ny + py * wn); g.lineTo(fx + px * wf, fy + py * wf);
        g.lineTo(fx - px * wf, fy - py * wf); g.lineTo(nx - px * wn, ny - py * wn);
        g.close(); g.fill();
      }
    }
    // Two tapered side streaks open slightly behind the fletching, as fine rays rather than a fog wedge.
    for (const side of [-1, 1]) {
      const spread = heavy ? 5 : 3.5;
      for (let k = 0; k < 8; k++) {
        const near = k / 8, far = (k + 1) / 8;
        const offsetNear = side * (0.8 + spread * near), offsetFar = side * (0.8 + spread * far);
        this.tint.set(255, 224, 116, Math.round((heavy ? 155 : 105) * Math.pow(1 - near, 1.6)));
        g.strokeColor = this.tint; g.lineWidth = (heavy ? 1.1 : 0.8) * (1 - near * 0.7);
        g.moveTo(x - dx * length * near + px * offsetNear, y - dy * length * near + py * offsetNear);
        g.lineTo(x - dx * length * far + px * offsetFar, y - dy * length * far + py * offsetFar); g.stroke();
      }
    }
  }

  release(x: number, y: number, dx: number, dy: number, heavy: boolean): boolean {
    return this.start(x, y, Math.atan2(dy, dx), heavy, true);
  }

  hit(x: number, y: number, heavy: boolean, angle = Math.PI / 2): boolean {
    return this.start(x, y, angle, heavy, false);
  }

  private start(x: number, y: number, angle: number, heavy: boolean, launch: boolean): boolean {
    if (!this.loaded) return false;
    const pool = launch ? this.launchFree : this.hitFree;
    const accent = pool.pop();
    // Budget exhaustion intentionally drops accents, retaining every physical projectile.
    if (!accent) return true;
    Object.assign(accent, { x, y, angle, heavy, age: 0, life: launch ? 0.19 : heavy ? 0.24 : 0.17 });
    accent.root.active = true; accent.root.setPosition(x, y, 0);
    accent.root.angle = angle * 180 / Math.PI - 90;
    this.active.push(accent); this.drawAccent(accent);
    return true;
  }

  tick(dt: number): void {
    this.chips.clear();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]; a.age += dt;
      if (a.age >= a.life) {
        a.root.active = false; this.active.splice(i, 1);
        (a.launch ? this.launchFree : this.hitFree).push(a); continue;
      }
      this.drawAccent(a);
      if (!a.launch) this.fragments(a);
    }
  }

  private drawAccent(a: Accent): void {
    const t = clamp(a.age / a.life), fade = Math.pow(1 - t, 1.7);
    const attack = clamp((a.age + 0.015) / 0.045);
    if (a.launch) {
      // An opening sweep and brief string snap, not a persistent halo around the hero.
      this.paint(a.body, 'wind', (a.heavy ? 72 : 54) * (0.65 + t * 0.45), (a.heavy ? 165 : 105) * fade, 0, 5 + t * 13, -12 + t * 26);
      this.paint(a.core, 'glint', (a.heavy ? 28 : 20) * (0.7 + attack * 0.35), 230 * Math.pow(1 - t, 3), 0, 9);
    } else {
      this.paint(a.body, 'impact', (a.heavy ? 49 : 31) * (0.65 + attack * 0.35 + t * 0.22), 240 * fade);
      this.paint(a.core, 'glint', (a.heavy ? 30 : 19) * (1 - t * 0.4), 245 * Math.pow(1 - t, 4));
    }
  }

  private fragments(a: Accent): void {
    const t = clamp(a.age / a.life), travel = 1 - Math.pow(1 - t, 2);
    const g = this.chips, n = a.heavy ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const angle = a.angle + (k - (n - 1) / 2) * 0.75;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const distance = 4 + travel * (a.heavy ? 31 : 20) * (k % 2 ? 0.75 : 1);
      const length = (a.heavy ? 7 : 4) * (1 - t * 0.65);
      this.tint.set(255, 224, 134, Math.round(220 * Math.pow(1 - t, 1.5)));
      g.strokeColor = this.tint; g.lineWidth = a.heavy ? 1.7 : 1.2;
      g.moveTo(a.x + dx * distance, a.y + dy * distance);
      g.lineTo(a.x + dx * (distance + length), a.y + dy * (distance + length)); g.stroke();
    }
  }
}
