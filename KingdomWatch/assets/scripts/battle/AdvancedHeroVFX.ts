/** Cosmetic bomb fragmentation and flowing extraction. No gameplay state is changed here. */
import { Color, Graphics, Node } from 'cc';
import { N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';

const TAU = Math.PI * 2, CAP = 16, PIECES = 30;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const rand = (seed: number): number => { const n = Math.sin(seed * 127.1 + 17.7) * 43758.5453; return n - Math.floor(n); };
const tint = new Color();
function ink(g: Graphics, r: number, green: number, b: number, alpha: number, width = 1): void {
  tint.set(r, green, b, Math.round(255 * clamp(alpha))); g.fillColor = tint; g.strokeColor = tint; g.lineWidth = width;
}
function oval(g: Graphics, x: number, y: number, rx: number, ry: number): void { g.ellipse(x, y, rx, ry); g.fill(); }
function line(g: Graphics, x: number, y: number, tx: number, ty: number): void { g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); }
interface Piece {
  vx: number; vy: number; lift: number; gravity: number; size: number; angle: number; spin: number;
  shade: number; shape: number; land: number;
}
interface Blast {
  x: number; y: number; radius: number; age: number; life: number; seed: number; power: number;
  count: number; pieces: Piece[]; shader: boolean;
}
interface Landing { x: number; y: number; age: number; life: number; id: number; }

export class CannonBlastVFX {
  private ground: Graphics;
  private air: Graphics;
  private fire: HeroFxShader;
  private floor: HeroFxShader;
  private slots: Blast[] = [];
  private landings: Landing[] = [];
  private cursor = 0;
  private sequence = 0;
  private landingCursor = 0;
  private landingSerial = 0;
  private dirty = false;
  constructor(field: Node) {
    const ground = field.getChildByName('GroundFxLayer')!, air = field.getChildByName('FxLayer')!;
    this.floor = new HeroFxShader(ground, 'bombPressureHeat', CAP);
    this.ground = N('bombDebrisShadows', ground).addComponent(Graphics);
    this.fire = new HeroFxShader(air, 'bombTurbulentFlame', CAP);
    this.air = N('bombFlyingShrapnel', air).addComponent(Graphics);
  }
  burst(x: number, y: number, radius: number, kind: 'normal' | 'skill' | 'ult' | 'echo'): void {
    const index = this.cursor++ % CAP;
    const b = this.slots[index] || (this.slots[index] = { pieces: Array.from({ length: PIECES }, () => ({} as Piece)) } as Blast);
    b.x = x; b.y = y; b.radius = Math.min(190, radius); b.age = 0; b.seed = ++this.sequence;
    b.power = kind === 'echo' ? .76 : kind === 'ult' ? 1.15 : 1;
    b.life = kind === 'ult' ? 1.42 : kind === 'echo' ? .94 : 1.22;
    b.count = kind === 'ult' ? 30 : kind === 'echo' ? 14 : 22;
    // Never replace a visible event's rendering mode when an asynchronous shader finishes loading.
    b.shader = this.fire.ready && this.floor.ready;
    for (let k = 0; k < b.count; k++) {
      const p = b.pieces[k], seed = b.seed * 47 + k * 13.7;
      const angle = k * 2.399963 + rand(seed) * .9, speed = b.radius * (1.0 + rand(seed + 1) * 1.9);
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed * .44;
      p.lift = b.radius * (.85 + rand(seed + 2) * 1.3); p.gravity = 760 + rand(seed + 3) * 310;
      p.land = 2 * p.lift / p.gravity;
      p.size = k < 8 ? (4.3 + rand(seed + 4) * 5.2) * b.power : 1.0 + rand(seed + 4) * 1.8;
      p.angle = rand(seed + 5) * TAU; p.spin = (rand(seed + 6) - .5) * 15;
      p.shade = rand(seed + 7); p.shape = .45 + rand(seed + 8) * .55;
    }
    this.dirty = true;
  }
  target(x: number, y: number, seconds: number): number {
    const index = this.landingCursor++ % CAP;
    const m = this.landings[index] || (this.landings[index] = {} as Landing);
    m.x = x; m.y = y; m.age = 0; m.life = seconds + .08; m.id = ++this.landingSerial;
    this.dirty = true; return m.id;
  }
  landed(id: number): void {
    const m = this.landings.find(m => m.id === id);
    if (m) { m.age = m.life; this.dirty = true; }
  }
  tick(dt: number): void {
    for (const b of this.slots) if (b.age < b.life) { b.age += dt; this.dirty = true; }
    for (const m of this.landings) if (m.age < m.life) { m.age += dt; this.dirty = true; }
  }
  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.ground.clear(); this.air.clear(); this.floor.begin(); this.fire.begin();
    this.drawLandings();
    for (let j = 0; j < this.slots.length; j++) {
      const b = this.slots[(this.cursor + j) % this.slots.length];
      if (b.age >= b.life) continue;
      const r = b.radius;
      if (b.shader) {
        this.floor.draw(b.x, b.y, r * 2.7, r * 1.35, 0, b.age, b.seed, b.power, 1, r);
        this.fire.draw(b.x, b.y + r * .38, r * 2.65, r * 2.7, 0, b.age, b.seed, b.power, 0, r, r * .38);
      } else this.fallback(b);
      this.fragments(b);
    }
    this.floor.end(); this.fire.end();
  }
  private drawLandings(): void {
    const g = this.ground;
    for (const m of this.landings) {
      if (m.age >= m.life) continue;
      const r = 30 - clamp(m.age / m.life) * 8;
      ink(g, 248, 192, 93, .72, 1.4);
      for (let k = 0; k < 4; k++) {
        const a = k * TAU / 4 + .2;
        g.moveTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r * .45);
        for (let i = 1; i <= 6; i++) g.lineTo(m.x + Math.cos(a + i * .14) * r, m.y + Math.sin(a + i * .14) * r * .45);
        g.stroke();
      }
      line(g, m.x - 4, m.y, m.x + 4, m.y); line(g, m.x, m.y - 3, m.x, m.y + 3);
    }
  }
  private fragments(b: Blast): void {
    const g = this.air, ground = this.ground, age = b.age;
    for (let k = 0; k < b.count; k++) {
      const p = b.pieces[k], after = Math.max(0, age - p.land);
      // Exact first landing, then a smaller ballistic bounce. No frame-rate-dependent Euler drift.
      const bounce = p.lift * .24, bounceLife = 2 * bounce / p.gravity;
      const z = age < p.land ? p.lift * age - .5 * p.gravity * age * age
        : after < bounceLife ? bounce * after - .5 * p.gravity * after * after : 0;
      const travel = age <= p.land ? (1 - Math.exp(-age * 1.4)) / 1.4
        : (1 - Math.exp(-p.land * 1.4)) / 1.4 + Math.exp(-p.land * 1.4) * .4 * (1 - Math.exp(-after * 5)) / 5;
      const x = b.x + p.vx * travel, gy = b.y + p.vy * travel, y = gy + Math.max(0, z);
      const fade = 1 - clamp((age - b.life * .63) / (b.life * .37));
      const turningAge = Math.min(age, p.land + bounceLife);
      const a = p.angle + p.spin * turningAge, c = Math.cos(a), s = Math.sin(a);
      const size = p.size, side = size * (.25 + Math.abs(Math.cos(turningAge * 10 + k)) * .5) * p.shape;
      ink(ground, 35, 27, 24, .27 * fade / (1 + z * .014)); oval(ground, x, gy - 2, size * 1.3, size * .38);
      // A short incandescent wake changes to dark metal; the pieces remain readable after the flash.
      const hot = clamp(1 - age / (.18 + p.shade * .24));
      if (hot > 0 && k < 17) {
        const tail = .025 * (1 - Math.exp(-age * 50));
        const tx = x - p.vx * tail, ty = y - (p.vy + p.lift - p.gravity * age) * tail;
        ink(g, 255, 117, 33, hot * .24, size * 3); line(g, tx, ty, x, y);
        ink(g, 255, 202, 99, hot * .85, Math.max(.8, size * .6)); line(g, tx, ty, x, y);
      }
      if (k < 8) {
        ink(g, 48 + p.shade * 20, 43 + p.shade * 15, 41 + p.shade * 12, fade);
        g.moveTo(x + c * size, y + s * size);
        g.lineTo(x - s * side, y + c * side);
        g.lineTo(x - c * size * .8 - s * side * .3, y - s * size * .8 + c * side * .3);
        g.lineTo(x + s * side * .7, y - c * side * .7); g.close(); g.fill();
        ink(g, 121 + hot * 100, 104 + hot * 75, 85 + hot * 30, fade * .95);
        g.moveTo(x + c * size, y + s * size); g.lineTo(x - s * side, y + c * side);
        g.lineTo(x - c * size * .35, y - s * size * .35); g.close(); g.fill();
        ink(g, 255, 210, 111, hot * .95, 1); line(g, x + c * size, y + s * size, x - s * side, y + c * side);
      } else {
        ink(g, 247, 147 + hot * 75, 52 + hot * 80, fade * (.45 + hot * .5));
        g.moveTo(x + c * size * 1.7, y + s * size * 1.7);
        g.lineTo(x - s * size * .4, y + c * size * .4);
        g.lineTo(x - c * size, y - s * size); g.close(); g.fill();
      }
      if (after > 0 && after < .065 && k < 8) {
        ink(g, 255, 203, 100, (1 - after / .065) * .7, 1.2);
        line(g, x - 3, gy, x + 3, gy + 4);
      }
    }
  }
  private fallback(b: Blast): void {
    const g = this.air, t = clamp(b.age / .42), fade = 1 - t;
    if (!fade) return;
    ink(g, 233, 95, 28, fade * .8); oval(g, b.x, b.y + 10, b.radius * .34, b.radius * .3);
    ink(g, 255, 213, 110, fade); oval(g, b.x, b.y + 8, b.radius * .21 * fade, b.radius * .22 * fade);
  }
}

interface DrainPulse { x: number; y: number; age: number; born: number; lifeId: number; heavy: boolean; }
export class SiphonBeamVFX {
  private g: Graphics;
  private ribbons: HeroFxShader;
  private pulses: DrainPulse[] = [];
  private cursor = 0;
  private clock = 0;
  private healAge = 1;
  private sx = 0;
  private sy = 0;
  private heavy = false;
  constructor(field: Node) {
    const parent = field.getChildByName('FxLayer')!;
    this.ribbons = new HeroFxShader(parent, 'siphonVoidStreams', 16);
    this.g = N('siphonExtractedEssence', parent).addComponent(Graphics);
  }
  tick(dt: number): void {
    this.clock += dt; this.healAge += dt;
    for (const p of this.pulses) p.age += dt;
  }
  hit(x: number, y: number, lifeId: number, heavy: boolean): void {
    for (const p of this.pulses) if (p.lifeId === lifeId && p.born === this.clock) { p.heavy ||= heavy; return; }
    const index = this.cursor++ % 48;
    const p = this.pulses[index] || (this.pulses[index] = {} as DrainPulse);
    p.x = x; p.y = y; p.lifeId = lifeId; p.age = 0; p.born = this.clock; p.heavy = heavy;
  }
  healed(): void { this.healAge = 0; }
  begin(sx: number, sy: number, heavy: boolean): void {
    this.g.clear(); this.ribbons.begin(); this.sx = sx; this.sy = sy; this.heavy = heavy;
  }
  beam(tx: number, ty: number, strength: number, phase: number): void {
    const dx = tx - this.sx, dy = ty - this.sy, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const power = strength * (this.heavy ? 1.2 : 1);
    if (this.ribbons.draw((this.sx + tx) * .5, (this.sy + ty) * .5, len + 72, this.heavy ? 106 : 88,
      Math.atan2(dy, dx) * 180 / Math.PI, this.clock, phase, power, 2, len)) return;
    // Error-only fallback: a stable curved channel, never an untextured white rectangle.
    const g = this.g, nx = -dy / len, ny = dx / len;
    for (let layer = 0; layer < 3; layer++) {
      ink(g, layer === 2 ? 235 : 115, layer === 2 ? 177 : 41, layer === 2 ? 255 : 180,
        layer === 0 ? .16 : .8, (layer === 0 ? 13 : layer === 1 ? 4 : 1) * power);
      g.moveTo(this.sx, this.sy);
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, offset = Math.sin(t * Math.PI) * Math.sin(t * 9 + this.clock * 3 + phase) * 7;
        g.lineTo(this.sx + dx * t + nx * offset, this.sy + dy * t + ny * offset);
      }
      g.stroke();
    }
  }
  end(): void {
    this.ribbons.end();
    const g = this.g;
    for (const p of this.pulses) {
      if (p.age >= .58) continue;
      const q = clamp(p.age / .58), t = q * (.65 + .35 * q), dx = this.sx - p.x, dy = this.sy - p.y;
      const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const bend = Math.sin(t * Math.PI) * Math.sin(t * 7 - this.clock * 3 + p.lifeId) * 11;
      const x = p.x + dx * t + nx * bend, y = p.y + dy * t + ny * bend;
      const fade = Math.sin(q * Math.PI), size = p.heavy ? 4 : 2.8;
      // Stretched essence and its translucent wake travel enemy -> raised palm.
      for (let layer = 0; layer < 3; layer++) {
        ink(g, layer === 2 ? 244 : 145, layer === 2 ? 197 : 55, 255,
          fade * (layer === 0 ? .12 : layer === 1 ? .5 : .85), size * (layer === 0 ? 4 : layer === 1 ? 1.6 : .45));
        line(g, x - dx / len * (p.heavy ? 13 : 9), y - dy / len * (p.heavy ? 13 : 9), x, y);
      }
      if (p.age < .24) {
        const progress = p.age / .24;
        for (let k = 0; k < 4; k++) {
          const a = k * TAU / 4 + p.lifeId + progress * 1.6, r = (1 - progress) * (p.heavy ? 22 : 16);
          ink(g, 183, 91, 242, (1 - progress) * .65, 1.3);
          g.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .8);
          g.quadraticCurveTo(p.x + Math.cos(a + .65) * r * .8, p.y + Math.sin(a + .65) * r * .6,
            p.x + Math.cos(a + 1) * r * .35, p.y + Math.sin(a + 1) * r * .3); g.stroke();
        }
      }
    }
    if (this.healAge < .22) {
      const fade = 1 - this.healAge / .22;
      ink(g, 210, 135, 255, fade * .14); oval(g, this.sx, this.sy, 16, 13);
      ink(g, 255, 222, 255, fade * .8); oval(g, this.sx, this.sy, 2 + fade * 2, 2 + fade * 2);
    }
  }
}
