/** Distance-based basic-shot wakes and side accents. Cosmetic only; no frame-count randomness. */
import { Color, Graphics, Layers, Node } from 'cc';

type RGB = readonly [number, number, number];
interface Style { tail: number; width: number; color: RGB; light: RGB; }
const STYLES: Record<string, Style> = {
  archer: { tail: 126, width: 4.8, color: [159, 226, 190], light: [255, 240, 175] },
  sniper: { tail: 146, width: 5.4, color: [125, 201, 236], light: [232, 250, 255] },
  pyro: { tail: 112, width: 6.2, color: [255, 118, 30], light: [255, 230, 136] },
  volt: { tail: 118, width: 4.4, color: [174, 102, 249], light: [242, 218, 255] },
  mora: { tail: 136, width: 6, color: [96, 209, 249], light: [225, 251, 255] },
};

export class BasicProjectileFlightVFX {
  private root: Node;
  private g: Graphics;
  private tint = new Color();
  private x = 0; private y = 0; private dx = 0; private dy = 1;

  constructor(parent: Node) {
    this.root = new Node('basicShotWakes');
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(parent);
    // Painted bodies stay above the wake; the center axis is clear around physical arrowheads.
    this.root.setSiblingIndex(0);
    this.g = this.root.addComponent(Graphics);
  }

  beginFrame(): void { this.g.clear(); }

  projectile(hero: string, x: number, y: number, vx: number, vy: number,
    size: number, age: number, phase: number): boolean {
    const style = STYLES[hero], speed = Math.hypot(vx, vy);
    if (!style || !Number.isFinite(speed) || speed < .01) return false;
    this.x = x; this.y = y; this.dx = vx / speed; this.dy = vy / speed;
    const body = hero === 'archer' ? 30 + size * 4.2 : hero === 'mora' ? size * 5.6
      : hero === 'sniper' ? size * 3.6 : hero === 'pyro' ? size * 2.65 : size * 2;
    const tail = body * .46;
    // Build up only after the projectile has traveled the distance. No full-length tail on spawn.
    const length = Math.min(style.tail, Math.max(0, speed * age - tail));
    if (length > 1) this.wake(style, tail, length, age, phase, hero === 'pyro');
    if (hero === 'volt') this.electric(size, age, phase, style);
    else if (hero === 'pyro') this.embers(body, length, age, phase, style);
    else if (hero === 'mora') this.ice(body, length, age, phase, style);
    else this.wind(body, length, age, phase, style, hero === 'sniper');
    return true;
  }

  private color(rgb: RGB, alpha: number): void {
    this.tint.set(rgb[0], rgb[1], rgb[2], Math.round(Math.max(0, Math.min(255, alpha))));
    this.g.fillColor = this.tint; this.g.strokeColor = this.tint;
  }
  private move(u: number, v: number): void {
    this.g.moveTo(this.x + this.dx * u - this.dy * v, this.y + this.dy * u + this.dx * v);
  }
  private line(u: number, v: number): void {
    this.g.lineTo(this.x + this.dx * u - this.dy * v, this.y + this.dy * u + this.dx * v);
  }
  private diamond(u: number, v: number, long: number, wide: number): void {
    this.move(u + long, v); this.line(u, v + wide); this.line(u - long, v);
    this.line(u, v - wide); this.g.close(); this.g.fill();
  }

  private wake(style: Style, tail: number, length: number, age: number, phase: number, flame: boolean): void {
    for (let band = 0; band < 3; band++) {
      const width = style.width * (band === 0 ? 1 : band === 1 ? .43 : .11);
      for (let k = 0; k < 9; k++) {
        const a = k / 9, b = (k + 1) / 9;
        const wa = width * Math.pow(1 - a, 1.35), wb = width * Math.pow(1 - b, 1.35);
        const va = Math.sin(a * 8 - age * 15 + phase) * a * (flame ? 2.7 : .65);
        const vb = Math.sin(b * 8 - age * 15 + phase) * b * (flame ? 2.7 : .65);
        this.color(band === 2 ? style.light : style.color,
          (band === 0 ? 38 : band === 1 ? 94 : 205) * Math.pow(1 - a, 1.65));
        this.move(-tail - length * a, va + wa); this.line(-tail - length * b, vb + wb);
        this.line(-tail - length * b, vb - wb); this.line(-tail - length * a, va - wa);
        this.g.close(); this.g.fill();
      }
    }
  }

  private wind(body: number, length: number, age: number, phase: number, style: Style, heavy: boolean): void {
    const reveal = Math.min(1, age / .055);
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 7; k++) {
        const a = k / 7, b = (k + 1) / 7;
        const reach = body * .85 + length * .35;
        const va = side * (3 + Math.sin(a * Math.PI) * (heavy ? 7 : 5) + a * 2);
        const vb = side * (3 + Math.sin(b * Math.PI) * (heavy ? 7 : 5) + b * 2);
        this.color(style.light, 165 * Math.sin((a + .08) * Math.PI) * reveal);
        this.g.lineWidth = (heavy ? 1.45 : 1.15) * (1 - a * .65);
        this.move(body * .35 - a * reach, va); this.line(body * .35 - b * reach, vb); this.g.stroke();
      }
    }
    // Two tiny glints slip backwards along either side, without becoming extra projectile bodies.
    for (let k = 0; k < 2; k++) {
      const t = (age * 3.4 + phase + k * .5) % 1;
      const side = k === 0 ? -1 : 1;
      this.color(style.light, 180 * Math.sin(t * Math.PI) * reveal);
      this.diamond(body * (.25 - t * .65), side * (5 + t * 4), 3.2 * (1 - t * .5), 1.1);
    }
  }

  private embers(body: number, length: number, age: number, phase: number, style: Style): void {
    for (let k = 0; k < 5; k++) {
      const t = (age * 3.1 + phase + k * .21) % 1;
      const side = k % 2 ? -1 : 1;
      const u = -body * .15 - t * Math.min(65, length + 8), v = side * (4 + t * (5 + k));
      this.color(k % 2 ? style.light : style.color, 220 * Math.sin(t * Math.PI));
      this.diamond(u, v, 3.7 * (1 - t * .6), 1.6 * (1 - t * .4));
    }
  }

  private electric(size: number, age: number, phase: number, style: Style): void {
    const pulse = Math.floor(age * 24);
    for (let side = -1; side <= 1; side += 2) {
      for (let band = 0; band < 2; band++) {
        this.color(band ? style.light : style.color, band ? 215 : 120);
        this.g.lineWidth = band ? .85 : 2.8;
        this.move(size * .7, side * size * .6);
        for (let k = 1; k <= 5; k++) {
          const u = size * .7 - k * (3.7 + size * .18);
          const v = side * (size + Math.sin(phase + pulse * 1.7 + k * 2.4) * 3 + k * .7);
          this.line(u, v);
        }
        this.g.stroke();
      }
    }
  }

  private ice(body: number, length: number, age: number, phase: number, style: Style): void {
    for (let k = 0; k < 4; k++) {
      const t = (age * 2.5 + phase + k * .26) % 1;
      const side = k % 2 ? -1 : 1;
      const u = body * .2 - t * Math.min(60, length + 16), v = side * (5 + t * (6 + k));
      const alpha = Math.sin(t * Math.PI);
      this.color(style.color, 190 * alpha);
      this.diamond(u, v, 4.6 * (1 - t * .4), 2.2 * (1 - t * .3));
      this.color(style.light, 240 * alpha);
      this.move(u + 4.6 * (1 - t * .4), v); this.line(u, v + 2.2 * (1 - t * .3));
      this.line(u - 3, v); this.g.close(); this.g.fill();
    }
  }
}
