/** In-place fatal burst from the supplied reference. Whole bodies never fall. */
import { Color, EffectAsset, Graphics, Layers, Material, Node, resources, Sprite, UIOpacity, UITransform, Vec4 } from 'cc';
import { BattleSprite } from './BattleSprite';
import { FLIGHT_SHADOW } from './FlightPresentation';

export type DeathElement = 'physical' | 'fire' | 'volt' | 'frost';
export interface FatalHit {
  killer: string; angle?: number; heavy: boolean; force: number;
  elite: boolean; boss: boolean; frozen: boolean;
}
let effect: EffectAsset | null = null;
let requested = false, serial = 0;
const limit = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const t = limit(v); return t * t * (3 - 2 * t); };
const noise = (seed: number): number => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const PALETTES: Record<DeathElement, readonly [number, number, number, number]> = {
  physical: [0.78, 0.66, 0.43, 0], fire: [1, 0.41, 0.10, 1],
  volt: [0.64, 0.51, 0.91, 2], frost: [0.48, 0.82, 0.96, 3],
};
export function warmMonsterDeath(): void {
  if (requested) return;
  requested = true;
  resources.load('fx/mob-death', EffectAsset, (err, asset) => {
    if (!err && asset) { effect = asset; effect.addRef(); }
  });
}
export class MonsterDeath {
  active = false;
  private age = 0;
  private total = 0.35;
  private holdAt = 0.025;
  private burstDuration = 0.19;
  private radius = 22;
  private height = 85;
  private seed = 0;
  private dx = 0;
  private dy = 1;
  private force = 1;
  private element: DeathElement = 'physical';
  private heavy = false;
  private hasArt = false;
  private shaderReady = false;
  private footX = 0;
  private footY = 0;
  private airborne = false;
  private bodyX = 0;
  private bodyY = 0;
  private burst: Sprite;
  private burstTransform: UITransform;
  private opacity: UIOpacity;
  private material: Material | null = null;
  private bound = false;
  private state = new Vec4();
  private rect = new Vec4();
  private shape = new Vec4();
  private style = new Vec4();
  private motion = new Vec4();
  private tint = new Color();

  constructor(private root: Node, private art: BattleSprite) {
    warmMonsterDeath();
    const node = new Node('deathMaterialBurst');
    node.layer = Layers.Enum.UI_2D; node.setParent(root);
    this.burstTransform = node.addComponent(UITransform);
    this.burstTransform.setAnchorPoint(0.5, 0.5);
    this.burst = node.addComponent(Sprite);
    this.burst.sizeMode = Sprite.SizeMode.CUSTOM; this.burst.trim = false;
    node.active = false;
    this.opacity = root.getComponent(UIOpacity) || root.addComponent(UIOpacity);
    this.prepare();
    root.once(Node.EventType.NODE_DESTROYED, () => {
      this.material?.destroy(); this.material = null; this.active = false;
    });
  }
  /** One reusable material/quad per actor, prepared before crowded kills. */
  prepare(): void {
    if (!this.material && effect) {
      this.material = new Material();
      this.material.initialize({ effectAsset: effect, defines: { USE_TEXTURE: true } });
    }
  }
  reset(): void {
    this.active = this.bound = false;
    this.burst.node.active = false; this.burst.spriteFrame = null;
    this.art.setDeathMaterial(null); this.art.cold(null);
    // show() can early-return for an unchanged static frame; restore visibility here.
    if (this.art.node.isValid) this.art.node.active = this.art.loaded;
    this.opacity.opacity = 255;
  }
  begin(radius: number, groundOffset: number, hit: FatalHit, height = radius * 3.85, flightLift = 0): void {
    this.active = true; this.bound = false; this.burst.node.active = false; this.age = 0;
    this.seed = (++serial * 0.61803398875) % 1 * 97;
    this.radius = height / 3.85; this.height = height;
    this.footX = this.root.position.x;
    const bodyFootY = this.root.position.y + this.art.node.position.y + this.height * groundOffset;
    this.airborne = flightLift > 0;
    this.footY = bodyFootY - flightLift;
    this.bodyX = this.footX; this.bodyY = bodyFootY + this.height * 0.36;
    this.heavy = hit.heavy || hit.elite || hit.boss;
    this.element = hit.killer === 'pyro' || hit.killer === 'burn' ? 'fire'
      : hit.killer === 'mora' || hit.frozen ? 'frost' : hit.killer === 'volt' ? 'volt' : 'physical';
    const angle = hit.angle ?? Math.PI / 2;
    this.dx = Math.cos(angle); this.dy = Math.sin(angle);
    this.force = (this.heavy ? 1.15 : 1) * (1 + Math.min(0.5, hit.force) * 0.15);
    this.holdAt = this.heavy ? 0.030 : 0.020;
    this.burstDuration = hit.boss ? 0.24 : hit.elite ? 0.22 : 0.19;
    this.total = this.holdAt + Math.max(this.burstDuration, this.element === 'fire' ? 0.37 : 0.32);
    this.hasArt = this.art.loaded && !!this.art.sprite.spriteFrame;
    this.prepare();
    this.shaderReady = this.hasArt && !!this.material;
    this.art.freezePose(); this.art.setDeathMaterial(null); this.art.cold(null); this.art.tint(Color.WHITE);
    if (this.hasArt) {
      const sf = this.art.sprite.spriteFrame!, uv = sf.uv;
      const w = this.height * sf.rect.width / sf.rect.height, pad = Math.min(48, radius * 1.75);
      this.rect.set(uv[0], uv[1], uv[2] - uv[0], uv[5] - uv[1]);
      this.shape.set(w, this.height, pad, pad);
      this.burst.spriteFrame = sf;
      this.burstTransform.setContentSize(w + pad * 2, this.height + pad * 2);
      // Snapshot the held cel exactly. No body movement, rotation, scaling or ground pivot.
      const node = this.art.node, a = node.angle * Math.PI / 180;
      const cy = this.height * 0.5 * node.scale.y;
      this.burst.node.setPosition(node.position.x - Math.sin(a) * cy, node.position.y + Math.cos(a) * cy, 0);
      this.burst.node.setScale(node.scale); this.burst.node.angle = node.angle;
    }
    const p = PALETTES[this.element];
    this.style.set(p[0], p[1], p[2], p[3]);
    this.motion.set(this.dx, this.dy, this.burstDuration, 0);
    this.pose();
  }
  tick(dt: number): boolean {
    if (!this.active) return true;
    this.age += dt;
    if (this.age >= this.total) { this.active = false; this.burst.node.active = false; return true; }
    this.pose(); return false;
  }
  private pose(): void {
    const time = Math.max(0, this.age - this.holdAt), progress = limit(time / this.burstDuration);
    this.prepare();
    if (this.shaderReady && this.material) {
      if (!this.bound) {
        this.burst.customMaterial = this.material;
        this.material.setProperty('deathRect', this.rect); this.material.setProperty('deathShape', this.shape);
        this.material.setProperty('deathStyle', this.style); this.material.setProperty('deathMotion', this.motion);
        this.bound = true;
      }
      // The two sprites describe the same cel at handoff, and are never drawn together.
      this.art.node.active = this.age < this.holdAt;
      this.burst.node.active = this.age >= this.holdAt && progress < 1;
      this.state.set(time, progress, this.seed, this.force);
      this.material.setProperty('deathState', this.state); this.opacity.opacity = 255;
    } else {
      // Loading fallback also exits in place; the rejected fall is completely removed.
      this.burst.node.active = false;
      this.opacity.opacity = Math.round(255 * (1 - smooth(time / 0.12)));
    }
  }
  private fill(g: Graphics, r: number, green: number, b: number, a: number): void {
    this.tint.set(r, green, b, Math.round(Math.max(0, a))); g.fillColor = this.tint;
  }
  /** Only the contact shadow fades with the body; deaths leave no ground residue. */
  drawGround(g: Graphics): void {
    if (!this.active) return;
    const shadow = 1 - smooth((this.age - this.holdAt) / this.burstDuration);
    if (shadow > 0.01) {
      this.fill(g, 28, 23, 18, (this.airborne ? FLIGHT_SHADOW.alpha : 42) * shadow);
      g.ellipse(this.footX, this.footY, this.radius * (this.airborne ? FLIGHT_SHADOW.width : 1.02),
        this.radius * (this.airborne ? FLIGHT_SHADOW.height : 0.20)); g.fill();
    }
  }
  drawAir(g: Graphics): void {
    if (!this.active) return;
    this.drawSnap(g);
    if (this.element === 'volt') this.drawElectric(g);
    const count = this.heavy ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const n = noise(this.seed + i * 3.17), n2 = noise(this.seed + i * 7.13 + 3);
      const time = this.age - this.holdAt - n * 0.025;
      const life = this.element === 'fire' ? 0.25 + n * 0.09 : 0.22 + n * 0.07;
      if (time < 0 || time > life) continue;
      const t = time / life, fade = Math.pow(1 - t, 1.3) * Math.min(1, time / 0.015);
      const vx = (n - 0.5) * 185 + this.dx * 42 * this.force, vy = 45 + n2 * 80 + this.dy * 16;
      const x = this.bodyX + (n2 - 0.5) * this.radius * 0.6 + vx * time;
      const y = this.bodyY - this.height * 0.15 + vy * time - (this.element === 'fire' ? 25 : 340) * time * time;
      const r = (this.element === 'frost' ? 1.7 + n * 2.1 : 1.2 + n * 1.5) * (1 - t * 0.4);
      if (this.element === 'frost') {
        this.fill(g, 86, 176, 211, 225 * fade);
        const a = n2 * 6.28 + time * (n > 0.5 ? 8 : -7), ux = Math.cos(a) * r, uy = Math.sin(a) * r;
        g.moveTo(x + ux, y + uy); g.lineTo(x - uy * 0.5, y + ux * 0.5);
        g.lineTo(x - ux, y - uy); g.lineTo(x + uy * 0.5, y - ux * 0.5); g.close(); g.fill();
        this.fill(g, 203, 241, 247, 230 * fade);
        g.moveTo(x + ux, y + uy); g.lineTo(x - uy * 0.5, y + ux * 0.5); g.lineTo(x, y); g.close(); g.fill();
      } else if (this.element === 'fire') {
        this.fill(g, 255, 129 + n * 65, 48, 225 * fade);
        g.ellipse(x, y, r * 0.55, r * 1.25); g.fill();
      } else {
        this.fill(g, 86, 68, 49, 215 * fade);
        g.moveTo(x - r, y - r * .5); g.lineTo(x + r * .8, y - r * .6);
        g.lineTo(x + r, y + r * .5); g.lineTo(x - r * .5, y + r * .8); g.close(); g.fill();
        this.fill(g, 206, 177, 124, 185 * fade);
        g.ellipse(x - r * .2, y + r * .2, r * .65, r * .25); g.fill();
      }
    }
  }
  /** Six tapered airborne accents punctuate the split, never a ground stain or body flash. */
  private drawSnap(g: Graphics): void {
    const time = this.age - this.holdAt;
    if (time < 0 || time > .105) return;
    const t = time / .105, p = PALETTES[this.element];
    this.fill(g, p[0] * 255, p[1] * 255, p[2] * 255, 195 * (1 - t) * Math.min(1, time / .012));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + this.seed, ux = Math.cos(a), uy = Math.sin(a);
      const r = this.radius * (.35 + t * .7), length = (this.heavy ? 13 : 9) * (1 - t * .45);
      const x = this.bodyX + ux * r + this.dx * t * 7, y = this.bodyY + uy * r * .8 + this.dy * t * 7;
      g.moveTo(x + ux * length, y + uy * length);
      g.lineTo(x - uy * 1.1, y + ux * 1.1);
      g.lineTo(x - ux * 2, y - uy * 2); g.close(); g.fill();
    }
  }
  private drawElectric(g: Graphics): void {
    const time = this.age - this.holdAt;
    if (time < 0 || time > 0.10) return;
    this.tint.set(184, 156, 238, Math.round(190 * Math.pow(1 - time / 0.10, 1.3)));
    g.strokeColor = this.tint; g.lineWidth = 1.3;
    for (let k = 0; k < 2; k++) {
      const sign = k ? 1 : -1;
      g.moveTo(this.bodyX - this.radius * 0.45, this.bodyY);
      for (let j = 1; j <= 4; j++) g.lineTo(this.bodyX + (j / 4 - 0.5) * this.radius * 1.25,
        this.bodyY + sign * Math.sin(j * 2.3 + Math.floor(time * 24) + this.seed) * this.radius * 0.25);
      g.stroke();
    }
  }
}
