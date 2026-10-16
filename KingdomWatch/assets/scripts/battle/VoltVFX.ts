/** Procedural lightning, in battlefield coordinates. Only the battle clock advances it.
 * Two shared render layers and a bounded data pool; no per-hit nodes or random gameplay calls.
 */
import { Color, Graphics, Layers, Node } from 'cc';

type Kind = 'release' | 'hit' | 'chain' | 'cast';
type RGB = readonly [number, number, number];
interface Flash {
  kind: Kind; age: number; life: number; seed: number;
  x: number; y: number; x1: number; y1: number; radius: number; strong: boolean;
}
const VIOLET: RGB = [161, 86, 255], BLUE: RGB = [101, 184, 255], HOT: RGB = [241, 231, 255];
const TAU = Math.PI * 2;
function noise(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export class VoltVFX {
  private air: Graphics;
  private flight: Graphics;
  private tint = new Color();
  private spine = new Float32Array(82);
  private twig = new Float32Array(82);
  private active: Flash[] = [];
  private free: Flash[] = [];
  private serial = 0;
  private dirty = false;

  constructor(parent: Node, projectileParent: Node) {
    this.flight = this.layer(projectileParent, 'voltElectricShots');
    this.air = this.layer(parent, 'voltLightning');
    for (let i = 0; i < 96; i++) this.free.push({
      kind: 'hit', age: 0, life: 1, seed: 0, x: 0, y: 0, x1: 0, y1: 0, radius: 0, strong: false,
    });
  }

  private layer(parent: Node, name: string): Graphics {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D; node.setParent(parent);
    return node.addComponent(Graphics);
  }

  private add(kind: Kind, x: number, y: number, x1: number, y1: number,
    life: number, radius: number, strong = false): void {
    // Leave capacity for the actual chain/ultimate when an area hit contacts a dense crowd.
    if (kind === 'hit' && this.free.length < 24) return;
    let e = this.free.pop();
    if (!e) {
      const index = this.active.findIndex(f => f.kind === 'hit' || f.kind === 'release');
      if (index < 0) return;
      e = this.active.splice(index, 1)[0];
    }
    e.kind = kind; e.x = x; e.y = y; e.x1 = x1; e.y1 = y1;
    e.age = 0; e.life = life; e.radius = radius; e.strong = strong; e.seed = ++this.serial;
    this.active.push(e); this.dirty = true;
  }

  release(x: number, y: number, dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    this.add('release', x, y, x + dx / len * 63, y + dy / len * 63, .25, 27);
  }
  hit(x: number, y: number, heavy: boolean): void {
    this.add('hit', x, y, x, y, heavy ? .23 : .19, heavy ? 31 : 23, heavy);
  }
  chain(x: number, y: number, x1: number, y1: number, jump: number): void {
    // Damage is instantaneous; each link appears on that same tick, with staggered after-pulses.
    this.add('chain', x, y, x1, y1, .31, jump);
  }
  cast(x: number, y: number, ultimate = false): void {
    this.add('cast', x, y, x, y + (ultimate ? 110 : 54), ultimate ? .42 : .24,
      ultimate ? 44 : 28, true);
  }

  beginProjectileFrame(): void { this.flight.clear(); }

  private color(g: Graphics, rgb: RGB, alpha: number): void {
    this.tint.set(rgb[0], rgb[1], rgb[2], Math.round(Math.max(0, Math.min(255, alpha))));
    g.strokeColor = this.tint; g.fillColor = this.tint;
  }

  private path(points: Float32Array, x: number, y: number, x1: number, y1: number,
    seed: number, amplitude: number, phase: number): number {
    const dx = x1 - x, dy = y1 - y, len = Math.hypot(dx, dy) || 1;
    const segments = Math.max(3, Math.min(40, Math.ceil(len / 23)));
    const flicker = Math.floor(phase * 30);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const offset = i === 0 || i === segments ? 0
        : noise(seed * 19 + i * 3.7 + flicker * .61) * amplitude * Math.sin(t * Math.PI);
      points[i * 2] = x + dx * t - dy / len * offset;
      points[i * 2 + 1] = y + dy * t + dx / len * offset;
    }
    return segments;
  }

  private stroke(g: Graphics, points: Float32Array, segments: number, width: number,
    alpha: number, rgb: RGB): void {
    if (alpha < 1) return;
    this.color(g, rgb, alpha); g.lineWidth = width;
    g.moveTo(points[0], points[1]);
    for (let i = 1; i <= segments; i++) g.lineTo(points[i * 2], points[i * 2 + 1]);
    g.stroke();
  }

  private electric(g: Graphics, points: Float32Array, segments: number, width: number, energy: number): void {
    // Every band follows the same crooked centerline, including the fine white core.
    this.stroke(g, points, segments, width * 3.8, 24 * energy, VIOLET);
    this.stroke(g, points, segments, width * 1.8, 95 * energy, VIOLET);
    this.stroke(g, points, segments, width, 220 * energy, BLUE);
    this.stroke(g, points, segments, Math.max(.6, width * .34), 250 * energy, HOT);
  }

  private glow(g: Graphics, x: number, y: number, radius: number, energy: number): void {
    this.color(g, VIOLET, 18 * energy); g.circle(x, y, radius); g.fill();
    this.color(g, BLUE, 32 * energy); g.circle(x, y, radius * .52); g.fill();
    this.color(g, HOT, 220 * energy); g.circle(x, y, Math.max(.6, radius * .11)); g.fill();
  }

  projectile(x: number, y: number, vx: number, vy: number, size: number, age: number, seed: number): boolean {
    const speed = Math.hypot(vx, vy);
    if (speed < .01) return false;
    const g = this.flight, dx = vx / speed, dy = vy / speed;
    const length = Math.min(166, speed * age), tailX = x - dx * length, tailY = y - dy * length;
    // Tapered ion wake: the length grows with actual distance rather than appearing fully formed.
    for (let k = 0; k < 9; k++) {
      const a = k / 9, b = (k + 1) / 9;
      const w0 = size * .86 * (1 - a), w1 = size * .86 * (1 - b);
      this.color(g, VIOLET, 65 * (1 - a) * (1 - a));
      g.moveTo(x - dx * length * a - dy * w0, y - dy * length * a + dx * w0);
      g.lineTo(x - dx * length * b - dy * w1, y - dy * length * b + dx * w1);
      g.lineTo(x - dx * length * b + dy * w1, y - dy * length * b - dx * w1);
      g.lineTo(x - dx * length * a + dy * w0, y - dy * length * a - dx * w0);
      g.close(); g.fill();
    }
    if (length > 2) {
      const n = this.path(this.spine, x, y, tailX, tailY, seed + 4, 6, age);
      // Fade by segment so the far end does not finish as an equally bright extra bullet.
      for (let k = 0; k < n; k++) {
        this.twig[0] = this.spine[k * 2]; this.twig[1] = this.spine[k * 2 + 1];
        this.twig[2] = this.spine[k * 2 + 2]; this.twig[3] = this.spine[k * 2 + 3];
        this.electric(g, this.twig, 1, 1.65 * (1 - k / n) + .4, (1 - k / n) * .75);
      }
    }
    const head = size * 2.2;
    this.glow(g, x, y, size * 2.7, 1);
    this.color(g, BLUE, 210);
    g.moveTo(x + dx * head, y + dy * head);
    g.lineTo(x - dy * size, y + dx * size);
    g.lineTo(x - dx * head, y - dy * head);
    g.lineTo(x + dy * size, y - dx * size); g.close(); g.fill();
    const n = this.path(this.spine, x - dx * head, y - dy * head,
      x + dx * head, y + dy * head, seed, size * .65, age);
    this.electric(g, this.spine, n, 2.2, 1);
    for (let side = -1; side <= 1; side += 2) {
      const p = (age * 4.2 + seed + (side + 1) * .25) % 1;
      const spread = side * (8 + Math.sin(p * Math.PI) * 10), u = -head * .2 - p * Math.min(length, 55);
      const sx = x + dx * u - dy * spread, sy = y + dy * u + dx * spread;
      const count = this.path(this.twig, sx, sy, sx - dx * 17, sy - dy * 17, seed + side, 4, age);
      this.electric(g, this.twig, count, 1.1, Math.sin(p * Math.PI) * Math.min(1, age / .04));
    }
    return true;
  }

  tick(dt: number): void {
    if (!this.dirty && !this.active.length) return;
    this.air.clear(); this.dirty = false;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i]; e.age += dt;
      if (e.age >= e.life) { this.active.splice(i, 1); this.free.push(e); continue; }
      const t = e.age / e.life, fade = (1 - t) * (1 - t);
      if (e.kind === 'chain') this.link(e, fade);
      else this.burst(e, fade);
      this.dirty = true;
    }
  }

  private link(e: Flash, fade: number): void {
    const pulse = Math.max(Math.exp(-e.age * 20), .62 * Math.exp(-Math.pow((e.age - .09 - e.radius * .008) / .028, 2)));
    const energy = Math.min(1, fade * .55 + pulse);
    const n = this.path(this.spine, e.x, e.y, e.x1, e.y1, e.seed, 18, e.age);
    this.electric(this.air, this.spine, n, 3.3, energy);
    for (let k = 1; k <= 3; k++) {
      const at = Math.min(n - 1, Math.max(1, Math.floor(n * k / 4)));
      const x = this.spine[at * 2], y = this.spine[at * 2 + 1];
      const angle = Math.atan2(e.y1 - e.y, e.x1 - e.x) + (k % 2 ? 1.1 : -1.1);
      const len = 20 + noise(e.seed + k) * 9;
      const count = this.path(this.twig, x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len,
        e.seed + k, 6, e.age);
      this.electric(this.air, this.twig, count, 1.2, energy * .8);
    }
    this.glow(this.air, e.x1, e.y1, 16, energy);
  }

  private rays(g: Graphics, e: Flash, radius: number, energy: number, count: number, squash: number): void {
    const travel = Math.min(1, e.age / .12);
    for (let k = 0; k < count; k++) {
      const angle = k * TAU / count + e.seed * .71;
      const dx = Math.cos(angle), dy = Math.sin(angle) * squash;
      const reach = radius * (.65 + .35 * travel + noise(e.seed + k) * .16);
      const n = this.path(this.twig, e.x + dx * reach * .23, e.y + dy * reach * .23,
        e.x + dx * reach, e.y + dy * reach, e.seed + k, 5 * squash, e.age);
      this.electric(g, this.twig, n, 1.25, energy);
    }
  }

  private burst(e: Flash, fade: number): void {
    const g = this.air;
    this.glow(g, e.x, e.y, e.radius * (.6 + .4 * fade), fade);
    if (e.kind === 'release') {
      const n = this.path(this.spine, e.x, e.y, e.x1, e.y1, e.seed, 12, e.age);
      this.electric(g, this.spine, n, 3.3, fade);
      this.rays(g, e, e.radius * (1 + e.age * 2), fade, 5, 1);
    } else if (e.kind === 'cast') {
      const n = this.path(this.spine, e.x, e.y, e.x1, e.y1, e.seed, 19, e.age);
      this.electric(g, this.spine, n, e.radius > 30 ? 4.2 : 2.6, fade);
      this.rays(g, e, e.radius * (1 + e.age), fade, 7, 1);
    } else this.rays(g, e, e.radius * (.65 + e.age * 4), fade, e.strong ? 6 : 4, 1);
  }
}
