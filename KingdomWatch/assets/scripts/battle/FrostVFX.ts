/** Ice at monster feet and the approved H3 v10 frost-domain clip.
 * Shared straight-alpha atlas, fixed pool, and the battle simulation clock.
 */
import { Color, Graphics, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';

const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const tint = new Color();
function color(r: number, g: number, b: number, alpha: number): Color {
  tint.set(r, g, b, Math.round(Math.max(0, Math.min(255, alpha)))); return tint;
}

/** Three painted planes give each shard a solid cyan dark face and an ivory cutting edge. */
export function drawIceCrystal(g: Graphics, x: number, y: number, width: number, height: number, alpha: number, lean = 0): void {
  const tipX = x + lean, tipY = y + height, shoulderY = y + height * 0.65;
  g.fillColor = color(55, 158, 209, alpha); g.strokeColor = color(35, 111, 153, alpha * 0.55); g.lineWidth = 0.8;
  g.moveTo(x - width * 0.5, y + height * 0.12); g.lineTo(x - width * 0.42, shoulderY);
  g.lineTo(tipX, tipY); g.lineTo(x + width * 0.5, y + height * 0.54);
  g.lineTo(x + width * 0.35, y); g.close(); g.fill(); g.stroke();
  g.fillColor = color(147, 232, 252, alpha);
  g.moveTo(x - width * 0.5, y + height * 0.12); g.lineTo(x - width * 0.42, shoulderY);
  g.lineTo(tipX, tipY); g.lineTo(x + width * 0.08, y + height * 0.47);
  g.lineTo(x + width * 0.03, y); g.close(); g.fill();
  g.fillColor = color(222, 252, 255, alpha * 0.9);
  g.moveTo(x - width * 0.42, shoulderY); g.lineTo(tipX, tipY);
  g.lineTo(x + width * 0.08, y + height * 0.47); g.lineTo(x - width * 0.06, y + height * 0.29); g.close(); g.fill();
}

/** Ice stays on the monster's fixed foot baseline. It covers ankles only, never a body-sized box. */
export function drawFootIce(g: Graphics, x: number, y: number, radius: number, age: number, remaining: number, thaw: number): void {
  if (remaining > 0) {
    const pop = 0.7 + clamp(age / 0.09) * 0.3;
    const fade = clamp(remaining / 0.09), alpha = 215 * fade;
    g.fillColor = color(72, 177, 222, 45 * fade);
    g.ellipse(x, y, radius * 1.05, radius * 0.21); g.fill();
    // Staggered back teeth, then a low front block: feet retain contact and the original silhouette.
    for (let k = 0; k < 5; k++) {
      const offset = (k - 2) * radius * 0.33;
      const height = radius * (k === 2 ? 0.55 : k % 2 ? 0.36 : 0.44) * pop;
      drawIceCrystal(g, x + offset, y - radius * 0.05, radius * 0.39, height, alpha, offset * 0.15);
    }
    g.fillColor = color(96, 202, 235, alpha * 0.86);
    g.moveTo(x - radius * 0.83, y + radius * 0.07); g.lineTo(x - radius * 0.48, y + radius * 0.22);
    g.lineTo(x + radius * 0.66, y + radius * 0.17); g.lineTo(x + radius * 0.89, y - radius * 0.06);
    g.lineTo(x + radius * 0.45, y - radius * 0.17); g.lineTo(x - radius * 0.64, y - radius * 0.15); g.close(); g.fill();
    g.strokeColor = color(232, 253, 255, 155 * fade); g.lineWidth = 1;
    g.moveTo(x - radius * 0.65, y + radius * 0.07); g.lineTo(x + radius * 0.38, y + radius * 0.09); g.stroke();
  } else if (thaw > 0) {
    const t = 1 - thaw / 0.26, fade = 1 - t;
    for (let k = 0; k < 5; k++) {
      const side = k - 2;
      const fx = x + side * radius * (0.32 + t * 0.38);
      const fy = y + Math.sin(t * Math.PI) * radius * (0.2 + k % 2 * 0.18) - t * radius * 0.16;
      drawIceCrystal(g, fx, fy, radius * 0.17 * fade, radius * 0.24 * fade, 180 * fade, side * 1.2);
    }
  }
}

interface FrostAtlas {
  frames: Record<string, number[]>;
  framePrefix: string;
  frameCount: number;
  cellSize: [number, number];
  frameDurations: number[];
  groundAnchor: [number, number];
  groundRadius: number;
}
interface Domain {
  x: number; y: number; radius: number; age: number; frameIndex: number;
  sprite: Sprite; ui: UITransform;
}
const FROST_RESOURCE = 'fx/frost_domain_video_v10';
const CLIP_DURATION = 1.5;

export class FrostVFX {
  private root: Node;
  private fallback: Graphics;
  private free: Domain[] = [];
  private active: Domain[] = [];
  private frames: SpriteFrame[] = [];
  private frameEnds: number[] = [];
  private atlas: FrostAtlas | null = null;
  private source: SpriteFrame | null = null;
  private life = CLIP_DURATION;
  private ground: Graphics;
  private groundVisible = false;

  constructor(groundParent: Node) {
    const ground = new Node('frostGround');
    ground.layer = Layers.Enum.UI_2D; ground.setParent(groundParent);
    this.ground = ground.addComponent(Graphics);
    this.root = new Node('frostDomainVideo');
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(groundParent);
    this.fallback = this.root.addComponent(Graphics);
    for (let i = 0; i < 4; i++) {
      const node = new Node('frostClip' + i);
      node.layer = Layers.Enum.UI_2D; node.setParent(this.root);
      const ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
      // The atlas is straight RGBA: use the Sprite's standard alpha blend, never ADD.
      node.active = false;
      this.free.push({ x: 0, y: 0, radius: 0, age: 0, frameIndex: -1, sprite, ui });
    }
    resources.load(FROST_RESOURCE + '.frames', JsonAsset, (err, data) => {
      if (err || !data || !this.root.isValid) return;
      const atlas = data.json as FrostAtlas;
      resources.load(FROST_RESOURCE + '/spriteFrame', SpriteFrame, (error, source) => {
        if (error || !source || !this.root.isValid) return;
        source.addRef(); this.source = source; this.atlas = atlas;
        let elapsed = 0;
        for (let i = 0; i < atlas.frameCount; i++) {
          const [x, y, w, h] = atlas.frames[atlas.framePrefix + i];
          const frame = new SpriteFrame();
          // Every cel uses the same full canvas and anchor, with no trimming or atlas remapping.
          frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h),
            originalSize: new Size(w, h), offset: new Vec2() });
          frame.packable = false; this.frames.push(frame);
          elapsed += atlas.frameDurations[i]; this.frameEnds.push(elapsed);
        }
        this.life = Math.round(elapsed * 1e6) / 1e6;
        for (const d of [...this.active, ...this.free]) d.ui.setAnchorPoint(...atlas.groundAnchor);
        this.render();
      });
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      for (const d of [...this.active, ...this.free]) d.sprite.spriteFrame = null;
      this.frames.forEach(frame => frame.destroy()); this.frames.length = 0;
      this.source?.decRef(); this.source = null;
      this.active.length = 0; this.free.length = 0;
    });
  }

  /** The visual clip is independent of gameplay freeze duration, which Monster owns. */
  domain(x: number, y: number, radius: number, _freezeDuration: number): void {
    const d = this.free.pop() || this.active.shift();
    if (!d) return;
    Object.assign(d, { x, y, radius, age: 0, frameIndex: -1 });
    this.active.push(d); this.render();
  }

  /** Low ground frost persists independently of the complete, unchanged v10 casting clip. */
  groundAreas(areas: readonly { x: number; y: number; radius: number; t: number; life: number }[]): void {
    if (!areas.length && !this.groundVisible) return;
    this.groundVisible = areas.length > 0;
    const g = this.ground; g.clear();
    for (const area of areas) {
      const fade = Math.min(1, area.t / .45, (area.life - area.t) / .15);
      const r = area.radius;
      g.fillColor = color(98, 185, 218, 26 * fade);
      g.circle(area.x, area.y, r); g.fill();
      g.fillColor = color(176, 231, 244, 22 * fade);
      g.circle(area.x, area.y, r * .72); g.fill();
      // Broken crystalline edges keep the battlefield legible without a heavy status ring.
      for (let k = 0; k < 9; k++) {
        const angle = k * Math.PI * 2 / 9 + area.x * .013;
        const x = area.x + Math.cos(angle) * r * .82;
        const y = area.y + Math.sin(angle) * r * .82;
        drawIceCrystal(g, x, y, 5, 9, 95 * fade, Math.cos(angle) * 2);
        g.strokeColor = color(212, 247, 252, 70 * fade); g.lineWidth = 1;
        g.moveTo(x - 8, y - 1); g.lineTo(x, y + 2); g.lineTo(x + 7, y); g.stroke();
      }
    }
  }

  tick(dt: number): void {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const d = this.active[i]; d.age += dt;
      if (d.age >= this.life) {
        d.sprite.node.active = false; this.active.splice(i, 1); this.free.push(d);
      }
    }
    this.render();
  }

  private render(): void {
    this.fallback.clear();
    for (const d of this.active) {
      if (this.atlas) {
        let index = Math.max(0, d.frameIndex);
        // Variable cel timing also handles skipped frames at low FPS and battle speed-up.
        while (index < this.frames.length - 1 && d.age >= this.frameEnds[index]) index++;
        if (index !== d.frameIndex) {
          d.sprite.spriteFrame = this.frames[index]; d.frameIndex = index;
        }
        const scale = d.radius / this.atlas.groundRadius;
        d.ui.setContentSize(this.atlas.cellSize[0] * scale, this.atlas.cellSize[1] * scale);
        d.sprite.node.setPosition(d.x, d.y, 0);
        d.sprite.node.active = d.age < this.life;
      } else {
        // Only while downloading: a light, brief frost front; never draw the obsolete ice sheet.
        const open = clamp(d.age / 0.4), fade = clamp((this.life - d.age) / 0.68);
        this.fallback.strokeColor = color(152, 226, 249, 35 * Math.sin(open * Math.PI) * fade);
        this.fallback.lineWidth = 4;
        this.fallback.circle(d.x, d.y, Math.max(1, d.radius * open)); this.fallback.stroke();
      }
    }
  }
}
