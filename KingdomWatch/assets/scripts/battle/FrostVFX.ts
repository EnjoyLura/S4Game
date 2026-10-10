/** Sparse painted mist animated by a shader, with code-drawn frost flecks and foot ice.
 * Fixed data pools and the simulation clock; no video frames or per-cast tweens.
 */
import { Color, EffectAsset, gfx, Graphics, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2, Vec4 } from 'cc';

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

interface Domain {
  x: number; y: number; radius: number; age: number; hold: number; life: number; seed: number;
  decal: Sprite; ui: UITransform; material: Material | null; state: Vec4;
}

export class FrostVFX {
  private ground: Graphics;
  private air: Graphics;
  private free: Domain[] = [];
  private active: Domain[] = [];
  private mistFrame: SpriteFrame | null = null;
  private mistEffect: EffectAsset | null = null;

  constructor(parent: Node, groundParent: Node) {
    // Black pixels in this light texture add nothing to the ground; no opaque ice sheet.
    const mist = new Node('frostGroundMist'); mist.layer = Layers.Enum.UI_2D; mist.setParent(groundParent);
    this.ground = this.layer('frostDomains', groundParent);
    this.air = this.layer('frostAir', parent);
    for (let i = 0; i < 4; i++) {
      const node = new Node('coldMist'); node.layer = Layers.Enum.UI_2D; node.setParent(mist);
      const ui = node.addComponent(UITransform), decal = node.addComponent(Sprite);
      ui.setAnchorPoint(0.5, 0.5); decal.sizeMode = Sprite.SizeMode.CUSTOM; decal.trim = false; node.active = false;
      // Creator 3.8's UIRenderer overrides effect blend factors from these serialized fields.
      // Match the additive pass before assigning it, so the renderer also keeps our material.
      const blend = decal as unknown as { _srcBlendFactor: gfx.BlendFactor; _dstBlendFactor: gfx.BlendFactor };
      blend._srcBlendFactor = gfx.BlendFactor.ONE; blend._dstBlendFactor = gfx.BlendFactor.ONE;
      this.free.push({ x: 0, y: 0, radius: 0, age: 0, hold: 0, life: 0, seed: 0, decal, ui, material: null, state: new Vec4() });
    }
    resources.load('fx/frost_mist_v3/spriteFrame', SpriteFrame, (err, source) => {
      if (err || !source || !mist.isValid) return;
      // Shader UVs need the full canvas; prevent trimming or dynamic-atlas UV remapping.
      const frame = new SpriteFrame(), w = source.texture.width, h = source.texture.height;
      frame.reset({ texture: source.texture, rect: new Rect(0, 0, w, h),
        originalSize: new Size(w, h), offset: new Vec2() });
      frame.packable = false; this.mistFrame = frame;
      for (const d of [...this.active, ...this.free]) d.decal.spriteFrame = frame;
      this.render();
    });
    resources.load('fx/frost-domain-v3', EffectAsset, (err, effect) => {
      if (err || !effect || !mist.isValid) return;
      effect.addRef(); this.mistEffect = effect;
      // Four reusable materials give simultaneous fields independent simulation clocks.
      for (const d of [...this.active, ...this.free]) {
        d.material = new Material(); d.material.initialize({ effectAsset: effect });
        d.decal.customMaterial = d.material;
      }
      this.render();
    });
    mist.once(Node.EventType.NODE_DESTROYED, () => {
      for (const d of [...this.active, ...this.free]) d.material?.destroy();
      this.mistFrame?.destroy(); this.mistFrame = null;
      this.mistEffect?.decRef(); this.mistEffect = null;
    });
  }

  private layer(name: string, parent: Node): Graphics {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.setParent(parent); return node.addComponent(Graphics);
  }

  domain(x: number, y: number, radius: number, duration: number): void {
    const d = this.free.pop() || this.active.shift();
    if (!d) return;
    Object.assign(d, { x, y, radius, age: 0, hold: duration, life: duration + 0.55, seed: x * 0.013 + y * 0.007 });
    this.active.push(d); this.render();
  }

  tick(dt: number): void {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const d = this.active[i]; d.age += dt;
      if (d.age >= d.life) { d.decal.node.active = false; this.active.splice(i, 1); this.free.push(d); }
    }
    this.render();
  }

  private render(): void {
    this.ground.clear(); this.air.clear();
    for (const d of this.active) this.draw(d);
  }

  private strokeArc(g: Graphics, x: number, y: number, radius: number, start: number, sweep: number, wobble: number): void {
    for (let k = 0; k <= 22; k++) {
      const p = k / 22, a = start + sweep * p, r = radius + Math.sin(p * Math.PI * 2) * wobble;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
  }

  private draw(d: Domain): void {
    const g = this.ground, air = this.air, age = d.age;
    const fade = 1 - clamp((age - d.hold) / 0.55);
    const open = 1 - Math.pow(1 - clamp((age + 0.025) / 0.14), 3);
    const r = d.radius * (0.55 + open * 0.45), x = d.x, y = d.y;
    const ready = !!this.mistFrame && !!d.material;
    // Never display the black source through a normal alpha-blended sprite while loading.
    d.decal.node.active = ready;
    if (ready) {
      d.ui.setContentSize(d.radius * 2.4, d.radius * 2.4);
      d.decal.node.setPosition(x, y, 0);
      d.state.set(age, d.hold, d.seed, 0);
      d.material!.setProperty('frostState', d.state);
    } else {
      // A few pale strokes keep the loading fallback light and free of hard rims.
      g.strokeColor = color(164, 230, 249, 18 * fade * open); g.lineWidth = 8;
      for (let k = 0; k < 3; k++) {
        this.strokeArc(g, x, y, r * 0.83, age * 0.8 + k * Math.PI * 2 / 3 + d.seed, 0.8, r * 0.025);
      }
    }
    // The freeze reads as a quick outward spray, not tall crystals covering monsters.
    if (age < 0.32) {
      const p = clamp(age / 0.32), alpha = 165 * Math.sin(p * Math.PI);
      for (let k = 0; k < 12; k++) {
        const a = k * 2.399 + d.seed;
        const rr = d.radius * (0.18 + p * (0.55 + k % 3 * 0.07));
        drawIceCrystal(air, x + Math.cos(a) * rr, y + Math.sin(a) * rr,
          2.1 * (1 - p), (5 + k % 3 * 2) * (1 - p), alpha, Math.cos(a) * 2);
      }
    }
    // Sparse rising frost, each with a stable phase, never a random flashing swarm.
    for (let k = 0; k < 10; k++) {
      const phase = (age * 0.7 + k * 0.371) % 1;
      const a = k * 2.399 + age * 0.17 + d.seed;
      const rr = r * (0.3 + (k % 5) * 0.13);
      const fx = x + Math.cos(a) * rr, fy = y + Math.sin(a) * rr + phase * 22;
      const alpha = Math.sin(phase * Math.PI) * 85 * fade;
      drawIceCrystal(air, fx, fy, 1.6, 3.8, alpha, 0.7);
    }
  }
}
