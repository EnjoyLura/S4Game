/** Compact, directional contacts with a fast attack and short decay.
 * Ordinary hits have no expanding halo. One bounded pool and one Graphics node.
 */
import { Color, Graphics, Layers, Node } from 'cc';
import { BurningTarget, FireVFX } from './FireVFX';
import { ArcherVFX } from './ArcherVFX';
import { FrostVFX } from './FrostVFX';
import { FrostProjectileVFX } from './FrostProjectileVFX';
import { FrostUltTarget, FrostUltimateVFX } from './FrostUltimateVFX';
import { BasicAttackLaunchVFX } from './BasicAttackLaunchVFX';
import { VoltVFX } from './VoltVFX';
import { VoltUltimateVFX } from './VoltUltimateVFX';
import { SniperUltimateVFX } from './SniperUltimateVFX';

interface Impact { x: number; y: number; life: number; max: number; radius: number; color: string; angle: number; heavy: boolean; hero: string; kind: 'contact' | 'cast' | 'blast'; }
interface CombatCue { kind: string; x: number; y: number; tx: number; ty: number; radius: number; life: number; max: number; }

export const HERO_FX: Record<string, string> = {
  archer: '#F8D886', sniper: '#ABD9F4', pyro: '#FFAD54', volt: '#D2A4FF', mora: '#A6E9F6',
};

export class ImpactFX {
  private g: Graphics;
  private active: Impact[] = [];
  private free: Impact[] = [];
  private cues: CombatCue[] = [];
  private cueFree: CombatCue[] = [];
  private tint = new Color();
  private dirty = false;
  private fire: FireVFX;
  private archer: ArcherVFX;
  private frost: FrostVFX;
  private frostProjectile: FrostProjectileVFX;
  private frostUltimate: FrostUltimateVFX;
  private basicLaunch: BasicAttackLaunchVFX;
  private volt: VoltVFX;
  private voltUltimate: VoltUltimateVFX;
  private sniperUltimate: SniperUltimateVFX;

  constructor(parent: Node, groundParent: Node = parent, projectileParent: Node = parent, depthParent?: Node) {
    this.fire = new FireVFX(parent, groundParent, projectileParent);
    this.archer = new ArcherVFX(parent, projectileParent);
    this.frost = new FrostVFX(groundParent);
    this.frostProjectile = new FrostProjectileVFX(projectileParent);
    this.frostUltimate = new FrostUltimateVFX(groundParent, parent, depthParent);
    this.basicLaunch = new BasicAttackLaunchVFX(parent);
    this.volt = new VoltVFX(parent, projectileParent);
    this.voltUltimate = new VoltUltimateVFX(parent, groundParent);
    this.sniperUltimate = new SniperUltimateVFX(parent, projectileParent);
    const node = new Node('impactEnvelopes');
    node.layer = Layers.Enum.UI_2D;
    node.setParent(parent);
    this.g = node.addComponent(Graphics);
    for (let i = 0; i < 32; i++) this.free.push({ x: 0, y: 0, life: 0, max: 1, radius: 1, color: '', angle: 0, heavy: false, hero: '', kind: 'contact' });
    for (let i = 0; i < 40; i++) this.cueFree.push({ kind: '', x: 0, y: 0, tx: 0, ty: 0, radius: 1, life: 0, max: 1 });
  }

  beginProjectileFrame(): void {
    this.fire.beginProjectileFrame(); this.archer.beginProjectileFrame(); this.frostProjectile.beginProjectileFrame();
    this.volt.beginProjectileFrame();
    this.sniperUltimate.beginFrame();
  }
  iceProjectile(x: number, y: number, vx: number, vy: number, size: number, age: number): boolean {
    return this.frostProjectile.projectile(x, y, vx, vy, size, age);
  }
  arrowProjectile(x: number, y: number, vx: number, vy: number, size: number, age: number, heavy: boolean): boolean {
    return this.archer.projectile(x, y, vx, vy, size, age, heavy);
  }
  arrowRelease(x: number, y: number, dx: number, dy: number, heavy: boolean): boolean {
    return this.archer.release(x, y, dx, dy, heavy);
  }
  normalRelease(hero: string, x: number, y: number, dx: number, dy: number, empowered = false): void {
    if (hero === 'volt') { this.volt.release(x, y, dx, dy); return; }
    this.basicLaunch.release(hero, x, y, dx, dy, empowered);
  }
  voltProjectile(x: number, y: number, vx: number, vy: number, size: number, age: number, seed: number): boolean {
    return this.volt.projectile(x, y, vx, vy, size, age, seed);
  }
  voltChain(x: number, y: number, x1: number, y1: number, jump: number): void {
    this.volt.chain(x, y, x1, y1, jump);
  }
  voltThunder(x: number, y: number, top: number, footY: number, radius: number, power = 1): void {
    this.voltUltimate.strike(x, y, top, footY, radius, power);
  }
  voltCast(x: number, y: number): void { this.volt.cast(x, y); }
  sniperUltimateRelease(x: number, y: number, dx: number, dy: number): void { this.sniperUltimate.release(x, y, dx, dy); }
  sniperUltimateHit(x: number, y: number, angle: number): void { this.sniperUltimate.hit(x, y, angle); }
  sniperUltimateProjectile(x: number, y: number, vx: number, vy: number, age: number, phase: number): boolean {
    return this.sniperUltimate.projectile(x, y, vx, vy, age, phase);
  }
  fireProjectile(x: number, y: number, vx: number, vy: number, size: number): boolean {
    return this.fire.projectile(x, y, vx, vy, size);
  }
  fireCraters(areas: readonly { x: number; y: number; t: number }[], radius: number, clock: number): boolean {
    return this.fire.craters(areas, radius, clock);
  }

  syncBurns(targets: readonly BurningTarget[], dt: number): void { this.fire.syncBurns(targets, dt); }

  frostDomain(x: number, y: number, radius: number, duration: number): void {
    this.frost.domain(x, y, radius, duration);
  }

  frostUlt(targets: readonly FrostUltTarget[]): void { this.frostUltimate.cast(targets); }
  frostUltBurst(targets: readonly FrostUltTarget[]): void { this.frostUltimate.burst(targets); }

  hit(x: number, y: number, hero: string, heavy: boolean, angle?: number): void {
    if (hero === 'volt') { this.volt.hit(x, y, heavy); return; }
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
    // Generic hero cast anchor is +24; the lightning release anchor is +60.
    if (hero === 'volt') { this.volt.cast(x, y + 36, true); return; }
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

  /** Shared code-only role feedback. Low-priority cues never evict a break/heal already playing. */
  combatFeedback(kind: string, x: number, y: number, radius: number, tx = x, ty = y): void {
    if (kind === 'burnBurst') { this.blast(x, y, 'pyro', radius); return; }
    if ((kind === 'rush' || kind === 'armorHit' || kind === 'wardHit') && this.cueFree.length <= 8) return;
    const p = this.cueFree.pop();
    if (!p) return;
    p.kind = kind; p.x = x; p.y = y; p.tx = tx; p.ty = ty; p.radius = radius;
    p.max = p.life = kind === 'armorHit' || kind === 'wardHit' ? .16 : kind === 'rush' ? .24 : kind === 'heal' ? .55 : .4;
    this.cues.push(p); this.dirty = true;
  }

  private drawCombatCues(dt: number): void {
    const g = this.g;
    for (let i = this.cues.length - 1; i >= 0; i--) {
      const p = this.cues[i]; p.life -= dt;
      if (p.life <= 0) { this.cues.splice(i, 1); this.cueFree.push(p); continue; }
      const t = 1 - p.life / p.max, fade = 1 - t;
      if (p.kind === 'heal') {
        this.tint.set(117, 229, 124, Math.round(170 * fade)); g.strokeColor = this.tint; g.lineWidth = 2;
        const travel = Math.min(1, t * 2.8), tail = Math.max(0, travel - .35);
        g.moveTo(p.x + (p.tx - p.x) * tail, p.y + (p.ty - p.y) * tail);
        g.lineTo(p.x + (p.tx - p.x) * travel, p.y + (p.ty - p.y) * travel); g.stroke();
        if (t > .25) {
          const y = p.ty + t * 24, size = 5 + 2 * fade;
          g.lineWidth = 3; g.moveTo(p.tx - size, y); g.lineTo(p.tx + size, y);
          g.moveTo(p.tx, y - size); g.lineTo(p.tx, y + size); g.stroke();
        }
      } else if (p.kind === 'rush') {
        this.tint.set(231, 196, 139, Math.round(150 * fade)); g.strokeColor = this.tint; g.lineWidth = 2 * fade + .5;
        for (let k = 0; k < 3; k++) {
          const x = p.x + (k - 1) * p.radius * .65, y = p.y + t * 28 + k * 4;
          g.moveTo(x, y); g.lineTo(x + (k - 1) * 4, y + 18 + 12 * fade); g.stroke();
        }
      } else {
        const magic = p.kind === 'wardBreak' || p.kind === 'wardHit';
        const breaking = p.kind === 'armorBreak' || p.kind === 'wardBreak', group = p.kind === 'groupKill';
        const interrupt = p.kind === 'interrupt';
        this.tint.set(group || interrupt ? 250 : magic ? 206 : 202,
          group ? 211 : interrupt ? 225 : magic ? 167 : 225,
          group ? 132 : interrupt ? 154 : magic ? 255 : 235, Math.round(235 * fade));
        g.fillColor = this.tint; g.strokeColor = this.tint; g.lineWidth = 1.8;
        const count = breaking ? 6 : group ? 7 : 3;
        const spread = (breaking ? p.radius * 1.5 : group ? 52 : 14) * (t + .2);
        for (let k = 0; k < count; k++) {
          const a = k * Math.PI * 2 / count + .25, dx = Math.cos(a), dy = Math.sin(a);
          const x = p.x + dx * spread, y = p.y + dy * spread - (breaking ? 36 * t * t : 0);
          if (breaking) {
            const s = 3 + 3 * fade;
            g.moveTo(x + s, y); g.lineTo(x, y + s * .6); g.lineTo(x - s, y - s); g.close(); g.fill();
          } else {
            g.moveTo(x, y); g.lineTo(x + dx * (5 + fade * 10), y + dy * (5 + fade * 10)); g.stroke();
          }
        }
      }
    }
  }

  tick(dt: number): void {
    this.fire.tick(dt);
    this.archer.tick(dt);
    this.frost.tick(dt);
    this.frostUltimate.tick(dt);
    this.basicLaunch.tick(dt);
    this.volt.tick(dt);
    this.voltUltimate.tick(dt);
    this.sniperUltimate.tick(dt);
    if (!this.dirty && this.active.length === 0 && this.cues.length === 0) return;
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
    this.drawCombatCues(dt);
  }
}
