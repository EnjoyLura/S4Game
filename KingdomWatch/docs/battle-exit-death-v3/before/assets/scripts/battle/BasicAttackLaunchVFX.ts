/** Texture-free procedural releases. A runtime white carrier supplies geometry, never artwork. */
import { Color, EffectAsset, Graphics, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';

type Element = 'wind' | 'fire' | 'volt' | 'frost';
type RGB = readonly [number, number, number];
interface Style { element: Element; life: number; scale: number; primary: RGB; light: RGB; dark: RGB; }
interface Procedural {
  node: Node; sprite: Sprite; material: Material | null; state: Vec4; color: Vec4;
}
interface Release { x: number; y: number; dx: number; dy: number; age: number; scale: number; phase: number; style: Style; quad: Procedural; }
const STYLES: Record<string, Style> = {
  archer: { element: 'wind', life: .32, scale: 1.45, primary: [216, 239, 231], light: [248, 255, 252], dark: [138, 190, 177] },
  sniper: { element: 'wind', life: .36, scale: 1.7, primary: [210, 234, 246], light: [248, 255, 255], dark: [120, 182, 204] },
  pyro: { element: 'fire', life: .34, scale: 1.5, primary: [255, 136, 35], light: [255, 238, 175], dark: [230, 65, 24] },
  volt: { element: 'volt', life: .30, scale: 1.5, primary: [180, 126, 245], light: [242, 227, 255], dark: [114, 69, 203] },
  mora: { element: 'frost', life: .36, scale: 1.5, primary: [136, 221, 249], light: [229, 253, 255], dark: [55, 157, 218] },
};
const MODES: Record<Element, number> = { wind: 0, fire: 1, volt: 2, frost: 3 };

export class BasicAttackLaunchVFX {
  private node: Node;
  private g: Graphics;
  private active: Release[] = [];
  private free: Release[] = [];
  private tint = new Color();
  private serial = 0;
  private painted = false;
  private carrier: SpriteFrame;
  private carrierTexture: Texture2D;
  private shaderReady = false;

  constructor(parent: Node) {
    this.node = new Node('basicAttackReleases');
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.g = this.node.addComponent(Graphics);
    // Sprite is only a four-vertex carrier. The fragment shader has no texture sampler.
    this.carrierTexture = new Texture2D();
    this.carrierTexture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    this.carrierTexture.uploadData(new Uint8Array(16).fill(255));
    this.carrier = new SpriteFrame();
    this.carrier.reset({ texture: this.carrierTexture, rect: new Rect(0, 0, 2, 2),
      originalSize: new Size(2, 2), offset: new Vec2() });
    this.carrier.packable = false;
    for (let i = 0; i < 36; i++) {
      const node = new Node('proceduralRelease' + i);
      node.layer = Layers.Enum.UI_2D; node.setParent(this.node); node.active = false;
      const ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      ui.setAnchorPoint(.25, .5); ui.setContentSize(128, 96);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
      sprite.spriteFrame = this.carrier;
      this.free.push({ x: 0, y: 0, dx: 0, dy: 1, age: 0, scale: 1, phase: 0,
        style: STYLES.archer, quad: { node, sprite, material: null, state: new Vec4(), color: new Vec4() } });
    }
    resources.load('fx/basic-launch-procedural', EffectAsset, (err, effect) => {
      if (err || !effect || !this.node.isValid) return;
      for (const a of [...this.active, ...this.free]) {
        const material = new Material();
        material.initialize({ effectAsset: effect });
        a.quad.material = material; a.quad.sprite.customMaterial = material;
      }
      this.shaderReady = true;
    });
    this.node.once(Node.EventType.NODE_DESTROYED, () => {
      for (const a of [...this.active, ...this.free]) {
        a.quad.sprite.spriteFrame = null; a.quad.material?.destroy();
      }
      this.carrier.destroy(); this.carrierTexture.destroy();
    });
  }

  release(hero: string, x: number, y: number, dx: number, dy: number, empowered = false): void {
    const style = STYLES[hero], length = Math.hypot(dx, dy);
    if (!style || !this.node.isValid || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(length) || length < .001) return;
    // Exhausting a cosmetic pool never blocks or changes a physical shot.
    const a = this.free.pop();
    if (!a) return;
    a.x = x; a.y = y; a.dx = dx / length; a.dy = dy / length;
    a.age = 0; a.style = style; a.scale = style.scale * (empowered ? 1.12 : 1);
    a.phase = (++this.serial * 2.399963) % (Math.PI * 2);
    this.active.push(a);
    this.shaderRelease(a, 0);
  }

  tick(dt: number): void {
    if (!this.node.isValid || !Number.isFinite(dt) || dt < 0) return;
    if (!this.active.length) {
      if (this.painted) { this.g.clear(); this.painted = false; }
      return;
    }
    this.g.clear();
    this.painted = true;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.age += dt;
      if (a.age >= a.style.life) {
        a.quad.node.active = false; this.active.splice(i, 1); this.free.push(a); continue;
      }
      const t = a.age / a.style.life;
      this.shaderRelease(a, t);
      if (this.shaderReady) continue;
      if (a.style.element === 'wind') this.wind(a, t);
      else if (a.style.element === 'fire') this.fire(a, t);
      else if (a.style.element === 'volt') this.volt(a, t);
      else this.frost(a, t);
    }
  }

  private shaderRelease(a: Release, t: number): void {
    const part = a.quad;
    if (!this.shaderReady || !part.material) { part.node.active = false; return; }
    part.state.set(t, MODES[a.style.element], a.phase, a.age);
    part.color.set(a.style.primary[0] / 255, a.style.primary[1] / 255, a.style.primary[2] / 255, 1);
    part.material.setProperty('launchState', part.state);
    part.material.setProperty('launchColor', part.color);
    part.node.setPosition(a.x + a.dx * 3, a.y + a.dy * 3, 0);
    part.node.angle = Math.atan2(a.dy, a.dx) * 180 / Math.PI;
    part.node.setScale(a.scale, a.scale, 1);
    part.node.active = true;
  }

  private color(rgb: RGB, alpha: number): void {
    this.tint.set(rgb[0], rgb[1], rgb[2], Math.round(Math.max(0, Math.min(255, alpha * 1.25))));
    this.g.fillColor = this.tint;
    this.g.strokeColor = this.tint;
  }

  /** All geometry is in the projectile's forward/perpendicular coordinates. */
  private move(a: Release, u: number, v: number): void {
    u *= a.scale; v *= a.scale;
    this.g.moveTo(a.x + a.dx * u - a.dy * v, a.y + a.dy * u + a.dx * v);
  }
  private line(a: Release, u: number, v: number): void {
    u *= a.scale; v *= a.scale;
    this.g.lineTo(a.x + a.dx * u - a.dy * v, a.y + a.dy * u + a.dx * v);
  }
  /** Open transverse pressure front; thin ends keep it an air crescent rather than a disk. */
  private pressure(a: Release, u: number, span: number, bulge: number, thickness: number): void {
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const theta = -Math.PI / 2 + i * Math.PI / steps;
      const x = u + bulge * Math.cos(theta), y = span * Math.sin(theta);
      if (i === 0) this.move(a, x, y); else this.line(a, x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const theta = -Math.PI / 2 + i * Math.PI / steps;
      const taper = Math.pow(Math.max(0, Math.cos(theta)), .65);
      this.line(a, u + bulge * Math.cos(theta) - thickness * taper, span * Math.sin(theta));
    }
    this.g.close(); this.g.fill();
  }

  /** A narrow curved airflow/flame ribbon with a sharp leading tip. */
  private ribbon(a: Release, u: number, v: number, length: number, width: number, bend: number): void {
    this.move(a, u, v);
    for (let i = 1; i <= 9; i++) {
      const q = i / 9, center = v + Math.sin(q * Math.PI) * bend;
      this.line(a, u + q * length, center + Math.sin(q * Math.PI) * width);
    }
    for (let i = 8; i >= 0; i--) {
      const q = i / 9, center = v + Math.sin(q * Math.PI) * bend;
      this.line(a, u + q * length, center - Math.sin(q * Math.PI) * width * .65);
    }
    this.g.close(); this.g.fill();
  }

  private wind(a: Release, t: number): void {
    const open = 1 - Math.pow(1 - t, 3), fade = Math.pow(1 - t, 1.05);
    const u = 4 + open * 20, span = 7 + open * 23;
    this.color(a.style.primary, 100 * fade);
    this.pressure(a, u - 4, span * .84, 6, 4);
    this.color(a.style.light, 225 * fade);
    this.pressure(a, u, span, 10, 5 * (1 - t * .6));
    this.color(a.style.light, 140 * fade);
    this.pressure(a, u - 8, span * .67, 5, 2.3);
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1;
      this.color(a.style.primary, 145 * fade);
      this.ribbon(a, -4 + open * 6, side * (5 + open * 7), 24 + open * 14, 1.7 * (1 - t * .6), side * 2.2);
    }
    this.color(a.style.light, 130 * Math.pow(1 - t, 3));
    this.ribbon(a, -3, 0, 22 + open * 9, 1.1, 0);
  }

  private fire(a: Release, t: number): void {
    const fade = Math.pow(1 - t, 1.05), travel = 1 - Math.pow(1 - t, 2);
    const u = 1 + travel * 19, length = 24 * (1 - t * .45);
    this.color(a.style.dark, 110 * fade);
    this.ribbon(a, u - 3, 0, length + 7, 7 * (1 - t * .6), Math.sin(t * 8 + a.phase) * 2);
    this.color(a.style.primary, 225 * fade);
    this.ribbon(a, u, 0, length, 4.6 * (1 - t * .65), Math.sin(t * 10 + a.phase) * 1.7);
    this.color(a.style.light, 235 * Math.pow(1 - t, 2));
    this.ribbon(a, u, -1, length * .74, 2.1 * (1 - t * .5), -.7);
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1;
      this.color(a.style.primary, 180 * fade);
      this.ribbon(a, u + 2, side * 5, length * .65, 2.2 * (1 - t), side * (3 + t * 4));
    }
    for (let k = 0; k < 8; k++) {
      const side = k % 2 ? -1 : 1, distance = 7 + travel * (22 + k * 3);
      const v = side * (3 + travel * (3 + k * 2)) + Math.sin(a.phase + k) * 1.5;
      this.color(k % 2 ? a.style.light : a.style.primary, 205 * fade);
      this.ribbon(a, distance, v, 4 * (1 - t * .6), .85 * (1 - t * .6), side * .4);
    }
  }

  private electricPath(a: Release, branch: number, t: number): void {
    const side = branch === 0 ? 0 : branch === 1 ? -1 : 1;
    const length = (branch === 0 ? 32 : 23) * (1 - t * .15), offset = 2 + t * 15;
    const phase = a.phase + Math.floor(a.age * 30) * 1.71;
    this.move(a, offset - 3, side * 2);
    for (let i = 1; i <= 5; i++) {
      const q = i / 5;
      const jitter = Math.sin(phase + i * 2.83 + branch * 1.9) * (i === 5 ? .5 : 3);
      this.line(a, offset + length * q, side * q * 12 + jitter);
    }
    this.g.stroke();
  }

  private volt(a: Release, t: number): void {
    const fade = Math.pow(1 - t, .95);
    this.color(a.style.dark, 60 * fade);
    this.pressure(a, 3 + t * 8, 5 + t * 10, 4, 3);
    for (let branch = 0; branch < 3; branch++) {
      this.color(a.style.primary, (branch ? 180 : 230) * fade);
      this.g.lineWidth = (branch ? 2.7 : 4.2) * a.scale;
      this.electricPath(a, branch, t);
      this.color(a.style.light, (branch ? 200 : 245) * fade);
      this.g.lineWidth = (branch ? 1.1 : 1.6) * a.scale;
      this.electricPath(a, branch, t);
    }
    for (let k = 0; k < 3; k++) {
      const side = k % 2 ? -1 : 1, u = 9 + t * (19 + k * 3), v = side * (5 + t * 8);
      this.color(a.style.light, 150 * fade);
      this.g.lineWidth = .9 * a.scale;
      this.move(a, u - 2, v); this.line(a, u + 2, v);
      this.move(a, u, v - 2.5); this.line(a, u, v + 2.5); this.g.stroke();
    }
  }

  private crystal(a: Release, u: number, v: number, length: number, width: number, fade: number): void {
    this.color(a.style.primary, 200 * fade);
    this.move(a, u + length, v); this.line(a, u, v + width);
    this.line(a, u - length * .65, v); this.line(a, u, v - width);
    this.g.close(); this.g.fill();
    this.color(a.style.light, 235 * fade);
    this.move(a, u + length, v); this.line(a, u, v + width);
    this.line(a, u - length * .65, v); this.g.close(); this.g.fill();
  }

  private frost(a: Release, t: number): void {
    const fade = Math.pow(1 - t, 1.05), travel = 1 - Math.pow(1 - t, 2);
    this.color(a.style.primary, 90 * fade);
    this.pressure(a, 3 + travel * 12, 5 + travel * 10, 5, 3);
    this.color(a.style.light, 165 * fade);
    this.pressure(a, 6 + travel * 13, 4 + travel * 11, 5, 1.4);
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1;
      this.color(a.style.primary, 105 * fade);
      this.ribbon(a, 1 + travel * 7, side * (4 + travel * 7), 20 + travel * 13, 1.8 * (1 - t * .6), side * 2);
    }
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? -1 : 1, u = 5 + travel * (19 + k * 4);
      const v = side * (2 + travel * (3 + k * 2));
      this.crystal(a, u, v, (3 + k * .5) * (1 - t * .3), 1.6 * (1 - t * .3), fade);
    }
    this.color(a.style.light, 170 * Math.pow(1 - t, 3));
    this.g.lineWidth = 1 * a.scale;
    this.move(a, -3, 0); this.line(a, 9, 0);
    this.move(a, 3, -4); this.line(a, 3, 4); this.g.stroke();
  }
}
