/** Selected-card ground residue. One battle-wide clock/pool, separate from ultimate presentation. */
import { Color, Graphics, Layers, Node } from 'cc';
import { VOLT_FIELD } from '../config/WindNinjaConfig';
import type { MonsterManager } from './Monster';
import type { DamageService } from './DamageService';

interface Field {
  active: boolean; owner: Node | null; ledger: DamageService | null;
  x: number; y: number; damage: number; born: number; expires: number; seed: number;
  cracks: Float32Array;
}
const EPS = 1e-8, TAU = Math.PI * 2, SEAMS = 7, POINTS = 6;
function noise(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class VoltField {
  private static battles = new WeakMap<Node, VoltField>();
  /** All Volt heroes in the same Field share overlap arbitration and the eight-slot budget. */
  static forBattle(battle: Node, time: number): VoltField {
    let fields = this.battles.get(battle);
    if (!fields) { fields = new VoltField(battle, time); this.battles.set(battle, fields); }
    return fields;
  }

  private fields: Field[] = [];
  private owners = new WeakSet<Node>();
  private time: number;
  private nextPulse: number;
  private serial = 0;
  private dirty = false;
  private destroyed = false;
  private g: Graphics | null = null;
  // Reused colors and local geometry: no textures, dark masks or per-frame palette/point buffers.
  private violet = new Color(154, 74, 231, 95);
  private lavender = new Color(209, 151, 255, 220);
  private spark = new Color(225, 185, 255, 230);

  private constructor(private battle: Node, time: number) {
    this.time = time; this.nextPulse = time + VOLT_FIELD.tick;
    for (let i = 0; i < VOLT_FIELD.maxFields; i++) this.fields.push({
      active: false, owner: null, ledger: null, x: 0, y: 0, damage: 0,
      born: 0, expires: 0, seed: 0, cracks: new Float32Array(SEAMS * POINTS * 2),
    });
    battle.once(Node.EventType.NODE_DESTROYED, () => {
      this.destroyed = true; this.g = null; this.fields.length = 0;
      VoltField.battles.delete(battle);
    });
  }

  private alive(p: Field): boolean {
    return p.active && !!p.owner?.isValid && p.owner.activeInHierarchy;
  }
  private release(p: Field): void { p.active = false; p.owner = null; p.ledger = null; }

  /** Called only by an actual ultimate strike, after advanceTo has reached its battle time. */
  leave(owner: Node, x: number, y: number, damage: number, ledger: DamageService | null): void {
    if (this.destroyed || !owner.isValid || !owner.activeInHierarchy ||
      !Number.isFinite(x + y) || !Number.isFinite(damage) || damage <= 0) return;
    let nearest: Field | null = null, free: Field | null = null, oldest: Field | null = null;
    let distance = (VOLT_FIELD.radius * .6) ** 2, occupied = false;
    for (const p of this.fields) {
      if (!this.alive(p) || p.expires <= this.time + EPS) {
        this.release(p); if (!free) free = p; continue;
      }
      occupied = true;
      if (!oldest || p.expires < oldest.expires) oldest = p;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d <= distance) { nearest = p; distance = d; }
    }
    const p = nearest || free || oldest;
    if (!p) return;
    if (!occupied) this.nextPulse = this.time + VOLT_FIELD.tick;
    if (!nearest) {
      p.born = this.time; p.seed = ++this.serial; p.damage = damage; p.owner = owner; p.ledger = ledger;
      this.makeCracks(p);
    } else if (damage >= p.damage) {
      // Refresh one footprint rather than stacking casts; retain its strongest damage/credit.
      p.damage = damage; p.owner = owner; p.ledger = ledger;
    }
    p.active = true; p.x = x; p.y = y; p.expires = this.time + VOLT_FIELD.duration;
    if (!this.owners.has(owner)) {
      this.owners.add(owner);
      owner.once(Node.EventType.NODE_DESTROYED, () => {
        for (const f of this.fields) if (f.owner === owner) this.release(f);
        this.dirty = true;
        if (!this.fields.some(f => this.alive(f)) && this.g?.node.isValid) this.g.clear();
      });
    }
    this.dirty = true;
  }

  /** Absolute hero battle time prevents multiple owners from advancing the shared clock twice. */
  advanceTo(time: number, manager: MonsterManager): void {
    if (this.destroyed || !Number.isFinite(time) || time <= this.time) return;
    this.time = time;
    let lastExpiry = 0;
    for (const p of this.fields) {
      if (!this.alive(p)) { this.release(p); continue; }
      lastExpiry = Math.max(lastExpiry, p.expires);
    }
    // Inclusive expiry gives an unrefreshed 3s field six contacts, at .5 through 3.0.
    const until = Math.min(time, lastExpiry);
    while (this.nextPulse <= until + EPS) {
      this.pulse(this.nextPulse, manager); this.nextPulse += VOLT_FIELD.tick;
    }
    for (const p of this.fields) if (p.active && p.expires <= time + EPS) this.release(p);
    this.dirty = true;
  }

  private pulse(time: number, manager: MonsterManager): void {
    const r2 = VOLT_FIELD.radius ** 2;
    for (const mob of manager.list) {
      if (mob.dead || mob.def.airborne || !mob.node.isValid || !mob.node.activeInHierarchy) continue;
      let strongest: Field | null = null;
      for (const p of this.fields) {
        if (!this.alive(p) || p.born >= time - EPS || p.expires < time - EPS ||
          (mob.x - p.x) ** 2 + (mob.y - p.y) ** 2 > r2) continue;
        if (!strongest || p.damage > strongest.damage) strongest = p;
      }
      if (!strongest) continue;
      // Direct periodic damage only: no projectile/on-hit/stun/shock/field recursion.
      mob.takeDamage(strongest.damage, false, 'volt');
      strongest.ledger?.add('volt', mob.lastDamageTaken);
    }
  }

  private makeCracks(p: Field): void {
    for (let k = 0; k < SEAMS; k++) {
      const angle = k * TAU / SEAMS + (noise(p.seed * 37 + k) - .5) * .55;
      const reach = VOLT_FIELD.radius * (.65 + noise(p.seed * 19 + k) * .3);
      const dx = Math.cos(angle), dy = Math.sin(angle), offset = k * POINTS * 2;
      for (let j = 0; j < POINTS; j++) {
        const t = j / (POINTS - 1), bend = (noise(p.seed * 53 + k * 11 + j) - .5) * 17 * t;
        p.cracks[offset + j * 2] = dx * reach * t - dy * bend;
        p.cracks[offset + j * 2 + 1] = (dy * reach * t + dx * bend) * .48;
      }
    }
  }

  /** Called from renderEffects after all battle substeps. Shared dirty flag paints only once. */
  render(): void {
    if (this.destroyed || !this.dirty) return;
    this.dirty = false;
    const visible = this.fields.some(p => this.alive(p));
    if (!this.g && visible) {
      const ground = this.battle.getChildByName('GroundFxLayer');
      if (!ground?.isValid) return; // Never attach a ground hazard to a hovering hero layer.
      const node = new Node('voltResidualFields'); node.layer = Layers.Enum.UI_2D; node.setParent(ground);
      this.g = node.addComponent(Graphics);
    }
    const g = this.g; if (!g?.node.isValid) return;
    g.clear(); if (!visible) return;
    for (const p of this.fields) {
      if (!this.alive(p)) continue;
      const age = this.time - p.born;
      const fade = Math.min(1, age / .12) * Math.min(1, Math.max(0, p.expires - this.time) / .5);
      const flicker = .78 + .22 * Math.sin(age * 21 + p.seed);
      this.violet.a = Math.round(85 * fade * flicker);
      this.lavender.a = Math.round(205 * fade * flicker);
      for (let layer = 0; layer < 2; layer++) {
        g.strokeColor = layer ? this.lavender : this.violet; g.lineWidth = layer ? 1.1 : 3.8;
        for (let k = 0; k < SEAMS; k++) {
          const offset = k * POINTS * 2;
          g.moveTo(p.x + p.cracks[offset], p.y + p.cracks[offset + 1]);
          for (let j = 1; j < POINTS; j++)
            g.lineTo(p.x + p.cracks[offset + j * 2], p.y + p.cracks[offset + j * 2 + 1]);
        }
        g.stroke();
      }
      // Three low purple wisps and five tiny sparks stay anchored to the crack intersection.
      this.spark.a = Math.round(225 * fade); g.strokeColor = this.spark; g.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        const phase = (age * 1.9 + k / 3 + p.seed * .17) % 1;
        const x = p.x + (k - 1) * 9, y = p.y + 2, sway = Math.sin(age * 16 + k * 2) * 5;
        g.moveTo(x, y); g.lineTo(x + sway, y + 7 + phase * 5);
        g.lineTo(x - sway * .6, y + 13 + phase * 7); g.lineTo(x + sway * .4, y + 20 + phase * 8);
      }
      g.stroke(); g.fillColor = this.spark;
      for (let k = 0; k < 5; k++) {
        const phase = (age * 2.2 + k / 5) % 1, angle = k * 2.4 + p.seed;
        g.circle(p.x + Math.cos(angle) * (5 + phase * 13),
          p.y + Math.sin(angle) * 5 + phase * 14, 1.1 + (1 - phase) * .6);
      }
      g.fill();
    }
  }
}
