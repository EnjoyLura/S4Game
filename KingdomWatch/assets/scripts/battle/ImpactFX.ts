/** Compact, directional contacts with a fast attack and short decay.
 * Ordinary hits have no expanding halo. One bounded pool and one Graphics node.
 */
import { Color, Graphics, Layers, Node } from 'cc';
import { FireVFX } from './FireVFX';
import { ArcherVFX } from './ArcherVFX';
import { FrostVFX } from './FrostVFX';

interface Impact { x: number; y: number; life: number; max: number; radius: number; color: string; angle: number; heavy: boolean; hero: string; kind: 'contact' | 'cast' | 'blast'; }

export const HERO_FX: Record<string, string> = {
  archer: '#F8D886', sniper: '#ABD9F4', pyro: '#FFAD54', volt: '#D2A4FF', mora: '#A6E9F6',
};

export class ImpactFX {
  private g: Graphics;
  private active: Impact[] = [];
  private free: Impact[] = [];
  private tint = new Color();
  private dirty = false;
  private fire: FireVFX;
  private archer: ArcherVFX;
  private frost: FrostVFX;

  constructor(parent: Node, groundParent: Node = parent, projectileParent: Node = parent) {
    this.fire = new FireVFX(parent, groundParent, projectileParent);
    this.archer = new ArcherVFX(parent, projectileParent);
    this.frost = new FrostVFX(parent, groundParent);
    const node = new Node('impactEnvelopes');
    node.layer = Layers.Enum.UI_2D;
    node.setParent(parent);
    this.g = node.addComponent(Graphics);
    for (let i = 0; i < 32; i++) this.free.push({ x: 0, y: 0, life: 0, max: 1, radius: 1, color: '', angle: 0, heavy: false, hero: '', kind: 'contact' });
  }

  beginProjectileFrame(): void { this.fire.beginProjectileFrame(); this.archer.beginProjectileFrame(); }
  arrowProjectile(x: number, y: number, vx: number, vy: number, size: number, age: number, heavy: boolean): boolean {
    return this.archer.projectile(x, y, vx, vy, size, age, heavy);
  }
  arrowRelease(x: number, y: number, dx: number, dy: number, heavy: boolean): boolean {
    return this.archer.release(x, y, dx, dy, heavy);
  }
  fireProjectile(x: number, y: number, vx: number, vy: number, size: number): boolean {
    return this.fire.projectile(x, y, vx, vy, size);
  }
  fireCraters(areas: readonly { x: number; y: number; t: number }[], radius: number, clock: number): boolean {
    return this.fire.craters(areas, radius, clock);
  }

  frostDomain(x: number, y: number, radius: number, duration: number): void {
    this.frost.domain(x, y, radius, duration);
  }

  hit(x: number, y: number, hero: string, heavy: boolean, angle?: number): void {
    if (hero === 'archer' && this.archer.hit(x, y, heavy, angle)) return;
    if (hero === 'pyro') {
      // 首选图生视频灼烧序列；未就绪退回引擎火团，再退回矢量描边。
      if (this.fire.hitClip(x, y, heavy)) return;
      if (this.fire.hit(x, y, heavy, angle)) return;
    }
    this.contact(x, y, hero, heavy, angle);
  }

  private contact(x: number, y: number, hero: string, heavy: boolean, angle?: number): void {
    const p = this.free.pop() || this.active.shift();
    if (!p) return;
    p.x = x; p.y = y; p.color = HERO_FX[hero] || '#EADFC2'; p.heavy = heavy; p.hero = hero; p.kind = 'contact';
    p.max = p.life = heavy ? 0.22 : 0.12;
    p.radius = heavy ? 22 : 11;
    p.angle = angle ?? (hero === 'volt' || hero === 'pyro' ? -Math.PI / 2 : Math.PI / 2);
    this.active.push(p); this.dirty = true;
  }

  cast(x: number, y: number, hero: string): void {
    this.contact(x, y, hero, false);
    const p = this.active[this.active.length - 1];
    if (p) { p.kind = 'cast'; p.radius = 19; p.max = p.life = 0.16; }
  }

  /** A local hot core and ground dust, sized below the gameplay warning circle. */
  blast(x: number, y: number, hero: string, radius: number): void {
    if (hero === 'pyro' && this.fire.blast(x, y, radius)) return;
    this.contact(x, y, hero, true, Math.PI / 2);
    const p = this.active[this.active.length - 1];
    if (p) { p.kind = 'blast'; p.radius = Math.min(60, radius * 0.45); p.max = p.life = 0.28; }
  }

  tick(dt: number): void {
    this.fire.tick(dt);
    this.archer.tick(dt);
    this.frost.tick(dt);
    if (!this.dirty && this.active.length === 0) return;
    this.g.clear(); this.dirty = false;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]; p.life -= dt;
      if (p.life <= 0) { this.active.splice(i, 1); this.free.push(p); continue; }
      const t = 1 - p.life / p.max, fade = 1 - t;
      const r = p.radius * (0.65 + (1 - Math.pow(fade, 3)) * 0.5);
      if (p.kind === 'blast') {
        this.tint.set(71, 47, 26, Math.round(75 * fade));
        this.g.strokeColor = this.tint; this.g.lineWidth = 6 * fade + 1;
        this.g.ellipse(p.x, p.y - 6, r * 1.4, r * 0.56); this.g.stroke();
        Color.fromHEX(this.tint, p.color); this.tint.a = Math.round(150 * fade * fade);
        this.g.fillColor = this.tint;
        this.g.ellipse(p.x, p.y, r * 0.38 * fade, r * 0.28 * fade); this.g.fill();
      }
      if (t < 0.28) {
        this.tint.set(255, 248, 221, Math.round(245 * (1 - t / 0.28)));
        this.g.fillColor = this.tint;
        this.g.circle(p.x, p.y, Math.max(1, p.radius * 0.2 * (1 - t / 0.28))); this.g.fill();
      }
      Color.fromHEX(this.tint, p.color); this.tint.a = Math.round(230 * fade * fade);
      this.g.strokeColor = this.tint; this.g.fillColor = this.tint;
      this.g.lineWidth = p.heavy ? 2.4 : 1.6;
      const dx = Math.cos(p.angle), dy = Math.sin(p.angle);
      if (p.kind === 'contact' && (p.hero === 'archer' || p.hero === 'sniper')) {
        // The strong axis follows the actual projectile, giving penetration a readable direction.
        this.g.moveTo(p.x - dx * r * 0.8, p.y - dy * r * 0.8);
        this.g.lineTo(p.x + dx * r * 1.2, p.y + dy * r * 1.2); this.g.stroke();
      }
      const count = p.kind === 'blast' ? 7 : p.heavy ? 5 : 3;
      for (let k = 0; k < count; k++) {
        const a = p.angle + (p.kind === 'blast' ? k * Math.PI * 2 / count : (k - (count - 1) / 2) * 0.72);
        const ax = Math.cos(a), ay = Math.sin(a), inner = r * (0.2 + t * 0.4), outer = r * (0.72 + (k % 2) * 0.24);
        if (p.hero === 'mora') {
          // Small sharp ice fragments, rather than another luminous ring.
          this.g.moveTo(p.x + ax * outer, p.y + ay * outer);
          this.g.lineTo(p.x + ax * inner - ay * 2, p.y + ay * inner + ax * 2);
          this.g.lineTo(p.x + ax * inner + ay * 2, p.y + ay * inner - ax * 2);
          this.g.close(); this.g.fill();
        } else {
          this.g.moveTo(p.x + ax * inner, p.y + ay * inner);
          if (p.hero === 'volt') this.g.lineTo(p.x + ax * r * 0.5 - ay * 3, p.y + ay * r * 0.5 + ax * 3);
          this.g.lineTo(p.x + ax * outer, p.y + ay * outer);
        }
      }
      if (p.hero !== 'mora') this.g.stroke();
    }
  }
}
