/** Painted-shape VFX only: no damage, timers outside the battle clock or asset downloads. */
import { Color, Graphics, Node } from 'cc';
import { C, N } from '../ui/UIKit';

const TAU = Math.PI * 2;
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const ease = (v: number): number => 1 - (1 - clamp(v)) ** 3;
const paint = {
  soot: C('#302A30'), smoke: C('#675C61'), smokeLight: C('#A99A91'), dust: C('#C8AA79'),
  rust: C('#B74D28'), orange: C('#EF782E'), gold: C('#FFC35E'), hot: C('#FFF1B8'),
  wine: C('#482239'), rose: C('#C83F7B'), pink: C('#F47BAA'), pearl: C('#FFE1EE'),
  steel: C('#3E4650'), steelLight: C('#93A6B0'), brass: C('#D5A641'),
};
// Graphics copies assigned colors; reuse palette objects instead of allocating colors per path.
function fill(g: Graphics, color: Color, alpha = 1): void {
  color.a = Math.round(255 * clamp(alpha)); g.fillColor = color;
}
function stroke(g: Graphics, color: Color, width: number, alpha = 1): void {
  color.a = Math.round(255 * clamp(alpha)); g.strokeColor = color; g.lineWidth = width;
}
function ellipse(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry); g.fill();
}
function arc(g: Graphics, x: number, y: number, rx: number, ry: number, start: number, span: number): void {
  const steps = Math.max(6, Math.ceil(Math.abs(span) * 4));
  for (let i = 0; i <= steps; i++) {
    const a = start + span * i / steps, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.stroke();
}
const rays = Array.from({ length: 9 }, (_, i) => {
  const a = i * TAU / 9 + .17;
  return { x: Math.cos(a), y: Math.sin(a), speed: .66 + (i * 7 % 5) * .085 };
});
const clouds = Array.from({ length: 9 }, (_, phase) => Array.from({ length: 24 }, (_, i) => {
  const a = i * TAU / 24, r = 1 + .14 * Math.sin(a * 5 + phase) + .07 * Math.cos(a * 9 - phase);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}));
function cloud(g: Graphics, x: number, y: number, rx: number, ry: number, variant: number): void {
  const points = clouds[variant], first = points[0], last = points[points.length - 1];
  g.moveTo(x + (last.x + first.x) * .5 * rx, y + (last.y + first.y) * .5 * ry);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], next = points[(i + 1) % points.length];
    g.quadraticCurveTo(x + p.x * rx, y + p.y * ry, x + (p.x + next.x) * .5 * rx, y + (p.y + next.y) * .5 * ry);
  }
  g.close(); g.fill();
}
interface Blast {
  x: number; y: number; radius: number; age: number; life: number; variant: number;
  kind: 'normal' | 'skill' | 'ult' | 'echo';
}
interface Landing { x: number; y: number; age: number; life: number; id: number; }

/** Shared projectile batch, with its actual velocity and recorded trail; no extra missile sprites. */
export function drawCannonMissile(g: Graphics, x: number, y: number, vx: number, vy: number,
  size: number, age: number, seed: number, trail: readonly number[] = []): void {
  const len = Math.hypot(vx, vy) || 1, dx = vx / len, dy = vy / len, nx = -dy, ny = dx;
  const length = size * 2.9, width = size * .53, tailX = x - dx * length * .5, tailY = y - dy * length * .5;
  // Smoky wake follows stored flight positions, rather than being a fixed vertical sticker.
  for (let i = 0; i < trail.length; i += 2) {
    const t = (i + 2) / trail.length, r = size * (1.15 - t * .45);
    fill(g, paint.smokeLight, .18 * t);
    ellipse(g, trail[i] - dx * length, trail[i + 1] - dy * length, r, r * .85);
  }
  const flame = size * (2.3 + .2 * Math.sin(age * 23 + seed * TAU));
  fill(g, paint.orange, .75);
  g.moveTo(tailX + nx * width * .9, tailY + ny * width * .9);
  g.lineTo(tailX - dx * flame, tailY - dy * flame);
  g.lineTo(tailX - nx * width * .9, tailY - ny * width * .9); g.close(); g.fill();
  fill(g, paint.hot, .95);
  g.moveTo(tailX + nx * width * .45, tailY + ny * width * .45);
  g.lineTo(tailX - dx * flame * .7, tailY - dy * flame * .7);
  g.lineTo(tailX - nx * width * .45, tailY - ny * width * .45); g.close(); g.fill();
  // Gunmetal fins, brass nose and one clean highlight match the engineer's fantasy machinery.
  fill(g, paint.steel); stroke(g, paint.soot, 1.8);
  for (const side of [-1, 1]) {
    g.moveTo(x - dx * length * .12 + nx * width * side, y - dy * length * .12 + ny * width * side);
    g.lineTo(tailX - dx * 4 + nx * width * 1.9 * side, tailY - dy * 4 + ny * width * 1.9 * side);
    g.lineTo(tailX + nx * width * .6 * side, tailY + ny * width * .6 * side); g.close(); g.fill(); g.stroke();
  }
  fill(g, paint.steel); stroke(g, paint.soot, 2);
  g.moveTo(x + dx * length * .6, y + dy * length * .6);
  g.lineTo(x + dx * length * .18 + nx * width, y + dy * length * .18 + ny * width);
  g.lineTo(tailX + nx * width * .78, tailY + ny * width * .78);
  g.lineTo(tailX - nx * width * .78, tailY - ny * width * .78);
  g.lineTo(x + dx * length * .18 - nx * width, y + dy * length * .18 - ny * width); g.close(); g.fill(); g.stroke();
  fill(g, paint.brass);
  g.moveTo(x + dx * length * .6, y + dy * length * .6);
  g.lineTo(x + dx * length * .18 + nx * width * .9, y + dy * length * .18 + ny * width * .9);
  g.lineTo(x + dx * length * .18 - nx * width * .9, y + dy * length * .18 - ny * width * .9); g.close(); g.fill();
  stroke(g, paint.gold, 3.2);
  g.moveTo(x + nx * width * .92, y + ny * width * .92); g.lineTo(x - nx * width * .92, y - ny * width * .92); g.stroke();
  stroke(g, paint.steelLight, 1.5, .95);
  g.moveTo(tailX + dx * 3 + nx * width * .36, tailY + dy * 3 + ny * width * .36);
  g.lineTo(x + dx * length * .16 + nx * width * .5, y + dy * length * .16 + ny * width * .5); g.stroke();
}

export class CannonBlastVFX {
  private ground: Graphics;
  private air: Graphics;
  private slots: Blast[] = [];
  private cursor = 0;
  private serial = 0;
  private dirty = false;
  private landings: Landing[] = [];
  private landingCursor = 0;
  private landingSerial = 0;
  constructor(field: Node) {
    this.ground = N('cannonBlastGround', field.getChildByName('GroundFxLayer')).addComponent(Graphics);
    this.air = N('cannonBlastAir', field.getChildByName('FxLayer')).addComponent(Graphics);
  }
  burst(x: number, y: number, radius: number, kind: Blast['kind']): void {
    const index = this.cursor++ % 16;
    const b = this.slots[index] || (this.slots[index] = {} as Blast);
    b.x = x; b.y = y; b.radius = radius; b.age = 0; b.kind = kind;
    b.life = kind === 'ult' ? .86 : kind === 'echo' ? .6 : .74;
    b.variant = this.serial++ % 9; // Visual variation never consumes the combat random stream.
    this.dirty = true;
  }
  tick(dt: number): void {
    for (const b of this.slots) if (b.age < b.life) { b.age += dt; this.dirty = true; }
    for (const m of this.landings) if (m.age < m.life) { m.age += dt; this.dirty = true; }
  }
  target(x: number, y: number, seconds: number): number {
    const index = this.landingCursor++ % 16;
    const m = this.landings[index] || (this.landings[index] = {} as Landing);
    m.x = x; m.y = y; m.age = 0; m.life = seconds + .08; m.id = ++this.landingSerial;
    this.dirty = true;
    return m.id;
  }
  landed(id: number): void {
    const m = this.landings.find(m => m.id === id);
    if (m) { m.age = m.life; this.dirty = true; }
  }
  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const ground = this.ground, g = this.air;
    ground.clear(); g.clear();
    for (const m of this.landings) {
      if (m.age >= m.life) continue;
      const p = clamp(m.age / m.life), r = 32 - p * 9;
      stroke(ground, paint.soot, 3, .55);
      arc(ground, m.x, m.y, r, r * .46, .2, Math.PI * .7);
      arc(ground, m.x, m.y, r, r * .46, Math.PI + .2, Math.PI * .7);
      stroke(ground, paint.gold, 1.4, .8);
      arc(ground, m.x, m.y, r, r * .46, .2, Math.PI * .7);
      arc(ground, m.x, m.y, r, r * .46, Math.PI + .2, Math.PI * .7);
      ground.moveTo(m.x - 5, m.y); ground.lineTo(m.x + 5, m.y);
      ground.moveTo(m.x, m.y - 4); ground.lineTo(m.x, m.y + 4); ground.stroke();
    }
    // Old smoke is behind fresh impacts; simultaneous barrage shells retain their own timing.
    for (let j = 0; j < this.slots.length; j++) {
      const b = this.slots[(this.cursor + j) % this.slots.length];
      if (b.age >= b.life) continue;
      const age = b.age, p = age / b.life, r = Math.min(190, b.radius), fade = 1 - p;
      const scale = b.kind === 'echo' ? .8 : b.kind === 'ult' ? 1.12 : 1;
      const spread = ease(age / .32), ring = r * (.14 + spread * .88);
      // Low, transparent scorch and dust stay underneath enemies, never as an opaque decal.
      fill(ground, paint.soot, .22 * fade);
      ellipse(ground, b.x, b.y - 3, r * .53 * Math.min(1, age / .06), r * .23 * Math.min(1, age / .06));
      stroke(ground, paint.dust, 6 * fade + 1, .5 * fade);
      arc(ground, b.x, b.y, ring, ring * .46, .12, TAU * .92);
      stroke(ground, paint.gold, 2.5, .7 * (1 - clamp(age / .3)));
      arc(ground, b.x, b.y + 1, ring * .84, ring * .38, .4, TAU * .87);
      for (let k = 0; k < 5; k++) {
        const a = (k + b.variant * .13) * TAU / 5, d = r * spread;
        fill(ground, paint.dust, .21 * Math.sin(Math.PI * p));
        ellipse(ground, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * .43,
          r * (.12 + p * .12), r * (.05 + p * .05));
      }
      // Soot curls rise only after the bright blast. Keep their coverage well inside the hit radius.
      if (age > .1) {
        const q = clamp((age - .1) / (b.life - .1)), smokeFade = Math.sin(Math.PI * q) * .5;
        for (let k = 0; k < 4; k++) {
          const side = (k - 1.5) / 1.5, size = r * (.12 + q * .12) * (k % 2 ? 1 : .83);
          const x = b.x + side * r * (.12 + q * .15), y = b.y + r * (.12 + q * .48) - Math.abs(side) * r * .09;
          fill(g, paint.soot, smokeFade); ellipse(g, x, y, size, size * .85);
          fill(g, paint.smoke, smokeFade * .85); ellipse(g, x - size * .16, y + size * .18, size * .8, size * .69);
          fill(g, paint.smokeLight, smokeFade * .4); ellipse(g, x - size * .26, y + size * .35, size * .42, size * .32);
        }
      }
      const fire = 1 - clamp(age / (b.kind === 'ult' ? .4 : .32));
      if (fire > 0) {
        const grow = ease(age / .065), size = r * .34 * grow * scale * (.5 + fire * .5);
        // One irregular silhouette with broad color planes, rather than stacked concentric disks.
        const cy = b.y + size * .45 + age * 25;
        fill(g, paint.rust, fire * .95); cloud(g, b.x, cy, size * 1.65, size * 1.35, b.variant);
        fill(g, paint.orange, fire); cloud(g, b.x - size * .06, cy + size * .1, size * 1.45, size * 1.17, b.variant);
        fill(g, paint.gold, fire); cloud(g, b.x, cy - size * .16, size * 1.05, size * .9, (b.variant + 3) % 9);
        fill(g, paint.hot, fire * fire);
        ellipse(g, b.x, b.y + size * .3, size * .5, size * .43);
      }
      // Short contact flash, never a screen flash or a lingering white disk.
      if (age < .09) {
        const flash = 1 - age / .09;
        stroke(g, paint.hot, 3.5 * flash + .5, flash);
        g.moveTo(b.x - r * .4 * flash, b.y + 6); g.lineTo(b.x + r * .4 * flash, b.y + 6);
        g.moveTo(b.x, b.y - r * .2 * flash); g.lineTo(b.x, b.y + r * .55 * flash); g.stroke();
      }
      // Warm streaks become dark tumbling fragments on ballistic arcs, with low ground shadows.
      for (let k = 0; k < rays.length; k++) {
        const ray = rays[(k + b.variant) % rays.length], t = clamp(age / .57);
        if (t >= 1) continue;
        const d = r * ray.speed * ease(t), z = Math.max(0, r * (1.4 * t - 1.65 * t * t));
        const x = b.x + ray.x * d, gy = b.y + ray.y * d * .47, y = gy + z;
        const size = (b.kind === 'ult' ? 3.8 : 2.7) * (1 - t * .7);
        fill(ground, paint.soot, .19 * (1 - t)); ellipse(ground, x, gy, size * 1.4, size * .5);
        if (age < .24) {
          stroke(g, paint.gold, size * .65, (1 - age / .24) * .9);
          g.moveTo(x - ray.x * 11 * (1 - t), y - (ray.y * .5 + .7) * 9 * (1 - t));
          g.lineTo(x, y); g.stroke();
        }
        fill(g, age < .2 ? paint.hot : paint.soot, 1 - t);
        g.moveTo(x - size, y); g.lineTo(x + ray.x * size, y + size * 1.4);
        g.lineTo(x + size, y - size * .6); g.close(); g.fill();
      }
    }
  }
}

interface DrainPulse { x: number; y: number; age: number; born: number; lifeId: number; heavy: boolean; }
export class SiphonBeamVFX {
  private g: Graphics;
  private pulses: DrainPulse[] = [];
  private cursor = 0;
  private clock = 0;
  private healAge = 1;
  private sx = 0;
  private sy = 0;
  private heavy = false;
  private beamCount = 0;
  private px = new Float32Array(25);
  private py = new Float32Array(25);
  constructor(field: Node) { this.g = N('lifeSiphonRibbons', field.getChildByName('FxLayer')).addComponent(Graphics); }
  tick(dt: number): void {
    this.clock += dt; this.healAge += dt;
    for (const pulse of this.pulses) pulse.age += dt;
  }
  hit(x: number, y: number, lifeId: number, heavy: boolean): void {
    // Skill, ultimate and normal channels can damage the same enemy in one tick: one visual packet.
    for (const p of this.pulses) if (p.lifeId === lifeId && p.born === this.clock) { p.heavy ||= heavy; return; }
    const index = this.cursor++ % 48;
    const p = this.pulses[index] || (this.pulses[index] = {} as DrainPulse);
    p.x = x; p.y = y; p.lifeId = lifeId; p.age = 0; p.born = this.clock; p.heavy = heavy;
  }
  healed(): void { this.healAge = 0; }
  begin(sx: number, sy: number, heavy: boolean): void {
    this.g.clear(); this.sx = sx; this.sy = sy; this.heavy = heavy; this.beamCount = 0;
  }
  beam(tx: number, ty: number, strength: number, phase: number): void {
    const g = this.g, dx = tx - this.sx, dy = ty - this.sy, len = Math.hypot(dx, dy);
    if (len < 1) return;
    this.beamCount++;
    const nx = -dy / len, ny = dx / len, bend = Math.min(20, len * .035) * Math.sin(phase * 1.7 + .6);
    const amplitude = (this.heavy ? 5 : 3.5) * strength, segments = Math.min(24, Math.max(10, Math.ceil(len / 42)));
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, envelope = Math.sin(Math.PI * t);
      const offset = envelope * (bend + Math.sin(t * 12 - this.clock * 5 + phase) * amplitude);
      this.px[i] = this.sx + dx * t + nx * offset; this.py[i] = this.sy + dy * t + ny * offset;
    }
    // Restrained wine silhouette, translucent rose ribbon and a fine luminous core.
    for (let layer = 0; layer < 4; layer++) {
      stroke(g, layer === 0 ? paint.rose : layer === 1 ? paint.wine : layer === 2 ? paint.pink : paint.pearl,
        (layer === 0 ? 15 : layer === 1 ? 7.5 : layer === 2 ? 4.1 : 1.15) * strength,
        layer === 0 ? .1 : layer === 1 ? .7 : layer === 2 ? .8 : .9);
      g.moveTo(this.px[0], this.py[0]);
      for (let i = 1; i <= segments; i++) g.lineTo(this.px[i], this.py[i]);
      g.stroke();
    }
    // A second helix wraps the core; this is smooth travel, never random frame-to-frame flicker.
    stroke(g, paint.rose, 1.5 * strength, .75);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, offset = Math.sin(t * 20 + this.clock * 4.5 + phase) * Math.sin(t * Math.PI) * 5 * strength;
      const x = this.px[i] + nx * offset, y = this.py[i] + ny * offset;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    // Small travelling highlights flow toward the caster and stay on the actual ribbon curve.
    fill(g, paint.pearl, .85);
    for (let k = 0; k < 3; k++) {
      const t = 1 - (this.clock * .72 + phase * .09 + k / 3) % 1, f = t * segments, i = Math.min(segments - 1, Math.floor(f));
      const x = this.px[i] + (this.px[i + 1] - this.px[i]) * (f - i), y = this.py[i] + (this.py[i + 1] - this.py[i]) * (f - i);
      ellipse(g, x, y, 1.7 * strength, 1.7 * strength);
    }
    // Open sigil arcs frame the contact point without hiding the target's face/body.
    const radius = (this.heavy ? 15 : 11) * Math.sqrt(strength), rotation = this.clock * .8 + phase;
    stroke(g, paint.wine, 3, .75);
    arc(g, tx, ty, radius, radius * .75, rotation, Math.PI * .72);
    arc(g, tx, ty, radius, radius * .75, rotation + Math.PI, Math.PI * .72);
    stroke(g, paint.pink, 1.3, .85);
    arc(g, tx, ty, radius, radius * .75, rotation, Math.PI * .68);
    arc(g, tx, ty, radius, radius * .75, rotation + Math.PI, Math.PI * .68);
  }
  end(): void {
    const g = this.g;
    let returning = false;
    for (const p of this.pulses) {
      if (p.age > .62) continue;
      returning = true;
      if (p.age < .18) {
        const q = p.age / .18, r = (p.heavy ? 18 : 13) * (.65 + q * .45);
        stroke(g, paint.pearl, 1.5, (1 - q) * .8);
        arc(g, p.x, p.y, r, r * .7, p.lifeId % 6, Math.PI * 1.2);
        fill(g, paint.pink, (1 - q) * .25); ellipse(g, p.x, p.y, r * .5, r * .4);
      }
      // The larger teardrop is born only on real damage, including the final lethal tick.
      const t = ease(p.age / .62), dx = this.sx - p.x, dy = this.sy - p.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, bow = Math.sin(t * Math.PI) * 14 * (p.lifeId % 2 ? 1 : -1);
      const x = p.x + dx * t + nx * bow, y = p.y + dy * t + ny * bow, alpha = Math.sin(Math.PI * clamp(p.age / .62));
      const size = p.heavy ? 3.4 : 2.6;
      fill(g, paint.rose, alpha * .2); ellipse(g, x, y, size * 2.7, size * 2.7);
      fill(g, paint.pearl, alpha * .95);
      g.moveTo(x + dx / len * size * 2, y + dy / len * size * 2);
      g.lineTo(x + nx * size, y + ny * size); g.lineTo(x - dx / len * size, y - dy / len * size);
      g.lineTo(x - nx * size, y - ny * size); g.close(); g.fill();
    }
    if (this.beamCount || returning) {
      const x = this.sx, y = this.sy, breathe = .9 + .1 * Math.sin(this.clock * 3), r = (this.heavy ? 22 : 16) * breathe;
      fill(g, paint.rose, .13); ellipse(g, x, y, r * 1.35, r * 1.2);
      stroke(g, paint.wine, 3.5, .85); arc(g, x, y, r, r * .7, this.clock, TAU * .85);
      stroke(g, paint.pink, 1.6, .85); arc(g, x, y, r, r * .7, this.clock, TAU * .85);
      fill(g, paint.pearl, .9); ellipse(g, x, y, 3.3, 4);
      // A small settling bloom confirms actual recovery, not hypothetical over-healing.
      if (this.healAge < .24) {
        const q = this.healAge / .24;
        stroke(g, paint.pearl, 1.5, (1 - q) * .65);
        arc(g, x, y - 3, r * (.6 + q * .6), r * (.35 + q * .3), 0, TAU);
      }
    }
  }
}
