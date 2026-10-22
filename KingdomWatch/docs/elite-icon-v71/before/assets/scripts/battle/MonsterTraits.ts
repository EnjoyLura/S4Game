/** Shared, bounded enemy roles; all clocks follow battle simulation time. */
import { Color, Graphics, Node } from 'cc';
import { LO } from '../config/GameConfig';
import type { Monster, MonsterManager } from './Monster';

type DefenseLine = { takeDamage: (damage: number) => void };

export class MonsterTraits {
  private age = 0;
  private summonClock = 0;
  private summoned = 0;
  private regenClock = 0;
  private pendingStrike = 0;
  private revived = false;
  private phase = false;
  private armorDamage = 0;
  private armorBroken = false;
  private armorCueT = 0;
  private cancelledRush = -1;
  private chargeArmed = false;
  private rushCueT = 0;
  private cue: Graphics | null = null;
  private tint = new Color();
  constructor(private owner: Monster) {}

  reset(): void {
    this.age = this.summonClock = this.summoned = this.regenClock = this.pendingStrike = 0;
    this.revived = this.phase = false;
    this.armorDamage = this.armorCueT = this.rushCueT = 0;
    this.armorBroken = this.chargeArmed = false;
    this.cancelledRush = -1;
    this.hide();
  }
  get enraged(): boolean { return this.phase; }
  get physicalResistance(): number { return this.armorBroken ? 0 : this.owner.def.physRes || 0; }
  recordPhysicalHit(raw: number): void {
    if (this.physicalResistance <= 0 || raw <= 0) return;
    this.armorDamage += raw;
    if (this.armorDamage >= this.owner.maxHp * (this.owner.def.armorBreakRatio || .3)) {
      this.armorBroken = true;
      this.owner.applyVuln(.15, 3);
      this.owner.feedback('armorBreak');
    } else if (this.armorCueT <= 0) {
      this.armorCueT = .16;
      this.owner.feedback('armorHit');
    }
  }
  private get rushPhase(): number {
    const rush = this.owner.def.rush;
    if (!rush || this.owner.state !== 'move' || this.age < rush.period ||
      Math.floor(this.age / rush.period) === this.cancelledRush) return -1;
    return this.age % rush.period;
  }
  private get preparingRush(): boolean {
    return this.rushPhase >= 0 && this.rushPhase < (this.owner.def.rush?.windup ?? .55);
  }
  private get charging(): boolean {
    const rush = this.owner.def.rush, phase = this.rushPhase;
    const windup = rush?.windup ?? .55;
    return !!rush && phase >= windup && phase < windup + rush.duration;
  }
  onReachLine(): void { this.chargeArmed = this.charging; }
  private get guarding(): boolean {
    const g = this.owner.def.guard;
    return !!g && this.age >= g.period && this.age % g.period < g.duration;
  }
  speedMultiplier(): number {
    const speed = this.preparingRush ? .4 : this.charging ? this.owner.def.rush!.multiplier : 1;
    return speed * (this.phase ? this.owner.def.phase?.speedMul || 1 : 1);
  }
  damageMultiplier(): number {
    const charge = this.chargeArmed ? this.owner.def.rush?.impactMul || 1 : 1;
    this.chargeArmed = false;
    return charge * (this.phase ? this.owner.def.phase?.attackMul || 1 : 1);
  }
  incomingDamage(amount: number, killer: string): number {
    return killer !== 'gm' && this.guarding ? amount * (1 - this.owner.def.guard!.reduction) : amount;
  }

  tick(dt: number, motionDt: number, line: DefenseLine, manager: MonsterManager): void {
    const o = this.owner, d = o.def;
    if (o.dead) return;
    this.armorCueT = Math.max(0, this.armorCueT - dt);
    if (motionDt < dt) {
      if (this.preparingRush || this.charging) this.cancelledRush = Math.floor(this.age / d.rush!.period);
      this.chargeArmed = false;
    }
    this.age += motionDt;
    if (d.phase && o.hp <= o.maxHp * d.phase.threshold) this.phase = true;
    // A control effect cancels the telegraph; it cannot land a queued hit after interruption.
    if (motionDt < dt) this.pendingStrike = 0;
    else if (this.pendingStrike > 0) {
      this.pendingStrike = Math.max(0, this.pendingStrike - motionDt);
      if (this.pendingStrike === 0) o.strike(line, manager);
    }
    this.rushCueT = Math.max(0, this.rushCueT - dt);
    if (this.charging && motionDt > 0 && this.rushCueT <= 0) {
      this.rushCueT = .2; o.feedback('rush');
    }
    if (motionDt > 0 && o.y < LO.half - d.radius) {
      if (d.regen) {
        this.regenClock += motionDt;
        if (this.regenClock >= 1) {
          const seconds = Math.floor(this.regenClock); this.regenClock -= seconds;
          if (o.hp < o.maxHp) o.heal(Math.min(o.maxHp - o.hp, o.maxHp * d.regen * seconds));
        }
      }
      if (d.kind === 'heal') {
        o.healT -= motionDt;
        if (o.healT <= 0) {
          o.healT += d.atkInterval;
          if (manager.healAround(o, 180, d.healAmount || 40)) o.animateHeal();
        }
      }
      if (d.summon && this.summoned < d.summon.limit) {
        this.summonClock += motionDt;
        if (this.summonClock >= d.summon.every) {
          const made = manager.spawnOffspring(o, d.summon.id, Math.min(d.summon.count, d.summon.limit - this.summoned));
          this.summoned += made;
          // Retry a full battlefield slowly, never accumulate a burst of deferred summons.
          this.summonClock = made ? 0 : Math.max(0, d.summon.every - 1);
        }
      }
    }
    this.drawCue();
  }
  attack(line: DefenseLine, manager: MonsterManager): void {
    const windup = this.owner.def.windup || 0;
    if (windup > 0) { if (this.pendingStrike <= 0) this.pendingStrike = windup; }
    else this.owner.strike(line, manager);
  }
  onLethal(killer: string): boolean {
    const fraction = this.owner.def.revive || 0;
    if (killer === 'gm' || !fraction || this.revived) return false;
    this.revived = true;
    this.owner.hp = Math.max(1, Math.round(this.owner.maxHp * fraction));
    this.pendingStrike = 0;
    return true;
  }
  onDie(killer: string, manager: MonsterManager | null): void {
    const split = this.owner.def.split;
    if (killer !== 'gm' && split && manager) manager.spawnOffspring(this.owner, split.id, split.count);
    this.hide();
  }
  private hide(): void { if (this.cue) this.cue.node.active = false; }
  private drawCue(): void {
    const o = this.owner;
    const armor = this.physicalResistance > 0, healer = o.def.kind === 'heal';
    const preparing = this.preparingRush, charging = this.charging;
    if (!armor && !healer && !preparing && !charging && !this.guarding && this.pendingStrike <= 0) { this.hide(); return; }
    if (!this.cue) {
      const n = new Node('enemyTelegraph'); n.layer = o.node.layer; n.setParent(o.node);
      this.cue = n.addComponent(Graphics);
    }
    const g = this.cue; g.node.active = true; g.clear();
    const top = o.def.radius * 3.2 + 12;
    this.tint.set(24, 31, 39, 220); g.fillColor = this.tint;
    if (armor || healer || preparing || charging) { g.roundRect(-14, top - 4, 28, 25, 5); g.fill(); }
    if (armor) {
      this.tint.set(186, 210, 224, 255); g.strokeColor = this.tint; g.lineWidth = 2;
      g.moveTo(-7, top + 14); g.lineTo(7, top + 14); g.lineTo(6, top + 4);
      g.lineTo(0, top); g.lineTo(-6, top + 4); g.close(); g.stroke();
      g.moveTo(0, top + 12); g.lineTo(0, top + 4); g.stroke();
    } else if (healer) {
      this.tint.set(136, 230, 127, 255); g.strokeColor = this.tint; g.lineWidth = 3;
      g.moveTo(-7, top + 8); g.lineTo(7, top + 8); g.moveTo(0, top + 1); g.lineTo(0, top + 15); g.stroke();
    } else if (preparing || charging) {
      this.tint.set(255, 177, 70, 255); g.strokeColor = this.tint; g.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        const y = top + 15 - i * 8;
        g.moveTo(-6, y); g.lineTo(0, y - 5); g.lineTo(6, y); g.stroke();
      }
      if (preparing) {
        g.lineWidth = 2; g.moveTo(-o.def.radius, -3); g.lineTo(0, -18); g.lineTo(o.def.radius, -3); g.stroke();
      }
    }
    if (this.guarding) {
      this.tint.set(112, 209, 238, 220); g.strokeColor = this.tint; g.lineWidth = 3;
      g.ellipse(0, -o.def.radius * .65, o.def.radius * 1.15, o.def.radius * .4); g.stroke();
    }
    if (this.pendingStrike > 0) {
      const width = o.isBoss ? 84 : 52, y = o.def.radius * 3.2 + (o.isBoss ? 24 : 6);
      const progress = 1 - this.pendingStrike / Math.max(.01, o.def.windup || 1);
      this.tint.set(48, 31, 24, 230); g.fillColor = this.tint; g.rect(-width / 2, y, width, 7); g.fill();
      this.tint.set(255, 158, 53, 255); g.fillColor = this.tint; g.rect(-width / 2, y, width * progress, 7); g.fill();
    }
  }
}
