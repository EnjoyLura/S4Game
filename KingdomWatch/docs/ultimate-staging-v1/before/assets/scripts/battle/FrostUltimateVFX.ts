/** H3 shatter contacts and painted ice rain. No expanding cold wave.
 * A full-field storm independent of enemy positions, on the battle clock.
 */
import { Color, Graphics, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { LINE_Y, LO, MAX_MOBS } from '../config/GameConfig';
import { drawIceCrystal } from './FrostVFX';
import { DepthSprite, registerDepthSprite, refreshDepth } from './BattleDepth';

export interface FrostUltTarget { x: number; y: number; radius: number; }
interface Atlas {
  frames: Record<string, number[]>; framePrefix: string; frameCount: number;
  cellSize: [number, number]; frameDurations: number[]; groundAnchorPixels: [number, number];
}
interface Part { node: Node; sprite: Sprite; ui: UITransform; }
interface Hit {
  back: Part; front: Part; x: number; y: number; width: number;
  start: number; opacity: number; frameIndex: number;
}
interface Drop {
  part: Part; x: number; y: number; start: number; flight: number; travel: number;
  height: number; drift: number; angle: number; seed: number; perspective: number; depth: DepthSprite | null;
}
const HIT_CAP = 24, RAIN_CAP = 128, CHIP_CAP = HIT_CAP * 5;
const COVERAGE_BANDS = 8;
const DURATION = 2, HIT_SECONDS = 0.68, IMPACT_RESOURCE = 'fx/frost_ultimate_impact_v1';
const RAIN_RESOURCE = 'fx/frost_ultimate_rain_v1';
// Pixel (46, 2) is the painted needle's apex. Its tip, rather than its centre,
// reaches the ground snapshot; chips continue to rotate around their centres.
const RAIN_TIP = [46 / 65, 1 - 2 / 156] as const;
const RAIN_ANGLE = -178;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
function smooth(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t);
}

export class FrostUltimateVFX {
  private groundRoot: Node;
  private root: Node;
  private ground: Graphics;
  private trails: Graphics;
  private hits: Hit[] = [];
  private drops: Drop[] = [];
  private chips: Part[] = [];
  private targets: readonly FrostUltTarget[] = [];
  private backFrames: SpriteFrame[] = [];
  private frontFrames: SpriteFrame[] = [];
  private frameEnds: number[] = [];
  private sources: SpriteFrame[] = [];
  private ownedFrames: SpriteFrame[] = [];
  private rainFrame: SpriteFrame | null = null;
  private chipFrame: SpriteFrame | null = null;
  private atlas: Atlas | null = null;
  private split = 118;
  private clipLife = 1.38;
  private age = 0;
  private running = false;
  private destroyed = false;
  private skyTop = 0;
  private rainCount = 0;
  private tint = new Color(255, 255, 255, 255);

  constructor(groundParent: Node, airParent: Node, private depthParent?: Node) {
    this.groundRoot = this.node('frostUltGround', groundParent);
    this.root = this.node('frostUltAir', airParent);
    this.ground = this.groundRoot.addComponent(Graphics);
    this.trails = this.root.addComponent(Graphics);
    for (let i = 0; i < HIT_CAP; i++) {
      this.hits.push({ back: this.part('iceHitBack' + i, this.groundRoot),
        front: this.part('iceHitFront' + i, this.root), x: 0, y: 0, width: 0,
        start: 0, opacity: 1, frameIndex: -1 });
    }
    const rainRoot = this.node('frostUltRain', this.root);
    for (let i = 0; i < RAIN_CAP; i++) {
      const part = this.part('icicle' + i, depthParent || rainRoot);
      this.drops.push({ part, x: 0, y: 0, start: 0, flight: 0.3, travel: 360,
        height: 60, drift: -40, angle: RAIN_ANGLE, seed: i, perspective: 1,
        depth: depthParent ? registerDepthSprite(depthParent, part.node) : null });
      part.ui.setAnchorPoint(...RAIN_TIP);
    }
    for (let i = 0; i < CHIP_CAP; i++) this.chips.push(this.part('iceChip' + i, rainRoot));
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.destroyed = true; this.running = false;
      this.targets = [];
      for (const h of this.hits) for (const p of [h.back, h.front]) {
        if (p.sprite.isValid) p.sprite.spriteFrame = null;
      }
      for (const d of this.drops) if (d.part.sprite.isValid) d.part.sprite.spriteFrame = null;
      for (const d of this.drops) if (d.part.node.isValid) d.part.node.destroy();
      for (const p of this.chips) if (p.sprite.isValid) p.sprite.spriteFrame = null;
      this.ownedFrames.forEach(f => f.destroy()); this.ownedFrames.length = 0;
      this.sources.forEach(f => f.decRef()); this.sources.length = 0;
      this.backFrames.length = this.frontFrames.length = this.frameEnds.length = 0;
      this.rainFrame = this.chipFrame = null; this.atlas = null;
      if (this.groundRoot.isValid) this.groundRoot.destroy();
    });
    this.loadImpact(); this.loadRain();
  }

  private node(name: string, parent: Node): Node {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.setParent(parent); return node;
  }
  private part(name: string, parent: Node): Part {
    const node = this.node(name, parent), ui = node.addComponent(UITransform);
    const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
    node.active = false; return { node, sprite, ui };
  }
  private frame(source: SpriteFrame, x: number, y: number, w: number, h: number): SpriteFrame {
    const frame = new SpriteFrame();
    frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h),
      originalSize: new Size(w, h), offset: new Vec2() });
    frame.packable = false; this.ownedFrames.push(frame); return frame;
  }
  private loadImpact(): void {
    resources.load(IMPACT_RESOURCE + '.frames', JsonAsset, (err, data) => {
      if (err || !data || this.destroyed || !this.root.isValid) return;
      const atlas = data.json as Atlas;
      resources.load(IMPACT_RESOURCE + '/spriteFrame', SpriteFrame, (error, source) => {
        if (error || !source || this.destroyed || !this.root.isValid) return;
        source.addRef(); this.sources.push(source); this.atlas = atlas;
        this.split = atlas.groundAnchorPixels[1] + 2;
        let elapsed = 0;
        for (let i = 0; i < atlas.frameCount; i++) {
          const [x, y, w, h] = atlas.frames[atlas.framePrefix + i];
          // Complementary rectangles share one texture. The upper fragments
          // sit behind bodies; the lower chips can cross the front of the toes.
          this.backFrames.push(this.frame(source, x, y, w, this.split));
          this.frontFrames.push(this.frame(source, x, y + this.split, w, h - this.split));
          elapsed += atlas.frameDurations[i]; this.frameEnds.push(elapsed);
        }
        this.clipLife = Math.round(elapsed * 1e6) / 1e6;
        for (const h of this.hits) {
          h.back.ui.setAnchorPoint(atlas.groundAnchorPixels[0] / atlas.cellSize[0],
            1 - atlas.groundAnchorPixels[1] / this.split);
          h.front.ui.setAnchorPoint(atlas.groundAnchorPixels[0] / atlas.cellSize[0], 1);
        }
        if (this.running) this.render();
      });
    });
  }
  private loadRain(): void {
    resources.load(RAIN_RESOURCE + '/spriteFrame', SpriteFrame, (err, source) => {
      if (err || !source || this.destroyed || !this.root.isValid) return;
      source.addRef(); this.sources.push(source);
      // Keep the cutting point and broad shoulder. Removing the second point
      // makes a falling icicle instead of a symmetric floating diamond.
      this.rainFrame = this.frame(source, 0, 0, source.width, 156);
      this.chipFrame = this.frame(source, 0, 0, source.width, source.height);
      for (const d of this.drops) d.part.sprite.spriteFrame = this.rainFrame;
      for (const p of this.chips) p.sprite.spriteFrame = this.chipFrame;
      if (this.running) this.render();
    });
  }

  /** Effects only. A repeated cast reuses these slots instead of stacking
   * another white field. Hero owns the immediate hit and real slow timers. */
  cast(targets: readonly FrostUltTarget[]): void {
    if (this.destroyed || !targets.length) return;
    const top = LO.half - 150 - LO.notchTop, bottom = LINE_Y + 30;
    this.skyTop = top;
    this.targets = targets.filter(t => t.y >= bottom && t.y <= top).slice(0, MAX_MOBS);
    this.hide(); this.age = 0; this.running = true;
    this.rainCount = RAIN_CAP;
    const low = bottom + 10, span = Math.max(1, top - 10 - low);
    // Random within broad depth bands, then shuffle the entire sequence.
    // Equal coverage prevents a top-heavy storm without visible rows or a
    // grid. Neither the RNG stream nor any landing depends on monster count.
    for (let i = 0; i < RAIN_CAP; i++) {
      const d = this.drops[i], band = Math.floor(i * COVERAGE_BANDS / RAIN_CAP);
      d.x = (Math.random() * 2 - 1) * 325;
      d.y = low + (band + Math.random()) * span / COVERAGE_BANDS;
    }
    for (let i = RAIN_CAP - 1; i > 0; i--) {
      const a = this.drops[i], b = this.drops[Math.floor(Math.random() * (i + 1))];
      const x = a.x, y = a.y; a.x = b.x; a.y = b.y; b.x = x; b.y = y;
    }
    let nextHit = 0;
    for (let i = 0; i < this.rainCount; i++) {
      const d = this.drops[i];
      // Larger shatters belong to random rain contacts too, not enemy feet.
      const mainContact = nextHit < HIT_CAP && i === Math.floor(nextHit * RAIN_CAP / HIT_CAP);
      const depth = clamp((top - d.y) / Math.max(1, top - bottom));
      d.perspective = 0.86 + depth * 0.16;
      d.start = 0.045 + i / Math.max(1, this.rainCount - 1) * 0.94 + Math.random() * 0.004;
      d.height = (mainContact ? 60 + Math.random() * 12 : 45 + Math.random() * 16) * d.perspective;
      // Project a shared overhead altitude relative to EACH landing point.
      // Formation positions differ with ground depth; there is no fixed
      // screen-top conveyor and no viewport-length-dependent falling speed.
      d.travel = (340 + (Math.random() - 0.5) * 40) * d.perspective;
      d.flight = 0.27 + depth * 0.04 + Math.random() * 0.02;
      d.drift = (-34 - Math.random() * 18) * d.perspective;
      d.angle = Math.atan2(-d.travel * 1.75, -d.drift) * 180 / Math.PI - 90;
      d.seed = Math.random() * Math.PI * 2;
      if (d.depth) d.depth.depthY = d.y;
      if (mainContact) {
        const hit = this.hits[nextHit++];
        hit.x = d.x; hit.y = d.y; hit.start = d.start + d.flight;
        hit.width = 120 + depth * 24; hit.opacity = 0.86; hit.frameIndex = -1;
      }
    }
    this.render();
  }

  tick(dt: number): void {
    if (!this.running || this.destroyed || dt <= 0) return;
    this.age += dt;
    if (this.age >= DURATION) { this.running = false; this.hide(); return; }
    this.render();
  }
  private hide(): void {
    this.ground.clear(); this.trails.clear();
    for (const h of this.hits) { h.back.node.active = false; h.front.node.active = false; }
    for (const d of this.drops) d.part.node.active = false;
    for (const p of this.chips) p.node.active = false;
    if (this.depthParent) refreshDepth(this.depthParent);
  }
  private opacity(part: Part, amount: number): void {
    this.tint.set(255, 255, 255, Math.round(255 * clamp(amount))); part.sprite.color = this.tint;
  }
  private drawRain(part: Part, x: number, y: number, height: number, opacity: number, angle = RAIN_ANGLE, widthScale = 1): void {
    const frame = part.sprite.spriteFrame;
    if (!frame) { part.node.active = false; return; }
    part.ui.setContentSize(height * frame.width / frame.height * widthScale, height);
    part.node.setPosition(x, y, 0); part.node.angle = angle;
    this.opacity(part, opacity); part.node.active = opacity > 0;
  }

  /** A local contact for EVERY needle: fixed landing shadow, short flash,
   * radial cracks and low ballistic chips. No expanding full-field sheet. */
  private contact(d: Drop, age: number): void {
    if (age > -0.16 && age < 0) {
      const approach = 1 + age / 0.16, r = d.height * 0.105 * (0.45 + approach * 0.55);
      this.tint.set(31, 56, 67, Math.round(65 * approach)); this.ground.fillColor = this.tint;
      this.ground.ellipse(d.x, d.y, r, r * 0.28); this.ground.fill();
      return;
    }
    if (age < 0 || age >= 0.56) return;
    const flash = 1 - smooth(0.015, 0.1, age);
    if (flash > 0) {
      this.tint.set(189, 242, 255, Math.round(132 * flash)); this.ground.fillColor = this.tint;
      this.ground.ellipse(d.x, d.y, 12 + 7 * age / 0.1, 3.5); this.ground.fill();
    }
    const fade = 1 - smooth(0.26, 0.56, age), expansion = Math.min(1, age / 0.06);
    // Persistent short scratches bind the airborne shatter to the floor.
    this.tint.set(137, 219, 244, Math.round(112 * fade)); this.ground.strokeColor = this.tint;
    this.ground.lineWidth = 0.85;
    for (let k = 0; k < 6; k++) {
      const a = d.seed + k * Math.PI / 3, length = (14 + k * 3) * expansion;
      const dx = Math.cos(a), dy = Math.sin(a) * 0.34;
      this.ground.moveTo(d.x, d.y);
      this.ground.lineTo(d.x + dx * length * 0.54 - dy * 2, d.y + dy * length * 0.54);
      this.ground.lineTo(d.x + dx * length, d.y + dy * length); this.ground.stroke();
      const u = Math.min(1, age / (0.22 + k * 0.025));
      const distance = (18 + k * 4) * (1 - Math.pow(1 - u, 2));
      const hop = (10 + k % 3 * 4) * 4 * u * (1 - u);
      const x = d.x + dx * distance, y = d.y + dy * distance + hop;
      drawIceCrystal(this.trails, x, y, 6 + k % 3 * 2, 5 + k % 2 * 3,
        215 * fade, dx * 3);
      this.tint.set(39, 63, 69, Math.round(36 * fade)); this.ground.fillColor = this.tint;
      this.ground.ellipse(x, d.y + dy * distance, 3, 1); this.ground.fill();
    }
  }
  private render(): void {
    this.ground.clear(); this.trails.clear();
    if (!this.running) return;
    const t = this.age;
    // Small immediate contact lights only; no spreading ring or cold-wave sheet.
    if (t < 0.22) {
      this.tint.set(170, 231, 255, Math.round(62 * Math.pow(1 - t / 0.22, 1.5)));
      this.ground.fillColor = this.tint;
      for (const target of this.targets) {
        this.ground.ellipse(target.x, target.y, target.radius * 0.72, target.radius * 0.22);
      }
      this.ground.fill();
    }
    for (let i = 0; i < HIT_CAP; i++) {
      const hit = this.hits[i], age = t - hit.start;
      const visible = age >= 0 && age < HIT_SECONDS;
      hit.back.node.active = hit.front.node.active = visible && !!this.atlas;
      if (!visible) continue;
      if (this.atlas) {
        let index = Math.max(0, hit.frameIndex);
        const clipAge = age * this.clipLife / HIT_SECONDS;
        while (index < this.frameEnds.length - 1 && clipAge >= this.frameEnds[index]) index++;
        if (index !== hit.frameIndex) {
          hit.back.sprite.spriteFrame = this.backFrames[index];
          hit.front.sprite.spriteFrame = this.frontFrames[index]; hit.frameIndex = index;
        }
        const scale = hit.width / this.atlas.cellSize[0];
        hit.back.ui.setContentSize(hit.width, this.split * scale);
        hit.front.ui.setContentSize(hit.width, (this.atlas.cellSize[1] - this.split) * scale);
        hit.back.node.setPosition(hit.x, hit.y, 0);
        hit.front.node.setPosition(hit.x, hit.y - 2 * scale, 0);
        this.opacity(hit.back, hit.opacity); this.opacity(hit.front, hit.opacity);
      } else if (age < 0.5) {
        const fade = smooth(0, 0.1, age) * (1 - smooth(0.18, 0.5, age));
        for (let k = 0; k < 3; k++) drawIceCrystal(this.ground,
          hit.x + (k - 1) * 12, hit.y, 9, 14, 185 * fade, (k - 1) * 7);
      }
    }
    for (let n = 0; n < this.rainCount; n++) {
      const d = this.drops[n];
      const u = (t - d.start) / d.flight;
      d.part.node.active = false;
      this.contact(d, t - d.start - d.flight);
      if (u < 0 || u >= 1) continue;
      const remaining = 1 - (0.25 * u + 0.75 * u * u);
      const x = d.x + d.drift * (1 - u), y = d.y + d.travel * remaining;
      const formation = smooth(0, 0.06, t - d.start);
      // A short condensation at the overhead point replaces a fully formed
      // diamond popping into view. No fade-out before the point meets the floor.
      const fade = formation * (1 - smooth(this.skyTop + 8, this.skyTop + 70, y));
      if (fade <= 0) continue;
      const vertical = d.travel * (0.25 + 1.5 * u), length = Math.hypot(d.drift, vertical);
      const dx = d.drift / length, dy = vertical / length;
      const height = d.height * (0.72 + 0.28 * formation) * (1 + remaining * 0.08);
      const tail = height * 0.83, streak = 22 + 60 * u;
      for (let k = 0; k < 7; k++) {
        this.tint.set(162, 229, 253, Math.round(59 * fade * Math.pow(1 - k / 7, 1.7)));
        this.trails.strokeColor = this.tint; this.trails.lineWidth = 1.1 + (1 - k / 7) * 0.8;
        this.trails.moveTo(x + dx * (tail + streak * k / 7), y + dy * (tail + streak * k / 7));
        this.trails.lineTo(x + dx * (tail + streak * (k + 1) / 7), y + dy * (tail + streak * (k + 1) / 7));
        this.trails.stroke();
      }
      const angle = Math.atan2(-vertical, -d.drift) * 180 / Math.PI - 90;
      this.drawRain(d.part, x, y, height, fade * 0.9, angle, 0.72);
      if (!this.rainFrame) drawIceCrystal(this.trails, x, y + height, 9, -height, 190 * fade, 2);
    }
    for (let k = 0; k < CHIP_CAP; k++) {
      const part = this.chips[k], n = Math.floor(k / 5), i = k % 5;
      part.node.active = false;
      const hit = this.hits[n], age = t - hit.start;
      if (age < 0 || age >= 0.64) continue;
      const a = i / 5 * Math.PI * 2 + n * 0.71, u = Math.min(1, age / (0.52 + i * 0.045));
      const distance = (26 + i * 6) * (1 - Math.pow(1 - u, 2));
      const hop = (16 + i % 3 * 6) * 4 * u * (1 - u);
      const opacity = (1 - smooth(0.26, 0.64, age)) * 0.86;
      this.drawRain(part, hit.x + Math.cos(a) * distance,
        hit.y - Math.sin(a) * distance * 0.38 + hop, 11 + i % 3 * 3, opacity, RAIN_ANGLE + i * 61 + u * (i % 2 ? 95 : -70));
    }
    if (this.depthParent) refreshDepth(this.depthParent);
  }
}
