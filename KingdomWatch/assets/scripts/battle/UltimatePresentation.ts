/** Shared, bounded ultimate direction. All geometry follows the battle clock.
 * Local accents and world-only camera kick; scene brightness and HUD stay stable.
 */
import { Color, Graphics, Layers, Node } from 'cc';
import { HERO_Y, LO } from '../config/GameConfig';
import { UltimateBeat, UltimateCue } from './UltimateTiming';

interface Cast extends UltimateCue { age: number; }
interface Beat extends UltimateBeat { age: number; sx: number; sy: number; }
const TAU = Math.PI * 2;
const PALETTE: Record<string, readonly number[]> = {
  scythe: [255,110,56],
  arcane: [105,191,255],
  lance: [255,211,79],
  space: [187,99,216], sword: [99,210,164],
  wind: [105, 227, 205], ninja: [116, 177, 236],
  cannon: [235, 189, 80], siphon: [240, 108, 155],
  archer: [189, 230, 117], sniper: [72, 170, 255], pyro: [255, 154, 55],
  volt: [191, 121, 255], mora: [147, 224, 246],
};
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
function smooth(a: number, b: number, n: number): number {
  const p = clamp((n - a) / (b - a)); return p * p * (3 - 2 * p);
}

export class UltimatePresentation {
  private air: Graphics;
  private floor: Graphics;
  private casts: Cast[] = [];
  private beats: Beat[] = [];
  private tint = new Color();
  private shakeT = 0;
  private shakeAmp = 0;
  private shakeCd = 0;
  private painted = false;

  constructor(private field: Node, airParent: Node, groundParent: Node) {
    this.floor = this.node('ultimateGroundAccents', groundParent).addComponent(Graphics);
    this.air = this.node('ultimateGatherAndAfterglow', airParent).addComponent(Graphics);
  }
  private node(name: string, parent: Node): Node {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.setParent(parent); return n;
  }
  get windupSpeedLimit(): number {
    let limit = Infinity;
    for (const c of this.casts) if (c.age < c.windup) limit = Math.min(limit, c.windup / .5);
    return limit;
  }
  get active(): boolean { return !!(this.casts.length || this.beats.length); }
  begin(cue: UltimateCue): void {
    const previous = this.casts.findIndex(c => c.hero === cue.hero);
    if (previous >= 0) this.casts.splice(previous, 1);
    this.casts.push({ ...cue, age: 0 });
    this.render();
  }
  beat(cue: UltimateBeat): void {
    if (!Number.isFinite(cue.x + cue.y + cue.energy)) return;
    const cast = this.casts.find(c => c.hero === cue.hero);
    // Decorative accents are capped separately from real gameplay projectiles.
    if (this.beats.length >= 18) this.beats.shift();
    this.beats.push({ ...cue, age: 0, sx: cast?.x ?? cue.x, sy: cast?.y ?? HERO_Y + 60 });
    if (cue.contact && cue.energy >= .85 && this.shakeCd <= 0) {
      this.shakeT = .14; this.shakeAmp = Math.min(3, cue.energy * 2.7); this.shakeCd = .6;
    }
    this.render();
  }
  tick(dt: number): void {
    this.shakeCd = Math.max(0, this.shakeCd - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT > 0) {
      const p = 1 - this.shakeT / .14, amp = this.shakeAmp * (1 - p) ** 2;
      this.field.setPosition(Math.sin(p * 22) * amp, Math.sin(p * 29 + .6) * amp * .55, 0);
    } else this.field.setPosition(0, 0, 0);
    for (let i = this.casts.length - 1; i >= 0; i--) {
      const c = this.casts[i]; c.age += dt;
      if (c.age >= c.duration) this.casts.splice(i, 1);
    }
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i]; b.age += dt;
      if (b.age >= .8) this.beats.splice(i, 1);
    }
    this.render();
  }
  suspend(): void { if (this.field.isValid) this.field.setPosition(0, 0, 0); }
  clear(): void {
    this.casts.length = this.beats.length = 0; this.shakeT = this.shakeCd = 0;
    this.suspend();
    for (const g of [this.air, this.floor]) if (g.isValid) g.clear();
    this.painted = false;
  }
  private ink(g: Graphics, hero: string, alpha: number, pale = false): void {
    const rgb = PALETTE[hero] || PALETTE.archer;
    this.tint.set(pale ? (rgb[0] + 255) / 2 : rgb[0], pale ? (rgb[1] + 255) / 2 : rgb[1],
      pale ? (rgb[2] + 255) / 2 : rgb[2], Math.round(Math.max(0, Math.min(255, alpha))));
    g.strokeColor = this.tint; g.fillColor = this.tint;
  }
  private render(): void {
    if (!this.casts.length && !this.beats.length && !this.painted) return;
    this.air.clear(); this.floor.clear();
    this.painted = !!(this.casts.length || this.beats.length);
    for (const c of this.casts) {
      if (c.age < c.windup + .4) this.gather(c);
    }
    for (const b of this.beats) this.afterglow(b);
  }
  private gather(c: Cast): void {
    const g = c.hero === 'lance' ? this.floor : this.air, p = clamp(c.age / c.windup);
    const light = smooth(0, .14, c.age) * (1 - smooth(c.windup, c.windup + .4, c.age));
    const x = c.x, y = c.y, span = 70 - p * 37;
    // Soft local core, with a readable outer colour and a small warm/cool inner point.
    for (let band = 3; band >= 0; band--) {
      this.ink(g, c.hero, (band === 0 ? 30 : 6) * light * (.35 + .65 * p), band === 0);
      g.ellipse(x, y, 6 + band * 6 + p * 3, 9 + band * 6 + p * 5); g.fill();
    }
    for (let k = 0; k < 9; k++) {
      const phase = (c.age * 1.25 + k / 9) % 1, a = k * TAU / 9 + phase * .7;
      const r = 10 + (1 - phase) * span, alpha = Math.sin(phase * Math.PI) * light;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * .72;
      this.ink(g, c.hero, alpha * 165, k % 3 === 0); g.lineWidth = 1.1;
      if (c.hero === 'volt') {
        g.moveTo(px, py); g.lineTo(px * .4 + x * .6 + 6, py * .4 + y * .6 - 5);
        g.lineTo(x, y); g.stroke();
      } else if (c.hero === 'mora') {
        const h = 3 + phase * 3;
        g.moveTo(px, py + h); g.lineTo(px + h * .4, py);
        g.lineTo(px, py - h); g.lineTo(px - h * .4, py); g.close(); g.fill();
      } else if (c.hero === 'pyro') {
        const lift = phase * 20;
        g.moveTo(px, py + lift); g.lineTo(px - 1.5, py + lift - 5); g.stroke();
        g.circle(px, py + lift, 1 + phase); g.fill();
      } else {
        g.moveTo(px, py);
        g.lineTo(x + Math.cos(a + .11) * (r + 9), y + Math.sin(a + .11) * (r + 9) * .72); g.stroke();
      }
    }
    if (c.hero === 'archer' || c.hero === 'sniper') {
      for (let k = 0; k < 3; k++) {
        const width = 48 - p * 20 + k * 6;
        this.ink(g, c.hero, light * (55 + 65 * p), k === 2); g.lineWidth = 1.2;
        g.moveTo(x - width, y - 13 - k * 4);
        g.bezierCurveTo(x - width * .5, y + 28, x + width * .5, y + 28, x + width, y - 13 - k * 4);
        g.stroke();
      }
    } else if (c.hero === 'volt') {
      // Short crawling cloud filaments; the screen-long channels belong to actual strikes.
      const top = LO.half - 150 - LO.notchTop;
      this.ink(g, c.hero, light * 90); g.lineWidth = .9;
      for (let k = 0; k < 3; k++) {
        const cx = (k - 1) * 190, cy = top - k % 2 * 22;
        g.moveTo(cx - 60, cy); g.lineTo(cx - 28, cy + 7); g.lineTo(cx - 8, cy - 3);
        g.lineTo(cx + 17, cy + 4); g.lineTo(cx + 62, cy - 7); g.stroke();
      }
    }
  }
  private afterglow(b: Beat): void {
    const g = b.contact ? this.floor : this.air, t = b.age / .8;
    const fade = (1 - smooth(.06, .8, b.age)) * Math.min(1, b.energy);
    if (b.hero === 'sniper' && b.contact) {
      const dx = b.x - b.sx, dy = b.y - b.sy, length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length, reach = Math.min(length, 230);
      for (let k = 0; k < 8; k++) {
        this.ink(this.air, b.hero, fade * 110 * (1 - k / 8)); this.air.lineWidth = 1.5 - k * .12;
        this.air.moveTo(b.x - ux * reach * k / 8, b.y - uy * reach * k / 8);
        this.air.lineTo(b.x - ux * reach * (k + 1) / 8, b.y - uy * reach * (k + 1) / 8); this.air.stroke();
      }
    }
    const count = b.hero === 'pyro' ? 12 : b.hero === 'archer' ? 7 : 6;
    for (let k = 0; k < count; k++) {
      const a = k * TAU / count + b.x * .013;
      const spread = (18 + k % 3 * 9) * (1 - (1 - t) ** 2);
      const hop = Math.sin(t * Math.PI) * (b.hero === 'pyro' ? 26 : 12);
      const x = b.x + Math.cos(a) * spread, y = b.y + Math.sin(a) * spread * .35 + hop;
      this.ink(g, b.hero, fade * 140, k % 3 === 0); g.lineWidth = .9;
      if (b.hero === 'archer' && !b.contact) {
        const side = (k - 3) / 3, reach = 24 + t * 82;
        g.moveTo(b.x + side * reach * .45, b.y + reach);
        g.lineTo(b.x + side * (reach + 16) * .45, b.y + reach + 16); g.stroke();
      } else {
        g.moveTo(x, y); g.lineTo(x - Math.cos(a) * (3 + fade * 3), y - 3 * fade); g.stroke();
      }
    }
    // Compact pressure arcs stay inside the real impact footprint.
    if (b.hero === 'pyro' && b.contact) {
      const r = 16 + (1 - (1 - t) ** 3) * 64;
      this.ink(g, b.hero, fade * 100); g.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) {
        for (let j = 0; j <= 12; j++) {
          const a = k * TAU / 3 + j / 12 * 1.4;
          const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r * .4;
          if (!j) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }
}
